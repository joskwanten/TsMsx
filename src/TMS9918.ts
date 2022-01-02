export class TMS9918 {
    
    registers = new Uint8Array(8);
    vram = new Uint8Array(0x4000);
    vramWriteAddress = 0;
    vramReadAddress = 0;
    vdpStatus = 0;
    
    hasLatchedData = false;
    latchedData = 0;

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
                    this.vramWriteAddress = (value & 0x3f) << 8 + this.latchedData;
                } else {
                    // Setup video write address
                    this.vramReadAddress = (value & 0x3f) << 8 + this.latchedData;
                }
            }
        } else {
            // Mode = 0 means writing to video memory
            this.vram[this.vramWriteAddress++] = value;
        }
    }

    read(mode: boolean): number {
        if (mode) {
            return this.vdpStatus;
        } else {
            return this.vram[this.vramReadAddress++];
        }
    }
}