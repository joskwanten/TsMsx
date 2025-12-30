class SCC_Processor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.scc = new Int8Array(0xff);
    this.scc_u = new Uint8Array(this.scc.buffer);
    this.phase = new Uint32Array(5);
    this.step = new Uint32Array(5);
    this.port.onmessage = (event) => {
      if (event.data && Array.isArray(event.data) && event.data.length === 2) {
        this.scc[event.data[0]] = event.data[1];
        const addr = event.data[0];
        if (addr >= 0x80 && addr <= 0x89) {
          const chan = Math.floor((addr - 0x80) / 2);
          this.phase[chan] = 0;
          this.step[chan] = this.computeStep(chan);
        }
      }
    };
  }

  computeStep(chan) {
    let t =
      this.scc_u[0x80 + 2 * chan] +
      ((this.scc_u[0x80 + 2 * chan + 1] & 0xf) << 8);
    let f = 3579545 / (32 * (t + 1));
    return (((32 * f) / sampleRate) * (1 << 27)) >>> 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (output.length > 0) {
      const outputChannel0 = output[0];
      for (let i = 0; i < outputChannel0.length; i++) {
        let val = 0;
        for (let chan = 0; chan < 5; chan++) {
          this.phase[chan] += this.step[chan];
          let pos = this.phase[chan] >>> 27;
          let wave = this.getWave(chan > 3 ? 3 : chan, pos) / 128;
          let vol = this.getVolume(chan) / 15;
          val += wave * vol;
        }

        val /= 5;

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
