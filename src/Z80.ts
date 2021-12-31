import { Logger } from './Logger';
import { CPU } from "./CPU";
import { IO } from "./IO";
import { Memory } from "./Memory";

const A = 1;
const F = 0;
const B = 3;
const C = 2;
const D = 5;
const E = 4;
const H = 7;
const L = 6;
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
const r_debug = ["B", "C", "D", "E", "H", "L", "HL", "A"];
const alu_debug = ["ADD A,", "ADC A,", "SUB ", "SBC A,", "AND", "XOR", "OR", "CP"];
const rot = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"];

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

    // Array to access shadow registers
    r16s = new Uint16Array(this.r16.buffer, 8);

    // Map the registers to 8bit registers
    r8 = new Uint8Array(this.r16.buffer);

    // Array to access shadow registers in 8bit mode
    r8s = new Uint8Array(this.r16.buffer, 8);


    constructor(private memory: Memory, private IO: IO, private logger: Logger) {

    }

    private hex16(n: number) {
        return ("000" + n.toString(16)).slice(-4);
    }

    private hex8(n: number) {
        return ("0" + n.toString(16)).slice(-2);
    }


    public dumpRegisters() {
        let s = "Registers:";
        let first = true;
        r16_debug.forEach((v, i) => {
            s += !first ? ", " : " ";
            s += v + ":" + this.hex16(this.r16[i]);
            first = false;
        })

        //this.logger.debug(Buffer.from(this.r8).toString('hex'));
        this.logger.debug(s);
    }


    reset(): void {
        this.r16[PC] = 0;
        this.r16[SP] = 0;
    }
    
    
    execute(numOfInstructions: number) {
        for (let i = 0; i < numOfInstructions; i++) {
            console.log(i);
            this.fetchInstruction();
        }
    }

    halt(): void {
        throw new Error("HALTED!");
    }

    flag(flag: number): boolean {
        return (this.r8[F] | flag) > 0;
    }

    cc(index: number): boolean {
        switch(index) {        
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
                return (this.r8[F] & FLAG_CARRY) > 10;
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
        this.logger.debug(("000" + address.toString(16)).slice(-4) + " : " + msg);

    }

    private ADD8(p1: number | 0, p2: number | 0): number {
        let result = (p1 & 0xFF) + (p2 & 0xFF);
        this.logger.debug("ADD8 result : " + result.toString(16));
        this.flags8(result);
        return result & 0xFF;
    }

    private ADD16(p1: number, p2: number): number {
        p1 = p1 & 0xFFFF | 0;
        p2 = p2 & 0xFFFF | 0;
        let result = p1 + p2;

        let flags = (this.r8[F] & 0xc4);
        let r2 = (result >>> 8);
        flags |= ((r2 & 0xFF) & 0x28);
        flags |= ((r2 & 0x10) > 0 ? FLAG_HALF_CARRY : 0);
        flags |= ((r2 & 0x100) > 0 ? FLAG_CARRY : 0);

        this.r8[F] = flags;// & 0xFF;

        return result & 0xFFFF | 0;
    }

    private ADD_A(n: number) {
        let result = (this.r8[A] + n);
        this.r8[A] = result & 0xFF;
        // TODO sign stuff correct?     
        this.flags8(result);
    }

    private flags8(result: number) {
        this.r8[F] = (result & FLAG_SIGN_F3_F5 |
            ((result & 0xFF) == 0 ? FLAG_ZERO : 0) |
            (result > 255 ? FLAG_OVERFLOW : 0) |
            (false ? FLAG_ADDSUB : 0) |
            ((result & 0x10) > 0 ? FLAG_HALF_CARRY : 0) |
            ((result & 0x100) > 0 ? FLAG_CARRY : 0)) & 0xFF;
    }

    private ADC_A(n: number) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        let result = (this.r8[A] + n + carry);
        this.r8[A] = result & 0xFF;
        this.flags8(result);
    }

    private SUB(n: number) {
        let result = this.r8[A] - n;
        this.r8[A] = result & 0xFF;
        this.flags8(this.r8[A]);
    }

    private SBC_A(n: number) {
        let carry = this.r8[F] & FLAG_CARRY ? 1 : 0;
        let result = (this.r8[A] - n - carry);
        this.r8[A] = result & 0xFF;
        this.flags8(result);
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
        let result = this.r8[A] - n;
        this.flags8(result & 0xFF);
    }

    private fetchInstruction() {
        this.dumpRegisters();
        let addr = this.r16[PC]++;
        let opcode = this.memory.uread8(addr);
        //this.log(addr, `Opcode: ${opcode.toString(16)}`);

        if (opcode === 0xCB || opcode === 0xDD || opcode === 0xED || opcode === 0xFD) {

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
                        this.log(addr, "NOP");
                        break;
                    case 1:
                        this.log(addr, "EX AF, AF'");
                        let tmp = this.r16[AF];
                        this.r16[AF] = this.r16s[AF];
                        this.r16s[AF] = this.r16[AF];
                        break;
                    case 2:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            this.log(addr, "DJNZ " + d);
                            this.r8[B]--;
                            this.r16[PC] += this.r8[B] !== 0 ? d : 0;
                        }
                        break;
                    case 3:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            this.log(addr, "JR " + d);
                            this.r16[PC] += d;
                        }
                        break;
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        {
                            let d = this.memory.read8(this.r16[PC]++);
                            this.log(addr, `JR ${cc_debug[y - 4]}, ${d}`);
                            this.r16[PC] += this.cc(y - 4) ? d : 0;
                        }
                    default:
                }
            }

            if (z === 1) {
                if (q === 0) {
                    let nn = this.memory.uread8(this.r16[PC]++) | (this.memory.uread8(this.r16[PC]++) << 8);
                    this.log(addr, "LD " + rp_debug[p] + ", $" + nn.toString(16));
                    this.r16[rp[p]] = nn & 0xFFFF; //(nn & 0xFF)  << 8 + ((nn >> 8) & 0xFF);
                }
                if (q == 1) {
                    this.log(addr, "ADD HL, " + rp_debug[p]);
                    this.r16[HL] = this.ADD16(this.r16[HL], this.r16[rp[p]]);
                }
            }

            if (z === 2) {
                if (p < 2) {
                    if (q === 0) {
                        this.log(addr, "LD (" + rp_debug[p] + "), A");
                        this.memory.uwrite8(this.r16[rp[p]], this.r8[A]);
                    } else {
                        this.log(addr, "LD A, (" + rp_debug[p] + ")");
                        this.r8[A] = this.memory.read8(this.r16[rp[p]]);
                    }
                } else {
                    // Fetch 16bits address location
                    let nn = this.memory.uread8(this.r16[PC]++) + (this.memory.uread8(this.r16[PC]++) << 8);
                    if (q === 0) {
                        if (p === 2) {
                            this.log(addr, "LD (" + nn.toString(16) + "), HL");
                            this.memory.uwrite16(nn, this.r16[HL]);
                        } else {
                            this.log(addr, "LD (" + nn.toString(16) + "), A");
                            this.memory.uwrite8(nn, this.r8[A]);
                        }
                    } else {
                        if (p === 2) {
                            this.log(addr, "LD HL, (" + nn.toString(16) + ")");
                            this.r16[HL] = this.memory.uread16(nn);
                        } else {
                            this.log(addr, "LD A, (" + nn.toString(16) + ")");
                            this.r8[A] = this.memory.uread8(nn);
                        }
                    }
                }

            }

            if (z === 3) {
                this.log(addr, (q === 0 ? "INC" : "DEC") + " " + rp_debug[p]);
                this.r16[rp[p]] += (q === 0 ? 1 : -1);
            }

            if (z === 4) {
                this.log(addr, "INC " + r_debug[y]);
                this.flags8(++this.r8[r[y]]);
            }

            if (z === 5) {
                this.log(addr, "DEC " + r_debug[y]);
                this.flags8(--this.r8[r[y]]);
            }

            if (z === 6) {
                let n = this.memory.uread8(this.r16[PC]++);
                this.log(addr, `LD ${r_debug[y]}, ${this.hex8(n)}`);
                this.r8[r[y]] = n;
            }

            if (z === 7) {
                switch(y) {
                    case 0: // RLCA
                        this.log(addr, 'RLCA');
                        let result = this.r8[A] << 1;                        
                        this.r8[F] = result & 0x100 ? FLAG_CARRY : 0;
                        this.r8[A] = (result & 0xFF) | (result & 0x100 ? 1 : 0);
                        break;
                    case 1: // RRCA
                        //this.log(addr, 'RRCA');
                        break;
                    case 2: // RLA
                        //this.log(addr, 'RLA');
                        break;
                    case 3: // RRA         
                        //this.log(addr, 'RRA');                                           
                        break;
                    case 4:	// DAA
                        //this.log(addr, 'DAA');
                        break;
                    case 5:	// CPL
                        //this.log(addr, 'CPL');
                        break;                        
                    case 6:	// SCF                    
                        //this.log(addr, 'SCF');
                        break;
                    case 7:	// CCF
                        //this.log(addr, 'CCF');
                        break;
                }
                
            }

        }

        if (x === 1) {
            if (z === 6 && y === 6) {
                this.log(addr, "HALT");
                this.r16[PC]--;
                this.halt();
            } else {
                if (z == 7 && y == 6) {
                    this.log(addr, `LD (${r_debug[y]}), ${r_debug[z]}`);
                    this.memory.uwrite8(this.r16[r[y]], this.r8[r[z]]);
                } else {
                    this.log(addr, `LD ${r_debug[y]}, ${r_debug[z]}`);
                    this.r8[r[y]] = this.r8[r[z]];
                }
            }
        }

        if (x === 2) {
            if (z == 6) {
                this.log(addr, `${alu_debug[y]} (${r_debug[z]})`);
                let val = this.memory.uread8(this.r16[r[z]]);
                console.log(val.toString(16));
                this.aluOperation(y, val);
            } else {
                this.log(addr, `${alu_debug[y]} ${r_debug[z]}`);
                this.aluOperation(y, this.r8[r[z]]);
            }
        }

        if (x === 3) {
            if (z === 0) {
                this.log(addr, `RET ${cc_debug[y]}`);
                this.log(addr, `${cc_debug[y]} FLAG : ${this.cc(y)}`);
                if (this.cc(y)) {
                    this.r16[PC] = this.memory.uread16(this.r16[SP]);
                    this.r16[SP] += 2
                }
            }

            if (z === 1) {
                if (q === 0) {                    
                    this.log(addr, `POP ${rp2_debug[p]}`);
                    this.r16[rp2[p]] = this.memory.uread16(this.r16[SP]++);
                } else {
                    switch(p) {
                        case 0:
                            this.log(addr, 'RET');
                            this.r16[PC] = this.memory.uread16(this.r16[SP]);
                            this.r16[SP] += 2;
                            break;
                        case 1:
                            this.log(addr, 'EXX');
                            let bc = this.r16[BC];
                            let de = this.r16[DE];
                            let hl = this.r16[HL];
                            this.r16s[BC] = this.r16[BC];
                            this.r16s[DE] = this.r16[DE];
                            this.r16s[HL] = this.r16[HL];
                            this.r16[BC] = bc;
                            this.r16[DE] = de;
                            this.r16[HL] = hl;
                            break;
                        case 2:
                            this.log(addr, 'JP HL (NOT IMPLEMENTED)');
                            break;
                        case 3:
                            this.log(addr, 'LD SP,HL (NOT IMPLEMENTED)');
                            break;
                    }

                }
            }

            if (z === 2) {
                let nn = this.memory.uread16(this.r16[PC])
                this.r16[PC] += 2;
                this.log(addr, `JP ${cc_debug[y]}, ${(nn).toString(16)}`);
                if (nn_predicates[y](this.r8[F])) {
                    this.r16[PC] = nn;
                }

                //this.r16[PC] += this.cc(y - 4) ? d : 0;

            }

            if (z === 3) {
                let n;
                switch(y) {
                    case 0: //	JP nn
                        let nn = this.memory.uread16(this.r16[PC])                        
                        this.log(addr, `JP ${this.hex16(nn)}`);
                        this.r16[PC] = nn;
                        break;

                    case 1:	//(CB prefix)
                        this.log(addr, `CB prefix instruction`);
                        break;
                    case 2:	//OUT (n), A
                        n = this.memory.uread8(this.r16[PC]++);
                        this.log(addr, `OUT (0x${n.toString(16)}), A`);
                        this.IO.write8(n, this.r8[A]);                       
                        break;
                    case 3:	//IN A, (n)
                        n = this.memory.uread8(this.r16[PC]++);
                        this.log(addr, `IN A,(0x${n.toString(16)})`);
                        this.r8[A] = this.IO.read8(n);                     
                        break;
                    case 4: //EX (SP), HL 
                        this.log(addr, `EX (SP), HL`);                        
                        let sp = this.memory.uread16(this.r16[SP]);
                        this.memory.uwrite16(this.r16[SP], this.r16[HL]);
                        this.r16[HL] = sp;
                        break;
                    case 5:	//EX DE, HL   
                        this.log(addr, `EX DE, HL`);
                        let de = this.r16[DE];
                        this.r16[DE] = this.r16[HL];
                        this.r16[HL] = de;                        
                        break;
                    case 6:	//DI
                        this.log(addr, `DI NOT IMPLEMENTED`);
                        break;
                    case 7:	//EI
                        this.log(addr, `EI NOT IMPLEMENTED`);
                        break;
                }
            }

            if (z === 4) {
                // TODO: incorrect
                let nn = this.memory.uread16(this.r16[PC]++)
                this.r16[PC]++;
                this.log(addr, `CALL ${this.hex16(nn)}`);
            }

            if (z === 5) {
                if (q === 0) {
                    // TODO: implement;
                    this.log(addr, `PUSH ${rp2_debug[p]}`);
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
                this.log(addr, alu_debug[y] + " $" + n.toString(16));
                this.aluOperation(y, n);
            }

            if (z === 7) {
                this.log(addr, `RST ${(y * 8).toString(16)}`);
                this.r16[PC] = (y * 8) & 0xFF;
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
}