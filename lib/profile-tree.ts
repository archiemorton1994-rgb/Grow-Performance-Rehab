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
import type { EquipmentTier, ExperienceLevel, PainRegion, Sex, TestWeekFrequency } from './store';

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

/** How long the first block runs. */
export type BlockLength = 8 | 12 | 16;

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
  kind: NodeKind;
  tier: NodeTier;
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

const focusIs = (a: Answers, ...want: ProgrammeFocus[]) =>
  want.includes(a.focus as ProgrammeFocus);

const saidYes = (a: Answers, id: string) => a[id] === 'yes';

// ─── The tree ───────────────────────────────────────────────────────────────

/**
 * Every question, in the order the spine runs.
 *
 * Order matters twice over: it is the order they are asked, and it is the order
 * they are DRAWN, so a branch node must come after the node it forks from or the
 * diagram would draw a line going back up the page.
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
    id: 'units',
    question: 'Kilos or pounds?',
    kind: 'single',
    tier: 'shape',
    options: [
      { value: 'kg', label: 'Kilograms' },
      { value: 'lbs', label: 'Pounds' },
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
    options: [
      { value: '30', label: '30 minutes' },
      { value: '45', label: '45 minutes' },
      { value: '60', label: 'An hour or more' },
    ],
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
     * Not currently asked anywhere, and it is the first line of every
     * assessment form a physiotherapist has ever filled in. Changes warm-up
     * length, how fast load climbs, and which safety rules apply.
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
    id: 'bodyweight',
    question: 'Your current bodyweight',
    kind: 'number',
    tier: 'tune',
  },
  {
    id: 'equipment',
    question: 'What have you got to train with?',
    hint: 'Pick everything you can get to.',
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
     * Only asked of people whose programme is actually built on the barbell.
     *
     * Typing a squat one rep max is a miserable question for somebody who came
     * to the app because their knee hurts, and today every single person is
     * asked it. A beginner is skipped too: they do not have the numbers, and
     * the engine estimates better from bodyweight than they guess.
     */
    id: 'lifts',
    question: 'Your best lifts',
    hint: 'Rough is fine. The app corrects itself within two sessions.',
    kind: 'number',
    tier: 'tune',
    optional: true,
    subFields: [
      { key: 'liftsSquat', label: 'Squat' },
      { key: 'liftsBench', label: 'Bench press' },
      { key: 'liftsDeadlift', label: 'Deadlift' },
    ],
    branch: {
      from: 'focus',
      when: (a) => focusIs(a, 'barbell', 'strength') && a.experience !== 'beginner',
      label: 'Because you train the barbell lifts',
    },
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
    id: 'length',
    question: 'How long should your first block be?',
    hint: 'It finishes with a review of everything that changed.',
    kind: 'single',
    tier: 'shape',
    options: [
      { value: '8', label: '8 weeks', hint: 'Short, if you have a date in mind' },
      { value: '12', label: '12 weeks', hint: 'The usual choice' },
      { value: '16', label: '16 weeks', hint: 'Slower, good after an injury' },
    ],
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
export function regionOptionsFor(regions: readonly { value: PainRegion; label: string }[]): TreeOption[] {
  return regions.map((r) => ({ value: r.value, label: r.label }));
}

/** What a finished tree says, in the types the rest of the app already uses. */
export interface TreeOutcome {
  name: string;
  focus: ProgrammeFocus;
  days: TrainingDays;
  minutes: SessionLength;
  blockWeeks: BlockLength;
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
  const soreRegions = Array.isArray(answers.soreArea)
    ? (answers.soreArea as PainRegion[])
    : [];
  const rawTest = String(answers.testWeeks ?? '12');
  const testWeekFrequency: TestWeekFrequency =
    rawTest === 'never' ? 'never' : rawTest === '18' ? 18 : 12;

  return {
    name: String(answers.name ?? '').trim(),
    focus: (answers.focus as ProgrammeFocus) ?? 'strength',
    days: (num(answers.days, 3) as TrainingDays) ?? 3,
    minutes: (num(answers.minutes, 45) as SessionLength) ?? 45,
    blockWeeks: (num(answers.length, 12) as BlockLength) ?? 12,
    experience: (answers.experience as ExperienceLevel) ?? 'beginner',
    ageYears: num(answers.age, 0),
    sex: (answers.sex as Sex) ?? 'other',
    bodyweightKg: num(answers.bodyweight, 0),
    equipmentTiers: Array.isArray(answers.equipment)
      ? (answers.equipment as EquipmentTier[])
      : [],
    soreRegions: answers.sore === 'yes' ? soreRegions : [],
    soreFor: answers.sore === 'yes' ? ((answers.soreAge as InjuryAge) ?? null) : null,
    testWeekFrequency,
    oneRepMaxes: {
      squat: answers.liftsSquat != null ? num(answers.liftsSquat, 0) || null : null,
      bench: answers.liftsBench != null ? num(answers.liftsBench, 0) || null : null,
      deadlift: answers.liftsDeadlift != null ? num(answers.liftsDeadlift, 0) || null : null,
    },
  };
}
