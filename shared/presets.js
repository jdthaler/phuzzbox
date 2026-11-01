// presets.js — the format of your own presets and of a shared link (as Forte's shared/presets.js).
// No DOM: the tests use it in Node; shared/user-presets.js is the pages' menu and dialog on top.
//
// A preset is the pedal's parameters as its contract has them (native/pedals/<slug>/
// <slug>-contract.json, tools/contract.mjs): by parameter id, a number, a choice's option key, or
// a toggle's true or false. From a pedal's 1.0 on, the contract promises that these ids, ranges
// and options keep meaning the same sound, so a preset saved today keeps working; an id a pedal no
// longer has is ignored, and a parameter a preset doesn't name takes its default.
//
// A preset file (.json), one preset or many:
//   { "phuzzbox": "presets", "format": 1, "pedal": "phuzz", "pedalVersion": "0.2.0",
//     "presets": [{ "name": "Cold gig", "values": { "fuzz": 0.8, "temp": 5, … } }] }
// format: this layout's version (FORMAT), so a later one can be read and migrated;
// pedalVersion: the pedal's version that saved it (for a migration after a major one).
//
// A shared link carries the parameters that differ from the defaults in the page's fragment:
//   https://phuzzbox.jthaler.net/phuzz/#_v=1&_n=Cold%20gig&temp=5&battery=7.5
// _v is FORMAT, _n the preset's name (optional). Opening it gives every other parameter its
// default. Numbers keep six significant figures; a toggle is 1 or 0.

import { params as paramsOf } from './params.js';

export const FORMAT = 1;
export const KIND = 'presets';
export const presetParams = (PEDAL) => paramsOf(PEDAL.groups);

// a value as the contract has it, or the parameter's default when it isn't one of its values
export function valid(p, v) {
  if (p.type === 'select') {
    const o = p.options.find(([k]) => k === v) ?? p.options.find(([k]) => String(k) === String(v));
    return o ? o[0] : p.def;
  }
  if (p.type === 'checkbox') return typeof v === 'boolean' ? v : v === 1 || v === 0 ? v === 1 : !!p.def;
  if (typeof v === 'string' && v.trim() !== '') v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v)) return p.def;
  return Math.min(p.max, Math.max(p.min, v));
}

// every parameter: the given value where there is a valid one, else the default
export function complete(params, values = {}) {
  return Object.fromEntries(params.map((p) => [p.id, values && Object.hasOwn(values, p.id) ? valid(p, values[p.id]) : p.def]));
}

export const cleanName = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

// a preset file's text, for presets [{ name, values }]
export function presetFile(PEDAL, version, presets) {
  const params = presetParams(PEDAL);
  return `${JSON.stringify({
    phuzzbox: KIND, format: FORMAT, pedal: PEDAL.id, pedalVersion: version || '',
    presets: presets.map((pr) => ({ name: cleanName(pr.name), values: complete(params, pr.values) })),
  }, null, 2)}\n`;
}

// A preset file's presets, each complete: { presets: [{ name, values }], warning? }. Throws an
// Error saying what is wrong when the text is not a preset file for this pedal. `names` maps a
// pedal's id to its name, for the message about a file for another pedal.
export function readPresetFile(text, PEDAL, names = {}) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('This file is not a PhuzzBox preset file (it is not JSON).'); }
  if (!d || typeof d !== 'object' || d.phuzzbox !== KIND || !Array.isArray(d.presets)) throw new Error('This file is not a PhuzzBox preset file.');
  if (d.pedal !== PEDAL.id) throw new Error(`These presets are for the ${names[d.pedal] ?? d.pedal ?? 'another pedal'}.`);
  const params = presetParams(PEDAL);
  const presets = d.presets
    .filter((pr) => pr && typeof pr === 'object' && pr.values && typeof pr.values === 'object')
    .map((pr, i) => ({ name: cleanName(pr.name) || `Preset ${i + 1}`, values: complete(params, pr.values) }));
  if (!presets.length) throw new Error('This preset file holds no presets.');
  const warning = Number(d.format) > FORMAT ? 'These presets come from a newer PhuzzBox: some settings may be left out.' : undefined;
  return { presets, warning };
}

// ---- shared links -------------------------------------------------------------------------------
const num = (v) => String(Number(v.toPrecision(6)));
const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? num(a) === num(b) : a === b);

// the fragment ('#_v=1&…') of a link to these values
export function linkHash(params, values, name = '') {
  const q = new URLSearchParams();
  q.set('_v', String(FORMAT));
  if (cleanName(name)) q.set('_n', cleanName(name));
  for (const p of params) {
    const v = valid(p, values[p.id]);
    if (same(v, p.type === 'checkbox' ? !!p.def : p.def)) continue;
    q.set(p.id, p.type === 'checkbox' ? (v ? '1' : '0') : p.type === 'select' ? String(v) : num(v));
  }
  return `#${q.toString()}`;
}

// A link's fragment read back: { name, values (complete) }, or null when it is not one
export function readLinkHash(hash, params) {
  const s = String(hash ?? '').replace(/^#/, '');
  if (!/^_v=\d+(&|$)/.test(s)) return null;
  const q = new URLSearchParams(s);
  const given = {};
  for (const p of params) {
    if (!q.has(p.id)) continue;
    const v = q.get(p.id);
    given[p.id] = p.type === 'checkbox' ? v === '1' || v === 'true' : v;
  }
  return { name: cleanName(q.get('_n')), values: complete(params, given) };
}
