// neon-params.js — the Neon Tremolo's controls. Values in SI units; `scale` shows them in
// friendlier ones.

// the gases, in the order of native/pedals/neon/neon-model.cpp's table
export const GASES = [['ne', 'Neon'], ['he', 'Helium'], ['ar', 'Argon']];

const pedal = [
  { id: 'rate', label: 'Rate R', min: 0.5e6, max: 50e6, def: 4.7e6, log: true, unit: 'MΩ', scale: 1e-6, decimals: 2, perform: true,
    hint: 'The resistor the capacitor charges through. The time to charge from where the lamp goes out to where it strikes is RC ln((Vs − Ve)/(Vs − Vb)): with the stock lamp and 100 nF, 4.7 MΩ flashes about 3.4 times a second, 2.2 MΩ about 7 times and 47 MΩ once every 3 seconds. Below about 1.4 MΩ the supply can feed the glow the 50 µA that holds it, the lamp never goes out, and the tremolo stops with the bass held down. An expression pedal sweeps it (MIDI CC 1 unless you teach it another).' },
  { id: 'supply', label: 'Supply', min: 60, max: 400, def: 180, unit: 'V', decimals: 0, perform: true,
    hint: 'The voltage the capacitor charges toward. The higher it is above the lamp\'s striking voltage, the faster the capacitor gets there: with the stock lamp and Rate, 150 V flashes about 1.25 times a second, 180 V 3.4 times and 300 V 10.9 times. Below the striking voltage (143 V for the stock lamp) the lamp never fires and the bass passes untouched; too far above it, and the supply holds the glow on through the Rate resistor: at 400 V it needs more than 5.8 MΩ to flash.' },
  { id: 'depth', label: 'Depth', min: 0, max: 1, def: 0.9, unit: '%', scale: 100, decimals: 0, perform: true,
    hint: 'How far the cell can pull the bass down. The Depth pot is in series with the cell, 1 MΩ at 0 and nothing at full, falling as the square of what is left of its turn: with the stock lamp each flash ducks the bass by about 11 dB at 90 %, 13.4 dB at full, and under half a decibel at 0.' },
  { id: 'level', label: 'Level', min: -24, max: 24, def: 1.7, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output. Between flashes the cell is dark, a megohm, and the divider passes nine tenths of the bass; each flash pulls it down.' },
];

const lamp = [
  { id: 'gas', label: 'Gas', type: 'select', def: 'ne', options: GASES,
    hint: 'The gas in the bulb, which sets Townsend\'s constants A and B and so its Paschen curve. With the stock gap and γ, neon strikes at 143 V and burns from 110 V; helium, whose electrons ionise most easily at low fields, strikes at 56 V and burns from 50 V; argon strikes at 169 V and burns from 66 V.' },
  { id: 'pd', label: 'Gap × pressure', min: 0.3, max: 30, def: 3, log: true, unit: 'Torr·cm', decimals: 2,
    hint: 'The gas\'s pressure times the gap between the electrodes, the one number on which, by Paschen\'s law, the striking voltage depends. Neon\'s curve has its minimum, 100 V with the stock γ, near 1 Torr·cm; the lit lamp burns from 3/e of that, 110 V, so near the minimum it would strike below where it burns and cannot flash. Away from it striking takes more: 118 V at 2 Torr·cm, 143 V at 3, 302 V at 10. Left of the minimum the curve climbs steeply to a wall, at 0.37 Torr·cm, where no voltage strikes at all.' },
  { id: 'gamma', label: 'Cathode γ', min: 0.01, max: 0.5, def: 0.3, log: true, decimals: 3, unit: '',
    hint: 'How many electrons each ion knocks from the cathode as it lands. An avalanche must replace the electron that started it, so the better the cathode gives up electrons, the smaller the avalanche needed and the lower both voltages: neon\'s minimum is 100 V at 0.3 but 207 V at 0.05 and 314 V at 0.01, as e (B/A) ln(1 + 1/γ). At 0.05 the stock lamp would strike at 219 V but burn from 228 V: it cannot flash.' },
  { id: 'cap', label: 'Capacitor', min: 10e-9, max: 1e-6, def: 100e-9, log: true, unit: 'nF', scale: 1e9, decimals: 0,
    hint: 'The capacitor the lamp flashes from. The period is proportional to it: 10 nF flashes some 34 times a second with the stock Rate, 1 µF once every 3 seconds. A bigger one also holds more charge to dump, C (Vb − Ve), so each flash is longer and brighter and ducks the bass deeper.' },
  { id: 'cell', label: 'Cell', min: 5e-3, max: 200e-3, def: 30e-3, log: true, unit: 'ms', scale: 1e3, decimals: 0,
    hint: 'How long a freed electron lasts in the cell\'s cadmium sulphide when it is dim. The flash lasts a few milliseconds; the cell takes it in at once and lets it go slowly, so the bass dips at once and swells back, halfway in about 35 ms at the stock 30 ms. Shorter, and each flash is a sharp chop (12 ms at 8 ms); longer, and the dips run together into a slow throb (107 ms at 120 ms).' },
];

export const GROUPS = [
  { name: 'The pedal', params: pedal },
  { name: 'The lamp and cell', params: lamp },
];

const stock = { rate: 4.7e6, supply: 180, depth: 0.9, level: 1.7, gas: 'ne', pd: 3, gamma: 0.3, cap: 100e-9, cell: 30e-3 };
export const PRESETS = {
  'Neon pulse': { ...stock },
  'Fast flicker': { ...stock, rate: 2.2e6, cap: 47e-9, level: 4.7 },
  'Slow blink': { ...stock, rate: 22e6, level: 0.9 },
  'Soft throb (slow cell)': { ...stock, cell: 120e-3, cap: 220e-9, rate: 2.2e6, level: 4.7 },
  'Sharp chop (quick cell)': { ...stock, cell: 8e-3, rate: 2.2e6, level: 1.7 },
  'Helium lamp': { ...stock, gas: 'he', pd: 10, supply: 150, level: 1.5 },
  'Argon lamp': { ...stock, gas: 'ar', pd: 2, supply: 250, level: 3 },
  'Steady glow: R too small': { ...stock, rate: 1e6, level: 9.6 },
  'Below the strike: dark': { ...stock, supply: 130, level: 0.8 },
};
export const KEEP = [];
