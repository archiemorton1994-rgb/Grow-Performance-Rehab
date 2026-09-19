import type { EquipmentTier } from './store';
import type {
  ConditioningExercise,
  KitKey,
  KitRequirement,
  LibraryExercise,
} from './exercise-library';
import { KIT_KEYS } from './exercise-library';

/**
 * CAN THIS PERSON DO THIS EXERCISE, WITH WHAT THEY SAID THEY HAVE.
 *
 * The library names the kit each exercise needs, one short key at a time, as
 * an AND of ORs: a Landmine Press is "a barbell, AND either the attachment or
 * a corner". Onboarding asks a much coarser question — five tiles — so this
 * module is the translation between the two. It expands the tiles somebody
 * ticked into the set of keys they own, and then asks the library's question
 * of that set.
 *
 * It is deliberately separate from the same-named function in lib/exercise-db,
 * which answers the old question ("does this template's one equipment word
 * name something you own") for the old catalogue. That one reads a single
 * string; this one reads the library's kit lists. Nothing in the app is wired
 * to this module yet.
 *
 * THREE THINGS EVERYBODY OWNS
 * ───────────────────────────
 * A corner is the stand-in for a landmine attachment, a block or a weight
 * plate is what a deficit is stood on, and a door frame is a door frame.
 * Nobody is asked whether they have a wall, so these are never a reason to
 * withhold an exercise. Door frames matter more than they look: Door Frame
 * Rows is the ONLY pull in the library that needs nothing else (decision 4),
 * so treating a door frame as gym kit would leave every home user with no
 * pulling exercise at all.
 *
 * WHAT A FULL GYM OWNS
 * ────────────────────
 * Everything. Derived from KIT_KEYS rather than listed out, so a key added to
 * the library later cannot quietly become impossible for the people who have
 * the best-equipped answer (decision 6).
 *
 * THE BENCH
 * ─────────
 * Decision 6: at home, one "Bench, box or sturdy step" tick covers a bench, a
 * box and a block. It is kit, not a rung on the equipment ladder — see
 * SUPPLY_TIERS — so it never decides which pool a session is drawn from.
 */

/**
 * Kit that is never a reason to withhold an exercise.
 *
 * See the note above. Every person owns these whatever they ticked.
 */
export const ALWAYS_OWNED_KIT: readonly KitKey[] = ['corner', 'blocks', 'doorframe'];

/**
 * Equipment values that supply kit without being a rung on the ladder.
 *
 * Kept here beside the kit rules, rather than in the store, because the store
 * and the workout engine both need it and the engine may not import runtime
 * values from the store (that edge would close a cycle). This module imports
 * nothing from either, so both may read it.
 *
 * A supply tier is never offered as a tile, never becomes the effective tier
 * of a session, and is never quietly thrown away: anything that filters a
 * person's stored equipment against what their experience level may choose has
 * to keep these, or the bench somebody ticked disappears the next time they
 * edit their profile.
 */
export const SUPPLY_TIERS: readonly EquipmentTier[] = ['bench'];

/** True for equipment that supplies kit but never decides the pool. */
export function isSupplyTier(tier: EquipmentTier): boolean {
  return SUPPLY_TIERS.includes(tier);
}

/**
 * A new selection, keeping the supplies the old one had.
 *
 * Ticking "full gym" replaces the whole selection with the ladder, because a
 * full gym is every rung of it. The bench somebody has at home is not part of
 * that answer and is not contradicted by it, so it is carried across rather
 * than thrown away and quietly lost the next time they untick the gym.
 */
export function withKeptSupplies(
  next: readonly EquipmentTier[],
  previous: readonly EquipmentTier[]
): EquipmentTier[] {
  const kept = previous.filter((t) => isSupplyTier(t) && !next.includes(t));
  return [...next, ...kept];
}

/**
 * What each answer on the equipment question supplies.
 *
 * 'bodyweight' supplies nothing: it is the answer "I have no equipment", and
 * the three keys everybody owns are added separately rather than pretended to
 * belong to it.
 *
 * TRX, a pull-up bar, a medicine ball, a slam ball, an ab wheel, a cable
 * stack, a lat pulldown, a landmine attachment, a trap bar, a rack, a barbell,
 * plates, a sled, an assault bike, a treadmill and a rower are all gym kit
 * (decision 6), which is what the full-gym line says by containing every key
 * and no other line naming them.
 */
