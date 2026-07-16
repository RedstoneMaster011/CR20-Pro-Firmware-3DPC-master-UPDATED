import {
  ADCMuxInputType,
  ADCReference,
  AVRADC,
  AVREEPROM,
  AVRIOPort,
  AVRSPI,
  AVRTimer,
  AVRTWI,
  AVRUSART,
  CPU,
  EEPROMMemoryBackend,
  avrInstruction,
  portAConfig,
  portBConfig,
  portCConfig,
  portDConfig,
  portEConfig,
  portFConfig,
  portGConfig,
  portHConfig,
  portJConfig,
  portKConfig,
  portLConfig,
  spiConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
} from 'avr8js';
import { VirtualSDCard } from './virtual-sd.js';

const CPU_HZ = 16_000_000;
const MAX_EMULATION_SPEED = 250;
const EEPROM_KEY = 'cr20-pro-emulator-eeprom-v2.3';
const ENCODER_PULSES_PER_NOTCH = 5;
const BLTOUCH_COMMANDS = [10, 60, 90, 120, 130, 140, 150, 160];
const STEPPERS_BY_STEP_PIN = new Map([
  [54, { axis: 'x', direction: 55, enable: 38, stepsPerMm: 80, inverted: false }],
  [60, { axis: 'y', direction: 61, enable: 56, stepsPerMm: 80, inverted: false }],
  [46, { axis: 'z', direction: 48, enable: 62, stepsPerMm: 400, inverted: true }],
  [26, { axis: 'e', direction: 28, enable: 24, stepsPerMm: 93, inverted: false }],
]);

const PORTS = [
  ['A', portAConfig, [22, 23, 24, 25, 26, 27, 28, 29]],
  ['B', portBConfig, [53, 52, 51, 50, 10, 11, 12, 13]],
  ['C', portCConfig, [37, 36, 35, 34, 33, 32, 31, 30]],
  ['D', portDConfig, [21, 20, 19, 18, -1, -1, -1, 38]],
  ['E', portEConfig, [0, 1, -1, 5, 2, 3, -1, -1]],
  ['F', portFConfig, [54, 55, 56, 57, 58, 59, 60, 61]],
  ['G', portGConfig, [41, 40, 39, -1, -1, 4, -1, -1]],
  ['H', portHConfig, [17, 16, -1, 6, 7, 8, 9, -1]],
  ['J', portJConfig, [15, 14, -1, -1, -1, -1, -1, -1]],
  ['K', portKConfig, [62, 63, 64, 65, 66, 67, 68, 69]],
  ['L', portLConfig, [49, 48, 47, 46, 45, 44, 43, 42]],
];

const PIN_TO_PORT = new Map();
for (const [name, config, pins] of PORTS) {
  pins.forEach((pin, bit) => {
    if (pin >= 0) PIN_TO_PORT.set(pin, { name, config, bit });
  });
}

const TIMER_DIVIDERS = { 0: 0, 1: 1, 2: 8, 3: 64, 4: 256, 5: 1024, 6: 0, 7: 0 };
const TIMER_BITS = { TOV: 1, OCFA: 2, OCFB: 4, OCFC: 8, TOIE: 1, OCIEA: 2, OCIEB: 4, OCIEC: 8 };

const megaTimer0 = {
  ...timer0Config,
  compAInterrupt: 0x2a,
  compBInterrupt: 0x2c,
  ovfInterrupt: 0x2e,
  compPortA: portBConfig.PORT,
  compPinA: 7,
  compPortB: portGConfig.PORT,
  compPinB: 5,
};

const megaTimer1 = {
  ...timer1Config,
  captureInterrupt: 0x20,
  compAInterrupt: 0x22,
  compBInterrupt: 0x24,
  compCInterrupt: 0x26,
  ovfInterrupt: 0x28,
  OCRC: 0x8c,
  compPortA: portBConfig.PORT,
  compPinA: 5,
  compPortB: portBConfig.PORT,
  compPinB: 6,
  compPortC: portBConfig.PORT,
  compPinC: 7,
  OCFC: 8,
  OCIEC: 8,
};

