import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const EMULATOR_DIRECTORY = resolve(TEST_DIRECTORY, '..');
const WORKSPACE_DIRECTORY = resolve(EMULATOR_DIRECTORY, '..');
const ELF_PATH = resolve(WORKSPACE_DIRECTORY, 'Marlin Firmware CR20-Pro/.pioenvs/megaatmega2560/firmware.elf');
const BUILD_HEADER_PATH = resolve(WORKSPACE_DIRECTORY, 'Marlin Firmware CR20-Pro/Marlin/src/inc/BuildNumber.h');
const SUITES = ['boot', 'lcd', 'encoder', 'controls', 'serial', 'motion', 'homing', 'thermal', 'sd', 'usb', 'mount', 'benchy', 'menu-print', 'print-controls', 'eeprom', 'layout'];

const buildHeader = await readFile(BUILD_HEADER_PATH, 'utf8');
const buildNumber = buildHeader.match(/^#define BUILD_NUMBER (\d+)$/m)?.[1];
if (!buildNumber) throw new Error(`Build number was not found in ${BUILD_HEADER_PATH}`);
const FIRMWARE_VERSION = `v2.3 - ${buildNumber}`;

const HELP = `CR-20 Pro emulator test runner

Usage:
  npm test -- --all
  npm test -- --suite lcd,encoder
  npm test -- --homing

Selection:
  --all                 Run every suite (default)
  --suite name,name     Run a comma-separated suite list
  --<suite>             Run one named suite, such as --sd or --layout
  --list                Print all suite names

Browser and output:
  --headed              Show Chrome during the run
  --port 4173           Local Vite port when the runner starts a server
  --url URL             Test an already-running emulator
  --timeout 75000       Per-operation timeout in milliseconds
  --output path         Report and screenshot directory
  --help                Show this help`;

function parseArguments(argv) {
  const options = {
    suites: [],
    headed: false,
    port: 4173,
    url: '',
    timeout: 75000,
    output: 'test-results',
    list: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--headed') options.headed = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--list') options.list = true;
    else if (argument === '--all') options.suites = [...SUITES];
    else if (argument === '--suite') options.suites.push(...(argv[++index] || '').split(','));
    else if (argument === '--port') options.port = Number.parseInt(argv[++index], 10);
    else if (argument === '--url') options.url = argv[++index] || '';
    else if (argument === '--timeout') options.timeout = Number.parseInt(argv[++index], 10);
    else if (argument === '--output') options.output = argv[++index] || options.output;
    else if (argument.startsWith('--') && SUITES.includes(argument.slice(2))) options.suites.push(argument.slice(2));
    else throw new Error(`Unknown argument: ${argument}`);
  }

  options.suites = [...new Set(options.suites.filter(Boolean))];
  if (!options.suites.length && !options.list && !options.help) options.suites = [...SUITES];
  for (const suite of options.suites) {
    if (!SUITES.includes(suite)) throw new Error(`Unknown suite: ${suite}`);
  }
  return options;
}

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

async function waitForServer(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The Vite process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureServer(options) {
  const url = options.url || `http://127.0.0.1:${options.port}/`;
  try {
    const response = await fetch(url);
    if (response.ok && (await response.text()).includes('CR-20 Pro Firmware Emulator'))
      return { url, process: null };
  } catch {
    // Start a local server below.
  }

  if (options.url) throw new Error(`No emulator server responded at ${options.url}`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(options.port)], {
    cwd: EMULATOR_DIRECTORY,
    stdio: 'ignore',
  });
  await waitForServer(url, options.timeout);
  return { url, process: child };
}

async function bootPage(browser, url, timeout, viewport = { width: 1440, height: 960 }, testMode = true) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const browserMessages = [];
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserMessages.push(`console: ${message.text()}`);
  });
  const pageUrl = new URL(url);
  if (testMode) pageUrl.searchParams.set('test', '1');
  await page.goto(pageUrl.href, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(() => window.__cr20Emulator?.cpu, null, { timeout });
  await page.locator('#speed').evaluate((input) => {
    input.value = '8';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForFunction(() => window.__cr20Display?.receivedFrame, null, { timeout });
  return { context, page, browserMessages };
}

async function framebufferHash(page) {
  return page.evaluate(() => {
    let hash = 2166136261;
    for (const value of window.__cr20Display.ram) {
      hash ^= value;
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  });
}

async function sendAndWait(page, command, expected, timeout) {
  const offset = await page.evaluate(() => window.__cr20Emulator.serialText.length);
  await page.evaluate((value) => window.__cr20Emulator.sendSerial(value), command);
  await page.waitForFunction(
    ({ start, text }) => window.__cr20Emulator.serialText.slice(start).includes(text),
    { start: offset, text: expected },
    { timeout },
  );
  return page.evaluate((start) => window.__cr20Emulator.serialText.slice(start), offset);
}

async function canvasPixelReport(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#printer-canvas canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let opaque = 0;
    let varied = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0) opaque += 1;
      if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) - Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) > 12) varied += 1;
    }
    return { width, height, opaque, varied };
  });
}

function avrSymbolAddresses(names) {
  const nm = process.env.AVR_NM || `${process.env.HOME}/.platformio/packages/toolchain-atmelavr/bin/avr-nm`;
  const output = execFileSync(nm, ['-C', '-n', ELF_PATH], { encoding: 'utf8' });
  const addresses = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^([0-9a-fA-F]+)\s+\w\s+(.+)$/);
    if (!match || !names.includes(match[2])) continue;
    addresses[match[2]] = Number.parseInt(match[1], 16) - 0x800000;
  }
  for (const name of names) assert(Number.isInteger(addresses[name]), `AVR symbol was not found: ${name}`);
  return addresses;
}

function finishedScreenAddresses() {
  const nm = process.env.AVR_NM || `${process.env.HOME}/.platformio/packages/toolchain-atmelavr/bin/avr-nm`;
  const output = execFileSync(nm, ['-C', '-n', ELF_PATH], { encoding: 'utf8' });
  const screenMatch = output.match(/^([0-9a-fA-F]+)\s+\w\s+menu_print_finished\(\)$/m);
  const pointerMatch = output.match(/^([0-9a-fA-F]+)\s+\w\s+MarlinUI::currentScreen$/m);
  assert(screenMatch && pointerMatch, 'Finished-screen AVR symbols were not found');
  return {
    pointer: Number.parseInt(pointerMatch[1], 16) - 0x800000,
    target: Number.parseInt(screenMatch[1], 16) >> 1,
  };
}

