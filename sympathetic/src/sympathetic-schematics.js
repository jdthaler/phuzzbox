// sympathetic-schematics.js — the Sympathetic Strings' frame (shared/schematic.js), written to
// sympathetic/schematics/ by tools/gen-schematics.mjs: the default strings (E major from E2) drawn
// to their lengths.
import { schematic } from '../../shared/schematic.js';
import { SCALES } from './sympathetic-params.js';

export const SCHEMATICS = {
  frame() {
    const s = schematic({ w: 34, h: 18.4, title: 'The Sympathetic Strings: a driver moves one bridge, twelve strings tuned to E major run from it, and a pickup hears their pull' });
    s.terminal([1, 8.5], 'in', { side: 'above' });
    s.wire([1, 8.5], [2.4, 8.5]);
    s.block([2.4, 7.1], 5, 2.8, { label: 'driver', value: 'your bass' });
    s.wire([7.4, 8.5], [8.6, 8.5]);
    // the bridge
    s.block([8.6, 1.4], 0.8, 14.2, { accent: true });
    s.label([9, 0.9], 'bridge', { colour: 'accent', weight: 600 });
    // each string to scale: L = c/2f, c = √(σ/ρ) = 276 m/s; the longest (E2, 1.68 m) 22 units
    const c = Math.sqrt(600e6 / 7850), notes = SCALES.major.map((k) => 440 * 2 ** ((-45 + 12 + 4 + k) / 12));
    const names = ['E2', 'F♯2', 'G♯2', 'A2', 'B2', 'C♯3', 'D♯3', 'E3', 'F♯3', 'G♯3', 'A3', 'B3'];
    const Lmax = c / (2 * notes[0]);
    notes.forEach((f, j) => {
      const y = 2 + j * 1.2, len = (22 * c) / (2 * f) / Lmax;
      s.wire([9.4, y], [9.4 + len, y]); s.dot([9.4 + len, y]);
      s.label([9.4 + len + 0.4, y + 0.35], names[j], { anchor: 'start', size: 10 });
    });
    s.label([23, 0.9], 'each string at 600 MPa: its length sets its note (E2 1.68 m … B3 0.56 m)', { size: 11 });
    // the pickup under the bridge
    s.wire([9, 15.6], [9, 16.4], [27.5, 16.4]);
    s.block([27.5, 15.2], 4, 2.4, { label: 'pickup', value: 'Σ pull' });
    s.wire([31.5, 16.4], [33, 16.4]); s.terminal([33, 16.4], 'out', { side: 'above' });
    return s.svg();
  },
};
