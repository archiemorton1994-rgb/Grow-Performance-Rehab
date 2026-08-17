import type { WeightUnit } from '@/lib/store';

/** Pounds in a kilogram. One definition, so the two directions cannot drift. */
const LB_PER_KG = 2.20462;

/**
 * The increment a gym stocked in `unit` can actually make, at this weight.
 *
 * A kilogram gym works in 2.5 kg jumps - a pair of 1.25 kg plates, and the
 * spacing of a dumbbell rack. A pound gym works in 5 lb jumps (a pair of 2.5 lb
 * plates), closing to 2.5 lb at the light end where the dumbbells sit closer
 * together and a 5 lb step is a fifth of the weight.
 */
function loadableStep(valueInUnit: number, unit: WeightUnit): number {
  if (unit === 'kg') return 2.5;
  return valueInUnit < 25 ? 2.5 : 5;
}

/**
 * The nearest weight the user's gym can actually put in their hands, in kg.
 *
 * WHY THIS IS NOT A DISPLAY CONCERN
 * ─────────────────────────────────
 * Every rounding decision in the engine used to be `Math.round(v / 2.5) * 2.5`
 * KILOGRAMS, for everybody. 2.5 kg is 5.5 lbs, so somebody training in pounds
 * was prescribed 143.3 → 154.3 → 165.3 → 176.4 lbs: a constant 11.0 lb step and
 * not one weight that can be made with plates.
 *
 * Doing this at the render boundary instead would have made the number on
 * screen honest and left the problem exactly where it was. The stored weight
 * would still be on the kilogram grid, so next session's step would be added to
 * a weight nobody had lifted and the display would round it somewhere else
 * again - the prescription would drift off-grid underneath a tidy-looking
 * number. So the grid is applied where the weight is DECIDED, and the kilograms
 * that get stored are the true weight of the plates on the bar: 145 lbs is
 * 65.77 kg, and that is what history records. Storage is kilograms either way,
 * so a set logged in pounds still reads back correctly in kilograms, and
 * switching units changes which grid the NEXT prescription lands on and nothing
 * else.
 *
 * In kilograms this is exactly the `Math.max(2.5, Math.round(v / 2.5) * 2.5)`
 * it replaces, so nothing moves for anyone training in kilograms.
 */
export function roundToLoadable(kg: number, unit: WeightUnit): number {
  if (!Number.isFinite(kg)) return kg;
  const inUnit = unit === 'lbs' ? kg * LB_PER_KG : kg;
  const step = loadableStep(inUnit, unit);
  const snapped = Math.max(step, Math.round(inUnit / step) * step);
  return unit === 'lbs' ? parseFloat((snapped / LB_PER_KG).toFixed(2)) : snapped;
}

/**
 * A weight that is already loadable in kilograms, made loadable in the user's
 * unit.
 *
 * Identity in kilograms on purpose. The figures in the exercise database were
 * written by somebody holding a 12 kg dumbbell, and everything the engine
 * computes is on the 2.5 kg grid already; it is only their CONVERSION that
 * lands between plates. So this is what to apply to a number that was never
 * rounded - a database range, an explicit ramp, a load carried through
 * untouched - without moving what a kilogram user reads.
 */
export function toLoadableForUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? roundToLoadable(kg, 'lbs') : kg;
}

/**
 * A weight that has just been moved deliberately, put on the gym's grid without
 * undoing the move.
 *
 * Rounding a 10% increase onto a coarse grid can land it back on - or below -
 * the weight it came from, which is the user asking for a change and not
 * getting one. `lib/auto-regulation.ts` already refuses that for its own
 * kilogram steps (see `adjustKg`), and its `loadStepKg` IS the kilogram gym's
 * grid. There was no pounds equivalent; this is it. Deliberately does nothing
 * in kilograms, so every auto-regulation rule keeps behaving exactly as it was
 * written and tested.
 */
