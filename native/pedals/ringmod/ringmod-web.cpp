// ringmod-web.cpp — the model functions the Ring Modulator's page and tests call (through the
// scratch area, shared/wasm.js), from a parameter array.

#include <cmath>

#include "ringmod-engine.h"
#include "ringmod-model.h"
#include "ringmod-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P, then n carrier voltages (V). out (after them): the switching function dw/dvin at each,
// then w with nothing in (the carrier's leak, V): two arrays of n. No inductors.
PHUZZ_EXPORT void ringmod_switching(double *io, int n) {
  const ringmod::Parts p = ringmod::parts(io);
  const double *v = io + ringmod::kParamCount;
  double *out = io + ringmod::kParamCount + n;
  ringmod::Ring r;
  for (int i = 0; i < n; i++) ringmod::switching(p, v[i], 0, 0, r, out[i], out[n + i]);
}
// in: P. out (after it): one cycle of the carrier in its steady state with nothing in, at n points:
// the carrier's voltage, the switching function and the leak (ringmod::cycle): three arrays of n.
PHUZZ_EXPORT void ringmod_cycle(double *io, int n) {
  const ringmod::Parts p = ringmod::parts(io);
  double *out = io + ringmod::kParamCount;
  ringmod::cycle(p, n, out, out + n, out + 2 * n);
}
// in: P, then n phases (cycles). out (after them): the carrier's voltage at each (V).
PHUZZ_EXPORT void ringmod_carrier(double *io, int n) {
  const ringmod::Parts p = ringmod::parts(io);
  const double *ph = io + ringmod::kParamCount;
  double *out = io + ringmod::kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = ringmod::carrierAt(p, ph[i]);
}
// in: P, then Rs, Rc, RL (Ω; 0 for RL: no load), then n pairs (vin, vcar) (V). out (after them):
// u, vc, w and the four diodes' currents at each, 7 × n, solved from the last; no inductors.
PHUZZ_EXPORT void ringmod_ring(double *io, int n) {
  ringmod::Parts p = ringmod::parts(io);
  const double *r = io + ringmod::kParamCount, *v = r + 3;
  p.Gs = 1 / r[0]; p.Gc = 1 / r[1]; p.GL = r[2] > 0 ? 1 / r[2] : 0;
  double *out = io + ringmod::kParamCount + 3 + 2 * n;
  ringmod::Ring ring;
  for (int i = 0; i < n; i++) {
    if (!ringmod::solve(p, v[2 * i], v[2 * i + 1], 0, 0, 0, 0, ring, 1e-10)) {
      ring = ringmod::Ring{};
      if (!ringmod::solve(p, v[2 * i], v[2 * i + 1], 0, 0, 0, 0, ring, 1e-10)) ring.u = ring.vc = ring.w = NAN;
    }
    ringmod::currents(p, ring);
    double *o = out + 7 * i;
    o[0] = ring.u; o[1] = ring.vc; o[2] = ring.w;
    for (int k = 0; k < 4; k++) o[3 + k] = ring.i[k];
  }
}
// in: P. out (at io): Rs, Rc, RL (Ω), L (H), each diode's saturation current (A) and nVT (V),
// D1's saturation current, the carrier's rise time (s), the recovery amplifier's gain and the Level
// as a factor: 10 numbers
PHUZZ_EXPORT void ringmod_parts(double *io) {
  const ringmod::Parts p = ringmod::parts(io);
  const double out[] = {1 / p.Gs, 1 / p.Gc, 1 / p.GL, p.L, p.d[1].is, p.d[1].nvt, p.d[0].is, p.rise, p.makeup, p.gain};
  for (int k = 0; k < 10; k++) io[k] = out[k];
}
PHUZZ_EXPORT double ringmod_iterations(phuzzbox::Effect *e) { auto *b = static_cast<ringmod::Engine *>(e); return b->steps ? (double)b->iterations / b->steps : 0; }
PHUZZ_EXPORT double ringmod_failures(phuzzbox::Effect *e) { return (double)static_cast<ringmod::Engine *>(e)->failures; }
}
