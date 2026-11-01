// board-pedal.js — the Pedalboard's descriptor, for the shared page (shared/shell.js): its own
// controls are the bass and the cables; the pedals it holds bring their own (board-pedals.js).

import { GROUPS, PRESETS, KEEP } from './board-params.js';

export const PEDAL = {
  id: 'board',
  name: 'Pedalboard',
  after: 'every pedal here, in a chain',
  description: 'The pedals in series, each loading the one before it and driving the one after through real cables and impedances',
  groups: GROUPS, presets: PRESETS, keep: KEEP,
};
