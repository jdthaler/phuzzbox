# Test bass

A bass guitar made of physics, so the pedals have something to play when nothing is plugged in,
and the tests and demos have a signal that is physics end to end rather than a recording. It is
not a pedal: it sits where your instrument would, and every pedal page can play it from the
computer keys or the fretboard on screen. Its six-string sibling is the
[test guitar](../testguitar/README.md), the same model with a guitar's strings, pick and pickup.

## The physics

Four steel-cored strings (E1 A1 D2 G2) on a 34-inch (0.864 m) scale. Each is a sum of its
transverse modes, stretched by the core's bending stiffness:

  fₙ = n f₀ √(1 + B n²),   B = π³ E d⁴ / (64 T ℓ²)

with E = 200 GPa, the core diameter *d* (1.0, 0.85, 0.65 and 0.5 mm), the tension *T* (190, 200,
190 and 170 N) and the vibrating length ℓ, which a fret shortens. The open E has B ≈ 6.8 × 10⁻⁴,
so its 20th partial is about 200 cents sharp of 20 × f₁. Each note is tuned so its first partial
is the equal-tempered pitch.

A finger plucks the string from rest at 12 cm from the bridge, as a triangle whose modal
amplitudes are

  aₙ = 2 ℓ² / (n² π² xₚ (ℓ − xₚ)) · sin(nπ xₚ / ℓ)

per metre of pull, smoothed by a finger 1.5 cm wide. A firm pluck pulls the string 2 mm. Each mode
decays at σ(f) = b₁ + b₃ f², with b₁ = 1 s⁻¹ and b₃ = 4 × 10⁻⁶ s, after Chaigne and Askenfelt:
the open E's fundamental rings for about 7 s (T60), the upper partials far less. Lifting the
finger off a fretted note mutes it at 60 s⁻¹ (−40 dB in about 0.1 s).

The pickup, 16 cm from the bridge and 2 cm wide, hears the string's velocity over its aperture
and turns it into an EMF at 0.3 V per m/s, so a firm pluck of the open E peaks around 190 mV, as a
passive bass does. That EMF goes through the pickup's own circuit into 3 m of cable and a 1 MΩ
input (the Buffer's circuit, phuzzbox/pickup.h): the signal an audio interface records.

## Sliding

Hold a fret and move the finger along the string, and the note goes with it. Drag along a string on
the fretboard, or hold a key and press another on the same row (the note slides there in 0.15 s
and back when the second key lets go). The string the finger stops is

  ℓ = ℓₛ 2^(−fret/12)

long, so every mode's frequency, decay and what the pickup hears of it move with the finger. What
stays is each mode's **action**, its energy over its frequency: when a vibrating system changes
slowly against its period, E/ω is an adiabatic invariant (Landau and Lifshitz). A mode's energy is
½ (μℓ/2) ω² A², so the action goes as ℓωA². On a flexible string ℓω is the same at every length
(ω = (π/ℓ)√(T/μ)), so the mode's displacement A carries through the slide unchanged; a stiff string's
upper partials stretch more as it shortens (B goes as 1/ℓ²), and the model keeps the action, so
they come out a fraction of a percent smaller. The
energy does not: slid up an octave, each mode has twice the energy it had, the work the finger does
against the string's tension. The pickup hears velocity, ωA, so a note slid an octave up is louder,
as on a real bass, and it is the open string's pluck (its shape, its pick position) heard at the
twelfth fret, not a fresh pluck there (the tests hold the slid note against the formula for aₙ
at both lengths).

The finger moves at a steady speed along the neck, its distance from the nut, ℓₛ(1 − 2^(−fret/12)),
linear in time, so the frets go by faster as it climbs. On a fretted bass the string is stopped by
a fret, not the finger: the pitch stays on one fret's equal-tempered note until the finger crosses
the next fret wire, halfway along, and steps there. **Fretless** takes the frets away (the board
shows only the lines where they were), and the note glides through every pitch between, as on a
fretless bass or under a guitar's slide bar.

## Bending

Drag across a string on the fretboard, up or down, and the finger pushes it across the neck: a drag
of one string's row on screen pushes it one string's spacing at the bridge (19 mm on the bass,
10.5 mm on the guitar). Pushed a distance δ at the fret, a from the nut and ℓ from the bridge, the
string from the nut to the bridge (L) is stretched by

  ΔL = √(a² + δ²) − a + √(ℓ² + δ²) − ℓ

and its tension rises by E A ΔL / L, with A the steel core's section (a winding adds mass, not
stiffness, as for the inharmonicity). The note goes up as √(T′/T), and B, which goes as 1/T, falls a
little. What sets the bend is the core's stiffness against the tension, E A / T, and the length:
the bass's G (a 0.5 mm core at 170 N) pushed 10 mm at the 7th fret goes up 0.58 semitones, the
guitar's plain G (0.432 mm at 73.8 N, on a shorter neck) 1.67, and the bass's E, a 1 mm core at
190 N, bends far more than its G. A drag of one row bends either G about two semitones there.
Near the nut a is short, and a small push is a big bend; an open string has nothing to push against
and does not bend, and no string is pushed past 1.5 × its tension (about three and a half
semitones). The note follows the finger with a 5 ms time constant, and a
string pushed before it is plucked plays bent.

