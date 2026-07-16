/**
 * Automatic speed and fan control for the first printed layers.
 */

#include "../inc/MarlinConfig.h"
#include "first_layer_control.h"

#include "../module/motion.h"
#include "../module/temperature.h"

#include <string.h>

FirstLayerControl first_layer_control;
bool better_bed_enabled = BETTER_BED_DEFAULT;

void FirstLayerControl::begin() {
  if (active_) return; // M24 also resumes a paused SD print.
  active_ = true;
  early_layers_ = marker_seen_ = have_extrusion_z_ = false;
  marker_layer_ = parsed_marker_layer_ = -1;
  comment_length_ = 0;
  requested_fan_ = thermalManager.fan_speed[0];
}

void FirstLayerControl::end() {
  if (early_layers_) thermalManager.set_fan_speed(0, requested_fan_);
  feedrate_percentage = 100;
  active_ = early_layers_ = false;
}

void FirstLayerControl::set_layer(const int16_t layer) {
  if (!active_) return;
  if (!better_bed_enabled) {
    if (early_layers_) {
      early_layers_ = false;
      feedrate_percentage = 100;
      thermalManager.set_fan_speed(0, requested_fan_);
    }
    return;
  }
  if (layer < FIRST_LAYERS_COUNT) {
    early_layers_ = true;
    feedrate_percentage = FIRST_LAYERS_SPEED_PERCENT;
    thermalManager.set_fan_speed(0, FIRST_LAYERS_FAN_SPEED);
  }
  else if (early_layers_) {
    early_layers_ = false;
    feedrate_percentage = 100;
    thermalManager.set_fan_speed(0, requested_fan_);
  }
}

void FirstLayerControl::begin_comment() {
  comment_length_ = 0;
}

void FirstLayerControl::comment_char(const char c) {
  if (comment_length_ < sizeof(comment_) - 1)
    comment_[comment_length_++] = c;
}

int16_t FirstLayerControl::end_comment() {
  comment_[comment_length_] = '\0';
  if (!strncmp(comment_, "LAYER:", 6)) {
    int16_t layer = 0;
    bool found = false;
    for (uint8_t i = 6; i < comment_length_ && comment_[i] >= '0' && comment_[i] <= '9'; i++) {
      found = true;
      layer = layer * 10 + comment_[i] - '0';
    }
    if (found) {
      parsed_marker_layer_ = layer;
      return layer;
    }
  }
  else if (!strncmp(comment_, "LAYER_CHANGE", 12)) {
    return ++parsed_marker_layer_;
  }
  return -1;
}

void FirstLayerControl::on_layer_marker(const int16_t layer) {
  marker_seen_ = true;
  marker_layer_ = layer;
  set_layer(layer);
}

void FirstLayerControl::on_extrusion(const float z) {
  if (!active_ || marker_seen_) return;
  if (!have_extrusion_z_) {
    have_extrusion_z_ = true;
    last_extrusion_z_ = z;
    marker_layer_ = 0;
    set_layer(marker_layer_);
  }
  else if (z > last_extrusion_z_ + 0.05f) {
    last_extrusion_z_ = z;
    set_layer(++marker_layer_);
  }
}

uint8_t FirstLayerControl::fan_target(const uint8_t fan, const uint8_t requested) {
  if (active_ && fan == 0) requested_fan_ = requested;
  return active_ && better_bed_enabled && early_layers_ && fan == 0 ? FIRST_LAYERS_FAN_SPEED : requested;
}

int16_t FirstLayerControl::speed_target(const int16_t requested) const {
  return active_ && better_bed_enabled && early_layers_ ? FIRST_LAYERS_SPEED_PERCENT : requested;
}
