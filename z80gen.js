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
let src = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
`;

let nn_read_ind = `
let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
let src = this.memory.uread16(nn);
`;

let nn_write_ind8 = `
let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite8(nn, src);
`;

let nn_write_ind16 = `let nn = this.memory.uread16(this.r16[PC]);
this.r16[PC] += 2;
this.memory.uwrite16(nn, src);`;

let n_read = `
let src = this.memory.uread8(this.r16[PC]++);    
`;

const registersLD = {
    'A': { type: 8, src: 'let src = this.r8[A];', dst: 'this.r8[A] = src;' },
    'F': { type: 8, src: 'let src = this.r8[F];', dst: 'this.r8[F] = src;' },
    'B': { type: 8, src: 'let src = this.r8[B];', dst: 'this.r8[B] = src;' },
    'C': { type: 8, src: 'let src = this.r8[C];', dst: 'this.r8[C] = src;' },
    '(C)': { type: 8, src: 'let src = this.IO.read8(this.r8[C]);', dst: 'this.IO.write8(this.r8[C], src);' },
    'D': { type: 8, src: 'let src = this.r8[D];', dst: 'this.r8[D] = src;' },
    'E': { type: 8, src: 'let src = this.r8[E];', dst: 'this.r8[E] = src;' },
    'H': { type: 8, src: 'let src = this.r8[H];', dst: 'this.r8[H] = src;' },
    'L': { type: 8, src: 'let src = this.r8[L];', dst: 'this.r8[L] = src;' },
    'AF': { type: 16, src: 'let src = this.r16[AF];', dst: 'this.r16[AF] = src;' },
    'BC': { type: 16, src: 'let src = this.r16[BC];', dst: 'this.r16[BC] = src;' },
    'DE': { type: 16, src: 'let src = this.r16[DE];', dst: 'this.r16[DE] = src;' },
    'HL': { type: 16, src: 'let src = this.r16[HL];', dst: 'this.r16[HL] = src;' },
    'SP': { type: 16, src: 'let src = this.r16[SP];', dst: 'this.r16[SP] = src;' },
    '(BC)': { type: 8, src: 'let src = this.memory.read8(this.r16[BC]);', dst: 'this.memory.write8(this.r16[BC], src);' },
    '(DE)': { type: 8, src: 'let src = this.memory.read8(this.r16[DE]);', dst: 'this.memory.write8(this.r16[DE], src);' },
    '(HL)': { type: 8, src: 'let src = this.memory.read8(this.r16[HL]);', dst: 'this.memory.write8(this.r16[HL], src);' },
    'HL\'': { type: 16, src: 'let src = this.r16s[HL];', dst: 'this.r16s[HL] = src;' },
    'IXh': { type: 8, src: 'let src = this.r8[IXh];', dst: 'this.r8[IXh] = src;' },
    'IXl': { type: 8, src: 'let src = this.r8[IXl];', dst: 'this.r8[IXl] = src;' },
    'IX': { type: 16, src: 'let src = this.r16[IX];', dst: 'this.r16[IX] = src;' },
    'IY': { type: 16, src: 'let src = this.r16[IY];', dst: 'this.r16[IY] = src;' },
    '(IX+o)': { type: 24, src: 'let src = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, src);' },
    '(IY+o)': { type: 24, src: 'let src = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, src);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': { type: 8, src: 'let src = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(nn)': { type: 24, src: nn_read_ind, dst: nn_write_ind8, dst16: nn_write_ind16 }
};

const rLookup = { 0: 'B', 1: 'C', 2: 'D', 3: 'E', 4: 'H', 5: 'L', 7: 'A' };


function generateLDOpcode(r, dst, src, opcode) {
    if (opcode[0] === 'ED') {
        emitCode(`this.addInstructionED(${opcode[1]}, () => {`);
    } else if (opcode[0] === 'CD') {
        emitCode(`this.addInstructionCD(${opcode[1]}, () => {`);
    } else if (opcode[0] === 'DD') {
        if (opcode[1] === 'CD') {
            emitCode(`this.addInstructionDDCD(${opcode[1]}, () => {`);
        } else {
            emitCode(`this.addInstructionDD(${opcode[1]}, () => {`);
        }
    } else if (opcode[0] === 'FD') {
        if (opcode[1] === 'CD') {
            emitCode(`this.addInstructionFDCD(${opcode[1]}, () => {`);
        } else {
            emitCode(`this.addInstructionFD(${opcode[1]}, () => {`);
        }
    } else {
        emitCode(`this.addInstruction(${opcode}, () => {`);
    }
    emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    emitCode(registersLD[src].src);
    if (registersLD[src].type == 16) {
        emitCode(registersLD[dst].dst16);
    } else {
        emitCode(registersLD[dst].dst);
    }
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitCode(`this.log(addr, '${r.Instruction}')`);
    emitCode(`});\n`);
}

function fillRInOpcode(opcode, r) {
    let regex = /(?<base>\w+)\+r/
    return opcode.map(o => {
        let match = regex.exec(o);
        if (match) {
            return `0x${(parseInt(match.groups['base'], 16) + parseInt(r)).toString(16)}`;
        }
        return `0x${o}`;
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
    let opcode = row.Opcode.replace(/n/g, '').trim().split(' ');
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