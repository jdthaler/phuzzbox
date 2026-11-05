// michelson-tour.js — the guided tour of the Michelson Interferometer's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('michelson', [
  {
    title: 'A mirror on a string',
    views: ['The fringe', 'Scope'],
    preset: 'Red laser, mid-fringe',
    bypass: true,
    play: [note('A1', { dur: 2.4, vel: 0.8 }), { at: 2.5, bypass: false }, note('A1', { at: 2.6, dur: 2.4, vel: 0.8 }), riff({ at: 5.2 })],
    text: `First the bass straight, then through the interferometer. A helium–neon laser's beam is split in two; each half goes down an arm to a mirror and back, and they meet again on a photodiode. Your bass moves one mirror, by 400 nm for every volt.

![The interferometer: a beam split into two arms, one mirror moved by the bass, recombined on a photodiode](schematics/bench.svg)

Where the two paths differ by a whole number of wavelengths the light adds up, bright; half a wavelength more and it cancels, dark. So every 316 nm the mirror moves takes the detector through a whole fringe. **The fringe** shows the light against the mirror's travel, and the dots the light as you play: the swing crosses crests and troughs, and each one folds the wave back.`,
  },
  {
    title: 'Crest or slope',
    views: ['Spectrum', 'Scope'],
    preset: 'Bright fringe: an octave up',
    play: [note('A1', { dur: 3, vel: 0.8 }), { at: 3.2, set: { fringe: 90 } }, note('A1', { at: 3.25, dur: 3, vel: 0.8 })],
    text: `A gentle stroke now, with the mirror resting on a bright fringe's crest. Moving it either way dims the light alike, so the detector's output rises and falls twice for each swing of the string: the note an octave up, and in the **Spectrum** only even harmonics.

Halfway, the resting point moves a quarter wavelength, to the fringe's steep side: now the light follows the mirror, and the note comes back at its own pitch, with odd harmonics only. A sine on the mirror makes harmonics whose sizes are Bessel functions of the swing, the same arithmetic as an FM synthesiser's.`,
  },
  {
    title: 'Counting fringes',
    views: ['The fringes', 'Scope'],
    preset: 'Red laser, mid-fringe',
    play: [riff({ times: 2 }), sweep('stroke', 100e-9, 2e-6, { at: 0.5, dur: 9, log: true })],
    text: `The stroke grows from 100 to 2000 nm/V while the riff plays. **The fringes** shows what a screen in the detector's place would show with the beam spread a little: rings, because off the axis the light crosses the arms at a slant. As the mirror moves out, rings swell from the middle; as it comes back, they shrink into it.

The detector sees whatever ring passes the middle. Counting them is how Michelson measured a metre in wavelengths of cadmium light, in 1892: a fringe for every half wavelength the mirror moves. More stroke, more fringes counted each swing, more folds, and a denser, brighter sound.`,
  },
  {
    title: 'The sodium lamp\'s two lines',
    views: ['The fringe', 'The fringes'],
    preset: 'Sodium lamp, lines in step',
    play: [riff({ times: 3 }), sweep('arm', 0, 291e-6, { at: 0.5, dur: 14 })],
    text: `A sodium lamp's yellow light is two lines, the D lines, at 589.0 and 589.6 nm. Each makes its own fringes, and they almost coincide. Now the micrometer lengthens one arm from 0 to 291 µm.

As it does, one line's fringes slip against the other's. At 145 µm they are half a fringe apart, crest on trough: the contrast falls to a third (D₂ is twice as bright as D₁, so they never cancel), and the folds go shallow. By 291 µm they are back in step. That is the classic way to measure the gap between the D lines with an interferometer: 0.6 nm, from where the fringes fade.`,
  },
  {
    title: 'White light',
    views: ['The fringe', 'Scope'],
    preset: 'White light, out and back',
    play: [note('E1', { dur: 3.5, vel: 0.85 }), note('A1', { at: 3.6, dur: 3, vel: 0.5 })],
    text: `A white LED's light is a mixture of colours, each with its own fringes; they agree only where the two paths are equal. A few micrometres away the colours' fringes fall out of step and wash each other out, so a white-light interferometer has fringes only at zero path, with a faint tail from the LED's blue chip.

Here the stroke is 4000 nm/V: a hard note swings the mirror 2 µm each way, out past the phosphor's fringes into the blue chip's faint ones and back, so the light flickers hard only as the mirror passes the middle, twice a cycle. The quieter note stays inside them. **The fringe** shows the envelope (dashed) the dots must stay within.`,
  },
]);