const megaTimer2 = {
  ...timer2Config,
  compAInterrupt: 0x1a,
  compBInterrupt: 0x1c,
  ovfInterrupt: 0x1e,
  compPortA: portBConfig.PORT,
  compPinA: 4,
  compPortB: portHConfig.PORT,
  compPinB: 6,
};

function timer16(config) {
  return { bits: 16, dividers: TIMER_DIVIDERS, ...TIMER_BITS, ...config };
}

const megaTimer3 = timer16({
  captureInterrupt: 0x3e,
  compAInterrupt: 0x40,
  compBInterrupt: 0x42,
  compCInterrupt: 0x44,
  ovfInterrupt: 0x46,
  TIFR: 0x38,
  OCRA: 0x98,
  OCRB: 0x9a,
  OCRC: 0x9c,
  ICR: 0x96,
  TCNT: 0x94,
  TCCRA: 0x90,
  TCCRB: 0x91,
  TCCRC: 0x92,
  TIMSK: 0x71,
  compPortA: portEConfig.PORT,
  compPinA: 3,
  compPortB: portEConfig.PORT,
  compPinB: 4,
  compPortC: portEConfig.PORT,
  compPinC: 5,
  externalClockPort: portEConfig.PIN,
  externalClockPin: 6,
});

const megaTimer4 = timer16({
  captureInterrupt: 0x52,
  compAInterrupt: 0x54,
  compBInterrupt: 0x56,
  compCInterrupt: 0x58,
  ovfInterrupt: 0x5a,
  TIFR: 0x39,
  OCRA: 0xa8,
  OCRB: 0xaa,
  OCRC: 0xac,
  ICR: 0xa6,
  TCNT: 0xa4,
  TCCRA: 0xa0,
  TCCRB: 0xa1,
  TCCRC: 0xa2,
  TIMSK: 0x72,
  compPortA: portHConfig.PORT,
  compPinA: 3,
  compPortB: portHConfig.PORT,
  compPinB: 4,
  compPortC: portHConfig.PORT,
  compPinC: 5,
  externalClockPort: portHConfig.PIN,
  externalClockPin: 7,
});

const megaTimer5 = timer16({
  captureInterrupt: 0x5c,
  compAInterrupt: 0x5e,
  compBInterrupt: 0x60,
  compCInterrupt: 0x62,
  ovfInterrupt: 0x64,
  TIFR: 0x3a,
  OCRA: 0x128,
  OCRB: 0x12a,
  OCRC: 0x12c,
  ICR: 0x126,
  TCNT: 0x124,
  TCCRA: 0x120,
  TCCRB: 0x121,
  TCCRC: 0x122,
  TIMSK: 0x73,
  compPortA: portLConfig.PORT,
  compPinA: 3,
  compPortB: portLConfig.PORT,
  compPinB: 4,
  compPortC: portLConfig.PORT,
  compPinC: 5,
  externalClockPort: portLConfig.PIN,
  externalClockPin: 2,
});

const megaAdcChannels = {};
for (let channel = 0; channel < 8; channel += 1) {
  megaAdcChannels[channel] = { type: ADCMuxInputType.SingleEnded, channel };
  megaAdcChannels[0x20 + channel] = { type: ADCMuxInputType.SingleEnded, channel: channel + 8 };
}

const megaAdcConfig = {
  ADMUX: 0x7c,
  ADCSRA: 0x7a,
  ADCSRB: 0x7b,
  ADCL: 0x78,
  ADCH: 0x79,
  DIDR0: 0x7e,
  adcInterrupt: 0x3a,
  numChannels: 16,
  muxInputMask: 0x3f,
  muxChannels: megaAdcChannels,
  adcReferences: [ADCReference.AREF, ADCReference.AVCC, ADCReference.Reserved, ADCReference.Internal1V1],
};

const megaEepromConfig = {
  eepromReadyInterrupt: 0x3c,
  EECR: 0x3f,
  EEDR: 0x40,
  EEARL: 0x41,
  EEARH: 0x42,
  eraseCycles: 28800,
  writeCycles: 28800,
};

