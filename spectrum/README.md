# Spectrum

Every pedal's page has a spectrum: the voltage going into the pedal (dashed) and coming out of it
(solid), as the amplitudes of the sines that make them up, against frequency. A clean pedal's two
lines lie on each other wherever its circuit passes the signal unchanged; a filter lifts or
lowers the solid line where it acts; a distortion puts new peaks where the dashed line has none.
The green line is the note you are playing, as the [tuner](../tuner/README.md) hears it at the
input, and the ticks along the top are its harmonics, so the peaks that belong to the note can be
told from the rest.

Part of [PhuzzBox](../README.md).

## What it measures

A plucked string is, to a good approximation, a sum of sines, its partials, at f₁, 2f₁, 3f₁ and
so on (a little sharp of those, as the tuner's notes explain). The spectrum takes the newest
stretch of the signal and finds how much of each frequency it holds, with the discrete Fourier
transform:

  X[k] = (1/N) Σₙ w[n] x[n] e^(−2πi kn/N),   n = 0 … N − 1

The browser's analyser does this (the Web Audio API's AnalyserNode). Each frame of the page it
takes the newest N samples, multiplies them by a Blackman window

  w[n] = 0.42 − 0.5 cos(2πn/N) + 0.08 cos(4πn/N)

so the block fades in and out rather than starting and stopping with a step, transforms them,
and averages the magnitudes with the frame before: |X̂| ← 0.6 |X̂|ₚᵣₑᵥ + 0.4 |X|. At 60 frames a
second that average forgets with a time constant of 33 ms, so the plot follows a note's attack
without flickering. It plots 20 log₁₀ of the result.

**The numbers.** N is 8192 samples at 44.1 or 48 kHz (doubled at 88.2 or 96 kHz, and 32768 at
192 kHz), a block of 0.17 s, so the bins are 5.86 Hz apart at 48 kHz. The input and the output
have analysers made alike, so the two lines compare like with like.

**Calibration.** A sine of peak amplitude A, centred on a bin, gives |X| = A · a₀ / 2, where a₀ =
0.42 is the window's mean (its coherent gain): 13.56 dB under A. The plot adds those 13.56 dB
back, so it reads a partial's peak amplitude in dB of volts: **0 dBV is a sine of 1 V peak**, and
a bass's 0.3 V low E reads −10.5 dBV. The input is the line's voltage (the page converts the
interface's numbers with the Full scale setting); the output is the pedal's output in volts,
before the Volume fader.

**Resolution.** The window spreads a pure sine over a peak six bins wide (its first zeros are
three bins either side), so two partials closer than about 18 Hz merge into one. A low E's
harmonics are 41.2 Hz apart and stand clear of each other; two notes a semitone apart in the
bottom octave (41.2 and 43.7 Hz) do not, and the tuner is what tells them apart. A sine that
falls between two bins reads up to 1.10 dB low (the window's scalloping loss). Noise spreads over
every bin; each bin gathers it from 1.73 bins' worth of bandwidth, about 10 Hz.

**The axes.** Frequency is logarithmic from 30 Hz to 20 kHz, as the ear hears pitch: each octave
is the same width. Level is in decibels, because a bass's partials span 60 dB and more, from the
fundamental to the hiss.

## What to look for

- **Buffer**: at its defaults the lines coincide; turn Cable length up and the solid line falls
  away from the dashed in the treble, where the curve in The pickup's response falls.
- **Wah**: the harmonics near the peak ride above the dashed line, and slide as you rock it.
- **Phuzz**: harmonics all the way up, odd and even, far above the input's, where
  the clipping makes them.

## How it is checked

`test/views-tests.mjs` transforms sines of known amplitude and frequency, with a Blackman window
and the 1/N of the Web Audio specification written out in the test, and checks that a sine of
0.3 V peak on a bin reads −10.46 dBV after the calibration, that one half way between bins reads
1.10 dB low (the closed form of the window's transform), that it lands in bin f / (fs/N), and that
the window's mean is the 0.42 the calibration assumes.

## What is simplified

- The analyser averages magnitudes, not powers, from frame to frame; a steady tone reads the same
  either way, a changing one a little differently.
- A note that changes within the block (a slide, a bend, a pluck's first 0.17 s) is smeared over
  the frequencies it passes through: the spectrum is of the whole block.
- The output is the pedal's, before Volume and the safety curve at the speakers.
- Below 30 Hz is left off; a five-string's low B (30.9 Hz) sits at the edge.

## Files

```
shared/views.js            spectrumView: the plot, PEAK_DB the calibration
shared/shell.js            the analysers, and a Spectrum on every page that doesn't bring its own
shared/plot.js             freqAxes and markNote (the green line)
test/views-tests.mjs       node test/views-tests.mjs
```

## Prior art and references

* Harris, F. J. (1978). "On the use of windows for harmonic analysis with the discrete Fourier
  transform." *Proceedings of the IEEE* 66(1), 51–83.
  [doi:10.1109/PROC.1978.10837](https://doi.org/10.1109/PROC.1978.10837). The Blackman window's
  coherent gain, scalloping loss (1.10 dB) and noise bandwidth (1.73 bins).
* Blackman, R. B. & Tukey, J. W. (1958). *The Measurement of Power Spectra from the Point of View
  of Communications Engineering*. Dover. The window the analyser uses.
* W3C (2021). *Web Audio API*, "AnalyserNode" and "FFT Windowing and smoothing over time".
  [w3.org/TR/webaudio](https://www.w3.org/TR/webaudio/). The window, the 1/N, the smoothing and
  the decibels, as every browser computes them.
