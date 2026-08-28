/**
 * WHICH MACHINE THE WARM-UP PUTS SOMEBODY ON, AND WHAT THEY CAN MOVE TO.
 *
 * Two problems, and they are the same problem.
 *
 * The first is practical. The warm-up card names one machine, and in a real gym
 * at six in the evening that machine has somebody on it. The card had no answer
 * for that: the treadmill warm-up carried no alternative at all, and the three
 * that did carried exactly one, hand-written, pointing at whatever the author
 * happened to think of. So the honest options were to wait, or to do something
 * else and log a warm-up the app believed was a treadmill.
 *
 * The second is physiological. The generator picked the warm-up by shuffling a
 * pool of six on a seed, which means the machine had nothing to do with the
 * session. A squat day could open on a rowing machine, which raises the heart
 * rate and warms the lats and does very little for the hips and knees about to
 * be loaded. A warm-up that primes the wrong half of the body is not wrong
 * exactly, it is just a two-minute detour.
 *
 * So the machine is chosen for what the session is about to load, and the swap
 * list is ordered the same way. `primes` is the whole model:
 *
 *   lower  the legs drive it            treadmill, stationary bike
 *   upper  the arms and back drive it   rowing machine, assault bike
 *
 * A ROWING MACHINE IS OBVIOUSLY A LEG EXERCISE TOO, and an assault bike is
 * obviously a bike. `primes` is not a claim about which muscles do the work; it
 * is a claim about which half of the body the machine wakes up that the others
 * do not. Nothing else on this list asks the shoulders and the lats to move
 * through range under a light load, and that is what a pressing or pulling
 * session wants first.
 *
 * WHY THE SWAP LIST ORDERS RATHER THAN FILTERS. The request that started this
 * was "my machine is taken". Cutting the list to the two machines that suit the
 * session answers that badly on the evening both of them are also taken, and
 * leaves the user doing nothing rather than something. So every machine stays
 * offered and the relevant ones come first under a heading that says why. The
 * guidance is visible; the user is never stuck.
 *
 * The duration never comes from here. Every machine carries the same `reps`
 * string the session prescribed, so swapping the machine cannot quietly shorten
 * the warm-up.
 */
import type { ExerciseTemplate } from './exercise-db';
import type { SessionType } from './store';

export type CardioMachineId = 'treadmill' | 'bike' | 'rower' | 'assault_bike';

/** Which half of the body a machine wakes up, and which half a session loads. */
export type CardioFocus = 'lower' | 'upper' | 'both';

export interface CardioMachine {
  id: CardioMachineId;
  /** What it is called on the card, without the "Warm-Up" suffix. */
  label: string;
  /** The full exercise name, which is what gets logged. */
  name: string;
  cue: string;
  suggestedLoad: string;
  primes: Exclude<CardioFocus, 'both'>;
  primaryMuscle: string;
  secondaryMuscles: string[];
}

export const CARDIO_MACHINES: readonly CardioMachine[] = [
  {
    id: 'treadmill',
    label: 'Treadmill',
    name: 'Treadmill Warm-Up',
    cue: 'Walk to start, then build to a jog you could still hold a conversation through. Keep the incline low.',
    suggestedLoad: 'Low intensity',
    primes: 'lower',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Calves', 'Glutes'],
  },
  {
    id: 'bike',
    label: 'Stationary Bike',
    name: 'Stationary Bike Warm-Up',
    cue: 'Low resistance, 70-90 RPM cadence - spin the legs loose before touching any weights. Gradually raise effort in the final 30s.',
    suggestedLoad: 'Low resistance',
    primes: 'lower',
    primaryMuscle: 'Quadriceps',
    secondaryMuscles: ['Hamstrings', 'Core'],
  },
  {
    id: 'rower',
    label: 'Rowing Machine',
    name: 'Rowing Machine Warm-Up',
    cue: 'Long slow strokes - push with legs first, then lean back, then pull arms. Easy effort, full range.',
    suggestedLoad: 'Low resistance',
    primes: 'upper',
    primaryMuscle: 'Lats',
    secondaryMuscles: ['Upper back', 'Quadriceps'],
  },
  {
    id: 'assault_bike',
    label: 'Assault Bike',
    name: 'Assault Bike Warm-Up',
    cue: 'Drive the handles as much as the pedals, so the shoulders warm up with the legs. Easy pace, steady breathing.',
    suggestedLoad: 'Low resistance',
    primes: 'upper',
    primaryMuscle: 'Shoulders',
    secondaryMuscles: ['Quadriceps', 'Upper back'],
  },
] as const;

