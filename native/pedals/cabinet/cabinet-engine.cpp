// cabinet-engine.cpp — the Speaker Cabinet as an effect (cabinet-engine.h).

#include "cabinet-engine.h"

#include <algorithm>
#include <cmath>

namespace cabinet {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  every = (int)std::lround(0.002 * fs);
  setParams(P);
}

void Engine::reset() { st = State{}; }

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  const bool ported = M.ported;
  M = model(P);
  if (ported != M.ported) st.up = 0;
  // RK4 is stable to |λh| ≈ 2.8: the coil's (Re + Rg)/Le is the fastest rate
  const double lam = (M.re + M.rg) / M.le / fs;
  sub = std::max(1, (int)std::ceil(lam / 1.5));
}

namespace {
inline State axpy(const State &s, const State &d, double h) { return {s.i + h * d.i, s.x + h * d.x, s.u + h * d.u, s.p + h * d.p, s.up + h * d.up}; }
// Below these the cabinet is silent by hundreds of dB: then forget it all at once. Flushing each
// state alone would freeze the others (a cone held off centre by a zeroed velocity), and leave
// WebAssembly, which keeps denormals, working on the remains.
inline bool quiet(const State &s) {
  return std::abs(s.i) < 1e-12 && std::abs(s.x) < 1e-15 && std::abs(s.u) < 1e-12 && std::abs(s.p) < 1e-9 && std::abs(s.up) < 1e-15;
}
} // namespace

void Engine::process(const float *in, float *L, float *R, int count) {
  const double h = 1 / (fs * sub), k = (double)M.n * RHO / (2 * PI * MIC_R) * M.mic;
  for (int i = 0; i < count; i++) {
    const double e = M.gain * M.perVolt * in[i];
    for (int j = 0; j < sub; j++) {
      const State k1 = rates(M, st, e), k2 = rates(M, axpy(st, k1, h / 2), e);
      const State k3 = rates(M, axpy(st, k2, h / 2), e), k4 = rates(M, axpy(st, k3, h), e);
      st.i += h / 6 * (k1.i + 2 * k2.i + 2 * k3.i + k4.i);
      st.x += h / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
      st.u += h / 6 * (k1.u + 2 * k2.u + 2 * k3.u + k4.u);
      st.p += h / 6 * (k1.p + 2 * k2.p + 2 * k3.p + k4.p);
      st.up += h / 6 * (k1.up + 2 * k2.up + 2 * k3.up + k4.up);
    }
    if (quiet(st)) st = State{};
    // the sound: the cone's and the port's accelerations now
    const State d = rates(M, st, e);
    const float y = (float)(k * (M.sd * d.u + M.sp * d.up));
    L[i] = R[i] = y;
    if (messages) {
      xPeak = std::max(xPeak, std::abs(st.x));
      upPeak = std::max(upPeak, std::abs(st.up));
      if (++at == every) {
        at = 0;
        msg.values[points] = (float)st.x;
        if (++points == 20) {
          msg.type = kCone;
          msg.count = 22;
          msg.values[20] = (float)xPeak;
          msg.values[21] = (float)upPeak;
          post(msg);
          points = 0;
          xPeak = upPeak = 0;
        }
      }
    }
  }
}

} // namespace cabinet
