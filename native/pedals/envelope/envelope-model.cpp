// envelope-model.cpp — the Envelope Filter's physics (envelope-model.h).

#include "envelope-model.h"

#include "envelope-params.h"

namespace envelope {

Model model(const double *P) {
  Model M;
  M.mode = (int)std::lround(P[mode]);
  M.q = P[reso];
  M.c = P[rangeC];
  M.gain = std::pow(10.0, P[sens] / 20);
  M.down = P[direction] > 0.5;
  M.ta = P[attack];
  M.td = P[decay];
  M.tau = P[lifetime];
  M.tauE = P[trapTime];
  M.litR = P[litR];
  M.blend = P[blend];
  M.level = std::pow(10.0, P[level] / 20);
  return M;
}

std::complex<double> filterResponse(const Model &M, double fc, double f) {
  using cd = std::complex<double>;
  const cd s(0, f / fc); // s/ω
  const cd d = s * s + s / M.q + 1.0;
  return M.mode == 0 ? 1.0 / d : M.mode == 1 ? s / d : s * s / d;
}

} // namespace envelope
