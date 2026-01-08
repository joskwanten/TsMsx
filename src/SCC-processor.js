class SCC_Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.scc = new Int8Array(0xff);
    this.scc_u = new Uint8Array(this.scc.buffer);
    this.phase = new Uint32Array(15);
    this.detuneScales = new Float32Array([0.9999, 1.0, 1.0001]);
    this.step = new Uint32Array(15);
    this.port.onmessage = (event) => {
      if (event.data && Array.isArray(event.data) && event.data.length === 2) {
        this.scc[event.data[0]] = event.data[1];
        const addr = event.data[0];
        if (addr >= 0x80 && addr <= 0x89) {
          const chan = Math.floor((addr - 0x80) / 2);
          for(let osc = 0; osc < 3; osc++) {
            this.phase[(3 * chan) + osc] = 0;
            this.step[(3 * chan) + osc] = this.computeStep(chan, this.detuneScales[osc]);
          }
        }
      }
    };
  }

  computeStep(chan, detune) {
    let t =
      this.scc_u[0x80 + 2 * chan] +
      ((this.scc_u[0x80 + 2 * chan + 1] & 0xf) << 8);
    let f = (detune * 3579545) / (32 * (t + 1));
    return (((32 * f) / sampleRate) * (1 << 27)) >>> 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (output.length > 0) {
      const outputChannel0 = output[0];
      for (let i = 0; i < outputChannel0.length; i++) {
        let val = 0;
        for (let osc = 0; osc < 3; osc++) {
          for (let chan = 0; chan < 5; chan++) {
            this.phase[(3 * chan) + osc] += this.step[(3 * chan) + osc];
            let pos = this.phase[(3 * chan) + osc] >>> 27;
            let wave = this.getWave(chan > 3 ? 3 : chan, pos);
            let vol = this.getVolume(chan);
            val += wave * vol;
          }
        }

        val /= (3 * 9600); // Normalize beteen -1 and 1 -> -128..127 (sample) * 5 (channel) * 15 (volume)

        outputChannel0[i] = val;
        if (output.length > 1) {
          output[1][i] = val;
        }
      }
    }

    return true; // Keep the processor alive
  }

  getVolume(chan) {
    if (this.scc_u[0x8f] & (1 << chan)) {
      return this.scc[0x8a + chan] & 0xf;
    }
    return 0;
  }

  getWave(chan, pos) {
    return this.scc[0x20 * chan + (pos % 32)];
  }
}

// Register the processor
registerProcessor("SCC-processor", SCC_Processor);