function lcdScreenAddresses(names) {
  const nm = process.env.AVR_NM || `${process.env.HOME}/.platformio/packages/toolchain-atmelavr/bin/avr-nm`;
  const output = execFileSync(nm, ['-C', '-n', ELF_PATH], { encoding: 'utf8' });
  const pointerMatch = output.match(/^([0-9a-fA-F]+)\s+\w\s+MarlinUI::currentScreen$/m);
  assert(pointerMatch, 'LCD current-screen AVR symbol was not found');
  const addresses = { pointer: Number.parseInt(pointerMatch[1], 16) - 0x800000 };
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = output.match(new RegExp(`^([0-9a-fA-F]+)\\s+\\w\\s+${escaped}$`, 'm'));
    assert(match, `LCD screen AVR symbol was not found: ${name}`);
    addresses[name] = Number.parseInt(match[1], 16) >> 1;
  }
  return addresses;
}

async function waitForLcdScreen(page, addresses, name, timeout) {
  await page.waitForFunction(
    ({ pointer, target }) => {
      const data = window.__cr20Emulator.cpu.data;
      return (data[pointer] | (data[pointer + 1] << 8)) === target;
    },
    { pointer: addresses.pointer, target: addresses[name] },
    { timeout },
  );
}

async function waitForFinishedScreen(page, timeout) {
  const addresses = finishedScreenAddresses();
  await page.waitForFunction(
    ({ pointer, target }) => {
      const data = window.__cr20Emulator.cpu.data;
      return (data[pointer] | (data[pointer + 1] << 8)) === target;
    },
    addresses,
    { timeout },
  );
  // The callback changes before Marlin's next LCD draw cycle completes.
  await page.waitForTimeout(500);
  const current = await page.evaluate(({ pointer }) => {
    const data = window.__cr20Emulator.cpu.data;
    return data[pointer] | (data[pointer + 1] << 8);
  }, addresses);
  assert(current === addresses.target, 'Finished-print screen was dismissed before it was drawn', { ...addresses, current });
  return addresses;
}

async function readAvrValues(page, addresses) {
  return page.evaluate((symbols) => {
    const data = window.__cr20Emulator.cpu.data;
    const int16 = (address) => {
      const unsigned = data[address] | (data[address + 1] << 8);
      return unsigned & 0x8000 ? unsigned - 0x10000 : unsigned;
    };
    return {
      betterBed: data[symbols.betterBed],
      overrideEnabled: data[symbols.overrideEnabled],
      overrideNozzle: int16(symbols.overrideNozzle),
      overrideBed: int16(symbols.overrideBed),
      speed: int16(symbols.speed),
      fan: data[symbols.fan],
      hotendTarget: int16(symbols.hotendTarget),
      bedTarget: int16(symbols.bedTarget),
    };
  }, addresses);
}

async function rotateEncoder(page, steps) {
  const direction = Math.sign(steps);
  for (let index = 0; index < Math.abs(steps); index += 1) {
    await page.evaluate((value) => window.__cr20Emulator.rotateEncoder(value), direction);
    await page.waitForTimeout(120);
  }
}

async function pressEncoder(page) {
  await page.evaluate(() => window.__cr20Emulator.pressEncoder());
  await page.waitForTimeout(350);
}

