// testbass-web.cpp — the test bass and the test guitar for JavaScript (shared/testbass.js): the
// page's worklet, the Node tests and the demo renderers play them through these.

#include "phuzzbox/denormals.h"
#include "phuzzbox/web.h"
#include "testbass.h"

namespace {
struct Handle {
  testbass::Instrument bass;
  float out[128];
  explicit Handle(double fs) : bass(fs) {}
};
alignas(16) double scratch[4096];
} // namespace

extern "C" {
PHUZZ_EXPORT Handle *tb_create(double fs) { return new Handle(fs); }
PHUZZ_EXPORT void tb_destroy(Handle *h) { delete h; }
// 0 the bass, 1 the guitar, as built (what was ringing stops)
PHUZZ_EXPORT void tb_use(Handle *h, int kind) { h->bass.use(kind == 1 ? testbass::Kind::guitar : testbass::Kind::bass); }
PHUZZ_EXPORT void tb_pluck(Handle *h, int string, int fret, double velocity) { h->bass.pluck(string, fret, velocity); }
PHUZZ_EXPORT void tb_mute(Handle *h, int string) { h->bass.mute(string); }
// the finger slides along a string to a (fractional) fret over some seconds
PHUZZ_EXPORT void tb_slide(Handle *h, int string, double fret, double seconds) { h->bass.slide(string, fret, seconds); }
PHUZZ_EXPORT int tb_note(Handle *h, int key, double velocity) { return h->bass.note(key, velocity); }
PHUZZ_EXPORT void tb_note_off(Handle *h, int key) { h->bass.noteOff(key); }
PHUZZ_EXPORT float *tb_out(Handle *h) { return h->out; }
PHUZZ_EXPORT void tb_process(Handle *h, int n) { phuzzbox::NoDenormals ftz; h->bass.process(h->out, n < 128 ? n : 128); }
// settings, by index: 0 pluckAt, 1 pickupAt, 2 cable, 3 Rload, 4 active (0/1), 5 L, 6 R, 7 volts;
// and to read: 8 scale, 9 strings, 10 the coil's capacitance, 11 the pots, 12 pull, 13 the
// finger's or pick's width, 14 the pickup's aperture, 15 kind (0 bass, 1 guitar); and 16 fretless
// (0/1: a slide glides rather than stepping fret by fret), to set and read
PHUZZ_EXPORT void tb_set(Handle *h, int what, double v) {
  testbass::Settings &S = h->bass.settings;
  switch (what) {
    case 0: S.pluckAt = v; break;
    case 1: S.pickupAt = v; break;
    case 2: S.circuit.cable = v; break;
    case 3: S.circuit.Rload = v; break;
    case 4: {
      S.circuit.active = v > 0.5;
      const testbass::Settings built = S.kind == testbass::Kind::guitar ? testbass::guitarSettings() : testbass::bassSettings();
      S.circuit.R = S.circuit.active ? 1000 : built.circuit.R;
      break;
    }
    case 5: S.circuit.L = v; break;
    case 6: S.circuit.R = v; break;
    case 7: S.volts = v; break;
    case 16: S.fretless = v > 0.5; break;
  }
  h->bass.applySettings();
}
PHUZZ_EXPORT double tb_get(Handle *h, int what) {
  const testbass::Settings &S = h->bass.settings;
  switch (what) {
    case 0: return S.pluckAt;
    case 1: return S.pickupAt;
    case 2: return S.circuit.cable;
    case 3: return S.circuit.Rload;
    case 4: return S.circuit.active ? 1 : 0;
    case 5: return S.circuit.L;
    case 6: return S.circuit.R;
    case 7: return S.volts;
    case 8: return S.scale;
    case 9: return S.strings;
    case 10: return S.circuit.Cself;
    case 11: return S.circuit.Rpots;
    case 12: return S.pull;
    case 13: return S.finger;
    case 14: return S.aperture;
    case 15: return S.kind == testbass::Kind::guitar ? 1 : 0;
    case 16: return S.fretless ? 1 : 0;
  }
  return 0;
}
PHUZZ_EXPORT double *tb_scratch() { return scratch; }
// the partials of a string at a fret into scratch: f, σ, amp for each; returns how many
PHUZZ_EXPORT int tb_partials(Handle *h, int string, int fret, double fs) {
  const auto ps = testbass::partials(h->bass.settings, string, fret, fs);
  int n = (int)ps.size();
  if (n > 1300) n = 1300;
  for (int i = 0; i < n; i++) { scratch[3 * i] = ps[i].f; scratch[3 * i + 1] = ps[i].sigma; scratch[3 * i + 2] = ps[i].amp; }
  return n;
}
// kind 0 the bass, 1 the guitar
PHUZZ_EXPORT double tb_inharmonicity(int kind, int string, double length) {
  return testbass::inharmonicity(kind == 1 ? testbass::kGuitarStrings[string] : testbass::kBassStrings[string], length);
}
}
