const rtc_block = 0;
const alarm_block = 0;

export class RP_5C10_RTC {    
    registerBlocks = [new Uint8Array(16), new Uint8Array(16), new Uint8Array(16), new Uint8Array(16)];
    register: number = 0;

    get selectedBlock() {
        return this.registerBlocks[0][13] & 3;
    }

    selectRegister(value: number) {
        this.register = value & 0xf;
    }

    writeRegister(value: number) {
        if (this.register >= 13) {
            this.registerBlocks[0][this.register] = value & 0xf;
        } else {
            this.registerBlocks[this.selectedBlock][this.register] = value & 0xf;
        }
    }

    readRegister(): number {
        if (this.register >= 13) {
            return this.registerBlocks[0][this.register];
        } else {
            return this.registerBlocks[this.selectedBlock][this.register];
        }
    }
}