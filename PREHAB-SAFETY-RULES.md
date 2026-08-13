# Prehab safety rules

<!-- GENERATED FILE - do not edit by hand. Run `npm run acute-map` to refresh. -->

What the app is allowed to give someone who has told it a body part hurts. `ACUTE-REHAB-MAP.json` is the same information for a program to read; this is the version to argue with.

## When these rules apply

- The user picks a body region on the Restore tab (Recovery or Targeted Prehab).
- The user reports pain in a region on the readiness screen before a training session.

On the Restore tab the user is asked outright — **"sore or injured"** or **"feels fine"** — and it defaults to sore. Answering "feels fine" gives the fuller mobility-led session that rotates across weeks, which is what someone well into a rehab block should be doing. On the readiness screen no question is needed: reporting pain there is the answer.

## The pain rule

> Stay in a pain-free range. Nothing here should take your pain above 2 out of 10, and it should settle as soon as you stop.

It is shown on screen as a banner that **cannot be dismissed**. Every other banner in the app reports a decision the app has already made; this one is an instruction, and it is the only thing setting the dose. The protocols prescribe effort as a fraction of the user's own — "about a third of your effort" — rather than as a weight, because in the first days after a strain the correct load is whatever does not hurt. Without the number that defines "does not hurt", the prescriptions underneath are incomplete.

## What may be prescribed

- **isometric** — The muscle works, nothing moves, nothing lengthens.
- **controlled isotonic** — Short range, light load, slow, well inside the middle of the range.
- **activation** — Switching the area on without loading it.
- **mobility low load** — Keeping a joint moving, explicitly stopping short of the end of the range.
- **circulation** — Moving blood and swelling, with no muscular demand at all.

## What may never be prescribed

- static or passive stretching of the injured tissue
- aggressive or ballistic dynamic movement
- heavy eccentric loading
- anything that leaves the ground

This is enforced, not merely intended: `tests/acute-rehab.check.mjs` generates a real session for every region at every severity and reads the name, reps and coaching cue of everything in it against a vocabulary of stretching, heavy loading and impact. It also checks the opposite — that the ordinary flexibility session **still** prescribes stretching, because a version of this that simply deleted stretching from the app would otherwise look correct.

## Site by site

### Hamstrings

*Work only in a range that stays comfortable - nothing in this session should take your pain above 2 out of 10, and it should settle again as soon as you stop. If it hurts more than that while you work, or the leg feels worse the next morning, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Supine Isometric Hamstring Press (Bent Knee) — 3 x 8 reps, hold 10s each side (Bodyweight)
- Banded Clamshell — 2 x 15 each side (Light band)
- Glute Bridge (isometric hold) — 3 x 8 reps, hold 5s each (Bodyweight)
- Prone Knee Bend Hold — 2 x 10 reps, hold 3s each side (Bodyweight)
- Single-Leg Glute Bridge — 2 x 8 each side (Bodyweight)

**Withheld, and why:**

- **Standing Hamstring Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Supine Hamstring Stretch (Strap)** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Nordic Curl Negative (slow)** (was 3 x 5 reps) — A near-maximal load on the injured tissue. Correct for a long-standing problem, far too much for a fresh one.
- **Hip Hinge Against Wall** (was 3 x 15 slow reps) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Pigeon Pose** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.
- **Seated Forward Fold** (was 2 x 60s) — A long passive hold that parks the healing tissue at its full length.

**Also to be avoided:**

- Standing and supine hamstring stretches - pulling on a muscle that is still knitting back together pulls the repairing fibres apart and slows healing down
- Nordic curl negatives and other hard lowering work - the heaviest demand there is on a hamstring, and completely wrong in the first two weeks after a strain
- The wall hip hinge and any hinge cued to feel a stretch at the bottom - it loads the hamstring at its longest point, which is exactly where strains happen and re-happen
- Pigeon Pose and the seated forward fold - long passive holds that park the healing tissue at full length for a minute at a time
- Running, sprinting and anything that lands - the tissue is nowhere near ready for speed

### Glutes