const megaUsart0Config = {
  ...usart0Config,
  rxCompleteInterrupt: 0x32,
  dataRegisterEmptyInterrupt: 0x34,
  txCompleteInterrupt: 0x36,
};

const megaSpiConfig = { ...spiConfig, spiInterrupt: 0x30 };
const megaTwiConfig = { ...twiConfig, twiInterrupt: 0x4e };

class PersistentEeprom extends EEPROMMemoryBackend {
  constructor() {
    super(4096);
    try {
      const stored = localStorage.getItem(EEPROM_KEY);
      if (stored) {
        const values = Uint8Array.from(atob(stored), (char) => char.charCodeAt(0));
        this.memory.set(values.subarray(0, this.memory.length));
      }
    } catch (error) {
      console.warn('Could not restore virtual EEPROM', error);
    }
  }

  writeMemory(address, value) {
    super.writeMemory(address, value);
    this.scheduleSave();
  }

  eraseMemory(address) {
    super.eraseMemory(address);
    this.scheduleSave();
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        let binary = '';
        for (const value of this.memory) binary += String.fromCharCode(value);
        localStorage.setItem(EEPROM_KEY, btoa(binary));
      } catch (error) {
        console.warn('Could not save virtual EEPROM', error);
      }
    }, 120);
  }
}

export function parseIntelHex(source) {
  const bytes = new Uint8Array(256 * 1024);
  bytes.fill(0xff);
  let upperAddress = 0;
  let highestAddress = 0;

  for (const [lineIndex, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line[0] !== ':' || !/^:[0-9a-f]+$/i.test(line))
      throw new Error(`Invalid Intel HEX record on line ${lineIndex + 1}`);

    const count = Number.parseInt(line.slice(1, 3), 16);
    if (line.length !== 11 + count * 2)
      throw new Error(`Invalid Intel HEX length on line ${lineIndex + 1}`);
    let checksum = 0;
    for (let index = 1; index < line.length; index += 2)
      checksum = (checksum + Number.parseInt(line.slice(index, index + 2), 16)) & 0xff;
    if (checksum !== 0)
      throw new Error(`Invalid Intel HEX checksum on line ${lineIndex + 1}`);

    const address = Number.parseInt(line.slice(3, 7), 16);
    const type = Number.parseInt(line.slice(7, 9), 16);
    if (type === 0x00) {
      const absolute = upperAddress + address;
      if (absolute + count > bytes.length)
        throw new Error(`Intel HEX data exceeds ATmega2560 flash on line ${lineIndex + 1}`);
      for (let index = 0; index < count; index += 1) {
        bytes[absolute + index] = Number.parseInt(line.slice(9 + index * 2, 11 + index * 2), 16);
      }
      highestAddress = Math.max(highestAddress, absolute + count);
    } else if (type === 0x02) {
      upperAddress = Number.parseInt(line.slice(9, 13), 16) << 4;
    } else if (type === 0x04) {
      upperAddress = Number.parseInt(line.slice(9, 13), 16) << 16;
    } else if (type === 0x01) {
      break;
    } else if (![0x03, 0x05].includes(type)) {
      throw new Error(`Unsupported Intel HEX record type ${type} on line ${lineIndex + 1}`);
    }
  }
  return { bytes, size: highestAddress };
}

function thermistorVoltage(celsius) {
  const kelvin = celsius + 273.15;
  const resistance = 100000 * Math.exp(4092 * (1 / kelvin - 1 / 298.15));
  const raw = (resistance / (resistance + 4700)) * 1023;
  return (raw / 1024) * 5;
}

