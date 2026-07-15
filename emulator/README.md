# CR-20 Pro Firmware Emulator

This emulator runs `CR-20 Pro Update.hex` on an emulated ATmega2560 and connects the firmware to a virtual RAMPS board, UC1701 MiniPanel, rotary encoder, steppers, endstops, BLTouch trigger, heaters, thermistors, fan, UART, FAT16 SD card, and persistent EEPROM.

## Run the Emulator

```bash
cd emulator
npm install
npm run dev
```

Open the URL printed by Vite. Click the encoder knob to press it and use the mouse wheel over the knob to rotate it. G-code can also be sent through the serial console. The virtual SD card starts with `DEMO.GCO`; use **Mount G-code** to replace it with another local file.

## Run Tests

Run every suite:

```bash
npm test -- --all
```

Run selected suites:

```bash
npm test -- --suite lcd,encoder
npm test -- --motion
npm test -- --homing
npm test -- --thermal --eeprom
npm test -- --help
```

List suite names:

```bash
npm test -- --list
```

Useful flags:

| Flag | Purpose |
|---|---|
| `--all` | Run every suite. This is also the default. |
| `--suite boot,lcd` | Run a comma-separated suite list. |
| `--boot`, `--lcd`, and so on | Run a named suite with a shortcut flag. |
| `--help` | Show command usage and available selection forms. |
| `--headed` | Show Chrome while tests run. |
| `--port 4174` | Use a different local server port. |
| `--url http://host:port` | Test an already-running emulator. |
| `--timeout 75000` | Set each browser wait timeout in milliseconds. |
| `--output path` | Choose the report and screenshot directory. |

The available suites are `boot`, `lcd`, `encoder`, `controls`, `serial`, `motion`, `homing`, `thermal`, `sd`, `mount`, `eeprom`, and `layout`. The controls suite exercises pause, resume, speed, reset, serial form, and console clearing. The `sd` suite runs the built-in virtual print to completion, while `mount` tests the browser file control and verifies its FAT16 listing through the firmware. The runner writes `report.json`, `desktop.png`, and `mobile.png` under `test-results/` by default.

## Scope

The emulator is intended for firmware UI and control-flow testing. It models the current CR-20 Pro pin map and important physical responses, but it cannot prove electrical safety, real heater behavior, stepper torque, mechanical collisions, probe repeatability, or print quality. Validate safety-sensitive changes on disconnected test hardware before operating heaters or motors on a printer.
