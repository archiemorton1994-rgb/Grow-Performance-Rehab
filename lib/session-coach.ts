/**
 * What the assistant has to say about the set you are actually on.
 *
 * WHY IT IS NOT THE OTHER ASSISTANT. lib/coach.ts looks across weeks: streaks,
 * personal bests, muscles you have been avoiding, whether you are due a test.
 * All of it is true and none of it helps somebody standing at a rack who is not
 * sure whether to put the suggested weight on the bar. Mid-session the useful
 * scope is this exercise, this set, and the two or three things about logging
 * that nobody reads in a tutorial and everybody wonders about once.
 *
 * SO IT ANSWERS QUESTIONS RATHER THAN REPORTING FACTS. Every entry below is
 * phrased as the thing a person actually wonders at that moment. The one that
 * matters most is the weight: a pre-filled box reads as an instruction, people
 * either lift a number that is wrong for them or type a number they did not
 * lift, and the second one quietly teaches the engine the wrong thing.
 *
 * ORDER IS BY WHAT IS TRUE RIGHT NOW, not by importance in the abstract. The
 * pain instruction outranks everything when there is pain; otherwise the tip
 * about the exercise in front of you comes first.
 */
import type { WeightUnit } from './store';

export interface SessionCoachContext {
  exerciseName: string;
  /** The exercise's block: 'prep', 'main', 'accessory' and so on. */
  category: string;
  /** 1-based, the set about to be done. */
  setNumber: number;
  totalSets: number;
  /** The weight the app is suggesting, in kilograms. Zero when it has none. */
  suggestedKg: number;
  /** What is in the weight box now, in kilograms. */
  typedKg: number;
  weightUnit: WeightUnit;
  /** True when the set carries no external load, so weight talk does not apply. */
  isBandOrBodyweight: boolean;
  /** Set when the user reported pain today, e.g. "left knee". */
  painRegionLabel?: string;
  /** True once anything has been logged in this session. */
  loggedAnySet: boolean;
  /** How many exercises are still to come after this one. */
  exercisesLeft: number;
}

export interface SessionTip {
  /** A short question or statement. Never a heading in title case. */
  title: string;
  body: string;
}

/** How many the sheet shows. More than four and it stops being a glance. */
export const MAX_SESSION_TIPS = 4;

const BLOCK_TIPS: Record<string, SessionTip> = {
  prep: {
    title: 'This is not meant to tire you',
    body: 'The warm-up is here to get blood moving and joints ready. Easy enough that you could hold a conversation the whole way through. If it feels like work, slow down.',
  },
  mechanical: {
    title: 'Quality over weight here',
    body: 'Activation work is about waking the right muscle up before it has to do something heavy. Light, slow and felt in the right place beats heavier and rushed.',
  },
  neuro: {
    title: 'Fast, then rest',
    body: 'Power work only counts while it is sharp. Every rep should look like the first one. When they start slowing down, that set is finished, whatever the number said.',
  },
  main: {
    title: 'This is the one that matters today',
    body: 'Your main lift is what the rest of the week is built around. If one thing goes well today, make it this. Take the rest you need between sets, even if it is longer than the timer.',
  },
  accessory: {
    title: 'Chase the muscle, not the number',
    body: 'Accessory work is about the muscle doing the work, not the weight on it. If you cannot feel the right muscle working, go lighter and slow the lowering down.',
  },
  prehab: {
    title: 'Prescribed, not optional',
    body: 'This one was chosen for a specific reason and the dose matters more than the effort. Stay inside a range that does not hurt, and stop if it does.',
  },
  finisher: {
    title: 'Last push',
    body: 'The finisher is meant to feel hard. It is also the safest place in the session to stop early if you have nothing left, because nothing later depends on it.',
  },
  cooldown: {
    title: 'Worth the two minutes',
    body: 'Bringing your breathing down at the end is what makes the next session easier. It is the part everybody skips and the part that costs the least.',
  },
};

const LOGGING_TIP: SessionTip = {
  title: 'What do I put in the boxes?',
  body: 'The weight you actually put on the bar and the reps you actually got. Not what you meant to do, and not what the app suggested. Those two numbers are the whole record.',
};

const FEEL_TIP: SessionTip = {
  title: 'What does the question after each set do?',
  body: 'Easy, Challenging or Too Hard changes the very next set straight away and sets where you start next time. It is worth answering honestly even when the honest answer is that it was too heavy.',
};

const REST_TIP: SessionTip = {
  title: 'How long should I rest?',
  body: 'The timer is a guide, not a rule. Take longer on the heavy sets if you need it. Being rushed into a set is how form goes.',
};

const SWAP_TIP: SessionTip = {
  title: 'What if I cannot do this one?',
  body: 'Open "How do I do this?" and use Swap for an alternative that trains the same thing. If nothing fits, Skip it. A skipped exercise keeps every set you already logged.',
};

/** The tips worth showing, most relevant first. */
export function sessionCoachTips(ctx: SessionCoachContext): SessionTip[] {
  const tips: SessionTip[] = [];

  /**
   * Pain outranks everything.
   *
   * The session was already built around the area they reported, and the one
   * line that makes that safe is the instruction to stop. If they have opened
   * the assistant while something hurts, that is the answer they need first.
   */
  if (ctx.painRegionLabel) {
    tips.push({
      title: `About your ${ctx.painRegionLabel}`,
      body: `Today's session was built around it, and some exercises were swapped for gentler ones. Nothing here is worth training through: if something hurts your ${ctx.painRegionLabel}, stop that exercise and tap Skip.`,
    });
  }

  /**
   * The weight, in whichever of its two states applies.
   *
   * Skipped entirely on a set with no load, where every word of it would be
   * about a box that is not on screen.
   */
  if (!ctx.isBandOrBodyweight && ctx.suggestedKg > 0) {
    const changed = Math.abs(ctx.typedKg - ctx.suggestedKg) > 0.01 && ctx.typedKg > 0;
    tips.push(
      changed
        ? {
            title: 'You changed the weight, and that is the point',
            body: 'The number in the box is a suggestion built from what you lifted last time. Changing it to what actually suits you today is not overriding the app, it is teaching it. Next time it will start closer.',
          }
        : {
            title: 'Do I have to lift the weight it suggests?',
            body: 'No. It is a starting point built from your last session, and it is often a little off. Change it to whatever you are actually going to lift. Two honest sessions and the suggestion stops being wrong.',
          }
    );
  }

  const block = BLOCK_TIPS[ctx.category];
  if (block) tips.push(block);

  // Somebody who has not logged anything yet has not seen the effort question,
  // so the mechanics of logging come before what the answer does.
  if (!ctx.loggedAnySet) tips.push(LOGGING_TIP);
  else tips.push(FEEL_TIP);

  if (ctx.category === 'main' || ctx.totalSets >= 3) tips.push(REST_TIP);
  tips.push(SWAP_TIP);

  return tips.slice(0, MAX_SESSION_TIPS);
}

/** The line under the assistant's title, naming what it is talking about. */
export function sessionCoachSubtitle(ctx: SessionCoachContext): string {
  const setPart =
    ctx.totalSets > 1 ? `set ${ctx.setNumber} of ${ctx.totalSets}` : 'one set';
  return `${ctx.exerciseName} · ${setPart}`;
}
