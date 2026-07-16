/**
 * Shared SD / USB print lifecycle and finished-print summary.
 */

#include "../inc/MarlinConfig.h"
#include "print_summary.h"
#include "first_layer_control.h"

#include "../module/printcounter.h"

#if ENABLED(SDSUPPORT)
  #include "../sd/cardreader.h"
#endif

#if HAS_LCD_MENU
  #include "../lcd/menu/menu.h"
  #include "../lcd/ultralcd.h"
  #include "../libs/duration_t.h"
  #include "../libs/numtostr.h"
#endif

#include <string.h>

static bool summary_active, host_active;
static float extruded_mm, slicer_grams = -1.0f;

static float filament_grams_from_mm(const float length_mm) {
  const float radius = DEFAULT_NOMINAL_FILAMENT_DIA * 0.5f;
  return length_mm * 3.1415926f * radius * radius * FILAMENT_DENSITY_G_CM3 * 0.001f;
}

#if ENABLED(SDSUPPORT)

  static float parse_positive_decimal(const char *p, const char **endptr) {
    while (*p && (*p < '0' || *p > '9') && *p != '.') p++;
    float value = 0.0f, scale = 0.0f;
    while (*p >= '0' && *p <= '9') value = value * 10.0f + (*p++ - '0');
    if (*p == '.') {
      p++;
      scale = 0.1f;
      while (*p >= '0' && *p <= '9') {
        value += (*p++ - '0') * scale;
        scale *= 0.1f;
      }
    }
    if (endptr) *endptr = p;
    return value;
  }

  static bool parse_filament_line(char *line, float &grams) {
    const char *value = strstr(line, "Filament used:");
    bool value_is_mm = false;
    if (!value) {
      value = strstr(line, "filament used [mm]");
      value_is_mm = value != nullptr;
    }
    if (!value) return false;

    const char *end;
    const float amount = parse_positive_decimal(value, &end);
    if (amount <= 0.0f) return false;

    while (*end == ' ') end++;
    const float length_mm = value_is_mm || !strncmp(end, "mm", 2) ? amount : amount * 1000.0f;
    grams = filament_grams_from_mm(length_mm);
    return true;
  }

  static void read_sd_filament_estimate() {
    if (!card.isFileOpen()) return;

    const uint32_t saved_index = card.getIndex(), scan_bytes = MIN(card.getFileSize(), 1024UL);
    char line[64];
    uint8_t length = 0;
    card.setIndex(0);

    for (uint32_t i = 0; i < scan_bytes; i++) {
      const int16_t read_char = card.get();
      if (read_char < 0) break;
      const char c = char(read_char);
      if (c == '\n' || c == '\r') {
        if (length) {
          line[length] = '\0';
          if (parse_filament_line(line, slicer_grams)) break;
          length = 0;
        }
      }
      else if (length < sizeof(line) - 1)
        line[length++] = c;
    }

    card.setIndex(saved_index);
  }

#endif

static void begin_summary() {
  if (summary_active) return;
  summary_active = true;
  extruded_mm = 0.0f;
  slicer_grams = -1.0f;
  first_layer_control.begin();
}

void print_summary_begin_sd() {
  if (summary_active) return;
  begin_summary();
  #if ENABLED(SDSUPPORT)
    read_sd_filament_estimate();
  #endif
}

void print_summary_cancel_sd() {
  if (!host_active) summary_active = false;
}

void print_summary_begin_host() {
  #if ENABLED(SDSUPPORT)
    if (card.isPrinting()) return;
  #endif
  host_active = true;
  begin_summary();
}

bool print_summary_host_active() { return host_active; }

bool print_summary_active() {
  return summary_active
    #if ENABLED(SDSUPPORT)
      || card.isPrinting()
    #endif
  ;
}

void print_summary_note_extrusion(const float e_delta) {
  if (summary_active) extruded_mm = MAX(0.0f, extruded_mm + e_delta);
}

void print_summary_finish_host() {
  if (!host_active) return;
  host_active = summary_active = false;
  first_layer_control.end();
}

#if HAS_LCD_MENU

  static uint32_t finished_seconds;
  static float finished_grams;

  static void menu_print_finished() {
    if (ui.use_click()) {
      ui.defer_status_screen(false);
      return ui.return_to_status();
    }

    char elapsed_string[10], filament_string[10];
    duration_t(finished_seconds).toDigital(elapsed_string, finished_seconds >= 86400UL);

    const char *number = ftostr42_52(finished_grams);
    while (*number == ' ') number++;
    filament_string[0] = '~';
    const uint8_t number_length = MIN(strlen(number), sizeof(filament_string) - 3);
    memcpy(&filament_string[1], number, number_length);
    filament_string[number_length + 1] = 'g';
    filament_string[number_length + 2] = '\0';

    START_SCREEN();
    STATIC_ITEM("Print Finished", true, true);
    STATIC_ITEM("Elapsed: ", false, false, elapsed_string);
    STATIC_ITEM("Filament: ", false, false, filament_string);
    END_SCREEN();
  }

#endif

void print_summary_show_finished() {
  summary_active = host_active = false;

  #if HAS_LCD_MENU
    finished_grams = slicer_grams >= 0.0f ? slicer_grams : filament_grams_from_mm(extruded_mm);
    finished_seconds = print_job_timer.duration();
    ui.use_click();
    ui.goto_screen(menu_print_finished);
    ui.defer_status_screen();
  #endif
}
