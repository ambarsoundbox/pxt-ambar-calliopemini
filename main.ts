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
        serial.setBaudRate(BaudRate.BaudRate57600)  // Baudrate auf 57600 setzen:contentReference[oaicite:0]{index=0}
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
