# CR-20 Pro Help Guide

This guide is for the CR-20 Pro running the RedstoneMaster01 v2.3 firmware.

The CR-20 Pro has a fixed bed without manual leveling knobs. The `Level bed` command uses the BLTouch probe to measure the bed and compensate for small height differences automatically.

## Level the Bed Before Every Print

Always complete one BLTouch bed-leveling cycle immediately before every print. This gives the firmware a fresh compensation mesh for the current bed position and temperature.

Use either of these methods:

- **From the printer:** Select `Motion > Level bed` and wait for the entire probing sequence to finish before selecting the print file.
- **From the G-code file:** Use `G28` followed immediately by `G29` in the slicer's start G-code. The printer will home and level automatically when the print starts.

One completed cycle is enough. If the file already runs `G28` followed by `G29`, that automatic cycle satisfies this requirement and you do not need to run `Motion > Level bed` first. If you are unsure what the file does, use `Motion > Level bed`, then correct the slicer profile before the next print.

Keep the bed clear and keep hands, tools, and loose filament away while the BLTouch is probing. There are no bed-leveling knobs to turn on the CR-20 Pro.

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

1. Confirm that the spool contains `1.75 mm` filament and that its material matches the selected preheat preset.
2. Mount the spool so it can unwind smoothly without rubbing, crossing under another loop, or pulling sharply against the extruder.
3. Inspect the first section of filament. Cut off any bent, swollen, brittle, or chewed portion.
4. Cut the new end cleanly at an angle and straighten the first several inches by hand.
5. Select the correct full preheat preset and wait for the nozzle to reach its target temperature.
6. Squeeze the extruder lever and guide the filament through the extruder entrance. Do not force it beside the drive gear.
7. Continue feeding it into the Bowden tube until it reaches the hotend and plastic exits the nozzle.
8. Purge until the strand flows continuously without gaps, bubbles, or traces of the previous color or material.
9. Release the extruder lever and confirm that the drive gear grips the filament normally.
10. Remove the purge strand with a tool, keeping fingers away from the hot nozzle.
11. Check that the spool still turns freely and that no loop has fallen underneath another loop.

Never force filament through a cold nozzle. If the extruder clicks, stop pushing and check the temperature, spool path, Z height, and nozzle for a clog.

### Unloading Filament

1. Identify the material currently in the hotend and select its preheat preset.
2. Wait until the nozzle reaches the required temperature. Never pull filament from a cold hotend.
3. Hold the spool so it cannot unwind uncontrollably.
4. Squeeze the extruder lever.
5. Push the filament forward slightly until a small amount exits the nozzle. This softens and shapes the tip for removal.
6. Pull the filament backward in one smooth motion and continue until it leaves the extruder.
7. Inspect the removed end. If it has a large blob that barely passed through the Bowden tube, cut that damaged end off before future loading.
8. Secure the loose filament end through a spool hole or clip. Do not let it pass underneath another loop, because that can create a knot during a later print.
9. Select `Temperature > Cooldown` if another material will not be loaded immediately.

### Changing Materials

1. Read the recommended temperature range on both spools.
2. Heat the nozzle to a temperature that safely softens the material currently inside it.
3. Follow the unloading procedure above and secure the old spool immediately.
4. Mount the new spool, cut a clean angled tip, and load it through the extruder and Bowden tube.
5. Purge enough filament to remove the previous color and material completely.
6. When changing from hotter PETG to cooler PLA, purge the PLA while the nozzle is still hot enough to remove the PETG, then lower the target to the PLA printing temperature.
7. When changing from PLA to PETG, raise the nozzle to the PETG loading temperature and purge until all PLA is gone.
8. Confirm that the outgoing strand is steady and matches the new material before starting a print.
9. Remove the purge strand and select `Cooldown` if printing will not begin immediately.

### Changing Filament During a Print

1. Use the printer's `Pause print` or `Change Filament` command. Do not pull filament while the machine is actively moving.
2. Wait for the print head to stop and park.
3. Keep the nozzle hot enough for the material being removed.
4. Unload the old filament, secure its spool, and load the replacement.
5. Purge until the new filament flows cleanly. Keep the purge strand away from the model.
6. Remove loose plastic from the nozzle with a tool.
7. Resume only after checking that the spool path is clear and the nozzle will not drag a strand onto the print.
8. Watch several resumed layers to confirm that extrusion and layer bonding have returned to normal.

## Preparing the Build Plate With Glue

Use **WASHABLE PURPLE GLUE STICKS** on the CR-20 Pro build surface. The purple color makes it easy to see where glue has been applied, and the washable formula can be removed with water after printing.

Do not use superglue, permanent craft adhesive, hot glue, spray adhesive, or an unknown glue stick. Apply glue only to a cool build plate.

### Before Every Print

1. Let the build plate cool completely.
2. Remove the previous print and all skirts, brims, purge lines, and loose plastic.
3. Remove old glue using the cleanup procedure below. Thick layers left from earlier prints can make the first layer uneven.
4. Dry the build plate completely and make sure it is correctly installed and flat.
5. Use a **washable purple glue stick** to draw thin, overlapping lines across the area where the model, brim, supports, and purge line will touch.
6. Apply a second set of thin lines in the other direction to spread coverage evenly. The goal is one smooth film, not ridges or clumps.
7. Cover slightly beyond the model's footprint. There is no need to coat unused areas of the plate.
8. Check the surface from an angle and fill only obvious gaps. Do not keep adding layers once coverage is even.
9. Keep glue away from the plate edges, heater wiring, underside, motion parts, and BLTouch pin.
10. Run the required bed-leveling cycle, then start the print and watch the complete first layer.

