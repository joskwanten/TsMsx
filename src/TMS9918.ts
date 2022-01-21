/*
Reg/Bit	7	    6	    5	    4	    3	    2	    1	    0
0	    -	    -	    -	    -	    -	    -	    M2	    EXTVID
1	    4/16K	BL	    GINT	M1	    M3	    -	    SI	    MAG
2	    -	    -	    -	    -	    PN13	PN12	PN11	PN10
3	    CT13	CT12	CT11	CT10	CT9	    CT8	    CT7	    CT6
4	    -	    -	    -	    -	    -	    PG13	PG12	PG11
5	    -	    SA13	SA12	SA11	SA10	SA9	    SA8	    SA7
6	    -	    -	    -	    -	    -	    SG13	SG12	SG11
7	    TC3 	TC2	    TC1	    TC0	    BD3	    BD2	    BD1	    BD0
 
Status  INT	    5S	    C   	FS4	    FS3	    FS2	    FS1	    FS0
*/

enum StatusFlags {
    S_INT = 0b10000000,
    S_5S = 0b01000000,
    S_C = 0b00100000,
    S_FS4 = 0b00010000,
    S_FS3 = 0b00001000,
    S_FS2 = 0b00000100,
    S_FS1 = 0b00000010,
    S_FS0 = 0b00000001,
};

export class TMS9918 {
    registers = new Uint8Array(8);
    vram = new Uint8Array(0x4000);
    vramAddress = 0;
    vdpStatus = 0;
    refreshRate = 600; // NTSC
    lastRefresh = 0;

    hasLatchedData = false;
    latchedData = 0;

    palette = [[0x00, 0x00, 0x00, 0x00],
    [0x00, 0x00, 0x00, 0x01],
    [0x21, 0xc8, 0x42, 0x01],
    [0x5e, 0xdc, 0x78, 0x01],
    [0x54, 0x55, 0xed, 0x01],
    [0x7d, 0x76, 0xfc, 0x01],
    [0xd4, 0x52, 0x4d, 0x01],
    [0x42, 0xeb, 0xf5, 0x01],
    [0xfc, 0x55, 0x54, 0x01],
    [0xff, 0x79, 0x78, 0x01],
    [0xd4, 0xc1, 0x54, 0x01],
    [0xe6, 0xce, 0x80, 0x01],
    [0x21, 0xb0, 0x3b, 0x01],
    [0xc9, 0x5b, 0xba, 0x01],
    [0xcc, 0xcc, 0xcc, 0x01],
    [0xff, 0xff, 0xff, 0x01]]

    constructor(private interruptFunction: () => void) {

    }

    getSprintAttributeTable() {
        return (this.registers[5] & 0x7f) << 7;
    }

    getColorTable() {
        return (this.registers[3]) << 6;
    }

    getPatternGenerationTable() {
        return (this.registers[4] & 7) << 11;
    }

    getPatternNameTable() {
        return (this.registers[2] & 0xf) << 10;
    }

    getTextColor() {
        return (this.registers[7]) >> 4;
    }

    getBackdropColor() {
        return (this.registers[7]) & 0xf;
    }

    GINT() {
        return (this.registers[1] & 0x20) != 0;
    }

    Mode() {
        let m1 = (this.registers[1] & 0x10) >> 2;
        let m3 = (this.registers[1] & 0x08) >> 1;
        let m2 = (this.registers[0] & 0x02) >> 1;
        return m1 + m2 + m3;
    }

    write(mode: boolean, value: number) {
        if (mode) {
            if (!this.hasLatchedData) {
                
                this.latchedData = value;
                this.hasLatchedData = true;

            } else {
                
                this.hasLatchedData = false;
                
                if (value & 0x80) {
                    // Write to register
                    let register = value & 0x7;
                    this.registers[register] = this.latchedData;
                    console.log(`register: ${register} = ${this.registers[register].toString(16)}`);
                } else if (value & 0x40) {
                    // Setup video write address
                    console.log(`this.vramAddress old = ${this.vramAddress.toString(16)}`);
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
                    console.log(`this.vramAddress = ${this.vramAddress.toString(16)}`);
                } else {
                    // Setup video write address
                    console.log(`read this.vramAddress old = ${this.vramAddress.toString(16)}`);
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
                    console.log(`read this.vramAddress = ${this.vramAddress.toString(16)}`);
                }
            }
        } else {
            this.hasLatchedData = false;
            // Mode = 0 means writing to video memory
            this.vram[this.vramAddress] = value;
            this.vramAddress = (this.vramAddress + 1) % 0x4000;
            console.log(`${this.vramAddress.toString(16)}:${value.toString(16)}`);
        }
    }

    read(mode: boolean): number {
        this.hasLatchedData = false;

        if (mode) {
            let value = this.vdpStatus;
            this.vdpStatus &= ~StatusFlags.S_INT;
            return value;
        } else {
            let value = this.vram[this.vramAddress];
            this.vramAddress = (this.vramAddress + 1) % 16384;
            return value;
        }
    }

    checkAndGenerateInterrupt(time: number) {
        if ((time - this.lastRefresh) > this.refreshRate) {
            this.lastRefresh = time;

            //  IF interrupts are enabled set the S_INT flag
            if (this.GINT()) {
                this.vdpStatus |= StatusFlags.S_INT;
            }
        }

        if (this.vdpStatus & StatusFlags.S_INT) {
            this.interruptFunction();
        }
    }

    render(image: Uint8ClampedArray) {
        for (let i = 0; i < image.length; i++) {
            image[i] = 0xff;
        }
        // console.log(`Mode ${this.Mode()}`);
        // console.log(`PG ${this.getPatternGenerationTable()}`);
        // console.log(`PN ${this.getPatternNameTable()}`);
        //console.clear();
        // console.log('--------------')
        if (this.Mode() == 1) {
            let PG = this.getPatternGenerationTable();
            let PN = this.getPatternNameTable();
            let TC = this.getTextColor();
            let BD = this.getBackdropColor();

            for (let y = 0; y < 24; y++) {                
                for (let x = 0; x < 40; x++) {
                    let char = this.vram[PN + (y * 40) + x];
                    
                }                
            }
        }

        if (this.Mode() == 0) {
            let PG = this.getPatternGenerationTable();
            let PN = this.getPatternNameTable();
            let TC = this.getTextColor();
            let BD = this.getBackdropColor();
            let row = "";
            for (let y = 0; y < 24; y++) {                
                for (let x = 0; x < 32; x++) {
                    let char = this.vram[PN + (y * 40) + x];
                   if (char) row += String.fromCharCode(char);
                }                
            }

            if (row.length) console.log(row);
        }
    }
}