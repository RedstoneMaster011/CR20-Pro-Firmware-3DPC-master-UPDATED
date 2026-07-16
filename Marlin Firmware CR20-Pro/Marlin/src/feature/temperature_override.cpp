/**
 * Optional temperature override for G-code read from an SD print.
 */

#include "../inc/MarlinConfig.h"
#include "temperature_override.h"
#include "print_summary.h"

bool override_slicer_temp_settings = SLICER_TEMP_OVERRIDE_DEFAULT;
int16_t override_slicer_hotend_temp = SLICER_OVERRIDE_HOTEND_TEMP,
        override_slicer_bed_temp = SLICER_OVERRIDE_BED_TEMP;

static bool should_override(const int16_t requested) {
  return override_slicer_temp_settings && requested > 0 && print_summary_active();
}

int16_t slicer_hotend_target(const float requested) {
  const int16_t target = requested;
  return should_override(target) ? override_slicer_hotend_temp : target;
}

int16_t slicer_bed_target(const float requested) {
  const int16_t target = requested;
  return should_override(target) ? override_slicer_bed_temp : target;
}
