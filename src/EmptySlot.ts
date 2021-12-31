import { Memory } from './Memory';

export class EmptySlot implements Memory {
    uread8(address: number): number {
        return 0xff;
    }
    read8(address: number): number {
        return 0xff;
    }
    uread16(address: number): number {
        return 0xffff;
    }
    
    uwrite8(address: number, value: number): void {
        
    }

    uwrite16(address: number, value: number): void {        
           
    }
}
