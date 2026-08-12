import { getAllPickableExercises } from './exercise-db';
import type { ExperienceLevel, ExerciseCategory, PainRegion, PainSeverity } from './store';

/**
 * Which exercises are unsafe for which complaint.
 *
 * THE PROBLEM THIS SOLVES
 * ───────────────────────
 * Telling the app your knee hurts changed almost nothing. The only adaptation
 * was `comfortVariant` — a hand-authored alternative attached to a small number
 * of templates, which fires only when that specific template is picked AND the
 * complaint is in its trigger list. Everything else went through untouched. A
 * beginner reporting knee pain was measured getting Squat Jumps, Burpees, Box
 * Jumps, a jump-rope warm-up and Bulgarian Split Squats in the same week.
 *
 * HOW IT WORKS
 * ────────────
 * Three tables, all meant to be read and edited by a human:
 *
 *   1. TAG_RULES  — what a movement does to the body, recognised from its name.
 *   2. IMPACT_IN_PRESCRIPTION — the landing a name leaves out, recognised from
 *      the exercise's own reps and cue.
 *   3. RESTRICTED_BY_REGION — what a given complaint should not be doing.
 *
 * Reading this off the exercise's own words rather than a per-exercise field is
 * deliberate. There are 447 pickable exercises and hand-tagging all of them
 * would be wrong within a month of the database growing; the names are
 * descriptive and consistent ("Squat Jump", "Bulgarian Split Squat", "Circuit
 * B: Burpee + Reverse Lunge"), and a compound circuit name matches on every
 * movement it contains, which a single per-exercise tag could not express.
 * Where the name is not descriptive the prescription underneath it is —
 * "AMRAP Finisher" says nothing; its reps say "5 burpees + 10 squat jumps".
 *
 * A NOTE ON WHAT THIS IS NOT
 * ──────────────────────────
 * This is a screening rule, not a diagnosis or a treatment plan. It is
 * deliberately blunt in one direction: it removes things. It does not decide
 * that anything is *good* for a complaint — the targeted rehab sessions and the
 * database's own `injuryFriendlyAlternatives` do that, and they were authored
 * by someone qualified. The mapping below is written as plain data precisely so
 * that a physio can correct it without touching any logic.
 */

export type StressTag =
  /** Both feet leave the ground, or the movement is a landing/deceleration. */
  | 'high_impact'
  /** The knee bends past roughly 90° under load. */
  | 'deep_knee_flexion'
  /** Resisted knee extension with the foot free — hard on the kneecap. */
  | 'open_chain_knee'
  /** A loaded hip hinge: deadlifts, RDLs, good mornings, swings. */
  | 'loaded_hinge'
  /** A load sitting on the spine — bar on the back, standing overhead work. */
  | 'spinal_compression'
  /** The low back rounds under load. */
  | 'lumbar_flexion'
  /** Pressing or reaching overhead. */
  | 'overhead'
  /** The shoulder is taken to the end of its range under load. */
  | 'shoulder_end_range'
  /** Heavy elbow flexion/extension in isolation. */
  | 'elbow_load'
  /** Weight bearing through an extended wrist, or a hard front rack. */
  | 'wrist_load'
  /** Loaded through the ankle/achilles. */
  | 'ankle_load'
  /** Load hanging from, or pulling on, the neck and upper traps. */
  | 'neck_load'
  /** Sustained hard gripping. */
  | 'grip_load';

/**
 * Name patterns → what the movement asks of the body.
 *
 * Order does not matter; every rule that matches contributes its tag. Patterns
 * are matched case-insensitively against the whole exercise name, so a circuit
 * picks up a tag from any movement inside it.
 */
