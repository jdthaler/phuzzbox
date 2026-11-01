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

double stoppedLength(const Settings &S, double fret) { return S.scale / std::pow(2.0, fret / 12.0); }

Mode mode(const Settings &S, int string, double len, int n, double tension) {
  const StringSpec &s = S.spec[string];
  const double B = inharmonicity(s, len) / tension; // B ∝ 1/T
  // tuned so that the first partial is the note: f₁ = f₀ √(1 + B), the note f_open ℓ_scale / ℓ
  // (f ∝ √T, so a bend raises it by √(T'/T))
  const double f0 = s.f * S.scale / len * std::sqrt(tension) / std::sqrt(1 + B), f = n * f0 * std::sqrt(1 + B * n * n);
  const double k = n * PI / len, xu = std::min(S.pickupAt, len);
  // the pickup hears the mode's velocity (its displacement times ω) over its aperture
  return {f, S.b1 + S.b3 * f * f, TAU * f * std::sin(k * xu) * sinc(k * S.aperture / 2)};
}

double bendTension(const Settings &S, int string, double fret, double across) {
  const StringSpec &s = S.spec[string];
  const double L = S.scale, len = stoppedLength(S, fret), a = L - len, d = std::abs(across);
  if (a < 1e-4 || d == 0) return 1; // an open string has nothing to push against
  const double stretch = std::hypot(a, d) - a + std::hypot(len, d) - len;
  const double EA = kSteelE * PI * s.core * s.core / 4; // the core carries the stretch; a winding adds mass, not stiffness
  return std::min(kMaxTension, 1 + EA * stretch / L / s.T);
}

std::vector<Partial> partials(const Settings &S, int string, int fret, double fs) {
  const double len = stoppedLength(S, fret);
  const double xp = std::clamp(S.pluckAt, 0.005, len - 0.005);
  const double fmax = std::min(0.45 * fs, 10000.0);
  std::vector<Partial> out;
  for (int n = 1; n <= kMaxModes; n++) {
    const Mode m = mode(S, string, len, n);
    if (m.f > fmax) break;
    const double k = n * PI / len;
    // a unit-height triangle from rest at xp: its n-th mode's displacement, smoothed by the finger
    const double a = 2 * len * len / (n * n * PI * PI * xp * (len - xp)) * std::sin(k * xp) * sinc(k * S.finger / 2);
    out.push_back({m.f, m.sigma, a * m.heard});
  }
  return out;
}

Instrument::Instrument(double fs, Kind kind) : fs(fs) { use(kind); }

void Instrument::use(Kind kind) {
  const bool fretless = settings.fretless;
  settings = kind == Kind::guitar ? guitarSettings() : bassSettings();
  settings.fretless = fretless;
  for (Voice &V : voices) { V.n = 0; V.key = -1; V.muted = false; V.across = 0; }
  next.fill(0);
  across.fill(0);
  applySettings();
}

void Instrument::applySettings() {
  const phuzzbox::PickupCircuit &c = settings.circuit;
  const phuzzbox::AnalogBiquad d = c.section();
  circuit = phuzzbox::bilinear({0, 0, 1, d.a2, d.a1, d.a0}, fs, std::min(c.resonance(), 0.4 * fs)); // an all-pole low-pass: the bilinear transform, prewarped at its resonance
}

void Instrument::pluck(int string, int fret, double velocity) {
  if (string < 0 || string >= settings.strings) return;
  fret = std::clamp(fret, 0, 24);
  mute(string); // the finger stops what was ringing as it plucks again
  const int v = string * 2 + next[string];
  next[string] ^= 1;
  Voice &V = voices[v];
  const double len = stoppedLength(settings, fret);
  const double xp = std::clamp(settings.pluckAt, 0.005, len - 0.005);
  const double fmax = std::min(0.45 * fs, 10000.0);
  const double height = settings.pull * std::clamp(velocity, 0.0, 1.0); // m: a firm finger pulls a bass string 2 mm
  V.n = 0;
  while (V.n < kMaxModes && mode(settings, string, len, V.n + 1).f <= fmax) V.n++;
  V.muted = false;
  V.key = settings.spec[string].key + fret;
  V.string = string;
  V.at = V.from = V.to = fret;
  V.sliding = false;
  V.across = across[string]; // a string already pushed plucks bent
  retune(V, fret, false);
  for (int i = 0; i < V.n; i++) {
    const int n = i + 1;
    const double k = n * PI / len;
    // the mode starts from rest at full displacement: a phasor of its amplitude (a unit-height
    // triangle from rest at xp, smoothed by the finger) at angle 0; the output takes −gain × its
    // imaginary part, the velocity the pickup hears
    const double a = 2 * len * len / (n * n * PI * PI * xp * (len - xp)) * std::sin(k * xp) * sinc(k * settings.finger / 2);
    V.re[i] = settings.volts * height * a;
    V.im[i] = 0;
  }
}

