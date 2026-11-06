// radio-model.h — the Crystal Radio: your bass on the air as an AM station, received by a crystal set.
//
//   the transmitter: a carrier at the station's frequency fs, its amplitude Ac(1 + k·vin), held at
//   zero when k·vin < −1 (a plate-modulated transmitter can't swing its carrier below nothing)
//   the next station: an unmodulated carrier 10 kHz above, B = Ac·10^(N/20)
//   the tuned circuit: a coil and a capacitor resonant at f0 = fs + tuning, with quality factor Q,
//   whose response near f0 is H(f) = 1/(1 + 2iQ(f − f0)/f0)
//   the detector: a point-contact diode into the earphone's load R, bypassed by the capacitor C
//
// Everything is worked in the complex envelope about the station's carrier, x(t) = Re[e(t) e^{iωs t}]:
// the tuned circuit becomes the one-pole filter de/dt = −(γ − iΔ) e + γ u, γ = πf0/Q, Δ = 2π·tuning;
// and the detector sees the carrier's amplitude A = |e|. Over one cycle of the carrier (1 µs, far
// shorter than anything else here) the capacitor's voltage V barely moves, so the diode's current,
// averaged over the cycle, is
//
//   ⟨i⟩ = Is ⟨e^{(A cos θ − V)/nVT} − 1⟩ = Is (e^{−V/nVT} I0(A/nVT) − 1),
//
// I0 the modified Bessel function, and the earphone's voltage obeys C dV/dt = ⟨i⟩ − V/R. Held at
// a steady A, V settles where ⟨i⟩ = V/R: for A ≪ nVT, V ∝ A², the square law; for A ≫ nVT,
// V → A − nVT ln(√(2πA/nVT)(1 + V/(R Is))), a peak detector.
#pragma once

#include <complex>

namespace radio {

using cplx = std::complex<double>;
// a product of complex numbers without the library's care for infinities, which costs a call each
inline cplx mul(cplx a, cplx b) { return {a.real() * b.real() - a.imag() * b.imag(), a.real() * b.imag() + a.imag() * b.real()}; }

// a diode family (the Bandgap's): voltage at 1 mA at 25 °C, and ideality n
struct Family { const char *name; double v1mA, n; };
constexpr int kFamilies = 3;
const Family &family(int k);

constexpr double kNeighbour = 10e3; // the next station, above this one (Hz): the Americas' spacing

struct Parts {
  double Ac;        // the carrier's amplitude at the detector, tuned in (V)
  double k;         // the modulation: the depth per volt in (1/V)
  double fs;        // the station (Hz)
  double tune;      // the tuned circuit's resonance less the station (Hz)
  double Q;         // the tuned circuit's quality factor, loaded
  double B;         // the next station's carrier at the detector, were it tuned in (V)
  double R, C;      // the earphone's load (Ω) and the bypass capacitor (F)
  double is, nvt;   // the diode's saturation current (A) and n kT/q (V)
  double level;     // the Level, as a gain
  double gamma() const;  // γ = π f0 / Q (rad/s): the tuned circuit's half bandwidth
  double delta() const;  // Δ = 2π·tune (rad/s)
};
Parts parts(const double *P);

// the tuned circuit's response at f Hz from the station: 1/(1 + i(2πf − Δ)/γ)
cplx tank(const Parts &p, double f);

// I0(a) − 1 and e^{−v} I0(a) − 1 = the diode's mean current over Is, accurately for small a and v
double i0m1(double a);
double meanCurrent(const Parts &p, double A, double V); // ⟨i⟩ (A)
// the carrier's part of ⟨i⟩, worked out once for an amplitude A: a = A/nVT, and I0(a) − 1 (a below
// 12) or e^{−a} I0(a) (above), so that ⟨i⟩ at many V costs an exponential each
struct Drive { double a = 0, m1 = 0, scaled = 0; bool big = false; };
Drive drive(const Parts &p, double A);
double meanCurrent(const Parts &p, const Drive &d, double V);
// its derivative in V
double meanConductance(const Parts &p, double A, double V);

// the detector's steady voltage for a steady carrier A at the diode: ⟨i⟩(A, V) = V/R
double settle(const Parts &p, double A);
// its slope dV/dA at A
double slope(const Parts &p, double A);

// the carrier at the detector with nothing in, at the tuning: |γ Ac/(γ − iΔ)|
double restingAmplitude(const Parts &p);

// The set as it runs, at the step h: the tuned circuit's envelope e exactly for an input held between
// steps at the mean of the two steps' inputs, and the earphone's voltage V by the second-order
// backward difference (BDF2), which damps the diode's fast charging as it should rather than
// ringing, as the trapezoidal rule would at steps longer than its time constant.
struct Receiver {
  void start(const Parts &p, double h); // h: the step (s); at rest with the unmodulated carrier in
  void retune(const Parts &p);          // new parts, keeping the state
  // one step: u is the input to the tuned circuit at this step (V, complex about the station's carrier)
  double step(cplx u);
  cplx e = 0, u1 = 0;
  double A = 0, V = 0, V1 = 0;
  long iterations = 0, steps = 0;
  double h = 1e-5;
 private:
  Parts q{};
  cplx pole = 0, gain = 0;
  double G = 0;
};

} // namespace radio
