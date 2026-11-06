// bandgap-web.cpp — the model functions the Bandgap's page and tests call (through the scratch area,
// shared/wasm.js), from a parameter array.

#include <cmath>

#include "bandgap-engine.h"
#include "bandgap-model.h"
#include "bandgap-params.h"
#include "phuzzbox/web.h"

namespace {
// the stacks of diodes of family k (or the chosen one, k < 0) at P's temperature and count
bandgap::Parts stacks(const double *P, int k) {
  double Q[bandgap::kParamCount];
  for (int i = 0; i < bandgap::kParamCount; i++) Q[i] = P[i];
  if (k >= 0) Q[bandgap::diodes] = k;
  return bandgap::parts(Q);
}
} // namespace

extern "C" {
// in: P, then n voltages (V) across the diodes. out (after them): the current through them (A)
// at each, positive one way and negative the other, for family k (0…5, or −1: P's own).
PHUZZ_EXPORT void bandgap_iv(double *io, int k, int n) {
  const bandgap::Parts p = stacks(io, k);
  const double *v = io + bandgap::kParamCount;
  double *out = io + bandgap::kParamCount + n, s;
  for (int i = 0; i < n; i++) out[i] = p.up.current(v[i], s) - p.down.current(-v[i], s);
}
// in: P, then a current (A). out (at io): for each family 0…5 at P's temperature and count, the
// voltage up and the voltage down that pass that current (V), then its 1 mA voltage at 25 °C (V),
// its bandgap (eV) and its light's wavelength (m, 0 if none): 6 × 5 numbers.
PHUZZ_EXPORT void bandgap_families(double *io) {
  const double i = io[bandgap::kParamCount];
  double out[bandgap::kFamilies * 5];
  for (int k = 0; k < bandgap::kFamilies; k++) {
    const bandgap::Parts p = stacks(io, k);
    const bandgap::Family &f = bandgap::family(k);
    out[5 * k] = p.up.voltageAt(i);
    out[5 * k + 1] = p.down.voltageAt(i);
    out[5 * k + 2] = f.v1mA;
    out[5 * k + 3] = f.eg;
    out[5 * k + 4] = f.lambda;
  }
  for (int k = 0; k < bandgap::kFamilies * 5; k++) io[k] = out[k];
}
// in: P, then n frequencies (Hz). out (after them): the small-signal gain to the output, |H| with
// the Level, and its phase (rad): two arrays of n.
PHUZZ_EXPORT void bandgap_response(double *io, int n) {
  const bandgap::Parts p = bandgap::parts(io);
  const double *f = io + bandgap::kParamCount;
  double *out = io + bandgap::kParamCount + n;
  for (int i = 0; i < n; i++) {
    const std::complex<double> H = bandgap::response(p, f[i]) * p.gain;
    out[i] = std::abs(H);
    out[n + i] = std::arg(H);
  }
}
// in: P. out (at io): the rail (V), the op-amp's slew rate (V/s), gain–bandwidth (Hz) and Vs (V),
// Rf, Rg, Cg, Rt, Cd (Ω, F), the Level as a factor, and the Filter's Rft and Ct (Ω, F).
PHUZZ_EXPORT void bandgap_parts(double *io) {
  const bandgap::Parts p = bandgap::parts(io);
  const double out[] = {p.rail, p.SR, p.GBW, p.Vs, p.Rf, p.Rg, p.Cg, p.Rt, p.Cd, p.gain, p.Rft, p.Ct};
  for (int k = 0; k < 12; k++) io[k] = out[k];
}
PHUZZ_EXPORT double bandgap_iterations(phuzzbox::Effect *e) { auto *b = static_cast<bandgap::Engine *>(e); return b->steps ? (double)b->iterations / b->steps : 0; }
PHUZZ_EXPORT double bandgap_failures(phuzzbox::Effect *e) { return (double)static_cast<bandgap::Engine *>(e)->failures; }
}
