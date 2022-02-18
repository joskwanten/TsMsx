import { TMS9918 } from './TMS9918.js';
import { SubSlotSelector } from './SubSlotSelector.js';
import { Rom } from './Rom.js';
import { IO } from './IO.js';
import * as Z80 from './Z80.js';
import { Slots } from './Slots.js';
import { EmptySlot } from './EmptySlot.js';
import { Ram } from './Ram.js';
import { PPI } from './PPI.js';
import { KonamiMegaRomSCC } from './KonamiMegaRomSCC.js';
import { AY_3_8910 } from './AY-3-8910.js';


function changeBackground(c: number) {
    let element: any = document.querySelector('.backdrop');
    if (element) {
        let color = ('#000000' + (c >>> 8).toString(16)).slice(-6);
        element.style.backgroundColor = color;
    }
}

const Hz = 60;
const MHz = 3.56;
const CyclesPerInterrupt = (MHz * 1000000) / Hz;
const loopTime = 1000 / Hz;

let z80: any = null;
let vdp = new TMS9918(() => z80?.interrupt(), changeBackground);
let ppi = new PPI();
let ay3 = new AY_3_8910();


ay3.configure(false, (MHz * 1000000) / 2, 44100);
ay3.setPan(0, 0.5, false);
ay3.setPan(1, 0.5, false);
ay3.setPan(2, 0.5, false);


let scc: SoundDevice;

let fillSoundBuffer = function (e: any) {
    var left = e.outputBuffer.getChannelData(0);
    var right = e.outputBuffer.getChannelData(1);
    for (var i = 0; i < left.length; i++) {
        //left[i] = right[i] = psg.process();
        ay3.process();
        ay3.removeDC();
        left[i] = ay3.left / 3;
        right[i] = ay3.right / 3;

        if (scc) {
            let val = scc.process();
            left[i] += .5 * val;
            right[i] += .5 * val;

            left[i] /= 2;
            right[i] /= 2;

        }
    }

    return true;
}

async function reset() {
    // let response = await fetch('cbios_main_msx1.rom');
    let response = await fetch('system/MSX1.ROM');
    let buffer = await response.arrayBuffer();
    let bios = new Uint8Array(buffer);
    let biosMemory = new Uint8Array(0x10000);
    bios.forEach((b, i) => biosMemory[i] = b);

    response = await fetch('system/cbios_logo_msx1.rom');
    buffer = await response.arrayBuffer();
    let logo = new Uint8Array(buffer);
    logo.forEach((b, i) => biosMemory[i + 0x8000] = b);

    const queryString = window.location.search.replace(/\?/, '');

    // http://localhost:3000/index.html?slot0=msx1.rom@0,msx1.logo@0x8000&slot1=TEST.ROM

    let slot1;
    if (queryString) {
        console.log(queryString);
        response = await fetch(queryString);
        buffer = await response.arrayBuffer();
        let game = new Uint8Array(buffer);
        if (buffer.byteLength > 0x8000) {
            slot1 = new KonamiMegaRomSCC(game, 44100);
            scc = slot1;
        } else {
            let gameMemory = new Uint8Array(0x10000);
            gameMemory.forEach((b, i) => gameMemory[i] = 0);
            game.forEach((g, i) => gameMemory[i + 0x4000] = g);
            slot1 = new Rom(gameMemory);
        }
    }

    // Define the MSX slots and sub-slots (slot 3)
    let slot0 = new Rom(biosMemory);
    slot1 = slot1 ? slot1 : new EmptySlot();
    let slot2 = new EmptySlot();
    let slot3 = new SubSlotSelector([new EmptySlot(), new EmptySlot(), new Ram(), new EmptySlot()]);
    let slots = new Slots([slot0, slot1, slot2, slot3]);

    class IoBus implements IO {
        psgRegister = 0;
        psgRegisters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        read8(address: number): number {
            switch (address) {
                case 0x98:
                    return vdp.read(false);
                case 0x99:
                    return vdp.read(true);
                case 0xa02:
                    return this.psgRegisters[this.psgRegister];
                case 0xa8:
                    return slots.getSlotSelector();
                case 0xa9:
                    return ppi.readA9();
                default:
                    return 0xff;
            }
        }

        write8(address: number, value: number): void {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    break;
                case 0x99:
                    vdp.write(true, value);
                    break;
                case 0xa0:
                    this.psgRegister = value;
                    break;
                case 0xa1:
                    this.psgRegisters[this.psgRegister] = value;
                    ay3.updateState(this.psgRegisters);
                    break;
                case 0xa8:
                    slots.setSlotSelector(value);
                    break;
                case 0xa9:
                    break;
                case 0xaa:
                    ppi.writeAA(value);
                    break;
                default:
                    break;
            }
        }
    }

    let io = new IoBus();

    // Wrapper object to use Z80.js
    let core = {
        mem_read: (address: number) => slots.uread8(address),
        mem_write: (address: number, value: number) => slots.uwrite8(address, value),
        io_read: (address: number) => io.read8(address & 0xff),
        io_write: (address: number, value: number) => io.write8(address & 0xff, value)

    }

    z80 = Z80.Z80(core);
    z80.reset();
}

