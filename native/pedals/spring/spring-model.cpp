// spring-model.cpp — the Spring Reverb's physics (spring-model.h).

#include "spring-model.h"

#include "spring-params.h"

namespace spring {

const Tank &tankOf(int which) {
  // Parker & Bilbao (2009), Appendix A: helix diameter, turns, helix length, magnet length and
  // diameter, for each spring
  static const Tank leem{3, {{4.4e-3, 303, 0.163, 4e-3, 1.5e-3}, {4.5e-3, 280, 0.163, 4e-3, 1.5e-3}, {4.6e-3, 351, 0.163, 4e-3, 1.5e-3}}};
  static const Tank olson{2, {{5.4e-3, 148, 0.065, 5e-3, 2.1e-3}, {6.1e-3, 133, 0.065, 5e-3, 2.1e-3}, {}}};
  static const Tank one{1, {{4.4e-3, 303, 0.163, 4e-3, 1.5e-3}, {}, {}}};
  return which == 1 ? olson : which == 2 ? one : leem;
}

void Spring::set(const Coil &c, double wireD, bool across) {
  R = c.D / 2;
  r = wireD / 2;
  // the wire's length: the helix unrolled, √((2πRN)² + H²) (Parker & Bilbao)
  L = std::hypot(2 * PI * R * c.turns, c.H);
  eps = 1 / R;
  gam2 = STEEL_E / STEEL_RHO;
  kap2 = r * r * gam2 / 4;
  c0 = std::sqrt(kap2) * eps;
  TD = 2 * L / c0;
  // the lower root's peak, by golden section on ω²(k) over (0.3ε, 0.8ε)
  double a = 0.3 * eps, b = 0.8 * eps;
  const double g = (std::sqrt(5.0) - 1) / 2;
  for (int i = 0; i < 80; i++) {
    const double x1 = b - g * (b - a), x2 = a + g * (b - a);
    if (w2(x1) > w2(x2)) b = x2; else a = x1;
  }
  kc = (a + b) / 2;
  Fc = omega(kc) / (2 * PI);
  // the bead: a cylindrical magnet, radius a and length l, turning about the spring's axis: lying
  // along the axis, about its own (I = ma²/2); lying across it, about a diameter through its middle
  // (I = m(a²/4 + l²/12)). The spring's wire turns about the same axis at its radius R.
  const double ma = c.magnetD / 2, ml = c.magnetL;
  const double mb = MAGNET_RHO * PI * ma * ma * ml;
  const double Ib = across ? mb * (ma * ma / 4 + ml * ml / 12) : mb * ma * ma / 2;
  const double Is = STEEL_RHO * PI * r * r * L * R * R;
  mu = Ib / Is;
  fb = (1 / TD) / (PI * mu); // f₀/(πμ), f₀ = c₀/2L = 1/T_D
}

double Spring::w2(double k) const {
  const double q = k * k - eps * eps;
  const double s = kap2 * q * q + gam2 * (eps * eps + k * k);
  const double p = kap2 * gam2 * k * k * q * q;
  const double d = s * s - 4 * p;
  return 2 * p / (s + std::sqrt(d > 0 ? d : 0));
}

double Spring::cg(double k) const {
  const double h = 1e-5 * (k > 1 ? k : 1);
  return (omega(k + h) - omega(k - h)) / (2 * h);
}

double Spring::share(double k) const {
  const double beta = gam2 * eps * k / (gam2 * k * k - w2(k));
  const double d = beta - k * R;
  return d * d / (1 + beta * beta);
}

double sigma(double f, double cg, double L, double mountsDb, double eta, double oil) {
  return oil + PI * f * eta + (mountsDb * std::log(10.0) / 20) * std::abs(cg) / L;
}

Model model(const double *P) {
  Model M;
  M.tank = (int)std::lround(P[tank]);
  M.across = std::lround(P[beads]) == 1;
  M.wire = P[wire]; M.mounts = P[mounts]; M.eta = P[steel]; M.oil = P[oil];
  M.dry = P[dry]; M.reverb = P[reverb];
  M.level = std::pow(10.0, P[level] / 20);
  return M;
}

} // namespace spring
