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
    text: `A coil of half a henry and a capacitor make a resonance; two transistors make a loop that drives the capacitor's far end with a copy of its near end. From the coil, that capacitor looks (1 + A) times larger (the Miller effect), and the pot under your foot sets the loop's gain A:

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
    title: 'Auto: rocked by how hard you play',
    views: ['The sweep', 'Scope'],
    preset: 'Auto: funky envelope',
    play: [note('A1', { dur: 1.5, vel: 0.9 }), note('D2', { at: 1.5, dur: 1.5, vel: 0.5 }), note('E1', { at: 3, dur: 2, vel: 1 }), riff({ at: 5.5 })],
    text: `With **Rocked by** on Auto, an envelope follower moves the rocker for you. A capacitor charges from the rectified bass through an attack resistor (5 ms) and drains through a decay resistor (0.25 s), so its voltage reads close to each note's peak.

That voltage pushes the rocker from heel toward toe. Each pluck opens the peak upward, and as the note fades the peak falls back: *wow*. A harder note goes further and stays up longer. Watch the solid curve in **The sweep** jump with every note.`,
  },
]);
