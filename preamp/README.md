# Tube Preamp

The preamp of a 1959 Fender Bassman, the 5F6-A: the amp built for bass that guitarists took
over. Three triodes, each Dempwolf and Zölzer's model of a measured 12AX7, so that a grid pushed
past its cathode draws current and the tube runs out of room as a real one does. A cathode
follower drives the passive tone stack whose Bass, Middle and Treble only ever take away, most of
all in the middle. The supply has its dropper and its filter capacitor, so the rail sags a
little when you dig in. The input is the tube's 1 MΩ grid leak, so your pickup sees what it would
see plugged into the amp.

Part of [PhuzzBox](../README.md).

| Input | |
|---|---|
| Your audio interface | pick it in the source menu (then **In 1** or **In 2**) |
| `Z`…`/`, `A`…`;`, `Q`…`P`, `1`…`0` | the test bass's E, A, D and G strings, open to the ninth fret |
| `Space` | the footswitch |

## The circuit

```
jack ── 68 kΩ ── V1a grid;  jack ── 1 MΩ ── ground
V1a: plate ── 100 kΩ ── rail;  cathode ── 1.5 kΩ ∥ 25 µF ── ground
V1a plate ──┤├── Gain pot 1 MΩ (audio) ── ground;  its wiper ── 270 kΩ ── V2a grid
           20 nF
V2a: plate ── 100 kΩ ── rail;  cathode ── 820 Ω ── ground (no capacitor)
V2b, a cathode follower: grid on V2a's plate, plate on the rail, cathode ── 100 kΩ ── ground
the tone stack, from V2b's cathode:
    ──┤├── Treble pot 250 kΩ ── (its wiper is the stack's output)
     250 pF          │
    ── 56 kΩ ──┬──┤├──┴── Bass pot 1 MΩ (audio) ──┐
               │  20 nF                           │
               └──┤├──────────────────── Middle pot 25 kΩ ── ground
                  20 nF
the stack's output ── Master pot 1 MΩ (audio) ── ground;  its wiper is the output
the rail: the 385 V supply ── 14 kΩ dropper ──┬── the preamp's rail, about 325 V
                                              └── 8 µF ── ground
```

From the Bassman (5F6-A, as Silicon Chip's 2024 article and Kuehnel's analysis give it): the
second stage's 100 kΩ plate, 820 Ω unbypassed cathode and 270 kΩ grid stopper; the cathode
follower's 100 kΩ; the tone stack, whose values and topology are Yeh and Smith's; the 68 kΩ grid
stopper and 1 MΩ grid leak at the input; the 20 nF coupling capacitor and 1 MΩ volume pot; the
385 V rail and the 8 µF filter on the 325 V one. The Bassman's first stage is a 12AY7 whose two
halves share an 820 Ω cathode resistor and 250 µF. There is no published fit of a 12AY7 for this
model, so the first stage here is the one Fender's AB763 amps use, a 12AX7 with a 1.5 kΩ cathode
resistor and 25 µF, as Rob Robinette gives it. The dropper's value is not in either source: the
14 kΩ here is chosen so the preamp's rail sits at the 325 V Kuehnel computes with. A Master pot
after the stack stands in for the power amp the Bassman drives: it sets the level without
changing how hard the tubes are driven.

At the operating point, with the RSD-1 tube (the default):

| | grid from cathode | plate from cathode | plate current |
|---|---|---|---|
| V1a | −1.6 V | 217 V | 1.06 mA |
| V2a | −1.15 V | 186 V | 1.38 mA |
| V2b (follower) | −0.48 V | 137 V | 1.88 mA |

Kuehnel computes V2a at −1.2 V, 181 V and about 1.4 mA. For a small signal the first stage gains
66 (36 dB), the second 45 (33 dB), the follower 0.98; the tone stack with every knob at halfway
takes about 12 dB off at 1 kHz.

## The triodes

