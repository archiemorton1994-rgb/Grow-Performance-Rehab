/**
 * WHAT THE LOGGING BAR ASKS FOR, AND IN WHICH UNIT.
 *
 * ARCHIE, 25 SEPTEMBER 2026, AFTER TESTING ON EXPO
 * ────────────────────────────────────────────────
 *   "On some exercises it's not giving option to put weight in."
 *   "Sled rows - it shouldn't say reps it should just say weight and distance
 *    in m (metres)."
 *   "When putting in weights during session it should say either kg or lbs,
 *    currently doesn't show the metric."
 *
 * He hit the first one on a Dumbbell Suitcase Hold. The sentence that matters
 * is "on some exercises", so what is written here is the rule, not the fix to
 * one card.
 *
 * WHAT THE SCREEN USED TO DO, AND WHY IT WAS WRONG
 * ────────────────────────────────────────────────
 * Two regular expressions over two sentences, and nothing else:
 *
 *   1. if the reps line contained a number followed by 's' or 'min', the whole
 *      card collapsed to a single "Mark Set Done" button - no weight box and no
 *      counter;
 *   2. otherwise, if the load line began "Bodyweight", contained the word
 *      "band" anywhere, or read "Low intensity", the bar printed the word
 *      Bodyweight where the weight box belongs.
 *
 * Measured over the real generator, rule 1 swallowed the four loaded holds
 * (Dumbbell and Barbell Suitcase Hold, Cable Pallof Hold, Kettlebell Marches),
 * which are prescribed at 10 to 50 kg, and it swallowed the rep count of the
 * rehab drills written as "10 reps, hold 5s each" - the app read the 5s and
 * decided the whole prescription was a hold. Rule 2 swallowed four barbell main
 * lifts - Band Resisted Back Squats, Front Squats, Deadlifts and Barbell Press
 * - which are prescribed at 40 to 100 kg PLUS a band, and printed "Bodyweight"
 * over a loaded bar.
 *
 * THE RULE THAT REPLACES THEM
 * ───────────────────────────
 * Two questions, asked of the prescription the person is actually looking at:
 *
 *   WHAT IS BEING COUNTED?  reps, seconds or metres. Read from the reps line by
 *                           `doseOfPrescription`, which strips the time words
 *                           out first so a rep count with a hold inside it is
 *                           still a rep count.
 *   IS THERE A WEIGHT?      read from the load line by `prescribesAWeight`,
 *                           which looks for a number with kg or lbs against it.
 *                           A load may say both "50-70 kg" and "light band";
 *                           the kilograms win, because they are what goes on
 *                           the bar and what gets recorded. The band stays a
 *                           note on the card.
 *   CAN IT HOLD ONE AT ALL? asked only of the load lines that describe an
 *                           effort instead of naming a weight - "Moderate
 *                           sled", "Steady pace", and "Easy pace", which the
 *                           warm-up slot writes over a movement's real load.
 *                           Answered from the record's own kit by
 *                           `offersAWeightBox`: a sled takes plates, a rower
 *                           and a skipping rope do not. Without it, adding the
 *                           unit label put the word "kg" beside an empty box
 *                           on an assault bike.
 *
 * ARCHIE'S ANSWERS ON THE THREE CASES THAT ARE NOT OBVIOUS
 * ────────────────────────────────────────────────────────
 *   LOADED HOLDS AND LOADED CARRIES ASK FOR THE WEIGHT ONLY. The seconds and
 *   the metres stay fixed as an instruction, because the library says on
 *   purpose that these get harder by adding weight rather than by holding
 *   longer or walking further - see HOLD_SECONDS_BY_LEVEL and
 *   CARRY_METRES_BY_LEVEL in lib/exercise-library.ts. A carry is recognised by
 *   its own movement pattern, not by its name.
 *
 *   SLED ROWS IS THE EXCEPTION HE NAMED: weight and metres, never reps. So the
 *   conditioning movements that are written in metres - the three sled drills,
 *   the rower, Duck Walks and Bear Crawl - count metres, and the seven carries
 *   do not.
 *
 *   THE REP COUNT COMES BACK on the rehab drills. The hold is part of the rep,
 *   not instead of it.
 *
 * WHY THE PRESCRIPTION AND NOT THE LIBRARY'S `dose` FIELD
 * ──────────────────────────────────────────────────────
 * Every library record carries a `dose` of 'reps', 'time', 'distance' or
 * 'quality', and it is the right answer for the record as written. It is NOT
 * always the right answer for the card: a Conditioning session rewrites Sled
 * Rows from "15 m" into a 15-second interval before it ever reaches the screen,
 * and a card asking for metres there would be asking for something nobody was
 * told to do. The bar asks about the prescription in front of the person.
 * tests/logging-a-set.check.mjs holds the two to agreeing everywhere the
 * prescription was NOT rewritten, so this cannot drift away from the library.
 *
 * ('quality' - the jumps, throws and slams - is a statement about progression
 * rather than about the input box. Nobody adds reps to a depth jump, but they
 * do five of them, so the box counts reps and lib/rep-scheme.ts is what refuses
 * to climb them.)
 */

