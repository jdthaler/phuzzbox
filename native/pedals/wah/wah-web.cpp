// wah-web.cpp — the model functions the Wah's page and tests call (through the scratch area,
// shared/wasm.js): the small-signal response at the operating point, and the operating point.

#include <cmath>
#include <complex>
#include <vector>

#include "phuzzbox/web.h"
#include "wah-model.h"
#include "wah-params.h"

namespace {
phuzzbox::dk::Circuit make(const double *P) {
  wah::Parts parts;
  const bool back = wah::backwards(P);
  phuzzbox::dk::Circuit c(wah::netlist(P, parts, back), 48000);
  const double uf[2] = {0, P[wah::vcc]}, ub[2] = {P[wah::vcc], 0};
  c.operatingPoint(back ? ub : uf);
  return c;
}
} // namespace

extern "C" {
// in: P[kParamCount], then n frequencies (Hz). out (after them): |H| at each, then its phase in
// radians, as two arrays of n: the output over the input for a small signal at the operating point.
// Plugged in backwards (Reversed), H is the voltage at the input jack, which drives the amp, per
// volt recorded at the interface: the bass's Norton current into the output jack, as the engine
// plays it.
PHUZZ_EXPORT void wah_response(double *io, int n) {
  const double *P = io, *f = io + wah::kParamCount;
  double *out = io + wah::kParamCount + n;
  const phuzzbox::dk::Circuit c = make(P);
  const bool back = wah::backwards(P);
  const wah::Recording r = wah::recording(P);
  for (int i = 0; i < n; i++) {
    std::complex<double> h[2];
    if (!back) c.response(f[i], h);
    else {
      c.response(f[i], h, 1); // ohms: volts at each output per ampere into the output jack
      const double w = 2 * 3.14159265358979323846 * f[i];
      h[0] *= 1.0 / std::complex<double>(r.coilR, w * r.coilL) + std::complex<double>(r.G, w * r.C);
    }
    out[i] = std::abs(h[0]);
    out[n + i] = std::arg(h[0]);
  }
}
// in: P. out (at io): the 13 nodes' DC voltages (node 1 first), in volts.
PHUZZ_EXPORT void wah_operating_point(double *io) {
  const phuzzbox::dk::Circuit c = make(io);
  for (int k = 1; k <= 13; k++) io[k - 1] = c.dcNodes()[k];
}
// Does it squeal? Plugged in backwards from a passive bass, the loop can oscillate on its own (its
// linearised circuit has poles in the right half-plane), and then there is no steady response to
// show. This plays the circuit from its operating point after a nudge (a microampere into the
// output jack for one sample) for 0.4 s, as the engine would, and watches what the input jack does.
// in: P. out (at io): 1 if it is still going over the last 0.1 s (above a millivolt: a stable
// circuit has forgotten the nudge by then, below a nanovolt), else 0; then its frequency there (Hz,
// from the upward zero crossings) and its peak (V).
PHUZZ_EXPORT void wah_squeal(double *io) {
  phuzzbox::dk::Circuit c = make(io);
  const bool back = wah::backwards(io);
  const double fs = 48000, vcc = io[wah::vcc];
  const int n = (int)(0.4 * fs), late = (int)(0.3 * fs);
  std::vector<double> tail;
  double y[2] = {0, 0};
  for (int k = 0; k < n; k++) {
    const double nudge = k == 0 ? 1e-6 : 0;
    const double u[2] = {back ? vcc : nudge * 1e4, back ? nudge : vcc}; // forward: 10 mV into the input
    c.step(u, y);
    if (k >= late) tail.push_back(y[0]);
  }
  // its swing about its mean over the last 0.1 s (the jacks are AC-coupled; a slow drift is no squeal)
  double mean = 0, peak = 0, prev = 0;
  for (double v : tail) mean += v;
  mean /= (double)tail.size();
  int up = 0, first = -1, last = -1;
  for (int k = 0; k < (int)tail.size(); k++) {
    const double v = tail[k] - mean;
    peak = std::fmax(peak, std::fabs(v));
    if (k > 0 && prev < 0 && v >= 0) { up++; if (first < 0) first = k; last = k; }
    prev = v;
  }
  io[0] = peak > 1e-3 ? 1 : 0;
  io[1] = up > 1 ? (up - 1) * fs / (last - first) : 0;
  io[2] = peak;
}
}
