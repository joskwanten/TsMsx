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
  DEV_STATUS = 0x08,
  DEV_WR = 0x83,
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
  private lunStatus: number[] = [3, 3, 3, 3, 3, 3, 3]; // Initial status for 7 LUNs

  // Buffers
  private dataArea: Uint8Array = new Uint8Array(32768); // 32KB buffer
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
        console.log(`RogueDrive Status Read: 0x${this.status.toString(16)}`);
        return this.status;
      case 0x63: // Error Code
        console.log(
          `RogueDrive Error Code Read: 0x${this.errorCode.toString(16)}`,
        );
        return this.errorCode;
      case 0x64: // Data Buffer
        if (this.dataIndex < 4096) {
          //console.log(`RogueDrive Data Buffer Read: 0x${this.dataIndex.toString(16)}:${this.dataArea[this.dataIndex].toString(16)}`);
          if (this.dataIndex === 0) {
            console.log(
              `Z80 starts reading data. First 4 bytes in buffer: ${this.dataArea[0].toString(16)}, ${this.dataArea[1].toString(16)}, ${this.dataArea[2].toString(16)}, ${this.dataArea[3].toString(16)}`,
            );
          }
          return this.dataArea[this.dataIndex++];
        }
        return 0xff;
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
        console.log(`RogueDrive Command Write: 0x${data.toString(16)}`);
        this.status |= STATUS_BUSY;
        this.handleCommand(data);
        break;

      case 0x61: // Sector Count
        console.log(`RogueDrive Sector Count Write: ${data}`);
        this.numOfSectors = data;
        this.lbaByteIdx = 0;
        this.dataIndex = 0;
        break;

      case 0x62: // LBA (4 consecutive writes)
        console.log(
          `RogueDrive LBA Byte[${this.lbaByteIdx}] Write: 0x${data.toString(16)}`,
        );
        const shift = this.lbaByteIdx * 8;
        this.lba &= ~(0xff << shift);
        this.lba |= data << shift;
        this.lbaByteIdx = (this.lbaByteIdx + 1) & 0x03;
        break;

      case 0x63: // LUN / Device
        console.log(`RogueDrive LUN/Device Write: 0x${data.toString(16)}`);
        this.lun = data & 0x0f;
        this.deviceNumber = (data >> 4) & 0x0f;
        break;

      case 0x64: // Data Buffer
        console.log(`RogueDrive Data Buffer Write: 0x${data.toString(16)}`);
        if (this.dataIndex < 4096) {
          this.dataArea[this.dataIndex++] = data;
        }
        break;
    }
  }

  private handleCommand(rawCmd: number): void {
    const cmd = (rawCmd & 0x0f) as RogueCmd;
    const isWrite = (rawCmd & CMD_WRITE_MASK) !== 0;
    const totalBytes = this.numOfSectors * 512;

    // Validation
    if (this.numOfSectors > 64) {
      this.status = STATUS_ERROR;
      return;
    }

    switch (cmd) {
      case RogueCmd.DEV_RD:
      case RogueCmd.DEV_WR:
        console.log(
          `RogueDrive Command: ${isWrite ? "WRITE" : "READ"} LUN=${this.lun} LBA=${this.lba} Sectors=${this.numOfSectors}`,
        );
        this.executeReadWrite(isWrite, totalBytes);
        break;

      case RogueCmd.LUN_INFO:
        console.log(
          `RogueDrive Command: LUN_INFO DEV=${this.deviceNumber}, LUN=${this.lun}`,
        );
        this.executeLunInfo();
        break;

      case RogueCmd.RESET:
        console.log("RogueDrive Command: RESET");
        this.lbaByteIdx = 0;
        this.status = STATUS_READY;
        break;
      case RogueCmd.LUN_CNT:
        console.log("RogueDrive Command: LUN_CNT");
        this.executeLunCnt();
        break;
      case RogueCmd.DEV_STATUS:
        console.log(`RogueDrive Command: DEV_STATUS LUN=${this.lun}`);
        this.executeDevStatus();
        break;

      default:
        this.status |= STATUS_ERROR;
        break;
    }

    // Operation complete, clear busy
    this.status &= ~STATUS_BUSY;
  }

  private executeReadWrite(isWrite: boolean, totalBytes: number): void {
    const disk = this.disks[this.lun - 1];
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
        this.dataArea[i] = offset + i < disk.length ? disk[offset + i] : 0;
      }
      this.dataIndex = 0;
    }
  }

  private executeLunInfo(): void {
    this.dataArea.fill(0, 0, 12);
    if (this.deviceNumber == 1) {
      const disk = this.disks[this.lun - 1];

      if (disk) {
        const totalSectors = Math.floor(disk.length / 512);

        this.dataArea[0] = 0x00; // Block device
        this.dataArea[1] = 0x00;
        this.dataArea[2] = 0x02; // 512 bytes per sector
        this.dataArea[3] = totalSectors & 0xff;
        this.dataArea[4] = (totalSectors >> 8) & 0xff;
        this.dataArea[5] = (totalSectors >> 16) & 0xff;
        this.dataArea[6] = (totalSectors >> 24) & 0xff;
        this.dataArea[7] = 0x05; // Removable + Floppy LUN
      }
    }

    this.dataIndex = 0;
  }

  private executeLunCnt(): void {
    this.dataArea.fill(0, 0, 1);
    this.dataArea[0] = this.disks.length;
    this.dataIndex = 0;
  }

  private executeDevStatus(): void {
    this.dataArea.fill(0, 0, 1);
    this.dataIndex = 0;

    if (this.lun <= 7 && this.disks[this.lun - 1]) {
      this.dataArea[0] = this.lunStatus[this.lun - 1];
      // Update status naar '1' na de eerste keer lezen
      if (this.lunStatus[this.lun - 1] == 3) {
        this.lunStatus[this.lun - 1] = 1;
      }
    } else {
      this.dataArea[0] = 0; // Not available
    }
  }
}
