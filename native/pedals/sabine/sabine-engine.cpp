// sabine-engine.cpp — Sabine's Room as an effect (sabine-engine.h).

#include "sabine-engine.h"

#include <algorithm>
#include <cmath>
#include <complex>

namespace sabine {

namespace {
constexpr double kPi = 3.14159265358979323846;
// the lines' delays at 48 kHz (ms), from 11 to 41: a few trips of a room's mean free path
constexpr double kDelays[kLines] = {11.3, 12.9, 14.6, 16.1, 17.9, 19.4, 21.2, 22.9, 24.6, 26.5, 28.3, 30.2, 32.6, 34.9, 37.7, 40.6};
constexpr double kCross[kBands - 1] = {176.8, 353.6, 707.1, 1414.2, 2828.4};
// the signs the lines are fed and read with
constexpr int kIn[kLines] = {1, -1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, -1, 1};
constexpr int kOut[kLines] = {1, 1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1};
bool prime(int n) {
  if (n < 2) return false;
  for (int k = 2; k * k <= n; k++) if (n % k == 0) return false;
  return true;
}
int pow2(int n) { int p = 1; while (p < n) p <<= 1; return p; }
// a tail left to die away in silence reaches denormal numbers, which on x86 cost a hundred times a
// normal one and which WebAssembly can't flush: anything under 1e-30 is inaudible, so it is zero
inline float flushed(double v) { return std::fabs(v) < 1e-30 ? 0.f : (float)v; }
// y = H x / 4 for the 16 × 16 Hadamard matrix: orthogonal, so the lines lose nothing to the mixing
void hadamard(float *x) {
  for (int len = 1; len < kLines; len <<= 1)
    for (int i = 0; i < kLines; i += 2 * len)
      for (int j = i; j < i + len; j++) { const float a = x[j], b = x[j + len]; x[j] = a + b; x[j + len] = a - b; }
  for (int j = 0; j < kLines; j++) x[j] *= 0.25f;
}
} // namespace

void Network::size(int longest) {
  mask = pow2(longest + 1) - 1;
  stride = mask + 1 + 37; // not a power of two, so the lines' reads don't all fall in the same cache sets
  lines.assign((size_t)kLines * stride, 0.f);
  pos = 0;
}
void Network::clear() { std::fill(lines.begin(), lines.end(), 0.f); }
double Network::step(double u, const Late &l) {
  pos = (pos + 1) & mask;
  float s[kLines];
  double out = 0;
  for (int j = 0; j < kLines; j++) {
    const float v = lines[(size_t)j * stride + ((pos - l.m[j]) & mask)];
    out += kOut[j] * v;
    s[j] = v * (float)l.g[j];
  }
  hadamard(s);
  const float in = (float)(0.25 * u);
  for (int j = 0; j < kLines; j++) lines[(size_t)j * stride + pos] = flushed(s[j] + kIn[j] * in);
  return out;
}

Engine::Engine(double rate) : Effect(rate) {
  for (int b = 0; b < kBands; b++) {
    int most = 0;
    for (int j = 0; j < kLines; j++) {
      int m = (int)std::lround(kDelays[j] * 1e-3 * fs * (1 + 0.031 * b));
      while (!prime(m)) m++;
      base[b][j] = m;
      most = std::max(most, m);
    }
    nets[b].size(most);
  }
  mask = pow2((int)(0.5 * fs) + 4) - 1;
  hist.assign((size_t)(mask + 1) * kBands, 0.f);
  // the late sound's bands: a sixth-order Butterworth prototype turned into each octave's bandpass
  // (s → (s² + ω0²)/(B s)), and a twelfth-order one into the lowpass and the highpass at the ends, so
  // that every band is twelfth order, at prewarped edges, each second-order factor mapped by the
  // bilinear transform. A band's neighbours are 36 to 39 dB down at its centre, so each octave
  // decays at its own rate, and the bands' powers sum to the bass's within 0.4 dB.
  {
    using cd = std::complex<double>;
    const double K = 2 * fs;
    auto warp = [&](double f) { return K * std::tan(kPi * f / fs); };
    auto put = [&](Section &q, double n0, double n1, double n2, double d0, double d1, double d2) {
      // analog (n2 s² + n1 s + n0)/(d2 s² + d1 s + d0) → digital
      const double A0 = d2 * K * K + d1 * K + d0, A1 = 2 * d0 - 2 * d2 * K * K, A2 = d2 * K * K - d1 * K + d0;
      const double B0 = n2 * K * K + n1 * K + n0, B1 = 2 * n0 - 2 * n2 * K * K, B2 = n2 * K * K - n1 * K + n0;
      q.b0 = B0 / A0; q.b1 = B1 / A0; q.b2 = B2 / A0; q.a1 = A1 / A0; q.a2 = A2 / A0;
    };
    // Butterworth's poles of order n in the left half plane, one of each conjugate pair
    auto pole = [&](int k, int n) { return std::polar(1.0, kPi * (2 * k + n + 1) / (2 * n)); };
    for (int b = 0; b < kBands; b++) {
      if (b == 0 || b == kBands - 1) {
        const double wc = warp(kCross[b == 0 ? 0 : kBands - 2]);
        for (int k = 0; k < kOrder; k++) {
          const double re = -2 * pole(k, 2 * kOrder).real() * wc;
          if (b == 0) put(sec[b][k], wc * wc, 0, 0, wc * wc, re, 1);
          else put(sec[b][k], 0, 0, 1, wc * wc, re, 1);
        }
      } else {
        const double lo = warp(kCross[b - 1]), hi = warp(kCross[b]), w0 = std::sqrt(lo * hi), B = hi - lo;
        for (int k = 0; k < kOrder / 2; k++) {
          // the pole p gives the two poles of s² − p B s + ω0², each with its conjugate from p̄
          const cd p = pole(k, kOrder), disc = std::sqrt(p * p * B * B - 4 * w0 * w0);
          const cd r[2] = {(p * B + disc) / 2.0, (p * B - disc) / 2.0};
          for (int j = 0; j < 2; j++) put(sec[b][2 * k + j], 0, B, 0, std::norm(r[j]), -2 * r[j].real(), 1);
        }
      }
      nsec[b] = kOrder;
    }
  }
  dry.assign(mask + 1, 0.f);
  for (int k = 0; k < kBands - 1; k++) { // Butterworth lowpasses by the bilinear transform, prewarped
    const double K = std::tan(kPi * kCross[k] / fs), q = std::sqrt(0.5), n = 1 / (1 + K / q + K * K);
    lp[k][0] = K * K * n; lp[k][1] = 2 * lp[k][0]; lp[k][2] = lp[k][0];
    lp[k][3] = 2 * (K * K - 1) * n; lp[k][4] = (1 - K / q + K * K) * n;
  }
  scratch.resize(kMaxImages);
  fadeLen = (int)std::lround(1024 * fs / 48000);
  alpha = 1 - std::exp(-1 / (0.05 * fs)); // the Level's 50 ms glide
}

void Engine::configure(const Parts &p, double fs, const int base[kBands][kLines], Config &c, Reflection *scratch) {
  Reflection refl[kEarly + 1];
  const double Re = early(p, refl, scratch);
  const double horizon = (double)(0.45 * fs);
  c.taps = 0;
  for (int i = 0; i <= kEarly; i++) {
    const double at = (refl[i].r - p.d) / kSpeed * fs;
    if (at > horizon) break;
    const int k = c.taps++;
    c.delay[k] = (int)std::floor(at);
    c.frac[k] = (float)(at - c.delay[k]);
    for (int b = 0; b < kBands; b++) {
      c.gain[k][b] = (float)refl[i].gain[b];
      c.g0[k][b] = (float)(refl[i].gain[b] * (1 - (at - c.delay[k])));
      c.g1[k][b] = (float)(refl[i].gain[b] * (at - c.delay[k]));
    }
  }
  const double V = p.V();
  int mmin = base[0][0];
  for (int b = 0; b < kBands; b++) for (int j = 0; j < kLines; j++) mmin = std::min(mmin, base[b][j]);
  c.pre = std::clamp((int)std::lround((std::min(Re, p.d + kSpeed * 0.44) - p.d) / kSpeed * fs) - mmin, 0, (int)horizon);
  for (int b = 0; b < kBands; b++) {
    Late &l = c.late[b];
    const double T = p.eyring(b);
    for (int j = 0; j < kLines; j++) { l.m[j] = base[b][j]; l.g[j] = std::pow(10.0, -3.0 * l.m[j] / (T * fs)); }
    // the diffuse field's power where the late sound comes in, t after the bass sounded
    const double t = c.pre / fs + p.d / kSpeed, decay = 6 * std::log(10.0) / (T * fs); // energy, per sample
    const double power = 4 * kPi * kSpeed / (V * fs) * std::exp(-decay * t * fs);
    // the network's output power: a sample read from a line of length m was written m samples ago,
    // when the field was e^(decay m) as strong; and since a sample's energy, weighted by e^(−decay a)
    // at its age a, summed over the lines and scaled by e^(decay t), is conserved (the mixing is
    // orthogonal, and a trip of m samples loses e^(−decay m)), the impulse's unit energy settles into
    // e^(−decay t)/Σm in every place: so the lines give out e^(−decay t) Σ e^(decay m)/Σm
    double lengths = 0, given = 0;
    for (int j = 0; j < kLines; j++) { lengths += l.m[j]; given += std::exp(decay * l.m[j]); }
    l.kappa = std::sqrt(power * lengths / given);
  }
}

bool Engine::sameRoom(const double *a, const double *b) const {
  for (int k = 0; k < kParamCount; k++) if (k != level && a[k] != b[k]) return false;
  return true;
}

void Engine::load(int which) {
  room = parts(want);
  configure(room, fs, base, cfg[which], scratch.data());
  std::copy(want, want + kParamCount, playing);
}

void Engine::setParams(const double *P) {
  std::copy(P, P + kParamCount, want);
  levelWant = std::pow(10.0, P[level] / 20);
  if (fresh) {
    load(active);
    levelNow = levelWant;
    settle();
    pending = fading = false;
  } else if (!sameRoom(want, playing)) {
    pending = true;
  }
}

void Engine::reset() {
  std::fill(hist.begin(), hist.end(), 0.f);
  std::fill(dry.begin(), dry.end(), 0.f);
  for (auto &band : sec) for (auto &q : band) q.z1 = q.z2 = 0;
  for (auto &net : nets) net.clear();
  for (auto &z : lpz) z[0] = z[1] = 0;
  fresh = true;
  if (fading) { active ^= 1; fading = false; }
  if (pending || !sameRoom(want, playing)) load(active);
  pending = false;
  levelNow = levelWant;
  settle();
}

void Engine::settle() {
  for (int b = 0; b < kBands; b++) live[b] = cfg[active].late[b];
  gliding = false;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  for (int i = 0; i < n; i++) {
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    if (pending && !fading) {
      load(active ^ 1);
      pending = false;
      fading = true;
      gliding = true;
      fadeAt = 0;
    }
    // the bands: the lowpasses' differences, which sum back to the input
    const double x = in[i];
    double low[kBands - 1];
    for (int k = 0; k < kBands - 1; k++) {
      double *c = lp[k], *z = lpz[k];
      const double y = c[0] * x + z[0];
      z[0] = c[1] * x - c[3] * y + z[1];
      z[1] = c[2] * x - c[4] * y;
      low[k] = y;
    }
    w = (w + 1) & mask;
    float *hw = &hist[(size_t)w * kBands];
    hw[0] = flushed(low[0]);
    for (int k = 1; k < kBands - 1; k++) hw[k] = flushed(low[k] - low[k - 1]);
    hw[kBands - 1] = flushed(x - low[kBands - 2]);
    // the direct sound and the early reflections
    const double g = fading ? 0.5 - 0.5 * std::cos(kPi * (fadeAt + 0.5) / fadeLen) : 0;
    double y = 0;
    for (int which = 0; which < (fading ? 2 : 1); which++) {
      const Config &c = cfg[which == 0 ? active : active ^ 1];
      const double share = fading ? (which == 0 ? 1 - g : g) : 1;
      double e = 0;
      // each tap between two samples, each band its own gain
      const float *h = hist.data();
      for (int k = 0; k < c.taps; k++) {
        const float *a = h + (size_t)((w - c.delay[k]) & mask) * kBands, *b = h + (size_t)((w - c.delay[k] - 1) & mask) * kBands;
        const float *gn = c.g0[k], *gf = c.g1[k];
        float s = 0;
        for (int j = 0; j < kBands; j++) s += gn[j] * a[j] + gf[j] * b[j];
        e += s;
      }
      y += share * e;
    }
    // the late sound, its input faded between the old room's delay and the new one's
    const Config &now = cfg[fading ? active ^ 1 : active], &was = cfg[active];
    dry[w] = (float)x;
    double u = dry[(w - now.pre) & mask];
    if (fading) u = g * u + (1 - g) * dry[(w - was.pre) & mask];
    for (int b = 0; b < kBands; b++) {
      double ub = u;
      for (int k = 0; k < nsec[b]; k++) {
        Section &q = sec[b][k];
        const double o = q.b0 * ub + q.z1;
        q.z1 = q.b1 * ub - q.a1 * o + q.z2;
        q.z2 = q.b2 * ub - q.a2 * o;
        ub = o;
      }
      Late &l = live[b];
      if (gliding) {
        const Late &to = now.late[b];
        for (int j = 0; j < kLines; j++) l.g[j] += alpha * (to.g[j] - l.g[j]);
        l.kappa += alpha * (to.kappa - l.kappa);
      }
      y += l.kappa * nets[b].step(ub, l);
    }
    if (fading && ++fadeAt >= fadeLen) { fading = false; active ^= 1; }
    if (++sinceFlush == 1024) {
      sinceFlush = 0;
      // the glide ends once every gain is within a millionth of the room's
      if (gliding && !fading) {
        bool there = true;
        for (int b = 0; b < kBands && there; b++) {
          there = std::fabs(live[b].kappa - cfg[active].late[b].kappa) <= 1e-6 * cfg[active].late[b].kappa;
          for (int j = 0; j < kLines && there; j++) there = std::fabs(live[b].g[j] - cfg[active].late[b].g[j]) <= 1e-6;
        }
        if (there) settle();
      }
      auto zero = [](double &z) { if (std::fabs(z) < 1e-30) z = 0; };
      for (auto &z : lpz) { zero(z[0]); zero(z[1]); }
      for (auto &band : sec) for (auto &q : band) { zero(q.z1); zero(q.z2); }
    }
    levelNow += alpha * (levelWant - levelNow);
    const float v = (float)(levelNow * y);
    L[i] = v;
    R[i] = v;
  }
}

} // namespace sabine
