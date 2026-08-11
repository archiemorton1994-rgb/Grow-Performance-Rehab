# Grow-Performance-Rehab — Full Depth Audit

**Report only. Nothing in the app has been changed.** Every finding below is
waiting on your decision before any work starts.

Audited: `main` at commit `389bdae`, 2026-08-07 to 2026-08-11.

---

## How this was done

Twenty-six investigators worked in parallel across four tracks, and every
high-severity claim was then handed to a separate set of agents whose instructions
were to **disprove it**. Where a claim was about behaviour rather than code, it was
checked by actually driving the app — a real browser, a real session, real taps —
not by reading the source and guessing.

- **The exercise database was read in full.** All 16,969 lines, every one of the
  661 exercises. Not a sample.
- **The progression system was simulated at full fidelity** — the auditors imported
  the app's *real* state store and *real* workout engine and ran 18-session
  histories through them, then confirmed the results in the live app.
- **The screens were walked as different people** — beginner and advanced, male and
  female, bodyweight-only through full gym, and one profile carrying an active pain
  flag.
- **Both themes were captured and measured** — 258 screenshots, with actual contrast
  ratios calculated rather than eyeballed.

**On confidence:** 42 high-severity findings went through adversarial verification
and **all 42 were confirmed**. One verification batch of roughly six findings was
lost to a connection failure and did not complete; those findings are marked in
their sections. Where a claim is a judgment call rather than a provable defect, it
says so — those are yours to decide, not mine.

## How to read this

Each finding carries a **severity** and a **kind**:

- **Objective** — provably wrong. The app does something other than what it says,
  or other than what it should. These are not opinions.
- **Judgment** — a taste or design call. I have given a recommendation where I have
  one, but these are yours.

Severity means: **critical** = could mislead someone into unsafe training, or
corrupt their data · **high** = wrong information shown to the user, or a broken
function · **medium** = a quality problem a paying user would notice · **low** =
a nitpick.

---

## The honest summary

**The foundations are better than the current state suggests.** The exercise
content itself is good — the coaching cues are well written and the programming
logic is sound. The visual design is stronger than it looks on screen. Nine of the
eleven bugs from your earlier briefs are genuinely fixed, and the test suite that
was broken now runs clean.

**What is wrong is almost entirely the wiring between good parts.** The muscle map
is fed by tagging that was never finished. The feedback buttons are computed
correctly and then never reach the input box. The dark theme has a correct accent
colour sitting three lines away from the wrong one that is actually used. Pain
severity is captured, stored, and dropped on the floor before it reaches the
workout generator.

That is good news for effort: several of the highest-impact items below are
one-line or one-function changes, not redesigns.

**But there are two findings I would not ship past.** One can put burpees and
sprint intervals into a session *because* the user said their knee hurts. The other
can put one person's training history onto another person's account. Both are
reproduced, both are confirmed, and both are in the top of the list below.

---

## Top 10 — highest impact first, across all four tracks

Ordered by what I would fix first, weighing harm against effort.

### 1. The safety swap can inject burpees, squat jumps and sprints under a "to protect your knee" caption
*Track 3 · critical · objective · `lib/exercise-safety.ts:74-100`*

The app decides whether an exercise is risky by reading **its name only**. Fifteen
catalogue exercises hide their jumping or sprinting in the rep line instead, so
they carry no risk marking and are eligible as *replacements*. A knee-pain session
was served "AMRAP Finisher" — *"5 burpees + 10 squat jumps + 15 push-ups"* —
captioned **"Swapped from Reverse Lunge + Knee Drive Intervals to protect your
knee."** This is the one place in the app where being wrong can injure a user who
did exactly what they were asked to do.

### 2. Signing in on a shared device inherits — and overwrites — the previous person's account
*Track 3 · critical · objective · `lib/auth-context.tsx:239-251`*

Signing out clears the login token and nothing else. The next person to sign in is
greeted by the previous user's name, inherits their sessions, badges, bodyweight
and tested maxes — and, because their new account is empty on the server, that data
is **uploaded to their account**. Working weights are then derived from a stranger's
strength. Reproduced end to end.

### 3. The Easy / Challenging / Too Hard buttons never change the weight you are given
*Track 2 · critical · objective · `app/session.tsx:580-589`*

The adjustment is calculated correctly, the explanatory note is written correctly,
the grey guide number updates — and the box the user actually submits does not
move. On screen at once: card says "65-107.5 kg", hint says "57.5 kg guide", note
says "Eased back — no more increases", input says **65**. **Every auto-regulation
adjustment in the app, in both directions, is currently decoration.** Three
separate agents hit this independently.

### 4. Nothing caps the weight — 165% of the user's own tested max by session 18
*Track 2 · critical · objective · `lib/workout-engine.ts:496-524`*

Next weight is always *last weight + step*, where step is 0, +2.5, +5 or +7.5. No
ceiling, no reference to the user's max, no deload, no way down. A lifter entering a
tested 100 kg bench is prescribed **165 kg by session 18**, praised as "17 clean
sessions in a row". The only brake is physically failing the lift.

### 5. A weight range is misread as a two-set ladder — 945 of 3,600 prescriptions
*Track 2 · critical · objective · `lib/workout-engine.ts:2095` — one line*

"30-47.5 kg" reads as two numbers; two numbers plus two sets is treated as a
deliberate ladder. Full-body sessions force two sets whenever under 60 minutes or
low energy. A brand-new user with no history was offered **Back Squat 65 kg then
107.5 kg**, with no warm-up. The same user on a lower-body day got a sensible ramp.
Best effort-to-impact ratio in the entire report.

### 6. Pain severity is captured, stored, and never reaches the workout generator
*Track 3 · critical · objective · `app/session.tsx:1989-1997`*

Mild, Moderate and Severe produced the **identical 10-exercise session** — including
explosive marching and 20-metre sprint intervals — on a knee-pain profile. The
rule that drops the explosive block at moderate and above never fires because
severity is not in the object handed to the engine. The logic works when called
directly; it is purely a missing connection.

### 7. Warm-up sets count toward the difficulty rating, so the biggest jump is the default
*Track 2 · critical · objective · `lib/auto-regulation.ts:244-250`*

The tally includes warm-ups, and the app's own cue tells the user those will be
easy ("very light warm-up — just waking up the pattern"). Two "Easy" answers earn
the **+7.5 kg** step, so an honest user earns the maximum jump every session. The
"steady +2.5 kg" step is only reachable by calling a warm-up challenging.

### 8. The muscle map is wrong more often than it is right
*Track 1 · high · objective · across `lib/exercise-db.ts` and its lookup tables*

**171 of 661 exercises carry no muscle tags at all** — every finisher, every
conditioning exercise, every 1RM test. All **48 weekly-session exercises** are
missing from three of the four lookup tables, so upper-body, lower-body and
full-body sessions light up **nothing**. Deadlifts credit no hamstrings or glutes.
A breathing drill credits the core after nearly every session. Two screens compute
muscles by different routes and disagree with each other. This is the Recover tab's
entire reason to exist.

### 9. Users who own no equipment are given exercises they cannot do — including required ones
*Track 1 · high · objective · ~20 exercises*

Bands, a pull-up bar, a bench, an ab wheel, a stability ball and a plyo box all
appear in buckets served to people who selected "no equipment". The worst is
**Chin-Up occupying a required slot** in every weekly upper-body and full-body
session — unavoidable, and its listed alternative also needs a bar. Related: a
naming collision offers the 30-60 kg barbell Good Morning to bodyweight-only users.

### 10. Two colour lines account for most of what makes the app look unfinished
*Track 4 · high · objective · `constants/colors.ts:112` and `app/(tabs)/_layout.tsx:169-183`*

The dark theme's primary green was never darkened — it is the light theme's value,
used as **text colour in 172 places**, measuring as low as 1.90:1. The Settings
sheet cannot show which theme is selected; the equipment list is green-on-green.
Separately, the light theme's tab bar is hardcoded to the dark palette, putting a
**pure-black slab** under white cards on every screen. The correct dark accent
already exists in the same file. Two lines, dozens of screens.

### Just outside the top 10, worth knowing

- **Conditioning sessions never vary** — byte-identical every day, forever, on every
  equipment tier (*Track 3, high*).
- **A custom session silently rewrites your main-lift baseline** — a measured drop
  from a 120 kg squat prescription to 50 kg, with no indication and no undo
  (*Track 3, critical*).
- **A single mistyped weight poisons progression permanently**, with no downward path
  out (*Track 2, high*).
- **No time-awareness at all** — returning after 368 days gives an identical,
  still-progressing prescription (*Track 2, high*).
- **The paywall shows no price** when the payment key is missing, and blocks the
  account-deletion path Apple requires (*Track 3, high*).

---

# Track 1 — Exercise database

**Verdict: the exercise content itself is good — the cues are well written, every
exercise has its fields filled in, and the coaching is sound. What is broken is the
*bookkeeping around* the exercises: which muscles they are recorded as training, which
equipment bucket they were filed in, and whether two entries are the same movement or
two different ones. All three of those are visible to the user, and the muscle map is
wrong more often than it is right.**

Ten auditors between them read every one of the 16,969 lines of `lib/exercise-db.ts` —
not a sample — and a further two traced the whole database structurally and followed the
muscle data from the file through to the pixels on screen. 136 findings came back. This
section groups them into the six things that actually matter. Every number quoted below
was re-checked against the repository while writing this; where two auditors disagreed on
a count, the figure here is the one that was verified directly.

---

## 1. The muscle map is built on data that was never finished

*40 of the 136 findings sit under this heading. It is the highest-impact theme in the
track because it is the one the user looks at.*

There is exactly one muscle heatmap in the app: the **Muscle Progress** panel on the
Stats > Strength tab (`app/(tabs)/workouts.tsx:237-330`). Alongside it, the post-workout
summary draws a "muscles worked" body figure. Both work the same way — after a session
the app takes each exercise you logged, looks up the list of body regions that exercise
declares, and colours those regions in. Only eleven regions can be coloured: chest,
bicep, tricep, core/ribs, quads, hamstrings, glutes, lat/mid-back, upper back, lower back
and calf/shin (`components/BodyDiagram.tsx:65-77`). Joint regions such as `hip_groin`,
`knee` and `front_shoulder` exist in the data but are filtered out and never appear.

That single filter is what turns a series of small data omissions into a systematically
wrong picture.

### 1a. Upper-body, lower-body and full-body sessions light up nothing at all

**Severity: critical · objective.** `lib/exercise-db.ts:16822-16842` (and 16774-16794,
16892-16912).

The database contains four separate lookup tables built by four separate lists of
collections. The two used for *display* — the name lookup and the exercise picker — include
the three weekly-session pools. The two used for *lookup* — the ones the heatmap actually
reads — do not. All 48 weekly exercises (`wlb-*`, `wub-*`, `wfb-*`) are missing from them.

The heatmap looks up by exercise id and has no fallback (`workouts.tsx:184`,
`targetRegionsMap[log.exerciseId] ?? []`). So every main lift in every upper-body,
lower-body and full-body session contributes **zero**. A full-body session is the worst
case, because all six of its movements come from the weekly pool with no accessory slots
at all — it contributes literally nothing.

This was confirmed in the running app, not just in the code. Screenshot
`H-fullbody-only-heatmap.png` shows a user who logged one full-body session yesterday —
Back Squat 3x5 @ 100 kg, Barbell Deadlift 2x5 @ 140 kg, Bench 2x8 @ 80 kg, overhead press,
pulldown — with the *entire* Muscle Progress figure grey and labelled "Not trained", while
the same screen's "Your heaviest lifts" panel correctly lists Barbell Deadlift 140 kg and
Back Squat 100 kg. The panel then advises them to "consider adding a session this week"
for muscles they trained the day before.

The weekly entries *do* carry correct muscle tags. That data is simply never read. Adding
the three weekly collections to the three walk lists fixes this, the eight-unmapped-picker-
exercises problem below, and the category-map gap, in one change.

Two smaller consequences of the same root cause: eight exercises the custom-session picker
offers (Barbell Row, DB Shoulder Press, DB Pullover, Pallof Press, Lying Leg Curl,
Bulgarian Split Squat, Barbell Bulgarian Split Squat, Bodyweight Hip Hinge) resolve to no
regions in *either* lookup, so a custom session built around them shows nothing at all; and
the category map has the same blind spot, which is inert today only because nothing reads
the field yet.

### 1b. Four whole collections declare no muscles whatsoever

**Severity: high · judgment (where the line falls is the owner's call; that it is currently
in the wrong place is not).** `lib/exercise-db.ts` FINISHERS, CONDITIONING_WORKOUTS,
ORM_TEST, GOAL_CONDITIONING_BLOCKS, CARDIO_WARMUPS.

171 of the 661 exercise templates in the file — 26% — declare an empty muscle list. The
gap is not scattered; it is total, by collection:

| Collection | Entries | With any muscle tag |
|---|---|---|
| Finishers | 81 | 0 |
| Conditioning workouts | 46 | 0 |
| 1RM test protocols | 18 | 0 |
| Goal-conditioning blocks (fat loss etc.) | 18 | 0 |
| Cardio warm-ups | 6 | 0 |
| Two stragglers (`ph-s-1`, `fl-s-1`) | 2 | 0 |

For light cardio this is defensible and probably deliberate. For the rest it is not:

- **Test week records nothing.** A test-week session is only two exercises, both from the
  1RM pool. Every twelfth squat, bench or deadlift session is therefore a maximal effort
  that the recovery view treats as though it never happened — the day after a max test the
  app says those muscles are fresh.
- **Genuinely heavy finishers register zero.** "Deadlift Drop Set" (3 sets up to 15-rep
  barbell deadlifts), "Leg Press 50s Drop Set" (150 total reps), "KB Swing EMOM" (160
  swings), "Machine Chest Fly (Pump)", "DB Romanian Deadlift Intervals". Every 60-minute
  session ends with one of these.
- **A conditioning session logs 7-8 exercises of which 6-7 contribute nothing.** A user
  whose week is conditioning sees every muscle grey and is told nothing has been trained in
  14 days.
- **Fat-loss users doing 5x20 heavy kettlebell swings** — an exercise whose own metadata
  names Hamstrings as the primary muscle — get no hamstring or glute credit.

### 1c. The muscle vocabulary was retrofitted onto part of the database and stopped

**Severity: high · objective.** 18 findings.

At some point the muscle regions (quads, hamstrings, glutes, chest, tricep…) were added to
exercises that had previously only been tagged with joint regions. That pass covered the
squat and bench main lifts and most accessories, and then stopped. Everything it missed
still carries joint-only tags, which the heatmap discards.

