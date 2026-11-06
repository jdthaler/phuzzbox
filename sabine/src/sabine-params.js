// sabine-params.js — Sabine's Room's controls. Values in SI units.

// the surfaces' absorption coefficients at 125, 250, 500, 1000, 2000 and 4000 Hz (Hall, Musical
// Acoustics, Table 15.1)
export const WALLS = [['concrete', 'Poured concrete'], ['block', 'Painted block'], ['plaster', 'Plaster on lath'], ['glass', 'Plate glass'], ['drapes', 'Velour drapes']];
export const FLOORS = [['wood', 'Wooden floor'], ['carpet', 'Carpet on concrete'], ['concrete', 'Poured concrete']];

const room = [
  { id: 'length', label: 'Length', min: 4, max: 60, def: 18, log: true, unit: 'm', decimals: 1, perform: true, hint: 'The room\'s length. A longer room rings longer, until the walls along it do most of the absorbing: in the stock room the reverberation time at 1 kHz is 2.0 s at 4 m long, 2.4 s at 9 m, 2.7 s at 36 m.' },
  { id: 'walls', label: 'Walls', type: 'select', def: 'plaster', options: WALLS, perform: true, hint: 'What the walls and the ceiling are made of. At 500 Hz in the stock room the sound dies away in 3.5 s off poured concrete, 1.9 s off plaster, 0.5 s behind velour drapes.' },
  { id: 'audience', label: 'Audience', min: 0, max: 100, def: 0, unit: '%', decimals: 0, perform: true, hint: 'How much of the floor an audience covers. People absorb: a full house takes the stock room\'s 2.6 s at 1 kHz down to 0.8 s.' },
  { id: 'distance', label: 'Distance', min: 1, max: 40, def: 6, log: true, unit: 'm', decimals: 1, perform: true, hint: 'How far you stand from the bass. Past the critical distance, 1.2 m in the stock room at 1 kHz (2.1 m with a full house), you hear more of the room than of the bass: at 6 m the room and the bass together are 14 dB over the bass alone. An expression pedal moves it.' },
  { id: 'level', label: 'Level', min: -24, max: 24, def: 2.2, unit: 'dB', decimals: 1, perform: true, hint: 'The output. At 0 dB the direct sound is the bass\'s strength a metre away, so at 6 m it comes 16 dB down, and the room adds the rest.' },
];

const more = [
  { id: 'width', label: 'Width', min: 3, max: 40, def: 12, log: true, unit: 'm', decimals: 1, hint: 'The room\'s width. At 1 kHz the stock room rings 1.8 s at 3 m wide, 2.8 s at 40 m.' },
  { id: 'height', label: 'Height', min: 2.5, max: 20, def: 6, log: true, unit: 'm', decimals: 1, hint: 'The room\'s height. A low ceiling keeps the sound near the absorbing floor: at 1 kHz the stock room rings 1.3 s under 2.5 m, 5.1 s under 20 m.' },
  { id: 'floor', label: 'Floor', type: 'select', def: 'wood', options: FLOORS, hint: 'The floor, where there is no audience. Carpet takes the highs: at 2 kHz the stock room rings 3.0 s over wood, 1.2 s over carpet, 5.3 s over concrete.' },
  { id: 'humidity', label: 'Humidity', min: 10, max: 90, def: 50, unit: '%', decimals: 0, hint: 'The air\'s relative humidity, at 20 °C. Dry air takes the highs: at 4 kHz the stock room rings 1.1 s at 10 %, 2.7 s at 90 %; in a big concrete hall, 60 by 40 by 20 m, 1.5 s against 6.6 s.' },
];

export const GROUPS = [
  { name: 'The room', params: room },
  { name: 'Its shape and its air', params: more },
];

const stock = { length: 18, walls: 'plaster', audience: 0, distance: 6, level: 2.2, width: 12, height: 6, floor: 'wood', humidity: 50 };
export const PRESETS = {
  'Empty hall': { ...stock },
  'Full house': { ...stock, audience: 100, level: 3.9 },
  'Concrete bunker': { ...stock, length: 12, width: 8, height: 3, walls: 'concrete', floor: 'concrete', distance: 4, level: -10.2 },
  'Glass atrium': { ...stock, length: 30, width: 20, height: 15, walls: 'glass', floor: 'concrete', distance: 12, level: 8.1 },
  'Cathedral': { ...stock, length: 60, width: 25, height: 20, walls: 'block', floor: 'concrete', distance: 20, level: 11.2 },
  'Drawing room': { ...stock, length: 7, width: 5, height: 3, walls: 'drapes', floor: 'carpet', distance: 2.5, level: -6.4 },
};
export const KEEP = [];
