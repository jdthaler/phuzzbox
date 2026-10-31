// harness.mjs — what every test file shares: ok/FAIL lines and a non-zero exit on failure.
let failures = 0;
export function check(cond, what, detail = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`);
  if (!cond) failures++;
}
export function done() { if (failures) { console.log(`${failures} failed`); process.exit(1); } }
export const CI = !!process.env.CI;
