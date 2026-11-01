# Test guitar

An electric guitar made of physics, the test bass's sibling, so a guitarist has something to play
through the pedals when nothing is plugged in. Choose **Guitar** as the instrument (in the Rig,
or beside the fretboard) and the fretboard on screen becomes six strings, the computer keys play
them, and the pedals that model a pickup or were built for a bass's range take a guitar's values.
It is not a pedal: it sits where your instrument would.

## The physics

It is the [test bass](../testbass/README.md)'s model with a guitar's numbers: six steel strings
(E2 A2 D3 G3 B3 E4) on a 25.5-inch (0.648 m) scale, each a sum of its transverse modes, stretched
by the core's bending stiffness:

  fₙ = n f₀ √(1 + B n²),   B = π³ E d⁴ / (64 T ℓ²)

with E = 200 GPa. The strings are a 10–46 set at the tensions D'Addario lists for this scale:
17.0, 19.0, 18.4, 16.6, 15.4 and 16.2 lb, low to high (75.6, 84.5, 81.8, 73.8, 68.5 and 72.1 N).
The top three are plain steel, so their cores are their whole gauges (0.432, 0.330 and
0.254 mm); the bottom three are wound, and only their cores (0.46, 0.40 and 0.33 mm) resist
bending. The open low E has B ≈ 1.4 × 10⁻⁴, so its 20th partial is about 46 cents sharp of
20 × f₁; the plain G, thick for its pitch, has B ≈ 1.1 × 10⁻⁴, and the high E only 1.3 × 10⁻⁵.
Each note is tuned so its first partial is the
equal-tempered pitch. A plain string's tension says its gauge is right: T = μ(2ℓf)², with
μ = ρπd²/4 for steel (7850 kg/m³), gives 72.6 N for the high E against the 72.1 N listed.

A pick plucks the string from rest 12 cm from the bridge, as a triangle whose modal amplitudes are

  aₙ = 2 ℓ² / (n² π² xₚ (ℓ − xₚ)) · sin(nπ xₚ / ℓ)

per metre of pull, smoothed by the pick's edge, 3 mm wide where a finger is 15 mm: a pick is
brighter than a finger because it leaves the high modes in (the smoothing is sinc(kw/2), so at
the open low E's 60th partial, near 5 kHz, the pick keeps 8.2 dB more than a finger would). A firm pick pulls the string 1 mm.
The losses are the test bass's, σ(f) = b₁ + b₃ f² with b₁ = 1 s⁻¹ and b₃ = 4 × 10⁻⁶ s: the open
low E's fundamental rings for about 6.7 s (T60), the open high E's for about 4.8 s. Lifting the
finger mutes a note at 60 s⁻¹.

The pickup is a single coil in the middle position, 10 cm from the bridge and 1.5 cm wide, hearing
the string's velocity over its aperture as an EMF of 0.25 V per m/s, so a firm pick of the open
low E peaks around 120 mV and the open high E around 450 mV. Its circuit is the Buffer's
(phuzzbox/pickup.h): 2.5 H and 6 kΩ, 100 pF of its own, a 250 kΩ volume pot and a 250 kΩ tone pot
to ground (125 kΩ), 3 m of cable at 100 pF/m into 1 MΩ. Its resonance is

  f = 1 / (2π √(L C)) = 1 / (2π √(2.5 H × 400 pF)) ≈ 5.0 kHz

above a bass's P pickup (3.6 H, about 4.2 kHz into the same cable), which is much of why a guitar
pickup sounds brighter.

## Playing it

The rows of letter keys are its strings, as tablature has them: the Z row the low E, then the A
row, the Q row and the numbers, from the open string up nine frets. A keyboard has four rows and a
guitar six strings, so holding **Shift** moves the rows up two strings: the Z row is then the D
string and the numbers the high E. The fretboard on screen has all six. **Play a riff** plays
the test bass's riff an octave up, where a guitar has it.

The guided tours are written for the bass, about its notes: a tour plays the test bass, and the
guitar comes back when it ends.

## What changes for a guitar

Each pedal keeps its settings for the bass and for the guitar apart, and starts the guitar's from
its own defaults with a guitar's values where the circuit cares:

- **Your guitar's pickup**: the Buffer, the Phuzz, the Wah and the Tube Preamp model the pickup
  as part of their circuits (they load it, or take the cable off it), so they start from this
  single coil rather than the bass's P pickup.
- **Ranges built for a bass**: the Wah's sweep capacitor goes back to the 10 nF it was built
  with for guitar; the Envelope Filter's range capacitors to 15 nF, a guitar's range (317 Hz to 4.8 kHz);
  the Octave Down's tracking filter up to 150 Hz, which takes the low E's second harmonic off
  as 70 Hz does a bass's; the Cabinet becomes a 4 × 12 closed back of 12-inch guitar drivers.
- **The tuner** reads from 60 to 1400 Hz (a bass's tuner stops at 500 Hz) and names the open
  strings of six- and seven-string guitars (B1 E2 A2 D3 G3 B3 E4).

The rest of the pedals (the reverbs, the echo, the compressor, the rotary speaker and the others)
are the same for any instrument, so they keep one set of settings' defaults for both.

## What is simplified

- As the test bass: one polarisation per string, no coupling between strings, no fret buzz, a
  linear pickup, no body or neck resonances.
- The wound strings' cores are typical of a 10–46 set rather than measured; their windings add
  mass, not stiffness.
- The pickup hears every string alike: a real one's pole pieces are staggered to even out the
  strings' different pulls on its field.
- One pickup, in one place; no selector, no humbucker.
- The pickup's circuit is discretised by the bilinear transform, matched at its resonance: it is
  within 0.2 dB of the circuit to 6 kHz, and a decibel low by 8 kHz.

## Files

```
native/sources/testbass/   the strings, the pluck and the pickup in C++ (bass and guitar)
testbass/wasm/testbass.wasm   built from it
shared/testbass.js         the class the pages, tests and tools play
shared/instruments.js      the instruments' strings, the tuner's ranges, the guitar's pickup
test/testguitar-tests.mjs  node test/testguitar-tests.mjs
```

## Prior art and references

* Fletcher, H. (1964). "Normal vibration frequencies of a stiff piano string." *J. Acoust. Soc.
  Am.* 36, 203–209. [doi:10.1121/1.1918933](https://doi.org/10.1121/1.1918933). The
  inharmonicity coefficient B.
* Chaigne, A. & Askenfelt, A. (1994). "Numerical simulations of piano strings. I. A physical model
  for a struck string using finite difference methods." *J. Acoust. Soc. Am.* 95, 1112–1118.
  [doi:10.1121/1.408459](https://doi.org/10.1121/1.408459). The frequency-dependent loss
  σ = b₁ + b₃ω².
* Horton, N. G. & Moore, T. R. (2009). "Modeling the magnetic pickup of an electric guitar."
  *Am. J. Phys.* 77(2), 144–150. [doi:10.1119/1.2990663](https://doi.org/10.1119/1.2990663).
* D'Addario EXL110 (10–46) gauges and tensions at a 25.5-inch scale, as listed at
  [Just Strings](https://juststrings.com/dad_exl110.html).
