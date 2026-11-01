// plugin-release.mjs — a plugin release (the release-plugins workflow): its notes, its tag, the
// pedals it packs and the files it must hold, as Forte's.
//
// Usage: node tools/plugin-release.mjs              the notes (Markdown)
//        node tools/plugin-release.mjs --tag        the default tag, plugins-v<PhuzzBox version>
//        node tools/plugin-release.mjs --plugins    "<id><TAB><name>" for each pedal with plugins
//                                                   (tools/package-plugins.sh)
//        node tools/plugin-release.mjs --files      every archive a release must hold
//        node tools/plugin-release.mjs --manifest   what a release holds: each pedal's version and
//                                                   the native/ tree it was built from

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PHUZZBOX_VERSION } from '../shared/registry.js';
import { APP, SYSTEMS, archive, withPlugins } from '../shared/plugins.js';

// A release is published only when this changes (the workflow compares it with the latest
// release's manifest.txt): a new or changed pedal, or any change under native/.
export function manifest() {
  const tree = execSync('git rev-parse HEAD:native', { cwd: new URL('..', import.meta.url) }).toString().trim();
  return [`phuzzbox ${PHUZZBOX_VERSION}`, `native ${tree}`, ...withPlugins().map((p) => `${p.id} ${p.version}`)].join('\n');
}

export const files = () => [null, APP, ...withPlugins().map((p) => p.id)].flatMap((id) => SYSTEMS.map(([, suffix]) => archive(id, suffix)));

// GitHub shows each line break in a release's notes, so paragraphs and list items wrapped in the
// file are joined into one line each (code, tables and headings stay as they are).
function unwrap(md) {
  const out = [];
  let code = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) code = !code;
    const prev = out.at(-1) ?? '';
    const joins = !code && line.trim() && !/^\s*([-*] |[|#>]|\d+\.|```)/.test(line) && prev.trim() && !/^\s*([|#]|```)/.test(prev);
    if (joins) out[out.length - 1] = `${prev} ${line.trim()}`;
    else out.push(line);
  }
  return out.join('\n');
}

// The table's rows are what shared/plugins.js's parseRelease reads: "| Name | `id` | version | …".
export function notes() {
  const install = readFileSync(new URL('../plugins/README.md', import.meta.url), 'utf8').replace(/^# .*\n+/, '');
  return [
    `PhuzzBox's pedals as plugins and the PhuzzBox app, built from the same C++ physics as <https://phuzzbox.jthaler.net> (PhuzzBox ${PHUZZBOX_VERSION}).`,
    '',
    `| Pedal | Id | Version | ${SYSTEMS.map(([s]) => s).join(' | ')} |`,
    `|---|---|---|${SYSTEMS.map(() => '---').join('|')}|`,
    ...withPlugins().map((p) => `| ${p.name} | \`${p.id}\` | ${p.version} | ${SYSTEMS.map(([, suffix]) => `\`${archive(p.id, suffix)}\``).join(' | ')} |`),
    '',
    `Every pedal and the app together: ${SYSTEMS.map(([s, suffix]) => `\`${archive(null, suffix)}\` (${s})`).join(', ')}. The app alone: ${SYSTEMS.map(([, suffix]) => `\`${archive(APP, suffix)}\``).join(', ')}.`,
    '',
    unwrap(install).replace(/^## /gm, '### '),
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  console.log(arg === '--tag' ? `plugins-v${PHUZZBOX_VERSION}`
    : arg === '--plugins' ? withPlugins().map((p) => `${p.id}\t${p.name}`).join('\n')
    : arg === '--manifest' ? manifest()
    : arg === '--files' ? files().join('\n')
    : notes());
}
