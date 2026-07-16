const SECTOR_SIZE = 512;
const MIN_SECTOR_COUNT = 8192;
const MAX_SECTOR_COUNT = 65536;
const RESERVED_SECTORS = 1;
const FAT_COUNT = 2;
const ROOT_ENTRIES = 512;
const ROOT_SECTORS = (ROOT_ENTRIES * 32) / SECTOR_SIZE;

function write16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
}

function write32(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
  target[offset + 2] = (value >> 16) & 0xff;
  target[offset + 3] = (value >> 24) & 0xff;
}

function writeAscii(target, offset, text, length) {
  for (let index = 0; index < length; index += 1) {
    target[offset + index] = index < text.length ? text.charCodeAt(index) : 0x20;
  }
}

function shortFileName(fileName) {
  const clean = fileName.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const pieces = clean.split('.');
  const base = (pieces[0] || 'PRINT').slice(0, 8).padEnd(8, ' ');
  const extension = (pieces.at(-1) === pieces[0] ? 'GCO' : pieces.at(-1)).slice(0, 3).padEnd(3, ' ');
  return `${base}${extension}`;
}

function demoGcode() {
  const lines = [
    '; CR-20 Pro emulator SD print',
    ';Filament used: 0.002m',
    'G91',
    ';LAYER:0',
    'G4 P2000',
  ];
  for (let index = 0; index < 8; index += 1) {
    lines.push(index % 2 === 0 ? 'G1 X2 Y1 E0.2 F6000' : 'G1 X-2 Y-1 E0.2 F6000');
  }
  lines.push(';LAYER:1', 'G1 E0.2 F1200', ';LAYER:2', 'G90', 'M84', '');
  return new TextEncoder().encode(lines.join('\n'));
}

function buildFat16Image(name, content) {
  if (!(content instanceof Uint8Array)) throw new TypeError('Virtual SD content must be a Uint8Array');
  const requiredDataSectors = Math.ceil(content.length / SECTOR_SIZE);
  let sectorCount = MIN_SECTOR_COUNT;
  while (sectorCount <= MAX_SECTOR_COUNT) {
    const fatSectors = Math.ceil((sectorCount + 2) * 2 / SECTOR_SIZE);
    const available = sectorCount - RESERVED_SECTORS - FAT_COUNT * fatSectors - ROOT_SECTORS;
    if (available >= requiredDataSectors) break;
    sectorCount += 1024;
  }
  if (sectorCount > MAX_SECTOR_COUNT)
    throw new RangeError('G-code is too large for the 32 MB virtual FAT16 card');

  const fatSectors = Math.ceil((sectorCount + 2) * 2 / SECTOR_SIZE);
  const firstRootSector = RESERVED_SECTORS + FAT_COUNT * fatSectors;
  const firstDataSector = firstRootSector + ROOT_SECTORS;
  const image = new Uint8Array(sectorCount * SECTOR_SIZE);
  const boot = image.subarray(0, SECTOR_SIZE);
  boot.set([0xeb, 0x3c, 0x90], 0);
  writeAscii(boot, 3, 'MSDOS5.0', 8);
  write16(boot, 11, SECTOR_SIZE);
  boot[13] = 1;
  write16(boot, 14, RESERVED_SECTORS);
  boot[16] = FAT_COUNT;
  write16(boot, 17, ROOT_ENTRIES);
  write16(boot, 19, sectorCount < 65536 ? sectorCount : 0);
  boot[21] = 0xf8;
  write16(boot, 22, fatSectors);
  write16(boot, 24, 32);
  write16(boot, 26, 64);
  write32(boot, 28, 0);
  write32(boot, 32, sectorCount >= 65536 ? sectorCount : 0);
  boot[36] = 0x80;
  boot[38] = 0x29;
  write32(boot, 39, 0x20302307);
  writeAscii(boot, 43, 'CR20EMU', 11);
  writeAscii(boot, 54, 'FAT16', 8);
  boot[510] = 0x55;
  boot[511] = 0xaa;

  const clusterCount = Math.ceil(content.length / SECTOR_SIZE);
  for (let copy = 0; copy < FAT_COUNT; copy += 1) {
    const fatOffset = (RESERVED_SECTORS + copy * fatSectors) * SECTOR_SIZE;
    write16(image, fatOffset, 0xfff8);
    write16(image, fatOffset + 2, 0xffff);
    for (let index = 0; index < clusterCount; index += 1) {
      const cluster = 2 + index;
      const next = index === clusterCount - 1 ? 0xffff : cluster + 1;
      write16(image, fatOffset + cluster * 2, next);
    }
  }

  const rootOffset = firstRootSector * SECTOR_SIZE;
  writeAscii(image, rootOffset, 'CR20EMU', 11);
  image[rootOffset + 11] = 0x08;
  const entry = rootOffset + 32;
  writeAscii(image, entry, shortFileName(name), 11);
  image[entry + 11] = 0x20;
  write16(image, entry + 22, 0x6000);
  write16(image, entry + 24, 0x5cef);
  write16(image, entry + 26, content.length ? 2 : 0);
  write32(image, entry + 28, content.length);

  const dataOffset = firstDataSector * SECTOR_SIZE;
  image.set(content, dataOffset);
  return { image, sectorCount };
}

export class VirtualSDCard {
  constructor() {
    this.fileName = 'DEMO.GCO';
    const card = buildFat16Image(this.fileName, demoGcode());
    this.image = card.image;
    this.sectorCount = card.sectorCount;
    this.selected = false;
    this.idle = true;
    this.command = [];
    this.response = [];
    this.appCommand = false;
    this.multiReadBlock = null;
    this.singleWriteBlock = null;
    this.multiWriteBlock = null;
    this.writeBuffer = null;
    this.firstClockAfterSelect = false;
  }