const TAG_RULES: { tag: StressTag; test: RegExp }[] = [
  // Feet leaving the ground, and the landings that follow. Running belongs here
  // too — a 20 m shuttle is a hundred landings, and the names that carry it
  // ("KB Swing + Shuttle", "Steady Walk / Light Jog") never say jump.
  { tag: 'high_impact', test: /\bjump|jumping|plyo|burpee|\bhop\b|bound\b|skater|tuck jump|depth drop|depth jump|power skip|\bskip\b|jump rope|high knees|mountain climber|sprint|stepping jack|jumping jack|box jump|broad jump|vertical jump|drop squat|shuttle|\bruns?\b|running|\bjogs?\b|jogging/i },
  { tag: 'ankle_load', test: /\bjump|plyo|burpee|\bhop\b|bound\b|skater|sprint|jump rope|\bskip\b|calf raise|calf press|heel raise|toe raise|pogo|shuttle|\bruns?\b|running|\bjogs?\b|jogging/i },

  // Knee. The barbell squats and the leg press belong here for the same reason
  // the front squat does — the knee goes past 90° with the heaviest load the
  // user handles all week. Leaving them out is why a SEVERE knee complaint
  // still prescribed Back Squat and Leg Press with nothing said about either.
  // The light front-loaded squats (goblet, box, bodyweight) are deliberately
  // NOT here: they are the regression the screen reaches for, and banning the
  // substitute along with the movement leaves nothing to put in its place.
  { tag: 'deep_knee_flexion', test: /bulgarian|split squat|sissy squat|pistol|cossack|curtsy|hack squat|deep squat|\bfront squat\b|\bback squat\b|barbell squat|belt squat|zercher|\bleg press\b|overhead squat|walking lunge|reverse lunge|lateral lunge|forward lunge|\blunge\b|step-up|step up|knee drive/i },
  { tag: 'open_chain_knee', test: /leg extension|knee extension|quad extension/i },

  // Hip and low back.
  // \bswings?\b spelled exactly as grip_load spells it. The plural was missing
  // here too: "EMOM Finisher: KB / DB Swings" and "Tabata Finisher: Alternating
  // Swings" were hinge-free, so a sore low back kept both.
  { tag: 'loaded_hinge', test: /deadlift|romanian|\brdl\b|good morning|\bswings?\b|hip thrust|clean\b|snatch|jefferson|back extension|hyperextension|jump shrug/i },
  { tag: 'spinal_compression', test: /back squat|front squat|overhead squat|zercher|barbell squat|standing (?:overhead|military|shoulder) press|push press|jerk|\bthruster\b|farmer|yoke|good morning|\bshrug\b/i },
  { tag: 'lumbar_flexion', test: /sit-up|situp|crunch|toe touch|jackknife|v-up|\bv up\b|roll-?up|jefferson curl|russian twist/i },

  // Shoulder, elbow, wrist, neck.
  // \bslam\b, because a slam STARTS overhead. Reading that off the cue instead
  // is not an option — see IMPACT_IN_PRESCRIPTION on why impact is the only
  // thing the prescription is trusted for — so the name has to carry it, and
  // every slam in the catalogue (med ball, battle rope) is thrown from above
  // the head. Without it "Med Ball Slam + Jump Rope Round" was overhead-free.
  { tag: 'overhead', test: /overhead|\bohp\b|military press|shoulder press|push press|\bjerk\b|snatch|handstand|pull-?up|chin-?up|lat pulldown|\bthruster\b|\bpress-?out\b|\bslams?\b/i },
  // \brings?\b, not ring\b. Without the leading boundary it matched "Nordic
  // HamstRING Curl", so reporting shoulder pain removed a hamstring exercise.
  { tag: 'shoulder_end_range', test: /\bdips?\b|\bfly\b|\bflye\b|pec deck|upright row|behind[- ]the[- ]neck|behind neck|\bpullover\b|deep push-?up|\brings?\b/i },
  { tag: 'elbow_load', test: /\bcurl\b|curls\b|skull ?crusher|triceps? extension|triceps? pushdown|pushdown|kickback|\bdip\b|dips\b|chin-?up|preacher|concentration/i },
  // An ab wheel is the most wrist-extended loaded position in the catalogue —
  // bodyweight through a straight arm on a rolling handle — and it was being
  // offered as the exercise that would protect a sore wrist.
  { tag: 'wrist_load', test: /push-?up|plank|bear crawl|front rack|handstand|burpee|renegade|\bdip\b|dips\b|upright row|wrist curl|mountain climber|ab wheel|\broll-?outs?\b/i },
  // `neck bridge` only — NOT a bare \bbridge\b. Every one of the 15 exercises in
  // the catalogue with "bridge" in its name is a GLUTE bridge, so the bare word
  // was a 100% false-positive rule: reporting neck or upper-back pain deleted
  // eleven glute bridges, none of which load the neck. Worse, it deleted them
  // and put something back — measured, an upper-back complaint had "Single-Leg
  // Glute Bridge + Side Plank Round" replaced by "Burpee + Reverse Lunge +
  // Plank Hold" under the caption "to protect your upper back".
  { tag: 'neck_load', test: /\bshrug\b|behind[- ]the[- ]neck|behind neck|neck (?:curl|extension|bridge)/i },
  // Sustained hard gripping — carries, hangs, heavy pulls from the floor. NOT
  // every row: a cable row is a back exercise you happen to hold, and banning
  // all rowing on a sore wrist took out 20% of the catalogue for no good reason.
  //
  // A bare \bswings?\b, not `kb swing`. A swing is a bell held in the hands at
  // the end of a long lever whatever the name calls it, and matching only the
  // abbreviated spelling meant "Alternating Swing + Tuck Jump Round" carried no
  // grip demand at all and was offered to protect a sore wrist. `loaded_hinge`
  // matched the same bare word already, so the two rules disagreed about which
  // exercise "Swing" named. The mobility swings are stripped before any rule
  // runs — see NOT_WHAT_IT_LOOKS_LIKE.
  { tag: 'grip_load', test: /deadlift|farmer|\bcarry\b|carries|\bhang\b|hanging|pull-?up|chin-?up|snatch|\bclean\b|fat grip|grip strength|gripper|\bswings?\b/i },
];

