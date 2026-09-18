/**
 * WHAT THE HOME TAB SAYS, AND WHAT ITS TOUR SAYS ABOUT IT.
 *
 * All of this used to live inside app/(tabs)/index.tsx, which is a React Native
 * screen and therefore cannot be imported by a plain node check. So the only way
 * a test could ask "does the first tour card still promise everybody a
 * programme" was to match a regular expression over the screen, which is this
 * repo's named commonest defect: a regular expression matches the comment
 * explaining a sentence as readily as the sentence itself, and the comments here
 * quote the very wording being checked for.
 *
 * The tour cards and the four lines of the programme tile are plain data with no
 * React in them, so tests RUN them and read the actual strings back.
 *
 * WHY HOME CHANGED.
 *
 * The hero card branched on whether somebody was enrolled in a programme. Not
 * enrolled, and it said "No programme yet" with a button to go and pick one, and
 * that was the whole card: the app's first screen, for the majority of its
 * users, was an advert for a feature Archie's own plan calls optional. A paused
 * programme was worse again, because `programme` was still there: the card went
 * on naming a block that had explicitly been stopped, counted sessions towards
 * it, and printed "Easier week" for a deload week nobody was in.
 *
 * So the hero is the Today card whenever nothing is choosing sessions for you -
 * never enrolled or paused, it makes no difference - and the programme is named
 * over it only when a programme really is running.
 */
/**
 * The name to print over today's session, or null when nothing is running.
 *
 * PAUSED COUNTS AS ABSENT EVERYWHERE ON HOME, which is the fix this phase is
 * mostly about. getCurrentSessionType already fell back to the rotation for a
 * paused block, and getProgrammePosition deliberately does not: it still answers
 * with the position the block is frozen at, so the hub can show somebody where
 * they will pick up. Home read that position as though the block were running.
 */
export function heroProgrammeName(p: { name: string; paused?: boolean } | null): string | null {
  return p && !p.paused ? p.name : null;
}

/**
 * The eyebrow above the session name.
 *
 * It names the block when there is one, so the card is unmistakably the
 * programme's rather than a suggestion from nowhere - the sentence that was
 * missing when somebody opened Home and found a Squat Session they had never
 * asked for. With no block running there is nothing to name, and "Today" is the
 * truth rather than a placeholder.
 */
export function heroEyebrow(programmeName: string | null): string {
  return programmeName ? `TODAY · ${programmeName.toUpperCase()}` : 'Today';
}

export interface ProgrammePlace {
  /** Sessions of the block completed. */
  done: number;
  /** How long the block is. */
  total: number;
  /** The next session falls in a deliberately easier week. */
  deload: boolean;
}

/**
 * Where in the block they are, and null the moment nothing is running.
 *
 * THE PAUSE GUARD IS THE POINT. A position exists for a paused block, and every
 * line below this one is drawn from it: the session count on the hero, the
 * number on the tile, and the "Easier week" note. A paused block has no weeks,
 * so it cannot have an easier one, and the store's own isDeloadSession says so;
 * Home worked it out again from the raw position and disagreed.
 */
export function programmePlace(
  programme: { paused?: boolean } | null,
  position: { onPlan: number; totalSessions: number; deload: boolean } | null
): ProgrammePlace | null {
  if (!programme || programme.paused || !position) return null;
  return { done: position.onPlan, total: position.totalSessions, deload: position.deload };
}

/**
 * The line under the session name, for somebody a block is choosing for.
 *
 * The easier week is APPENDED rather than given a line of its own, because this
 * card cannot grow: Home is sized to fit without scrolling and every tile in it
 * is fixed, so a second row here is a second row everywhere. Six words on the
 * end of a line that was already there is the whole announcement, and the
 * session screen carries the explanation.
 */
export function programmePlaceLine(place: ProgrammePlace | null): string | null {
  if (!place) return null;
  const at = Math.min(place.done + 1, place.total);
  return `Session ${at} of ${place.total}` + (place.deload ? ' · Easier week' : '');
}

/**
 * WHICH HERO CARD IS DRAWN.
 *
 * 'today' is the session, whoever you are and whatever is or is not choosing it.
 * 'chooser' is the one narrow case where the app genuinely does not know: a
 * person who rotates their sessions and has never lifted here, for whom
 * "Lower Body" is not a suggestion but a coin toss. They pick, the pick is
 * stored as the rotation's starting point, and they never see this card again.
 *
 * A beginner is never shown it, because there is nothing for them to choose:
 * Archie's second decision gives them Full Body every session until they earn a
 * rung. See rotatesSessions in lib/session-type.ts.
 *
 * AND A PAUSED BLOCK COUNTS AS ENROLLED HERE, which is the opposite of the rule
 * everywhere else on this screen. Found by driving the real screen: somebody who
 * pauses Joint Health has no LIFTING history at all, because that block is
 * prehab and flexibility, so the chooser was treating them as brand new and
 * asking them to pick a first session the day after they stopped a block they
 * had been training for three weeks. The card is for people the app has never
 * met. Pausing is not that, so they get the rotation's own first session and the
 * Today card everybody else has.
 */
