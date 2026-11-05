// transformer-model.h — the Output Transformer: a valve amplifier's output stage as a voltage source
// behind its plate resistance, driving the primary of a transformer whose iron core follows the
// Jiles–Atherton model of ferromagnetic hysteresis, loaded by the speaker reflected through it.
//
//   the source: Vs = Drive·vin behind Rs; the load: 4.2 kΩ, a 4 Ω speaker through the turns ratio
//   (Hammond's 1750L, a replacement for the 5F6-A Bassman's); together a Thévenin source
//   Vth = Vs RL/(Rs + RL) behind Rp = Rs ∥ RL across the primary
//   the core: N turns on a core of area A and magnetic path l; the field H = N i/l of the
//   magnetising current i, the flux density B = µ0 (H + M), and the primary's voltage
//   v = N A dB/dt = Vth − Rp i
//   the magnetisation: Jiles and Atherton's equation in its 1986 form, as Szewczyk (2018) and
//   Plucinski et al. (2025) write it:
//     dM/dH = δM (Man − M)/((1 + c)(δk − α(Man − M))) + c/(1 + c) dMan/dH,
//     Man = Ms L((H + αM)/a), L(x) = coth x − 1/x,
//   δ the sign of dH, and δM zero when Man − M and δ differ in sign (the magnetisation never moves
//   against the field). dMan/dH counts the field M itself adds: (Ms/a) L′ (1 + α dM/dH).
//
// The magnetising current is the core's nonlinearity: through Rp it takes from the voltage the
// speaker gets. A stiff source (small Rs) forces the flux whatever the current, and the speaker hears
// little of it; a soft one lets the core's loop into the sound.
#pragma once

namespace transformer {

// a core's Jiles–Atherton parameters (A/m, but α and c)
struct Core { const char *name; double Ms, a, alpha, k, c; };
constexpr int kCores = 3;
const Core &core(int k);
double initialSusceptibility(const Core &c); // dM/dH at H = M = 0: the reversible part's, c/(1 + c) of the anhysteretic's

constexpr double kTurns = 1500;  // the primary's turns
constexpr double kPath = 0.15;   // the core's magnetic path (m)
constexpr double kLoad = 4200;   // the speaker reflected to the primary (Ω): 1750L, 4.2 kΩ to 4 Ω
constexpr double kMu0 = 1.25663706212e-6;

struct Parts {
  const Core *core;
  double drive;   // the source's volts per volt in
  double Rs;      // the source's resistance, the output valves' plate resistance (Ω)
  double A;       // the core's cross-section (m²)
  double level;   // the Level, as a gain
  double divider() const { return kLoad / (Rs + kLoad); } // Vth per Vs
  double rp() const { return Rs * kLoad / (Rs + kLoad); }  // Rs ∥ RL (Ω)
};
Parts parts(const double *P);

double langevin(double x);      // L(x) = coth x − 1/x
double langevinSlope(double x); // L′(x)
double anhysteretic(const Core &c, double He); // Man (A/m)

// The magnetisation carried from (H, M) to the field H + dh, in substeps that move the effective
// field a tenth of the anhysteretic's scale: in each the anhysteretic is taken as linear in the
// effective field (its value and slope at the substep's start), and the JA equation, then linear,
// is solved exactly: the irreversible part relaxes toward the anhysteretic over the length
// (1 + c)(k − α|Man − M|)/β. Returns M at the end and, in slope, dM/dH there. Stable however long
// the step, which the core needs: past saturation the field swings thousands of A/m a cycle
// against a pinning field k of 0.6 to 50.
double advance(const Core &c, double H, double M, double dh, double &slope, int &substeps);

// The transformer stepped by the trapezoidal rule on the flux, Φ_n − Φ_{n−1} = (h/2)(v_n + v_{n−1}),
// with v = Vth − Rp l H/N: one equation in the field H, solved by Newton from the field extrapolated
// from the last two steps, inside a bracket found by doubling.
struct Transformer {
  double H = 0, M = 0, Hp = 0, v = 0;
  long evaluations = 0, substeps = 0, steps = 0; // for the tests: the core's evaluations, their substeps, steps taken
  void reset() { H = M = Hp = v = 0; }
  double step(const Parts &p, double vth, double h); // the primary's voltage after the step (V)
  double B() const { return kMu0 * (H + M); }
};

} // namespace transformer
