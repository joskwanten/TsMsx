import { Ram } from './Ram';
import { Logger, Registers } from './Logger';
import { CPU } from "./CPU";
import { IO } from "./IO";
import { Memory } from "./Memory";
import { throws } from 'assert';

const A = 1;
const F = 0;
const B = 3;
const C = 2;
const D = 5;
const E = 4;
const H = 7;
const L = 6;
const I = 16;
const R = 17;
const IXh = 9;
const IXl = 8;
const IYh = 11;
const IYl = 10;
const r16_debug = ["AF", "BC", "DE", "HL", "IX", "IY", "SP", "PC"];

const AF = 0;
const BC = 1;
const DE = 2;
const HL = 3;
const IX = 4;
const IY = 5;
const SP = 6;
const _I = 7;
const _R = 8;
const PC = 9;
const _F = 10;

enum Flags {
    S = 0b10000000,
    Z = 0b01000000,
    F5 = 0b00100000,
    H = 0b00010000,
    F3 = 0b00001000,
    PV = 0b00000100,
    N = 0b00000010,
    C = 0b00000001,
    S_F5_F3 = 0b10101000,
}

enum LogicalOperation {
    AND,
    OR,
    XOR,
}

export class Z80 implements CPU {
    // Declare 256bits for the registers
    // The Z80 uses 208bits from it
    r16 = new Uint16Array(16);

    // We will use this array with only one element
    // to convert a javascript number to a 16 bit represenation
    // this to find out which flags have to be set
    rAlu = new Uint16Array(1);

    // Array to access shadow registers
    r16s = new Uint16Array(16);

    // Map the registers to 8bit registers
    r8 = new Uint8Array(this.r16.buffer);

    // Array to access shadow registers in 8bit mode
    r8s = new Uint8Array(this.r16s);

    // Interrupts are enabled at startup
    interruptEnabled: boolean = true;

    // Interrupt flags 
    iff1 = true;
    iff2 = true;

    // flag to indicate if the CPU is halted
    halted = false;
    cycles: number = 0;
    opcodes: ((addr: number) => void)[] = [];
    opcodesED: ((addr: number) => void)[] = [];
    opcodesDD: ((addr: number) => void)[] = [];
    opcodesFD: ((addr: number) => void)[] = [];
    opcodesCB: ((addr: number) => void)[] = [];
    opcodesDDCB: ((addr: number, o: number) => void)[] = [];
    opcodesFDCB: ((addr: number, o: number) => void)[] = [];
    evenParity: boolean[] = [];

    addSub8(value1: number, value2: number, sub: boolean, carry: boolean): number {
        // If carry has to be taken into account add one to the second operand
        if (carry && (this.r8[F] & Flags.C)) {
            value2 += 1;
        }

        if (sub) {
            // Substraction is the same as an addition except that it
            // uses the 2's-complement value for the computation
            value2 = (~(value2 - 1)) & 0xff
        }

        let result = value1 + value2;

        // Set / Reset N flag depending if it is an addition or substraction
        if (sub) { this.r8[F] |= ~Flags.N } else { this.r8[F] &= ~Flags.N }

        // Set Zero flag if result is zero
        if (result == 0) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }

        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3;           // Reset bits
        this.r8[F] |= (result & Flags.S_F5_F3); // Set bits if set in the result

        // Set carry if bit 9 is set
        if (result & 0x100) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Overflow, if signs of both values are the same and the sign result is different, then we have
        // an overflow e.g. when adding 0x7f (127) + 1 = 0x80 (-1)
        let overflow = ((value1 & 0x80) == (value2 & 0x80)) && ((result & 0x80) != (value1 & 0x80));

        // Set carry if bit 9 is set
        if (overflow) { this.r8[F] |= Flags.PV } else { this.r8[F] &= ~Flags.PV }

