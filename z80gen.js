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

let nn_write_ind16 = `
    let nn = this.memory.uread16(this.r16[PC]);
    this.r16[PC] += 2;
    this.memory.uwrite8(nn, src);
`;

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
    '(BC)': { type: 16, src: 'let src = this.memory.read8(this.r16[BC]);', dst: 'this.memory.write8(this.r16[BC], src);' },
    '(DE)': { type: 16, src: 'let src = this.memory.read8(this.r16[DE]);', dst: 'this.memory.write8(this.r16[DE], src);' },
    '(HL)': { type: 16, src: 'let src = this.memory.read8(this.r16[HL]);', dst: 'this.memory.write8(this.r16[HL], src);' },
    'HL\'': { type: 16, src: 'let src = this.r16s[HL];', dst: 'this.r16s[HL] = src;' },
    'IXh': { type: 16, src: 'let src = this.r8[IXh];', dst: 'this.r8[IXh] = src;' },
    'IXl': { type: 16, src: 'let src = this.r8[IXl];', dst: 'this.r8[IXl] = src;' },
    '(IX+o)': { type: 24, src: 'let src = this.memory.uread8(this.r16[IX] + o);', dst: 'this.memory.uwrite8(this.r16[IX] + o, src);' },
    '(IY+o)': { type: 24, src: 'let src = this.memory.uread8(this.r16[IY] + o)', dst: 'this.memory.uwrite8(this.r16[IY] + o, src);' },
    'nn': { type: 24, src: nn_read, dst: undefined },
    'n': {type: 8, src: 'let src = this.memory.uread8(this.r16[PC]++);', dst: undefined },
    '(nn)': { type: 24, src: nn_read_ind, dst8: nn_write_ind8, dst16: nn_write_ind16 }

};

function generateLD(r) {
    //console.log(r);
    let match = mnemonic.exec(r.Instruction);
    if (!match) {
        throw new Error('No match for ' + JSON.stringify(r));
    }

    emitComment(`${r.Instruction} Opcode: ${r.Opcode}`);
    let src = match.groups["operand2"];
    let dst = match.groups["operand"];
    emitCode(registersLD[src].src);
    emitCode(registersLD[dst].dst);
    emitCode(`this.cycles += ${r.TimingZ80};`);
    emitComment('END\n\n');

}

fs.createReadStream('Opcodes.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
        results.filter(r => r.Instruction.indexOf('LD') == 0).forEach(r => {
            generateLD(r);
        })
    });    