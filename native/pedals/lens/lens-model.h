// lens-model.h — the Gravitational Lens's physics: your bass, as a wave from a source far behind a
// point mass M, bent round it on its way to you (Einstein 1936; Refsdal 1964; for waves Deguchi and
// Watson 1986, Takahashi and Nakamura 2003).
//
// Lengths in the lens plane are in Einstein radii, the source's offset from the line through the
// lens is y (u in Paczyński's notation), and times are in units of 4GM_z/c³, M_z = M(1 + z_L) the
// lens's redshifted mass (4GM☉/c³ = 19.70 µs). A path through the lens plane at x arrives at
//
//   T(x) = |x − y|²/2 − ln|x|,
//
// the geometric delay of the bent path less the Shapiro delay of passing the mass. Fermat's
// principle puts the rays where T is stationary: a minimum at x₊ = (y + √(y² + 4))/2 on the source's
// side and a saddle at x₋ = (y − √(y² + 4))/2 on the other, magnified μ± = 1/2 ± (y² + 2)/(2y√(y²+4))
// (μ₋ < 0: the saddle's image is mirrored).
//
// The wave sums every path (Kirchhoff, or Feynman), F(w) = (w/2πi) ∫ d²x e^{iwT(x)}, w = 2πf·4GM_z/c³.
// Grouped by arrival time the sum is F(w) = (w/2πi) ∫ A'(τ) e^{iwτ} dτ, A(τ) the area of the lens
// plane that arrives before τ, and twice by parts,
//
//   F(w) = ∫ h(τ) e^{iwτ} dτ,  h(τ) = A''(τ)/2π:
//
// the lens's impulse response is the second derivative of that area. A grows from nothing at the
// minimum (as an ellipse, so h starts with a spike √μ₊), turns a corner at the saddle (where h
// swings through ∓1/(π(τ − T₋)) √|μ₋|, a Hilbert transform), and far out grows as 2πτ + π ln 2τ…, so
// h ends in a tail −1/(2τ²) that carries the long waves round the lens: F(0) = 1.
#pragma once

#include <complex>
#include <vector>

namespace lens {

constexpr double kGMsun = 1.3271244e20; // m³/s²: IAU 2015 Resolution B3's nominal solar mass parameter
constexpr double kC = 299792458;        // m/s
constexpr double kUnitSun = 4 * kGMsun / (kC * kC * kC); // s: 4GM☉/c³, 19.70 µs

// the two images of a source at y: positions (Einstein radii, + on the source's side), arrival
// times (units of 4GM_z/c³) and magnifications (μ₋ < 0)
struct Images { double y, xp, xm, Tp, Tm, mup, mum; };
Images images(double y);

// the area of the lens plane (Einstein radii²) whose paths arrive before τ
double area(double tau, double y);

enum Optics : int { kWaves = 0, kRays = 1 };

struct Parts {
  double mass = 100, z = 0, y = 0.5;
  double unit = 0;  // s: 4GM(1 + z)/c³
  Images im{};
  double delay = 0; // s: the second image after the first
  double magnification = 0; // |μ₊| + |μ₋|, Paczyński's A(u)
  int optics = kWaves;
  double gain = 1;
};
Parts parts(const double *P);

// the lens's response at f (Hz) in geometric optics, the two images alone (Takahashi and
// Nakamura's eq. 18), as the engine hears it: e^{−iωt}, the first image at t = 0
std::complex<double> geometric(const Parts &p, double f);

// Geometric optics, causally. The saddle's image is the minimum's Hilbert-transformed: every
// frequency turned a quarter cycle, which reaches back before the first image arrives and so can't
// be heard as it stands. As frequency shifters do, each image goes instead through its own chain
// of first-order allpass sections, the two chains' phases a quarter cycle apart (90° ± 0.4° from
// 12 Hz to 120 kHz, the poles found here by minimising the largest error): the images keep their
// sizes and their relative phase, and share a phase that bends with frequency (the bass's lowest
// notes a little behind its treble: 7 ms at the open E), which the ear barely hears in a
// single image.
constexpr int kRaySections = 7;
// the analog poles (Hz): the minimum's chain, then the saddle's
constexpr double kRayPolesA[kRaySections] = {4.416108, 36.09546, 165.1913, 756.7674, 3488.448, 16251.79, 83700.46};
constexpr double kRayPolesB[kRaySections] = {15.77205, 77.52404, 353.0363, 1622.731, 7511.291, 35653.89, 302962.1};
// a chain's coefficients at fs: each section (a − s)/(a + s), by the bilinear transform,
// y = −c x + x₋₁ + c y₋₁
void rayCoefficients(const double (&poles)[kRaySections], double fs, double (&c)[kRaySections]);
// a chain's response at f (Hz)
std::complex<double> rayChain(const double (&c)[kRaySections], double f, double fs);
// the rays' response as the engine plays it at fs: the minimum's image through chain A, the
// saddle's through chain B after the delay (both kRayLead samples late)
constexpr int kRayLead = 8;
std::complex<double> rayResponse(const Parts &p, double f, double fs);

// The kernel the engine convolves with: the impulse response sampled at fs, from the first image
// on. Built a little at a time (work()), so that a change of the lens never holds up the audio.
//
// Waves: hₙ = (A(τₙ + Δ) − 2A(τₙ) + A(τₙ − Δ))/(2πΔ), τₙ = T₊ + nΔ, Δ = 1/(fs · 4GM_z/c³): A''/2π
// averaged over a triangle two samples wide, which is exact for the spike and draws the rest as a
// straight line between samples. Away from the images h is smooth on the scale of its distance from
// them, so it is worked out exactly only at taps a tenth of that distance apart (every tap near
// an image) and by cubic interpolation between. Its tail is cut once the lowest note's waves have
// been carried (10/w at 20 Hz, at least 8 units past the saddle), faded out over its last quarter,
// and the long-wave part it leaves out put back there, so the kernel passes DC exactly once, as
// F(0) = 1.
//
// (Rays, geometric optics, are not a kernel but two paths: see RayPair.)
class Kernel {
 public:
  void reserve(int cap); // room for kernels of up to cap taps (the engine's, up front)
  void start(const Parts &p, double fs, int cap); // begin a kernel for these parts
  bool work(int evals); // evaluate up to evals more areas; true when the kernel is complete
  bool done() const { return state == finished; }
  int length() const { return n; }
  int evaluations() const { return (int)at.size(); } // the areas this kernel takes
  const std::vector<double> &taps() const { return h; }
  bool every = false; // work out every tap exactly (for the tests)

 private:
  void finish();
  enum { idle, building, finished } state = idle;
  Parts p{};
  double D = 0; // Δ, the step in units of 4GM_z/c³
  int n = 0, next = 0;
  std::vector<int> pts, at; // the taps worked out exactly; the areas they need, A(τₖ) at k = at[i]
  std::vector<double> A, h;
};

// the kernel's length for these parts: the images, then the tail
int kernelLength(const Parts &p, double fs, int cap);

} // namespace lens
