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

let nn_read = `
let val = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
`;

let nn_read_ind = `
let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
let val = this.memory.uread16(nn);
`;

let nn_write_ind8 = `
let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite8(nn, val);
`;

let nn_write_ind16 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite16(nn, val);`;

let n_read = `
let val = this.memory.uread8(this.r16[PC]++);    
`;

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
    'AF': { type: 16, src: 'let val = this.r16[AF];', dst: 'this.r16[AF] = val;' },
    'BC': { type: 16, src: 'let val = this.r16[BC];', dst: 'this.r16[BC] = val;' },
    'DE': { type: 16, src: 'let val = this.r16[DE];', dst: 'this.r16[DE] = val;' },
    'HL': { type: 16, src: 'let val = this.r16[HL];', dst: 'this.r16[HL] = val;' },
    'SP': { type: 16, src: 'let val = this.r16[SP];', dst: 'this.r16[SP] = val;' },
    '(BC)': { type: 8, src: 'let val = this.memory.read8(this.r16[BC]);', dst: 'this.memory.write8(this.r16[BC], val);' },
    '(DE)': { type: 8, src: 'let val = this.memory.read8(this.r16[DE]);', dst: 'this.memory.write8(this.r16[DE], val);' },
    '(HL)': { type: 8, src: 'let val = this.memory.read8(this.r16[HL]);', dst: 'this.memory.write8(this.r16[HL], val);' },
    'HL\'': { type: 16, src: 'let val = this.r16s[HL];', dst: 'this.r16s[HL] = val;' },
    'IXh': { type: 8, src: 'let val = this.r8[IXh];', dst: 'this.r8[IXh] = val;' },
    'IXl': { type: 8, src: 'let val = this.r8[IXl];', dst: 'this.r8[IXl] = val;' },
    'IX': { type: 16, src: 'let val = this.r16[IX];', dst: 'this.r16[IX] = val;' },
    'IY': { type: 16, src: 'let val = this.r16[IY];', dst: 'this.r16[IY] = val;' },
    '(IX+o)': { type: 24, src: 'let val = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, val);' },
    '(IY+o)': { type: 24, src: 'let val = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, val);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': { type: 8, src: 'let val = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(nn)': { type: 24, src: nn_read_ind, dst: nn_write_ind8, dst16: nn_write_ind16 }
};

const rLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'H', 5: 'L', 7: 'A' };
const pLookup =	{ 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'IXh', 5: 'IXl', 7: 'A'};
const qLookup =	{ 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'IXh', 5: 'IXl', 7: 'A'};



function generateLDOpcode(r, dst, src, opcode) {
    if (opcode[0] === 'ED') {
        emitCode(`this.addInstructionED(0x${opcode[1]}, () => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'CD') {
        emitCode(`this.addInstructionCD(0x${opcode[1]}, () => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    } else if (opcode[0] === 'DD') {
        if (opcode[1] === 'CD') {
            emitCode(`this.addInstructionDDCD(0x${opcode[2]}, () => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionDD(0x${opcode[1]}, () => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else if (opcode[0] === 'FD') {
        if (opcode[1] === 'CD') {
            emitCode(`this.addInstructionFDCD(0x${opcode[1]}, () => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
        } else {
            emitCode(`this.addInstructionFD(0x${opcode[1]}, () => {`);
            emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
            if (opcode[2] == 'o') {
                emitCode(`let o = this.memory.uread8(this.r16[PC]++);`);
            }
        }
    } else {
        emitCode(`this.addInstruction(0x${opcode}, () => {`);
        emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    }

    emitCode(registersLD[src].src);
    if (registersLD[src].type == 16) {
        emitCode(registersLD[dst].dst16);
    } else {
        emitCode(registersLD[dst].dst);
    }

    let instr = r.Instruction.replace(/r/, src).replace(/o/, '${o}').replace(/,nn/, ',${src}').replace(/,n/, ',${src}');

    emitCode(`this.cycles += ${r.TimingZ80};`);
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
    console.log(opcode);

    if (src == 'r') {
        Object.entries(rLookup).forEach(c => {
            let r = c[0];
            generateLDOpcode(row, dst, c[1], fillRInOpcode(opcode, r));
        });
    } else {
        generateLDOpcode(row, dst, src, opcode);
    }
}

fs.createReadStream('Opcodes.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
        results.filter(r => r.Instruction.indexOf('LD') == 0).forEach(r => {
            generateLD(r);
        })
    });    