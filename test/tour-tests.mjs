// tour-tests.mjs — the guided tours (shared/tour.js) and How it works (shared/notes.js): every
// ready pedal has a tour, its page loads it, and each step names views the page has, presets the
// pedal has, parameters it has with values in their ranges, and notes the test bass can play. A
// tour's numbers are the READMEs' (which the pedals' tests check), so every quantity in its text
// must appear in its pedal's README, the test bass's, the tuner's, the scope's or the spectrum's, or be a
// setting the step makes.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS } from '../shared/registry.js';
import { params } from '../shared/params.js';
import { renderMarkdown } from '../shared/markdown.js';
import { RIFF, RIFF_BPM } from '../shared/testbass.js';
import { midi, note, run, riff, sweep, score, length, RANGE } from '../shared/tour.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(`${root}${rel}`, 'utf8');

// the helpers
{
  check(midi('E1') === 28 && midi('A1') === 33 && midi('G2') === 43 && midi('F#2') === 42 && midi('Bb1') === 34 && midi(40) === 40,
    'notes by name: E1 is the open low E (28), G2 the open G (43)');
  let threw = false;
  try { midi('H2'); } catch { threw = true; }
  check(threw, 'a name that is not a note is refused');
  const r = run('E1 G1 A1', { at: 1, step: 0.5 });
  check(r.map((n) => n.at).join() === '1,1.5,2' && r.every((n) => n.dur < 0.5), 'a run steps through its notes, each let go before the next');
  const beats = RIFF.reduce((s, [, b]) => s + b, 0), rf = riff({ at: 2, times: 2 });
  check(rf.length === 2 * RIFF.filter(([k]) => k).length && Math.abs(Math.max(...rf.map((n) => n.at + n.dur)) - (2 + 2 * beats * 60 / RIFF_BPM)) < 0.2,
    'the riff is the page\'s, at its tempo', `${beats} beats, ${(beats * 60 / RIFF_BPM).toFixed(2)} s`);
  const sw = sweep('cable', 0.3, 30, { at: 1, dur: 4, log: true });
  check(sw[0].set.cable === 0.3 && sw.at(-1).set.cable === 30 && sw.at(-1).at === 5 && Math.abs(sw[sw.length >> 1].set.cable - 3) < 1e-9,
    'a sweep moves a parameter from one value to the other, by ratios when asked');
  const step = { play: [note('E1', { at: 2, dur: 3 }), [run('A1 D2', { step: 1 })], { at: 1, set: { x: 1 } }] };
  check(score(step).map((e) => e.at).join() === '0,1,1,2' && length(step) === 5, 'a step\'s score is every event in time order, and its length the last to end');
}

// How it works: every page's tabs are READMEs that exist and render
for (const dir of ['testbass', 'testguitar', 'tuner', 'metronome', 'rig', 'scope', 'spectrum']) {
  const md = read(`${dir}/README.md`);
  let html = '';
  try { html = renderMarkdown(md, { skip: ['Files'] }).html; } catch (e) { console.log(e.message); }
  check(html.length > 500 && /^## Prior art and references/m.test(md) && /^## What is simplified/m.test(md),
    `How it works: ${dir}/README.md renders, credits prior art and says what is simplified`);
}
check(/['"]testbass\/['"]/.test(read('shared/notes.js')) && /['"]testguitar\/['"]/.test(read('shared/notes.js')) && /['"]tuner\/['"]/.test(read('shared/notes.js')), 'How it works: every page has the test bass\'s and the tuner\'s notes');

