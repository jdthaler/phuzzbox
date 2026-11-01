// plugins.js — where the plugins and the app are downloaded: the archives of the latest plugin
// release, one per system with every pedal and the app, one per system with the app alone, and
// one per system for each ready pedal. The release-plugins workflow publishes them after each
// release of the site (tools/package-plugins.sh packs them, tools/plugin-release.mjs names them);
// the Plugins tab of How it works links them (shared/notes.js), with plugins/README.md on
// installing them.
// The links are the files themselves, never a page on GitHub (Jesse, 2026-11-01: the credits
// are the site's only link to GitHub; downloads may fetch a release's files directly).

import { PEDALS, SOURCE } from './registry.js';

export const LATEST = `${SOURCE}/releases/latest/download/`;
const API = SOURCE.replace('://github.com/', '://api.github.com/repos/') + '/releases/latest';

// [system, archive suffix, the formats in it]
export const SYSTEMS = [
  ['macOS', 'macos.zip', 'AU · VST3 · CLAP · app'],
  ['Windows', 'windows.zip', 'VST3 · CLAP · app'],
  ['Linux', 'linux.tar.gz', 'VST3 · CLAP · app'],
];
export const APP = 'app'; // archive(APP, …): the PhuzzBox app alone

export const withPlugins = () => PEDALS.filter((p) => p.ready && p.plugin);

// PhuzzBox-plugins-<system> holds every pedal and the app, PhuzzBox-app-<system> the app alone,
// PhuzzBox-<id>-<system> one pedal.
export const archive = (id, suffix) => `PhuzzBox-${id ?? 'plugins'}-${suffix}`;
export const downloads = (id) => SYSTEMS.map(([system, suffix, formats]) => ({ system, formats, file: archive(id, suffix), url: LATEST + archive(id, suffix) }));

// What a plugin release holds, from its notes (tools/plugin-release.mjs): each pedal's version,
// from the table's "| Name | id | version |" rows.
export function parseRelease({ tag_name: tag, body = '' }) {
  const versions = {};
  for (const m of body.matchAll(/^\| [^|]+ \| `([\w-]+)` \| ([\d.]+) \|/gm)) versions[m[1]] = m[2];
  return { tag, versions };
}

// The latest plugin release, asked of GitHub's API once a visit (kept ten minutes in the tab):
// { tag, versions }, or { none: true } before the first release, or null when it can't be had
// (offline, the API's limit), and the downloads then say nothing more.
const KEY = 'phuzzbox/plugin-release';
let asked = null;
export function latestRelease() {
  return (asked ??= (async () => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(KEY));
      if (kept && Date.now() - kept.at < 600e3) return kept.release;
    } catch { /* no storage */ }
    const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 404) return { none: true };
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const release = parseRelease(await r.json());
    try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), release })); } catch { /* no storage */ }
    return release;
  })().catch(() => (asked = null)));
}

// The line under the downloads: which release they are, and for a pedal whether this version of
// it is in it yet. `ok` is false when the files aren't there to download.
const NEXT = 'the plugin release that follows the site\'s next update';
export function releaseLine(rel, pedal) {
  if (rel.none) return { ok: false, text: `The first plugin release is still to come: it follows the site's next update.` };
  if (!pedal) return { ok: true, text: `From the plugin release ${rel.tag}.` };
  const v = rel.versions[pedal.id];
  if (!v) return { ok: false, text: `No plugin of the ${pedal.name} yet: it comes in ${NEXT}.` };
  return { ok: true, text: v === pedal.version ? `The ${pedal.name} ${v}, from the plugin release ${rel.tag}.`
    : `The ${pedal.name} ${v}, from the plugin release ${rel.tag}. This page is ${pedal.version}, whose plugin comes in ${NEXT}.` };
}