The clearest single example, and the one a real user will notice first:

> **All three deadlift main lifts train no hamstrings and no glutes.**
> `dl-main-bw` (Single-Leg Hinge), `dl-main-db` (Romanian Deadlift) and `dl-main-fg`
> (Barbell Deadlift) all declare `targetRegions: ['lower_back', 'hip_groin']`
> (`lib/exercise-db.ts:4451, 4480, 4509`). `hip_groin` is filtered out, so the only muscle
> a deadlift can ever light is **lower back**. Meanwhile the same objects contradict
> themselves three lines further down: the barbell deadlift lists Glutes, Hamstrings,
> Trapezius, Core and Quadriceps as its secondary muscles, and the Romanian deadlift names
> Hamstrings as its primary muscle. The squat mains were fixed
> (`['quads','hamstrings','glutes','knee','hip_groin']`); the deadlift mains were not.
> Simulated across every combination: **no deadlift session in the app, at any tier or
> duration, ever produces hamstrings or glutes.** The Home screen advertises that session
> as "KPI · Hinge · Posterior Chain".

The same omission repeats down the whole hinge and posterior-chain family, which is why
the app portrays deadlift training as pure lower-back stress:

| What is missing | Where |
|---|---|
| All 45 mechanical-priming exercises tag only joints — glute bridges credit **lower back**, goblet squat primers credit **nothing** | MECHANICAL block, `1017-2347` |
| Every hinge primer (KB Swing, DB Power Clean, Jump Shrug, Hang Pull, Power Clean, Speed Good Morning) credits lower back, never glutes/hamstrings | `3194, 3223, 3281, 2867, 3804, 3953, 4230` |
| 12 glute-primary accessories (hip thrusts, glute bridges, donkey kicks, cable pull-throughs) omit `glutes` | `4575, 4894, 5070, 5507, 5681, 7555, 7845, 8050, 8108, 8311, 8487` and others |
| 7 row exercises omit `lat_mid_back` and `bicep` despite naming the lats as their primary muscle | `6004, 6265, 6383, 6789, 6878, 8079, 8516` |
| Every stretch in the standalone flexibility pool omits the muscle it stretches | `15356, 15374, 15446, 15464, 15482` |
| Hamstring stretches and reaches (prep and prehab copies) credit lower back, not hamstrings | `805, 9403, 9451, 9499` |
| Doorway Chest Opener — the app's canonical pec stretch — omits `chest`, in all three copies | `478, 566, 655` |
| Every plyometric: Squat Jump, Broad Jump, Box Jump, Depth Jump, Clap Push-Up, Plyo Push-Up all tag joints only | NEURO / POWER_NEURO blocks |

The inconsistency is provable inside single objects and between duplicates of the same
movement. The identical exercise "Single-Leg Glute Bridge" exists twice: as an accessory it
is tagged `['glutes','hamstrings']`, as a mechanical primer it is tagged
`['hip_groin','lower_back']` — same movement, opposite heatmap credit depending on which
block served it. A Bodyweight Squat lights quads; a Squat Jump does not.

Adding up: 171 exercises have no muscle tags at all and a further 103 have only joint tags,
so **274 of the 613 mapped exercises (45%) can never colour the heatmap** — 322 of 661
(49%) once the unmapped weekly pool is included.

### 1d. Muscles credited that the exercise does not train

**Severity: high · objective.** 7 findings. These are the opposite error and are arguably
worse, because they actively mislead.

- **A breathing drill counts as core work.** `cooldown-1` "Diaphragmatic Breathing" is
  tagged `['core_ribs']` (`lib/exercise-db.ts:11504`). Every weekly session appends it, and
  so does every 60-minute strength session. The session logger records an entry for every
  exercise in the session whether or not any set was completed, and the heatmap counts a
  region as trained for any log at all. So three minutes of nasal breathing marks the core
  as trained on essentially every session day, and anyone training five or more days a week
  sees **core showing red "Overloaded"** purely from cooldown breathing.
- **A machine hamstring curl credits the lower back and no hamstrings.**
  `dl-mech-fg-5` is tagged `['hip_groin','lower_back']`. A lying leg curl is pure knee
  flexion; it is frequently prescribed *because* it unloads the back. Should be
  `['hamstrings','knee']`.
- **The adductor machine credits quads** (`5768`) — a seated hip adduction with a fixed
  knee angle does not train the quadriceps, and the entry's own muscle fields agree.
- **An inner-thigh stretch credits the calf.** The same "Adductor Side-Lying Stretch" is
  tagged `['hip_groin','knee']` in one pool and `['hip_groin','calf_shin']` in another
  (`9182` vs `9474`). `calf_shin` does reach the heatmap, so this one is visibly wrong.
- **A cable front raise credits the upper back** (`7464`), inflating upper-back load every
  time it is served.

### 1e. Two screens, two different answers — and swaps are not recorded at all

**Severity: high · objective.** 6 findings.

The post-workout summary and the Stats heatmap use *different* lookup chains. The summary
falls back from exercise id to exercise name to a per-session-type default; the Stats panel
uses the id alone. For a weekly session that produces a flat contradiction: measured on an
upper-body full-gym 45-minute session, the summary immediately after the workout credits
`[upper_back, chest, tricep, lat_mid_back, bicep, core_ribs]` and the Stats panel opened the
next day credits `[upper_back, lat_mid_back, bicep, core_ribs]` — chest and triceps vanish
overnight. A full-body full-gym session loses quads, hamstrings, glutes, chest, tricep and
bicep between the two screens. Any future fix applied to one will not reach the other.

Three further defects in the same area:

- **Swapping an exercise mid-session is never recorded.** Tapping swap changes only what is
  displayed; the completed session is written using the **original** exercise's id and name
  with the **swapped** exercise's sets and weights (`app/session.tsx:2746-2757`). So History
  and Personal Bests show a lift the user did not do, the swap's load becomes the base
  lift's remembered working weight and drives the next session's suggestion, and the
  heatmap credits the base exercise's muscles. Concretely: swap Dumbbell Bench Press for DB
  Incline Press, do the incline at a lighter load, and that weight is written into your
  Dumbbell Bench Press personal best. (Grip variants, by contrast, behave correctly.)
- **The name lookup is last-write-wins**, and the rehab/mobility collections are walked
  after the strength ones, so 14 names resolve to a *different* exercise's muscles and lose
  groups: "Goblet Squat" loses hamstrings, "Romanian Deadlift" loses lower back,
  "Single-Leg Glute Bridge" loses lower back and hamstrings, "Band Pull-Apart" has four
  different region sets across nine ids.
- **122 of the 219 swap names, and all six grip-variant names, resolve to nothing** — so a
  swap can only ever inherit the base exercise's muscles. Fine for like-for-like swaps;
  wrong for the outliers, e.g. an Inverted Row swapped in for a Band Bicep Curl is logged
  as bicep-only work.

The remaining item here was already known: the summary reads the raw historic exercise name
instead of running it through the alias function, so all seven renamed exercises miss the
lookup in old history. The uncorrected root cause is a single missing call at
`app/session-summary.tsx:896`.

### 1f. The test that was supposed to catch this only inspects two collections

**Severity: medium · judgment.** `tests/muscle-heatmap-coverage.check.mjs`.

The test's own header claims it catches exactly the failure described in 1a — "an entire
session type goes dark on the heatmap". It verifies coverage by parsing the MAIN_LIFTS and
ACCESSORIES source blocks and never asserts that the ids a session *actually logs* are
present in the map. Three of the ten session types can go completely dark with the suite
green, which is what happened. A stronger assertion would be: for every session type, tier
and duration, the generated workout must contain at least one exercise whose id is in the
map with a real muscle in it.

---

## 2. Exercises that need equipment the user told us they do not own

*20 findings.*

Onboarding offers "No Equipment" and "Resistance Bands" as two separate choices, and
"Dumbbells" and "Kettlebells" as two more. Internally those four collapse to two buckets
(`lib/exercise-db.ts:12-16`): no-equipment and bands users share the **bodyweight** bucket;
dumbbell and kettlebell users share the **dumbbells** bucket. Nothing filters within a
bucket — `getAccessories()` returns it verbatim (`12776-12781`) and the engine just shuffles
and slices. The only place `equipmentRequired` is honoured anywhere in the app is the cardio
warm-up pool.

The result is that users who own nothing are regularly handed band exercises, and users who
own only dumbbells are handed kettlebell, bench, pull-up-bar and medicine-ball exercises.

**Severity: high · objective** for the required-slot cases; **medium** for the rest.

**The worst case — a required slot with no escape.** `wub-bw-chin-up` and `wfb-bw-chin-up`
("Chin-Up", suggested load "Bodyweight (pull-up bar)") sit at position 4 of the bodyweight
upper-body session and position 6 of the bodyweight full-body session. Both positions fall
inside the engine's *required-pattern* window, so the exercise is in essentially every
generated session, not an optional extra. Its only swap, "Neutral-Grip Pull-Up", also needs
a bar. A user who told the app they have no equipment is handed an unperformable movement
in a mandatory slot, every session, with no way out.

Two more with no performable alternative: `sq-mech-bw-4` "Lateral Band Walk", whose swap is
"Monster Walk" — also a band exercise; and `sq-mech-db-3` "Lateral Band Walk", whose swap is
"Banded Clamshell" — also a band exercise.

**Hardware that nobody in the tier owns.** The deadlift bodyweight accessory pool contains
a **stability ball** (`dl-acc-bw-15`) and an **ab wheel** (`dl-acc-bw-17`). Neither is in
the kit of *either* onboarding option that feeds this bucket, so those two entries serve
nobody. The same pool also contains Pull-Up, Dead Hang and Hanging Leg Raise (bar),
Copenhagen Plank and Banded Hip Thrust (bench). Combined with the band entries, **10 of
that pool's 17 exercises are impossible for a no-equipment user** — so most deadlift and
full-body sessions will prescribe at least one exercise they cannot do.

Named leaks, by bucket:

| Bucket (who it serves) | Exercises requiring kit they do not have |
|---|---|
| **bodyweight** (no equipment / bands) | Banded Clamshell, Lateral Band Walk, Band Pull-Apart, Banded Lateral Walk, Spanish Squat, Banded Glute Bridge, Band Bicep Curl, Band Face Pull, External Rotation (Band), Banded Good Morning, Banded Pull-Apart, Banded Pallof Press, Band Pull-Apart (Fast Tempo) — all need bands |
| **bodyweight** (true no-kit) | Chin-Up, Pull-Up, Inverted Row, Dead Hang, Hanging Leg Raise (bar); Weighted Push-Up ("10-20 kg plate"); Single Leg Hip Thrust, Copenhagen Plank (bench); Stability Ball Hamstring Curl; Ab Wheel Rollout; Jump Rope Intervals |
| **dumbbells** (DB or KB only) | Chin-Up and 45° Hyperextension (`dl-acc-db-12/14`, both claiming `equipmentRequired: 'dumbbells'`); Med Ball Overhead Slam; Box Jump and Depth Drop (plyo box — half that pool); Banded Clamshell, Lateral Band Walk, Band Pull-Apart; foam roller thoracic drill; Chest Supported Row, DB Skull Crushers, Tate Press, Single Leg Hip Thrust (all need a bench); "Bike or treadmill" conditioning warm-ups |

**Three paths make this worse rather than better:**

1. **The pain path.** When a user reports pain the app substitutes a gentler "comfort
   variant" — with no equipment check. Three of the four bench neuro options for
   no-equipment users use "Band Punch-Out" as their comfort variant, and the comfort variant
   for the plain Glute Bridge is a Banded Clamshell. So a no-equipment user in pain is
   routed to an exercise they cannot perform, at exactly the moment the app is trying to be
   kind to them. Likewise, five of the nineteen targeted-prehab regions — rear shoulder,
   upper back, knee, hip/groin and glutes — have a band exercise as their *first* entry, and
   that first entry is what gets injected into 45- and 60-minute strength sessions when pain
   is reported.
2. **The injury-substitution path.** Reported separately in section 3, this one is measured:
   across 90,720 generated sessions, 20 distinct equipment leaks, including "Barbell Bench
   Press" served **414 times** to bodyweight and bands users and "Cardio Machine Warm-Up"
   served **2,520 times**. The identical sweep with no aches reported produced **zero**
   leaks, so this is entirely an ache-path defect.
3. **The custom-session picker.** Its equipment gate is explicitly meant to "never offer a
   movement the user has no kit for", but the three machine cardio warm-ups pass it for
   every tier, because a collection that is not filed by tier is treated as needing no
   equipment at all.

One cue is worth calling out on its own: `cardio-warmup-3` is one of only three warm-ups
served to *every* non-gym user, and its swap is "Cardio Machine Warm-Up" with the cue
"Treadmill or bike at easy pace — **no space needed**". A user who told the app they own
nothing taps swap and is told to get on a treadmill.

Two entries in the targeted-prehab section directly violate the section's own stated
invariant ("equipment-agnostic — all bodyweight / light band", and a test file documents the
same rule): the elbow circuit requires a light dumbbell and the chest circuit requires a foam
roller. Neither has a swap.

---

## 3. One movement, many names — and the picker keys on the name

*24 findings.*

The database has 111 names that cover 312 different ids. That would be harmless if the
duplicates were genuine tier variants of the same movement, but many are not, and several
systems key on the name rather than the id.

### 3a. The picker shows the wrong version of an exercise

**Severity: high · objective.** `lib/exercise-db.ts:16670-16745`.

`getAllPickableExercises()` builds its list keyed on the exercise **name**. When two
templates share a name, the first one encountered wins and later ones only widen the list of
equipment tiers it is offered under. Accessories are walked before the weekly pools, so:

> Searching "Good Morning" in the custom-session picker on a **bodyweight-only** profile
> returns a card reading **"Good Morning / Hamstrings / 3 sets · 12 · 30-60 kg"**. That is
> `sq-acc-fg-18`, the barbell lift, cue "Barbell on upper back". The genuine bodyweight
> template — `wfb-bw-hinge`, 3x12, Bodyweight — is unreachable. Verified in the running app;
> screenshot `custom-goodmorning.png`.

Six names are affected this way: Good Morning, Standing Calf Raise (shows a 40-80 kg
machine, hiding the 2x20 bodyweight version), Hanging Leg Raise, Ab Wheel Rollout, Chin-Up
and Shoulder CARs. The root fix is naming: `wfb-bw-hinge` is an unloaded hip hinge that has
been given the standard name of a barbell lift, and its own swap is literally called
"Bodyweight Hip Hinge" — renaming it resolves the collision without touching the picker.

