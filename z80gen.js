// Z80 opcode code generator

const csv = require('csv-parser')
const fs = require('fs');
const { emit } = require('process');
const results = [];
const generateLoggingCode = true;

let mnemonic = /(?<opcode>\w+)( )?(?<operand>(\()?\w+(\+o)?(\))?)(,?)(?<operand2>(\()?\w+(\+o)?([\),'])?)?$/
let indirect = /\((?<reg>(\w+)(\+o)?)\)/

function emitCode(code) {
    console.log(code);
}

function emitLog(code) {
    if (generateLoggingCode) {
        console.log(code);
    }
}

function emitComment(comment) {
    emitCode(`// ${comment}`);
}

let nn_read = `let val = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;`;

let nn_read_ind = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
let val = this.memory.uread16(nn);`;

let nn_write_ind8 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite8(nn, val);`;

let nn_write_ind16 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite16(nn, val);`;

let n_read = `
let val = this.memory.uread8(this.r16[PC]++);    
`;

let stack_pc = `this.r16[SP] -= 2;\nthis.memory.uwrite16(this.r16[SP], this.r16[PC]);`

const conditions = {
    C: '(this.r8[F] & Flags.C)',
    NC: '!(this.r8[F] & Flags.C)',
    Z: '(this.r8[F] & Flags.Z)',
    NZ: '!(this.r8[F] & Flags.Z)',
    M: '(this.r8[F] & Flags.S)',
    P: '!(this.r8[F] & Flags.S)',
    PE: '(this.r8[F] & Flags.PV)',
    PO: '!(this.r8[F] & Flags.PV)',
}

const flagChecks = {
    Z: 'if (val == 0) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
    PV: 'if (this.evenParity[val]) { this.r8[F] |= Flags.PV } else { this.r8[F] &= ~Flags.PV }',
    C: 'if ([val] & 0x100) { this.r8[F] |= Flags.C } else { this.r8[F] &= ~Flags.C }',
    H: '// TODO: Implement Half carry behaviour',
    S: 'if (val == 0x80) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
    S16: 'if (val == 0x8000) { this.r8[F] |= Flags.Z } else { this.r8[F] &= ~Flags.Z }',
}

const flagReset = {
    S: 'this.r8[F] &= ~Flags.S;',
    Z: 'this.r8[F] &= ~Flags.Z;',
    F5: 'this.r8[F] &= ~Flags.F5;',
    H: 'this.r8[F] &= ~Flags.H;',
    F3: 'this.r8[F] &= ~Flags.F3;',
    PV: 'this.r8[F] &= ~Flags.PV;',
    N: 'this.r8[F] &= ~Flags.N;',
    C: 'this.r8[F] &= ~Flags.C;',
}

const flagSet = {
    S: 'this.r8[F] |= Flags.S;',
    Z: 'this.r8[F] |= Flags.Z;',
    F5: 'this.r8[F] |= Flags.F5;',
    H: 'this.r8[F] |= Flags.H;',
    F3: 'this.r8[F] |= Flags.F3;',
    PV: 'this.r8[F] |= Flags.PV;',
    N: 'this.r8[F] |= Flags.N;',
    C: 'this.r8[F] |= Flags.C;',
}

const registersLD = {
    'A': { type: 8, src: 'let val = this.r8[A];', dst: 'this.r8[A] = val;', direct: 'this.r8[A]' },
    'F': { type: 8, src: 'let val = this.r8[F];', dst: 'this.r8[F] = val;', direct: 'this.r8[F]' },
    'B': { type: 8, src: 'let val = this.r8[B];', dst: 'this.r8[B] = val;', direct: 'this.r8[B]' },
    'C': { type: 8, src: 'let val = this.r8[C];', dst: 'this.r8[C] = val;', direct: 'this.r8[C]' },
    '(C)': { type: 8, src: 'let val = this.IO.read8(this.r8[C]);', dst: 'this.IO.write8(this.r8[C], val);' },
    'D': { type: 8, src: 'let val = this.r8[D];', dst: 'this.r8[D] = val;', direct: 'this.r8[D]' },
    'E': { type: 8, src: 'let val = this.r8[E];', dst: 'this.r8[E] = val;', direct: 'this.r8[E]' },
    'H': { type: 8, src: 'let val = this.r8[H];', dst: 'this.r8[H] = val;', direct: 'this.r8[H]' },
    'L': { type: 8, src: 'let val = this.r8[L];', dst: 'this.r8[L] = val;', direct: 'this.r8[L]' },
    'I': { type: 8, src: 'let val = this.r8[I];', dst: 'this.r8[I] = val;', direct: 'this.r8[I]' },
    'R': { type: 8, src: 'let val = this.r8[R];', dst: 'this.r8[R] = val;', direct: 'this.r8[R]' },
    'AF': { type: 16, src: 'let val = this.r16[AF];', dst: 'this.r16[AF] = val;', direct: 'this.r16[AF]' },
    'BC': { type: 16, src: 'let val = this.r16[BC];', dst: 'this.r16[BC] = val;', direct: 'this.r16[BC]' },
    'DE': { type: 16, src: 'let val = this.r16[DE];', dst: 'this.r16[DE] = val;', direct: 'this.r16[DE]' },
    'HL': { type: 16, src: 'let val = this.r16[HL];', dst: 'this.r16[HL] = val;', direct: 'this.r16[HL]' },
    'SP': { type: 16, src: 'let val = this.r16[SP];', dst: 'this.r16[SP] = val;', direct: 'this.r16[SP]' },
    '(BC)': { type: 8, src: 'let val = this.memory.uread8(this.r16[BC]);', dst: 'this.memory.uwrite8(this.r16[BC], val);' },
    '(DE)': { type: 8, src: 'let val = this.memory.uread8(this.r16[DE]);', dst: 'this.memory.uwrite8(this.r16[DE], val);' },
    '(HL)': { type: 8, src: 'let val = this.memory.uread8(this.r16[HL]);', dst: 'this.memory.uwrite8(this.r16[HL], val);' },
    '(IX)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IX]);', dst: 'this.memory.uwrite8(this.r16[IX], val);' },
    '(IY)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IY]);', dst: 'this.memory.uwrite8(this.r16[IY], val);' },
    'HL\'': { type: 16, src: 'let val = this.r16s[HL];', dst: 'this.r16s[HL] = val;', direct: 'this.r16s[HL]' },
    'IXh': { type: 8, src: 'let val = this.r8[IXh];', dst: 'this.r8[IXh] = val;', direct: 'this.r8[IXh]' },
    'IXl': { type: 8, src: 'let val = this.r8[IXl];', dst: 'this.r8[IXl] = val;', direct: 'this.r8[IXl]' },
    'IYh': { type: 8, src: 'let val = this.r8[IYh];', dst: 'this.r8[IYh] = val;', direct: 'this.r8[IYh]' },
    'IYl': { type: 8, src: 'let val = this.r8[IYl];', dst: 'this.r8[IYl] = val;', direct: 'this.r8[IYl]' },
    'IX': { type: 16, src: 'let val = this.r16[IX];', dst: 'this.r16[IX] = val;', direct: 'this.r16[IX]' },
    'IY': { type: 16, src: 'let val = this.r16[IY];', dst: 'this.r16[IY] = val;', direct: 'this.r16[IY]' },
    '(IX+o)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, val);' },
    '(IY+o)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, val);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': { type: 8, src: 'let val = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(n)': { type: 8, src: 'let val = this.memory.uread8(this.r16[PC]++);', dst: 'this.IO.write8(n, val);' },
    '(nn)': { type: 8, src: nn_read_ind, dst: nn_write_ind8, dst16: nn_write_ind16 }
};

const rLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'H', 5: 'L', 7: 'A' };
const pLookup = {/* 0: 'B', 1: 'C', 2: 'D', 3: 'E',*/ 4: 'IXh', 5: 'IXl'/*, 7: 'A'*/ };
const qLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'IXh', 5: 'IXl', 7: 'A' };

function generateLambda(r, opcode) {
    if (opcode[0] === 'ED') {
        emitCode(`this.addInstructionED(0x${opcode[1]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'CB') {
        emitCode(`this.addInstructionCB(0x${opcode[1]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'DD') {
        if (opcode[1] === 'CD') {
            emitCode(`this.addInstructionDDCB(0x${opcode[2]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionDD(0x${opcode[1]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else if (opcode[0] === 'FD') {
        if (opcode[1] === 'CB') {
            emitCode(`this.addInstructionFDCB(0x${opcode[1]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionFD(0x${opcode[1]}, (addr: number) => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else {
        emitCode(`this.addInstruction(0x${opcode[0]}, (addr: number) => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    }
}

function generateLDOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);

    if (registersLD[src].direct && registersLD[dst].direct) {
        emitCode(`${registersLD[dst].direct} = ${registersLD[src].direct}`);
    } else {
        emitCode(registersLD[src].src);
        if (registersLD[src].type == 16 && registersLD[dst].type == 8) {
            emitCode(registersLD[dst].dst16);
        } else {
            emitCode(registersLD[dst].dst);
        }
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/,nn/, ',${val}')
        .replace(/,\(nn\)/, ',(${val})')
        .replace(/,n/, ',${val}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}


function generateAddSubCpOpcode(r, dst, src, opcode) {
    generateLambda(r, opcode);

    emitCode(registersLD[src].src);
    let sbc = r.Instruction.indexOf('SBC ') >= 0;
    let adc = r.Instruction.indexOf('ADC ') >= 0;
    let add = r.Instruction.indexOf('ADD ') >= 0;
    let cp = r.Instruction.indexOf('CP ') >= 0;
    let carry = sbc || adc;
    let adding = add || adc;

    let store = cp ? '' : `${registersLD[dst].direct} = `
    if (registersLD[src].type == 16) {
        emitCode(`${store}this.addSub16(${registersLD[dst].direct}, val, ${adding}, ${carry})`);
    } else {
        emitCode(`${store}this.addSub8(${registersLD[dst].direct}, val, ${adding}, ${carry})`);
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/,nn/, ',${val}')
        .replace(/,\(nn\)/, ',(${val})')
        .replace(/,n/, ',${val}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}


function generateJPOpcode(r, condition, src, opcode) {
    generateLambda(r, opcode);
    emitCode(registersLD[src].src);

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/nn/, '${val}');

    if (condition) {
        emitCode(`if (${conditions[condition]}) {`);;
        emitCode(`this.r16[PC] = val;`)
        emitCode(`}`);
    } else {
        emitCode(`this.r16[PC] = val;`)
    }
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateJRAndCallOpcode(r, condition, src, opcode) {

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/nn/, '${nn}');

    let timings = r.TimingZ80.split('/');

    generateLambda(r, opcode);

    let call = instr.indexOf('CALL') >= 0;

    if (call) {
        emitCode(`let nn = this.memory.uread16(this.r16[PC]);`);
        emitCode(`this.r16[PC] += 2;`);
    } else {
        emitCode(`let o = this.memory.read8(this.r16[PC]++);`);
    }

    let varName = call ? 'nn' : 'o';

    if (condition) {
        emitCode(`if (${conditions[condition]}) {`);;
        if (call) emitCode(stack_pc); // Call puts program counter on the stack
        emitCode(`this.r16[PC] += ${varName};`)
        emitCode(`this.cycles += ${timings[0]};`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`);
    } else {
        emitCode(`this.r16[PC] = ${varName};`);
        emitCode(`this.cycles += ${r.TimingZ80};`);
    }

    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateIncDecOpcode(r, src, opcode, inc) {

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/nn/, '${nn}');

    generateLambda(r, opcode);

    let val = 'val';
    if (registersLD[src].direct && registersLD[src].type == 8) {
        emitCode(`${registersLD[src].direct} = this.incDec8(${registersLD[src].direct}, ${inc});`);
    } else {
        emitCode(registersLD[src].src);
        if (registersLD[src].type == 8) {
            emitCode(`${val} = this.incDec8(${val}, ${inc});`);
        } else {
            if (inc) {
                emitCode(`${val}++`);
            } else {
                emitCode(`${val}--`);
            }
        }
        emitCode(registersLD[src].dst)
    }

    emitLog(`this.log(addr, \`${instr}\`)`);
    emitCode(`});\n`);
}

function generateAndOrXorOpcode(r, src, opcode, operation) {

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/nn/, '${nn}');

    generateLambda(r, opcode);

    let val = 'val';
    emitCode(registersLD[src].src);

    emitCode(`this.logicalOperation(${val}, LogicalOperation.${operation});`);

    if (src === 'n') {
        emitLog(`this.log(addr, \`${operation} \${val}\`)`);
    } else {
        src = src.replace(/\+o/, '+${o}');
        emitLog(`this.log(addr, \`${operation} ${src}\`)`);
    }

    emitCode(`});\n`);
}


function fillRInOpcode(opcode, r) {
    let regex = /(?<base>\w+)\+r/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(r)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillPInOpcode(opcode, p) {
    let regex = /(?<base>\w+)\+p/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillPInOpcodeMul(opcode, p) {
    let regex = /(?<base>\w+)\*p/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) * parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillQInOpcode(opcode, p) {
    let regex = /(?<base>\w+)\+q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(p)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillQInOpcode(opcode, q) {
    let regex = /(?<base>\w+)\+q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) + parseInt(q)).toString(16)}`;
        }
        return `${o}`;
    })
}

function fillQInOpcodeMul(opcode, q) {
    let regex = /(?<base>\w+)\*q/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `${(parseInt(match.groups['base'], 16) * parseInt(q)).toString(16)}`;
        }
        return `${o}`;
    })
}

function generateLD(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];
    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    // TODO: generate flag behavior for I and R registers.
    // In all other cases no flags are affected
    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateLDOpcode(row, dst, c[1], fillRInOpcode(opcode, r));
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateLDOpcode(row, dst, c[1], fillPInOpcode(opcode, p));
        });
    } else if (src.match(/q/)) {
        Object.entries(pLookup).forEach(c => {
            let q = c[0];
            generateLDOpcode(row, dst, c[1], fillQInOpcode(opcode, q));
        });
    } else {
        generateLDOpcode(row, dst, src, opcode);
    }
}

function generateAddSub(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let dst = match.groups["operand"];
    let src = match.groups["operand2"];

    if (!src) {
        src = dst;
        dst = 'A';
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    // TODO: generate flag behavior for I and R registers.
    // In all other cases no flags are affected
    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillRInOpcode(opcode, r));
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillPInOpcode(opcode, p));
        });
    } else if (src.match(/q/)) {
        Object.entries(pLookup).forEach(c => {
            let q = c[0];
            generateAddSubCpOpcode(row, dst, c[1], fillQInOpcode(opcode, q));
        });
    } else {
        generateAddSubCpOpcode(row, dst, src, opcode);
    }
}

function generateJPJR(row) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let condition = match.groups["operand"];
    let src = match.groups["operand2"];

    if (!src) {
        src = condition;
        condition = undefined;
    }
    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);

    if (match.groups['opcode'] == "JP") {
        generateJPOpcode(row, condition, src, opcode);
    } else {
        generateJRAndCallOpcode(row, condition, src, opcode);
    }
}

function generateIncDec(row, inc) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);
    let src = match.groups["operand"];
    if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateIncDecOpcode(row, c[1], fillPInOpcodeMul(opcode, p), inc);
        });
    } else if (src.match(/q/)) {
        Object.entries(pLookup).forEach(c => {
            let q = c[0];
            generateIncDecOpcode(row, c[1], fillQInOpcodeMul(opcode, q), inc);
        });
    } else {
        generateIncDecOpcode(row, src, opcode, inc);
    }
}

function generateAndOrXor(row, operation) {
    //console.log(r);
    let match = mnemonic.exec(row.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(row));
    }

    let opcode = row.Opcode.trim().split(' ');
    //console.log(opcode);
    let src = match.groups["operand"];
    if (src.match(/r/)) {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateAndOrXorOpcode(row, c[1], fillRInOpcode(opcode, r), operation);
        });
    } else if (src.match(/p/)) {
        Object.entries(pLookup).forEach(c => {
            let p = c[0];
            generateAndOrXorOpcode(row, c[1], fillPInOpcode(opcode, p), operation);
        });
    } else if (src.match(/q/)) {
        Object.entries(pLookup).forEach(c => {
            let q = c[0];
            generateAndOrXorOpcode(row, c[1], fillQInOpcode(opcode, q), operation);
        });
    } else {
        generateAndOrXorOpcode(row, src, opcode, operation);
    }
}

async function generateCode() {
    await new Promise((res, rej) => {
        fs.createReadStream('Opcodes.csv')
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => results.push(data))
            .on('end', () => {
                // results.filter(r => r.Instruction.indexOf('LD ') == 0).forEach(r => {
                //     generateLD(r);
                // });

                // results.filter(r => r.Instruction.indexOf('JP ') == 0).forEach(r => {
                //     generateJPJR(r);
                // });

                // results.filter(r => r.Instruction.indexOf('JR ') == 0).forEach(r => {
                //     generateJPJR(r);
                // });

                // results.filter(r => r.Instruction.indexOf('CALL ') == 0).forEach(r => {
                //     generateJPJR(r);
                // });

                // results.filter(r => r.Instruction.indexOf('INC ') == 0).forEach(r => {
                //     generateIncDec(r, true);
                // });

                // results.filter(r => r.Instruction.indexOf('DEC ') == 0).forEach(r => {
                //     generateIncDec(r, false);
                // });

                // results.filter(r => r.Instruction.indexOf('AND ') == 0).forEach(r => {
                //     generateAndOrXor(r, 'AND');
                // });

                // results.filter(r => r.Instruction.indexOf('OR ') == 0).forEach(r => {
                //     generateAndOrXor(r, 'OR');
                // });

                // results.filter(r => r.Instruction.indexOf('XOR ') == 0).forEach(r => {
                //     generateAndOrXor(r, 'XOR');
                // });

                // results.filter(r => r.Instruction.indexOf('OUT ') == 0).forEach(r => {
                //     generateLD(r);
                // });

                // results.filter(r => r.Instruction.indexOf('IN ') == 0).forEach(r => {
                //     generateLD(r);
                // });

                // results.filter(r => r.Instruction.indexOf('ADC ') == 0).forEach(r => {
                //     generateADC(r);
                // });

                // results.filter(r => r.Instruction.indexOf('ADD ') == 0).forEach(r => {
                //     generateADC(r);
                // });

                // results.filter(r => r.Instruction.indexOf('SBC ') == 0).forEach(r => {
                //     generateAddSub(r);
                // });

                // results.filter(r => r.Instruction.indexOf('SUB ') == 0).forEach(r => {
                //     generateAddSub(r);
                // });

                // results.filter(r => r.Instruction.indexOf('CP ') == 0).forEach(r => {
                //     generateAddSub(r);
                // });

                // TODO: Rotate functions!
                results.filter(r => r.Instruction.indexOf('RL ') == 0).forEach(r => {
                    generateAddSub(r);
                });

                res();
            });
    });
}

async function readFile() {
    const data = fs.readFileSync('src/z80_template.ts', 'utf8');
    let lines = data.split('\r\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('/* GENERATED_CODE_INSERT_HERE */') >= 0) {
            await generateCode();
        } else {
            console.log(lines[i]);
        }
    }
}

readFile();