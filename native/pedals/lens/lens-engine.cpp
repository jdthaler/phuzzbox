// lens-engine.cpp — the Gravitational Lens as an effect (lens-engine.h).

#include "lens-engine.h"

#include <algorithm>
#include <cmath>

#include "lens-params.h"
#include "phuzzbox/dsp.h"

namespace lens {

namespace { constexpr double kPi = 3.14159265358979323846; }

Engine::Engine(double rate) : Effect(rate) {
  cap = rate <= 50000 ? 16384 : rate <= 100000 ? 32768 : 65536;
  maxParts = cap / kBlock;
  for (Slot &s : slot) {
    s.h.reserve(cap);
    s.re.assign((size_t)maxParts * kBins, 0);
    s.im.assign((size_t)maxParts * kBins, 0);
  }
  xre.assign((size_t)maxParts * kBins, 0);
  xim.assign((size_t)maxParts * kBins, 0);
  hist.assign(2 * kBlock, 0);
  kernelB.reserve(cap);
  for (int k = 0; k < kFFT / 2; k++) twiddle[k] = std::polar(1.0, -2 * kPi * k / kFFT);
  int bits = 0;
  while ((1 << bits) < kFFT) bits++;
  for (int i = 0; i < kFFT; i++) {
    int r = 0;
    for (int b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  lightEvery = (int)std::lround(rate / 30);
  // the rays' delay line: room for the longest delay (2000 suns' worth, three Einstein radii off)
  int size = 1;
  while (size < 0.4 * rate + kRayLead + kTaps) size <<= 1;
  line.assign(size, 0);
  lineMask = size - 1;
  rayCoefficients(kRayPolesA, rate, ca);
  rayCoefficients(kRayPolesB, rate, cb);
  // the windowed sinc, a row for each fraction α of a sample: tap j (−7 … 8) weighs the sample
  // j − α from the point read, Kaiser-windowed (β = 8) over ±8 samples, each row summing to one
  auto i0 = [](double v) { double s = 1, t = 1; for (int k = 1; k < 40; k++) { t *= (v / (2 * k)) * (v / (2 * k)); s += t; } return s; };
  sinc.assign((kPhases + 1) * kTaps, 0);
  for (int ph = 0; ph <= kPhases; ph++) {
    const double a = (double)ph / kPhases;
    double sum = 0;
    for (int j = 0; j < kTaps; j++) {
      const double t = (j - 7) - a, r = t / 8;
      const double win = std::abs(r) < 1 ? i0(8 * std::sqrt(1 - r * r)) / i0(8) : 0;
      const double v = (std::abs(t) < 1e-12 ? 1 : std::sin(kPi * t) / (kPi * t)) * win;
      sinc[ph * kTaps + j] = v;
      sum += v;
    }
    for (int j = 0; j < kTaps; j++) sinc[ph * kTaps + j] /= sum;
  }
  raysStep = 1 / (0.03 * rate);
  glide = 1 - std::exp(-1 / (0.05 * rate));
}

bool Engine::sameLens(const Parts &a, const Parts &b) const {
  return a.mass == b.mass && a.z == b.z && a.y == b.y;
}

void Engine::setParams(const double *P) {
  gain = phuzzbox::dbToGain(P[level]);
  const Parts p = parts(P);
  delayTo = p.delay * fs;
  gaTo = std::sqrt(std::abs(p.im.mup));
  gbTo = std::sqrt(std::abs(p.im.mum));
  raysTo = p.optics == kRays ? 1 : 0;
  if (fresh) { delayNow = delayTo; gaNow = gaTo; gbNow = gbTo; raysNow = raysTo; }
  if (!haveParams || (fresh && !sameLens(p, want))) {
    // a lens set before the music starts is built at once, so the first sample already hears it
    if (stage != quiet) { stage = quiet; pending = false; }
    kernelB.start(p, fs, cap);
    while (!kernelB.work(1 << 20)) {}
    load(slot[active], kernelB);
    for (int q = 1; q <= slot[active].parts; q++) transform(slot[active], q);
    want = p;
    haveParams = true;
    return;
  }
  if (sameLens(p, want)) return;
  want = p;
  pending = true; // built once the kernel on its way (if any) is playing
}

void Engine::reset() {
  std::fill(hist.begin(), hist.end(), 0);
  std::fill(xre.begin(), xre.end(), 0);
  std::fill(xim.begin(), xim.end(), 0);
  std::fill(cur, cur + kBlock, 0);
  std::fill(prev, prev + kBlock, 0);
  for (Slot &s : slot) std::fill(s.tailOut, s.tailOut + kBlock, 0);
  if (stage == waiting || stage == fading) { active = 1 - active; stage = quiet; }
  std::fill(line.begin(), line.end(), 0);
  for (auto *v : {ax, ay, bx, by}) std::fill(v, v + kRaySections, 0);
  lineAt = 0;
  delayNow = delayTo; gaNow = gaTo; gbNow = gbTo; raysNow = raysTo;
  histAt = pos = fdlAt = lightAt = 0;
  sumIn = sumOut = 0;
}

void Engine::fft(bool inverse) {
  for (int i = 0; i < kFFT; i++)
    if (i < rev[i]) std::swap(buf[i], buf[rev[i]]);
  for (int len = 2; len <= kFFT; len <<= 1) {
    const int half = len >> 1, step = kFFT / len;
    for (int i = 0; i < kFFT; i += len)
      for (int k = 0; k < half; k++) {
        const std::complex<double> w = inverse ? std::conj(twiddle[k * step]) : twiddle[k * step];
        const std::complex<double> a = buf[i + k], b = buf[i + k + half] * w;
        buf[i + k] = a + b;
        buf[i + k + half] = a - b;
      }
  }
}

void Engine::load(Slot &s, const Kernel &k) {
  const std::vector<double> &h = k.taps();
  s.taps = k.length();
  s.h.assign(h.begin(), h.begin() + s.taps);
  if ((int)s.h.size() < kBlock) s.h.resize(kBlock, 0.0);
  s.parts = (s.taps + kBlock - 1) / kBlock - 1;
}

void Engine::transform(Slot &s, int p) {
  const int from = p * kBlock;
  for (int k = 0; k < kBlock; k++) buf[k] = from + k < s.taps ? s.h[from + k] : 0.0;
  for (int k = kBlock; k < kFFT; k++) buf[k] = 0.0;
  fft(false);
  float *re = s.re.data() + (size_t)(p - 1) * kBins, *im = s.im.data() + (size_t)(p - 1) * kBins;
  for (int k = 0; k < kBins; k++) { re[k] = (float)buf[k].real(); im[k] = (float)buf[k].imag(); }
}

void Engine::tails(Slot &s) {
  // Σ over the partitions p ≥ 1 of the input's spectrum p − 1 blocks back times partition p's
  float accRe[kBins] = {}, accIm[kBins] = {};
  for (int p = 1; p <= s.parts; p++) {
    const int at = (fdlAt - (p - 1) + maxParts) % maxParts;
    const float *xr = xre.data() + (size_t)at * kBins, *xi = xim.data() + (size_t)at * kBins;
    const float *hr = s.re.data() + (size_t)(p - 1) * kBins, *hi = s.im.data() + (size_t)(p - 1) * kBins;
    for (int k = 0; k < kBins; k++) {
      accRe[k] += xr[k] * hr[k] - xi[k] * hi[k];
      accIm[k] += xr[k] * hi[k] + xi[k] * hr[k];
    }
  }
  if (s.parts == 0) { std::fill(s.tailOut, s.tailOut + kBlock, 0); return; }
  for (int k = 0; k < kBins; k++) buf[k] = {accRe[k], accIm[k]};
  for (int k = kBins; k < kFFT; k++) buf[k] = std::conj(buf[kFFT - k]);
  fft(true);
  // overlap-save: the second half is the linear convolution's
  for (int k = 0; k < kBlock; k++) s.tailOut[k] = buf[kBlock + k].real() / kFFT;
}

void Engine::blockDone() {
  for (int k = 0; k < kBlock; k++) { buf[k] = prev[k]; buf[kBlock + k] = cur[k]; }
  fft(false);
  fdlAt = (fdlAt + 1) % maxParts;
  float *xr = xre.data() + (size_t)fdlAt * kBins, *xi = xim.data() + (size_t)fdlAt * kBins;
  for (int k = 0; k < kBins; k++) { xr[k] = (float)buf[k].real(); xi[k] = (float)buf[k].imag(); }
  std::copy(cur, cur + kBlock, prev);
  if (stage == waiting) { stage = fading; fadeAt = 0; fadeLen = std::max(1, (int)std::lround(0.03 * fs)); }
  tails(slot[active]);
  if (stage == fading) tails(slot[1 - active]);
}

double Engine::rayStep(double x) {
  lineAt = (lineAt + 1) & lineMask;
  line[lineAt] = x;
  delayNow += glide * (delayTo - delayNow);
  gaNow += glide * (gaTo - gaNow);
  gbNow += glide * (gbTo - gbNow);
  // the minimum's image kRayLead samples back; the saddle's Δt further, between samples
  double a = line[(lineAt - kRayLead) & lineMask];
  const double back = kRayLead + delayNow;
  const int i = (int)back;
  const double frac = (back - i) * kPhases;
  const int ph = std::min((int)frac, kPhases - 1);
  const double t = frac - ph;
  const double *r0 = sinc.data() + ph * kTaps, *r1 = r0 + kTaps;
  double b = 0;
  for (int j = 0; j < kTaps; j++) b += (r0[j] + t * (r1[j] - r0[j])) * line[(lineAt - i - (j - 7)) & lineMask];
  // each through its chain
  for (int k = 0; k < kRaySections; k++) {
    const double ya = -ca[k] * a + ax[k] + ca[k] * ay[k];
    ax[k] = a; ay[k] = ya; a = ya;
    const double yb = -cb[k] * b + bx[k] + cb[k] * by[k];
    bx[k] = b; by[k] = yb; b = yb;
  }
  return gaNow * a + gbNow * b;
}

void Engine::process(const float *in, float *L, float *R, int n) {
  fresh = false;
  for (int i = 0; i < n; i++) {
    // a sample that isn't a number goes out as one, so the block is silenced and the pedal reset
    if (!std::isfinite(in[i])) { L[i] = R[i] = in[i]; continue; }
    const double x = in[i];
    hist[histAt] = hist[histAt + kBlock] = x;
    const double *w = hist.data() + histAt + kBlock; // w[−k] is x k samples ago
    histAt = (histAt + 1) % kBlock;
    cur[pos] = x;
    auto head = [&](const Slot &s) {
      double y = 0;
      const double *h = s.h.data();
      for (int k = 0; k < kBlock; k++) y += h[k] * w[-k];
      return y + s.tailOut[pos];
    };
    double y = head(slot[active]);
    if (stage == fading) {
      const double g = 0.5 - 0.5 * std::cos(kPi * (fadeAt + 0.5) / fadeLen);
      y += g * (head(slot[1 - active]) - y);
      if (++fadeAt >= fadeLen) { active = 1 - active; stage = quiet; }
    }
    const double r = rayStep(x);
    if (raysNow != raysTo) raysNow = raysTo > raysNow ? std::min(raysTo, raysNow + raysStep) : std::max(raysTo, raysNow - raysStep);
    if (raysNow > 0) y += (0.5 - 0.5 * std::cos(kPi * raysNow)) * (r - y);
    L[i] = R[i] = (float)(gain * y);
    sumIn += x * x;
    sumOut += y * y;
    if (++pos == kBlock) { blockDone(); pos = 0; }
    if (++lightAt >= lightEvery) {
      if (messages) {
        msg.type = kLight;
        msg.count = 3;
        msg.values[0] = (float)std::sqrt(sumIn / lightAt);
        msg.values[1] = (float)std::sqrt(sumOut / lightAt);
        msg.values[2] = stage == quiet && !pending ? 0.f : 1.f;
        post(msg);
      }
      lightAt = 0;
      sumIn = sumOut = 0;
    }
  }
  // the next kernel, a little at a time: its areas, then its partitions' spectra
  if (stage == quiet && pending) {
    pending = false;
    building = want;
    kernelB.start(building, fs, cap);
    stage = build;
  }
  if (stage == build && kernelB.work(std::max(16, n / 2))) {
    load(slot[1 - active], kernelB);
    transformAt = 1;
    stage = transforming;
  }
  if (stage == transforming) {
    Slot &s = slot[1 - active];
    for (int k = 0; k < 16 && transformAt <= s.parts; k++) transform(s, transformAt++);
    if (transformAt > s.parts) stage = waiting;
  }
}

} // namespace lens
