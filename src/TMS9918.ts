export class TMS9918 {
    
    registers = new Uint8Array(8);
    vram = new Uint8Array(0x4000);
    vramAddress = 0;
    vdpStatus = 0;
    
    hasLatchedData = false;
    latchedData = 0;
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
*/

    getSprintAttributeTable() {
        return (this.registers[5] & 0x7f) << 7;
    }

    getColorTable() {
        return (this.registers[3]) << 6; 
    }

    getPatternGenerationTable() {
        return (this.registers[4]) << 13; 
    }

    getTextColor() {
        return (this.registers[7]) >> 4 ;  
    }

    getBackdropColor() {
        return (this.registers[7]) & 0xf ;  
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
                    this.registers[register] =  this.latchedData;                
                } else if (value & 0x40) {
                    // Setup video write address
                    this.vramAddress = (value & 0x3f) << 8 + this.latchedData;
                } else {
                    // Setup video write address
                    this.vramAddress = (value & 0x3f) << 8 + this.latchedData;
                }
            }
        } else {
            this.hasLatchedData = true;
            // Mode = 0 means writing to video memory
            this.vram[this.vramAddress] = value;
            this.vramAddress = (this.vramAddress + 1) % 16384;
        }
    }

    read(mode: boolean): number {
        this.hasLatchedData = false;
    
        if (mode) {
            return this.vdpStatus;
        } else {
            let value = this.vram[this.vramAddress];
            this.vramAddress = (this.vramAddress + 1) % 16384;
            return value;
        }
    }
}