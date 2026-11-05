// ringmod-tour.js — the guided tour of the Ring Modulator's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('ringmod', [
  {
    title: 'Sum and difference',
    views: ['Spectrum', 'The sidebands'],
    preset: 'Two octaves up: 220 Hz',
    bypass: true,
    play: [note('A1', { dur: 2.4, vel: 0.8 }), { at: 2.5, bypass: false }, note('A1', { at: 2.6, dur: 3, vel: 0.8 }), riff({ at: 6 })],
    text: `First the A string alone, then through the ring with a 220 Hz carrier. A product of two waves is their sum and their difference,

  cos(2πft) · cos(2πfct) = ½ cos(2π(f + fc)t) + ½ cos(2π(f − fc)t),

so the A at 55 Hz leaves at 165 Hz and 275 Hz, and neither 55 Hz nor 220 Hz comes out. In the **Spectrum** the note's line is gone and two stand either side of where the carrier would be. Here they happen to be the A's third and fifth harmonics, because the carrier is four times the note; the riff's other notes land between the harmonics and ring like bells.

![The Ring Modulator: four diodes in a ring between two centre-tapped transformers, the carrier into T1's centre tap](schematics/ring.svg)`,
  },
  {
    title: 'Four diodes make a switch',
    views: ['The ring', 'Scope'],
    preset: 'Two octaves up: 220 Hz',
    set: { carrier: 6, mix: 1 },
    play: [note('A1', { dur: 5, vel: 0.8 }), sweep('carrier', 6, 220, { at: 5, dur: 5, log: true }), note('A1', { at: 5, dur: 5, vel: 0.8 })],
    text: `The carrier slowed to 6 Hz so you can watch it. Driven positive, it pushes current through D1 and D3, 2.85 mA each at its 3 V peak, and a conducting diode is a small resistance: T1 is connected straight across to T2, and the bass passes. Driven negative, D2 and D4 conduct and cross the connections over: the bass comes out upside down. In **The ring** the lit pair alternates, and the dots run along w = +u, then w = −u.

The carrier's own current divides between the two halves of each winding in opposite senses, so its ampere-turns cancel and it never reaches the output: what comes out is the bass times the carrier's sign. Then the carrier sweeps back up to 220 Hz, the flips get faster than the bass, and the **Scope** shows a new waveform with neither's period.`,
  },
  {
    title: 'A square wave\'s harmonics',
    views: ['The sidebands', 'Spectrum'],
    preset: 'Square carrier',
    play: [note('A1', { dur: 4, vel: 0.8 }), riff({ at: 4.2 })],
    text: `Multiplying by the carrier's sign is multiplying by a square wave, whatever the carrier's shape, once it is strong enough. Through 600 Ω into 600 Ω it passes half, so the square is ±½, and its Fourier series is

  (2/π)(sin θ + ⅓ sin 3θ + ⅕ sin 5θ + …).

Each term moves the bass: f to fc ± f at (2/π) of its amplitude, −3.9 dB, and to 3fc ± f and 5fc ± f, a third and a fifth as loud. **The sidebands** draws the switching function above and those lines below, and the **Spectrum** shows them in what comes out.`,
  },
  {
    title: 'Below the knee: a multiplier',
    views: ['The sidebands', 'Spectrum'],
    preset: 'Two octaves up: 220 Hz',
    play: [sweep('carrierLevel', 3, 0.03, { at: 0.2, dur: 9, log: true }), sweep('level', 0, 22.3, { at: 0.2, dur: 9 }), riff({ times: 2 })],
    text: `Now the carrier falls from 3 V to 30 mV, with the Level brought up to keep the loudness. With no load and stiff sources the ring's equations solve exactly:

  tanh(w/nVT) = tanh(u/nVT) · tanh(vc/nVT),

a multiplier in tanh's terms. A strong carrier makes tanh(vc/nVT) = ±1, the switch; germanium's nVT is 41.1 mV, and a 30 mV carrier is inside it, where w = u·vc/nVT, the product itself. In **The sidebands** the switching function rounds from a square into a copy of the carrier, and the 3fc ± f lines sink until they are 38.9 dB below f ± fc. The product needs no harmonics of the carrier: only the sum and difference are left.`,
  },
  {
    title: 'A mismatched diode leaks',
    views: ['Spectrum', 'The sidebands'],
    preset: 'Leaky ring',
    play: [riff(), { at: 5, set: { mismatch: 0 } }, riff({ at: 5 })],
    text: `Matched diodes make the ring balanced: its equations are odd in the carrier and in the bass, so neither comes out alone. Here D1 needs 30 mV more than the others for the same current, and the balance is broken: 18.0 mV of the 3 V carrier whistles through at 220 Hz, the grey line in **The sidebands**, steady under every note in the **Spectrum**. Halfway the diodes are matched again and it is gone.

The leak almost doubles because of the transformers: a winding can hold no DC voltage, so each one's inductance carries the constant current that keeps the averages zero, and the ring settles round a different point.`,
  },
  {
    title: 'The transformers\' low end',
    views: ['Spectrum', 'Scope'],
    preset: 'Small transformers',
    play: [riff(), { at: 5, set: { inductance: 3 } }, riff({ at: 5 })],
    text: `Each transformer's magnetising inductance sits across its winding, against about 300 Ω either side of it. Below R/(2πL) it shunts the bass before it reaches the ring: at 0.3 H that is 160 Hz, so the low notes go in weak. Halfway the inductance goes to 3 H and the corner to 16 Hz, below the low B, and the low strings come back.`,
  },
]);
