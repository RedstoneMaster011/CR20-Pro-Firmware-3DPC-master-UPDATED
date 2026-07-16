/**
 * Automatic speed and fan control for the first printed layers.
 */
#pragma once

#include "../inc/MarlinConfigPre.h"

class FirstLayerControl {
public:
  void begin();
  void end();
  void begin_comment();
  void comment_char(const char c);
  int16_t end_comment();
  void on_layer_marker(const int16_t layer);
  void on_extrusion(const float z);
  uint8_t fan_target(const uint8_t fan, const uint8_t requested);
  int16_t speed_target(const int16_t requested) const;

private:
  void set_layer(const int16_t layer);

  char comment_[16];
  uint8_t comment_length_, requested_fan_;
  int16_t marker_layer_, parsed_marker_layer_;
  float last_extrusion_z_;
  bool active_, early_layers_, marker_seen_, have_extrusion_z_;
};

extern FirstLayerControl first_layer_control;
extern bool better_bed_enabled;