export class CR20Emulator {
  constructor(display) {
    this.display = display;
    this.cpu = null;
    this.running = false;
    this.speed = 1;
    this.lastFrameTime = 0;
    this.lastHardwareCycle = 0;
    this.hardwareAccumulator = 0;
    this.portInstances = new Map();
    this.pinOutputs = new Map();
    this.inputStates = new Map();
    this.inputEvents = [];
    this.encoderPhase = 0;
    this.serialQueue = [];
    this.serialText = '';
    this.lcdPageSequence = 0;
    this.lcdDataBytesRemaining = 0;
    this.eepromBackend = new PersistentEeprom();
    this.sdCard = new VirtualSDCard();
    this.axes = { x: 117.5, y: 117.5, z: 10, e: 0 };
    this.axisExtents = {};
    this.probe = { deployed: false, triggered: false, command: 90, commands: [], triggerCount: 0 };
    this.servoRiseCycle = null;
    this.temperatures = { hotend: 25, bed: 25 };
    this.duties = { hotend: 0, bed: 0, fan: 0 };
    this.dutyPeaks = { hotend: 0, bed: 0, fan: 0 };
    this.outputSamplers = new Map();
    this.statusLed = { r: 0, g: 0, b: 0 };
    this.onTelemetry = () => {};
    this.onExtrusion = () => {};
    this.onSerial = () => {};
    this.onState = () => {};
    this.lastTelemetryTime = 0;
    this.extrusionSampleSteps = 0;
    this.unexpectedResets = [];
    this.boundFrame = (time) => this.frame(time);
  }

  async load(url, defaultGcodeUrl = null) {
    const [response, gcodeResponse] = await Promise.all([
      fetch(url),
      defaultGcodeUrl ? fetch(defaultGcodeUrl) : Promise.resolve(null),
    ]);
    if (!response.ok) throw new Error(`Firmware fetch failed (${response.status})`);
    if (gcodeResponse && !gcodeResponse.ok)
      throw new Error(`Default G-code fetch failed (${gcodeResponse.status})`);
    const source = await response.text();
    const { bytes, size } = parseIntelHex(source);
    this.firmwareBytes = bytes;
    this.firmwareSize = size;
    if (gcodeResponse)
      this.sdCard.mountFile('3DBenchy.gcode', new Uint8Array(await gcodeResponse.arrayBuffer()));
    this.createCpu();
    return size;
  }

  createCpu() {
    const program = new Uint16Array(131072);
    program.fill(0xffff);
    for (let index = 0; index < this.firmwareBytes.length; index += 2) {
      program[index >> 1] = this.firmwareBytes[index] | (this.firmwareBytes[index + 1] << 8);
    }

    // avr8js adds 0x100 bytes for core I/O. The Mega2560 also has 0x100 bytes
    // of extended I/O before its 8 KB SRAM, so the backing size is 8192 + 256.
    this.cpu = new CPU(program, 8448);
    const resetCpu = this.cpu.reset.bind(this.cpu);
    this.cpu.reset = () => {
      this.unexpectedResets.push({
        cycles: this.cpu.cycles,
        previousPc: this.cpu.pc,
        previousSp: this.cpu.SP,
        mcusr: this.cpu.data[0x54],
        wdtcsr: this.cpu.data[0x60],
      });
      if (this.unexpectedResets.length > 8) this.unexpectedResets.shift();
      resetCpu();
    };
    this.portInstances.clear();
    this.pinOutputs.clear();
    this.inputStates.clear();
    for (const [name, config, pins] of PORTS) {
      const port = new AVRIOPort(this.cpu, config);
      this.portInstances.set(name, port);
      port.addListener((value, oldValue) => this.handlePortChange(pins, value, oldValue));
    }

    this.peripherals = [
      new AVRTimer(this.cpu, megaTimer0),
      new AVRTimer(this.cpu, megaTimer1),
      new AVRTimer(this.cpu, megaTimer2),
      new AVRTimer(this.cpu, megaTimer3),
      new AVRTimer(this.cpu, megaTimer4),
      new AVRTimer(this.cpu, megaTimer5),
    ];

    this.adc = new AVRADC(this.cpu, megaAdcConfig);
    this.eeprom = new AVREEPROM(this.cpu, this.eepromBackend, megaEepromConfig);
    this.spi = new AVRSPI(this.cpu, megaSpiConfig, CPU_HZ);
    this.spi.onByte = (value) => this.handleSpi(value);
    this.twi = new AVRTWI(this.cpu, megaTwiConfig, CPU_HZ);
    this.attachPca9632();
    this.usart = new AVRUSART(this.cpu, megaUsart0Config, CPU_HZ);
    this.usart.onByteTransmit = (value) => this.handleSerialByte(value);
    this.peripherals.push(this.adc, this.eeprom, this.spi, this.twi, this.usart);

    this.lastFrameTime = 0;
    this.lastHardwareCycle = 0;
    this.hardwareAccumulator = 0;
    this.inputEvents.length = 0;
    this.encoderPhase = 0;
    this.serialQueue.length = 0;
    this.lcdPageSequence = 0;
    this.lcdDataBytesRemaining = 0;
    this.probe.deployed = false;
    this.probe.triggered = false;
    this.probe.command = 90;
    this.probe.commands.length = 0;
    this.probe.triggerCount = 0;
    this.resetTrace();
    this.servoRiseCycle = null;
    this.outputSamplers.clear();
    this.statusLed = { r: 0, g: 0, b: 0 };
    this.dutyPeaks = { hotend: 0, bed: 0, fan: 0 };
    this.lastTelemetryTime = 0;
    this.extrusionSampleSteps = 0;
    this.setInput(31, true);
    this.setInput(33, true);
    this.setInput(35, true);
    this.setInput(49, false);
    this.setInput(64, true);
    this.updateEndstops();
    this.updateAdc();
    this.onState('booting');
  }

