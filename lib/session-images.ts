/**
 * Session card artwork, resolved per profile sex.
 *
 * The same five screens all rendered their own copy of this map, so a new asset
 * meant editing five files and silently drifting if you missed one. Everything
 * now resolves through getSessionImage / getRecoverImage.
 *
 * `require` calls must stay static literals — Metro resolves them at bundle
 * time, so these cannot be built from a template string.
 *
 * The female set covers the seven session artworks. Anything without a female
 * variant (currently `custom`) falls back to the shared asset rather than
 * rendering nothing.
 */
import { trainTypeOf, type TrainSessionType } from './session-type';
import type { SessionType, Sex } from './store';

/**
 * KEYED BY THE SESSION THE APP BUILDS, NOT BY THE ID THAT WAS STORED.
 *
 * There is no 'squat', 'bench' or 'deadlift' row any more. A day stored under
 * one of those ids builds, and is named as, a lower body, upper body or full
 * body session, so putting a barbell back squat photograph beside the words
 * "Lower Body" would be the app disagreeing with itself on the one card a
 * person is most likely to look at.
 *
 * Typing the tables `Record<TrainSessionType, ...>` is what holds it: a stored
 * id has to go through `trainTypeOf` to be looked up at all, so a later change
 * that reaches straight into the table with whatever came off a completed
 * session fails the typecheck rather than quietly showing the old artwork
 * again. The three lift images stay on disk, unreferenced; deleting an asset is
 * a separate decision from deciding not to show it.
 */
const MALE: Record<TrainSessionType, any> = {
  conditioning: require('@/assets/images/sessions/conditioning.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
  flexibility: require('@/assets/images/sessions/mobility.png'),
  custom: require('@/assets/images/sessions/custom.png'),
  lower_body: require('@/assets/images/sessions/lower-body.png'),
  upper_body: require('@/assets/images/sessions/upper-body.png'),
  full_body: require('@/assets/images/sessions/full-body.png'),
};

const FEMALE: Partial<Record<TrainSessionType, any>> = {
  conditioning: require('@/assets/images/sessions/female/conditioning.png'),
  prehab: require('@/assets/images/sessions/female/targeted-prehab.png'),
  flexibility: require('@/assets/images/sessions/female/mobility.png'),
  lower_body: require('@/assets/images/sessions/female/lower-body.png'),
  upper_body: require('@/assets/images/sessions/female/upper-body.png'),
  full_body: require('@/assets/images/sessions/female/full-body.png'),
  // `custom` has no female variant — falls back to MALE below.
};

/** Recover tab uses its own keys; `mobility` shares the flexibility artwork. */
const RECOVER_MALE: Record<string, any> = {
  recovery: require('@/assets/images/sessions/recovery.png'),
  mobility: require('@/assets/images/sessions/mobility.png'),
  prehab: require('@/assets/images/sessions/targeted-prehab.png'),
};

const RECOVER_FEMALE: Record<string, any> = {
  recovery: require('@/assets/images/sessions/female/recovery.png'),
  mobility: require('@/assets/images/sessions/female/mobility.png'),
  prehab: require('@/assets/images/sessions/female/targeted-prehab.png'),
};

/**
 * 'other' and an unset profile both fall through to the shared set — picking a
 * gendered figure for someone who declined to specify would be a worse guess
 * than the neutral default the app already ships.
 */
// Named `prefers`, not `use`: the `use` prefix is reserved for React hooks
// and the rules-of-hooks lint treats anything starting with it as one. This
// is a plain predicate over a string.
function prefersFemaleArt(sex: Sex | undefined): boolean {
  return sex === 'female';
}

/** The picture follows the name on the card. See the tables above. */
export function getSessionImage(type: SessionType, sex: Sex | undefined): any {
  const art = trainTypeOf(type);
  if (prefersFemaleArt(sex)) return FEMALE[art] ?? MALE[art];
  return MALE[art];
}

export function getRecoverImage(key: string, sex: Sex | undefined): any {
  if (prefersFemaleArt(sex)) return RECOVER_FEMALE[key] ?? RECOVER_MALE[key];
  return RECOVER_MALE[key];
}
