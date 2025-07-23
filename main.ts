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
     * @param tempo das Tempo in BPM
     * @param key die Tonart
     * @param notes die Noten in ABC-Notation
     */
    //% block="ABC-Notation (version 2) an Kanal %channel Taktart %timeSignature Tempo %tempo Tonart %key Noten %notes"
    //% tempo.min=60 tempo.max=200 tempo.defl=120
    //% notes.defl="|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|"
    //% color=#cd7f32 weight=80
    export function playABCNotation(channel: Channel, timeSignature: TimeSignature, tempo: number, key: Key, notes: string): void {
        serial.setBaudRate(BaudRate.BaudRate57600)
        
        // Bereche die Grundnotenlänge basierend auf Tempo (in ms)
        let beatDuration = 60000 / tempo  // Eine Viertelnote in Millisekunden
        
        // Parse und spiele Noten mit Tonart-Anpassung
        parseAndPlayNotes(notes, beatDuration, channel, key)
    }

    // Hilfsfunktion: Parse und spiele die Noten
    function parseAndPlayNotes(noteString: string, beatDuration: number, channel: Channel): void {
        let i = 0
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
                
                // Frequenz berechnen und senden
                let frequency = noteToFrequency(noteName.charAt(0), octave)
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

    // Hilfsfunktion: Wandle Notennamen in Frequenz um
    function noteToFrequency(note: string, octave: number): number {
        // Grundfrequenzen für Oktave 4 (mittleres C = C4)
        let baseFreq: number
        switch (note.toUpperCase()) {
            case 'C': baseFreq = 261.63; break
            case 'D': baseFreq = 293.66; break
            case 'E': baseFreq = 329.63; break
            case 'F': baseFreq = 349.23; break
            case 'G': baseFreq = 392.00; break
            case 'A': baseFreq = 440.00; break
            case 'B': baseFreq = 493.88; break
            default: return 0
        }
        
        // Oktave anpassen (jede Oktave verdoppelt/halbiert die Frequenz)
        let octaveMultiplier = Math.pow(2, octave - 4)
        return Math.round(baseFreq * octaveMultiplier)
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
}
