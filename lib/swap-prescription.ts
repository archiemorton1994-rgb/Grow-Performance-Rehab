import { doseOfPrescription } from './set-logging';
import {
  CONDITIONING_EXERCISES,
  LIBRARY_EXERCISES,
  WARMUP_CARDIO_EXERCISES,
} from './exercise-library';
import {
  getAllPickableExercises,
  getCooldown,
  getRestoreExercises,
  getStandaloneFlexibilityWorkout,
  getStandalonePrehabWorkout,
} from './exercise-db';

/**
 * WHAT A SWAPPED CARD IS ACTUALLY ASKING FOR.
 *
 * WHAT ARCHIE SAW, 30 SEPTEMBER 2026
 * ──────────────────────────────────
 *   "Banded Clamshells should say reps not seconds."
 *
 * Every Banded Clamshell record in the app is written at "15 each side" and
 * always has been. What put it on a clock was the SWAP BUTTON: tapping an
 * alternative changed the card's name, cue and load and left the PRESCRIPTION
 * belonging to the exercise it replaced. So a warm-up prescribed two minutes of
 * easy cardio, swapped to a clamshell, asked for two minutes of clamshells and
 * drew a two-minute countdown under it; a Copenhagen Adductor Hold swapped the
 * same way asked for twenty seconds of them.
 *
 * Measured over 62,230 swap offers across every session type, kit, level,
 * length and sore area before this rule existed: 17,206 of them - 27.6 per cent
 * - would have handed the person a prescription of the wrong KIND. 2,640 of
 * those were the clamshell Archie named. The rest were the same fault wearing
 * other names: a Band Pull-Apart and a Wall Slide put on the two-minute cardio
 * clock, a Copenhagen hold offered behind a card counted in reps, a Wall Sit
 * offered behind Bodyweight Squats, a Plank behind a Deadbug.
 *
 * THE RULE, AND WHY IT IS THIS AND NOT "ALWAYS USE THE SWAP'S OWN DOSE"
 * ────────────────────────────────────────────────────────────────────
 * A movement counted in REPS is never put on a clock, and a movement counted on
 * a CLOCK is never given a rep count. Where a swap would do either, the
 * swapped-in movement's own written prescription is used instead. Anything else
 * keeps the card's prescription.
 *
 * DISTANCE IS DELIBERATELY LEFT INHERITED, because twice over the session has
 * written the number on purpose and the movement's own answer is the wrong one:
 *
 *   - The opening cardio card is two minutes (decision 25), whichever machine
 *     is behind it. Swapping the bike for the rower must not turn that into the
 *     rower's authored five hundred metres.
 *   - A Conditioning session's blocks ARE a clock - work this long, rest that
 *     long, this many times - and every one of Archie's conditioning records
 *     carries a distance or a time of its own that is not comparable with the
 *     others. Swapping a forty-second block for Sled Rows must not turn it into
 *     fifteen metres.
 *
 * Reps against a clock has no such reading. There is no sense in which two
 * minutes of clamshells or thirty seconds of band pull-aparts is the thing
 * somebody was asked to do, which is why that one pair is corrected and the
 * others are not.
 *
 * READ AT THE MOMENT THE CARD IS DRAWN, off the record the swap already names.
 * The alternative arrives on the card as an id and a name (lib/exercise-swaps.ts)
 * and every one of them is a real record somewhere - the check asserts that over
 * a full sweep rather than assuming it - so the prescription can be looked up
 * rather than threaded through all eight places in the app that write a swap
 * slot. The ID is asked first and the name only as a fallback, because a couple
 * of names exist in both Archie's library and the old catalogue under different
 * ids, and the id is the one that came with the choice.
 */

/** The fields this module needs from a record. Every pool's entries satisfy it. */
interface Prescribed {
  id?: string;
  name?: string;
  reps?: string;
}

let byId: Map<string, string> | null = null;
let byName: Map<string, string> | null = null;

const normalise = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Every prescription the app can serve, indexed once.
 *
 * Built on first use rather than at module load: the Restore pools are
 * functions, some of them build their lists on the way past, and nothing should
 * pay for that until a swap is actually shown. First entry wins for a name, so
 * Archie's library beats the old catalogue where both spell a movement the same
 * way - and the id lookup means that tie is almost never the one that decides.
 */
function index(): { byId: Map<string, string>; byName: Map<string, string> } {
  if (byId && byName) return { byId, byName };
  const ids = new Map<string, string>();
  const names = new Map<string, string>();
  const pools: readonly Prescribed[][] = [
    LIBRARY_EXERCISES as unknown as Prescribed[],
    CONDITIONING_EXERCISES as unknown as Prescribed[],
    WARMUP_CARDIO_EXERCISES as unknown as Prescribed[],
    getStandalonePrehabWorkout() as unknown as Prescribed[],
    getStandaloneFlexibilityWorkout() as unknown as Prescribed[],
    getCooldown() as unknown as Prescribed[],
    getRestoreExercises() as unknown as Prescribed[],
    getAllPickableExercises().map((p) => (p as { template: Prescribed }).template),
  ];
  for (const pool of pools) {
    for (const record of pool) {
      const reps = record?.reps;
      if (!reps) continue;
      if (record.id && !ids.has(record.id)) ids.set(record.id, reps);
      if (record.name && !names.has(normalise(record.name))) names.set(normalise(record.name), reps);
    }
  }
  byId = ids;
  byName = names;
  return { byId, byName };
}

/**
 * The prescription this movement is written at, or undefined if nothing serves
 * it.
 *
 * Exported so a check can sweep every swap the app can offer and assert that
 * none of them is unknown. Undefined is the honest answer and the safe one - the
 * card keeps what it had, which is the behaviour that shipped - but it is also
 * the silent hole, so it is measured rather than trusted.
 */
export function ownPrescriptionFor(swap: { id?: string; name?: string }): string | undefined {
  const { byId: ids, byName: names } = index();
  if (swap.id) {
    const byTheId = ids.get(swap.id);
    if (byTheId) return byTheId;
  }
  if (swap.name) return names.get(normalise(swap.name));
  return undefined;
}

/**
 * What the card should ask for now that an alternative is showing on it.
 *
 * Takes the card's own prescription and the alternative the person chose, and
 * returns the one of the two that describes what they are being asked to do.
 * Safe on anything: an unknown movement, a blank prescription and an
 * alternative that is the card's own record all come back as the card's own
 * prescription.
 */
export function swapPrescription(
  cardReps: string | undefined,
  swap: { id?: string; name?: string } | null | undefined
): string {
  const card = cardReps ?? '';
  if (!swap) return card;
  const own = ownPrescriptionFor(swap);
  if (!own || own === card) return card;
  const cardDose = doseOfPrescription(card);
  const ownDose = doseOfPrescription(own);
  const repsOnAClock = cardDose === 'time' && ownDose === 'reps';
  const clockInReps = cardDose === 'reps' && ownDose === 'time';
  return repsOnAClock || clockInReps ? own : card;
}
