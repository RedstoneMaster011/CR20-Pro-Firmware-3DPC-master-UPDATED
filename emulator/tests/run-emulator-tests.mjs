import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright-core';

const SUITES = ['boot', 'lcd', 'encoder', 'controls', 'serial', 'motion', 'homing', 'thermal', 'sd', 'mount', 'eeprom', 'layout'];

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
    if (response.ok) return { url, process: null };
  } catch {
    // Start a local server below.
  }

  if (options.url) throw new Error(`No emulator server responded at ${options.url}`);
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(options.port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer(url, options.timeout);
  return { url, process: child };
}

async function bootPage(browser, url, timeout, viewport = { width: 1440, height: 960 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const browserMessages = [];
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserMessages.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(() => window.__cr20Emulator?.cpu, null, { timeout });
  await page.evaluate(() => window.__cr20Emulator.setSpeed(4));
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
        assert(first.serial.includes('Marlin v2.3 - 58584'), 'Firmware version was not reported', first);
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
        assert(menuHash !== statusHash, 'Encoder press did not open the main menu', { statusHash, menuHash });
        assert(rotatedHash !== menuHash, 'Encoder rotation did not change menu selection', { menuHash, rotatedHash });
        return { statusHash, menuHash, rotatedHash };
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
        return { speed, pausedCycles, reset };
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
        await page.evaluate(() => window.__cr20Emulator.resetTrace());
        const response = await sendAndWait(page, 'G28', 'ok', options.timeout);
        const after = await page.evaluate(() => ({
          axes: { ...window.__cr20Emulator.axes },
          extents: structuredClone(window.__cr20Emulator.axisExtents),
          probe: {
            deployed: window.__cr20Emulator.probe.deployed,
            triggered: window.__cr20Emulator.probe.triggered,
            commands: [...window.__cr20Emulator.probe.commands],
            triggerCount: window.__cr20Emulator.probe.triggerCount,
          },
        }));
        assert(!response.includes('BLTouch error') && !response.includes('Homing failed'), 'Firmware reported a homing failure', { response, after });
        assert(after.probe.commands.includes(10) && after.probe.commands.includes(90), 'BLTouch did not receive both deploy and stow commands', after);
        assert(after.probe.triggerCount >= 2, 'BLTouch did not register both Z homing contacts', after);
        assert(!after.probe.deployed && !after.probe.triggered, 'BLTouch was not safely stowed after homing', after);
        assert(after.extents.x.min <= 0.05 && after.extents.y.min <= 0.05, 'X/Y endstops did not stop homing travel', { before, after });
        assert(after.extents.z.min <= 0.15, 'The BLTouch did not stop Z homing near the bed', { before, after });
        return { before, response: response.trim(), ...after };
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
        }));
        await sendAndWait(page, 'M104 S0', 'ok', options.timeout);
        await sendAndWait(page, 'M140 S0', 'ok', options.timeout);
        await sendAndWait(page, 'M106 S0', 'ok', options.timeout);
        assert(heated.duties.hotend > 0.5, 'Hotend heater did not turn on', heated);
        assert(heated.duties.bed > 0.5, 'Bed heater did not turn on', heated);
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
        assert(selected.includes('Size: 1322'), 'SD file size was not read from FAT16', { selected });
        await sendAndWait(page, 'M24', 'ok', options.timeout);
        await page.waitForTimeout(900);
        const progress = await sendAndWait(page, 'M27', '/1322', options.timeout);
        const match = progress.match(/SD printing byte (\d+)\/(\d+)/);
        assert(match, 'M27 did not report SD byte progress', { progress });
        assert(Number(match[1]) > 0 && Number(match[1]) < Number(match[2]), 'SD print did not report in-progress bytes', { progress });
        const offset = await page.evaluate(() => window.__cr20Emulator.serialText.length);
        await page.waitForFunction(
          (start) => window.__cr20Emulator.serialText.slice(start).includes('Done printing file'),
          offset,
          { timeout: options.timeout },
        );
        const completed = await page.evaluate((start) => window.__cr20Emulator.serialText.slice(start), offset);
        const startsAfter = await page.evaluate(() => (window.__cr20Emulator.serialText.match(/^start$/gm) || []).length);
        assert(startsAfter === startsBefore, 'Firmware reset during the SD print', { startsBefore, startsAfter, completed });

        return { listing, progress, completed: completed.trim() };
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
        return { desktop: { ...desktopLayout, pixels: desktopPixels }, mobile: { ...mobileLayout, pixels: mobilePixels }, movedCamera };
      });
    }
  } finally {
    await desktop?.context.close();
    await browser.close();
    server.process?.kill('SIGTERM');
  }

  const report = {
    firmware: 'CR-20 Pro Update.hex',
    version: 'v2.3 - 58584',
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
