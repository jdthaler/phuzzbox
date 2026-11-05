// neon-web.cpp — the model functions the Neon Tremolo's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <cmath>

#include "neon-model.h"
#include "neon-params.h"
#include "phuzzbox/web.h"

using neon::kParamCount;

extern "C" {
// in: P, then n values of pd (Torr·cm). out (after them): the breakdown voltage at each for the
// three gases (neon, helium, argon) at P's γ, n each; infinite where none strikes.
PHUZZ_EXPORT void neon_paschen(double *io, int n) {
  const neon::Parts p = neon::parts(io);
  const double *pd = io + kParamCount;
  double *out = io + kParamCount + n;
  for (int k = 0; k < neon::kGases; k++)
    for (int i = 0; i < n; i++) out[k * n + i] = neon::breakdown(neon::gasOf(k), pd[i], p.gamma);
}
// in: P, the capacitor's starting voltage (V), 1 if the lamp starts lit, a step (s). out (after
// them): n × the capacitor's voltage after each step, then n × the charge through the lamp in it
// (C), then the number of strikes and 1 if the lamp is lit at the end. n under 2000 (the scratch
// area's size): run longer in pieces.
PHUZZ_EXPORT void neon_run(double *io, int n) {
  const neon::Parts p = neon::parts(io);
  neon::Osc o;
  o.v = io[kParamCount];
  o.lit = io[kParamCount + 1] > 0.5;
  const double dt = io[kParamCount + 2];
  double *out = io + kParamCount + 3;
  int strikes = 0;
  for (int i = 0; i < n; i++) {
    out[n + i] = neon::advance(p, o, dt, &strikes);
    out[i] = o.v;
  }
  out[2 * n] = strikes;
  out[2 * n + 1] = o.lit ? 1 : 0;
}
// in: P, the cell's electrons to start, a step (s), then n lights (relative to Iref). out (after
// them): the electrons after each step.
PHUZZ_EXPORT void neon_cell(double *io, int n) {
  const neon::Parts p = neon::parts(io);
  double m = io[kParamCount];
  const double dt = io[kParamCount + 1], *light = io + kParamCount + 2;
  double *out = io + kParamCount + 2 + n;
  for (int i = 0; i < n; i++) out[i] = m = neon::cellStep(p, light[i], m, dt);
}
// in: P. out (at io): the lamp's striking, burning and extinguishing voltages (V); the Paschen
// minimum's pd (Torr·cm); the period, the charging time and the flash's (s); 1 if it never strikes,
// 1 if once lit it glows on; the supply (V), R (Ω), C (F); the gas's A and B, γ, pd; the lit lamp's
// target voltage (V) and time constant (s); the Depth pot's resistance (Ω), the cell's lifetime
// (s), the Level as a factor; the lamp's resistance (Ω), the hold current (A), Iref (A), the cell's
// lit and dark resistance (Ω), Rs (Ω), and the curve's minimum (V): 28 numbers.
PHUZZ_EXPORT void neon_parts(double *io) {
  const neon::Parts p = neon::parts(io);
  const double out[28] = {p.Vb, p.Vm, p.Ve, neon::minimumPd(*p.gas, p.gamma),
                          neon::period(p), neon::chargeTime(p), neon::flashTime(p),
                          neon::neverStrikes(p) ? 1.0 : 0.0, neon::glowsSteadily(p) ? 1.0 : 0.0,
                          p.Vs, p.R, p.C, p.gas->A, p.gas->B, p.gamma, p.pd,
                          neon::litTarget(p), neon::litTau(p), p.Rd, p.tau, p.gain,
                          neon::kBallast, neon::kHold, neon::kIref, neon::kRlit, neon::kRdark, neon::kRs, neon::minimumV(*p.gas, p.gamma)};
  for (int k = 0; k < 28; k++) io[k] = out[k];
}
}