Each triode is Dempwolf and Zölzer's physically motivated model (DAFx 2011). With Vg and Va the
grid's and the plate's voltages from the cathode, the cathode emits

  Ik = G (ln(1 + e^(C (Va/µ + Vg))) / C)^γ

which is Child's law, I ∝ (Vg + Va/µ)^(3/2), with γ fitted (about 1.3) and its knee at cut-off
smoothed by the softplus ln(1 + e^x). The grid collects

  Ig = Gg (ln(1 + e^(Cg Vg)) / Cg)^ξ + Ig0

nothing until it rises to about its cathode's voltage, then a current that grows as a power of
how far above it is; Ig0, tens of nanoamperes, the paper adds for numerical stability. The plate takes the
rest, Ia = Ik − Ig. Their Table 1 has three 12AX7s measured with plates from 20 V to 300 V and
grids from −5 V to 3 V; **Tubes** picks one:

| | G | µ | γ | C | Gg | ξ | Cg | Ig0 |
|---|---|---|---|---|---|---|---|---|
| RSD sample 1 | 2.242e-3 | 103.2 | 1.26 | 3.40 | 6.177e-4 | 1.314 | 9.901 | 8.025e-8 |
| RSD sample 2 | 2.173e-3 | 100.2 | 1.28 | 3.19 | 5.911e-4 | 1.358 | 11.76 | 4.527e-8 |
| Electro-Harmonix | 1.371e-3 | 86.9 | 1.349 | 4.56 | 3.263e-4 | 1.156 | 11.99 | 3.917e-8 |

Between the electrodes are the capacitances the paper uses, the 12AX7's datasheet values: grid
to cathode 2.3 pF, grid to plate 2.4 pF, plate to cathode 0.9 pF. The grid-to-plate one is
multiplied by the stage's gain (the Miller effect): with the 270 kΩ stopper in front of it, V2a
rolls the top off as the amp does.

**Emission** scales G, the current a cathode gives, for a tired tube: at 60 % the gain stages'
plates sit higher and the preamp has about 5 dB less gain.

### How it distorts

Gain sets how much of V1a's output reaches V2a's grid, which rests 1.15 V below its cathode.
A 0.2 V note comes through clean (its harmonics 50 dB down) with Gain up to about a third.
Swing it more than that above and the grid conducts: its current, through the 270 kΩ stopper and
the pot, holds the grid near its cathode, and the plate's swing flattens on the way down. Swing
it a few volts below and the tube cuts off: the plate rises to the rail through its 100 kΩ, and
the swing flattens on the way up. The two sides are not alike, so the even harmonics come first: from about 40 % the second
harmonic leads, and further up, where the tube cuts off as well, the third takes over.
The cathode follower adds its own: its grid rests only 0.48 V below its cathode, so a large swing
from V2a pulls the follower's grid into conduction, which loads V2a's plate. That is the
Bassman's thick, compressed break-up, and the **The tubes** view shows each tube's trail running
into those edges.

## The tone stack

The stack (Yeh and Smith's analysis of the Bassman's) is a passive network: three capacitors and
four resistances, three of them pots. Yeh and Smith solve it, unloaded, as a third-order transfer function,

  H(s) = (b1 s + b2 s² + b3 s³) / (1 + a1 s + a2 s² + a3 s³)

whose coefficients are polynomials in the three pots' settings. With every knob at halfway, it
takes about 12 dB off at 1 kHz (11.8 dB unloaded, 12.4 dB here with the Master pot across its
output) and scoops the middle most, near 700 Hz. From halfway:

- **Bass** (1 MΩ, audio taper): full up lifts 60 Hz by about 4 dB; all the way down takes about
  8 dB off.
- **Middle** (25 kΩ, linear): full up adds about 2.5 dB at 500 Hz; all the way down deepens the
  scoop to about 22 dB near 900 Hz.
- **Treble** (250 kΩ, linear, fed through 250 pF): full up adds about 4.5 dB at 5 kHz; all the
  way down takes about 7.5 dB off.

