# Metronome

Every page has a metronome under the pedal, beside the tuner: turn it on with **Metronome** under
the pedal's footswitch. It ticks on each beat and rings a bell on the first beat of each bar, from
30 to 250 beats a minute. Set the tempo with − and + (Shift for five at a time), by typing it, or
by tapping **Tap** on the beat a few times. The clicks go to the speakers after the pedal, under the
master volume, so they never pass through the fuzz; **Level** sets how loud they are.

Part of [PhuzzBox](../README.md).

## The physics

Nothing here is a recording. The tick and the bell are two bars, struck at one end, as a clockwork
metronome has an escapement that knocks on its wooden case and a bell on the first beat of the bar.

**A bar free at both ends** bends in modes whose shapes satisfy the Euler–Bernoulli beam equation;
the ends being free (no bending moment, no shear) leaves the roots of

  cos(βL) cosh(βL) = 1

with βL = 4.730, 7.853, 10.996, 14.137 for the first four. Each mode rings at

  fₙ = (βₙL)² / (2π L²) · √(E I / ρ A),   I / A = t² / 12 for a bar of thickness t,

so the modes stand in the ratios 1 : 2.756 : 5.404 : 8.933, far from a harmonic series, which is
why a struck bar clicks or chimes rather than sounding a note with a pitch like a string's.

- **The tick** is a maple block 150 mm long and 8 mm thick (E = 12.6 GPa, ρ = 705 kg/m³):
  its first mode is at 1545 Hz.
- **The bell** is a steel bar 80 mm long and 4 mm thick (E = 200 GPa, ρ = 7850 kg/m³): 3243 Hz.

**Damping.** Each material loses a fraction η of its energy each radian (its loss factor), so a
mode decays as e^(−t/τ) with τ = 1 / (π f η): maple at η = 0.02 gives the first mode 10.3 ms, a
dry knock; steel at η = 0.0003 gives 0.33 s, a ring. The higher modes, at higher frequencies, die
sooner.

**The strike.** The bar is struck at its end, where every mode moves alike. The beater stays in
contact for a while (0.2 ms on the maple, 0.1 ms on the steel), pushing with a half-sine of force,
whose spectrum relative to its value at zero frequency is

  |F(f)| / F(0) = cos(π f T) / (1 − (2 f T)²),

which falls past about 1.5 / T: a longer contact, a softer beater, a duller click. Each mode
starts with that share and rings at its frequency with its decay; the page adds them up once, at
the audio's sample rate, and plays the result on each beat.

**The pendulum.** A metronome's beat comes from a pendulum upside down: a bob of 60 g fixed 45 mm
below the pivot and a weight of 30 g you slide along the rod above it. For small swings its
period is that of a compound pendulum,

  T = 2π √((M r_M² + m r_m²) / (g (M r_M − m r_m))),

and it beats each way, so a beat is half a period. Raising the weight adds to the moment of
inertia and takes from the restoring torque, both of which slow it, which is why the tempos on a
metronome's scale run slowest at the top. The drawing puts the weight where this formula says
the tempo needs it: 87 mm above the pivot at 30 a minute, 15 mm at 250. The rod reaches the end of
its swing on each beat.

## The timing

The clicks are scheduled on the audio clock a little ahead (0.15 s), a window at a time, so the
beat stays steady whatever else the page is doing. A new tempo starts from the next beat and keeps
its place in the bar; a new number of beats a bar starts the bar, with the bell, on the next beat.
Tapping takes the median of the last few intervals between taps.

## What is simplified

- The bars' modes are Euler–Bernoulli's: a thin bar, without the shear and rotary inertia that
  Timoshenko's theory adds, which lowers the higher modes of a thick bar by a few per cent.
- Only bending modes, the first four; no torsion, and no case or room around the bars.
- The loss factor is the same for every mode of a material.
- The pendulum is drawn with point masses on a massless rod, for small swings: a real one's rod
  has mass, and its wider swing (some 30 degrees) beats a little slower than small swings would.
  The beat itself is the page's clock, not the pendulum's.

## Files

```
shared/metronome.js        the bars' modes, the strike, the pendulum, the beats
shared/metronome-card.js   its card under the pedal: the controls, the scheduling, the drawing
test/metronome-tests.mjs   node test/metronome-tests.mjs
```

## Prior art and references

* Fletcher, N. H. & Rossing, T. D. (1998). *The Physics of Musical Instruments*, 2nd ed.
  Springer. The bending modes of a bar with free ends, their ratios 1 : 2.756 : 5.404 : 8.933,
  and the bars of the xylophone and the glockenspiel.
* The compound pendulum's period, T = 2π √(I / (m g d)), is in any mechanics text (e.g. Kleppner,
  D. & Kolenkow, R., *An Introduction to Mechanics*).
