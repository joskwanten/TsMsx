import { TMS9918 } from './TMS9918';
import { SubSlotSelector } from './SubSlotSelector';
import { Rom } from './Rom';
import { IO } from './IO';
import { Logger, Registers } from './Logger';
import { PC, Z80 } from './z80_generated';
import { Slots } from './Slots';
import { EmptySlot } from './EmptySlot';
import { Ram } from './Ram';
import { PPI } from './PPI';


function changeBackground(c: number) {
    let element: any = document.querySelector('.backdrop');
    if (element) {
        let color = ('#000000' + (c >>> 8).toString(16)).slice(-6);
        element.style.backgroundColor = color;
        console.log(color);
    }
}
let z80: Z80 | null = null;
let vdp = new TMS9918(() => z80?.interrupt(), changeBackground);
let ppi = new PPI();
let debugBuffer = '';

function wait(ms: number) {
    return new Promise<void>((res, rej) => setTimeout(() => res(), ms));
}

async function reset() {
    // let response = await fetch('cbios_main_msx1.rom');
    let response = await fetch('MSX1.ROM');
    let buffer = await response.arrayBuffer();
    let bios = new Uint8Array(buffer);
    let biosMemory = new Uint8Array(0x10000);
    bios.forEach((b, i) => biosMemory[i] = b);

    response = await fetch('PIPPOLS.ROM');
    buffer = await response.arrayBuffer();
    let game  = new Uint8Array(buffer);
    let gameMemory = new Uint8Array(0x10000);
    gameMemory.forEach((b, i) => gameMemory[i] = game[i % game.length]);

    let slot0 = new Rom(biosMemory);
    // let slot1 = new EmptySlot();
    let slot1 = new Rom(gameMemory);
    let slot2 = new EmptySlot();
    let slot3 = new SubSlotSelector([new EmptySlot(), new EmptySlot(), new Ram(), new EmptySlot()]);
    let slots = new Slots([slot0, slot1, slot2, slot3]);

    let buf = "";
    class IoBus implements IO {
        read8(address: number): number {
            switch (address) {
                case 0x98:
                    return vdp.read(false);
                case 0x99:
                    return vdp.read(true);
                case 0xa8:
                    return slots.getSlotSelector();
                case 0xa9:
                    return ppi.readA9();
                default:
                    //console.log(`Port read not implemented ${address.toString(16)}`);
                    return 0xff;
            }
        }
        write8(address: number, value: number): void {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    break;
                case 0x99:
                    //console.log(`vdp write 0x${value.toString(16)}`);
                    vdp.write(true, value);
                    break;
                case 0xa8:
                    slots.setSlotSelector(value);
                    break;
                case 0xa9:
                    break;
                case 0xaa:
                    ppi.writeAA(value);
                    break;
                case 0x7d:
                    console.debug("Check program counter");
                    break;
                case 0x20:
                    throw new Error('Invalid')
                case 0x2e:
                case 0x2f:
                    //console.log(`Debug info ${address.toString(16)}, ${value}, ${String.fromCharCode(value)}`)
                    if (value == 0) {
                        console.log(debugBuffer);
                    } else {
                        debugBuffer += String.fromCharCode(value);
                    }
                default:
                    //console.log(`Port write not implemented ${address.toString(16)}`);
                    break;
            }
        }
    }

    class ConsoleLogger implements Logger {
        debug(str: string, registers: Registers): void {
            console.log(str);
        }

    }

    let io = new IoBus();
    z80 = new Z80(slots, io, new ConsoleLogger());
}

async function run() {
    setInterval(() => {
        if (z80) {
            let lastCycles = z80.cycles;
            while ((z80.cycles - lastCycles) < 60000) {
                z80.executeSingleInstruction();
            }

            vdp.checkAndGenerateInterrupt(Date.now());
        }
    }, 17);
}

reset().then(() => {
    run();
});

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
    }
}