The bend keeps each mode's action, as a slide does. The length is fixed, so a mode's displacement
goes as 1/√f, and what the pickup hears of it, its velocity, as √f: a note bent up a whole tone is
about 6 % louder, and let back it is the note it was.

## What is simplified

- One polarisation per string, no coupling between strings, no fret buzz or string–fret contact.
- The string's stiffness comes from its steel core alone, with core diameters and tensions typical
  of a medium round-wound set rather than measured.
- The pickup is linear: the field's nonlinearity (Horton and Moore) is left for later.
- No body or neck resonances.
- A slide moves only the pitch: each mode keeps its displacement as if the change were slow, though
  0.15 s is only a few periods of a low note, so the energy a fast slide moves between modes, the
  scrape of the finger or bar on the winding and the tension a finger adds by pressing are left
  out.
- A bend stretches the string from the nut to the bridge as two straight lines from the finger:
  the fret's friction, the string's bending stiffness where the finger presses it, and the few
  hundredths of a percent it lengthens the vibrating part are left out.
- Sliding down adds no modes above those the pluck had, and a mode slid above half the sample rate
  falls silent rather than aliasing.

## Files

```
native/sources/testbass/   the strings, the pluck and the pickup in C++
testbass/wasm/testbass.wasm   built from it
shared/testbass.js         the class the pages, tests and tools play
test/testbass-tests.mjs    node test/testbass-tests.mjs
test/slide-tests.mjs       node test/slide-tests.mjs
```

## Prior art and references

* Fletcher, H. (1964). "Normal vibration frequencies of a stiff piano string." *J. Acoust. Soc.
  Am.* 36, 203–209. [doi:10.1121/1.1918933](https://doi.org/10.1121/1.1918933). The
  inharmonicity coefficient B.
* Chaigne, A. & Askenfelt, A. (1994). "Numerical simulations of piano strings. I. A physical model
  for a struck string using finite difference methods." *J. Acoust. Soc. Am.* 95, 1112–1118.
  [doi:10.1121/1.408459](https://doi.org/10.1121/1.408459). The frequency-dependent loss
  σ = b₁ + b₃ω².
* Landau, L. D. & Lifshitz, E. M. (1976). *Mechanics*, 3rd ed. (Course of Theoretical Physics,
  vol. 1), §49, "Adiabatic invariants". Pergamon. Why a slowly slid string keeps E/ω.
* Fender's specifications of the string spacing at the bridge: ¾ inch on a Precision Bass, 2 1/16
  inches from E to E on a Stratocaster. Only how far a drag on screen pushes a string.
* Horton, N. G. & Moore, T. R. (2009). "Modeling the magnetic pickup of an electric guitar."
  *Am. J. Phys.* 77(2), 144–150. [doi:10.1119/1.2990663](https://doi.org/10.1119/1.2990663).