The same tier-widening is what lets the injury screen hand a **Barbell Bench Press** to a
user with no equipment (414 times in the sweep), and it makes **201 templates permanently
unreachable** from the picker — the picker returns 440 rows against 652 ids actually served,
while the paywall advertises "661+ exercises".

### 3b. The same exercise served twice in one session, under two names, at two weights

**Severity: high · objective.** `lib/workout-engine.ts:1138` and `877-1030`.

When a user reports an ache, the substitution logic blocks duplicates by comparing raw
template names — but by that point the session's names have already been rewritten by the
kettlebell renamer, the grip-variant logic and comfort-variant swaps, all of which keep the
template id and change only the label. The result is the same exercise id appearing twice in
one session under two names with two different prescribed loads.

Reproduced **1,380 times across 90,720 generated sessions**, in 23 distinct name-pair
patterns. Worked example — lower body, kettlebells, low energy, 60 minutes, knee pain:

```
slot 6:  "KB Good Morning"   id=sq-acc-db-7   3x12 @ 8-8 kg
slot 8:  "DB Good Morning"   id=sq-acc-db-7   3x12 @ 8-14 kg
```

The user does the same movement twice believing it is variety, and anything keyed on
exercise id — progression, last-logged weight, the clean-session streak — sees one id logged
twice in one session with conflicting weights. This fires in about 1.5% of all generated
sessions and always on the ache path, which is precisely when a user is paying most
attention to what the app hands them.

### 3c. Different exercises with the same name share one history row

**Severity: medium · objective.**

