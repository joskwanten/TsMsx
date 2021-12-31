import { SlotSelector } from './SlotSelector';
import { Memory } from './Memory'


export class SubSlotSelector implements Memory  {
    subSlotRegister: number = 0xf0; // Default VG8020 configuration
    
    constructor(private subSlots: Memory[]) {
        console.log(subSlots.length);
    }

    selectedSlot(address: number): Memory {
        //console.log(`Address: ${address.toString(16)}`);
        if (address >= 0 && address <= 0x3fff) {
            return this.subSlots[this.subSlotRegister & 0x3];
        } else if (address >= 0x4000 && address <= 0x7fff) {
            return this.subSlots[(this.subSlotRegister >> 2) & 0x3];
        } else if (address >= 0x8000 && address <= 0xbfff) {
            return this.subSlots[(this.subSlotRegister >> 4) & 0x3];
        } else {
            return this.subSlots[(this.subSlotRegister >> 6) & 0x3];
        }
    }

    uread8(address: number): number {
        console.log(`Reading ${address.toString(16)}`);
        return this.selectedSlot(address).uread8(address);
    }

    read8(address: number): number {
        return this.selectedSlot(address).read8(address);
    }

    uread16(address: number): number {
        return this.selectedSlot(address).uread16(address);
    }

    uwrite8(address: number, value: number): void {
        console.log(`Writing ${address.toString(16)},${value.toString(16)}`);
        if (address == 0xffff) {
            this.subSlotRegister = value;
            value = ~value;
        }

        this.selectedSlot(address).uwrite8(address, value);
    }

    uwrite16(address: number, value: number): void {
        if (address == 0xfffe) {
            this.subSlotRegister = value >> 8 && 0xff;
            value = (value && 0xff) + (~this.subSlotRegister) << 8;
        }

        this.selectedSlot(address).uwrite16(address, value);
    }
}