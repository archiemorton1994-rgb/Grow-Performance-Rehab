/**
 * THE PROFILE BUILDER, DESCRIBED AS A TREE RATHER THAN WRITTEN AS SCREENS.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * app/onboarding.tsx is a swipe pager. Every question is hand-written JSX with
 * its own useState, and the flow is `currentIndex + 1`. That shape can ask ten
 * fixed questions in a fixed order and nothing else. It cannot branch, it cannot
 * be drawn as a diagram, and it cannot be tested as a set of journeys, because
 * there is no object anywhere that represents "the questions".
 *
 * So the questions become data. Once they are a graph you can walk, three things
 * fall out at once:
 *
 *   1. THE SCREEN CAN DRAW ITSELF. You can only draw a tree you can enumerate.
 *   2. THE BRANCHES CAN BE TESTED. tests/profile-tree.check.mjs walks every
 *      journey and asserts nobody is asked something irrelevant, nobody reaches
 *      a dead end, and every path terminates.
 *   3. THE DRAFT GETS SIMPLER. Resuming stores the ANSWERS and recomputes the
 *      path. The old draft stored a step index, which is a number that means
 *      something different the moment the question order changes.
 *
 * WHAT A "TREE" CAN ACTUALLY BE ON A PHONE
 * ────────────────────────────────────────
 * A real tree diagram is wide and a phone is about 390 points across. Twelve
 * nodes branching sideways is illegible at that width, so the tree here runs
 * DOWN a vertical spine that the view travels along, one question in focus at a
 * time, answered nodes collapsing to small chips above you.
 *
 * Branches are the exception and that is the point. `branch` is undefined for
 * most nodes, which means the spine is a straight line most of the way and a
 * visible fork is rare enough to feel like something happened. When one does
 * fork, `branch.label` is the sentence the app draws on the line so the split is
 * legible rather than mysterious: "because you said something is sore".
 *
 * THE TWO TIERS ARE NOT DECORATION
 * ────────────────────────────────
 * `tier` splits the trunk in half. SHAPE is what the person wants, and it is
 * what chooses their programme. TUNE is what the engine needs to set loads and
 * pick exercises. Drawing that boundary on the diagram tells the truth about
 * what the questions are for, and it puts a seam in the exact place the form
 * would be split later if the drop-off numbers ever say it should be.
 *
 * NO REACT AND NO REACT NATIVE IMPORT, so the contract test can run this rather
 * than read a copy of it. The type-only import from ./store is erased at compile
 * time, which lib/rep-scheme.ts already relies on.
 */
import { LADDER_PATTERNS, type LadderPattern } from './exercise-levels';
import type {
  EquipmentTier,
  ExperienceLevel,
  PainRegion,
  Sex,
  TestWeekFrequency,
  WeightUnit,
} from './store';
import { displayUnitToKg } from './utils';

// ─── The vocabulary the builder introduces ──────────────────────────────────

/**
 * What the programme is built around. THE branch point, and the single question
 * that does not exist today.
 *
 * Everyone who finishes the current builder is put on the same three-lift
 * rotation, because `SESSION_ORDER = ['squat', 'bench', 'deadlift']` in
 * lib/store.ts is the whole programme and no answer reaches it. The app then
 * works out over about a fortnight that somebody does not want to squat, by
 * watching them decline it. This asks instead.
 */
export type ProgrammeFocus =
  | 'barbell'
  | 'strength'
  | 'muscle'
  | 'comeback'
  | 'fitness'
  | 'joints';

/** Days a week. The first thing any coach asks, and never once asked here. */
export type TrainingDays = 2 | 3 | 4 | 5;

/**
 * Usual session length in minutes.
 *
 * Exactly the three the generator understands. TimeAvailable in ./store is
 * '30' | '45' | '60' and lib/workout-engine.ts branches on those three strings
 * throughout, so a fourth option here would be a question the app collects an
 * answer to and then cannot honour. Asking it would break the one rule this
 * tree is built on.
 */
export type SessionLength = 30 | 45 | 60;

/**
 * How long the first block runs, counted in SESSIONS.
 *
 * WHY NOT WEEKS. A block measured in weeks is a promise about the calendar, and
 * this app has no control over anybody's calendar. Somebody who said three days
 * a week and then trained twice for a fortnight has not fallen behind a
 * twelve-week block, but a week counter says they have, and the app that keeps
 * telling you that you are behind is the app you delete.
 *
 * Counted in sessions, the block only moves when they train, so it is a promise
 * the app can keep. It also lets somebody choose something genuinely short: four
 * sessions is a fortnight of trying it out, and no number of weeks expresses
 * that without assuming a frequency.
 *
 * Nine choices rather than three, because "how much am I committing to" is the
 * question people actually hesitate over, and three answers made two of them
 * wrong for most people.
 */
export type SessionCount = 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;

/** Every count offered, in the order the question lists them. */
export const SESSION_COUNTS: SessionCount[] = [4, 6, 8, 10, 12, 14, 16, 18, 20];

/** How long something has been sore. Changes whether it is treated as acute. */
export type InjuryAge = 'days' | 'weeks' | 'months' | 'years';

