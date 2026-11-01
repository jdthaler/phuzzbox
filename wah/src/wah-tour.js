// wah-tour.js — the guided tour of the Wah's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

// the rocker, heel to toe and back, `times` times over `dur` seconds from `at`
const rock = ({ at = 0, dur = 4, times = 1 } = {}) => Array.from({ length: times }, (_, i) => [
  sweep('position', 0, 1, { at: at + (i * dur) / times, dur: dur / times / 2, steps: 20 }),
  sweep('position', 1, 0, { at: at + ((i + 0.5) * dur) / times, dur: dur / times / 2, steps: 20 }),
]);

export const TOUR = tour('wah', [
  {
    title: 'A resonance under your foot',
    views: ['The sweep', 'Spectrum'],
    preset: 'Bass wah (22 nF)',
    set: { position: 0 },
    play: [note('A1', { dur: 7, vel: 0.85 }), rock({ at: 0.5, dur: 6 })],
    text: `![The wah: the coil L1 and sweep capacitor C3, two transistors, and the rocker's pot](schematics/circuit.svg)

A coil of half a henry and a capacitor make a resonance; two transistors make a loop that drives the capacitor's far end with a copy of its near end. From the coil, that capacitor looks (1 + A) times larger (the Miller effect), and the pot under your foot sets the loop's gain A:

  f ≈ 1 / (2π √(L C (1 + A)))

Toe down, A ≈ 0 and the peak is the coil and the 22 nF alone, near 1.5 kHz; heel down, the loop pushes hardest and the peak falls to about 290 Hz. One held note, rocked heel to toe and back: its harmonics light up one by one as the peak passes.`,
  },
  {
    title: 'Heel down, sharper',
    views: ['The sweep'],
    preset: 'Bass wah (22 nF)',
    set: { position: 1 },
    play: [riff(), { at: 5, set: { position: 0.05 } }, riff({ at: 5 })],
    text: `Toe down, then heel down. Watch the peak in **The sweep**: low and narrow at the heel, high and broad at the toe.

The loop that makes the capacitor look larger also cancels part of the damping, so the lower the peak goes the sharper it gets. What is left is mostly the resistor across the coil: the next step but one turns it. Heel down the loop gain is about 27, which pulls a guitar wah's 2.2 kHz down past 400 Hz.`,
  },
  {
    title: 'Swept low for bass',
    views: ['The sweep', 'Spectrum'],
    preset: 'Guitar wah as built (10 nF)',
    play: [riff(), rock({ dur: 5, times: 2 }), { at: 5, set: { sweepC: 22e-9 } }, riff({ at: 5 }), rock({ at: 5, dur: 5, times: 2 })],
    text: `The wah as it was built for guitar has a 10 nF sweep capacitor and sweeps about 430 Hz to 2.2 kHz: on a bass, that is above the notes' fundamentals, and it only works their upper harmonics.

Halfway, the capacitor becomes 22 nF. The resonance moves as 1/√C, so the whole sweep moves down by √2.2, to about 290 Hz–1.5 kHz, where a bass's own harmonics are strong. **Range** on the pedal's face is that capacitor.`,
  },
  {
    title: 'Q: the resistor across the coil',
    views: ['The sweep', 'Spectrum'],
    preset: 'Bass wah (22 nF)',
    set: { qR: 100e3 },
    play: [riff(), rock({ dur: 5, times: 2 }), { at: 5, set: { qR: 15e3 } }, riff({ at: 5 }), rock({ at: 5, dur: 5, times: 2 })],
    text: `A resistor across the coil damps the resonance. First 100 kΩ: little damping, a tall and narrow peak, the vocal *wow*. Then 15 kΩ: a broader, gentler peak, more a tone control than a voice.

The classic value is 33 kΩ. **Q** on the pedal's face is that resistor.`,
  },
  {
    title: 'Keeping the bottom',
    views: ['Spectrum', 'The sweep'],
    preset: 'Bass wah (22 nF)',
    set: { position: 0.5 },
    play: [riff(), { at: 5, set: { blend: 0.4 } }, riff({ at: 5 })],
    text: `Whatever the rocker does, the circuit leaves 100 Hz about 11 dB down, and a bass's fundamentals with it: through a wah alone, the low end goes.

Bass wahs add a **Clean blend** pot, which mixes the dry signal back in under the wah. Halfway it goes to 40 %: the bottom comes back, and the sweep rides on top of it.`,
  },
  {
    title: 'Plugged in backwards',
    views: ['The sweep', 'Spectrum'],
    preset: 'Plugged in backwards',
    set: { position: 0 },
    play: [
      sweep('position', 0, 0.85, { at: 0.5, dur: 6, steps: 40 }),
      sweep('position', 0.85, 0, { at: 7, dur: 3, steps: 20 }),
      riff({ at: 10.5 }),
    ],
    text: `Your bass into the wah's output jack, its input jack to the amp. The signal runs the loop the other way, from the pot's wiper through Q2 and the coil to Q1's base, and out of the input jack. But Q1 still drives the output jack, where the pickup's coil now hangs, and the coil's inductance turns the loop's phase round: from a passive bass, the loop oscillates on its own.

That is the seagull of a wah plugged in backwards. Heel down it squeals near 880 Hz; rocked forward it climbs to 1.16 kHz by 60 % and fades, and past about three quarters of the travel it stops. Then the riff, heel down: the notes shake the squeal rather than replacing it. Bypassed, the true-bypass switch joins the jacks, and it plays the same either way round. From an active bass it would not squeal at all.`,
  },
]);
