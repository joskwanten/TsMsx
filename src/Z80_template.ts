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
const IXH = 9;
const IXL = 8;
const IYH = 11;
const IYL = 10;
const r8_debug = ["F", "A", "C", "B", "E", "D", "L", "H"];
const r16_debug = ["AF", "BC", "DE", "HL", "IX", "IY", "SP", "_I", "_R", "PC", "_F"];

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
const rp = [BC, DE, HL, SP];
const rp_debug = ["BC", "DE", "HL", "SP"];
const rp2 = [BC, DE, HL, AF];
const rp2_debug = ["BC", "DE", "HL", "AF"];
const r = [B, C, D, E, H, L, HL, A];
const r_dd = [B, C, D, E, IXH, IXL, HL, A];
const r_fd = [B, C, D, E, IYH, IYL, HL, A];
const r_debug = ["B", "C", "D", "E", "H", "L", "HL", "A"];
const r_debug_dd = ["B", "C", "D", "E", "IXH", "IXL", "HL", "A"];
const r_debug_fd = ["B", "C", "D", "E", "IYH", "IYL", "HL", "A"];

const alu_debug = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND", "XOR", "OR", "CP"];

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


const cc_debug = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"];

export class Z80Gen implements CPU {
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
    cycles: number = 0;

    // Interrupt flags 
    iff1 = true;
    iff2 = true;

    // flag to indicate if the CPU is halted
    halted = false;

    // Instructions
    instructions: (() => void)[];

    constructor(private memory: Memory, private IO: IO, private logger: Logger) {
        this.instructions = new Array(256);
        this.instructions[0x00] = () => {
            // NOP
            this.cycles += 4;
        }
        this.instructions[0x01] = () => {
            let nn = this.memory.uread8(this.r16[PC]++) | (this.memory.uread8(this.r16[PC]++) << 8);
            
                    if (log) { this.log(addr, "LD " + rp_debug[p] + ", $" + nn.toString(16)); }
                    this.r16[rp[p]] = nn & 0xFFFF; //(nn & 0xFF)  << 8 + ((nn >> 8) & 0xFF);
                }
        }

    }
    execute(numOfInstructions: number, showLog: boolean): void {
        if (this.halted) {
            return;
        }

        if (!this.r16[PC]) {
            console.log("DEVICE (RE)STARTED");
        }
        // else {
        //     console.log(this.r16[PC].toString(16));
        // }
        let addr = this.r16[PC]++;
        let opcode = this.memory.uread8(addr);
        let opcodeMode = 0;
        let tStates = 0; // Number of TStates the operat
    }
    halt(): void {
        throw new Error('Method not implemented.');
    }
    interrupt(): void {
        throw new Error('Method not implemented.');
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
        // TODO: Real reset
    }        
}