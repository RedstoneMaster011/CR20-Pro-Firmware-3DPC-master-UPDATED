# CR-20 Pro Help Guide

This guide is for the CR-20 Pro running the RedstoneMaster01 v2.3 firmware.

The CR-20 Pro has a fixed bed without manual leveling knobs. The `Level bed` command uses the BLTouch probe to measure the bed and compensate for small height differences automatically.

## Setting the Probe Z Offset

The Probe Z Offset controls the distance between the nozzle and the bed after the BLTouch detects the bed. Set it carefully for a clean first layer.

You will need a normal sheet of printer paper.

1. Remove any plastic stuck to the nozzle. A dirty nozzle will make the measurement inaccurate.
2. Heat the nozzle to `200 C` and the bed to `60 C`. These are good calibration temperatures for PLA.
3. Place the sheet of paper on the bed below the nozzle.
4. Select `Motion > Auto home` and wait for homing to finish.
5. Select `Motion > Move axis > Move Z > Move 0.1mm`.
6. Slowly move Z to `0.00`. Stop if the nozzle presses hard against the paper or bed.
7. Select `Configuration > Probe Z Offset`.
8. Adjust the offset until the nozzle lightly grips the paper. The paper should still move, but with a small amount of drag.
9. Select `Configuration > Store Settings` to save the offset in EEPROM.
10. Run `Motion > Auto home`, return Z to `0.00`, and check the paper drag again.

If the nozzle is too high during a print, make the Probe Z Offset slightly more negative. If the nozzle scrapes the bed or the first layer is extremely thin, make the offset less negative, toward zero. Make small changes such as `0.02 mm` at a time.

`Allow Negative` does not need to be enabled to set the Probe Z Offset. Leave it disabled unless you specifically need manual X, Y, or Z movement below zero.

## Filament and Preheating

The temperature printed on the filament spool or supplied by its manufacturer is the main authority. Different colors and brands of the same material may need different temperatures.

This firmware has two complete preheat presets:

| Material | Menu | Nozzle | Bed | Good starting use |
| --- | --- | ---: | ---: | --- |
| PLA | `Temperature > Preheat PLA > Preheat PLA` | `200 C` | `60 C` | General PLA loading, calibration, and printing |
| PETG | `Temperature > Preheat PETG > Preheat PETG` | `230 C` | `80 C` | General PETG loading and printing |

These are starting values, not guaranteed settings for every spool. The temperature commands saved in a sliced G-code file take control when a print starts and may replace the manual preheat temperatures.

The firmware's maximum temperature limit is an emergency cutoff, not a recommended printing temperature. Do not use unusually high temperatures just because the menu permits them. Stay within the filament manufacturer's range and the safe range of the installed hotend.

### How to Preheat

1. Confirm that the selected preset matches the filament currently loaded or about to be loaded.
2. Open `Temperature` from the main menu.
3. Select `Preheat PLA` or `Preheat PETG`.
4. Select the full preset with the material name. Do not select the nozzle-only or bed-only option when both need heating.
5. Return to the status screen and wait until the current temperatures reach the target temperatures.
6. Keep the hot nozzle away from skin, cables, tools, and the bed surface.
7. Select `Temperature > Cooldown` when heating is no longer needed.

Do not leave the printer sitting at printing temperature for a long time without printing or loading filament. Filament can cook inside the hotend and become difficult to remove.

### PLA Workflow

PLA is the easiest starting material for this printer. The firmware preset is `200 C` nozzle and `60 C` bed. A normal spool may use roughly `190-220 C` at the nozzle and `50-60 C` on the bed, but always begin with the spool or slicer profile recommendation.

1. Select a PLA material profile in the slicer.
2. Check that the sliced file uses PLA temperatures, not PETG temperatures.
3. Use `Temperature > Preheat PLA > Preheat PLA` when loading filament or setting the Z offset.
4. Once hot, feed filament until the new color flows cleanly from the nozzle.
5. Clean away the extruded strand before homing or leveling.
6. Use little or no part cooling on the first layer. Let the slicer increase cooling on later layers.
7. Watch for a smooth first layer with connected lines and no scraping.

