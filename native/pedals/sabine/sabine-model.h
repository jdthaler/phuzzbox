// sabine-model.h — Sabine's Room: a shoebox room, L × W × H, the bass at one end and you d away.
//
//   the surfaces: absorption coefficients α in six octave bands, 125 Hz to 4 kHz (Hall's Table 15.1):
//   the walls and the ceiling of one material, the floor of another, the audience covering part of it
//   the air: ISO 9613-1's absorption at 20 °C, as an intensity attenuation m = α_dB/(10 log10 e) per metre
//   Sabine: T = 55.26 V/(c A), A = Σ S α + 4 m V, the absorption area; Eyring: T = 55.26 V/(c (−S ln(1 − ᾱ) + 4 m V))
//   the early sound: the direct path and the first 64 reflections, by Allen and Berkley's image
//   method: an image of the bass for each sequence of reflections, its pressure Π β^n / r with
//   β = √(1 − α) for each surface it reflects from n times, through the air's absorption
//   the late sound: the diffuse field, whose images arrive at a rate 4π c³ t²/V, each 1/(c t) strong,
//   so that its power is 4π c/V (relative to the direct sound at a metre), dying away at Eyring's rate
#pragma once

namespace sabine {

constexpr int kBands = 6;                 // octaves centred on 125, 250, 500, 1000, 2000, 4000 Hz
constexpr int kEarly = 64;                // reflections played one by one
constexpr int kSurfaces = 6;              // x = 0, x = L, y = 0, y = W, the floor, the ceiling
constexpr double kSabine = 55.262042231857; // 24 ln 10
constexpr double kSpeed = 343.2;          // c at 20 °C (m/s)
extern const double kCentres[kBands];

struct Parts {
  double L, W, H;                   // the room (m)
  double src[3], rcv[3];            // the bass and you (m)
  double d;                         // the distance between them (m)
  double alpha[kSurfaces][kBands];  // each surface's absorption coefficient
  double area[kSurfaces];           // each surface's area (m²)
  double m[kBands];                 // the air's attenuation (1/m, of intensity)
  double level;                     // the Level, as a gain
  double V() const { return L * W * H; }
  double S() const { return 2 * (L * W + L * H + W * H); }
  double A(int b) const;            // Sabine's absorption area, with the air's (m²)
  double sabine(int b) const;       // T60 (s)
  double eyring(int b) const;       // T60 (s)
};
Parts parts(const double *P);

double airAbsorption(double f, double rh); // ISO 9613-1 at 20 °C and sea level (dB/m)

struct Reflection {
  double r;              // its path (m)
  int order;             // how many times it reflects
  double gain[kBands];   // its pressure, relative to the bass's a metre away
};
// The direct sound and the first kEarly reflections, nearest first (kEarly + 1 entries), and the path
// of the reflection after them, where the late sound takes over. scratch: room for kMaxImages.
constexpr int kMaxImages = 20000;
double early(const Parts &p, Reflection *out, Reflection *scratch);

} // namespace sabine
