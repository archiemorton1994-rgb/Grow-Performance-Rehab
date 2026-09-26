/**
 * THE CLOCK ON A CARD THAT IS PRESCRIBED IN TIME.
 *
 * WHAT ARCHIE SAID, 25 SEPTEMBER 2026, AFTER TESTING ON EXPO
 * ──────────────────────────────────────────────────────────
 *   "For exercises that require timing the counter should start when the client
 *    presses start."
 *   "App should make a noise or vibrate when exercise timer has complete to
 *    alert the client to stop."
 *
 * WHAT WAS THERE BEFORE
 * ─────────────────────
 * Measured over every session the generator can build: 32.5% of exercise cards
 * are prescribed on a clock, and exactly ONE of them had a counter - the cardio
 * warm-up. A Plank prescribed "30s" showed a plain "Mark Set Done" button and
 * nothing counted the thirty seconds. The only number on that card that looked
 * like a timer was the rest between sets, which is a different thing.
 *
 * And the one counter that did exist started itself. Its `isRunning` was
 * initialised to true, so it began the moment the card mounted - which, because
 * the plan screen is a Modal layered over the session rather than a screen of
 * its own, is while the person is still reading the plan. A three-minute warm-up
 * could finish, and buzz, before they had pressed Start.
 *
 * WHAT THIS MODULE IS FOR
 * ───────────────────────
 * Everything about that clock that is a rule rather than a pixel: which cards
 * get one, how long it runs, how many times, when it buzzes, and what it says.
 * It is a plain state machine with no React in it, so a check can drive a whole
 * thirty seconds of it in a millisecond and read every buzz on the way past.
 * The screen owns the pressable and the vibration; it owns no decisions.
 *
 * THE FIVE RULES, AND WHY EACH ONE IS A RULE
 * ──────────────────────────────────────────
 * 1. THE PRESCRIPTION DECIDES, NOT THE NAME AND NOT THE POSITION. A card gets a
 *    clock when what it asks for is a length of time, read by
 *    `doseOfPrescription` - the same question the logging bar asks about the same
 *    sentence, so the card cannot want a stopwatch and a rep counter at once.
 *    Keying it on "the first warm-up" once handed a five-minute countdown to a
 *    six-rep Cossack squat. Keying it on the category would put one on a
 *    twenty-metre sled push, because a conditioning card's dose is whatever the
 *    conditioning slot wrote on it.
 *
 * 2. A DURATION IS NEVER INVENTED. The old parser fell back to FIVE MINUTES
 *    when it could not read the sentence, which is how the Cossack squat got
 *    held for five minutes. There is no fallback here. If the seconds cannot be
 *    read out of the prescription, or land outside what a human being is ever
 *    asked to hold, there is no clock - a missing counter is a nuisance and an
 *    invented one is a clinical error.
 *
 * 3. NOTHING STARTS ON ITS OWN. `holdInitialState` is `ready`, and `holdStep`
 *    can only reach `running` from a `start` event, which only a press sends.
 *    That is asserted event by event and phase by phase in
 *    tests/hold-timer.check.mjs, so a clock that armed itself again would fail
 *    rather than be noticed by somebody in a gym.
 *
 * 4. "EACH SIDE" WAITS. Thirty of the clocked prescriptions say "each side",
 *    "each leg" or "each arm", and one says "each way, each arm". One run goes
 *    on the clock, it alerts, the screen asks them to swap, and it waits for
 *    another press. It must never begin timing a side before the person has
 *    swapped to it, so `swap` is a phase that a tick cannot leave.
 *
 * 5. IT COUNTS DOWN, AND WARNS. Down, because somebody in a plank wants to know
 *    how much is left, not how much is done. A short buzz at three seconds so
 *    nobody has to watch the screen to know it is nearly over, and a distinct
 *    one at zero. Both are derived from the CROSSING between two readings
 *    (`alertForCrossing`) rather than from a stored flag, so each fires exactly
 *    once per run and a pause and resume cannot double it.
 *
 * WHAT THE ALERT IS, AND WHAT IT IS NOT
 * ─────────────────────────────────────
 * It is a vibration. Grow cannot make a noise of its own: there is no audio
 * library in the project and no sound file in it either, and adding one needs a
 * native build rather than an over-the-air update. So the alert is the haptic
 * that is already installed and already used at zero by both existing timers.
 *
 * That is also the half that is CORRECT on a silenced phone. The decision taken
 * was "vibration only on a silenced phone": Grow must not make a noise in a
 * quiet clinic on a phone somebody has deliberately switched to silent. A
 * vibration cannot break that rule, and no audio session is configured anywhere
 * in this repo to override the ringer switch. Whether Grow should also make a
 * noise on a phone that is NOT silenced is a decision for Archie that costs a
 * dependency and a native build; it is not this module's to take.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * ─────────────────────────────
 * The rest between sets. That timer starts when a set is logged rather than on a
 * press, and it stays that way: somebody resting is not looking at their phone,
 * and Archie's instruction was about exercises that require timing. It does
 * share this module's arithmetic and its alert rule, so the two clocks behave
 * identically once they are running.
 */