export function homeHero(i: {
  /** Enrolled in a block at all, paused or running. */
  hasProgramme: boolean;
  rotates: boolean;
  liftingCount: number;
}): 'today' | 'chooser' {
  if (i.hasProgramme) return 'today';
  return i.rotates && i.liftingCount === 0 ? 'chooser' : 'today';
}

export interface ProgrammeTile {
  /** The micro-label above the number. */
  label: string;
  /** The big number. A single space rather than empty: see below. */
  number: string;
  /** The tile's name. */
  title: string;
  /** The line under it. */
  subtitle: string;
}

/**
 * THE FOUR LINES OF THE "YOUR PROGRAMME" TILE, IN EVERY STATE IT HAS.
 *
 * All four are ALWAYS returned, and the number is a space rather than an empty
 * string when there is no number to show. Home is sized not to scroll and these
 * tiles are a fixed height, so dropping an element out of one state is a layout
 * change rather than a copy change: the tile would stand a line shorter than the
 * three beside it and the whole grid would step.
 *
 * The tile used to say YOUR PROGRAMME and "Choose one" to anybody not enrolled,
 * which is the same advert the hero card was, in the same two square inches. A
 * person off a programme is not missing anything, so the tile tells them what
 * they have: their own sessions, and the next one.
 *
 * Paused keeps the block's name. The hero has already handed the day back to
 * the rotation, and this is the one place left that can say where the block is
 * waiting - hiding it would leave somebody who paused with no route back.
 */
export function programmeTile(i: {
  /** A finished block whose report has not been read yet. */
  reportReady: boolean;
  /** The enrolled block's name, paused or not. Null when enrolled in nothing. */
  enrolledName: string | null;
  /** Whether that block is paused. */
  paused?: boolean;
  /** Where in the block they are, null unless one is running. */
  place: ProgrammePlace | null;
  /** The name of the session the app is suggesting next. */
  nextSessionLabel: string;
}): ProgrammeTile {
  const title = i.enrolledName ? i.enrolledName.toUpperCase() : 'YOUR SESSIONS';
  if (i.reportReady) {
    return { label: 'FINISHED', number: ' ', title, subtitle: 'Read your report' };
  }
  if (i.enrolledName && i.paused) {
    return { label: 'PAUSED', number: ' ', title, subtitle: 'Paused for now' };
  }
  if (i.place) {
    return {
      label: 'SESSION',
      number: String(i.place.done),
      title,
      subtitle: `of ${i.place.total} in the block`,
    };
  }
  return { label: '', number: ' ', title, subtitle: `Next: ${i.nextSessionLabel}` };
}

/** What the tile opens. */
export function programmeTileHref(reportReady: boolean): '/programme-report' | '/program' {
  return reportReady ? '/programme-report' : '/program';
}

/**
 * THE TOUR, REBUILT - and mostly by deleting.
 *
 * It ran to eighteen cards across five tabs before the user had done anything,
 * and length was the whole problem: nobody reads eighteen, so the ones that
 * mattered were never reached. It is twelve now, and the cuts followed three
 * rules.
 *
 * DO NOT NARRATE AN EMPTY SCREEN. Five steps described data a first-run user
 * does not have - a training block with no sessions in it, a program rotation
 * that has not started, badges nobody has earned, charts that "fill in as you
 * log". Being told about a number you cannot see teaches you the app is talking
 * to someone else.
 *
 * SAY IT ONCE. The streak was explained on Home, again on Profile and again on
 * Stats. It is explained here, and nowhere else.
 *
 * EARN THE STEP. Anything self-evident from its own heading went.
 *
 * What went IN is the assistant, which was in the app and in no tour - the one
 * place that says what the app has noticed about your training, behind a button
 * most people would never press unprompted.
 */
export interface HomeTutorialStep {
  spotlightRef: 'session' | 'programme' | 'coach' | 'streak' | 'achievements';
  iconName: string;
  iconLabel: string;
  title: string;
  body: string;
}

