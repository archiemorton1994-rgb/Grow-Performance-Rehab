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

## Wired into sessions

It is live. On finishing a session the app works out where each exercise's reps
go next, saves it, and the next session's card shows the earned target.

Measured on a 40 kg accessory whose template says 12 reps, with honest answers:

| Session | Card says | Next |
|---|---|---|
| 1 | 40 kg x 12 | 42.5 kg x 8-12 |
| 2 | 42.5 kg x 8-12 | 42.5 kg x 9-12 |
| 3 | 42.5 kg x 9-12 | 42.5 kg x 10-12 |
| 4 | 42.5 kg x 10-12 | 42.5 kg x 11-12 |
| 5 | 42.5 kg x 11-12 | 42.5 kg x 12 |
| 6 | 42.5 kg x 12 | 45 kg x 8-12 |

**Something moves every session.** Before this, the same exercise showed no
change at all for three sessions and then jumped.

### Two things the wiring had to get right

**The two gates cancelled each other.** Topping out the reps asks for more
weight, but the load engine separately refuses any jump over 5% until three
clean sessions have banked it — a rule from when load was the only lever.
Climbing 8 reps to 12 already takes four sessions, so both gates fired and the
weight never moved at all: twelve simulated sessions, reps cycling, 40 kg
throughout. Topping out the range now banks the jump, because that IS the
earning.

**A held load looked like a stall.** While reps climb the weight holds, which
the engine records the same way it records a failure. Left alone, three good
sessions of rep progress would have been indistinguishable from three failures
and would have earned a 10% deload. Rep progress is excluded from the stall
counter.

### The three difficulty buttons now mean three things

Measured before this change, "Easy" and "Too easy" produced an identical jump at
every weight, because the percentage between them was smaller than one plate.
Reps are a finer grid, so the same answers can finally differ:

- **Too easy** — straight to the top of the range. The weight is wrong, and
  creeping up one rep at a time wastes weeks getting there.
- **Easy** — two reps.
- **Normal** — one rep.
- **Hard** — nothing moves.

## Where it stands

**Live and tested** — `lib/rep-scheme.ts` (39 checks) and the wiring
(`tests/double-progression-wiring.check.mjs`, 17 checks):

- the goal × tier table above, as editable data
- goal-aware rest, effort targets and the last-set rule
- double progression, end to end: recorded on completion, applied to the next
  session's card
- everything it refuses to touch — a parser that correctly ignores 367 of the
  catalogue's 689 prescriptions because they are times, AMRAPs or tempo work

**Already in the app, so left alone:** warm-up ramps for main lifts (the
50/70/85% build-up the spec asks for already generates), and exercise tiering,
which the tiers here map onto rather than duplicating.

**Not done yet.** The effort target and the goal-aware rest are computed but not
shown on the card — the card still displays the category-based rest it always
did. That is a UI change on the busiest screen in the app and worth its own pass
with eyes on it. Until then the numbers exist and nothing depends on them, so
nothing is misreported.
