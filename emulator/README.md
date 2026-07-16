# CR-20 Pro Firmware Emulator

This emulator runs `CR-20 Pro Update.hex` on an emulated ATmega2560 and connects the firmware to a virtual RAMPS board, UC1701 MiniPanel, rotary encoder, steppers, endstops, BLTouch trigger, heaters, thermistors, fan, UART, FAT16 SD card, and persistent EEPROM.

## Run the Emulator

```bash
cd emulator
npm install
npm run dev
```

Open the URL printed by Vite. Click the encoder knob to press it and use the mouse wheel over the knob to rotate it; the Up and Down arrow keys also rotate the focused knob. G-code can be sent through the serial console. The virtual SD card starts with the bundled `CCR20PRO_3DBenchy.gcode` as `3DBENCH.GCO`; use **Mount G-code** to replace it with another local file. The speed control runs from `0.25x` through `8x` when the computer can emulate the requested AVR rate.

The 3D view follows the physical bed-slinger arrangement: X moves the print head, Y moves the bed, and Z raises the gantry. The BLTouch pin deploys with firmware commands, the part-cooling fan rotates around its shaft, and accepted extruder steps leave orange filament paths attached to the moving bed. Resetting the emulator or mounting another file clears the rendered print.

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
npm test -- --print-controls
npm test -- --menu-print
npm test -- --usb
npm test -- --benchy
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

The available suites are `boot`, `lcd`, `encoder`, `controls`, `serial`, `motion`, `homing`, `thermal`, `sd`, `usb`, `mount`, `benchy`, `menu-print`, `print-controls`, `eeprom`, and `layout`. The controls suite exercises pause, resume, speed, reset, serial form, and console clearing. The `sd` and `usb` suites run short prints through their real firmware paths and verify the exact finished-screen function selected by the AVR. `mount` tests the browser file control, `benchy` verifies the bundled 5 MB file and expandable FAT16 card, and `menu-print` uses the virtual knob to select and start the bundled Benchy, then verifies TWI status-LED traffic and bed heating. `print-controls` verifies the temperature overrides, Better Bed values, layer transition, heater shutoff, and EEPROM persistence against the built AVR ELF. The layout suite also checks the fan, BLTouch, axis transforms, and deposited-filament trace. The runner writes `report.json` and its screenshots under `test-results/` by default.

## Scope

The emulator is intended for firmware UI and control-flow testing. It models the current CR-20 Pro pin map and important physical responses, but it cannot prove electrical safety, real heater behavior, stepper torque, mechanical collisions, probe repeatability, or print quality. Validate safety-sensitive changes on disconnected test hardware before operating heaters or motors on a printer.
