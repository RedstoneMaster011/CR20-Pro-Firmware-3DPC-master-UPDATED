# CR-20 Pro Help Guide

This guide is for the CR-20 Pro running the RedstoneMaster01 v2.3 firmware.

The CR-20 Pro has a fixed bed without manual leveling knobs. Its BLTouch probe measures the bed and lets the firmware compensate for small height differences automatically.

## Quick Print Workflow

Follow this order for every print:

1. Slice and preview the model for the CR-20 Pro and the loaded material.
2. Inspect the printer, filament path, BLTouch, wiring, and G-code file.
3. Clean the cool build plate and apply a thin layer of washable purple glue.
4. Preheat as needed, load or purge the filament, and clean the nozzle.
5. Level the bed once, either with `Motion > Level bed` or with `G28` followed by `G29` in the file.
6. Start the job from the SD card or USB host.
7. Keep hands clear during homing and probing, then watch the complete first layer.

The rest of this guide explains each step in detail.

## Setup and Calibration

Complete the Probe Z Offset procedure when setting up the printer, after changing the nozzle or BLTouch, or whenever the first-layer height can no longer be corrected with a very small live adjustment.

### Setting the Probe Z Offset

The Probe Z Offset controls the distance between the nozzle and the bed after the BLTouch detects the bed. Set it carefully for a clean first layer.

You will need a normal sheet of printer paper.

1. Remove any plastic stuck to the nozzle. A dirty nozzle makes the measurement inaccurate.
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

### How BLTouch Leveling Works

`Motion > Level bed` runs a complete BLTouch probing cycle and creates a compensation mesh. It does not expect you to turn anything under the bed.

