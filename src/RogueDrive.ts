/**
 * Constants for the RogueDrive protocol
 */
enum RogueCmd {
    NONE = 0x00,
    GET_VERSION = 0x01,
    RESET = 0x02,
    DEV_RD = 0x03,
    LUN_INFO = 0x06,
    LUN_CNT = 0x07,
    DEV_WR = 0x83
}

const STATUS_READY = 0x00;
const STATUS_BUSY = 0x01;
const STATUS_ERROR = 0x04;
const CMD_WRITE_MASK = 0x80;

export class RogueDrive {
    // Registers
    private status: number = STATUS_READY;
    private errorCode: number = 0;
    private lba: number = 0;
    private lbaByteIdx: number = 0;
    private numOfSectors: number = 0;
    private lun: number = 0;
    private deviceNumber: number = 0;
    private lba_byte_idx: number = 0;
    
    // Buffers
    private dataArea: Uint8Array = new Uint8Array(4096);
    private dataIndex: number = 0;
    
    // Disks (Static arrays provided in constructor)
    private disks: Uint8Array[];

    constructor(disks: Uint8Array[]) {
        this.disks = disks;
    }

    /**
     * Centralized IO Read handler
     * @param port The port address (0x60 - 0x64)
     */
    public io_read(port: number): number {
        switch (port) {
            case 0x60: // Status
                return this.status;
            case 0x63: // Error Code
                return this.errorCode;
            case 0x64: // Data Buffer
                if (this.dataIndex < 4096) {
                    return this.dataArea[this.dataIndex++];
                }
                return 0xFF;
            default:
                return 0x00;
        }
    }

    /**
     * Centralized IO Write handler
     * @param port The port address (0x60 - 0x64)
     * @param data The 8-bit value to write
     */
    public io_write(port: number, data: number): void {
        switch (port) {
            case 0x60: // Command
                this.status |= STATUS_BUSY;
                this.handleCommand(data);
                break;

            case 0x61: // Sector Count
                this.numOfSectors = data;
                this.lbaByteIdx = 0;
                this.dataIndex = 0;
                break;

            case 0x62: // LBA (4 consecutive writes)
                const shift = this.lbaByteIdx * 8;
                this.lba &= ~(0xFF << shift);
                this.lba |= (data << shift);
                this.lba_byte_idx = (this.lba_byte_idx + 1) & 0x03;
                break;

            case 0x63: // LUN / Device
                this.lun = (data & 0x0F) - 1;
                this.deviceNumber = (data >> 4) & 0x0F;
                break;

            case 0x64: // Data Buffer
                if (this.dataIndex < 4096) {
                    this.dataArea[this.dataIndex++] = data;
                }
                break;
        }
    }

    private handleCommand(rawCmd: number): void {
        const cmd = (rawCmd & 0x0F) as RogueCmd;
        const isWrite = (rawCmd & CMD_WRITE_MASK) !== 0;
        const totalBytes = this.numOfSectors * 512;

        // Validation
        if (this.numOfSectors > 8) {
            this.status = STATUS_ERROR;
            return;
        }

        switch (cmd) {
            case RogueCmd.DEV_RD:
            case RogueCmd.DEV_WR:
                this.executeReadWrite(isWrite, totalBytes);
                break;

            case RogueCmd.LUN_INFO:
                this.executeLunInfo();
                break;

            case RogueCmd.RESET:
                this.lbaByteIdx = 0;
                this.status = STATUS_READY;
                break;
            case RogueCmd.LUN_CNT:
                this.executeLunCnt();
                break;

            default:
                this.status |= STATUS_ERROR;
                break;
        }

        // Operation complete, clear busy
        this.status &= ~STATUS_BUSY;
    }

    private executeReadWrite(isWrite: boolean, totalBytes: number): void {
        const disk = this.disks[this.lun];
        if (!disk) {
            this.status |= STATUS_ERROR;
            this.errorCode = 0x02; // Not Ready
            return;
        }

        const offset = this.lba * 512;

        if (isWrite) {
            // Write from buffer to disk array
            for (let i = 0; i < totalBytes; i++) {
                if (offset + i < disk.length) {
                    disk[offset + i] = this.dataArea[i];
                }
            }
        } else {
            // Read from disk array to buffer
            for (let i = 0; i < totalBytes; i++) {
                this.dataArea[i] = (offset + i < disk.length) ? disk[offset + i] : 0;
            }
            this.dataIndex = 0;
        }
    }

    private executeLunInfo(): void {
        this.dataArea.fill(0, 0, 12);
        const disk = this.disks[this.lun];

        if (disk) {
            const totalSectors = Math.floor(disk.length / 512);
            
            this.dataArea[0] = 0x00; // Block device
            this.dataArea[1] = 0x00;
            this.dataArea[2] = 0x02; // 512 bytes per sector
            this.dataArea[3] = (totalSectors & 0xFF);
            this.dataArea[4] = (totalSectors >> 8) & 0xFF;
            this.dataArea[5] = (totalSectors >> 16) & 0xFF;
            this.dataArea[6] = (totalSectors >> 24) & 0xFF;
            this.dataArea[7] = 0x05; // Removable + Floppy LUN
        }

        this.dataIndex = 0;
    }

    private executeLunCnt(): void {
        this.dataArea.fill(0, 0, 1);
        this.dataArea[0] = this.disks.length;
        this.dataIndex = 0;
    }
}