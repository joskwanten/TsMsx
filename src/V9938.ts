/*
Reg/Bit	7	    6	    5	    4	    3	    2	    1	    0
0	    0	    DG	    IE2	    IE1	    M5	    M4	    M3	    0
1	    0   	BL	    IE0 	M1	    M2	    -	    SI	    MAG
2	    -	    -	    -	    -	    PN13	PN12	PN11	PN10
3	    CT13	CT12	CT11	CT10	CT9	    CT8	    CT7	    CT6
4	    -	    -	    -	    -	    -	    PG13	PG12	PG11
5	    -	    SA13	SA12	SA11	SA10	SA9	    SA8	    SA7
6	    -	    -	    -	    -	    -	    SG13	SG12	SG11
7	    TC3 	TC2	    TC1	    TC0	    BD3	    BD2	    BD1	    BD0
8       MS      LP      TP      CB      VR      0       SPD     BW
9       LN      0       S1      S0      IL      E0      *NT     DC

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

enum Reg9 {
    LN = 0b10000000,
    S1 = 0b00100000,
    S0 = 0b00010000,
    IL = 0b00001000,
    E0 = 0b00000100,
    NT = 0b00000010,
    DC = 0b00000001,
}

export class V9938 {
    registers = new Uint8Array(64);
    statusRegisters = new Uint8Array(16); // Only 10 used used
    vram = new Uint8Array(0x20000);
    vramAddress = 0;
    refreshRate = 60; // NTSC
    lastRefresh = 0;

    hasLatchedData = false;
    latchedData = 0;
    renderedImage = new Uint32Array(256 * 212);
    spriteDetectionBuffer = new Uint8Array(256 * 212);

    paletteRegisterFirstByte: number | undefined = undefined;

    palette = [
        0x00000000,
        0x000000ff,
        0x21c842ff,
        0x5edc78ff,
        0x5455edff,
        0x7d76fcff,
        0xd4524dff,
        0x42ebf5ff,
        0xfc5554ff,
        0xff7978ff,
        0xd4c154ff,
        0xe6ce80ff,
        0x21b03bff,
        0xc95bbaff,
        0xccccccff,
        0xffffffff
    ];

    constructor(private interruptFunction: () => void, private backdropChangedFunc: (color: number) => void) {

    }

    getBlank() {
        return (this.registers[1] & 0x40) !== 0x40;
    }

    getSprintAttributeTable() {
        return (this.registers[5] & 0x7f) << 7;
    }

    getSpriteGenerationTable() {
        return (this.registers[6] & 7) << 11;
    }

    getColorTable() {
        if (this.Mode() === 2) {
            return (this.registers[3] & 0x80) << 6;
        }

        return (this.registers[3]) << 6;
    }

    getPatternGenerationTable() {
        if (this.Mode() === 2) {
            return (this.registers[4] & 4) << 11;
        }

        return (this.registers[4] & 7) << 11;
    }

    getPatternNameTable() {
        return (this.registers[2] & 0xf) << 10;
    }

    getTextColor() {
        return (this.registers[7]) >>> 4;
    }

    getBackdropColor() {
        return (this.registers[7]) & 0xf;
    }

    getMagnified() {
        return (this.registers[1] & 1) !== 0;
    }

    getSixteen() {
        return (this.registers[1] & 2) !== 0;
    }

    GINT() {
        return (this.registers[1] & 0x20) != 0;
    }

    getAndIncrementControlRegister() {
        let index = this.registers[17] & 0x3f;
        if (this.registers[17] & 0x80) {
            // If auto incrementing is set, increment the index
            // to the control register
            this.registers[17] = 0x80 | ((index + 1) & 0x3f);
        }

        return index;
    }

    getAndIncrementPaletteRegister() {
        let index = this.registers[16] & 0x0f;
        this.registers[16] = ((index + 1) & 0xf);
        return index;
    }

    convert3To8Bit(color: number) {
        // Convert a 3 bits color value to 8 bits 
        // e.g. we want to convert 7 to 255 so
        // therefore we multiply by 36.5
        return Math.floor((color & 7) * 36.5);
    }

    get vramBaseAddress() {
        return (this.registers[14] & 0b111) << 14;
    }

    get statusRegisterPointer() {
        return this.registers[15] & 0b1111;
    }

    Mode() {
        let ml = (this.registers[1] & 0b11000) >>> 3;
        let mh = (this.registers[0] & 0b01110) << 1;
        return (ml | mh);
    }

    private write0(value: number) {
        this.hasLatchedData = false;
        this.vram[this.vramAddress] = value;
        this.vramAddress = (this.vramAddress + 1) % 0x20000;
    }

    private write1(value: number) {
        if (!this.hasLatchedData) {
            this.latchedData = value;
            this.hasLatchedData = true;
        } else {

            this.hasLatchedData = false;

            if (value & 0x80) {
                // Write to register
                let register = value & 0x3f;
                this.registers[register] = this.latchedData;

                if (register == 7) {
                    let c = this.palette[this.getBackdropColor()];
                    this.backdropChangedFunc(c);
                }
            } else if (value & 0x40) {
                // Setup video write address
                this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
            } else {
                // Setup video read address (internally the same)
                // Since this is an emulator the read / write
                this.vramAddress = ((value & 0x3f) << 8) + this.latchedData;
                // bit is not taken into account since we don't have to
                // prefetch data

            }
        }
    }

    private write2(value: number) {
        if (this.paletteRegisterFirstByte) {
            let blue = this.convert3To8Bit(this.paletteRegisterFirstByte & 7);
            let red = this.convert3To8Bit((this.paletteRegisterFirstByte >>> 4) & 7);
            let green = this.convert3To8Bit(value & 7);
            let rgba = (red << 24 + green << 16 + blue << 8 + 0xff);
            this.palette[this.getAndIncrementPaletteRegister()] = rgba;
            this.paletteRegisterFirstByte = undefined;
        } else {
            this.paletteRegisterFirstByte = value;
        }
    }

    private write3(value: number) {
        let index = this.getAndIncrementControlRegister();
        if (index !== 17) {
            this.registers[index] = value;
        }
    }


    write(mode: number, value: number) {
        switch (mode & 3) {
            case 0:
                return this.write0(value);
            case 1:
                return this.write1(value);
            case 2:
                return this.write2(value);
            case 3:
                return this.write3(value);
        }
    }

    private read0() {
        let value = this.vram[this.vramAddress];
        this.vramAddress = (this.vramAddress + 1) % 16384;
        return value;
    }

    private read1() {
        let value = this.statusRegisters[this.statusRegisterPointer];
        if (this.statusRegisterPointer == 0) {
            this.statusRegisters[0] = 0;
        }
        return value;
    }

    private read2() {
        return 0x00;
    }

    private read3() {
        return 0x00;
    }

    read(mode: number): number {
        this.hasLatchedData = false;
        switch (mode & 3) {
            case 0:
                return this.read0();
            case 1:
                return this.read1();
            case 2:
                return this.read2();
            case 3:
                return this.read3();
        }
        // Cannot be reached, but the typescript compiler is not smart enough to know that
        return 0;
    }

    checkAndGenerateInterrupt(time: number) {
        //if ((time - this.lastRefresh) > this.refreshRate) {
        this.lastRefresh = time;
        this.render(this.renderedImage);

        //  IF interrupts are enabled set the S_INT flag
        if (this.GINT()) {
            this.statusRegisters[0] |= StatusFlags.S_INT;
        }
        //}

        if (this.statusRegisters[0] & StatusFlags.S_INT) {
            this.interruptFunction();
        }
    }

    render(image: Uint32Array) {
        let c = this.getBackdropColor();
        for (let i = 0; i < image.length; i++) {
            image[i] = this.palette[c];
        }

        if (this.getBlank()) {
            //  Blank done
        } else if (this.Mode() == 1) {
            // Screen 0 Width 40
            this.renderScreen0(image);

        } else if (this.Mode() == 17) {
            // Screen 0 Width 80
            console.log('Screen 0 / T2');
        } else if (this.Mode() == 2) {
            // Screen 3
            console.log('Screen 3 / MC');
        } else if (this.Mode() == 0) {
            // Screen 1
            this.renderScreen1(image);
            this.renderSprites(image);
        } else if (this.Mode() == 4) {
            // Screen 2 (Graphics 2)
            this.renderScreen2(image);
            this.renderSprites(image);
        } else if (this.Mode() == 8) {
            // Screen 4 (Graphics 3)
            console.log('Screen 4 / G3');
        } else if (this.Mode() == 12) {
            console.log('Screen 5 / G4');
        } else if (this.Mode() == 16) {
            console.log('Screen 6 / G5');
            const height = (this.registers[9] & Reg9.LN) !== 0 ? 212 : 192;
        } else if (this.Mode() == 20) {
            console.log('Screen 7 / G6');
        } else if (this.Mode() == 28) {
            console.log('Screen 8 / G7');
        }else {
            //this.renderScreen4(image);
            //this.renderSprite4(image);
        }
    }

    private renderScreen0(image: Uint32Array) {
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
                            image[(256 * ((y * 8) + i) + ((x * 6) + j))] = this.palette[fg];
                        } else {
                            image[(256 * ((y * 8) + i) + ((x * 6) + j))] = this.palette[bg];
                        }
                    }
                }
            }
        }
    }

    private renderScreen1(image: Uint32Array) {
        let PG = this.getPatternGenerationTable();
        let PN = this.getPatternNameTable();
        let CT = this.getColorTable();
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 32; x++) {
                let index = (y * 32) + x;
                // Get Pattern name
                let char = this.vram[PN + index];
                // Get Colors from the Color table
                let color = this.vram[CT + (char >>> 3)];
                let fg = color >>> 4;
                let bg = color & 0xf;
                for (let i = 0; i < 8; i++) {
                    let p = this.vram[PG + (8 * char) + i];
                    for (let j = 0; j < 8; j++) {
                        if (p & (1 << (7 - j))) {
                            image[(256 * ((y * 8) + i) + ((x * 8) + j))] = this.palette[fg];
                        } else {
                            image[(256 * ((y * 8) + i) + ((x * 8) + j))] = this.palette[bg];
                        }
                    }
                }
            }
        }
    }

    private renderScreen2(image: Uint32Array) {
        let PG = this.getPatternGenerationTable();
        let PN = this.getPatternNameTable();
        let CT = this.getColorTable();
        let mask = (this.registers[4] & 3) << 8;
        for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 32; x++) {
                let index = (y * 32) + x;
                let table = (index & mask) >>> 8;
                // Get Pattern name
                let char = this.vram[PN + index];
                let offset = (table * 256 * 8) + (8 * char);
                for (let i = 0; i < 8; i++) {
                    let p = this.vram[PG + offset + i];
                    let c = this.vram[CT + offset + i];
                    let fg = c >>> 4;
                    let bg = c & 0xf;
                    let imgIndex = 256 * ((y * 8) + i) + ((x * 8));
                    image[imgIndex + 0] = p & 0x80 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 1] = p & 0x40 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 2] = p & 0x20 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 3] = p & 0x10 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 4] = p & 0x08 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 5] = p & 0x04 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 6] = p & 0x02 ? this.palette[fg] : this.palette[bg];
                    image[imgIndex + 7] = p & 0x01 ? this.palette[fg] : this.palette[bg];
                }
            }
        }
    }

    private renderSprites(image: Uint32Array) {
        // Clear collision detection buffer
        for (let i = 0; i < this.spriteDetectionBuffer.length; i++) {
            this.spriteDetectionBuffer[i] = 0;
        }

        let SA = this.getSprintAttributeTable();
        let SG = this.getSpriteGenerationTable();

        for (let s = 0; s < 32; s++) {
            let y = this.vram[SA + (4 * s)];
            let x = this.vram[SA + (4 * s) + 1];
            let p = this.vram[SA + (4 * s) + 2];
            let c = this.vram[SA + (4 * s) + 3] & 0xf;
            let ec = (this.vram[SA + (4 * s) + 3] & 0x80) !== 0;

            // According to Sean Young its TMS9918 document
            // thie early clock flag will shift the x position
            // by 32 pixels
            if (ec) {
                x += 32;
            }

            if (y === 208) {
                // End of sprite attribute table
                break;
            }

            // Special meaning of the Y position
            // we use 0,0 as origin (top, left) and negative
            // values for offscreen. The TMS9918 uses line 255
            // as zero and 0 as 1, so therefore we substract 255-y
            // if value is bigger then 238 (still a line is rendered in case of 16x16)
            if (y > 238) {
                y = 0 - (255 - y);
            } else {
                y += 1;
            }

            // Get the sprite pattern
            if (this.getSixteen()) {
                for (let i = 0; i < 32; i++) {
                    let sy = (i > 7 && i < 16) || (i > 23) ? 8 : 0;
                    let sx = (i > 15) ? 8 : 0;
                    let s = this.vram[SG + (8 * (p & 0xfc)) + i];
                    for (let j = 0; j < 8; j++) {
                        if (s & (1 << (7 - j))) {
                            let ypos = y + sy + (i % 8);
                            let xpos = x + sx + j;
                            if (ypos >= 0 && ypos < 208 && xpos >= 0 && xpos <= 255) {
                                image[(256 * ypos) + xpos] = this.palette[c];
                                if (this.spriteDetectionBuffer[(256 * ypos) + xpos]) {
                                    this.statusRegisters[0] |= StatusFlags.S_C;
                                } else {
                                    this.spriteDetectionBuffer[(256 * ypos) + xpos] = s + 1;
                                }
                            }
                        }
                    }
                }
            } else {
                for (let i = 0; i < 8; i++) {
                    let s = this.vram[SG + (8 * p) + i];
                    for (let j = 0; j < 8; j++) {
                        if (s & (1 << (7 - j))) {
                            let ypos = y + i;
                            let xpos = x + j;
                            if (ypos >= 0 && ypos < 208 && xpos >= 0 && xpos <= 255) {
                                image[(256 * ypos) + xpos] = this.palette[c];
                                if (this.spriteDetectionBuffer[(256 * ypos) + xpos]) {
                                    this.statusRegisters[0] |= StatusFlags.S_C;
                                } else {
                                    this.spriteDetectionBuffer[(256 * ypos) + xpos] = s + 1;
                                }
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