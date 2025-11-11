namespace AMBAR {
    let serialInitialized = false

    /**
     * Initialisiert die serielle Schnittstelle für AMBAR (automatisch beim ersten Nutzen).
     */
    function ensureSerialInitialized(): void {
        if (!serialInitialized) {
            serial.setBaudRate(BaudRate.BaudRate57600)
            serialInitialized = true
        }
    }

    export enum Channel { A, B, C, D, E }
    export enum DefaultNoteLength { Quarter, Sixteenth, Eighth, Half, Whole }
    export enum TimeSignature { FourFour, ThreeFour, TwoFour, SixEight, NineEight, TwelveEight }
    export enum Key { G, C, D, A, E, B, FSharp, F, BFlat, EFlat, AFlat, DFlat, GFlat }

    let manualNoteIndex = 0
    let manualNoteString = ""
    let manualKey = Key.G
    let manualChannel = Channel.A
    let lastValuePerChannel: (number | undefined)[] = [undefined, undefined, undefined, undefined, undefined];

    /**
     * Sende eine Zahl über die serielle Schnittstelle im AMBAR-Format.
     * Sendet nur, wenn sich der Wert pro Kanal geändert hat.
     * @param value die Zahl, die gesendet werden soll
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    export function sendNumber(value: number, channel: Channel): void {
        ensureSerialInitialized()
        if (lastValuePerChannel[channel] !== value) {
            let chLetter = channelToLetter(channel)
            serial.writeString("s" + chLetter + value + "e")
            lastValuePerChannel[channel] = value
        }
    }

    /**
     * Event-Handler: Wenn ein serielles Datenpaket im AMBAR-Format empfangen wird.
     * Ruft die bereitgestellte Funktion auf und übergibt die empfangene Zahl.
     * @param handler Funktion, die bei Empfang einer Zahl aufgerufen wird
     */
    export function onSerialReceived(handler: (value: number) => void): void {
        ensureSerialInitialized()
        serial.onDataReceived("e", function () {
            let raw = serial.readUntil("e")
            if (raw && raw.length > 2 && raw.charAt(0) == 's') {
                const channelChar = raw.charAt(1)
                const numberStr = raw.substr(2)
                const num = parseInt(numberStr)
                if (!isNaN(num) && "abcde".indexOf(channelChar) >= 0) {
                    handler(num)
                }
            }
        })
    }

    /**
     * Spiele ABC-Notation ab und sende Frequenzen über WebSerial (v15)
     * Die Symbole ^, = und _ werden (vor einer Note) verwendet, um jeweils ein Kreuz (♯), ein Auflösungszeichen (♮) oder ein Be (♭) zu erzeugen.
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param timeSignature die Taktart
     * @param key die Tonart
     * @param defaultNoteLength die Standard-Notenlänge
     * @param tempo das Tempo in BPM
     * @param notes die Noten in ABC-Notation
     */
    export function playABCNotation(channel: Channel, timeSignature: TimeSignature, key: Key, defaultNoteLength: DefaultNoteLength, tempo: number, notes: string): void {
        ensureSerialInitialized()
        let beatDuration = 60000 / tempo
        parseAndPlayNotes(notes, beatDuration, channel, key, timeSignature, defaultNoteLength)
    }

    /**
     * ABC manuelles Tempo - spielt jeweils eine Note bei jedem Aufruf
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param key die Tonart
     * @param notes die Noten in ABC-Notation
     */
    export function playABCManualTempo(channel: Channel, key: Key, notes: string): void {
        ensureSerialInitialized()
        if (manualNoteString != notes || manualKey != key || manualChannel != channel) {
            manualNoteIndex = 0
            manualNoteString = notes
            manualKey = key
            manualChannel = channel
        }
        let frequency = getNextNoteFrequency()
        if (frequency > 0) {
            sendNumber(frequency, channel)
        }
    }

    /**
     * ABC-Ton beenden - sendet 0 über WebSerial
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    export function stopABCTone(channel: Channel): void {
        ensureSerialInitialized()
        sendNumber(0, channel)
    }

    // Hilfsfunktion: Hole die nächste Note und erhöhe den Index
    function getNextNoteFrequency(): number {
        if (manualNoteIndex >= manualNoteString.length) {
            manualNoteIndex = 0
            return 0
        }
        let i = manualNoteIndex
        while (i < manualNoteString.length) {
            let char = manualNoteString.charAt(i)
            if (char != '|' && char != ':' && char != ' ') break
            i++
        }
        if (i >= manualNoteString.length) {
            manualNoteIndex = 0
            return 0
        }
        let noteName = ''
        let octave = 0
        let accidental = ''
        let char = manualNoteString.charAt(i)
        if (char == '^') {
            accidental = '#'
            i++
            if (i >= manualNoteString.length) { manualNoteIndex = 0; return 0 }
            char = manualNoteString.charAt(i)
        } else if (char == '=') {
            accidental = '='
            i++
            if (i >= manualNoteString.length) { manualNoteIndex = 0; return 0 }
            char = manualNoteString.charAt(i)
        } else if (char == '_') {
            accidental = 'b'
            i++
            if (i >= manualNoteString.length) { manualNoteIndex = 0; return 0 }
            char = manualNoteString.charAt(i)
        }
        if ('ABCDEFGabcdefg'.indexOf(char) >= 0) {
            noteName = char
            i++
            if (accidental == '' && i < manualNoteString.length && (manualNoteString.charAt(i) == '#' || manualNoteString.charAt(i) == 'b')) {
                accidental = manualNoteString.charAt(i)
                i++
            }
            if (char >= 'A' && char <= 'G') { octave = 4 } else { octave = 5 }
            while (i < manualNoteString.length && manualNoteString.charAt(i) == '\'') { octave++; i++ }
            while (i < manualNoteString.length && manualNoteString.charAt(i) == ',') { octave--; i++ }
            if (i < manualNoteString.length && manualNoteString.charAt(i) >= '0' && manualNoteString.charAt(i) <= '9') { i++ }
            else if (i < manualNoteString.length && manualNoteString.charAt(i) == '/') {
                i++
                if (i < manualNoteString.length && manualNoteString.charAt(i) >= '0' && manualNoteString.charAt(i) <= '9') i++
            }
            manualNoteIndex = i
            return noteToFrequencyWithKey(noteName + accidental, octave, manualKey)
        } else {
            manualNoteIndex = i + 1
            return getNextNoteFrequency()
        }
    }

    function parseAndPlayNotes(noteString: string, beatDuration: number, channel: Channel, key: Key, timeSignature: TimeSignature, defaultNoteLength: DefaultNoteLength): void {
        let i = 0
        let baseDuration = calculateBaseDuration(beatDuration, timeSignature)
        let baseNoteFraction = getDefaultNoteFraction(defaultNoteLength)
        while (i < noteString.length) {
            let char = noteString.charAt(i)
            if (char == '|' || char == ':' || char == ' ') { i++; continue }
            let noteName = ''
            let octave = 0
            let duration = 1
            let accidental = ''
            if (char == '^') { accidental = '#'; i++; char = noteString.charAt(i) }
            else if (char == '=') { accidental = '='; i++; char = noteString.charAt(i) }
            else if (char == '_') { accidental = 'b'; i++; char = noteString.charAt(i) }
            if ('ABCDEFGabcdefg'.indexOf(char) >= 0) {
                noteName = char
                i++
                if (accidental == '' && i < noteString.length && (noteString.charAt(i) == '#' || noteString.charAt(i) == 'b')) { accidental = noteString.charAt(i); i++ }
                if (char >= 'A' && char <= 'G') { octave = 4 } else { octave = 5 }
                while (i < noteString.length && noteString.charAt(i) == '\'') { octave++; i++ }
                while (i < noteString.length && noteString.charAt(i) == ',') { octave--; i++ }
                if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') { duration = parseInt(noteString.charAt(i)); i++ }
                else if (i < noteString.length && noteString.charAt(i) == '/') {
                    i++
                    if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') { duration = 1 / parseInt(noteString.charAt(i)); i++ }
                    else duration = 0.5
                }
                let frequency = noteToFrequencyWithKey(noteName + accidental, octave, key)
                let noteDuration = Math.round(baseDuration * baseNoteFraction * duration)
                sendNumber(frequency, channel)
                basic.pause(noteDuration)
                sendNumber(0, channel)
                basic.pause(50)
            } else i++
        }
    }

    function getDefaultNoteFraction(defaultNoteLength: DefaultNoteLength): number {
        switch (defaultNoteLength) {
            case DefaultNoteLength.Whole:     return 4
            case DefaultNoteLength.Half:      return 2
            case DefaultNoteLength.Quarter:   return 1
            case DefaultNoteLength.Eighth:    return 0.5
            case DefaultNoteLength.Sixteenth: return 0.25
            default:                          return 1
        }
    }

    function calculateBaseDuration(beatDuration: number, timeSignature: TimeSignature): number {
        switch (timeSignature) {
            case TimeSignature.FourFour:
            case TimeSignature.ThreeFour:
            case TimeSignature.TwoFour:      return beatDuration
            case TimeSignature.SixEight:
            case TimeSignature.NineEight:
            case TimeSignature.TwelveEight:  return beatDuration / 2
            default:                         return beatDuration
        }
    }

    function noteToFrequencyWithKey(noteName: string, octave: number, key: Key): number {
        let baseNote = noteName.charAt(0).toUpperCase()
        let accidental = noteName.length > 1 ? noteName.charAt(1) : ''
        let baseFreq: number
        switch (baseNote) {
            case 'C': baseFreq = 261.63; break
            case 'D': baseFreq = 293.66; break
            case 'E': baseFreq = 329.63; break
            case 'F': baseFreq = 349.23; break
            case 'G': baseFreq = 392.00; break
            case 'A': baseFreq = 440.00; break
            case 'B': baseFreq = 493.88; break
            default: return 0
        }
        if (accidental == '#') { baseFreq *= 1.059463 }
        else if (accidental == 'b') { baseFreq /= 1.059463 }
        else if (accidental == '=') { /* nichts machen */ }
        else { baseFreq = applyKeySignature(baseNote, baseFreq, key) }
        let octaveMultiplier = Math.pow(2, octave - 4)
        return Math.round(baseFreq * octaveMultiplier)
    }

    function applyKeySignature(note: string, frequency: number, key: Key): number {
        let keySignatures = getKeySignature(key)
        for (let i = 0; i < keySignatures.length; i++) {
            if (keySignatures.charAt(i) == note) {
                if (isSharpKey(key)) { return frequency * 1.059463 }
                else { return frequency / 1.059463 }
            }
        }
        return frequency
    }

    function getKeySignature(key: Key): string {
        switch (key) {
            case Key.C:       return ""
            case Key.G:       return "F"
            case Key.D:       return "FC"
            case Key.A:       return "FCG"
            case Key.E:       return "FCGD"
            case Key.B:       return "FCGDA"
            case Key.FSharp:  return "FCGDAE"
            case Key.F:       return "B"
            case Key.BFlat:   return "BE"
            case Key.EFlat:   return "BEA"
            case Key.AFlat:   return "BEAD"
            case Key.DFlat:   return "BEADG"
            case Key.GFlat:   return "BEADGC"
            default: return ""
        }
    }

    function isSharpKey(key: Key): boolean {
        return key == Key.G || key == Key.D || key == Key.A || key == Key.E || key == Key.B || key == Key.FSharp
    }

    function channelToLetter(ch: Channel): string {
        const letters = ["a", "b", "c", "d", "e"]
        return letters[ch] || "a"
    }
}