  mountFile(name, content) {
    const fatName = shortFileName(name);
    this.fileName = `${fatName.slice(0, 8).trim()}.${fatName.slice(8).trim()}`;
    const card = buildFat16Image(name, content);
    this.image = card.image;
    this.sectorCount = card.sectorCount;
    this.selected = false;
    this.idle = true;
    this.appCommand = false;
    this.multiReadBlock = null;
    this.singleWriteBlock = null;
    this.multiWriteBlock = null;
    this.writeBuffer = null;
    this.firstClockAfterSelect = false;
    this.command.length = 0;
    this.response.length = 0;
  }

  setSelected(selected) {
    if (selected === this.selected) return;
    this.selected = selected;
    this.firstClockAfterSelect = selected;
    this.command.length = 0;
    this.response.length = 0;
    if (!selected) this.writeBuffer = null;
  }

  transfer(value, selected) {
    this.setSelected(selected);
    if (!selected) return 0xff;

    if (this.response.length) return this.response.shift();
    if (this.writeBuffer) return this.receiveWrite(value);

    if (this.command.length || (value & 0xc0) === 0x40) {
      this.command.push(value);
      if (this.command.length === 6) {
        this.processCommand(this.command);
        this.command = [];
      }
      return 0xff;
    }
    if (this.multiReadBlock !== null && value === 0xff) {
      if (this.firstClockAfterSelect) {
        this.firstClockAfterSelect = false;
        return 0xff;
      }
      this.queueDataBlock(this.multiReadBlock++);
      return this.response.shift();
    }

    if ((this.singleWriteBlock !== null || this.multiWriteBlock !== null) && (value === 0xfe || value === 0xfc)) {
      this.writeBuffer = { token: value, bytes: [] };
      return 0xff;
    }
    if (value === 0xfd && this.multiWriteBlock !== null) {
      this.multiWriteBlock = null;
      return 0xff;
    }
    return 0xff;
  }

  processCommand(bytes) {
    const command = bytes[0] & 0x3f;
    const argument = ((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4]) >>> 0;
    const status = this.idle ? 0x01 : 0x00;

    const wasAppCommand = this.appCommand;
    if (command !== 55) this.appCommand = false;

    if (command === 0) {
      this.idle = true;
      this.multiReadBlock = null;
      this.response.push(0x01);
    } else if (command === 8) {
      this.response.push(0x01, 0x00, 0x00, 0x01, 0xaa);
    } else if (command === 55) {
      this.appCommand = true;
      this.response.push(status);
    } else if (command === 41 && wasAppCommand) {
      this.idle = false;
      this.response.push(0x00);
    } else if (command === 58) {
      this.response.push(0x00, 0xc0, 0xff, 0x80, 0x00);
    } else if (command === 59 || command === 16 || command === 23) {
      this.response.push(status);
    } else if (command === 9) {
      const csd = new Uint8Array(16);
      csd[0] = 0x40;
      csd[5] = 0x09;
      const cSize = this.sectorCount / 1024 - 1;
      csd[7] = (cSize >> 16) & 0x3f;
      csd[8] = (cSize >> 8) & 0xff;
      csd[9] = cSize & 0xff;
      csd[10] = 0x40;
      csd[14] = 0x01;
      this.response.push(0x00, 0xff, 0xfe, ...csd, 0xff, 0xff);
    } else if (command === 10) {
      const cid = new Uint8Array(16);
      cid[0] = 0x03;
      writeAscii(cid, 1, 'EMU', 2);
      writeAscii(cid, 3, 'CR20P', 5);
      cid[8] = 0x10;
      write32(cid, 9, 0x23075858);
      cid[13] = 0x01;
      cid[14] = 0x57;
      this.response.push(0x00, 0xff, 0xfe, ...cid, 0xff, 0xff);
    } else if (command === 17) {
      this.response.push(0x00, 0xff);
      this.queueDataBlock(argument);
    } else if (command === 18) {
      this.multiReadBlock = argument;
      this.response.push(0x00);
    } else if (command === 12) {
      this.multiReadBlock = null;
      this.response.push(0xff, 0x00);
    } else if (command === 24) {
      this.singleWriteBlock = argument;
      this.response.push(0x00);
    } else if (command === 25) {
      this.multiWriteBlock = argument;
      this.response.push(0x00);
    } else if (command === 13) {
      this.response.push(0x00, 0x00);
    } else if ([32, 33, 38].includes(command)) {
      this.response.push(0x00);
    } else {
      this.response.push(status | 0x04);
    }
  }

  queueDataBlock(block) {
    const offset = block * SECTOR_SIZE;
    if (offset < 0 || offset + SECTOR_SIZE > this.image.length) {
      this.response.push(0x09);
      return;
    }
    this.response.push(0xfe, ...this.image.subarray(offset, offset + SECTOR_SIZE), 0xff, 0xff);
  }

  receiveWrite(value) {
    this.writeBuffer.bytes.push(value);
    if (this.writeBuffer.bytes.length < SECTOR_SIZE + 2) return 0xff;

    const block = this.singleWriteBlock ?? this.multiWriteBlock;
    const offset = block * SECTOR_SIZE;
    if (offset >= 0 && offset + SECTOR_SIZE <= this.image.length) {
      this.image.set(this.writeBuffer.bytes.slice(0, SECTOR_SIZE), offset);
    }
    if (this.singleWriteBlock !== null) this.singleWriteBlock = null;
    if (this.multiWriteBlock !== null) this.multiWriteBlock += 1;
    this.writeBuffer = null;
    this.response.push(0x05, 0xff);
    return 0xff;
  }
}
