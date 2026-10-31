// testbass.cpp — the test bass (testbass.h).

#include "testbass.h"

#include <algorithm>
#include <cmath>

namespace testbass {

using phuzzbox::PI;
using phuzzbox::TAU;

constexpr int kOpenKey[kStrings] = {28, 33, 38, 43}; // E1 A1 D2 G2
constexpr double kSteelE = 200e9;                   // Pa: Young's modulus of the steel core

double inharmonicity(const StringSpec &s, double length) {
  return PI * PI * PI * kSteelE * std::pow(s.core, 4) / (64 * s.T * length * length);
}

static double sinc(double x) { return std::abs(x) < 1e-9 ? 1 : std::sin(x) / x; }

std::vector<Partial> partials(const Settings &S, int string, int fret, double fs) {
  const StringSpec &s = kStringSpecs[string];
  const double len = S.scale / std::pow(2.0, fret / 12.0);
  const double B = inharmonicity(s, len);
  // tuned so that the first partial is the note: f₁ = f₀ √(1 + B)
  const double target = s.f * std::pow(2.0, fret / 12.0), f0 = target / std::sqrt(1 + B);
  const double xp = std::clamp(S.pluckAt, 0.005, len - 0.005), xu = std::min(S.pickupAt, len);
  const double fmax = std::min(0.45 * fs, 10000.0);
  std::vector<Partial> out;
  for (int n = 1; n <= kMaxModes; n++) {
    const double f = n * f0 * std::sqrt(1 + B * n * n);
    if (f > fmax) break;
    const double k = n * PI / len;
    // a unit-height triangle from rest at xp: its n-th mode's displacement, smoothed by the finger
    const double a = 2 * len * len / (n * n * PI * PI * xp * (len - xp)) * std::sin(k * xp) * sinc(k * S.finger / 2);
    // the pickup hears the mode's velocity (amplitude a·ω) over its aperture
    const double heard = std::sin(k * xu) * sinc(k * S.aperture / 2);
    out.push_back({f, S.b1 + S.b3 * f * f, a * TAU * f * heard});
  }
  return out;
}

Bass::Bass(double fs) : fs(fs) { applySettings(); }

void Bass::applySettings() {
  const phuzzbox::PickupCircuit &c = settings.circuit;
  const phuzzbox::AnalogBiquad d = c.section();
  circuit = phuzzbox::bilinear({0, 0, 1, d.a2, d.a1, d.a0}, fs, std::min(c.resonance(), 0.4 * fs)); // an all-pole low-pass: the bilinear transform, prewarped at its resonance
}

void Bass::pluck(int string, int fret, double velocity) {
  if (string < 0 || string >= kStrings) return;
  mute(string); // the finger stops what was ringing as it plucks again
  const int v = string * 2 + next[string];
  next[string] ^= 1;
  Voice &V = voices[v];
  const std::vector<Partial> ps = partials(settings, string, fret, fs);
  const double height = 2.0e-3 * std::clamp(velocity, 0.0, 1.0); // m: a firm finger pulls 2 mm
  V.n = (int)ps.size();
  V.muted = false;
  V.key = kOpenKey[string] + fret;
  const double T = 1 / fs;
  for (int i = 0; i < V.n; i++) {
    const Partial &p = ps[i];
    const double r = std::exp(-p.sigma * T), w = TAU * p.f * T, rm = std::exp(-std::max(p.sigma, settings.muted) * T);
    V.cr[i] = r * std::cos(w); V.ci[i] = r * std::sin(w);
    V.cmr[i] = rm * std::cos(w); V.cmi[i] = rm * std::sin(w);
    // the mode starts from rest at full displacement, so its velocity goes as −sin(ωt): a phasor
    // of the mode's heard amplitude starting at angle 0, whose imaginary part the output takes
    V.re[i] = settings.volts * height * p.amp;
    V.im[i] = 0;
  }
}

void Bass::mute(int string) {
  for (int k = 0; k < 2; k++) {
    Voice &V = voices[string * 2 + k];
    if (V.muted || !V.n) continue;
    V.muted = true;
    for (int i = 0; i < V.n; i++) { V.cr[i] = V.cmr[i]; V.ci[i] = V.cmi[i]; }
  }
}

int Bass::note(int key, double velocity) {
  for (int s = kStrings - 1; s >= 0; s--) {
    const int fret = key - kOpenKey[s];
    if (fret >= 0) {
      if (fret > 24) return -1;
      pluck(s, fret, velocity);
      return s;
    }
  }
  return -1;
}

void Bass::noteOff(int key) {
  for (int s = 0; s < kStrings; s++)
    for (int k = 0; k < 2; k++) {
      Voice &V = voices[s * 2 + k];
      if (V.key == key && !V.muted && V.n) {
        V.muted = true;
        for (int i = 0; i < V.n; i++) { V.cr[i] = V.cmr[i]; V.ci[i] = V.cmi[i]; }
      }
    }
}

void Bass::process(float *out, int n) {
  for (int j = 0; j < n; j++) {
    double e = 0;
    for (Voice &V : voices) {
      for (int i = 0; i < V.n; i++) {
        const double re = V.re[i] * V.cr[i] - V.im[i] * V.ci[i];
        const double im = V.re[i] * V.ci[i] + V.im[i] * V.cr[i];
        V.re[i] = re;
        V.im[i] = im;
        e -= im;
      }
    }
    out[j] = (float)circuit.run(e);
  }
  // a voice whose modes have all died away stops costing anything
  for (Voice &V : voices) {
    if (!V.n) continue;
    double m = 0;
    for (int i = 0; i < V.n; i++) m = std::max(m, std::abs(V.re[i]) + std::abs(V.im[i]));
    if (m < 1e-7) V.n = 0;
  }
}

} // namespace testbass