For PLA that will not stick, first clean the bed and check the Z offset. Raising the nozzle temperature is not a substitute for correcting a nozzle that is too far from the bed.

### PETG Workflow

The firmware PETG preset is `230 C` nozzle and `80 C` bed. Many normal PETG spools use roughly `220-240 C` at the nozzle and `70-85 C` on the bed. Follow the spool recommendation when it differs.

1. Select a PETG material profile in the slicer. Do not reuse a PLA profile with only the temperature changed.
2. Use `Temperature > Preheat PETG > Preheat PETG` for loading.
3. Feed and purge until no old PLA remains. Mixed material in the nozzle can cause weak or inconsistent extrusion.
4. Clean the nozzle before homing or probing because PETG tends to ooze while hot.
5. Use low or moderate part cooling after the first layers. Too much cooling can weaken layer bonding.
6. Expect PETG to look slightly less flattened than PLA on a good first layer. Do not force it hard into the bed.

PETG can bond extremely strongly to some smooth build surfaces. Follow the build-surface manufacturer's instructions. On a smooth surface that grips PETG aggressively, a thin, even glue-stick layer can serve as a release layer. Apply it only while the bed is cool.

### Loading Filament

1. Preheat for the material being loaded.
2. Cut the filament end cleanly at an angle.
3. Squeeze the extruder lever and feed the `1.75 mm` filament into the Bowden tube.
4. Continue feeding until plastic exits the nozzle in a steady strand.
5. Remove the strand with a tool after moving hands away from the hot nozzle.

Never force filament through a cold nozzle. If the extruder clicks, stop pushing and check the temperature, spool path, Z height, and nozzle for a clog.

### Changing Materials

1. Heat the nozzle to a temperature suitable for the material currently inside it.
2. Push the old filament forward slightly, then withdraw it smoothly while squeezing the extruder lever.
3. Load the new filament and purge until its color and flow are consistent.
4. When changing from hotter PETG to cooler PLA, purge the PLA while the nozzle is still hot enough to remove the PETG, then lower the target to the PLA temperature.
5. Remove the purge strand and select `Cooldown` if printing will not begin immediately.

### Filament Storage

- Store PLA and PETG in sealed bags or boxes with fresh desiccant.
- PETG generally absorbs moisture faster than PLA.
- Popping sounds, steam, bubbles, rough extrusion, and unusually heavy stringing can indicate wet filament.
- Use a temperature-controlled filament dryer and follow the spool manufacturer's drying instructions. A household oven may overshoot its set temperature and damage the filament or spool.

### Other Filament Types

The built-in presets are intended for ordinary PLA and PETG. They are not universal settings for every material.

- TPU and other flexible filaments usually need a slower profile and careful feeding through the Bowden extruder.
- ABS and ASA can warp and release fumes. They need suitable ventilation and often an enclosure designed so the printer electronics and power supply do not overheat.
- Carbon-fiber, glass-fiber, glow, and many metal-filled filaments are abrasive and can quickly wear out a standard brass nozzle. Use a compatible hardened nozzle and profile.
- Nylon and polycarbonate commonly need dry filament and temperatures or surroundings beyond what should be assumed safe for a stock CR-20 Pro.
- Check that the hotend, nozzle, build surface, and ventilation are suitable before using any material other than normal PLA or PETG.

## Cura and Other Slicers

A slicer converts an STL, OBJ, or 3MF model into the `.gcode` movement and temperature instructions that the printer can run. The printer cannot print an STL or 3MF file directly.

### Required CR-20 Pro Profile

Use a built-in `Creality CR-20 Pro` profile when the slicer provides one. For a manual profile, verify these values:

