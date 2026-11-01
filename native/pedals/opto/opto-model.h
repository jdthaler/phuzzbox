// opto-model.h — the Opto Compressor's physics: an electroluminescent panel lit by a driver that
// listens to the signal, and a cadmium-sulphide photocell that shunts the signal to ground after a
// series resistor, as in the electro-optical leveling amplifiers of the 1960s (the T4 cell):
//
//   in ──[buffer]──┬── Rs 47 kΩ ──┬──[make-up gain]──┬── out
//                  │              │                  │
//                  │            cell R(n)            │
//                  │              ⏚                  │
//                  └──(input)──► driver ◄──(output)──┘   the Sense switch picks which it hears
//                                  │ ×Ad·k
//                                panel: light ∝ exp(−b/√|v|), with an afterglow τp
//                                  ⇣ (light)
//                                cell: free electrons n and trapped ones m
//
// The panel (an AC electroluminescent lamp) emits, at each instant, exp(−b (1/√|v| − 1/√Vref))
// relative to its glow at Vref = 100 V (the voltage law of powder electroluminescence), and its
// phosphor glows on with a time constant τp. The light Λ frees electrons in the cell, which
// recombine (with themselves too, so the response is sublinear) and fall into traps that let
// them go slowly (Rose's picture of a photoconductor, RCA Review 1951):
//
//   dn/dt = Λ/τ − (n/τ)(1 + n/n₁) − k n (N − m) + m/τe
//   dm/dt = k n (N − m) − m/τe
//
// n is in units of the free electrons the reference glow keeps in the cell (with n₁ = 1 that is
// the root of n(1 + n) = 1), so the cell's conductance is 1/Rdark + n/Rlit. A steady light leaves
// the traps in balance, and n where Λ = n(1 + n/n₁). The fast release is τ; the slow one is the
// traps emptying, over τe, into a cell that keeps recombining what they let go.
#pragma once

#include <cmath>

namespace opto {

constexpr double RS = 47e3;     // Ω: the series resistor ahead of the cell
constexpr double AD = 10000;    // the driver's voltage gain (80 dB), ahead of the Peak Reduction pot
constexpr double VREF = 100;    // V: the panel voltage whose glow is the reference
constexpr double N1 = 1;        // the free electrons at which recombination among them doubles the rate
constexpr double TRAPS = 2;     // N: the traps, in the same units as n
constexpr double CAPTURE = 1;   // k: 1/s per unit of n, how fast a free electron finds an empty trap

// everything the parameters set
struct Model {
  double kpr = 0.1;      // the Peak Reduction pot's fraction (audio taper)
  double b = 70;         // √V: the panel's voltage constant
  double tp = 1e-3;      // s: the phosphor's afterglow
  double swing = 150;    // V: the driver's swing
  double litR = 2e3, darkR = 5e6; // Ω: the cell
  double tau = 0.075, tauE = 2;   // s: the free electrons' lifetime, the traps'
  bool feedForward = false;
};
Model model(const double *P);

// the audio pot's fraction at x (the lower part, wiper to ground): (81^x − 1)/80, 10 % halfway
inline double audioTaper(double x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return (std::pow(81.0, x) - 1) / 80; }

// the voltage across the panel when the driver hears v
inline double drive(const Model &M, double v) {
  const double d = AD * M.kpr * v;
  return d > M.swing ? M.swing : d < -M.swing ? -M.swing : d;
}
// the panel's emission at a voltage v across it, relative to its glow at VREF
inline double emission(const Model &M, double v) {
  const double a = std::abs(v);
  return a < 1e-9 ? 0 : std::exp(-M.b * (1 / std::sqrt(a) - 1 / std::sqrt(VREF)));
}
// the attenuator's gain (Rs and the cell, as a divider) with n free electrons
inline double atten(const Model &M, double n) {
  const double rc = 1 / (1 / M.darkR + n / M.litR);
  return rc / (RS + rc);
}
// the free electrons a steady light Λ keeps in the cell, the traps in balance
inline double steadyN(double light) { return 0.5 * N1 * (std::sqrt(1 + 4 * light / N1) - 1); }

// the cell's rates
inline void rates(const Model &M, double light, double n, double m, double &dn, double &dm) {
  const double cap = CAPTURE * n * (TRAPS - m), rel = m / M.tauE;
  dn = light / M.tau - (n / M.tau) * (1 + n / N1) - cap + rel;
  dm = cap - rel;
}
// one step of dt (Heun's method; the fastest rate is far below 1/dt)
inline void cellStep(const Model &M, double light, double &n, double &m, double dt) {
  double a1, b1, a2, b2;
  rates(M, light, n, m, a1, b1);
  rates(M, light, n + dt * a1, m + dt * b1, a2, b2);
  n += 0.5 * dt * (a1 + a2);
  m += 0.5 * dt * (b1 + b2);
  if (n < 0) n = 0;
  if (m < 0) m = 0;
}

// The quasi-static gain for a steady sine of amplitude A at the input: the light is the panel's
// emission averaged over a cycle (the afterglow and the cell are slow beside it), and n its
// steady value, found by bisection where the light the attenuated signal makes keeps that n
// (feedback), or directly (feed-forward). Returns the attenuator's gain; n through nOut.
double quasiStatic(const Model &M, double A, double *nOut = nullptr);

} // namespace opto