        return result;
    }

    addSub16(value1: number, value2: number, sub: boolean, carry: boolean): number {
        // If carry has to be taken into account add one to the second operand
        if (carry && (this.r8[F] & Flags.C)) {
            value2 += 1;
        }

        if (sub) {
            // Substraction is the same as an addition except that it
            // uses the 2's-complement value for the computation
            value2 = (~(value2 - 1)) & 0xffff
        }

        let result = value1 + value2;

        // Set / Reset N flag depending if it is an addition or substraction
        if (sub) { this.r8[F] |= ~Flags.N } else { this.r8[F] &= ~Flags.N }

        // Set Zero flag if result is zero
        if (result == 0) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }

        // Set Sign / F3 / F5 are copies of the result
        this.r8[F] &= ~Flags.S_F5_F3;           // Reset bits
        this.r8[F] |= ((result >> 8) & Flags.S_F5_F3); // Set bits if set in the result

        // Set carry if bit 9 is set
        if (result & 0x10000) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Overflow, if signs of both values are the same and the sign result is different, then we have
        // an overflow e.g. when adding 0x7f (127) + 1 = 0x80 (-1)
        let overflow = ((value1 & 0x8000) == (value2 & 0x8000)) && ((result & 0x8000) != (value1 & 0x8000));

        // Set carry if bit 9 is set
        if (overflow) { this.r8[F] |= Flags.PV } else { this.r8[F] &= ~Flags.PV }

        return result;
    }


    incDec8(value: number, inc: boolean): number {
        // Add 1 or in case of decrement the two's complement of one
        let result = value + (inc ? 0x01 : 0xff);

        // Reset N flag if it is an increment
        if(!inc) { this.r8[F] |= Flags.N; } else { this.r8[F] &= ~Flags.N; }

        // Set Zero flag if result is zero
        if (result == 0) { this.r8[F] |= Flags.Z; } else { this.r8[F] &= ~Flags.Z; }

        // Set sign if the result has its sign bit set (2-complement)
        if (result & 0x80) { this.r8[F] |= Flags.S; } else { this.r8[F] &= ~Flags.S; }

        // Carry is unaffected

        // Overflow, if the sign becomes negative when adding one
        let overflow = inc ? 
            ((value & 0x80) == 0) && ((result & 0x80) != 0) :
            ((value & 0x80) == 0x80) && ((result & 0x80) != 0x80);

        // Set carry if bit 9 is set
        if (overflow) { this.r8[F] |= Flags.PV; } else { this.r8[F] &= ~Flags.PV; }

        return result;
    }

    logicalOperation(value: number, operation: LogicalOperation) {
        // Add 1 or in case of decrement the two's complement of one
        let result = (operation == LogicalOperation.AND) ? this.r8[A] & value 
            : (operation == LogicalOperation.OR) ? this.r8[A] | value
            : this.r8[A] ^ value;

        // Reset N and C flags
        this.r8[F] &= ~Flags.N;
        this.r8[F] &= ~Flags.C;

        // Set Zero flag if result is zero
        if (result == 0) { this.r8[F] |= Flags.Z; } else { this.r8[F] &= ~Flags.Z; }

        // Set sign if the result has its sign bit set (2-complement)
        if (result & 0x80) { this.r8[F] |= Flags.S; } else { this.r8[F] &= ~Flags.S; }

        // Set parity if even
        if (this.evenParity[this.r8[A]]) { this.r8[F] |= Flags.PV; } else { this.r8[F] &= ~Flags.PV; }
    }

    shiftRotateFlags(result: number) { 
        // Reset H and N flags
        this.r8[F] &= ~Flags.H;
        this.r8[F] &= ~Flags.N;

        // Set Zero flag if result is zero
        if (result == 0) { this.r8[F] |= Flags.Z; } else { this.r8[F] &= ~Flags.Z; }

        // Set sign if the result has its sign bit set (2-complement)
        if (result & 0x80) { this.r8[F] |= Flags.S; } else { this.r8[F] &= ~Flags.S; }

        // Set parity if even
        if (this.evenParity[this.r8[A]]) { this.r8[F] |= Flags.PV; } else { this.r8[F] &= ~Flags.PV; }
    }


    rotateLeft(value: number): number{
        let result = (value << 1) + (this.r8[F] & Flags.C) ? 1 : 0;
        if (result & 0x100) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }
        this.shiftRotateFlags(result);
        return result;
    }

    rotateLeftCarry(value: number): number {
        let result = (value << 1);
        // If we have a carry set bit 0 and the carry flag
        if (result & 0x100) {
            result |= 1;
            this.r8[F] |= Flags.C 
        } else { 
            this.r8[F] &= ~Flags.C 
        }
        this.shiftRotateFlags(result);
        return result;
    }

    rotateRight(value: number): number {
        // bit 0 will be shifted to the carry
        let bit0 = value & 1;

        // Do shifting and add carry as bit 7 (0x80)
        let result = (value >> 1) + (this.r8[F] & Flags.C) ? 0x80 : 0;
        
        // Store bit 0 into the carry
        if (bit0) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Set flags
        this.shiftRotateFlags(result);
        return result;
    }

    rotateRightCarry(value: number): number {
        // bit 0 will be shifted to the carry
        let bit0 = value & 1;
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value >> 1) + bit0 ? 0x80 : 0;
        
        // Store bit0 into the carry
        if (bit0) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Set flags
        this.shiftRotateFlags(result);
        return result;
    }

    shiftLeft(value: number): number {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value << 1);
        
        // Store bit0 into the carry
        if (result & 0x100) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Set flags
        this.shiftRotateFlags(result);
        return result;
    }

    shiftRightLogic(value: number): number {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value >> 1);
        
        // Store original bit0 into the carry
        if (value & 1) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Set flags
        this.shiftRotateFlags(result);
        return result;
    }

    shiftRightArithmetic(value: number): number {
        // Do shifting and add bit0 as bit 7 (0x80)
        let result = (value >> 1);
        
        // Copy bit 7 from the original value to maintain the same sign
        result |= (value & 0x80);

        // Store original bit0 into the carry
        if (value & 1) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }

        // Set flags
        this.shiftRotateFlags(result);
        return result;
    }

    generateEvenParityTable() {
        this.evenParity = [...Array(256).keys()]
            .map(x => {
                let sum = 0;
                for (let i = 0; i < 8; i++) {
                    sum += ((x >> i) & 1);
                };
                return !(sum & 1);
            });
    }

    constructor(private memory: Memory, private IO: IO, private logger: Logger) {
        // Generate parity table for fast computation of parity
        this.generateEvenParityTable();

        this.opcodes[0xED] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesED[opcode](addr);
        }
        this.opcodes[0xDD] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesDD[opcode](addr);
        }
        this.opcodes[0xFD] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesFD[opcode](addr);
        }
        this.opcodes[0xCB] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesCB[opcode](addr);
        }
        this.opcodesDD[0xCB] = (addr) => {
            let o = this.memory.uread8(this.r16[PC]++);
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesDDCB[opcode](addr, o);
        }
        this.opcodesFD[0xCB] = (addr) => {
            let o = this.memory.uread8(this.r16[PC]++);
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesFDCB[opcode](addr, o);
        }
        this.addOpcodes();
    }
    halt(): void {
        throw new Error('Method not implemented.');
    }
    interrupt(): void {
        throw new Error('Method not implemented.');
    }

    private hex16(n: number) {
        return ("000" + n.toString(16)).slice(-4);
    }

    private hex8(n: number) {
        return ("0" + n.toString(16)).slice(-2);
    }

    private log(address: number, msg: string): void {
        this.logger.debug(
            ("000" + address.toString(16)).slice(-4) + " : " + msg,
            this.dumpRegisters()
        );

    }

    public dumpRegisters(): Registers {
        let registers: Registers = {};
        r16_debug.forEach((v, i) => {
            registers[v] = this.r16[i];
        });

        r16_debug.forEach((v, i) => {
            registers[`_${v}`] = this.r16s[i];
        });

        return registers;
    }


    reset(): void {
        this.r16[PC] = 0;
        this.r16[SP] = 0;
    }


    execute(numOfInstructions: number, showLog: boolean) {

    }

    addInstructionCB(opcode: number, func: (addr: number) => void) {
        this.opcodesCB[opcode] = func;
    }

    addInstructionED(opcode: number, func: (addr: number) => void) {
        this.opcodesED[opcode] = func;
    }

    addInstructionDD(opcode: number, func: (addr: number) => void) {
        this.opcodesDD[opcode] = func;
    }

    addInstructionFD(opcode: number, func: (addr: number) => void) {
        this.opcodesFD[opcode] = func;
    }

    addInstructionDDCB(opcode: number, func: (addr: number, o: number) => void) {
        this.opcodesDDCB[opcode] = func;
    }

    addInstructionFDCB(opcode: number, func: (addr: number, o: number) => void) {
        this.opcodesFDCB[opcode] = func;
    }

    addInstruction(opcode: number, func: (addr: number) => void) {
        this.opcodes[opcode] = func;
    }

    addOpcodes() {
this.addInstructionCB(0x16, (addr: number) => {
// RL (HL) Opcode: CB 16
let val = this.memory.uread8(this.r16[HL]);
val = this.rotateLeft(val);
this.memory.uwrite8(this.r16[HL], val);
this.cycles += 15;
this.log(addr, `RL (HL)`);
});

this.addInstructionDDCB(0x16, (addr: number, o: number) => {
// RL (IX+o) Opcode: DD CB o 16
let val = this.memory.uread8(this.r16[IX] + o);
val = this.rotateLeft(val);
this.memory.uwrite8(this.r16[IX] + o, val);
this.cycles += 23;
this.log(addr, `RL (IX+${o})`);
});

this.addInstructionFDCB(0x16, (addr: number, o: number) => {
// RL (IY+o) Opcode: FD CB o 16
let val = this.memory.uread8(this.r16[IY] + o)
val = this.rotateLeft(val);
this.memory.uwrite8(this.r16[IY] + o, val);
this.cycles += 23;
this.log(addr, `RL (IY+${o})`);
});

this.addInstructionCB(0x10, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[B] = this.rotateLeft(this.r8[B]);
this.cycles += 8;
this.log(addr, `RL B`);
});