export const KIT_BY_TIER: Record<EquipmentTier, readonly KitKey[]> = {
  bodyweight: [],
  bands: ['band'],
  dumbbells: ['dumbbell'],
  kettlebells: ['kettlebell'],
  bench: ['bench', 'box', 'blocks'],
  fullgym: KIT_KEYS,
};

/**
 * WHERE A DUMBBELL MAY DO A KETTLEBELL'S JOB (decision 5).
 *
 * Archie's ruling, in his words: "A dumbbell may stand in for a kettlebell on
 * the kettlebell deadlifts, goblet squats, lunges, carries and marches."
 * Spelled out here one exercise at a time rather than inferred from the name,
 * because the exercises it does NOT cover are named the same way: a Kettlebell
 * Swing and a Kettlebell Halo are held by the horns and by the handle, and
 * doing either with a dumbbell is a different, worse movement.
 *
 * This list is only ever needed where the library itself does not already
 * offer the choice. Gorilla Rows, the Split Stance and Single Leg Romanian
 * Deadlifts, the Waiter Carry and Kettlebell Box Squats are written "or" in
 * the document, so their kit already names both implements and they are
 * satisfied without help from here.
 *
 * Keyed by libraryName, which is the document's spelling. A name that matches
 * nothing would silently do nothing, so tests/kit.check.mjs checks every entry
 * against the library.
 */
export const DUMBBELL_FOR_KETTLEBELL: readonly string[] = [
  // The deadlifts
  'Kettlebell Deadlift',
  'Kettlebell Romanian Deadlift',
  'Deficit Kettlebell Deadlift',
  // The goblet squats
  'Kettlebell Goblet Squats',
  'Kettlebell Box Squats',
  // The lunges
  'Kettlebell Side Lunge',
  'Kettlebell Reverse Lunges',
  'Kettlebell Curtsy Lunge',
  'Kettlebell Box Step Over',
  // The carries
  'Kettlebell Suitcase Carry',
  'Kettlebell Farmers Carry',
  // The marches
  'Kettlebell Marches',
];

/**
 * The least an exercise has to carry for this module to judge it.
 *
 * Structural rather than the record type itself, so a library exercise, a
 * conditioning exercise and a test fixture all fit.
 */
export interface KitDemand {
  kit: KitRequirement;
  libraryName?: string;
}

/**
 * Everything somebody can reach, from the tiles they ticked.
 *
 * An answer this table has never heard of supplies nothing rather than
 * throwing. Persisted equipment is years old on some devices and has already
 * held one retired value ('barbell'), and the cost of the two failures is not
 * the same: supplying nothing offers somebody a shorter session, and throwing
 * stops the session being built at all.
 */
export function ownedKitKeys(owned: readonly EquipmentTier[]): Set<KitKey> {
  const keys = new Set<KitKey>(ALWAYS_OWNED_KIT);
  for (const tier of owned) {
    for (const key of KIT_BY_TIER[tier] ?? []) keys.add(key);
  }
  return keys;
}

/** True where decision 5 lets a dumbbell stand in for the kettlebell. */
export function dumbbellMayReplaceKettlebell(exercise: KitDemand): boolean {
  return !!exercise.libraryName && DUMBBELL_FOR_KETTLEBELL.includes(exercise.libraryName);
}

/**
 * Can somebody with this equipment do this exercise.
 *
 * Every requirement has to be met, and any one key inside a requirement meets
 * it. An exercise that needs nothing is possible for everybody, which is how
 * the document's "Bodyweight" reads.
 */
export function canPerformWith(
  exercise: KitDemand | LibraryExercise | ConditioningExercise,
  owned: readonly EquipmentTier[]
): boolean {
  const keys = ownedKitKeys(owned);
  const kettlebellByDumbbell = keys.has('dumbbell') && dumbbellMayReplaceKettlebell(exercise);
  return exercise.kit.every((group) =>
    group.some((key) => keys.has(key) || (key === 'kettlebell' && kettlebellByDumbbell))
  );
}
