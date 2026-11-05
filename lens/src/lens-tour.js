// lens-tour.js — the guided tour of the Gravitational Lens's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('lens', [
  {
    title: 'Two images',
    views: ['The lens plane', 'Arrivals'],
    preset: 'A heavy lens: 1000 suns',
    play: [note('E1', { dur: 1.2, vel: 0.9 }), note('A1', { at: 1.6, dur: 1.2, vel: 0.9 }), riff({ at: 3.4 })],
    text: `A source one Einstein radius behind a lens of 1000 suns. Each path from it to you through the plane of the lens arrives at its own time,

  T(x) = |x − y|²/2 − ln|x|,

in units of 4GM/c³ (19.7 ms for 1000 suns): the geometric detour, less the Shapiro delay of passing the mass. Light, or sound, takes the paths where T is stationary, Fermat's principle: a minimum on the source's side at x₊ = 1.62 and a saddle across the lens at x₋ = −0.62. So every note arrives twice, the second time 2.08 units, 41.0 ms, later, and 38 % as loud.

![The Gravitational Lens: two rays from the source bend round the mass to you](schematics/paths.svg)`,
  },
  {
    title: 'A quarter cycle turned',
    views: ['Scope', 'Arrivals'],
    preset: 'A heavy lens: 1000 suns',
    play: [note('A1', { dur: 2.5, vel: 0.9 }), note('E1', { at: 3, dur: 2.5, vel: 0.9 })],
    text: `The second image is not just a quieter copy. The saddle is a minimum one way and a maximum the other, and the paths near it add up a quarter cycle late at every frequency: the image is Hilbert-transformed. Its spectrum is the note's, but its shape is not: in the **Scope** the echo of the plucked string comes back with its peaks where the first had its zero crossings. In **Arrivals** the click comes through as a spike, then, 41.0 ms on, a swing up and over, the Hilbert transform of a click.`,
  },
  {
    title: 'The comb',
    views: ['The response', 'Spectrum'],
    preset: 'A star of 100 suns',
    play: [riff(), sweep('offset', 0.5, 1.5, { at: 5, dur: 5, log: true }), riff({ at: 5 })],
    text: `Behind 100 suns, half an Einstein radius off, the images are 1.99 ms apart, and they beat. Where they arrive in step the sound is brightened 6.15 dB; where opposed, cut 6.15 dB, a comb with 12.3 dB between its peaks and its dips, one every 502 Hz. A plain echo would put its dips at odd multiples of 251 Hz; the quarter-cycle turn moves them a quarter of the way along, to 377 Hz and 879 Hz. Then the source drifts off to 1.5 Einstein radii: the second image fades, and the comb flattens.`,
  },
  {
    title: 'Too long to be bent',
    views: ['The response', 'Spectrum'],
    preset: 'A light lens: 3 suns',
    play: [riff(), { at: 5, set: { optics: 'rays' } }, riff({ at: 5 })],
    text: `A lens of 3 suns, in waves. Rays would bend every wavelength alike, but a wave much longer than the lens goes round it, feeling nothing: the lens fades out below about c³/(8πGM), here 2.69 kHz, and the bass's fundamentals pass as if it weren't there. The open E comes out 0.1 dB louder.

Halfway the optics switch to **Rays**, geometric optics: just the two images, at every wavelength. Now the same E is brightened 3.4 dB, as if the low strings were short waves. Waves are right: this is why the light from a star is lensed but a long gravitational wave from behind a small mass is not.`,
  },
  {
    title: 'The Einstein ring',
    views: ['The lens plane', 'The response'],
    preset: 'Nearly aligned: an Einstein ring',
    play: [riff(), sweep('offset', 0.05, 0.5, { at: 5, dur: 5, log: true }), riff({ at: 5 })],
    text: `Line the source up behind the lens and the two images close in on the Einstein ring from either side, both bright: at 0.05 Einstein radii they are 20.0 times as bright together (13.0 dB), arriving 0.20 ms apart, so the comb's dips fall every 5.1 kHz. In **The lens plane** the contours crowd into a ring. Exactly behind, the ring would close and, in rays, the brightness diverge; in waves it stays finite, because a wave can't be focused finer than its wavelength.`,
  },
  {
    title: 'Microlensing',
    views: ['The response', 'The lens plane'],
    preset: 'A star of 100 suns',
    set: { offset: 1.5, level: -2 },
    play: [sweep('offset', 1.5, 0.1, { at: 0.2, dur: 5, log: true }), sweep('offset', 0.1, 1.5, { at: 5.2, dur: 5, log: true }), riff({ times: 2 })],
    text: `A star drifting behind an unseen mass: the microlensing Paczyński proposed in 1986 as a way to find the dark bodies of our galaxy's halo. The images are far too close to see apart, so all that is seen is their total brightness, rising and falling as the mass passes,

  A(u) = (u² + 2)/(u√(u² + 4)),

1.13 at 1.5 Einstein radii, 1.34 at 1, 10.0 at 0.1, and back. Here the source passes from 1.5 to 0.1 and away again: the treble swells by 10.0 dB and falls, and the comb's teeth spread and close.`,
  },
]);
