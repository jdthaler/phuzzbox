# Scope

Every pedal's page has a scope: the voltage going into the pedal (dashed) and coming out of it
(solid), against time, on one scale, as an oscilloscope on a bench would show them with a probe
on each jack. A buffer's two lines lie on each other; a filter shifts the output in time and
changes its shape; a fuzz squares it off. Where the spectrum says which frequencies a pedal adds
or takes away, the scope shows what that does to the wave.

Part of [PhuzzBox](../README.md).

## What it shows

**Time** runs across ten divisions of 5 ms, 50 ms in all: two periods of a low E (24.3 ms each),
five of an open G. **Voltage** runs up and down, two divisions either side of zero, at 1, 2 or
5 × 10ⁿ volts a division, chosen so each trace's peak fits. A scale steps up at once when you dig
in, and back down only after a second of playing softer, so it doesn't pump; it never goes below
2 mV a division, so the hiss between notes stays small.

Both traces share one scale while the two want scales within 2.5 times of each other (one step of
1, 2, 5), so a pedal that passes the signal unchanged shows two lines on each other, and one that
doubles it shows the output twice as tall. When a pedal has more gain than that (the Tube Preamp's,
turned up), each trace gets its own scale, as the two channels of a bench scope do, and the label
says both: in so many volts a division, out so many.

The input is the line's voltage (the page converts the interface's numbers with the Full scale
setting). The output is the pedal's output in volts, before the Volume fader. The two come from
the browser's analysers (the Web Audio API's AnalyserNode), fed by the same pedal in the same
block of samples, so their newest samples are the same instant and the traces line up to the
sample.

## The trigger

A bass note repeats, so drawing each frame from the same point in its cycle stands the wave
still, as an oscilloscope's trigger does. The scope triggers on the input, the bass itself: it
looks back from the newest 50 ms for the last place the input rose through its level, half way
between its lowest and highest over the last 100 ms, and starts both traces there. Noise riding
on a slow edge would cross the level several times on one rise and make the trace jump; so a
crossing counts only if the input came up from a tenth of its swing below the level (hysteresis,
as in Schmitt's trigger). The crossing is found to a fraction of a sample, between the two samples
either side of it, so the trace doesn't jitter by a sample (21 µs at 48 kHz) from frame to frame.
With nothing to trigger on (silence, or a wave that never crosses its middle), the scope runs free
and shows the newest 50 ms.

Triggering on the input, rather than the output, keeps the note still whatever the pedal does to
it: a wah's output rings at its peak, many times faster than the note, and a trigger on it would
catch a different ring each frame. What a pedal does to the timing (a wah's phase shift near its
peak, a coupling capacitor's lead in the bass) shows as the solid output sliding against the
dashed input.

## What to look for

- **Buffer**: at its defaults the lines coincide; with a long cable the output loses the input's
  sharpest corners, the treble the cable's capacitance takes.
- **Wah**: the output rings at the peak's frequency, a faster wiggle on the slow wave of the note.
- **Phuzz**: the output is squared off, clipped on both sides, each flat top sagging as the
  output capacitor charges through the volume pot.

## How it is checked

`test/views-tests.mjs` gives the trigger sines whose rising crossings are known in closed form,
t = (2πk − φ) / ω, and checks that it finds the last one before the window to a thousandth of a
sample; that with noise on a slow sine, hysteresis of a tenth of the swing finds only the true
crossing where none would trigger on the noise; that a signal that never crosses its level gives
no trigger; that the volts a division are 1, 2 or 5 × 10ⁿ and never less than the peak needs; and
that the two traces share a scale within one step of each other and part beyond it.

## What is simplified

- A bench scope draws every sweep; this one draws one sweep a frame of the page (about 60 a
  second), the newest, so a single glitch between frames can be missed.
- One timebase, 5 ms a division. A five-string's low B (32.4 ms) shows once and a half.
- The trigger is on the input's rising edge only, at a level the scope sets itself.

## Files

```
shared/views.js            scopeView, trigger, niceRange and sharedScale
shared/shell.js            the analysers, and a Scope on every page that doesn't bring its own
test/views-tests.mjs       node test/views-tests.mjs
```

## Prior art and references

* Schmitt, O. H. (1938). "A thermionic trigger." *Journal of Scientific Instruments* 15(1),
  24–26. [doi:10.1088/0950-7671/15/1/305](https://doi.org/10.1088/0950-7671/15/1/305). The
  trigger with hysteresis, which keeps noise from firing it twice.
* W3C (2021). *Web Audio API*, "AnalyserNode". [w3.org/TR/webaudio](https://www.w3.org/TR/webaudio/).
  The time-domain data both traces are read from.
