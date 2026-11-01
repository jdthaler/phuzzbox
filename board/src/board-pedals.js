// board-pedals.js — every pedal the Pedalboard can hold: their descriptors, by id. The board's
// page and its worklet import this list (test/board-tests.mjs checks it has every ready pedal).

import { PEDALS } from '../../shared/registry.js';
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
import { PEDAL as DOPPLER } from '../../doppler/src/doppler-pedal.js';

export const BOARD_PEDALS = Object.fromEntries([BUFFER, PHUZZ, WAH, PREAMP, OPTO, CABINET, ENVELOPE, OCTAVE, SPRING, ECHO, ROTARY, PLATE, SYMPATHETIC, BLACKHOLE, DOPPLER].map((d) => [d.id, d]));

// each pedal's enclosure and the ink printed on it, as its own page has them (<id>/style.css)
export const ENCLOSURES = Object.fromEntries(PEDALS.filter((p) => p.enclosure).map((p) => [p.id, p.enclosure]));