| Setting | Value |
| --- | --- |
| Printer type | Cartesian bed-slinger |
| G-code flavor | Marlin |
| Printable size | `220 x 220 x 250 mm` |
| Build-plate origin | Front-left, not center |
| Heated bed | Enabled |
| Extruders | 1 |
| Filament diameter | `1.75 mm` |
| Standard nozzle diameter | `0.4 mm` |

Do not select a similarly named CR-series printer unless its machine dimensions and start G-code have been checked. Do not export Klipper, resin-printer, proprietary binary, or `.bgcode` output. This firmware expects normal Marlin `.gcode` files.

### Bed Leveling in Start G-code

The recommended method is to probe the bed at the start of every print. Open the printer profile's start G-code and make sure it contains:

```gcode
G28 ; Home all axes
G29 ; Probe the bed after homing
```

`G29` must come after the final `G28`. Homing after probing can turn leveling compensation off. If a profile already has `G28`, add only the `G29` line immediately after it; do not add a second homing command elsewhere.

With this start G-code, the printer will home and run BLTouch leveling automatically after you start the file. You can still use `Motion > Level bed` as a manual check, but the start G-code will probe again so the print uses a fresh mesh.

Keep hands, filament strands, and tools away during the automatic home and probe sequence.

### Cura Setup

Menu names can vary slightly between Cura releases.

1. Open the printer manager and choose `Add printer`.
2. Choose a local or non-networked printer.
3. Look under `Creality` for `CR-20 Pro` and add it.
4. Open `Machine Settings` and verify the profile values in the table above.
5. In `Start G-code`, find the final `G28` and place `G29` directly after it.
6. Select a `0.4 mm` nozzle and a `1.75 mm` PLA or PETG material profile.
7. Import the model and place its intended flat face on the build plate.
8. Choose the material, quality, strength, speed, support, and adhesion settings.
9. Select `Slice`.
10. Open `Preview` and move through every layer before exporting.
11. Save the result as a plain `.gcode` file on the SD card.
12. Eject the SD card cleanly before removing it from the computer.

Use a short, recognizable filename. Avoid special characters when possible so it is easy to identify on the printer's LCD.

### Any Other Slicer

OrcaSlicer, PrusaSlicer, SuperSlicer, Creality Print, and other FDM slicers use different menu names, but the required checks are the same:

1. Select or create a CR-20 Pro printer profile.
2. Verify Marlin G-code, `220 x 220 x 250 mm`, one extruder, `1.75 mm` filament, and the installed nozzle diameter.
3. Select the correct PLA or PETG filament profile.
4. Put `G29` immediately after the last `G28` in start G-code.
5. Slice and inspect the layer preview.
6. Export a normal `.gcode` file to the SD card.

### Safe Starter Slicer Settings

These values are conservative starting points for a standard `0.4 mm` nozzle. A tested CR-20 Pro profile and the filament manufacturer's profile should take priority.

| Setting | PLA starting point | PETG starting point |
| --- | ---: | ---: |
| Layer height | `0.20 mm` | `0.20 mm` |
| First-layer height | `0.20 mm` | `0.20 mm` |
| Walls/perimeters | 3 | 3 |
| Top and bottom thickness | At least `0.8 mm` | At least `0.8 mm` |
| Infill | `15-20%` | `15-20%` |
| General print speed | `40-50 mm/s` | `35-45 mm/s` |
| First-layer speed | `15-20 mm/s` | `15-20 mm/s` |
| Nozzle | Start near `200 C` | Start near `230 C` |
| Bed | Start near `60 C` | Start near `80 C` |
| First-layer fan | Off or low | Off |
| Later fan | Slicer profile, usually strong | Slicer profile, usually low/moderate |

Use the retraction settings supplied by the CR-20 Pro printer profile as the starting point. Change retraction in small steps only after temperature and filament dryness have been checked.

### Supports and Build-Plate Adhesion