/**
 * Words that read as one movement and mean another.
 *
 * Two of them, both measured as live false positives:
 *
 *   swing — a loaded hinge with a bell in both hands, except in "Leg Swing +
 *     Arm Cross Warm-Up", "Marching + Arm Swings" and "Goblet Squat + Arm Swing
 *     Warm-Up", where nothing is held and nothing is loaded. Reading those as
 *     hinges took three mobility warm-ups out of every hip, low-back,
 *     hamstring, glute and mid-back session and put something else in their
 *     place.
 *   curl — heavy elbow flexion, except in the eight LEG curls, where the elbow
 *     does nothing at all. Measured, a sore bicep produced "Swapped from Nordic
 *     Hamstring Curl to protect your bicep" and a sore tricep produced the same
 *     for "Hamstring Curl (light)". Same shape of mistake as \brings?\b once
 *     matching "Nordic HamstRING Curl", in the same corner of the catalogue.
 *
 * Removed from the name before any rule sees it rather than excluded rule by
 * rule, so a name containing BOTH a leg swing and a kettlebell swing still
 * reads as the loaded hinge it is. NOT a general exclusion list: a phrase only
 * belongs here when no rule needs it — "jefferson curl" is spinal flexion and
 * stripping it would cost lumbar_flexion the only pattern that catches it.
 */
const NOT_WHAT_IT_LOOKS_LIKE =
  /\b(?:arm|leg|shoulder|torso)\s+swings?\b|\b(?:leg|hamstring|nordic)\s+curls?\b/gi;

/**
 * The landing a name does not admit to.
 *
 * Most names are honest — "Squat Jump", "Burpee", "Box Jump" — but not all of
 * them. "AMRAP Finisher" is eight minutes of burpees and squat jumps, "Dynamic
 * Warm-Up" is jumping jacks and butt kicks, and "KB Swing + Shuttle" hides a
 * sprint behind an abbreviation. Judging those on the name alone made them safe
 * for every complaint at once, so they were not merely left in a knee-pain
 * session — they were eligible to be picked as the REPLACEMENT for the lunge
 * that was taken out of it.
 *
 * Impact is the only thing read out of the prescription. Coaching cues are full
 * of the words the other rules key on — "press the floor away", "curl the tail
 * under", "keep it overhead" — and matching those would rule out most of the
 * catalogue for most complaints. What a movement lands on is the one thing a
 * rep scheme reliably spells out.
 */
