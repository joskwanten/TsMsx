

export class PPI {
// The PPI handles also the slot seletion, but in this emulator this is directly handled by the 
// Slot selector.
// Thi PPI handles keyboard handling and TBD.
    
    // Read keyboard matrix
    readA9() {
        return 0;
    }

    writeAA(val: number) {
        
    }

    writeAB(val: number) {

    }
}