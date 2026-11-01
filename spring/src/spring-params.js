// spring-params.js — the Spring Reverb's controls. Values in SI units; `scale` shows them in
// friendlier ones. A reverb tank: helical steel springs hung between magnetic beads, one bead
// turned by the drive coil, the one at the far end read by the pickup coil.

const tank = [
  { id: 'tank', label: 'Tank', type: 'select', def: 'leem',
    options: [['leem', 'Leem, three springs'], ['olson', 'Olson, two springs'], ['one', 'One spring']],
    hint: 'Whose springs hang in the tank, from Parker and Bilbao\'s measurements of a Leem Pro KA-1210 and an Olson X-82: their coils, turns and beads. The three long springs echo every 40 to 53 ms; the two short, wider ones every 31 and 35 ms, with their chirps lower. One spring alone echoes crisply, where three blur into a wash.' },
  { id: 'wire', label: 'Wire diameter', min: 0.2e-3, max: 0.6e-3, def: 0.35e-3, log: true, unit: 'mm', scale: 1000, decimals: 2,
    hint: 'The steel wire every spring is wound from (0.35 mm in both tanks). Thinner wire carries slower waves, so the echoes come later, and moves the top of the chirps, the transition frequency, down in proportion: a darker, slower, more twangy spring. Thicker is faster and brighter.' },
  { id: 'beads', label: 'Bead magnets', type: 'select', def: 'along',
    options: [['along', 'Along the spring'], ['across', 'Across it']],
    hint: 'Which way the small magnets at the springs\' ends lie. Along the spring, each turns about its own axis and is easy to turn; across it, it turns end over end, five times harder in the Leem, and the beads\' corner frequency falls from 8 kHz to 1.5 kHz: a darker tank.' },
  { id: 'mounts', label: 'Loss at the mounts', min: 0.05, max: 3, def: 0.4, log: true, unit: 'dB', decimals: 2,
    hint: 'What a wave loses each time it reaches a bead and turns back. It sets how long the tank rings: more is a shorter reverb. Waves just below the transition frequency crawl, reach the beads least often, and are the ones the mounts damp least.' },
  { id: 'steel', label: 'Steel loss factor', min: 1e-5, max: 2e-3, def: 2e-4, log: true, unit: '× 10⁻⁴', scale: 1e4, decimals: 2,
    hint: 'The steel\'s own internal friction, a fraction of each cycle\'s energy. It damps the high frequencies first, so more makes the tail darker as it dies.' },
  { id: 'oil', label: 'Oil damping', min: 0, max: 20, def: 0, unit: '/s', decimals: 1,
    hint: 'A viscous drag on the wire, like the oil Hammond hung his springs in. It damps every frequency alike, so it shortens the reverb without changing its colour.' },
];

const mix = [
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in.' },
  { id: 'reverb', label: 'Reverb', min: 0, max: 1, def: 0.3, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How much of what the pickup bead hears is mixed in: the recovery amplifier\'s gain. At 100 % the first echo of a low note comes out as loud as the note went in.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: -0.6, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The tank', params: tank },
  { name: 'The mix', params: mix },
];

export const PRESETS = {
  'Spring under the bass': { tank: 'leem', wire: 0.35e-3, mounts: 0.4, steel: 2e-4, oil: 0, dry: 1, reverb: 0.3 },
  'Surf drip': { tank: 'leem', wire: 0.35e-3, mounts: 0.25, steel: 1e-4, oil: 0, dry: 0.8, reverb: 0.8 },
  'Small tank': { tank: 'olson', wire: 0.35e-3, mounts: 0.4, steel: 2e-4, oil: 0, dry: 1, reverb: 0.4 },
  'One spring, nearly lossless': { tank: 'one', wire: 0.35e-3, mounts: 0.05, steel: 1e-5, oil: 0, dry: 0.5, reverb: 1 },
  'Thin wire, slow chirps': { tank: 'one', wire: 0.22e-3, mounts: 0.15, steel: 5e-5, oil: 0, dry: 0.6, reverb: 1 },
  'Oil bath': { tank: 'leem', wire: 0.35e-3, mounts: 0.4, steel: 2e-4, oil: 8, dry: 1, reverb: 0.5 },
};
export const KEEP = ['level'];