/**
 * Every answer, keyed by node id.
 *
 * Deliberately loose. The nodes own their own value types and the screen writes
 * whatever the node's kind produces; narrowing happens once, in the function
 * that turns a finished set of answers into a UserProfile. A union that tried to
 * be exact here would have to be edited every time a question moved.
 */
export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;

export interface TreeOption {
  value: string;
  label: string;
  /** One short line under the label. Not every option needs one. */
  hint?: string;
}

/** What the node collects, which is also which control the screen draws. */
export type NodeKind = 'single' | 'multi' | 'number' | 'text';

/** Which half of the trunk a node sits on. See the docblock. */
export type NodeTier = 'shape' | 'tune';

export interface TreeNode {
  id: string;
  /** The question as asked, in the app's voice. */
  question: string;
  /** One supporting line. Optional, and most nodes are better without one. */
  hint?: string;
  /**
   * A hint that depends on what they have already said, used instead of `hint`
   * when it is present.
   *
   * One node needs it. Somebody who has just declined strength tests and
   * somebody who has just opted into them need different reasons to type their
   * best lifts, and giving either of them the other's line is wrong: promising
   * a re-test to a person who said no is a promise nothing will keep, and
   * "this is optional" is no reason at all for the person who said yes.
   */
  hintFor?: (a: Answers) => string;
  kind: NodeKind;
  tier: NodeTier;
  /**
   * How the options are laid out, where the default is wrong for this node.
   *
   * Only 'grid', and only the block-length question wants it. Nine numbers are
   * chosen by comparing them, so they have to be on screen together; as
   * full-width rows the card was taller than the phone. Declared on the node
   * rather than inferred from the option count, because "a lot of options"
   * means a grid for numbers and does not mean one for sentences.
   */
  layout?: 'grid';
  options?: TreeOption[];
  /**
   * A node that collects SEVERAL numbers on one screen, e.g. the three best
   * lifts. It is still one node on the diagram, because it is one stop on the
   * journey, but its answers live under these keys rather than under the node
   * id. Answered means any one of them has a value: somebody who knows their
   * squat and not their bench should not be held up.
   */
  subFields?: { key: string; label: string }[];
  /**
   * Can be passed without an answer. The screen still draws it; the footer just
   * offers a way past. Only the two questions where "none" is a real answer.
   */
  optional?: boolean;
  /** What the way past is called. "Skip" says nothing about what skipping means. */
  skipLabel?: string;
  /**
   * Undefined means the trunk: everybody is asked this.
   *
   * Set means the node hangs off a fork. `from` is the node whose answer created
   * the fork, `when` decides whether this journey takes it, and `label` is the
   * sentence drawn on the branch line so the person can see WHY they are being
   * asked something the last person was not.
   */
  branch?: {
    from: string;
    when: (a: Answers) => boolean;
    label: string;
  };
}

// ─── Helpers used by the branch conditions ──────────────────────────────────

/**
 * They train with hand weights and have no full gym behind them.
 *
 * A full gym has a rack running to whatever anybody can lift, so there is no
 * ceiling worth asking about and the question would be noise. Bands and
 * bodyweight have no number either.
 */
export function hasKitButNoGym(a: Answers): boolean {
  const kit = Array.isArray(a.equipment) ? (a.equipment as string[]) : [];
  return (kit.includes('dumbbells') || kit.includes('kettlebells')) && !kit.includes('fullgym');
}

/** They explicitly declined. An unanswered question is not the same as a no. */
const saidNo = (a: Answers, id: string) => a[id] === 'no';

const focusIs = (a: Answers, ...want: ProgrammeFocus[]) =>
  want.includes(a.focus as ProgrammeFocus);

const saidYes = (a: Answers, id: string) => a[id] === 'yes';

// ─── The tree ───────────────────────────────────────────────────────────────

/**
 * Every question, in the order the spine runs.
 *
 * Order matters three times over. It is the order they are asked; it is the
 * order they are DRAWN, so a branch node must come after the node it forks from
 * or the diagram would draw a line running back up the page; and the two tiers
 * have to be CONTIGUOUS. The block-length question is "what you want" and was
 * written at the end of the list, which made the spine read shape, tune, shape
 * and drew the "what you want" heading twice, the second time below "about you".
 * Found by photographing it, not by reading it.
 *
 * The rule applied to every entry: a question earns its place only if a
 * different answer produces a visibly different programme. Sleep, diet, stress,
 * gym opening hours and full injury history all fail that test. They make a
 * builder feel thorough while making it slower to reach a first session, which
 * is the fortnight that decides whether anybody stays.
 */
