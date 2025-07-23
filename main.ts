/**
 * AMBAR Bibliothek für Calliope mini
 * Version: v10b
 * Erweitert um ABC-Notation Block für Musikwiedergabe
 */

namespace AMBAR {
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
     * @param channel der Kanal (A-E) über den gesendet wird
     * @param timeSignature die Taktart
     * @param key die Tonart
     * @param tempo das Tempo in BPM
     * @param notes die Noten in ABC-Notation
     */
    //% block="ABC-Notation an Kanal %channel Taktart %timeSignature Tonart %key Tempo %tempo Noten %notes"
    //% tempo.min=60 tempo.max=200 tempo.defl=120
    //% key.defl=Key.G
    //% notes.defl="GABc dedB c2ec B2dB A2F2 G4"
    //% notes.fieldEditor="textarea" notes.fieldOptions.rows=4 notes.fieldOptions.cols=50
    //% color=#cd7f32 weight=80
    export function playABCNotation(channel: Channel, timeSignature: TimeSignature, key: Key, tempo: number, notes: string): void {
        serial.setBaudRate(BaudRate.BaudRate57600)
        
        // Bereche die Grundnotenlänge basierend auf Tempo (in ms)
        let beatDuration = 60000 / tempo  // Eine Viertelnote in Millisekunden
        
        // Parse und spiele Noten mit Tonart-Anpassung
        parseAndPlayNotes(notes, beatDuration, channel, key)
    }

    // Hilfsfunktion: Parse und spiele die Noten
    function parseAndPlayNotes(noteString: string, beatDuration: number, channel: Channel, key: Key): void {
        let i = 0
        while (i < noteString.length) {
            let char = noteString.charAt(i)
            
            // Überspringe Balken und andere Zeichen
            if (char == '|' || char == ':' || char == ' ' || char == '\n' || char == '\r') {
                i++
                continue
            }
            
            // Note identifizieren
            let noteName = ''
            let octave = 0
            let duration = 1  // Standard: Viertelnote
            
            // Notennamen erfassen (A-G, a-g)
            if ('ABCDEFGabcdefg'.indexOf(char) >= 0) {
                noteName = char
                i++
                
                // Vorzeichen erfassen (# für Kreuz, b für Be)
                if (i < noteString.length && (noteString.charAt(i) == '#' || noteString.charAt(i) == 'b')) {
                    noteName += noteString.charAt(i)
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
                
                // Notenlänge erfassen
                if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                    duration = parseInt(noteString.charAt(i))
                    i++
                } else if (i < noteString.length && noteString.charAt(i) == '/') {
                    i++
                    if (i < noteString.length && noteString.charAt(i) >= '0' && noteString.charAt(i) <= '9') {
                        duration = 1 / parseInt(noteString.charAt(i))
                        i++
                    } else {
                        duration = 0.5  // Halbe Note bei /
                    }
                }
                
                // Frequenz berechnen und senden (mit Tonart-Anpassung)
                let frequency = noteToFrequency(noteName, octave, key)
                let noteDuration = Math.round(beatDuration * duration)
                
                sendNumber(frequency, channel)
                basic.pause(noteDuration)
                sendNumber(0, channel)  // Kurze Pause zwischen Noten
                basic.pause(50)
                
            } else {
                i++
            }
        }
    }

    // Hilfsfunktion: Wandle Notennamen in Frequenz um (mit Tonart-Anpassung)
    function noteToFrequency(noteName: string, octave: number, key: Key): number {
        let baseNote = noteName.charAt(0).toUpperCase()
        let hasSharp = noteName.indexOf('#') >= 0
        let hasFlat = noteName.indexOf('b') >= 0
        
        // Grundfrequenzen für Oktave 4 (C4 = 261.63 Hz)
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
        
        // Vorzeichen anwenden
        if (hasSharp) {
            baseFreq *= 1.059463  // Halbton höher
        } else if (hasFlat) {
            baseFreq /= 1.059463  // Halbton tiefer
        }
        
        // Tonart-Vorzeichen anwenden
        let keyAdjustment = getKeyAdjustment(baseNote, key)
        if (keyAdjustment != 0) {
            if (keyAdjustment > 0) {
                baseFreq *= Math.pow(1.059463, keyAdjustment)  // Kreuz
            } else {
                baseFreq /= Math.pow(1.059463, Math.abs(keyAdjustment))  // Be
            }
        }
        
        // Oktave anpassen
        let octaveMultiplier = Math.pow(2, octave - 4)
        return Math.round(baseFreq * octaveMultiplier)
    }
    
    // Hilfsfunktion: Ermittle Tonart-Vorzeichen für eine Note
    function getKeyAdjustment(note: string, key: Key): number {
        // Rückgabe: 1 = Kreuz, -1 = Be, 0 = keine Änderung
        switch (key) {
            case Key.C: return 0  // Keine Vorzeichen
            case Key.G: 
                return note == 'F' ? 1 : 0  // F#
            case Key.D:
                return (note == 'F' || note == 'C') ? 1 : 0  // F#, C#
            case Key.A:
                return (note == 'F' || note == 'C' || note == 'G') ? 1 : 0  // F#, C#, G#
            case Key.E:
                return (note == 'F' || note == 'C' || note == 'G' || note == 'D') ? 1 : 0  // F#, C#, G#, D#
            case Key.B:
                return (note == 'F' || note == 'C' || note == 'G' || note == 'D' || note == 'A') ? 1 : 0
            case Key.Fs:
                return (note == 'F' || note == 'C' || note == 'G' || note == 'D' || note == 'A' || note == 'E') ? 1 : 0
            case Key.F:
                return note == 'B' ? -1 : 0  // Bb
            case Key.Bb:
                return (note == 'B' || note == 'E') ? -1 : 0  // Bb, Eb
            case Key.Eb:
                return (note == 'B' || note == 'E' || note == 'A') ? -1 : 0  // Bb, Eb, Ab
            case Key.Ab:
                return (note == 'B' || note == 'E' || note == 'A' || note == 'D') ? -1 : 0  // Bb, Eb, Ab, Db
            case Key.Db:
                return (note == 'B' || note == 'E' || note == 'A' || note == 'D' || note == 'G') ? -1 : 0
            case Key.Gb:
                return (note == 'B' || note == 'E' || note == 'A' || note == 'D' || note == 'G' || note == 'C') ? -1 : 0
            default: return 0
        }
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
      TwelveEight,
      //% block="2/2"
      TwoTwo,
      //% block="3/8"
      ThreeEight
    }

    /**
     * Aufzählungstyp für Tonarten
     */
    export enum Key {
      //% block="C-Dur"
      C,
      //% block="G-Dur"
      G,
      //% block="D-Dur"
      D,
      //% block="A-Dur"
      A,
      //% block="E-Dur"
      E,
      //% block="B-Dur"
      B,
      //% block="F#-Dur"
      Fs,
      //% block="F-Dur"
      F,
      //% block="Bb-Dur"
      Bb,
      //% block="Eb-Dur"
      Eb,
      //% block="Ab-Dur"
      Ab,
      //% block="Db-Dur"
      Db,
      //% block="Gb-Dur"
      Gb
    }
}