Here the stack is part of the circuit, driven by the follower's 615 Ω (Kuehnel's figure) and loaded by the
Master pot, not a separate filter; the tests check the network against Yeh and Smith's closed
form.

## The bass, the supply, and what it drives

The bass is the Buffer's pickup: its coil's resistance and inductance, its own capacitance and the
cable's, and its pots. The voltage your interface recorded is turned back into the current the
pickup drove into the recording's circuit (a Norton source, as the Phuzz does), and that current
drives the preamp's 1 MΩ: the pickup's resonance is the one it would have plugged into the amp.
A longer cable from the bass moves it down: 10 m against 1 m leaves 5 kHz about 9 dB darker.

The preamp's rail hangs from the 385 V supply through the dropper, held up by the 8 µF filter.
The three stages draw about 4.4 mA, so the dropper takes about 60 V. Playing hard changes what
they draw, and the rail moves with it, slowly (the dropper and the filter take a tenth of a
second or so). **B+** lowers everything: at 300 V the preamp's rail is about 250 V and the
output clips lower.

After the Master pot, the output drives a cable and an input. The stack and the pot drive them
from tens of kilohms: 30 m of cable takes about 10 dB off 3 kHz, and an input of 100 kΩ makes the
preamp about 3 dB quieter.

## Solving it

The circuit is a netlist for PhuzzBox's nodal DK solver (`native/core/include/phuzzbox/dk.h`;
Yeh, Abel, Vladimirescu and Smith 2010; Holters and Zölzer 2011), as the Wah is. Every capacitor
and the coil become, by the trapezoidal rule, a conductance and a current carried from the last
sample; the linear network (twenty nodes) is solved once, again whenever a knob moves; and each
sample only the three triodes' six port voltages (each grid and plate from its cathode) are
solved, by Newton's method, from the ports carried on in a straight line from the last two
samples. A step that would move a grid more than 2 V is shortened. Newton stops when its last
correction is under a millivolt: it converges quadratically, so what is left is about a
microvolt, on plates that swing by a hundred volts. The DC operating point, where the pedal
starts and rests, is the same Newton with the supply switched on in twenty steps.

The circuit runs at four times the host's rate between the same 8th-order Chebyshev filters as
the Phuzz's, so the harmonics clipping makes above 20 kHz are filtered rather than folded back.
**Quality** in a host: high is 4×, medium 2×, low 1×.

## The controls

