// testbass.h — a bass guitar and a guitar made of physics, so the tests, the demos and a page with
// nothing plugged in have a signal to put through the pedals without a recording
// (testbass/README.md, testguitar/README.md).
//
// Stiff strings (the bass's E1 A1 D2 G2 on a 34-inch scale, the guitar's E2 A2 D3 G3 B3 E4 on a
// 25.5-inch one), each a sum of its transverse modes
//   f_n = n f₀ √(1 + B n²),   B = π³ E d⁴ / (64 T ℓ²)
// plucked from rest by a finger or a pick of some width at some distance from the bridge (the
// triangular shape's modal amplitudes, smoothed by its width), losing energy at σ(f) = b₁ + b₃ f²
// (Chaigne and Askenfelt's form), heard by a magnetic pickup as the velocity of the string over its
// aperture, and then through the pickup's circuit into a cable and an interface
// (phuzzbox/pickup.h): the signal a passive bass or guitar gives an audio interface, in volts.
#pragma once

#include <array>
#include <vector>

#include "phuzzbox/pickup.h"

namespace testbass {

constexpr int kMaxStrings = 6;
constexpr int kMaxModes = 160;

struct StringSpec {
  double f;     // open pitch (Hz)
  double core;  // steel core diameter (m): the whole string, for a plain one
  double T;     // tension (N)
  int key;      // the open string's MIDI key
};
// E1, A1, D2, G2 at A = 440 Hz; round-wound cores and tensions of a medium set
inline const StringSpec kBassStrings[4] = {
  {41.2034, 1.00e-3, 190, 28}, {55.0, 0.85e-3, 200, 33}, {73.4162, 0.65e-3, 190, 38}, {97.9989, 0.50e-3, 170, 43}};
// E2, A2, D3, G3, B3, E4: a 10–46 set, its tensions as D'Addario lists them for a 25.5-inch scale
// (17.0, 19.0, 18.4, 16.6, 15.4 and 16.2 lb); the three wound strings' cores typical, the plain
// strings' their gauges (0.017, 0.013, 0.010 inch)
inline const StringSpec kGuitarStrings[6] = {
  {82.4069, 0.46e-3, 75.6, 40}, {110.0, 0.40e-3, 84.5, 45}, {146.832, 0.33e-3, 81.8, 50},
  {195.998, 0.432e-3, 73.8, 55}, {246.942, 0.330e-3, 68.5, 59}, {329.628, 0.254e-3, 72.1, 64}};

enum class Kind { bass = 0, guitar = 1 };

struct Settings {
  Kind kind = Kind::bass;
  int strings = 4;
  std::array<StringSpec, kMaxStrings> spec{};
  double scale = 0.864;    // m: the scale length, nut to bridge (34 inches)
  double pluckAt = 0.12;   // m from the bridge
  double finger = 0.015;   // m: the width of what plucks (a finger, a pick)
  double pull = 2.0e-3;    // m: how far a firm pluck pulls the string
  double pickupAt = 0.16;  // m from the bridge (a P pickup's middle)
  double aperture = 0.02;  // m: the width the pickup hears
  double b1 = 1.0;         // 1/s: losses independent of frequency (air, the bridge)
  double b3 = 4.0e-6;      // s: losses growing as f² (the string's internal friction)
  double muted = 60;       // 1/s: σ of every mode under a muting hand
  bool fretless = false;   // a slide glides (a fretless bass, a slide bar on a guitar); fretted, it steps fret by fret
  double volts = 0.3;      // V of EMF per m/s of string velocity at the pickup (a passive bass peaks at a few hundred mV)
  phuzzbox::PickupCircuit circuit; // the pickup, its cable and the interface
};
// The two instruments as built: the bass (a P pickup, 3.6 H and 10.5 kΩ, played with a finger) and
// the guitar (a single coil of 2.5 H and 6 kΩ in the middle position, played with a pick)
Settings bassSettings();
Settings guitarSettings();

// The string's inharmonicity coefficient, for a length ℓ (m)
double inharmonicity(const StringSpec &s, double length);
// The partials of a string at a fret: frequency (Hz) and decay rate (1/s), n = 1 …, and the
// amplitude the pickup hears per metre of pull (amp = a ω heard)
struct Partial { double f, sigma, amp; };
std::vector<Partial> partials(const Settings &S, int string, int fret, double fs);
// A string stopped at a fractional fret (a slide passing through): its length, and each mode's
// frequency and decay, and what the pickup makes of its displacement (ω × the aperture's view)
double stoppedLength(const Settings &S, double fret);
struct Mode { double f, sigma, heard; };
Mode mode(const Settings &S, int string, double length, int n);

class Instrument {
 public:
  explicit Instrument(double fs, Kind kind = Kind::bass);
  Settings settings;
  void use(Kind kind);  // become the bass or the guitar as built (silences what rings)
  void applySettings(); // after changing settings
  void pluck(int string, int fret, double velocity); // velocity 0..1
  void mute(int string);
  // a note (MIDI key) on the string that plays it lowest on the neck; −1 if out of range
  int note(int key, double velocity);
  void noteOff(int key);
  // the finger, still pressing, moves along the string to a fret (fractional is fine) over some
  // seconds, at a steady speed along the neck: the last note plucked on that string follows it
  void slide(int string, double fret, double seconds);
  void process(float *out, int n);

 private:
  struct Voice {
    int n = 0;
    double sigmaMuted = 0;
    bool muted = false;
    // state (each mode's displacement, as a phasor, in volts per unit gain); rotation e^(−σT+iωT);
    // muted rotation; gain (what the pickup makes of the displacement: ω × its view of the mode)
    std::array<double, kMaxModes> re{}, im{}, cr{}, ci{}, cmr{}, cmi{}, gain{};
    int key = -1;
    // the finger: where it is (in frets), where a slide goes, and the stopped fret now sounding
    int string = 0;
    double at = 0, from = 0, to = 0, pitch = 0;
    long t = 0, dur = 0;
    bool sliding = false;
  };
  void retune(Voice &V, double pitch); // the modes of the string stopped at a (fractional) fret
  double fs;
  std::array<Voice, kMaxStrings * 2> voices; // two per string: the last pluck rings out under the next
  std::array<int, kMaxStrings> next{};
  phuzzbox::Biquad circuit;
};
using Bass = Instrument;

} // namespace testbass
