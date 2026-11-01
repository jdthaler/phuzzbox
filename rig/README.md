# Rig

The foot of every page is your rig: what comes before and after the pedal you are trying.

- **Its bar** has the input (the test bass or guitar, or one of your interface's inputs, and
  which channel), the output (on Chrome and Edge, any of your outputs: choose the interface itself,
  and the browser need not resample between two devices' clocks), the **Master** volume after the
  pedal and the metronome, and the latency, which you can measure with a cable from the output back
  to the input.
- **With the test bass or guitar**, its fretboard is under the bar. They are clean, so they skip
  the rest.
- **With your interface**, the units come in a row, from the jack to the pedal: the interface
  itself, then five small boxes, each with its own footswitch. Their settings are the same on every
  page, as a board's first pedals stay put while you swap the one you are trying.

Part of [PhuzzBox](../README.md).

## The interface

Choose your interface and its gain, and the page works out **Full scale** (how many volts at the
input jack make a full-scale sample) from the maker's specification; or type it in. Every pedal
works in volts, as a circuit does, so a fuzz needs to know how hard your bass really drives it.
Set it so your bass and the test bass read alike on the pedal's In meter. **Instrument** is bass
or guitar: the tuner's range, and the pedals' settings for each.

## The units

They work in volts, after the interface and before the pedal, in this order.

**Gain** is an ideal amplifier: the volts times 10^(G/20), so 6 dB is twice the volts. Turn a
quiet bass up to match a hot one, or drive the pedals harder.

**Hum filter.** Mains hum is the mains frequency (60 Hz in North America, 50 Hz in Europe and most
of the rest of the world) and its harmonics; a ground loop hums at the first few, and a single
coil's buzz reaches up through many. The filter puts a notch at each of the first **Harmonics**
of them, each the analog band-reject

  H(s) = (s² + ω₀²) / (s² + (ω₀/Q) s + ω₀²),   Q = f₀ / Width,

whose −3 dB points are f₀ (√(1 + 1/4Q²) ± 1/2Q): exactly **Width** apart. A notch rings for about
1/(π Width), 0.16 s at 2 Hz, so a narrow notch takes a moment to settle on a hum, and leaves the
notes beside it alone: at 2 Hz wide, the B on the A string (61.7 Hz), nearest the 60 Hz notch,
loses about a decibel and a quarter; the D (73.4 Hz) loses three hundredths.

**Gate.** A rectifier charges a capacitor in 0.1 ms and lets it go over 50 ms: a peak detector,
which follows the notes and ignores the gaps between a note's cycles (a low E's period is 24 ms).
When it rises above **Threshold** the gate opens, in 1 ms; when it falls below half the threshold
(6 dB lower, so a note dying away doesn't chatter at the edge) it closes, its gain falling as
e^(−t/τ) with τ = **Release**. Set the threshold just above what you hear with the strings muted.

**EQ.** Three second-order sections, each the bilinear transform of an analog original prewarped
at its frequency, so it is exactly that original at every frequency, the frequency axis bent
toward the top (Ω = tan(πf/fs) / tan(πf₀/fs)):

- **Bass**, a shelf at 80 Hz (Butterworth, Q = 0.707): its full boost or cut at the bottom,
  half of it in decibels at 80 Hz, none above a few hundred.
- **Mid**, a bell at **Mid frequency** (Q = 0.9, about an octave and a half), its full boost or cut
  at the centre: 200–300 Hz is the body of the notes, 700 Hz–1 kHz their growl, 2–3 kHz the click
  of the strings.
- **Treble**, a shelf at 4 kHz, the same shape turned over.

With A = 10^(G/40) for a gain of G dB, the shelf is H(s) = A (s² + (√A/Q)s + A) / (A s² + (√A/Q)s + 1)
and the bell H(s) = (s² + (A/Q)s + 1) / (s² + s/(AQ) + 1), with s in units of the section's ω₀.
They are what an active bass's or a mixer's op-amp tone stages approximate, rather than a
particular circuit's.

**Compressor.** A peak detector that charges with **Attack** and lets go with **Release** (each a
time constant: 63 % of the way in that long), and a gain computer: over **Threshold**, the level in
decibels comes down by (1 − 1/**Ratio**) of the excess, so at 4 : 1 a note 12 dB over comes out
3 dB over. **Makeup** turns the result up again. A passive bass peaks around 0.1–1 V, so a
threshold of 100 mV catches most notes. For a compressor modelled as a circuit, light and all, try
the [Opto Compressor](../opto/README.md).

## What is simplified

- The units are ideal: no noise, no clipping, no circuit's own colour. They are what you would put
  before a pedal to set it up, not pedals to listen to.
- The gate and the compressor read the peak of the signal, not its RMS, with a hard knee.
- The hum filter is linear and fixed: it doesn't follow a mains frequency that drifts (it does by
  a few hundredths of a hertz), which is what Width is for.
- The test bass and guitar skip the units: they have no hum, and their level is the model's.

## Files

```
shared/rig.js              the units: their parameters and their signal processing
shared/rig-panel.js        their boxes at the foot of the page
shared/shell.js            the rig's bar: the input, the output, the master volume, the latency
shared/worklet.js          runs them on the interface's input, before the pedal
test/rig-tests.mjs         node test/rig-tests.mjs
```

## Prior art and references

* Bristow-Johnson, R. "Cookbook formulae for audio equalizer biquad filter coefficients." Published
  by the W3C as the [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/). The shelves, the
  bell and the notch, and their bilinear transforms.
* Giannoulis, D., Massberg, M. & Reiss, J. D. (2012). "Digital Dynamic Range Compressor Design —
  A Tutorial and Analysis." *J. Audio Eng. Soc.* 60(6), 399–408. The compressor's gain computer and
  its branching peak detector.