const IMPACT_IN_PRESCRIPTION =
  /burpee|\bjump|jumping|plyo|\bhops?\b|hopping|bound(?:s|ing)?\b|skater|butt kick|high knees|mountain climber|sprint|shuttle|\bruns?\b|running|\bjogs?\b|jogging|double-?under|pogo/i;

/**
 * …unless the exercise says in so many words that it is the version that does
 * not land. Several of these exist precisely as the gentle alternative — "same
 * cardio effect as jumping jacks without the impact", "rehearse the jump
 * pattern without leaving the floor" — and taking them out would remove the
 * substitutes the screen most wants to reach for.
 */
const IMPACT_DISCLAIMED =
  /\b(?:low|zero|no|non)[-\s]?impact|without (?:the )?(?:sprint|jump|jumping|impact|running)|without leaving the (?:floor|ground)|no jumping|instead of (?:the )?(?:sprint|jump|run)/i;

/**
 * Sprinting a bike, rower or erg is still sprinting, and still nothing lands.
 * "Assault Bike Intervals" prescribes "20s sprint" and is one of the few hard
 * conditioning options a sore knee or achilles can actually keep.
 */
const SEATED_CONDITIONING =
  /\bbike|cycling|\berg\b|rower|rowing|elliptical|assault|airdyne|arc trainer|\bswim/i;

/**
 * What each complaint should be kept away from.
 *
 * Read this as "someone whose X is bothering them today should not be doing…".
 * It is intentionally conservative for joints and lighter for muscles: a sore
 * quad is a reason to avoid deep loaded knee bending for a session, a painful
 * knee is a reason to avoid it and everything that lands hard on top.
 */
export const RESTRICTED_BY_REGION: Record<PainRegion, StressTag[]> = {
  // ── Joints ────────────────────────────────────────────────────────────────
  knee: ['high_impact', 'deep_knee_flexion', 'open_chain_knee'],
  ankle_achilles: ['high_impact', 'ankle_load'],
  hip_groin: ['high_impact', 'deep_knee_flexion', 'loaded_hinge'],
  lower_back: ['high_impact', 'spinal_compression', 'lumbar_flexion', 'loaded_hinge'],
  upper_back: ['spinal_compression', 'overhead', 'neck_load'],
  neck: ['neck_load', 'overhead', 'spinal_compression'],
  front_shoulder: ['overhead', 'shoulder_end_range'],
  rear_shoulder: ['overhead', 'shoulder_end_range'],
  elbow: ['elbow_load', 'overhead', 'wrist_load'],
  wrist: ['wrist_load', 'grip_load'],

  // ── Muscles / soft tissue ─────────────────────────────────────────────────
  calf_shin: ['high_impact', 'ankle_load'],
  quads: ['deep_knee_flexion', 'open_chain_knee', 'high_impact'],
  hamstrings: ['loaded_hinge', 'high_impact'],
  glutes: ['loaded_hinge', 'high_impact'],
  chest: ['shoulder_end_range'],
  bicep: ['elbow_load', 'grip_load'],
  tricep: ['elbow_load', 'overhead'],
  lat_mid_back: ['loaded_hinge', 'spinal_compression'],
  core_ribs: ['lumbar_flexion', 'loaded_hinge'],
};

/** Plain-English name for a tag, for the line shown on a substituted card. */
export const STRESS_TAG_LABELS: Record<StressTag, string> = {
  high_impact: 'jumping and landing',
  deep_knee_flexion: 'deep knee bending',
  open_chain_knee: 'loaded knee extension',
  loaded_hinge: 'loaded hip hinging',
  spinal_compression: 'loading through the spine',
  lumbar_flexion: 'rounding the lower back',
  overhead: 'overhead work',
  shoulder_end_range: 'end-range shoulder work',
  elbow_load: 'loaded elbow work',
  wrist_load: 'weight through the wrists',
  ankle_load: 'loading the ankle',
  neck_load: 'loading the neck and traps',
  grip_load: 'hard gripping',
};

let prescriptionsByName: Map<string, string> | null = null;

