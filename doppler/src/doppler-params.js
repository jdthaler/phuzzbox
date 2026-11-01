// doppler-params.js — the Doppler's controls. Values in SI units: a source plays your bass as it
// passes you on a straight road, again and again, and you hear it at its retarded time.

const pass = [
  { id: 'speed', label: 'Speed', min: 0, max: 700, def: 25, unit: 'm/s', decimals: 0, perform: true,
    hint: 'How fast the source passes, through still air: 25 m/s is 90 km/h. Coming it sounds higher, going lower: at 25 m/s a note falls by 2.5 semitones as it passes. Above the speed of sound (343 m/s at 20 °C) the source outruns its sound: nothing, then the boom as its Mach cone sweeps over you, then two sounds at once, the one from its approach played backwards. The boom is far louder than the pass: the Mach presets turn Level down by 24 dB. A change takes effect from the next pass.' },
  { id: 'distance', label: 'Distance', min: 1, max: 100, def: 4, log: true, unit: 'm', decimals: 1, perform: true,
    hint: 'How close the road comes to you. Close, the pitch drops fast as it passes and the level swells; far, the pitch glides down slowly. From the next pass.' },
  { id: 'period', label: 'Every', min: 1, max: 8, def: 4, unit: 's', decimals: 1, perform: true,
    hint: 'The time from one pass to the next: each source is heard for this long, fading in and out at the ends of its stretch of road, and passes you halfway. From the next pass.' },
  { id: 'dry', label: 'Dry', min: 0, max: 1, def: 0, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'Your bass as it came in, as if you stood by the road playing too.' },
];

const air = [
  { id: 'listener', label: 'Your speed', min: -50, max: 50, def: 0, unit: 'm/s', decimals: 0,
    hint: 'How fast you move along the road, through the air: plus the way the source goes, minus toward it. Riding at 25 m/s past a source standing still, you hear it 122 cents high as you come and 131 cents low as you go; a source passing you at 25 m/s is the other way round, 131 cents high and 122 low. The pitch depends on who moves through the air, not only on how fast you close. From the next pass.' },
  { id: 'temp', label: 'Air', min: -20, max: 40, def: 20, unit: '°C', decimals: 0,
    hint: 'The air\'s temperature, which sets the speed of sound: 331 m/s at 0 °C, 343 m/s at 20 °C. From the next pass.' },
  { id: 'mix', label: 'Fly-by', min: 0, max: 1, def: 1, unit: '%', scale: 100, decimals: 0,
    hint: 'How much of the passing source is heard.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1,
    hint: 'Gain after the mix, in decibels.' },
];

export const GROUPS = [
  { name: 'The pass', params: pass },
  { name: 'The air and output', params: air },
];

export const PRESETS = {
  'Car at 90 km/h': { speed: 25, distance: 4, period: 4, listener: 0, dry: 0, mix: 1 },
  'Race car': { speed: 90, distance: 6, period: 3 },
  'Train': { speed: 40, distance: 20, period: 8 },
  'You ride past': { speed: 0, listener: 25, distance: 4, period: 4 },
  'Head on': { speed: 25, listener: -25, distance: 4, period: 4 },
  'Jet, low pass': { speed: 250, distance: 60, period: 6 },
  'Just past Mach 1': { speed: 380, distance: 30, period: 5, level: -24 },
  'Mach 2': { speed: 686, distance: 100, period: 6, level: -24 },
};
export const KEEP = [];
