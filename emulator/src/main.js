import './styles.css';
import { CR20Emulator } from './cr20-emulator.js';
import { UC1701Display } from './lcd.js';
import { PrinterScene } from './printer-scene.js';

const elements = {
  state: document.querySelector('#run-state'),
  stateLabel: document.querySelector('#run-state-label'),
  firmwareStatus: document.querySelector('#firmware-status'),
  firmwareVersion: document.querySelector('#firmware-version'),
  pause: document.querySelector('#pause-button'),
  reset: document.querySelector('#reset-button'),
  encoder: document.querySelector('#encoder'),
  encoderUp: document.querySelector('#encoder-up'),
  encoderDown: document.querySelector('#encoder-down'),
  speed: document.querySelector('#speed'),
  speedValue: document.querySelector('#speed-value'),
  serialOutput: document.querySelector('#serial-output'),
  serialForm: document.querySelector('#serial-form'),
  serialInput: document.querySelector('#serial-input'),
  clearConsole: document.querySelector('#clear-console'),
  sdFileInput: document.querySelector('#sd-file-input'),
  sdFileName: document.querySelector('#sd-file-name'),
  axisX: document.querySelector('#axis-x'),
  axisY: document.querySelector('#axis-y'),
  axisZ: document.querySelector('#axis-z'),
  axisE: document.querySelector('#axis-e'),
  hotendTemp: document.querySelector('#hotend-temp'),
  bedTemp: document.querySelector('#bed-temp'),
  hotendBar: document.querySelector('#hotend-bar'),
  bedBar: document.querySelector('#bed-bar'),
  fanValue: document.querySelector('#fan-value'),
};

const printerScene = new PrinterScene(document.querySelector('#printer-canvas'));
let emulator;
let knobRotation = 0;
let displayReady = false;
let serialRenderTimer;
let latestSerialText = '';

const display = new UC1701Display(document.querySelector('#lcd'), () => {
  displayReady = true;
  setState('running');
});

emulator = new CR20Emulator(display);

function setState(state, message) {
  const labels = {
    booting: 'Booting firmware',
    running: 'Firmware running',
    paused: 'Emulator paused',
    error: 'Emulator error',
  };
  elements.state.dataset.state = state;
  elements.stateLabel.textContent = message || labels[state];
  elements.pause.querySelector('span').textContent = state === 'paused' ? '▶' : 'Ⅱ';
  elements.pause.title = state === 'paused' ? 'Resume emulator' : 'Pause emulator';
  elements.pause.setAttribute('aria-label', elements.pause.title);
}

emulator.onState = (state) => {
  if (state === 'running' && !displayReady) return;
  setState(state);
};

emulator.onSerial = (_character, text) => {
  latestSerialText = text;
  if (!elements.firmwareVersion.dataset.loaded) {
    const match = text.match(/Marlin (v2\.3 - \d+)\r?\n/);
    if (match) {
      elements.firmwareVersion.textContent = match[1];
      elements.firmwareVersion.dataset.loaded = 'true';
    }
  }
  if (serialRenderTimer) return;
  serialRenderTimer = setTimeout(() => {
    elements.serialOutput.textContent = latestSerialText;
    elements.serialOutput.scrollTop = elements.serialOutput.scrollHeight;
    serialRenderTimer = undefined;
  }, 80);
};

emulator.onTelemetry = ({ axes, temperatures, duties, probe }) => {
  elements.axisX.textContent = axes.x.toFixed(2);
  elements.axisY.textContent = axes.y.toFixed(2);
  elements.axisZ.textContent = axes.z.toFixed(2);
  elements.axisE.textContent = axes.e.toFixed(2);
  elements.hotendTemp.textContent = temperatures.hotend.toFixed(1);
  elements.bedTemp.textContent = temperatures.bed.toFixed(1);
  elements.hotendBar.style.width = `${Math.min(100, temperatures.hotend / 3)}%`;
  elements.bedBar.style.width = `${Math.min(100, temperatures.bed)}%`;
  elements.fanValue.textContent = `${Math.round(duties.fan * 100)}%`;
  printerScene.setAxes(axes);
  printerScene.setFanDuty(duties.fan);
  printerScene.setProbe(probe);
};

emulator.onExtrusion = (axes) => {
  if (axes) printerScene.depositFilament(axes);
  else printerScene.stopDeposition();
};

function rotateKnob(direction) {
  emulator.rotateEncoder(direction);
  knobRotation += direction * 18;
  elements.encoder.style.setProperty('--knob-rotation', `${knobRotation}deg`);
}

elements.encoder.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (!event.deltaY) return;
  rotateKnob(event.deltaY > 0 ? 1 : -1);
}, { passive: false });

elements.encoder.addEventListener('click', () => emulator.pressEncoder());
elements.encoderUp.addEventListener('click', () => rotateKnob(-1));
elements.encoderDown.addEventListener('click', () => rotateKnob(1));
elements.encoder.addEventListener('keydown', (event) => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  rotateKnob(event.key === 'ArrowDown' ? 1 : -1);
});

elements.pause.addEventListener('click', () => {
  if (emulator.running) emulator.pause();
  else emulator.resume();
});

elements.reset.addEventListener('click', () => {
  displayReady = false;
  printerScene.clearPrint();
  emulator.reset();
});

function formatSpeed(speed) {
  if (speed >= 100) return `${speed.toFixed(0)}×`;
  if (speed >= 10) return `${speed.toFixed(1)}×`;
  return `${speed.toFixed(2)}×`;
}

elements.speed.addEventListener('input', () => {
  const speed = Number.parseFloat(elements.speed.value);
  emulator.setSpeed(speed);
  elements.speedValue.textContent = formatSpeed(speed);
});

elements.serialForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const command = elements.serialInput.value.trim();
  if (!command) return;
  emulator.sendSerial(command);
  elements.serialInput.value = '';
});

elements.clearConsole.addEventListener('click', () => {
  clearTimeout(serialRenderTimer);
  serialRenderTimer = undefined;
  latestSerialText = '';
  emulator.serialText = '';
  elements.serialOutput.textContent = '';
});

elements.sdFileInput.addEventListener('change', async () => {
  const [file] = elements.sdFileInput.files;
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    emulator.mountGcode(file.name, bytes);
    printerScene.clearPrint();
    elements.sdFileName.textContent = emulator.sdCard.fileName;
    elements.firmwareStatus.textContent = `${(bytes.length / 1024).toFixed(1)} KB G-code mounted`;
  } catch (error) {
    console.error(error);
    elements.firmwareStatus.textContent = error.message;
  }
  elements.sdFileInput.value = '';
});

async function boot() {
  try {
    setState('booting');
    const defaultGcode = new URLSearchParams(window.location.search).has('test')
      ? null
      : '/gcode/CCR20PRO_3DBenchy.gcode';
    const size = await emulator.load('/firmware/CR-20-Pro-Update.hex', defaultGcode);
    elements.sdFileName.textContent = emulator.sdCard.fileName;
    elements.firmwareStatus.textContent = `${(size / 1024).toFixed(1)} KB firmware loaded`;
    emulator.start();
  } catch (error) {
    console.error(error);
    elements.firmwareStatus.textContent = error.message;
    setState('error', 'Firmware failed to load');
  }
}

boot();

window.__cr20Emulator = emulator;
window.__cr20Display = display;
window.__cr20Scene = printerScene;
