// test-all.mjs — run every test/*-tests.mjs in parallel (or those whose names contain an argument)
// and report all the failures. `npm test`, `npm test buffer`.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../test/', import.meta.url));
const want = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('-tests.mjs') && (!want.length || want.some((w) => f.includes(w))));
const run = (f) => new Promise((resolve) => {
  const p = spawn(process.execPath, [dir + f], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ f, code, out }));
});
const results = await Promise.all(files.map(run));
let failed = 0;
for (const { f, code, out } of results) {
  const fails = out.split('\n').filter((l) => /^FAIL|Error/.test(l));
  const oks = out.split('\n').filter((l) => /^ok/.test(l)).length;
  console.log(`${code ? 'FAIL' : 'ok  '} ${f}: ${oks} passed${fails.length ? `, ${fails.length} failed` : ''}`);
  if (code) { failed++; console.log(out.split('\n').filter((l) => !/^ok/.test(l)).map((l) => `    ${l}`).join('\n')); }
}
process.exit(failed ? 1 : 0);
