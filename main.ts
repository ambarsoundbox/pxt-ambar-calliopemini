namespace AMBAR {
    // Globale Variablen für manuelles Tempo
    let manualNoteIndex = 0
    let manualNoteString = ""
    let manualKey = Key.G
    let manualChannel = Channel.A

    /**
     * Sende eine Zahl über die serielle Schnittstelle im AMBAR-Format.
     * @param value die Zahl, die gesendet werden soll
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    //% block="sende Zahl %value an AMBAR auf den Kanal %channel"
    //% value.min=0 value.max=20000
    //% color=#cd7f32 weight=100
    export function sendNumber(value: number, channel: Channel): void {
        serial.setBaudRate(BaudRate.BaudRate57600)  // Baudrate auf 57600 setzen
        let chLetter = channelToLetter(channel)
        serial.writeString("s" + chLetter + value + "e")
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
        serial.setBaudRate(BaudRate.BaudRate57600)  // sicherstellen, dass Baudrate stimmt
        serial.onDataReceived("e", function () {
            let raw = serial.readUntil("e")  // liest bis zum Terminator 'e'
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
     * Spiele ABC-Notation ab und sende Frequenzen über WebSerial
     * Die Symbole ^, = und _ werden (vor einer Note) verwendet, um jeweils ein Kreuz (♯), ein Auflösungszeichen (♮) oder ein Be (♭) zu erzeugen.
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param timeSignature die Taktart
     * @param key die Tonart
     * @param defaultNoteLength die Standard-Notenlänge
     * @param tempo das Tempo in BPM
     * @param notes die Noten in ABC-Notation
     */
    //% block="ABC-Notation (v13) an Kanal %channel Taktart %timeSignature Tonart %key Standard-Notenlänge %defaultNoteLength Tempo %tempo Noten %notes"
    //% tempo.min=60 tempo.max=200 tempo.defl=120
    //% timeSignature.defl=TimeSignature.FourFour
    //% key.defl=Key.G
    //% defaultNoteLength.defl=DefaultNoteLength.Quarter
    //% notes.defl="|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|GABc dedB|dedB dedB|c2ec B2dB|A2F2 G4:||:g2gf gdBd|g2f2 e2d2|c2ec B2dB|c2A2 A2df|g2gf g2Bd|g2f2 e2d2|c2ec B2dB|A2F2 G4:|"
    //% color=#cd7f32 weight=80
    export function playABCNotation(channel: Channel, timeSignature: TimeSignature, key: Key, defaultNoteLength: DefaultNoteLength, tempo: number, notes: string): void {
        serial.setBaudRate(BaudRate.BaudRate57600)
        
        // Berechne die Grundnotenlänge basierend auf Tempo (in ms)
        let beatDuration = 60000 / tempo  // Eine Viertelnote in Millisekunden
        
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
        serial.setBaudRate(BaudRate.BaudRate57600)
        
        // Wenn neue Parameter, dann Index zurücksetzen
        if (manualNoteString != notes || manualKey != key || manualChannel != channel) {
            manualNoteIndex = 0
            manualNoteString = notes
            manualKey = key
            manualChannel = channel
        }
        
        // Spiele die nächste Note
        let frequency = getNextNoteFrequency()
        if (frequency > 0) {
            sendNumber(frequency, channel)
        }
    }

    /**
     * ABC-Ton beenden - sendet 0 über WebSerial
     * @param channel der Kanal (A-E) über den gesendet wird
     */
    //% block="ABC-Ton beenden an Kanal %channel"
    //% color=#cd7f32 weight=60
    export function stopABCTone(channel: Channel): void {
        serial.setBaudRate(BaudRate.BaudRate57600)
        sendNumber(0, channel)
    }

    // Hilfsfunktion: Hole die nächste Note und erhöhe den Index
    function getNextNoteFrequency(): number {
        if (manualNoteIndex >= manualNoteString.length) {
            // Ende erreicht, Index zurücksetzen
            manualNoteIndex = 0
            return 0
        }

        let i = manualNoteIndex
        
        // Überspringe Balken und andere Zeichen
        while (i < manualNoteString.length) {
            let char = manualNoteString.charAt(i)
            if (char != '|' && char != ':' && char != ' ') {
                break
            }
            i++
        }
        
        if (i >= manualNoteString.length) {
            manualNoteIndex = 0
            return 0
        }
        
        // Note parsen
        let noteName = ''
        let octave = 0
        let accidental = ''
        let char = manualNoteString.charAt(i)
        
        // Prüfe auf explizite Vorzeichen vor der Note
        if (char == '^') {
            accidental = '#'  // Kreuz
            i++
            if (i >= manualNoteString.length) {
                manualNoteIndex = 0
                return 0
            }
            char = manualNoteString.charAt(i)
        } else if (char == '=') {
            accidental = '='  // Auflösungszeichen
            i++
            if (i >= manualNoteString.length) {
                manualNoteIndex = 0
                return 0
            }
            char = manualNoteString.charAt(i)
        } else if (char == '_') {
            accidental = 'b'  // Be
            i++
            if (i >= manualNoteString.length) {
                manualNoteIndex = 0
                return 0
            }
            char = manualNoteString.charAt(i)
        }
        
        // Notennamen erfassen (A-G, a-g)
        if ('ABCDEFGabcdefg'.indexOf(char) >= 0) {
            noteName = char
            i++
            
            // Weitere Vorzeichen erfassen (# für Kreuz, b für Be)
            if (accidental == '' && i < manualNoteString.length && (manualNoteString.charAt(i) == '#' || manualNoteString.charAt(i) == 'b')) {
                accidental = manualNoteString.charAt(i)
                i++
            }
            
            // Oktave bestimmen
            if (char >= 'A' && char <= 'G') {
                octave = 4  // Mittlere Oktave
            } else {
                octave = 5  // Höhere Oktave für kleine Buchstaben
            }
            
            // Zusätzliche Oktav-Markierungen
            while (i < manualNoteString.length && manualNoteString.charAt(i) == '\'') {
                octave++
                i++
            }
            while (i < manualNoteString.length && manualNoteString.charAt(i) == ',') {
                octave--
                i++
            }
            
            // Notenlänge überspringen (für manuelles Tempo irrelevant)
            if (i < manualNoteString.length && manualNoteString.charAt(i) >= '0' && manualNoteString.charAt(i) <= '9') {
                i++
            } else if (i < manualNoteString.length && manualNoteString.charAt(i) == '/') {
                i++
                if (i < manualNoteString.length && manualNoteString.charAt(i) >= '0' && manualNoteString.charAt(i) <= '9') {
                    i++
                }
            }
            
            // Index für nächsten Aufruf setzen
            manualNoteIndex = i
            
            // Frequenz berechnen
            return noteToFrequencyWithKey(noteName + accidental, octave, manualKey)
        } else {
            // Unbekanntes Zeichen, überspringe es
            manualNoteIndex = i + 1
            return getNextNoteFrequency()  // Rekursiver Aufruf für nächstes Zeichen
        }
    }

    // Hilfsfunktion: Parse und spiele die Noten
    function parseAndPlayNotes(noteString: string, beatDuration: number, channel: Channel, key: Key, timeSignature: TimeSignature, defaultNoteLength: DefaultNoteLength): void {
        let i = 0
        // Anpassung der Grundnotenlänge basierend auf Taktart
        let baseDuration = calculateBaseDuration(beatDuration, timeSignature)
        
        // Berechne Standard-Notenlänge als Bruchteil einer Viertelnote
        let baseNoteFraction = getDefaultNoteFraction(defaultNoteLength)
        
        while (i < noteString.length) {
            let char = noteString.charAt(i)
            
            // Überspringe Balken und andere Zeichen
            if (char == '|' || char == ':' || char == ' ') {
                i++
                continue
            }
            
            // Note identifizieren
            let noteName = ''
            let octave = 0
            let duration = 1  // Standardmultiplikator (entspricht der gewählten Standard-Notenlänge)
            let accidental = ''  // Für explizite Vorzeichen (^, =, _)
            
            // Prüfe auf explizite Vorzeichen vor der Note
            if (char == '^') {
                accidental = '#'  // Kreuz
                i++
                char = noteString.charAt(i)
            } else if (char == '=') {
                accidental = '='  // Auflösungszeichen
                i++
                char = noteString.charAt(i)
            } else if (char == '_') {
                accidental = 'b'  // Be
                i++
                char = noteString.charAt(i)
            }
            
            // Notennamen erfassen (A-G, a-g)
            if ('ABCDEFGabcdefg'.indexOf(char) >= 0) {
                noteName = char
                i++
                
                // Weitere Vorzeichen erfassen (# für Kreuz, b für Be) - nur wenn nicht bereits explizit gesetzt
                if (accidental == '' && i < noteString.length && (noteString.charAt(i) == '#' || noteString.charAt(i) == 'b')) {
                    accidental = noteString.charAt(i)
                    i++
                }
                
                // Oktave bestimmen (große Buchstaben sind tiefere Oktave)
                if (char >= 'A' && char <= 'G') {
                    octave = 4  // Mittlere Oktave
                } else {
                    octave = 5  // Höhere Oktave für kleine Buchstaben
                }
                
                // Zusätzliche Oktav-Markierungen
                while (i < noteString.length && noteString.charAt(i) == '\'') {
                    octave++
                    i++
                }
                while (i < noteString.length && noteString.charAt(i) == ',') {
                    octave--
                    i++
                }
                
                // Notenlänge erfassen (Multiplikator der Standard-Notenlänge)
                if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                    duration = parseInt(noteString.charAt(i))
                    i++
                } else if (i < noteString.length && noteString.charAt(i) == '/') {
                    i++
                    if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                        duration = 1 / parseInt(noteString.charAt(i))
                        i++
                    } else {
                        duration = 0.5  // Halbe Standard-Notenlänge bei /
                    }
                }
                
                // Frequenz berechnen mit Tonart-Anpassung und expliziten Vorzeichen
                let frequency = noteToFrequencyWithKey(noteName + accidental, octave, key)
                let noteDuration = Math.round(baseDuration * baseNoteFraction * duration)
                
                sendNumber(frequency, channel)
                basic.pause(noteDuration)
                sendNumber(0, channel)  // Kurze Pause zwischen Noten
                basic.pause(50)
                
            } else {
                i++
            }
        }
    }

    // Hilfsfunktion: Erhalte Bruchteil einer Viertelnote für Standard-Notenlänge
    function getDefaultNoteFraction(defaultNoteLength: DefaultNoteLength): number {
        switch (defaultNoteLength) {
            case DefaultNoteLength.Whole:
                return 4        // Ganze Note = 4 Viertelnoten
            case DefaultNoteLength.Half:
                return 2        // Halbe Note = 2 Viertelnoten
            case DefaultNoteLength.Quarter:
                return 1        // Viertelnote = 1 Viertelnote
            case DefaultNoteLength.Eighth:
                return 0.5      // Achtelnote = 1/2 Viertelnote
            case DefaultNoteLength.Sixteenth:
                return 0.25     // Sechzehntelnote = 1/4 Viertelnote
            default:
                return 1        // Standard: Viertelnote
        }
    }

    // Hilfsfunktion: Berechne Basis-Notendauer basierend auf Taktart
    function calculateBaseDuration(beatDuration: number, timeSignature: TimeSignature): number {
        switch (timeSignature) {
            case TimeSignature.FourFour:
                return beatDuration  // 4/4 Takt - Viertelnote als Basis
            case TimeSignature.ThreeFour:
                return beatDuration  // 3/4 Takt - Viertelnote als Basis
            case TimeSignature.TwoFour:
                return beatDuration  // 2/4 Takt - Viertelnote als Basis
            case TimeSignature.SixEight:
                return beatDuration / 2  // 6/8 Takt - Achtelnote als Basis
            case TimeSignature.NineEight:
                return beatDuration / 2  // 9/8 Takt - Achtelnote als Basis
            case TimeSignature.TwelveEight:
                return beatDuration / 2  // 12/8 Takt - Achtelnote als Basis
            default:
                return beatDuration
        }
    }

    // Hilfsfunktion: Wandle Notennamen in Frequenz um mit Tonart-Anpassung
    function noteToFrequencyWithKey(noteName: string, octave: number, key: Key): number {
        let baseNote = noteName.charAt(0).toUpperCase()
        let accidental = noteName.length > 1 ? noteName.charAt(1) : ''
        
        // Grundfrequenzen für Oktave 4 (mittleres C = C4)
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
        
        // Explizite Vorzeichen haben Vorrang vor Tonart-Vorzeichen
        if (accidental == '#') {
            baseFreq *= 1.059463  // Halbton höher
        } else if (accidental == 'b') {
            baseFreq /= 1.059463  // Halbton tiefer
        } else if (accidental == '=') {
            // Auflösungszeichen - keine Änderung der Grundfrequenz
            // Tonart-Vorzeichen werden ignoriert
        } else {
            // Nur wenn kein explizites Vorzeichen: Tonart-Anpassung anwenden
            baseFreq = applyKeySignature(baseNote, baseFreq, key)
        }
        
        // Oktave anpassen (jede Oktave verdoppelt/halbiert die Frequenz)
        let octaveMultiplier = Math.pow(2, octave - 4)
        return Math.round(baseFreq * octaveMultiplier)
    }

    // Hilfsfunktion: Wende Tonart-Vorzeichen an
    function applyKeySignature(note: string, frequency: number, key: Key): number {
        let keySignatures = getKeySignature(key)
        
        // Prüfe ob die Note von der Tonart betroffen ist
        for (let i = 0; i < keySignatures.length; i++) {
            if (keySignatures.charAt(i) == note) {
                if (isSharpKey(key)) {
                    return frequency * 1.059463  // Kreuz
                } else {
                    return frequency / 1.059463  // Be
                }
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
        return key == Key.G || key == Key.D || key == Key.A || key == Key.E || key == Key.B || key == Key.FSharp
    }

    // Hilfsfunktion: Wandle Channel-Enum in entsprechenden Buchstaben um
    function channelToLetter(ch: Channel): string {
        const letters = ["a", "b", "c", "d", "e"]
        return letters[ch] || "a"
    }

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
}