  start() {
    if (!this.cpu || this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.boundFrame);
  }

  pause() {
    this.running = false;
    this.onState('paused');
  }

  resume() {
    if (this.running) return;
    this.running = true;
    this.lastFrameTime = performance.now();
    this.onState('running');
    requestAnimationFrame(this.boundFrame);
  }

  reset() {
    const wasRunning = this.running;
    this.running = false;
    this.display.reset?.();
    this.createCpu();
    if (wasRunning) this.start();
  }

  setSpeed(speed) {
    this.speed = Math.max(0.25, Math.min(MAX_EMULATION_SPEED, speed));
  }

  frame(timestamp) {
    if (!this.running || !this.cpu) return;
    const elapsedMs = Math.min(40, Math.max(0, timestamp - this.lastFrameTime));
    this.lastFrameTime = timestamp;
    const targetCycle = this.cpu.cycles + elapsedMs * CPU_HZ * this.speed / 1000;
    let instructionCount = 0;
    // Turbo modes run as fast as the host allows. Keep a finite frame budget
    // so the LCD, controls, and browser rendering continue to receive time.
    const maxInstructions = this.speed > 8 ? 1800000 : 900000;

    while (this.cpu.cycles < targetCycle && instructionCount < maxInstructions) {
      const interruptsWereEnabled = this.cpu.interruptsEnabled;
      avrInstruction(this.cpu);
      if (!interruptsWereEnabled && this.cpu.interruptsEnabled) {
        // AVR guarantees one instruction after setting SREG.I before accepting
        // a pending interrupt. GCC relies on this while restoring SPL/SPH.
        const sreg = this.cpu.SREG;
        this.cpu.data[0x5f] = sreg & 0x7f;
        this.cpu.tick();
        this.cpu.data[0x5f] = sreg;
      } else {
        this.cpu.tick();
      }
      instructionCount += 1;
      if ((instructionCount & 0x3f) === 0) {
        this.flushInputEvents();
        this.drainSerial();
      }
    }

    this.flushInputEvents();
    this.drainSerial();
    this.updateHardware();
    this.display.draw();
    if (timestamp - this.lastTelemetryTime >= 80) {
      this.lastTelemetryTime = timestamp;
      this.onTelemetry(this.snapshot());
    }
    requestAnimationFrame(this.boundFrame);
  }

  handlePortChange(pins, value, oldValue) {
    const changed = value ^ oldValue;
    for (let bit = 0; bit < 8; bit += 1) {
      if (!(changed & (1 << bit)) || pins[bit] < 0) continue;
      const pin = pins[bit];
      const state = (value & (1 << bit)) !== 0;
      this.pinOutputs.set(pin, state);
      this.sampleOutputTransition(pin, state);
      this.handleServoPin(pin, state);
      this.handleStepperPin(pin, state, oldValue, bit);
    }
  }

