// bandgap-model.cpp — the Bandgap's circuit (bandgap-model.h).

#include "bandgap-model.h"

#include <algorithm>
#include <cmath>

#include "bandgap-params.h"

namespace bandgap {

namespace {
constexpr double kQ = 1.602176634e-19, kK = 1.380649e-23; // the electron's charge (C), Boltzmann's constant (J/K)
constexpr double kH = 6.62607015e-34, kC = 299792458.0;   // Planck's constant (J s), the speed of light (m/s)
constexpr double kPi = 3.14159265358979323846;
// an LED's voltage at 1 mA: the photon energy hc/λ in volts less 0.2 V, as small LEDs light up a
// little below it (the classroom measurement of Planck's constant rests on that)
constexpr double led(double lambda) { return kH * kC / (lambda * kQ) - 0.2; }

const Family kTable[kFamilies] = {
  {"Germanium", 0.28, 1.6, 0.66, 3, 0},       // a point-contact germanium diode
  {"Schottky", 0.32, 1.05, 0.60, 2, 0},       // metal on silicon: thermionic emission over a 0.60 eV barrier
  {"Silicon", 0.58, 1.75, 1.12, 3, 0},        // a small-signal silicon diode
  {"Red LED", led(630e-9), 2.0, kH * kC / (630e-9 * kQ), 3, 630e-9},
  {"Green LED", led(525e-9), 2.0, kH * kC / (525e-9 * kQ), 3, 525e-9},
  {"Blue LED", led(465e-9), 2.0, kH * kC / (465e-9 * kQ), 3, 465e-9},
};

// an op-amp: gain–bandwidth product (Hz), slew rate (V/s), and how close its output gets to each rail (V)
struct OpAmp { double gbw, sr, headroom; };
const OpAmp kOpAmps[3] = {
  {1.0e6, 0.3e6, 1.5}, // LM308 with 30 pF compensation
  {1.0e6, 0.5e6, 1.5}, // µA741
  {3.0e6, 13e6, 1.5},  // TL072
};

// a family's saturation current at temperature T (K): from its voltage at 1 mA at T0, and as
// I_s(T) = I_s(T0) (T/T0)^(XTI/n) exp((E/(n k))(1/T0 − 1/T))
double saturation(const Family &f, double T) {
  const double vt0 = kK * kT0 / kQ;
  const double is0 = 1e-3 / std::expm1(f.v1mA / (f.n * vt0));
  return is0 * std::pow(T / kT0, f.xti / f.n) * std::exp((f.eg * kQ / (f.n * kK)) * (1 / kT0 - 1 / T));
}
// the drive pot's audio taper: 10 % of its resistance at half way
double taper(double x) { return (std::pow(100.0, x) - 1) / 99; }
} // namespace

const Family &family(int k) { return kTable[std::clamp(k, 0, kFamilies - 1)]; }

double Stack::current(double v, double &slope) const {
  if (count == 0) { slope = 0; return 0; }
  const double s = count * nvt;
  // past 10 A (the circuit never gets near it) the exponential carries on as its tangent there,
  // so Newton's steps stay finite
  const double u = v / s;
  if (u < -40) { slope = 0; return -is; } // reversed: the saturation current, and e^u < 1e-17
  if (u > cap) { const double e = std::exp(cap); slope = is * e / s; return is * (e - 1) + slope * (v - cap * s); }
  const double e = std::exp(u);
  slope = is * e / s;
  return is * (e - 1);
}
double Stack::voltageAt(double i) const { return count ? count * nvt * std::log1p(i / is) : INFINITY; }

Parts parts(const double *P) {
  Parts p{};
  p.Rf = 100 + 100e3 * taper(P[drive]);
  p.Cf = 100e-12;
  p.Rg = 1e3;
  p.Cg = P[lowCut];
  p.Rt = 1e3 + 100e3 * P[filter];
  p.Cd = 3.3e-9;
  const OpAmp &a = kOpAmps[std::clamp((int)std::lround(P[opamp]), 0, 2)];
  p.GBW = a.gbw;
  p.SR = a.sr;
  p.Vs = a.sr / (2 * kPi * a.gbw);
  p.rail = P[supply] / 2 - a.headroom;
  p.diodes = std::clamp((int)std::lround(P[diodes]), 0, kFamilies);
  const double T = P[temp] + 273.15;
  const int per = (int)std::lround(P[perSide]); // 0 one each way, 1 two, 2 one up and two down
  for (Stack *s : {&p.up, &p.down}) {
    if (p.diodes == kFamilies) { s->count = 0; continue; }
    const Family &f = kTable[p.diodes];
    s->is = saturation(f, T);
    s->nvt = f.n * kK * T / kQ;
    s->count = per == 1 ? 2 : (per == 2 && s == &p.down) ? 2 : 1;
    s->cap = std::log(10 / s->is);
  }
  p.gain = std::pow(10.0, P[level] / 20);
  return p;
}

void derivatives(const Parts &p, const double *y, double vin, double *f, double *J, double *id) {
  const double x = y[0], vf = y[1], vg = y[2], vd = y[3], u = x - vf;
  for (int k = 0; k < 16; k++) J[k] = 0;
  // the op-amp: tanh of the input pair; and its output stage, which can't pass the rail: past it,
  // a pull back that grows as e^(overshoot / 10 mV), so the output stops within a few millivolts
  // of the rail and comes straight off it (softplus: smooth, and nothing 0.2 V inside the rail)
  const double e = vin - u, th = std::tanh(e / p.Vs), dth = (1 - th * th) / p.Vs;
  const double soft = 0.01, over = (std::fabs(x) - p.rail) / soft;
  double sp = 0, sig = 0; // nothing to compute 0.4 V inside the rail, where e^over < 1e-17
  if (over > 30) { sp = over; sig = 1; } else if (over > -40) { const double ex = std::exp(over); sp = std::log1p(ex); sig = ex / (1 + ex); }
  f[0] = p.SR * (th - (x >= 0 ? sp : -sp));
  J[0 * 4 + 0] = -p.SR * dth - p.SR * sig / soft;
  J[0 * 4 + 1] = p.SR * dth;
  // vf: Cf dvf/dt = (u − vg)/Rg − vf/Rf  (the current through Rg is what Rf and Cf carry from x)
  f[1] = ((u - vg) / p.Rg - vf / p.Rf) / p.Cf;
  J[1 * 4 + 0] = 1 / (p.Rg * p.Cf);
  J[1 * 4 + 1] = (-1 / p.Rg - 1 / p.Rf) / p.Cf;
  J[1 * 4 + 2] = -1 / (p.Rg * p.Cf);
  // vg: Cg dvg/dt = (u − vg)/Rg
  f[2] = (u - vg) / (p.Rg * p.Cg);
  J[2 * 4 + 0] = 1 / (p.Rg * p.Cg);
  J[2 * 4 + 1] = -1 / (p.Rg * p.Cg);
  J[2 * 4 + 2] = -1 / (p.Rg * p.Cg);
  // vd: Cd dvd/dt = (x − vd)/Rt − I(vd), I(vd) = I_up(vd) − I_down(−vd)
  double s1, s2;
  const double i = p.up.current(vd, s1) - p.down.current(-vd, s2);
  *id = i;
  f[3] = ((x - vd) / p.Rt - i) / p.Cd;
  J[3 * 4 + 0] = 1 / (p.Rt * p.Cd);
  J[3 * 4 + 3] = (-1 / p.Rt - s1 - s2) / p.Cd;
}

std::complex<double> response(const Parts &p, double f) {
  using C = std::complex<double>;
  const C s(0, 2 * kPi * f);
  // the feedback: Zf = Rf ∥ Cf from the output to u, Zg = Rg + 1/(s Cg) from u to ground
  const C Zf = p.Rf / (1.0 + s * p.Rf * p.Cf), Zg = p.Rg + 1.0 / (s * p.Cg);
  const C beta = Zg / (Zg + Zf), A = 2 * kPi * p.GBW / s;
  const C x = A / (1.0 + A * beta);
  // the diodes' small-signal conductance at 0 V, both ways
  double s1 = 0, s2 = 0;
  p.up.current(0, s1);
  p.down.current(0, s2);
  const C Yd = s * p.Cd + (s1 + s2);
  return x / (1.0 + p.Rt * Yd);
}

} // namespace bandgap
