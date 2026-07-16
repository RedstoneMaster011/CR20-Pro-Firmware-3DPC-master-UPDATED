/**
 * Optional temperature override for G-code read from an SD print.
 */
#pragma once

#include "../inc/MarlinConfigPre.h"

extern bool override_slicer_temp_settings;
extern int16_t override_slicer_hotend_temp, override_slicer_bed_temp;

int16_t slicer_hotend_target(const float requested);
int16_t slicer_bed_target(const float requested);
