/**
 * THE SIGN-UP, AS RULES RATHER THAN AS A SCREEN.
 *
 * WHAT THIS IS
 * ────────────
 * app/onboarding.tsx is ten pages in a row, and this file is everything about
 * those pages that is not drawing: what order they come in, what counts as an
 * answer to each one, what is wrong with a typed one in words, how a
 * half-finished sign-up is put down and picked up again, and how the finished
 * set becomes the one shape `completeOnboarding` takes.
 *
 * WHY IT IS NOT IN THE SCREEN
 * ───────────────────────────
 * Because a screen cannot be run. app/onboarding.tsx imports react-native, so
 * the only way a check could ever reach its rules was to read the file as text
 * and match a regular expression against it - which is this repo's commonest
 * defect, and it had already bitten here: the old pager check asserted that the
 * Continue button was gated, by finding the word "canContinue", while the
 * bodyweight question it was supposed to be gating let a blank through.
 *
 * Everything below runs under `npx tsx`, so tests/onboarding-pager.check.mjs
 * drives the real rules rather than a description of them.
 *
 * THE ORDER IS NOT A DETAIL
 * ─────────────────────────
 * No page is conditional and no page is skipped. The tree that this replaced
 * branched, and the branch is what made it long: somebody who said a shoulder
 * hurt was asked four more questions than somebody who did not, and the two of
 * them could not be compared. Ten pages, every one of them put to everybody,
 * is a sign-up that can be finished in a couple of minutes and a profile that
 * means the same thing for every person who has one.
 *
 * No React and no react-native import in this file, deliberately.
 */
import { bodyweightIssue } from './bodyweight';
import { ageIssue } from './one-rep-max-input';
import {
  TIER_ORDER,
  type EquipmentTier,
  type ExperienceLevel,
  type FitnessGoal,
  type OnboardingDraft,
  type PainRegion,
  type Sex,
  type SignUpAnswers,
  type WeightUnit,
} from './store';
import { withKeptSupplies } from './kit';

/**
 * The pages, in the order they are put to somebody.
 *
 * Named rather than numbered. The pager this restores was driven by a bare
 * index referenced from five places that had to agree, and every one of its
 * shipped bugs was a number left behind when a page moved: a Continue button
 * that never enabled, a text field that stopped taking focus, a save that fired
 * one page early and wrote the default for the question asked after it. An
 * index is derived from this list now, so moving a page moves everything.
 *
 * WHAT IS NOT HERE, AND WHY. There is no theme page (new installs open dark,
 * and the setting is in Profile), no strength-test page and no best-lifts page
 * (both retired, Archie's decision 3), and no programme is chosen, offered or
 * certificated anywhere in the flow. Signing up produces a profile. It does not
 * enrol anybody in anything.
 */
export const SIGN_UP_PAGES = [
  'welcome',
  'name',
  'age',
  'sex',
  'bodyweight',
  'experience',
  'goals',
  'equipment',
  'around',
  'ready',
] as const;

export type SignUpPage = (typeof SIGN_UP_PAGES)[number];

/** Where a page sits, or -1 for a name that is not a page. */
export function pageIndex(page: SignUpPage): number {
  return SIGN_UP_PAGES.indexOf(page);
}

/** The last page, which is the only one with no Continue button under it. */
export const LAST_SIGN_UP_PAGE: SignUpPage = SIGN_UP_PAGES[SIGN_UP_PAGES.length - 1];

/**
 * The answers as they are being given, in the words and units they are typed
 * in. Nothing here has been converted or defaulted yet.
 *
 * `sore` and `avoid` are undefined until the person has said something, and an
 * EMPTY ARRAY is a real answer to both: "nothing is sore" is a different state
 * from "we have not asked yet", and the difference is what lets the Continue
 * button stay off until the clinical question has actually been answered.
 */
export interface SignUpDraftAnswers {
  name: string;
  /** Their age in whole years, as typed. */
  age: string;
  sex: Sex | null;
  /** The number they typed, read in the unit they chose on the same page. */
  bodyweight: string;
  experience: ExperienceLevel | null;
  goals: FitnessGoal[];
  equipment: EquipmentTier[];
  /** Areas they say are sore. `[]` means "nothing", undefined means unanswered. */
  sore?: PainRegion[];
  /** Areas a clinician told them to stay off. Same two meanings. */
  avoid?: PainRegion[];
}

/** Nothing answered yet. */
export const EMPTY_SIGN_UP: SignUpDraftAnswers = {
  name: '',
  age: '',
  sex: null,
  bodyweight: '',
  experience: null,
  goals: [],
  equipment: [],
  sore: undefined,
  avoid: undefined,
};

