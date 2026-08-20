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

**Now on the card.** The effort target is printed under the target weight, and
the rest timer counts down the goal's number rather than the category's.

| Goal | Main lift effort | Rest |
|---|---|---|
| Strength / Power | Leave about 1-2 reps in the tank | 4 min |
| Muscle / General | Leave about 1-2 reps in the tank, last set close to failure | 2.5 min |
| Fat loss | Leave about 2-3 reps in the tank | 75 s |
| Rehab | Leave about 2-3 reps in the tank | 2.5 min |

Rest only follows the goal on the lifts. Prehab, activation and power-primer work
already carry rest written per category — 30-45 s for a mechanical drill, 45-60 s
for a neuro one — and the goal table has one number covering all three, so using
it there would trade a specific answer for a vaguer one.

**And displaying it caught a real one.** Rehab is mapped to the hypertrophy row,
which carries "last set close to failure". Right for the rep range, wrong for the
effort — so someone rehabbing a shoulder was being programmed a maximal set on
their main lift, and if they had also ticked muscle or strength it happened by a
different route as well. Invisible for as long as the number was computed and
never shown. Rehab now overrides the effort outright: never to failure, and never
fewer than 2-3 reps kept back. It wins this one rather than losing the tie-break,
because being wrong about a rep range costs a mediocre session and being wrong
here costs an injury, to someone who has told the app they already have one.

---

## Reading the reps, not just the buttons

Everything the app knew about how a session felt came from three buttons.
Buttons are a report; reps are a measurement — and someone prescribed 8-12 who
logs 20 has already typed in better evidence than any answer they could tap.

So the last set of every lift is now read. No new question, no extra tap, and it
works for the user who never touches the feedback buttons, which the buttons by
definition cannot.

It takes a lot to fire — a rep count has to clear a proportional guard **and** an
absolute one, because one extra rep means something different on a triple than on
a calf raise, and a single rep either way is a miscount rather than a
prescription error:

| Target | Logged | Verdict |
|---|---|---|
| 8-12 | 13 | nothing |
| 8-12 | 15 | easy |
| 8-12 | 18 | too easy |
| 5 | 6 | nothing |
| 5 | 8 | too easy |
| 20 | 22 | nothing |

Erring toward silence is deliberate: a missed signal costs one session, a false
one adds weight to a bar that did not deserve it.

**The last set, and only the last.** On a main lift every set below the top is a
stated fraction of one number, so beating a warm-up's target proves nothing. On a
hypertrophy accessory the last set is the one taken closest to failure. Both
point at the same set.

**"Too Hard" is never overruled by it.** A rep count is evidence about a weight;
"Too Hard" is a person saying they were at their limit. Answering that with more
weight because the arithmetic disagreed is the worst thing the app could do.

**And what it will not read:** clinical dosing (beating "2 x 15 each side" on a
rotator cuff is not an argument for more weight), timed holds, AMRAPs, and any
exercise with a set left unfinished.

### Nothing to add is not the same as "add nothing"

43 catalogue lifts are bodyweight with a countable rep range. Topping out the
range used to tell those "the weight goes up and the reps start again" — and then
no weight went up, because there is none, so the earned reps were thrown away and
the same range was climbed again, forever. Reading the reps makes the top of the
range arrive faster, so this stopped being theoretical. Those lifts now hold at
the top, which is at least honest. The app decides which are which from what was
actually lifted, not from the load sentence, because "Bodyweight + 10-20 kg
plate" is both.

---

## The warm-up asymmetry

One place the feedback rules contradicted themselves.

"Easy" on a warm-up was correctly ignored — it is a fraction of the working
weight, so an honest answer to it is Easy every time. **"Too Hard" on the same
warm-up failed the whole lift**: held the load, and counted toward the three
stalled sessions that earn a 10% deload. A lifter with a stiff first set who
answered honestly and then went on to lift their full working weight was punished
for saying so. The generous answer to the same set was not.

It is settled by one question: **did they get past it?**

- Working set came in at or above the weight they refused → they got past it, and
  nothing changes.
- Working set came in under it, or was never answered → it stands, and the load
  holds.

The weights are what make this safe, and the first attempt without them was
wrong. "The working set was answered" is not the same as "the working set carried
the prescription": saying Too Hard mid-ramp backs the exercise off and caps every
set after it, so the working set gets answered at a *reduced* weight. Reading
that as "nothing to change" left the prescription exactly where someone had just
demonstrated they could not lift it — measured on a lifter with a 60 kg limit
prescribed 102.5 kg, the weight never came down at all. Both the fix and that
failure are pinned by tests.

What it still cannot do is **earn** anything. The best a lift with a "Too Hard"
anywhere in it can score is "nothing changes".
