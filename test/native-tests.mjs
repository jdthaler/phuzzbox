// native-tests.mjs — the generated C++ tables and the app's bundled window match their sources, and each committed
// WebAssembly build has the descriptor's parameters (a stale build is refused when loaded).

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, done } from './harness.mjs';
import { PEDALS } from '../shared/registry.js';
import { loadPedal } from '../tools/engine.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
let fresh = true;
try { execFileSync(process.execPath, [`${root}tools/gen-native-params.mjs`, '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; console.log(String(e.stdout)); }
check(fresh, 'the C++ parameter tables are generated from the descriptors as they stand');
let bundled = true;
try { execFileSync(process.execPath, [`${root}tools/bundle-app.mjs`, '--check'], { stdio: 'pipe' }); } catch (e) { bundled = false; console.log(String(e.stderr)); }
check(bundled, 'the app\'s window (native/app/buffer.html) is bundled from the modules as they stand');

for (const p of PEDALS.filter((q) => q.ready)) {
  check(existsSync(`${root}${p.id}/wasm/${p.id}.wasm`), `${p.name}: its WebAssembly is committed`);
  let ok = true;
  try { await loadPedal(p.id); } catch (e) { ok = false; console.log(e.message); }
  check(ok, `${p.name}: the WebAssembly has the descriptor's parameters`);
}
check(existsSync(`${root}testbass/wasm/testbass.wasm`), 'the test bass\'s WebAssembly is committed');
done();
