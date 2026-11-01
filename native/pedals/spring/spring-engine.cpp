// spring-engine.cpp — the Spring Reverb as an effect (spring-engine.h).

#include "spring-engine.h"

#include <algorithm>
#include <cmath>

namespace spring {

Engine::Engine(double fs) : Effect(fs) {
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setParams(P);
  reset();
}

void Engine::reset() {
  std::fill(zr, zr + MAX_MODES, 0.f);
  std::fill(zi, zi + MAX_MODES, 0.f);
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  M = model(P);
  fMax = std::min(pick(8000.0, 6000.0, 4000.0), 0.45 * fs);
  if (M.tank != built || M.wire != builtWire) build();
  tune();
}

// The modes: every spring's standing waves k = nπ/L on the lower root, from 20 Hz to fMax, each
// weighted by its share of the beads' motion, the beads' inertia and its sign at the far end,
// (−1)ⁿ. The weights are 2/T_D per spring at the low-frequency limit, so that the first arrival of
// a low note through one spring comes out at the level it went in; the springs are averaged.
void Engine::build() {
  built = M.tank; builtWire = M.wire;
  const Tank &T = tankOf(M.tank);
  count = T.count;
  modes = 0;
  for (int s = 0; s < count; s++) {
    Spring &sp = springs[s];
    sp.set(T.coil[s], M.wire);
    for (int n = 1; modes < MAX_MODES; n++) {
      const double k = n * PI / sp.L;
      const double f = sp.omega(k) / (2 * PI);
      if (k > sp.eps && f > fMax) break; // up the bending branch, past the top
      if (f < 20 || f > fMax) continue;
      const double c = sp.share(k) * sp.bead(f);
      if (c < 3e-3) continue;            // the beads barely touch it
      spr[modes] = s; num[modes] = n;
      freq[modes] = f;
      vel[modes] = sp.cg(k);
      weight[modes] = (2 / sp.TD) * c * (n % 2 ? -1 : 1) / count;
      modes++;
    }
  }
  for (int m = modes; m < MAX_MODES; m++) { freq[m] = 0; weight[m] = 0; zr[m] = zi[m] = 0; }
}

// The losses, and each mode as a resonator by the impulse invariant: the bead's angular velocity
// for a torque impulse, w e^{−σt}(cos ω_d t − (σ/ω_d) sin ω_d t), sampled, is Re of
// z ← p z + c x with p = e^{(−σ + iω_d)T} and c = T w (1 + iσ/ω_d).
void Engine::tune() {
  const double T = 1 / fs;
  for (int m = 0; m < MAX_MODES; m++) {
    if (m >= modes) { decay[m] = 0; pr[m] = pi[m] = cr[m] = ci[m] = 0; continue; }
    const Spring &sp = springs[spr[m]];
    const double w = 2 * PI * freq[m];
    const double sg = sigma(freq[m], vel[m], sp.L, M.mounts, M.eta, M.oil);
    decay[m] = sg;
    if (sg >= w) { pr[m] = pi[m] = cr[m] = ci[m] = 0; continue; }
    const double wd = std::sqrt(w * w - sg * sg), a = std::exp(-sg * T);
    pr[m] = (float)(a * std::cos(wd * T)); pi[m] = (float)(a * std::sin(wd * T));
    cr[m] = (float)(T * weight[m]); ci[m] = (float)(T * weight[m] * sg / wd);
  }
}

void Engine::tank(const float *x, float *y, int n) {
  for (int at = 0; at < n; at += BLOCK) {
    const int b = std::min(BLOCK, n - at);
    std::fill(acc, acc + b * W, 0.f);
    bool quiet = true;
    for (int i = 0; i < b; i++) quiet = quiet && x[at + i] == 0.f;
    const int groups = (modes + W - 1) / W;
    for (int g = 0; g < groups; g++) {
      const int o = g * W;
      if (quiet) { // a group at rest with nothing coming in stays at rest
        bool rest = true;
        for (int j = 0; j < W; j++) rest = rest && zr[o + j] == 0.f && zi[o + j] == 0.f;
        if (rest) continue;
      }
      float Pr[W], Pi[W], Cr[W], Ci[W], Zr[W], Zi[W];
      for (int j = 0; j < W; j++) { Pr[j] = pr[o + j]; Pi[j] = pi[o + j]; Cr[j] = cr[o + j]; Ci[j] = ci[o + j]; Zr[j] = zr[o + j]; Zi[j] = zi[o + j]; }
      for (int i = 0; i < b; i++) {
        const float xi = x[at + i];
        float *A = acc + i * W;
        for (int j = 0; j < W; j++) {
          const float nr = Pr[j] * Zr[j] - Pi[j] * Zi[j] + Cr[j] * xi;
          const float ni = Pi[j] * Zr[j] + Pr[j] * Zi[j] + Ci[j] * xi;
          Zr[j] = nr; Zi[j] = ni;
          A[j] += nr;
        }
      }
      for (int j = 0; j < W; j++) {
        // a mode 200 dB below a volt is let go, long before it reaches the denormals
        const bool gone = std::abs(Zr[j]) + std::abs(Zi[j]) < 1e-10f;
        zr[o + j] = gone ? 0.f : Zr[j]; zi[o + j] = gone ? 0.f : Zi[j];
      }
    }
    for (int i = 0; i < b; i++) {
      float s = 0;
      for (int j = 0; j < W; j++) s += acc[i * W + j];
      y[at + i] = s;
    }
  }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int at = 0; at < n; at += BLOCK) {
    const int b = std::min(BLOCK, n - at);
    tank(in + at, wet, b);
    for (int i = 0; i < b; i++) {
      const float out = (float)(M.level * (M.dry * in[at + i] + M.reverb * wet[i]));
      L[at + i] = out;
      R[at + i] = out;
    }
  }
}

} // namespace spring
