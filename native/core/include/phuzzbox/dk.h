// dk.h — a circuit of resistors, capacitors, inductors, sources, transistors and triodes, solved
// sample by sample by the nodal DK method (Yeh, Abel and Smith 2010; Holters and Zölzer 2011,
// with variable parts): modified nodal analysis, the capacitors and inductors replaced by their
// trapezoidal companions (exactly the bilinear transform), and the linear part solved once, so
// that each sample's Newton iteration runs only on the nonlinear junctions' voltages.
//
//   Netlist net;                      nodes 1 … nodes (0 is ground)
//   net.resistor(1, 2, 68e3);  net.capacitor(2, 3, 10e-9);  net.inductor(6, 7, 0.5);
//   net.source(1);                    node 1 held at u[0], the next source at u[1], …
//   net.current(9);                   u[k] amperes into node 9, k after every voltage source
//   net.npn(3, 4, 5, Is, βF, βR);     base, collector, emitter: Ebers–Moll, two junctions
//   net.triode(10, 11, 12, tube);     grid, plate, cathode: Dempwolf and Zölzer's model, two ports
//   net.output(8);                    read node 8
//   Circuit c(net, fs);  c.operatingPoint(u);  c.step(u, out);  c.setResistor(k, ohms); c.update();
//
// The linear part's matrices (K × states and so on) are recomputed by update(), after a resistor
// or a reactive part changes (a pot turning): one inversion of the nodal matrix, no allocation, so
// it may run in the audio thread a few thousand times a second.
//
// For a linear check, response(f) gives the small-signal transfer from an input (source 0 unless
// told) to each output at the operating point, by complex nodal analysis (the transistors' and
// triodes' currents linearised): volts per volt from a voltage source, ohms from a current.
//
// A triode (Dempwolf and Zölzer, "A physically-motivated triode model for circuit simulations",
// DAFx 2011, eqs. 10–12), with the grid's and plate's voltages from the cathode Vg and Va:
//
//   Ik = G (log(1 + e^(C (Va/µ + Vg))) / C)^γ,   Ig = Gg (log(1 + e^(Cg Vg)) / Cg)^ξ + Ig0,
//   Ia = Ik − Ig
//
// its ports the grid to the cathode (Ig flowing) and the plate to the cathode (Ia). Its
// capacitances between the electrodes are not part of it: add them as capacitors.
#pragma once

#include <algorithm>
#include <complex>
#include <vector>

namespace phuzzbox::dk {

struct Netlist {
  struct Two { int a, b; double value; };
  struct Bjt { int b, c, e; double Is, betaF, betaR, Vt; bool pnp; };
  struct Diode { int a, k; double Is, n, Vt; };
  struct Tube { double G, mu, gamma, C, Gg, xi, Cg, Ig0; }; // Dempwolf and Zölzer's Table 1
  struct Triode { int g, p, k; Tube t; };
  int nodes = 0;
  std::vector<Two> resistors, capacitors, inductors;
  std::vector<int> sources, currents, outputs;
  std::vector<Bjt> bjts;
  std::vector<Diode> diodes;
  std::vector<Triode> triodes;

  int resistor(int a, int b, double ohms) { grow(a, b); resistors.push_back({a, b, ohms}); return (int)resistors.size() - 1; }
  int capacitor(int a, int b, double farads) { grow(a, b); capacitors.push_back({a, b, farads}); return (int)capacitors.size() - 1; }
  int inductor(int a, int b, double henries) { grow(a, b); inductors.push_back({a, b, henries}); return (int)inductors.size() - 1; }
  void source(int node) { grow(node, 0); sources.push_back(node); }
  void current(int node) { grow(node, 0); currents.push_back(node); }
  void output(int node) { grow(node, 0); outputs.push_back(node); }
  void npn(int b, int c, int e, double Is, double betaF, double betaR, double Vt = 0.02585) { grow(b, c); grow(e, 0); bjts.push_back({b, c, e, Is, betaF, betaR, Vt, false}); }
  void pnp(int b, int c, int e, double Is, double betaF, double betaR, double Vt = 0.02585) { grow(b, c); grow(e, 0); bjts.push_back({b, c, e, Is, betaF, betaR, Vt, true}); }
  void diode(int a, int k, double Is, double n = 1, double Vt = 0.02585) { grow(a, k); diodes.push_back({a, k, Is, n, Vt}); }
  int triode(int g, int p, int k, const Tube &t) { grow(g, p); grow(k, 0); triodes.push_back({g, p, k, t}); return (int)triodes.size() - 1; }