export const PROFILE_TREE: TreeNode[] = [
  // ── SHAPE: what they want, which chooses the programme ───────────────────
  {
    id: 'look',
    question: 'Choose your look',
    kind: 'single',
    tier: 'shape',
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'system', label: 'Match my phone' },
    ],
  },
  {
    /**
     * The choice, and nothing else.
     *
     * It used to explain where each unit is "usually used", which is a geography
     * lesson nobody asked for on a two-option question. The one piece of context
     * worth keeping is that it is not a decision they are stuck with.
     */
    id: 'units',
    question: 'Kilos or pounds?',
    hint: 'You can change it anytime in settings.',
    kind: 'single',
    tier: 'shape',
    options: [
      { value: 'kg', label: 'Kilograms (kg)' },
      { value: 'lbs', label: 'Pounds (lbs)' },
    ],
  },
  {
    id: 'name',
    question: 'What should we call you?',
    kind: 'text',
    tier: 'shape',
  },
  {
    /**
     * THE CHOICE THE APP NEVER GAVE ANYBODY.
     *
     * Everybody who finished the builder was enrolled in a programme. It was
     * true that they could pause it or ignore it - an off-plan session leaves
     * the block exactly where it was, and always has - but being handed
     * something and told you may put it down is not the same as being asked.
     * Somebody who wanted to poke around, do a custom session and see what was
     * in here got a twelve session block and a counter measuring how much of it
     * they had not done.
     *
     * ASKED BEFORE the four questions that exist only to shape a programme, so
     * answering "let me explore" skips all four rather than collecting answers
     * for a thing nobody is building.
     *
     * EVERYTHING IN THE SECOND TIER IS STILL ASKED EITHER WAY. Experience, the
     * movement screen, injuries and equipment decide what somebody is
     * PRESCRIBED, and a person choosing their own sessions needs those to be
     * right exactly as much as somebody on a block does. Arguably more: nobody
     * is checking their week for them.
     */
    id: 'guided',
    question: 'Want a programme built for you?',
    hint: 'Either way you can train whatever you like, whenever you like. You can start a programme later, or leave one, without losing anything.',
    kind: 'single',
    tier: 'shape',
    options: [
      {
        value: 'yes',
        label: 'Yes, build me one',
        hint: 'A few more questions, then every session is chosen for you',
      },
      {
        value: 'no',
        label: 'No, let me explore',
        hint: 'Pick your own sessions, and start a programme whenever you want one',
      },
    ],
  },
  {
    /**
     * The fork the whole app has been missing.
     *
     * Six answers, and each one selects a different programme template rather
     * than a different flavour of the same three lifts. It also decides three of
     * the four branches below, which is why it is asked this early: everything
     * after it can be shaped by it.
     */
    id: 'focus',
    question: 'What should your training be built around?',
    hint: 'This picks your programme. You can change it whenever you like.',
    kind: 'single',
    tier: 'shape',
    branch: {
      from: 'guided',
      when: (a) => !saidNo(a, 'guided'),
      label: 'Because you want a programme',
    },
    options: [
      {
        value: 'barbell',
        label: 'The big three lifts',
        hint: 'Squat, bench and deadlift, tested and progressed',
      },
      {
        value: 'strength',
        label: 'General strength',
        hint: 'Get stronger with whatever kit you have',
      },
      { value: 'muscle', label: 'Building muscle', hint: 'More volume, more accessory work' },
      {
        value: 'comeback',
        label: 'Coming back from an injury',
        hint: 'Rehab first, load added back gradually',
      },
      { value: 'fitness', label: 'Fitness and conditioning', hint: 'Cardio led, strength kept up' },
      { value: 'joints', label: 'Joint health and mobility', hint: 'Prehab and flexibility as the main work' },
    ],
  },
  {
    id: 'days',
    question: 'How many days a week can you train?',
    hint: 'Be honest rather than hopeful. The programme is built to fit.',
    kind: 'single',
    tier: 'shape',
    branch: {
      from: 'guided',
      when: (a) => !saidNo(a, 'guided'),
      label: 'Because you want a programme',
    },

    options: [
      { value: '2', label: '2 days', hint: 'Full body each time' },
      { value: '3', label: '3 days' },
      { value: '4', label: '4 days' },
      { value: '5', label: '5 or more' },
    ],
  },
  {
    id: 'minutes',
    question: 'How long have you usually got?',
    kind: 'single',
    tier: 'shape',
    branch: {
      from: 'guided',
      when: (a) => !saidNo(a, 'guided'),
      label: 'Because you want a programme',
    },

    options: [
      { value: '30', label: '30 minutes' },
      { value: '45', label: '45 minutes' },
      { value: '60', label: 'An hour or more' },
    ],
  },

  {
    /**
     * Sessions, not weeks. See SessionCount for why.
     *
     * Nine options, which is one past the eight that make the screen switch from
     * full-width rows to chips. That is deliberate: nine numbers read as a scale
     * when they sit side by side and as a wall when they are stacked.
     */
    id: 'length',
    branch: {
      from: 'guided',
      when: (a) => !saidNo(a, 'guided'),
      label: 'Because you want a programme',
    },
    question: 'How many sessions should your first block be?',
    hint: 'Counted in sessions, not weeks, so it only moves when you train. It finishes with a review of everything that changed.',
    kind: 'single',
    tier: 'shape',
    layout: 'grid',
    options: SESSION_COUNTS.map((n) => ({
      value: String(n),
      label: String(n),
      // Three captions, on the three that need one. A caption on all nine would
      // be nine sentences saying the same thing in ascending order.
      hint: n === 4 ? 'Try it out' : n === 12 ? 'Usual' : n === 20 ? 'Long build' : undefined,
    })),
  },

  // ── TUNE: what the engine needs to set loads and pick exercises ──────────
  {
    id: 'experience',
    question: 'How long have you been training?',
    kind: 'single',
    tier: 'tune',
    options: [
      { value: 'beginner', label: 'Just getting started', hint: 'New to structured training' },
      { value: 'intermediate', label: '1 to 3 years', hint: 'Comfortable with the basics' },
      { value: 'advanced', label: '3 years or more', hint: 'I know my numbers' },
    ],
  },
  {
    /**
     * PHASE 1 OF THE SCREENING MATRIX, from PROGRESSION-LADDERS.md.
     *
     * The weakest link in the level system, and this is the fix for it. Every
     * movement ceiling in the app comes from the one answer above this: how
     * long somebody says they have been training. One number, applied to six
     * different patterns. Somebody who has squatted for five years and never
     * hung from a bar gets the same pull ceiling as their squat ceiling.
     *
     * Six benchmarks, one per pattern, all zero-load and all doable in a
     * kitchen. Each one is the gate between Level 1 and Level 2 of its ladder,
     * so an unticked pattern is built from foundations however experienced the
     * person is - which is exactly what a physiotherapist would do, and exactly
     * what the app has never been able to do.
     *
     * THE PAIN GATE IS FOLDED INTO THE TICK. The matrix asks separately whether
     * a movement produces sharp pain, and routes a yes to Level 1. Since not
     * being able to do it and it hurting when you try lead to the same answer,
     * one box does both jobs, and the hint says so.
     *
     * OPTIONAL, AND THAT IS LOAD-BEARING. Skipping means no screen was taken,
     * which leaves the app doing exactly what it does today. Only an answer
     * given caps anything. Somebody who genuinely passes none of them has
     * "None of these yet" to say so, which is a different statement from
     * saying nothing.
     */
    id: 'screen',
    question: 'Which of these can you do right now?',
    hint: 'Tick what you could do today without it hurting. No kit needed, and nothing here is a test. Skip it if you would rather just start.',
    kind: 'multi',
    tier: 'tune',
    optional: true,
    skipLabel: 'Skip this',
    options: [
      /**
       * PLAIN ENGLISH, AND THE JARGON IS GONE.
       *
       * The first version of this asked about "strict scapular pull-ups or
       * pulldowns", "a slow split squat" and squatting "to parallel". Reviewed
       * from outside, the verdict was that it reads as niche technical
       * terminology and causes exactly the friction that makes people drop out
       * of an onboarding flow - and the pull one was worse than jargon, because
       * it named two exercises needing different equipment, so somebody at home
       * literally could not test it. Leaving it unticked then clamped every
       * pulling movement they would ever be given to the easiest rung.
       *
       * So each option is now something a person can picture doing in their
       * kitchen, described the way they would describe it themselves. The
       * benchmark - the number that decides whether it passes - stays on the
       * hint line, because "squat down and stand back up" without "ten times"
       * is a question somebody ticks having done one.
       *
       * WHAT IT MEASURES HAS NOT CHANGED. These are still the six patterns and
       * still the gate between Level 1 and Level 2 of each ladder. Only the
       * words a person reads are different.
       */
      { value: 'hinge', label: 'Touch your shins without rounding your back', hint: '10 times, back staying flat' },
      { value: 'squat', label: 'Squat down and stand back up', hint: '10 times, heels staying down' },
      { value: 'push', label: 'Hold a plank', hint: '30 seconds, hips level' },
      { value: 'pull', label: 'Hang from a bar, or pull a band down to your chest', hint: '5 times, either one counts' },
      { value: 'lunge', label: 'Step one foot back and lower your knee', hint: '5 times each side, without wobbling' },
      { value: 'carry', label: 'Carry a heavy shopping bag in one hand', hint: '30 seconds without leaning' },
      {
        value: 'none',
        label: 'None of these yet',
        hint: 'Everything starts from foundations',
      },
    ],
  },
  {
    /**
     * Not currently asked anywhere, and it is the first line of every
     * assessment form a physiotherapist has ever filled in.
     *
     * WHAT IT ACTUALLY DOES, which is one thing and used to be none. Past fifty
     * a 45 minute session keeps all three mobility drills instead of dropping
     * to two - see prepCountFor in lib/workout-engine.ts.
     *
     * This comment used to claim it changed warm-up length, how fast load
     * climbs and which safety rules apply. None of the three was true: the
     * answer was collected, stored, synced to the server and read by nothing.
     * The other two are real ideas and they are clinical decisions, so they are
     * Archie's to make rather than mine to assume.
     */
    id: 'age',
    question: 'How old are you?',
    kind: 'number',
    tier: 'tune',
  },

  {
    id: 'sex',
    question: 'Your biological sex',
    hint: 'Used for the starting weight estimate, nothing else.',
    kind: 'single',
    tier: 'tune',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Prefer not to say' },
    ],
  },
  {
    /**
     * OPTIONAL, and it has to stay optional.
     *
     * Skipping falls back to ASSUMED_BODYWEIGHT_KG internally, because a first
     * session has to start somewhere. That number is never read back at the
     * user: the people most likely to leave this blank are the ones least likely
     * to want a guess about their weight quoted at them, and they are exactly
     * the people the guess is furthest out for. It is not in the placeholder
     * either, for the same reason in a quieter voice.
     */
    id: 'bodyweight',
    question: 'Your current bodyweight',
    hint: 'It sets your opening weights. Leave it blank if you would rather not, and we will tune your weights from how your first few sessions go.',
    kind: 'number',
    tier: 'tune',
    optional: true,
    skipLabel: 'Rather not say',
  },
  {
    /**
     * The hint answers the question people actually stall on here.
     *
     * "Pick everything you can get to" invited somebody to think about the worst
     * day rather than the usual one, because nothing on the screen said what
     * happens when the usual one does not turn up. It does not lock anything in:
     * the readiness screen asks again before every session and the whole session
     * is built from that answer. Saying so is the difference between an honest
     * answer here and a hedged one.
     */
    id: 'equipment',
    question: 'What have you got to train with?',
    hint: 'Pick what you usually have. You are asked again before every session, so a day without the gym just builds a different one.',
    kind: 'multi',
    tier: 'tune',
    options: [
      { value: 'bodyweight', label: 'No equipment' },
      { value: 'bands', label: 'Resistance bands' },
      { value: 'dumbbells', label: 'Dumbbells' },
      { value: 'kettlebells', label: 'Kettlebells' },
      { value: 'fullgym', label: 'Full gym' },
    ],
  },
  {
    /**
     * ONLY ASKED OF PEOPLE WITH A LIMIT, which is what makes it worth asking.
     *
     * "Dumbbells" is a yes or a no today, so a person with two five kilo
     * dumbbells and a person with a full rack get the same prescription, and one
     * of them is being told to lift a weight they do not own. Somebody with a
     * full gym has no ceiling worth naming and is not asked.
     */
    id: 'kit',
    question: 'What is the heaviest you can pick up?',
    hint: 'The biggest dumbbell or kettlebell you can get your hands on. Nothing is ever prescribed heavier than this.',
    kind: 'number',
    tier: 'tune',
    optional: true,
    skipLabel: 'Not sure',
    branch: {
      from: 'equipment',
      when: (a) => hasKitButNoGym(a),
      label: 'Because you train with dumbbells or kettlebells',
    },
  },
  {
    /**
     * THE QUESTION THAT MAKES GROW GROW.
     *
     * Pain is asked before every single session, which is right for the day to
     * day. But a shoulder that has hurt for six months is a standing fact about
     * a person, and today it is re-learned every session and forgotten every
     * session. Nothing about it ever reaches the programme.
     */
    id: 'sore',
    question: 'Is anything sore or injured right now?',
    kind: 'single',
    tier: 'tune',
    options: [
      { value: 'yes', label: 'Yes, something is bothering me' },
      { value: 'no', label: 'No, nothing at the moment' },
    ],
  },
  {
    id: 'soreArea',
    question: 'Where is it?',
    hint: 'You can add more areas later, and change this any time.',
    kind: 'multi',
    tier: 'tune',
    branch: {
      from: 'sore',
      when: (a) => saidYes(a, 'sore'),
      label: 'Because something is sore',
    },
    // Options come from the body diagram at runtime rather than being listed
    // twice. See regionOptionsFor below.
  },
  {
    id: 'soreAge',
    question: 'How long has it been like that?',
    kind: 'single',
    tier: 'tune',
    branch: {
      from: 'sore',
      when: (a) => saidYes(a, 'sore'),
      label: 'Because something is sore',
    },
    options: [
      { value: 'days', label: 'A few days', hint: 'Recent, so we start very gently' },
      { value: 'weeks', label: 'A few weeks' },
      { value: 'months', label: 'Months' },
      { value: 'years', label: 'A year or more', hint: 'Long standing, so we work around it' },
    ],
  },
  {
    /**
     * THE QUESTION A PHYSIOTHERAPIST ALWAYS ASKS, and the app never did.
     *
     * Not the same question as "is anything sore right now". A shoulder that
     * does not hurt today because it has been avoided for six months answers no
     * to that one and yes to this one, and it is the second answer that should
     * change what somebody is handed.
     *
     * Asked of everybody, on the trunk, because it is not conditional on
     * anything they have already said. "Nothing" is an explicit option rather
     * than an empty answer, so the difference between a considered no and a
     * question nobody engaged with survives.
     */
    id: 'avoid',
    question: 'Has a clinician told you to avoid loading anything?',
    hint: 'A physio, a doctor or a surgeon. Anything named here is worked around in every session, whether it hurts today or not.',
    kind: 'multi',
    tier: 'tune',
    // Region options come from the body diagram at runtime, plus "nothing".
    // See regionOptionsFor and optionsFor in components/ProfileTree.tsx.
  },
  {
    id: 'testWeeks',
    question: 'Test your strength every few weeks?',
    hint: 'A session that finds your new max, so the weights stay honest.',
    kind: 'single',
    tier: 'tune',
    branch: {
      from: 'focus',
      when: (a) => focusIs(a, 'barbell'),
      label: 'Because you train the barbell lifts',
    },
    options: [
      { value: '12', label: 'Every 12 sessions', hint: 'The usual choice' },
      { value: '18', label: 'Every 18 sessions' },
      { value: 'never', label: 'No thanks' },
    ],
  },
  {
    /**
     * Only asked of people whose programme is actually built on the barbell.
     *
     * Typing a squat one rep max is a miserable question for somebody who came
     * to the app because their knee hurts, and today every single person is
     * asked it. A beginner is skipped too: they do not have the numbers, and
     * the engine estimates better from bodyweight than they guess.
     *
     * ASKED AFTER THE TEST-WEEK QUESTION, and that order is load-bearing. The
     * larger decision comes first because it changes what the smaller one is
     * for, and hintFor above reads the answer to it. A step that says only
     * "optional" gives somebody who has just declined strength tests no reason
     * to answer, and promising a re-test to that same person is the same wrong
     * answer pointing the other way.
     */
    id: 'lifts',
    question: 'Your best lifts',
    hint: 'Rough is fine. The app corrects itself within two sessions.',
    hintFor: (a) =>
      a.testWeeks === 'never'
        ? 'These set your starting weights. Rough is fine, and the app corrects itself within two sessions.'
        : 'These set your starting weights. Rough is fine, and your first strength test will re-measure them.',
    kind: 'number',
    tier: 'tune',
    optional: true,
    skipLabel: 'I do not know these',
    subFields: [
      { key: 'liftsSquat', label: 'Squat' },
      { key: 'liftsBench', label: 'Bench press' },
      { key: 'liftsDeadlift', label: 'Deadlift' },
    ],
    branch: {
      from: 'focus',
      /**
       * ASKED OF EXPLORERS TOO, and that is not an afterthought.
       *
       * These three numbers set every working weight in the app. Somebody who
       * declined a programme is choosing which session to do, not asking to be
       * given lighter ones - and without this branch they were never asked,
       * because it hangs off a focus question they never saw. Their opening
       * weights would have come from a bodyweight estimate alone while the
       * person next to them, who ticked "build me a programme", got theirs from
       * what they actually lift.
       *
       * Still not asked of a beginner, either way: somebody new to structured
       * training has no honest number to give, and the app calibrates from their
       * first two sessions instead.
       */
      when: (a) =>
        (focusIs(a, 'barbell', 'strength') || saidNo(a, 'guided')) && a.experience !== 'beginner',
      label: 'Because you lift with a barbell',
    },
  },
];