export function snapToLoadable(kg: number, fromKg: number, unit: WeightUnit): number {
  if (unit !== 'lbs' || !Number.isFinite(kg) || kg <= 0) return kg;
  // Holding the previous weight is an answer in its own right ("same weight
  // again - you said that one was challenging"). It must survive verbatim even
  // when the user typed something off-grid.
  if (kg === fromKg) return kg;
  let out = roundToLoadable(kg, unit);
  if (fromKg > 0) {
    const step = loadableStep(Math.max(kg, fromKg) * LB_PER_KG, unit) / LB_PER_KG;
    if (kg > fromKg && out <= fromKg) out = roundToLoadable(fromKg + step, unit);
    if (kg < fromKg && out >= fromKg) out = roundToLoadable(fromKg - step, unit);
  }
  return out;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${kgToDisplayUnit(kg, unit)} ${unit}`;
}

/**
 * A weight in the unit the user reads, at the precision they read it.
 *
 * One decimal place, and no trailing zero, because this number is BOTH printed
 * on the card and prefilled into the logging box. They used to be computed two
 * different ways - `convertLoadString` rounded to whole pounds while the bar
 * prefilled one decimal - so the same set read 143 lbs on the card and 143.3 in
 * the box.
 */
export function kgToDisplayUnit(kg: number, unit: WeightUnit): number {
  return parseFloat((unit === 'lbs' ? kg * LB_PER_KG : kg).toFixed(1));
}

export function displayUnitToKg(val: number, unit: WeightUnit): number {
  return unit === 'lbs' ? parseFloat((val / LB_PER_KG).toFixed(2)) : val;
}

export function formatWeightValue(kg: number, unit: WeightUnit): number {
  return kgToDisplayUnit(kg, unit);
}

/**
 * Convert any "<number> kg" / "<num>–<num> kg" tokens inside a free-form load
 * string (e.g. "10–18 kg per hand", "80 kg", "12 kg per hand") into the user's
 * display unit. Non-numeric labels like "Bodyweight", "Light band", or
 * "Low intensity" pass through unchanged. Source strings live in the exercise
 * database in kg - this is the render-boundary transform.
 *
 * The pounds it prints go through the same two functions the logging bar's
 * prefill does, so "Target weight" on the card and the number waiting in the
 * box are the same number by construction rather than by coincidence.
 */
export function convertLoadString(load: string, unit: WeightUnit): string {
  if (!load) return load;
  const show = (kg: number) => kgToDisplayUnit(toLoadableForUnit(kg, unit), unit);
  // A whole run of numbers before the unit word, not just the one touching it.
  // Loads come as a single weight ("80 kg"), a range ("10–18 kg per hand") and
  // a stated ladder ("60 / 50 / 40 kg" — the 1RM ramp writes one). Matching
  // only the last number left the ladder half converted: a pounds user was
  // shown "60 / 50 / 40 lbs" with the first two still in kilograms.
  //
  // Only the numbers are rewritten, so whatever separators and spacing the
  // source used survive.
  return load.replace(
    /(\d+(?:\.\d+)?(?:\s*[–\-/]\s*\d+(?:\.\d+)?)*)\s*(kgs?)\b/gi,
    (_m, run: string, kgWord: string) => {
      const converted = run.replace(/\d+(?:\.\d+)?/g, (n) => String(show(parseFloat(n))));
      // Kilograms keep their own word and their own punctuation. The only thing
      // that moves is precision: a weight carried over from a spell training in
      // pounds is 65.77 kg, and the card has to read it to the one decimal
      // place the logging box prefills or the two disagree again.
      return unit === 'lbs' ? `${converted} lbs` : `${converted} ${kgWord}`;
    }
  );
}

/**
 * Is `kg` heavier than `bestKg` as the user reads them?
 *
 * The "New Record!" flash used to compare kilograms: `effectiveWeightKg >
 * previousBest`, where the left side is the pounds in the box converted back.
 * Display rounds to one decimal and parsing to two, so for 48 of the 120
 * weights on the 2.5 kg grid the round trip lands FRACTIONALLY ABOVE where it
 * started (100 kg → 220.5 lbs → 100.02 kg). Submitting the prefilled number -
 * exactly what happens when the app holds a weight - therefore congratulated
 * the user on a personal best for repeating last week's set.
 *
 * Comparing what is on screen instead of what is behind it settles it without a
 * fudge factor: 220.5 lbs is not a record over 220.5 lbs, and a genuine 0.5 kg
 * step (220.5 → 221.6 lbs) still is.
 */
export function isHeavierThan(kg: number, bestKg: number, unit: WeightUnit): boolean {
  return kgToDisplayUnit(kg, unit) > kgToDisplayUnit(bestKg, unit);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

/** ISO 8601 week string (YYYY-Www) for a date. Weeks run Mon–Sun.
 *  Shared by lib/badge-engine.ts and lib/store.ts so the week a session
 *  counts toward for streak display and for badge eligibility can never
 *  silently disagree. */
/**
 * Midnight on the Monday of the week containing `date`, in local time.
 *
 * THE ONE DEFINITION OF "THIS WEEK". There were three, all in the Stats tab:
 * the "This Week" pill counted from Monday (UTC), the "This wk" bar directly
 * below it counted from Sunday (local), and the History date filter used a
 * third. Mid-week the bar included Sunday's sessions and the pill did not; on a
 * Sunday the pill covered Mon–Sun while the bar covered that day alone, so two
 * numbers sitting on the same screen openly disagreed. Nothing surfaces a bug
 * like that — the stats simply look wrong and stop being trusted.
 *
 * Monday, to match getStreakDays, the badge engine's isoWeek below, and the
 * calendar grid, all of which were already Monday-based.
 */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay() || 7; // 1 = Mon … 7 = Sun
  d.setDate(d.getDate() - (dow - 1));
  return d;
}

/** Midnight on the Monday `weeksAgo` weeks before the week containing `date`. */
export function startOfWeeksAgo(weeksAgo: number, date: Date = new Date()): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() - weeksAgo * 7);
  return d;
}

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dow); // shift to the Thursday of that ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Turn a thrown API error into something a person can read.
 *
 * apiRequest rejects before its caller can inspect the response, and the
 * message it throws is `${status}: ${raw body}` — so a mistyped code put
 * `400: {"message":"Invalid or expired code."}` on screen, in red, on the
 * first error a new user can possibly hit. Unwrap that shape back to the
 * server's own sentence, and fall back to plain English for anything that
 * isn't JSON (a gateway's HTML error page, a network failure).
 *
 * The unwrapped text is still the server's `message`, so the "too many"
 * rate-limit check downstream keeps matching.
 */
export function friendlyError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : '';
  if (!raw) return fallback;
  const body = raw.replace(/^\s*\d{3}\s*:\s*/, '');
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Not JSON. Only surface it if it reads like a sentence rather than a
    // status line, a stack trace or an HTML error page.
    if (body.length > 0 && body.length <= 120 && !/[<>{}]/.test(body)) return body;
  }
  return fallback;
}
