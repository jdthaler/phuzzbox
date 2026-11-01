// board-pedals.js — every pedal the Pedalboard can hold: their descriptors, by id. The board's
// page and its worklet import this list (test/board-tests.mjs checks it has every ready pedal).

import { PEDAL as BUFFER } from '../../buffer/src/buffer-pedal.js';
import { PEDAL as PHUZZ } from '../../phuzz/src/phuzz-pedal.js';
import { PEDAL as WAH } from '../../wah/src/wah-pedal.js';
import { PEDAL as PREAMP } from '../../preamp/src/preamp-pedal.js';
import { PEDAL as OPTO } from '../../opto/src/opto-pedal.js';
import { PEDAL as CABINET } from '../../cabinet/src/cabinet-pedal.js';
import { PEDAL as ENVELOPE } from '../../envelope/src/envelope-pedal.js';
import { PEDAL as OCTAVE } from '../../octave/src/octave-pedal.js';
import { PEDAL as SPRING } from '../../spring/src/spring-pedal.js';
import { PEDAL as ECHO } from '../../echo/src/echo-pedal.js';
import { PEDAL as ROTARY } from '../../rotary/src/rotary-pedal.js';
import { PEDAL as PLATE } from '../../plate/src/plate-pedal.js';
import { PEDAL as SYMPATHETIC } from '../../sympathetic/src/sympathetic-pedal.js';
import { PEDAL as BLACKHOLE } from '../../blackhole/src/blackhole-pedal.js';

export const BOARD_PEDALS = Object.fromEntries([BUFFER, PHUZZ, WAH, PREAMP, OPTO, CABINET, ENVELOPE, OCTAVE, SPRING, ECHO, ROTARY, PLATE, SYMPATHETIC, BLACKHOLE].map((d) => [d.id, d]));

// each pedal's enclosure and the ink printed on it, as its own page has them (<id>/style.css)
export const ENCLOSURES = {
  buffer: ['#5b6470', '#f5f3ef'], phuzz: ['#8c2f1f', '#f7efe6'], wah: ['#2b2b2e', '#f2efe8'],
  preamp: ['#b08a55', '#2a1d10'], opto: ['#8a9096', '#16181b'], cabinet: ['#232326', '#ece8e1'],
  envelope: ['#4b2f6e', '#f1e9fb'], octave: ['#1f4d47', '#e6f4f1'], spring: ['#3a3f47', '#eef1f5'],
  echo: ['#5a4632', '#f6eee2'], rotary: ['#6b3a1e', '#f4e7d6'],
  plate: ['#c9c6bd', '#1d1f22'], sympathetic: ['#7a5a1f', '#f7efdc'],
  blackhole: ['#0d0d12', '#f3d9a4'],
};
