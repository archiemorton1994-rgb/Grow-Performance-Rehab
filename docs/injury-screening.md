# Injury screening — what the app blocks, and for whom

This is generated from the live rules in `lib/exercise-safety.ts`. It exists so the
mapping can be checked by someone qualified without reading any code. If something here
is wrong, say which line and it changes — the rules are plain data, not logic.

**What this does and does not do.** It only ever REMOVES exercises. It never decides
that something is *good* for a complaint — the targeted rehab sessions do that, and
they are deliberately exempt from this screen. Where something is removed, a
replacement is chosen from the same category and movement pattern, and the user is
told what was swapped and can put it back with one tap.

**One rule applies on top of all of this:** a BEGINNER who reports any complaint at
all also loses every high-impact exercise, not just the ones that load the sore
joint. Experienced lifters keep whatever their specific complaint does not rule out.

## Upper Body

### Front Shoulder

Avoids: overhead work, end-range shoulder work.

Blocks **30 of 447** exercises (7%).

Examples of what it removes:

- Australian Pull-Up
- Cable Chest Fly
- Chin-Up
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit B: DB Thruster + Renegade Row + Jump Squat
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- DB Chest Fly
- DB Deadlift + Push Press AMRAP
- DB Pullover
- DB Push Press Intervals
- DB Shoulder Press
- …and 18 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

### Rear Shoulder

Avoids: overhead work, end-range shoulder work.

Blocks **30 of 447** exercises (7%).

Examples of what it removes:

- Australian Pull-Up
- Cable Chest Fly
- Chin-Up
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit B: DB Thruster + Renegade Row + Jump Squat
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- DB Chest Fly
- DB Deadlift + Push Press AMRAP
- DB Pullover
- DB Push Press Intervals
- DB Shoulder Press
- …and 18 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

### Elbow

Avoids: loaded elbow work, overhead work, weight through the wrists.

