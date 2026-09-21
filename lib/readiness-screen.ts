/**
 * THE THREE CARDS THAT TALK OVER THE READINESS CHECK.
 *
 * WHY THEY ARE NOT IN app/readiness.tsx ANY MORE
 * ──────────────────────────────────────────────
 * Same reason as lib/train-screen.ts, lib/home-screen.ts, lib/stats-screen.ts
 * and lib/session-screen.ts. A node check cannot import a React Native screen,
 * so the only way to ask what these three cards SAY was a regular expression
 * over the screen - and the comments below quote the very phrases being looked
 * for, several of them word for word, because they exist to explain what was
 * taken out of the copy and why.
 *
 * That is not a hypothetical. The word "lift" is the live example: the app
 * swept "main lift" to "main exercise" everywhere a user reads it, and the
 * comments here still say "main lift" half a dozen times, on purpose, because
 * they describe sessions the app used to build. A check that greps this file
 * cannot tell those apart. tests/copy-sweep.check.mjs imports the array and
 * reads the title and body of each card, which can.
 *
 * Order matches the page's actual top-to-bottom layout (Pain, then Energy,
 * then Time) so the tutorial scrolls one direction instead of zigzagging up
 * and down the page between steps.
 *
 * Every word below is the screen's, unchanged apart from that one phrase.
 */
export const READINESS_TUTORIAL = [
  {
    iconName: 'medical-outline',
    iconLabel: 'Pain',
    title: 'Any pain today?',
    // Rewritten when the acute protocols landed. The old copy described only
    // half of what naming a sore area does — "swap exercises away from that
    // area" — and left out the half that matters most: the rehab work you are
    // given INSTEAD, which is deliberately gentle and comes with a pain limit.
    // Someone who reads "swap away" and then finds five isometric holds in
    // their session has been told the wrong thing about their own workout.
    // "Tap anywhere that is sore" described the body map, which is on the NEXT
    // screen. What this card is spotlighting is a No / Yes pair.
    body: 'Tap Yes and mark where it hurts. The app takes the exercises that would aggravate it out of your session and puts gentle work for that area in. Nothing that stretches or hard-loads it, and a pain limit to stay inside.',
  },
  {
    iconName: 'battery-half-outline',
    iconLabel: 'Energy',
    title: 'How are you feeling?',
    /**
     * THE WEIGHT DOES NOT MOVE WITH THIS, AND THE CARD USED TO SAY IT DID.
     *
     * Generate the same session at low, normal and high and the main lift comes
     * out at the same load every time. The load comes from personalizeLoad -
     * last logged weight, your rating of it, your 1RM, time off - and energy is
     * not one of its inputs. Telling somebody who has just said "low" that the
     * weight will drop, and then showing them last week's number, reads as the
     * app ignoring them. So the card says the true thing AND says the weight is
     * not part of it, because that is the sentence that stops the confusion.
     *
     * REWRITTEN AGAIN when the lift-named session ids stopped being generated.
     * It used to promise "low takes a set off your main lift", which was true of
     * the old squat, bench and deadlift days and has never been true of a lower
     * or upper body one: those give four sets whatever you answer. What the
     * answer really moves now is which finisher you get, and on a Full Body
     * session, how many sets everything in it carries.
     *
     * AND REWRITTEN AGAIN when Lower Body moved to Archie's library, where the
     * two halves swap over: a library session takes a set off EVERY exercise
     * when you say low and adds one when you say high, and its finisher comes
     * off the conditioning list by rotation rather than by how you feel. So the
     * card named both and promised neither everywhere, because which one you
     * got depended on the session.
     *
     * AND THE FINISHER HALF IS NOW GONE, because the session it was true of is.
     * Full Body was the last type the old engine built, and with it switched
     * over there is no session anywhere that picks a different finisher when
     * you say you feel flat. What the answer moves, on all three types, is the
     * sets: 14 / 19 / 24 on a Lower or Upper Body hour and 17 / 23 / 29 on a
     * Full Body one. So the sentence says the one thing that is true of every
     * session rather than hedging between two, and the hedge goes with it.
     *
     * tests/guided-tour.check.mjs generates all three at each answer and fails
     * if any of that stops matching, which is the signal to re-read this. It
     * also fails if the finisher starts moving with energy again while the card
     * stays quiet about it.
     */
    body: 'Low gives you an easier session and high a harder one: fewer or more sets on every exercise in it. It does not change the weight on the bar, which comes from what you lifted last time.',
  },
  {
    iconName: 'time-outline',
    iconLabel: 'Time',
    title: 'How long have you got?',
    /**
     * Counted, not guessed. Generating a LOWER BODY session at each duration
     * gives 8, 9 and 11 cards:
     *
     *   30  Warm-Up x4, main lift, Accessory x2, Cool Down
     *   45  one warm-up fewer, a third Accessory, + PREHAB
     *   60  the fourth warm-up back, a fourth Accessory, + FINISHER
     *
     * So the two blocks that appear as the session gets longer are Prehab at 45
     * and the Finisher at 60. Rewritten here when the lift-named session ids
     * stopped being generated: the old copy described the squat day's shape,
     * which put a Power Primer and an Activation drill in and reached its
     * finisher at 45. No session the app builds has any of that.
     *
     * COUNTED AGAIN, now that all three of them are built from Archie's list.
     * Every type gives the same shape: 30 is Warm-Up, main lift and
     * Accessories; 45 adds a Cool Down; 60 adds a Finisher. Nothing is taken
     * away as the session gets longer, on any type, at any tier.
     *
     * SO TWO THINGS CAME OUT OF THIS CARD. Prehab, because it is not a
     * duration any more: a library session puts a rehab drill in whenever
     * there is an area to look after, and it does that at 30, 45 and 60 alike,
     * so naming it under 45 told somebody the wrong reason they were or were
     * not getting one. And "goes in instead of the Prehab", because no session
     * loses a block by being longer now. That clause was true of the old
     * engine's Full Body day, which ended 45 on Prehab and 60 on the Finisher
     * with the Prehab gone, and that day is not built any more.
     *
     * The block names are capitalised because they are the badges printed on
     * the cards themselves - see components/SessionPlanList.tsx - so the words
     * here are the words the user is about to read.
     */
    body: '30 is your Warm-Up, your main exercise and the Accessories that fit. 45 keeps all of that and adds a Cool Down to ease you out of it. 60 adds a Finisher on top.',
  },
] as const;

/** One card of the readiness tutorial. */
export type ReadinessTutorialStep = (typeof READINESS_TUTORIAL)[number];
