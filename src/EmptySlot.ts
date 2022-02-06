import { Memory } from './Memory';

export class EmptySlot implements Memory {
    uread8(address: number): number {
        return 0x0;
    }
    
    uwrite8(address: number, value: number): void {
        
    }
}
