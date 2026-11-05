// bandgap-tour.js — the guided tour of the Bandgap's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';
import { PRESETS } from './bandgap-params.js';

// each family of diodes at the level its preset plays it at, so the climb keeps about one loudness
const lv = (name) => PRESETS[name].level;
const climb = [
  ['ge', lv('Germanium, soft and low')], ['si', lv('Silicon')], ['red', lv('Red LEDs, open and loud')],
  ['green', (lv('Red LEDs, open and loud') + lv('Blue LEDs, barely clipping')) / 2], ['blue', lv('Blue LEDs, barely clipping')],
];

export const TOUR = tour('bandgap', [
  {
    title: 'Gain, then diodes',
    views: ['Scope', 'The diodes'],
    preset: 'Silicon',
    bypass: true,
    play: [note('E1', { dur: 2.4, vel: 0.85 }), { at: 2.5, bypass: false }, note('E1', { at: 2.6, dur: 2.4, vel: 0.85 }), riff({ at: 5.2 })],
    text: `First the bass straight, then through the Bandgap. An op-amp multiplies it by 16, so a note that peaked at 0.2 V would swing 3 V; but between the op-amp and the output sits a pair of silicon diodes to ground, back to back, and a diode hardly conducts until it has about 0.6 V across it. Past that its current climbs tenfold for every 0.1 V or so, and the diodes hold the output at about ±0.5 V. The **Scope** shows the tops flattened.

![The Bandgap: a non-inverting op-amp with the Drive pot in its feedback, then the Filter resistor into a pair of diodes to ground](schematics/circuit.svg)

In **The diodes**, the curves are the six kinds of diode's current against their voltage, and the moving dot is this pair's: where it climbs the steep part of its curve, the diode is clipping.`,
  },
  {
    title: 'Climbing the bandgap',
    views: ['The diodes', 'Scope'],
    preset: 'Silicon',
    play: climb.flatMap(([d, level], k) => [{ at: 2.6 * k, set: { diodes: d, level } }, note('A1', { at: 2.6 * k + 0.05, dur: 2.4, vel: 0.85 })]),
    text: `Now the same note through germanium, silicon, then red, green and blue LEDs, each at its preset's level so the loudness stays about even and you hear the shape.

A diode turns on when the electrons have enough energy to cross its junction, and that is set by the material's **bandgap**: 0.66 eV in germanium, 1.12 eV in silicon. In an LED an electron that crosses gives its energy up as a photon, so the light's colour tells you the gap:

  E = hc/λ,  1.97 eV at 630 nm (red), 2.36 eV at 525 nm (green), 2.67 eV at 465 nm (blue)

and the voltage it turns on at follows, a little below E/q. Germanium clips at 0.2 V and rounds everything off; blue LEDs let the wave reach 2.3 V before they bite, so they clip only the tops of the loudest notes. In **The diodes** the curves stand in that order, and the LEDs glow when they conduct: the light is the clipping.`,
  },
  {
    title: 'Warm diodes clip lower',
    views: ['Scope', 'The diodes'],
    preset: 'Silicon',
    set: { temp: -5 },
    play: [riff({ times: 3 }), sweep('temp', -5, 45, { at: 0.5, dur: 14 })],
    text: `The stage warms from −5 °C to 45 °C. A diode's saturation current, the trickle that gets over the barrier by heat alone, climbs steeply with temperature, as exp(−E_g/nkT): so at a given current a warm diode needs less voltage, about 2 mV less for each degree.

Over these 50 degrees the clipping level falls from 0.55 V to 0.44 V, and the output by about 2 dB. In **The diodes** the silicon curve slides left as it warms. Pedal builders who socket their diodes hear this on a cold stage.`,
  },
  {
    title: 'Lopsided clipping',
    views: ['Spectrum', 'Scope'],
    preset: 'Lopsided: one up, two down',
    play: [note('A1', { dur: 3, vel: 0.85 }), { at: 3.2, set: { perSide: 'one' } }, note('A1', { at: 3.25, dur: 3, vel: 0.85 }), riff({ at: 6.6 })],
    text: `One silicon diode one way and two in series the other: the top of the wave clips at 0.5 V, the bottom at 1 V. A wave clipped evenly has only odd harmonics, the 3rd, 5th, 7th; clipped unevenly it gains the even ones too, the 2nd an octave up and the 4th two octaves up, and in the **Spectrum** they appear between the odd ones. Halfway the pedal goes back to one diode each way, and the even harmonics drop away.

Even harmonics are the ones a valve amp's single-ended stages make, and they sound thicker and sweeter to most ears.`,
  },
  {
    title: 'No diodes: the op-amp\'s rails',
    views: ['Scope', 'The response'],
    preset: 'No diodes: the rails',
    play: [riff(), { at: 5, set: { supply: 18 } }, riff({ at: 5 })],
    text: `With the diodes switched out, nothing clips but the op-amp, whose output can't swing past its supply. From 9 V, with about 1.5 V lost at each end, it reaches ±3 V, and the bass's louder notes square off there, hard: an op-amp hits its rail as abruptly as a wall.

Halfway the supply goes to 18 V, as a charge-pump doubler gives, and the rails move out to ±7.5 V: now the gain of 16 runs out of room only on the loudest attacks. **The response** shows the small-signal gain the op-amp gives, flat across the bass's range, and the corners the Filter and the Low cut set.`,
  },
]);
