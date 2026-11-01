# Phuzz

A fuzz from 1966, built from two germanium transistors, five resistors, three capacitors and two
pots. The Phuzz is that circuit solved as it plays. Each transistor is an Ebers–Moll transistor
with its own current gain and leakage, set as a transistor tester would read them, and both drift
with temperature as germanium does: warm the room and the bias slides, until the pedal sputters.
The battery has an internal resistance, so the rail sags under each note. Its input is a few
kilohms, so it loads your pickup before any transistor clips, which is why one of these sounds
different on every bass.

Part of [PhuzzBox](../README.md).

| Input | |
|---|---|
| Your audio interface | pick it in the source menu (then **In 1** or **In 2**) |
| `Z`…`/`, `A`…`;`, `Q`…`P`, `1`…`0` | the test bass's E, A, D and G strings, open to the ninth fret |
| `Space` | the footswitch |

## The circuit

Two PNP transistors with a positive ground: the battery's + is the circuit's ground, and its − is
the rail, about −9 V.

```
jack ─┤├── Q1 base                    Q1: emitter to ground, collector ── 33 kΩ ── rail
     2.2 µF   │                       Q2: base on Q1's collector
              └── 100 kΩ ── Q2 emitter ── Fuzz pot 1 kΩ ── ground (its wiper ── 20 µF ── ground)
Q2 collector ── 8.2 kΩ ──┬── 470 Ω ── rail
                         └──┤├── Volume pot 500 kΩ (audio) ── ground; its wiper is the output
                          10 nF
```

Q1 amplifies; its collector drives Q2's base directly; and the 100 kΩ from Q2's emitter back to
Q1's base is the feedback that sets the bias of both (shunt–series feedback: if Q2 runs more
current, its emitter falls, Q1's base current rises, Q1 pulls its collector up and Q2's base with
it, and Q2 runs less). The Fuzz pot decides how much of that feedback reaches the signal: full up,
the 20 µF capacitor grounds Q2's emitter for audio, the signal sees no feedback and the pair has
about 39 dB of gain at 1 kHz; at half, half the pot is back in the emitter and the gain is 25 dB
lower. The output is taken from a divider on Q2's collector, 470 Ω over 8.67 kΩ, which is why a
fuzz this hot comes out at about the level of a bass played straight in.

The bias at the defaults (20 °C, a fresh 9 V battery, Q1 with hFE 80 and 30 µA of leakage, Q2 with
120 and 100 µA): Q1's collector at −0.57 V, Q2's emitter at −0.43 V and its collector at −5.3 V,
0.43 mA through it. Builders trim Q2's collector toward the middle of its swing so that it clips
evenly on both sides; here that takes about 12 kΩ in place of the 8.2 kΩ (**Q2 collector
resistor**), which leaves the collector at −3.7 V at rest, its swing reaching from about −0.4 V,
where Q2 saturates, to the rail.

## The transistors

Each transistor is Ebers–Moll's (1954), in the transport form. With veb = Ve − Vb and
vcb = Vc − Vb (a PNP conducts with its emitter above its base),

  iF = Is (e^(veb/Vt) − 1),   iR = Is (e^(vcb/Vt) − 1)

  current out of the collector = iF − iR / αR,   out of the base = iF / βF + iR / βR

with Vt = kT/q, βF the hFE knob, βR = 2 and αR = βR / (βR + 1). A tester reads leakage as the
collector current with the base open, I_CEO; in this model that is exactly

  I_CEO = Is (βF + βR + 1) / βR

so each **leakage** knob sets Is. Germanium's leakage is large (tens to hundreds of µA, against
silicon's nanoamps) and it grows fast with temperature. The temperature laws are SPICE's:

  Is(T) = Is(T₀) (T/T₀)³ exp((Eg / Vt)(T/T₀ − 1)),   β(T) = β(T₀) (T/T₀)^1.5

with germanium's band gap Eg = 0.67 eV and T₀ = 20 °C. That makes the leakage about double every
7 °C (the tests check × 1.99 for 7 °C).