- Use supports only where the model has unsupported overhangs or bridges that need them.
- Inspect support placement in Preview; supports consume material and can mark the model.
- Use a skirt for a normal adhesion and flow check.
- Use a brim for a small contact area, a tall narrow part, or corners that tend to lift.
- Use a raft only when other first-layer and adhesion fixes have failed.
- Rotate the model so its strongest layer direction matches how the finished part will be loaded.

### Check the Preview Before Exporting

Look through the complete sliced preview and confirm:

- The model sits on the build plate and no required section begins in mid-air.
- The first layer has enough contact area.
- Supports exist where they are genuinely needed.
- There are no missing walls or unexpectedly empty layers.
- The nozzle and bed temperatures match the loaded material.
- The estimated material use fits the amount left on the spool.
- The model stays inside the printable area.

The slicer's time estimate and the printer's remaining-time estimate may differ. The printer calculates from actual elapsed time and SD-card progress while the print is running.

## Before Printing

1. Confirm that the model was sliced for the CR-20 Pro and the filament currently loaded.
2. Check that the selected G-code uses the correct PLA or PETG temperatures.
3. Check that the start G-code contains `G29` after `G28`.
4. Check that the nozzle is clean and does not have a blob of old filament attached. Clean it carefully while warm and avoid touching the hot nozzle.
5. Check that the cool bed surface is clean and free of loose filament, dust, and fingerprints.
6. Check that the BLTouch pin is straight, clean, and able to deploy without hitting anything.
7. Check that the spool can unwind freely and that the filament is not crossed, tangled, or pinched.
8. Check that the Bowden tube, hotend wiring, bed wiring, and axis cables will not catch during movement.
9. Check that the build area is clear and that no tools or old prints remain on the bed.
10. Insert the SD card, select the correct `.gcode` file, and start the print.
11. Let the start G-code home and level the printer. Keep hands and tools away while it moves.
12. Watch the complete first layer. Stop the print if the nozzle scrapes the bed or if filament is not sticking.

If the selected file does not run `G29` after homing, use `Motion > Level bed` before printing and correct the slicer profile before relying on it for future prints.

There are no bed-leveling knobs on the CR-20 Pro. `Level bed` creates a compensation mesh with the BLTouch; it does not expect you to turn anything under the bed. If the bed or gantry is physically loose or badly tilted, repair the mechanical issue instead of looking for adjustment knobs.

## During Printing

The main printing screen shows the current nozzle and bed temperatures, machine position, print progress, and print timing.

- The progress bar fills as the printer moves through the SD-card G-code file.
- The time above the left edge of the progress bar is the elapsed print time.
- The value above the right edge is the estimated time remaining.
- `Calc.` appears on the right until the progress bar gains its first visible filled segment.
- After the first estimate appears, the firmware recalculates it every 60 seconds and counts down between updates.
- The estimate may move up or down because different parts of a G-code file can print at different speeds.

Click the control knob during a print to open the menu. The `Tune` menu can be used to adjust print speed, nozzle temperature, bed temperature, fan speed, and Probe Z Offset.

### Live Z Adjustment

Watch how the first layer is placed:

- If separate lines have gaps or do not stick, the nozzle is probably too high. Make the Probe Z Offset slightly more negative.
- If the nozzle scrapes, filament barely comes out, or the layer is excessively flattened, the nozzle is too low. Make the offset less negative.
- Change the offset in small steps and wait for the nozzle to print several lines before judging the result.

Open the live adjustment by clicking the control knob four times quickly, or select `Tune > Probe Z Offset`. When the first layer looks correct, use `Configuration > Store Settings` after the print to keep the new value.

### Pausing or Stopping

Use `Pause print` when you need to temporarily stop the job. Keep hands away until all movement has stopped. Use `Stop print` when the print is failing or continuing could damage the nozzle, bed, or model.

## After Printing