this.addInstructionCB(0x11, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[C] = this.rotateLeft(this.r8[C]);
this.cycles += 8;
this.log(addr, `RL C`);
});

this.addInstructionCB(0x12, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[D] = this.rotateLeft(this.r8[D]);
this.cycles += 8;
this.log(addr, `RL D`);
});

this.addInstructionCB(0x13, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[E] = this.rotateLeft(this.r8[E]);
this.cycles += 8;
this.log(addr, `RL E`);
});

this.addInstructionCB(0x14, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[H] = this.rotateLeft(this.r8[H]);
this.cycles += 8;
this.log(addr, `RL H`);
});

this.addInstructionCB(0x15, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[L] = this.rotateLeft(this.r8[L]);
this.cycles += 8;
this.log(addr, `RL L`);
});

this.addInstructionCB(0x17, (addr: number) => {
// RL r Opcode: CB 10+r
this.r8[A] = this.rotateLeft(this.r8[A]);
this.cycles += 8;
this.log(addr, `RL A`);
});

this.addInstructionCB(0x06, (addr: number) => {
// RLC (HL) Opcode: CB 06
let val = this.memory.uread8(this.r16[HL]);
val = this.rotateLeftCarry(val);
this.memory.uwrite8(this.r16[HL], val);
this.cycles += 15;
this.log(addr, `RLC (HL)`);
});