export const HOME_TUTORIAL: readonly HomeTutorialStep[] = [
  {
    /**
     * THIS CARD DESCRIBED THE WRONG SCREEN, TWICE.
     *
     * It first said "tap Start" when a brand-new user was looking at a
     * three-lift chooser with no Start button on it. It was rewritten as "the
     * next session in your programme", which was true of the only card the hero
     * could then draw - and became false for everybody the moment the hero
     * stopped requiring a programme, which is most people. A first card that
     * describes a feature the reader has not got teaches them the app is
     * talking to someone else.
     *
     * So it promises nobody a programme and nobody a rotation. It says where
     * the suggestion comes from, which is true either way and is the thing the
     * eyebrow above the session name is there to tell them.
     */
    spotlightRef: 'session',
    iconName: 'flash-outline',
    iconLabel: 'Today',
    title: 'Start here every day',
    body: 'This is the session Grow suggests next, and the line above it says where it came from: your programme if you are on one, your own rotation if you are not. Either way the whole thing gets built for you, warm-up to cool-down, with the weight for every set.',
  },
  {
    /**
     * WHERE THE PROGRAMME LIVES, AND THAT IT IS OPTIONAL.
     *
     * A tour written before programmes existed pointed at a streak, a session
     * and a trophy, and never once at the thing that decides what somebody on
     * one trains. Reported after use: "the process to try and edit / change /
     * program didnt feel simple", which starts with not knowing where it is.
     *
     * It is also the only honest place to say a programme is not required,
     * because it is the moment somebody is looking straight at the tile. The
     * card used to open "Tap this to see the whole block", which quietly
     * assumed a block.
     */
    spotlightRef: 'programme',
    iconName: 'albums-outline',
    iconLabel: 'Programme',
    title: 'Programmes are optional',
    body: 'You do not need one. Grow suggests a session either way, and everything in Train stays open. Tap here to look through the programmes, or to build your own, and if you are on one this is where the whole block lives: days a week, how long, your level, or stopping it.',
  },
  {
    /**
     * THE SYMBOL IS THE PART THAT HAS TO BE TAUGHT.
     *
     * This step was written when the assistant was a grey speech bubble that
     * only ever raised problems, and it said so: three examples, all faults,
     * ending on "it stays out of your way until you open it".
     *
     * None of that is the button any more. It is sapphire, it says as much
     * about what is going well as what is not, and it swaps its glyph for a
     * sparkle when there is something unread - which is the ONLY way a user
     * finds out there is anything to read. A tour that leaves that out ships a
     * changing symbol nobody has been told the meaning of.
     */
    spotlightRef: 'coach',
    iconName: 'sparkles',
    iconLabel: 'Assistant',
    title: 'Your assistant',
    body: 'The blue button is what the app has noticed: a personal best, a lift that has stalled, a week worth taking lighter. It shows the three that matter most, with the rest one tap behind. When the symbol turns into a sparkle, there is something new.',
  },
  {
    spotlightRef: 'streak',
    iconName: 'flame-outline',
    iconLabel: 'Streak',
    title: 'Consistent, not perfect',
    body: 'Your streak counts weeks you hit your goal, not days in a row. Miss a session and it survives; miss a week and it starts again.',
  },
  {
    /**
     * ACHIEVEMENTS WERE CUT FROM THIS TOUR, AND THE REASON NO LONGER HOLDS.
     *
     * Five steps were removed for narrating an empty screen, and one of them
     * was "badges nobody has earned". That was right at the time. It is not
     * right any more, because the tour now ends by awarding one: finishing the
     * practice session earns Welcome Aboard and the user watches it land.
     *
     * The number is deliberately not quoted here. It comes from the catalogue
     * and the catalogue grows; the achievements screen counts them itself.
     */
    spotlightRef: 'achievements',
    iconName: 'trophy-outline',
    iconLabel: 'Badges',
    title: 'Something to collect',
    body: 'Badges unlock on their own as you train: sessions logged, weeks kept, a lift moved, an area you looked after. You never chase them. Tap here any time to see what you have and what is next.',
  },
] as const;

/**
 * THE FIRST-SESSION CHOOSER'S OWN WORDS, AND THEY ARE SHORT ON PURPOSE.
 *
 * Kept here with the rest of Home's copy so the check reads what the user reads.
 * The three session names come from SESSION_META; only the framing is here.
 *
 * BOTH LINES HAVE TO FIT ON ONE LINE EACH. Home does not scroll, the hero is the
 * tallest thing on it, and this card has to come in at or under the Today card
 * it replaces. At the sizes the screen uses, a title over about 25 characters
 * and a body over about 45 wrap, and each wrap is another row of the whole page.
 * The card carries no eyebrow of its own for the same reason: it wears the same
 * "Today" the other branch does, which is true and costs nothing.
 */
export const FIRST_SESSION_COPY = {
  title: 'Pick your first session',
  body: 'Whichever you pick, the others follow.',
} as const;

/** The ceilings the two lines above are written to. See FIRST_SESSION_COPY. */
export const FIRST_SESSION_TITLE_MAX = 25;
export const FIRST_SESSION_BODY_MAX = 45;
