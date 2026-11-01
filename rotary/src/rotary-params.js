// rotary-params.js — the Rotary Speaker's controls. Values in SI units (rotation rates in hertz,
// shown in rpm; angles in radians, shown in degrees). A horn and a drum spin in a cabinet past two
// microphones; what the microphones hear is the physics of a moving source.

const DEG = 180 / Math.PI;

const rotors = [
  { id: 'fast', label: 'Fast (tremolo)', type: 'checkbox', def: false, perform: true,
    hint: 'The two-speed switch: off, the rotors turn slowly (chorale); on, fast (tremolo). The horn, light, gets there in about a second; the drum, heavy, takes several, so for a while the two beat against each other. Fast, the horn swings the pitch of a high note about ±30 cents; slow, about ±4.' },
  { id: 'balance', label: 'Horn and drum', min: -12, max: 12, def: 0, unit: 'dB', decimals: 1, perform: true,
    hint: 'The horn\'s level against the drum\'s: up, more of the horn, which carries everything above the crossover; down, more of the drum and its low end.' },
  { id: 'distance', label: 'Mic distance', min: 0.3, max: 3, def: 1, log: true, unit: 'm', decimals: 2, perform: true,
    hint: 'How far the microphones are from the rotors\' axis. Close, the horn swings nearer and further by a large share of the distance, so its level throbs: at 30 cm about 9 dB from near to far, at 3 m under 1 dB. The pitch swings the same at any distance.' },
  { id: 'spread', label: 'Mic spread', min: 0, max: Math.PI, def: (2 * Math.PI) / 3, unit: '°', scale: DEG, decimals: 0, perform: true,
    hint: 'The angle between the two microphones around the cabinet. At 0 both hear the same; at 180° they are on opposite sides, and as the horn comes toward one it goes away from the other, so the pitch rises in one ear as it falls in the other.' },
];

const speeds = [
  { id: 'hornSlow', label: 'Horn, slow', min: 0.3, max: 1.5, def: 50 / 60, unit: 'rpm', scale: 60, decimals: 0,
    hint: 'The horn\'s chorale speed. A Leslie\'s is about 50 rpm: a slow swirl.' },
  { id: 'hornFast', label: 'Horn, fast', min: 4, max: 8, def: 400 / 60, unit: 'rpm', scale: 60, decimals: 0,
    hint: 'The horn\'s tremolo speed, about 400 rpm. Faster swings the pitch further, since the horn\'s mouth moves faster.' },
  { id: 'drumSlow', label: 'Drum, slow', min: 0.3, max: 1.5, def: 40 / 60, unit: 'rpm', scale: 60, decimals: 0,
    hint: 'The drum\'s chorale speed, about 40 rpm, a little slower than the horn\'s.' },
  { id: 'drumFast', label: 'Drum, fast', min: 4, max: 8, def: 340 / 60, unit: 'rpm', scale: 60, decimals: 0,
    hint: 'The drum\'s tremolo speed, about 340 rpm: slower than the horn\'s, so the two never quite line up.' },
  { id: 'hornTau', label: 'Horn spin-up', min: 0.1, max: 2, def: 0.35, log: true, unit: 's', decimals: 2,
    hint: 'The time constant with which the horn follows the switch: its inertia against its motor and its drag. 0.35 s brings it 95 % of the way in about a second.' },
  { id: 'drumTau', label: 'Drum spin-up', min: 0.5, max: 6, def: 1.7, log: true, unit: 's', decimals: 1,
    hint: 'The same for the drum, heavier: 1.7 s brings it 95 % of the way in about five seconds, long after the horn.' },
];

const cabinet = [
  { id: 'crossover', label: 'Crossover', min: 400, max: 1600, def: 800, log: true, unit: 'Hz', decimals: 0,
    hint: 'Where the signal divides: below it to the drum, above it to the horn. A Leslie\'s is 800 Hz; higher keeps more of a bass note in the drum, whose swirl is gentler.' },
  { id: 'hornR', label: 'Horn radius', min: 0.08, max: 0.25, def: 0.15, unit: 'cm', scale: 100, decimals: 1,
    hint: 'How far the horn\'s mouth is from the axis it turns on. The mouth moves at the radius times the rotation, so a longer horn swings the pitch further.' },
  { id: 'hornA', label: 'Horn mouth', min: 0.02, max: 0.08, def: 0.04, unit: 'cm', scale: 100, decimals: 1,
    hint: 'The radius of the horn\'s mouth. A wavelength much longer than the mouth spreads out every way; a shorter one beams along the horn, so the high notes come and go as it turns, the more the wider the mouth.' },
  { id: 'drumR', label: 'Drum radius', min: 0.08, max: 0.25, def: 0.18, unit: 'cm', scale: 100, decimals: 1,
    hint: 'How far the drum\'s opening is from its axis: with the drum\'s rotation, how far its pitch swings.' },
  { id: 'drumA', label: 'Drum opening', min: 0.05, max: 0.2, def: 0.15, unit: 'cm', scale: 100, decimals: 1,
    hint: 'The radius of the drum\'s opening. Bass wavelengths are metres long, much more than the opening, so the drum\'s low end hardly beams at all: what it does to a bass note is mostly the pitch swing. Wider beams the upper notes more.' },
];

const output = [
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the microphones, in decibels.' },
];

export const GROUPS = [
  { name: 'Rotors', params: rotors },
  { name: 'Speeds', params: speeds },
  { name: 'The cabinet', params: cabinet },
  { name: 'Output', params: output },
];

export const PRESETS = {
  'Chorale': { fast: false, balance: 0, distance: 1, spread: (2 * Math.PI) / 3 },
  'Tremolo': { fast: true, balance: 0, distance: 1, spread: (2 * Math.PI) / 3 },
  'Mics up close': { fast: false, distance: 0.35, spread: Math.PI },
  'Drum only': { fast: true, balance: -12 },
  'Horn only': { fast: true, balance: 12, distance: 0.5 },
  'Long horn, slow motor': { fast: true, hornR: 0.24, hornTau: 1.5, drumTau: 5 },
};
export const KEEP = ['level'];
