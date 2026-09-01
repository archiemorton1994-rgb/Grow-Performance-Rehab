# Movement progression ladders, and the rules for moving between them

Source material supplied by Archie on 2026-09-01. This is the specification for
the exercise-level system, not a description of what the app does today. Nothing
in `lib/` implements it yet.

## Why this is a different thing from what the app already does

Grow already does **load progression**: the weight on the bar comes from what you
lifted last time, and it climbs when you clear your reps. That is one axis.

This is the second axis, **exercise progression**. A person who cannot yet hinge
without rounding does not need a lighter deadlift, they need a wall-touch hinge.
A person doing dumbbell Romanian deadlifts comfortably does not need more
dumbbell reps, they need a barbell. Moving somebody along that ladder is a
different decision from moving the number, and the app currently cannot make it.

## The seven patterns and their five levels

Each pattern runs Level 1 (foundations, bodyweight) to Level 5 (elite). The full
lists are below; each level is the rung, and the exercises are the rungs' rails.

### Hinge

1. **Foundations** Wall-touch hip hinge, dowel hinge, glute bridge, banded good
   morning, single-leg bodyweight hinge
2. **Introduced loading** Kettlebell or dumbbell RDL, elevated kettlebell sumo
   deadlift, high rack pull, trap bar (high handles), barbell RDL
3. **Floor access** Trap bar (low handles), barbell sumo deadlift, conventional
   barbell deadlift, barbell good morning, single-leg dumbbell RDL
4. **Range and asymmetry** Deficit deadlift, stiff-legged deadlift, single-leg
   barbell RDL, band or chain resisted deadlift, pause deadlift
5. **Elite** Reeves deadlift, suitcase deadlift, Jefferson deadlift,
   snatch-grip deficit deadlift

### Squat

1. Box sit-to-stand, assisted bodyweight squat, air squat, plate-reach
   counterbalance squat, goblet squat to box
2. Goblet squat, dual dumbbell front squat, Zercher squat, landmine squat,
   barbell box squat
3. Barbell front squat, high-bar back squat, low-bar back squat, safety squat
   bar, dumbbell Bulgarian split squat
4. Heels-elevated squat, pause or Anderson squat, overhead squat, skater squat,
   barbell Bulgarian split squat
5. Pistol squat, Zercher deficit squat, bottom-up overhead pistol squat,
   supramaximal eccentric work

### Lunge

1. Assisted static split squat, bodyweight static split squat, reverse lunge,
   lateral lunge, curtsy lunge
2. Forward lunge, goblet split squat, dumbbell reverse lunge, walking lunge,
   elevated front-foot split squat
3. Dumbbell walking lunge, barbell reverse lunge, barbell forward lunge,
   deficit reverse lunge, clock lunge series
4. Suitcase or offset lunge, front-rack walking lunge, jumping split squats,
   overhead walking lunge, Bulgarian lunge drive
5. Barbell overhead walking lunge, Zercher deficit walking lunge, weighted
   plyometric lunges, single-arm overhead barbell walking lunge

### Push (horizontal and vertical are one ladder with two vectors)

1. Wall push-up, incline push-up, seated overhead dumbbell press, kneeling
   push-up, dumbbell floor press
2. Standard push-up, dumbbell flat bench, standing dumbbell overhead press,
   barbell bench press, standing barbell overhead press
3. Incline bench, deficit push-up, parallel bar dip, decline push-up, push press
4. Weighted dips or push-ups, single-arm overhead press, ring push-ups or dips,
   pause or pin bench, bench with chains or bands
5. Wall-assisted handstand push-up, single-arm barbell floor press, freestanding
   handstand push-up, deficit handstand push-up, bottom-up kettlebell press

### Pull

1. Doorframe isometric row, high-incline inverted row, lat pulldown or band
   pulldown, chest-supported dumbbell row, scapular pull-up
2. Low-incline inverted row, single-arm dumbbell row, band-assisted pull-up,
   seated cable row, bent-over barbell row
3. Strict chin-up, strict pull-up, Meadows row, feet-elevated inverted row,
   kipping pull-up
4. Weighted pull-up, ring pull-up or row, unsupported single-arm row,
   chest-to-bar pull-up, towel or thick-grip pull-up
5. Archer pull-up, strict muscle-up, single-arm inverted row, heavy one-arm
   pulldown, one-arm pull-up

### Carry

1. Trap bar carry, two-handed farmer's carry, goblet or hug carry, plate pinch
   carry, farmer's hold march
2. Suitcase carry, front-rack kettlebell carry, uneven farmer's carry, sandbag
   hug walk, heavy trap bar carry
3. Single-arm front-rack carry, waiter's walk, cross-body mixed-rack carry
   (levels 4 and 5 not supplied; treat as elite variations of the above)

### Core

Not supplied separately. Treat as a supporting pattern for now.

---

## The screening matrix and the rules for moving

### Phase 1: the zero-load gate

Before anybody is assigned a level for a pattern, they pass a movement clearance
screen for that pattern.

**Pain-free screen, first and overriding.** "Do you feel any sharp pain,
pinching or joint discomfort during this movement?" Yes routes them to Level 1
foundations, or to a clinician.

**Mobility and control benchmarks, pass or fail:**

| Pattern | Benchmark |
| --- | --- |
| Hinge | 10 wall-touch hinges with a flat spine, no lumbar rounding |
| Squat | 10 plate-reach counterbalance squats to parallel, heels down, no knee valgus |
| Push | 30 second rigid plank with no lumbar sag, before any push-up |
| Pull | 5 strict scapular pull-ups or lat pulldowns with clear retraction |
| Lunge | Static split squat, 3 seconds down, no balance loss, no knee crash |
| Carry | Suitcase carry at 20% bodyweight for 30 seconds without leaning |

### Phase 2: the gates between levels

**The "earn the barbell" rule (Level 2 to Level 3).** Never assign a
barbell-loaded variation until the person has logged a dumbbell or kettlebell
variation of the same pattern with acceptable effort and form. Dumbbells allow
independent joint movement and an easy bail-out; a barbell fixes the path and
loads the spine.

**Capacity and effort threshold.** Two consecutive weeks of a variation at
RPE 7 or lower (two to three reps in reserve) with the volume threshold met
(for example three sets of ten, clean). A rating of RPE 9 to 10, or failed reps,
locks the next level.

> Grow's own effort scale is three points, not ten. The mapping is
> Easy = RPE 7 or below, Challenging = RPE 8, Too Hard = RPE 9 to 10. That is the
> signal the app already collects after every set.

**Asymmetry gate.** For unilateral patterns, the level is capped by the weaker
side. Ten single-leg RDLs on the right and five on the left holds the hinge at
its current level until the disparity is under 10 to 15 per cent.

### Phase 3: regression

Automatic triggers that drop a level or start a deload:

- pain reported on the pattern
- form breakdown
- failed reps at the current level

---

## What this means for programme difficulty

Archie's framing, 2026-09-01: programme length is a **session count**, not a
number of weeks. Offer 4, 6, 8, 10, 12, 14, 16, 18 and 20.

Difficulty is a separate axis and is **not** implied by length. Six labels:
**Beginner, Novice, Intermediate, Advanced, Expert, Elite.**

Difficulty comes from the work and the volume, which is where the ladder above
does the job: an exercise's level maps onto the difficulty bands, overlapping
rather than partitioning, so a Novice programme draws mostly on Level 1 with
some Level 2, an Intermediate one on Levels 2 and 3, and so on.

And every programme has to run at 30, 45 and 60 minutes without becoming a
different programme. The adaptive part is not optional: it is the reason
somebody stays on a block when their week goes wrong.