import { doseOfPrescription } from './set-logging';

/**
 * What changes between one run of the clock and the next, in the words the
 * screen uses to ask for it.
 *
 * 'over' covers the prescription that is not about a side of the body at all -
 * "30s each way, each arm" on the Forearm Flexor & Extensor Stretch, where what
 * changes is which way the wrist is bent as well as which arm.
 */
export type SwapWord = 'side' | 'leg' | 'arm' | 'over';

/** What a clock-prescribed card asks the counter to do. */
export interface HoldClock {
  /** Seconds in ONE run of the clock. */
  seconds: number;
  /**
   * How many runs of that clock make up one set: 1, or 2 for "each side", or 4
   * for the one prescription that names two things to swap.
   */
  runs: number;
  /** What to ask them to swap between runs. Null when there is only one run. */
  swap: SwapWord | null;
}

/** How long before zero the short warning buzz goes. */
export const NEARLY_SECONDS = 3;

/**
 * The shortest and longest clock this module will put on a card.
 *
 * The floor is above zero so an unreadable sentence can never become a
 * zero-second hold that completes the instant it starts. The ceiling is twenty
 * minutes: the longest thing the library actually prescribes on a clock is a
 * five-minute treadmill warm-up, so anything past twenty minutes is a misread
 * sentence rather than a prescription, and the honest answer to a misread
 * sentence is no clock.
 */
const SHORTEST_CLOCK_SECONDS = 1;
const LONGEST_CLOCK_SECONDS = 20 * 60;

/**
 * A length of time in a prescription, with the unit it is written in.
 *
 * The optional second number is a range: "30-45s". Only the LOWER bound is ever
 * used. A range on a hold means "at least this long", so counting to the bottom
 * of it and alerting is safe - they can carry on - where counting to the top
 * would quietly ask for more than the prescription's minimum.
 */
const TIME_WITH_UNIT =
  /(\d+(?:\.\d+)?)\s*(?:[-–]\s*(?:\d+(?:\.\d+)?)\s*)?(s|secs?|seconds?|mins?|minutes?)\b/i;

/**
 * A phrase that means the set is done twice, once on each of something.
 *
 * The body parts are named, and that is the point. "30s at each level" on a
 * Floor Angel also contains the word "each", and a level is not a side: the cue
 * describes one continuous slide of the arms overhead and back. Doubling that
 * would be inventing a run, which is rule 2 wearing different clothes.
 */
const SWAP_PHRASE =
  /\beach\s+(sides?|legs?|arms?|hands?|feet|foot|ways?|directions?|shoulders?|knees?|hips?|ankles?|wrists?|elbows?)\b/gi;

/** Which word to ask them to swap, from the body part the prescription named. */
function swapWordFor(matched: string): SwapWord {
  const word = matched.toLowerCase();
  if (word.startsWith('side')) return 'side';
  if (
    word.startsWith('leg') ||
    word.startsWith('knee') ||
    word.startsWith('ankle') ||
    word.startsWith('hip') ||
    word.startsWith('foot') ||
    word.startsWith('feet')
  ) {
    return 'leg';
  }
  if (
    word.startsWith('arm') ||
    word.startsWith('hand') ||
    word.startsWith('wrist') ||
    word.startsWith('elbow') ||
    word.startsWith('shoulder')
  ) {
    return 'arm';
  }
  return 'over';
}

