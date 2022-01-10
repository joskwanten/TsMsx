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

    // Number of T-States executed
    tStates: number = 0;

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
    opcodesCD: ((addr: number) => void)[] = [];

    constructor(private memory: Memory, private IO: IO, private logger: Logger) {
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
        this.opcodes[0xCD] = (addr) => {
            let opcode = this.memory.uread8(this.r16[PC]++);
            this.opcodesCD[opcode](addr);
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
  
    addOpcodes() {
        this.addInstruction(0x2, (addr: number) => {
            // LD (BC),A Opcode: 2
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[BC], val);
            this.cycles += 7;
            this.log(addr, `LD (BC),A`)
        });

        this.addInstruction(0x12, (addr: number) => {
            // LD (DE),A Opcode: 12
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[DE], val);
            this.cycles += 7;
            this.log(addr, `LD (DE),A`)
        });

        this.addInstruction(0x36, (addr: number) => {
            // LD (HL),n Opcode: 36 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 10;
            this.log(addr, `LD (HL),${val}`)
        });

        this.addInstruction(0x70, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),B`)
        });

        this.addInstruction(0x71, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),C`)
        });

        this.addInstruction(0x72, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),D`)
        });

        this.addInstruction(0x73, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),E`)
        });

        this.addInstruction(0x74, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),H`)
        });

        this.addInstruction(0x75, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),L`)
        });

        this.addInstruction(0x77, (addr: number) => {
            // LD (HL),r Opcode: 70+r
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[HL], val);
            this.cycles += 7;
            this.log(addr, `LD (HL),A`)
        });

        this.addInstructionDD(0x36, (addr: number) => {
            // LD (IX+o),n Opcode: DD 36 o n
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),${val}`)
        });

        this.addInstructionDD(0x70, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),B`)
        });

        this.addInstructionDD(0x71, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),C`)
        });

        this.addInstructionDD(0x72, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),D`)
        });

        this.addInstructionDD(0x73, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),E`)
        });

        this.addInstructionDD(0x74, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),H`)
        });

        this.addInstructionDD(0x75, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),L`)
        });

        this.addInstructionDD(0x77, (addr: number) => {
            // LD (IX+o),r Opcode: DD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[IX] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IX+${o}),A`)
        });

        this.addInstructionFD(0x36, (addr: number) => {
            // LD (IY+o),n Opcode: FD 36 o n
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[PC]++);
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),${val}`)
        });

        this.addInstructionFD(0x70, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[B];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),B`)
        });

        this.addInstructionFD(0x71, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[C];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),C`)
        });

        this.addInstructionFD(0x72, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[D];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),D`)
        });

        this.addInstructionFD(0x73, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[E];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),E`)
        });

        this.addInstructionFD(0x74, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[H];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),H`)
        });

        this.addInstructionFD(0x75, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[L];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),L`)
        });

        this.addInstructionFD(0x77, (addr: number) => {
            // LD (IY+o),r Opcode: FD 70+r o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.r8[A];
            this.memory.uwrite8(this.r16[IY] + o, val);
            this.cycles += 19;
            this.log(addr, `LD (IY+${o}),A`)
        });

        this.addInstruction(0x32, (addr: number) => {
            // LD (nn),A Opcode: 32 nn nn
            let val = this.r8[A];

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite8(nn, val);

            this.cycles += 13;
            this.log(addr, `LD (nn),A`)
        });

        this.addInstructionED(0x43, (addr: number) => {
            // LD (nn),BC Opcode: ED 43 nn nn
            let val = this.r16[BC];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
            this.log(addr, `LD (nn),BC`)
        });

        this.addInstructionED(0x53, (addr: number) => {
            // LD (nn),DE Opcode: ED 53 nn nn
            let val = this.r16[DE];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
            this.log(addr, `LD (nn),DE`)
        });

        this.addInstruction(0x22, (addr: number) => {
            // LD (nn),HL Opcode: 22 nn nn
            let val = this.r16[HL];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 16;
            this.log(addr, `LD (nn),HL`)
        });

        this.addInstructionDD(0x22, (addr: number) => {
            // LD (nn),IX Opcode: DD 22 nn nn
            let val = this.r16[IX];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
            this.log(addr, `LD (nn),IX`)
        });

        this.addInstructionFD(0x22, (addr: number) => {
            // LD (nn),IY Opcode: FD 22 nn nn
            let val = this.r16[IY];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
            this.log(addr, `LD (nn),IY`)
        });

        this.addInstructionED(0x73, (addr: number) => {
            // LD (nn),SP Opcode: ED 73 nn nn
            let val = this.r16[SP];
            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            this.memory.uwrite16(nn, val);
            this.cycles += 20;
            this.log(addr, `LD (nn),SP`)
        });

        this.addInstruction(0x0A, (addr: number) => {
            // LD A,(BC) Opcode: 0A
            let val = this.memory.uread8(this.r16[BC]);
            this.r8[A] = val;
            this.cycles += 7;
            this.log(addr, `LD A,(BC)`)
        });

        this.addInstruction(0x1A, (addr: number) => {
            // LD A,(DE) Opcode: 1A
            let val = this.memory.uread8(this.r16[DE]);
            this.r8[A] = val;
            this.cycles += 7;
            this.log(addr, `LD A,(DE)`)
        });

        this.addInstruction(0x7E, (addr: number) => {
            // LD A,(HL) Opcode: 7E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[A] = val;
            this.cycles += 7;
            this.log(addr, `LD A,(HL)`)
        });

        this.addInstructionDD(0x7E, (addr: number) => {
            // LD A,(IX+o) Opcode: DD 7E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[A] = val;
            this.cycles += 19;
            this.log(addr, `LD A,(IX+${o})`)
        });

        this.addInstructionFD(0x7E, (addr: number) => {
            // LD A,(IY+o) Opcode: FD 7E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[A] = val;
            this.cycles += 19;
            this.log(addr, `LD A,(IY+${o})`)
        });

        this.addInstruction(0x3A, (addr: number) => {
            // LD A,(nn) Opcode: 3A nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r8[A] = val;
            this.cycles += 13;
            this.log(addr, `LD A,(nn)`)
        });

        this.addInstruction(0x3E, (addr: number) => {
            // LD A,n Opcode: 3E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[A] = val;
            this.cycles += 7;
            this.log(addr, `LD A,${val}`)
        });

        this.addInstruction(0x78, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[B];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,B`)
        });

        this.addInstruction(0x79, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[C];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,C`)
        });

        this.addInstruction(0x7a, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[D];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,D`)
        });

        this.addInstruction(0x7b, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[E];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,E`)
        });

        this.addInstruction(0x7c, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[H];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,H`)
        });

        this.addInstruction(0x7d, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[L];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,L`)
        });

        this.addInstruction(0x7f, (addr: number) => {
            // LD A,r Opcode: 78+r
            let val = this.r8[A];
            this.r8[A] = val;
            this.cycles += 4;
            this.log(addr, `LD A,A`)
        });

        this.addInstructionDD(0x78, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[B];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x79, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[C];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x7a, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[D];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x7b, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[E];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x7c, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[IXh];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x7d, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[IXl];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionDD(0x7f, (addr: number) => {
            // LD A,IXp Opcode: DD 78+p
            let val = this.r8[A];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IXp`)
        });

        this.addInstructionFD(0x78, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[B];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x79, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[C];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x7a, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[D];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x7b, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[E];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x7c, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[IXh];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x7d, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[IXl];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionFD(0x7f, (addr: number) => {
            // LD A,IYq Opcode: FD 78+q
            let val = this.r8[A];
            this.r8[A] = val;
            this.cycles += 8;
            this.log(addr, `LD A,IYq`)
        });

        this.addInstructionED(0x57, (addr: number) => {
            // LD A,I Opcode: ED 57
            let val = this.r8[I];
            this.r8[A] = val;
            this.cycles += 9;
            this.log(addr, `LD A,I`)
        });

        this.addInstructionED(0x5F, (addr: number) => {
            // LD A,R Opcode: ED 5F
            let val = this.r8[R];
            this.r8[A] = val;
            this.cycles += 9;
            this.log(addr, `LD A,R`)
        });

        this.addInstruction(0x46, (addr: number) => {
            // LD B,(HL) Opcode: 46
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[B] = val;
            this.cycles += 7;
            this.log(addr, `LD B,(HL)`)
        });

        this.addInstructionDD(0x46, (addr: number) => {
            // LD B,(IX+o) Opcode: DD 46 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[B] = val;
            this.cycles += 19;
            this.log(addr, `LD B,(IX+${o})`)
        });

        this.addInstructionFD(0x46, (addr: number) => {
            // LD B,(IY+o) Opcode: FD 46 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[B] = val;
            this.cycles += 19;
            this.log(addr, `LD B,(IY+${o})`)
        });

        this.addInstruction(0x06, (addr: number) => {
            // LD B,n Opcode: 06 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[B] = val;
            this.cycles += 7;
            this.log(addr, `LD B,${val}`)
        });

        this.addInstruction(0x40, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[B];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,B`)
        });

        this.addInstruction(0x41, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[C];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,C`)
        });

        this.addInstruction(0x42, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[D];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,D`)
        });

        this.addInstruction(0x43, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[E];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,E`)
        });

        this.addInstruction(0x44, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[H];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,H`)
        });

        this.addInstruction(0x45, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[L];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,L`)
        });

        this.addInstruction(0x47, (addr: number) => {
            // LD B,r Opcode: 40+r
            let val = this.r8[A];
            this.r8[B] = val;
            this.cycles += 4;
            this.log(addr, `LD B,A`)
        });

        this.addInstructionDD(0x40, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[B];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x41, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[C];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x42, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[D];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x43, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[E];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x44, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[IXh];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x45, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[IXl];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionDD(0x47, (addr: number) => {
            // LD B,IXp Opcode: DD 40+p
            let val = this.r8[A];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IXp`)
        });

        this.addInstructionFD(0x40, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[B];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x41, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[C];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x42, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[D];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x43, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[E];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x44, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[IXh];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x45, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[IXl];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionFD(0x47, (addr: number) => {
            // LD B,IYq Opcode: FD 40+q
            let val = this.r8[A];
            this.r8[B] = val;
            this.cycles += 8;
            this.log(addr, `LD B,IYq`)
        });

        this.addInstructionED(0x4B, (addr: number) => {
            // LD BC,(nn) Opcode: ED 4B nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[BC] = val;
            this.cycles += 20;
            this.log(addr, `LD BC,(nn)`)
        });

        this.addInstruction(0x01, (addr: number) => {
            // LD BC,nn Opcode: 01 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[BC] = val;
            this.cycles += 10;
            this.log(addr, `LD BC,${val}`)
        });

        this.addInstruction(0x4E, (addr: number) => {
            // LD C,(HL) Opcode: 4E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[C] = val;
            this.cycles += 7;
            this.log(addr, `LD C,(HL)`)
        });

        this.addInstructionDD(0x4E, (addr: number) => {
            // LD C,(IX+o) Opcode: DD 4E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[C] = val;
            this.cycles += 19;
            this.log(addr, `LD C,(IX+${o})`)
        });

        this.addInstructionFD(0x4E, (addr: number) => {
            // LD C,(IY+o) Opcode: FD 4E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[C] = val;
            this.cycles += 19;
            this.log(addr, `LD C,(IY+${o})`)
        });

        this.addInstruction(0x0E, (addr: number) => {
            // LD C,n Opcode: 0E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[C] = val;
            this.cycles += 7;
            this.log(addr, `LD C,${val}`)
        });

        this.addInstruction(0x48, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[B];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,B`)
        });

        this.addInstruction(0x49, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[C];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,C`)
        });

        this.addInstruction(0x4a, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[D];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,D`)
        });

        this.addInstruction(0x4b, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[E];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,E`)
        });

        this.addInstruction(0x4c, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[H];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,H`)
        });

        this.addInstruction(0x4d, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[L];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,L`)
        });

        this.addInstruction(0x4f, (addr: number) => {
            // LD C,r Opcode: 48+r
            let val = this.r8[A];
            this.r8[C] = val;
            this.cycles += 4;
            this.log(addr, `LD C,A`)
        });

        this.addInstructionDD(0x48, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[B];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x49, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[C];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x4a, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[D];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x4b, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[E];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x4c, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[IXh];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x4d, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[IXl];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionDD(0x4f, (addr: number) => {
            // LD C,IXp Opcode: DD 48+p
            let val = this.r8[A];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IXp`)
        });

        this.addInstructionFD(0x48, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[B];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x49, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[C];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x4a, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[D];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x4b, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[E];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x4c, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[IXh];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x4d, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[IXl];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstructionFD(0x4f, (addr: number) => {
            // LD C,IYq Opcode: FD 48+q
            let val = this.r8[A];
            this.r8[C] = val;
            this.cycles += 8;
            this.log(addr, `LD C,IYq`)
        });

        this.addInstruction(0x56, (addr: number) => {
            // LD D,(HL) Opcode: 56
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[D] = val;
            this.cycles += 7;
            this.log(addr, `LD D,(HL)`)
        });

        this.addInstructionDD(0x56, (addr: number) => {
            // LD D,(IX+o) Opcode: DD 56 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[D] = val;
            this.cycles += 19;
            this.log(addr, `LD D,(IX+${o})`)
        });

        this.addInstructionFD(0x56, (addr: number) => {
            // LD D,(IY+o) Opcode: FD 56 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[D] = val;
            this.cycles += 19;
            this.log(addr, `LD D,(IY+${o})`)
        });

        this.addInstruction(0x16, (addr: number) => {
            // LD D,n Opcode: 16 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[D] = val;
            this.cycles += 7;
            this.log(addr, `LD D,${val}`)
        });

        this.addInstruction(0x50, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[B];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,B`)
        });

        this.addInstruction(0x51, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[C];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,C`)
        });

        this.addInstruction(0x52, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[D];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,D`)
        });

        this.addInstruction(0x53, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[E];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,E`)
        });

        this.addInstruction(0x54, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[H];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,H`)
        });

        this.addInstruction(0x55, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[L];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,L`)
        });

        this.addInstruction(0x57, (addr: number) => {
            // LD D,r Opcode: 50+r
            let val = this.r8[A];
            this.r8[D] = val;
            this.cycles += 4;
            this.log(addr, `LD D,A`)
        });

        this.addInstructionDD(0x50, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[B];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x51, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[C];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x52, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[D];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x53, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[E];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x54, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[IXh];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x55, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[IXl];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionDD(0x57, (addr: number) => {
            // LD D,IXp Opcode: DD 50+p
            let val = this.r8[A];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IXp`)
        });

        this.addInstructionFD(0x50, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[B];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x51, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[C];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x52, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[D];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x53, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[E];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x54, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[IXh];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x55, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[IXl];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionFD(0x57, (addr: number) => {
            // LD D,IYq Opcode: FD 50+q
            let val = this.r8[A];
            this.r8[D] = val;
            this.cycles += 8;
            this.log(addr, `LD D,IYq`)
        });

        this.addInstructionED(0x5B, (addr: number) => {
            // LD DE,(nn) Opcode: ED 5B nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[DE] = val;
            this.cycles += 20;
            this.log(addr, `LD DE,(nn)`)
        });

        this.addInstruction(0x11, (addr: number) => {
            // LD DE,nn Opcode: 11 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[DE] = val;
            this.cycles += 10;
            this.log(addr, `LD DE,${val}`)
        });

        this.addInstruction(0x5E, (addr: number) => {
            // LD E,(HL) Opcode: 5E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[E] = val;
            this.cycles += 7;
            this.log(addr, `LD E,(HL)`)
        });

        this.addInstructionDD(0x5E, (addr: number) => {
            // LD E,(IX+o) Opcode: DD 5E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[E] = val;
            this.cycles += 19;
            this.log(addr, `LD E,(IX+${o})`)
        });

        this.addInstructionFD(0x5E, (addr: number) => {
            // LD E,(IY+o) Opcode: FD 5E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[E] = val;
            this.cycles += 19;
            this.log(addr, `LD E,(IY+${o})`)
        });

        this.addInstruction(0x1E, (addr: number) => {
            // LD E,n Opcode: 1E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[E] = val;
            this.cycles += 7;
            this.log(addr, `LD E,${val}`)
        });

        this.addInstruction(0x58, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[B];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,B`)
        });

        this.addInstruction(0x59, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[C];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,C`)
        });

        this.addInstruction(0x5a, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[D];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,D`)
        });

        this.addInstruction(0x5b, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[E];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,E`)
        });

        this.addInstruction(0x5c, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[H];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,H`)
        });

        this.addInstruction(0x5d, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[L];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,L`)
        });

        this.addInstruction(0x5f, (addr: number) => {
            // LD E,r Opcode: 58+r
            let val = this.r8[A];
            this.r8[E] = val;
            this.cycles += 4;
            this.log(addr, `LD E,A`)
        });

        this.addInstructionDD(0x58, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[B];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x59, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[C];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x5a, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[D];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x5b, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[E];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x5c, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[IXh];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x5d, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[IXl];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionDD(0x5f, (addr: number) => {
            // LD E,IXp Opcode: DD 58+p
            let val = this.r8[A];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IXp`)
        });

        this.addInstructionFD(0x58, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[B];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x59, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[C];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x5a, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[D];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x5b, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[E];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x5c, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[IXh];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x5d, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[IXl];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstructionFD(0x5f, (addr: number) => {
            // LD E,IYq Opcode: FD 58+q
            let val = this.r8[A];
            this.r8[E] = val;
            this.cycles += 8;
            this.log(addr, `LD E,IYq`)
        });

        this.addInstruction(0x66, (addr: number) => {
            // LD H,(HL) Opcode: 66
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[H] = val;
            this.cycles += 7;
            this.log(addr, `LD H,(HL)`)
        });

        this.addInstructionDD(0x66, (addr: number) => {
            // LD H,(IX+o) Opcode: DD 66 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[H] = val;
            this.cycles += 19;
            this.log(addr, `LD H,(IX+${o})`)
        });

        this.addInstructionFD(0x66, (addr: number) => {
            // LD H,(IY+o) Opcode: FD 66 o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[H] = val;
            this.cycles += 19;
            this.log(addr, `LD H,(IY+${o})`)
        });

        this.addInstruction(0x26, (addr: number) => {
            // LD H,n Opcode: 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[H] = val;
            this.cycles += 7;
            this.log(addr, `LD H,${val}`)
        });

        this.addInstruction(0x60, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[B];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,B`)
        });

        this.addInstruction(0x61, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[C];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,C`)
        });

        this.addInstruction(0x62, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[D];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,D`)
        });

        this.addInstruction(0x63, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[E];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,E`)
        });

        this.addInstruction(0x64, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[H];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,H`)
        });

        this.addInstruction(0x65, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[L];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,L`)
        });

        this.addInstruction(0x67, (addr: number) => {
            // LD H,r Opcode: 60+r
            let val = this.r8[A];
            this.r8[H] = val;
            this.cycles += 4;
            this.log(addr, `LD H,A`)
        });

        this.addInstruction(0x2A, (addr: number) => {
            // LD HL,(nn) Opcode: 2A nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[HL] = val;
            this.cycles += 16;
            this.log(addr, `LD HL,(nn)`)
        });

        this.addInstruction(0x21, (addr: number) => {
            // LD HL,nn Opcode: 21 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[HL] = val;
            this.cycles += 10;
            this.log(addr, `LD HL,${val}`)
        });

        this.addInstructionED(0x47, (addr: number) => {
            // LD I,A Opcode: ED 47
            let val = this.r8[A];
            this.r8[I] = val;
            this.cycles += 9;
            this.log(addr, `LD I,A`)
        });

        this.addInstructionDD(0x2A, (addr: number) => {
            // LD IX,(nn) Opcode: DD 2A nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[IX] = val;
            this.cycles += 20;
            this.log(addr, `LD IX,(nn)`)
        });

        this.addInstructionDD(0x21, (addr: number) => {
            // LD IX,nn Opcode: DD 21 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[IX] = val;
            this.cycles += 14;
            this.log(addr, `LD IX,${val}`)
        });

        this.addInstructionDD(0x26, (addr: number) => {
            // LD IXh,n Opcode: DD 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IXh] = val;
            this.cycles += 11;
            this.log(addr, `LD IXh,${val}`)
        });

        this.addInstructionDD(0x60, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[B];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x61, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[C];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x62, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[D];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x63, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[E];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x64, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[IXh];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x65, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[IXl];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x67, (addr: number) => {
            // LD IXh,p Opcode: DD 60+p
            let val = this.r8[A];
            this.r8[IXh] = val;
            this.cycles += 8;
            this.log(addr, `LD IXh,p`)
        });

        this.addInstructionDD(0x2E, (addr: number) => {
            // LD IXl,n Opcode: DD 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IXl] = val;
            this.cycles += 11;
            this.log(addr, `LD IXl,${val}`)
        });

        this.addInstructionDD(0x68, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[B];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x69, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[C];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x6a, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[D];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x6b, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[E];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x6c, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[IXh];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x6d, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[IXl];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionDD(0x6f, (addr: number) => {
            // LD IXl,p Opcode: DD 68+p
            let val = this.r8[A];
            this.r8[IXl] = val;
            this.cycles += 8;
            this.log(addr, `LD IXl,p`)
        });

        this.addInstructionFD(0x2A, (addr: number) => {
            // LD IY,(nn) Opcode: FD 2A nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[IY] = val;
            this.cycles += 20;
            this.log(addr, `LD IY,(nn)`)
        });

        this.addInstructionFD(0x21, (addr: number) => {
            // LD IY,nn Opcode: FD 21 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[IY] = val;
            this.cycles += 14;
            this.log(addr, `LD IY,${val}`)
        });

        this.addInstructionFD(0x26, (addr: number) => {
            // LD IYh,n Opcode: FD 26 n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IYh] = val;
            this.cycles += 11;
            this.log(addr, `LD IYh,${val}`)
        });

        this.addInstructionFD(0x60, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[B];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x61, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[C];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x62, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[D];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x63, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[E];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x64, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[IXh];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x65, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[IXl];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x67, (addr: number) => {
            // LD IYh,q Opcode: FD 60+q
            let val = this.r8[A];
            this.r8[IYh] = val;
            this.cycles += 8;
            this.log(addr, `LD IYh,q`)
        });

        this.addInstructionFD(0x2E, (addr: number) => {
            // LD IYl,n Opcode: FD 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[IYl] = val;
            this.cycles += 11;
            this.log(addr, `LD IYl,${val}`)
        });

        this.addInstructionFD(0x68, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[B];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x69, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[C];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x6a, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[D];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x6b, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[E];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x6c, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[IXh];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x6d, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[IXl];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstructionFD(0x6f, (addr: number) => {
            // LD IYl,q Opcode: FD 68+q
            let val = this.r8[A];
            this.r8[IYl] = val;
            this.cycles += 8;
            this.log(addr, `LD IYl,q`)
        });

        this.addInstruction(0x6E, (addr: number) => {
            // LD L,(HL) Opcode: 6E
            let val = this.memory.uread8(this.r16[HL]);
            this.r8[L] = val;
            this.cycles += 7;
            this.log(addr, `LD L,(HL)`)
        });

        this.addInstructionDD(0x6E, (addr: number) => {
            // LD L,(IX+o) Opcode: DD 6E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IX] + o);
            this.r8[L] = val;
            this.cycles += 19;
            this.log(addr, `LD L,(IX+${o})`)
        });

        this.addInstructionFD(0x6E, (addr: number) => {
            // LD L,(IY+o) Opcode: FD 6E o
            let o = this.memory.uread8(this.r16[PC]++);
            let val = this.memory.uread8(this.r16[IY] + o)
            this.r8[L] = val;
            this.cycles += 19;
            this.log(addr, `LD L,(IY+${o})`)
        });

        this.addInstruction(0x2E, (addr: number) => {
            // LD L,n Opcode: 2E n
            let val = this.memory.uread8(this.r16[PC]++);
            this.r8[L] = val;
            this.cycles += 7;
            this.log(addr, `LD L,${val}`)
        });

        this.addInstruction(0x68, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[B];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,B`)
        });

        this.addInstruction(0x69, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[C];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,C`)
        });

        this.addInstruction(0x6a, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[D];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,D`)
        });

        this.addInstruction(0x6b, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[E];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,E`)
        });

        this.addInstruction(0x6c, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[H];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,H`)
        });

        this.addInstruction(0x6d, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[L];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,L`)
        });

        this.addInstruction(0x6f, (addr: number) => {
            // LD L,r Opcode: 68+r
            let val = this.r8[A];
            this.r8[L] = val;
            this.cycles += 4;
            this.log(addr, `LD L,A`)
        });

        this.addInstructionED(0x4F, (addr: number) => {
            // LD R,A Opcode: ED 4F
            let val = this.r8[A];
            this.r8[R] = val;
            this.cycles += 9;
            this.log(addr, `LD R,A`)
        });

        this.addInstructionED(0x7B, (addr: number) => {
            // LD SP,(nn) Opcode: ED 7B nn nn

            let nn = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;
            let val = this.memory.uread16(nn);

            this.r16[SP] = val;
            this.cycles += 20;
            this.log(addr, `LD SP,(nn)`)
        });

        this.addInstruction(0xF9, (addr: number) => {
            // LD SP,HL Opcode: F9
            let val = this.r16[HL];
            undefined
            this.cycles += 6;
            this.log(addr, `LD SP,HL`)
        });

        this.addInstructionDD(0xF9, (addr: number) => {
            // LD SP,IX Opcode: DD F9
            let val = this.r16[IX];
            undefined
            this.cycles += 10;
            this.log(addr, `LD SP,IX`)
        });

        this.addInstructionFD(0xF9, (addr: number) => {
            // LD SP,IY Opcode: FD F9
            let val = this.r16[IY];
            undefined
            this.cycles += 10;
            this.log(addr, `LD SP,IY`)
        });

        this.addInstruction(0x31, (addr: number) => {
            // LD SP,nn Opcode: 31 nn nn

            let val = this.memory.uread16(this.r16[PC]);
            this.r16[PC] += 2;

            this.r16[SP] = val;
            this.cycles += 10;
            this.log(addr, `LD SP,${val}`)
        });


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

    addInstruction(opcode: number, func: (addr: number) => void) {
        this.opcodes[opcode] = func;
    }
}
