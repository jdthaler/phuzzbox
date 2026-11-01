// envelope-model.h — the Envelope Filter's physics: an envelope follower drives an LED, the LED
// lights two matched photocells, and the photocells are the resistors of a state-variable
// filter's two integrators, so the light sets the cutoff:
//
//   in ──┬──────────────► state-variable filter: two integrators, R(n) and C each ──► mode ──► out
//        │                    ▲ R = (cell ∥ R_floor) + R_min, both cells alike
//        └─► |·| ─► follower: C dv/dt = (|G·in| − v)/Ra·[|G·in| > v] − v/Rd
//                       │
//                       └─► LED: i = clamp(v/R_led, 0, 20 mA) (up), or 5 mA − v/R_led (down), R_led 220 Ω
//                                 ⇣ light Λ = i / 1 mA
//                               cells: free electrons n, trapped m (Rose; as the Opto's cell)
//
//   dn/dt = Λ/τ − (n/τ)(1 + n/n₁) − k n (N − m) + m/τe,  dm/dt = k n (N − m) − m/τe
//   1/R_cell = 1/R_dark + n/R_lit,  f_c = 1/(2π R C)
//
// The filter's three outputs, with ω = 1/(RC) and k = 1/Q set by its damping resistor, are the
// classic state-variable ones: low-pass ω²/(s² + kωs + ω²), band-pass ωs/(…), high-pass s²/(…).
#pragma once

#include <cmath>
#include <complex>

namespace envelope {

constexpr double PI = 3.141592653589793;
constexpr double R_LED = 220;     // Ω: the follower's volts into the LED through it
constexpr double I_MAX = 20e-3;   // A: the LED's most current
constexpr double I_REF = 1e-3;    // A: the current whose light is the unit of Λ
constexpr double I_DOWN = 5e-3;   // A: the LED's standing current in Down, which the follower subtracts from
constexpr double R_FLOOR = 33e3;  // Ω: across each cell: the filter's lowest cutoff, dark
constexpr double R_MIN = 1e3;     // Ω: in series with each cell: its highest
constexpr double DARK_R = 2e6;    // Ω: a cell in the dark
constexpr double N1 = 1;          // the free electrons at which recombination among them doubles the rate
constexpr double TRAPS = 2;       // N: the traps, in units of n
constexpr double CAPTURE = 1;     // k: 1/s per unit of n

struct Model {
  int mode = 1;          // 0 low-pass, 1 band-pass, 2 high-pass
  double q = 5, c = 47e-9;
  double gain = 10;      // the follower's gain
  bool down = false;
  double ta = 0.01, td = 0.15;
  double tau = 0.015, tauE = 0.5, litR = 5e3;
  double blend = 0, level = 1;
};
Model model(const double *P);

// the LED's light (in units of 1 mA's) for the follower's voltage v
inline double light(const Model &M, double v) {
  const double i = v / R_LED;
  double led = M.down ? I_DOWN - i : i;
  led = led < 0 ? 0 : led > I_MAX ? I_MAX : led;
  return led / I_REF;
}
// a cell's resistance with n free electrons, and the integrators' resistance it makes
inline double cellR(const Model &M, double n) { return 1 / (1 / DARK_R + n / M.litR); }
inline double filterR(const Model &M, double n) { const double r = cellR(M, n); return r * R_FLOOR / (r + R_FLOOR) + R_MIN; }
inline double cutoff(const Model &M, double n) { return 1 / (2 * PI * filterR(M, n) * M.c); }
// the free electrons a steady light keeps in the cells, the traps in balance: Λ = n(1 + n/n₁)
inline double steadyN(double L) { return 0.5 * N1 * (std::sqrt(1 + 4 * L / N1) - 1); }

inline void rates(const Model &M, double L, double n, double m, double &dn, double &dm) {
  const double cap = CAPTURE * n * (TRAPS - m), rel = m / M.tauE;
  dn = L / M.tau - (n / M.tau) * (1 + n / N1) - cap + rel;
  dm = cap - rel;
}
// one step of dt by Heun's method (the fastest rate, (1 + 2n)/τ, stays far below 1/dt)
inline void cellStep(const Model &M, double L, double &n, double &m, double dt) {
  double a1, b1, a2, b2;
  rates(M, L, n, m, a1, b1);
  rates(M, L, n + dt * a1, m + dt * b1, a2, b2);
  n += 0.5 * dt * (a1 + a2);
  m += 0.5 * dt * (b1 + b2);
  if (n < 1e-30) n = 0;
  if (m < 1e-30) m = 0;
}
// the follower's exact step for a sample with its rectified input r held: charging through Ra
// with Rd across, or discharging through Rd
inline double follow(double v, double r, double ca, double va, double cd) {
  return r > v ? va * r + (v - va * r) * ca : v * cd;
}

// the filter's analog response at f for cutoff fc, the mode's output, before the blend
std::complex<double> filterResponse(const Model &M, double fc, double f);

} // namespace envelope
