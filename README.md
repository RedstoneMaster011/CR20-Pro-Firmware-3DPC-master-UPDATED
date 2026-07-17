# CR20-Pro-Firmware-3DPC v2.3 

Updated Marlin firmware for the CR-20 Pro, created by RedstoneMaster01.

For setup, leveling, Z-offset, and printing instructions, see the [CR-20 Pro Help Guide](help.md).

## Firmware Emulator

The [browser emulator](emulator/README.md) runs the current HEX on an emulated ATmega2560 with the CR-20 Pro LCD, encoder, steppers, endstops, BLTouch, heaters, fan, virtual SD card, and persistent EEPROM. Its 3D printer follows the real X-head, Y-bed, and Z-gantry movement, animates the fan and probe, and leaves filament lines from emulated extrusion. The right panel provides the firmware-driven screen and clickable, scrollable encoder knob. `CCR20PRO_3DBenchy.gcode` is bundled as the default virtual SD print.

```bash
cd emulator
npm install
npm run dev
```

Run the complete automated firmware and interface test matrix with `npm test -- --all`, or target one area with flags such as `--homing`, `--thermal`, `--sd`, or `--layout`. See the emulator guide for every suite and command-line option.

## Version 2.3

Version 2.3 adds estimated print time remaining and better support for negative X, Y, and Z movement values.

- Added estimated time remaining to the main printing screen.
- `Calc.` is displayed until the progress bar gains its first visible filled segment.
- The first estimate is calculated as soon as progress appears, using elapsed time with SD-card byte progress or USB `M73` percentage reports.
- Remaining time is re-estimated every 60 seconds after the first estimate and counts down between estimates.
- Elapsed time is aligned above the left edge of the progress bar; remaining time is aligned above its right edge.
- Added `Temperature > Override Slicer Temps`, disabled by default. When enabled, active SD-card or USB print temperature commands use the configurable `Override Slicer Nozzle` (`200 C` default) and `Override Slicer Bed` (`60 C` default) values; zero-temperature heater-off commands still work normally.
- Slicer override settings are stored with `Configuration > Store Settings`.
- Added `Temperature > Better Bed`, enabled by default and stored in EEPROM. When enabled, layers 0 and 1 of SD-card and USB prints set the temporary `Tune > Speed` value to `70%` and `Tune > Fan Speed` to `255` (full speed). At layer 2, speed returns to `100%` and the latest fan value requested by the slicer is restored.
- SD layer comments are applied when their associated command executes, preventing command-buffer read-ahead from ending first-layer settings early.
- Added a `Print Finished` screen for SD-card and USB prints. It shows elapsed time and estimated filament weight in grams; a knob press returns to the status screen.
- SD completion now waits for every queued G-code command before stopping the timer or showing `Print Finished`.
- USB hosts can use standard `M75`, `M73`, and `M77` commands for print start, progress/ETA, and successful completion.
- V67, V68, and V69 EEPROM data is automatically migrated to V70.

- Added `Configuration > Advanced Settings > Allow Negative`.
- The setting is disabled by default.
- The setting is stored in EEPROM with `Configuration > Store Settings` and restored at startup.
- Existing V67 EEPROM calibration and mesh data are automatically migrated to the new V68 layout.
- When enabled, minimum software endstops are relaxed so X, Y, and Z can move below zero. Maximum software endstops remain active.
- Removed the duplicate setting from the Motion menu.
- Added the v2.3 creator credit to the printer Information screen.
- Added an automatic build number to the version, displayed as `v2.3 - <build>`.
- Each CR-20 Pro firmware build increases the saved build number by a random value from 5 through 15.
- Shortened the LCD label so its On/Off value displays correctly.

Use negative movement carefully, especially on the Z axis, because the nozzle can move below the configured bed-zero position.

## Overview

This update brings a few changes to the CR-20 Pro:

1) Updated and improved Z-offset consistency between prints
2) Live-Z adjust the Z offset during prints by clicking the select button 4 times on the printer.
3) Overall reliability improvements (Marlin 2.0)
4) Optional negative X, Y, and Z movement support

## Operation Changes 

The procedure for setting up the Z offset is now different than the traditional CR-20 pro with these new firmware changes. Please follow the following procedure: 

### Setting the Probe Z Offset

1) Heat the printer up to 200 celcius on the nozzle, 60 on the bed
2) Auto home the printer
3) Move the printer's Z axis to zero. Make sure you have your paper underneath the nozzle before doing this
4) Go to the configuration > probe z offset menu. Move the Z offset into the negative range until it start to grip the paper
5) Save the settings by clicking configuration > store settings.

### Live-Adjusting the Probe Z Offset

You can now adjust the offset on the fly! This is really useful for getting just the right first layer 'squish'. There are two ways of doing this: 

1) While printing, click the select button four times quickly.
2) While printing, go to configuration or tune, then probe z offset

** SAVE the setting with Store Settings to make the setting stick! 

## Installation Procedure: 

XLoader is a program designed to upload firmwares to your 3d printer. Download XLoader from this source: http://www.hobbytronics.co.uk/arduino-xloader

Before flashing an update, back up the printer's EEPROM settings, including Probe Z Offset, bed mesh, steps, PID values, acceleration, and other calibration. Restore only settings compatible with the new EEPROM layout, verify the restored values on the printer, and run homing/leveling checks before printing. Do not assume a firmware flash or EEPROM migration will preserve every calibration without verification.

1) Plug your printer into your computer
2) Open XLoader. Configure it with the following values: 
      - Hex File: Select `CR-20 Pro Update.hex` from this repository
      - Device: MEGA(ATMEGA2560)
      - COM Port: The com port for your printer (should only be 1-2 there - try both if you don't have success at first)
      - Baud Rate: 115200
3) Press Upload.
