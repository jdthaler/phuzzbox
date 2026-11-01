// doppler-schematics.js — the Doppler's geometry (shared/schematic.js), written to doppler/schematics/
// by tools/gen-schematics.mjs: the source on its road, where it was when it sent what you hear now,
// and the path that sound took.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  road() {
    const s = schematic({ w: 32, h: 15, title: 'The Doppler: the source on a straight road d from you, what you hear now sent from where it was D earlier, along a path c D long' });
    // the road
    s.block([0.6, 2.6], 30.8, 1.6, { colour: 'ink2', dash: '6 6' });
    s.label([2.6, 1.9], 'the road', { anchor: 'start', size: 11 });
    // where it was, and where it is
    const was = [8, 3.4], is = [21, 3.4], you = [16, 12];
    s.dot(was); s.label([was[0] - 0.4, 5.4], 'where it was: τ = t − D', { anchor: 'end', size: 11 });
    s.block([is[0] - 0.5, is[1] - 0.5], 1, 1, { accent: true });
    s.arrow([is[0] + 0.8, is[1]], [is[0] + 4, is[1]], { colour: 'accent' });
    s.label([is[0] + 2.4, 1.9], 'v', { colour: 'accent', weight: 600 });
    s.label([is[0], 5.4], 'where it is now', { colour: 'accent', size: 11 });
    s.arrow(was, [you[0] - 0.3, you[1] - 0.5], { dash: '5 4' });
    s.label([10.4, 9.4], 'the sound: c D', { anchor: 'end', size: 11 });
    // you, and how far the road is
    s.dot(you); s.dot([you[0] - 0.6, you[1]]); s.dot([you[0] + 0.6, you[1]]);
    s.label([you[0], you[1] + 1.8], 'you, at t (moving at u)', { colour: 'ink', weight: 600 });
    s.wire([27, 3.4], [27, 12]);
    s.label([27.6, 8], 'd', { anchor: 'start', weight: 600 });
    s.label([16, 14.6], 'c² D² = (X − v D)² + d²: X where it is now, from you along the road', { size: 11 });
    return s.svg();
  },
};
