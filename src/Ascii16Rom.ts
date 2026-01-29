import { Memory } from './Memory';

export class Ascii16Rom implements Memory {
    bankRegisters = [0, 1];
    /**
     *
     */
    constructor(private memory: Uint8Array) {

    }

    uread8(address: number): number {
        let rom_addr = (this.bankRegisters[(address >> 15) & 1] << 14) | (address & 0x3FFF);
        return this.memory[rom_addr];
    }

    uwrite8(address: number, value: number): void {
        
        switch (address & 0xF800)
        {
        case 0x6000:
            this.bankRegisters[0] = value & 0x3F;
            break;
        case 0x7000:
            this.bankRegisters[1] = value & 0x3F;
            break;
        default:
            break;
        }
    }
    
}
