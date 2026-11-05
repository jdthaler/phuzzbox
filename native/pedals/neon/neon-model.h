// neon-model.h — the Neon Tremolo's physics: a neon lamp that flashes in a relaxation oscillator
// (Pearson and Anson's), and a cadmium-sulphide photocell, lit by the flashes, that pulls the
// signal down:
//
//   +Vs ──R──┬──────────┐
//            C        neon lamp ┄┄(light)┄┄► cell
//            ⏚          ⏚
//   in ──Rs──┬── out (× Level)
//          cell
//          Rd (Depth)
//            ⏚
//
// The capacitor charges through R toward the supply. The gas between the lamp's electrodes
// insulates until the field is strong enough for each electron to start an avalanche that
// replaces itself (Townsend), which happens at Paschen's breakdown voltage,
//
//   Vb = B pd / ln(A pd / ln(1 + 1/γ)),
//
// with p the gas's pressure, d the gap, A and B the gas's constants and γ the electrons each ion
// knocks out of the cathode. Struck, the lamp burns as a normal glow: a cathode fall that sets its
// own thickness, at the simple theory's least voltage, V0 = 3 (B/A) ln(1 + 1/γ), 3/e of the way above the
// curve's minimum, and behind it the lamp's own resistance r (GE's equivalent circuit, V = V0 + r i).
// The capacitor dumps its charge through it until the current falls below what holds the glow and
// it goes out. The flash's light is its current (the glow covers a share of the cathode in
// proportion to it).
//
// The light frees electrons in the cell, which recombine with each other as the Lamp Vibe's do:
//
//   dn/dt = Λ/τ − (n/τ)(1 + n),  Λ = i / Iref,  R = 1 / (1/Rdark + n/Rlit)
//
// and the cell, with the Depth pot in series, is the lower leg of a divider after Rs.
#pragma once

namespace neon {

constexpr int kGases = 3;
constexpr double kBallast = 5.5e3;  // Ω: the lamp's own resistance while lit (GE's NE-2, A1A)
constexpr double kHold = 50e-6;     // A: below this the glow goes out (GE: not to be run below 50 µA)
constexpr double kIref = 0.5e-3;    // A: the lamp current whose steady light holds the cell at Rlit
constexpr double kRlit = 5e3, kRdark = 1e6; // Ω: the cell
constexpr double kRs = 100e3;       // Ω: the series resistor ahead of the cell
constexpr double kPot = 1e6;        // Ω: the Depth pot, in series with the cell

// a gas: Townsend's α/p = A exp(−B p/E), in 1/(cm Torr) and V/(cm Torr) (Wang et al. 2022, Table I)
struct Gas { const char *name; double A, B; };
const Gas &gasOf(int k);

// Paschen's breakdown voltage at pd (Torr·cm); infinite left of the curve's asymptote, where no
// field is strong enough
double breakdown(const Gas &g, double pd, double gamma);
// the curve's minimum, e B/A ln(1 + 1/γ), at pd = e ln(1 + 1/γ)/A
double minimumV(const Gas &g, double gamma);
double minimumPd(const Gas &g, double gamma);
// the normal glow's cathode fall, 3 (B/A) ln(1 + 1/γ), where the lit lamp burns
double cathodeFall(const Gas &g, double gamma);

struct Parts {
  const Gas *gas;
  double pd, gamma;
  double Vs, R, C;       // the supply (V), the rate resistor (Ω), the capacitor (F)
  double Vb, Vm, Ve;     // the lamp strikes at Vb, burns from Vm, and goes out at Ve = Vm + r Ihold
  double tau;            // s: the cell's electrons' lifetime when dim
  double Rd;             // Ω: the Depth pot's resistance in series with the cell
  double gain;           // the Level, as a factor
};
Parts parts(const double *P);

// the oscillator: the capacitor's voltage, and whether the lamp is lit
struct Osc { double v = 0; bool lit = false; };

// the capacitor's voltage the lit lamp pulls toward, and its time constant then
double litTarget(const Parts &p);
double litTau(const Parts &p);
// the lamp's current with the capacitor at v (0 when out)
inline double current(const Parts &p, double v, bool lit) { return lit ? (v - p.Vm) / kBallast : 0; }
// whether it never strikes (Vs below Vb), and whether, once lit, it never goes out
inline bool neverStrikes(const Parts &p) { return !(p.Vs > p.Vb); }
bool glowsSteadily(const Parts &p);
// the period, charging from Ve to Vb and flashing from Vb to Ve (0 when it doesn't oscillate),
// and each part
double chargeTime(const Parts &p);
double flashTime(const Parts &p);
inline double period(const Parts &p) { return neverStrikes(p) || glowsSteadily(p) ? 0 : chargeTime(p) + flashTime(p); }

// advance the oscillator by dt, exactly (each stretch is an exponential, each switch found where
// it falls); returns the charge that passed through the lamp (C), and counts the strikes
double advance(const Parts &p, Osc &o, double dt, int *strikes = nullptr);

// the cell: its free electrons under a steady light, one step of them (Heun's method), its
// resistance, and the divider's gain with the cell at R
double steadyN(double light);
double cellStep(const Parts &p, double light, double n, double dt);
inline double cellR(double n) { return 1 / (1 / kRdark + n / kRlit); }
inline double divider(const Parts &p, double R) { return (R + p.Rd) / (kRs + R + p.Rd); }

} // namespace neon