this.addInstructionDDCB(0x06, (addr: number, o: number) => {
// RLC (IX+o) Opcode: DD CB o 06
let val = this.memory.uread8(this.r16[IX] + o);
val = this.rotateLeftCarry(val);
this.memory.uwrite8(this.r16[IX] + o, val);
this.cycles += 23;
this.log(addr, `RLC (IX+${o})`);
});

this.addInstructionFDCB(0x06, (addr: number, o: number) => {
// RLC (IY+o) Opcode: FD CB o 06
let val = this.memory.uread8(this.r16[IY] + o)
val = this.rotateLeftCarry(val);
this.memory.uwrite8(this.r16[IY] + o, val);
this.cycles += 23;
this.log(addr, `RLC (IY+${o})`);
});

this.addInstructionCB(0x0, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[B] = this.rotateLeftCarry(this.r8[B]);
this.cycles += 8;
this.log(addr, `RLC B`);
});

this.addInstructionCB(0x1, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[C] = this.rotateLeftCarry(this.r8[C]);
this.cycles += 8;
this.log(addr, `RLC C`);
});

this.addInstructionCB(0x2, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[D] = this.rotateLeftCarry(this.r8[D]);
this.cycles += 8;
this.log(addr, `RLC D`);
});

this.addInstructionCB(0x3, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[E] = this.rotateLeftCarry(this.r8[E]);
this.cycles += 8;
this.log(addr, `RLC E`);
});

this.addInstructionCB(0x4, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[H] = this.rotateLeftCarry(this.r8[H]);
this.cycles += 8;
this.log(addr, `RLC H`);
});

this.addInstructionCB(0x5, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[L] = this.rotateLeftCarry(this.r8[L]);
this.cycles += 8;
this.log(addr, `RLC L`);
});

this.addInstructionCB(0x7, (addr: number) => {
// RLC r Opcode: CB 00+r
this.r8[A] = this.rotateLeftCarry(this.r8[A]);
this.cycles += 8;
this.log(addr, `RLC A`);
});

