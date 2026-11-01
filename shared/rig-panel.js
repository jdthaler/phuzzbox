// rig-panel.js — the rig's units at the foot of every page (shared/rig.js is their physics): small
// grey boxes in a row, from the interface to the pedal, each with its knobs and a footswitch, as a
// player's board starts. Their settings are the same on every page (phuzzbox.rig). The page shows
// them while your interface is the input; the test bass and guitar skip them, so the page shows
// the fretboard there instead.
//
//   const units = rigUnits({ h, store, knobFor, send, first })   // first: an element before them
//   units.el; units.values() the rig's values, for the worklet's { type: 'rig', R }

import { RIG_UNITS, RIG_KEY, rigValues } from './rig.js';
import { fmt } from './params.js';

export function rigUnits({ h, store, knobFor, send, first = null, about = null }) {
  const R = rigValues(store.get(RIG_KEY, {}));
  const put = (id, v) => { R[id] = v; store.set(RIG_KEY, R); send({ type: 'rig', R: { ...R } }); refresh(); };
  const refreshers = [];
  const refresh = () => refreshers.forEach((f) => f());

  const units = RIG_UNITS.map((u) => {
    const knobs = h('div', { class: 'knobs' });
    for (const p of u.params) {
      if (p.id === u.on) continue;
      if (p.type === 'select') {
        const sel = h('select', { 'aria-label': p.label, title: p.hint ?? '', 'data-param': `rig-${p.id}` }, ...p.options.map(([v, l]) => h('option', { value: v }, l)));
        sel.addEventListener('change', () => { put(p.id, sel.value); sel.blur(); });
        const el = h('div', { class: 'knob pick' }, sel, h('div', { class: 'klabel' }, p.label));
        refreshers.push(() => { sel.value = R[p.id]; });
        knobs.append(el);
      } else {
        const k = knobFor(p, () => R[p.id], (v) => put(p.id, v));
        k.dataset.param = `rig-${p.id}`;
        refreshers.push(() => k.refresh());
        knobs.append(k);
      }
    }
    const led = h('span', { class: 'led', 'aria-hidden': 'true' });
    const foot = h('button', { type: 'button', class: 'footswitch', title: `Switch the ${u.name.toLowerCase()} in or out`, 'aria-label': `${u.name} on` });
    foot.addEventListener('click', () => { put(u.on, !R[u.on]); foot.blur(); });
    const el = h('section', { class: 'pedal mini rig-unit', 'data-unit': u.id, 'aria-label': u.name },
      h('div', { class: 'rig-name' }, u.name), knobs, h('div', { class: 'rig-foot' }, led, foot));
    refreshers.push(() => {
      const on = !!R[u.on];
      led.classList.toggle('on', on);
      foot.setAttribute('aria-pressed', String(on));
      el.classList.toggle('off', !on);
    });
    return el;
  });
  const el = h('div', { class: 'rig-chain', role: 'group', 'aria-label': 'The rig, from the interface to the pedal' },
    first, ...units.flatMap((u) => [h('span', { class: 'rig-wire', 'aria-hidden': 'true' }), u]),
    h('span', { class: 'rig-wire', 'aria-hidden': 'true' }), h('div', { class: 'rig-end' }, 'to the pedal', about));
  refresh();
  return { el, values: () => ({ ...R }), text: (id) => fmt(RIG_UNITS.flatMap((u) => u.params).find((p) => p.id === id), R[id]) };
}
