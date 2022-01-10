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
const r8_debug = ["F", "A", "C", "B", "E", "D", "L", "H"];
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
const rp = [BC, DE, HL, SP];
const rp_dd = [BC, DE, IX, SP];
const rp_fd = [BC, DE, IY, SP];
const rp_debug = ["BC", "DE", "HL", "SP"];
const rp_debug_dd = ["BC", "DE", "IX", "SP"];
const rp_debug_fd = ["BC", "DE", "IY", "SP"];
const rp2 = [BC, DE, HL, AF];
const rp2_dd = [BC, DE, IX, AF];
const rp2_fd = [BC, DE, IY, AF];
const rp2_debug = ["BC", "DE", "HL", "AF"];
const rp2_debug_dd = ["BC", "DE", "IX", "AF"];
const rp2_debug_fd = ["BC", "DE", "IY", "AF"];
const r = [B, C, D, E, H, L, HL, A];
const r_dd = [B, C, D, E, IXh, IXl, HL, A];
const r_fd = [B, C, D, E, IYh, IYl, HL, A];
const r_debug = ["B", "C", "D", "E", "H", "L", "HL", "A"];
const r_debug_dd = ["B", "C", "D", "E", "IXH", "IXL", "HL", "A"];
const r_debug_fd = ["B", "C", "D", "E", "IYH", "IYL", "HL", "A"];

const alu_debug = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND", "XOR", "OR", "CP"];