 private:
  void grow(int a, int b) { nodes = std::max(nodes, std::max(a, b)); }
};

// a triode's grid and plate currents (A, into the tube) at Vg and Va from its cathode, as the
// circuit's ports draw them (for the views and tests)
void triodeCurrents(const Netlist::Tube &t, double vg, double va, double &ig, double &ia);

// a dense row-major matrix that never reallocates after construction
struct Mat {
  int r = 0, c = 0;
  std::vector<double> a;
  Mat() = default;
  Mat(int r, int c) : r(r), c(c), a((size_t)r * c, 0.0) {}
  double &operator()(int i, int j) { return a[(size_t)i * c + j]; }
  double operator()(int i, int j) const { return a[(size_t)i * c + j]; }
  void zero() { std::fill(a.begin(), a.end(), 0.0); }
};

class Circuit {
 public:
  Circuit(const Netlist &net, double fs);

  // change a part's value; update() then makes the matrices again
  void setResistor(int k, double ohms) { net.resistors[k].value = ohms; dirty = true; }
  void setCapacitor(int k, double farads) { net.capacitors[k].value = farads; dirty = true; }
  void setInductor(int k, double henries) { net.inductors[k].value = henries; dirty = true; }
  // a triode's tube (its emission worn, another valve): no new matrices needed
  void setTube(int k, const Netlist::Tube &t) { net.triodes[k].t = t; }
  void update();

  // u: each voltage source's volts, then each current source's amperes.
  // the DC operating point for constant sources u (capacitors open, inductors shorted), found by
  // Newton with the sources stepped up from zero; the states are set to it, so the circuit starts
  // there without a thump. False if it did not converge.
  bool operatingPoint(const double *u);
  // one sample: the sources u, the outputs out. False if the Newton iteration did not converge
  // (the sample is still the last iterate's).
  bool step(const double *u, double *out);

  // node voltages at the last operating point (index 0 is ground)
  const std::vector<double> &dcNodes() const { return dcV; }
  // the ports' voltages and currents now: each transistor's two junctions, each diode, then each
  // triode's grid and plate (from its cathode), as the last step or operating point left them
  const std::vector<double> &portVoltages() const { return vn; }
  const std::vector<double> &portCurrents() const { return in; }
  // small-signal transfer from input k (u's numbering) to each output at the operating point, at f Hz
  void response(double f, std::complex<double> *out, int input = 0) const;
  int iterations = 0; // Newton iterations in the last step (for tests)
  // start each step's Newton from the ports carried on in a straight line from the last two
  // samples rather than from the last: fewer iterations when the circuit is oversampled
  bool extrapolate = false;
  // a step's Newton stops once its last correction is under this (V); Newton converges
  // quadratically, so what is left is about its square
  double tolerance = 1e-6;

  Netlist net;

 private:
  void stamp(int a, int b, double g);
  void build(bool dc);
  void junctions(const double *v, double *i, double *J) const; // port currents and ∂i/∂v (block diagonal)
  double limit(int q, double vnew, double vold) const;
  bool newton(const double *p, const Mat &F, double *v, int maxIter, double tol);
  void nodeVoltages(const double *u, const double *i, std::vector<double> &V, bool withStates) const;

  double fs, T;
  int nU, nK, nI, nX, nN, nO;      // unknown nodes, voltage sources, inputs (and current sources), states, ports, outputs
  std::vector<int> col;            // node → its unknown's index, or −1 − its source's index
  std::vector<int> xa, xb, na, nb, oa; // the reactive parts', the junctions' and the outputs' nodes
  std::vector<double> gX, gOld;    // the reactive parts' companion conductances (and before update())
  std::vector<int> sign;           // +1 capacitor, −1 inductor
  Mat Y, Yk, S, work;              // nodal matrix, its known-node part, its inverse, space to invert
  Mat SxT, SnT, SY;                // S N_xU', S N_nU', S Y_K
  Mat A, B, C, D, E, F, Do, Eo, Fo; // the DK matrices at the sample rate
  Mat Edc, Fdc;                    // and the junctions' at DC
  std::vector<double> z, vx, vn, in, p, r, Jd, Jm, dv, dcV, iDC, uStep, vPrev;
  std::vector<int> blockLo, blockHi; // each port's device: its first port and one past its last
  std::vector<double> nvtQ, vcritQ; // each junction's n·Vt, and where its limiting starts
  std::vector<double> maxStep;     // each port's largest Newton step (V), where it is not a junction
  bool dirty = true;
};

} // namespace phuzzbox::dk
