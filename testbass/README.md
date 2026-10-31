# Test bass

A bass guitar made of physics, so the pedals have something to play when nothing is plugged in,
and the tests and demos have a signal that is physics end to end rather than a recording. It is
not a pedal: it sits where your instrument would, and every pedal page can play it from the
computer keys or the fretboard on screen.

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

## What is simplified

- One polarisation per string, no coupling between strings, no fret buzz or string–fret contact.
- The string's stiffness comes from its steel core alone, with core diameters and tensions typical
  of a medium round-wound set rather than measured.
- The pickup is linear: the field's nonlinearity (Horton and Moore) is left for later.
- No body or neck resonances.

## Files

```
native/sources/testbass/   the strings, the pluck and the pickup in C++
testbass/wasm/testbass.wasm   built from it
shared/testbass.js         the class the pages, tests and tools play
test/testbass-tests.mjs    node test/testbass-tests.mjs
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
