import { TMS9918 } from './TMS9918';
import { SubSlotSelector } from './SubSlotSelector';
import { Rom } from './Rom';
import { IO } from './IO';
import { Logger, Registers } from './Logger';
import { PC, Z80 } from './z80_generated';
import { Slots } from './Slots';
import { EmptySlot } from './EmptySlot';
import { Ram } from './Ram';


function changeBackground(c: number) {
    let element : any = document.querySelector('.backdrop');
    if (element) {
        element.style.backgroundColor = `#${c.toString(16).slice(0,6)}`;
    }
}
let z80: Z80 | null = null;
let vdp = new TMS9918(() => z80?.interrupt(), changeBackground);
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

    // response = await fetch('SCOBRA.ROM');
    // buffer = await response.arrayBuffer();
    // let game  = new Uint8Array(buffer);
    // let gameMemory = new Uint8Array(0x10000);
    // game.forEach((b, i) => gameMemory[i] = b);

    let slot0 = new Rom(biosMemory);
    let slot1 = new EmptySlot();
    //let slot1 = new Rom(gameMemory);
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
    if (!z80) {
        return;
    }

    while (true) {
        let lastCycles = z80.cycles;
        let timestamp = Date.now();
        while((z80.cycles - lastCycles) < 60000 && !z80.halted) {
            z80.executeSingleInstruction();

            if (z80.r16[PC] === 0xe0d) {
                console.log("BREAK");
            }
        }

        let timeLeft = 16.67 - (Date.now() - timestamp);
        if (timeLeft > 0) {
            // console.log(`Left ${timeLeft}`)
            await wait(timeLeft);
        }

        vdp.checkAndGenerateInterrupt(Date.now());
    }
}

reset().then(() => {
    console.log(z80);
    run();
});

window.onload = () => {
    const canvas = <HTMLCanvasElement>document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const imageData = ctx?.createImageData(256, 192);
    if (imageData) {
        // Iterate through every pixel
        for (let i = 0; i < imageData.data.length; i += 4) {
            // Percentage in the x direction, times 255
            let x = (i % 1024) / 1024 * 255;
            // Percentage in the y direction, times 255
            let y = Math.ceil(i / 1024) / 1024 * 255;

            // Modify pixel data
            imageData.data[i + 0] = x;        // R value
            imageData.data[i + 1] = y;        // G value
            imageData.data[i + 2] = 255 - x;  // B value
            imageData.data[i + 3] = 255;      // A value
        }

        // Draw image data to the canvas
        ctx?.putImageData(imageData, 0, 0);

        let renderRoutine = () => {
            // Do rendering
            vdp.render(imageData.data);
            ctx?.putImageData(imageData, 0, 0);
            requestAnimationFrame(renderRoutine);
        };
        
        window.requestAnimationFrame(() => {
            renderRoutine();
        });        
    }
}
