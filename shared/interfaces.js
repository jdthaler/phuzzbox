// interfaces.js — audio interfaces' instrument inputs, from their makers' specifications, to set
// the page's Full scale in volts from the interface and its gain.
//
// A maker quotes the instrument input's maximum level in dBu at minimum gain: the sine that just
// reaches digital full scale. 0 dBu is √0.6 V rms (1 mW in 600 Ω), so that sine's peak, which is
// what a sample of 1.0 means, is √0.6 × 10^(dBu/20) × √2 volts. Each decibel of gain lowers it by
// a decibel. The input impedance is what the bass's pickup sees.

export const INTERFACES = [
  { id: 'scarlett-2i2-4', name: 'Scarlett 2i2 (4th gen)', maxDbu: 12, gainRange: 62, inputZ: 1e6,
    note: 'Focusrite Control 2 shows the gain in dB. Press INST.',
    source: 'https://focusrite.com/products/scarlett-2i2' },
  { id: 'scarlett-2i2-3', name: 'Scarlett 2i2 (3rd gen)', maxDbu: 12.5, gainRange: 56, inputZ: 1.5e6,
    note: 'The gain knob has no scale: fully left is 0 dB, fully right 56 dB. Press INST.',
    source: 'https://soundref.com/?p=6032' },
];

export const byInterface = (id) => INTERFACES.find((i) => i.id === id);

// the peak volts at the jack that make a full-scale sample
export function fullScaleVolts(iface, gainDb) {
  const g = Math.min(iface.gainRange, Math.max(0, gainDb));
  return Math.sqrt(0.6) * 10 ** (iface.maxDbu / 20) * Math.SQRT2 / 10 ** (g / 20);
}