// ─── Walking the tree ───────────────────────────────────────────────────────

/** Whether this journey is asked this node at all. */
export function nodeApplies(node: TreeNode, answers: Answers): boolean {
  if (!node.branch) return true;
  return node.branch.when(answers);
}

/**
 * The nodes THIS person is asked, in order.
 *
 * Recomputed from the answers every time rather than stored. A stored path and a
 * stored set of answers can disagree; a derived one cannot. It is also what lets
 * somebody go back and change their mind: answer the fork differently and the
 * branch below it simply stops applying.
 */
export function visibleNodes(answers: Answers): TreeNode[] {
  return PROFILE_TREE.filter((n) => nodeApplies(n, answers));
}

/** True once this node has something in it. Empty multi-selects do not count. */
export function isAnswered(node: TreeNode, answers: Answers): boolean {
  if (node.subFields) {
    return node.subFields.some((f) => {
      const raw = answers[f.key];
      if (raw === undefined || raw === null) return false;
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return Number.isFinite(n) && n > 0;
    });
  }
  const v = answers[node.id];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return true;
}

/**
 * The question to put in front of them now, or null when the tree is finished.
 *
 * The first UNANSWERED visible node, not "the one after the last answered one".
 * Those differ the moment somebody goes back and changes a fork: answering
 * "no longer sore" removes two nodes from the middle of the path, and an index
 * would then point at the wrong question or past the end.
 */
