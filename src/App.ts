import { TMS9918 } from './TMS9918';
import { SubSlotSelector } from './SubSlotSelector';
import { Rom } from './Rom';
import { IO } from './IO';
import { Logger, Registers } from './Logger';
import { Z80 } from './Z80';
import { Slots } from './Slots';
import { EmptySlot } from './EmptySlot';
import { Ram } from './Ram';

/*
"11 0A 00 1B 7A B3 C2 03 00"
0000   11 0A 00               LD   de,10   
0003                LOOP:     
0003                          ; ... do something here
0003   1B                     DEC   de   
0004   7A                     LD   a,d   
0005   B3                     OR   e   
0006   C2 03 00               JP   nz,Loop   
*/

/*
"06 0A 16 03 10 FE 15 C2 04 00"
0000   06 0A                  LD   b,10   ; The LSB of the loop is 10
0002   16 03                  LD   d,3   ; The MSB of the loop + the first loop is 3
0004                LOOP:     
0004                          ; ... do something here
0004   10 FE                  DJNZ   Loop   
0006   15                     DEC   d   
0007   C2 04 00               JP   nz,Loop   
*/

/*
0000   3E C8                  LD   a,200   
0002   06 96                  LD   b,150   
0004   80                     ADD   a,b   ;200+150=350
0005                          ; way too big
0005                          ; to store in
0005                          ; 8 bit register
0005                          ;max it can hold
0005                          ; is 255
0005                          ;carry set!
0005   3E 04                  LD   a,4   
0007   06 05                  LD   b,5   
0009   88                     ADC   a,b   ;4+5=9
000A                          ;carry is set
000A                          ; so 9+1=10
000A                          ;10 is stored in
000A                          ; a
000A   3E 05                  LD   a,5   ;one operand
000C   06 04                  LD   b,4   ;second operand
000E   90                     SUB   b   ;a-b=5-4=1
000F                          ;1 stored in a
000F   3E 04                  LD   a,4   ;one operand
0011   06 05                  LD   b,5   ;second operand
0013   90                     SUB   b   ;a-b=4-5=-1=255
*/

/*
0000   11 0A 00               LD   DE,10   
0003   3E 06                  LD   A,6   
0005   CD 09 00               CALL   DE_Times_A   
0008   76                     HALT   
0009                DE_TIMES_A:   
0009                          ;Inputs:
0009                          ;     DE and A are factors
0009                          ;Outputs:
0009                          ;     A is not changed
0009                          ;     B is 0
0009                          ;     C is not changed
0009                          ;     DE is not changed
0009                          ;     HL is the product
0009                          ;Time:
0009                          ;     342+6x
0009                          ; 
0009   06 08                  LD   b,8   ;7           7
000B   21 00 00               LD   hl,0   ;10         10
000E   29                     ADD   hl,hl   ;11*8       88
000F   07                     RLCA   ;4*8        32
0010   30 01                  JR   nc,$+3   ;(12|18)*8  96+6x
0012   19                     ADD   hl,de   ;--         --
0013   10 F9                  DJNZ   $-5   ;13*7+8     99
0015   C9                     RET   ;10         10
*/

// code.split(':').map(c => c.replace(/[\n\r]+/g, '')).filter(c => c !== "").forEach(c => {    
//     let length = Number.parseInt(c.substr(0, 2), 16);
//     let address = Number.parseInt(c.substr(2, 4), 16);
//     let recordType = Number.parseInt(c.substr(6, 2), 16);
//     let data = c.substr(8);

//     if (recordType === 0) {
//         for(let i = 0; i < length; i++) {
//             let byte = data.substr(2 * i, 2);
//             memory.uwrite8(address + i, Number.parseInt(byte, 16));

//             console.log(`Written ${address.toString(16)} ${memory.uread8(address + i).toString(16)}`);
//         }
//     }

//     console.log(`${length} ${address} ${recordType} ${data}`);
// })


/* 
 "11 0A 00 1B 3E 41 D3 FF 7A B3 C2 03 00 3E 0A D3 FF"
    LD   de,10   
loop:
    DEC  de
    LD   a, 65
    OUT  255,a
    
    LD   a,d   
    OR   e   
    JP   nz,Loop
    LD   a,10
    OUT  255,a
*/

/*
"21 14 00 CD 07 00 76 7E A7 C8 CD 11 00 23 18 F7 C9 D3 FF C9 48 65 6C 6C 6F 20 77 6F 72 6C 64 21"
; Program code entry point
Execute:
    ld	hl,Hello_TXT	; Load the address from the label Hello_TXT into HL.
    call	Print		; Call the routine Print below.
    halt			; Back to MSX-BASIC environment.
 
Print:
    ld	a,(hl)		; Load the byte from memory at address indicated by HL into A.
    and	a		; Same as CP 0 but faster.
    ret	z		; Back behind the call print if A = 0
    call	chput		; Call the routine to display a character.
    inc	hl		; Increment the HL value.
    jr	Print		; Relative jump to the address in the label Print.
    ret

chput:
    out 255, a
    ret
    
Hello_TXT:			; Set the current address into label Hello_TXT. (text pointer)
    db "Hello world!",10,0	; Zero indicates the end of text.
*/


// "21 14 00 CD 07 00 76 7E A7 C8 CD 11 00 23 18 F7 C9 D3 FF C9 48 65 6C 6C 6F 20 77 6F 72 6C 64 21 0A 00"
//     .split(" ")
//     .map(x => parseInt(x, 16))
//     .forEach((b,i) => { 
//         //console.log(i); 
//         memory.uwrite8(i, b);
//     });

function wait(ms: number) {
    return new Promise<void>((res, rej) => setTimeout(() => res(), ms));
}

let z80: Z80 | null = null;
let vdp = new TMS9918();

async function reset() {
    let response = await fetch('cbios_main_msx1.rom');
    let buffer = await response.arrayBuffer();
    let bios = new Uint8Array(buffer);
    let romMemory = new Uint8Array(0x10000);
    bios.forEach((b, i) => romMemory[i] = b);
    let slot0 = new Rom(romMemory);
    let slot1 = new EmptySlot();
    let slot2 = new EmptySlot();
    let slot3 = new SubSlotSelector([new EmptySlot(), new EmptySlot(), new Ram(), new EmptySlot()]);
    let slots = new Slots([slot0, slot1, slot2, slot3]);
    
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
                case 0xa8:
                    return slots.getSlotSelector();
                default:
                    console.log(`Port read not implemented ${address.toString(16)}`);
                    return 0xff;
            }
        }
        write8(address: number, value: number): void {
            switch (address) {
                case 0x98:
                    vdp.write(false, value);
                    console.count("vdp write");
                    break;
                case 0x99:
                    vdp.write(true, value);
                    break;
                case 0xa8:
                    slots.setSlotSelector(value);
                    break;
                default:
                    console.log(`Port write not implemented ${address.toString(16)}`);
                    break;
            }
        }
    }

    let io = new IoBus();



    let logger = new ScreenLogger();

    z80 = new Z80(slots, io, logger);

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
    }

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
            step(100, false);
            await wait(10);
            if (!running) {
                return;
            }
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
        z80?.executeUntil(0x0dc9); // 0x280 ret verder onderzoeken

        //
    });
}
