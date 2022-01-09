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

function emitFetchN() {
    emitCode(`let n = this.memory.uread8(this.r16[PC]++);`);
}

function emitFetchNN() {
    emitCode(`let nn = this.memory.uread8(this.r16[PC]++) | (this.memory.uread8(this.r16[PC]++) << 8);`);
}

function emitFetchIndirect8(reg) {
    emitCode(`let val2 = this.memory.uread8(this.r16[${reg}]);`);
}

function emitFetchIndirect16(reg) {
    emitCode(`let val2 = this.memory.uread16(this.r16[${reg}]);`);
}

function emitFetchDirect8(reg) {
    emitCode(`let val2 = this.r8[${reg}];`);
}

function emitFetchDirect16(reg) {
    emitCode(`let val2 = this.r16[${reg}];`);
}

let registerNames = ['A', 'F', 'B', 'C', 'D', 'E', 'H', 'L', 'AF', 'BC', 'DE', 'HL', 'HL\'', 'IXh', 'IXl', 'IX+o', 'IY+o'];
let aliases = ['n', 'nn', 'p', 'q'];


fs.createReadStream('Opcodes.csv')
    .pipe(csv({ separator: ';' }))
    .on('data', (data) => results.push(data))
    .on('end', () => {
        results.filter(r => r.Instruction.indexOf('LD') == 0).forEach(r => {
            //console.log(r);
            let match = mnemonic.exec(r.Instruction);
            if (!match) {
                throw new Error('No match for ' + JSON.stringify(r));
            } else {
                emitComment(r.Instruction);

                if (match.groups['operand2']) {
                    let operand2 = match.groups['operand2'];
                    let indirectMatch = indirect.exec(operand2)
                    if (indirectMatch) {
                        let reg = indirectMatch.groups['reg'];
                        if (reg === 'n') {
                            emitFetchN();
                        } else if (reg === 'nn') {
                            emitFetchNN();
                        }

                        if (reg.length == 1) {
                            emitFetchIndirect8(reg);
                        } else {
                            emitFetchIndirect16(reg);
                        }
                    } else {
                        if (operand2 === 'n') {
                            emitFetchN();
                        } else if (operand2 === 'nn') {
                            emitFetchNN();
                        } else if (operand2.length == 1) {
                            emitFetchDirect8(operand2);
                        } else {
                            emitFetchDirect16(operand2);
                        }
                    }
                }

                if (match.groups['operand1']) {
                    let operand1 = match.groups['operand1'];
                    let indirectMatch = indirect.exec(operand1)
                    if (indirectMatch) {
                        let reg = indirectMatch.groups['reg'];
                        if (reg === 'n') {
                            emitFetchN();
                        } else if (reg === 'nn') {
                            emitFetchNN();
                        }

                        if (reg.length == 1) {
                            emitFetchIndirect8(reg);
                        } else {
                            emitFetchIndirect16(reg);
                        }
                    } else {
                        if (operand2 === 'n') {
                            emitFetchN();
                        } else if (operand2 === 'nn') {
                            emitFetchNN();
                        } else if (operand2.length == 1) {
                            emitFetchDirect8(operand2);
                        } else {
                            emitFetchDirect16(operand2);
                        }
                    }
                }

                // this.add(this.r16[HL], this.r16[SP]);
            }
        });

        emitComment('// End');
    });