import { CONDITIONING_EXERCISES, LIBRARY_EXERCISES } from './exercise-library';

/** What the second box on the bar counts. */
export type SetCount = 'reps' | 'metres';

/** What kind of dose a written prescription is asking for. */
export type PrescribedDose = 'reps' | 'time' | 'distance';

export interface SetInputShape {
  /** Draw a weight box, with the person's own unit written beside it. */
  weight: boolean;
  /**
   * The second box, and what it counts. Null when the prescription fixes the
   * number itself: a hold's seconds, a carry's metres.
   */
  count: SetCount | null;
  /**
   * Whether a weight has to be entered before the set can be logged.
   *
   * True wherever a weight was actually prescribed, which is the only case
   * where the box arrives already holding the right answer - so the person is
   * being asked not to delete it rather than to think of a number. A 32 kg
   * suitcase hold logged as 0 kg is a lost set, and the old rule allowed it on
   * every hold and every carry in a conditioning session.
   *
   * Never true where the load is described rather than prescribed - "Moderate
   * sled", "Steady pace". There the box is offered, empty, because a sled can
   * hold a weight worth recording, and nothing is standing in the way of
   * somebody who does not want to.
   */
  weightRequired: boolean;
  /** The word printed where the weight box would be when there is no weight. */
  unloadedLabel: 'Bodyweight' | 'Band';
}

/**
 * Every way a length of time is written in a prescription, including a range.
 *
 * The range matters: "30-45s" has to be removed whole, or the 30 is left behind
 * and reads as a rep count.
 *
 * Deliberately does NOT match a bare "m". That is metres - "40 m" is a farmer's
 * carry, not forty minutes - and confusing the two is the fault this module was
 * written to end.
 */
const TIME_TOKEN_SOURCE = String.raw`\d+(?:\.\d+)?\s*(?:[-\u2013]\s*\d+(?:\.\d+)?\s*)?(?:s|secs?|seconds?|mins?|minutes?)\b`;
/** Two objects rather than one, because a /g/ regex remembers where it got to
 *  and `test` on a shared one answers differently every other call. */
const TIME_TOKEN_ALL = new RegExp(TIME_TOKEN_SOURCE, 'gi');
const TIME_TOKEN_ONE = new RegExp(TIME_TOKEN_SOURCE, 'i');

/** A distance: a number with a bare metre against it. "3 min" cannot match. */
const DISTANCE_TOKEN = /\d+(?:\.\d+)?\s*m\b/i;

/**
 * A weight, in the load line: a number with kg or lbs against it.
 *
 * Measured over the whole generator: of the 133 distinct load lines the app can
 * print, every single one that contains a digit also names its unit, so this
 * never has to guess what a loose number means.
 */
const WEIGHT_TOKEN = /\d+(?:\.\d+)?\s*(?:kg|lbs?)\b/i;

