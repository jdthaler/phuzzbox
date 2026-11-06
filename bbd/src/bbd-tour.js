// bbd-tour.js — the guided tour of the Bucket Brigade's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('bbd', [
  {
    title: 'Buckets of charge',
    views: ['The buckets', 'Scope'],
    preset: 'Slapback',
    play: [note('E1', { dur: 1.5, vel: 0.85 }), note('A1', { at: 1.6, dur: 1.5, vel: 0.85 }), riff({ at: 3.4 })],
    text: `A chain of 4096 capacitors, joined by switches a clock opens and closes. Each clock cycle every charge moves two stages along, so the chain holds 2048 samples, and at 30 kHz a sample takes 68.3 ms to cross it: τ = N/(2 fclk). In **The buckets** the bass enters at the left as charge and travels right; what reaches the right is what you played a delay ago, and the **Scope** shows it come round.

![The Bucket Brigade: a chain of capacitors between two filters, its switches closed by a two-phase clock](schematics/chain.svg)`,
  },
  {
    title: 'The clock sets the delay',
    views: ['The response', 'The buckets'],
    preset: 'Chorus',
    set: { depth: 0, mix: 0.5 },
    play: [riff({ times: 2 }), sweep('clock', 100e3, 25e3, { at: 0.5, dur: 9, log: true })],
    text: `The same chain, 1024 stages, half and half with the dry sound, the clock falling from 100 kHz to 25 kHz. At 100 kHz the delay is 5.12 ms, and the delayed and the dry cancel where they are half a cycle apart: notches at 97.7 Hz, 293 Hz, 488 Hz. As the clock slows the delay grows, and **The response** shows the notches crowding down through the bass. Nothing moves but the clock.`,
  },
  {
    title: 'A swinging clock bends the pitch',
    views: ['The buckets', 'Spectrum'],
    preset: 'Vibrato',
    play: [note('A2', { dur: 4, vel: 0.8 }), riff({ at: 4.2 })],
    text: `Now only the delayed sound, with a triangle swinging the clock 20 % at 5 Hz. The count of stages doesn't change, so a charge coming out now went in when the clock had counted 512 cycles fewer. When the clock is faster now than then, the charges come out faster than they went in, and the pitch rises: its frequency times fclk(now)/fclk(then). Here that is half a semitone either way. The **Chorus** preset swings 15 % at 0.8 Hz, about 6 cents, a drift you hear as thickness rather than wobble.`,
  },
  {
    title: 'Feedback: a flanger',
    views: ['The response', 'Spectrum'],
    preset: 'Flanger',
    play: [riff({ times: 3 })],
    text: `512 stages at 150 kHz, 1.71 ms, with 70 % of the delayed sound returned to the input. The whole is (1 − mix) + mix·H/(1 − gH): where the loop comes round in step it rings, peaks every 586 Hz, and the clock's slow swing slides them through the bass. Feedback negative puts the peaks where the notches were.`,
  },
  {
    title: 'Aliases: the sampling theorem',
    views: ['Spectrum', 'The response'],
    preset: 'Aliasing',
    play: [riff({ times: 2 }), { at: 6, set: { filter: 3e3 } }],
    text: `The chip samples, once a clock cycle, so the sampling theorem holds it: a tone at f gives exactly the samples of one at its alias, the distance from f to the nearest multiple of the clock. Here the clock is 8 kHz, and with the filters wide open the bass's upper harmonics above 4 kHz fold back as tones it never played; a 6.5 kHz tone comes out at 1.5 kHz. **The response** shades the band above half the clock. Halfway the filters close to 3 kHz, below half the clock, and the 1.5 kHz alias falls 20 dB: the anti-aliasing filter is why a bucket brigade's top end stops short of half its clock.`,
  },
  {
    title: 'Charges left behind',
    views: ['The response', 'Spectrum'],
    preset: 'Leaky chain',
    play: [riff(), { at: 5, set: { cti: 0 } }, riff({ at: 5 })],
    text: `At each transfer a share ε of the charge stays behind and joins the next. A charge makes 4096 transfers, and the chance it arrives m cycles late is the negative binomial distribution; as a filter, ((1 − ε)/(1 − εz⁻¹))^N. At 500 ppm and a 40 kHz clock it takes 0.87 dB off at 2 kHz and 5.21 dB at 5 kHz. Halfway the chain is made perfect, and the top comes back.`,
  },
]);