  handleStepperPin(pin, state, oldPortValue, bit) {
    if (!state || (oldPortValue & (1 << bit)) !== 0) return;
    const motor = STEPPERS_BY_STEP_PIN.get(pin);
    if (!motor || this.pinOutputs.get(motor.enable) !== false) return;
    const direction = this.pinOutputs.get(motor.direction) === motor.inverted ? -1 : 1;
    this.axes[motor.axis] += direction / motor.stepsPerMm;
    const extent = this.axisExtents[motor.axis];
    extent.min = Math.min(extent.min, this.axes[motor.axis]);
    extent.max = Math.max(extent.max, this.axes[motor.axis]);
    if (motor.axis === 'e') {
      if (direction < 0) {
        this.extrusionSampleSteps = 0;
        this.onExtrusion(null);
      }
      else if (++this.extrusionSampleSteps >= 8) {
        this.extrusionSampleSteps = 0;
        this.onExtrusion({ ...this.axes });
      }
    }
    else
      this.updateEndstops();
  }

  resetTrace() {
    this.axisExtents = Object.fromEntries(Object.entries(this.axes).map(([axis, position]) => [axis, { min: position, max: position }]));
    this.probe.commands.length = 0;
    this.probe.triggerCount = 0;
  }

  sampleOutputTransition(pin, state) {
    if (![8, 9, 10].includes(pin) || !this.cpu) return;
    let sampler = this.outputSamplers.get(pin);
    if (!sampler) {
      sampler = { state: false, lastCycle: this.cpu.cycles, highCycles: 0, totalCycles: 0 };
      this.outputSamplers.set(pin, sampler);
    }
    const elapsed = Math.max(0, this.cpu.cycles - sampler.lastCycle);
    sampler.totalCycles += elapsed;
    if (sampler.state) sampler.highCycles += elapsed;
    sampler.lastCycle = this.cpu.cycles;
    sampler.state = state;
  }

  handleServoPin(pin, state) {
    if (pin !== 11 || !this.cpu) return;
    if (state) {
      this.servoRiseCycle = this.cpu.cycles;
      return;
    }
    if (this.servoRiseCycle === null) return;

    const pulseUs = (this.cpu.cycles - this.servoRiseCycle) / (CPU_HZ / 1_000_000);
    this.servoRiseCycle = null;
    if (pulseUs < 400 || pulseUs > 2600) return;

    const angle = Math.round(((pulseUs - 544) * 180) / (2400 - 544));
    const command = BLTOUCH_COMMANDS.reduce((closest, candidate) => (
      Math.abs(candidate - angle) < Math.abs(closest - angle) ? candidate : closest
    ));
    if (Math.abs(command - angle) > 8 || command === this.probe.command) return;

    this.probe.command = command;
    this.probe.commands.push(command);
    if (this.probe.commands.length > 80) this.probe.commands.shift();
    if (command === 10) this.probe.deployed = true;
    if (command === 90 || command === 160) this.probe.deployed = false;
    this.updateEndstops();
  }

  readDuty(pin) {
    const sampler = this.outputSamplers.get(pin);
    if (!sampler || !this.cpu) return this.pinOutputs.get(pin) ? 1 : 0;
    const elapsed = Math.max(0, this.cpu.cycles - sampler.lastCycle);
    sampler.totalCycles += elapsed;
    if (sampler.state) sampler.highCycles += elapsed;
    sampler.lastCycle = this.cpu.cycles;
    const duty = sampler.totalCycles > 0 ? sampler.highCycles / sampler.totalCycles : (sampler.state ? 1 : 0);
    sampler.highCycles = 0;
    sampler.totalCycles = 0;
    return duty;
  }

