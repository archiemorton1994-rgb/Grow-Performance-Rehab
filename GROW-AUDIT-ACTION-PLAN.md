# Grow — Audit Action Plan

Plain-English companion to `GROW-FULL-DEPTH-AUDIT.md`. That report is the
evidence; this is the to-do list. Nothing here has been done yet.

The 386 findings boil down to about 20 things that actually matter. They are
grouped by "when should this be dealt with", not by which track found them.

---

## Tier 1 — Fix before anyone else installs the app (3 items)

### 1.1 The injury swap can put burpees into a session because your knee hurts
**What happens:** When someone reports pain, the app removes the risky exercise
and puts a different one in its place. It decides what counts as risky by
reading the exercise's *name*. Fifteen exercises hide their jumping or sprinting
in the description rather than the name — so the app thinks they are safe and is
willing to use them as the replacement. A knee-pain session was served an
exercise made of burpees and squat jumps, labelled *"to protect your knee"*.

**Why it matters:** This is the only finding in the audit that can physically
hurt somebody. The user did exactly what they were asked — reported pain — and
got something worse than what was removed.

**What to do:** Mark the fifteen exercises as high-impact so they can never be
chosen as a replacement, then stop matching on names and use the tags instead.

**Effort:** Half a day. The tagging is the work; the logic change is small.

### 1.2 Two people sharing a device end up sharing an account
**What happens:** Signing out forgets the login but leaves all the training data
on the phone. When the next person signs in with their own email, the app sees
their account is empty and uploads whatever is on the phone into it.

**Why it matters:** A new subscriber can end up with a stranger's history, and
their weights get calculated from that stranger's strength. It also blocks
recovery: the app only accepts your real data if the server has more sessions
than the phone.

**Not affected:** Anyone using their own email on their own phone. This needs two
different accounts on one device.

**What to do:** Clear the local data on sign-out — the delete-account path in the
same file already does exactly this correctly, so it is a matter of doing the
same thing. Then decide the rule for the upload branch (safest: only upload local
data to a new account if it was never tied to a different signed-in user).

**Effort:** An hour, plus a decision from you on the upload rule.

### 1.3 Pain severity is thrown away before it reaches the workout
**What happens:** The check-in asks Mild / Moderate / Severe, saves the answer to
your history — and then hands the workout generator everything *except* the
severity. Mild, Moderate and Severe produce an identical session.

**Why it matters:** The rule that drops the explosive block at moderate pain and
above never runs. A knee-pain session included explosive marching and 20-metre
sprints regardless of what the user chose. The logic already works — it is a
missing connection, not missing code.

**What to do:** Pass severity through to the generator.

**Effort:** Under an hour.

---

## Tier 2 — The core promise ("automatically progressive") is not working (4 items)

### 2.1 The Easy / Challenging / Too Hard buttons do not change your weight
**What happens:** The app works out the right adjustment, writes an honest note
about it, and updates the small grey guide number — then leaves the box you
actually type into untouched. All three numbers are on screen at once and they
disagree.

**Why it matters:** Every automatic adjustment in the app, in both directions, is
currently cosmetic. Someone saying "that was too hard" gets handed the same or a
heavier bar while being told it was eased off.

**What to do:** Refresh the weight box when the recommendation changes, not only
when the set number changes.

**Effort:** An hour. Same underlying cause as the broken swap tool, so it fixes
two things.

### 2.2 Nothing stops the weight climbing forever
**What happens:** Next weight is always last weight plus a step. There is no
ceiling, no reference back to the user's tested max, and no way down. The "3
clean sessions earns a bigger jump" bonus also never switches off, so the big
step becomes permanent from the fourth session onward.

**Why it matters:** A simulated lifter entering a tested 100 kg bench was being
prescribed **165 kg by session 18**, congratulated for consistency. The only
thing that stops it is failing the lift.

**What to do:** Three decisions for you: cap the suggestion at a sensible
percentage of the tested max; add a deload when someone stalls; and make the
bonus step expire.

**Effort:** A day, and it needs your input on the numbers.

### 2.3 A weight range is misread, so beginners get a top-set with no warm-up
**What happens:** "30-47.5 kg" is two numbers. When an exercise has two sets, the
app treats those two numbers as a deliberate ladder and prescribes bottom then
top.

**Why it matters:** **945 of 3,600 prescriptions are affected.** A brand-new user
with no history was offered Back Squat 65 kg followed by 107.5 kg. The same user
on a different day got a proper gradual ramp.

**What to do:** Only treat two numbers as a ladder when they are not a range.

**Effort:** One line. Best value in the whole report.

### 2.4 Warm-ups count towards "how hard was that?", so the biggest jump is the default
**What happens:** The difficulty tally includes warm-up sets. The app's own
coaching text tells the user those will feel very light. Two "Easy" answers earn
the maximum weight jump.

**Why it matters:** An honest user earns the biggest possible increase every
single session. The gentle step is only reachable by calling a warm-up
"challenging", which is not what an honest person would do.

**What to do:** Only count the working sets.

**Effort:** An hour.

---

## Tier 3 — The app shows users wrong information (3 items)

