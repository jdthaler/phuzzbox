# Tuner

Every page has a tuner, under the pedal at the left. It reads whatever is coming in, your bass through the
interface or the test bass, and shows the nearest note and how far from it the string is, in
cents, against a reference A4 you can set (440 Hz unless you change it). It is not a pedal: it
listens to the input before the pedal (after the [rig](../rig/README.md)'s units, with your interface), so a fuzz or a wah doesn't move the needle. **Mute** silences the output, as a tuner pedal does, and the tuner still hears the input.

Part of [PhuzzBox](../README.md).

## The physics

A bass string is stiff, so its partials are not whole multiples of the first. The steel core
resists bending, which adds a restoring force that grows with the curvature, and the higher modes
bend more:

  fₙ = n f₁ √(1 + B n²) / √(1 + B),   B = π³ E d⁴ / (64 T ℓ²)

(Fletcher 1964). For a steel core 1.0 mm across at 190 N on a 34-inch scale, the low E's B is
6.8 × 10⁻⁴, and its 20th partial is about 200 cents sharp of twenty times the first. The string is
tuned by its first partial: that is the pitch an electronic tuner, a piano tuner and the ear
match.

A tuner that measures the waveform's **period** finds a compromise among all the partials, and
on a stiff low E it reads sharp: in the tests, a low E with that B and partials falling as 1/n
has a period 23 cents sharp of its first partial. So this one works in two steps:

1. **The period, to name the note.** The normalised autocorrelation of the newest 8192 samples,
   averaged down to about 12 kHz (a bass's fundamentals are under 500 Hz), finds the lag of the
   first peak within 90 % of the highest, between 30 and 500 Hz, with a parabola through it for
   the fraction of a sample. Below a correlation of 0.6, or in near silence, there is no note.
   Taking the first strong peak rather than the highest keeps a low E whose fundamental is weak
   from reading as the octave above.
2. **The first partial, to tune it.** The peak of the Hann-windowed Fourier transform of the
   whole block (16384 samples, a third of a second at 48 kHz), searched within ±3 % of the
   period's estimate on three ever finer grids, and then a parabola through the logarithms of the
   powers at the best point and its neighbours, which is exact for a Gaussian peak and within a
   hundredth of a cent for Hann's.

A block that starts in the silence before a pluck has a step in it, and the step's spectrum would
pull the peak by tens of cents. So the tuner reads only the part since the note began: from 5 ms
after the first sample above a tenth of the block's peak, past the finger's scrape. When that is
under half the block, the note is too new to read, and it waits: the first reading comes about
0.2 s after a pluck.

The cents are 1200 log₂(f / f_note), with f_note = A4 · 2^((key − 69)/12) in equal temperament.

## The needle

Ten readings a second. The needle shows the median of the last three, so a single stray reading
(an octave, a scrape) is outvoted, and while the note holds, an exponential average of the cents
(each reading moves it 40 % of the way), so it settles rather than jitters. Within ±3 cents it
turns green. When the signal stops, the last note stays on screen for 1.5 s, dimmed, then clears.
The open strings of four-, five- and six-string basses (B0 E1 A1 D2 G2 C3) are named as such.

## A guitar

Set for a guitar (the Rig's **Instrument**), the tuner looks for notes from 60 to 1400 Hz, from
drop C's low C (65 Hz) to the high E's 24th fret (1319 Hz), where a bass's range stops at 500 Hz.
It names the open strings of six- and seven-string guitars (B1 E2 A2 D3 G3 B3 E4). The method is
the same; a guitar's thinner strings are less stiff (the low E's B is about 1.4 × 10⁻⁴), so its
period and its first partial are closer.

## How well it reads

The tests (`test/tuner-tests.mjs`) check it against tones whose frequencies are known in closed
form: harmonic series on every open string from B0 to C3, detuned by −14 to +31 cents, read to a
tenth of a cent; a low E with its fundamental 20 dB under the octave still reads E1; the stiff
low E above reads its first partial to a hundredth of a cent where its period is 23 cents sharp;
and the test bass's open strings read in tune to a fifth of a cent from the pluck to the decay.
Set for a guitar, it reads harmonic series from C2 to E6 to a tenth of a cent, and the test
guitar's open strings and its high E's 12th fret in tune to a fifth of a cent.
Silence and white noise read no note.

## What is simplified

- One note at a time: a chord reads as whichever note the autocorrelation finds.
- Below 30 Hz there is no reading, so a five-string's low B (31 Hz) is near the edge, and a
  string tuned down past it reads nothing.
- Equal temperament only; the reference A4 can move from 415 to 466 Hz.

## Files

```
shared/tuner.js            detectPitch, refine, tune, noteOf and the Tuner's smoothing
shared/shell.js            the tuner's card on every page
test/tuner-tests.mjs       node test/tuner-tests.mjs
```

## Prior art and references

* Fletcher, H. (1964). "Normal vibration frequencies of a stiff piano string." *J. Acoust. Soc.
  Am.* 36, 203–209. [doi:10.1121/1.1918933](https://doi.org/10.1121/1.1918933). The
  inharmonicity coefficient B.
* de Cheveigné, A. & Kawahara, H. (2002). "YIN, a fundamental frequency estimator for speech and
  music." *J. Acoust. Soc. Am.* 111(4), 1917–1930.
  [doi:10.1121/1.1458024](https://doi.org/10.1121/1.1458024). Why a pitch detector takes the
  first strong peak of the autocorrelation rather than the highest.
* The Hann window and the parabolic interpolation of a spectral peak's log magnitudes are in any
  digital signal processing text (e.g. Smith, J. O., *Spectral Audio Signal Processing*, "Quadratic
  Interpolation of Spectral Peaks").