export function nextNode(answers: Answers): TreeNode | null {
  for (const n of visibleNodes(answers)) {
    if (n.optional) continue;
    if (!isAnswered(n, answers)) return n;
  }
  // Optional nodes are asked, just never blocking. They come last so that
  // skipping one cannot strand somebody before a required question.
  for (const n of visibleNodes(answers)) {
    if (!n.optional) continue;
    if (!isAnswered(n, answers) && answers[`${n.id}__skipped`] !== true) return n;
  }
  return null;
}

/** Nothing required is outstanding. */
export function isComplete(answers: Answers): boolean {
  return visibleNodes(answers).every((n) => n.optional || isAnswered(n, answers));
}

/**
 * How far down the spine they are.
 *
 * `total` is the length of the path THIS journey takes, not the size of the
 * tree, so somebody who said nothing is sore is never shown a progress figure
 * counting two questions they will not be asked.
 */
export function treeProgress(answers: Answers): { answered: number; total: number } {
  const visible = visibleNodes(answers);
  return {
    answered: visible.filter((n) => isAnswered(n, answers)).length,
    total: visible.length,
  };
}

/**
 * Where the spine forks, for drawing.
 *
 * Returns each node that is the first of a branch, with the label to write on
 * the line. Consecutive nodes from the same fork are one branch, not two, so the
 * "where is it" and "how long" pair draws as a single limb with two questions on
 * it rather than as two separate splits.
 */
