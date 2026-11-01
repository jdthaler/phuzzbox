// buffer-tour.js — the guided tour of the Buffer's physics, and of the test bass and the tuner
// every page has (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('buffer', [
  {
    title: 'A bass made of physics',
    views: ['Tuner', 'Spectrum'],
    preset: 'As plugged in',
    play: [note('E1', { dur: 4.5, vel: 0.8 }), note('A1', { at: 4.5, dur: 4, vel: 0.8 })],
    text: `The tour plays the **test bass**: four steel strings on a 34-inch scale, plucked by a finger, heard by a pickup. A string is stiff, so its partials run sharp of whole multiples of the first:

  fₙ = n f₁ √(1 + B n²)

On the low E, B ≈ 6.8 × 10⁻⁴, and the 20th partial is 200 cents sharp. The **Tuner** reads the first partial, the pitch a string is tuned by; the waveform's period, a compromise among all of them, would read sharp. Each ⓘ opens how they work.`,
  },
  {
    title: 'The pickup is a resonance',
    views: ['The pickup\'s response', 'Spectrum'],
    preset: 'As plugged in',
    play: [riff()],
    text: `A passive pickup is a coil of a few henries, and the cable it drives is a capacitor: together they resonate, at

  f₀ = 1 / (2π √(L C))

about 4.2 kHz for a 3.6 H pickup with 100 pF of its own and 3 m of 100 pF/m cable. That is the bump in **The pickup's response**.

Your interface has already heard your bass through your cable. The Buffer works out that circuit and the one you choose, and plays the ratio of the two. Here they are the same, so the thin line is flat at 0 dB and the signal passes untouched.`,
  },
  {
    title: 'Longer cable, lower resonance',
    views: ['The pickup\'s response', 'Spectrum'],
    preset: 'As plugged in',
    set: { cable: 0.3 },
    play: [riff({ times: 2 }), sweep('cable', 0.3, 30, { at: 0.5, dur: 9, log: true })],
    text: `Now the cable grows from 30 cm, a pedal right at the bass, to 30 m. Each metre adds its capacitance across the coil, and the resonance slides down: 30 m puts 3.1 nF there and drops f₀ to 1.5 kHz.

Listen to the top of each note, the string's brightness and its scrape: it dulls as the peak comes down. The fundamental stays, far below the resonance. This is why a long stage cable sounds darker than a short one, with nothing but copper and plastic in the way.`,
  },
  {
    title: 'A hungry input',
    views: ['The pickup\'s response', 'Spectrum'],
    preset: 'Vintage fuzz input (10 kΩ)',
    play: [riff(), { at: 5, bypass: true }, riff({ at: 5 })],
    text: `What the cable plugs into is a resistance across the coil. A buffer or an interface is 1 MΩ and leaves the resonance alone; a vintage germanium fuzz's input is about **10 kΩ**, which damps it away.

It costs level too: the coil's 10.5 kΩ of wire and that 10 kΩ make a divider, about 6 dB down. First the 10 kΩ input, then (the footswitch off) your interface's 1 MΩ. That is why a germanium fuzz sounds different on a passive bass than on an active one, before any transistor clips.`,
  },
  {
    title: 'Active electronics',
    views: ['The pickup\'s response'],
    preset: 'Thirty metres of cable',
    set: { active: true },
    play: [riff(), { at: 5, set: { active: false } }, riff({ at: 5 })],
    text: `An **active** bass has a preamp inside that drives the cable from about 1 kΩ, with no coil in the way:

  v / e = 1 / (R C s + 1 + R / Rₗ)

whose corner, even with 30 m of cable, sits far above anything you hear. Thirty metres first as an active bass would drive them, then as a passive one: the cable and the input only matter to a passive pickup.`,
  },
]);
