// Z80 opcode code generator

const csv = require('csv-parser')
const fs = require('fs');
const { emit } = require('process');
const results = [];

let mnemonic = /(?<opcode>\w+)( )?(?<operand>(\()?\w+(\+o)?(\))?)(,?)(?<operand2>(\()?\w+(\+o)?([\),'])?)?$/
let indirect = /\((?<reg>(\w+)(\+o)?)\)/

function emitCode(code) {
    console.log(code);
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

const registersLD = {
    'A': { type: 8, src: 'let val = this.r8[A];', dst: 'this.r8[A] = val;' },
    'F': { type: 8, src: 'let val = this.r8[F];', dst: 'this.r8[F] = val;' },
    'B': { type: 8, src: 'let val = this.r8[B];', dst: 'this.r8[B] = val;' },
    'C': { type: 8, src: 'let val = this.r8[C];', dst: 'this.r8[C] = val;' },
    '(C)': { type: 8, src: 'let val = this.IO.read8(this.r8[C]);', dst: 'this.IO.write8(this.r8[C], src);' },
    'D': { type: 8, src: 'let val = this.r8[D];', dst: 'this.r8[D] = val;' },
    'E': { type: 8, src: 'let val = this.r8[E];', dst: 'this.r8[E] = val;' },
    'H': { type: 8, src: 'let val = this.r8[H];', dst: 'this.r8[H] = val;' },
    'L': { type: 8, src: 'let val = this.r8[L];', dst: 'this.r8[L] = val;' },
    'I': { type: 8, src: 'let val = this.r8[I];', dst: 'this.r8[I] = val;' },
    'R': { type: 8, src: 'let val = this.r8[R];', dst: 'this.r8[R] = val;' },
    'AF': { type: 16, src: 'let val = this.r16[AF];', dst: 'this.r16[AF] = val;' },
    'BC': { type: 16, src: 'let val = this.r16[BC];', dst: 'this.r16[BC] = val;' },
    'DE': { type: 16, src: 'let val = this.r16[DE];', dst: 'this.r16[DE] = val;' },
    'HL': { type: 16, src: 'let val = this.r16[HL];', dst: 'this.r16[HL] = val;' },
    'SP': { type: 16, src: 'let val = this.r16[SP];', dst: 'this.r16[SP] = val;' },
    '(BC)': { type: 8, src: 'let val = this.memory.uread8(this.r16[BC]);', dst: 'this.memory.uwrite8(this.r16[BC], val);' },
    '(DE)': { type: 8, src: 'let val = this.memory.uread8(this.r16[DE]);', dst: 'this.memory.uwrite8(this.r16[DE], val);' },
    '(HL)': { type: 8, src: 'let val = this.memory.uread8(this.r16[HL]);', dst: 'this.memory.uwrite8(this.r16[HL], val);' },
    '(IX)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IX]);', dst: 'this.memory.uwrite8(this.r16[IX], val);' },
    '(IY)': { type: 8, src: 'let val = this.memory.uread8(this.r16[IY]);', dst: 'this.memory.uwrite8(this.r16[IY], val);' },
    'HL\'': { type: 16, src: 'let val = this.r16s[HL];', dst: 'this.r16s[HL] = val;' },
    'IXh': { type: 8, src: 'let val = this.r8[IXh];', dst: 'this.r8[IXh] = val;' },
    'IXl': { type: 8, src: 'let val = this.r8[IXl];', dst: 'this.r8[IXl] = val;' },
    'IYh': { type: 8, src: 'let val = this.r8[IYh];', dst: 'this.r8[IYh] = val;' },
    'IYl': { type: 8, src: 'let val = this.r8[IYl];', dst: 'this.r8[IYl] = val;' },
    'IX': { type: 16, src: 'let val = this.r16[IX];', dst: 'this.r16[IX] = val;' },
    'IY': { type: 16, src: 'let val = this.r16[IY];', dst: 'this.r16[IY] = val;' },
    '(IX+o)': { type: 24, src: 'let val = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, val);' },
    '(IY+o)': { type: 24, src: 'let val = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, val);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': { type: 8, src: 'let val = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(nn)': { type: 8, src: nn_read_ind, dst: nn_write_ind8, dst16: nn_write_ind16 }
};

const rLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'H', 5: 'L', 7: 'A' };
const pLookup =	{/* 0: 'B', 1: 'C', 2: 'D', 3: 'E',*/ 4: 'IXh', 5: 'IXl'/*, 7: 'A'*/};
const qLookup =	{ 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'IXh', 5: 'IXl', 7: 'A'};

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

    emitCode(registersLD[src].src);
    if (registersLD[src].type == 16 && registersLD[dst].type == 8) {
        emitCode(registersLD[dst].dst16);
    } else {
        emitCode(registersLD[dst].dst);
    }

    let instr = r.Instruction.replace(/r/, src)
        .replace(/o/, '${o}')
        .replace(/,nn/, ',${val}')
        .replace(/,\(nn\)/, ',(${val})')
        .replace(/,n/, ',${val}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitCode(`this.log(addr, \`${instr}\`)`);
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
    emitCode(`this.log(addr, \`${instr}\`)`);
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
        emitCode(`this.r16[PC] += ${varName};`)
        emitCode(`this.cycles += ${timings[0]};`);
        emitCode(`} else {`);
        emitCode(`this.cycles += ${timings[1]};`);
        emitCode(`}`);
    } else {
        emitCode(`this.r16[PC] = ${varName};`);
        emitCode(`this.cycles += ${r.TimingZ80};`);
    }
    
    emitCode(`this.log(addr, \`${instr}\`)`);
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
    }else {
        generateLDOpcode(row, dst, src, opcode);
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

fs.createReadStream('Opcodes.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
        // results.filter(r => r.Instruction.indexOf('LD ') == 0).forEach(r => {
        //     generateLD(r);
        // });
        results.filter(r => r.Instruction.indexOf('CALL ') == 0).forEach(r => {
            generateJPJR(r);
        });
    });

// fs.createReadStream('Opcodes.csv')
//     .pipe(csv({ separator: ';' }))
//     .on('data', (data) => results.push(data))
//     .on('end', () => {
//         results.filter(r => r.Instruction.indexOf('JP ') == 0).forEach(r => {
//             generateLD(r);
//         })
//     });  