// A string whose stopped length changes slowly keeps each mode's action, its energy over its
// frequency. A mode's energy is ½ (μℓ/2) ω² A², so the action goes as ℓ ω A²; ℓω is nearly
// constant (exactly, for a flexible string), so the displacement A carries through a slide
// unchanged, and only the frequencies, the decay rates and what the pickup hears move.
void Instrument::retune(Voice &V, double pitch, bool keep) {
  V.pitch = pitch;
  const double len = stoppedLength(settings, pitch), T = 1 / fs, fmax = 0.49 * fs;
  const double tension = bendTension(settings, V.string, pitch, V.across);
  for (int i = 0; i < V.n; i++) {
    const Mode m = mode(settings, V.string, len, i + 1, tension);
    // the action ½(μℓ/2)ω²A² / ω ∝ ℓ f A² is kept: through a slide ℓf barely changes (exactly not,
    // on a flexible string) and the displacement is kept; through a bend ℓ is fixed and A ∝ 1/√f
    const double lf = len * m.f;
    if (keep && V.lf[i] > 0) { const double k = std::sqrt(V.lf[i] / lf); V.re[i] *= k; V.im[i] *= k; }
    V.lf[i] = lf;
    const double f = std::min(m.f, fmax);
    const double r = std::exp(-m.sigma * T), w = TAU * f * T, rm = std::exp(-std::max(m.sigma, settings.muted) * T);
    V.cr[i] = r * std::cos(w); V.ci[i] = r * std::sin(w);
    V.cmr[i] = rm * std::cos(w); V.cmi[i] = rm * std::sin(w);
    if (V.muted) { V.cr[i] = V.cmr[i]; V.ci[i] = V.cmi[i]; }
    V.gain[i] = m.f < fmax ? m.heard : 0; // a mode slid above the Nyquist frequency is no longer heard
  }
}

void Instrument::slide(int string, double fret, double seconds) {
  if (string < 0 || string >= settings.strings) return;
  Voice &V = voices[string * 2 + (next[string] ^ 1)]; // the last plucked on this string
  if (!V.n || V.muted) return;
  V.from = V.at;
  V.to = std::clamp(fret, 0.0, 24.0);
  V.t = 0;
  V.dur = std::max(1L, (long)std::lround(seconds * fs));
  V.sliding = true;
  V.key = settings.spec[string].key + (int)std::lround(V.to);
}

void Instrument::bend(int string, double d) {
  if (string < 0 || string >= settings.strings) return;
  across[string] = std::clamp(std::abs(d), 0.0, 0.05);
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
  constexpr int kStep = 16; // a sliding finger moves every 16 samples (a third of a millisecond)
  for (int j0 = 0; j0 < n; j0 += kStep) {
    const int m = std::min(kStep, n - j0);
    for (Voice &V : voices) {
      if (!V.sliding || !V.n) continue;
      V.t = std::min(V.dur, V.t + m);
      // at a steady speed along the neck: the finger's distance from the nut, ℓ_s(1 − 2^(−fret/12)),
      // moves linearly in time
      const double u = (double)V.t / V.dur, d0 = 1 - std::pow(2.0, -V.from / 12), d1 = 1 - std::pow(2.0, -V.to / 12);
      V.at = -12 * std::log2(1 - (d0 + u * (d1 - d0)));
      if (V.t >= V.dur) { V.at = V.to; V.sliding = false; }
      // fretted, the string is stopped by the fret nearest the finger (it crosses to the next one
      // halfway between); fretless or under a slide bar, at the finger itself
      const double pitch = settings.fretless ? V.at : std::round(V.at);
      if (pitch != V.pitch) retune(V, pitch);
    }
    // a bend: the note still held on each string follows the finger across the neck, as a finger
    // moves, in a few milliseconds (a time constant of 5 ms)
    const double glide = 1 - std::exp(-m / (0.005 * fs));
    for (int s = 0; s < settings.strings; s++) {
      Voice &V = voices[s * 2 + (next[s] ^ 1)];
      if (!V.n || V.muted || V.across == across[s]) continue;
      V.across += (across[s] - V.across) * glide;
      if (std::abs(V.across - across[s]) < 1e-6) V.across = across[s];
      retune(V, V.pitch);
    }
    for (int j = j0; j < j0 + m; j++) {
      double e = 0;
      for (Voice &V : voices) {
        for (int i = 0; i < V.n; i++) {
          const double re = V.re[i] * V.cr[i] - V.im[i] * V.ci[i];
          const double im = V.re[i] * V.ci[i] + V.im[i] * V.cr[i];
          V.re[i] = re;
          V.im[i] = im;
          e -= V.gain[i] * im;
        }
      }
      out[j] = (float)circuit.run(e);
    }
  }
  // a voice whose modes have all died away stops costing anything
  for (Voice &V : voices) {
    if (!V.n) continue;
    double mx = 0;
    for (int i = 0; i < V.n; i++) mx = std::max(mx, std::abs(V.gain[i]) * (std::abs(V.re[i]) + std::abs(V.im[i])));
    if (mx < 1e-7) { V.n = 0; V.sliding = false; }
  }
}

} // namespace testbass