/**
 * An exercise's own reps and cue, found from the name the caller already holds.
 *
 * The screen runs over finished sessions and over the alternatives hanging off
 * each card, and in both places an exercise is a name and very little else.
 * Resolving the prescription here means every caller is judged on the same
 * evidence without having to carry the template around with it. A name the
 * catalogue does not recognise falls back to an empty prescription, which is
 * simply the name-only behaviour this started as.
 */
function prescriptionFor(name: string): string {
  if (!prescriptionsByName) {
    prescriptionsByName = new Map(
      getAllPickableExercises().map(({ template }) => [
        template.name.toLowerCase(),
        `${template.reps} ${template.cue}`,
      ])
    );
  }
  return prescriptionsByName.get(name.toLowerCase()) ?? '';
}

/**
 * Everything a movement asks of the body.
 *
 * Read from the name first, then from the exercise's own reps and cue for the
 * impact a name can leave out. The second pass only ever ADDS: a movement the
 * name already rules out stays ruled out, whatever its cue claims.
 *
 * `movementPattern` is used only as a backstop for names the patterns miss —
 * a hinge or a squat that is named after its equipment rather than its shape.
 */
export function stressTagsFor(name: string, movementPattern?: string): StressTag[] {
  const tags = new Set<StressTag>();
  const readable = name.replace(NOT_WHAT_IT_LOOKS_LIKE, ' ');
  for (const rule of TAG_RULES) {
    if (rule.test.test(readable)) tags.add(rule.tag);
  }
  const prescription = prescriptionFor(name);
  if (
    IMPACT_IN_PRESCRIPTION.test(prescription) &&
    !IMPACT_DISCLAIMED.test(prescription) &&
    !SEATED_CONDITIONING.test(`${name} ${prescription}`)
  ) {
    tags.add('high_impact');
    tags.add('ankle_load');
  }
  if (movementPattern === 'hinge' && /barbell|dumbbell|\bdb\b|\bkb\b|kettlebell|trap bar/i.test(name)) {
    tags.add('loaded_hinge');
  }
  return [...tags];
}

/**
 * The tags that are off-limits for this user today.
 *
 * BEGINNER SAFETY OVERRIDE. A beginner reporting any complaint at all loses
 * high-impact work across the board, not just the impact that happens to load
 * the sore joint. Someone new to training has neither the landing mechanics nor
 * the tissue tolerance to absorb plyometrics, and "my shoulder hurts" is not a
 * reason to have them doing box jumps either. Experienced lifters keep whatever
 * their specific complaint does not rule out.
 *
 * SEVERE. Pain bad enough to call severe is a reason not to land on anything
 * today, wherever it is. Below severe the impact rules stay region-specific: a
 * sore bicep is genuinely not a reason to stop sprinting, and pretending
 * otherwise trains people to under-report so the app stops taking things away.
 */
export function restrictedTagsFor(
  regions: PainRegion[] | undefined,
  experience?: ExperienceLevel,
  severity?: PainSeverity
): Set<StressTag> {
  const banned = new Set<StressTag>();
  if (!regions || regions.length === 0) return banned;
  for (const r of regions) {
    for (const tag of RESTRICTED_BY_REGION[r] ?? []) banned.add(tag);
  }
  if (experience === 'beginner') banned.add('high_impact');
  if (severity && SEVERITY_BANS_IMPACT[severity]) banned.add('high_impact');
  return banned;
}