/**
 * What the reps line is asking to be counted.
 *
 * Distance first, because "20 m each side" is a walk however it is worded.
 * Then the time words are struck out and the question is asked of what is left:
 * if a number or the word "rep" survives, there is a countable prescription and
 * the hold inside it is part of the rep. "10 reps, hold 5s each" keeps its ten.
 * "30s each side" does not, because nothing but "each side" is left.
 */
export function doseOfPrescription(repsStr: string): PrescribedDose {
  const text = repsStr ?? '';
  if (DISTANCE_TOKEN.test(text)) return 'distance';
  const withoutTime = text.replace(TIME_TOKEN_ALL, ' ');
  if (/\d/.test(withoutTime) || /\brep/i.test(withoutTime)) return 'reps';
  if (TIME_TOKEN_ONE.test(text)) return 'time';
  // Nothing countable and no clock: "AMRAP", "Max effort". Reps is the only
  // box that can hold an answer to those.
  return 'reps';
}

/** Whether the load line names a weight the person can put on the bar. */
export function prescribesAWeight(suggestedLoad: string): boolean {
  return WEIGHT_TOKEN.test(suggestedLoad ?? '');
}

/**
 * Whether the load line is a way of saying "nothing on the bar".
 *
 * A load that names kilograms is never this, whatever else it says. That one
 * line is what put a weight box back on four barbell main lifts.
 */
function isUnloadedLoadLine(suggestedLoad: string): boolean {
  const lower = (suggestedLoad ?? '').toLowerCase();
  if (prescribesAWeight(suggestedLoad)) return false;
  return lower.startsWith('bodyweight') || lower.includes('band') || lower === 'low intensity';
}

/**
 * THE KIT YOU CANNOT PUT A WEIGHT ON.
 *
 * Some load lines name neither a weight nor bodyweight - they describe an
 * effort. "Moderate sled", "Steady pace", "Brisk walk on an incline", and
 * "Easy pace", which is what the warm-up slot writes over a conditioning
 * movement's real load. A weight box is right on one of those and wrong on the
 * others, and the difference is the kit: a sled takes plates, so a number can
 * be recorded against it. A rower, an assault bike, a treadmill and a skipping
 * rope have no weight to choose, and neither does a movement that needs no kit
 * at all.
 *
 * Read off the record's own `kit` rather than off the words in the load line.
 * Guessing a load from a word is the whole reason four barbell squats printed
 * "Bodyweight": the word "band" was in the sentence.
 *
 * A record with no kit listed holds nothing, and so does a movement this map has
 * never heard of - the rehab drills in lib/acute-rehab.ts are written without a
 * kit field at all, and "Soft ball or rolled towel" is a squeeze rather than a
 * weight. Not knowing means no box, because withholding one is recoverable and
 * inventing one is what put the word kg beside an empty box on an assault bike.
 * Nothing that names a weight in kilograms ever reaches this line, so nothing
 * loadable can be lost here, and tests/logging-a-set.check.mjs holds every
 * described load the app can print to one of two named lists, so a new one fails
 * loudly instead of defaulting quietly.
 */
const KIT_THAT_HOLDS_NO_WEIGHT: ReadonlySet<string> = new Set([
  'assaultbike',
  'treadmill',
  'rower',
  'rope',
]);

/** Which movements a weight can be added to, by record id. */
const TAKES_EXTERNAL_LOAD: ReadonlyMap<string, boolean> = new Map(
  [...LIBRARY_EXERCISES, ...CONDITIONING_EXERCISES].map((record) => [
    record.id,
    (record.kit ?? []).flat().some((k) => !KIT_THAT_HOLDS_NO_WEIGHT.has(k)),
  ])
);

/**
 * Whether the bar draws a weight box at all.
 *
 * Asked in the order the facts deserve. Kilograms win outright. A load that
 * says bodyweight, a band or low intensity means there is nothing to record.
 * What is left is an effort described in words, and then the question is
 * whether the movement can hold a weight.
 */
