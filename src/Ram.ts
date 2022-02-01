import { Memory } from './Memory.js';

export class Ram implements Memory {
    memory = new Uint8Array(0x10000).fill(0x00);
    memorys = new Int8Array(this.memory.buffer);
    memory16 = new Uint16Array(this.memory.buffer);
  
    uread8(address: number): number {
        return this.memory[address & 0xFFFF];
    }

    read8(address: number): number {
        return this.memorys[address & 0xFFFF];
    }
    
    uread16(address: number): number {
        address = address & 0xFFFF;
        return this.memory[address] + (this.memory[address + 1] << 8);
    }
    
    uwrite8(address: number, value: number): void {
        this.memory[address & 0xFFFF] = value;
    }

    uwrite16(address: number, value: number): void {  
        address = address & 0xFFFF;   
        this.memory[address] = value ;   
        this.memory[address + 1] = (value >> 8);     
    }
}