export function forks(answers: Answers): { at: string; label: string; nodeIds: string[] }[] {
  const out: { at: string; label: string; nodeIds: string[] }[] = [];
  for (const n of visibleNodes(answers)) {
    if (!n.branch) continue;
    const last = out[out.length - 1];
    if (last && last.at === n.branch.from && last.label === n.branch.label) {
      last.nodeIds.push(n.id);
      continue;
    }
    out.push({ at: n.branch.from, label: n.branch.label, nodeIds: [n.id] });
  }
  return out;
}

/**
 * Every journey the tree can produce, as answer sets.
 *
 * Exists for the contract test, which needs to prove that no combination of
 * answers strands somebody or asks them something irrelevant. Enumerating the
 * branch conditions by hand in the test would be a second copy of the tree.
 */
export function everyJourney(): Answers[] {
  const focuses: ProgrammeFocus[] = [
    'barbell',
    'strength',
    'muscle',
    'comeback',
    'fitness',
    'joints',
  ];
  const experiences: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
  const out: Answers[] = [];
  for (const focus of focuses) {
    for (const experience of experiences) {
      for (const sore of ['yes', 'no']) {
        out.push({ focus, experience, sore });
      }
    }
  }
  return out;
}

// ─── Turning answers into the things the app already understands ────────────