async function run() {
    setInterval(() => {
        let cycles = 0;

        while (cycles < CyclesPerInterrupt) {
            cycles += z80.run_instruction();
        }

        vdp.checkAndGenerateInterrupt(Date.now());
    }, loopTime);
}

reset().then(() => {
    run();
});

window.onpopstate = function (event) {
    alert("location: " + document.location + ", state: " + JSON.stringify(event.state));
};

window.onload = () => {
    const canvas = <HTMLCanvasElement>document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const imageData = ctx?.createImageData(256, 192);
    if (imageData) {
        //const view = new DataView(imageData.data.buffer);
        document.onkeydown = (event) => {
            ppi.onKeydown(event.key);
        };

        document.onkeyup = (event) => {
            ppi.onKeyup(event.key);
        };

        let screenUpdateRoutine = () => {
            // Do rendering
            let vdpOutout = vdp.getImage();
            for (let i = 0; i < vdpOutout.length; i++) {
                imageData.data[4 * i + 0] = 0xff & (vdpOutout[i] >>> 24);
                imageData.data[4 * i + 1] = 0xff & (vdpOutout[i] >>> 16);
                imageData.data[4 * i + 2] = 0xff & (vdpOutout[i] >>> 8);
                imageData.data[4 * i + 3] = 0xff & vdpOutout[i];
                //view.setUint32(i, vdpOutout[i]); // light blue (#80d7ff)
            }
            //view.setUint32(1500, 0xff00ffff);
            ctx?.putImageData(imageData, 0, 0);
            requestAnimationFrame(screenUpdateRoutine);
        };

        //setInterval(screenUpdateRoutine, 20);

        window.requestAnimationFrame(screenUpdateRoutine);

        let soundButton = document.querySelector('#sound');
        soundButton?.addEventListener('click', async (e) => {
            var AudioContext = window.AudioContext;
            var audioContext = new AudioContext();

            var audioNode = audioContext.createScriptProcessor(512, 0, 2);
            audioNode.onaudioprocess = fillSoundBuffer;
            audioNode.connect(audioContext.destination);
            soundButton?.setAttribute("style", "display:none;");
        });

        let fullscreenButton = document.querySelector('#fullscreen');
        fullscreenButton?.addEventListener('click', async (e) => {
            let body = document.querySelector('body');
            body?.requestFullscreen();
            
        });

        let scale2xButton = document.querySelector('#scale2x');
        scale2xButton?.addEventListener('click', async (e) => {
            canvas?.setAttribute("style", "transform: scale(2);");
        });

        let scale3xButton = document.querySelector('#scale3x');
        scale3xButton?.addEventListener('click', async (e) => {
            canvas?.setAttribute("style", "transform: scale(3);");
        });

        let scale4xButton = document.querySelector('#scale4x');
        scale4xButton?.addEventListener('click', async (e) => {
            canvas?.setAttribute("style", "transform: scale(4);");
        });
    }
}

document.addEventListener('fullscreenchange', (event) => {
    let fullscreenButton = document.querySelector('#fullscreen');
    if (document.fullscreenElement) {
        fullscreenButton?.setAttribute("style", "display:none;");
    } else {
        fullscreenButton?.setAttribute("style", "display:unset;");
    }
});