Blocks **89 of 447** exercises (20%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Archer Push-Up
- Australian Pull-Up
- Band Bicep Curl
- Band Curl (light, high reps)
- Band Pushdown (light, high reps)
- Bear Crawl
- Bear Crawl (Easy Pace)
- Bear Crawl (Steady Pace)
- Bear Crawl + Sprint
- Bear Crawl Intervals
- Burpee
- …and 77 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints

### Wrist

Avoids: weight through the wrists, hard gripping.

Blocks **81 of 447** exercises (18%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Archer Push-Up
- Australian Pull-Up
- Barbell Deadlift
- Bear Crawl
- Bear Crawl (Easy Pace)
- Bear Crawl (Steady Pace)
- Bear Crawl + Sprint
- Bear Crawl Intervals
- Burpee
- Burpee Ladder
- Burpee to Broad Jump
- …and 69 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints

### Neck

Avoids: loading the neck and traps, overhead work, loading through the spine.

Blocks **45 of 447** exercises (10%).

Examples of what it removes:

- Australian Pull-Up
- Back Squat
- Banded Glute Bridge
- Banded Good Morning
- Barbell Back Squat
- Chin-Up
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit B: DB Thruster + Renegade Row + Jump Squat
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- DB Deadlift + Push Press AMRAP
- DB Farmer Carry
- …and 33 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

## Torso

### Lower Back

Avoids: jumping and landing, loading through the spine, rounding the lower back, loaded hip hinging.

Blocks **111 of 447** exercises (25%).

Examples of what it removes:

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints
- Back Extension
- Back Squat
- Banded Good Morning
- Banded Hip Thrust
- Barbell Back Squat
- Barbell Deadlift
- …and 99 more

Still allowed (loaded, but not in a way this complaint rules out):

- Alternating Reverse Lunge
- Archer Push-Up
- Australian Pull-Up
- Band Bicep Curl
- Band Curl (light, high reps)
- Band Pushdown (light, high reps)

### Upper Back / Thoracic

Avoids: loading through the spine, overhead work, loading the neck and traps.

Blocks **45 of 447** exercises (10%).

Examples of what it removes:

- Australian Pull-Up
- Back Squat
- Banded Glute Bridge
- Banded Good Morning
- Barbell Back Squat
- Chin-Up
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit B: DB Thruster + Renegade Row + Jump Squat
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- DB Deadlift + Push Press AMRAP
- DB Farmer Carry
- …and 33 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

### Core

Avoids: rounding the lower back, loaded hip hinging.

Blocks **51 of 447** exercises (11%).

Examples of what it removes:

- 45 Degree Hyperextension
- Assault Bike EMOM + RDL
- Back Extension
- Banded Good Morning
- Banded Hip Thrust
- Barbell Deadlift
- Barbell Hip Thrust
- Cable Crunch
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit A: KB Swing + Goblet Squat + Push-Up
- Circuit B: Bear Crawl + KB Swing + Box Jump
- Circuit B: KB Snatch + Box Jump + Burpee
- …and 39 more

Still allowed (loaded, but not in a way this complaint rules out):

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints

## Lower Body

### Knee

Avoids: jumping and landing, deep knee bending, loaded knee extension.

Blocks **72 of 447** exercises (16%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints
- Barbell Bulgarian Split Squat
- Bear Crawl + Sprint
- Box Jump (Step-Down)
- Broad Jump
- Bulgarian Split Squat
- Burpee
- Burpee Ladder
- …and 60 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Archer Push-Up
- Assault Bike EMOM + RDL
- Australian Pull-Up
- Back Extension
- Back Squat

### Hip

Avoids: jumping and landing, deep knee bending, loaded hip hinging.

Blocks **116 of 447** exercises (26%).

Examples of what it removes:

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints
- Back Extension
- Banded Good Morning
- Banded Hip Thrust
- Barbell Bulgarian Split Squat
- Barbell Deadlift
- …and 104 more

Still allowed (loaded, but not in a way this complaint rules out):

- Archer Push-Up
- Australian Pull-Up
- Back Squat
- Band Bicep Curl
- Band Curl (light, high reps)
- Band Pushdown (light, high reps)

### Ankle

Avoids: jumping and landing, loading the ankle.

Blocks **57 of 447** exercises (13%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints
- Bear Crawl + Sprint
- Box Jump (Step-Down)
- Broad Jump
- Burpee
- Burpee Ladder
- Burpee to Broad Jump
- Calf Raise
- Circuit A: Burpee + Squat Jump + Plyo Lunge
- …and 45 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike EMOM + RDL
- Australian Pull-Up
- Back Extension

### Calf / Shin

Avoids: jumping and landing, loading the ankle.

Blocks **57 of 447** exercises (13%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints
- Bear Crawl + Sprint
- Box Jump (Step-Down)
- Broad Jump
- Burpee
- Burpee Ladder
- Burpee to Broad Jump
- Calf Raise
- Circuit A: Burpee + Squat Jump + Plyo Lunge
- …and 45 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike EMOM + RDL
- Australian Pull-Up
- Back Extension

## Upper Body Muscles

### Chest

Avoids: end-range shoulder work.

Blocks **8 of 447** exercises (2%).

Examples of what it removes:

- Cable Chest Fly
- DB Chest Fly
- DB Pullover
- Machine Chest Fly (Pump)
- Machine Rear Delt Fly
- Pec Deck (Machine Fly)
- Tricep Dips (Bench)
- Weighted Dips

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

### Bicep / Front Arm

Avoids: loaded elbow work, hard gripping.

Blocks **65 of 447** exercises (15%).

Examples of what it removes:

- Australian Pull-Up
- Band Bicep Curl
- Band Curl (light, high reps)
- Band Pushdown (light, high reps)
- Barbell Deadlift
- Cable Bicep Curl
- Cable Tricep Pushdown
- Chin-Up
- Circuit A: KB Swing + Goblet Squat + Push-Up
- Circuit B: Bear Crawl + KB Swing + Box Jump
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- …and 53 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

### Tricep / Back Arm

Avoids: loaded elbow work, overhead work.

Blocks **48 of 447** exercises (11%).

Examples of what it removes:

- Australian Pull-Up
- Band Bicep Curl
- Band Curl (light, high reps)
- Band Pushdown (light, high reps)
- Cable Bicep Curl
- Cable Tricep Pushdown
- Chin-Up
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit B: DB Thruster + Renegade Row + Jump Squat
- Circuit B: KB Snatch + Box Jump + Burpee
- Circuit B: KB Snatch + Jump Squat + Renegade Row
- DB Bicep Curl
- …and 36 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit

## Lower Body Muscles

### Quads (Front Thigh)

Avoids: deep knee bending, loaded knee extension, jumping and landing.

Blocks **72 of 447** exercises (16%).

Examples of what it removes:

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints
- Barbell Bulgarian Split Squat
- Bear Crawl + Sprint
- Box Jump (Step-Down)
- Broad Jump
- Bulgarian Split Squat
- Burpee
- Burpee Ladder
- …and 60 more

Still allowed (loaded, but not in a way this complaint rules out):

- 45 Degree Hyperextension
- Archer Push-Up
- Assault Bike EMOM + RDL
- Australian Pull-Up
- Back Extension
- Back Squat

### Hamstrings (Back Thigh)

Avoids: loaded hip hinging, jumping and landing.

Blocks **95 of 447** exercises (21%).

Examples of what it removes:

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints
- Back Extension
- Banded Good Morning
- Banded Hip Thrust
- Barbell Deadlift
- Barbell Hip Thrust
- Bear Crawl + Sprint
- …and 83 more

Still allowed (loaded, but not in a way this complaint rules out):

- Alternating Reverse Lunge
- Archer Push-Up
- Australian Pull-Up
- Back Squat
- Band Bicep Curl
- Band Curl (light, high reps)

### Glutes

Avoids: loaded hip hinging, jumping and landing.

Blocks **95 of 447** exercises (21%).

Examples of what it removes:

- 45 Degree Hyperextension
- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Assault Bike + Squat Jump Circuit
- Assault Bike EMOM + RDL
- Assault Bike Sprints
- Back Extension
- Banded Good Morning
- Banded Hip Thrust
- Barbell Deadlift
- Barbell Hip Thrust
- Bear Crawl + Sprint
- …and 83 more

Still allowed (loaded, but not in a way this complaint rules out):

- Alternating Reverse Lunge
- Archer Push-Up
- Australian Pull-Up
- Back Squat
- Band Bicep Curl
- Band Curl (light, high reps)

### Lats

Avoids: loaded hip hinging, loading through the spine.

Blocks **66 of 447** exercises (15%).

Examples of what it removes:

- 45 Degree Hyperextension
- Assault Bike EMOM + RDL
- Back Extension
- Back Squat
- Banded Good Morning
- Banded Hip Thrust
- Barbell Back Squat
- Barbell Deadlift
- Barbell Hip Thrust
- Circuit A: DB Man Maker + Thruster + Swing
- Circuit A: KB Swing + Goblet Squat + Push-Up
- Circuit B: Bear Crawl + KB Swing + Box Jump
- …and 54 more

Still allowed (loaded, but not in a way this complaint rules out):

- AMRAP: Squat Jump + Broad Jump + Burpee
- Alternating Jump Lunge
- Alternating Reverse Lunge
- Archer Push-Up
- Assault Bike + Squat Jump Circuit
- Assault Bike Sprints

## The categories a movement can fall into

- **jumping and landing** (`high_impact`)
- **deep knee bending** (`deep_knee_flexion`)
- **loaded knee extension** (`open_chain_knee`)
- **loaded hip hinging** (`loaded_hinge`)
- **loading through the spine** (`spinal_compression`)
- **rounding the lower back** (`lumbar_flexion`)
- **overhead work** (`overhead`)
- **end-range shoulder work** (`shoulder_end_range`)
- **loaded elbow work** (`elbow_load`)
- **weight through the wrists** (`wrist_load`)
- **loading the ankle** (`ankle_load`)
- **loading the neck and traps** (`neck_load`)
- **hard gripping** (`grip_load`)