/**
 * How many seconds one run of the clock lasts, or null if the sentence does not
 * say.
 *
 * Exported because it is the half of rule 2 worth driving on its own: every
 * prescription the app can print goes through it in
 * tests/hold-timer.check.mjs, and the number that comes out has to appear in
 * the sentence that went in.
 */
export function clockSecondsIn(repsStr: string): number | null {
  const match = (repsStr ?? '').match(TIME_WITH_UNIT);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const isMinutes = /^m/i.test(match[2]);
  const seconds = Math.round(isMinutes ? value * 60 : value);
  if (seconds < SHORTEST_CLOCK_SECONDS || seconds > LONGEST_CLOCK_SECONDS) return null;
  return seconds;
}

/**
 * The clock this prescription asks for, or null if it asks for no clock at all.
 *
 * Takes the sentence and nothing else. Not the category, not the name, not
 * where the card sits: the sentence is the only honest signal, and the two
 * times a clock has landed on the wrong exercise in this app it was because
 * something else was asked instead.
 */
export function holdClockFor(repsStr: string): HoldClock | null {
  const text = repsStr ?? '';
  if (doseOfPrescription(text) !== 'time') return null;
  const seconds = clockSecondsIn(text);
  if (seconds == null) return null;

  const phrases = [...text.matchAll(SWAP_PHRASE)];
  const runs = phrases.length >= 2 ? 4 : phrases.length === 1 ? 2 : 1;
  const swap =
    runs === 1 ? null : phrases.length >= 2 ? 'over' : swapWordFor(phrases[0][1]);

  return { seconds, runs, swap };
}

/** Where the clock is. `ready` and `swap` both mean "waiting for a press". */
export type HoldPhase = 'ready' | 'running' | 'paused' | 'swap' | 'done';

export interface HoldState {
  phase: HoldPhase;
  /** 1-based: the run on the clock now, or the run a press would start. */
  run: number;
  /**
   * The absolute millisecond the run on the clock reaches zero.
   *
   * Absolute rather than a count that is decremented, because a phone stops
   * ticking a JavaScript interval while the app is in the background. The old
   * warm-up timer subtracted one per second and had no way back, so a person who
   * pocketed their phone mid-warm-up returned to a clock frozen where they left
   * it. Deriving the remaining seconds from this on every reading means the
   * worst a background spell can do is make the next reading jump.
   */
  endAt: number | null;
  /** Seconds still to go in this run. */
  remaining: number;
}

/** What to buzz. 'nearly' is the short warning, 'finished' the one at zero. */
export type HoldAlert = 'nearly' | 'finished';

export interface HoldStep {
  state: HoldState;
  /** What this event asks the screen to buzz, if anything. */
  alert: HoldAlert | null;
}

export type HoldEvent =
  /** A press. The ONLY event that can put a clock on. */
  | { kind: 'start'; now: number }
  | { kind: 'pause'; now: number }
  | { kind: 'tick'; now: number }
  | { kind: 'reset' };

/** Seconds left, never negative, rounded up so "1" shows for the last second. */
export function remainingAt(endAt: number | null, now: number): number {
  if (endAt == null) return 0;
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}

/**
 * Which buzz, if any, belongs to the step between two readings of the clock.
 *
 * Between two readings, not at a value, and that is the whole reason it is a
 * function. A test on "remaining === 3" fires on every tick a paused clock
 * takes; a flag that remembers whether it has fired has to be cleared correctly
 * in five places. A crossing fires once by construction: after the warning, the
 * previous reading is already at or under the threshold, so the same crossing
 * cannot happen twice, and a resume from two seconds does not buzz because it
 * never crossed anything.
 *
 * Both timers on the session screen use this, so the rest between sets warns
 * and finishes exactly the way a hold does.
 */
export function alertForCrossing(prev: number | null, next: number): HoldAlert | null {
  if (next <= 0) return prev != null && prev > 0 ? 'finished' : null;
  if (prev != null && prev > NEARLY_SECONDS && next <= NEARLY_SECONDS) return 'nearly';
  return null;
}

/** A clock that has not been started. The only state a card is allowed to mount in. */
export function holdInitialState(clock: HoldClock): HoldState {
  return { phase: 'ready', run: 1, endAt: null, remaining: clock.seconds };
}

