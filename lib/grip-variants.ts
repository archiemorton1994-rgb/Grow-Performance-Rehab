import type { ExerciseTemplate } from '@/lib/exercise-db';

/**
 * Grip and stance variants for accessory work.
 *
 * WHY THIS IS A CURATED TABLE AND NOT A RULE
 * ──────────────────────────────────────────
 * The ask was for accessories to rotate their grip — "wide grip rows also
 * rotate into close grip rows etc". Those variants do not exist in the
 * database: of 447 pickable exercises only 31 carry any grip or stance modifier
 * in their name, and there are three genuine variant families in total. So they
 * have to be introduced.
 *
 * They cannot be introduced by rule. A wide-grip Romanian deadlift is not a
 * thing, a close-grip variant of something already performed at shoulder width
 * is a rename, and applying modifiers indiscriminately would produce cues that
 * are not merely useless but wrong. This is a rehab-adjacent app whose users may
 * be training around an injury, so an invented variant is a safety problem, not
 * a cosmetic one.
 *
 * Every entry below was proposed against the real database and then
 * adversarially reviewed against six tests: does the base exist under exactly
 * this name; is it a genuine variant rather than a rename; does it need a
 * different working weight (it inherits suggestedLoad, so it must not); would
 * the base's footage mislead; does it increase load on a vulnerable joint; and
 * is the cue specific enough to actually perform.
 *
 * MOST CANDIDATES WERE REJECTED, and the rejections are the useful part:
 *
 *   wide-grip lat pulldown, T-bar row, seal row, seated cable row
 *       — a wide grip on a row or pulldown takes the shoulder past 90 degrees
 *         of abduction under load, which is the classic impingement position.
 *         The Inverted Row survives precisely because the torso is horizontal
 *         and the shoulder never gets there.
 *   wide-stance hip thrusts, long-stance Bulgarian split squat
 *       — increase hip or knee demand at a load calibrated for the base.
 *   front-racked lunges, goblet-held step-ups
 *       — a real coached variant, but it cuts usable weight by about a third,
 *         and the weight is inherited.
 *   toes-in/toes-out leg curls
 *       — a real but subtle bias that would read as a gimmick rename.
 *
 * The bar was set deliberately high. If it should be lower, that is a product
 * decision, not a code change — add entries here.
 *
 * IMPLEMENTATION NOTE. A variant keeps the base exercise's `id`, deliberately.
 * Progression, personal bests and weight memory all key on exerciseId, and a
 * grip variant is the same movement at the same load — so a wide-grip inverted
 * row should continue the base's progression rather than start a new one.
 */
export interface GripVariant {
  name: string;
  /** Appended to the base cue. Must describe the change precisely enough to
   *  perform it without separate footage. */
  cueSuffix: string;
}

export const GRIP_VARIANTS: Record<string, GripVariant[]> = {
  // Horizontal pull. The one place a wide grip is safe: the torso is
  // horizontal, so the shoulder stays inside 90 degrees of abduction.
  'Inverted Row': [
    {
      name: 'Wide-Grip Inverted Row',
      cueSuffix:
        'Take the bar about a hand-width outside shoulder width and let the elbows flare to roughly 45 degrees as the chest meets the bar.',
    },
  ],

  // Vertical pull. Neutral is the third real grip alongside pronated and
  // supinated, both of which already exist as their own entries — so this
  // completes a rotation rather than inventing one. The database already
  // endorses it: Chin-Up carries 'Neutral-Grip Pull-Up' as its swapAlternative.
  'Pull-Up': [
    {
      name: 'Neutral-Grip Pull-Up',
      cueSuffix:
        'Use parallel handles with the palms facing each other; if your bar has no neutral handles, keep the standard grip.',
    },
  ],

  // Overhead and incline pressing. Palms-in keeps the humerus in the scapular
  // plane, which lowers anterior shoulder demand rather than raising it — the
  // right direction for this app.
  'Seated DB Shoulder Press': [
    {
      name: 'Neutral-Grip Seated DB Shoulder Press',
      cueSuffix:
        'Hold the dumbbells palms-facing-each-other and keep them that way for the whole rep, pressing just in front of your ears rather than out to the sides.',
    },
  ],
  'Incline DB Press': [
    {
      name: 'Neutral-Grip Incline DB Press',
      cueSuffix:
        'Turn the dumbbells so your palms face each other and keep the elbows tucked to roughly 45 degrees instead of flared wide.',
    },
  ],

  // Hinge. Foot rotation moves the work off the erectors and onto the glutes,
  // which takes demand away from the lower back rather than adding to it.
  '45 Degree Hyperextension': [
    {
      name: 'Toes-Out 45 Degree Hyperextension',
      cueSuffix:
        'Turn the feet out to roughly 45 degrees on the platform and start each rep by squeezing the glutes. Same load, but the work shifts off the erectors and onto the glutes.',
    },
  ],
};

/**
 * Rotate an accessory's grip. Returns the base unchanged when it has no
 * curated variants, which is the overwhelming majority.
 */
export function applyGripVariant(template: ExerciseTemplate, seed: number): ExerciseTemplate {
  const variants = GRIP_VARIANTS[template.name];
  if (!variants || variants.length === 0) return template;
  const pick = seed % (variants.length + 1);
  if (pick === 0) return template;
  const v = variants[pick - 1];
  return { ...template, name: v.name, cue: `${template.cue} ${v.cueSuffix}` };
}