/**
 * The exercise ids the machines are generated under.
 *
 * Kept in one place because two other things read them: the session screen asks
 * "is the card I am drawing a machine warm-up" to decide whether to offer the
 * machine picker at all, and the restore path matches saved ids against
 * generated ones.
 */
export const CARDIO_MACHINE_IDS: readonly string[] = CARDIO_MACHINES.map(
  (m) => `cardio-machine-${m.id}`
);

export function machineById(id: CardioMachineId): CardioMachine | undefined {
  return CARDIO_MACHINES.find((m) => m.id === id);
}

/** The machine a generated warm-up card came from, if it came from one. */
export function machineForExerciseId(exerciseId: string): CardioMachine | undefined {
  if (!exerciseId.startsWith('cardio-machine-')) return undefined;
  return CARDIO_MACHINES.find((m) => `cardio-machine-${m.id}` === exerciseId);
}

/**
 * Which half of the body the session is about to load.
 *
 * `deadlift` sits with the full-body sessions rather than with the lower-body
 * ones deliberately, and not as a shrug: the engine already treats it as the
 * full-body pattern when it picks prep and prehab (upper to bench, lower to
 * squat, full to deadlift), and a heavy pull asks as much of the lats and the
 * upper back holding the bar as it does of the hips moving it.
 */
export function cardioFocusForSession(sessionType: SessionType): CardioFocus {
  switch (sessionType) {
    case 'squat':
    case 'lower_body':
      return 'lower';
    case 'bench':
    case 'upper_body':
      return 'upper';
    default:
      return 'both';
  }
}

/**
 * Every machine, the ones that suit this session first.
 *
 * A 'both' session gets the two machines that move the most of the body first,
 * rather than an arbitrary order: on a deadlift or a full-body day there is no
 * half to prime, so the tie-break is coverage.
 */
export function machinesForFocus(focus: CardioFocus): CardioMachine[] {
  if (focus === 'both') {
    const order: CardioMachineId[] = ['rower', 'assault_bike', 'bike', 'treadmill'];
    return order.map((id) => machineById(id)).filter((m): m is CardioMachine => !!m);
  }
  const relevant = CARDIO_MACHINES.filter((m) => m.primes === focus);
  const rest = CARDIO_MACHINES.filter((m) => m.primes !== focus);
  return [...relevant, ...rest];
}

/** How many of `machinesForFocus` are the ones that suit the session. */
export function relevantCountForFocus(focus: CardioFocus): number {
  return focus === 'both'
    ? CARDIO_MACHINES.length
    : CARDIO_MACHINES.filter((m) => m.primes === focus).length;
}

/** One short line saying why the top of the swap list is at the top. */
export function focusHeading(focus: CardioFocus): string {
  if (focus === 'lower') return 'Primes the legs you are about to train';
  if (focus === 'upper') return 'Primes the shoulders and back you are about to train';
  return 'Warms the most of you before a full-body session';
}

/**
 * A machine as a warm-up template, carrying the prescription it replaces.
 *
 * `reps` is passed in rather than stored on the machine so that a swap can
 * never change how long the warm-up is. Whatever the session asked for is what
 * every machine asks for.
 */
export function machineTemplate(machine: CardioMachine, reps: string): ExerciseTemplate {
  return {
    id: `cardio-machine-${machine.id}`,
    name: machine.name,
    sets: 1,
    reps,
    cue: machine.cue,
    suggestedLoad: machine.suggestedLoad,
    category: 'prep',
    targetRegions: [],
    videoId: '',
    movementPattern: 'conditioning',
    primaryMuscle: machine.primaryMuscle,
    secondaryMuscles: machine.secondaryMuscles,
    equipmentRequired: 'fullgym',
    difficulty: 'beginner',
    isUnilateral: false,
    injuryFriendlyAlternatives: [],
  };
}

/** The standard warm-up length. Every machine template is built with it. */
export const CARDIO_WARMUP_REPS = '2 min steady';

/**
 * The pool the generator picks the opening warm-up from, for a gym session.
 *
 * Only the machines that suit the session go in, so the default is always
 * relevant; there is more than one so the warm-up still varies day to day, the
 * way it did when it was shuffled out of a pool of six. Everything else is one
 * tap away in the swap list.
 */
export function cardioWarmupPoolForSession(sessionType: SessionType): ExerciseTemplate[] {
  const focus = cardioFocusForSession(sessionType);
  const machines =
    focus === 'both'
      ? machinesForFocus(focus)
      : CARDIO_MACHINES.filter((m) => m.primes === focus);
  return machines.map((m) => machineTemplate(m, CARDIO_WARMUP_REPS));
}
