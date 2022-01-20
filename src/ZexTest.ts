import { TMS9918 } from './TMS9918';
import { SubSlotSelector } from './SubSlotSelector';
import { Rom } from './Rom';
import { IO } from './IO';
import { Logger, Registers } from './Logger';
import { Z80, C, E, DE, PC, SP, A } from './z80_generated';
import { Slots } from './Slots';
import { EmptySlot } from './EmptySlot';
import { Ram } from './Ram';


function wait(ms: number) {
    return new Promise<void>((res, rej) => setTimeout(() => res(), ms));
}

let z80: Z80 | null = null;
let vdp = new TMS9918(() => z80?.interrupt());

async function reset() {
    let response = await fetch('testfiles/z80doc.bin');
    let buffer = await response.arrayBuffer();
    let zexdoc = new Uint8Array(buffer);

    // This position is read by Zexall to set the stack pointer (SP)    
    let mem = new Ram();
    let romMemory = new Uint8Array(0x10000);
    zexdoc.forEach((b, i) => mem.uwrite8(i + 0x8000, b));
    // mem.uwrite8(0x006, 0x00);
    // mem.uwrite8(0x007, 0xf3);

    //     let response = await fetch('testfiles/zexdoc.com');
    // let buffer = await response.arrayBuffer();
    // let zexdoc = new Uint8Array(buffer);

    // // This position is read by Zexall to set the stack pointer (SP)    
    // let mem = new Ram();
    // let romMemory = new Uint8Array(0x10000);
    // zexdoc.forEach((b, i) => mem.uwrite8(i + 0x0100, b));
    // mem.uwrite8(0x006, 0x00);
    // mem.uwrite8(0x007, 0xf3);

    class ScreenLogger implements Logger {
        debug(str: string, registers: Registers): void {
            let div = document.createElement('div');
            div.classList.add('log-line');

            let logtext = document.createElement('div');
            logtext.classList.add('mnemonic');
            logtext.innerText = str;
            div.appendChild(logtext);

            let indexes = ['AF', 'BC', 'DE', 'HL', 'SP', '_BC', '_DE', '_HL'];
            indexes.forEach(i => {
                let d = document.createElement('div');
                d.classList.add('register');
                d.innerText = `${i}=${('0000' + registers[i].toString(16)).slice(-4)}`;
                div.appendChild(d);
            });

            let logger = document.querySelector('#logger');
            if (logger) {
                let maxLines = 1000;
                let numOfRowsTooMany = logger.children.length - maxLines;
                for (let i = 0; i < numOfRowsTooMany; i++) {
                    logger.removeChild(logger.children[i]);
                }
                logger.appendChild(div);
                logger.scrollTop = logger.scrollHeight;
            }
        }
    }

    class IoBus implements IO {
        read8(address: number): number {
            switch (address) {
                case 0x98:
                    return vdp.read(false);
                case 0x99:
                    return vdp.read(true);
                default:
                    console.log(`Port read not implemented ${address.toString(16)}`);
                    return 0xff;
            }
        }
        write8(address: number, value: number): void {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    //console.count("vdp write");
                    break;
                case 0x99:
                    vdp.write(true, value);
                    break;
                case 0x7d:
                    console.debug("Check program counter");
                    break;
                case 0x20:
                    throw new Error('Invalid')
                case 0x2e:
                case 0x2f:
                    console.log(`Debug info ${address.toString(16)}, ${value}, ${String.fromCharCode(value)}`)
                default:
                    //console.log(`Port write not implemented ${address.toString(16)}`);
                    break;
            }
        }
    }

    let io = new IoBus();



    let logger = new ScreenLogger();

    z80 = new Z80(mem, io, logger);

    z80.registerSystemCall(0x0005, (cpu: Z80) => {
        if (cpu.r8[C] == 2) {
            console.log(cpu.r8[E]);
        } else if (cpu.r8[C] == 9) {
            let str = "";
            let i = 0, c;
            let mem = cpu.memory.uread8(i);
            for (i = cpu.r16[DE], c = 0; mem != '$'.charCodeAt(0); i++) {
                mem = cpu.memory.uread8(i & 0xffff);
                str += String.fromCharCode(mem);
                if (c++ > 256) {
                    console.error("String to print is too long!\n");
                    break;
                }
            }

            console.log(str);
        }
    });

    let printedChars = '';
    z80.registerSystemCall(0x0010, (cpu: Z80) => {
        if (cpu.r8[A] != 13) {
            printedChars += String.fromCharCode(cpu.r8[A]);
        } else {
            console.log(printedChars);
            printedChars = '';
        }
    });

    z80.r16[PC] = 0x8000;
    z80.r16[SP] = 0xf300;
    // Put a RET on 0x1601 which will be called for ROM_CHAN_OPEN (ZX Spectrum)
    z80.memory.uwrite8(0x1601, 0xc9);
    //while(1) {
    //}
}

reset().then(() => {
    console.log(z80);
});

let running = false;

function step(numOfSteps: number, log = true) {
    z80?.execute(numOfSteps, log);
}

window.onload = () => {
    // const canvas = <HTMLCanvasElement>document.getElementById('screen');
    // const ctx = canvas.getContext('2d');
    // const imageData = ctx?.createImageData(256, 192);
    // if (imageData) {
    //     // Iterate through every pixel
    //     for (let i = 0; i < imageData.data.length; i += 4) {
    //         // Percentage in the x direction, times 255
    //         let x = (i % 1024) / 1024 * 255;
    //         // Percentage in the y direction, times 255
    //         let y = Math.ceil(i / 1024) / 1024 * 255;

    //         // Modify pixel data
    //         imageData.data[i + 0] = x;        // R value
    //         imageData.data[i + 1] = y;        // G value
    //         imageData.data[i + 2] = 255 - x;  // B value
    //         imageData.data[i + 3] = 255;      // A value
    //     }

    //     // Draw image data to the canvas
    //     ctx?.putImageData(imageData, 0, 0);
    // }

    document.querySelector('#reset')?.addEventListener('click', () => {
        reset();
    });

    document.querySelector('#step1')?.addEventListener('click', () => {
        step(1);
    });

    document.querySelector('#step10')?.addEventListener('click', () => {
        step(10);
    });

    document.querySelector('#step100')?.addEventListener('click', () => {
        step(100);
    });

    document.querySelector('#run')?.addEventListener('click', async () => {
        running = true;
        while (running) {
            step(1000000, false);
            await wait(1);
            if (!running) {
                return;
            }

            vdp.checkAndGenerateInterrupt(Date.now());
        }
    });

    document.querySelector('#stop')?.addEventListener('click', async () => {
        running = false;
    });

    document.querySelector('#runBreak')?.addEventListener('click', async () => {
        // 0x0d86 - Just before User Interface
        // 0x0d91 - Call to init_vdp
        // 0x0d94 - Returned from init_vdp (Hangs now)
        // 0x074d - init_vdp
        // 0x026d - init_vdp -> filvrm
        // 0x0280 - ret filvrm
        // 0x0260 - setwrt
        // 0x07a3 - call 0x0297 (ldirvm)
        // 0x0d94 - call 0x114e (initio)
        // 0x0da6 - call 0x23bf (rdslt)
        // 0x0daf - just before some ix commands (logo_none:)
        // 0x0dc9 - CALL 03c2 (init32)
        z80?.executeUntil(0x8259); // 0x280 ret verder onderzoeken

        //
    });
}