/**
 * What is wrong with what has been TYPED on this page, in words, or null.
 *
 * Blank returns null on purpose. A message that appears on an empty box tells
 * somebody off for not having finished typing yet; the empty box is handled by
 * `canContinue`, which keeps the button off without shouting about it.
 */
export function pageIssue(
  page: SignUpPage,
  answers: SignUpDraftAnswers,
  unit: WeightUnit
): string | null {
  if (page === 'age') {
    return answers.age.trim() === '' ? null : ageIssue(answers.age);
  }
  if (page === 'bodyweight') {
    return answers.bodyweight.trim() === '' ? null : bodyweightIssue(answers.bodyweight, unit);
  }
  return null;
}

/**
 * Whether the Continue button on this page may be pressed.
 *
 * EVERY QUESTION IS REQUIRED. There is no skip and no "optional" anywhere in
 * the flow, and the two that used to be optional are the two worth saying out
 * loud:
 *
 *   BODYWEIGHT. It scales the opening load of every accessory, every
 *   bodyweight-relative movement and every estimate made before the app has
 *   watched anybody lift. The old flow let it through blank and assumed 75 kg,
 *   which opens a 55 kg person about 35% too heavy on the one session where
 *   they are least able to tell that a weight is wrong for them.
 *
 *   THE CLINICAL QUESTION. A shoulder somebody was told to stay off does not
 *   hurt while they are staying off it, so it is not caught by asking what is
 *   sore. It is put to everybody, and "Nothing" is an answer to it.
 */
export function canContinue(
  page: SignUpPage,
  answers: SignUpDraftAnswers,
  unit: WeightUnit
): boolean {
  switch (page) {
    case 'welcome':
    case 'ready':
      return true;
    case 'name':
      return answers.name.trim().length > 0;
    case 'age':
      return answers.age.trim() !== '' && ageIssue(answers.age) === null;
    case 'sex':
      return answers.sex !== null;
    case 'bodyweight':
      return (
        answers.bodyweight.trim() !== '' && bodyweightIssue(answers.bodyweight, unit) === null
      );
    case 'experience':
      return answers.experience !== null;
    case 'goals':
      return answers.goals.length > 0;
    case 'equipment':
      return answers.equipment.length > 0;
    case 'around':
      return answers.sore !== undefined && answers.avoid !== undefined;
  }
  return false;
}

/**
 * THE BEGINNER EQUIPMENT LOCK IS GONE, AND THIS IS WHERE IT LIVED.
 *
 * It read `experience === 'beginner' ? ['bodyweight', 'bands'] : TIER_ORDER`,
 * and it was a real restriction rather than a padlock drawn on a tile: a
 * beginner could not tick dumbbells here, in the readiness picker, on Home, on
 * Recover or in the Profile sheet, and answering "beginner" after ticking a
 * full gym deleted the other tiers.
 *
 * What it was protecting against was the old weekly pools, which were not
 * levelled: kit was the only thing standing between somebody on their first
 * session and a barbell back squat. Every strength session is built from the
 * library now, and the library's own level ceiling does that job properly - a
 * beginner is given Beginner records whatever they own, so the lock was costing
 * them 18 of the 36 Beginner exercises (all four cable rows, both kettlebell
 * deadlifts, both plate presses, the carries, everything using a bench or box)
 * and telling them a gym membership was something to grow into.
 *
 * So the kit question and the level question are separate questions now: what
 * have you got, and how much have you done. tests/beginner-equipment.check.mjs
 * holds both halves - every level is offered every tile here, and a beginner at
 * a full gym is still given nothing above Beginner.
 */

/**
 * Ticking a tile, with the two rules the old pager had.
 *
 * A full gym means everything, so picking it picks the lot; picking anything
 * else means it is NOT a full gym, so the full-gym tile comes back off.
 *
 * NO EXPERIENCE ARGUMENT. It used to take one, purely so it could refuse a
 * tile the lock did not allow, and the parameter is deliberately removed rather
 * than left unused: a spare `experience` sitting in this signature is an
 * invitation to filter by it again.
 */
export function toggleTier(tiers: EquipmentTier[], tier: EquipmentTier): EquipmentTier[] {
  if (tier === 'fullgym') {
    return tiers.includes('fullgym')
      ? tiers.filter((t) => t !== 'fullgym')
      : withKeptSupplies(TIER_ORDER, tiers);
  }
  if (tiers.includes(tier)) return tiers.filter((t) => t !== tier && t !== 'fullgym');
  return [...tiers, tier];
}

