// cable-model.cpp — the Transatlantic Cable's physics (cable-model.h).

#include "cable-model.h"

#include <algorithm>
#include <cmath>

#include "cable-params.h"

namespace cable {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kEps0 = 8.8541878128e-12, kMu0 = 1.25663706212e-6;
constexpr double kCopperRho = 1.72e-8;   // Ω·m: annealed copper
constexpr double kCopperDensity = 8960;  // kg/m³
constexpr double kGuttaDensity = 980;    // kg/m³: gutta-percha
constexpr double kGuttaEps = 3.0;        // gutta-percha's relative permittivity, taken as 3
constexpr double kBattery = 5;           // Ω: a telegraph battery and key
using cd = std::complex<double>;

// A telephone exchange cable's pair of 0.4 mm (26-gauge) copper wires: 274 Ω/km round the loop,
// and the 0.6 mH/km and 52 nF/km typical of such a pair.
const Cable kPair{"Telephone pair, 0.4 mm", 2 * kCopperRho / (kPi * 0.2e-3 * 0.2e-3), 0.6e-6, 52e-12, 1e-12, 600};

// the ABCD matrix of a two-port, and its products
struct Abcd { cd a, b, c, d; };
Abcd operator*(const Abcd &x, const Abcd &y) { return {x.a * y.a + x.b * y.c, x.a * y.b + x.b * y.d, x.c * y.a + x.d * y.c, x.c * y.b + x.d * y.d}; }
Abcd series(cd z) { return {1.0, z, 0.0, 1.0}; }
Abcd shunt(cd y) { return {1.0, 0.0, y, 1.0}; }
Abcd line(const Cable &c, double len, double f) {
  const cd g = gamma(c, f) * len, z = z0(c, f);
  return {std::cosh(g), z * std::sinh(g), std::sinh(g) / z, std::cosh(g)};
}
Abcd power(Abcd x, int n) {
  Abcd r{1.0, 0.0, 0.0, 1.0};
  for (; n; n >>= 1, x = x * x) if (n & 1) r = r * x;
  return r;
}
// the far end's voltage over the source's for a two-port between the source and load resistances
cd transfer(const Abcd &m, double zs, double zl) { return zl / (m.a * zl + m.b + zs * (m.c * zl + m.d)); }
} // namespace

Cable submarine(const char *name, double mc, double mg) {
  // the core's area from its mass, the insulation's outer diameter from the gutta-percha's
  const double ac = mc / kCopperDensity, d = std::sqrt(4 * ac / kPi);
  const double D = std::sqrt(4 * (mg / kGuttaDensity + ac) / kPi), ln = std::log(D / d);
  return {name, kCopperRho / ac, kMu0 / (2 * kPi) * ln, 2 * kPi * kEps0 * kGuttaEps / ln, 0, kBattery};
}

const Cable &cableAt(int k) {
  // the 1858 cable: seven strands of copper weighing 107 lb per nautical mile (26 kg/km), in
  // gutta-percha of 261 lb (64 kg/km); the 1866 one: 300 lb of very pure copper (73 kg/km) in
  // 400 lb of insulation (98 kg/km)
  static const Cable table[kCables] = {
    submarine("Atlantic telegraph, 1858", 0.026, 0.064),
    submarine("Atlantic telegraph, 1866", 0.073, 0.098),
    kPair,
  };
  return table[std::clamp(k, 0, kCables - 1)];
}

cd gamma(const Cable &c, double f) {
  const double w = 2 * kPi * f;
  return std::sqrt(cd(c.R, w * c.L) * cd(c.G, w * c.C));
}
cd z0(const Cable &c, double f) {
  const double w = 2 * kPi * f;
  return std::sqrt(cd(c.R, w * c.L) / cd(c.G, w * c.C));
}