/**
 * The whole life of the clock, one event at a time.
 *
 * Every branch either leaves the phase alone or moves it somewhere a press
 * asked for. The two things this must never do, which
 * tests/hold-timer.check.mjs asserts over every phase and every event:
 *
 *   - reach `running` from anything but a `start`
 *   - leave `swap` on a tick, which would time a side the person has not
 *     swapped to yet
 */
export function holdStep(clock: HoldClock, state: HoldState, event: HoldEvent): HoldStep {
  switch (event.kind) {
    case 'start': {
      // A press during a running clock is handled as a pause by the screen and
      // must not restart the run if it ever arrives here.
      if (state.phase === 'running') return { state, alert: null };
      // Resuming keeps the seconds already served.
      if (state.phase === 'paused') {
        return {
          state: { ...state, phase: 'running', endAt: event.now + state.remaining * 1000 },
          alert: null,
        };
      }
      // A finished set run again starts from the first side, not the last.
      const run = state.phase === 'done' ? 1 : state.run;
      return {
        state: {
          phase: 'running',
          run,
          endAt: event.now + clock.seconds * 1000,
          remaining: clock.seconds,
        },
        alert: null,
      };
    }

    case 'pause': {
      if (state.phase !== 'running') return { state, alert: null };
      return {
        state: {
          ...state,
          phase: 'paused',
          endAt: null,
          remaining: remainingAt(state.endAt, event.now),
        },
        alert: null,
      };
    }

    case 'tick': {
      if (state.phase !== 'running' || state.endAt == null) return { state, alert: null };
      const remaining = remainingAt(state.endAt, event.now);
      const alert = alertForCrossing(state.remaining, remaining);
      if (remaining > 0) return { state: { ...state, remaining }, alert };
      // The run is over. Another side waiting means WAITING: the clock comes
      // off and stays off until they press again.
      if (state.run < clock.runs) {
        return {
          state: { phase: 'swap', run: state.run + 1, endAt: null, remaining: clock.seconds },
          alert,
        };
      }
      return { state: { phase: 'done', run: state.run, endAt: null, remaining: 0 }, alert };
    }

    case 'reset':
      return { state: holdInitialState(clock), alert: null };
  }
}

/** mm:ss, always four digits and a colon, for a count of seconds. */
export function clockFace(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** What to ask them to swap, in the words the prescription used. */
export function swapPromptFor(clock: HoldClock): string {
  switch (clock.swap) {
    case 'side':
      return 'Swap sides';
    case 'leg':
      return 'Swap legs';
    case 'arm':
      return 'Swap arms';
    default:
      return 'Swap over';
  }
}

/**
 * What the button on the clock says.
 *
 * Here rather than in the screen so a check can read every word of it for every
 * prescription the app can print. A node check can import this file and cannot
 * import a React Native screen, which is why every other piece of copy worth
 * holding to a standard in this app lives in lib as well.
 */
export function holdButtonLabel(clock: HoldClock, state: HoldState): string {
  switch (state.phase) {
    case 'ready':
      return `Start the timer - ${clockFace(clock.seconds)}`;
    case 'running':
      return clockFace(state.remaining);
    case 'paused':
      return `Paused - ${clockFace(state.remaining)}`;
    case 'swap':
      return `${swapPromptFor(clock)}, then start - ${clockFace(clock.seconds)}`;
    case 'done':
      return 'Time is up - tap to run it again';
  }
}

/**
 * The quiet line under the button: which run of how many.
 *
 * Nothing at all when there is one run, because "1 of 1" is noise on a Plank.
 */
export function holdRunLabel(clock: HoldClock, state: HoldState): string | null {
  if (clock.runs < 2) return null;
  if (state.phase === 'done') return `all ${clock.runs} done`;
  return `${state.run} of ${clock.runs}`;
}

/** What the press does, said out loud for anyone using a screen reader. */
export function holdPressLabel(clock: HoldClock, state: HoldState): string {
  switch (state.phase) {
    case 'ready':
      return 'Start the timer';
    case 'running':
      return 'Pause the timer';
    case 'paused':
      return 'Carry on';
    case 'swap':
      return `${swapPromptFor(clock)}, then start the timer`;
    case 'done':
      return 'Run the timer again';
  }
}