/**
 * The region options for the "where is it" node.
 *
 * Passed in rather than listed here, because the body diagram in
 * app/(tabs)/recover.tsx already owns the list of areas the app can adapt
 * around, and a second copy of it here is a drift waiting to happen. The
 * paywall's pain-zone count is read off the same list for the same reason.
 */
/**
 * The nodes whose options are the body's regions, filled in at render time.
 *
 * Named here rather than in the screen, because three separate places need to
 * agree about it: the screen that draws them, the check that every choice node
 * has something to tap, and anybody reading the tree and wondering why two of
 * its nodes have no options listed.
 *
 * They are drawn from lib/exercise-db rather than written out here so the
 * question and the body diagram can never offer different lists.
 */
export const REGION_OPTION_NODES = ['soreArea', 'avoid'] as const;

export function regionOptionsFor(regions: readonly { value: PainRegion; label: string }[]): TreeOption[] {
  return regions.map((r) => ({ value: r.value, label: r.label }));
}

/** What a finished tree says, in the types the rest of the app already uses. */
export interface TreeOutcome {
  name: string;
  /**
   * Whether they asked for a programme at all.
   *
   * False means "let me explore": no block is started, and the four questions
   * that only shape a block were never asked, so `focus`, `days`, `minutes` and
   * `sessions` below hold defaults rather than answers. They are still filled in
   * because the rest of the app reads them for other things - session length
   * seeds the readiness screen, and the focus decides the rep ranges - but
   * nothing should read them as a statement about a programme.
   */
  guided: boolean;
  focus: ProgrammeFocus;
  days: TrainingDays;
  minutes: SessionLength;
  /** How many sessions the first block runs for. */
  sessions: SessionCount;
  experience: ExperienceLevel;
  ageYears: number;
  sex: Sex;
  bodyweightKg: number;
  equipmentTiers: EquipmentTier[];
  /** Empty when nothing is sore. */
  soreRegions: PainRegion[];
  soreFor: InjuryAge | null;
  testWeekFrequency: TestWeekFrequency;
  oneRepMaxes: { squat: number | null; bench: number | null; deadlift: number | null };
  /**
   * The movement patterns whose zero-load benchmark they can do.
   *
   * NULL WHEN THE SCREEN WAS NOT TAKEN, which is a different thing from an
   * empty list. Null leaves every ceiling exactly where the experience answer
   * put it, which is the app as it is today; an empty list is somebody saying
   * "none of these yet" and means every pattern starts at foundations.
   */
  screenPassed: LadderPattern[] | null;
  /** Areas a clinician has told them to stay off. Empty when there are none. */
  avoidRegions: PainRegion[];
  /**
   * The heaviest hand weight they can reach, in kg. Zero when they have a full
   * gym, or did not say.
   */
  maxKitKg: number;
}

