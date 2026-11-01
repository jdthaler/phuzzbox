// circuit-tests.cpp — the nodal DK solver (phuzzbox/dk.h) against closed forms written here: an RC
// low-pass, a series RLC's resonance, a diode's operating point from its own equation, a current
// source into an RC, a triode's load line and its gain from its own equations; the Wah's and the
// Tube Preamp's engines against the solver's small-signal response; and the MIDI map's rules
// (phuzzbox/midi.h).

#include <cmath>
#include <algorithm>
#include <complex>
#include <cstdio>
#include <vector>

#include "phuzzbox/dk.h"
#include "phuzzbox/midi.h"
#include "preamp-engine.h"
#include "preamp-model.h"
#include "wah-engine.h"
#include "wah-model.h"

static int failures = 0;
static void check(bool ok, const char *what, double detail = NAN) {
  if (std::isnan(detail)) std::printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  else std::printf("%s %s (%.3g)\n", ok ? "ok  " : "FAIL", what, detail);
  if (!ok) failures++;
}
using cd = std::complex<double>;
using phuzzbox::dk::Circuit;
using phuzzbox::dk::Netlist;
constexpr double PI = 3.14159265358979323846;

// the amplitude of a steady sine through a circuit, from its last half second
static double sineGain(Circuit &c, double f, double fs, double amp, double *u, int in = 0) {
  const int n = (int)fs;
  double re = 0, im = 0, y = 0;
  for (int i = 0; i < n; i++) {
    u[in] = amp * std::sin(2 * PI * f * i / fs);
    c.step(u, &y);
    if (i >= n / 2) { re += y * std::cos(2 * PI * f * i / fs); im += y * std::sin(2 * PI * f * i / fs); }
  }
  return 2 * std::hypot(re, im) / (n / 2) / amp;
}

