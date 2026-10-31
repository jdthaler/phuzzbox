// testbass.h — a bass guitar made of physics, so the tests, the demos and a page with nothing
// plugged in have a signal to put through the pedals without a recording (testbass/README.md).
//
// Four stiff strings (E1 A1 D2 G2 on a 34-inch scale), each a sum of its transverse modes
//   f_n = n f₀ √(1 + B n²),   B = π³ E d⁴ / (64 T ℓ²)
// plucked from rest by a finger of some width at some distance from the bridge (the triangular
// shape's modal amplitudes, smoothed by the finger), losing energy at σ(f) = b₁ + b₃ f² (Chaigne and
// Askenfelt's form), heard by a magnetic pickup as the velocity of the string over its aperture, and
// then through the pickup's circuit into a cable and an interface (phuzzbox/pickup.h): the signal a
// passive bass gives an audio interface, in volts.
#pragma once

#include <array>
#include <vector>

#include "phuzzbox/pickup.h"

namespace testbass {

constexpr int kStrings = 4;
constexpr int kMaxModes = 160;

struct StringSpec {
  double f;     // open pitch (Hz)
  double core;  // steel core diameter (m)
  double T;     // tension (N)
};
// E1, A1, D2, G2 at A = 440 Hz; round-wound cores and tensions of a medium set
inline const StringSpec kStringSpecs[kStrings] = {
  {41.2034, 1.00e-3, 190}, {55.0, 0.85e-3, 200}, {73.4162, 0.65e-3, 190}, {97.9989, 0.50e-3, 170}};

struct Settings {
  double scale = 0.864;    // m: the scale length, nut to bridge (34 inches)
  double pluckAt = 0.12;   // m from the bridge
  double finger = 0.015;   // m: the finger's width
  double pickupAt = 0.16;  // m from the bridge (a P pickup's middle)
  double aperture = 0.02;  // m: the width the pickup hears
  double b1 = 1.0;         // 1/s: losses independent of frequency (air, the bridge)
  double b3 = 4.0e-6;      // s: losses growing as f² (the string's internal friction)
  double muted = 60;       // 1/s: σ of every mode under a muting hand
  double volts = 0.3;      // V of EMF per m/s of string velocity at the pickup (a passive bass peaks at a few hundred mV)
  phuzzbox::PickupCircuit circuit; // the pickup, its cable and the interface
};

// The string's inharmonicity coefficient, for a length ℓ (m)
double inharmonicity(const StringSpec &s, double length);
// The partials of a string at a fret: frequency (Hz) and decay rate (1/s), n = 1 …
struct Partial { double f, sigma, amp; };
std::vector<Partial> partials(const Settings &S, int string, int fret, double fs);

class Bass {
 public:
  explicit Bass(double fs);
  Settings settings;
  void applySettings(); // after changing settings
  void pluck(int string, int fret, double velocity); // velocity 0..1
  void mute(int string);
  // a note (MIDI key) on the string that plays it lowest on the neck; −1 if out of range
  int note(int key, double velocity);
  void noteOff(int key);
  void process(float *out, int n);

 private:
  struct Voice {
    int n = 0;
    double sigmaMuted = 0;
    bool muted = false;
    std::array<double, kMaxModes> re{}, im{}, cr{}, ci{}, cmr{}, cmi{}; // state; rotation e^(−σT+iωT); muted rotation
    int key = -1;
  };
  double fs;
  std::array<Voice, kStrings * 2> voices; // two per string: the last pluck rings out under the next
  std::array<int, kStrings> next{};
  phuzzbox::Biquad circuit;
};

} // namespace testbass
