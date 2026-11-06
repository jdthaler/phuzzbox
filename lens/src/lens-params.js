// lens-params.js — the Gravitational Lens's controls. Values in SI units, and the lens's mass in
// suns: your bass, a wave from far behind a point mass, bent round it on its way to you.

const pedal = [
  { id: 'mass', label: 'Mass', min: 1, max: 1000, def: 100, log: true, unit: 'M☉', decimals: 0, perform: true,
    hint: 'The lens\'s mass in suns. It sets the scale of everything, 4GM/c³ = 19.7 µs a sun: half an Einstein radius off, the second image arrives 1.99 ms after the first behind 100 suns and 19.9 ms behind 1000. And waves much longer than the lens go round it untouched: the lens fades out below about c³/(8πGM), 81 Hz for 100 suns, 8.1 kHz for one.' },
  { id: 'offset', label: 'Offset', min: 0.02, max: 3, def: 0.5, log: true, unit: 'θE', decimals: 2, perform: true,
    hint: 'How far the source sits from the line through the lens, in Einstein radii. At 0.5 the two images are 2.18 times as bright as the source alone (3.4 dB), the second 1.99 ms late behind 100 suns; near 0 they close into a ring and brighten as one over the offset, 20.0 times at 0.05, arriving almost together (0.20 ms); at 3 the second is 9.2 % as loud as the first and 15.4 ms late.' },
  { id: 'optics', label: 'Optics', type: 'select', def: 'waves', options: [['waves', 'Waves'], ['rays', 'Rays']], perform: true,
    hint: 'Waves: the lens as the wave equation has it, the sum over every path through the plane of the lens, so waves longer than the lens bend round it and a light lens leaves the bass alone: behind 3 suns the open E comes out 0.1 dB louder. Rays: geometric optics, the two images alone at every wavelength, the second turned a quarter cycle, so even the longest waves are brightened: 3.4 dB on the same E.' },
];

const lens = [
  { id: 'redshift', label: 'Lens redshift', min: 0, max: 1, def: 0, unit: '', decimals: 2,
    hint: 'How far off the lens is, as the redshift of its light: the universe stretches every delay by (1 + z) on the way to you, so a lens at z = 1 sounds like one twice as heavy nearby. Behind 100 suns at z = 1 the second image is 3.98 ms late, not 1.99.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: -4.9, unit: 'dB', decimals: 1,
    hint: 'Gain after the lens, in decibels.' },
];

export const GROUPS = [
  { name: 'The lens', params: pedal },
  { name: 'The sky and output', params: lens },
];

const stock = { mass: 100, offset: 0.5, optics: 'waves', redshift: 0, level: -4.9 };
export const PRESETS = {
  'A star of 100 suns': { ...stock },
  'Nearly aligned: an Einstein ring': { ...stock, offset: 0.05, level: -8.4 },
  'Rays: geometric optics': { ...stock, optics: 'rays', level: -5.4 },
  'A light lens: 3 suns': { ...stock, mass: 3, level: -0.5 },
  'A heavy lens: 1000 suns': { ...stock, mass: 1000, offset: 1, level: -1.4 },
  'Far off the axis': { ...stock, offset: 2, level: -0.3 },
  'A distant lens: z = 1': { ...stock, redshift: 1, level: -3.2 },
};
export const KEEP = [];