this.addInstructionCB(0x1E, (addr: number) => {
// RR (HL) Opcode: CB 1E
let val = this.memory.uread8(this.r16[HL]);
val = this.rotateRight(val);
this.memory.uwrite8(this.r16[HL], val);
this.cycles += 15;
this.log(addr, `RR (HL)`);
});

this.addInstructionDDCB(0x1E, (addr: number, o: number) => {
// RR (IX+o) Opcode: DD CB o 1E
let val = this.memory.uread8(this.r16[IX] + o);
val = this.rotateRight(val);
this.memory.uwrite8(this.r16[IX] + o, val);
this.cycles += 23;
this.log(addr, `RR (IX+${o})`);
});

this.addInstructionFDCB(0x1E, (addr: number, o: number) => {
// RR (IY+o) Opcode: FD CB o 1E
let val = this.memory.uread8(this.r16[IY] + o)
val = this.rotateRight(val);
this.memory.uwrite8(this.r16[IY] + o, val);
this.cycles += 23;
this.log(addr, `RR (IY+${o})`);
});

this.addInstructionCB(0x18, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[B] = this.rotateRight(this.r8[B]);
this.cycles += 8;
this.log(addr, `RR B`);
});

this.addInstructionCB(0x19, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[C] = this.rotateRight(this.r8[C]);
this.cycles += 8;
this.log(addr, `RR C`);
});

this.addInstructionCB(0x1a, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[D] = this.rotateRight(this.r8[D]);
this.cycles += 8;
this.log(addr, `RR D`);
});

this.addInstructionCB(0x1b, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[E] = this.rotateRight(this.r8[E]);
this.cycles += 8;
this.log(addr, `RR E`);
});

this.addInstructionCB(0x1c, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[H] = this.rotateRight(this.r8[H]);
this.cycles += 8;
this.log(addr, `RR H`);
});

this.addInstructionCB(0x1d, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[L] = this.rotateRight(this.r8[L]);
this.cycles += 8;
this.log(addr, `RR L`);
});

this.addInstructionCB(0x1f, (addr: number) => {
// RR r Opcode: CB 18+r
this.r8[A] = this.rotateRight(this.r8[A]);
this.cycles += 8;
this.log(addr, `RR A`);
});

this.addInstructionCB(0x0E, (addr: number) => {
// RRC (HL) Opcode: CB 0E
let val = this.memory.uread8(this.r16[HL]);
val = this.rotateRightCarry(val);
this.memory.uwrite8(this.r16[HL], val);
this.cycles += 15;
this.log(addr, `RRC (HL)`);
});

this.addInstructionDDCB(0x0E, (addr: number, o: number) => {
// RRC (IX+o) Opcode: DD CB o 0E
let val = this.memory.uread8(this.r16[IX] + o);
val = this.rotateRightCarry(val);
this.memory.uwrite8(this.r16[IX] + o, val);
this.cycles += 23;
this.log(addr, `RRC (IX+${o})`);
});

this.addInstructionFDCB(0x0E, (addr: number, o: number) => {
// RRC (IY+o) Opcode: FD CB o 0E
let val = this.memory.uread8(this.r16[IY] + o)
val = this.rotateRightCarry(val);
this.memory.uwrite8(this.r16[IY] + o, val);
this.cycles += 23;
this.log(addr, `RRC (IY+${o})`);
});

this.addInstructionCB(0x8, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[B] = this.rotateRightCarry(this.r8[B]);
this.cycles += 8;
this.log(addr, `RRC B`);
});

this.addInstructionCB(0x9, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[C] = this.rotateRightCarry(this.r8[C]);
this.cycles += 8;
this.log(addr, `RRC C`);
});

this.addInstructionCB(0xa, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[D] = this.rotateRightCarry(this.r8[D]);
this.cycles += 8;
this.log(addr, `RRC D`);
});

this.addInstructionCB(0xb, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[E] = this.rotateRightCarry(this.r8[E]);
this.cycles += 8;
this.log(addr, `RRC E`);
});

this.addInstructionCB(0xc, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[H] = this.rotateRightCarry(this.r8[H]);
this.cycles += 8;
this.log(addr, `RRC H`);
});

this.addInstructionCB(0xd, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[L] = this.rotateRightCarry(this.r8[L]);
this.cycles += 8;
this.log(addr, `RRC L`);
});

this.addInstructionCB(0xf, (addr: number) => {
// RRC r Opcode: CB 08+r
this.r8[A] = this.rotateRightCarry(this.r8[A]);
this.cycles += 8;
this.log(addr, `RRC A`);
});

    }
}

