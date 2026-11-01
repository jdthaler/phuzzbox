// echo-engine.cpp — the Tape Echo as an effect (echo-engine.h).

#include "echo-engine.h"

#include <algorithm>
#include <cmath>

namespace echo {

Engine::Engine(double fs) : Effect(fs) {
  // the tape holds the longest echo at the slowest speed, and some
  N = (int)std::ceil(fs * HEAD[2] / 0.05) + 4 * TAPS + 64;
  buf.assign(N, 0.f);
  pos.assign(N, 0.0);
  every = (int)std::lround(0.020 * fs);
  for (int i = 0; i < kParamCount; i++) P[i] = kParams[i].def;
  M = model(P);
  v = vTape = M.speed;
  reset();
  setParams(P);
}

void Engine::reset() {
  // a blank tape, moving at the motor's speed
  std::fill(buf.begin(), buf.end(), 0.f);
  X = 0; w = 0;
  for (int i = 0; i < N; i++) pos[(w - i + N) % N] = -i * v / fs;
  for (int j = 0; j < 3; j++) {
    const double p = X - HEAD[j];
    int k = w;
    while (pos[k] > p) k = (k - 1 + N) % N;
    at[j] = k;
  }
  std::fill(hist, hist + TAPS, 0.0);
  fb = 0; hpS = 0; theta = 0; recordPeak = 0;
  blank = true;
}

void Engine::setParams(const double *Pn) {
  for (int i = 0; i < kParamCount; i++) P[i] = Pn[i];
  M = model(P);
  const double gg = PI * COUPLING_HZ / fs;
  hpG = gg / (1 + gg);
  // a blank tape (nothing recorded since a reset) runs at the knob's speed at once: no one hears
  // the motor come up to speed until there is something on the tape
  if (blank && v != M.speed) { v = vTape = M.speed; reset(); }
  redesign();
}

// the heads' FIR, again when the motor's speed or the heads have moved
void Engine::redesign() {
  if (std::abs(v / designedV - 1) > 5e-3 || M.spacing != designedD || M.gap != designedG) {
    design(fir, v, M.spacing, M.gap, fs);
    designedV = v; designedD = M.spacing; designedG = M.gap;
  }
}

// The tape at position p, as head j reads it: the samples either side of p, by cubic (Hermite)
// interpolation in the buffer, at the fraction of the way between their positions.
double Engine::read(int j, double p) {
  int k = at[j];
  for (;;) { const int n1 = (k + 1) % N; if (n1 == w || pos[n1] > p) break; k = n1; } // pos[k] ≤ p < pos[k+1]
  at[j] = k;
  const int k1 = (k + 1) % N, k0 = (k - 1 + N) % N, k2 = (k + 2) % N;
  const double span = pos[k1] - pos[k];
  const double t = span > 0 ? std::clamp((p - pos[k]) / span, 0.0, 1.0) : 0;
  const double y0 = buf[k0], y1 = buf[k], y2 = buf[k1], y3 = buf[k2];
  const double c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

double Engine::step(double x) {
  // the motor follows the knob; the capstan wavers once a turn
  v += (M.speed - v) * (1 - std::exp(-1 / (MOTOR_TAU * fs)));
  theta += vTape / CAPSTAN_R / fs;
  if (theta > 2 * PI) theta -= 2 * PI;
  vTape = v * (1 + (M.ecc / CAPSTAN_R) * std::cos(theta));
  X += vTape / fs;
  // record: the input and the repeats, through the coupling RC, onto the tape
  const double r = x + M.repeats * fb;
  const double vv = (r - hpS) * hpG, lp = vv + hpS; hpS = lp + vv;
  const double hpOut = r - lp;
  recordPeak = std::max(recordPeak, std::abs(M.g * hpOut));
  w = (w + 1) % N;
  buf[w] = (float)tape(hpOut, M.g);
  if (buf[w] != 0.f) blank = false;
  pos[w] = X;
  // play: each head reads the tape d behind the record head, ahead by the FIR's latency
  const double ahead = vTape * HALF / fs;
  double sum = 0;
  for (int j = 0; j < 3; j++) {
    const double y = read(j, X - HEAD[j] + ahead); // read every head, so each keeps its place
    if (M.head[j]) sum += y;
  }
  // the heads' losses
  hist[hp] = sum;
  double y = 0;
  for (int n = 0, i = hp; n < TAPS; n++, i = (i == 0 ? TAPS - 1 : i - 1)) y += fir[n] * hist[i];
  hp = (hp + 1) % TAPS;
  fb = y;
  return y;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  for (int i = 0; i < n; i++) {
    if ((i & 31) == 0) redesign();
    const double x = in[i];
    const double e = step(x);
    const float out = (float)(M.level * (M.dry * x + M.wet * e));
    L[i] = out;
    R[i] = out;
    if (messages && ++tick >= every) {
      tick = 0;
      msg.type = kState;
      msg.count = 5;
      msg.values[0] = (float)vTape;
      for (int j = 0; j < 3; j++) msg.values[1 + j] = (float)(HEAD[j] / v);
      msg.values[4] = (float)recordPeak;
      recordPeak = 0;
      post(msg);
    }
  }
  if (std::abs(fb) < 1e-15) fb = 0; // 300 dB down: the repeats have died
  if (std::abs(hpS) < 1e-30) hpS = 0;
}

} // namespace echo