Leakage is what makes a germanium fuzz temperamental. In the active region
I_C = hFE·I_B + I_CEO: Q1's leakage is current it passes whatever its base asks for, so the
feedback hands Q1 less base current, Q2's emitter rises toward ground and Q2 runs less current.
At 0 °C Q2's collector sits at −4.5 V and clips evenly; at 40 °C it has slid to −7.3 V, near the
rail, and clips lopsided; by 50 °C the pair has lost 40 dB of gain. Q2's own leakage matters much
less, because the feedback holds Q2's current: three times Q2's leakage moves its current by 1 %,
three times Q1's by 23 %.

## The bass, the battery, and what it drives

The pickup is part of the circuit, as in the [Buffer](../buffer/README.md): the coil's resistance
and inductance, its own capacitance and the cable's, the bass's pots. The signal arriving at the
page is what your interface recorded through your cable into its own input (1 MΩ). Behind it is a
Norton source at the jack, the current that into the recording's circuit (the coil, the
capacitances, the pots, the interface) makes the recorded voltage. The Phuzz puts the same current
into its own input instead, and the jack's voltage is whatever the Phuzz's input impedance lets it
be: about 6 kΩ with the Fuzz full up, and a few hundred ohms below that, where the feedback works
on the input too. Into either, the pickup's resonance is damped away, so the cable from the bass
hardly matters (1 m against 10 m: under 0.3 dB).

The battery is its EMF behind its internal resistance: an ohm or two new, hundreds of ohms nearly
dead. With 200 Ω, the rail sags by 0.19 V under a note against 2 mV for a fresh battery, and since
the output divider's 470 Ω goes to the rail, the battery's resistance adds to it and the output
comes out about 2 dB louder. A lower voltage leaves Q2's collector less room: at 7 V the output
clips at 0.36 V where at 9 V it clips at 0.45 V.

The output drives the cable to the amp (its capacitance, at the **Cable capacitance** per metre)
and the amp's input. Below full volume the pot's resistance and that capacitance are a low-pass:
30 m of cable at 70 % volume costs 18 dB at 5 kHz.

## Solving it

The circuit is discretised by the nodal DK method (Yeh, Abel, Vladimirescu and Smith 2010;
Holters and Zölzer 2011). Each capacitor and the coil becomes, by the trapezoidal rule, a
conductance and a current carried over from the last sample. The linear network (ten nodes) is
inverted once, whenever a knob moves, so it is known what each carried current, each source and
each transistor current does to every node. Each sample then needs only the four junction
voltages, from

  v = p + K i(v)

