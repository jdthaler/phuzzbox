// radio-params.js — the Crystal Radio's controls. Values in SI units; `scale` shows them in friendlier ones.

// the detector's diode (native/pedals/radio/radio-model.cpp: the Bandgap's families)
export const DIODES = [['ge', 'Germanium'], ['schottky', 'Schottky'], ['si', 'Silicon']];

const station = [
  { id: 'signal', label: 'Signal', min: 0.003, max: 3, def: 0.3, log: true, unit: 'mV', scale: 1000, decimals: 0, perform: true,
    hint: 'The station\'s carrier at the detector, tuned in: how strong the station is where you listen. Weak, under the diode\'s nVT (41 mV for germanium), the detector is a square-law device: the earphone\'s voltage goes as the carrier\'s square, so the bass comes out squared, with a second harmonic m/4 of each note, 10 % at 40 % modulation. Strong, it is a peak detector and the bass comes out straight: 0.7 % at 1 V, 0.4 % at 2 V. The amplifier after the set makes up the level, so this changes the sound, not how loud it is.' },
  { id: 'depth', label: 'Modulation', min: 0.1, max: 10, def: 0.8, log: true, unit: '%/V', scale: 100, decimals: 0, perform: true,
    hint: 'How deeply the bass modulates the carrier, per volt in: at 80 %/V a 0.5 V note swings the carrier\'s amplitude 40 % up and down. Past 100 % the carrier is cut off in the note\'s troughs, since a transmitter can\'t send less than nothing, and they come out flattened: at 500 %/V a 0.3 V note overmodulates to 150 %, with an 18 % second harmonic. The amplifier divides the modulation back out, so this sets the distortion, not the level.' },
  { id: 'tuning', label: 'Tuning', min: -15000, max: 15000, def: 0, unit: 'kHz', scale: 0.001, decimals: 1, perform: true,
    hint: 'Where the set is tuned, from the station. Off it, the station\'s carrier sits on the side of the tuned circuit\'s response and comes in weaker: 6 kHz off, with the circuit 3 dB down 10 kHz either side (Q 50 at 1000 kHz), the bass is 1.6 dB quieter. Tune 10 kHz up and you are on the next station. An expression pedal sweeps it (MIDI CC 1 unless you teach it another).' },
  { id: 'q', label: 'Selectivity', min: 10, max: 300, def: 50, log: true, unit: 'Q', decimals: 0, perform: true,
    hint: 'The tuned circuit\'s quality factor, loaded by the antenna and the detector. It passes a band 3 dB down f0/2Q either side of the station, and the bass rides on the carrier as sidebands, each note f from it, so that band is the bass\'s bandwidth: at Q 50 and 1000 kHz, 10 kHz, all of the bass; at Q 200, 2.5 kHz, and the treble above it is cut, 2.9 dB at 2.5 kHz.' },
  { id: 'level', label: 'Level', min: -24, max: 12, def: 0, unit: 'dB', decimals: 1, perform: true,
    hint: 'The output, after the amplifier that follows the set. At 0 dB a gentle modulation comes out as loud as the bass went in, whatever the signal: the amplifier\'s gain makes up what the transmitter and the detector made of it, 14.2 dB at 300 mV on germanium and 63.0 dB for a faint 10 mV.' },
];

const set = [
  { id: 'diode', label: 'Detector', type: 'select', def: 'ge', options: DIODES,
    hint: 'The detector\'s diode. Germanium\'s knee is low: it passes 1 mA at 0.28 V, and nVT is 41 mV. Silicon needs 0.58 V for 1 mA, so a station that germanium detects straight, silicon detects squared or worse: at 300 mV, between its square law and its peak law, its voltage grows faster than the square, and a 40 % modulation comes out with a 26 % second harmonic, against germanium\'s 2 %. The Schottky is in between.' },
  { id: 'load', label: 'Earphone load', min: 10e3, max: 1e6, def: 100e3, log: true, unit: 'kΩ', scale: 0.001, decimals: 0,
    hint: 'The earphone, as the resistance R the detector drives, with the bypass capacitor C across it. The capacitor holds the carrier\'s peaks and R lets them down: when the carrier falls faster than RC lets the voltage go, the voltage falls in a straight line instead, diagonal clipping, from where mωRC = √(1 − m²). At 100 kΩ and 1 nF that is 3.6 kHz for 40 % modulation, above the bass; at 1 MΩ and 4.7 nF, 78 Hz, and a 220 Hz note at 40 % comes out with an 8 % second harmonic.' },
  { id: 'cap', label: 'Bypass capacitor', min: 100e-12, max: 10e-9, def: 1e-9, log: true, unit: 'nF', scale: 1e9, decimals: 2,
    hint: 'The capacitor across the earphone, which holds the voltage up between the carrier\'s peaks, a million of them a second, so only the bass is left. With the load it sets RC: the longer it is, the sooner diagonal clipping starts, at mωRC = √(1 − m²): 4.7 nF across 1 MΩ starts it at 78 Hz for 40 % modulation.' },
  { id: 'station', label: 'Station', min: 540e3, max: 1700e3, def: 1000e3, log: true, unit: 'kHz', scale: 0.001, decimals: 0,
    hint: 'Where the station is on the dial, from 540 to 1700 kHz, the AM channels of the US. For the same Q the tuned circuit passes a band in proportion to the frequency: at Q 200, 3 dB down 1.35 kHz either side at 540 kHz, 2.5 kHz at 1000 kHz and 4.25 kHz at 1700 kHz.' },
  { id: 'neighbour', label: 'Next station', min: -80, max: 0, def: -46, unit: 'dB', decimals: 0,
    hint: 'The next station, 10 kHz up the dial, as strong as this one less this many dB. The tuned circuit lets part of it through (3 dB down at Q 50 and 1000 kHz), and the detector hears the two carriers beating: a 10 kHz whistle, the heterodyne. Under a 0.3 V note, at −46 dB it is 39 dB down; at −24 dB, 17 dB down.' },
];

export const GROUPS = [
  { name: 'The station', params: station },
  { name: 'The set', params: set },
];

// Each preset shows one idea, at the level that makes it as loud as bypass on the test bass's riff
// (tools/loudness.mjs).
const stock = { signal: 0.3, depth: 0.8, tuning: 0, q: 50, level: 0, diode: 'ge', load: 100e3, cap: 1e-9, station: 1000e3, neighbour: -46 };
export const PRESETS = {
  'A local station': { ...stock },
  'Faint and far: square law': { ...stock, signal: 0.01 },
  'Silicon detector': { ...stock, diode: 'si', level: -0.2 },
  'Strong and linear': { ...stock, signal: 2 },
  'Sharp tuning': { ...stock, q: 200 },
  'Off the station': { ...stock, tuning: 6000, level: 1.5 },
  'Whistle from next door': { ...stock, neighbour: -24, level: -2 },
  'Overmodulated': { ...stock, depth: 5, level: 0.5 },
  'Diagonal clipping': { ...stock, signal: 1, load: 1e6, cap: 4.7e-9 },
};
export const KEEP = [];
