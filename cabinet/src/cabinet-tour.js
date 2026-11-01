// cabinet-tour.js — the guided tour of the Speaker Cabinet's physics (shared/tour.js)
import { tour, note, riff, sweep } from '../../shared/tour.js';

export const TOUR = tour('cabinet', [
  {
    title: 'A speaker is a circuit',
    views: ['The box', 'The response'],
    preset: '8 × 10 sealed',
    play: [riff({ times: 2 })],
    text: `![The cabinet as one circuit: the coil, the cone on its suspension, and the air in the box and the port](schematics/circuit.svg)

The amp's volts push a current through a voice coil in a magnet's gap. The current pushes the cone, the cone pushes the air in the box, and the air pushes back. Each of those is a circuit's equations: the cone's mass is an inductor, its suspension a capacitor, the box's air another.

Every number comes from the drivers' datasheet parameters, the Thiele–Small parameters. **The box** shows it slowed thirty times: a cone pushed by each note, and the air in the box pressed (red) and drawn out (blue). **The response** shows what the microphone hears at each frequency (orange), and the impedance the amp drives (blue).`,
  },
  {
    title: 'Sealed: a spring behind the cones',
    views: ['The response', 'The cone'],
    preset: '8 × 10 sealed',
    play: [note('E1', { dur: 2.5, vel: 0.8 }), note('A1', { at: 2.5, dur: 2, vel: 0.8 }), note('D2', { at: 4.5, dur: 2, vel: 0.8 })],
    text: `Sealed, the air in the box is a second spring behind the cones, and the resonance rises to

  f_c = F_s √(1 + V_as / V_b)

Eight 10-inch drivers in 200 L resonate at 80.0 Hz, where the impedance peaks. Below it the sound rolls off at 12 dB an octave, so the low E's fundamental is quieter than the D's. **The cone** shows why the box stays in control: however low you go, the cones' travel levels off.`,
  },
  {
    title: 'Ported: the air in the port',
    views: ['The response', 'The cone'],
    preset: '4 × 10 ported',
    play: [riff({ times: 3 }), sweep('portL', 0.09, 0.2, { at: 6, dur: 6, log: true })],
    text: `A port puts a slug of air on the box's spring: a Helmholtz resonator. Two 10 cm ports, 9 cm long, in 140 L tune it to 45.3 Hz. There the port does the work: the impedance dips between two peaks, and in **The cone** the cones barely move.

Below the tuning the port no longer holds them back, so the cones flap and the sound falls fast, toward 24 dB an octave. Halfway through, the ports get longer: more air in them, a heavier mass on the spring, and the tuning slides down.`,
  },
  {
    title: 'Running out of travel',
    views: ['The cone', 'Spectrum'],
    preset: '8 × 10, pushed hard',
    play: [note('E1', { dur: 3, vel: 1 }), note('A2', { at: 3.5, dur: 3, vel: 1 })],
    text: `Push the cones far and two things change. The coil starts to leave the magnet's gap, so the motor weakens, and the suspension stiffens. At X_max the force factor is 82 % of its rest value.

The low E moves the cones furthest, past the dashed X_max lines in **The cone**, and odd harmonics climb in the Spectrum. The higher note, at the same level, moves them far less and stays clean. That is why a loud cabinet thickens the low strings first, and why 12 dB more gain is only 10.7 dB louder on a low E.`,
  },
  {
    title: 'A tube amp\'s bloom',
    views: ['The response'],
    preset: '8 × 10 sealed',
    play: [riff({ times: 3 }), sweep('ampR', 0.05, 4, { at: 1, dur: 8, log: true })],
    text: `The coil, shorted through the amp, brakes the cone: moving in the magnet, it makes a voltage, and the current that drives back through the amp opposes the motion. A solid-state amp is nearly a short, and brakes hard.

A tube amp drives the cabinet through its output transformer, a few ohms. Watch the bump at the box's resonance swell as the amp's impedance rises: at 4 Ω it is 2.7 dB taller, a looser, fuller low end. That is the bloom players hear from a tube amp into a cabinet.`,
  },
  {
    title: 'The coil darkens the top',
    views: ['The response', 'Spectrum'],
    preset: '8 × 10 sealed',
    play: [riff({ times: 3 }), sweep('le', 0.8e-3, 3e-3, { at: 1, dur: 8, log: true })],
    text: `The voice coil is an inductor as well as a resistor. Above R_e/(2πL_e), 1114 Hz for the 10-inch, it chokes the current, and the cabinet's top rolls off. That is a large part of why a bass cabinet without a tweeter sounds warm.

The coil's inductance grows here from 0.8 mH toward 3 mH, and the top of the response, and the harmonics in the Spectrum, fall away.`,
  },
]);
