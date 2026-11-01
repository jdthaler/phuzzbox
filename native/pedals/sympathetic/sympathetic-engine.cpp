// sympathetic-engine.cpp — the Sympathetic Strings as an effect (sympathetic-engine.h).

#include "sympathetic-engine.h"

#include <algorithm>
#include <cmath>

namespace sympathetic {

namespace {
// each scale's strings, in semitones above the root (sympathetic-params.js)
const int SCALES[6][13] = {
  {12, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19},
  {12, 0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19},
  {11, 0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24},
  {11, 0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24},
  {5, 0, 7, 12, 19, 24},
  {12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11},
};
constexpr double REF_SUSTAIN = 6, REF_HIGHS = 1; // the pickup's gain is set at these
} // namespace

Engine::Engine(double fs) : Effect(fs) {
  every = (int)std::lround(0.040 * fs);
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
  const int k = (int)P[key], s = std::clamp((int)P[scale], 0, 5), o = (int)P[octave];
  if (k != builtKey || s != builtScale || o != builtOctave || P[wire] != builtWire) {
    builtKey = k; builtScale = s; builtOctave = o; builtWire = P[wire];
    build();
  }
  tune();
}

// The strings and their partials to FMAX (and below a third of the sample rate), and the pickup's
// gain: set for each tuning so that white noise in, at the reference losses, comes out at its own
// level, whatever the key and scale.
void Engine::build() {
  const int *sc = SCALES[builtScale];
  strings = sc[0];
  modes = 0;
  const double top = std::min(FMAX, fs / 3);
  for (int j = 0; j < strings; j++) {
    // the root in octave 1–3 (the choice index 0–2): C1 is 45 semitones below A4
    const double semis = -45 + 12 * builtOctave + builtKey + sc[1 + j];
    string[j] = sympathetic::tune(noteHz(semis), builtWire);
    const String &S = string[j];
    int n = 0;
    for (; n < MAX_PARTIALS; n++) {
      const double f = S.partial(n + 1);
      if (f > top) break;
      const double k = (n + 1) * PI / S.L;
      ofString[modes] = j; partial[modes] = n + 1; freq[modes] = f;
      coupling[modes] = 2 / S.L * (S.T + S.EI * k * k);
      modes++;
    }
    string[j].partials = n;
  }
  // the energy of the pickup's response to a click. The partials of different strings often sit
  // close (E2's second and E3's first) and then add as amplitudes, not powers: Σ_ij c_i c_j h_i·h_j,
  // Σ_k (r_i r_j)^k cos(ω_i kT) cos(ω_j kT) = ½ Re 1/(1 − q e^{i(ω_i − ω_j)T}) + ½ Re 1/(1 − q e^{i(ω_i + ω_j)T}),
  // q = r_i r_j. Pairs further apart than 20 Hz are each ≈ ½ c_i c_j (both halves near ¼).
  double r1, r3;
  losses(REF_SUSTAIN, REF_HIGHS, r1, r3);
  const double T = 1 / fs;
  double sum = 0;
  for (int i = 0; i < modes; i++) {
    const double w = 2 * PI * freq[i];
    cc[i] = T * coupling[i]; rr[i] = std::exp(-(r1 + r3 * w * w) * T); ww[i] = w * T; order[i] = i;
    sum += cc[i];
  }
  std::sort(order, order + modes, [&](int a, int b) { return freq[a] < freq[b]; });
  const auto half = [](double q, double d) { const double cd = std::cos(d); return 0.5 * (1 - q * cd) / (1 - 2 * q * cd + q * q); };
  double energy = 0.5 * sum * sum;
  for (int a = 0; a < modes; a++)
    for (int b = a; b < modes && freq[order[b]] - freq[order[a]] < 20; b++) {
      const int i = order[a], j = order[b], k = a == b ? 1 : 2;
      const double q = rr[i] * rr[j];
      energy += k * cc[i] * cc[j] * (half(q, ww[i] - ww[j]) + half(q, ww[i] + ww[j]) - 0.5);
    }
  gain = energy > 0 ? 1 / std::sqrt(energy) : 1;
  for (int i = modes; i < MAX_MODES; i++) { zr[i] = zi[i] = 0; pr[i] = pi[i] = b[i] = e[i] = 0; }
  reset();
}

// Each partial by the impulse invariant of K s/(s² + 2as + ω²): K e^{−at}(cos ω_d t − (a/ω_d) sin ω_d t),
// the real part of z ← p z + b v read as z_r − (a/ω_d) z_i, p = e^{(−a + iω_d)T}, b = K T.
void Engine::tune() {
  losses(P[sustain], P[highs], b1, b3);
  const double T = 1 / fs;
  for (int i = 0; i < modes; i++) {
    const double w = 2 * PI * freq[i], a = b1 + b3 * w * w;
    decay[i] = a;
    const double wd = std::sqrt(std::max(1e-9, w * w - a * a)), r = std::exp(-a * T);
    pr[i] = (float)(r * std::cos(wd * T)); pi[i] = (float)(r * std::sin(wd * T));
    b[i] = (float)(gain * T * coupling[i]);
    e[i] = (float)(a / wd);
  }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double lv = std::pow(10, P[level] / 20);
  for (int at = 0; at < n; at += BLOCK) {
    const int bl = std::min(BLOCK, n - at);
    const float *x = in + at;
    std::fill(acc, acc + bl * W, 0.f);
    bool quiet = true;
    for (int i = 0; i < bl; i++) quiet = quiet && x[i] == 0.f;
    for (int o = 0; o < modes; o += W) {
      const int lanes = std::min(W, modes - o);
      if (quiet) {
        bool rest = true;
        for (int j = 0; j < lanes; j++) rest = rest && zr[o + j] == 0.f && zi[o + j] == 0.f;
        if (rest) continue;
      }
      alignas(32) float Pr[W] = {}, Pi[W] = {}, B[W] = {}, Ee[W] = {}, Zr[W] = {}, Zi[W] = {};
      for (int j = 0; j < lanes; j++) { Pr[j] = pr[o + j]; Pi[j] = pi[o + j]; B[j] = b[o + j]; Ee[j] = e[o + j]; Zr[j] = zr[o + j]; Zi[j] = zi[o + j]; }
      for (int i = 0; i < bl; i++) {
        const float xi = x[i];
        float *A = acc + i * W;
        for (int j = 0; j < W; j++) {
          const float nr = Pr[j] * Zr[j] - Pi[j] * Zi[j] + B[j] * xi;
          const float ni = Pi[j] * Zr[j] + Pr[j] * Zi[j];
          Zr[j] = nr; Zi[j] = ni;
          A[j] += nr - Ee[j] * ni;
        }
      }
      for (int j = 0; j < lanes; j++) {
        const bool gone = std::abs(Zr[j]) + std::abs(Zi[j]) < 1e-10f;
        zr[o + j] = gone ? 0.f : Zr[j]; zi[o + j] = gone ? 0.f : Zi[j];
      }
    }
    for (int i = 0; i < bl; i++) {
      float s = 0;
      for (int j = 0; j < W; j++) s += acc[i * W + j];
      wet[i] = s;
    }
    for (int i = 0; i < bl; i++) L[at + i] = R[at + i] = (float)(lv * (P[dry] * x[i] + P[mix] * wet[i]));
    tick += bl;
    if (tick >= every) {
      tick = 0;
      msg.type = kStrings; msg.count = (uint16_t)strings;
      for (int j = 0; j < strings; j++) msg.values[j] = 0;
      for (int i = 0; i < modes; i++) msg.values[ofString[i]] += zr[i] * zr[i] + zi[i] * zi[i];
      post(msg);
    }
  }
}

} // namespace sympathetic
