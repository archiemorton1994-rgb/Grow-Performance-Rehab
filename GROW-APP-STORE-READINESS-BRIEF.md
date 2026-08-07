# Grow-Performance-Rehab — App Store Readiness & Progression Deep-Dive

Repo: https://github.com/archiemorton1994-rgb/Grow-Performance-Rehab

## Purpose of this pass

This is a report-only audit, not an implementation task. Actually run the app
and click through it — don't just read code — but don't fix anything until
each finding has been reviewed and explicitly approved. Organize the report
by the sections below. For every finding: which file/screen, what the actual
problem is (not just a symptom), severity, and whether it's an objective
bug/gap versus a judgment call that needs a human decision.

---

## Part 1 — App Store readiness

- Anything that would get the app rejected or flagged in review: broken
  flows, placeholder content, crashes, missing required screens (privacy
  policy link, account deletion path, terms), permission requests without
  clear justification, subscription flow clarity (pricing must be
  unambiguous before purchase).
- Anything that looks unfinished to a first-time reviewer with no context —
  broken images, lorem-ipsum-style leftover text, console errors visible in
  the app itself, dead-end navigation.
- Performance: does anything visibly stutter, hang, or take too long to
  load, especially on first launch / cold start.
- Accessibility basics: readable contrast (tie this to the color-token audit
  from the visual rehaul), tap target sizes, whether screen readers get
  anything remotely usable.
- Do NOT touch the RevenueCat/auth integration logic itself — report on
  whether the *user-facing flow* around it is clear and premium-feeling, not
  the implementation.

## Part 2 — General functional/technical/visual/QoL sweep

Same four-dimension structure as before (functional, code quality, visual,
QoL) — full re-sweep, not just the areas already covered. Check current code
state against `GROW-REHAUL-BRIEF.md` so already-fixed items aren't
re-reported, but verify against actual code rather than trusting the doc.

## Part 3 — Progression system deep-dive (the important part)

This needs real precision — trace the actual code path, don't guess or
summarize from memory of what similar apps do.

### 3a. Document exactly how progression works today

Trace and explain, in plain terms:
- What data actually drives the load/weight suggested for the next session
  of a given exercise (the 1RM-based path, the last-logged-weight path, and
  whichever else exists).
- What role the post-set/post-exercise feedback (currently a 3-option scale)
  plays, if any, versus the weight actually logged that session.
- **Specific question to answer definitively**: if a user rates an exercise
  as "easy" but has also logged a heavier weight than last time, does the
  system still progress them correctly next session? Or can the feedback
  rating override, block, or contradict what the logged weight would
  otherwise do? Trace the actual code path and give a concrete yes/no answer
  with the reasoning, not a guess.
- Where streak-based step sizing (harder/faster progression after
  consecutive good sessions) fits into this, and what "resets" it.

### 3b. Should the feedback scale change from 3-option to 1-5?

Give an honest recommendation, not just "sure, more granularity is
better." Consider:
- What would a 1-5 scale actually let the algorithm do that 3 options can't
  — is there a real progression-quality improvement, or would it just be
  more UI complexity for the same underlying decision?
- Whether more granularity risks user fatigue (a 5-point scale takes longer
  to answer honestly than 3 buttons, every single set) against the payoff
  in progression quality.
- If recommending the change: how the new scale should map onto the existing
  progression math (what should 1 vs 2 do differently from the current
  "hard", etc.), and whether this is closer to an RPE (Rate of Perceived
  Exertion) scale that users already know from other fitness contexts —
  worth considering matching that convention rather than inventing a new
  one, since it's a well-established mental model for anyone who's used
  serious fitness apps before.

### 3c. Smart progression — how to make this feel genuinely premium

This is the app's core differentiator, so give real, specific ideas, not
generic ones. Consider (and give honest opinions on which are worth building
vs which are complexity without real payoff):
- Plateau detection — if an exercise hasn't progressed in N sessions despite
  good feedback, should the app notice and suggest something (deload, form
  check reminder, exercise swap)?
- Auto-regulation — adjusting a single session's targets in real time based
  on how the first few sets actually went, not just planning the whole
  session in advance.
- Deload logic — does one exist? Should it? On what trigger?
- Personalizing progression *rate* itself over time — someone who
  consistently rates things easy and keeps hitting PRs should perhaps
  progress faster than the default step size; someone plateauing should
  slow down. Is there a feedback loop for this, or is step size currently
  fixed?
- Anything that would make progression feel *visible and legible* to the
  user in the moment — e.g. does the app ever explain *why* it's suggesting
  a particular weight ("+2.5kg because your last 3 sessions felt easy"),
  or does it just present a number with no reasoning shown? Showing the
  reasoning is often what makes a system feel "smart" rather than opaque,
  worth strong consideration here.

Flag clearly which of these are quick wins versus larger design/dev
decisions that need explicit sign-off before building.

### 3d. Exercise variety and session composition

- Does the app actually vary session composition run to run, or is the same
  session type consistently generating a near-identical exercise list? Trace
  the actual selection/rotation logic and give a concrete answer — this
  connects to a known issue already flagged (day-index rotation uses UTC
  midnight, see `GROW-REHAUL-BRIEF.md`), but go further: is rotation
  meaningful (real variety across a week/month) or superficial (technically
  different but barely noticeable to the user)?
- Are there any exercises that are mislabeled, oddly cued, or seem
  incorrect for the muscle group/session type they're filed under —
  spot-check a meaningful sample across `exercise-db.ts`, not just a couple.

### 3e. Injury/pain handling — thresholds and rehab redirection

- Document exactly how pain/injury input currently affects what the app
  does — trace it from wherever pain is captured (readiness check-in,
  profile, in-session) through to its effect on exercise selection.
- **Specific question**: is there currently any logic that says "this pain
  level / this combination of signals is high enough that the app should
  actively suggest a rehab/recovery session instead of the planned strength
  session" — or does the app only do passive exercise substitution (swapping
  individual exercises for comfort) without ever actively redirecting the
  whole session? If no such threshold/redirect exists, say so clearly rather
  than describing the substitution logic as if it were the same thing.
- If it doesn't exist: is this worth building, and what would a sensible
  threshold look like (e.g. pain reported at a certain severity, or pain
  reported across multiple consecutive sessions)? This is a real safety and
  trust feature for a rehab-positioned app — treat it as a serious
  recommendation, not an afterthought, but flag it as a design decision
  needing sign-off given it affects what sessions get suggested.

---

## Part 4 — Output format

Structure the actual report as:
1. App Store readiness — pass/fail style list with severity
2. General sweep — grouped by dimension (functional/technical/visual/QoL),
   ordered by severity within each
3. Progression system — the 3a-3e questions above, each answered plainly and
   specifically, with code references
4. Prioritized recommendation list — what to fix/build first to get from
   "nearly done" to genuinely App Store ready and premium-feeling, ordered
   by impact

Don't build or fix anything from this report in the same session — get it
reviewed first, then a separate session executes whatever gets approved.