Always complete one leveling cycle immediately before every print. Probe after the bed reaches its intended printing temperature so the mesh represents the bed while hot. The detailed choice between menu leveling and automatic start-G-code leveling is in [Level the Bed](#level-the-bed).

If the bed, gantry, rollers, or frame is physically loose or badly tilted, repair that mechanical problem. A compensation mesh cannot correct loose hardware or a severely misaligned machine.

## Filament and Temperature Preparation

The temperature printed on the filament spool or supplied by its manufacturer is the main authority. Different brands and colors of the same material may require different settings.

This firmware has two complete preheat presets:

| Material | Menu | Nozzle | Bed | Good starting use |
| --- | --- | ---: | ---: | --- |
| PLA | `Temperature > Preheat PLA > Preheat PLA` | `200 C` | `60 C` | General PLA loading, calibration, and printing |
| PETG | `Temperature > Preheat PETG > Preheat PETG` | `230 C` | `80 C` | General PETG loading and printing |

These are starting values, not guaranteed settings for every spool. By default, the temperature commands in the sliced G-code control the print and may replace manually selected preheat temperatures.

### How to Preheat

1. Confirm that the selected preset matches the filament currently loaded or about to be loaded.
2. Open `Temperature` from the main menu.
3. Select `Preheat PLA` or `Preheat PETG`.
4. Select the full preset with the material name. Do not select a nozzle-only or bed-only option when both need heating.
5. Return to the status screen and wait until the current temperatures reach their targets.
6. Keep the hot nozzle away from skin, cables, tools, and the bed surface.
7. Select `Temperature > Cooldown` when heating is no longer needed.

Do not leave the printer sitting at printing temperature for a long time without printing or loading filament. Filament can cook inside the hotend and become difficult to remove.

### PLA Workflow

PLA is the easiest starting material for this printer. The firmware preset is `200 C` nozzle and `60 C` bed. A normal spool may use roughly `190-220 C` at the nozzle and `50-60 C` on the bed, but always begin with the spool or slicer-profile recommendation.

1. Select a PLA material profile in the slicer.
2. Check that the sliced file uses PLA temperatures, not PETG temperatures.
3. Use `Temperature > Preheat PLA > Preheat PLA` when loading filament or setting the Z offset.
4. Feed filament until the new color flows cleanly from the nozzle.
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

PETG can bond extremely strongly to some smooth build surfaces. Follow the build-surface manufacturer's instructions. A thin, even glue-stick layer can act as a release layer on a surface that grips PETG aggressively. Apply it only while the bed is cool.

### Overriding Slicer Temperatures

Open `Temperature` and enable `Override Slicer Temps` when you want the printer to ignore positive nozzle and bed temperatures embedded in an SD-card or USB print. Two additional controls appear:

- `Override Slicer Nozzle` defaults to `200 C`.
- `Override Slicer Bed` defaults to `60 C`.

The override is disabled by default. It changes positive `M104`, `M109`, `M140`, and `M190` targets while an SD-card or recognized USB print is active; zero-temperature commands still turn the heaters off. Change the values to match the loaded material, then use `Configuration > Store Settings` to keep the toggle and temperatures after a restart. Leave the override disabled when the slicer profile should control temperatures normally.

For USB printing, `M75` must be sent before the first temperature command so the firmware recognizes the stream as a print before applying the override.

The firmware's maximum temperature limit is an emergency cutoff, not a recommended printing temperature. Stay within the filament manufacturer's range and the safe range of the installed hotend.

### Automatic First-Layer Controls

`Temperature > Better Bed` is enabled by default. For SD-card and recognized USB prints, it sets temporary `Tune > Speed` to `70%` and `Tune > Fan Speed` to full (`255`) on layers 0 and 1. When layer 2 begins, Tune speed returns to `100%` and the firmware restores the most recent fan speed requested by the slicer.

Cura layer comments are detected directly from SD files. Extrusion-height changes provide the fallback for other files and USB streaming. Disable `Better Bed` before a print to leave both Tune values under normal slicer control.

SD layer changes are synchronized with G-code execution, so reading commands ahead from the card does not advance Better Bed before the corresponding layer starts.

### Loading Filament

1. Confirm that the spool contains `1.75 mm` filament and matches the selected preheat preset.
2. Mount the spool so it can unwind smoothly without rubbing, crossing under another loop, or pulling sharply against the extruder.
3. Cut off any bent, swollen, brittle, or chewed section.
4. Cut the new end cleanly at an angle and straighten the first several inches by hand.
5. Select the correct full preheat preset and wait for the nozzle to reach its target.
6. Squeeze the extruder lever and guide the filament through the extruder entrance. Do not force it beside the drive gear.
7. Continue feeding it through the Bowden tube until it reaches the hotend and plastic exits the nozzle.
8. Purge until the strand flows continuously without gaps, bubbles, or traces of the previous color or material.
9. Release the extruder lever and confirm that the drive gear grips the filament normally.
10. Remove the purge strand with a tool, keeping fingers away from the hot nozzle.
11. Check that the spool still turns freely and no loop has fallen underneath another loop.

Never force filament through a cold nozzle. If the extruder clicks, stop pushing and check the temperature, spool path, Z height, and nozzle for a clog.

### Unloading Filament

1. Identify the material currently in the hotend and select its preheat preset.
2. Wait until the nozzle reaches the required temperature. Never pull filament from a cold hotend.
3. Hold the spool so it cannot unwind uncontrollably.
4. Squeeze the extruder lever.
5. Push the filament forward slightly until a small amount exits the nozzle.
6. Pull the filament backward in one smooth motion until it leaves the extruder.
7. Cut off a damaged or enlarged tip before loading that filament again.
8. Secure the loose end through a spool hole or clip so it cannot pass underneath another loop.
9. Select `Temperature > Cooldown` if another material will not be loaded immediately.

### Swapping Materials

1. Read the recommended temperature range on both spools.
2. Heat the nozzle to a temperature that safely softens the material currently inside it.
3. Follow the unloading procedure and secure the old spool immediately.
4. Mount the new spool, cut a clean angled tip, and load it through the extruder and Bowden tube.
5. Purge enough filament to remove the previous color and material completely.
6. When changing from hotter PETG to cooler PLA, purge PLA while the nozzle is still hot enough to remove the PETG, then lower the target to the PLA printing temperature.
7. When changing from PLA to PETG, raise the nozzle to the PETG loading temperature and purge until all PLA is gone.
8. Confirm that the outgoing strand is steady and matches the new material.
9. Remove the purge strand and select `Cooldown` if printing will not begin immediately.

### Filament Storage

- Store PLA and PETG in sealed bags or boxes with fresh desiccant.
- Secure the filament end so it cannot slip under another loop on the spool.
- PETG generally absorbs moisture faster than PLA.
- Popping, steam, bubbles, rough extrusion, and unusually heavy stringing can indicate wet filament.
- Use a temperature-controlled filament dryer and follow the spool manufacturer's instructions. A household oven may overshoot its setting and damage the filament or spool.

### Drying Filament in a Food Dehydrator

Use these values only as conservative starting points for ordinary PLA and PETG. The filament and spool manufacturer's instructions take priority when they specify a lower temperature or different time.

| Material | Temperature | Time |
| --- | ---: | ---: |
| PLA | `45 C / 113 F` | 6 hours |
| PETG | `55 C / 131 F` | 6 hours |

Use a dehydrator with an adjustable thermostat, a working circulation fan, and enough room for air to move around both sides of the spool. A dehydrator that cannot hold the required low temperature is not suitable for PLA or PETG.

1. Read the dehydrator manual and confirm that it can run continuously for the full drying time.
2. Check the filament label and use its lower recommended temperature if it differs from the table.
3. Confirm that the spool can tolerate the drying temperature. Cardboard glue and some plastic spools can loosen, shrink, or warp.
4. Remove the spool from its bag and remove desiccant packets, clips, loose labels, and other packaging.
5. Put the complete spool in the dehydrator without unwinding it. Keep it away from the heating element and leave airflow space around it.
6. Place a separate thermometer near the spool. Do not rely only on the dehydrator's dial or display.
7. Set PLA to `45 C / 113 F` or PETG to `55 C / 131 F`.
8. Dry for 6 hours, checking the actual temperature and spool condition periodically.
9. Stop immediately if the spool warps, filament becomes soft or sticky, loops begin fusing, or there is an unusual odor.
10. Turn the dehydrator off and let the spool cool without leaving it in humid air for a long period.
11. Put the cooled spool into a sealed bag or dry box with fresh desiccant, or load and use it promptly.

If the filament still pops, bubbles, or prints rough, confirm the thermometer reading and manufacturer directions before repeating the cycle. Do not raise the temperature just to speed up drying.

Prefer a dehydrator dedicated to filament. Filament colorants and additives are not food, so do not assume the appliance remains suitable for food preparation. Operate it on a stable, nonflammable surface with clear vents and follow all appliance safety instructions.

### Other Filament Types

The built-in presets are intended for ordinary PLA and PETG. They are not universal settings for every material.

- TPU and other flexible filaments usually need a slower profile and careful feeding through the Bowden extruder.
- ABS and ASA can warp and release fumes. They need suitable ventilation and often an enclosure designed so the printer electronics and power supply do not overheat.
- Carbon-fiber, glass-fiber, glow, and many metal-filled filaments are abrasive and can quickly wear out a standard brass nozzle.
- Nylon and polycarbonate commonly need very dry filament and temperatures or surroundings beyond what should be assumed safe for a stock CR-20 Pro.
- Check that the hotend, nozzle, build surface, and ventilation are suitable before using anything other than ordinary PLA or PETG.

## Cura and Other Slicers

A slicer converts an STL, OBJ, or 3MF model into the `.gcode` movement and temperature instructions that the printer can run. The printer cannot print an STL, OBJ, or 3MF file directly.

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

The recommended automatic method is to probe at the start of every file. Open the printer profile's start G-code and make sure it contains:

```gcode
G28 ; Home all axes
G29 ; Probe the bed after homing
```

`G29` must come after the final `G28`. Homing after probing can turn leveling compensation off. If the profile already has `G28`, add only `G29` immediately after it instead of adding a second homing command elsewhere.

With this start G-code, the printer homes and runs BLTouch leveling automatically after the job starts. That one automatic cycle satisfies the requirement to level before the print, so do not also run `Motion > Level bed` unless you intentionally want a separate diagnostic cycle.

### Cura Setup

Menu names can vary slightly between Cura releases.

1. Open the printer manager and choose `Add printer`.
2. Choose a local or non-networked printer.
3. Look under `Creality` for `CR-20 Pro` and add it.
4. Open `Machine Settings` and verify the profile values above.
5. In `Start G-code`, find the final `G28` and place `G29` directly after it.
6. Select a `0.4 mm` nozzle and a `1.75 mm` PLA or PETG profile.
7. Import the model and place its intended flat face on the build plate.
8. Choose material, quality, strength, speed, support, and adhesion settings.
9. Select `Slice`.
10. Open `Preview` and move through every layer before exporting or sending the job.
11. Save or send the result as a normal `.gcode` file.

### Any Other Slicer

OrcaSlicer, PrusaSlicer, SuperSlicer, Creality Print, and other FDM slicers use different menu names, but the required checks are the same:

1. Select or create a CR-20 Pro printer profile.
2. Verify Marlin G-code, `220 x 220 x 250 mm`, one extruder, `1.75 mm` filament, and the installed nozzle diameter.
3. Select the correct PLA or PETG filament profile.
4. Put `G29` immediately after the last `G28` in start G-code.
5. Slice and inspect the complete layer preview.
6. Export or send a normal `.gcode` file.

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

Use the retraction settings supplied by the CR-20 Pro profile as the starting point. Change retraction in small steps only after checking temperature and filament dryness.

### Supports and Build-Plate Adhesion

- Use supports only where the model has unsupported overhangs or bridges that need them.
- Inspect support placement in Preview; supports consume material and can mark the model.
- Use a skirt for a normal adhesion and flow check.
- Use a brim for a small contact area, a tall narrow part, or corners that tend to lift.
- Use a raft only after leveling, Z offset, temperature, cleaning, glue, and brim settings have been checked.
- Rotate the model so its strongest layer direction matches how the finished part will be loaded.

### Check the Preview Before Exporting

Inspect the complete sliced preview and confirm:

- The model sits on the build plate and no required section begins in mid-air.
- The first layer has enough contact area.
- Supports exist where they are genuinely needed.
- There are no missing walls or unexpectedly empty layers.
- The nozzle and bed temperatures match the loaded material.
- The estimated material use fits the amount left on the spool.
- The model stays inside the printable area.

The slicer's time estimate and the printer's remaining-time estimate may differ. The printer estimates from actual elapsed time and SD-card byte progress or USB `M73` percentage reports.

## Choose a Print Method

The same `.gcode` can be printed from an SD card or streamed from a computer over USB. SD-card printing is simpler and more resistant to computer, cable, or software interruptions. USB printing is useful for host monitoring and control, but the host must remain reliable for the entire job.

### SD-Card Printing

1. Save the sliced model as a normal `.gcode` file on a compatible SD card.
2. Use a short, recognizable filename without unusual symbols.
3. Eject the card cleanly from the computer before removing it.
4. Insert it into the printer before opening the print-file menu.
5. Complete the [Before Every Print](#before-every-print) procedure.
6. Select the correct file and confirm the print.

Do not remove the SD card, rename its files, or power off the printer while it is reading a print.

### USB Printing

Use a data-capable USB cable and host software that streams normal Marlin G-code. This firmware uses `250000` baud. Select the CR-20 Pro's serial port, connect, and confirm that the printer responds before heating or starting a job.

Before connecting or printing:

1. Put the computer on reliable external power when possible.
2. Disable automatic sleep, hibernation, reboot, and USB power saving for the duration of the print.
3. Close other programs that might open the same serial port.
4. Route the cable where the moving bed and print head cannot pull, pinch, or strike it.
5. Slice and preview the file exactly as you would for an SD-card print.
6. Confirm that start G-code contains `G28` followed by `G29`.
7. Complete the [Before Every Print](#before-every-print) procedure before starting the stream.

For full firmware support, the USB host or G-code should begin with these commands before the first heating command:

```gcode
M75       ; Mark the start of the USB print and start its timer
M73 P0    ; Set initial progress to 0 percent
```

Sending `M75` first lets `Override Slicer Temps`, `Better Bed`, timing, and the finished-print summary recognize the USB job. During the print, send `M73 P<percent>` with values from 0 through 100. For example, `M73 P25` reports 25 percent complete. The progress bar and remaining-time estimate cannot update correctly without these reports.

After the last print move has been sent and completed, the host should send:

```gcode
M73 P100  ; Report completion
M77       ; Finish the USB job and show the print summary
```

Normal end G-code must still turn off the nozzle, bed, and fan. `M77` finishes the job timer and summary; it is not a heater-shutdown command. The firmware recognizes common heating and shutdown sequences, but explicit `M75`, `M73`, and `M77` commands give the clearest USB behavior.

While USB printing:

- Keep the host software open and the cable connected until completion.
- Pause, resume, or cancel from the USB host so it also stops or resumes G-code transmission. The printer's SD controls cannot guarantee that an external program stops sending commands.
- Do not let the computer sleep. A broken connection can leave an incomplete part and may leave the printer waiting in its current state.
- Continue watching the physical printer, especially during homing, probing, heating, and the first layer.
- If communication fails, stop from the host if it still responds. If motion or heating continues unexpectedly, use the printer's power switch and inspect the machine before trying again.

With the expected commands, the LCD behaves like an SD print: elapsed time appears on the left, `Calc.` changes to estimated time remaining after progress begins, Better Bed controls the first two layers, and successful completion opens `Print Finished`.

## Before Every Print

Follow these sections from top to bottom. Do not start the job until the build area is clear and the intended leveling method is known.

### Inspect the File and Printer

1. Confirm that the model was sliced for the CR-20 Pro and the filament currently loaded.
2. Confirm that the G-code uses the correct PLA or PETG temperatures.
3. Inspect the Bowden tube, hotend wiring, bed wiring, belts, rollers, and axis cables for looseness, damage, or anything that could catch during motion.
4. Check that the BLTouch pin is straight, clean, and free to deploy.
5. Remove tools, old prints, purge lines, loose plastic, and other objects from the build area.
6. Check that the spool can unwind freely and the filament is not crossed, tangled, pinched, or nearly empty.
7. Decide whether this job will run from SD or USB and review that method's connection requirements.

### Clean and Glue the Build Plate

Use **WASHABLE PURPLE GLUE STICKS** on the CR-20 Pro build surface. The purple color shows coverage and the washable formula can be removed with water. Do not use superglue, permanent craft adhesive, hot glue, spray adhesive, or an unknown glue stick.

1. Let the build plate cool completely.
2. Remove the previous print, skirt, brim, purge line, loose plastic, dust, fingerprints, and old glue.
3. Use warm water and a small amount of ordinary dish soap for glue cleanup. Keep liquid away from heater wiring, electronics, the plate underside, and motion parts.
4. Dry the top, bottom, and edges completely. Make sure the plate is installed flat and correctly positioned.
5. Avoid touching the cleaned printing area with bare fingers.
6. Draw thin, overlapping lines of washable purple glue across the area where the model, brim, supports, and purge line will touch.
7. Apply thin lines in the other direction for even coverage.
8. Cover slightly beyond the model footprint, then fill only obvious gaps.
9. Stop when there is one smooth film. Ridges, clumps, and multiple thick layers can make the first layer uneven.
10. Keep glue away from plate edges, heater wiring, the underside, motion parts, and the BLTouch pin.

For PLA, the glue provides consistent adhesion. For PETG, it can also serve as a release layer so the material does not bond too aggressively to a smooth surface.

### Prepare the Filament and Nozzle

1. Confirm that the loaded spool matches the sliced material profile.
2. Preheat with the correct preset if filament needs to be loaded, changed, or purged.
3. Purge until filament flows smoothly and the previous color or material is gone.
4. Carefully remove plastic stuck to the nozzle while it is warm. Keep fingers away from the hot metal.
5. Remove the purge strand with a tool before homing or probing.
6. Confirm once more that the spool and filament path move freely.

### Level the Bed

Always complete one BLTouch leveling cycle immediately before every print. Heat the bed to the intended printing temperature first. Make sure the nozzle is clean so an attached blob cannot distort probing or touch the plate.

Use exactly one of these methods:

- **Printer menu:** Select `Motion > Level bed`, wait for the entire probing sequence to finish, and then start the file. Use this when the file does not contain `G29`.
- **Start G-code:** Let the file run `G28` followed immediately by `G29`. This automatic cycle happens after the job starts and satisfies the leveling requirement.

If the file already runs `G28` followed by `G29`, do not run `Motion > Level bed` first unless you intentionally need a second diagnostic cycle. If you do not know what the file contains, level from the menu for this print and correct the slicer profile before the next one.

Keep hands, tools, glue, and loose filament away while the printer homes and probes. Stop the printer if the BLTouch does not deploy correctly or the nozzle moves toward the bed without stopping.

### Start and Watch the First Layer

1. Start the correct file from the SD card or begin streaming it from the connected USB host.
2. If leveling is in start G-code, let `G28` and `G29` finish without touching the printer.
3. Confirm that the nozzle and bed reach the expected temperatures.
4. Watch the purge line, skirt, and complete first layer.
5. Stop the print if the nozzle scrapes, filament does not stick, extrusion stops, the spool tangles, or any cable catches.

## During Printing

### Reading the Main Screen

The main screen shows current nozzle and bed temperatures, machine position, progress, and print timing.

- The progress bar uses SD-card file progress or `M73` percentages sent by a USB host.
- Elapsed print time is aligned above the left edge of the progress bar.
- Estimated time remaining is aligned above the right edge.
- `Calc.` appears until the progress bar gains its first visible filled segment.
- The estimate is recalculated every 60 seconds and counts down between updates.
- The estimate can move up or down because different parts of a file print at different speeds.

Click the control knob during a print to open the menu. `Tune` can adjust speed, nozzle temperature, bed temperature, fan speed, and Probe Z Offset.

### Live Z Adjustment

Watch how the first layer is placed:

- Separate lines, gaps, or poor adhesion usually mean the nozzle is too high. Make the Probe Z Offset slightly more negative.
- Scraping, blocked extrusion, or an excessively flattened layer means the nozzle is too low. Make the offset less negative.
- Change the offset in small steps and let the nozzle print several lines before judging the result.

Open live adjustment by clicking the control knob four times quickly or selecting `Tune > Probe Z Offset`. When the layer looks correct, use `Configuration > Store Settings` after the print to keep the new value.

### Pausing, Resuming, or Stopping

For an SD-card print, use the printer's `Pause print`, `Resume print`, or `Stop print` controls. Keep hands away until all motion has stopped.

For a USB print, pause, resume, and cancel from the host software. A USB host controls the command stream, so using only the printer menu may not stop the computer from sending more commands. Confirm that motion has stopped before touching the printer.

Stop a failing job immediately if continuing could damage the nozzle, bed, wiring, or model.

### Changing Filament During a Print

1. Pause from the printer for SD or from the host for USB.
2. Wait for all motion to stop and for the print head to park if that behavior is available.
3. Keep the nozzle hot enough for the material being removed.
4. Unload the old filament and secure its spool.
5. Load the replacement and purge until it flows cleanly.
6. Keep the purge strand away from the model and remove loose plastic with a tool.
7. Confirm that the spool path is clear before resuming.
8. Watch several resumed layers to verify extrusion and layer bonding.

## After Every Print

### Finish, Cool, and Remove the Part

When a print completes normally, the LCD opens `Print Finished` and shows elapsed time and estimated filament weight. SD prints use the slicer's `Filament used` header when available; otherwise the firmware estimates from accepted extrusion. Press the knob to return to the status screen. Canceled jobs do not show the success summary.

1. Wait for all movement to stop.
2. Confirm that the nozzle, bed, and fan have been turned off. Select `Temperature > Cooldown` if needed.
3. Let the bed and model cool completely. Many prints release more easily when cool.
4. Remove the model without twisting or pulling against the printer frame or BLTouch.
5. Remove skirts, brims, supports, purge lines, and loose plastic.
6. Inspect the nozzle for a forming blob or leak.

### Remove the Glue

Scrub off the glue after every print so the next first layer begins on a clean, even surface.

1. Wait until the bed is completely cool.
2. Remove a removable build surface from the printer before washing it. Never pour water onto the printer.
3. Use warm water, a small amount of ordinary dish soap, and a soft cloth or non-scratch sponge.
4. Do not use steel wool, a metal brush, or anything that can gouge the surface.
5. Rinse a removable surface thoroughly. On a fixed surface, wipe repeatedly with a clean damp cloth without letting liquid reach wiring, electronics, the underside, or plate edges.
6. Dry the top, bottom, and edges completely before reinstalling or heating the plate.
7. Avoid touching the cleaned print area with bare fingers.

Do not scrape hardened glue from a hot plate. Regular cleanup prevents glue buildup from changing first-layer height or making the bottom surface uneven.

### Store the Printer and Filament

1. Secure the filament end so it cannot slip under another spool loop.
2. Store the spool in a sealed bag or dry box with fresh desiccant.
3. Make sure the hotend and bed are cooling normally.
4. Turn the printer off when it is cool and no longer needed.

## Quick Troubleshooting

### Filament Does Not Stick

- Clean and completely dry the cool build surface.
- Apply one thin, even layer of washable purple glue.
- Confirm the correct bed temperature.
- Confirm that leveling completed successfully and `G29` follows `G28` when it is in start G-code.
- Make the Probe Z Offset slightly more negative if the nozzle is too high.
- Reduce first-layer speed or use a brim for a small contact area.

### Nozzle Scrapes the Bed

- Stop the print immediately.
- Make the Probe Z Offset less negative.
- Remove plastic stuck to the nozzle before calibration or probing.
- Check that the build plate is installed flat.
- Run one fresh leveling cycle before restarting.

### BLTouch Fails to Probe

- Stop the printer before touching the probe.
- Check that the pin is straight, clean, and free to move.
- Check that the cable is firmly connected and cannot catch.
- Power-cycle the printer and try `Motion > Auto home` again while ready to switch off power.

### Extruder Clicks or Stops Feeding

- Stop the print if extrusion has failed.
- Confirm that the nozzle reached the required temperature.
- Check that the spool turns freely and filament is not tangled.
- Check whether the nozzle is too close to the bed for plastic to exit.
- Inspect the Bowden tube and nozzle for a blockage.
- Do not increase flow to force material through a clog.

### PLA Has Weak Layers

- Confirm that PLA, not PETG, is selected in the slicer.
- Increase nozzle temperature in a `5 C` step while staying inside the spool's range.
- Reduce excessive part cooling.
- Reduce print speed if the hotend cannot melt filament consistently.

### PETG Is Stringy

- Dry the filament according to its manufacturer's instructions.
- Remove leaked material from the nozzle before printing.
- Lower nozzle temperature in a `5 C` step while staying inside the spool's range.
- Start with the CR-20 Pro profile's retraction settings and tune in small steps.
- Adjust slicer travel settings to avoid unnecessary movement across open areas.

### Corners Lift or the Part Warps

- Clean the cool surface and apply a fresh, thin glue layer.
- Keep the printer away from cold drafts.
- Confirm the correct bed temperature.
- Use a brim for sharp corners or a small footprint.
- Recheck leveling, Z offset, first-layer speed, and temperature before using a raft.

### Time Remaining Stays on `Calc.`

The estimate requires an active SD-card print or a recognized USB print whose host sends `M73` percentages. It remains on `Calc.` until the progress bar first visibly fills. Very short files may finish before a useful estimate can be calculated.

For USB, confirm that `M75` was sent before heating and that the host continues sending `M73 P<percent>` reports.

### USB Does Not Connect or Stops Printing

- Select the correct serial port and `250000` baud.
- Use a short, data-capable USB cable in good condition.
- Close any other application using the printer's serial port.
- Prevent computer sleep, hibernation, automatic restart, and USB power saving.
- Keep the host program running and watch its communication log for errors or repeated retries.
- Do not reconnect and blindly resume from the middle of a file. Home, position, extrusion state, and temperatures must all be known before a safe recovery is possible.

## Important Safety Notes

- The nozzle and bed can cause burns. Let them cool before touching or cleaning them.
- Never put hands near moving axes, belts, lead screws, rollers, or the print head.
- Keep `Allow Negative` disabled for normal printing.
- Never force Z downward when the nozzle is touching the bed.
- Do not leave the printer unattended until the complete first layer has printed successfully.
- USB or remote monitoring does not make an unattended printer safe.
- Do not exceed temperatures recommended by the filament or installed hotend manufacturer.
- The firmware temperature limit is not proof that the stock hotend is safe at that temperature.
- Use ordinary PLA or PETG while learning. Other materials may require hardware, ventilation, or slicer changes.
- Keep water, glue, tools, and loose filament away from electronics, wiring, fans, and moving parts.

## Further Reading

- [Original CR-20 Pro Guide Book](https://asset.conrad.com/media10/add/160267/c1/-/en/002141333ML00/user-safety-instructions-2141333-creality-cr-20-pro-3d-printer-assembly-kit-all-filament-types.pdf)
- [PLA Material Guide](https://help.prusa3d.com/article/pla_2062)
- [PETG Material Guide](https://help.prusa3d.com/article/petg_2059)
- [Filament Drying Guide](https://help.prusa3d.com/article/drying-filament_332086)
- [UltiMaker Cura Overview](https://ultimaker.com/learn/how-to-use-a-3d-printer/)
