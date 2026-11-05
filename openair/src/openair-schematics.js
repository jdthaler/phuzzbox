// openair-schematics.js — Open Air's geometry (shared/schematic.js), written to openair/schematics/
// by tools/gen-schematics.mjs: the bass and you over the ground, the direct path and the one
// reflected from the ground, which seems to come from the bass's image below it. Heights are drawn
// a few times larger than the distance, which is in fact 100 m.
import { schematic } from '../../shared/schematic.js';

export const SCHEMATICS = {
  field() {
    const s = schematic({ w: 32, h: 19, title: 'Open Air: the bass and you over the ground, the direct path r1 and the path r2 reflected from the ground, which seems to come from the bass\'s image beneath it' });
    const ground = 11, src = [3, 7.5], you = [29, 5.4], image = [3, 14.5];
    const t = (image[1] - ground) / (image[1] - you[1]), hit = [image[0] + t * (you[0] - image[0]), ground];
    // the ground, its surface hatched
    s.wire([0.6, ground], [31.4, ground]);
    for (let x = 1; x < 31.4; x += 1.2) s.wire([x, ground], [x - 0.6, ground + 0.6]);
    s.label([24, ground + 1.8], 'the ground: its impedance Z, by its flow resistivity σ', { size: 11 });
    // the bass, you, and the image
    s.wire([src[0], src[1]], [src[0], ground]);
    s.block([src[0] - 0.7, src[1] - 0.7], 1.4, 1.4, { accent: true });
    s.label([src[0] + 1.2, src[1] - 1.2], 'the bass, hs up', { anchor: 'start', colour: 'accent', size: 11 });
    s.wire([you[0], you[1]], [you[0], ground]);
    s.dot(you);
    s.label([you[0] - 0.2, you[1] - 1.1], 'you, hr up', { anchor: 'end', colour: 'ink', size: 11 });
    s.block([image[0] - 0.7, image[1] - 0.7], 1.4, 1.4, { colour: 'ink2', dash: '4 4' });
    s.label([image[0] + 1.2, image[1] + 1.4], 'its image, hs down', { anchor: 'start', size: 11 });
    // the paths
    s.arrow([src[0] + 0.8, src[1] - 0.1], [you[0] - 0.4, you[1] + 0.05], { colour: 'accent' });
    s.label([16, 5.4], 'r1, the direct path', { colour: 'accent', size: 11 });
    s.arrow([src[0] + 0.6, src[1] + 0.6], hit, { colour: 'accent2' });
    s.arrow(hit, [you[0] - 0.4, you[1] + 0.3], { colour: 'accent2' });
    s.arrow([image[0] + 0.7, image[1] - 0.3], hit, { dash: '5 4' });
    s.label([20.5, 9.6], 'r2, reflected: Q', { colour: 'accent2', size: 11 });
    s.label([16, 18.2], 'heard: e^(ik r1)/r1 + Q e^(ik r2)/r2, each path through the air\'s absorption', { size: 11 });
    return s.svg();
  },
};
