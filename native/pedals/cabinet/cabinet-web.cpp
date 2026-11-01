// cabinet-web.cpp — the model functions the Cabinet's page and tests call (through the scratch
// area, shared/wasm.js): the small-signal response, the derived parameters, the engine's state.

#include <cmath>
#include <complex>

#include "phuzzbox/web.h"
#include "cabinet-engine.h"
#include "cabinet-model.h"
#include "cabinet-params.h"

extern "C" {
// in: P[kParamCount], then n frequencies (Hz). out (after them), as arrays of n: |H| (out/in), its
// phase, |Z| (Ω, the cabinet as the amp sees it), its phase, |X| (m of cone travel per input volt)
PHUZZ_EXPORT void cabinet_response(double *io, int n) {
  const double *P = io, *f = io + cabinet::kParamCount;
  double *out = io + cabinet::kParamCount + n;
  const cabinet::Model M = cabinet::model(P);
  for (int i = 0; i < n; i++) {
    const cabinet::Response r = cabinet::response(M, f[i]);
    out[i] = std::abs(r.h); out[n + i] = std::arg(r.h);
    out[2 * n + i] = std::abs(r.z); out[3 * n + i] = std::arg(r.z);
    out[4 * n + i] = std::abs(r.x);
  }
}
// in: P. out (at io): Mms, Kms, Bl, Rms (one driver), Cab, Mp, Sp, Ra (its share of the box),
// the port's tuning (Hz, 0 sealed), drivers, a driver's share of the volts, Rg as it sees it, gain
PHUZZ_EXPORT void cabinet_info(double *io) {
  const cabinet::Model M = cabinet::model(io);
  const double v[] = {M.mms, M.kms, M.bl, M.rms, M.cab, M.mp, M.sp, M.ra, M.fb, (double)M.n, M.perVolt, M.rg, M.gain};
  for (int i = 0; i < 13; i++) io[i] = v[i];
}
// the engine's state: coil current, excursion, cone velocity, box pressure, port air velocity
PHUZZ_EXPORT void cabinet_state(phuzzbox::Effect *e, double *out) {
  const auto &s = static_cast<cabinet::Engine *>(e)->st;
  out[0] = s.i; out[1] = s.x; out[2] = s.u; out[3] = s.p; out[4] = s.up;
}
}
