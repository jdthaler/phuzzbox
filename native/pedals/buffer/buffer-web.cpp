// buffer-web.cpp — the model functions the Buffer's page and tests call (through the scratch area,
// shared/wasm.js): the circuits' responses and resonances, from a parameter array.

#include "buffer-model.h"
#include "buffer-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P[kParamCount], then n frequencies (Hz). out (after them): |recorded|, |wanted|, |H| at each, as
// three arrays of n, where recorded and wanted are v / e and H = wanted / recorded.
PHUZZ_EXPORT void buffer_response(double *io, int n) {
  const double *P = io, *f = io + buffer::kParamCount;
  double *out = io + buffer::kParamCount + n;
  const buffer::Circuits c = buffer::circuits(P);
  const phuzzbox::AnalogBiquad r = c.recorded.section(), w = c.wanted.section(), h = buffer::transfer(c);
  const phuzzbox::AnalogBiquad ri{0, 0, 1, r.a2, r.a1, r.a0}, wi{0, 0, 1, w.a2, w.a1, w.a0};
  for (int i = 0; i < n; i++) {
    out[i] = phuzzbox::analogMagnitude(ri, f[i]);
    out[n + i] = phuzzbox::analogMagnitude(wi, f[i]);
    out[2 * n + i] = phuzzbox::analogMagnitude(h, f[i]);
  }
}
// in: P. out (at io): the recorded and wanted resonances 1/(2π√(LC)) in Hz, and their capacitances in F.
PHUZZ_EXPORT void buffer_resonances(double *io) {
  const buffer::Circuits c = buffer::circuits(io);
  io[0] = c.recorded.resonance();
  io[1] = c.wanted.resonance();
  io[2] = c.recorded.C();
  io[3] = c.wanted.C();
}
}
