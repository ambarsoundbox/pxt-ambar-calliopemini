namespace AMBAR {
    /**
     * Aufzählungstyp für die Kanäle A-E
     */
    export enum Channel {
      //% block="A"
      A,
      //% block="B"
      B,
      //% block="C"
      C,
      //% block="D"
      D,
      //% block="E"
      E
    }

    /**
     * Aufzählungstyp für Standard-Notenlängen
     */
    export enum DefaultNoteLength {
        //% block="1/4"
        Quarter,
        //% block="1/16"
        Sixteenth,
        //% block="1/8"
        Eighth,
        //% block="1/2"
        Half,
        //% block="1/1"
        Whole
    }

    /**
     * Aufzählungstyp für Taktarten
     */
    export enum TimeSignature {
        //% block="4/4"
        FourFour,
        //% block="3/4"
        ThreeFour,
        //% block="2/4"
        TwoFour,
        //% block="6/8"
        SixEight,
        //% block="9/8"
        NineEight,
        //% block="12/8"
        TwelveEight
    }

    /**
     * Aufzählungstyp für Tonarten
     */
    export enum Key {
        //% block="G-Dur"
        G,
        //% block="C-Dur"
        C,
        //% block="D-Dur"
        D,
        //% block="A-Dur"
        A,
        //% block="E-Dur"
        E,
        //% block="H-Dur"
        B,
        //% block="Fis-Dur"
        FSharp,
        //% block="F-Dur"
        F,
        //% block="B-Dur"
        BFlat,
        //% block="Es-Dur"
        EFlat,
        //% block="As-Dur"
        AFlat,
        //% block="Des-Dur"
        DFlat,
        //% block="Ges-Dur"
        GFlat
    }

    // Konstanten für bessere Wartbarkeit
    const BAUD_RATE = 115200
    const NOTE_GAP_MS = 50
    const START_MARKER = "s"
    const END_MARKER = "e"
    const VALID_CHANNELS = "abcde"
    const SEMITONE_RATIO = 1.059463094  // 2^(1/12) - präziser Wert

    // Globale Variablen für manuelles Tempo
    let manualNoteIndex = 0
    let manualNoteString = ""
    let manualKey = Key.G
    let manualChannel = Channel.A
    let isSerialInitialized = false
    
    // Cache für aktuelle Werte pro Kanal
    let channelValues: number[] = [-1, -1, -1, -1, -1]  // Ein Wert pro Kanal (A-E)

    /**
     * Initialisiert die serielle Schnittstelle (intern)
     */
    function initSerial(): void {
        if (!isSerialInitialized) {
            serial.setBaudRate(BAUD_RATE)
            isSerialInitialized = true
        }
    }

    /**
     * Sende eine Zahl über die serielle Schnittstelle im AMBAR-Format.
     * @param value die Zahl, die gesendet werden soll
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    //% block="sende Zahl %value an AMBAR auf den Kanal %channel"
    //% value.min=0 value.max=20000
    //% color=#cd7f32 weight=100
    export function sendNumber(value: number, channel: Channel): void {
        initSerial()
        
        // Validierung der Eingabe
        if (value < 0) value = 0
        if (value > 20000) value = 20000
        
        const roundedValue = Math.round(value)
        const channelIndex = channel as number
        
        // Nur senden wenn sich der Wert geändert hat
        if (channelValues[channelIndex] === roundedValue) {
            return  // Wert unverändert, nicht senden
        }
        
        // Wert hat sich geändert, Cache aktualisieren und senden
        channelValues[channelIndex] = roundedValue
        
        const chLetter = channelToLetter(channel)
        serial.writeString(START_MARKER + chLetter + roundedValue + END_MARKER)
    }

    /**
     * Event-Handler: Wenn ein serielles Datenpaket im AMBAR-Format empfangen wird.
     * Ruft die bereitgestellte Funktion auf und übergibt die empfangene Zahl.
     * @param handler Funktion, die bei Empfang einer Zahl aufgerufen wird
     */
    //% block="wenn Zahl von AMBAR empfangen"
    //% draggableParameters="reporter"
    //% color=#cd7f32 weight=90
    export function onSerialReceived(handler: (value: number) => void): void {
        initSerial()
        
        serial.onDataReceived(END_MARKER, function () {
            const raw = serial.readUntil(END_MARKER)
            
            if (!raw || raw.length < 3) return
            if (raw.charAt(0) != START_MARKER.charAt(0)) return
            
            const channelChar = raw.charAt(1)
            if (VALID_CHANNELS.indexOf(channelChar) < 0) return
            
            const numberStr = raw.substr(2)
            const num = parseInt(numberStr)
            
            if (!isNaN(num) && num >= 0) {
                handler(num)
            }
        })
    }

    /**
     * Spiele ABC-Notation ab und sende Frequenzen über WebSerial
     * Die Symbole ^, = und _ werden (vor einer Note) verwendet, um jeweils ein Kreuz (♯), ein Auflösungszeichen (♮) oder ein Be (♭) zu erzeugen.
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param timeSignature die Taktart
     * @param key die Tonart
     * @param defaultNoteLength die Standard-Notenlänge
     * @param tempo das Tempo in BPM
     * @param notes die Noten in ABC-Notation
     */
    //% block="ABC-Notation (v16) an Kanal %channel Taktart %timeSignature Tonart %key Standard-Notenlänge %defaultNoteLength Tempo %tempo Noten %notes"
    //% tempo.min=60 tempo.max=200 tempo.defl=120
    //% timeSignature.defl=TimeSignature.FourFour
    //% key.defl=Key.G
    //% defaultNoteLength.defl=DefaultNoteLength.Quarter
    //% notes.defl="|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|GABc dedB|dedB dedB|c2ec B2dB|A2F2 G4:||:g2gf gdBd|g2f2 e2d2|c2ec B2dB|c2A2 A2df|g2gf g2Bd|g2f2 e2d2|c2ec B2dB|A2F2 G4:|"
    //% color=#cd7f32 weight=80
    export function playABCNotation(channel: Channel, timeSignature: TimeSignature, key: Key, defaultNoteLength: DefaultNoteLength, tempo: number, notes: string): void {
        initSerial()
        
        // Validierung
        if (tempo < 60) tempo = 60
        if (tempo > 200) tempo = 200
        if (!notes || notes.length == 0) return
        
        // Berechne die Grundnotenlänge basierend auf Tempo (in ms)
        const beatDuration = 60000 / tempo  // Eine Viertelnote in Millisekunden
        
        // Parse und spiele Noten mit Tonart-Anpassung
        parseAndPlayNotes(notes, beatDuration, channel, key, timeSignature, defaultNoteLength)
    }

    /**
     * ABC manuelles Tempo - spielt jeweils eine Note bei jedem Aufruf
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param key die Tonart
     * @param notes die Noten in ABC-Notation
     */
    //% block="ABC manuelles Tempo an Kanal %channel Tonart %key Noten %notes"
    //% key.defl=Key.G
    //% notes.defl="|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|GABc dedB|dedB dedB|c2ec B2dB|A2F2 G4:||:g2gf gdBd|g2f2 e2d2|c2ec B2dB|c2A2 A2df|g2gf g2Bd|g2f2 e2d2|c2ec B2dB|A2F2 G4:|"
    //% color=#cd7f32 weight=70
    export function playABCManualTempo(channel: Channel, key: Key, notes: string): void {
        initSerial()
        
        if (!notes || notes.length == 0) return
        
        // Wenn neue Parameter, dann Index zurücksetzen
        if (manualNoteString != notes || manualKey != key || manualChannel != channel) {
            manualNoteIndex = 0
            manualNoteString = notes
            manualKey = key
            manualChannel = channel
        }
        
        // Spiele die nächste Note
        const frequency = getNextNoteFrequency()
        if (frequency > 0) {
            sendNumber(frequency, channel)
        } else if (frequency == 0 && manualNoteIndex == 0) {
            // Ende erreicht und zurückgesetzt
            sendNumber(0, channel)
        }
    }

    /**
     * ABC-Ton beenden - sendet 0 über WebSerial
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    //% block="ABC-Ton beenden an Kanal %channel"
    //% color=#cd7f32 weight=60
    export function stopABCTone(channel: Channel): void {
        initSerial()
        sendNumber(0, channel)
    }

    /**
     * Setze den manuellen Tempo-Index zurück
     */
    //% block="ABC manuelles Tempo zurücksetzen"
    //% color=#cd7f32 weight=50
    export function resetManualTempo(): void {
        manualNoteIndex = 0
    }
    
    /**
     * Setze den Kanal-Cache zurück (erzwingt erneutes Senden beim nächsten Aufruf)
     * @param channel der Kanal (A-E) der zurückgesetzt werden soll
     */
    //% block="Kanal %channel zurücksetzen"
    //% color=#cd7f32 weight=40
    export function resetChannel(channel: Channel): void {
        const channelIndex = channel as number
        channelValues[channelIndex] = -1
    }
    
    /**
     * Setze alle Kanal-Caches zurück
     */
    //% block="alle Kanäle zurücksetzen"
    //% color=#cd7f32 weight=35
    export function resetAllChannels(): void {
        for (let i = 0; i < channelValues.length; i++) {
            channelValues[i] = -1
        }
    }

    // Hilfsfunktion: Hole die nächste Note und erhöhe den Index
    function getNextNoteFrequency(): number {
        if (manualNoteIndex >= manualNoteString.length) {
            manualNoteIndex = 0
            return 0
        }

        let i = manualNoteIndex
        
        // Überspringe Balken, Doppelpunkte, Leerzeichen und Wiederholungszeichen
        while (i < manualNoteString.length) {
            const char = manualNoteString.charAt(i)
            if (char != '|' && char != ':' && char != ' ') {
                break
            }
            i++
        }
        
        if (i >= manualNoteString.length) {
            manualNoteIndex = 0
            return 0
        }
        
        // Note und Eigenschaften parsen
        const noteInfo = parseNote(manualNoteString, i)
        if (noteInfo.success) {
            manualNoteIndex = noteInfo.nextIndex
            return noteInfo.frequency
        } else {
            // Bei Fehler: überspringe Zeichen und versuche nächstes
            manualNoteIndex = i + 1
            if (manualNoteIndex < manualNoteString.length) {
                return getNextNoteFrequency()
            } else {
                manualNoteIndex = 0
                return 0
            }
        }
    }

    // Hilfsfunktion: Parse eine einzelne Note
    function parseNote(noteString: string, startIndex: number): {success: boolean, frequency: number, nextIndex: number, duration: number} {
        let i = startIndex
        let accidental = ''
        let char = noteString.charAt(i)
        
        // Prüfe auf explizite Vorzeichen vor der Note
        if (char == '^') {
            accidental = '#'
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        } else if (char == '=') {
            accidental = '='
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        } else if (char == '_') {
            accidental = 'b'
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        }
        
        // Notennamen erfassen (A-G, a-g oder z für Pause)
        if ('ABCDEFGabcdefgz'.indexOf(char) < 0) {
            return {success: false, frequency: 0, nextIndex: i, duration: 1}
        }
        
        const noteName = char
        i++
        
        // Pause erkennen
        if (noteName == 'z') {
            // Länge der Pause parsen (optional)
            let duration = 1
            if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                duration = parseInt(noteString.charAt(i))
                i++
            }
            return {success: true, frequency: 0, nextIndex: i, duration: duration}
        }
        
        // Weitere Vorzeichen erfassen (# für Kreuz, b für Be)
        if (accidental == '' && i < noteString.length && (noteString.charAt(i) == '#' || noteString.charAt(i) == 'b')) {
            accidental = noteString.charAt(i)
            i++
        }
        
        // Oktave bestimmen
        let octave = (char >= 'A' && char <= 'G') ? 4 : 5
        
        // Zusätzliche Oktav-Markierungen
        while (i < noteString.length && noteString.charAt(i) == '\'') {
            octave++
            i++
        }
        while (i < noteString.length && noteString.charAt(i) == ',') {
            octave--
            i++
        }
        
        // Notenlänge erfassen
        let duration = 1
        if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
            duration = parseInt(noteString.charAt(i))
            i++
        } else if (i < noteString.length && noteString.charAt(i) == '/') {
            i++
            if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                duration = 1 / parseInt(noteString.charAt(i))
                i++
            } else {
                duration = 0.5
            }
        }
        
        // Frequenz berechnen
        const frequency = noteToFrequencyWithKey(noteName + accidental, octave, manualKey)
        
        return {success: true, frequency: frequency, nextIndex: i, duration: duration}
    }

    // Hilfsfunktion: Parse und spiele die Noten
    function parseAndPlayNotes(noteString: string, beatDuration: number, channel: Channel, key: Key, timeSignature: TimeSignature, defaultNoteLength: DefaultNoteLength): void {
        let i = 0
        const baseDuration = calculateBaseDuration(beatDuration, timeSignature)
        const baseNoteFraction = getDefaultNoteFraction(defaultNoteLength)
        
        while (i < noteString.length) {
            const char = noteString.charAt(i)
            
            // Überspringe Balken und andere Zeichen
            if (char == '|' || char == ':' || char == ' ') {
                i++
                continue
            }
            
            // Note parsen
            const noteInfo = parseNoteForPlayback(noteString, i, key)
            
            if (noteInfo.success) {
                i = noteInfo.nextIndex
                
                const noteDuration = Math.round(baseDuration * baseNoteFraction * noteInfo.duration)
                
                if (noteInfo.frequency > 0) {
                    // Normale Note abspielen
                    sendNumber(noteInfo.frequency, channel)
                    basic.pause(noteDuration)
                    sendNumber(0, channel)
                    basic.pause(NOTE_GAP_MS)
                } else {
                    // Pause
                    sendNumber(0, channel)
                    basic.pause(noteDuration)
                }
            } else {
                i++
            }
        }
        
        // Sicherstellen, dass am Ende kein Ton mehr spielt
        sendNumber(0, channel)
    }

    // Hilfsfunktion: Parse Note für Playback (inkl. Tonart)
    function parseNoteForPlayback(noteString: string, startIndex: number, key: Key): {success: boolean, frequency: number, nextIndex: number, duration: number} {
        let i = startIndex
        let accidental = ''
        let char = noteString.charAt(i)
        
        // Explizite Vorzeichen
        if (char == '^') {
            accidental = '#'
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        } else if (char == '=') {
            accidental = '='
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        } else if (char == '_') {
            accidental = 'b'
            i++
            if (i >= noteString.length) return {success: false, frequency: 0, nextIndex: i, duration: 1}
            char = noteString.charAt(i)
        }
        
        // Notennamen erfassen
        if ('ABCDEFGabcdefgz'.indexOf(char) < 0) {
            return {success: false, frequency: 0, nextIndex: i, duration: 1}
        }
        
        const noteName = char
        i++
        
        // Pause
        if (noteName == 'z') {
            let duration = 1
            if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                duration = parseInt(noteString.charAt(i))
                i++
            }
            return {success: true, frequency: 0, nextIndex: i, duration: duration}
        }
        
        // Weitere Vorzeichen
        if (accidental == '' && i < noteString.length && (noteString.charAt(i) == '#' || noteString.charAt(i) == 'b')) {
            accidental = noteString.charAt(i)
            i++
        }
        
        // Oktave
        let octave = (char >= 'A' && char <= 'G') ? 4 : 5
        
        while (i < noteString.length && noteString.charAt(i) == '\'') {
            octave++
            i++
        }
        while (i < noteString.length && noteString.charAt(i) == ',') {
            octave--
            i++
        }
        
        // Notenlänge
        let duration = 1
        if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
            duration = parseInt(noteString.charAt(i))
            i++
        } else if (i < noteString.length && noteString.charAt(i) == '/') {
            i++
            if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                duration = 1 / parseInt(noteString.charAt(i))
                i++
            } else {
                duration = 0.5
            }
        }
        
        const frequency = noteToFrequencyWithKey(noteName + accidental, octave, key)
        
        return {success: true, frequency: frequency, nextIndex: i, duration: duration}
    }

    // Hilfsfunktion: Erhalte Bruchteil einer Viertelnote für Standard-Notenlänge
    function getDefaultNoteFraction(defaultNoteLength: DefaultNoteLength): number {
        switch (defaultNoteLength) {
            case DefaultNoteLength.Whole: return 4
            case DefaultNoteLength.Half: return 2
            case DefaultNoteLength.Quarter: return 1
            case DefaultNoteLength.Eighth: return 0.5
            case DefaultNoteLength.Sixteenth: return 0.25
            default: return 1
        }
    }

    // Hilfsfunktion: Berechne Basis-Notendauer basierend auf Taktart
    function calculateBaseDuration(beatDuration: number, timeSignature: TimeSignature): number {
        switch (timeSignature) {
            case TimeSignature.FourFour:
            case TimeSignature.ThreeFour:
            case TimeSignature.TwoFour:
                return beatDuration
            case TimeSignature.SixEight:
            case TimeSignature.NineEight:
            case TimeSignature.TwelveEight:
                return beatDuration / 2
            default:
                return beatDuration
        }
    }

    // Hilfsfunktion: Wandle Notennamen in Frequenz um mit Tonart-Anpassung
    function noteToFrequencyWithKey(noteName: string, octave: number, key: Key): number {
        const baseNote = noteName.charAt(0).toUpperCase()
        const accidental = noteName.length > 1 ? noteName.charAt(1) : ''
        
        // Grundfrequenzen für Oktave 4
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
        
        // Explizite Vorzeichen haben Vorrang
        if (accidental == '#') {
            baseFreq *= SEMITONE_RATIO
        } else if (accidental == 'b') {
            baseFreq /= SEMITONE_RATIO
        } else if (accidental != '=') {
            // Nur wenn kein explizites Vorzeichen: Tonart-Anpassung
            baseFreq = applyKeySignature(baseNote, baseFreq, key)
        }
        
        // Oktave anpassen
        const octaveMultiplier = Math.pow(2, octave - 4)
        return Math.round(baseFreq * octaveMultiplier)
    }

    // Hilfsfunktion: Wende Tonart-Vorzeichen an
    function applyKeySignature(note: string, frequency: number, key: Key): number {
        const keySignatures = getKeySignature(key)
        
        for (let i = 0; i < keySignatures.length; i++) {
            if (keySignatures.charAt(i) == note) {
                return isSharpKey(key) 
                    ? frequency * SEMITONE_RATIO 
                    : frequency / SEMITONE_RATIO
            }
        }
        
        return frequency
    }

    // Hilfsfunktion: Erhalte die betroffenen Noten einer Tonart
    function getKeySignature(key: Key): string {
        switch (key) {
            case Key.C: return ""
            case Key.G: return "F"
            case Key.D: return "FC"
            case Key.A: return "FCG"
            case Key.E: return "FCGD"
            case Key.B: return "FCGDA"
            case Key.FSharp: return "FCGDAE"
            case Key.F: return "B"
            case Key.BFlat: return "BE"
            case Key.EFlat: return "BEA"
            case Key.AFlat: return "BEAD"
            case Key.DFlat: return "BEADG"
            case Key.GFlat: return "BEADGC"
            default: return ""
        }
    }

    // Hilfsfunktion: Prüfe ob Tonart Kreuz-Tonart ist
    function isSharpKey(key: Key): boolean {
        return key == Key.G || key == Key.D || key == Key.A || 
               key == Key.E || key == Key.B || key == Key.FSharp
    }

    // Hilfsfunktion: Wandle Channel-Enum in entsprechenden Buchstaben um
    function channelToLetter(ch: Channel): string {
        const letters = ["a", "b", "c", "d", "e"]
        return letters[ch] || "a"
    }
}
