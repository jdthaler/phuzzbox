// tunnel-model.h — the Tunnel Diode: Esaki's diode, whose current falls as its voltage rises, made a
// switch with memory by a load resistor, or a relaxation oscillator by an inductor.
//
//   the diode: Sze's sum of three currents, I(V) = Ip (V/Vp) e^{1 − V/Vp} (tunnelling, empirical)
//              + Jx e^{C4 (V − Vv)} (the excess current through states in the gap) + I0 (e^{V/VT} − 1)
//              (diffusion, an ordinary junction's), fitted to a 1 mA germanium diode: its valley at
//              Vv = 350 mV, Iv = 0.1 mA, and Ip again at Vfp = 500 mV; 5 pF across it
//   the circuit: the source Vs = Bias + Drive·vin through the load R (and, in the oscillator, the
//              inductor L) into the diode: L di/dt = Vs − R i − V, C dV/dt = i − I(V)
//
// Between the peak and the valley the diode's resistance is negative (−152 Ω at its steepest). A
// load steeper than that (R > 152 Ω) crosses the curve three times for a range of Vs: the middle
// crossing is unstable and the outer two are the switch's states, low (under Vp) and high (over
// Vv). The diode stays in its state until Vs carries it past the peak or the valley, then jumps in
// a few nanoseconds (RC with 5 pF): a Schmitt trigger. With the inductor and a load under 152 Ω,
// biased so the load line crosses in the negative region, nothing is stable: the current ramps
// through L along one branch until it runs off the peak or the valley, the voltage jumps across, and
// it ramps back: a relaxation oscillator.
#pragma once

namespace tunnel {

constexpr double kC = 5e-12; // the diode's capacitance (F): GE's typical 1 mA diode

// the diode, fitted (diode()) to its peak, valley and forward points
struct Diode {
  double Ip, Vp, Iv, Vv, Vfp; // the points it is fitted to (A, V)
  double I0, Jx, C4;          // diffusion's saturation current (A), the excess current's (A) and slope (1/V)
  double Vm, gmin;            // where the negative slope is steepest (V), and that slope (S)
  double current(double V) const;
  double slope(double V) const; // dI/dV (S)
  double both(double V, double &dI) const; // the current, and its slope in dI, for the price of one
};
const Diode &diode();

struct Parts {
  bool osc;         // the oscillator: the inductor in series with the load
  double drive;     // Vs per volt in
  double bias;      // Vs at rest (V)
  double R;         // the load (Ω)
  double L;         // the inductor (H), in the oscillator
  double level;     // the Level, as a gain
};
Parts parts(const double *P);

// the circuit, stepped by backward Euler (h, s); its state is the diode's voltage and the current
// through the load. The step's equation for V is solved from where V was in the direction it is
// moving: marching to the first sign change, then Newton kept inside it, so the diode stays in its
// state (the root nearest it) until that root is gone, and then jumps to the next one along.
struct Circuit {
  double V = 0, i = 0, h = 0;
  long evaluations = 0, steps = 0; // for the tests: the diode's current computed, the steps taken
  // at rest: the switch on its low branch at Vs = vs (the high one if there is no low one); the
  // oscillator, which has no rest, switched on with nothing yet through its inductor
  void start(const Parts &p, double vs, double h);
  double step(const Parts &p, double vs);          // the diode's voltage after a step to Vs = vs
};

// the switch's thresholds for the load R: Vs = V + R I(V) at its local maximum (up) and local
// minimum (down), where the load line is tangent to the curve; up < 0 when R ≤ |1/gmin| (no memory)
void thresholds(double R, double &up, double &down);
// the static states at Vs: the low branch's (lo) and the high branch's (hi), NaN where there is none
void states(double R, double vs, double &lo, double &hi);

} // namespace tunnel
