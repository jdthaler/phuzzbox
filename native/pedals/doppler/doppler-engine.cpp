// doppler-engine.cpp — the Doppler as an effect (doppler-engine.h).
//
// Each output sample is the moving source's field averaged over the sample: for each retarded-time
// branch, the input integrated over the emission times that arrive within it, weighted by d / R.
// The compression 1 / |1 − M_r| is then the width of that emission interval, so nothing is
// differentiated and nothing diverges where it would be infinite, at the Mach cone.

#include "doppler-engine.h"

#include <algorithm>
#include <cmath>

namespace doppler {

Engine::Engine(double fs) : Effect(fs) {
  // the longest any sound can take at the controls' limits, and the passes' longest length
  Pass worst;
  worst.v = 700; worst.u = 50; worst.d = 100; worst.c = soundSpeed(-20); worst.T = 8;
  const double hist = (longest(worst) + 0.1) * fs + 8;
  int64_t size = 1;
  while (size < hist) size <<= 1;
  buf.assign((size_t)size, 0.f);
  mask = size - 1;
  cadence = (int)std::lround(0.020 * fs);
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  setParams(P);
  reset();
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
}

Pass Engine::next() const {
  Pass p;
  p.v = P[speed]; p.u = P[listener]; p.d = P[distance]; p.T = P[period]; p.c = soundSpeed(P[temp]);
  if (std::fabs(p.v - p.c) < 0.05) p.v = p.c + (p.v < p.c ? -0.05 : 0.05); // never exactly Mach 1
  return p;
}

void Engine::reset() {
  std::fill(buf.begin(), buf.end(), 0.f);
  n = 0; nextStart = 0; tick = 0;
  for (auto &q : live) q.on = false;
}

void Engine::begin(int64_t at) {
  Live *q = live;
  for (auto &c : live) { if (!c.on) { q = &c; break; } if (c.start < q->start) q = &c; } // a free slot, or the oldest
  q->p = next();
  q->start = at; q->on = true;
  q->Tmid = q->p.T * fs / 2;
  q->reach = (q->p.T + longest(q->p)) * fs + 2;
  for (int ear = 0; ear < 2; ear++) {
    double D[2];
    q->count[ear] = delays(q->p, (at - (at + q->Tmid)) / fs, ear ? EAR : -EAR, D);
    q->D[ear][0] = D[0] * fs; q->D[ear][1] = D[1] * fs;
  }
  nextStart = at + std::max<int64_t>(1, std::llround(q->p.T * fs));
}

double Engine::integral(double a, double b) const {
  const int64_t ia = (int64_t)std::floor(a), ib = (int64_t)std::floor(b);
  const auto x = [&](int64_t j) { return (double)buf[(size_t)(j & mask)]; };
  const double fa = a - ia, fb = b - ib;
  if (ia == ib) {
    const double x0 = x(ia), x1 = x(ia + 1);
    return x0 * (fb - fa) + (x1 - x0) * (fb * fb - fa * fa) / 2;
  }
  double s = 0;
  { const double x0 = x(ia), x1 = x(ia + 1); s += x0 * (1 - fa) + (x1 - x0) * (1 - fa * fa) / 2; }
  for (int64_t j = ia + 1; j < ib; j++) s += 0.5 * (x(j) + x(j + 1));
  { const double x0 = x(ib), x1 = x(ib + 1); s += x0 * fb + (x1 - x0) * fb * fb / 2; }
  return s;
}

double Engine::hear(Live &q, int ear, double e) {
  const double t1 = (double)(n + 1), s1 = (t1 - q.start - q.Tmid) / fs;
  double D[2];
  const int c1 = delays(q.p, s1, e, D), c0 = q.count[ear];
  const double D1[2] = {D[0] * fs, D[1] * fs};
  double out = 0;
  // each branch's emission interval [τ at the last boundary, τ now], in samples
  double from[2], to[2], Dm[2];
  int k = 0;
  if (c0 == c1) {
    for (; k < c1; k++) { from[k] = t1 - 1 - q.D[ear][k]; to[k] = t1 - D1[k]; Dm[k] = 0.5 * (q.D[ear][k] + D1[k]); }
  } else if (c0 == 0 && c1 == 2) { // the Mach cone arrived within this sample: both branches from where they meet
    double sc, Dc;
    cone(q.p, e, sc, Dc);
    const double tc = q.start + q.Tmid + sc * fs, tauc = tc - Dc * fs;
    for (; k < 2; k++) { from[k] = tauc; to[k] = t1 - D1[k]; Dm[k] = 0.5 * (Dc * fs + D1[k]); }
  }
  for (int j = 0; j < k; j++) {
    double a = std::min(from[j], to[j]), b = std::max(from[j], to[j]);
    a = std::max(a, (double)q.start); b = std::min(b, (double)q.start + 2 * q.Tmid); // its stretch of road
    a = std::max(a, (double)(n + 1) - (double)mask + 2);                           // what the ring holds
    if (b <= a) continue;
    const double tm = 0.5 * (a + b), w = envelope(q.p, (tm - q.start) / fs);
    if (w <= 0) continue;
    out += w * q.p.d / (q.p.c * Dm[j] / fs) * integral(a, b);
  }
  q.count[ear] = c1; q.D[ear][0] = D1[0]; q.D[ear][1] = D1[1];
  return out;
}

void Engine::process(const float *in, float *L, float *R, int count) {
  const double lv = std::pow(10, P[level] / 20);
  for (int i = 0; i < count; i++, n++) {
    const float x = std::isfinite(in[i]) ? in[i] : 0.f;
    buf[(size_t)(n & mask)] = x;
    if (n >= nextStart) begin(n);
    double y[2] = {0, 0};
    for (auto &q : live) {
      if (!q.on) continue;
      if (n - q.start > q.reach) { q.on = false; continue; }
      y[0] += hear(q, 0, -EAR);
      y[1] += hear(q, 1, EAR);
    }
    L[i] = (float)(lv * (P[dry] * x + P[mix] * y[0]));
    R[i] = (float)(lv * (P[dry] * x + P[mix] * y[1]));
  }
  tick += count;
  if (tick >= cadence) {
    tick = 0;
    const Live *q = nullptr;
    for (const auto &c : live) if (c.on && (!q || c.start > q->start)) q = &c;
    if (q) {
      msg.type = kPass; msg.count = 6;
      const float v[6] = {(float)((n - q->start - q->Tmid) / fs), (float)q->p.T, (float)q->p.v, (float)q->p.u, (float)q->p.d, (float)q->p.c};
      for (int j = 0; j < 6; j++) msg.values[j] = v[j];
      post(msg);
    }
  }
}

} // namespace doppler