*Stay inside a range that feels comfortable - none of this should push your pain above 2 out of 10, and it should settle as soon as you finish. If the pain goes higher than that, or the hip is more sore the following day, stop and have it assessed by a physiotherapist or doctor.*

**Given instead:**

- Glute Set (isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Glute Bridge (isometric hold) — 3 x 8 reps, hold 5s each (Bodyweight)
- Banded Clamshell — 2 x 15 each side (Light band)
- Isometric Hip Abduction (Wall Press) — 3 x 5 reps, hold 20s each side (Bodyweight)
- Single-Leg Glute Bridge — 2 x 8 each side (Bodyweight)

**Withheld, and why:**

- **Glute Bridge (isometric hold)** (was 3 x 10 reps, 5s hold each) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Pigeon Pose** (was 2 x 60s each side) — A long passive hold that parks the healing tissue at its full length.
- **Figure-4 Glute Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Figure-4 and Pigeon Pose - both pull the leg across the body, which presses the glute tendons hard against the point of the hip and is one of the most common reasons this pain drags on
- Loaded hip hinges - deadlifts, Romanian deadlifts, kettlebell swings and hip thrusts all ask the sore muscle for its hardest job while it is still healing
- Deep squats and lunges, which take the hip into the loaded, folded position the tissue least tolerates right now
- Jumping, running and taking stairs two at a time
- Long side-lying holds on the sore hip and sitting with the legs crossed - both squash the tendon against the bone for minutes at a time

### Calf / Shin

*Keep everything inside a pain-free range - nothing here should take your pain above 2 out of 10, and it should ease off the moment you stop. If it goes higher than that, or the calf is tighter and more painful the next day, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Seated Ankle Pump (Small Range) — 2 x 20 slow reps each side (Bodyweight)
- Seated Toe Raise — 2 x 20 reps (Bodyweight)
- Seated Isometric Calf Press — 3 x 8 reps, hold 10s each side (Bodyweight)
- Seated Heel Raise (Bodyweight) — 2 x 12 slow reps each side (Bodyweight)
- Legs-Up-The-Wall — 1 x 3 min (Bodyweight)

**Withheld, and why:**

- **Standing Calf Raise (slow eccentric)** (was 3 x 15 reps (3s down)) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Soleus Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Single-Leg Calf Raise** (was 3 x 12 each side) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Calf Stretch (Wall)** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Calf and soleus stretches against a wall - a healing calf tear does not need lengthening, and that is the exact position most calves tear in
- Heel drops off a step and slow eccentric calf raises - the right treatment for a long-standing tendon problem and far too much for a fresh muscle strain
- Single-leg calf raises, which put roughly double the load through the injured calf compared with using both legs
- Running, skipping and jumping - every stride is a fast, forceful stretch of the tissue you are trying to protect
- Digging into the sore spot with a massage gun or foam roller in the first week or so, which can add to the bleeding and swelling

### Ankle / Achilles

*Only work in a range that stays comfortable - nothing here should push your pain above 2 out of 10, and it should settle straight after you finish. If the pain is higher than that, or the ankle is stiffer and more sore the next morning, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Seated Ankle Pump (Small Range) — 2 x 20 slow reps each side (Bodyweight)
- Seated Toe Raise — 2 x 20 reps (Bodyweight)
- Isometric Ankle Press (In and Out) — 2 x 5 holds of 10s in each direction (Bodyweight)
- Seated Isometric Calf Press — 3 x 8 reps, hold 10s each side (Bodyweight)
- Single-Leg Balance — 3 x 30s each side (Bodyweight)
- Legs-Up-The-Wall — 1 x 3 min (Bodyweight)

**Withheld, and why:**

- **Heel Drop (eccentric)** (was 3 x 15 each side) — A near-maximal load on the injured tissue. Correct for a long-standing problem, far too much for a fresh one.
- **Ankle Circles** (was 2 x 10 each direction, each ankle) — Driven deliberately to the end of the range, which for a fresh sprain is the position of injury.
- **Calf Stretch (Wall)** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Eccentric heel drops off a step - the correct treatment for a long-standing Achilles problem and the wrong choice entirely for one that is freshly strained, swollen or angry
- Calf and soleus stretches against a wall, which pull directly on the tendon you are trying to settle
- Full-range ankle circles - they take an irritated joint to the end of its range in every direction, one after another
- Running, hopping, skipping and jumping, and anything where you push off hard
- Balance work with no support and up on the toes - the balance training here is deliberately flat-footed with a hand on something solid

### Quads

*Work only in a range that stays pain-free - 0 to 2 out of 10 at most, and no sharp pull at any point. If pain goes above a 2 while you work, or the thigh is more sore later that day or the next morning, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Quad Set (isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Short-Arc Quad Extension (Towel Roll) — 3 x 12 reps, hold 2s at the top (Bodyweight)
- Supine Straight-Leg Raise — 3 x 10 each side (Bodyweight)
- Banded Clamshell — 2 x 15 each side (Light band)
- Single-Leg Balance — 3 x 30s each side (Bodyweight)
- Legs-Up-The-Wall — 1 x 3 min (Bodyweight)

**Withheld, and why:**

- **Standing Quad Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Slow Step-Down (eccentric)** (was 3 x 10 each side) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Couch Stretch** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.
- **Isometric Wall Sit** (was 2 x 30s) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Hip Flexor Kneeling Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Standing Quad Stretch, Couch Stretch and kneeling hip flexor stretches - all of them pull a torn quad into its longest position, which is the one thing torn muscle fibres cannot tolerate in the first week or two
- Slow Step-Down and any other eccentric or step-based quad work - lowering under control is exactly the loading pattern that tore the muscle in the first place
- Isometric Wall Sit and deep squats or lunges - long holds at 90 degrees put high tension through the quad while it is already lengthened
- Foam rolling or digging into the sore spot - pressure over a fresh strain can worsen the bleeding and bruising
- Running, kicking and sprinting until the leg is pain-free at full effort on the exercises below

### Knee

*Stay in a pain-free range throughout - 0 to 2 out of 10 is the limit, and nothing should feel sharp or catch. If pain goes above a 2, or the knee is more swollen or stiff the next morning, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Quad Set (isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Supported Heel Slide — 2 x 10 slow slides each side (Bodyweight)
- Supine Straight-Leg Raise — 3 x 10 each side (Bodyweight)
- Glute Bridge (isometric hold) — 3 x 10 reps, hold 5s each (Bodyweight)
- Terminal Knee Extension (band) — 3 x 15 each side (Light band)
- Legs-Up-The-Wall — 1 x 3 min (Bodyweight)

**Withheld, and why:**

- **Slow Step-Down** (was 3 x 10 each side) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **VMO Wall Sit** (was 3 x 30s) — More load than an irritated area can take inside a 0-2/10 pain limit.
- **Standing Quad Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Slow Step-Down, step-ups and squatting past a quarter of the way down - deep bending squeezes an already irritated kneecap and loads the joint eccentrically
- VMO Wall Sit and any long hold at 90 degrees - high load in deep bend is the classic way to flare a sore knee
- Standing Quad Stretch, Figure-4 Glute Stretch and kneeling stretches - they tug on a joint that is already irritated and add nothing while it is settling
- Kneeling, twisting on a planted foot, jumping and running until the knee is comfortable with everything below
- Pushing through swelling - a knee that puffs up after a session was loaded too hard, not stretched too little

### Hip / Groin

*Everything here should stay pain-free - up to 2 out of 10 at most, with no sharp pull in the groin. If pain goes above a 2 while you work, or the area is worse later that day or the next morning, stop and get it assessed by a physiotherapist or doctor.*

**Given instead:**

- Isometric Adductor Squeeze (Ball or Towel) — 3 x 10 reps, hold 5s each (Soft ball or rolled towel)
- Glute Bridge (isometric hold) — 3 x 10 reps, hold 5s each (Bodyweight)
- Seated Hip March (Low Lift) — 2 x 12 each side (Bodyweight)
- Long-Lever Adductor Squeeze — 3 x 8 reps, hold 5s each (Soft ball or rolled towel)
- Single-Leg Balance — 3 x 30s each side (Bodyweight)
- Legs-Up-The-Wall — 1 x 3 min (Bodyweight)

**Withheld, and why:**

- **Copenhagen Adductor Hold** (was 3 x 20s each side) — A near-maximal load on the injured tissue. Correct for a long-standing problem, far too much for a fresh one.
- **Hip Flexor Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Figure-4 Glute Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Pigeon Pose** (was 2 x 60s each side) — A long passive hold that parks the healing tissue at its full length.

**Also to be avoided:**

- Copenhagen Adductor Hold - one of the highest adductor loads there is, and completely wrong for a groin that is still healing
- Butterfly and seated groin stretches, Pigeon Pose and wide-legged positions - they take the injured inner thigh to its full length, which is where fresh strains re-tear
- Hip Flexor Stretch and kneeling lunge stretches - the same problem at the front of the hip if that is the part that was strained
- Lateral Band Walk, side lunges and wide-stance squats - these pull the groin long while it is under load and weight-bearing
- Kicking, sprinting and changing direction until the squeezes below are comfortable at full effort

### Front of Shoulder

*Work only in a range that stays pain-free - a mild ache of 0 to 2 out of 10 is acceptable, anything sharper is not. Stop and get the shoulder assessed if pain climbs above 2 out of 10 during a session or if it is more sore the day after.*

**Given instead:**

- Pendulum Shoulder Swing — 2 x 30s each side (Bodyweight)
- Scapular Setting (Isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Isometric Shoulder External Rotation (Doorframe) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Isometric Shoulder Flexion Press (Wall) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Supported Shoulder Slide (Table) — 2 x 10 slow reps each side (Bodyweight (towel on a table))
- Wall Slide — 2 x 8 slow reps (Bodyweight)

**Withheld, and why:**

- **Doorway Chest Stretch** (was 2 x 30s each side) — A long passive hold that parks the healing tissue at its full length.
- **Pec Minor Stretch (doorway)** (was 2 x 30s each side) — A long passive hold that parks the healing tissue at its full length.
- **Doorway Chest Opener** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.

**Also to be avoided:**

- Doorway chest stretch and pec minor stretch - both drive the arm into end-range shoulder extension, which is the exact position that pulls on a freshly strained front shoulder
- Cross-body and overhead stretching - end-range positions add nothing in the first ten days and can irritate a healing tendon
- Shoulder CAR and other full-circle mobility drills - taking the joint to its limit in every direction is the opposite of what an acute strain needs
- Press-ups, dips, bench pressing and overhead pressing - loaded shoulder flexion is a return-to-sport task, not a day 2-10 task
- Lifting the arm above shoulder height against gravity until the isometric holds feel completely comfortable

### Back of Shoulder

*Stay inside a pain-free range at all times - 0 to 2 out of 10 discomfort is fine, more than that is a signal to stop. If pain goes above 2 out of 10, or the shoulder is worse the following day, stop and get it assessed.*

**Given instead:**

- Pendulum Shoulder Swing — 2 x 30s each side (Bodyweight)
- Scapular Setting (Isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Isometric Shoulder External Rotation (Doorframe) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Isometric Shoulder Extension Press (Wall) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Prone Thoracic Extension — 2 x 8 reps, hold 2s at top (Bodyweight)
- Band Face Pull — 2 x 12 slow reps (Very light band)

**Withheld, and why:**

- **Cross-Body Shoulder Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Cross-body shoulder stretch - it lengthens the rear deltoid and back of the shoulder capsule, which is precisely the tissue that has been strained
- Band Pull-Apart and Prone Y Raise at their usual dose - both take the injured rear deltoid through full range under load and squeeze hard at the end, which is too much in the first week
- Shoulder CAR and full-circle mobility work - end range in every direction is the wrong ask for an acute strain
- Rows, pull-downs, rear flyes and any pulling with weight
- Sleeping on the sore side, and the sleeper stretch, which compresses and lengthens the back of the shoulder at the same time

### Chest

*Everything here should feel easy - keep discomfort at 0 to 2 out of 10 and ease off the moment it goes higher. If pain rises above 2 out of 10, or the chest is more sore the next day, stop the session and get it assessed.*

**Given instead:**

- Scapular Setting (Isometric) — 3 x 10 reps, hold 5s each (Bodyweight)
- Isometric Pec Squeeze (Palms Together) — 3 x 6 reps, hold 10s each (Bodyweight)
- Isometric Chest Press Into Wall — 3 x 6 reps, hold 10s each side (Bodyweight)
- Band Chest Press (Light, Short Range) — 2 x 12 slow reps (Light band)

**Withheld, and why:**

- **Doorway Chest Stretch** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.
- **Incline Push-Up (slow)** (was 3 x 10 slow reps) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Pec Minor Stretch** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.
- **Doorway Chest Opener** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.

**Also to be avoided:**

- Doorway chest stretch, pec minor stretch and floor angels - each one takes the chest muscle to its full length, which is the single position a healing pec strain cannot tolerate
- Press-ups of any kind, including incline - the bottom of a press-up is a loaded stretch of the pec
- Flyes, dips and bench pressing, which combine load with end-range width
- Letting the elbows travel behind the ribs in any exercise, including sleeping with the arm out wide or hanging off the edge of the bed
- Chest-opening yoga positions and foam rolling directly over the sore area

### Biceps

*Only work in a range that stays pain-free - 0 to 2 out of 10 discomfort is acceptable, anything above that is not. Stop and get the arm assessed if pain goes past 2 out of 10 during the session or if it is worse the following day.*

**Given instead:**

- Elbow Flexion / Extension ROM — 2 x 10 slow reps each side (Bodyweight)
- Forearm Supination / Pronation — 2 x 15 each direction (Bodyweight)
- Isometric Elbow Flexion Hold (Table) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Isometric Supination Hold (Towel) — 2 x 6 reps, hold 10s each side (Rolled towel)
- Band Curl (light, high reps) — 2 x 15 slow reps (Very light band)

**Withheld, and why:**

- **Bicep Stretch (arm back)** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Band Curl (light, high reps)** (was 3 x 20 reps) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Wrist Flexor Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Cross-Body Shoulder Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Forearm Flexor & Extensor Stretch** (was 1 x 30s each way, each arm) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- The arm-back bicep stretch - straightening the elbow with the arm behind you is the longest possible position for the biceps and its shoulder tendon, and a healing biceps should not go there
- Cross-body shoulder stretch and wrist flexor stretch, which both pull on the same tissue line
- Curls with weight, chin-ups and anything with a slow lowering phase - controlled lowering under load is how most biceps injuries happen in the first place
- Forcing the last few degrees of straightening at the elbow, whether by yourself or with someone helping
- Carrying shopping or heavy bags in that hand while the arm is still sore

### Triceps

*Keep everything inside a pain-free range - 0 to 2 out of 10 discomfort is fine, anything sharper means stop. If pain rises above 2 out of 10, or the back of the arm is more sore the day after, stop and get it assessed.*

**Given instead:**

- Elbow Flexion / Extension ROM — 2 x 10 slow reps each side (Bodyweight)
- Forearm Supination / Pronation — 2 x 15 each direction (Bodyweight)
- Isometric Elbow Extension Press (Thigh) — 3 x 6 reps, hold 10s each side (Bodyweight)
- Isometric Shoulder Extension Press (Wall) — 2 x 6 reps, hold 10s each side (Bodyweight)
- Band Pushdown (light, high reps) — 2 x 15 slow reps (Very light band)

**Withheld, and why:**

- **Overhead Tricep Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Cross-Body Tricep Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Wrist Extensor Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Side-Bend Overhead Reach** (was 1 x 40s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Overhead and cross-body tricep stretches - both put the triceps at full length across the shoulder and the elbow at the same time, which a healing muscle cannot take
- Wrist extensor stretch, which pulls on the same chain at the elbow
- Dips, close-grip pressing, skull crushers and any overhead pressing
- Wall angels and overhead arm slides in the first week - taking the arm above the head lengthens the long head of the triceps at the shoulder
- Bending the elbow deeply while holding something heavy, such as carrying a bag with the arm bent

### Elbow

*Stay inside a pain-free range for every movement here - no more than 2 out of 10 on a scale where 0 is nothing and 10 is the worst pain you can imagine. If the elbow goes above that during a movement, or feels worse in the hours afterwards, stop and get it assessed before doing this again.*

**Given instead:**

- Open-and-Close Fist Pumps — 2 x 20 slow reps each side (Bodyweight)
- Isometric Wrist Extension Hold — 3 x 30s each side (Bodyweight)
- Isometric Wrist Flexion Hold — 2 x 20s each side (Bodyweight)
- Isometric Elbow Press (Bend and Straighten) — 2 x 20s each direction (Bodyweight)
- Pain-Free Elbow Bend and Straighten — 2 x 10 slow reps each side (Bodyweight)
- Forearm Supination / Pronation — 2 x 15 each direction (Bodyweight)

**Withheld, and why:**

- **Eccentric Wrist Extension** (was 3 x 12 each side) — Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.
- **Forearm Flexor & Extensor Stretch** (was 1 x 30s each way, each arm) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Wrist flexor and extensor stretches - pulling the fingers back on a straight arm puts the healing tendon at the elbow on full stretch, which is exactly what keeps it irritable
- Eccentric Wrist Extension with a water bottle - slow heavy lowering is the right drill for a long-standing tendon problem, not for a strain that is only days old
- The Forearm Flexor & Extensor Stretch that normally ends this session - it is the same end-range pull with the elbow locked out
- Pronator Self-Release - digging a thumb into tissue that is still swollen and sore adds irritation rather than settling it
- Hanging, heavy gripping, press-ups and any loaded arm work - the elbow is not ready to take load through a long straight arm yet
- Fully straightening or fully bending the elbow to its limit - the last few degrees at either end are where a fresh strain gets pulled again

### Wrist

*Everything here should stay pain-free - up to 2 out of 10 at most, on a scale where 0 is nothing and 10 is the worst pain you can imagine. If the wrist hurts more than that at any point, or is more sore later on, stop and get it looked at before repeating this session.*

**Given instead:**

- Open-and-Close Fist Pumps — 2 x 20 slow reps each side (Bodyweight)
- Isometric Wrist Extension Hold — 3 x 30s each side (Bodyweight)
- Isometric Wrist Flexion Hold — 2 x 20s each side (Bodyweight)
- Soft Towel Squeeze — 2 x 10 reps, hold 5s each (Rolled towel)
- Band Finger Extension — 2 x 20 reps (Light band)
- Pain-Free Wrist Glide — 2 x 10 slow reps each direction (Bodyweight)

**Withheld, and why:**

- **Wrist Flexor Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Wrist Extensor Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Wrist Circles** (was 2 x 10 each direction) — Driven deliberately to the end of the range, which for a fresh sprain is the position of injury.
- **Forearm Flexor & Extensor Stretch** (was 1 x 30s each way, each arm) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Wrist flexor and extensor stretches - taking a sore wrist to its end range pulls directly on the ligaments and tendons that are trying to knit back together
- Full end-range wrist circles - going as far as the joint will travel in every direction strains the injured structures at the outside of each circle
- The Forearm Flexor & Extensor Stretch that normally closes this session - it is a 30 second end-range hold on an injured joint
- Press-ups, planks, front rack holds or anything that puts bodyweight through the palm - a bent-back loaded wrist is far too much this early
- Loaded wrist curls, heavy gripping and hanging - the wrist should not be taking outside load until it is comfortable without it
- Cracking or forcing the joint to see how far it goes - testing the painful range repeatedly is what keeps it inflamed

### Neck

*Keep every movement inside a pain-free range - 2 out of 10 at the very most, where 0 is no pain and 10 is the worst pain you can imagine. If anything is sharper than that, or the neck is stiffer and sorer afterwards, stop and get it assessed rather than pushing on.*

**Given instead:**

- Supported Neck Nod (Head Resting) — 2 x 10 reps, hold 3s each (Bodyweight)
- Isometric Neck Press (Hand Resistance) — 2 x 4 directions, hold 5s each (Bodyweight)
- Supported Neck Rotation (Small Range) — 2 x 8 slow reps each side (Bodyweight)
- Chin Tuck — 3 x 10 reps, hold 3s each (Bodyweight)
- Scapular Setting (Shoulder Blade Set) — 2 x 10 reps, hold 5s each (Bodyweight)
- Wall Angel — 2 x 10 slow reps (Bodyweight)

**Withheld, and why:**

- **Chin Tuck** (was 3 x 10 reps, hold 3s each) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Neck Side Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Levator Scapulae Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Upper Trap Stretch** (was 2 x 30s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Neck side stretches, upper trap stretches and levator scapulae stretches - pulling the head away from a strained neck muscle re-stresses the tissue that is trying to heal
- Any end-range turning, looking up or dropping the chin to the chest - the far end of the range is where a fresh neck strain gets provoked
- Hands-on pulling of the head in any direction, including using the other arm to add pressure
- Loaded shrugs, farmer's carries, overhead pressing and heavy rows - they all pull on the neck through the shoulders
- The Prone Thoracic Extension that normally ends this session - lying face down and lifting the head holds the neck in extension for exactly the wrong length of time
- Fast or repeated head movements to test the range - repeatedly checking how far it will go keeps the area irritated

### Lower Back

*Everything here should feel easy - keep any discomfort at or below 2 out of 10 on a 0 to 10 pain scale, and never push into a position that hurts. If pain goes above that during the session, or the back is worse the next day, stop and get it assessed by a physio or doctor.*

**Given instead:**

- Supine Abdominal Brace with Breathing — 3 x 5 reps, hold 10s each (Bodyweight)
- Supine Pelvic Tilt (Small Range) — 2 x 10 slow reps (Bodyweight)
- Glute Bridge (isometric hold) — 3 x 8 reps, 5s hold each (Bodyweight)
- Dead Bug — 2 x 6 slow reps each side (Bodyweight)
- Bird Dog — 2 x 6 each side, hold 3s (Bodyweight)

**Withheld, and why:**

- **Hip Flexor Stretch** (was 2 x 45s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Hip Flexor Stretch - the deep lunge tips the pelvis forward and pulls the sore low back to the very end of its range
- Cat-Cow - it drives the injured segment into full bending backwards and forwards, which is the movement that hurts most in the first ten days
- Supine Spinal Twist and Seated Forward Fold - end-range twisting and folding put a direct pull on healing muscle and ligament
- Hollow Body Hold and McGill Side Plank - far too much trunk load for a strain that is only a few days old
- Any hip hinge, deadlift or good morning pattern, including Hip Hinge Against Wall - loading the back in a bent-forward position is what tends to re-tear it
- Rolling or digging into the sore spot - it feels productive but it just irritates fresh tissue

### Upper Back

*Stay inside a pain-free range throughout - anything you feel should be no more than 2 out of 10 on a 0 to 10 pain scale. If it climbs above that, or the mid-back feels worse in the hours afterwards, stop the session and have it assessed by a physio or doctor.*

**Given instead:**

- Chin Tuck — 2 x 10 reps, hold 5s each (Bodyweight)
- Scapular Setting (Isometric Squeeze) — 3 x 8 reps, hold 5s each (Bodyweight)
- Thoracic Cat-Cow — 2 x 10 slow reps (Bodyweight)
- Wall Slide — 2 x 10 slow reps (Bodyweight)
- Isometric Band Row Hold (Light) — 3 x 5 reps, hold 10s each (Light band)
- Band Face Pull — 2 x 15 light reps (Light band)

**Withheld, and why:**

- **Book Opener (thoracic rotation)** (was 2 x 8 each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Thread-the-Needle Rotation and Book Opener - both take the mid-back to the end of its twist, which pulls directly on the strained muscle
- Prone T-Spine Extension - arms out in a T is a long lever and loads sore tissue hard for no benefit this early
- Band Pull-Apart - straight-arm band work puts more pull through the rhomboids and mid-traps than a fresh strain can take
- Cat-Cow at full range and Child's Pose - end-range rounding lengthens exactly what is healing
- Upper Trap Stretch, Levator Scapulae Stretch and Neck Side Stretch - hanging on a strained area is not treatment
- Rows, pull-ups and overhead pressing with any real weight until this is settled and pain-free

### Lat / Mid Back

*Work only where it is pain-free - a mild 0 to 2 out of 10 on a 0 to 10 pain scale is acceptable, anything sharper is not. Stop the session and get the area assessed by a physio or doctor if pain goes above 2 out of 10, or if it is worse in the hours after.*

**Given instead:**

- Seated Lat Press-Down Hold (Chair) — 3 x 6 reps, hold 8s each (Bodyweight)
- Thoracic Cat-Cow — 2 x 10 slow reps (Bodyweight)
- Band Face Pull — 2 x 15 light reps (Light band)
- Band Straight-Arm Press-Down (Short Range) — 2 x 12 slow reps each side (Light band)
- Prone Thoracic Extension — 2 x 10 reps, hold 2s at top (Bodyweight)

**Withheld, and why:**

- **Child's Pose with Side Reach** (was 2 x 45s each side) — A long passive hold that parks the healing tissue at its full length.
- **Book Opener (thoracic rotation)** (was 2 x 8 each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.
- **Doorway Lat Stretch** (was 2 x 30s each side) — A long passive hold that parks the healing tissue at its full length.
- **Side-Bend Overhead Reach** (was 1 x 40s each side) — Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.

**Also to be avoided:**

- Doorway Lat Stretch, Child's Pose with Side Reach and Side-Bend Overhead Reach - all three pull the lat out to its full length, which is the one thing a strained lat cannot tolerate in the first ten days
- Any overhead reaching or hanging position - the lat is already at full stretch before you have even added load
- Thread-the-Needle Rotation and Book Opener - end-range twisting drags on the same tissue from a different angle
- Band Pull-Apart - straight-arm band tension is more than a fresh strain needs
- Pull-ups, lat pulldowns and dumbbell rows - the classic way people re-tear a lat is going back to pulling too soon
- Foam rolling the sore area - pressure on a healing tear does not speed it up

### Core / Ribs

*Keep every movement pain-free - no more than 2 out of 10 on a 0 to 10 pain scale - and breathe normally rather than holding your breath. If pain rises above 2 out of 10, or the ribs or stomach feel worse afterwards, stop and get assessed by a physio or doctor.*

**Given instead:**

- Supine Rib Breathing (Hands on Ribs) — 2 x 10 slow breaths (Bodyweight)
- Supine Heel Slide (Braced) — 2 x 8 slow reps each side (Bodyweight)
- Dead Bug — 2 x 6 slow reps each side (Bodyweight)
- Bird Dog — 2 x 6 each side, hold 3s (Bodyweight)
- Pallof Press (Isometric Hold) — 2 x 15s each side (Light band)

**Withheld, and why:**

- **McGill Side Plank** (was 2 x 20s each side) — More load than an irritated area can take inside a 0-2/10 pain limit.
- **Hollow Body Hold** (was 3 x 20s) — More load than an irritated area can take inside a 0-2/10 pain limit.
- **Child's Pose with Side Reach** (was 2 x 30s each side) — A long passive hold that parks the healing tissue at its full length.

**Also to be avoided:**

- Hollow Body Hold - holding the whole body off the floor is one of the hardest loads there is for a torn stomach muscle
- McGill Side Plank - a side plank loads the side of the trunk at precisely the spot that is injured
- Child's Pose with Side Reach, Side-Bend Overhead Reach and Supine Spinal Twist - side bending and twisting pull the injured muscle and its rib attachments out to full length
- Cat-Cow - arching backwards stretches the front of the trunk, which is the healing tissue in a stomach or rib strain
- Sit-ups, crunches, russian twists and leg raises - full-range trunk flexion is the fastest way to set this back
- Any lift heavy enough that you hold your breath and strain, including coughing or sneezing unbraced if you can help it