const num = (v: AnswerValue, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Answers to an outcome, with a defensible default for everything.
 *
 * Every fallback here is the app's CURRENT behaviour, so a half-finished or
 * corrupted answer set produces the app as it is today rather than something
 * nobody designed. testWeekFrequency defaulting to 12 matters most: it is what
 * the builder does now for anyone who does not touch it.
 */
export function outcomeFrom(answers: Answers): TreeOutcome {
  /**
   * EVERY WEIGHT TYPED INTO THE TREE IS IN THE UNIT THEY PICKED, and the tree
   * stores kilograms.
   *
   * The unit question is the second one asked, precisely so the bodyweight
   * question can be validated against a plausible range - see the docblock in
   * lib/bodyweight.ts, which records the last time these two halves disagreed.
   * The validation was converting and the storage was not, so a person who
   * picked pounds and typed 176 passed the check and had 176 KILOGRAMS written
   * to their profile. Bodyweight scales every accessory load the app
   * prescribes, so that is not a cosmetic profile error.
   *
   * One conversion, here, where every typed number passes through.
   */
  const unit: WeightUnit = answers.units === 'lbs' ? 'lbs' : 'kg';
  const kg = (v: AnswerValue, fallback: number): number =>
    displayUnitToKg(num(v, fallback), unit);

  const soreRegions = Array.isArray(answers.soreArea)
    ? (answers.soreArea as PainRegion[])
    : [];
  /**
   * NOT ASKED MEANS NOT WANTED, rather than "every 12 sessions by default".
   *
   * The question is only put to people whose programme is built on the barbell
   * lifts. Everybody else used to be defaulted to 12, so that isTestWeekDue
   * could never read undefined - which is safe and is also how somebody who
   * came to the app for their knee ended up being told it was Test Week and
   * offered a one-rep max squat. Reported from use.
   *
   * The answer stands where it was given. Where it was not, "never" is the
   * honest reading of a question nobody was asked.
   */
  const askedAboutTests = answers.focus === 'barbell';
  const rawTest = String(answers.testWeeks ?? (askedAboutTests ? '12' : 'never'));
  const testWeekFrequency: TestWeekFrequency =
    rawTest === 'never' ? 'never' : rawTest === '18' ? 18 : 12;

  return {
    name: String(answers.name ?? '').trim(),
    // An unanswered question is not a no. Everybody who came through the
    // builder before this question existed, and anybody whose draft predates it,
    // gets the programme they have always been given.
    guided: answers.guided !== 'no',
    focus: (answers.focus as ProgrammeFocus) ?? 'strength',
    days: (num(answers.days, 3) as TrainingDays) ?? 3,
    minutes: (num(answers.minutes, 45) as SessionLength) ?? 45,
    /**
     * Snapped to an offered count rather than trusted.
     *
     * An answer that is not one of the nine can only come from a corrupted
     * draft or an older build, and a block length of 13 would quietly produce a
     * plan nobody designed. Twelve is the default for the same reason it is
     * labelled the usual choice.
     */
    sessions: SESSION_COUNTS.includes(num(answers.length, 12) as SessionCount)
      ? (num(answers.length, 12) as SessionCount)
      : 12,
    experience: (answers.experience as ExperienceLevel) ?? 'beginner',
    ageYears: num(answers.age, 0),
    sex: (answers.sex as Sex) ?? 'other',
    bodyweightKg: kg(answers.bodyweight, 0),
    equipmentTiers: Array.isArray(answers.equipment)
      ? (answers.equipment as EquipmentTier[])
      : [],
    soreRegions: answers.sore === 'yes' ? soreRegions : [],
    soreFor: answers.sore === 'yes' ? ((answers.soreAge as InjuryAge) ?? null) : null,
    testWeekFrequency,
    /**
     * "none" is an ANSWER, and the empty list it produces is not the same as no
     * answer at all. Somebody who ticked nothing at all skipped the screen and
     * is treated exactly as they are today; somebody who ticked "none of these
     * yet" has told us something, and every pattern starts from foundations.
     */
    /**
     * AND A SKIPPED SCREEN IS NOT AN EMPTY ONE, which is the distinction the
     * whole question rests on and which the skip button quietly broke.
     *
     * The skip handler clears the node's answer, and clearing a multi-select
     * means writing an empty array. That is the value meaning "I took the
     * screen and passed nothing", which caps EVERY pattern at foundations - so
     * tapping "Not sure" gave an advanced lifter the most restrictive answer in
     * the question rather than no answer at all. Measured: an advanced profile
     * that skipped came out with a pull ceiling of 1.
     *
     * The skip already leaves a marker behind. Reading it here is what turns
     * "I would rather not say" back into silence.
     */
    screenPassed:
      Array.isArray(answers.screen) && answers.screen__skipped !== true
        ? (answers.screen as string[]).filter((v): v is LadderPattern =>
            LADDER_PATTERNS.includes(v as LadderPattern)
          )
        : null,
    avoidRegions: Array.isArray(answers.avoid)
      ? (answers.avoid as string[]).filter((v): v is PainRegion => v !== 'none')
      : [],
    maxKitKg: Math.max(0, kg(answers.kit, 0)),
    oneRepMaxes: {
      // Same conversion, and the same bug: these three go straight into
      // oneRepMaxes, which every working weight is derived from.
      squat: answers.liftsSquat != null ? kg(answers.liftsSquat, 0) || null : null,
      bench: answers.liftsBench != null ? kg(answers.liftsBench, 0) || null : null,
      deadlift: answers.liftsDeadlift != null ? kg(answers.liftsDeadlift, 0) || null : null,
    },
  };
}
