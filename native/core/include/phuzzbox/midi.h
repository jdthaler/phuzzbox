// midi.h — MIDI foot controllers on a pedal in the plugins and the app: which control change moves
// which control, with the FC-300's factory numbers as the defaults. The same rules as the pages'
// shared/midi.js: a continuous control follows the CC's 0–127 along its travel; a switch is
// latching (≥ 64 on) or momentary (each press toggles); a choice takes the nearest option.
#pragma once

#include <cmath>
#include <cstdint>
#include <cstring>

#include "phuzzbox/pedal.h"

namespace phuzzbox {

// Roland FC-300 in Control Change mode, as it leaves the factory (owner's manual, pp. 21–22)
namespace fc300 {
constexpr int exp1 = 7, exp2 = 1, pedal1 = 65, pedal2 = 66;
}

// a volume pedal's audio-taper pot: (81^x − 1)/80, 10 % at half travel
inline double audioTaper(double x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return (std::pow(81.0, x) - 1) / 80; }

// What a mapping moves: one of the pedal's parameters (its index), or the host's two of its own.
enum MidiTarget : int16_t { MIDI_BYPASS = -1, MIDI_VOLUME = -2 };

struct MidiMapping {
  uint8_t cc = 0;
  uint8_t channel = 0;    // 1–16, or 0 for any
  int16_t target = MIDI_VOLUME;
  bool momentary = false; // a switch that sends 127 while held (each press toggles); else latching
  bool invert = false;
};

class MidiMap {
 public:
  static constexpr int MAX = 32;
  MidiMapping maps[MAX];
  int count = 0;

  // expression pedal 1 the volume, expression pedal 2 the pedal's expression control (if it has
  // one), number pedal 1 the bypass
  void defaults(const PedalInfo &pedal) {
    count = 0;
    add({fc300::exp1, 0, MIDI_VOLUME, false, false});
    if (pedal.expression >= 0) add({fc300::exp2, 0, (int16_t)pedal.expression, false, false});
    add({fc300::pedal1, 0, MIDI_BYPASS, false, false});
  }
  bool add(const MidiMapping &m) { if (count >= MAX) return false; maps[count++] = m; return true; }

  // One MIDI message. For each mapping it fires, calls f(target, kind, value): kind 'c' a
  // position 0…1, 's' a switch's state 0 or 1, 't' a momentary press (toggle), 'i' a choice's index.
  // `choices(target)` gives a choice parameter's option count (0 for anything else).
  template <class F, class Choices>
  void handle(const uint8_t *data, int size, const PedalInfo &pedal, F &&f, Choices &&choices) {
    if (size < 3 || (data[0] & 0xf0) != 0xb0 || data[1] > 119) return;
    const int channel = (data[0] & 0x0f) + 1, cc = data[1], value = data[2];
    const int previous = last[channel - 1][cc];
    last[channel - 1][cc] = (uint8_t)value;
    for (int k = 0; k < count; k++) {
      const MidiMapping &m = maps[k];
      if (m.cc != cc || (m.channel && m.channel != channel)) continue;
      const int v = m.invert ? 127 - value : value;
      const bool isSwitch = m.target == MIDI_BYPASS || (m.target >= 0 && m.target < pedal.paramCount && pedal.params[m.target].kind == ParamKind::toggle);
      const int n = m.target >= 0 ? choices(m.target) : 0;
      if (n > 1) f(m.target, 'i', std::round(v / 127.0 * (n - 1)));
      else if (!isSwitch) f(m.target, 'c', v / 127.0);
      else if (m.momentary) { if (v >= 64 && !(previous >= 64 && previous != 255)) f(m.target, 't', 1.0); }
      else f(m.target, 's', v >= 64 ? 1.0 : 0.0);
    }
  }

 private:
  uint8_t last[16][128] = {}; // the last value of each CC (255: none yet)
 public:
  MidiMap() { std::memset(last, 255, sizeof last); }
};

} // namespace phuzzbox
