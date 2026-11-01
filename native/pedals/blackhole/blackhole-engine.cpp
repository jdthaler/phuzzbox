// blackhole-engine.cpp — the Black Hole as an effect (blackhole-engine.h).

#include "blackhole-engine.h"

#include <algorithm>
#include <cmath>

namespace blackhole {

namespace {
constexpr int LMN[Engine::MODES][3] = {{2, 2, 0}, {2, 1, 0}, {3, 3, 0}, {4, 4, 0}};
}

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setParams(P);
  reset();
}

void Engine::reset() {
  for (auto &v : z) v = 0;
}

// Each mode as a complex one-pole at its own ω: ζ ← e^{−iωT} ζ + g x, so a click rings as e^{−iωt}.
// The detector's gain g is set so that white noise in comes out of the two channels, on average,
// at its own level: Σ_t (Re Σ_k γ_k p_k^t)² = ½ Σ_kl [γ_k γ_l*/(1 − p_k p_l*) + Re γ_k γ_l/(1 − p_k p_l)].
void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  a = spinOf(P[nines]);
  const double Ms = P[mass] * MSUN_S, T = 1 / fs, iota = P[inclination] * PI / 180;
  const Amplitudes A = amplitudes(P[ratio]);
  const double amps[MODES] = {1, A.a21, A.a33, A.a44};
  std::complex<double> gp[MODES], gx[MODES];
  for (int k = 0; k < MODES; k++) {
    Mode &md = mode[k];
    md.l = LMN[k][0]; md.m = LMN[k][1]; md.n = LMN[k][2];
    Omega w{};
    omega(md.l, md.m, md.n, a, w);
    md.f = w.re / (2 * PI * Ms); md.gamma = -w.im / Ms; md.Q = PI * md.f / md.gamma;
    md.amp = amps[k];
    const double y1 = swsh(md.l, md.m, iota), y2 = swsh(md.l, -md.m, iota), s = (md.l % 2) ? -1 : 1;
    md.plus = md.amp * (y1 + s * y2); md.cross = -md.amp * (y1 - s * y2);
    md.on = md.f < 0.45 * fs;
    p[k] = md.on ? std::exp(std::complex<double>(-md.gamma * T, -2 * PI * md.f * T)) : 0.0;
    if (!md.on) z[k] = 0;
    gp[k] = md.on ? md.plus : 0.0;
    gx[k] = md.on ? std::complex<double>(0, -md.cross) : 0.0; // Re(γ ζ) = cross·Im ζ for γ = −i·cross
  }
  double e = 0;
  for (const auto *g : {gp, gx})
    for (int k = 0; k < MODES; k++)
      for (int l = 0; l < MODES; l++)
        e += 0.5 * (std::real(g[k] * std::conj(g[l]) / (1.0 - p[k] * std::conj(p[l]))) + std::real(g[k] * g[l] / (1.0 - p[k] * p[l])));
  gain = e > 0 ? 1 / std::sqrt(e / 2) : 1;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double lv = std::pow(10, P[level] / 20);
  for (int i = 0; i < n; i++) {
    const double x = gain * in[i];
    double hp = 0, hx = 0;
    for (int k = 0; k < MODES; k++) {
      z[k] = p[k] * z[k] + x;
      hp += mode[k].plus * z[k].real();
      hx += mode[k].cross * z[k].imag();
    }
    L[i] = (float)(lv * (P[dry] * in[i] + P[mix] * hp));
    R[i] = (float)(lv * (P[dry] * in[i] + P[mix] * hx));
  }
  for (auto &v : z) if (std::abs(v) < 1e-30) v = 0;
}

} // namespace blackhole
