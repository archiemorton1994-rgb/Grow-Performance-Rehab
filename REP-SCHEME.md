# How the app decides reps, sets, effort and rest

Plain-English companion to `lib/rep-scheme.ts`. That file is the config; this is
what it means and what is still to do.

---

## The table

Your **goal** (asked in onboarding) decides the rep range. The **kind of
exercise** decides how far that range bends. Together they set how close to
failure a set should go, and how long you rest.

| | Main lift | Accessory | Isolation / rehab |
|---|---|---|---|
| **Strength / Power** | 3-5 reps, 3-5 sets, 3-5 min rest | 6-8 reps, 2-3 min | 10-15 reps, 45-75 s |
| **Muscle / General** | 6-10 reps, 3-4 sets, 2-3 min rest | 8-12 reps, 90-120 s | 12-20 reps, 45-75 s |
| **Fat loss** | 12-20 reps, 2-3 sets, 60-90 s rest | 15-20 reps, 45-60 s | 15-25 reps, 30-60 s |

**Rehab as a goal is deliberately programmed like muscle, not like strength.** A
3-5 rep max-effort prescription is the wrong shape for someone rehabbing, so it
gets the forgiving rep range and an effort target a long way from failure.

**If you pick more than one goal, strength wins.** A 5-rep prescription trained
as 15 is a different session; a 12-rep prescription trained as 8 is just a
heavier one. Erring toward the more specific answer is the safer mistake.

---

## Effort: how hard, not just how heavy

New. The weight told you how heavy; nothing told you how hard. Each set now
carries a target in plain English — **"leave about 2 reps in the tank"** — rather
than the industry's "RIR 2", which means nothing to a beginner.

On **muscle** goals only, and only on main lifts and accessories, the **last set
pushes close to failure**. That is the single most effective item in the spec and
the easiest to misapply, so it never applies to rehab, isolation or drill work:
an all-out set on a shoulder prehab exercise is how prehab becomes an injury.

---

## Double progression: earn the reps, then the weight

This is the big one, and it is what makes progress *visible*.

The app could only ever add weight, and the smallest honest step is a 2.5 kg
plate — **12.5% on a 20 kg dumbbell press**. So it had two options, nothing or
too much, and for an honest "normal" session under about 50 kg it did nothing,
three sessions running, before making one large jump.

Now: reps climb inside the range first, then the weight goes up and the reps
start again.

```
8-10  ->  9-10  ->  10  ->  weight up, back to 8-10
```

Adding a rep is 5-10% more work at a fraction of the joint cost. It is what any
coach does between plates, and it means a beginner sees the app respond almost
every session instead of one in three.

**Two things it deliberately will not touch:**

- **Anything that is not countable reps** — holds for time, AMRAP sets, and
  anything prescribed "explosive" or "slow". Adding a rep to a three-minute carry
  is meaningless, and "5 explosive" is chosen for a quality more reps destroy.
- **Rehab and isolation dosing.** "2 x 15 each side" on a rotator cuff is a
  clinical dose written by a physiotherapist, not an opening bid. Progression
  belongs to the lifting.

**And it reads the range from the exercise, not from the last prescription.**
This matters more than it sounds: climbing `8-10` gives `9-10`, then `10` — at
which point the range has vanished from the text. An earlier version re-derived
it from `10` alone, fell back to the goal default, and silently replaced an
authored `8-10` with a generic `6-8` two sessions in. Both the fix and that
failure are pinned by tests.

---

## What is done, and what is not

**Done and tested** (`lib/rep-scheme.ts`, `tests/rep-scheme.check.mjs`, 39 checks):

- the goal x tier table above, as editable data
- goal-aware rest, effort targets and the last-set rule
- the double-progression logic, including everything it refuses to touch
- a parser that correctly ignores 367 of the catalogue's 689 prescriptions
  because they are times, AMRAPs or tempo work

**Not yet wired into a session.** Using it live needs one more thing the app does
not have: a memory of *where each exercise currently sits in its rep range*. Load
is remembered per exercise (`lastLoggedWeights`); reps are not. That is a store
field, a migration, and a change to how the session card renders its target.

It is deliberately a separate step. This half is pure logic with no way to break
an existing session; the next half changes what every card shows, and is worth
doing on its own with its own eyes on it.

**Already in the app, so left alone:** warm-up ramps for main lifts (50/70/85%
style build-ups already generate), and the three-button difficulty feedback,
which is a coarser version of the same auto-regulation idea and should probably
be re-expressed in these terms once the above lands.