function offersAWeightBox(exercise: LoggableExercise): boolean {
  if (prescribesAWeight(exercise.suggestedLoad)) return true;
  if (isUnloadedLoadLine(exercise.suggestedLoad)) return false;
  return TAKES_EXTERNAL_LOAD.get(exercise.id ?? '') ?? false;
}

/**
 * A movement whose distance the library fixes by level rather than by choice.
 *
 * The seven loaded carries and Kettlebell Marches, all of which the library
 * files under the 'carry' movement pattern. Read off the record rather than off
 * the name, so a carry written next year is placed by what it is.
 */
function distanceIsFixed(movementPattern?: string): boolean {
  return movementPattern === 'carry';
}

/** The exercise fields this module needs. A session card satisfies it as it is. */
export interface LoggableExercise {
  reps: string;
  suggestedLoad: string;
  /** The library record this card was built from, which is what knows its kit. */
  id?: string;
  movementPattern?: string;
  category?: string;
}

/**
 * What the bar should ask for, for one card.
 *
 * The one exception inside it is rehab, and it is not new: "Light dumbbell
 * 1-2 kg" on a wrist extension assumes an elbow that can hold 1 kg, and the
 * movement is worth doing unweighted by somebody whose elbow cannot. So a
 * prehab card offers the weight box and never insists on it, which is the only
 * honest way for that log to say nothing was held.
 */
export function setInputShapeFor(exercise: LoggableExercise): SetInputShape {
  const dose = doseOfPrescription(exercise.reps);
  const hasWeight = prescribesAWeight(exercise.suggestedLoad);
  const weight = offersAWeightBox(exercise);
  const allowsZeroWeight = exercise.category === 'prehab';

  let count: SetCount | null;
  if (dose === 'time') count = null;
  else if (dose === 'distance') count = distanceIsFixed(exercise.movementPattern) ? null : 'metres';
  else count = 'reps';

  return {
    weight,
    count,
    weightRequired: weight && hasWeight && !allowsZeroWeight,
    unloadedLabel:
      !weight && (exercise.suggestedLoad ?? '').toLowerCase().includes('band')
        ? 'Band'
        : 'Bodyweight',
  };
}

/**
 * Whether the "how did that set feel?" question is worth asking on this card.
 *
 * The answer's only job is to move the weight offered for the next set (see
 * lib/auto-regulation.ts), so it is asked exactly where there is a weight for
 * it to move: a weight box, with a prescribed weight behind it. That keeps it
 * off breathing drills and stretches, which is what it was switched off for,
 * puts it on the four band-resisted barbell lifts and the four loaded holds,
 * which are real working sets, and takes it off a sled push prescribed "Light
 * to moderate sled", where there was never a number for the answer to change.
 */
export function asksHowItFelt(exercise: LoggableExercise): boolean {
  return setInputShapeFor(exercise).weight && prescribesAWeight(exercise.suggestedLoad);
}

/**
 * The number to put in the counter before the person types anything.
 *
 * The prescribed count, with any hold struck out first: "10 reps, hold 5s each"
 * prefills 10, "15 m" prefills 15, "30s each side" prefills nothing because it
 * has no counter to prefill. It used to return nothing for anything containing
 * a seconds token at all, which is the other half of why the rehab drills lost
 * their rep count.
 *
 * A carry still gets its metres from this even though no counter is drawn for
 * one, and that is on purpose: the set is logged with the distance it was
 * prescribed at, which is the number a carry was already logging when the box
 * was there and demanded. Taking the box away must not quietly empty the log
 * and change what a 30 metre carry is worth on the progress screen.
 */
export function targetCountForPrefill(repsStr: string): string {
  const dose = doseOfPrescription(repsStr);
  if (dose === 'time') return '';
  const text = dose === 'distance' ? (repsStr ?? '') : (repsStr ?? '').replace(TIME_TOKEN_ALL, ' ');
  const match = text.match(/\d+/);
  return match ? match[0] : '';
}
