// preamp-web.cpp — the model functions the Tube Preamp's page and tests call (through the scratch
// area, shared/wasm.js), from a parameter array.

#include <complex>
#include <memory>

#include "phuzzbox/web.h"
#include "preamp-engine.h"
#include "preamp-model.h"
#include "preamp-params.h"

namespace {
std::unique_ptr<phuzzbox::dk::Circuit> make(const double *P) {
  preamp::Parts parts;
  auto c = std::make_unique<phuzzbox::dk::Circuit>(preamp::netlist(P, parts), 192000);
  const double u[2] = {P[preamp::bplus], 0};
  c->operatingPoint(u);
  return c;
}
} // namespace

extern "C" {
// in: P[kParamCount], then n frequencies (Hz). out (after them): |H| at each, its phase in radians,
// and |H| of the tone stack and Master alone (the output over the cathode follower's), three
// arrays of n. H is the output per volt recorded at the interface, for a small signal at the
// operating point: the bass's Norton current into the preamp's input, as the engine plays it.
PHUZZ_EXPORT void preamp_response(double *io, int n) {
  const double *P = io, *f = io + preamp::kParamCount;
  double *out = io + preamp::kParamCount + n;
  const auto c = make(P);
  const preamp::Recording r = preamp::recording(P);
  for (int i = 0; i < n; i++) {
    std::complex<double> z[4];
    c->response(f[i], z, 1); // ohms: volts at each output per ampere into the jack
    const double w = 2 * 3.14159265358979323846 * f[i];
    const std::complex<double> yrec = 1.0 / std::complex<double>(r.coilR, w * r.coilL) + std::complex<double>(r.G, w * r.C);
    const std::complex<double> h = z[0] * yrec;
    out[i] = std::abs(h);
    out[n + i] = std::arg(h);
    out[2 * n + i] = std::abs(z[0] / z[2]);
  }
}
// in: P. out (at io): the 20 nodes' DC voltages (A, M, G1, P1, K1, Q, W1, G2, P2, K2, K3, T, O,
// X, S, Y, Z, V, D, E), then each triode's grid and plate voltages from its cathode and its grid
// and plate currents (V1a, V2a, the cathode follower: 4 each), all at the operating point.
PHUZZ_EXPORT void preamp_operating_point(double *io) {
  const auto c = make(io);
  for (int k = 1; k <= preamp::kNodes; k++) io[k - 1] = c->dcNodes()[k];
  const std::vector<double> &v = c->portVoltages(), &i = c->portCurrents();
  for (int t = 0; t < 3; t++) {
    double *o = io + preamp::kNodes + 4 * t;
    o[0] = v[2 * t]; o[1] = v[2 * t + 1]; o[2] = i[2 * t]; o[3] = i[2 * t + 1];
  }
}
// The chosen tube's plate characteristics: in P, then nv plate voltages, then ng grid voltages
// (from the cathode). out (after them): the plate current at each, ng arrays of nv.
PHUZZ_EXPORT void preamp_plate_curves(double *io, int nv, int ng) {
  const phuzzbox::dk::Netlist::Tube t = preamp::tubeOf(io);
  const double *va = io + preamp::kParamCount, *vg = va + nv;
  double *out = io + preamp::kParamCount + nv + ng;
  for (int g = 0; g < ng; g++)
    for (int k = 0; k < nv; k++) {
      double ig, ia;
      phuzzbox::dk::triodeCurrents(t, vg[g], va[k], ig, ia);
      out[g * nv + k] = ia;
    }
}
// The engine's Newton iterations so far, per sample, and the samples that didn't converge.
PHUZZ_EXPORT double preamp_iterations(phuzzbox::Effect *e) {
  auto *x = static_cast<preamp::Engine *>(e);
  return x->steps ? (double)x->iterations / x->steps : 0;
}
PHUZZ_EXPORT double preamp_failures(phuzzbox::Effect *e) { return (double)static_cast<preamp::Engine *>(e)->failures; }
}
