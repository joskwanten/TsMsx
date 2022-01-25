import { Memory } from './Memory';

export class KonamiMegaRom implements Memory {
    //memory = new Uint8Array(0x10000);
    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);

    selectedPages = [0, 1, 2, 3];
    pageSize = 0x2000;
    /**
     *
     */
    constructor(private memory: Uint8Array) {

    }

    private getRealAddress(address: number): number {
        let index = ((address - 0x4000) >>> 13);
        if (index >= 0 && index <= 3) {
            let page = this.selectedPages[index];
            return (page * this.pageSize) + (address - 0x4000);
        }

        return 0;
    }

    uread8(address: number): number {
       return this.memory[this.getRealAddress(address)];
    }

    read8(address: number): number {
        return this.memorys[this.getRealAddress(address)];
    }

    uread16(address: number): number {
        address = this.getRealAddress(address)
        return this.memory[address] + (this.memory[address + 1] << 8);
    }

    uwrite8(address: number, value: number): void {
        let index = ((address - 0x4000) >>> 13);
        if (index >= 0 && index <= 3) {
            this.selectedPages[index] = value;
        }
    }

    uwrite16(address: number, value: number): void {
        // Not implemented
    }
}
