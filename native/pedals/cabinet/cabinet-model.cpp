// cabinet-model.cpp — the Speaker Cabinet's physics (cabinet-model.h).

#include "cabinet-model.h"

#include <cmath>

#include "cabinet-params.h"

namespace cabinet {

Model model(const double *P) {
  Model M;
  static constexpr int N[] = {1, 2, 4, 8}, S[] = {1, 1, 2, 2};
  const int k = (int)P[layout], s = S[k], par = N[k] / S[k];
  M.n = N[k];
  M.perVolt = 1.0 / s;
  M.rg = P[ampR] * par / s;
  M.re = P[re]; M.le = P[le]; M.sd = P[sd]; M.xmax = P[xmax];
  const double w = 2 * PI * P[fs], cms = P[vas] / (RC2 * M.sd * M.sd);
  M.kms = 1 / cms;
  M.mms = 1 / (w * w * cms);
  M.bl = std::sqrt(w * M.mms * M.re / P[qes]);
  M.rms = w * M.mms / P[qms];
  const double vb = P[volume] / M.n;
  M.cab = vb / RC2;
  M.ported = P[box] > 0.5;
  if (M.ported) {
    const double a = P[portD] / 2, area = std::round(P[ports]) * PI * a * a;
    M.sp = area / M.n;
    const double leff = P[portL] + END * a;
    M.mp = RHO * M.sp * leff;
    M.fb = C / (2 * PI) * std::sqrt(area / (P[volume] * leff));
    M.ra = QL / (2 * PI * M.fb * M.cab);
  }
  M.gain = std::pow(10.0, P[drive] / 20);
  M.mic = P[mic];
  return M;
}

State rates(const Model &M, const State &s, double e) {
  const double bl = blAt(M, s.x);
  State d;
  d.i = (e - (M.re + M.rg) * s.i - bl * s.u) / M.le;
  d.x = s.u;
  d.u = (bl * s.i - M.rms * s.u - kAt(M, s.x) * s.x + M.sd * s.p) / M.mms;
  d.p = -(M.sd * s.u + M.sp * s.up + s.p / M.ra) / M.cab;
  d.up = M.ported ? M.sp * s.p / M.mp : 0;
  return d;
}

Response response(const Model &M, double f) {
  using cd = std::complex<double>;
  const cd s(0, 2 * PI * f);
  const cd ze = M.rg + M.re + s * M.le, zm = s * M.mms + M.rms + M.kms / s;
  // the box's admittance (volume velocity per pascal): its air, its leaks, and the port's air
  cd yb = s * M.cab + 1.0 / M.ra;
  if (M.ported) yb += M.sp * M.sp / (s * M.mp);
  const cd zmt = zm + M.sd * M.sd / yb;        // the cone's load, the box's air included
  const cd zin = ze + M.bl * M.bl / zmt;      // the coil's, with the cone's motion reflected
  const double e = M.gain * M.perVolt;        // a driver's volts per volt at the input
  const cd i = e / zin, u = M.bl * i / zmt, p = -M.sd * u / yb;
  const cd up = M.ported ? M.sp * p / (s * M.mp) : cd(0);
  const cd pressure = (double)M.n * RHO / (2 * PI * MIC_R) * s * (M.sd * u + M.sp * up);
  Response r;
  r.h = M.mic * pressure;
  r.z = (zin - M.rg) / (M.perVolt * M.perVolt * (double)M.n); // s in series, N/s strings: s²/N of a driver's
  r.x = u / s;
  return r;
}

} // namespace cabinet
