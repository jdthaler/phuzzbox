// testbass.cpp — the test bass and the test guitar (testbass.h).

#include "testbass.h"

#include <algorithm>
#include <cmath>

namespace testbass {

using phuzzbox::PI;
using phuzzbox::TAU;

constexpr double kSteelE = 200e9; // Pa: Young's modulus of the steel core

Settings bassSettings() {
  Settings S;
  S.kind = Kind::bass;
  S.strings = 4;
  for (int s = 0; s < 4; s++) S.spec[s] = kBassStrings[s];
  return S; // the rest as Settings has them: the bass is the default
}

Settings guitarSettings() {
  Settings S;
  S.kind = Kind::guitar;
  S.strings = 6;
  for (int s = 0; s < 6; s++) S.spec[s] = kGuitarStrings[s];
  S.scale = 0.648;     // 25.5 inches
  S.pluckAt = 0.12;    // a pick between the pickups
  S.finger = 0.003;    // a pick's edge, not a finger's pad: a brighter pluck
  S.pull = 1.0e-3;     // lighter strings, pulled less far
  S.pickupAt = 0.10;   // a single coil in the middle position
  S.aperture = 0.015;
  S.volts = 0.25;
  S.circuit.L = 2.5;   // a single coil: fewer turns than a bass's P pickup
  S.circuit.R = 6000;
  return S;
}

double inharmonicity(const StringSpec &s, double length) {
  return PI * PI * PI * kSteelE * std::pow(s.core, 4) / (64 * s.T * length * length);
}

static double sinc(double x) { return std::abs(x) < 1e-9 ? 1 : std::sin(x) / x; }

std::vector<Partial> partials(const Settings &S, int string, int fret, double fs) {
  const StringSpec &s = S.spec[string];
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

Instrument::Instrument(double fs, Kind kind) : fs(fs) { use(kind); }

void Instrument::use(Kind kind) {
  settings = kind == Kind::guitar ? guitarSettings() : bassSettings();
  for (Voice &V : voices) { V.n = 0; V.key = -1; V.muted = false; }
  next.fill(0);
  applySettings();
}

void Instrument::applySettings() {
  const phuzzbox::PickupCircuit &c = settings.circuit;
  const phuzzbox::AnalogBiquad d = c.section();
  circuit = phuzzbox::bilinear({0, 0, 1, d.a2, d.a1, d.a0}, fs, std::min(c.resonance(), 0.4 * fs)); // an all-pole low-pass: the bilinear transform, prewarped at its resonance
}

void Instrument::pluck(int string, int fret, double velocity) {
  if (string < 0 || string >= settings.strings) return;
  mute(string); // the finger stops what was ringing as it plucks again
  const int v = string * 2 + next[string];
  next[string] ^= 1;
  Voice &V = voices[v];
  const std::vector<Partial> ps = partials(settings, string, fret, fs);
  const double height = settings.pull * std::clamp(velocity, 0.0, 1.0); // m: a firm finger pulls a bass string 2 mm
  V.n = (int)ps.size();
  V.muted = false;
  V.key = settings.spec[string].key + fret;
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

void Instrument::mute(int string) {
  for (int k = 0; k < 2; k++) {
    Voice &V = voices[string * 2 + k];
    if (V.muted || !V.n) continue;
    V.muted = true;
    for (int i = 0; i < V.n; i++) { V.cr[i] = V.cmr[i]; V.ci[i] = V.cmi[i]; }
  }
}

int Instrument::note(int key, double velocity) {
  for (int s = settings.strings - 1; s >= 0; s--) {
    const int fret = key - settings.spec[s].key;
    if (fret >= 0) {
      if (fret > 24) return -1;
      pluck(s, fret, velocity);
      return s;
    }
  }
  return -1;
}

void Instrument::noteOff(int key) {
  for (int s = 0; s < settings.strings; s++)
    for (int k = 0; k < 2; k++) {
      Voice &V = voices[s * 2 + k];
      if (V.key == key && !V.muted && V.n) {
        V.muted = true;
        for (int i = 0; i < V.n; i++) { V.cr[i] = V.cmr[i]; V.ci[i] = V.cmi[i]; }
      }
    }
}

void Instrument::process(float *out, int n) {
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
