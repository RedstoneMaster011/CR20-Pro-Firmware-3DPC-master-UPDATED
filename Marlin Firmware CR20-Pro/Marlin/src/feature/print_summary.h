/**
 * Shared SD / USB print lifecycle and finished-print summary.
 */
#pragma once

#include "../inc/MarlinConfigPre.h"

void print_summary_begin_sd();
void print_summary_cancel_sd();
void print_summary_begin_host();
bool print_summary_host_active();
bool print_summary_active();
void print_summary_note_extrusion(const float e_delta);
void print_summary_finish_host();
void print_summary_show_finished();
