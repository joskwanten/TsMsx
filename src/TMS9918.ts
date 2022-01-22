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
    renderedImage = new Uint8ClampedArray(256 * 212 * 4);

    palette = [[0x00, 0x00, 0x00, 0x00],
    [0x00, 0x00, 0x00, 0xff],
    [0x21, 0xc8, 0x42, 0xff],
    [0x5e, 0xdc, 0x78, 0xff],
    [0x54, 0x55, 0xed, 0xff],
    [0x7d, 0x76, 0xfc, 0xff],
    [0xd4, 0x52, 0x4d, 0xff],
    [0x42, 0xeb, 0xf5, 0xff],
    [0xfc, 0x55, 0x54, 0xff],
    [0xff, 0x79, 0x78, 0xff],
    [0xd4, 0xc1, 0x54, 0xff],
    [0xe6, 0xce, 0x80, 0xff],
    [0x21, 0xb0, 0x3b, 0xff],
    [0xc9, 0x5b, 0xba, 0xff],
    [0xcc, 0xcc, 0xcc, 0xff],
    [0xff, 0xff, 0xff, 0xff]]

    constructor(private interruptFunction: () => void, private backdropChangedFunc: (color: number) => void) {

    }

    getBlank() {
        return (this.registers[1] & 0x40) !== 0x40;
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
        let m1 = (this.registers[1] & 0x10) >> 4;
        let m3 = (this.registers[1] & 0x08) >> 1;
        let m2 = (this.registers[0] & 0x02);
        return (m3 | m2 | m1);
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

                    if (register == 7) {
                        let c =
                            (this.palette[this.getBackdropColor()][0] << 24) |
                            (this.palette[this.getBackdropColor()][1] << 16) |
                            (this.palette[this.getBackdropColor()][2] << 8) |
                            (this.palette[this.getBackdropColor()][3]);

                        this.backdropChangedFunc(c);
                    }
                } else if (value & 0x40) {
                    // Setup video write address
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
                } else {
                    // Setup video read address (internally the same)
                    this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;

                }
            }
        } else {
            this.hasLatchedData = false;
            // Mode = 0 means writing to video memory
            this.vram[this.vramAddress] = value;
            this.vramAddress = (this.vramAddress + 1) % 0x4000;
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
            this.render(this.renderedImage);

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
        let c = this.getBackdropColor();
        for (let i = 0; i < image.length / 4; i++) {
            image[(4 * i) + 0] = this.palette[c][0];
            image[(4 * i) + 1] = this.palette[c][1];
            image[(4 * i) + 2] = this.palette[c][2];
            image[(4 * i) + 3] = this.palette[c][3];
        }

        if (this.getBlank()) {
            //  Blank done
        } else if (this.Mode() == 1) {
            // Screen 0
            let PG = this.getPatternGenerationTable();
            let PN = this.getPatternNameTable();
            for (let y = 0; y < 24; y++) {
                for (let x = 0; x < 40; x++) {
                    let index = (y * 40) + x;
                    // Get Pattern name
                    let char = this.vram[PN + index];
                    // Get Colors from the Color table
                    let fg = this.getTextColor();
                    let bg = this.getBackdropColor();
                    for (let i = 0; i < 8; i++) {
                        let p = this.vram[PG + (8 * char) + i];
                        for (let j = 0; j < 6; j++) {
                            if (p & (1 << (7 - j))) {
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 0] = this.palette[fg][0];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 1] = this.palette[fg][1];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 2] = this.palette[fg][2];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 3] = this.palette[fg][3];
                            } else {
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 0] = this.palette[bg][0];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 1] = this.palette[bg][1];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 2] = this.palette[bg][2];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 6) + j))) + 3] = this.palette[bg][3];
                            }
                        }
                    }
                }
            }
        } else if (this.Mode() == 0) {
            let PG = this.getPatternGenerationTable();
            let PN = this.getPatternNameTable();
            let CT = this.getColorTable();
            for (let y = 0; y < 24; y++) {
                for (let x = 0; x < 32; x++) {
                    let index = (y * 32) + x;
                    // Get Pattern name
                    let char = this.vram[PN + index];
                    // Get Colors from the Color table
                    let color = this.vram[CT + (index / 8)];
                    let fg = color >> 4;
                    let bg = color & 0xf;
                    fg = 15;
                    bg = 5;
                    for (let i = 0; i < 8; i++) {
                        let p = this.vram[PG + (8 * char) + i];
                        for (let j = 0; j < 8; j++) {
                            if (p & (1 << (7 - j))) {
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 0] = this.palette[fg][0];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 1] = this.palette[fg][1];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 2] = this.palette[fg][2];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 3] = this.palette[fg][3];
                            } else {
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 0] = this.palette[bg][0];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 1] = this.palette[bg][1];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 2] = this.palette[bg][2];
                                image[(4 * (256 * ((y * 8) + i) + ((x * 8) + j))) + 3] = this.palette[bg][3];
                            }
                        }
                    }
                }
            }
        }
    }

    getImage() {
        return this.renderedImage;
    }
}