1. Wait for all movement to stop.
2. Select `Temperature > Cooldown` if the G-code did not already turn the heaters off.
3. Allow the bed and model to cool before removal. Many prints release more easily after cooling.
4. Remove the model without pulling against the printer frame or BLTouch.
5. Remove skirts, purge lines, and loose plastic from the bed.
6. Inspect the nozzle for a forming blob or leak before the next print.
7. Store the remaining filament in a sealed container with desiccant.
8. Turn the printer off when it is cool and no longer needed.

## Quick Troubleshooting

### Filament Does Not Stick

- Clean the cool bed surface.
- Confirm that the sliced file uses the correct bed temperature.
- Confirm that `Motion > Level bed` completed successfully.
- Confirm that `G29` comes after `G28` in start G-code.
- Check the Probe Z Offset and move it slightly more negative if the nozzle is too high.
- Confirm that the nozzle and bed reached the temperatures expected by the G-code file.
- Reduce the slicer's first-layer speed.
- Add a brim when the model has very little bed contact.

### Nozzle Scrapes the Bed

- Stop the print immediately.
- Make the Probe Z Offset less negative.
- Check for plastic stuck to the nozzle during calibration.
- Run `Motion > Level bed` again before restarting the print.

### BLTouch Fails to Probe

- Stop the printer before touching the probe.
- Check that the probe pin is straight and can move freely.
- Check that its cable is firmly connected.
- Power-cycle the printer and try `Motion > Auto home` again.

### Extruder Clicks or Stops Feeding

- Stop the print if extrusion has failed.
- Check that the nozzle reached the material's required temperature.
- Check that the spool turns freely and the filament is not tangled.
- Check whether the nozzle is so close to the bed that plastic cannot exit.
- Check the Bowden tube and nozzle for a blockage.
- Do not increase flow to force material through a clog.

### PLA Has Weak Layers

- Confirm that PLA, not PETG, is selected in the slicer.
- Increase nozzle temperature in a small `5 C` step while staying inside the spool's range.
- Reduce excessive part cooling.
- Reduce print speed if the hotend cannot melt filament consistently.

### PETG Is Stringy

- Dry the filament according to its manufacturer's instructions.
- Remove leaked material from the nozzle before printing.
- Lower nozzle temperature in a small `5 C` step while staying inside the spool's range.
- Use the CR-20 Pro profile's retraction settings, then tune in small steps.
- Avoid excessive travel across open areas by adjusting slicer travel settings.

### Corners Lift or the Part Warps

- Clean the cool build surface.
- Keep the printer away from cold drafts.
- Confirm the correct bed temperature.
- Use a brim for models with sharp corners or a small footprint.
- Do not use a raft until leveling, Z offset, temperature, and brim settings have been checked.

### Time Remaining Stays on `Calc.`

The estimate is available only for an active SD-card print. It remains on `Calc.` until the progress bar first visibly fills. Very short files may finish before a useful estimate can be calculated.

## Important Safety Notes

- The nozzle and bed can cause burns. Let them cool before touching or cleaning them.
- Never put hands near moving axes, belts, or the print head.
- Keep `Allow Negative` disabled for normal printing.
- Never force the Z axis downward if the nozzle is touching the bed.
- Do not leave the printer unattended until the first layer has completed successfully.
- Do not exceed the temperature recommended by the filament or installed hotend manufacturer.
- The firmware temperature limit is not proof that the stock hotend is safe at that temperature.
- Use PLA or PETG while learning. High-temperature, abrasive, flexible, or fume-producing materials may require hardware, ventilation, or slicer changes.

## Further Reading

- [Original CR-20 Pro Guide Book](https://asset.conrad.com/media10/add/160267/c1/-/en/002141333ML00/user-safety-instructions-2141333-creality-cr-20-pro-3d-printer-assembly-kit-all-filament-types.pdf)
- [PLA Material Guide](https://help.prusa3d.com/article/pla_2062)
- [PETG Material Guide](https://help.prusa3d.com/article/petg_2059)
- [UltiMaker Cura Overview](https://ultimaker.com/learn/how-to-use-a-3d-printer/)