  updateHardware() {
    if (!this.cpu) return;
    const elapsedCycles = this.cpu.cycles - this.lastHardwareCycle;
    this.hardwareAccumulator += elapsedCycles;
    this.lastHardwareCycle = this.cpu.cycles;
    if (this.hardwareAccumulator < CPU_HZ / 20) return;

    const seconds = this.hardwareAccumulator / CPU_HZ;
    this.hardwareAccumulator = 0;
    this.duties.hotend = this.readDuty(10);
    this.duties.bed = this.readDuty(8);
    this.duties.fan = this.readDuty(9);
    for (const output of Object.keys(this.duties))
      this.dutyPeaks[output] = Math.max(this.dutyPeaks[output], this.duties[output]);

    const ambient = 25;
    const hotendCooling = (this.temperatures.hotend - ambient) / 65;
    const bedCooling = (this.temperatures.bed - ambient) / 190;
    this.temperatures.hotend += (this.duties.hotend * 5.5 - hotendCooling) * seconds;
    this.temperatures.bed += (this.duties.bed * 0.55 - bedCooling) * seconds;
    this.temperatures.hotend = Math.max(ambient, this.temperatures.hotend);
    this.temperatures.bed = Math.max(ambient, this.temperatures.bed);
    this.updateAdc();
  }

  updateAdc() {
    if (!this.adc) return;
    this.adc.channelValues[13] = thermistorVoltage(this.temperatures.hotend);
    this.adc.channelValues[14] = thermistorVoltage(this.temperatures.bed);
  }

  updateEndstops() {
    this.setInput(3, this.axes.x <= 0);
    this.setInput(14, this.axes.y <= 0);
    const probeTriggered = this.probe.deployed && this.axes.z <= 0.12;
    if (probeTriggered && !this.probe.triggered) this.probe.triggerCount += 1;
    this.probe.triggered = probeTriggered;
    this.setInput(18, this.probe.triggered);
  }

  attachPca9632() {
    const registers = new Uint8Array(16);
    let connected = false;
    let register = null;
    let autoIncrement = false;
    this.pca9632Registers = registers;
    this.twi.eventHandler = {
      start: () => {
        connected = false;
        register = null;
        this.twi.completeStart();
      },
      stop: () => {
        connected = false;
        register = null;
        this.twi.completeStop();
      },
      connectToSlave: (address, write) => {
        connected = address === 0x60;
        register = null;
        this.twi.completeConnect(connected && write);
      },
      writeByte: (value) => {
        if (!connected) {
          this.twi.completeWrite(false);
          return;
        }
        if (register === null) {
          autoIncrement = (value & 0xe0) !== 0;
          register = value & 0x0f;
        }
        else {
          registers[register] = value;
          if (autoIncrement) register = (register + 1) & 0x0f;
          this.statusLed = { r: registers[2], g: registers[3], b: registers[4] };
        }
        this.twi.completeWrite(true);
      },
      readByte: () => {
        const value = connected && register !== null ? registers[register] : 0xff;
        if (autoIncrement && register !== null) register = (register + 1) & 0x0f;
        this.twi.completeRead(value);
      },
    };
  }

  handleSpi(value) {
    if (!this.cpu) return;
    const sdSelected = this.pinOutputs.get(53) === false;
    const sdResponse = this.sdCard.transfer(value, sdSelected);
    if (sdSelected) {
      this.cpu.addClockEvent(() => this.spi.completeTransfer(sdResponse), this.spi.transferCycles);
      return;
    }

    const chipSelect = this.pinOutputs.get(25) ?? true;
    const dataMode = this.pinOutputs.get(27) ?? false;
    if (!chipSelect) {
      if (dataMode || this.lcdDataBytesRemaining > 0) {
        this.display.data(value);
        this.lcdDataBytesRemaining = Math.max(0, this.lcdDataBytesRemaining - 1);
      } else {
        this.display.command(value);

        // U8glib writes each MiniPanel page as 0x10, 0x00, 0xB0|page,
        // followed by exactly 128 data bytes. avr8js misses the optimized
        // A0 GPIO transition in this build, so retain the wire protocol as
        // a fallback when the pin still appears low.
        if (this.lcdPageSequence === 0) {
          this.lcdPageSequence = value === 0x10 ? 1 : 0;
        } else if (this.lcdPageSequence === 1) {
          this.lcdPageSequence = value === 0x00 ? 2 : (value === 0x10 ? 1 : 0);
        } else {
          if ((value & 0xf8) === 0xb0) this.lcdDataBytesRemaining = 128;
          this.lcdPageSequence = 0;
        }
      }
    }
    this.cpu.addClockEvent(() => this.spi.completeTransfer(0xff), this.spi.transferCycles);
  }