async function clickEncoderStep(page, direction, address, timeout) {
  const before = await page.evaluate((offset) => {
    const data = window.__cr20Emulator.cpu.data;
    return data[offset] | (data[offset + 1] << 8);
  }, address);
  await page.locator(direction > 0 ? '#encoder-down' : '#encoder-up').click();
  const target = (before + direction) & 0xffff;
  await page.waitForFunction(
    ({ offset, value }) => {
      const data = window.__cr20Emulator.cpu.data;
      return (data[offset] | (data[offset + 1] << 8)) === value;
    },
    { offset: address, value: target },
    { timeout },
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (options.list) {
    console.log(SUITES.join('\n'));
    return;
  }

  await mkdir(options.output, { recursive: true });
  const server = await ensureServer(options);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: !options.headed,
  });
  const results = [];
  let desktop;

  const run = async (name, test) => {
    const startedAt = Date.now();
    try {
      const details = await test();
      results.push({ name, status: 'passed', durationMs: Date.now() - startedAt, details });
      console.log(`PASS ${name}`);
    } catch (error) {
      let diagnostics = {};
      try {
        diagnostics = await desktop?.page.evaluate(() => ({
          serialTail: window.__cr20Emulator.serialText.slice(-2500),
          running: window.__cr20Emulator.running,
          cycles: window.__cr20Emulator.cpu.cycles,
          serialQueue: String.fromCharCode(...window.__cr20Emulator.serialQueue),
          uart: {
            rxBusy: window.__cr20Emulator.usart.rxBusy,
            rxEnable: window.__cr20Emulator.usart.rxEnable,
            status: window.__cr20Emulator.cpu.data[window.__cr20Emulator.usart.config.UCSRA],
          },
          axes: { ...window.__cr20Emulator.axes },
          probe: { ...window.__cr20Emulator.probe, commands: [...window.__cr20Emulator.probe.commands] },
          sd: {
            fileName: window.__cr20Emulator.sdCard.fileName,
            idle: window.__cr20Emulator.sdCard.idle,
            selected: window.__cr20Emulator.sdCard.selected,
            multiReadBlock: window.__cr20Emulator.sdCard.multiReadBlock,
            queuedResponses: window.__cr20Emulator.sdCard.response.length,
          },
          sdLabel: document.querySelector('#sd-file-name').textContent,
        })) || {};
      } catch {
        // The original failure is more useful if the page has already closed.
      }
      results.push({
        name,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error: error.message,
        details: { ...(error.details || {}), diagnostics },
      });
      console.error(`FAIL ${name}: ${error.message}`);
    }
  };

  try {
    desktop = await bootPage(browser, server.url, options.timeout);
    const { page } = desktop;

    if (options.suites.includes('boot')) {
      await run('boot', async () => {
        const first = await page.evaluate(() => ({
          cycles: window.__cr20Emulator.cpu.cycles,
          serial: window.__cr20Emulator.serialText,
          state: document.querySelector('#run-state-label').textContent,
          size: window.__cr20Emulator.firmwareSize,
        }));
        await page.waitForTimeout(1200);
        const secondCycles = await page.evaluate(() => window.__cr20Emulator.cpu.cycles);
        const starts = (first.serial.match(/^start$/gm) || []).length;
        assert(first.serial.includes(`Marlin ${FIRMWARE_VERSION}`), 'Firmware version was not reported', first);
        assert(first.serial.includes('SD card ok') && !first.serial.includes('SD init fail'), 'Virtual SD did not initialize', first);
        assert(first.state === 'Firmware running', 'Firmware did not reach running state', first);
        assert(first.size > 100000, 'Firmware image was unexpectedly small', first);
        assert(secondCycles > first.cycles, 'AVR cycles stopped advancing');
        assert(starts === 1, 'Firmware unexpectedly restarted during boot', { starts });
        assert(desktop.browserMessages.length === 0, 'Browser errors occurred', { messages: desktop.browserMessages });
        return { firmwareBytes: first.size, cycles: secondCycles, starts };
      });
    }

    if (options.suites.includes('lcd')) {
      await run('lcd', async () => {
        const details = await page.evaluate(() => ({
          displayOn: window.__cr20Display.displayOn,
          receivedFrame: window.__cr20Display.receivedFrame,
          nonzeroBytes: Array.from(window.__cr20Display.ram).filter(Boolean).length,
          byteSum: window.__cr20Display.ram.reduce((sum, value) => sum + value, 0),
        }));
        assert(details.displayOn, 'UC1701 display remained off', details);
        assert(details.receivedFrame, 'No complete 128x64 frame was received', details);
        assert(details.nonzeroBytes > 150, 'LCD framebuffer appears blank', details);
        await page.screenshot({ path: `${options.output}/desktop.png`, fullPage: true });
        return details;
      });
    }

    if (options.suites.includes('encoder')) {
      await run('encoder', async () => {
        const statusHash = await framebufferHash(page);
        await page.locator('#encoder').click();
        await page.waitForTimeout(900);
        const menuHash = await framebufferHash(page);
        const bounds = await page.locator('#encoder').boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(900);
        const rotatedHash = await framebufferHash(page);
        await page.locator('#encoder-up').click();
        await page.waitForTimeout(900);
        const upButtonHash = await framebufferHash(page);
        await page.locator('#encoder-down').click();
        await page.waitForTimeout(900);
        const downButtonHash = await framebufferHash(page);
        assert(menuHash !== statusHash, 'Encoder press did not open the main menu', { statusHash, menuHash });
        assert(rotatedHash !== menuHash, 'Encoder rotation did not change menu selection', { menuHash, rotatedHash });
        assert(upButtonHash !== rotatedHash, 'Up button did not rotate the encoder one notch', { rotatedHash, upButtonHash });
        assert(downButtonHash === rotatedHash, 'Down button did not reverse the up-button notch', { rotatedHash, downButtonHash });
        return { statusHash, menuHash, rotatedHash, upButtonHash, downButtonHash };
      });
    }

    if (options.suites.includes('controls')) {
      await run('controls', async () => {
        await page.locator('#speed').evaluate((input) => {
          input.value = '2';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const speed = await page.evaluate(() => ({
          value: window.__cr20Emulator.speed,
          label: document.querySelector('#speed-value').textContent,
        }));
        assert(speed.value === 2 && speed.label === '2.00×', 'Speed control did not update the emulator', speed);

        const turboCyclesBefore = await page.evaluate(() => window.__cr20Emulator.cpu.cycles);
        await page.locator('#speed').evaluate((input) => {
          input.value = '250';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForTimeout(250);
        const turbo = await page.evaluate((before) => ({
          maximum: document.querySelector('#speed').max,
          value: window.__cr20Emulator.speed,
          label: document.querySelector('#speed-value').textContent,
          cyclesAdvanced: window.__cr20Emulator.cpu.cycles - before,
        }), turboCyclesBefore);
        assert(turbo.maximum === '250' && turbo.value === 250 && turbo.label === '250×', '250x turbo control did not update the emulator', turbo);
        assert(turbo.cyclesAdvanced > 0, 'AVR cycles stopped in 250x turbo mode', turbo);
        await page.locator('#speed').evaluate((input) => {
          input.value = '2';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        await page.locator('#pause-button').click();
        await page.waitForFunction(() => !window.__cr20Emulator.running);
        const pausedCycles = await page.evaluate(() => window.__cr20Emulator.cpu.cycles);
        await page.waitForTimeout(250);
        const stillPausedCycles = await page.evaluate(() => window.__cr20Emulator.cpu.cycles);
        assert(stillPausedCycles === pausedCycles, 'CPU cycles advanced while paused', { pausedCycles, stillPausedCycles });
        await page.locator('#pause-button').click();
        await page.waitForFunction((cycles) => window.__cr20Emulator.running && window.__cr20Emulator.cpu.cycles > cycles, pausedCycles);

        const serialOffset = await page.evaluate(() => window.__cr20Emulator.serialText.length);
        await page.locator('#serial-input').fill('M115');
        await page.locator('#serial-form button[type="submit"]').click();
        await page.waitForFunction(
          (start) => window.__cr20Emulator.serialText.slice(start).includes('FIRMWARE_NAME:'),
          serialOffset,
          { timeout: options.timeout },
        );
        assert(await page.locator('#serial-input').inputValue() === '', 'Serial form did not clear after sending');

        await page.locator('#clear-console').click();
        const cleared = await page.evaluate(() => ({
          model: window.__cr20Emulator.serialText,
          view: document.querySelector('#serial-output').textContent,
        }));
        assert(cleared.model === '' && cleared.view === '', 'Clear console did not clear both console buffers', cleared);

        await page.locator('#reset-button').click();
        await page.waitForFunction(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length > 0, null, { timeout: options.timeout });
        await page.waitForFunction(() => document.querySelector('#run-state-label').textContent === 'Firmware running', null, { timeout: options.timeout });
        await page.locator('#speed').evaluate((input) => {
          input.value = '4';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const reset = await page.evaluate(() => ({
          running: window.__cr20Emulator.running,
          speed: window.__cr20Emulator.speed,
          starts: (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length,
          state: document.querySelector('#run-state-label').textContent,
        }));
        assert(reset.running && reset.speed === 4 && reset.starts === 1 && reset.state === 'Firmware running', 'Reset control did not reboot into a running state', reset);
        return { speed, turbo, pausedCycles, reset };
      });
    }

    if (options.suites.includes('serial')) {
      await run('serial', async () => {
        const response = await sendAndWait(page, 'M115', 'Cap:EEPROM:1', options.timeout);
        assert(response.includes('MACHINE_TYPE:CR-20 Pro'), 'M115 reported the wrong machine', { response });
        assert(response.includes('Cap:EEPROM:1'), 'M115 did not report EEPROM capability', { response });
        return { response: response.slice(0, 500) };
      });
    }

    if (options.suites.includes('motion')) {
      await run('motion', async () => {
        const before = await page.evaluate(() => ({ ...window.__cr20Emulator.axes }));
        await sendAndWait(page, 'G91', 'ok', options.timeout);
        await page.evaluate(() => window.__cr20Emulator.sendSerial('G1 X3 Y2 Z1 F600'));
        await page.waitForFunction(
          (origin) => {
            const axes = window.__cr20Emulator.axes;
            return axes.x > origin.x + 2.8 && axes.y > origin.y + 1.8 && axes.z > origin.z + 0.8;
          },
          before,
          { timeout: options.timeout },
        );
        const after = await page.evaluate(() => ({ ...window.__cr20Emulator.axes }));
        assert(after.x > before.x && after.y > before.y && after.z > before.z, 'A positive move used the wrong direction', { before, after });
        await page.evaluate(() => window.__cr20Emulator.sendSerial('G1 X-3 Y-2 Z-1 F600'));
        await sendAndWait(page, 'M400', 'ok', options.timeout);
        const returned = await page.evaluate(() => ({ ...window.__cr20Emulator.axes }));
        for (const axis of ['x', 'y', 'z']) {
          assert(Math.abs(returned[axis] - before[axis]) < 0.15, `Negative ${axis.toUpperCase()} move did not return to the starting point`, { before, after, returned });
        }
        await sendAndWait(page, 'G90', 'ok', options.timeout);
        return { before, after, returned };
      });
    }

    if (options.suites.includes('homing')) {
      await run('homing', async () => {
        const before = await page.evaluate(() => ({ ...window.__cr20Emulator.axes }));
        const startsBefore = await page.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);
        await page.evaluate(() => window.__cr20Emulator.resetTrace());
        const response = await sendAndWait(page, 'G28', 'ok', options.timeout);
        const leveling = await sendAndWait(page, 'M420 S1 Z2', 'ok', options.timeout);
        const after = await page.evaluate(() => ({
          axes: { ...window.__cr20Emulator.axes },
          extents: structuredClone(window.__cr20Emulator.axisExtents),
          probe: {
            deployed: window.__cr20Emulator.probe.deployed,
            triggered: window.__cr20Emulator.probe.triggered,
            commands: [...window.__cr20Emulator.probe.commands],
            triggerCount: window.__cr20Emulator.probe.triggerCount,
          },
          starts: (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length,
          unexpectedResets: window.__cr20Emulator.unexpectedResets.map((event) => ({ ...event })),
        }));
        assert(!response.includes('BLTouch error') && !response.includes('Homing failed'), 'Firmware reported a homing failure', { response, after });
        assert(after.probe.commands.includes(10) && after.probe.commands.includes(90), 'BLTouch did not receive both deploy and stow commands', after);
        assert(after.probe.triggerCount >= 2, 'BLTouch did not register both Z homing contacts', after);
        assert(!after.probe.deployed && !after.probe.triggered, 'BLTouch was not safely stowed after homing', after);
        assert(after.extents.x.min <= 0.05 && after.extents.y.min <= 0.05, 'X/Y endstops did not stop homing travel', { before, after });
        assert(after.extents.z.min <= 0.15, 'The BLTouch did not stop Z homing near the bed', { before, after });
        assert(after.starts === startsBefore, 'Firmware restarted after G28 and M420', { startsBefore, leveling, after });
        assert(after.unexpectedResets.length === 0, 'AVR reset after G28 and M420', after);
        return { before, response: response.trim(), leveling: leveling.trim(), ...after };
      });
    }

    if (options.suites.includes('thermal')) {
      await run('thermal', async () => {
        const before = await page.evaluate(() => ({ ...window.__cr20Emulator.temperatures }));
        await sendAndWait(page, 'M104 S45', 'ok', options.timeout);
        await sendAndWait(page, 'M140 S35', 'ok', options.timeout);
        await sendAndWait(page, 'M106 S128', 'ok', options.timeout);
        await page.waitForFunction(
          (start) => window.__cr20Emulator.temperatures.hotend > start.hotend + 3 && window.__cr20Emulator.temperatures.bed > start.bed + 1,
          before,
          { timeout: options.timeout },
        );
        const heated = await page.evaluate(() => ({
          temperatures: { ...window.__cr20Emulator.temperatures },
          duties: { ...window.__cr20Emulator.duties },
          dutyPeaks: { ...window.__cr20Emulator.dutyPeaks },
        }));
        await sendAndWait(page, 'M104 S0', 'ok', options.timeout);
        await sendAndWait(page, 'M140 S0', 'ok', options.timeout);
        await sendAndWait(page, 'M106 S0', 'ok', options.timeout);
        assert(heated.dutyPeaks.hotend > 0.9, 'Hotend heater output never turned fully on', heated);
        assert(heated.dutyPeaks.bed > 0.9, 'Bed heater output never turned fully on', heated);
        assert(heated.duties.fan > 0.35 && heated.duties.fan < 0.65, 'Part-cooling fan did not run near half speed', heated);
        return { before, ...heated };
      });
    }

    if (options.suites.includes('sd')) {
      await run('sd', async () => {
        const startsBefore = await page.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);
        const listing = await sendAndWait(page, 'M20', 'End file list', options.timeout);
        assert(listing.includes('DEMO.GCO'), 'Built-in SD test file was not listed', { listing });
        const selected = await sendAndWait(page, 'M23 DEMO.GCO', 'File selected', options.timeout);
        const size = Number(selected.match(/Size: (\d+)/)?.[1]);
        assert(size > 100, 'SD file size was not read from FAT16', { selected });
        const statusHash = await framebufferHash(page);
        const offset = await page.evaluate(() => window.__cr20Emulator.serialText.length);
        await sendAndWait(page, 'M24', 'ok', options.timeout);
        await page.waitForTimeout(120);
        const progress = await sendAndWait(page, 'M27', `/${size}`, options.timeout);
        const match = progress.match(/SD printing byte (\d+)\/(\d+)/);
        assert(match, 'M27 did not report SD byte progress', { progress });
        assert(Number(match[1]) > 0 && Number(match[1]) < Number(match[2]), 'SD print did not report in-progress bytes', { progress });
        await page.waitForFunction(
          (start) => window.__cr20Emulator.serialText.slice(start).includes('Done printing file'),
          offset,
          { timeout: options.timeout },
        );
        const finishedScreen = await waitForFinishedScreen(page, options.timeout);
        const completed = await page.evaluate((start) => window.__cr20Emulator.serialText.slice(start), offset);
        const finishedHash = await framebufferHash(page);
        const startsAfter = await page.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);
        assert(startsAfter === startsBefore, 'Firmware reset during the SD print', { startsBefore, startsAfter, completed });
        assert(finishedHash !== statusHash, 'Finished-print screen was not shown after the SD print', { statusHash, finishedHash });
        await page.screenshot({ path: `${options.output}/sd-print-finished.png`, fullPage: true });

        return { listing, size, progress, completed: completed.trim(), statusHash, finishedHash, finishedScreen };
      });
    }

    if (options.suites.includes('usb')) {
      await run('usb', async () => {
        const usb = await bootPage(browser, server.url, options.timeout);
        try {
          const startsBefore = await usb.page.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);
          await sendAndWait(usb.page, 'G91', 'ok', options.timeout);
          await sendAndWait(usb.page, 'M75', 'ok', options.timeout);
          const progressStart = await sendAndWait(usb.page, 'M73 P5', 'ok', options.timeout);
          assert(!progressStart.includes('Unknown command'), 'M73 USB progress support is disabled', { progressStart });
          await sendAndWait(usb.page, 'G1 X1 E1 F1200', 'ok', options.timeout);
          const progressEnd = await sendAndWait(usb.page, 'M73 P100', 'ok', options.timeout);
          assert(!progressEnd.includes('Unknown command'), 'M73 USB progress support is disabled', { progressEnd });
          const printingHash = await framebufferHash(usb.page);
          await sendAndWait(usb.page, 'M77', 'ok', options.timeout);
          const finishedScreen = await waitForFinishedScreen(usb.page, options.timeout);
          const finishedHash = await framebufferHash(usb.page);
          const state = await usb.page.evaluate(() => ({
            axes: { ...window.__cr20Emulator.axes },
            starts: (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length,
          }));
          assert(state.starts === startsBefore, 'Firmware reset during the USB print', { startsBefore, state });
          assert(finishedHash !== printingHash, 'Finished-print screen was not shown after M77', { printingHash, finishedHash });
          assert(usb.browserMessages.length === 0, 'Browser errors occurred during USB print', { messages: usb.browserMessages });
          await usb.page.screenshot({ path: `${options.output}/usb-print-finished.png`, fullPage: true });
          return { ...state, printingHash, finishedHash, finishedScreen };
        } finally {
          await usb.context.close();
        }
      });
    }

    if (options.suites.includes('mount')) {
      await run('mount', async () => {
        const mounted = await bootPage(browser, server.url, options.timeout);
        try {
          const mountOffset = await mounted.page.evaluate(() => window.__cr20Emulator.serialText.length);
          await mounted.page.locator('#sd-file-input').setInputFiles({
            name: 'mounted-test.gcode',
            mimeType: 'text/x-gcode',
            buffer: Buffer.from('; mounted through the browser\nG90\nG1 X1 F600\n'),
          });
          await mounted.page.waitForFunction(() => document.querySelector('#sd-file-name').textContent === 'MOUNTEDT.GCO');
          await mounted.page.waitForFunction(
            (start) => window.__cr20Emulator.serialText.slice(start).includes('SD card ok'),
            mountOffset,
            { timeout: options.timeout },
          );
          const listing = await sendAndWait(mounted.page, 'M20', 'End file list', options.timeout);
          assert(listing.includes('MOUNTEDT.GCO 45'), 'Browser-mounted G-code was not visible to the firmware', { listing });
          assert(mounted.browserMessages.length === 0, 'Browser errors occurred while mounting G-code', { messages: mounted.browserMessages });
          return { fileName: 'MOUNTEDT.GCO', listing };
        } finally {
          await mounted.context.close();
        }
      });
    }

    if (options.suites.includes('benchy')) {
      await run('benchy', async () => {
        const benchy = await bootPage(browser, server.url, options.timeout, { width: 1280, height: 800 }, false);
        try {
          const details = await benchy.page.evaluate(() => ({
            fileName: window.__cr20Emulator.sdCard.fileName,
            imageBytes: window.__cr20Emulator.sdCard.image.length,
            sectors: window.__cr20Emulator.sdCard.sectorCount,
          }));
          const listing = await sendAndWait(benchy.page, 'M20', 'End file list', options.timeout);
          assert(details.fileName === '3DBENCHY.GCO', 'Bundled Benchy was not mounted at startup', details);
          assert(listing.includes('3DBENCHY.GCO 5337861'), 'Bundled Benchy size or FAT entry was incorrect', { details, listing });
          assert(details.imageBytes > 5337861, 'Virtual SD did not expand for the Benchy', details);
          assert(benchy.browserMessages.length === 0, 'Browser errors occurred while loading Benchy', { messages: benchy.browserMessages });
          return { ...details, listing };
        } finally {
          await benchy.context.close();
        }
      });
    }

    if (options.suites.includes('menu-print')) {
      await run('menu-print', async () => {
        await desktop.page.evaluate(() => window.__cr20Emulator.pause());
        const menuPrint = await bootPage(browser, server.url, options.timeout, { width: 1440, height: 960 }, false);
        let stage = 'boot';
        try {
          const { page: menuPage } = menuPrint;
          const screens = lcdScreenAddresses([
            'MarlinUI::status_screen()',
            'menu_main()',
            'menu_sdcard()',
            'menu_sd_confirm()',
          ]);
          const encoderPosition = avrSymbolAddresses(['MarlinUI::encoderPosition'])['MarlinUI::encoderPosition'];
          const sdPosition = avrSymbolAddresses(['CardReader::sdpos'])['CardReader::sdpos'];
          const temperatureSymbols = avrSymbolAddresses([
            'Temperature::temp_hotend',
            'Temperature::temp_bed',
          ]);
          const temperatureAddresses = {
            hotend: temperatureSymbols['Temperature::temp_hotend'],
            bed: temperatureSymbols['Temperature::temp_bed'],
          };
          await waitForLcdScreen(menuPage, screens, 'MarlinUI::status_screen()', options.timeout);
          await menuPage.evaluate(() => window.__cr20Emulator.setSpeed(2));
          await menuPage.waitForTimeout(350);
          const startingBed = await menuPage.evaluate(() => window.__cr20Emulator.temperatures.bed);
          const startsBefore = await menuPage.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);

          stage = 'open main menu';
          await pressEncoder(menuPage);
          await waitForLcdScreen(menuPage, screens, 'menu_main()', options.timeout);
          stage = 'select Print from SD';
          for (let index = 0; index < 7; index += 1) {
            stage = `select Print from SD (${index + 1}/7)`;
            await clickEncoderStep(menuPage, 1, encoderPosition, options.timeout);
          }
          await pressEncoder(menuPage);
          await waitForLcdScreen(menuPage, screens, 'menu_sdcard()', options.timeout);
          stage = 'select Benchy';
          await clickEncoderStep(menuPage, 1, encoderPosition, options.timeout);
          await pressEncoder(menuPage);
          await waitForLcdScreen(menuPage, screens, 'menu_sd_confirm()', options.timeout);
          stage = 'confirm Print';
          await menuPage.locator('#encoder-down').click();
          await menuPage.waitForTimeout(500);
          await pressEncoder(menuPage);
          await menuPage.evaluate(() => window.__cr20Emulator.setSpeed(8));

          stage = 'open file';
          await menuPage.waitForFunction(
            () => window.__cr20Emulator.serialText.includes('File opened: 3dbenchy.gco Size: 5337861'),
            null,
            { timeout: options.timeout },
          );
          const cyclesAtStart = await menuPage.evaluate(() => window.__cr20Emulator.cpu.cycles);
          stage = 'bed heating';
          await menuPage.waitForFunction(
            (start) => window.__cr20Emulator.temperatures.bed > start + 0.75,
            startingBed,
            { timeout: options.timeout },
          );
          const details = await menuPage.evaluate(() => ({
            cycles: window.__cr20Emulator.cpu.cycles,
            bed: window.__cr20Emulator.temperatures.bed,
            bedDuty: window.__cr20Emulator.duties.bed,
            led: { ...window.__cr20Emulator.statusLed },
            serial: window.__cr20Emulator.serialText.slice(-1200),
          }));
          assert(details.cycles > cyclesAtStart, 'AVR stopped after the menu Print action', details);
          assert(details.bedDuty > 0.5, 'M190 did not drive the emulated bed heater', details);
          assert(details.led.b > 0, 'PCA9632 bed-heating LED was not updated over TWI', details);
          assert(details.serial.includes('B@:127'), 'Firmware did not report active bed-heater power', details);

          stage = 'complete heating and homing';
          await menuPage.evaluate((addresses) => {
            const readInt16 = (data, address) => {
              const value = data[address] | (data[address + 1] << 8);
              return value & 0x8000 ? value - 0x10000 : value;
            };
            window.__menuPrintThermalAssist = setInterval(() => {
              const emulator = window.__cr20Emulator;
              const data = emulator.cpu.data;
              const view = emulator.cpu.dataView;
              const hotendTarget = readInt16(data, addresses.hotend + 8);
              const bedTarget = readInt16(data, addresses.bed + 8);
              if (hotendTarget > 0)
                emulator.temperatures.hotend += hotendTarget - view.getFloat32(addresses.hotend + 4, true);
              if (bedTarget > 0)
                emulator.temperatures.bed += bedTarget - view.getFloat32(addresses.bed + 4, true);
              emulator.updateAdc();
            }, 20);
          }, temperatureAddresses);
          await menuPage.waitForFunction(
            ({ offset, minimum }) => {
              const emulator = window.__cr20Emulator;
              const data = emulator.cpu.data;
              const position = (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
              return position > minimum && emulator.axisExtents.x.min < 10 && emulator.axisExtents.y.min < 10;
            },
            { offset: sdPosition, minimum: 1000 },
            { timeout: options.timeout },
          );
          const progressed = await menuPage.evaluate((offset) => {
            const emulator = window.__cr20Emulator;
            const data = emulator.cpu.data;
            return {
              starts: (emulator.serialText.match(/^start$/gm) || []).length,
              sdPosition: (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0,
              temperatures: { ...emulator.temperatures },
              axes: { ...emulator.axes },
              extents: Object.fromEntries(Object.entries(emulator.axisExtents).map(([axis, value]) => [axis, { ...value }])),
            };
          }, sdPosition);
          assert(progressed.starts === startsBefore, 'Firmware reset after startup heating', { startsBefore, progressed });
          assert(progressed.temperatures.hotend > 180 && progressed.temperatures.bed > 45, 'Print advanced before both heaters reached their targets', progressed);
          assert(progressed.extents.x.min < 10 && progressed.extents.y.min < 10, 'Print did not advance through X/Y homing', progressed);
          assert(menuPrint.browserMessages.length === 0, 'Browser errors occurred during menu printing', { messages: menuPrint.browserMessages });
          await menuPage.screenshot({ path: `${options.output}/menu-print-heating.png`, fullPage: true });
          return { heating: details, progressed };
        } catch (error) {
          const state = await menuPrint.page.evaluate(() => ({
            serialTail: window.__cr20Emulator.serialText.slice(-2000),
            cycles: window.__cr20Emulator.cpu.cycles,
            inputEvents: window.__cr20Emulator.inputEvents.length,
            encoderPosition: (() => {
              const data = window.__cr20Emulator.cpu.data;
              return data[0x0bf3] | (data[0x0bf4] << 8);
            })(),
            bed: window.__cr20Emulator.temperatures.bed,
            bedDuty: window.__cr20Emulator.duties.bed,
            led: { ...window.__cr20Emulator.statusLed },
          })).catch(() => ({}));
          error.details = { ...(error.details || {}), stage, menuPrint: state };
          throw error;
        } finally {
          await menuPrint.page.evaluate(() => {
            clearInterval(window.__menuPrintThermalAssist);
            delete window.__menuPrintThermalAssist;
          }).catch(() => {});
          await menuPrint.context.close();
          await desktop.page.evaluate(() => window.__cr20Emulator.resume()).catch(() => {});
        }
      });
    }

    if (options.suites.includes('print-controls')) {
      await run('print-controls', async () => {
        const controlled = await bootPage(browser, server.url, options.timeout);
        let stage = 'symbols';
        const symbols = avrSymbolAddresses([
          'better_bed_enabled',
          'override_slicer_temp_settings',
          'override_slicer_hotend_temp',
          'override_slicer_bed_temp',
          'feedrate_percentage',
          'Temperature::fan_speed',
          'Temperature::temp_hotend',
          'Temperature::temp_bed',
        ]);
        const addresses = {
          betterBed: symbols.better_bed_enabled,
          overrideEnabled: symbols.override_slicer_temp_settings,
          overrideNozzle: symbols.override_slicer_hotend_temp,
          overrideBed: symbols.override_slicer_bed_temp,
          speed: symbols.feedrate_percentage,
          fan: symbols['Temperature::fan_speed'],
          hotendTarget: symbols['Temperature::temp_hotend'] + 8,
          bedTarget: symbols['Temperature::temp_bed'] + 8,
        };

        try {
          stage = 'defaults';
          const defaults = await readAvrValues(controlled.page, addresses);
          assert(defaults.betterBed === 1, 'Better Bed was not enabled by default', defaults);
          assert(defaults.overrideEnabled === 0, 'Slicer temperature override was not disabled by default', defaults);
          assert(defaults.overrideNozzle === 200 && defaults.overrideBed === 60, 'Override temperatures had the wrong defaults', defaults);

          stage = 'enable override';
          await controlled.page.evaluate((address) => {
            window.__cr20Emulator.cpu.data[address] = 1;
          }, addresses.overrideEnabled);

          stage = 'store custom settings';
          await sendAndWait(controlled.page, 'M500', 'Settings Stored', options.timeout);
          await controlled.page.evaluate((address) => {
            window.__cr20Emulator.cpu.data[address] = 0;
          }, addresses.overrideEnabled);
          stage = 'reload custom settings';
          await sendAndWait(controlled.page, 'M501', 'stored settings retrieved', options.timeout);
          await controlled.page.waitForFunction(
            (address) => window.__cr20Emulator.cpu.data[address] === 1,
            addresses.overrideEnabled,
            { timeout: options.timeout },
          );
          const persisted = await readAvrValues(controlled.page, addresses);
          assert(persisted.betterBed === 1 && persisted.overrideEnabled === 1, 'Temperature controls did not persist through reset', persisted);

          const lines = ['M104 S190', 'M140 S50', 'M106 S64', ';LAYER:0'];
          lines.push('G4 P8000');
          lines.push(';LAYER:1');
          lines.push('G4 P8000');
          lines.push(';LAYER:2');
          lines.push('G4 P5000');
          lines.push('M104 S0', 'M140 S0', 'M107', '');

          stage = 'mount fixture';
          const mountOffset = await controlled.page.evaluate(() => window.__cr20Emulator.serialText.length);
          await controlled.page.locator('#sd-file-input').setInputFiles({
            name: 'print-controls.gcode',
            mimeType: 'text/x-gcode',
            buffer: Buffer.from(lines.join('\n')),
          });
          await controlled.page.waitForFunction(() => document.querySelector('#sd-file-name').textContent === 'PRINTCON.GCO');
          await controlled.page.waitForFunction(
            (start) => window.__cr20Emulator.serialText.slice(start).includes('SD card ok'),
            mountOffset,
            { timeout: options.timeout },
          );
          stage = 'select fixture';
          await sendAndWait(controlled.page, 'M23 PRINTCON.GCO', 'File selected', options.timeout);
          const doneOffset = await controlled.page.evaluate(() => window.__cr20Emulator.serialText.length);
          stage = 'start fixture';
          await sendAndWait(controlled.page, 'M24', 'ok', options.timeout);

          stage = 'first layer values';
          await controlled.page.waitForFunction(
            ({ speed, fan }) => {
              const data = window.__cr20Emulator.cpu.data;
              return (data[speed] | (data[speed + 1] << 8)) === 70 && data[fan] === 255;
            },
            { speed: addresses.speed, fan: addresses.fan },
            { timeout: options.timeout },
          );
          const early = await readAvrValues(controlled.page, addresses);
          assert(early.hotendTarget === 200 && early.bedTarget === 60, 'SD temperatures were not overridden to 200/60', early);

          await controlled.page.screenshot({ path: `${options.output}/first-layer-status.png`, fullPage: true });

          stage = 'third layer values';
          await controlled.page.waitForFunction(
            ({ speed, fan }) => {
              const data = window.__cr20Emulator.cpu.data;
              return (data[speed] | (data[speed + 1] << 8)) === 100 && data[fan] === 64;
            },
            { speed: addresses.speed, fan: addresses.fan },
            { timeout: options.timeout },
          );
          const restored = await readAvrValues(controlled.page, addresses);
          await controlled.page.screenshot({ path: `${options.output}/third-layer-status.png`, fullPage: true });

          stage = 'print completion';
          await controlled.page.waitForFunction(
            (start) => window.__cr20Emulator.serialText.slice(start).includes('Done printing file'),
            doneOffset,
            { timeout: options.timeout },
          );
          await waitForFinishedScreen(controlled.page, options.timeout);
          await controlled.page.screenshot({ path: `${options.output}/print-controls-finished.png`, fullPage: true });
          stage = 'heater off values';
          const cooled = await readAvrValues(controlled.page, addresses);
          assert(cooled.hotendTarget === 0 && cooled.bedTarget === 0, 'Heater-off commands were overridden', cooled);
          assert(controlled.browserMessages.length === 0, 'Browser errors occurred during print-controls test', { messages: controlled.browserMessages });

          return { defaults, persisted, early, restored, cooled };
        } catch (error) {
          const state = await controlled.page.evaluate(() => ({
            serialTail: window.__cr20Emulator.serialText.slice(-3000),
            fileName: window.__cr20Emulator.sdCard.fileName,
            axes: { ...window.__cr20Emulator.axes },
          })).catch(() => ({}));
          error.details = { ...(error.details || {}), stage, controlled: state };
          throw error;
        } finally {
          await controlled.context.close();
        }
      });
    }

    if (options.suites.includes('eeprom')) {
      await run('eeprom', async () => {
        const persistent = await bootPage(browser, server.url, options.timeout);
        try {
          await sendAndWait(persistent.page, 'M500', 'Settings Stored', options.timeout);
          await persistent.page.waitForTimeout(300);
          const before = await persistent.page.evaluate(() => ({
            checksum: window.__cr20Emulator.eepromBackend.memory.reduce((sum, value, index) => (sum + value * (index + 1)) >>> 0, 0),
            changed: Array.from(window.__cr20Emulator.eepromBackend.memory).filter((value) => value !== 0xff).length,
            starts: (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length,
          }));
          await persistent.page.evaluate(() => window.__cr20Emulator.reset());
          await persistent.page.waitForFunction(
            (count) => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length > count,
            before.starts,
            { timeout: options.timeout },
          );
          const after = await persistent.page.evaluate(() => ({
            checksum: window.__cr20Emulator.eepromBackend.memory.reduce((sum, value, index) => (sum + value * (index + 1)) >>> 0, 0),
            serial: window.__cr20Emulator.serialText.slice(window.__cr20Emulator.serialText.lastIndexOf('start')),
          }));
          assert(before.changed > 50, 'M500 did not write virtual EEPROM', before);
          assert(after.checksum === before.checksum, 'EEPROM changed across reset', { before, after });
          assert(!after.serial.includes('EEPROM version mismatch'), 'Stored EEPROM was not loaded after reset', { serial: after.serial });
          assert(persistent.browserMessages.length === 0, 'Browser errors occurred during EEPROM persistence test', { messages: persistent.browserMessages });
          return { changedBytes: before.changed, checksum: after.checksum };
        } finally {
          await persistent.context.close();
        }
      });
    }

    if (options.suites.includes('layout')) {
      await run('layout', async () => {
        const desktopLayout = await page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          clientWidth: document.body.clientWidth,
          scrollHeight: document.body.scrollHeight,
          clientHeight: document.body.clientHeight,
          camera: window.__cr20Scene.camera.position.toArray(),
        }));
        const desktopPixels = await canvasPixelReport(page);
        await page.screenshot({ path: `${options.output}/desktop.png`, fullPage: true });
        const canvasBounds = await page.locator('#printer-canvas canvas').boundingBox();
        await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.55, canvasBounds.y + canvasBounds.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.68, canvasBounds.y + canvasBounds.height * 0.5, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const movedCamera = await page.evaluate(() => window.__cr20Scene.camera.position.toArray());
        assert(desktopLayout.scrollWidth === desktopLayout.clientWidth, 'Desktop layout has horizontal overflow', desktopLayout);
        assert(desktopPixels.opaque > 10000 && desktopPixels.varied > 1000, 'Desktop WebGL canvas appears blank', desktopPixels);
        assert(JSON.stringify(movedCamera) !== JSON.stringify(desktopLayout.camera), '3D orbit control did not move the camera');

        const mechanism = await page.evaluate(() => {
          const scene = window.__cr20Scene;
          scene.clearPrint();
          scene.depositFilament({ x: 110, y: 110, z: 0.2 });
          scene.depositFilament({ x: 120, y: 110, z: 0.2 });
          const fanBefore = scene.fan.rotation.y;
          scene.setFanDuty(1);
          scene.setProbe({ deployed: true });
          scene.setAxes({ x: 130, y: 140, z: 20 });
          for (let index = 0; index < 40; index += 1) scene.stepVisuals();
          return {
            traceSegments: scene.filamentSegmentCount,
            fanBefore,
            fanAfter: scene.fan.rotation.y,
            bedZ: scene.bedGroup.position.z,
            carriageX: scene.carriageGroup.position.x,
            gantryY: scene.gantryGroup.position.y,
            probeY: scene.probePin.position.y,
          };
        });
        assert(mechanism.traceSegments === 1, 'Deposited filament trace was not created', mechanism);
        assert(mechanism.fanAfter !== mechanism.fanBefore, 'Part-cooling fan did not spin', mechanism);
        assert(Math.abs(mechanism.bedZ + 1.705) < 0.02, 'Bed did not follow the Y axis around the nozzle center', mechanism);
        assert(Math.abs(mechanism.carriageX - 0.125) < 0.02, 'Carriage did not follow the X axis', mechanism);
        assert(Math.abs(mechanism.gantryY - 2.22) < 0.02, 'Gantry did not follow the Z axis', mechanism);
        assert(mechanism.probeY < -0.99, 'BLTouch pin did not deploy in the 3D view', mechanism);

        const bedTravel = await page.evaluate(() => {
          const scene = window.__cr20Scene;
          const readAt = (y) => {
            scene.axisShown.y = y;
            scene.axisTargets.y = y;
            scene.updateAxisTransforms();
            return scene.bedGroup.position.z;
          };
          return { home: readAt(0), center: readAt(117.5), maximum: readAt(235) };
        });
        assert(Math.abs(bedTravel.center + 1.48) < 0.001, 'Bed center was not aligned beneath the nozzle', bedTravel);
        assert(Math.abs((bedTravel.home - bedTravel.center) - 1.175) < 0.001, 'Bed home travel was not centered', bedTravel);
        assert(Math.abs((bedTravel.maximum - bedTravel.center) + 1.175) < 0.001, 'Bed maximum travel was not centered', bedTravel);

        const mobile = await bootPage(browser, server.url, options.timeout, { width: 390, height: 844 });
        const mobileLayout = await mobile.page.evaluate(() => ({
          scrollWidth: document.body.scrollWidth,
          clientWidth: document.body.clientWidth,
          commandBottom: document.querySelector('.command-row').getBoundingClientRect().bottom,
          footerTop: document.querySelector('.panel-footer').getBoundingClientRect().top,
          controls: Array.from(document.querySelectorAll('button,input,canvas')).map((element) => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName, left: rect.left, right: rect.right, width: rect.width };
          }),
        }));
        const mobilePixels = await canvasPixelReport(mobile.page);
        await mobile.page.screenshot({ path: `${options.output}/mobile.png`, fullPage: true });
        await mobile.context.close();
        assert(mobileLayout.scrollWidth === mobileLayout.clientWidth, 'Mobile layout has horizontal overflow', mobileLayout);
        assert(mobileLayout.controls.every((item) => item.left >= -1 && item.right <= mobileLayout.clientWidth + 1), 'A mobile control extends outside the viewport', mobileLayout);
        assert(mobileLayout.footerTop >= mobileLayout.commandBottom, 'Mobile footer overlaps the command controls', mobileLayout);
        assert(mobilePixels.opaque > 10000 && mobilePixels.varied > 1000, 'Mobile WebGL canvas appears blank', mobilePixels);
        return { desktop: { ...desktopLayout, pixels: desktopPixels }, mobile: { ...mobileLayout, pixels: mobilePixels }, movedCamera, mechanism, bedTravel };
      });
    }
  } finally {
    await desktop?.context.close();
    await browser.close();
    server.process?.kill('SIGTERM');
  }

  const report = {
    firmware: 'CR-20 Pro Update.hex',
    version: FIRMWARE_VERSION,
    generatedAt: new Date().toISOString(),
    suites: options.suites,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
  await writeFile(`${options.output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${options.output}/report.json`);
  if (report.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
