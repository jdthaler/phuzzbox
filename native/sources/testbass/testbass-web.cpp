// testbass-web.cpp — the test bass for JavaScript (shared/testbass.js): the page's worklet, the Node
// tests and the demo renderers play it through these.

#include "phuzzbox/denormals.h"
#include "phuzzbox/web.h"
#include "testbass.h"

namespace {
struct Handle {
  testbass::Bass bass;
  float out[128];
  explicit Handle(double fs) : bass(fs) {}
};
alignas(16) double scratch[4096];
} // namespace

extern "C" {
PHUZZ_EXPORT Handle *tb_create(double fs) { return new Handle(fs); }
PHUZZ_EXPORT void tb_destroy(Handle *h) { delete h; }
PHUZZ_EXPORT void tb_pluck(Handle *h, int string, int fret, double velocity) { h->bass.pluck(string, fret, velocity); }
PHUZZ_EXPORT void tb_mute(Handle *h, int string) { h->bass.mute(string); }
PHUZZ_EXPORT int tb_note(Handle *h, int key, double velocity) { return h->bass.note(key, velocity); }
PHUZZ_EXPORT void tb_note_off(Handle *h, int key) { h->bass.noteOff(key); }
PHUZZ_EXPORT float *tb_out(Handle *h) { return h->out; }
PHUZZ_EXPORT void tb_process(Handle *h, int n) { phuzzbox::NoDenormals ftz; h->bass.process(h->out, n < 128 ? n : 128); }
// settings, by index: 0 pluckAt, 1 pickupAt, 2 cable, 3 Rload, 4 active (0/1), 5 L, 6 R, 7 volts
PHUZZ_EXPORT void tb_set(Handle *h, int what, double v) {
  testbass::Settings &S = h->bass.settings;
  switch (what) {
    case 0: S.pluckAt = v; break;
    case 1: S.pickupAt = v; break;
    case 2: S.circuit.cable = v; break;
    case 3: S.circuit.Rload = v; break;
    case 4: S.circuit.active = v > 0.5; if (S.circuit.active) S.circuit.R = 1000; else S.circuit.R = 10500; break;
    case 5: S.circuit.L = v; break;
    case 6: S.circuit.R = v; break;
    case 7: S.volts = v; break;
  }
  h->bass.applySettings();
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
PHUZZ_EXPORT double tb_inharmonicity(int string, double length) { return testbass::inharmonicity(testbass::kStringSpecs[string], length); }
}