let rp_dd_fd: any = {
    0x00: rp,      // Normal instructions
    0xdd: rp_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: rp_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

let rp_debug_dd_fd: any = {
    0x00: rp_debug,      // Normal instructions
    0xdd: rp_debug_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: rp_debug_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

let r_dd_fd: any = {
    0x00: r,
    0xdd: r_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: r_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

let r_debug_dd_fd: any = {
    0x00: r_debug,      // Normal instructions
    0xdd: r_debug_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: r_debug_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

let rp2_dd_fd: any = {
    0x00: rp2,      // Normal instructions
    0xdd: rp2_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: rp2_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

let rp2_debug_dd_fd: any = {
    0x00: rp2_debug,      // Normal instructions
    0xdd: rp2_debug_dd,   // DD instructions (H is replaced by IXH and L by IXL)
    0xfd: rp2_debug_fd,   // FD instructions (H is replaced by IYH and L by IYL)
};

const ROT_RLC = 0;
const ROT_RRC = 1;
const ROT_RL = 2;
const ROT_RR = 3;
const ROT_SLA = 4;
const ROT_SRA = 5;
const ROT_SLL = 6;
const ROT_SRL = 7;
const rot_debug = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"];

const ALU_ADD_A = 0;
const ALU_ADC_A = 1;
const ALU_SUB = 2;
const ALU_SBC_A = 3;
const ALU_AND = 4;
const ALU_XOR = 5;
const ALU_OR = 6;
const ALU_CP = 7;

const FLAG_SIGN_F3_F5 = 0b10101000;
const FLAG_F3_F5 = 0b10101000;
const FLAG_ZERO = 0b01000000;
const FLAG_HALF_CARRY = 0b00010000;
const FLAG_OVERFLOW = 0b00000100;
const FLAG_ADDSUB = 0b00000010;
const FLAG_CARRY = 0b00000001;
const FLAGS_ADD_AFFECTED = 0b00111011;

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

const nn_predicates = [
    (f: number) => !(f & FLAG_ZERO), // NZ,
    (f: number) => !(f & FLAG_ZERO), // Z,
    (f: number) => !(f & FLAG_CARRY), // NC,
    (f: number) => (f & FLAG_CARRY), // C
];

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


    constructor(private memory: Memory, private IO: IO, private logger: Logger) {

    }

    private hex16(n: number) {
        return ("000" + n.toString(16)).slice(-4);
    }

    private hex8(n: number) {
        return ("0" + n.toString(16)).slice(-2);
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
        for (let i = 0; i < numOfInstructions; i++) {
            this.fetchInstruction(showLog);
        }
    }

    executeUntil(breakPoint: number) {
        while (1) {
            this.fetchInstruction(false);
            if (this.r16[PC] == breakPoint) {
                return;
            }
        }
    }

    halt(): void {
        throw new Error("HALTED!");
    }

    flag(flag: number): boolean {
        return (this.r8[F] | flag) > 0;
    }

    cc(index: number): boolean {
        switch (index) {
            case 0: // NZ
                return (this.r8[F] & FLAG_ZERO) == 0;
                break;
            case 1: // Z;
                return (this.r8[F] & FLAG_ZERO) > 0;
                break;
            case 2: // NC
                return (this.r8[F] & FLAG_CARRY) == 0;
                break;
            case 3: // C
                return (this.r8[F] & FLAG_CARRY) > 0;
                break;
            case 4: // PO
                break;
            case 5: // PE
                break;
            case 6: // P
                break;
            case 7: // M
                break;
        }

        let flag = 1 << (index | 0);
        return (this.r8[F] | flag) > 0;
    }

    set_cc(index: number, value: boolean): void {
        // TODO: implement flag setter
    }

    private log(address: number, msg: string): void {
        this.logger.debug(
            ("000" + address.toString(16)).slice(-4) + " : " + msg,
            this.dumpRegisters()
        );

    }

    private ADD8(p1: number | 0, p2: number | 0): number {
        this.rAlu[0] = (p1 & 0xFF) + (p2 & 0xFF);
        this.log(0, "ADD8 result : " + this.rAlu[0].toString(16));
        this.flags8(this.rAlu[0]);
        return this.rAlu[0] & 0xFF;
    }

    private ADD16(p1: number, p2: number): number {
        p1 = p1 & 0xFFFF | 0;
        p2 = p2 & 0xFFFF | 0;
        this.rAlu[0] = p1 + p2;

        let flags = (this.r8[F] & 0xc4);
        let r2 = (this.rAlu[0] >>> 8);
        flags |= ((r2 & 0xFF) & 0x28);
        flags |= ((r2 & 0x10) > 0 ? FLAG_HALF_CARRY : 0);
        flags |= ((r2 & 0x100) > 0 ? FLAG_CARRY : 0);

        this.r8[F] = flags;// & 0xFF;

        return this.rAlu[0];
    }

    private ADD_A(n: number) {
        this.rAlu[0] = (this.r8[A] + n);
        this.r8[A] = this.rAlu[0];
        // TODO sign stuff correct?     
        this.flags8(this.rAlu[0]);
    }

    private set_flags(...flaglist: Flags[]) {
        flaglist.forEach(f => this.r8[F] |= f);
    }

    private reset_flags(...flaglist: Flags[]) {
        flaglist.forEach(f => this.r8[F] &= ~f);
    }

    private set_parity(val: number) {
        let sum = 0;
        for (let i = 0; i < 8; i++) {
            sum += (val >> i) && 1;
        }

        // Parity bit is set when parity is even
        this.toggle_flag(Flags.PV, (sum & 0x1) == 0);
    }


    private toggle_flag(flag: Flags, set: boolean) {
        if (set) {
            this.r8[F] &= flag;
        } else {
            this.r8[F] != flag;
        }
    }

    private flags8(result: number) {
        this.r8[F] =
            // Copy sign , bit 5 and bit 3 (bit 5 and 3 behaviour is undocumented)
            (result & FLAG_SIGN_F3_F5) |
            // Zero flag
            ((result & 0xFF) == 0 ? FLAG_ZERO : 0) |
            // Overflow flag
            (result > 255 ? FLAG_OVERFLOW : 0) |
            // Not implemented yet
            (false ? FLAG_ADDSUB : 0) |
            // Half carry when bit 4 is set
            ((result & 0x10) > 0 ? FLAG_HALF_CARRY : 0) |
            // Carry when bit 9 is set
            ((result & 0x100) > 0 ? FLAG_CARRY : 0);
    }

    private ADC_A(n: number) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        this.rAlu[0] = (this.r8[A] + n + carry);
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }

    private SUB(n: number) {
        this.rAlu[0] = this.r8[A] - n;
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }

    private SBC_A(n: number) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        this.rAlu[0] = (this.r8[A] - n - carry);
        this.r8[A] = this.rAlu[0];
        this.flags8(this.rAlu[0]);
    }

    private AND(n: number) {
        this.r8[A] &= n;
        this.flags8(this.r8[A]);
    }

    private XOR(n: number) {
        this.r8[A] ^= n;
        this.flags8(this.r8[A]);
    }

    private OR(n: number) {
        this.r8[A] |= n;
        this.flags8(this.r8[A]);
    }

    private CP(n: number) {
        this.rAlu[0] = this.r8[A] - n;
        if (n === H) {
            console.log('Break');
        }
        //this.log(this.r16[PC], `CP Result: ${this.rAlu[0]}`);
        this.flags8(this.rAlu[0]);
    }


    private rotate(y: number, value: number): number {
        switch (y) {
            case ROT_RLC:
                {
                    let result = value << 1;
                    result |= (result >> 8)
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RRC:
                {
                    let lsb = value & 1;
                    let result = (value >> 1) | (lsb << 7);
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RL:
                {
                    let result = value << 1;
                    result |= this.r8[F] & FLAG_CARRY ? 1 : 0;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_RR:
                {
                    let lsb = value & 1;
                    let result = (value >> 1);
                    if (this.r8[F] | FLAG_CARRY) {
                        result |= 0x80;
                    }
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SLA:
                {
                    let result = value << 1;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SRA:
                {
                    let lsb = value & 1;
                    let msb = value & 0x80;
                    let result = (value >> 1) | msb;
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SLL:
                {
                    let result = (value << 1) + 1;
                    this.r8[F] = result & 0x100 ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    return result;
                }
            case ROT_SRL:
                {
                    let lsb = value & 1;
                    let result = (value >> 1);
                    // S, H, and N flags reset, Z if result is zero, P/V set if parity is even, C from bit 0.
                    this.r8[F] = lsb ? (this.r8[F] | FLAG_CARRY) : (this.r8[F] & ~(FLAG_CARRY));
                    // TODO: Flags nog correct implmenented
                    return result;
                }
        }

        return 0;
    }

    private handleCBInstruction(log: boolean) {
        let addr = this.r16[PC] - 1; // CB already read
        let opcode = this.memory.uread8(this.r16[PC]++);

        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);

        switch (x) {
            case 0:
                if (z == 6) {
                    // (HL) handling
                    this.log(addr, `${rot_debug[y]}  (${r_debug[z]})`);
                    this.memory.uwrite8(this.r16[r[z]], this.rotate(y, this.memory.uread8(this.r16[r[z]])));
                } else {
                    this.log(addr, `${rot_debug[y]}  ${r_debug[z]}`);
                    this.r8[r[z]] = this.rotate(y, this.r8[r[z]]);
                }
                break;
            case 1: {
                let mask = 1 << y;
                let val = 0;
                if (z == 6) {
                    // (HL) handling
                    if (log) { this.log(addr, `BIT ${y}, (${r_debug[z]})`); }
                    val = this.memory.uread8(this.r16[r[z]]) & mask;
                } else {
                    // Register version
                    this.log(addr, `BIT ${y}, ${r_debug[z]}`);
                    val = this.r8[r[z]] & mask;
                }

                // CARRY is preserved in the BIT command, Half carry is set and the
                // zero flag is inverted value of the bit which is tested
                this.r8[F] = (this.r8[F] & FLAG_CARRY) | FLAG_HALF_CARRY | (val ? 0 : FLAG_ZERO);
            }
                break;
            case 2: {
                let mask = (~(1 << y)) & 0xff;
                if (z == 6) {
                    // (HL) handling
                    if (log) { this.log(addr, `RES ${y}, (${r_debug[z]})`); }
                    this.memory.uwrite8(this.r16[r[z]], this.memory.uread8(this.r16[r[z]]) & mask);
                } else {
                    // Register version
                    this.log(addr, `RES ${y}, ${r_debug[z]}`);
                    this.r8[r[z]] = this.r8[r[z]] & mask;
                }
            }
                break;
            case 3: {
                let mask = (1 << y);
                if (z == 6) {
                    // (HL) handling
                    if (log) { this.log(addr, `SET ${y}, (${r_debug[z]})`); }
                    this.memory.uwrite8(this.r16[r[z]], this.memory.uread8(this.r16[r[z]]) | mask);
                } else {
                    // Register version
                    this.log(addr, `SET ${y}, ${r_debug[z]}`);
                    this.r8[r[z]] = this.r8[r[z]] | mask;
                }
            }
                break;
        }

    }

    private handleEDInstruction(log: boolean): number {
        let edAddr = this.r16[PC] - 1; // CB already read
        let opcode = this.memory.uread8(this.r16[PC]++);

        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);
        let p = (opcode & 0x30) >> 4;
        let q = (opcode & 0x08) >> 3;

        if (x === 1) {
            switch (z) {
                case 0:
                    if (y !== 6) {
                        // IN r[y], (C)
                        if (log) { this.log(edAddr, `IN ${r_debug[y]}, (C)`); }
                        this.r8[r[y]] = this.IO.read8(this.r8[C]);
                        this.reset_flags(Flags.N);
                        this.set_parity(this.r8[r[y]]);
                        this.tStates += 12;
                        // N flag reset, P/V represents parity, C flag preserved, all other flags affected by definition.

                    } else {
                        // IN (C)
                        if (true) { this.log(edAddr, `IN (C) NOT IMPLEMENTED UNDOCUMENTED`); }
                    }
                    break;
                case 1:
                    // OUT (C), r[y]
                    if (log && y != 6) { this.log(edAddr, `OUT (C), ${r_debug[y]}`); }
                    if (log && y == 6) { this.log(edAddr, `OUT (C), 0`); }
                    let val = y == 6 ? 0 : this.r8[r[y]];
                    this.IO.write8(this.r8[C], val);
                    this.tStates += 12;
                    // All flags preserved
                    break;
                case 2:
                    if (true) { this.log(edAddr, `NOT IMPLEMENTED`); }
                    break;
                case 3:
                    {
                        let nn = this.memory.uread16(this.r16[PC]);
                        this.r16[PC] += 2;

                        if (q === 0) {
                            if (log) { this.log(edAddr, `LD ($${nn.toString(16)}), ${rp_debug[p]}`) };
                            this.memory.uwrite16(nn, this.r16[rp[p]]);
                        } else {
                            if (log) { this.log(edAddr, `LD ${rp_debug[p]}, ($${nn.toString(16)})`) };
                            this.r16[rp[p]] = this.memory.uread16(nn);
                        }

                        break;
                    }
                case 4:
                    if (log) { this.log(edAddr, `NEG`); }
                    this.r8[A] = -this.r8[A];
                    this.set_flags(Flags.N);
                    this.toggle_flag(Flags.Z, this.r8[A] == 0);
                    break;
                case 5:
                    if (true) { this.log(edAddr, `NOT IMPLEMENTED`); }
                    if (true) { this.log(edAddr, y === 1 ? "RETI" : "RETN"); }
                    this.r16[PC] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                    break;
                case 6:
                    if (true) { this.log(edAddr, `NOT IMPLEMENTED`); }
                    break;
                case 7:
                    if (true) { this.log(edAddr, `NOT IMPLEMENTED`); }
                    break;
            }
        } else if (x === 2) {
            switch (z) {
                case 3:
                    {
                        if (log && y === 4) { this.log(edAddr, `OUTI`); }
                        else if (log && y === 5) { this.log(edAddr, `OUTD`); }
                        else if (log && y === 6) { this.log(edAddr, `OTIR`); }
                        else if (log && y === 7) { this.log(edAddr, `OTDR`); }

                        // OTIR and OTID are the same instructions as OUTI and OUTD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r8[B] : 1;
                        let inc = y === 4 || y == 6;

                        for (let i = 0; i < repeat; i++) {
                            this.IO.write8(this.r8[C], this.memory.uread8(this.r16[HL]));

                            if (inc) {
                                this.r16[HL]++;
                            } else {
                                this.r16[HL]--;
                            }
                            this.r8[B]--;
                        }

                        this.r8[F] &= ~FLAG_SIGN_F3_F5; // Reset Negative / Sign flag (others undocumented
                        if (this.r8[B]) {
                            this.r8[F] &= ~FLAG_ZERO;
                        } else {
                            this.r8[F] |= FLAG_ZERO;
                        }
                    }
                    break;

                case 2:
                    {
                        if (log && y === 4) { this.log(edAddr, `INI`); }
                        else if (log && y === 5) { this.log(edAddr, `IND`); }
                        else if (log && y === 6) { this.log(edAddr, `INIR`); }
                        else if (log && y === 7) { this.log(edAddr, `INDR`); }

                        // OTIR and OTID are the same instructions as OUTI and OUTD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r8[B] : 1;
                        let inc = y === 4 || y == 6;

                        for (let i = 0; i < repeat; i++) {
                            this.r16[HL] = this.memory.uread8(this.r8[C]);

                            if (inc) {
                                this.r16[HL]++;
                            } else {
                                this.r16[HL]--;
                            }
                            this.r8[B]--;
                        }

                        this.r8[F] &= ~FLAG_SIGN_F3_F5; // Reset Negative / Sign flag (others undocumented
                        if (this.r8[B]) {
                            this.r8[F] &= ~FLAG_ZERO;
                        } else {
                            this.r8[F] |= FLAG_ZERO;
                        }
                    }
                    break;

                case 1:
                    throw new Error('NOT IMPLEMENTED');
                    break;

                case 0:
                    {
                        if (log && y === 4) { this.log(edAddr, `LDI`); }
                        else if (log && y === 5) { this.log(edAddr, `LDD`); }
                        else if (log && y === 6) { this.log(edAddr, `LDIR`); }
                        else if (log && y === 7) { this.log(edAddr, `LDDR`); }

                        // LDIR and LDDR are the same instructions as LDI and LDD
                        // but only repeat until register D is zero.
                        let repeat = y === 6 || y == 7 ? this.r16[BC] : 1;
                        // Increment or decrement 
                        let inc = y === 4 || y == 6;

                        for (let i = 0; i < repeat; i++) {
                            this.memory.uwrite8(this.r16[DE], this.memory.uread8(this.r16[HL]));

                            if (inc) {
                                this.r16[HL]++;
                                this.r16[DE]++;
                            } else {
                                this.r16[HL]--;
                                this.r16[DE]--;
                            }
                            this.r16[BC]--;
                        }

                        if (this.r16[BC] == 0) {
                            this.reset_flags(Flags.PV);
                        }
                    }
                    break;
            }

        }

        return this.tStates;
    }

    private fetchInstruction(log: boolean) {
        //this.dumpRegisters();
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
        let tStates = 0; // Number of TStates the operation took
        //this.log(addr, `Opcode: ${opcode.toString(16)}`);

        // TODO: support more 0xDD or 0xFD opcodes and use the last one as
        if (opcode === 0xDD || opcode === 0xFD) {
            opcodeMode = opcode;
            opcode = this.memory.uread8(this.r16[PC]++);
        }

        if (opcode === 0xED) {
            return this.handleEDInstruction(log);
        }

        let x = opcode >> 6;
        let y = (opcode & 0x3F) >> 3;
        let z = (opcode & 0x07);
        let p = (opcode & 0x30) >> 4;
        let q = (opcode & 0x08) >> 3;

        //console.log(`OPCODE: ${opcode.toString(16)}, x = ${x}`);

        if (x === 0) {
            if (z === 0) {
                switch (y) {
                    case 0:
                        if (log) { this.log(addr, "NOP"); }
                        this.tStates += 4;
                        break;
                    case 1:
                        {
                            if (log) { this.log(addr, "EX AF, AF'"); }
                            let tmp = this.r16[AF];
                            this.r16[AF] = this.r16s[AF];
                            this.r16s[AF] = this.r16[AF];
                            this.tStates += 4;
                        }
                        break;
                    case 2:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) { this.log(addr, "DJNZ " + d); }
                            this.r8[B]--;
                            this.r16[PC] += this.r8[B] !== 0 ? d : 0;
                            this.tStates += this.r8[B] !== 0 ? 13 : 8;
                        }
                        break;
                    case 3:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) { this.log(addr, "JR " + d); }
                            this.r16[PC] += d;
                            this.tStates += 10;
                        }
                        break;
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            if (log) { this.log(addr, `JR ${cc_debug[y - 4]}, ${d}`); }
                            this.r16[PC] += this.cc(y - 4) ? d : 0;
                            this.tStates += this.cc(y - 4) ? 12 : 7;
                        }
                    default:
                }
            }

            if (z === 1) {
                if (q === 0) {
                    let nn = this.memory.uread8(this.r16[PC]++) | (this.memory.uread8(this.r16[PC]++) << 8);
                    if (log) { this.log(addr, "LD " + rp_debug_dd_fd[opcodeMode][p] + ", $" + nn.toString(16)); }
                    this.r16[rp_dd_fd[opcode][p]] = nn; //(nn & 0xFF)  << 8 + ((nn >> 8) & 0xFF);
                }
                if (q == 1) {
                    // TODO: Check flag modification
                    if (opcodeMode == 0) {
                        if (log) { this.log(addr, `ADD HL, ` + rp_debug[p]); }
                        this.r16[HL] = this.ADD16(this.r16[HL], this.r16[rp[p]]);
                        this.tStates += 11;
                    } else if (opcodeMode == 0xdd) {
                        if (log) { this.log(addr, `ADD IX, ` + rp_debug_dd[p]); }
                        this.r16[IX] = this.ADD16(this.r16[IX], this.r16[rp_dd[p]]);
                        this.tStates += 15;
                    } else {
                        if (log) { this.log(addr, `ADD IY, ` + rp_debug_fd[p]); }
                        this.r16[IY] = this.ADD16(this.r16[IY], this.r16[rp_fd[p]]);
                        this.tStates += 15;
                    }
                }
            }

            if (z === 2) {
                if (p < 2) {
                    if (q === 0) {
                        if (log) { this.log(addr, "LD (" + rp_debug[p] + "), A"); }
                        this.memory.uwrite8(this.r16[rp[p]], this.r8[A]);
                    } else {
                        if (log) { this.log(addr, "LD A, (" + rp_debug[p] + ")"); }
                        this.r8[A] = this.memory.read8(this.r16[rp[p]]);
                    }
                } else {
                    // Fetch 16bits address location
                    let nn = this.memory.uread8(this.r16[PC]++) + (this.memory.uread8(this.r16[PC]++) << 8);
                    if (q === 0) {
                        if (p === 2) {
                            if (log) { this.log(addr, "LD (" + nn.toString(16) + "), HL"); }
                            this.memory.uwrite16(nn, this.r16[HL]);
                        } else {
                            if (log) { this.log(addr, "LD (" + nn.toString(16) + "), A"); }
                            this.memory.uwrite8(nn, this.r8[A]);
                        }
                    } else {
                        if (p === 2) {
                            if (log) { this.log(addr, "LD HL, (" + nn.toString(16) + ")"); }
                            this.r16[HL] = this.memory.uread16(nn);
                        } else {
                            if (log) { this.log(addr, "LD A, (" + nn.toString(16) + ")"); }
                            this.r8[A] = this.memory.uread8(nn);
                        }
                    }
                }

            }

            if (z === 3) {
                if (log) { this.log(addr, (q === 0 ? "INC" : "DEC") + " " + rp_debug[p]); }
                this.r16[rp[p]] += (q === 0 ? 1 : -1);
            }

            if (z === 4) {
                if (log) { this.log(addr, "INC " + r_debug[y]); }
                this.flags8(++this.r8[r[y]]);
            }

            if (z === 5) {
                if (log) { this.log(addr, "DEC " + r_debug[y]); }
                this.flags8(--this.r8[r[y]]);
            }

            if (z === 6) {
                let n = this.memory.uread8(this.r16[PC]++);
                if (log) { this.log(addr, `LD ${r_debug[y]}, ${this.hex8(n)}`); }
                this.r8[r[y]] = n;
            }

            if (z === 7) {
                switch (y) {
                    case 0: // RLCA
                        {
                            if (log) { this.log(addr, 'RLCA'); }
                            let result = this.r8[A] << 1;
                            let carry = (result & 0x100) > 0;
                            this.r8[A] = result | (carry ? 1 : 0);
                            this.toggle_flag(Flags.C, carry);
                            this.reset_flags(Flags.H, Flags.N);
                        }
                        break;
                    case 1: // RRCA
                        {
                            if (log) { this.log(addr, 'RRCA'); }
                            let carry = (this.r8[A] & 1) === 1;
                            this.r8[A] = (this.r8[A] >> 1) | (carry ? 0x80 : 0);
                            this.toggle_flag(Flags.C, carry);
                            this.reset_flags(Flags.H, Flags.N);
                        }
                        break;
                    case 2: // RLA
                        if (log) { this.log(addr, 'RLA'); }
                        let result = this.r8[A] << 1;
                        let carry = (result & 0x100) > 0;
                        this.r8[A] = result;
                        this.toggle_flag(Flags.C, carry);
                        this.reset_flags(Flags.H, Flags.N);
                        this.tStates += 4;
                        // C is changed to the leaving 7th bit, H and N are reset, P/V , S and Z are preserved.
                        break;
                    case 3: // RRA
                        throw new Error('RRA NOT IMPLEMENTED');
                        break;
                    case 4:	// DAA
                        // if the lower 4 bits form a number greater than 9 or H is set, add $06 to the accumulator
                        // if the upper 4 bits form a number greater than 9 or C is set, add $60 to the accumulator
                        if (log) { this.log(addr, 'DAA'); }
                        let lsb = this.r8[A] & 0xf;
                        let msb = this.r8[A] >> 4;
                        if (lsb > 9 || (this.r8[F] & Flags.H)) {
                            lsb += 6;
                        }
                        if (msb > 9 || (this.r8[F] & Flags.C)) {
                            msb += 6;
                            this.set_flags(Flags.C);
                        }
                        this.r8[A] = msb << 4 + lsb;
                        this.set_parity(this.r8[A]);
                        this.tStates += 4;
                        break;
                    case 5:	// CPL
                        {
                            if (log) { this.log(addr, 'CPL'); }
                            this.r8[A] = ~this.r8[A];
                            this.r8[F] = this.r8[F] | FLAG_HALF_CARRY | FLAG_ADDSUB;
                            break;
                        }
                    case 6:	// SCF    
                        if (log) { this.log(addr, 'SCF'); }
                        this.set_flags(Flags.C);
                        this.reset_flags(Flags.H, Flags.N);
                        break;
                    case 7:	// CCF
                        throw new Error('CCF NOT IMPLEMENTED');
                        break;
                }

            }

        }

        if (x === 1) {
            if (z === 6 && y === 6) {
                if (log) { this.log(addr, "HALT"); }
                this.halted = true;
                // Go to the halted state, when an interrupt occurs,
                // the PC can be pushed on the stack and operation will continue
                //this.r16[PC]--;
            } else {
                if (y == 6) {
                    if (log) { this.log(addr, `LD (${r_debug[y]}), ${r_debug[z]}`); }
                    this.memory.uwrite8(this.r16[r[y]], this.r8[r[z]]);
                } else if (z == 6) {
                    if (log) { this.log(addr, `LD ${r_debug[y]}, (${r_debug[z]})`); }
                    this.r8[r[y]] = this.memory.uread8(this.r16[r[z]]);
                } else {
                    if (log) { this.log(addr, `LD ${r_debug[y]}, ${r_debug[z]}`); }
                    this.r8[r[y]] = this.r8[r[z]];
                }
            }
        }

        if (x === 2) {
            if (z == 6) {
                if (log) { this.log(addr, `${alu_debug[y]} (${r_debug[z]})`); }
                let val = this.memory.uread8(this.r16[r[z]]);
                if (val === undefined) {
                    console.log('ERROR, should not read undefined');
                    val = this.memory.uread8(this.r16[r[z]]);
                }
                //console.log(val.toString(16));
                this.aluOperation(y, val);
            } else {
                if (log) { this.log(addr, `${alu_debug[y]} ${r_debug[z]}`); }
                this.aluOperation(y, this.r8[r[z]]);
            }
        }

        if (x === 3) {
            if (z === 0) {
                if (log) { this.log(addr, `RET ${cc_debug[y]}`); }
                if (log) { this.log(addr, `${cc_debug[y]} FLAG : ${this.cc(y)}`); }
                if (this.cc(y)) {
                    this.r16[PC] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                }
            }

            if (z === 1) {
                if (q === 0) {
                    if (log) { this.log(addr, `POP ${rp2_debug[p]}`); }
                    this.r16[rp2[p]] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2;
                } else {
                    switch (p) {
                        case 0:
                            if (true) { this.log(addr, `RET PC=${this.memory.uread16(this.r16[SP]).toString(16)}`); }
                            this.r16[PC] = this.memory.uread16(this.r16[SP]);
                            this.r16[SP] += 2;
                            break;
                        case 1:
                            if (log) { this.log(addr, 'EXX'); }
                            let bc = this.r16[BC];
                            let de = this.r16[DE];
                            let hl = this.r16[HL];
                            this.r16[BC] = this.r16s[BC];
                            this.r16[DE] = this.r16s[DE];
                            this.r16[HL] = this.r16s[HL];
                            this.r16s[BC] = bc;
                            this.r16s[DE] = de;
                            this.r16s[HL] = hl;
                            break;
                        case 2:
                            if (log) { this.log(addr, 'JP HL'); }
                            this.r16[PC] = this.r16[HL];
                            break;
                        case 3:
                            if (log) { this.log(addr, 'LD SP,HL'); }
                            this.r16[SP] = this.r16[HL];
                            break;
                    }

                }
            }

            if (z === 2) {
                let nn = this.memory.uread16(this.r16[PC])
                this.r16[PC] += 2;
                if (log) { this.log(addr, `JP ${cc_debug[y]}, ${(nn).toString(16)}`); }
                if (this.cc(y)) {
                    this.r16[PC] = nn;
                }

                //this.r16[PC] += this.cc(y - 4) ? d : 0;

            }

            if (z === 3) {
                let n;
                switch (y) {
                    case 0: //	JP nn
                        let nn = this.memory.uread16(this.r16[PC])
                        if (log) { this.log(addr, `JP ${this.hex16(nn)}`); }
                        this.r16[PC] = nn;
                        break;

                    case 1:	//(CB prefix)                        
                        this.handleCBInstruction(log);
                        break;
                    case 2:	//OUT (n), A
                        n = this.memory.uread8(this.r16[PC]++);
                        if (log) { this.log(addr, `OUT (0x${n.toString(16)}), A`); }
                        this.IO.write8(n, this.r8[A]);
                        break;
                    case 3:	//IN A, (n)
                        n = this.memory.uread8(this.r16[PC]++);
                        if (log) { this.log(addr, `IN A,(0x${n.toString(16)})`); }
                        this.r8[A] = this.IO.read8(n);
                        // TODO: CHECK FLAGS
                        break;
                    case 4: //EX (SP), HL 
                        if (log) { this.log(addr, `EX (SP), HL`); }
                        let sp = this.memory.uread16(this.r16[SP]);
                        this.memory.uwrite16(this.r16[SP], this.r16[HL]);
                        this.r16[HL] = sp;
                        break;
                    case 5:	//EX DE, HL   
                        if (log) { this.log(addr, `EX DE, HL`); }
                        let de = this.r16[DE];
                        this.r16[DE] = this.r16[HL];
                        this.r16[HL] = de;
                        break;
                    case 6:	//DI
                        if (log) { this.log(addr, `DI`); }
                        this.interruptEnabled = false;
                        break;
                    case 7:	//EI
                        if (log) { this.log(addr, `EI`); }
                        this.interruptEnabled = true;
                        break;
                }
            }

            if (z === 4) {
                let nn = this.memory.uread16(this.r16[PC]++)
                this.r16[PC] += 2;
                if (log) { this.log(addr, `CALL ${cc_debug[y]}, ${this.hex16(nn)}`); }
                if (this.cc(y)) {
                    this.r16[SP] -= 2;
                    this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                    this.log(addr, `CALL CONDITIONAL ${this.hex16(nn)}`);
                    this.r16[PC] = nn;
                }
            }

            if (z === 5) {
                if (q === 0) {
                    if (log) { this.log(addr, `PUSH ${rp2_debug_dd_fd[opcodeMode][p]}`); }
                    this.r16[SP] -= 2;
                    this.memory.uwrite16(this.r16[SP], this.r16[rp2_dd_fd[opcodeMode][p]]);
                } else {
                    if (p === 0) {

                        let nn = this.memory.uread16(this.r16[PC])
                        this.r16[PC] += 2;
                        this.r16[SP] -= 2;
                        this.memory.uwrite16(this.r16[SP], this.r16[PC]);

                        this.log(addr, `CALL ${this.hex16(nn)}`);
                        this.r16[PC] = nn;

                    } else if (p === 1) {

                    } else if (p === 2) {

                    } else if (p === 3) {

                    }

                }
            }

            if (z === 6) {
                let n = this.memory.uread8(this.r16[PC]++);
                if (log) { this.log(addr, alu_debug[y] + " $" + n.toString(16)); }
                this.aluOperation(y, n);
            }

            if (z === 7) {
                if (log) { this.log(addr, `RST ${(y * 8).toString(16)}`); }
                this.r16[SP] -= 2;
                this.memory.uwrite16(this.r16[SP], this.r16[PC]);
                this.r16[PC] = y * 8;
            }
        }
    }

    private aluOperation(y: number, n: number) {
        switch (y) {
            case ALU_ADD_A:
                this.ADD_A(n);
                break;
            case ALU_ADC_A:
                this.ADC_A(n);
                break;
            case ALU_SUB:
                this.SUB(n);
                break;
            case ALU_SBC_A:
                this.SBC_A(n);
                break;
            case ALU_AND:
                this.AND(n);
                break;
            case ALU_XOR:
                this.XOR(n);
                break;
            case ALU_OR:
                this.OR(n);
                break;
            case ALU_CP:
                this.CP(n);
                break;
        }
    }

    interrupt(): void {
        if (this.interruptEnabled) {
            // Push the program counter
            this.r16[PC] += 2;
            this.r16[SP] -= 2;
            this.memory.uwrite16(this.r16[SP], this.r16[PC]);
            // Execute the interrupt routine
            this.halted = false;
            let retadd = this.r16[PC];
            this.r16[PC] = 0x0038;
            this.log(0x0038, `INT ($${retadd})`);
        }
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


    addInstructionED(arg0: number, func: (addr: number) => void) {
        throw new Error('Method not implemented.');
    }


    addInstructionDD(arg0: number, func: (addr: number) => void) {
        throw new Error('Method not implemented.');
    }

    addInstructionFD(arg0: number, func: (addr: number) => void) {
        throw new Error('Method not implemented.');
    }

    addInstruction(arg0: number, func: (addr: number) => void) {
        throw new Error('Method not implemented.');
    }
}
