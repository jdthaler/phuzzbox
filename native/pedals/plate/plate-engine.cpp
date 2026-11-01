// plate-engine.cpp — the Plate Reverb as an effect (plate-engine.h).

#include "plate-engine.h"

#include <algorithm>
#include <cmath>

namespace plate {

namespace {
double bessel0(double x) { // I0 by its series
  double s = 1, t = 1;
  for (int k = 1; k < 40; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; if (t < 1e-17 * s) break; }
  return s;
}
constexpr double FLOW = 0.09; // the modes below FLOW·fs are played at fs/4
} // namespace

void Lowpass::design(double pass, double stop, double rate) {
  const double A = 70, beta = 0.1102 * (A - 8.7), width = (stop - pass) / rate;
  int n = (int)std::ceil((A - 7.95) / (14.36 * width)) + 1;
  n |= 1;
  taps = std::min(n, MAXT);
  const int M = (taps - 1) / 2;
  const double fc = (pass + stop) / 2 / rate;
  double sum = 0;
  for (int k = 0; k < taps; k++) {
    const double t = k - M, r = M ? t / M : 0;
    const double s = t == 0 ? 2 * fc : std::sin(2 * PI * fc * t) / (PI * t);
    h[k] = s * bessel0(beta * std::sqrt(std::max(0.0, 1 - r * r))) / bessel0(beta);
    sum += h[k];
  }
  for (int k = 0; k < taps; k++) h[k] /= sum;
}

void Down::clear() { std::fill(hist, hist + 2 * Lowpass::MAXT, 0.0); at = 0; phase = 0; }
bool Down::push(double x, double &out) {
  const int T = f->taps;
  hist[at] = hist[at + T] = x; // mirrored, so hist[at .. at + T) is the last T, oldest first
  at = (at + 1) % T;
  phase ^= 1;
  if (phase) return false;
  double s = 0;
  for (int k = 0; k < T; k++) s += f->h[T - 1 - k] * hist[at + k];
  out = s;
  return true;
}
void Up::clear() { std::fill(hist, hist + 2 * Lowpass::MAXT, 0.0); at = 0; }
double Up::push(double x) {
  const int T = f->taps;
  hist[at] = hist[at + T] = x;
  at = (at + 1) % T;
  double s = 0;
  for (int k = 0; k < T; k++) s += f->h[T - 1 - k] * hist[at + k];
  return s;
}

Engine::Engine(double fs) : Effect(fs) {
  every = (int)std::lround(0.040 * fs);
  d1.f = u1[0].f = u1[1].f = &f1;
  d2.f = u2[0].f = u2[1].f = &f2;
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setParams(P);
  reset();
}

void Engine::reset() {
  std::fill(zr, zr + MAX_MODES, 0.f);
  std::fill(zi, zi + MAX_MODES, 0.f);
  d1.clear(); d2.clear();
  for (int c = 0; c < 2; c++) { u1[c].clear(); u2[c].clear(); }
  std::fill(align, align + 2 * Lowpass::MAXT, 0.f);
  alignAt = 0;
}

void Engine::setQuality(phuzzbox::Quality q) {
  Effect::setQuality(q);
  setParams(P);
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  const double t = std::min({P[plate::top], pick(1e9, 4000.0, 2500.0), 0.2 * fs});
  if (t != builtTop) { builtTop = t; build(); }
  tune();
}

// The modes from 20 Hz to the top, with their shapes at the driver and the pickups, and the
// transducers' gain: set once for the plate so that white noise in, with the damper at 3 s, comes
// out of each pickup at the power it went in (the plate's own sound is what the modes make of it).
void Engine::build() {
  top = builtTop;
  const double k = kappa(), split = FLOW * fs;
  // the modes at fs/4 first, then those at fs/2
  modes = 0;
  for (int pass = 0; pass < 2; pass++) {
    if (pass == 1) low = modes;
    for (int n = 1; modes < MAX_MODES; n++) {
      const double ky = n * PI / LY;
      if (k * ky * ky / (2 * PI) > top) break;
      for (int m = 1; modes < MAX_MODES; m++) {
        const double kx = m * PI / LX, f = k * (kx * kx + ky * ky) / (2 * PI);
        if (f > top) break;
        if (f < 20 || (f <= split) != (pass == 0)) continue;
        mm[modes] = m; nn[modes] = n; freq[modes] = f;
        const auto shape = [&](const double *p) { return std::sin(kx * p[0]) * std::sin(ky * p[1]); };
        shapeD[modes] = shape(DRIVE); shapeL[modes] = shape(PICK[0]); shapeR[modes] = shape(PICK[1]);
        modes++;
      }
    }
  }
  // the filters: fs ↔ fs/2 passes every mode played; fs/2 ↔ fs/4 the modes below the split
  f1.design(std::max(top, split), fs / 2 - std::max(top, split), fs);
  f2.design(split, fs / 4 - split, fs / 2);
  alignLen = f2.taps - 1;
  delay = (f1.taps - 1) + 2 * (f2.taps - 1);
  // the transducers: Σ over modes of each one's impulse response's energy at fs, at the reference damper
  const double T = 1 / fs, mass = RHO * H * LX * LY / 4, ref = damper(3);
  double energy = 0;
  for (int i = 0; i < modes; i++) {
    const double a = steel(freq[i]) + ref, c = T * shapeD[i] / mass;
    energy += 0.5 * c * c * (shapeL[i] * shapeL[i] + shapeR[i] * shapeR[i]) / 2 / (1 - std::exp(-2 * a * T));
  }
  gain = energy > 0 ? 1 / std::sqrt(energy) : 1;
  for (int i = modes; i < MAX_MODES; i++) { zr[i] = zi[i] = 0; pr[i] = pi[i] = b[i] = e[i] = wl[i] = wr[i] = 0; }
  reset();
}

// Each mode as a resonator by the impulse invariant: the plate's velocity for a force impulse is
// (Φ_d Φ_p / M) e^{−αt}(cos ω_d t − (α/ω_d) sin ω_d t), M = ρh Lx Ly / 4: Re of
// z ← p z + b x, read as z_r − (α/ω_d) z_i, with p = e^{(−α + iω_d)T} at the mode's own rate.
void Engine::tune() {
  const double mass = RHO * H * LX * LY / 4, d = damper(P[plate::decay]);
  for (int i = 0; i < modes; i++) {
    const double T = (i < low ? 4 : 2) / fs;
    const double w = 2 * PI * freq[i], a = steel(freq[i]) + d;
    decay[i] = a;
    const double wd = std::sqrt(std::max(1e-9, w * w - a * a)), r = std::exp(-a * T);
    pr[i] = (float)(r * std::cos(wd * T)); pi[i] = (float)(r * std::sin(wd * T));
    b[i] = (float)(gain * T * shapeD[i] / mass);
    e[i] = (float)(a / wd);
    wl[i] = (float)shapeL[i]; wr[i] = (float)shapeR[i];
  }
}

void Engine::bank(int from, int to, const float *x, float *yl, float *yr, int n) {
  std::fill(accL, accL + n * W, 0.f);
  std::fill(accR, accR + n * W, 0.f);
  bool quiet = true;
  for (int i = 0; i < n; i++) quiet = quiet && x[i] == 0.f;
  for (int o = from; o < to; o += W) {
    const int lanes = std::min(W, to - o); // the last group may hold fewer modes: the rest sit still
    if (quiet) { // a group at rest with nothing coming in stays at rest
      bool rest = true;
      for (int j = 0; j < lanes; j++) rest = rest && zr[o + j] == 0.f && zi[o + j] == 0.f;
      if (rest) continue;
    }
    alignas(32) float Pr[W] = {}, Pi[W] = {}, B[W] = {}, Ee[W] = {}, Wl[W] = {}, Wr[W] = {}, Zr[W] = {}, Zi[W] = {};
    for (int j = 0; j < lanes; j++) { Pr[j] = pr[o + j]; Pi[j] = pi[o + j]; B[j] = b[o + j]; Ee[j] = e[o + j]; Wl[j] = wl[o + j]; Wr[j] = wr[o + j]; Zr[j] = zr[o + j]; Zi[j] = zi[o + j]; }
    for (int i = 0; i < n; i++) {
      const float xi = x[i];
      float *Al = accL + i * W, *Ar = accR + i * W;
      for (int j = 0; j < W; j++) {
        const float nr = Pr[j] * Zr[j] - Pi[j] * Zi[j] + B[j] * xi;
        const float ni = Pi[j] * Zr[j] + Pr[j] * Zi[j];
        Zr[j] = nr; Zi[j] = ni;
        const float u = nr - Ee[j] * ni;
        Al[j] += Wl[j] * u; Ar[j] += Wr[j] * u;
      }
    }
    for (int j = 0; j < lanes; j++) {
      const bool gone = std::abs(Zr[j]) + std::abs(Zi[j]) < 1e-10f;
      zr[o + j] = gone ? 0.f : Zr[j]; zi[o + j] = gone ? 0.f : Zi[j];
    }
  }
  for (int i = 0; i < n; i++) {
    float sl = 0, sr = 0;
    for (int j = 0; j < W; j++) { sl += accL[i * W + j]; sr += accR[i * W + j]; }
    yl[i] = sl; yr[i] = sr;
  }
}

void Engine::run(const float *x, float *yl, float *yr, int n) {
  // down: the driver's signal at fs/2 (delayed to meet the fs/4 path) and at fs/4
  int n2 = 0, n4 = 0;
  for (int i = 0; i < n; i++) {
    double v2, v4;
    due2[i] = d1.push(x[i], v2);
    if (!due2[i]) continue;
    align[alignAt] = align[alignAt + alignLen + 1] = (float)v2;
    alignAt = (alignAt + 1) % (alignLen + 1);
    in2[n2] = align[alignAt]; // the sample alignLen ago
    due4[n2] = d2.push(v2, v4);
    if (due4[n2]) in4[n4++] = (float)v4;
    n2++;
  }
  // the modes
  bank(low, modes, in2, y2[0], y2[1], n2);
  bank(0, low, in4, y4[0], y4[1], n4);
  // up: the fs/4 modes to fs/2, added to the fs/2 modes, and all of them to fs
  for (int c = 0; c < 2; c++) {
    for (int j = 0, k = 0; j < n2; j++) y2[c][j] += (float)u2[c].push(due4[j] ? 2.0 * y4[c][k++] : 0.0);
    float *y = c ? yr : yl;
    for (int i = 0, j = 0; i < n; i++) y[i] = (float)u1[c].push(due2[i] ? 2.0 * y2[c][j++] : 0.0);
  }
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double lv = std::pow(10, P[level] / 20);
  for (int at = 0; at < n; at += BLOCK) {
    const int bl = std::min(BLOCK, n - at);
    run(in + at, wetL, wetR, bl);
    for (int i = 0; i < bl; i++) {
      L[at + i] = (float)(lv * (P[dry] * in[at + i] + P[reverb] * wetL[i]));
      R[at + i] = (float)(lv * (P[dry] * in[at + i] + P[reverb] * wetR[i]));
    }
    tick += bl;
    if (tick >= every) {
      tick = 0;
      // the 15 modes moving most
      int best[15]; float amp[15];
      int got = 0;
      for (int i = 0; i < modes; i++) {
        const float a = std::abs(zr[i]) * (i < low ? 0.5f : 1.f); // a state at fs/4 is twice one at fs/2
        if (a == 0) continue;
        if (got < 15) { best[got] = i; amp[got] = a; got++; continue; }
        int lo = 0;
        for (int j = 1; j < 15; j++) if (amp[j] < amp[lo]) lo = j;
        if (a > amp[lo]) { best[lo] = i; amp[lo] = a; }
      }
      msg.type = kModes; msg.count = (uint16_t)(2 * got);
      for (int j = 0; j < got; j++) { msg.values[2 * j] = (float)(mm[best[j]] + 1000 * nn[best[j]]); msg.values[2 * j + 1] = zr[best[j]] * (best[j] < low ? 0.5f : 1.f); }
      post(msg);
    }
  }
}

} // namespace plate