  mountGcode(name, bytes) {
    this.sdCard.mountFile(name, bytes);
    this.setInput(49, false);
    this.sendSerial('M21');
  }

  setInput(pin, state) {
    const mapping = PIN_TO_PORT.get(pin);
    if (!mapping) return;
    if (this.inputStates.get(pin) === state) return;
    this.inputStates.set(pin, state);
    this.portInstances.get(mapping.name)?.setPin(mapping.bit, state);
  }

  scheduleInput(pin, state, cycle) {
    this.inputEvents.push({ pin, state, cycle });
    this.inputEvents.sort((a, b) => a.cycle - b.cycle);
  }

  flushInputEvents() {
    if (!this.cpu) return;
    while (this.inputEvents.length && this.inputEvents[0].cycle <= this.cpu.cycles) {
      const event = this.inputEvents.shift();
      this.setInput(event.pin, event.state);
    }
  }

  rotateEncoder(direction) {
    if (!this.cpu) return;
    const lastCycle = this.inputEvents.at(-1)?.cycle || this.cpu.cycles;
    let cycle = Math.max(lastCycle, this.cpu.cycles) + CPU_HZ * 0.004;
    const phases = [[true, true], [true, false], [false, false], [false, true]];
    const phaseDirection = direction > 0 ? 1 : -1;
    for (let pulse = 0; pulse < ENCODER_PULSES_PER_NOTCH; pulse += 1) {
      this.encoderPhase = (this.encoderPhase + phaseDirection + phases.length) % phases.length;
      const [a, b] = phases[this.encoderPhase];
      this.scheduleInput(31, a, cycle);
      this.scheduleInput(33, b, cycle);
      cycle += CPU_HZ * 0.004;
    }
  }

  pressEncoder() {
    if (!this.cpu) return;
    const cycle = Math.max(this.cpu.cycles, this.inputEvents.at(-1)?.cycle || 0);
    this.scheduleInput(35, false, cycle + CPU_HZ * 0.002);
    this.scheduleInput(35, true, cycle + CPU_HZ * 0.12);
  }

  sendSerial(command) {
    if (!this.usart) return;
    for (const character of `${command.trim()}\n`) this.serialQueue.push(character.charCodeAt(0));
    this.drainSerial();
  }

  drainSerial() {
    if (!this.usart || !this.cpu || this.serialQueue.length === 0) return;
    const receiveRegisterFull = (this.cpu.data[megaUsart0Config.UCSRA] & 0x80) !== 0;
    if (this.usart.rxBusy || receiveRegisterFull) return;
    if (this.usart.writeByte(this.serialQueue[0])) this.serialQueue.shift();
  }

  handleSerialByte(value) {
    const character = String.fromCharCode(value);
    this.serialText += character;
    if (this.serialText.length > 120000) this.serialText = this.serialText.slice(-100000);
    this.onSerial(character, this.serialText);
  }

  snapshot() {
    return {
      axes: { ...this.axes },
      axisExtents: Object.fromEntries(
        Object.entries(this.axisExtents).map(([axis, extent]) => [axis, { ...extent }]),
      ),
      temperatures: { ...this.temperatures },
      duties: { ...this.duties },
      dutyPeaks: { ...this.dutyPeaks },
      statusLed: { ...this.statusLed },
      unexpectedResets: this.unexpectedResets.map((event) => ({ ...event })),
      probe: { ...this.probe, commands: [...this.probe.commands] },
      cycles: this.cpu?.cycles || 0,
      speed: this.speed,
      firmwareSize: this.firmwareSize || 0,
    };
  }
}
