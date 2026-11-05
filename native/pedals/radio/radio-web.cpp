// radio-web.cpp — the model functions the Crystal Radio's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <algorithm>
#include <cmath>
#include <complex>

#include "radio-engine.h"
#include "radio-model.h"
#include "radio-params.h"
#include "phuzzbox/web.h"

extern "C" {
// in: P. out (at io): the diode's saturation current (A) and nVT (V); the resting carrier at the
// diode (V) and the earphone's voltage on it (V); the detector's slope dV/dA at the tuned-in
// carrier; the amplifier's gain with the Level; γ and Δ (rad/s); the next station's carrier (V)
// and its spacing (Hz); the carrier tuned in (V): 11 numbers
PHUZZ_EXPORT void radio_parts(double *io) {
  const radio::Parts p = radio::parts(io);
  const double A0 = radio::restingAmplitude(p), s = radio::slope(p, p.Ac);
  const double out[] = {p.is, p.nvt, A0, radio::settle(p, A0), s, p.level / (p.k * p.Ac * s), p.gamma(), p.delta(), p.B, radio::kNeighbour, p.Ac};
  for (int k = 0; k < 11; k++) io[k] = out[k];
}
// in: P, then n carrier amplitudes at the diode (V). out (after them): the earphone's steady voltage on each (V).
PHUZZ_EXPORT void radio_settle(double *io, int n) {
  const radio::Parts p = radio::parts(io);
  const double *a = io + radio::kParamCount;
  double *out = io + radio::kParamCount + n;
  for (int i = 0; i < n; i++) out[i] = radio::settle(p, a[i]);
}
// in: P, then n pairs (A, V) (V). out (after them): the diode's current averaged over a cycle of the carrier (A).
PHUZZ_EXPORT void radio_current(double *io, int n) {
  const radio::Parts p = radio::parts(io);
  const double *v = io + radio::kParamCount;
  double *out = io + radio::kParamCount + 2 * n;
  for (int i = 0; i < n; i++) out[i] = radio::meanCurrent(p, v[2 * i], v[2 * i + 1]);
}
// in: P, then n frequencies from the station (Hz). out (after them): the tuned circuit's response at
// each: n pairs (re, im).
PHUZZ_EXPORT void radio_tank(double *io, int n) {
  const radio::Parts p = radio::parts(io);
  const double *f = io + radio::kParamCount;
  double *out = io + radio::kParamCount + n;
  for (int i = 0; i < n; i++) { const auto h = radio::tank(p, f[i]); out[2 * i] = h.real(); out[2 * i + 1] = h.imag(); }
}
// The set receiving a steady tone: in: P, then the tone's frequency (Hz) and its peak at the input
// (V). It runs from rest at about 192 kHz for long enough to settle, then over two periods of the tone
// gives n points (after the inputs): the carrier as sent, the carrier's amplitude at the diode and the
// earphone's voltage (V), three arrays of n. The next station is left out.
PHUZZ_EXPORT void radio_tone(double *io, int n) {
  const radio::Parts p = radio::parts(io);
  const double f = io[radio::kParamCount], amp = io[radio::kParamCount + 1];
  double *out = io + radio::kParamCount + 2;
  const int sub = std::max(1, (int)std::ceil(2 * 192000.0 / (f * n)));
  const double h = 2 / (f * n * sub);
  radio::Receiver rx;
  rx.start(p, h);
  const double tau = 6.28318530717958647692;
  const int settle = (int)std::ceil(std::max(0.03, 4 / f) * f / 2) * n * sub; // whole pairs of periods
  for (int i = 0; i < settle + n * sub; i++) {
    const double env = p.Ac * std::fmax(0.0, 1 + p.k * amp * std::sin(tau * f * h * (i + 1)));
    rx.step(env);
    const int j = i - settle;
    if (j >= 0 && (j + 1) % sub == 0) {
      const int k = j / sub;
      out[k] = env; out[n + k] = rx.A; out[2 * n + k] = rx.V;
    }
  }
}
PHUZZ_EXPORT double radio_iterations(phuzzbox::Effect *e) { auto &r = static_cast<radio::Engine *>(e)->rx; return r.steps ? (double)r.iterations / r.steps : 0; }
}