- **The preamp**: Gain (the Bassman's Volume), Bass, Middle, Treble and Master, on its face.
- **Tubes**: which 12AX7, its emission, and the first stage's cathode capacitor. Below 1 µF it
  bypasses only the highs: under 100 Hz the stage loses about 5 dB of its gain, and the low notes
  push the next stage less hard.
- **Supply and cables**: B+, the dropper and the filter capacitor; the cables to and from the
  preamp, and the input it drives.
- **Your bass** and **How you are plugged in**: as in the Buffer.

## The views

- **The tubes**: each triode's plate current against the voltage across it, at grid voltages of 0
  to −4 V (the model's own curves), with its DC load line and its operating point. Play, and each
  one's trail runs along its load line, into the 0 V curve where the grid conducts and down to the
  axis where the tube cuts off.
- **The tone stack**: the preamp's small-signal gain from what your interface records to the
  output, and the stack and Master alone.
- **Scope** and **Spectrum**: the input and the output, as on every page (their own How it works tabs say how they are made).

## What to listen for

- **Clean and warm**, **Edge of break-up** and **Cranked**: the same circuit with more of the
  first stage reaching the second. Watch V2a's trail reach the 0 V curve and the axis.
- **Scooped** against **Mids forward**: the tone stack's two faces.
- **Tight (small cathode capacitor)**: the first stage gives the low notes less gain, so they
  break up later than the high ones.
- **Tired tubes, low rail**: less emission, less headroom, an earlier and softer break-up.

## What is simplified

- The triodes are fitted to static measurements: no transit time, and their capacitances are
  constants. The model's plate current depends on Vg + Va/µ, so with a grid driven hard positive
  from a low impedance it would let a plate go below its cathode; here every grid is fed through
  a stopper and that never happens, but it is a limit of the fit (measured above 20 V).
- Only the Normal channel is here: the Bassman's second channel and its volume pot, which load
  the 270 kΩ mixing resistor's far side, are left out, and so are the Bright channel's 100 pF.
- The first stage is a 12AX7 rather than the Bassman's 12AY7 (above), and has its own cathode
  resistor.
- There is no power amp, phase inverter or output transformer: the tone stack's output goes to
  the Master pot. A power amp with its transformer is a pedal of its own.
- The supply is a source behind a resistance: no rectifier, no choke, and the 385 V rail itself
  does not sag. The heaters are perfect, so there is no hum.
- The pots are ideal, and the audio tapers are the smooth curve (81^x − 1)/80.

## Files

```
preamp/index.html, style.css             page
preamp/src/preamp-params.js              parameters and presets
preamp/src/preamp-pedal.js               the descriptor: everything but the page
preamp/src/preamp-main.js                page wiring and views
preamp/src/preamp-tour.js                the guided tour
preamp/src/preamp-worklet.js             its AudioWorklet module
preamp/wasm/preamp.wasm                  built from the C++
native/pedals/preamp/                    the circuit and the engine in C++
native/core/include/phuzzbox/dk.h        the circuit solver, with its triodes
test/preamp-circuit.mjs                  the circuit solved independently, for the tests
test/preamp-tests.mjs                    node test/preamp-tests.mjs
```

## Prior art and references

* The circuit is the Fender Bassman 5F6-A's. Its values are from "Fender Bassman
  Guitar Amp", *Silicon Chip*, April 2024
  ([article](https://www.siliconchip.com.au/Issue/SC/2024/April/Fender+Bassman+Guitar+Amp)), and
  from Richard Kuehnel's *Circuit Analysis of a Legendary Tube Amplifier: The Fender Bassman 5F6-A*
  (Pentode Press, ISBN 978-0-9769822-1-0), whose operating points the tests compare with; his
  summary is at [ampbooks.com](https://www.ampbooks.com/mobile/classic-circuits/bassman-summary/).
* The first stage's values are the AB763's, from Rob Robinette's
  [How the AB763 Deluxe Reverb works](https://robrobinette.com/How_The_AB763_Deluxe_Reverb_Works.htm).
* Dempwolf, K. & Zölzer, U. (2011). "A physically-motivated triode model for circuit simulations."
  *Proc. 14th Int. Conf. on Digital Audio Effects (DAFx-11)*, Paris.
  [paper](https://dafx.de/paper-archive/2011/Papers/76_e.pdf). The triode's equations, the three
  12AX7s' parameters and its capacitances.
* Yeh, D. T. & Smith, J. O. (2006). "Discretization of the '59 Fender Bassman tone stack."
  *Proc. 9th Int. Conf. on Digital Audio Effects (DAFx-06)*, Montreal.
  [paper](https://dafx.de/paper-archive/2006/papers/p_001.pdf). The stack's values and its closed
  form.
* Yeh, D. T., Abel, J. S., Vladimirescu, A. & Smith, J. O. (2010). "Automated physical modeling of
  nonlinear audio circuits for real-time audio effects, Part I: theoretical development."
  *IEEE Trans. Audio, Speech, and Language Processing* 18(4), 728–737. The nodal DK method.
* Holters, M. & Zölzer, U. (2011). "Physical modelling of a wah-wah effect pedal as a case study
  for application of the nodal DK method to circuits with variable parts." *Proc. 14th Int. Conf.
  on Digital Audio Effects (DAFx-11)*, Paris.
* Rob Robinette's [How the TMB tone stack works](https://robrobinette.com/How_The_TMB_Tone_Stack_Works.htm)
  explains the stack's knobs and why they interact.