int main() {
  const double fs = 48000;
  // 1. an RC low-pass: H = 1 / (1 + jωRC); the trapezoidal rule is the bilinear transform, so the
  // engine's gain at f is the analog gain at the warped frequency (fs/π) tan(πf/fs)
  {
    Netlist n;
    n.source(1);
    n.resistor(1, 2, 1e3);
    n.capacitor(2, 0, 1e-6);
    n.output(2);
    Circuit c(n, fs);
    double u[1] = {0};
    c.operatingPoint(u);
    double worst = 0, worstStep = 0;
    for (double f : {20.0, 159.15, 1000.0, 5000.0}) {
      cd h;
      c.response(f, &h);
      const cd want = 1.0 / (1.0 + cd(0, 2 * PI * f * 1e3 * 1e-6));
      worst = std::max(worst, std::abs(h - want));
      const double fw = fs / PI * std::tan(PI * f / fs);
      worstStep = std::max(worstStep, std::abs(sineGain(c, f, fs, 0.1, u) - 1 / std::hypot(1, 2 * PI * fw * 1e-3)));
    }
    check(worst < 1e-9, "an RC low-pass: the response is 1/(1 + jωRC)", worst);
    check(worstStep < 2e-3, "and a sine through it has the bilinear transform's gain", worstStep);
  }
  // 2. a series RLC, the output across R: a band-pass peaking at unity at 1/(2π√(LC))
  {
    Netlist n;
    n.source(1);
    n.inductor(1, 2, 0.5);
    n.capacitor(2, 3, 22e-9);
    n.resistor(3, 0, 1e3);
    n.output(3);
    Circuit c(n, 4 * fs);
    double u[1] = {0};
    c.operatingPoint(u);
    const double f0 = 1 / (2 * PI * std::sqrt(0.5 * 22e-9));
    cd h0, hl, hh;
    c.response(f0, &h0);
    c.response(f0 * 0.9, &hl);
    c.response(f0 * 1.1, &hh);
    check(std::abs(std::abs(h0) - 1) < 1e-6 && std::abs(hl) < 1 && std::abs(hh) < 1, "a series RLC peaks at unity at 1/(2π√(LC))", std::abs(h0));
    const double g = sineGain(c, f0, 4 * fs, 0.1, u);
    check(std::abs(g - 1) < 0.01, "and a sine there passes whole (at 4 × 48 kHz)", g);
  }
  // 3. a diode from 5 V through 1 kΩ: its operating point solves Is (e^(V/nVt) − 1) = (5 − V)/R
  {
    Netlist n;
    n.source(1);
    n.resistor(1, 2, 1e3);
    n.diode(2, 0, 2.52e-9, 1.752);
    n.output(2);
    Circuit c(n, fs);
    double u[1] = {5};
    const bool ok = c.operatingPoint(u);
    const double V = c.dcNodes()[2], I = 2.52e-9 * (std::exp(V / (1.752 * 0.02585)) - 1);
    check(ok && std::abs(I - (5 - V) / 1e3) < 1e-9, "a diode's operating point satisfies its equation and Ohm's law", V);
    double y = 0;
    c.step(u, &y);
    check(std::abs(y - V) < 1e-6, "and the circuit starts there, at rest", y - V);
  }
  // 3b. a current source into R ∥ C: V = I R / (1 + jωRC), and I R at DC
  {
    Netlist n;
    n.current(1);
    n.resistor(1, 0, 10e3);
    n.capacitor(1, 0, 10e-9);
    n.output(1);
    Circuit c(n, fs);
    double u[1] = {1e-4};
    c.operatingPoint(u);
    check(std::abs(c.dcNodes()[1] - 1.0) < 1e-6, "a current source: 100 µA into 10 kΩ is 1 V", c.dcNodes()[1]);
    double worst = 0;
    for (double f : {50.0, 1591.5, 8000.0}) {
      cd h;
      c.response(f, &h);
      worst = std::max(worst, std::abs(h - 10e3 / (1.0 + cd(0, 2 * PI * f * 10e3 * 10e-9))));
    }
    check(worst < 1e-3, "and its response is R / (1 + jωRC) ohms", worst); // GMIN: 1e-12 S across 10 kΩ
    u[0] = 0;
    const double g = sineGain(c, 1000, fs, 1e-4, u);
    const double fw = fs / PI * std::tan(PI * 1000 / fs);
    check(std::abs(g - 10e3 / std::hypot(1, 2 * PI * fw * 1e-4)) < 20, "and a sine of current through it, the bilinear transform's", g);
  }
  // 3c. a 12AX7 (Dempwolf and Zölzer's RSD-1) from 300 V through 100 kΩ, its grid fed −1.5 V
  // through 68 kΩ: the grid where its own current across the stopper leaves it, and the plate
  // where the load line Va = 300 − 100k · Ia crosses the tube's curve (each found here by
  // bisection on the paper's equations); the gain −gm (ra ∥ R), gm and 1/ra the equations'
  // derivatives by finite differences
  {
    const Netlist::Tube t{2.242e-3, 103.2, 1.26, 3.40, 6.177e-4, 1.314, 9.901, 8.025e-8};
    auto Ig = [&](double vg) { return t.Gg * std::pow(std::log(1 + std::exp(t.Cg * vg)) / t.Cg, t.xi) + t.Ig0; };
    auto Ia = [&](double vg, double va) { return t.G * std::pow(std::log(1 + std::exp(t.C * (va / t.mu + vg))) / t.C, t.gamma) - Ig(vg); };
    double lo = -3, hi = 0;
    for (int i = 0; i < 200; i++) { const double m = 0.5 * (lo + hi); (-1.5 - 68e3 * Ig(m) > m ? lo : hi) = m; }
    const double Vg = 0.5 * (lo + hi);
    lo = 0; hi = 300;
    for (int i = 0; i < 200; i++) { const double m = 0.5 * (lo + hi); (300 - 100e3 * Ia(Vg, m) > m ? lo : hi) = m; }
    const double Va = 0.5 * (lo + hi);
    Netlist n;
    n.source(1); // the grid's drive
    n.source(2); // B+
    n.resistor(1, 4, 68e3); // a grid stopper
    n.resistor(2, 3, 100e3);
    n.triode(4, 3, 0, t);
    n.output(3);
    Circuit c(n, fs);
    double u[2] = {-1.5, 300};
    const bool ok = c.operatingPoint(u);
    check(ok && std::abs(c.dcNodes()[3] - Va) < 1e-4 && std::abs(c.dcNodes()[4] - Vg) < 1e-6, "a triode's plate sits where its load line crosses its curve (V)", c.dcNodes()[3] - Va);
    const double h = 1e-4;
    const double gm = (Ia(Vg + h, Va) - Ia(Vg - h, Va)) / (2 * h), ga = (Ia(Vg, Va + h) - Ia(Vg, Va - h)) / (2 * h);
    const double gg = (Ig(Vg + h) - Ig(Vg - h)) / (2 * h); // the grid's own conductance, against the stopper
    const double want = -gm / (ga + 1 / 100e3) / (1 + 68e3 * gg);
    cd r;
    c.response(1000, &r);
    check(std::abs(r - want) < 1e-4 * std::abs(want), "and its gain is −gm (ra ∥ R)", std::abs(r));
    double y = 0;
    c.step(u, &y);
    check(std::abs(y - c.dcNodes()[3]) < 1e-6, "and the circuit starts there, at rest", y - c.dcNodes()[3]);
    double re = 0, im = 0;
    const int N = (int)fs;
    for (int i = 0; i < N; i++) {
      u[0] = -1.5 + 1e-3 * std::sin(2 * PI * 1000 * i / fs);
      c.step(u, &y);
      if (i >= N / 2) { re += y * std::cos(2 * PI * 1000 * i / fs); im += y * std::sin(2 * PI * 1000 * i / fs); }
    }
    const double g = 2 * std::hypot(re, im) / (N / 2) / 1e-3;
    check(std::abs(g / std::abs(r) - 1) < 1e-3, "and a small sine on the grid comes out that much bigger", g);
    // driven hard through its stopper, the grid conducts on the positive peaks and its current
    // across the stopper holds it there; the plate stays between the tube's floor and B+
    double lowest = 300, highest = 0, grid = -10;
    for (int i = 0; i < 4800; i++) {
      u[0] = -1.5 + 4 * std::sin(2 * PI * 100 * i / fs);
      c.step(u, &y);
      lowest = std::min(lowest, y); highest = std::max(highest, y); grid = std::max(grid, c.portVoltages()[0]);
    }
    check(lowest > 0 && highest < 300.01 && grid < 1, "and driven 4 V through its stopper, the grid conducts and the plate stays between the rails", grid);
  }
  // 4. the Wah's engine follows the circuit's small-signal response
  {
    double P[wah::kParamCount];
    for (int i = 0; i < wah::kParamCount; i++) P[i] = wah::kParams[i].def;
    double worst = 0;
    for (double pos : {0.0, 0.5, 1.0}) {
      P[wah::position] = pos;
      wah::Parts parts;
      Circuit c(wah::netlist(P, parts), 4 * fs);
      double u[2] = {0, P[wah::vcc]};
      c.operatingPoint(u);
      for (double f : {100.0, 400.0, 1000.0, 3000.0}) {
        cd h;
        c.response(f, &h);
        const double g = sineGain(c, f, 4 * fs, 1e-4, u);
        worst = std::max(worst, std::abs(20 * std::log10(g / std::abs(h))));
      }
    }
    check(worst < 0.1, "the Wah: a small sine's gain is the linearised circuit's (dB)", worst);
    P[wah::position] = 0.3;
    wah::Engine e(fs);
    e.setParams(P);
    std::vector<float> x(4800), L(4800), R(4800);
    for (int i = 0; i < 4800; i++) x[i] = (float)(2.0 * std::sin(2 * PI * 41.2 * i / fs));
    for (int at = 0; at < 4800; at += 128) e.process(x.data() + at, L.data() + at, R.data() + at, std::min(128, 4800 - at));
    bool finite = true;
    for (float v : L) finite = finite && std::isfinite(v) && std::abs(v) < 20;
    check(finite, "and a 2 V low E, far past what it was built for, stays finite and below the supply");
  }
  // 4b. the Tube Preamp's engine, oversampled, follows its circuit's small-signal response (the
  // output per volt recorded, through the bass's Norton current), and stays finite driven hard
  {
    double P[preamp::kParamCount];
    for (int i = 0; i < preamp::kParamCount; i++) P[i] = preamp::kParams[i].def;
    double worst = 0;
    for (double g : {0.1, 0.5}) {
      P[preamp::gain] = g;
      preamp::Parts parts;
      Circuit c(preamp::netlist(P, parts), 192000);
      double u[2] = {P[preamp::bplus], 0};
      c.operatingPoint(u);
      const preamp::Recording r = preamp::recording(P);
      for (double f : {60.0, 400.0, 2000.0}) {
        cd z[4];
        c.response(f, z, 1);
        const double w = 2 * PI * f;
        const double want = std::abs(z[0] * (1.0 / cd(r.coilR, w * r.coilL) + cd(r.G, w * r.C)));
        preamp::Engine e(fs);
        e.setParams(P);
        const int n = (int)fs / 2;
        std::vector<float> x(n), L(n), R(n);
        for (int i = 0; i < n; i++) x[i] = (float)(1e-4 * std::sin(2 * PI * f * i / fs));
        for (int at = 0; at < n; at += 128) e.process(x.data() + at, L.data() + at, R.data() + at, std::min(128, n - at));
        double re = 0, im = 0;
        for (int i = n / 2; i < n; i++) { re += L[i] * std::cos(2 * PI * f * i / fs); im += L[i] * std::sin(2 * PI * f * i / fs); }
        const double got = 2 * std::hypot(re, im) / (n / 2) / 1e-4;
        worst = std::max(worst, std::abs(20 * std::log10(got / want)));
      }
    }
    // within the oversampler's filters' ripple: 0.1 dB going up, 0.1 dB coming down
    check(worst < 0.2, "the Tube Preamp: a small sine's gain is the linearised circuit's (dB)", worst);
    P[preamp::gain] = 1;
    preamp::Engine e(fs);
    e.setParams(P);
    std::vector<float> x(9600), L(9600), R(9600);
    for (int i = 0; i < 9600; i++) x[i] = (float)(2.0 * std::sin(2 * PI * 41.2 * i / fs));
    for (int at = 0; at < 9600; at += 128) e.process(x.data() + at, L.data() + at, R.data() + at, std::min(128, 9600 - at));
    bool finite = true;
    for (float v : L) finite = finite && std::isfinite(v) && std::abs(v) < 400;
    check(finite && e.failures == 0, "and a 2 V low E at full gain stays finite, every sample converged", (double)e.failures);
  }
  // 5. the MIDI map
  {
    phuzzbox::MidiMap m;
    const phuzzbox::PedalInfo info{"wah", "Wah", "0", "", "Wahh", wah::kParams, wah::kParamCount, wah::kPresets, wah::kPresetCount, nullptr, wah::kExpression};
    m.defaults(info);
    std::vector<std::pair<int, double>> got;
    auto f = [&](int t, char kind, double v) { got.push_back({t * 10 + (kind == 't' ? 1 : 0), v}); };
    auto none = [](int) { return 0; };
    const uint8_t exp2[3] = {0xB0, 1, 127}, exp1[3] = {0xB3, 7, 64}, sw[3] = {0xB0, 65, 0}, other[3] = {0xB0, 20, 5};
    m.handle(exp2, 3, info, f, none);
    m.handle(exp1, 3, info, f, none);
    m.handle(sw, 3, info, f, none);
    m.handle(other, 3, info, f, none);
    check(got.size() == 3 && got[0].first == wah::position * 10 && got[0].second == 1, "MIDI: the FC-300's expression pedal 2 (CC 1) moves the rocker");
    check(got.size() == 3 && got[1].first == phuzzbox::MIDI_VOLUME * 10 && std::abs(got[1].second - 64 / 127.0) < 1e-12, "and expression pedal 1 (CC 7), on any channel, the volume");
    check(got.size() == 3 && got[2].first == phuzzbox::MIDI_BYPASS * 10 && got[2].second == 0, "and number pedal 1 (CC 65, latching) the bypass");
    check(std::abs(phuzzbox::audioTaper(0.5) - 0.1) < 1e-12 && phuzzbox::audioTaper(0) == 0 && phuzzbox::audioTaper(1) == 1, "the volume pedal's audio taper: 10 % at half travel");
  }
  return failures ? 1 : 0;
}