where p comes from the carried currents and the sources, K from the network, and i(v) is
Ebers–Moll. That is solved by Newton's method from the junctions carried on in a straight line
from the last two samples, which usually lands within microvolts: on a loud note at 4×
oversampling it takes 1.1 iterations a sample on average. A step that would push a junction far
into forward bias is cut back as SPICE cuts it (pnjlim), and a step under 100 µV ends the
iteration (Newton's error after it is under 0.2 µV). The DC operating point, where the pedal
starts and rests, is found by the same Newton with the battery switched on in forty steps.

Clipping makes harmonics far above 20 kHz, which at 48 kHz would fold back as inharmonic tones.
So the circuit runs at four times the host's rate, between a pair of 8th-order Chebyshev low-pass
filters at 20 kHz. They are IIR filters, so the delay is 4 samples (0.08 ms at 48 kHz) rather than
the dozens a linear-phase filter would add; the pedal reports it as its latency. On a loud 2.5 kHz
note the inharmonic products come out 32 dB down against 15 dB with no oversampling (most of a
bass's notes are far lower, where it is much better). **Quality** in a host: high is 4×,
medium 2×, low 1×.

## The controls

- **The Phuzz**: Fuzz, Volume (an audio taper, (81^x − 1)/80, a tenth of the way at half),
  Temperature and the battery's voltage, on the pedal's face.
- **Transistors**: each one's hFE and leakage (I_CEO at 20 °C), as a tester reads them.
- **Battery, bias and cables**: the battery's internal resistance, Q2's collector resistor, the
  cables to and from the pedal, and the amp's input.
- **Your bass** and **How you are plugged in**: as in the Buffer. Set them to your pickup, your
  cable and your interface, and the Phuzz sees your pickup as it would be plugged into it.

## The views

- **The transistors**: each one's collector current against the voltage across it, at a few base
  currents (the model's own characteristics), with the DC load line its resistors allow and the
  operating point. Play, and the trail shows where each goes: on a firm note both run from
  saturation (the left edge) to cut-off (the bottom), Q1 within its first volt, Q2 across nearly
  the whole battery.
- **Scope**: the input and the output in volts.
- **Spectrum**: the input's and the output's.

## What to listen for

- **Full fuzz** against **Fuzz at half**: the second is cleaner and quieter, and its input
  impedance has fallen to a few hundred ohms, loading the pickup harder.
- **Cold room** and **Hot stage**: the same transistors 33 °C apart. Cold clips evenly; hot clips
  lopsided, its peaks 13 % apart.
- **Dying battery**: less headroom, and the rail sagging with each note.
- **Leaky first transistor**, then **Trimmed for a leaky one**: a starved fuzz, its peaks 16 %
  apart, and the same transistor with Q2's collector resistor raised to 20 kΩ, which evens them
  (1 % apart) at the cost of some level.

## What is simplified

- The transistors have no junction or diffusion capacitance, no base resistance and no Early
  effect. The AC128s and NKT275s these pedals used are slow (a few hundred kHz to a few MHz of
  gain–bandwidth), so a real one rolls off the very top that this one keeps.
- Germanium's leakage is modelled as Ebers–Moll's own saturation current. Much of a real
  transistor's leakage is surface leakage, which grows with temperature at its own rate; and
  βR = 2 and β's temperature exponent of 1.5 are typical values, not measured ones.
- The battery is an EMF and a resistance, with no chemistry: its voltage doesn't fall as you play.
- The pots are ideal, and the Volume's audio taper is a smooth curve rather than the two straight
  segments real ones have.
- The recorded signal is inverted through the recording's circuit to drive the Phuzz. Above the
  pickup's resonance that boosts whatever the recording holds there, which is mostly the
  interface's noise; this pedal amplifies it, as a real fuzz amplifies a pickup's hiss.

## Files

```
phuzz/index.html, style.css            page
phuzz/src/phuzz-params.js             parameters and presets
phuzz/src/phuzz-pedal.js              the descriptor: everything but the page
phuzz/src/phuzz-main.js               page wiring and views
phuzz/src/phuzz-worklet.js            its AudioWorklet module
phuzz/wasm/phuzz.wasm                 built from the C++
native/pedals/phuzz/                  the circuit, its solver and the engine in C++
native/core/include/phuzzbox/oversample.h   the oversampling filters
test/phuzz-circuit.mjs                the circuit solved independently, for the tests
test/phuzz-tests.mjs                  node test/phuzz-tests.mjs
```

## Prior art and references

* The circuit is the Fuzz Face's, introduced by Ivor Arbiter in 1966 with germanium transistors
  ([Wikipedia](https://en.wikipedia.org/wiki/Fuzz_Face)). Its values and its analysis (gain,
  bias targets, the transistors builders choose) are from ElectroSmash's
  [Fuzz Face analysis](https://electrosmash.com/fuzz-face).
* Ebers, J. J. & Moll, J. L. (1954). "Large-signal behavior of junction transistors."
  *Proc. IRE* 42(12), 1761–1772.
  [doi:10.1109/JRPROC.1954.274797](https://doi.org/10.1109/JRPROC.1954.274797).
* Vladimirescu, A., Zhang, K., Newton, A. R., Pederson, D. O. & Sangiovanni-Vincentelli, A.
  (1983). *SPICE Version 2G6 User's Guide*. University of California, Berkeley. The transistor's
  temperature laws (XTI, XTB, EG) and germanium's band gap of 0.67 eV.
* Yeh, D. T., Abel, J. S., Vladimirescu, A. & Smith, J. O. (2010). "Automated physical modeling of
  nonlinear audio circuits for real-time audio effects, Part I: theoretical development."
  *IEEE Trans. Audio, Speech, and Language Processing* 18(4), 728–737. The nodal DK method.
* Holters, M. & Zölzer, U. (2011). "Physical modelling of a wah-wah effect pedal as a case study
  for application of the nodal DK method to circuits with variable parts." *Proc. 14th Int. Conf.
  on Digital Audio Effects (DAFx-11)*, Paris.
  [paper](https://www.dafx.de/paper-archive/details/hR2kI9NQ8b1kjRgzxNk0pw).
* The trapezoidal companion models, Newton's method and the Chebyshev filters are in any circuit
  simulation or digital signal processing text.
