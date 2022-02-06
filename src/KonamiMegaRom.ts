import { Memory } from './Memory';

export class KonamiMegaRom implements Memory {
    //memory = new Uint8Array(0x10000);
    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);

    selectedPages = [0, 0, 0, 0, 0, 1, 2, 4];
    pageSize = 0x2000;
    /**
     *
     */
    constructor(private memory: Uint8Array) {

    }

    uread8(address: number): number {
        let pageIndex = (address >>> 13) % 8;
        let page = this.selectedPages[pageIndex];
        return this.memory[(page * this.pageSize) + (address % this.pageSize)];
    }

    uwrite8(address: number, value: number): void {
        this.selectedPages[(address >>> 13) % 8] = value;
    }
}