/**
 * What the app may not CHOOSE for you — as opposed to what it may not leave you
 * doing, which is `restrictedTagsFor` above.
 *
 * THE PROBLEM THIS SOLVES
 * ───────────────────────
 * RESTRICTED_BY_REGION lists `high_impact` for eight regions of nineteen, and
 * that is the right answer to "should a sore tricep cancel your sprints?" — no.
 * It is the wrong answer to a different question the same table was being asked:
 * "may the app hand this person burpees under a card that says it is protecting
 * their tricep?" Measured across the ten regions that do not restrict impact,
 * that produced 39 distinct substitutions of the form
 *
 *     Broad Jump + Walking Lunge Round
 *     Swapped from DB Squat Clean + Push Press Round to protect your elbow
 *
 * — a caption that promises care while the app quietly escalates a press into a
 * plyometric. The coach-mark on the pain screen says "we'll automatically swap
 * exercises away from that area so you can train safely"; that sentence is
 * about what the app picks, so this is the set that has to honour it.
 *
 * Widening RESTRICTED_BY_REGION instead was the obvious fix and the wrong one.
 * It would have deleted every jump from the session of anyone with a sore
 * wrist, which is not a safety rule, it is the app being nervous on someone
 * else's behalf. Leaving what the user's own program already contains alone,
 * and holding what the app substitutes IN to a higher standard, is the smaller
 * and more honest rule: never make the session harder than you found it.
 */
export function substitutionRestrictedTags(banned: Set<StressTag>): Set<StressTag> {
  if (banned.size === 0) return banned;
  return new Set<StressTag>([...banned, 'high_impact']);
}

/** The restricted tags a given movement carries. Empty means it is fine. */
export function restrictedTagsOn(
  name: string,
  banned: Set<StressTag>,
  movementPattern?: string
): StressTag[] {
  if (banned.size === 0) return [];
  return stressTagsFor(name, movementPattern).filter((t) => banned.has(t));
}

/**
 * Blocks the screen must not touch.
 *
 * The prehab block is chosen FOR the sore region — when someone reports knee
 * pain, `getRegionPrehabWorkout('knee')` hands back the knee work. Screening it
 * removes the treatment because it mentions the knee, which is exactly
 * backwards. Measured: without this exemption, reporting knee pain deleted
 * Terminal Knee Extension (a standard patellofemoral rehab exercise) and
 * replaced it with a step-down, which is harder on the joint.
 *
 * Whole session types are exempted for the same reason: a rehab or mobility
 * session IS the adaptation.
 */
export const SCREEN_EXEMPT_CATEGORIES: ExerciseCategory[] = ['prehab'];
export const SCREEN_EXEMPT_SESSION_TYPES = ['prehab', 'flexibility'] as const;

/**
 * Categories that may simply be dropped when nothing safe can replace them.
 *
 * A session without a finisher is a shorter session; a session without its main
 * lift is not the session the user asked for. Where a main lift cannot be made
 * safe the search widens rather than giving up (see the engine), so this list
 * is about optional blocks only.
 */
export const DROPPABLE_CATEGORIES: ExerciseCategory[] = [
  'finisher',
  'neuro',
  'mechanical',
  'cardio',
];

/**
 * Which half of the body a movement belongs to.
 *
 * WHY THE SCREEN NEEDS THIS
 * ─────────────────────────
 * Substitutions used to be chosen by CATEGORY alone — a main lift is replaced
 * by a main lift, an accessory by an accessory. Measured on a lower-body
 * session with a sore quad, that produced:
 *
 *     main       Barbell Bench Press   (swapped from Barbell Front Squat)
 *     accessory  Band Face Pull        (swapped from Bodyweight Reverse Lunge)
 *
 * Both are perfectly safe for a quad. Neither is a leg exercise. The screen was
 * quietly turning leg day into a half-upper-body session and saying nothing
 * about it, which is worse than either training around the injury properly or
 * admitting the session cannot be built.
 *
 * 'other' covers full-body, cardio and anything unclassifiable — those are
 * allowed to stand in for either half, because they genuinely do.
 */
export type BodyRegion = 'upper' | 'lower' | 'core' | 'other';

const LOWER_MUSCLES =
  /glute|quad|hamstring|calf|calves|gastrocnemius|adductor|abductor|hip flexor|hip external|soleus|tibialis|posterior chain/i;
const UPPER_MUSCLES =
  /pectoral|chest|deltoid|latissimus|\blats?\b|tricep|bicep|rhomboid|trapezius|rotator cuff|infraspinatus|forearm|grip|brachialis|wrist|serratus|mid back|neck|pronator|elbow/i;
const CORE_MUSCLES =
  /\bcore\b|abdomin|oblique|erector spinae|thoracic extensor|transversus|diaphragm/i;

