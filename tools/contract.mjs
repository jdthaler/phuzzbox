// contract.mjs — what a song saved with a PhuzzBox plugin relies on, and whether a change keeps it
// (as Forte's tools/contract.mjs).
//
// tools/gen-native-params.mjs writes each pedal's native/pedals/<slug>/<slug>-contract.json from
// its descriptor: every parameter by id with its kind, range, step, scaling and default, the
// options of a choice in order, and the presets in order. A host saves the plugin's state by
// parameter id (native/plugin/plugin.cpp), keeps automation as VST3's normalised values (so a
// parameter's range is part of it) and the Preset choice by position. So a change breaks saved
// songs when it removes or renames a parameter, changes its kind, range, step, scaling or default,
// removes, renames or moves a choice's option or a preset, or changes a preset's values. Adding
// parameters, options at the end and presets at the end breaks nothing.
//
// From 1.0 on a pedal whose contract breaks needs a major release note (changes/README.md);
// `node tools/release.mjs --check-pr` enforces it, and warns about the breaks before 1.0.
//
// Usage: node tools/contract.mjs [<ref>]      the breaks and additions since <ref> (default origin/main)

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const R = new URL('..', import.meta.url);
export const contractPath = (slug) => `native/pedals/${slug}/${slug}-contract.json`;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What changed from one contract to the next: breaks (saved songs change) and additions.
export function compare(before, after) {
  const breaks = [], added = [];
  const now = new Map(after.params.map((p) => [p.id, p]));
  for (const p of before.params) {
    const q = now.get(p.id);
    if (!q) { breaks.push(`parameter ${p.id} is gone`); continue; }
    if (p.kind !== q.kind) { breaks.push(`parameter ${p.id} goes from ${p.kind} to ${q.kind}`); continue; }
    for (const k of ['min', 'max', 'step', 'log', 'def']) {
      if (k in p && !same(p[k], q[k])) breaks.push(`parameter ${p.id}: ${k} goes from ${JSON.stringify(p[k])} to ${JSON.stringify(q[k])}`);
    }
    if (p.options) {
      const kept = p.options.every((o, i) => q.options[i] === o);
      if (!kept) breaks.push(`parameter ${p.id}: its options go from ${p.options.join(', ')} to ${q.options.join(', ')}`);
      else if (q.options.length > p.options.length) added.push(`parameter ${p.id}: options ${q.options.slice(p.options.length).join(', ')}`);
    }
  }
  const had = new Set(before.params.map((p) => p.id));
  for (const q of after.params) if (!had.has(q.id)) added.push(`parameter ${q.id}`);
  before.presets.forEach((pr, i) => {
    const q = after.presets[i];
    if (!q) breaks.push(`preset ${i + 1}, ${pr.name}, is gone`);
    else if (q.name !== pr.name) breaks.push(`preset ${i + 1} goes from ${pr.name} to ${q.name}`);
    else if (!same(pr.values, q.values)) breaks.push(`preset ${pr.name}: its values change`);
  });
  for (const q of after.presets.slice(before.presets.length)) added.push(`preset ${q.name}`);
  return { breaks, added };
}

const git = (...a) => execFileSync('git', a, { cwd: R, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const atRef = (ref, path) => { try { return JSON.parse(git('show', `${ref}:${path}`)); } catch { return null; } };
const slugsAt = (ref) => { try { return git('ls-tree', '--name-only', `${ref}:native/pedals`).split('\n').filter(Boolean); } catch { return []; } };

// Every pedal's changes between two commits (one without a contract at base is new: nothing breaks).
export function changesBetween(base, head) {
  const out = [];
  for (const slug of slugsAt(head)) {
    const a = atRef(base, contractPath(slug)), b = atRef(head, contractPath(slug));
    if (!a || !b) continue;
    const c = compare(a, b);
    if (c.breaks.length || c.added.length) out.push({ slug, ...c });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2] ?? 'origin/main';
  const changes = changesBetween(base, 'HEAD');
  for (const c of changes) {
    for (const b of c.breaks) console.log(`${c.slug}: breaks: ${b}`);
    for (const a of c.added) console.log(`${c.slug}: adds: ${a}`);
  }
  if (!changes.length) console.log(`no contract changes since ${base}`);
}
