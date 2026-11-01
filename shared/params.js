// params.js — a pedal's parameters as its descriptor lists them, and the text a value shows. The
// C++ (native/core/src/params.cpp) shows the same text from the same fields, so a knob reads alike
// on the page and in a plugin.
//
//   { id: 'pickupL', label: 'Pickup inductance', min: 0.5, max: 12, def: 3.6, log: true,
//     unit: 'H', scale: 1, decimals: 2, hint: 'What the hint says the knob does to the sound.' }
//   { id: 'active', label: 'Active electronics', type: 'checkbox', def: false }
//   { id: 'mode', label: 'Mode', type: 'select', options: [['a', 'A'], ['b', 'B']], def: 'a' }
//
// Values are in SI units (ohms, farads, henries, metres, seconds); `scale` shows them in friendlier
// ones (kΩ: scale 0.001). `showIf: (P) => …` hides a control when it is irrelevant (page only).

export const params = (groups) => groups.flatMap((g) => g.params.map((p) => ({ group: g.name, ...p })));

export function defaults(groups) {
  const P = {};
  for (const p of params(groups)) P[p.id] = p.def;
  return P;
}

export function fmt(p, v) {
  if (p.type === 'select') return p.options.find(([x]) => x === v)?.[1] ?? String(v);
  if (p.type === 'checkbox') return v ? 'on' : 'off';
  let s = (v * (p.scale ?? 1)).toFixed(p.decimals ?? 2);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  s = s.replace('-', '−');
  return p.unit ? `${s} ${p.unit}` : s;
}

// A parameter's number for the native code: a choice's index, a toggle's 0 or 1.
export function nativeValue(p, v) {
  if (p.type === 'select') { const k = p.options.findIndex(([x]) => x === v); return k < 0 ? p.options.findIndex(([x]) => x === p.def) : k; }
  if (p.type === 'checkbox') return v ? 1 : 0;
  return typeof v === 'number' && Number.isFinite(v) ? v : p.def;
}

// A native number back as the descriptor's value: a choice's key, a toggle's true or false.
export function fromNative(p, v) {
  if (p.type === 'select') return p.options[Math.round(v)]?.[0] ?? p.def;
  if (p.type === 'checkbox') return v >= 0.5;
  return v;
}

// Position 0..1 along a knob (log parameters in log(value)), and back, snapped to `step`.
export function toUnit(p, v) {
  if (p.log) return Math.log(v / p.min) / Math.log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
}
export function fromUnit(p, x) {
  x = Math.min(1, Math.max(0, x));
  let v = p.log ? p.min * (p.max / p.min) ** x : p.min + x * (p.max - p.min);
  if (p.step) v = p.min + Math.round((v - p.min) / p.step) * p.step;
  return Math.min(p.max, Math.max(p.min, v));
}
