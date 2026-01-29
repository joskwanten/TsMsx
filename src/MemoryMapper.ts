import { Memory } from "./Memory.js";

export class MemoryMapper implements Memory {
  segments = [0, 1, 2, 3];
  memory = new Uint8Array(16 * 16 * 1024).fill(0x00);

  uread8(address: number): number {
    let page = address >> 14;
    let bank = this.segments[page] & 0x0f;
    let ram_addr = (bank << 14) | (address & 0x3fff);
    return this.memory[ram_addr];
  }

  uwrite8(address: number, value: number): void {
    let page = address >> 14;
    let bank = this.segments[page] & 0x0f;
    let ram_addr = (bank << 14) | (address & 0x3fff);
    this.memory[ram_addr] = value;
  }

  io_write(port: number, data: number): void {
    this.segments[port & 0x03] = data;
  }
}