For PLA, the glue helps provide consistent adhesion. For PETG, it can also act as a release layer so the material does not bond too aggressively to a smooth surface.

### Removing Glue After Every Print

1. Wait until the bed and printed model are completely cool.
2. Remove the model without twisting or pulling against the printer frame.
3. If the build surface is removable, remove it from the printer before washing. If it is not removable, never pour water onto the printer.
4. Use warm water and a small amount of ordinary dish soap.
5. Scrub away all purple glue with a soft cloth or non-scratch sponge. Do not use steel wool, a metal brush, or anything that gouges the print surface.
6. Rinse a removable surface thoroughly. For a fixed surface, wipe repeatedly with a clean damp cloth without allowing liquid to reach the heater, wiring, electronics, or plate edges.
7. Dry the top, bottom, and edges completely before reinstalling or heating the plate.
8. Avoid touching the cleaned printing area with bare fingers because skin oil can reduce adhesion.
9. Apply a fresh thin layer of washable purple glue before the next print.

Do not scrape hardened glue from a hot plate. Regular cleanup prevents glue buildup from changing the first-layer height or producing an uneven bottom surface.

### Filament Storage

- Store PLA and PETG in sealed bags or boxes with fresh desiccant.
- PETG generally absorbs moisture faster than PLA.
- Popping sounds, steam, bubbles, rough extrusion, and unusually heavy stringing can indicate wet filament.
- Use a temperature-controlled filament dryer and follow the spool manufacturer's drying instructions. A household oven may overshoot its set temperature and damage the filament or spool.

### Drying Filament in a Food Dehydrator

Use these values only as conservative starting points for ordinary PLA and PETG. The filament and spool manufacturer's instructions take priority when they specify a lower temperature or different time.

| Material | Temperature | Time |
| --- | ---: | ---: |
| PLA | `45 C / 113 F` | 6 hours |
| PETG | `55 C / 131 F` | 6 hours |

Use a dehydrator with an adjustable thermostat, a working circulation fan, and enough room for air to move around both sides of the spool. A dehydrator that cannot hold the required low temperature is not suitable for PLA or PETG.

1. Read the dehydrator manual and confirm that it is designed to run continuously for the full drying time.
2. Check the filament label for its drying instructions. Use the lower recommended temperature if it differs from the table.
3. Check that the spool itself can tolerate the drying temperature. Cardboard glue and some plastic spools can loosen, shrink, or warp even when the filament temperature is safe.
4. Remove the spool from its bag and remove all desiccant packets, clips, labels that may come loose, and other packaging.
5. Put the complete spool in the dehydrator without unwinding it. Keep it away from the heating element and leave airflow space around it.
6. Place a separate thermometer near the spool. Do not rely only on the dehydrator's dial or display.
7. Set PLA to `45 C / 113 F` or PETG to `55 C / 131 F`.
8. Dry for 6 hours. Check the actual temperature and spool condition periodically.
9. Stop immediately if the spool warps, the filament becomes soft or sticky, loops begin fusing together, or there is an unusual odor.
10. At the end, turn the dehydrator off and let the spool cool without exposing it to humid air for a long period.
11. Put the cooled spool into a sealed bag or dry box with fresh desiccant, or load it into the printer and use it promptly.

If the filament still pops, bubbles, or prints rough after one cycle, confirm the thermometer reading and the filament manufacturer's directions before repeating the cycle. Do not raise the temperature to speed up drying; overheated filament can soften, fuse together, change diameter, or become unusable.

Prefer a dehydrator dedicated to filament. Filament colorants and additives are not food, so do not assume an appliance remains suitable for food preparation after it has been used for filament. Operate it on a stable, nonflammable surface with its vents clear and follow all appliance safety instructions.

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

The bed must be leveled before every print. The recommended automatic method is to probe at the start of every file. Open the printer profile's start G-code and make sure it contains:

```gcode
G28 ; Home all axes
G29 ; Probe the bed after homing
```

`G29` must come after the final `G28`. Homing after probing can turn leveling compensation off. If a profile already has `G28`, add only the `G29` line immediately after it; do not add a second homing command elsewhere.

With this start G-code, the printer will home and run BLTouch leveling automatically after you start the file. This fulfills the requirement to level before every print. Do not run `Motion > Level bed` first unless you intentionally want a separate manual check, because the start G-code will probe again.

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
3. Decide how this print will be leveled: either select `Motion > Level bed` before the print or confirm that its start G-code contains `G29` after `G28`.
4. Check that the nozzle is clean and does not have a blob of old filament attached. Clean it carefully while warm and avoid touching the hot nozzle.
5. Check that the cool bed surface is clean and free of loose filament, dust, and fingerprints.
6. Check that the BLTouch pin is straight, clean, and able to deploy without hitting anything.
7. Check that the spool can unwind freely and that the filament is not crossed, tangled, or pinched.
8. Check that the Bowden tube, hotend wiring, bed wiring, and axis cables will not catch during movement.
9. Check that the build area is clear and that no tools or old prints remain on the bed.
10. Complete one bed-leveling cycle. Select `Motion > Level bed` now unless the file will run `G28` followed by `G29` automatically.
11. Insert the SD card, select the correct `.gcode` file, and start the print.
12. If the file handles leveling, let it home and probe the bed. Keep hands and tools away while it moves.
13. Watch the complete first layer. Stop the print if the nozzle scrapes the bed or if filament is not sticking.

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
- [Filament Drying Guide](https://help.prusa3d.com/article/drying-filament_332086)
- [UltiMaker Cura Overview](https://ultimaker.com/learn/how-to-use-a-3d-printer/)