// a measured quantity in prose: a number and its unit
const QUANTITY = /(\d+(?:\.\d+)?(?: × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?) ?(kΩ|Ω|µF|nF|pF|pF\/m|mH|H|kHz|Hz|dB|mV|V|µA|mA|°C|cents|cm|ms|m|%)(?![\w/])/g;
const norm = (s) => s.replace(/[  ]/g, ' ').replace(/\*\*/g, '');
const shared = norm(['testbass', 'testguitar', 'tuner', 'scope', 'spectrum'].map((d) => read(`${d}/README.md`)).join('\n'));

for (const p of PEDALS.filter((x) => x.ready)) {
  const file = `${p.id}/src/${p.id}-tour.js`;
  if (!existsSync(`${root}${file}`)) { check(false, `${p.name}: a guided tour of its physics`, `write ${file} (docs/PEDAL_GUIDE.md, "The guided tour")`); continue; }
  const html = read(`${p.id}/index.html`);
  const main = html.indexOf(`src="src/${p.id}-main.js"`), loads = html.indexOf(`<script type="module" src="src/${p.id}-tour.js"></script>`);
  check(loads > main && main > 0, `${p.name}: its page loads its tour after its main module`);
  const { TOUR } = await import(`${root}${file}`);
  const { PEDAL } = await import(`${root}${p.id}/src/${p.id}-pedal.js`);
  check(TOUR.id === p.id && TOUR.steps.length >= 3 && TOUR.steps.length <= 8, `${p.name}: its tour has 3 to 8 steps`, `${TOUR.steps.length}`);
  // the page's views: their titles in its main module, and the tuner, the scope and the spectrum
  const views = ['Tuner', 'Scope', 'Spectrum', ...[...read(`${p.id}/src/${p.id}-main.js`).matchAll(/^\s*title:\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => m[1].replace(/\\(.)/g, '$1'))];
  const byId = new Map(params(PEDAL.groups).map((q) => [q.id, q]));
  const valid = (q, v) => (q.type === 'checkbox' ? typeof v === 'boolean' : q.type === 'select' ? q.options.some(([o]) => o === v) : Number.isFinite(v) && v >= q.min && v <= q.max);
  const readme = norm(read(`${p.id}/README.md`)) + shared;
  const problems = [];
  TOUR.steps.forEach((s, i) => {
    const bad = (m) => problems.push(`step ${i + 1} (${s.title ?? 'untitled'}): ${m}`);
    if (!s.title || s.title.length > 48) bad('a title of a few words');
    if (!s.text || s.text.length < 80) bad('text saying what to listen for');
    if (s.text?.length > 900) bad(`text of ${s.text.length} characters (900 at most: the card is small)`);
    try { renderMarkdown(s.text ?? ''); } catch (e) { bad(`its Markdown: ${e.message}`); }
    if (i === 0 && !s.views?.length) bad('the first step names the views it shows');
    for (const v of s.views ?? []) if (!views.some((w) => w.toLowerCase() === v.toLowerCase())) bad(`no view "${v}" (the page has ${views.join(', ')})`);
    if (s.preset && !PEDAL.presets?.[s.preset]) bad(`no preset "${s.preset}"`);
    if (s.bypass !== undefined && typeof s.bypass !== 'boolean') bad('bypass is true or false');
    for (const o of [s.set ?? {}, ...score(s).filter((e) => e.set).map((e) => e.set)]) {
      for (const [k, v] of Object.entries(o)) {
        const q = byId.get(k);
        if (!q) bad(`no parameter ${k}`);
        else if (!valid(q, v)) bad(`${k} = ${JSON.stringify(v)} is out of its range or not one of its options`);
      }
    }
    for (const e of score(s)) {
      if (e.key === undefined) {
        if (!e.set && typeof e.bypass !== 'boolean') bad(`an event that is neither a note, a set nor the footswitch: ${JSON.stringify(e)}`);
        continue;
      }
      if (!Number.isInteger(e.key) || e.key < RANGE[0] || e.key > RANGE[1]) bad(`note ${e.key} is outside the test bass's ${RANGE.join('–')}`);
      if (!(e.at >= 0) || !(e.dur > 0) || !(e.vel > 0 && e.vel <= 1)) bad(`a note needs at ≥ 0, dur > 0 and 0 < vel ≤ 1: ${JSON.stringify(e)}`);
    }
    if (!score(s).some((e) => e.key !== undefined)) bad('plays nothing');
    if (length(s) > 20) bad(`plays for ${length(s).toFixed(1)} s (20 at most)`);
    // a quantity is the READMEs' (measured, and tested there), or a setting the step itself makes
    const setting = new Set();
    for (const o of [s.preset ? PEDAL.presets[s.preset] : {}, s.set ?? {}, ...score(s).filter((e) => e.set).map((e) => e.set)]) {
      for (const [k, v] of Object.entries(o)) { const q = byId.get(k); if (q && typeof v === 'number') setting.add(`${+(v * (q.scale ?? 1)).toPrecision(6)} ${q.unit}`); }
    }
    for (const [, num, unit] of norm(s.text ?? '').matchAll(QUANTITY)) {
      if (!readme.includes(`${num} ${unit}`) && !readme.includes(`${num}${unit}`) && !setting.has(`${+num} ${unit}`)) bad(`"${num} ${unit}" is neither in the READMEs nor a setting the step makes`);
    }
  });
  check(!problems.length, `${p.name}: every step of its tour names views, presets, parameters and notes it has, and the READMEs' numbers`, problems.join('; '));
}

done();