Parts parts(const double *P) {
  Parts p{};
  p.c = cableAt((int)std::lround(P[conductor]));
  p.length = P[length];
  p.loading = (int)std::lround(P[loading]);
  p.coil = P[coil];
  p.source = p.c.source;
  p.gain = std::pow(10.0, P[repeater] / 20);
  const bool open = std::lround(P[far]) == 1;
  const double l = p.length;
  if (p.loading == heaviside) {
    // Heaviside's condition, L/R = C/G: the added inductance, and the leakance it asks for
    p.c.L += P[inductance] * 1e-3;
    p.c.G = p.c.R * p.c.C / p.c.L;
    p.z0 = std::sqrt(p.c.L / p.c.C);
    p.delay = l * std::sqrt(p.c.L * p.c.C);
    p.loss = std::exp(-l * std::sqrt(p.c.R * p.c.G));
    p.load = open ? kOpen : p.z0;
    p.sections = 0;
    return p;
  }
  if (p.loading == coils) {
    // a coil every 6000 feet, and the cable between them in enough sections that each turns a
    // sine at the coils' cutoff by under 0.05 rad, up to 8 and 256 sections in all
    const int coils = std::max(1, (int)std::lround(l / kCoilSpacing));
    const double between = l / coils, fc = 1 / (kPi * std::sqrt((p.coil + p.c.L * between) * p.c.C * between));
    p.per = std::clamp((int)std::ceil(std::abs(gamma(p.c, fc)) * between / 0.05), 1, 8);
    p.per = std::max(1, std::min(p.per, kMaxSections / coils));
    p.sections = coils * p.per;
    p.cutoff = fc;
    const double d = l / p.sections;
    p.Rs = p.c.R * d; p.Ls = p.c.L * d; p.Cs = p.c.C * d; p.Gs = p.c.G * d;
    // matched to the loaded line's impedance at 1 kHz, its coils spread along it
    Cable avg = p.c;
    avg.L += p.coil / kCoilSpacing;
    p.load = open ? kOpen : std::abs(z0(avg, 1000));
    return p;
  }
  // unloaded: enough sections that each turns a sine by under 0.28 rad wherever the whole line
  // loses it by under 80 dB (9.2 nepers) more than the bass at 20 Hz, up to 10 kHz, from 24 to 224
  // of them. (A long submarine cable's loss stops growing at a few kilohertz, where its inductance
  // takes over from its resistance: R/2 √(C/L) nepers a metre.)
  const double floor = std::real(gamma(p.c, 20)) * l + 9.2;
  double f = 10000;
  if (std::real(gamma(p.c, f)) * l > floor) {
    double lo = 20, hi = 10000;
    for (int i = 0; i < 60; i++) { const double m = std::sqrt(lo * hi); (std::real(gamma(p.c, m)) * l > floor ? hi : lo) = m; }
    f = hi;
  }
  p.sections = std::clamp((int)std::ceil(std::abs(gamma(p.c, f)) * l / 0.28), 24, 224);
  p.per = 1;
  const double d = l / p.sections;
  p.Rs = p.c.R * d; p.Ls = p.c.L * d; p.Cs = p.c.C * d; p.Gs = p.c.G * d;
  p.load = open ? kOpen : std::abs(z0(p.c, 1000));
  return p;
}

cd response(const Parts &p, double f) {
  if (p.loading == coils) {
    const double d = p.length / (p.sections / p.per);
    const Abcd sec = series(cd(0, 2 * kPi * f * p.coil)) * line(p.c, d, f);
    return transfer(power(sec, p.sections / p.per), p.source, p.load);
  }
  return transfer(line(p.c, p.length, f), p.source, p.load);
}

cd ladderResponse(const Parts &p, double f) {
  if (p.loading == heaviside) return response(p, f);
  const double w = 2 * kPi * f;
  const Abcd sec = series(cd(p.Rs, w * p.Ls)) * shunt(cd(p.Gs, w * p.Cs));
  Abcd group = power(sec, p.per);
  if (p.loading == coils) group = series(cd(0, w * p.coil)) * group;
  return transfer(power(group, p.sections / p.per), p.source, p.load);
}

} // namespace cable
