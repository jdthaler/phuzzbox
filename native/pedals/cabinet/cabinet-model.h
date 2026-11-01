// cabinet-model.h — the Speaker Cabinet's physics: each driver a voice coil in a magnet's gap
// (resistance Re, inductance Le, force factor Bl) driving a cone (mass Mms on a suspension of
// stiffness Kms with friction Rms), the air in its share of the box behind it (a spring), and, in a
// ported box, the air in its share of the ports (a mass) — the lumped circuit of Thiele and Small:
//
//   Le di/dt = e − (Re + Rg) i − Bl(x) u                  the coil, the amp behind it, the back EMF
//   Mms du/dt = Bl(x) i − Rms u − K(x) x + Sd p           the cone (x outward, u = dx/dt)
//   Cab dp/dt = −(Sd u + Sp up + p/Ra)                    the box's air: compressed as the cone goes in
//   Mp dup/dt = Sp p                                      the port's air, pushed out by the box's
//
// Cab = Vb/(ρc²) is the box's acoustic compliance, Mp = ρ Sp Leff the port's air (Leff its length
// with an end correction), Ra the box's leaks and absorption (a loss QL = 7 at the port's tuning).
// The drive parameters are Thiele–Small's (Fs, Qes, Qms, Vas, Re, Le, Sd), from which
//   Cms = Vas/(ρc² Sd²), Mms = 1/((2πFs)² Cms), Bl = √(2πFs Mms Re/Qes), Rms = 2πFs Mms/Qms.
//
// Large excursions leave the linear region: the coil leaves the gap and the suspension stiffens,
//   Bl(x) = Bl/(1 + (x/(2.13 Xmax))²)   (82 % of Bl at Xmax)
//   K(x)  = Kms (1 + (x/(1.5 Xmax))²)   (twice as stiff at 1.5 Xmax)
//
// Identical drivers wired s in series and p in parallel each get the amp's voltage over s through
// Rg·p/s, share the box and the ports equally, and add their sound: the cabinet is one driver in
// its share of the box, N = s·p times over. The microphone, 1 m away on the axis of a cabinet on
// the floor (radiating into half space), hears p = N ρ/(2π r) d/dt(Sd u + Sp up).
#pragma once

#include <complex>

namespace cabinet {

constexpr double RHO = 1.204, C = 343.0; // air at 20 °C: kg/m³, m/s
constexpr double RC2 = RHO * C * C;
constexpr double QL = 7;                 // the box's losses at the port's tuning
constexpr double END = 1.463;            // a port's end corrections, in radii (one flanged end, one free)
constexpr double MIC_R = 1;              // m: the microphone's distance
constexpr double PI = 3.141592653589793;

struct Model {
  // per driver
  double re = 5.6, le = 0.8e-3, bl = 13, mms = 0.04, kms = 3000, rms = 2, sd = 0.035, xmax = 4e-3;
  double rg = 0.05;      // the amp's output impedance as one driver sees it, Rg·p/s
  double perVolt = 0.5;  // a driver's share of the amp's voltage, 1/s
  int n = 8;             // drivers
  // per driver's share of the box
  double cab = 1e-7, mp = 0, sp = 0, ra = 1e300;
  bool ported = false;
  double fb = 0;         // Hz: the port's tuning (Helmholtz), 0 sealed
  double gain = 40;      // the power amp's voltage gain
  double mic = 0.015;    // V/Pa
};
Model model(const double *P);

inline double blAt(const Model &M, double x) { const double r = x / (2.13 * M.xmax); return M.bl / (1 + r * r); }
inline double kAt(const Model &M, double x) { const double r = x / (1.5 * M.xmax); return M.kms * (1 + r * r); }

// The state of one driver and its share of the box: coil current, cone excursion and velocity,
// the box's pressure, the port air's velocity.
struct State { double i = 0, x = 0, u = 0, p = 0, up = 0; };
// the rates at a state with e across the coil (from the amp, before Rg)
State rates(const Model &M, const State &s, double e);

// The small-signal response at f (Hz): out/in for the whole pedal (the microphone's volts per volt
// at the input), the cabinet's impedance as the amp sees it (Ω), and the cone's excursion per volt
// at the input (m/V).
struct Response { std::complex<double> h, z, x; };
Response response(const Model &M, double f);

} // namespace cabinet
