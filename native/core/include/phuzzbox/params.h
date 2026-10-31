// params.h — a pedal's parameters and presets. tools/gen-native-params.mjs writes these tables from
// the JavaScript descriptor (<slug>/src/<slug>-params.js), which stays the single source of them.
#pragma once

#include <cstddef>
#include <cstdint>

namespace phuzzbox {

enum class ParamKind : uint8_t { continuous, choice, toggle };

struct ParamInfo {
  const char *id;    // the JavaScript id; the plugins' parameter ids are hashed from it
  const char *label;
  const char *group;
  ParamKind kind;
  double min, max, def; // a choice: 0 … count − 1, def its default index; a toggle: 0 … 1
  double step;          // 0 = continuous
  bool log;             // the knob turns in log(value)
  const char *unit;     // shown after the number ("kΩ", "pF", "dB")
  double scale;         // shown = value × scale (a value in ohms shown in kΩ: 0.001)
  int decimals;         // shown with this many decimals
  const char *const *choices = nullptr; // a choice's labels
  int choiceCount = 0;
};

struct PresetValue {
  uint16_t param;
  double value;
};

struct Preset {
  const char *name;
  const PresetValue *values;
  uint16_t count;
};

// Clamp to the range and snap to the step (and choices and toggles to whole numbers).
double constrain(const ParamInfo &p, double v);
// Position 0..1 along the control (log parameters in log(value)), and back.
double toNormalized(const ParamInfo &p, double v);
double fromNormalized(const ParamInfo &p, double x);
// The value as the page shows it ("3.50 H", "−3.0 dB", a choice's label).
void formatValue(const ParamInfo &p, double v, char *out, size_t size);
// Read a value typed in the same form (the number, with or without its unit), clamped to the
// range; false if unreadable.
bool parseValue(const ParamInfo &p, const char *text, double &v);
// A stable 31-bit id for a parameter, from its JavaScript id (FNV-1a), as Forte's.
uint32_t paramHash(const char *id);

} // namespace phuzzbox