### 3.1 The muscle map is wrong more often than right
**What happens:** 171 of the 661 exercises carry no muscle tags at all — every
finisher, every conditioning exercise, every strength test. All 48 exercises used
by the upper-body / lower-body / full-body sessions are missing from the lookup
tables, so those sessions light up **nothing**. Deadlifts credit no hamstrings or
glutes. A breathing cooldown credits your core after nearly every session.

**Why it matters:** This is the Recover tab's entire reason to exist, and it is
the most visible "the app is wrong about me" moment a user can have.

**What to do:** A content pass to fill in the missing tags, plus adding the
weekly-session exercises to the lookup tables. The report lists every affected
exercise by ID.

**Effort:** One to two days, mostly careful data entry rather than coding.

### 3.2 People with no equipment are given exercises they cannot do
**What happens:** Bands, a pull-up bar, a bench, an ab wheel, a stability ball and
a plyo box all appear in the "no equipment" pool. The worst is **Chin-Up in a
required slot** of every weekly upper-body and full-body session, so it cannot be
avoided — and the listed alternative also needs a bar.

**Why it matters:** Home users hit an exercise they physically cannot perform, in
a slot they cannot skip. It is the fastest way to make someone cancel.

**What to do:** Re-file the roughly twenty offenders into the right equipment
tier and give the required slots a genuine no-equipment option.

**Effort:** Half a day.

### 3.3 Conditioning sessions never change
**What happens:** The conditioning workout is byte-identical every single day,
forever, at every equipment level.

**Why it matters:** Anyone using conditioning regularly sees the exact same
session every time, which reads as broken.

**What to do:** Apply the rotation the other session types already use.

**Effort:** Half a day.

---

## Tier 4 — Making it look like a paid app (2 root causes)

### 4.1 In dark mode the "important" colour is the least readable thing on screen
**What happens:** The dark theme's green was never actually darkened — it is the
light theme's value, designed to sit *behind* white text. It is used as text
colour in 172 places.

**Why it matters:** The Settings screen cannot show you which theme is selected.
The equipment list is green-on-green. "Warm-Up" labels are invisible on the first
four cards of every session.

**What to do:** Point those usages at the bright green that already exists three
lines away in the same file.

**Effort:** Half a day (it is a find-and-replace with eyes on each one).

### 4.2 In light mode the bottom bar is stuck on the dark palette
**What happens:** The tab bar reads its colours from the dark theme regardless of
setting, so a pure-black slab sits under white cards on every screen.

**What to do:** Read the active theme instead. One line.

**Effort:** Ten minutes.

---

## Tier 5 — Cheap wins, worth batching into one session

- Chart labels render in **Times New Roman** because no chart text sets a font.
- **"1 sessions"** appears on the summary screen and in the Stats footer.
- The home greeting **cuts off the user's name** — "Good evening Arc…".
- The readiness button reads **"→ Next: pick area →"** — an arrow at both ends.
- Sign-in errors show the **raw technical error code** to the user.
- Seven browser warnings fire every time the Stats tab opens.
- A future slot in the programme timeline is labelled **"Today"**.
- Two stat tiles on the home screen are **misaligned by 13 pixels**.
- The paywall shows **no price at all** if the payment key is missing.

**Effort:** All of it in one day.

---

## Decisions only you can make

These are not bugs. I have a view on each but they are yours:

1. **Imagery.** Three unrelated human-figure art styles, plus emoji and 3D
   stickers mixed with flat green line icons. This is the biggest single driver
   of "no consistent WOW factor". Pick one direction and regenerate everything to
   it. *(Your rehaul brief raised this as Phase 4 — it is still open.)*
2. **Feedback scale.** Whether to move from three buttons to a 1-5 scale. My
   view: not until 2.1 is fixed, because right now the buttons do nothing — more
   granularity on a disconnected control is wasted effort.
3. **Rehab redirection.** Today the app offers to switch to a recovery session
   only when someone selects *Severe*, and it is an offer, not automatic.
   Whether moderate or repeated pain should also trigger it is a product call.
4. **Time away from training.** There is currently no concept of it at all —
   coming back after a year gives you the same weight as yesterday. What the
   backoff should look like is your decision.
5. **Test week.** The maths demotes every goal except strength and power. A
   rehab-goal user is guaranteed a large cut every cycle. Needs re-thinking, not
   just patching.
6. **Pounds users.** Everything is calculated in 2.5 kg steps, so lbs users get a
   constant 11.0 lb jump and weights no gym's plates can make.

---

## Suggested order of work

| Batch | Contents | Rough time |
|---|---|---|
| **A** | Tier 1 — the three safety and data items | 1 day |
| **B** | 2.3 + 2.1 + 2.4 (the one-line range fix, the weight box, the warm-up tally) | 1 day |
| **C** | Tier 5 cheap wins + 4.2 tab bar | 1 day |
| **D** | 3.1 muscle tags + 3.2 equipment tiers | 2-3 days |
| **E** | 4.1 dark theme colour + 3.3 conditioning rotation | 1 day |
| **F** | 2.2 weight ceiling and deload — after you decide the numbers | 1 day |

Batches A and B together remove every critical finding in the audit.
