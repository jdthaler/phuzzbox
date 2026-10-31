// phuzz-web.cpp — the model functions the Phuzz's page and tests call (through the scratch area,
// shared/wasm.js), from a parameter array.

#include <cmath>

#include "phuzz-engine.h"
#include "phuzz-model.h"
#include "phuzz-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P[kParamCount]. out (at io): the ten node voltages (A, B, K1, E2, W, K2, X, S, O, V), the
// four transistor currents (out of Q1's collector and base, Q2's collector and base) and the four
// junction voltages (veb1, vcb1, veb2, vcb2), all at the DC operating point.
PHUZZ_EXPORT void phuzz_operating_point(double *io) {
  const phuzz::OperatingPoint op = phuzz::operatingPoint(phuzz::parts(io));
  for (int k = 0; k < phuzz::kNodes; k++) io[k] = op.node[k];
  for (int k = 0; k < 4; k++) { io[phuzz::kNodes + k] = op.i[k]; io[phuzz::kNodes + 4 + k] = op.v[k]; }
}
// A transistor's output characteristics: in P, then nv values of |V_CE| (V), then nb base
// currents (A). out (after them): for each base current, I_C at each |V_CE|, nb arrays of nv.
// which: 0 for Q1, 1 for Q2.
PHUZZ_EXPORT void phuzz_characteristics(double *io, int which, int nv, int nb) {
  const phuzz::Parts p = phuzz::parts(io);
  const phuzz::Transistor &q = which ? p.q2 : p.q1;
  const double *vce = io + phuzz::kParamCount, *ib = vce + nv;
  double *out = io + phuzz::kParamCount + nv + nb;
  for (int b = 0; b < nb; b++)
    for (int k = 0; k < nv; k++) {
      // the base current rises with veb at a fixed V_CE: bisect for the one asked for
      double lo = -1, hi = 1, ic = 0, ibv, d1[2], d2[2];
      for (int it = 0; it < 80; it++) {
        const double mid = 0.5 * (lo + hi);
        q.currents(mid, mid - vce[k], ic, ibv, d1, d2);
        (ibv < ib[b] ? lo : hi) = mid;
      }
      q.currents(0.5 * (lo + hi), 0.5 * (lo + hi) - vce[k], ic, ibv, d1, d2);
      out[b * nv + k] = ic;
    }
}
// The engine's Newton iterations so far, per sample, and the samples that didn't converge.
PHUZZ_EXPORT double phuzz_iterations(phuzzbox::Effect *e) {
  auto *x = static_cast<phuzz::Engine *>(e);
  return x->steps ? (double)x->iterations / x->steps : 0;
}
PHUZZ_EXPORT double phuzz_failures(phuzzbox::Effect *e) { return (double)static_cast<phuzz::Engine *>(e)->failures; }
}