export function bodyRegionOf(primaryMuscle?: string): BodyRegion {
  if (!primaryMuscle) return 'other';
  if (LOWER_MUSCLES.test(primaryMuscle)) return 'lower';
  if (UPPER_MUSCLES.test(primaryMuscle)) return 'upper';
  if (CORE_MUSCLES.test(primaryMuscle)) return 'core';
  return 'other';
}

/**
 * Can `candidate` stand in for something from `region`?
 *
 * Same region, or unclassified. Deliberately NOT "any safe exercise": a bench
 * press is a safe substitute for a squat in the sense that it will not hurt
 * your quad, and a useless one in the sense that you came to train legs.
 */
export function canSubstituteFor(region: BodyRegion, candidateMuscle?: string): boolean {
  if (region === 'other') return true;
  const c = bodyRegionOf(candidateMuscle);
  return c === region || c === 'other';
}

/**
 * The blocks where body region matters.
 *
 * A main lift and its accessories ARE the session — swap a leg press for a
 * bench press and you are no longer doing legs. A warm-up, a finisher or a
 * cooldown is general conditioning that happens to sit alongside; an upper-body
 * finisher on a squat day is a normal thing a coach would program, not a
 * mistake, so holding those to the same rule would reject good substitutes for
 * no reason.
 */
export const REGION_BOUND_CATEGORIES: ExerciseCategory[] = ['main', 'accessory'];

/**
 * How hard to screen, by how bad it is.
 *
 * Severity used to affect NOTHING. It was read in exactly two places: the
 * readiness screen, to decide whether to show a confirming prompt for 'severe',
 * and the session screen, to copy it onto the completed-session record. No code
 * anywhere read it back. "Mild" and "Moderate" were the same button.
 *
 * Now it decides how much of the session survives:
 *
 *   mild      – swap what loads the sore area, leave the rest alone
 *   moderate  – the same, and drop the explosive and finisher blocks, which are
 *               where an irritated joint gets aggravated fastest
 *   severe    – the same as moderate, and nothing lands anywhere in the session
 *               whichever region hurts, and every working block loses a set
 *
 * The severe row is new, and it is here because the previous three-way question
 * had two answers. Measured across 168 region × session-type × tier
 * combinations, mild and moderate produced different sessions 168 times out of
 * 168 and moderate and severe produced different sessions 0 times out of 168 —
 * the app asked how bad it was, offered three buttons, and treated the last two
 * as the same button. Asking someone in pain to make a distinction you then
 * discard is how they learn to stop answering honestly.
 *
 * A set off every working block is the lever rather than another block-drop
 * because it is the one that applies to every session there is. Dropping blocks
 * only bites on sessions that have those blocks; volume is what every session
 * has, and less of it is what "this is severe" should mean.
 *
 * These are session-shaping rules, not medical ones. They are here as data so
 * they can be argued with.
 */
export const SEVERITY_DROPS_INTENSITY: Record<string, boolean> = {
  mild: false,
  moderate: true,
  severe: true,
};

/** Blocks removed entirely at moderate and above. */
export const HIGH_INTENSITY_CATEGORIES: ExerciseCategory[] = ['neuro', 'finisher'];

/** Whether impact goes out of the whole session whatever the sore region is. */
export const SEVERITY_BANS_IMPACT: Record<string, boolean> = {
  mild: false,
  moderate: false,
  severe: true,
};

/** Sets taken off each working block at severe. */
export const SEVERE_SET_REDUCTION = 1;

/**
 * The blocks a set comes off.
 *
 * The loaded ones only. A warm-up, a cooldown and the rehab block are not
 * volume in the sense that matters — cutting a set of breathing or of the
 * joint work chosen for the sore area makes the session worse, not gentler.
 */
export const SET_REDUCED_CATEGORIES: ExerciseCategory[] = ['main', 'accessory', 'mechanical'];

/** The sentence shown on a card that was changed for safety. */
export function substitutionNote(originalName: string, regionLabel: string): string {
  return `Swapped from ${originalName} to protect your ${regionLabel.toLowerCase()}`;
}