Completed sessions store the exercise **name** as the history key (this is deliberate — the
alias file exists specifically because renaming an exercise "silently splits every user's
history in two"). Four pairs are severe because one version is bodyweight and the other is
loaded, and no alias covers them:

| Name | Version A | Version B |
|---|---|---|
| Good Morning | 3x12 @ 30-60 kg barbell | 3x12 Bodyweight — *and this is the hinge slot of every bodyweight full-body session, so it fires for real users* |
| Standing Calf Raise | 3x20 @ 40-80 kg machine | 2x20 Bodyweight |
| Single Leg Hip Thrust | 3x12 Bodyweight | 3x12 @ 16-24 kg |
| Lying Hamstring Curl | dumbbell-between-the-feet floor curl, 6-14 kg | machine lying curl, 30-50 kg — a user upgrading to a gym gets one chart mixing 10 kg and 40 kg entries, a fake 4x jump |

The reverse error also exists: the *same* movement under two spellings, splitting history in
two. "Dead Hang" vs "Dead Hangs" (bodyweight tier vs gym tier), "Stiff Leg Deadlift" vs
"Stiff-Leg Deadlift" (the second is a swap name, and swaps are logged under the swap's
name), "DB Skull Crusher" vs "DB Skull Crushers", "Supine Hamstring Stretch (strap)" vs
"(Strap)" — the last two differ by a single letter's case and appear as two separate rows in
the picker, one labelled "Neck flexors" and the other "Hamstrings".

### 3d. Near-duplicates that let one session serve the same thing twice as "variety"

**Severity: medium · objective/judgment.** Measured by generating tens of thousands of real
sessions and counting how often each pair co-occurs:

| Pair | Sessions where both appear |
|---|---|
| "Doorway Chest Opener" (prep) + "Doorway Chest Stretch" (prehab) — near-identical cues, one opens the session and one closes it | 990 |
| "Thoracic Extension on Floor" + "Thoracic Extension (foam roll)" | 828 |
| "Hip Flexor Kneeling Stretch" + "Hip Flexor Stretch" | 774 |
| "Goblet Squat" + "DB Sumo Squat" + "Sumo Goblet Squat" | 285 (12 sessions contain all three) |
| "Barbell Row" + "Barbell Bent-Over Row" | 279 |
| "DB Good Morning" + "Good Morning" | 216 |
| "Standing Hamstring Reach" + "Standing Hamstring Stretch" | 144 |
| "Chest Supported Row" + "Chest-Supported DB Row" (3x15 @ 12-20 kg alongside 3x10 @ 5-10 kg) | 108 |
| "Inverted Row" + "Australian Pull-Up" — the same movement, "Australian pull-up" being simply the informal synonym | 72 |

Others in the same shape: "Standing Long Jump" whose swap is "Broad Jump" (synonyms — tap
swap, get the identical exercise, and the rest of the database consistently calls it Broad
Jump); "Cable Tricep Pushdown" and "Straight Bar Pushdowns" (the same straight-bar pushdown
with near-identical cues); one supine figure-4 hip stretch existing under **three** names,
two of which ("90/90 Hip Stretch") describe a completely different position that the
database elsewhere calls "90/90 Hip Switch".

A related pattern the owner should look at: the finisher pool is chosen without checking
what the session already contains, so sessions repeatedly end with intervals of a movement
they already did — "Leg Press" then "Leg Press Intervals" 192 times, "Goblet Squat" as the
main lift then "DB Goblet Squat Easy Pace" 192 times, "Romanian Deadlift" then "DB Romanian
Deadlift Intervals" 144 times. Some of this is defensible programming; at these frequencies
it starts to read as the app running out of exercises.

### 3e. Kettlebell branding shown to dumbbell owners

**Severity: medium · objective.** The engine relabels dumbbell terms as kettlebell terms for
kettlebell users, but there is no reverse. So dumbbell-only users are prescribed "KB Swing",
"KB Swing EMOM", "KB Deadbug", "Circuit A: KB Swing…" at "14-18 kg KB", "Circuit B: KB
Snatch…" and a warm-up cue reading "light KB swings" — all naming kit they explicitly said
they do not own. Every one of these movements works with a dumbbell; nothing in the name,
cue or load ever says so.

---

## 4. Metadata that is simply wrong

*32 findings.* This section splits cleanly into what a user can see today and what is a trap
for later.

### 4a. User-visible: the muscle label under an exercise's name in the picker

**Severity: high · objective.** The custom-session picker renders each exercise's
`primaryMuscle` as its subtitle. Where the name is unique in the database, that label is
exactly what the user reads. Many of them are wrong:

| Exercise | Labelled as | Should be |
|---|---|---|
| Sled Push Intervals, Sled Push/Pull Complex, Prowler Push/Pull + Bike, two sled circuits | **Pectorals** (with Triceps/Anterior deltoid as secondaries) | quads/glutes — their own cues say "drive through legs" |
| Prowler Drag (light) — cue "Face sled, drag backward" | **Latissimus dorsi**, movement pattern "pull" | a backward sled drag is quad-dominant |
| Supine Hamstring Stretch (strap) | **Neck flexors** | hamstrings |
| Nordic Curl Negative | **Biceps** | hamstrings |
| Soleus Stretch, Couch Stretch, Pigeon Pose | **Core** | calf, quads, glutes |
| Pallof Press (both copies), Band Pushdown | **Pectorals** | core, triceps |
| Bicep Stretch (arm back) | **Thoracic extensors** | biceps |
| Tibialis Raise | **Calves** — the antagonist | tibialis anterior |
| Wrist Extensor Stretch, Band Finger Extension (whose own cue says it strengthens the extensors) | **Forearm flexors** | forearm extensors |
| Every Band Pull-Apart and Face Pull (six entries) | **Latissimus dorsi** | rear delts / rhomboids |
| Every Hip Flexor Stretch (three entries) | **Glutes** | hip flexors |
| Cable External Rotation (a rotator-cuff drill) | **Hip flexors** | infraspinatus — the correct value is on the identically-named entry elsewhere in the file |
| Arm Speed Drill (an arm-swing shoulder primer) | **Hip flexors** | deltoids |
| Jump Rope Intervals, Light Sled Drag, Battle Rope EMOM, DB Complex, DB Man Maker | **Core**, movement pattern **mobility** | placeholder block, pasted five times |
| Legs-Up-The-Wall (a passive restorative inversion) | **Hip external rotators** | describes a figure-4 stretch, not this pose |

Two movements even contradict *themselves* across copies: the medicine-ball slam is
"Pectorals" in two blocks and "Latissimus dorsi" in a third (the third is correct), and the
power clean is "Glutes" in one block and "Hamstrings" in another.

Also visible in the picker: **movement-pattern chips**. All three calf raises are tagged
`push`, so the Standing Calf Raise card literally reads "ACCESSORY / PUSH (HORIZONTAL) /
ISOLATION / BEGINNER" (screenshot `custom-Standing-Calf-Raise.png`); Hanging Leg Raise reads
"PULL (HORIZONTAL)". Leg Extension, the Adductor Machine and Cable Crunch — all dynamic
exercises — are tagged `isometric`; a Banded Lateral Walk is tagged `rotation`. The same
field also drives the engine's "diversify by movement pattern" logic, so a bench session's
push-diversity counts a calf raise as a push. And the **"· unilateral"** label is missing
from roughly half the per-side drills ("6 slow each side", "8 each side") while present on
comparable neighbours.

Finally, **difficulty badges** are user-visible filter chips, and they contradict their own
buckets: four hard-bucket finishers are labelled *beginner*, including an 8-minute DB Man
Maker AMRAP and an 8-minute DB Complex EMOM; three easy-bucket finishers are labelled
*intermediate*. "Bear Crawl Intervals" is intermediate in one pool and beginner in another;
"DB Man Maker" is advanced in one and beginner in another. A user filtering for "beginner"
is offered an eight-minute man-maker AMRAP.

### 4b. Load text that could get someone hurt or waste their session

**Severity: medium · objective.** A goblet squat is by definition **one** bell held at the
chest with both hands. Six entries prescribe it "per hand":

- `sq-main-db` Goblet Squat — "**16-28 kg per hand**", cue "Elbows inside knees", prescribed
  as a beginner main lift. Read literally that is up to 56 kg.
- Its comfort variant, "12-16 kg per hand".
- The Goblet Squat Primer at both tiers — "8-12 kg per hand" and "12-16 kg per hand" — for
  what is meant to be a light activation drill.
- Two conditioning entries — "10-16 kg per hand", "12-16 kg per hand goblet".

The file itself gets it right elsewhere ("12-16 kg", "8-12 kg" with no per-hand), so these
are copy-paste slips. The same error appears on hip thrusts, which use a single dumbbell
across the hips: `sq-acc-db-2` and `dl-acc-db-1` both say "16-24 kg per hand" against a cue
reading "DB on hips", and the same movement is quoted as "20-32 kg per hand" when referenced
as a swap — three different figures for one exercise.

### 4c. Inert today, a trap tomorrow

**Severity: low-medium · objective.** The `equipmentRequired` field is wrong at scale. The
audit found roughly 90 wrong values across the file. Some highlights:

- **All three barbell KPI main lifts — Back Squat, Barbell Bench Press, Barbell Deadlift —
  declare `equipmentRequired: 'dumbbells'`.** These are the three exercises the entire
  progression system is built around.
- All three dumbbell mains declare `'bodyweight'`. A bodyweight Depth Jump declares
  `'barbell'`. A Chin-Up declares `'dumbbells'`. A DB Shrug declares `'kettlebell'`.
- Band-requiring exercises declare `'bodyweight'` (Lateral Band Walk, Banded Lateral Walk,
  Spanish Squat, Banded Glute Bridge, Band Bicep Curl, External Rotation (Band)) while
  band-free exercises declare `'resistance bands'` (Glute Bridge Pulse, Cossack Squat, Wide
  Push-Up, Pull-Up, Donkey Kick, Ab Wheel Rollout). **The field is inverted precisely where
  it would be needed to fix section 2.**
- Bear crawls and an assault bike declare `'barbell'`. Cable and machine exercises declare
  `'barbell'` throughout.
- Three incompatible vocabularies are in use at once: tier names (`bodyweight`, `fullgym`),
  item names (`barbell`, `dumbbells`, `resistance bands`), and one-off values (`machine`,
  `cable machine`, `foam roller`, `kettlebell`) that match nothing.
- **All 48 weekly templates omit the field entirely** — the only exercises in the database
  missing it.

Today the field is read in exactly two places (filtering the cardio warm-up pool, and a
fallback in the plate calculator that looks for a string value this data never uses), so
there is no live bug from it. But the interface comment declares it exists for "future smart
selection", and any consumer built on it inherits this. The owner's decision is whether to
correct it wholesale or delete it.

Two smaller items in the same bracket: the plate calculator's exercise-name pattern matches
"hip thrust" and "overhead press", so a **barbell plate calculator button appears on a
bodyweight Single Leg Hip Thrust and on a dumbbell "Standing Overhead Press"** — the root
cause again being naming, since "Standing Overhead Press" is the standard name for the
barbell lift and has been given to a dumbbell movement. And the section comment on the
targeted-prehab data says it covers "11 pain regions" when it contains 19.

---

## 5. Cueing, safety and difficulty grading

*12 findings.* This is the smallest group, and that is a genuine positive: **not one unsafe
cue was found in the entire 16,969 lines** by any of the ten auditors who read them. Only 3
of 652 cues are under 40 characters and none are placeholders. What follows is a short list
of specific problems, not a pattern.

**The one entry worth acting on:**

> **A Nordic curl inside the hamstring-pain rehab circuit, graded "beginner".**
> `ph-r-hm-3` prescribes 3 sets of 5 slow Nordic hamstring negatives with a 5-second
> eccentric. This is the single most intense hamstring eccentric there is, and it is served
> when a user reports **hamstring pain** — every other entry in that circuit is gentle
> stretching and hinging. It has no swap and no injury-friendly alternative, while the same
> movement elsewhere in the database carries "Partial Nordic Curl" as its easier option. It
> also requires the ankles anchored by a partner, rack or couch, in a section that claims to
> be equipment-agnostic. **Severity: high · judgment** — the grading is defensible only if
> someone decides it is; nobody appears to have.

**Cues that are not performable from the text alone:**

- **"Band around neck"** — the Banded Good Morning appears four times and every copy cues
  the band around the *neck*, never mentioning that you must stand on the band. Without the
  under-foot anchor there is no resistance at all, so the setup cannot be reproduced from
  the text; and telling a beginner (this entry is graded "beginner") to rest a tensioned
  elastic against the front of the neck is both uncomfortable and a snap-back hazard. The
  standard setup is the loop across the upper traps. The same truncated text is repeated in
  three comfort-variant cues and once more on a *fast* hinge variant, where cervical loading
  matters more.
- **Adductor Rockback** is cued "Wide stance, rock into each hip". It is a quadruped drill —
  kneel, one leg out to the side, rock the hips back. "Wide stance" with no mention of
  all-fours reads like a standing lateral shift. The exercise's own comfort variant gives the
  game away by advertising "no wide-stance or all-fours demand".
- **"Speed Squat Ramp (bar only)"** cues "zero load, maximum intent" while its suggested load
  says "20 kg". An empty bar *is* 20 kg; the copy contradicts the field.
- **"Lat engagement (protect armpits)"** on the barbell deadlift is coach shorthand a general
  user will not parse; every other cue in that pool is plain instructional language.

**Things that read as unserious or mis-scaled:**

- "Med Ball Slam (Simulated)" tells no-equipment users, if they have no ball, to "slam your
  palms on a soft surface or **against thighs**". Miming a ball slam by slapping your own
  thighs delivers no load; three genuinely bodyweight alternatives already exist in the same
  pool.
- **Clap Push-Up (difficulty: advanced, 5 sets of 3) is the only power option for both the
  bodyweight and the dumbbell bench pools**, and nothing anywhere in the engine reads the
  difficulty field. A beginner who ticked the "power" goal is prescribed five sets of an
  advanced plyometric with real wrist and face-plant risk.
- The **"easy" bodyweight conditioning** bucket — served to users who reported *low* energy —
  prescribes 3x20 squats, 3x15 push-ups with "no rest between sets", 3x20 lunges and 3x30s
  mountain climbers back to back. 45 strict push-ups with no rest is beyond many beginners
  on a good day. Conditioning templates are the only pool in the database with no swap
  blocks at all, so there is nothing to scale down to.
- **"Deadlift Drop Set"** — 3 sets of 8/10/15 barbell deadlifts starting at 70% of working
  weight, appended *after* a full deadlift session — and **"Leg Press 50s Drop Set"**, 150
  total reps as a finisher. High-rep deadlifts under accumulated fatigue are exactly where
  form degrades and lower backs go. Both are graded advanced and only reachable on a
  high-energy day, which mitigates it. Every other hard finisher in the range is
  conditioning-style rather than heavy-barbell-to-fatigue. **Judgment — the owner should
  confirm these belong in a product branded for rehab.**
- **Plate Pinch Holds** prescribes two 10 kg plates pinched smooth-side-out for 30 seconds
  per hand. That is a serious grip feat, over-pitched for a general population.

**One calibration question:** the full-gym weekly pools seed higher starting loads than the
KPI pools for the same movements — Back Squat and Bench "60-100 kg" and Barbell Bulgarian
Split Squat "40-70 kg" in the weekly pool, against a canonical Back Squat main of 60-90 kg
and bench of 50-80 kg. These do get scaled by profile afterwards, so this is a seed-choice
question rather than a bug, but a weekly-session user starts from a hotter anchor than a
KPI-session user for the same lift and it should be deliberate.

---

## 6. Gaps in the catalogue

*8 findings. All judgment calls for the owner.*

- **No lateral raise exists anywhere in the full-gym tier.** Across every pool a full-gym
  user can reach — prep, priming, power, mains, accessories, finishers, weekly, prehab —
  there is not one lateral or side raise. Their deltoid options are anterior only (overhead
  press, cable front raise, landmine press) plus rear delt. Dumbbell users get four lateral
  raise variants, and because the engine resolves to exactly one tier bucket, a full-gym user
  cannot reach the dumbbell pool. The lateral raise is the single most common side-delt
  movement in any gym; its complete absence is likely to be noticed. Smaller gaps at the same
  tier: no shrug or trap work at all, and rear-delt flyes exist only as a priming drill,
  never as an accessory.
- **Bodyweight squat-day priming contains no squatting.** All five options in that pool are
  hip/glute activation. Both other tiers include a knee-flexion pattern primer (Goblet Squat
  Primer, Leg Press Activation). A tempo air squat or wall sit would fill the slot at zero
  equipment cost.
- **Bodyweight squat prep contains no ankle mobility**, while both other squat tiers dedicate
  a slot to ankle dorsiflexion whose own cue says it "improves squat depth" — and ankle
  restriction is, if anything, more limiting for deep unloaded squats. The drill needs no
  equipment; no-equipment users simply never receive it.
- **The wrist pain circuit is one exercise short.** Nineteen of the twenty targeted-prehab
  regions hold five exercises; wrist holds four — a leftover from the elbow/wrist split.
  A wrist-pain user's targeted session is six exercises where everyone else's is seven.
- **Every targeted prehab session, for every body region, ends with a hip stretch.** The
  fixed cooldown is a supine figure-4 hip stretch, appended to all twenty regions. A user who
  opens a targeted session for their wrist, neck, elbow, bicep, tricep, chest, shoulder,
  upper back or lats is finished off with a hip stretch that has nothing to do with what they
  selected — 14% of every targeted prehab session is off-target. Related: three regions are
  near-copies of each other (glutes and hip/groin share four of their five exercises; upper
  back shares four of five with both lat/mid-back and rear shoulder).
- **Accessory pool depth varies almost 2:1 between tiers.** A bench-day full-gym user rotates
  through 23 accessories; a bench-day bodyweight user through 14, and a squat-day dumbbell
  user through 14. Two accessories are drawn per session, so the thin pools repeat noticeably
  sooner — and the bodyweight and dumbbell tiers are where new and unequipped users start,
  i.e. where variety matters most for retention. (Every other pool is uniform across all nine
  combinations.) Compounding this, five of the seventeen squat-bodyweight slots are variations
  of supine hip extension.
- **Not one exercise in the database has a demo video.** All 652 served exercises have an
  empty `videoId`, so every "watch demo" tap sends the user to a YouTube search results page
  rather than a chosen demonstration. The fallback is by design and nothing is broken; the
  curated path simply has zero coverage. The code comment describing how to fill it in says
  "no code, no release, just data".

---

## What is actually in good shape

Worth stating plainly, because the rest of this section is a list of problems and the
underlying content does not deserve the impression that leaves:

- **Cue quality is genuinely good.** Ten auditors read every cue in the file and found no
  unsafe instruction. Only 3 of 652 cues fall under 40 characters and none are placeholders.
  The rehab cues in particular are clinically sound and safety-conscious ("never force", "no
  pulling"), and the anatomy described in the cue *text* is usually correct even where the
  metadata field beside it is wrong.
- **Field discipline is complete.** Zero exercises are missing a movement pattern, a
  difficulty or a primary muscle.
- **The deadlift bodyweight priming pool is entirely clean of equipment leaks** — proof that
  the equipment constraint was applied deliberately somewhere, and that the leaks elsewhere
  are oversights rather than a missing concept.
- **Generated sessions filter the cardio warm-up pool by equipment correctly.** The machine
  warm-up leak is confined to the custom-session picker.
- **Sets, reps and loads are sane throughout** for the population each bucket serves, with
  the specific exceptions named in section 5.

The database's problem is not missing data or bad coaching. It is **duplicate identity** —
the same movement existing several times under several names with different tags — and the
fact that three of the four lookup tables built from it were never updated when new
collections were added.

---

# Track 2 — Progression system

**Verdict: the progression engine does not deliver the app's core promise, and in
several places it does the opposite of what it tells the user it is doing.**

This track was simulated at full fidelity: the auditor imported the app's *real*
state store and *real* workout engine and ran them under Node, then confirmed
the headline results by driving the actual app in a browser. Numbers below are
measured, not inferred.

---

## The five critical findings

### C1. Answering "Too Hard" or "Challenging" does not change the weight you are given

**Where:** `app/session.tsx:580-589` (the weight-field refresh), against the rule
written at `lib/auto-regulation.ts:29-38`.
**Severity: critical · objective**

The app's own code states the rule in plain terms: *"The app must never increase
the load after 'Challenging' or 'Too Hard'... answering that honestly must never
be punished with more weight."* The calculation obeys this. **The screen does
not.**

The weight box is filled in at the moment a set is ticked off — which happens
*before* the user is asked how it felt. When the answer arrives, the explanatory
note updates and the little grey "guide" number updates, but the number in the
box the user actually submits never moves.

The result is three different numbers on screen at once for the same set. Live in
the app, on a Romanian Deadlift: the card said *"Target weight: 65-107.5 kg"*,
the hint said *"57.5 kg guide"*, the note said *"Down 10% — no more increases
this exercise"*, and the box the user taps "Did It" on contained **65**. This was
confirmed on both a main lift and an accessory, with a 3.5-second pause to rule
out a timing glitch.

**Consequence:** every automatic adjustment in the app, in both directions, is
decoration. A user who reports a set was too hard is handed the same or heavier
weight while being told it was eased off.

---

### C2. Warm-up sets count towards the "was that easy?" score, so the biggest possible jump is the default

**Where:** `lib/auto-regulation.ts:244-250`, `app/session.tsx:2196-2202`.
**Severity: critical · objective**

After every set the user must answer Easy / Challenging / Too Hard — the session
cannot continue until they do. The tally counts **all** sets, including the four
warm-up sets. Two "Easy" answers produce the top rating, which is the **+7.5 kg**
step.

The app's own warm-up cues tell the user those sets will be easy: *"Set 1: Very
light warm-up (~17.5 kg) — just waking up the pattern"*. So a user answering
honestly earns the largest possible jump **every single session**. Meanwhile the
"steady" +2.5 kg step is only reachable by calling a warm-up the app just
described as very light "Challenging".

Confirmed end-to-end in the running app: answering Easy on only the two warm-ups
and Challenging on the four real sets produced the top rating and pushed the next
session from a 40 kg anchor to 47.5 kg.

---

### C3. Nothing caps the weight — 165% of the user's own tested max by session 18

**Where:** `lib/workout-engine.ts:496-524`, `lib/store.ts:396-424`.
**Severity: critical · objective**

Once an exercise has a logged weight, the next suggestion is simply *last weight
+ step*, where step is only ever 0, +2.5, +5 or +7.5. There is no ceiling, no
reference back to the user's tested max, no deload, and no point at which the
increase stops.

The "3 clean sessions earns +5 kg" bonus also never turns off — the streak
counter keeps climbing (4, 5, 6 … 18), so from the fourth clean session onwards
the step is permanently +5. **The +2.5 kg step happens exactly twice in a user's
lifetime.**

Simulated with the real store: an intermediate lifter who enters a tested 100 kg
bench max is prescribed 85 kg in session 1 and **165 kg in session 18** — 165% of
his own max — under the reassuring note *"Bumped up — 17 clean sessions in a
row"*. The only brake in the entire system is the user physically failing the
lift, which for a bench press means getting pinned under the bar.

---

### C4. A weight range is misread as a two-set ladder, prescribing the top of the range as a working set

**Where:** `lib/workout-engine.ts:2095`.
**Severity: critical · objective**

229 loads in the database are written as ranges ("30-47.5 kg"), which read as
exactly two numbers. The code treats "two numbers and two sets" as a deliberate
set-by-set ladder — so a two-set exercise gets *bottom of range, then top of
range*, with no warm-up ramp at all.

Full-body sessions force everything to two sets whenever the session is under 60
minutes or energy is low, so this fires on one of the app's most common
configurations. **945 of 3,600 generated prescriptions are affected (26%).**

Confirmed live: a brand-new advanced user with no history at all was offered Back
Squat **set 1 = 65 kg, set 2 = 107.5 kg**. The identical user on a lower-body day
got a sensible 32.5 → 42.5 → 57.5 → 65 kg ramp.

This is a one-line fix and it is the single highest-value change in the report.

---

### C5. "Same weight again" is displayed while a heavier bar is pre-filled

**Where:** `app/session.tsx:580-589`.
**Severity: critical · objective**

The same root cause as C1, but worth stating separately because of how it reads
to the user. Driving a real bench session and answering "Challenging" on all six
sets produced pre-filled weights of 17.5 → 23 → 30 → 30 → 35 → 40 kg while the
note said *"Same weight again — you said that one was challenging"* every time.
The user was told nothing changed while the weight climbed 22.5 kg.

---

## High-severity findings

| # | Finding | Where |
|---|---|---|
| H1 | **Test week demotes every goal except strength/power.** The test is set at 90% of current working weight, which only makes sense if that weight is already near-max — true only for strength/power. Reps needed just to *stand still*: strength 9, power 7, muscle 14, fitness 18, fat-loss 21, **rehab 36**. A rehab-goal user — the audience the product is named for — is mathematically guaranteed a cut at every test cycle. | `app/session.tsx:2711-2730`, `lib/workout-engine.ts:364-377` |
| H2 | **One bad test day overwrites the working weight**, while the PB display keeps the old best. After a bad day the app showed a 144 kg personal best while prescribing 65 kg, with no explanation. Recovery takes 5+ sessions. | `app/session.tsx:2717-2727` vs `lib/store.ts:1227-1232` |
| H3 | **A single mistyped weight poisons progression permanently.** Logging 400 kg on a 50 kg squat makes 400 the anchor; the user then can't complete 405 kg, which makes the state "failed", which *holds* at 400 — forever. The only escape is typing over the prescription. The 400 kg also becomes a permanent personal best. | `app/session.tsx:2768-2778`, `lib/workout-engine.ts:496-506` |
| H4 | **No time-awareness whatsoever.** Returning after 38 days or 368 days produces a byte-identical, still-progressing prescription. The app *knows* time passed (streaks reset, bodyweight reminder fires) — that information simply never reaches the load calculation. For a rehab-positioned app this is the wrong default. | `lib/workout-engine.ts:816-847` |
| H5 | **A stored 1RM is ignored by upper/lower/full-body sessions.** The same user, same day, was offered Back Squat at **120 kg** on a KPI day and **45-75 kg** on a lower-body day — a 2.7× difference for the same movement. | `lib/workout-engine.ts:1758-1770` |
| H6 | **Precedence answered definitively (see below).** Rating "Too Hard" can still *raise* next session's weight, because the anchor is the heaviest weight touched regardless of what the user said about it. | `app/session.tsx:2768-2788` → `lib/workout-engine.ts:482-505` |
| H7 | **Noisy feedback ratchets upward only.** A user rating "Too Hard" on six of twelve sessions still gained 30 kg. Rating it hard *every* session pins the weight forever with no reduction. | `lib/workout-engine.ts:496-524` |
| H8 | **An in-session "Too Hard" is reported back as "a set was left incomplete".** Factually wrong about what the user did, and it hides the fact that their honest answer caused the hold. | `lib/workout-engine.ts:754-758`, `app/session-summary.tsx:204-207` |
| H9 | **"We adjust the weight automatically" for energy is false.** Energy only changes the number of sets. Worse, dropping a set compresses the warm-up, so on the day the user felt worst the jump into the working set is *bigger*. | `app/readiness.tsx:79` vs `lib/workout-engine.ts:1384-1385` |
| H10 | **Agreeing twice shrinks the jump.** Rating sets easy in-session (earning +7.5) and then tapping thumbs-up or "that was too easy" on the summary — both meaning *give me more* — reduces the next jump to +5. The "too easy" button does the opposite of what it says. | `lib/store.ts:888-951` |

---

## The precedence question, answered definitively

The readiness brief asked: *if a user rates an exercise "easy" but logs a heavier
weight than last time, does the system still progress them correctly?*

**The formula is:** `next = heaviest weight you completed + step chosen by your rating`.

The logged weight is the anchor; the rating only picks the step size; the
separate thumbs multiplier is **not** applied on top (so there is no
double-counting). Concretely:

- **Easy + logged heavier → correct.** Prescribed 40, logged 45, rated easy →
  next session 50 kg. Built on the logged weight once, not twice. This works as
  intended.
- **Too Hard + logged heavier → wrong.** Prescribed 40, logged 45, rated too hard
  → next session **45 kg** — *higher than the weight the user just rejected*,
  under the note "Held steady".

So feedback can never *block* progression built on a logged weight, but it also
can never reduce it. The in-session back-off is undone the same way: the app
lowers the bar after "Too Hard", but the heaviest weight touched is still what
gets saved, so the reduction never survives to the next session.

---

## Medium and low findings (summary)

- **Pounds users get unloadable weights.** Storage and conversion are correct —
  switching units mid-programme does *not* corrupt history, which I checked
  specifically. But every rounding decision is in 2.5 kg steps, so a lbs user
  sees a constant **11.0 lb** progression step and fractional targets no gym's
  plates can make. The card text and the input box also round differently (143
  vs 143.3).
- **Repeating the same weight in lbs fires a false "new PB"** for 48 of 120
  weights, because the unit round-trip lands fractionally above the original.
- **14 exercises show a target weight on the card but refuse to accept one**,
  blocking "Did It" until the user types something the app never suggested.
- **Bodyweight and onboarding 1RM have no upper limit.** A typo produces an
  absurd prescription that the session screen then *refuses to accept* (500 kg
  ceiling), leaving the user stuck with no explanation.
- **Comfort-variant sessions add weight on a day the user reported pain**, and
  show no progression note at all because the note looks up a different key.
- **"Held steady" is shown when the weight actually dropped** — a failed top set
  silently re-baselines the anchor downward, an undocumented auto-deload.
- **The thumbs multipliers are dead code** for any exercise with a logged weight.
  This is the only mechanism in the codebase that could ever *reduce* a load, and
  it is unreachable.
- **A self-reported 1RM is trusted at full percentage on day one** — 85% of a
  number typed from memory, for 5-6 reps, with no confidence ramp. *(Judgment
  call: whether to discount the first block is a product decision, but the 2.7×
  gap between the "typed a max" and "didn't" paths deserves a deliberate answer.)*

---

## What the auditor recommends looking at first

Two changes, in this order:

1. **`lib/workout-engine.ts:2095` — one line.** Require that the two numbers
   aren't simply a range before treating them as a ladder. Fixes 945 of 3,600
   prescriptions, including the 107.5 kg first-session squat.
2. **`app/session.tsx:581-589`.** The weight box must re-derive when the
   recommendation changes, not only when the set index changes. Until this is
   fixed, every auto-regulation adjustment in the app is cosmetic.

---

# Track 3 — Screens, flows and data consistency

**Verdict: the screens work and are pleasant to use, but the app repeatedly tells
the user something different from what it has actually recorded — about their
weights, their muscles, their pain and their account. One defect can put another
person's training history on your phone, and one can put burpees into a session
you asked for because your knee hurts.**

Ten auditors drove the *real* app in a browser as different people — beginner and
advanced, male and female, bodyweight-only through full gym, and one profile
carrying an active pain flag — completing full sessions and reading every screen.
An eleventh strand imported the real workout engine and simulated 30 consecutive
days across eight training streams. Every number below was measured in a running
app or a running engine, not read off the code.

---

## The four critical findings

### 1. Signing in as a different person on the same device inherits the first person's entire training history — and overwrites their account with it

**Where:** `lib/auth-context.tsx:239-251` (sign out) and `:224-230` (sign in),
with `lib/store.ts:1345`.
**Severity: critical · objective**

Signing out clears the login token and nothing else. All of the training data —
sessions, tested maxes, bodyweight, badges, even the user's name — stays on the
device. When the next person signs in with their own email, the app asks the
server for their data; if the server has none, which is the case for a new
account, it **uploads the data already sitting on the phone to that new account**.

Reproduced end to end. Signed in as one email, completed a squat session, signed
out, signed in with a different email: the home screen greeted the new user by
the *old* user's name, and their stored data held 1 session, 10 badges, 3 tested
maxes and the old user's 80 kg bodyweight. Because working weights are calculated
from those tested maxes, the second user is then prescribed loads derived from
the first user's strength.

There is a second half to this. Even for an account that *does* have data on the
server, the merge only accepts it when the server has **more** sessions than the
phone. A returning user whose device holds someone else's longer history will
never load their own.

### 2. The pain severity the user picks is thrown away before it reaches the workout

**Where:** `app/session.tsx:1989-1997`; `lib/workout-engine.ts:1164`.
**Severity: critical · objective**

The readiness check asks Mild / Moderate / Severe and puts the answer in the web
address of the session. The session screen reads it, and saves it onto the
completed-session record. But the object it hands to the workout generator
contains only *has aches, region, energy, time* — severity is simply not in it. I
confirmed this line by line in the repo.

The engine falls back to "mild" every time, so the rule written to drop the
explosive block and the finisher at moderate and above never fires. Live in the
app, on an intermediate / dumbbells / 45-minute profile with knee pain, Mild,
Moderate and Severe all produced the **identical 10-exercise session**, including
*"Step-Over High Knee March — 3 sets x 5 explosive reps"* and *"Shuttle Run
Intervals — 6 min, 20 m sprints"*. Calling the engine directly with the severity
supplied produces 11 exercises instead of 13, so the logic works — it is purely a
missing connection.

Two comments in the codebase contradict each other about whether this is meant to
happen. Only the one that says severity does nothing matches reality.

### 3. The safety screen swaps burpees, squat jumps and sprint intervals *into* the session, and captions them "to protect your knee"

**Where:** `lib/exercise-safety.ts:74-100`; `lib/exercise-db.ts:11781`, `:10919`,
`:11727`.
**Severity: critical · objective**

When the user reports pain, the app removes movements that would aggravate it and
replaces them. It decides what is risky by reading the exercise's **name only**.
Several exercises in the catalogue hide their impact in the rep description
instead of the name, so they carry no risk marking at all and are treated as safe
for every complaint — which means they are eligible to be chosen as the
*replacement*.

The worst is an exercise literally called "AMRAP Finisher", whose rep line reads
*"8 min: 5 burpees + 10 squat jumps + 15 push-ups"*. A knee-pain bodyweight
session served it with the caption **"Swapped from Reverse Lunge + Knee Drive
Intervals to protect your knee"**. A lower-back session served the same exercise
captioned "to protect your lower back". A knee session served "Shuttle Run
Intervals — 20 m sprints" captioned "to protect your knee". A fourth served
"Dynamic Warm-Up", whose coaching cue is *"leg swings, arm circles, jumping
jacks, butt kicks"*, again captioned as knee protection.

A catalogue scan found **15 distinct exercises** with jumping or sprinting in
their reps or cue and no impact marking. This is the one place in the app where a
wrong answer can injure someone: the user has said a joint hurts, the app has told
them it removed the offending movement, and what it put in its place is burpees.

### 4. One casual custom session permanently rewrites your main-lift baseline

**Where:** `app/session.tsx:1949-1963` and `:2766-2790`.
**Severity: critical · objective**

Exercises picked in a self-built "custom" session get no personalisation at all —
Back Squat is prescribed from the generic catalogue range. But whatever weight is
logged there is filed under the **same exercise identity as the real squat
session**, and the next real squat session anchors to it.

Measured on a profile with a 140 kg squat max: the custom session offered *"Target
weight: 60-90 kg"* and a 25 kg opening set; after completing it with a top set of
47.5 kg, the next proper Squat Session's card read **"Target weight: 50 kg"** —
down from 120 kg — under the note *"Nudged up, clean session last time"*. A
control run of the identical profile with no custom session in its history read
120 kg. There is nothing on screen telling the user this happened and no way to
undo it.

> **A fifth critical defect in this track is the weight pre-fill lag** — the
> number in the box never moves when the user answers "Too Hard" or
> "Challenging". Three separate agents hit it independently while driving real
> sessions here, including one frame showing the note *"Eased back to your last
> good set — no more increases this exercise"*, a *"42.5 kg guide"* hint, and
> **65** typed in the box the user is about to submit. It is reported in full as
> C1 in the Progression section; this track's evidence corroborates it and adds
> that the *same* stale-field mechanism is what breaks the swap tool, below.

---

## Does the app ever send a painful day to a rehab session? The definitive answer

This is the product's headline promise, so it deserves a plain answer.

**Yes, but on exactly one narrow path, and only as an offer the user has to
accept. Everywhere else the app substitutes individual exercises inside the
planned session and keeps going.**

The one real redirect: if the user reports pain, picks a region and selects
**Severe**, the readiness screen interrupts with *"That sounds like more than a
minor ache — A Recovery session targeting your knee might serve you better today
than Squat Session"*, and offers two buttons, "Switch to Recovery Session" and a
continue-anyway option (`app/readiness.tsx:1115-1126`). Taking the switch does
generate a real, correctly-targeted rehab session — the pain auditor completed one
and confirmed the exercises match the region. So the capability exists and works.

Everything else is substitution, not redirection:

- At **Mild** and **Moderate**, the planned strength session goes ahead. Banned
  movements are swapped for alternatives inside it. The session type never
  changes.
- Because of critical finding 2, Moderate is *identical to* Mild. The intensity
  drop that was supposed to distinguish them never runs. So in practice there are
  only two behaviours in the whole app: substitute-and-continue, or the severe
  interstitial.
- **"Not sure, train carefully"** — the button offered to anyone who is sore but
  cannot or will not pick a region — does nothing at all. It sends an empty
  region, the safety pass exits immediately, and the generated session is
  byte-identical to one where the user said they had no aches. Verified live: no
  "Adapted for" banner, no caution note, and *"Squat Jump — 3 sets x 5 explosive
  reps"* still in the session. **(High, objective.)** This matters more than it
  looks, because it is also the fallback for anyone defeated by the broken body
  diagram described below.
- Nothing in the app is ever *proactive*. There is no persistent injury or
  limitation on the user's profile — the profile holds only name, sex,
  experience, goals and bodyweight. Onboarding never asks about pain or injuries,
  despite its own pitch slide promising the app *"adapts to your equipment, energy
  and pain"*. The only thing that survives a session is the last region reported,
  and it has exactly one consumer in the entire codebase: a "Same as last time"
  shortcut on the pain step. Someone with a genuine long-term problem must
  re-report it, region by region, before every single session, and the app never
  learns from it. **(Medium, objective.)**

There is a bitter irony in the one path that does work: **taking the severe-pain
redirect records no pain at all.** The shared function that launches it hardcodes
"no aches" and never saves the readiness answer, so the last-pain-region memory
stays empty and the completed session is filed as pain-free. Every milder report,
where the user pushed on anyway, is remembered. The most serious one is forgotten.
**(Medium, objective.)**

### The pain screen itself is partly unusable

**Severity: high, objective.** On the pain step the body-diagram card is taller
than the space it is given and, because it is centred, it spills upward over the
controls above it and wins the tap. Measured at three phone sizes (390x844,
375x812, 430x932): tapping the centre of **"More than one area"** or **"Not
sore"** hits the diagram card instead, and neither does anything. Consequences:
multi-region pain reporting is unreachable by any user — the confirm button has an
"(N regions)" label that can never appear — the step has no visible heading, and
the chip confirming which region you picked is covered by the severity pill. The
web preview gives the screen about 20px less room than a real iPhone, but the
overlap measured 48px, so it should still be covered on device. Worth one device
check.

Two supporting items: the severity question **defaults to "Moderate" and renders
pre-selected**, so a user who taps their knee and hits Start has silently answered
a question they never read (low, judgment — inert today, but it becomes a real
problem the moment severity is wired up). And on the web build no region on the
body diagram can be selected at all, because the tap handler reads a coordinate
that browser mouse events do not carry; the same code is what makes it work on a
device, so this needs a device check before anyone treats it as broken (medium,
objective).

### The app invents pain the user never reported

**Severity: high, objective.** Choosing an area to *prehab* from the Restore tab
writes that area into the same field used for reported pain. Every pain display
then counts it as a complaint.

The pain auditor's reconciliation is the clearest evidence in this track. They
reported pain exactly twice across five completed sessions:

| What was actually entered | Session | Region | Severity |
|---|---|---|---|
| Reported pain | Squat (KPI) | Knee | Moderate |
| Reported pain | Bench (KPI) | Front Shoulder | Mild |
| Not asked about pain | Recovery, Targeted Prehab, Mobility | none | none |

What the app then showed:

| Display | What it shows | Verdict |
|---|---|---|
| Pain Patterns header | "3 regions flagged" | **Wrong** — should be 2 |
| Pain heat map, all time | knee, front shoulder, **rear shoulder** | Rear shoulder is invented |
| Region card, Rear Shoulder | "Rear Shoulder Pain · 1 all-time · 1 last 4 wks · OCCASIONAL · Worsening" | **Fabricated** |
| Last-4-weeks trend list | Front Shoulder worse, Rear Shoulder worse, Knee worse | Wrong twice, see below |
| History row chips | Prehab row carries a "Rear Shoulder" chip identical to the real ones | Indistinguishable from a real report |
| Severity (Moderate / Mild) | shown nowhere at all | Never surfaced |

The user is being told a joint they never complained about is getting worse.

Two further defects sit inside that table. **Any region reported for the first
time always reads "Worsening"** (medium, objective) — the trend compares the last
28 days against the 28 before, and for a first report the earlier window is empty,
so 1 beats 0 and the app prints a red warning chip. And **severity is write-only**
(medium, objective): it is asked for, stored on every session, and displayed on no
screen anywhere, so one severe episode and five mild niggles look identical in
every pain display.

### The Restore tab reports the wrong session as done

**Severity: high, objective.** Completing a **Recovery** session flips the
*Targeted Prehab* card to "Done today", while the Recovery card itself stays on
"Not tried yet" — permanently. The Recovery card looks for prehab sessions with no
label, but every Recovery session started from that screen is always given a
label, so the filter can never match. I confirmed both halves in the repo. After
five completed sessions the card still read "Not tried yet".

Alongside it, three smaller Restore items, all medium: **"Recovery" and "Targeted
Prehab" are the same feature shipped twice** — same picker, same function, same
resulting session, only the label differs (judgment); **a session started as
"Mobility" is called "Flexibility"** on the session header, the certificate, the
history row and the stats breakdown, so the one name the user chose is the one
they never see again (objective); and **a region-targeted prehab session's summary
never shows the region it targeted** — a rear-shoulder session reports "Muscles 3:
Traps, Lower Back, Core", because shoulders are classified as joints and filtered
out (judgment).

**Worth stating plainly, because it is good:** recovery and mobility work is
credited exactly like strength work everywhere else. It counts toward totals,
streaks, badges, history and the muscle map, and correctly does *not* advance the
strength test cycle. The auditor measured all six of those. That is the app's
thesis working as intended, and the Restore recency bug is the only place that
fails to honour it.

---

## Cross-screen data consistency: where the app contradicts itself

An auditor logged two complete sessions through the real interface, dumped the
stored data as ground truth, and reconciled **28 metrics** across Home, Stats (all
four sub-tabs), the session certificate, past-sessions, the calendar and the
program screen.

**22 of the 28 matched.** Session counts, weekly counts, the streak value itself,
the session-type breakdown and its filter link, total volume (10,940 kg),
weighted-exercise count, top weights, set counts, dates, tested maxes, personal
bests, achievement counts and the program position all agree with the stored data
and with each other. The week-bucketing logic is shared between the pill, the
chart and the history filter, so those cannot drift apart. That is a solid
foundation and it should be said before the failures.

Six did not match, and they fall into three causes.

### Cause 1: the same session's muscles are computed three different ways

Three screens answer "which muscles did I just work?" using three different rules,
and one of them uses its colour scale backwards.

**The session certificate paints the muscles you trained most in amber and red.**
**(High, objective.)** It colours a muscle by how many exercises hit it and feeds
raw counts into a scale that was written to mean *worked / needs attention /
overloaded*: 1 exercise renders green, 2-3 render **amber**, 4 or more renders
**red**. In a squat session, quads, hamstrings, glutes and lower back each got 2
exercises and came out amber, while calves and core, at 1 exercise each, came out
green. In an upper-body session, upper back got 4 exercises and came out **red**.
There is no legend on the certificate. The Stats screen maps the same data
deliberately and renders every one of those regions green, so the two screens show
opposite colours for the same session.

**All 48 Lower Body / Upper Body / Full Body exercises are missing from both
muscle-region lookups.** **(High, objective. Known as K8, but far larger than the
handover note says.)** A full upper-body session of bench press, rows and overhead
press contributes **zero chest, zero lats, zero biceps** to the Stats heat map. K8
named two exercises; the real scope is three whole collections and both lookup
tables, and it breaks the heat map, not just the name path.

**Stats silently drops comfort-variant exercises** — precisely the substitutes the
app makes when you report pain. **(High, objective.)** A squat session of Tempo
Goblet Squat and Box Sumo Squat listed Quads on the certificate and rendered quads
in the "not trained" grey on Stats. The user who trains around pain is exactly the
user who loses their data.

Underneath those, the two lookup tables **disagree with each other** even where
both are populated (medium, objective), so divergence will survive the fix above;
and generic warm-ups and the shuttle-run finisher resolve to no muscles at all in
either table (low, objective), so the hardest block in the session goes
uncredited.

### Cause 2: the same number is labelled or rounded differently in different files

| What | One screen says | Another screen says | Severity |
|---|---|---|---|
| Streak unit | Home "1 **WEEK** STREAK", Stats "1 Week Streak" | Certificate: "**1 day streak**". Same number, wrong unit. Five qualifying weeks would read "5 day streak". | high, objective |
| Session duration | Certificate "DURATION **0m**" | Stats history, calendar and past-sessions all say "**1m**". One rounds down, three round to nearest; a 47:40 session would read 47m and 48m. | medium, objective |
| Volume change | "TOTAL VOLUME 7,470 kg" then "4,813 kg" | "**2657.5 kg** less than last time". The difference is computed before rounding, so the three visible numbers cannot be reconciled. | low, objective |
| Bodyweight multiplier | In kg: "**1.8x** Deadlift" | In lbs, same account, same data: "**1.7x**". The ratio is computed from rounded display values, so a dimensionless number changes with the unit it is shown in. | medium, objective |
| Badge totals | "10 of **257** earned" | The four rarity counters 40px below total **277**. | low, objective |
| Deadlift subtitle | Home first-run card: "Back · Hips · Legs" | Train tab one tap later: "KPI · Hinge · Posterior Chain" | low, objective |
| Milestone plural | Every user's first session: "**1 sessions** and counting" on the certificate and "1 sessions completed" on Home | The most celebratory moment in the app | low, objective |

### Cause 3: lists are silently truncated, so two screens disagree about the same session

**Severity: medium, objective**, four findings.

Expanding a session row in History shows **at most 4 exercises**, with no "and 7
more". An 11-exercise, 23-set upper-body session showed four lines, dropping a
three-set 40 kg exercise entirely along with every warm-up and the finisher — while
the Progress tab, from the same stored data, correctly lists all five weighted
exercises. Separately, "Your heaviest lifts" says it shows the best weight *"for
each exercise, from any session"* and shows only the top six of nine, with no way
to see the rest; and because ties keep their insertion order, that list is headed
by a machine warm-up drill sitting above Back Squat. History filters **stack but
the heading names only one of them**, so a two-tap path from the calendar leaves
the list filtered to squat sessions under a heading that says only "Mon, Aug 10".
And the exercise drill-down promises *"tap one for full history"* then shows no set
history at all — three numbers, an empty graph and two-thirds of the sheet blank
(judgment).

### Three more places where the stored data and the screen part company

**Skipped exercises still count** toward the certificate's muscle map and its
headline "Muscles" number (medium, objective), even though everything else on that
screen correctly filters skipped sets out. Skipping the only calf exercise still
painted green calves and reported 6 muscles instead of 5.

**Deleting your most recent weigh-in leaves the app still using it** (medium,
objective). The entry disappears from the history list, but the profile header,
the strength ratios and the workout engine's calibration all keep the deleted
number. The delete is also a single unconfirmed tap on a bin icon, while every
other destructive action in the app confirms first.

**An estimate from the 1RM calculator is written into the same list Stats presents
as "Your tested maxes"** and as "Personal Bests, all-time bests highlighted with a
trophy" (medium, judgment). Nothing distinguishes a calculated number from a
tested one, and it drives future working weights.

Two smaller ones: the **Program screen promises a 12-session cycle and draws 9**
(12 dots, "Session 1 of 12" in the header, 9 rows below), and from session 10
onward the highlighted card and the highlighted dot point at different sessions
(medium, objective); and the **Program timeline labels future sessions "Today"**,
because every upcoming row prints when that session type was last done with no
label saying so (medium, objective).

---

## Session variety over a simulated month

Two auditors independently simulated 30 consecutive days per training stream by
stepping the app's own calendar forward one day at a time and calling the real
workout generator. Their numbers agree. "Overlap" is how much of one day's session
repeats the day before — lower means more variety.

| Stream | Main lift | Overlap day to day | Distinct exercises in 30 days | Verdict |
|---|---|---|---|---|
| Bench / full gym | Stable: Barbell Bench, 30 of 30 | 0.31-0.37 | 41-43 of a 47 pool | **Real variety** |
| Bench / bodyweight | Stable: Push-Up | 0.32 | 35 of 36 | **Real variety** |
| Squat / dumbbells | Stable: Goblet Squat | 0.32 | 33-34 of 35 | **Real variety** |
| Deadlift / full gym | Stable: Barbell Deadlift | 0.31-0.33 | 40-41 of 45 | **Real variety** |
| Upper body / full gym | Swaps flat to incline on 25% of days | 0.49-0.53 | 28-33 of 43 | Adequate, but some of the variety is fake |
| Lower body / bodyweight | Swaps on 25% of days | 0.46-0.48 | 28-30 of 32 | Adequate |
| Full body / dumbbells | Swaps on 25% of days | **0.56-0.62** | 19-21 of 35, and **still 21 at 90 days** | **Repetitive** |
| Conditioning, every tier | not applicable | **1.000** | **8 of 8: the same 8, every day** | **Degenerate** |

**Say this first, because it is good programming and must not be "fixed".** The
main lift in all four squat/bench/deadlift streams is perfectly stable — one
exercise across 365 simulated days. That is correct. A strength programme should
hold the main lift fixed and vary the work around it, and that is exactly what
those four streams do: roughly 70% of the session turns over day to day, 33-43
distinct exercises in a month, and no repeated session in 60 days. Someone
benching twice a week for a month sees a coach varying their accessories around a
fixed main lift. No slot that ought to be stable rotates, and low equipment tiers
do **not** degenerate — bodyweight bench has half the accessory depth of full-gym
bench and still produced 29 distinct sessions in 30 days.

### Conditioning never rotates at all

**Severity: high, objective.** Two auditors found this separately; it is one
defect. Every other session builder in the file runs its exercise pools through the
shuffle. The conditioning builder takes its list and uses it verbatim — I confirmed
this in the repo, and the only thing it shuffles is three warm-up stretches spliced
in.

Measured: day-to-day overlap of **1.000 on all 29 day-pairs**, one distinct
exercise set across 30 days, the same across 60 days, and identical at **all 15
combinations** of the five equipment tiers and three energy levels. A user doing
conditioning twice a week for five weeks does the identical four exercises ten
times — *Circuit A: Sled Push + Assault Bike Sprint / Circuit B: Bear Crawl + KB
Swing + Box Jump / AMRAP Finisher / Cool Down* — with only the order of three
stretches changing. The most anyone can ever see is 3 conditioning sessions, and
only by misreporting their energy level.

This is an engine gap and a data gap together: the database holds exactly one
prescribed circuit per tier and energy level, so there is nothing else to rotate to
even after the shuffle is added.

### The weekly split's variety is partly cosmetic, and its main-lift rotation corrupts the weight

**Severity: high, objective**, reported by two auditors and merged here.

Every fourth session the weekly split deliberately swaps the main lift for a
variation — flat bench becomes **incline** bench — while keeping the same internal
exercise identity so progression carries over. Keeping the identity does the
opposite of what was intended: the database gives incline its own lighter load
band (30-60 kg where flat is 45-75 kg), and sharing the identity makes the engine
discard that in favour of the flat-bench logged weight plus a progression step.

Measured: a user benching 100 kg is shown **"Incline Barbell Bench Press, 102.5
kg"** on one session in four — roughly 25-33% above an appropriate incline load, on
a barbell press, in a rehab-positioned app. With no history the same slot correctly
shows 45-75 kg for flat and 30-60 kg for incline, which proves the database
distinguishes them and the shared identity is what collapses them. It also runs
backwards: whatever the user manages on incline day is saved as the flat-bench
baseline, so one progression number oscillates between two lifts of different
strength and the progress graph blends two movements into one line. The same
applies to shoulder press becoming Arnold press and dumbbell row becoming
chest-supported row. This is *not* the same as grip variants sharing an identity,
which is deliberate and sound — a grip change is the same lift; flat versus incline
bench is not.

**The pull slot's variety is largely a rename** (high, objective). The substitution
filter is loose enough that the vertical-pull slot (Lat Pulldown) can be filled by
Barbell Bent-Over Row, and the check that stops the same movement appearing twice
fails on "Barbell Row" versus "Barbell Bent-Over Row". Over 30 simulated
upper-body days, **13 of 30 sessions contained both** "Barbell Row" and "Barbell
Bent-Over Row" — the same movement listed twice — and **9 of 30 contained no
vertical pull at all**, breaking the four-pattern coverage the code documents.
Because the rotation staggers one slot per day, this is a permanent one-in-three
cadence, not a rare collision.

### Full body plateaus, and the weekly finisher never changes

**Severity: medium**, four findings merged into two.

Full body always uses exactly 6 required slots and **zero optional slots**, so the
15-exercise accessory pool that gives the other streams their variety is never
sampled. Two of those six slots have no eligible substitute at all, so Dumbbell
Bench Press and DB Shoulder Press appear in **365 of 365** generated sessions,
alongside all three warm-up stretches, the finisher and the cooldown — **7 of 12
exercises fixed forever**. The result is 8 distinct sessions in 30 days, a hard
plateau at 21 distinct exercises that does not improve at 90 days, and 14 pool
exercises that can never appear. Three times a week for five weeks gives 8 distinct
sessions out of 15; a paying user would notice inside two weeks. *(The "never drop
the key movements" design is defensible coaching. The owner's call is whether to
give full body one optional slot at 60 minutes, or widen the substitution filter.)*

Separately, the weekly builder always takes the **first** finisher in its pool
where the squat/bench/deadlift builder shuffles the identical three-item pool.
Every upper-body session ends with Assault Bike Intervals, every lower-body session
with Jump Rope Intervals, every full-body session with KB Swing + Shuttle — 365 of
365 days each. **18 authored finishers are unreachable** across the three weekly
types at the tiers sampled. The prehab slot immediately above it *is* shuffled, so
this reads as an oversight rather than a decision.

### The shuffle itself is uneven

**Severity: medium, objective.** The random-number routine behind the rotation is
biased in a way that is a property of the algorithm rather than the seed — measured
identically when fed random seeds and when fed the consecutive day numbers the app
actually uses. Over 20,000 shuffles, an item that should land first 870 times
landed anywhere between 239 and 2,568 times.

In practice: one of the five priming exercises in each pool becomes **unreachable
for a year or more at a time** (Band Pull-Apart never appears in bench sessions in
2026 or 2027, and the locked-out item changes as the calendar moves), and accessory
exposure is skewed **21-fold** — Lat Pulldown 85 appearances a year against Machine
Chest Press 4.

**Low-severity content-depth notes, for completeness.** At 60 minutes the warm-up
"rotation" is order-only (a pool of 3, picking 3), the cool-down prehab pool is 2
deep so it is a coin flip forever, one dumbbell squat accessory duplicates the main
lift and is always removed, and the one-in-four main-lift variation aliases badly
with regular training cadences — someone training that session every four days
would *only ever* see the variation and never the curated base lift.

---

## Swapping an exercise is only skin deep

The swap button is the app's escape hatch when a machine is taken or something
hurts. It changes what is drawn on the card and almost nothing underneath it.
**Severity: high, objective** for the first three; seven findings in total.

**The sets you perform are recorded under the original exercise's name and
identity.** Swapping Leg Press to Hack Squat Machine and logging two sets of 15 at
65 kg stored *"Leg Press, 65x15, 65x15"*. History shows a movement you did not do,
next session's Leg Press weight is set from work done on a different machine, and a
note you wrote about the swapped exercise resurfaces on the original.

**The plate calculator answers for the exercise you swapped away from.** With the
bottom bar reading "Pause Squat / Safety Bar, 15 kg guide", the open plate window
was headed *"Back Squat, 47.5 kg"* with a matching plate diagram. The one thing
that tool exists to do is wrong whenever a swap is active.

**The weight box keeps the pre-swap number.** The guide caption updates to the new
exercise; the box does not. The user sees "15 kg guide" above a box containing
47.5, and tapping "Did It" logs 47.5 against the swapped exercise without them
touching anything. This is the *same* stale-field mechanism as the progression
pre-fill defect, so one fix addresses both.

Three more, all medium: the **first alternative is offered at the identical weight
as the original** while its own coaching cue says *"reduce 20% load"*, and the
second alternative falls back to a raw catalogue range an order of magnitude
lighter; **every swap is captioned "targets the same muscles with less demand"**,
including a pair of exercises that are exact inverses of each other, each described
as the lighter option than the other; and **a swap cannot be undone** — there is no
route back, so a mis-tap is permanent for the session (judgment). Custom sessions
offer no swap at all, with nothing on screen explaining why (low, judgment).

**Verified correct, so nobody re-audits it:** the plate arithmetic itself is right,
including awkward and below-the-bar loads — 101 kg correctly answers "25 + 15 a
side, closest you can load is 100 kg, 1 kg under". The problem is only *which*
exercise it answers for, and that the button appears on **31 catalogue entries that
are not barbell lifts** (high, objective): bodyweight hip thrusts, per-hand dumbbell
presses, cable pushdowns, one-end-loaded landmine and T-bar work, EZ-bar lifts
assumed to use a 20 kg bar, and the dumbbell deadlift that is the *main lift* of
every dumbbell deadlift session. On the bodyweight ones the window answers "that is
at or below an empty 20 kg bar", which is a nonsense answer for a glute exercise.

### Skipping an exercise silently deletes the sets you already did

**Severity: high, objective.** "Skip, couldn't do this exercise" rewrites **every**
set of that exercise to zero, including sets already completed with real numbers.
No confirmation, no warning, no undo. Reproduced: two real sets logged, tapped
skip, both gone. The custom-session builder has an undo toast for its deletions;
the session screen has nothing.

### Custom sessions ignore everything the app knows about you

**Severity: high, objective**, and the cause of critical finding 4. The generator
returns nothing for custom sessions, so the picked exercises pass straight through
with the raw catalogue text: no personalised load, no progression note, no feedback
adjustment. A user with a 140 kg squat max who picks Back Squat sees *"Target
weight: 60-90 kg"* and a 25 kg opening set, against 120 kg in the proper session.
Loading a **saved template also loses its name** (medium, objective), so the whole
point of templates — reuse — files the session as a generic "Custom Session".

Two smaller session-screen items, both medium: a **note written earlier in a
session becomes invisible after resuming it** (the data is safe; the card just
shows nothing and the pencil looks empty), and **per-exercise notes never appear on
the summary** at all even though a separate session-level notes box does, which
makes it easy to conclude they were lost (judgment).

---

## What a brand-new paying user sees

An auditor onboarded a profile through the real interface and then viewed every
screen with zero history.

**The good, and it is genuinely good.** The Achievements zero state is the best
empty state in the app — *"FIRST UP / First Step / Complete your first session"*
with a locked hero medallion and "0 of 277". Home's "Choose your first session"
card, the coach bubble's *"Start where you are… it will not be perfect yet"*,
Restore's per-row "Not tried yet" and Program's *"Welcome to your program. Let's
build something lasting."* are all clearly authored rather than defaulted. The
classic crash spots came out clean: an empty summary renders "No session found"
and does not throw, readiness with no prior state defaults sensibly, and **no NaN,
undefined, "--" or "Invalid Date" appeared on any screen or route**, with no chart
rendered on empty data anywhere.

Against that, the first session has a pile-up problem. **High, objective** for the
first three.

**The badge celebration fires twice.** The summary plays a banner for the newly
unlocked badges, then pressing Done lands on Home and a **full-screen modal
presents the identical set again**. Two components each claimed the same badges,
and clearing one queue does not clear the other. Confirmed on a fresh account.

**Badge rarity is derived from the order badges happen to be declared in**, which
is assumed to be ascending difficulty and is not. Three badges awarded by the
*identical* condition — complete your first session — come out bronze, gold and
"grow", the rarest tier, described in the code as "the hardest badges". "Levelled
Up" (use anything beyond bodyweight) is rarest-tier while "Equipment Explorer" (use
four tiers) is only gold. Two badges awarded by literally the same condition sit at
opposite ends of the rarity scale on the same shelf. In the running app, after
**one** session, the rarity row read *5/62 bronze, 0/69 silver, 2/66 gold, 3/80
grow* — three rarest-tier badges on session one and zero silver. The colour
language of the whole screen therefore signals nothing.

**"Personal Best — set a new 1RM personal best" is awarded after session one**,
with no personal best having been set. It fires on "at least two recorded maxes",
and onboarding writes three in a single pass.

On top of those: **a modal asking the user to re-confirm the bodyweight they
entered minutes ago covers the first-session certificate and its celebration**
(medium, judgment), and follows them onto other screens; **39 badge names are
mis-cased** — "First Lower body", "Full body God" — directly beneath shelf headings
reading "Lower Body Sessions" (medium, objective); the individual-medallion
celebration **caps at 9 badges while a real first session unlocks exactly 10**, so
the case the feature was written for is the one case it misses (low, judgment); and
**267 of 277 locked badges show a generic category hint and no progress at all**
(medium, judgment) — every milestone badge says "Complete more sessions to unlock
this", with no "1 of 10" against a count the app already has.

Smaller first-run inconsistencies, medium unless noted: the **Stats empty card is
inset on Overview and edge-to-edge on the other three sub-tabs**, so tapping across
the segmented control makes the same card jump three times; **all four sub-tabs
show byte-identical empty copy**, including wording about charts and personal bests
on the tab that lists sessions, so the control reads as broken (judgment); the
**Home "Week Streak" tile looks exactly like its three tappable siblings and does
nothing** when tapped, with no pressed state to confirm the tap even registered;
the **Home "Cycle" tile uses a different internal layout** to the other three, so
the two big numbers in the top row do not share a baseline (judgment); the Week
Streak and Total tiles use **fixed artwork with a part-filled progress ring baked
in**, so a brand-new account sees what looks like partial progress sitting directly
above a "0" (low, judgment); and three different empty-state designs are used
across the zero-history screens (low, judgment).

Two route-hygiene items. **The "page not found" screen is the untouched Expo
template** (medium, objective) — light grey while the user's theme is dark,
unstyled system type, a blue link, and an "Oops!" navigation bar that every other
screen suppresses. It is reachable in production and not only by typing a bad web
address: the app's own code comment documents a race that lands there. And
**opening the session address directly with no session in progress silently builds
and starts a live workout** (medium, judgment) — clock running, first warm-up timer
counting — skipping the readiness gate entirely, which is where pain is declared.

---

## Onboarding: the numbers that set everything else up

**The most consequential finding here is a pair, and they compound each other.
Severity: high, objective.**

The only check on the three "your best lifts" inputs and on bodyweight is *is it a
positive number*. A 999 kg squat and a 0.5 kg bench are both accepted silently; a
9,999 kg bodyweight enables Continue with no warning. Verified live — the stored
profile read back squat 999, bench 0.5, deadlift 250. These numbers become the
prescribed working weight for every subsequent strength session, so a single
fat-finger (140 becoming 1400) produces prescriptions an order of magnitude too
heavy. The same check-nothing pattern exists on the profile screen, so it is
app-wide rather than an onboarding slip.

**And onboarding is kilograms-only** (medium, judgment). Bodyweight and all three
lifts hardcode "kg", with no unit choice anywhere in the flow, even though the app
supports pounds everywhere else and the profile screen offers the toggle. A
pounds-native lifter typing "225" for a deadlift is stored as **225 kg** and given
working weights roughly 2.2 times heavier than intended, with nothing in the app
questioning it. The onboarding auditor's own conclusion: this combination is the
most plausible route from this flow to an unsafe session.

Four flow defects, all medium and objective unless noted:

- **Changing experience level between "intermediate" and "advanced" silently wipes
  every equipment selection.** Both levels offer the *identical* equipment list, so
  the wipe achieves nothing. Going back to correct "1-3 years" to "3+ years" sends
  you forward to an equipment screen with everything unchecked and Continue
  disabled, with nothing explaining why.
- **Un-selecting "Full Gym" leaves the other four tiers checked.** Tapping it
  selects all five; tapping it again deselects only itself. The user is left with
  four selections they never made, and those carry into the saved profile.
- **"Every 12 sessions we'd max out squat, bench and deadlift"** is not what
  happens. Only squat, bench and deadlift sessions advance that counter, so a user
  training the mixed week the app's own Train and Restore tabs push will do far
  more than 12 sessions before a test comes due. The profile screen's equivalent
  copy deliberately avoids making the claim.
- **Every answer is lost on a reload or app kill mid-flow** (judgment). Name, sex,
  experience, bodyweight, goals, equipment and lifts all live in screen memory
  until the final question. A refresh returns the user to the welcome screen with
  everything gone. It is deliberate and the flow is short, but the failure is total
  and silent.

Two judgment calls worth a deliberate answer. **A user who has just said they own
no equipment is immediately asked for barbell squat, bench and deadlift maxes in
kilograms**, then shown barbell test-week copy with "Yes, test me" pre-selected —
and for that user the engine does something else entirely (a max-reps test with no
working weights to reset). And the **beginner equipment lock says "Unlock with more
experience"**, implying something unlocks through use; nothing does, the only route
through is to go back and claim more training history, and tapping a locked tile
produces no toast, no shake and no hint — three taps left the screen pixel-
identical.

Contrast and polish, objective: **selecting an option card drops its description
text to 2.99:1 contrast in dark mode**, worse than the unselected cards at 9.6:1,
so choosing an option makes its own explanation three times harder to read;
**selected goal chip icons render at 1.90:1**, effectively invisible, while the
label simultaneously brightens, so the two halves of the chip move in opposite
directions; and option icons sit in a filled tile on two steps and float in empty
space on the two next to them. The bodyweight field accepts "62.5abc" and
"62.5.5.5" and saves 62.5 with no error (low); the celebration screen shows only
the **first** of up to six selected goals and gives the "No Equipment" pill a
dumbbell icon (low); and onboarding offers fewer choices than the profile screen
for test-week frequency and theme (low).

---

## Account, paywall and App Store review

Beyond critical finding 1, this is the cluster a reviewer or a support ticket finds
first. Fourteen findings.

**Every authentication error is shown as a raw status code plus the raw server
response. Severity: high, objective.** A wrong login code renders
`400: {"message":"Invalid or expired code."}` on screen. A server error renders the
**entire HTML error document** inline. A network drop renders `Failed to fetch`.
The server goes to real trouble writing friendly strings — *"Incorrect code. Please
try again."*, *"Code has expired. Please request a new one."*, *"Too many incorrect
attempts."* — and not one of them reaches the user in readable form, because a
shared helper throws before the code that would unwrap them ever runs, leaving that
unwrapping code unreachable. This is the first screen a paying customer sees after
onboarding. There is a single-point fix in that shared helper, with one caveat: the
rate-limit detection currently *works because of* the leak and would need updating
alongside.

**The paywall renders with no price at all if the store key is empty. Severity:
high, objective**, found by two auditors. The card shows the plan name and a bare
*"/ month"* with no number, the sub-line degrades to "Try free for 14 days, then
the standard rate", the "Price unavailable / Retry" affordance is skipped, and the
"Start 14-Day Free Trial" button **does nothing and says nothing**. Restore
Purchases is equally silent. Since the app forces anyone without a subscription
back to this screen, that is an unrecoverable dead end. This is not hypothetical
for this project: the repo's own notes record that this exact key already resolved
to empty in real builds. A reviewer landing here sees a subscription offer with no
price, which is a straight rejection.

**The paywall is a hard gate with no dismiss, no sign-out and no route to account
deletion. Severity: high, judgment.** Its only controls are start-trial, restore,
terms and privacy; there is no back, no close and no "maybe later". A user who has
just been made to create an account, and whose purchase fails or who simply changes
their mind, is trapped with no way to reach the screen that deletes the account
they were made to create. Apple requires in-app account deletion to be reachable
for any app that supports account creation, and reviewers routinely test exactly
this path. Even a "Sign out" text link in the footer would close it.

Three commercial-copy items: the paywall **asserts a specific "14-day free trial"
as a hardcoded fallback** whenever it cannot read the store, so the card can
simultaneously admit it cannot reach the App Store and state an exact trial length
(medium, judgment); the profile screen **hardcodes "£4.99/month" in pounds** in two
places while the paywall shows the store's localised price, so a US or EU user sees
one currency on the profile and another one tap later (medium, objective) — the
app's own terms page already qualifies this correctly; and the profile subscription
card reads *"Free trial active"* with the subtitle *"Active"* and never shows days
remaining (low, judgment).

Smaller: **"Reset All Progress" does nothing on the web build** (low, objective) —
it is the only destructive action without a web branch, while sign-out and
delete-account both have one; the rate-limit cooldown counts down in **raw seconds,
"Resend code in 598s"** (low); refreshing while waiting for the emailed code
**drops back to the email step with the field cleared**, forcing a second code
request that eats into the rate limit (low), though the in-app "Change email" link
handles this correctly; and a dead stub route ships in the bundle with no owner and
no navigator entry (low, reported by two auditors).

---

## Smaller items, grouped

**Console noise** (low, objective; four findings merged plus one). Every screen
containing the body diagram — Home, Stats, the pain picker, the session certificate
— logs seven React errors on render, and the Achievements screen logs one on every
render. They are web-build noise and the visible output is fine, but they fire
during completely ordinary use and would bury a real error. The body-diagram errors
share a root cause with the untappable regions noted earlier and need one device
check between them.

**Input coercion** (low, objective). A comma decimal is silently truncated: "62,5"
logs as **62 kg**, with the field quietly rewritten to "62" afterwards. The comma is
the decimal separator across most of continental Europe. Decimal rep counts are
floored with no warning and no rewrite. Everything else in the input layer is
correct — zero, empty, negative, non-numeric and implausible values are all blocked
properly, which the core-loop auditor checked deliberately.

**Dead or mislabelled controls** (medium, judgment). The "Rate Exercises" sheet
promises *"sets the weight you'll see next time you do these"* and offers thumbs
for cardio warm-ups, static stretches and breathing drills, where the rating
provably does nothing — 13 rows offered, 3 of which carried a weight. Exercises
outside the main and accessory categories **show a target weight on the card and
give no guide in the logging bar**, blocking completion until the user invents a
number the app never suggested (medium, objective). Both Stats drill-down windows
print their title twice, 18px apart (low, judgment).

**Navigation dead-ends** (medium). Opening an old session from the past-sessions
list is a one-way trip — the summary has no back or close control and its only exit
dismisses the whole stack to Home, so browsing three old sessions means three
round-trips through Home. And **"Discard session" lands on the pre-session check-in
screen**, which immediately offers to start the session just abandoned, while "Save
and exit" correctly goes Home. The data handling on both is correct.

---

## Checked and found correct

Recording these so nobody re-audits them:

- 22 of 28 cross-screen metrics reconcile exactly against the stored data, and the
  week-bucketing logic is shared between the weekly pill, the bar chart and the
  history filter, so those three cannot drift apart.
- The session certificate's own muscle map is internally consistent with the
  exercises actually logged, checked across four different session types.
- The main lift is stable across 365 days in all four strength streams, and the
  rotation genuinely cycles the pools rather than locking onto a subset — 23 of 23,
  14 of 14 and 21 of 21 accessories reached over a year.
- Low equipment tiers do not degenerate. Bodyweight bench has half the accessory
  depth of full-gym bench and still produced 29 distinct sessions in 30 days. The
  two degenerate cases are structural, not content-thin.
- All 19 pain regions measurably change the generated session, so no region is
  dead. The substitution engine keeps body region — a leg exercise is replaced by a
  leg exercise — and comfort-swapped cards do carry a revert option.
- Recovery, prehab and mobility sessions are credited like strength sessions for
  totals, streaks, badges, history and the muscle map, and correctly do not advance
  the strength test cycle.
- Plate arithmetic, including non-divisible and below-the-bar loads, in both
  kilograms and pounds.
- Same-day session regeneration is deterministic in all eight streams.
- The custom-session filter sheet (known issue K11) appears resolved: filters narrow
  the list correctly and "Clear all" restores it.
- The three energy levels, the rest timer, set-correction chips, the abandon and
  resume flow, the training calendar, the history date filters and past-sessions
  ordering all behave as they visually imply.
- The known day-boundary issue K5 appears fixed on this tree — the day index now
  flips at local midnight.

---

# Track 4 — Visual & theming

**Verdict: two single-line colour mistakes are responsible for most of what makes
the app look unfinished. Fixing those two lines fixes dozens of screens at once.**

Both themes were driven through the real app and captured (178 light screenshots,
80 dark), then every colour pair was *measured* rather than eyeballed. The
numbers below are real contrast ratios; the accessibility standard for body text
is 4.5:1.

---

## The two root causes

### V1. In dark mode, the app's "important" colour is the least readable colour on screen

**Where:** `constants/colors.ts:112` — `DarkColors.primary` is `#2f6b46`, *the
identical value to the light theme's primary*.
**Severity: high · objective**

That green was designed as a **fill** behind white text on a white page. But the
codebase also uses it as a **text and icon colour in 172 places across 17 files**.
In dark mode those greens sit on near-black surfaces and measure **1.90:1,
2.42:1, 2.94:1, 2.98:1** — all failing, several below even the relaxed
large-text floor.

Green is the app's "this is important / this is selected" colour, so the effect
is systematic. Measured examples:

- **The Settings sheet cannot show you which theme is active.** Every segmented
  control renders the *selected* chip at 1.90:1 and the unselected ones at
  8.77:1 — so the only option you can't read is the one you've chosen. This hits
  the streak goal, test-week frequency, weight units and the theme picker
  simultaneously.
- **The "Equipment today" sheet is entirely unreadable** — with a full-gym
  profile all five rows are selected, so the whole list is dark green on dark
  green.
- **"Warm-Up" badges are invisible.** Seven of the eight exercise-category badges
  pair a dark background with a *bright* text colour; only warm-up pairs dim with
  dim (1.90:1). Warm-up is the most common category — it's the first four cards
  of every session, sitting right next to legible "Activation" and "KPI Lift"
  badges.
- **The first card a new user sees is inconsistent with itself.** On "Choose Your
  First Session", the squat row's title measures 2.98:1 while bench (7.43:1) and
  deadlift (7.15:1) directly beneath it are fine — three sibling rows, three
  hand-picked colours.
- **The shared stat component** renders every headline number at 2.98:1. On Stats
  › Strength that produces *three different greens for the same kind of number on
  one screen*.

**The fix already exists in the file.** `DarkColors.primaryDark` (`#4ade80`) is
the correct dark-theme accent at ~6.9:1 — it's simply only used in a handful of
places.

### V2. In light mode, the bottom tab bar is hardcoded to the dark palette

**Where:** `app/(tabs)/_layout.tsx:169-183`.
**Severity: high · objective**

The tab bar reads its colours from the imported `DarkColors` object instead of
the active theme. So in light mode — where the whole app is white and off-white —
the bottom bar renders as a **full-width pure black slab** on every screen, with
labels at **2.16:1**.

Two details make this clearly a mistake rather than a choice: the codebase
*already fixed* this exact contrast complaint for the light tab colour (there's a
comment in `colors.ts:41-43` explaining it), and every other deliberate
non-theme exception in this repo carries a justifying comment. This one doesn't.

The same token is wrong in the other direction too: dark-theme inactive tab
labels measure **2.16:1**, worse than the value the light theme explicitly
rejected as "hard to read". Four of the five navigation labels are affected on
every screen of the app.

---

## Other high-severity visual defects

| Finding | Detail | Where |
|---|---|---|
| **The muscle map's legend is wrong** | The legend dots are built from theme tokens but the diagram paints with a different fixed palette. "Progressing" shows a dark green dot while worked muscles render bright mint — and "Not trained" is near-white in the legend but near-black on the body. A user matching swatch to muscle **gets the wrong answer**, and one pairing is exactly backwards. | `workouts.tsx:403-407` vs `BodyDiagram.tsx:28-31` |
| **Restore tab's three entry points wash out** | Row titles are tinted with the raw card accent on a pale card: "Targeted Prehab" **2.0:1**, its chevron **1.45:1** (essentially invisible). These are the three main entry points of an entire tab; the amber one reads as disabled. | `recover.tsx:613,617` |
| **The pain "Yes" button is the faintest control on the check-in** | "No" is a solid filled pill; "Yes →" is a faint amber outline at **3.21:1**. The affirmative branch of a pain question is the one control on that screen with real safety consequences. | `readiness.tsx` ~`:659` |
| **The body-diagram "Muscles" toggle is invisible in light mode** | Hardcoded to a green the file itself documents as "pops on dark backgrounds" — on the white pill it measures **1.75:1**, while the identical-looking Front/Back control 20px above is crisp black. | `BodyDiagram.tsx:928` |
| **`textTertiary` is too light for the content it carries** | **2.44–2.53:1** in light mode, and it's used for real information, not just hints: the in-session timer and progress line, the "Skip — couldn't do this exercise" control, every queued exercise's set/rep spec, all 277 badge names, the rarity tiers, "Not tried yet", chart labels. The team already rejected this exact value for the tab bar; it's still the general token. | `constants/colors.ts:18` |
| **The summary screen is in two themes at once** | The screen deliberately uses a fixed cream "certificate" palette — but the notes field below still uses theme tokens, so in dark mode a **near-black box with white text sits on a cream page**. The achievement banner over it is fully dark-themed too. | `session-summary.tsx:1652-1690` |
| **The first screen after sign-up truncates the user's name** | "Good evening Arc…" — the greeting loses a width contest with two circular buttons. Confirmed it's truncation, not missing data: a shorter name renders in full. A personalised greeting that can't fit the person's name reads worse than no greeting. | home header |
| **The onboarding tour paints over the thing it's pointing at** | The "spotlight" lays a light plate on top of the highlighted element rather than cutting a hole in the scrim, and the first tooltip sits on the session card and chops the headline in half. | coach-mark overlay |

---

## Consistency and craft (mostly judgment calls — your taste, not mine)

These are the things that read as "prototype" to a paying user comparing against
Strong or Whoop:

- **No coherent accent system** — at least **eight unrelated accent hues** across
  five screens.
- **Three unrelated human-figure art styles** in one app, plus full-colour emoji
  and 3D stickers mixed into an otherwise flat green line-icon set. (This is the
  imagery-strategy question Phase 4 of your rehaul brief raised — it's still
  open, and it's the single biggest driver of "no consistent WOW factor".)
- **Four different segmented-control designs**, two of them stacked 60px apart on
  the same screen using *opposite* conventions for "selected".
- **Two different greens for the primary button**, with no rule a user could
  infer.
- **The same five equipment options drawn four different ways** — and two of them
  render as black squares because the icon component accepts a colour prop and
  ignores it.
- **Every chart label renders in Times New Roman.** No SVG text element in the
  app sets a font family, so all in-chart text falls back to a serif while the
  rest of the app is a geometric sans. This one is objective and cheap to fix.
- **Early-data states look broken** rather than empty — one row above a full
  screen of nothing, charts with a single bar floating in an empty grid.
- Layout nits: two home stat tiles misaligned by 13px because only one has an
  eyebrow line; a square drop shadow around a round medal; badge rows clipping
  the fifth badge mid-word; sticky headers hard-clipping content with no fade.
- Copy: **"1 sessions"** appears on the session summary and in the Stats chart
  footer; a future program slot is labelled "Today"; the readiness button reads
  "→ Next: pick area →" with an arrow on both sides.
- **Seven React DOM warnings** fire every time the Stats tab renders.

---

## What the reviewer said is genuinely good — don't touch it

The independent first-impression pass (which never saw the code) called out the
onboarding flow's structure, the session "certificate" summary concept, and the
badge artwork system as reading as considered and premium. The problems above are
overwhelmingly *colour-token wiring*, not design. The underlying design is
stronger than the current rendering makes it look.

---

# Cross-check — what the three earlier briefs reported, re-verified today

Every item below was re-checked against the current code (commit `389bdae`), not
taken from the briefs. Line numbers in the old briefs had drifted, so each was
searched for afresh.

## Fixed — 9 of the 11 confirmed bugs from the rehaul brief

| Item | What it was | Evidence it's fixed |
|---|---|---|
| **K1** | Achievement gold always used the dark-mode colour, so badges were low-contrast in light mode | The static export is gone. `achievementGold` is now a proper theme token read per-theme, and two contrast tests now guard it inside `npm run check` |
| **K2** | Black text hardcoded on theme-changing green buttons — nearly unreadable in light mode on the most-tapped buttons | A dedicated `primaryDarkText` token now exists (`constants/colors.ts:20-24`) with a comment explaining this exact bug, applied across Home, onboarding and session. The only remaining black literals are shadow colours |
| **K3** | Two screens each hardcoded their own stale milestone list, so "N sessions to your next badge" was frequently wrong | `lib/badges.ts:158` now exports one derived list marked "Single source of truth"; both former offenders import it. The old array no longer exists anywhere in code |
| **K4** | Downgrading to Beginner left disallowed equipment stuck with no way to remove it | `profile.tsx:566-581` now filters equipment down to what the new level allows, with a comment describing the dead-end it prevents |
| **K5** | Exercise rotation flipped at UTC midnight, not the user's local midnight | `getLocalDayIndex()` now computes from local date parts and every rotation seed uses it. Zero occurrences of the old pattern remain |
| **K6** | Warm-up/cooldown exercises defined twice (drift risk) | Re-confirmed: each is defined exactly once |
| **K7** | A 396-line training calendar component built but never rendered | The dead component is gone. A calendar that *is* rendered replaced it, reachable from a drill-down in Stats |
| **K8** | "Bench Press" and "Barbell Row" resolved to no muscle regions at all | Both renamed and given proper regions; old history still resolves through a new alias map |
| **K11** | Custom-session filter chips cluttering their own row | Rebuilt behind a single Filters button with an active-count badge |

**Also fixed:** the three test suites the handover listed as unable to run now
run and pass. I executed them directly — 3 suites, **129 tests, all passing**.

## Not fixed — and mostly deliberate

- **K9** — exercises still tag elbow and wrist together (138 places). This is the
  deliberate, coverage-preserving state the handover described; narrowing each
  exercise to one joint remains available as a content improvement.
- **K10** — male session artwork is still much lower resolution than the female
  set (measured: 220×196 vs 600×534 for bench, and similar across the set).
- **Stale orphan tests** — `tests/body-diagram-e2e.mjs` and
  `tests/body-diagram.spec.ts` are still written against the retired 18-region
  model and would fail if run. Neither is wired into `npm run check`, so they sit
  there giving false comfort. A third, `tests/session-bar-kav.spec.ts`, is
  superseded by a passing suite.

## The three "Still to do" items — no work has been done on any of them

- **Goals drive programming — partially built, all of it pre-dating the
  handover.** Goals *do* already adjust set counts, load percentages and whether
  a conditioning block is added. But the specced parts are absent: there is **no
  goal-based rep-range shaping** anywhere (no "strength → ≤5 reps", no
  "hypertrophy → moderate reps"), and no "new users only / don't re-programme
  mid-plan" guard.
- **Notification set — not built.** Only two notification types exist (daily
  reminder, streak protection), both predating the request. No "Feeling sore?"
  recovery nudge, no fat-loss conditioning nudge.
- **Track Your Goals — absent.** The Stats tabs are still Overview / Strength /
  Progress / History. The raw ingredients exist (bodyweight log, strength trend)
  but nothing has been assembled from them.
