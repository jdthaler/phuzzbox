// rotary-engine.cpp — the Rotary Speaker as an effect (rotary-engine.h).

#include "rotary-engine.h"

#include <algorithm>
#include <cmath>

namespace rotary {

constexpr int RING = 2048, MASK = RING - 1;

Engine::Engine(double fs) : Effect(fs) {
  every = (int)std::lround(0.020 * fs);
  half = halfTaps(fs);
  lat = (int)std::lround(R_MAX / C * fs) + half;
  for (Rotor *q : {&horn, &drum}) for (auto &hh : q->hist) hh.assign(2 * (2 * half + 1), 0.0);
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setParams(P);
  reset();
}

void Engine::reset() {
  for (Rotor *q : {&horn, &drum}) {
    std::fill(q->buf, q->buf + RING, 0.f);
    for (auto &hh : q->hist) std::fill(hh.begin(), hh.end(), 0.0);
    q->hp = 0;
    q->w = P[fast] > 0.5 ? q->fast : q->slow;
    q->lastTau[0] = q->lastTau[1] = 0;
  }
  horn.alpha = 0; drum.alpha = 0;
  for (auto &s : lpS) s[0] = s[1] = 0;
  for (auto &s : hpS) s[0] = s[1] = 0;
  w = 0;
  blank = true;
}

// a second-order section (bilinear, prewarped), Q = 1/2: two first-order Butterworth sections in
// one, the second-order Linkwitz–Riley crossover's halves, the high half inverted so they sum flat
static void section(double *a, double f, double fs, bool high) {
  const double K = std::tan(PI * f / fs), q = 0.5, n = 1 / (1 + K / q + K * K);
  if (high) { a[0] = n; a[1] = -2 * n; a[2] = n; }
  else { a[0] = K * K * n; a[1] = 2 * a[0]; a[2] = a[0]; }
  a[3] = 2 * (K * K - 1) * n; a[4] = (1 - K / q + K * K) * n;
}
double Engine::biquad(const double *a, double *s, double x) {
  const double y = a[0] * x + s[0];
  s[0] = a[1] * x - a[3] * y + s[1];
  s[1] = a[2] * x - a[4] * y;
  return y;
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  horn.r = P[hornR]; horn.a = P[hornA]; horn.slow = 2 * PI * P[hornSlow]; horn.fast = 2 * PI * P[hornFast]; horn.tau = P[hornTau];
  drum.r = P[drumR]; drum.a = P[drumA]; drum.slow = 2 * PI * P[drumSlow]; drum.fast = 2 * PI * P[drumFast]; drum.tau = P[drumTau];
  horn.pattern.design(horn.a, fs);
  drum.pattern.design(drum.a, fs);
  dist = P[distance];
  offset = (dist - R_MAX) / C;
  for (int m = 0; m < 2; m++) {
    const double phi = (m ? 0.5 : -0.5) * P[spread];
    mic[m][0] = dist * std::cos(phi); mic[m][1] = dist * std::sin(phi);
  }
  gHorn = std::pow(10, P[balance] / 40); gDrum = 1 / gHorn;
  gOut = std::pow(10, P[level] / 20);
  section(lpA, P[crossover], fs, false);
  section(hpA, P[crossover], fs, true);
  // until anything is played, the rotors are at the switch's speed: no one hears them spin up
  if (blank) for (Rotor *q : {&horn, &drum}) q->w = P[fast] > 0.5 ? q->fast : q->slow;
}

// what microphone m hears of rotor q now: its signal sent at the retarded time, by cubic
// interpolation in its ring, through its pattern at the angle it was facing, over the distance
double Engine::hear(Rotor &q, int m, double ww) {
  const Path p = retarded(mic[m][0], mic[m][1], q.r, q.alpha, ww, q.lastTau[m] > 0 ? q.lastTau[m] : dist / C);
  const double prev = q.lastTau[m] > 0 ? q.lastTau[m] : p.tau;
  q.lastTau[m] = p.tau;
  q.doppler[m] = 1 - (p.tau - prev) * fs;
  const double d = (p.tau - offset) * fs; // samples back from now
  const double back = std::clamp(d, 1.0, (double)RING - 4);
  const int i = (int)back;
  const double t = back - i;
  // the samples at i-1, i, i+1, i+2 back, with the fraction t from i toward i+1 (older)
  const double y0 = q.buf[(w - i + 1) & MASK], y1 = q.buf[(w - i) & MASK], y2 = q.buf[(w - i - 1) & MASK], y3 = q.buf[(w - i - 2) & MASK];
  const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  const double x = ((c3 * t + c2) * t + c1) * t + y1;
  // the history, newest last: hh[0 … taps−1] runs from the oldest to the newest
  const int taps = 2 * half + 1;
  double *ring = q.hist[m].data();
  ring[q.hp] = ring[q.hp + taps] = x;
  const double *hh = ring + q.hp + 1;
  if (m == 1) q.hp = (q.hp + 1) % taps; // both microphones' rings move on together, after the second
  // the pattern: sin θ in front, and behind what it sends sideways
  const double s = p.cosTheta > 0 ? std::sqrt(std::max(0.0, 1 - p.cosTheta * p.cosTheta)) : 1;
  const double u = s * (NS - 1);
  const int k = std::min(NS - 2, (int)u);
  const double f = u - k;
  const double *h0 = q.pattern.row(k), *h1 = q.pattern.row(k + 1);
  const int r = std::max(q.pattern.reach[k], q.pattern.reach[k + 1]);
  double a0 = 0, a1 = 0;
  for (int n = half - r; n <= half + r; n++) { a0 += h0[n] * hh[taps - 1 - n]; a1 += h1[n] * hh[taps - 1 - n]; }
  q.gain[m] = dist / p.dist;
  q.sin[m] = s;
  return dist / p.dist * ((1 - f) * a0 + f * a1);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  const double kh = 1 - std::exp(-1 / (horn.tau * fs)), kd = 1 - std::exp(-1 / (drum.tau * fs));
  const bool fastOn = P[fast] > 0.5;
  for (int i = 0; i < n; i++) {
    const double x = in[i];
    if (blank && x != 0) blank = false;
    // the motors
    horn.w += ((fastOn ? horn.fast : horn.slow) - horn.w) * kh;
    drum.w += ((fastOn ? drum.fast : drum.slow) - drum.w) * kd;
    horn.alpha += horn.w / fs; drum.alpha += drum.w / fs;
    if (horn.alpha > 2 * PI) horn.alpha -= 2 * PI;
    if (drum.alpha > 2 * PI) drum.alpha -= 2 * PI;
    // the crossover, into each rotor's ring
    const double lo = biquad(lpA, lpS[0], x);
    const double hi = -biquad(hpA, hpS[0], x);
    w = (w + 1) & MASK;
    horn.buf[w] = (float)hi; drum.buf[w] = (float)lo;
    double out[2];
    for (int m = 0; m < 2; m++) out[m] = gHorn * hear(horn, m, horn.w) + gDrum * hear(drum, m, drum.w);
    L[i] = (float)(gOut * out[0]);
    R[i] = (float)(gOut * out[1]);
    if (++tick >= every) {
      tick = 0;
      msg.type = kState;
      const float v[] = {(float)horn.alpha, (float)drum.alpha, (float)(horn.w / (2 * PI)), (float)(drum.w / (2 * PI)),
                         (float)horn.doppler[0], (float)horn.doppler[1], (float)drum.doppler[0], (float)drum.doppler[1],
                         (float)horn.gain[0], (float)horn.gain[1], (float)drum.gain[0], (float)drum.gain[1],
                         (float)horn.sin[0], (float)horn.sin[1], (float)drum.sin[0], (float)drum.sin[1]};
      msg.count = 16;
      for (int k = 0; k < 16; k++) msg.values[k] = v[k];
      post(msg);
    }
  }
}

} // namespace rotary
