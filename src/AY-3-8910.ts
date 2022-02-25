const dac_table_dc = [
    1.147, 1.162, 1.169, 1.178, 
    1.192, 1.213, 1.238, 1.299,
    1.336, 1.457, 1.573, 1.707,
    1.882, 2.060, 2.320, 2.580
]

const dac_table = [
     0.000, 0.010, 0.015, 0.021, 
     0.031, 0.045, 0.063, 0.105, 
     0.131, 0.216, 0.297, 0.390,
     0.512, 0.637, 0.818, 1.000,
]

export class AY_3_8910 {
    left: number;
    right: number;

    registers = new Uint8Array(18);

    constructor(private clock: number, private sampleRate: number) {
       this.left = 0;
       this.right = 0;
    }

    getTempo(chan: number) {
        return this.registers[2 * chan] + ((this.registers[2 * chan + 1] & 0xf) << 8);
    }

    getFrequency(chan: number): number {
        return 3579545 / (32 * (this.getTempo(chan) + 1));
    }

    getVolume(chan: number) {
        // Check if mute flag is set
        if (this.registers[chan + 10] & 0x10) {
            return 0;
        }

        return dac_table[this.registers[chan + 10] & 0xf];
    }

    process(): void {
        
    }

    setRegister(register: number, value: number) {
        this.registers[register] = value;
    }
}