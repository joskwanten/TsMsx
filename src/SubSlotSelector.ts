import { Memory } from './Memory.js'

export class SubSlotSelector implements Memory {
    private subSlotRegister = 0;

    constructor(private subSlots: Memory[]) {
        if (subSlots.length < 4) {
            throw new Error("SubSlotSelector requires at least 4 subslots");
        }
    }

    private selectedSlot(address: number): Memory {
        // Elk 16KB segment gebruikt 2 bits van het subslotregister
        let index: number;
        if (address <= 0x3fff) {
            index = this.subSlotRegister & 0x3;          // 0x0000 - 0x3FFF
        } else if (address <= 0x7fff) {
            index = (this.subSlotRegister >>> 2) & 0x3; // 0x4000 - 0x7FFF
        } else if (address <= 0xbfff) {
            index = (this.subSlotRegister >>> 4) & 0x3; // 0x8000 - 0xBFFF
        } else {
            index = (this.subSlotRegister >>> 6) & 0x3; // 0xC000 - 0xFFFF
        }
        return this.subSlots[index];
    }

    uread8(address: number): number {
        if (address === 0xffff) {
            // Lezen van het subslotregister geeft complement terug volgens MSX-spec
            return (~this.subSlotRegister) & 0xff;
        }
        return this.selectedSlot(address).uread8(address);
    }

    uwrite8(address: number, value: number): void {
        if (address === 0xffff) {
            //console.log(`SubSlot select 0b${value.toString(2)}`);
            this.subSlotRegister = value & 0xff;
        } else {
            this.selectedSlot(address).uwrite8(address, value);
        }
    }
}
