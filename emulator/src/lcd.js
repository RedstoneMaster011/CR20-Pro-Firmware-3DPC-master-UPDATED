const WIDTH = 128;
const HEIGHT = 64;

export class UC1701Display {
  constructor(canvas, onFirstFrame = () => {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.ram = new Uint8Array(WIDTH * 8);
    this.page = 0;
    this.column = 0;
    this.displayOn = false;
    this.allPixelsOn = false;
    this.inverted = false;
    this.dirty = true;
    this.receivedFrame = false;
    this.onFirstFrame = onFirstFrame;

    this.imageData = this.context.createImageData(WIDTH, HEIGHT);
    this.draw();
  }

  reset() {
    this.page = 0;
    this.column = 0;
    this.displayOn = false;
    this.allPixelsOn = false;
    this.inverted = false;
    this.receivedFrame = false;
    this.ram.fill(0);
    this.dirty = true;
  }

  command(value) {
    if ((value & 0xf0) === 0xb0) {
      this.page = value & 0x0f;
    } else if ((value & 0xf0) === 0x10) {
      this.column = (this.column & 0x0f) | ((value & 0x0f) << 4);
    } else if ((value & 0xf0) === 0x00) {
      this.column = (this.column & 0xf0) | (value & 0x0f);
    } else if (value === 0xaf) {
      this.displayOn = true;
      this.dirty = true;
    } else if (value === 0xae) {
      this.displayOn = false;
      this.dirty = true;
    } else if (value === 0xa4) {
      this.allPixelsOn = false;
      this.dirty = true;
    } else if (value === 0xa5) {
      this.allPixelsOn = true;
      this.dirty = true;
    } else if (value === 0xa6 || value === 0xa7) {
      this.inverted = value === 0xa7;
      this.dirty = true;
    } else if (value === 0xe2) {
      this.page = 0;
      this.column = 0;
      this.displayOn = false;
      this.ram.fill(0);
      this.dirty = true;
    }
  }

  data(value) {
    if (this.page < 8 && this.column < WIDTH) {
      this.ram[this.page * WIDTH + this.column] = value;
      this.dirty = true;
    }
    this.column = (this.column + 1) & 0x7f;

    if (!this.receivedFrame && this.page === 7 && this.column === 0) {
      this.receivedFrame = true;
      this.onFirstFrame();
    }
  }

  draw() {
    if (!this.dirty) return;

    const pixels = this.imageData.data;
    const enabled = this.displayOn;
    for (let y = 0; y < HEIGHT; y += 1) {
      const page = y >> 3;
      const bit = y & 7;
      for (let x = 0; x < WIDTH; x += 1) {
        const source = this.ram[page * WIDTH + x];
        let on = enabled && (this.allPixelsOn || (source & (1 << bit)) !== 0);
        if (this.inverted) on = !on;

        const offset = (y * WIDTH + x) * 4;
        if (on) {
          pixels[offset] = 169;
          pixels[offset + 1] = 241;
          pixels[offset + 2] = 247;
        } else {
          pixels[offset] = 13;
          pixels[offset + 1] = 48;
          pixels[offset + 2] = 53;
        }
        pixels[offset + 3] = 255;
      }
    }
    this.context.putImageData(this.imageData, 0, 0);
    this.dirty = false;
  }
}