/**
 * Answering the experience question, which no longer touches the kit answer.
 *
 * It used to clear it whenever the answer CHANGED, and that was the lock again:
 * the old answer decided which tiles were on offer, so a kit answer given under
 * it could not be trusted under a new one. Nothing decides the tiles now, so
 * clearing would only mean somebody who went back a page to correct "beginner"
 * to "intermediate" came forward to find their gym unticked.
 *
 * Kept as a named rule rather than folded into the screen so that the two
 * answers staying independent is something a check can run.
 */
export function pickExperience(
  answers: SignUpDraftAnswers,
  level: ExperienceLevel
): SignUpDraftAnswers {
  if (answers.experience === level) return answers;
  return { ...answers, experience: level };
}

/**
 * "Nothing" and a list of areas contradict each other, so ticking one clears
 * the other. Without this, "my knee, and nothing" is an answer the profile
 * would have to guess about.
 */
export function toggleRegion(regions: PainRegion[] | undefined, region: PainRegion): PainRegion[] {
  const current = regions ?? [];
  return current.includes(region) ? current.filter((r) => r !== region) : [...current, region];
}

/** The finished sign-up, in the one shape `completeOnboarding` takes. */
export function toSignUpAnswers(
  answers: SignUpDraftAnswers,
  unit: WeightUnit
): SignUpAnswers {
  const age = parseInt(answers.age.trim(), 10);
  const weight = parseFloat(answers.bodyweight.trim());
  return {
    name: answers.name.trim(),
    // Both pages are required, so neither fallback can be reached by finishing
    // the flow. They exist because a type has to have a value, not because
    // anybody is ever saved with one.
    sex: answers.sex ?? 'other',
    ageYears: Number.isFinite(age) ? age : 0,
    bodyweight: Number.isFinite(weight) ? weight : 0,
    weightUnit: unit,
    experienceLevel: answers.experience ?? 'beginner',
    goals: answers.goals,
    equipmentTiers: answers.equipment,
    soreRegions: answers.sore ?? [],
    clinicalAvoid: answers.avoid ?? [],
  };
}

/**
 * The answer sheet, written down so the app can be closed on page six.
 *
 * WHY THE PAGE IS SAVED WITH IT. Somebody who put their phone down half way
 * through does not want to start at "Welcome" and swipe back to where they
 * were; they want the page they were on. The age is stored as the number it
 * parsed to rather than as the typed text, so a half-typed "1" left behind by
 * an app that was killed mid-keystroke restores as an empty box instead of as
 * an age the flow would refuse to move past.
 */
export function answersToDraft(
  answers: SignUpDraftAnswers,
  page: SignUpPage,
  existing?: OnboardingDraft | null
): OnboardingDraft {
  const age = parseInt(answers.age.trim(), 10);
  return {
    ...(existing ?? {}),
    step: pageIndex(page),
    name: answers.name,
    sex: answers.sex,
    ageYears: Number.isFinite(age) ? age : undefined,
    bodyweight: answers.bodyweight,
    experienceLevel: answers.experience,
    goals: answers.goals,
    equipmentTiers: answers.equipment,
    soreRegions: answers.sore,
    clinicalAvoid: answers.avoid,
  };
}

/** The same answers read back out, with anything missing left unanswered. */
export function draftToAnswers(draft: OnboardingDraft | null | undefined): SignUpDraftAnswers {
  if (!draft) return { ...EMPTY_SIGN_UP };
  return {
    name: draft.name ?? '',
    age: typeof draft.ageYears === 'number' && draft.ageYears > 0 ? String(draft.ageYears) : '',
    sex: draft.sex ?? null,
    bodyweight: draft.bodyweight ?? '',
    experience: draft.experienceLevel ?? null,
    goals: draft.goals ?? [],
    equipment: draft.equipmentTiers ?? [],
    sore: draft.soreRegions,
    avoid: draft.clinicalAvoid,
  };
}

/**
 * The page a saved draft resumes on.
 *
 * Clamped, because a step from an older build, or a corrupted one, that points
 * past the last page would strand somebody on blank space with no button.
 * A draft that had reached the last page resumes on the page before it: the
 * finish is a button, not an answer, and landing on it would let somebody
 * finish a sign-up they had not actually finished answering.
 */
export function resumePage(draft: OnboardingDraft | null | undefined): SignUpPage {
  const step = Math.trunc(draft?.step ?? 0);
  const clamped = Math.min(Math.max(Number.isFinite(step) ? step : 0, 0), SIGN_UP_PAGES.length - 2);
  return SIGN_UP_PAGES[clamped];
}
