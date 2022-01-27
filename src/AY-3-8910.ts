const noiseGeneratorFrequency = 111861;
const ChanA = 0;
const ChanB = 1;
const ChanC = 2;

export class AY_3_8910 implements SoundDevice{
    selected = 0;
    psg = new Uint8Array(16);
    time = 0; // Counts 44100 per second
    
    selectRegister(value: number) {
        this.selected = Math.floor(value) % 16;
    }
    
    read() {
        return this.psg[this.selected];
    }

    write(value: number) {
        this.psg[this.selected] = value;
    }

    getTempo(chan: number) {
        return this.psg[(2 * chan)] + ((this.psg[(2 * chan) + 1] & 0xf) << 8);
    }

    getFrequency(chan: number): number {
        return 3579545 / (32 * (this.getTempo(chan) + 1));
    }

    getNoiseFrequency(): number {
        return this.psg[6] & 0x1f;
    }

    getVolume(chan: number): number {
        if (this.psg[8 + chan] & 0x10) {
            // Controlled by the envelope
            return 0;
        } else {
            return (this.psg[8] & 0xf) / 15;
        }
    }

    getToneEnabled(chan: number) {
        if (this.psg[7] & (1 << chan)) {
            return true;
        }

        return false;
    }

    getNoiseEnabled(chan: number) {
        if (this.psg[7] & (3 << chan)) {
            return true;
        }

        return false;
    }

    process() {
        let val = 0;
        for (let chan = 0; chan < 3; chan++) {
            let f = this.getFrequency(chan);
            let step = (2 * f) / 44100;
            let pos = (Math.floor(step * this.time)) % 2;
            val +=  pos ? 0 : this.getVolume(chan);
        }

        this.time++;
        return val / 5;
    }

}