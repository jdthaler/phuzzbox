// presets-tests.mjs — your own presets, preset files and shared links (shared/presets.js): every
// pedal's factory presets survive a link and a file exactly, a link carries only what differs
// from the defaults, and what isn't a valid value falls back to the default.

import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS } from '../shared/registry.js';
import { defaults } from '../shared/params.js';
import { presetParams, complete, valid, linkHash, readLinkHash, presetFile, readPresetFile, cleanName, FORMAT } from '../shared/presets.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// six significant figures, as a link keeps them
const close = (ps, a, b) => ps.every((p) => (typeof a[p.id] === 'number' ? Math.abs(a[p.id] - b[p.id]) <= 1e-5 * Math.abs(b[p.id]) : a[p.id] === b[p.id]));

for (const reg of PEDALS.filter((p) => p.ready)) {
  const { PEDAL } = await import(`${root}${reg.id}/src/${reg.id}-pedal.js`);
  const ps = presetParams(PEDAL), def = complete(ps, {});
  check(same(def, Object.fromEntries(ps.map((p) => [p.id, p.def]))) && same(Object.keys(def).sort(), Object.keys(defaults(PEDAL.groups)).sort()),
    `${reg.name}: a preset names every parameter, each at its default unless given`);
  check(readLinkHash(linkHash(ps, def), ps) && linkHash(ps, def) === `#_v=${FORMAT}`, `${reg.name}: a link to the defaults carries nothing but its format`);
  let links = true, files = true;
  for (const [name, values] of Object.entries(PEDAL.presets ?? {})) {
    const full = complete(ps, { ...def, ...values });
    const back = readLinkHash(linkHash(ps, full, name), ps);
    if (!back || back.name !== cleanName(name) || !close(ps, back.values, full)) { links = false; console.log(`  link: ${name}`); }
    const f = readPresetFile(presetFile(PEDAL, reg.version, [{ name, values: full }]), PEDAL);
    if (f.presets.length !== 1 || !same(f.presets[0].values, full) || f.warning) { files = false; console.log(`  file: ${name}`); }
  }
  check(links, `${reg.name}: each factory preset comes back from a link with its name (${Object.keys(PEDAL.presets ?? {}).length})`);
  check(files, `${reg.name}: each factory preset comes back from a file exactly`);
}

// what a link or a file can't carry falls back to the default, and the wrong file is refused
{
  const { PEDAL } = await import(`${root}phuzz/src/phuzz-pedal.js`);
  const ps = presetParams(PEDAL), p = ps.find((q) => !q.type), sel = ps.find((q) => q.type === 'select'), box = ps.find((q) => q.type === 'checkbox');
  check(valid(p, p.max * 10) === p.max && valid(p, 'loud') === p.def && valid(p, String(p.min)) === p.min, 'a number beyond its range is clamped, and one that is no number takes the default');
  if (sel) check(valid(sel, 'nonsense') === sel.def && valid(sel, sel.options.at(-1)[0]) === sel.options.at(-1)[0], 'a choice that is no option takes the default');
  if (box) check(valid(box, 1) === true && valid(box, 0) === false && valid(box, 'x') === !!box.def, 'a toggle is true or false, 1 or 0');
  const hash = `#_v=1&_n=%20Cold%0Agig&${p.id}=${p.max * 2}&nobody=3`;
  const got = readLinkHash(hash, ps);
  check(got.name === 'Cold gig' && got.values[p.id] === p.max && !('nobody' in got.values), 'a link\'s name is cleaned, its values clamped, and unknown ids ignored');
  check(readLinkHash('#about', ps) === null && readLinkHash('#tour', ps) === null, 'the How it works and tour hashes are not links to settings');
  const { PEDAL: WAH } = await import(`${root}wah/src/wah-pedal.js`);
  let msg = '';
  try { readPresetFile(presetFile(WAH, '0.1.0', [{ name: 'x', values: {} }]), PEDAL, { wah: 'Wah' }); } catch (e) { msg = e.message; }
  check(/for the Wah/.test(msg), 'a file of another pedal\'s presets is refused, naming it', msg);
  try { readPresetFile('{"forte":"presets"}', PEDAL); msg = ''; } catch (e) { msg = e.message; }
  check(/not a PhuzzBox preset file/.test(msg), 'a file that is not a PhuzzBox preset file is refused');
  const newer = JSON.parse(presetFile(PEDAL, '9.0.0', [{ name: 'a', values: {} }, { name: '', values: {} }]));
  newer.format = FORMAT + 1;
  const r = readPresetFile(JSON.stringify(newer), PEDAL);
  check(r.presets.length === 2 && r.presets[1].name === 'Preset 2' && /newer PhuzzBox/.test(r.warning ?? ''), 'a newer format is read with a warning, and a preset without a name gets one');
}
done();
