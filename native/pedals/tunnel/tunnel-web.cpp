// tunnel-web.cpp — the model functions the Tunnel Diode's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <algorithm>
#include <cmath>

#include "tunnel-engine.h"
#include "tunnel-model.h"
#include "tunnel-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the diode's fitted points Ip, Vp, Iv, Vv, Vfp (A, V); its fit I0 (A), Jx (A)
// and C4 (1/V); where its slope is steepest (V) and that slope (S); the switch's thresholds on Vs for
// the load, up and down (V, −1 without memory); the circuit (0 switch, 1 oscillator): 14 numbers
PHUZZ_EXPORT void tunnel_parts(double *io) {
  const tunnel::Parts p = tunnel::parts(io);
  const tunnel::Diode &d = tunnel::diode();
  double up, down;
  tunnel::thresholds(p.R, up, down);
  const double out[] = {d.Ip, d.Vp, d.Iv, d.Vv, d.Vfp, d.I0, d.Jx, d.C4, d.Vm, d.gmin, up, down, p.osc ? 1.0 : 0.0, tunnel::kC};
  for (int k = 0; k < 14; k++) io[k] = out[k];
}
// in: P, then n voltages (V). out (after them): the diode's current at each (A).
PHUZZ_EXPORT void tunnel_curve(double *io, int n) {
  const double *v = io + tunnel::kParamCount;
  double *out = io + tunnel::kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = tunnel::diode().current(v[i]);
}
// in: P, then n source voltages Vs (V). out (after them): n pairs, the static states on the low and
// the high branch for the load (V, NaN where there is none; both the one state without memory).
PHUZZ_EXPORT void tunnel_states(double *io, int n) {
  const tunnel::Parts p = tunnel::parts(io);
  const double *v = io + tunnel::kParamCount;
  double *out = io + tunnel::kParamCount + n;
  for (int i = 0; i < n; i++) tunnel::states(p.R, v[i], out[2 * i], out[2 * i + 1]);
}
// The circuit playing a steady tone: in: P, then the tone's frequency (Hz) and its peak at the input
// (V). It runs from rest with steps of about 1/384 kHz for long enough to settle (a quarter of a
// second, or four periods), then over two periods of the tone gives n points (after the inputs): the
// source's voltage Vs, the diode's voltage V and the current through the load i (V, V, A), three arrays of n.
PHUZZ_EXPORT void tunnel_tone(double *io, int n) {
  const tunnel::Parts p = tunnel::parts(io);
  const double f = io[tunnel::kParamCount], amp = io[tunnel::kParamCount + 1];
  double *out = io + tunnel::kParamCount + 2;
  const int sub = std::max(1, (int)std::ceil(2 * 384000.0 / (f * n)));
  const double h = 2 / (f * n * sub), tau = 6.28318530717958647692;
  tunnel::Circuit cx;
  cx.start(p, p.bias, h);
  const int settle = (int)std::ceil(std::max(0.25, 4 / f) * f / 2) * n * sub; // whole pairs of periods
  for (int i = 0; i < settle + n * sub; i++) {
    const double vs = p.bias + p.drive * amp * std::sin(tau * f * h * (i + 1));
    cx.step(p, vs);
    const int j = i - settle;
    if (j >= 0 && (j + 1) % sub == 0) {
      const int k = j / sub;
      out[k] = vs; out[n + k] = cx.V; out[2 * n + k] = cx.i;
    }
  }
}
PHUZZ_EXPORT double tunnel_evaluations(phuzzbox::Effect *e) { auto &c = static_cast<tunnel::Engine *>(e)->cx; return c.steps ? (double)c.evaluations / c.steps : 0; }
}
