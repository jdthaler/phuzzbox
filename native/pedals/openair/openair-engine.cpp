// openair-engine.cpp — Open Air as an effect (openair-engine.h).

#include "openair-engine.h"

#include <algorithm>
#include <cmath>

#include "openair-params.h"

namespace openair {

Engine::Engine(double rate) : Effect(rate) {
  const int scale = rate <= 50000 ? 1 : rate <= 100000 ? 2 : 4;
  B = 128 * scale;
  M = 32;
  taps = B * M;
  fadeLen = 8 * B;
  for (int w = 0; w < 2; w++) {
    head[w].assign(B, 0.0);
    spec[w].assign((M - 1) * (B + 1), cplx(0));
    tails[w].assign(B, 0.0);
  }
  fdl.assign((M - 1) * (B + 1), cplx(0));
  hist.assign(2 * B, 0.0);
  blk.assign(2 * B, 0.0);
  work.assign(2 * B, cplx(0));
  scratch.assign(designScratch(taps), cplx(0));
  h.assign(taps, 0.0);
  alpha = 1 - std::exp(-1 / (0.05 * fs)); // the Level's 50 ms glide
}

bool Engine::sameField(const Parts &a, const Parts &b) const {
  return a.d == b.d && a.hs == b.hs && a.hr == b.hr && a.T == b.T && a.rh == b.rh && a.sigma == b.sigma;
}

void Engine::load(int w) {
  design(want, fs, taps, h.data(), scratch.data());
  designed++;
  for (int j = 0; j < B; j++) head[w][j] = h[B - 1 - j];
  for (int p = 1; p < M; p++) {
    for (int j = 0; j < 2 * B; j++) work[j] = j < B ? h[p * B + j] : 0.0;
    fft(work.data(), 2 * B, false);
    std::copy(work.begin(), work.begin() + B + 1, spec[w].begin() + (p - 1) * (B + 1));
  }
  playing = want;
}

void Engine::setParams(const double *P) {
  want = openair::parts(P);
  if (fresh) { // until the first sample, a new field is loaded at once
    if (!sameField(want, playing) || !designed) load(active);
    levelNow = want.level;
    pending = fading = false;
  } else if (!sameField(want, playing)) {
    pending = true;
  }
}

void Engine::reset() {
  std::fill(hist.begin(), hist.end(), 0.0);
  std::fill(blk.begin(), blk.end(), 0.0);
  std::fill(fdl.begin(), fdl.end(), cplx(0));
  for (auto &t : tails) std::fill(t.begin(), t.end(), 0.0);
  pos = fill = newest = 0;
  fresh = true;
  if (fading) { active ^= 1; fading = false; }
  if (pending || !sameField(want, playing)) load(active);
  pending = false;
  levelNow = want.level;
}

double Engine::dot(const std::vector<double> &kk) const {
  const double *x = hist.data() + pos + 1, *c = kk.data();
  double s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  for (int j = 0; j < B; j += 4) {
    s0 += c[j] * x[j];
    s1 += c[j + 1] * x[j + 1];
    s2 += c[j + 2] * x[j + 2];
    s3 += c[j + 3] * x[j + 3];
  }
  return (s0 + s1) + (s2 + s3);
}

// the tail's output for the coming block: partition p meets the input block p before it
void Engine::tail(int w) {
  const int K = B + 1, slots = M - 1;
  for (int j = 0; j < K; j++) work[j] = 0;
  for (int p = 1; p < M; p++) {
    const cplx *x = fdl.data() + ((newest - (p - 1) + slots) % slots) * K, *s = spec[w].data() + (p - 1) * K;
    for (int j = 0; j < K; j++) work[j] += x[j] * s[j];
  }
  for (int j = 1; j < B; j++) work[2 * B - j] = std::conj(work[j]);
  work[0] = work[0].real();
  work[B] = work[B].real();
  fft(work.data(), 2 * B, true);
  for (int j = 0; j < B; j++) tails[w][j] = work[B + j].real() / (2 * B);
}

void Engine::boundary() {
  const int K = B + 1, slots = M - 1;
  for (int j = 0; j < 2 * B; j++) work[j] = blk[j];
  fft(work.data(), 2 * B, false);
  newest = (newest + 1) % slots;
  std::copy(work.begin(), work.begin() + K, fdl.begin() + newest * K);
  std::copy(blk.begin() + B, blk.end(), blk.begin());
  fill = 0;
  if (fading && fadeAt >= fadeLen) { fading = false; active ^= 1; }
  if (pending && !fading) { // a new field: design it, then fade over to it
    load(active ^ 1);
    pending = false;
    fading = true;
    fadeAt = 0;
  }
  tail(active);
  if (fading) tail(active ^ 1);
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    // (px_process), rather than into the filter's history, where it would stay
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    pos = pos + 1 == B ? 0 : pos + 1;
    hist[pos] = hist[pos + B] = in[i];
    blk[B + fill] = in[i];
    double y = dot(head[active]) + tails[active][fill];
    if (fading) {
      const double g = 0.5 - 0.5 * std::cos(3.14159265358979323846 * (fadeAt + 0.5) / fadeLen);
      y += g * (dot(head[active ^ 1]) + tails[active ^ 1][fill] - y);
      fadeAt++;
    }
    if (++fill == B) boundary();
    levelNow += alpha * (want.level - levelNow);
    const float v = (float)(levelNow * y);
    L[i] = v;
    R[i] = v;
  }
}

} // namespace openair
