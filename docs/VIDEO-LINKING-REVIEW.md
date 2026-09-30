# Video linking: what still needs Archie

<!-- GENERATED FILE - do not edit by hand. Run `npm run video-review` to refresh. -->

The app now reads 232 uploads from @GrowPerformanceRehabilitation, captured 2026-09-26. Every exercise whose name is EXACTLY the title of an upload has been linked to it, and **150 of the app's 299 exercises now open a video**. Before this refresh the app still held the August list of 103 uploads and only 72 exercises had footage.

This page is the rest of the job, and none of it has been wired. An exercise with no video is not broken: its red button runs a YouTube search on the exercise name, which is what the app has always done. A video on the WRONG card is broken quietly, so nothing below is attached on a resemblance, however obvious the resemblance looks.

Everything here needs one word: yes, no, or film it.

## 1. Where the channel itself is unclear

- **An upload with no real title: "14 September 2026"** (https://www.youtube.com/shorts/dW0dsA7Oqek). The title is the date it went up, so there is no way to tell from here which movement it shows. Nothing is linked to it. Renaming it on YouTube is enough to bring it in on the next refresh.
- **Two uploads share the title "Kettlebell Swings"**: https://www.youtube.com/shorts/6x-elUqiBJ0 and https://www.youtube.com/shorts/7bIzl01moZc. Two videos cannot both be the demo for one card, so this was left out of the automatic pass. The app has an exercise called exactly that (Kettlebell Swings). Its card opens https://www.youtube.com/shorts/6x-elUqiBJ0 today, the take chosen in August. Which of the two should it be?

## 2. Wired on the name, worth one look

Two exercises whose names are the same but for the words in brackets, each now opening the upload with its own exact title. The names match character for character, so nothing was guessed, but a name cannot tell anybody whether the two are the right way round. One look at each confirms it.

- Trapbar Deadlift (high handles) opens "Trapbar Deadlift (high handles)" - https://www.youtube.com/shorts/3yjg8We2hEc
- Trapbar Deadlift (low handles) opens "Trapbar Deadlift (Low Handles)" - https://www.youtube.com/shorts/dNEiynURLvg

## 3. A name that looks like an exact match and is not

The traps to know about before wiring anything else by hand.

- `Box Squat` in `lib/exercise-videos.ts` opens "Barbell Box Squat" (https://www.youtube.com/shorts/6uPr0ee_wa4), and there is now a DIFFERENT upload titled exactly "Box Squat" (https://www.youtube.com/shorts/vxQKnZyUm6s). Nothing is broken today, and the app does not serve that name any more, but the two are easy to mix up.

## 4. 9 uploads were renamed since August

Worth knowing because the old titles are quoted in the code and in earlier decisions, and because two of the renames change which movement the title points at.

| Was called | Now called | Video |
| --- | --- | --- |
| Single Arm Cable Tricep Extensions | Cable Single Arm Tricep Extensions | https://www.youtube.com/shorts/SU3KkNX7cCg |
| Single Arm Cable Curls | Cable Single Arm Curls | https://www.youtube.com/shorts/hMJysvlxaqY |
| Single Arm Cable Rows | Cable Single Arm Rows | https://www.youtube.com/shorts/U5EdqKJDX6s |
| Tib Raises | Seated Tib Raises | https://www.youtube.com/shorts/di7H803LkK0 |
| Seated Lateral Raises | Seated Dumbbell Lateral Raises | https://www.youtube.com/shorts/UsZgojyINOg |
| Standing Dumbbell Rows | Bent Over Dumbbell Rows | https://www.youtube.com/shorts/XTbgWQAyO6Y |
| Trapbar Deadlift | Trapbar Deadlift (high handles) | https://www.youtube.com/shorts/3yjg8We2hEc |
| Box Squat | Barbell Box Squat | https://www.youtube.com/shorts/6uPr0ee_wa4 |
| Alternating Dumbbell Press | Alternating Dumbbell Shoulder Press | https://www.youtube.com/shorts/80Ro5q41PJw |

## 5. Near misses: 44 pairs, none of them linked

On the left is the app's name for the exercise, on the right the title of an upload nothing is using. They are grouped by how close the wording is, closest first. A tick against any row is enough to wire it.

### The same words, spelled or spaced differently (15)

| The app calls it | The video is called | Video |
| --- | --- | --- |
| Band Resisted Back Squats | Band Resisted Back Squat | https://www.youtube.com/shorts/71RMsWY-ir4 |
| Band Resisted Front Squats | Band Resisted Front Squat | https://www.youtube.com/shorts/2zA7DPiN9uc |
| Banded Deadbugs | Banded Deadbug | https://www.youtube.com/shorts/3weEfp-HaBk |
| Bear Crawl | Bear Crawls | https://www.youtube.com/shorts/SPOdO2okxwo |
| Box Squats | Box Squat | https://www.youtube.com/shorts/vxQKnZyUm6s |
| Cable Face Pulls | Cable Facepull | https://www.youtube.com/shorts/tP8AleAgC88 |
| Cable Pallof Hold | Cable Palloff Hold | https://www.youtube.com/shorts/QWNDmcKA_W8 |
| Cable Pallof Press | Cable Palloff Press | https://www.youtube.com/shorts/0esQ9q7F10s |
| Chest Supported Dumbbell Row | Chest Supported Dumbbell Rows | https://www.youtube.com/shorts/U8cmf7vRzms |
| Deficit Split Squats | Deficit Split Squat | https://www.youtube.com/shorts/r-9T61bUcCo |
| Door Frame Rows | Doorframe Rows | https://www.youtube.com/shorts/o-23DJeFOXw |
| Shoulder CAR (Controlled Articular Rotation) | Shoulder CARs (Controlled Articular Rotations) | https://www.youtube.com/shorts/BpXtcAzYnSY |
| Single Arm Dumbbell Rows | Single Arm Dumbbell Row | https://www.youtube.com/shorts/LbSW7NoxNaA |
| Superman Plank | Superman Planks | https://www.youtube.com/shorts/itN9hv0tEOM |
| Zercher Squat | Zercher Squats | https://www.youtube.com/shorts/AxKaqXKYpec |

### One name is the other with a word or two added (17)

| The app calls it | The video is called | Video |
| --- | --- | --- |
| Ab Wheel Rollout (Kneeling) | Ab Wheel Rollout | https://www.youtube.com/shorts/O-PV4nRP1q4 |
| Figure-4 Glute Stretch | Figure 4 Stretch | https://www.youtube.com/shorts/Kk7pygLYW7c |
| Forearm Side Plank | Side Plank | https://www.youtube.com/shorts/JF5kANvI5aY |
| Hip Flexor Kneeling Stretch | Kneeling Hip Flexor Stretch | https://www.youtube.com/shorts/ffrVTB1Sfg0 |
| Hip Flexor Stretch | Kneeling Hip Flexor Stretch | https://www.youtube.com/shorts/ffrVTB1Sfg0 |
| Hip Hinge Against Wall | Hip Hinges | https://www.youtube.com/shorts/GzW9LKufDVM |
| Isometric Elbow Extension Press (Thigh) | Isometric Elbow Extension | https://www.youtube.com/shorts/rwpYc9123d4 |
| Isometric Elbow Flexion Hold (Table) | Isometric Elbow Flexion | https://www.youtube.com/shorts/5kNDNWs9tbs |
| Isometric Wrist Extension Hold | Isometric Wrist Extension | https://www.youtube.com/shorts/eo7GgSh4Sag |
| Isometric Wrist Flexion Hold | Isometric Wrist Flexion | https://www.youtube.com/shorts/O8NM4NYmM1w |
| McGill Side Plank | Side Plank | https://www.youtube.com/shorts/JF5kANvI5aY |
| Side Plank Reach Throughs | Side Plank | https://www.youtube.com/shorts/JF5kANvI5aY |
| Single Leg Romanian Deadlift (Barbell) | Single Leg Barbell Romanian Deadlift | https://www.youtube.com/shorts/9AIEC3yGft4 |
| Single Leg Romanian Deadlift (Barbell) | Single Leg Romanian Deadlift | https://www.youtube.com/shorts/tZQ94VAPp1w |
| Single Leg Romanian Deadlift (Dumbbell) | Single Leg Romanian Deadlift | https://www.youtube.com/shorts/tZQ94VAPp1w |
| Single-Leg Calf Raise | Calf Raises | https://www.youtube.com/shorts/_a4USpdkYEU |
| Single-Leg Calf Raise | Bent Knee Single Leg Calf Raise | https://www.youtube.com/shorts/I4aTkSDhj2Q |

### Most of the words are shared (12)

| The app calls it | The video is called | Video |
| --- | --- | --- |
| Band Resisted Back Squats | Band Resisted Front Squat | https://www.youtube.com/shorts/2zA7DPiN9uc |
| Band Resisted Front Squats | Band Resisted Back Squat | https://www.youtube.com/shorts/71RMsWY-ir4 |
| Eccentric Wrist Extension | Isometric Wrist Extension | https://www.youtube.com/shorts/eo7GgSh4Sag |
| Isometric Shoulder External Rotation (Doorframe) | Seated Shoulder External Rotations | https://www.youtube.com/shorts/JqRjE-haFOM |
| Lateral Band Walk | Banded Lateral Walks | https://www.youtube.com/shorts/cZDYVxn38LY |
| Prone Shoulder External Rotation | Seated Shoulder External Rotations | https://www.youtube.com/shorts/JqRjE-haFOM |
| Seated Toe Raise | Seated Calf Raises | https://www.youtube.com/shorts/gtMaEijS97k |
| Seated Toe Raise | Seated Tib Raises | https://www.youtube.com/shorts/di7H803LkK0 |
| Side Plank Reach Throughs | Side Plank Reach Thru | https://www.youtube.com/shorts/6NJG0qXgLVw |
| Single Leg Romanian Deadlift (Dumbbell) | Single Leg Barbell Romanian Deadlift | https://www.youtube.com/shorts/9AIEC3yGft4 |
| Single-Leg Calf Raise (Eccentric) | Bent Knee Single Leg Calf Raise | https://www.youtube.com/shorts/I4aTkSDhj2Q |
| Single-Leg Glute Bridge | Box Single Leg Bridge | https://www.youtube.com/shorts/hRYFNJHtgSw |

## 6. Uploads no exercise opens (86)

Footage on the channel that no card in the app can reach. Each one is either a movement the library does not carry, which means the exercise has to be written before the video has anywhere to go, or a near miss from the section above.

32 of them ARE named in `lib/exercise-videos.ts`, against a movement the deleted Train catalogue had and the library does not. Those mappings are kept on purpose so the footage is not lost, and they re-attach the day the movement joins the library, but no card opens them today. They are marked below.

- Dumbbell Wrist Curls - https://www.youtube.com/shorts/a7D1h_9B8gc
- Isometric Wrist Extension - https://www.youtube.com/shorts/eo7GgSh4Sag
- Isometric Wrist Flexion - https://www.youtube.com/shorts/O8NM4NYmM1w
- Isometric Elbow Flexion - https://www.youtube.com/shorts/5kNDNWs9tbs
- Isometric Elbow Extension - https://www.youtube.com/shorts/rwpYc9123d4
- Doorframe Rows - https://www.youtube.com/shorts/o-23DJeFOXw
- Bear Crawls - https://www.youtube.com/shorts/SPOdO2okxwo
- Band Resisted Back Squat - https://www.youtube.com/shorts/71RMsWY-ir4
- Band Resisted Front Squat - https://www.youtube.com/shorts/2zA7DPiN9uc
- Superman Planks - https://www.youtube.com/shorts/itN9hv0tEOM
- 14 September 2026 - https://www.youtube.com/shorts/dW0dsA7Oqek
- Zercher Squats - https://www.youtube.com/shorts/AxKaqXKYpec
- Side Plank - https://www.youtube.com/shorts/JF5kANvI5aY
- Box Squat - https://www.youtube.com/shorts/vxQKnZyUm6s
- Single Leg Barbell Romanian Deadlift - https://www.youtube.com/shorts/9AIEC3yGft4
- Deficit Split Squat - https://www.youtube.com/shorts/r-9T61bUcCo
- Clock Lunge Series - https://www.youtube.com/shorts/iAW5xkBndCs
- Ab Wheel Rollout - https://www.youtube.com/shorts/O-PV4nRP1q4
- Atlas Lunges - https://www.youtube.com/shorts/tdee0mAz2xU
- Single Arm Dumbbell Row - https://www.youtube.com/shorts/LbSW7NoxNaA
- Dumbbell Chest Fly - https://www.youtube.com/shorts/gQhe-mYcteQ
- Chest Supported Dumbbell Rows - https://www.youtube.com/shorts/U8cmf7vRzms
- Cable Tricep Extension - https://www.youtube.com/shorts/BAu5JkTNPwY
- Cable Front Raise - https://www.youtube.com/shorts/Vd8IRI-iAaA
- Cable Bicep Curls - https://www.youtube.com/shorts/1ic0MBrhQ3s
- Cable Facepull - https://www.youtube.com/shorts/tP8AleAgC88
- Cable Palloff Press - https://www.youtube.com/shorts/0esQ9q7F10s
- Cable Palloff Hold - https://www.youtube.com/shorts/QWNDmcKA_W8
- Bridge Marches - https://www.youtube.com/shorts/cW-vS8737PI
- Bridge Walkouts - https://www.youtube.com/shorts/LoviMBNTOs8
- Box Single Leg Bridge - https://www.youtube.com/shorts/hRYFNJHtgSw
- Banded Deadbug - https://www.youtube.com/shorts/3weEfp-HaBk
- Box Bridge - https://www.youtube.com/shorts/-Yi9Yr_mTZU
- Box Bridge Marches - https://www.youtube.com/shorts/17WEgsFmCTc
- Prayer Pose Stretch - https://www.youtube.com/shorts/W_PtQlh1lps
- Figure 4 Stretch - https://www.youtube.com/shorts/Kk7pygLYW7c
- Kneeling Hip Flexor Stretch - https://www.youtube.com/shorts/ffrVTB1Sfg0
- Adductor Rock Backs - https://www.youtube.com/shorts/kYSmIECqHwU
- Barbell Calf Raises - https://www.youtube.com/shorts/rVU3BezY21E
- Side Plank Reach Thru - https://www.youtube.com/shorts/6NJG0qXgLVw
- Banded Skiers - https://www.youtube.com/shorts/p8TWOIt7ieA
- Banded Chest Flies - https://www.youtube.com/shorts/l_k0lL8K54A
- Copenhagen Plank - https://www.youtube.com/shorts/GEo3bz2oR3U
- Dumbbell Calf Raises - https://www.youtube.com/shorts/y0t-sFKoYes
- Weighted Back Extensions - https://www.youtube.com/shorts/3TcCn3cz2cc
- Back Extensions - https://www.youtube.com/shorts/kInfBbbNgZ8
- Banded Hip Thrust - https://www.youtube.com/shorts/8c_Aa15OV20
- Single Leg Hip Thrust - https://www.youtube.com/shorts/DpzaM2aZQTE
- Kettlebell Hip Thrust - https://www.youtube.com/shorts/oc2RaD9s2gk
- Barbell Hip Thrust - https://www.youtube.com/shorts/hiJHWhanCLA
- Banded Broad Jumps - https://www.youtube.com/shorts/ds2HDjF4dfk
- Banded Bicep Curls - https://www.youtube.com/shorts/IGgdX1KzzBI
- Spanish Squats - https://www.youtube.com/shorts/a7NjWDSBxHI  _(held for the retired name Spanish Squat)_
- Banded VMO Extensions - https://www.youtube.com/shorts/IOTqFAgZuKc  _(held for the retired name Banded VMO Extension)_
- Leg Swings - https://www.youtube.com/shorts/wx2ZP3GTHTA  _(held for the retired name Leg Swing)_
- Lateral Leg Swings - https://www.youtube.com/shorts/LoMfSTdFTgg  _(held for the retired name Lateral Leg Swing)_
- Seated Butterflies - https://www.youtube.com/shorts/mRNLmtW2bQ8  _(held for the retired name Seated Butterfly)_
- Hip Hinges - https://www.youtube.com/shorts/GzW9LKufDVM  _(held for the retired name Bodyweight Hip Hinge)_
- Bent Knee Ankle Dorsiflexion - https://www.youtube.com/shorts/xVFiyGocri0  _(held for the retired name Ankle Dorsiflexion Drill)_
- Single Leg Romanian Deadlift - https://www.youtube.com/shorts/tZQ94VAPp1w
- Cable Single Arm Tricep Extensions - https://www.youtube.com/shorts/SU3KkNX7cCg  _(held for the retired name Single Arm Cable Extension)_
- Cable Lateral Raises - https://www.youtube.com/shorts/wtGks2lKJ9M  _(held for the retired name Cable Lateral Raise)_
- Cable Hip Flexion - https://www.youtube.com/shorts/Zcitq7bqwjk  _(held for the retired name Cable Hip Flexion)_
- Cable Single Arm Curls - https://www.youtube.com/shorts/hMJysvlxaqY  _(held for the retired name Single-Arm Cable Curl)_
- Cable Hip Extensions - https://www.youtube.com/shorts/qrJC1I1XaWQ  _(held for the retired name Cable Hip Extension)_
- Cable Hip Abduction - https://www.youtube.com/shorts/NTNYykzuwUs  _(held for the retired name Cable Hip Abduction)_
- Calf Raises - https://www.youtube.com/shorts/_a4USpdkYEU  _(held for the retired name Calf Raise)_
- Bent Knee Calf Raises - https://www.youtube.com/shorts/7vFpu7FOUWg  _(held for the retired name Bent-Knee Calf Raise)_
- Bent Knee Single Leg Calf Raise - https://www.youtube.com/shorts/I4aTkSDhj2Q  _(held for the retired name Bent-Knee Single-Leg Calf Raise)_
- Seated Calf Raises - https://www.youtube.com/shorts/gtMaEijS97k  _(held for the retired name Seated Calf Raise)_
- Weighted Seated Calf Raises - https://www.youtube.com/shorts/OHldOsbk0iw  _(held for the retired name Weighted Seated Calf Raise)_
- Seated Tib Raises - https://www.youtube.com/shorts/di7H803LkK0  _(held for the retired name Tib Raise)_
- Shoulder CARs (Controlled Articular Rotations) - https://www.youtube.com/shorts/BpXtcAzYnSY  _(held for the retired name Shoulder CARs (Controlled Articular Rotations))_
- Seated Dumbbell Lateral Raises - https://www.youtube.com/shorts/UsZgojyINOg  _(held for the retired name Seated DB Lateral Raise)_
- Banded Lateral Walks - https://www.youtube.com/shorts/cZDYVxn38LY  _(held for the retired name Banded Lateral Walk)_
- Banded Monster Walks - https://www.youtube.com/shorts/qWBa9MSasTM  _(held for the retired name Banded Monster Walk)_
- Banded Marches - https://www.youtube.com/shorts/mMkzfRz_djc  _(held for the retired name Banded March)_
- Bench Dumbbell Reverse Fly - https://www.youtube.com/shorts/ykk0R4hSGo4  _(held for the retired name Bench Dumbbell Reverse Fly)_
- Alternating Dumbbell Curls - https://www.youtube.com/shorts/763mOmEIQI8  _(held for the retired name Alternating Dumbbell Curl)_
- Dumbbell Hammer Curls - https://www.youtube.com/shorts/ddLnW_AhnCA  _(held for the retired name DB Hammer Curl)_
- Hip 90 90s - https://www.youtube.com/shorts/ZSysWQWU8js  _(held for the retired name 90/90 Hip Switch)_
- Kneeling Rocks - https://www.youtube.com/shorts/JS9vTaMTfwM  _(held for the retired name Kneeling Rock-Back)_
- Seated Shoulder External Rotations - https://www.youtube.com/shorts/JqRjE-haFOM  _(held for the retired name Seated Shoulder External Rotation (Band))_
- Kettlebell Swings - https://www.youtube.com/shorts/7bIzl01moZc
- Dumbbell Lateral Raises - https://www.youtube.com/shorts/VJpw-_FZdi8  _(held for the retired name DB Lateral Raise)_
- Dumbbell Bicep Curls - https://www.youtube.com/shorts/JDiuwl1C6gY  _(held for the retired name DB Bicep Curl)_

## 7. Exercises with no video at all (149)

The shooting list, grouped by where the exercise turns up. EXERCISE-VIDEO-STATUS.md orders the same list by how many sessions each movement can appear in, which is the better order to film in.

### Main lifts (13)

- Band Resisted Back Squats
- Band Resisted Front Squats
- Box Squats
- Chest Supported Dumbbell Row
- Deficit Split Squats
- Door Frame Rows
- Dumbbell Front Squats
- Kettlebell Deadlift
- Single Arm Dumbbell Rows
- Single Leg Romanian Deadlift (Barbell)
- Single Leg Romanian Deadlift (Dumbbell)
- Zercher Squat
- Zombie Squat

### Accessories (9)

- Ab Wheel Rollout (Kneeling)
- Banded Deadbugs
- Cable Face Pulls
- Cable Pallof Hold
- Cable Pallof Press
- Forearm Side Plank
- Side Plank Reach Throughs
- Superman Plank
- Waiter Carry

### Rehab and prehab drills (114)

- Ankle Circles
- Band Chest Press (Light, Short Range)
- Band Curl (light, high reps)
- Band Finger Extension
- Band Pushdown (light, high reps)
- Band Straight-Arm Press-Down (Short Range)
- Bicep Stretch (arm back)
- Book Opener (thoracic rotation)
- Calf Stretch (Wall)
- Cat-Cow
- Child's Pose with Side Reach
- Chin Tuck
- Copenhagen Adductor Hold
- Couch Stretch
- Cross-Body Shoulder Stretch
- Cross-Body Tricep Stretch
- Doorway Lat Stretch
- Eccentric Wrist Extension
- Elbow Flexion / Extension ROM
- Floor Angel
- Forearm Supination / Pronation
- Glute Bridge (isometric hold)
- Glute Set (isometric)
- Heel Drop (eccentric)
- Hip Flexor Kneeling Stretch
- Hip Flexor Stretch
- Hip Hinge Against Wall
- Hollow Body Hold
- Incline Push-Up (slow)
- Isometric Adductor Squeeze (Ball or Towel)
- Isometric Ankle Press (In and Out)
- Isometric Band Row Hold (Light)
- Isometric Chest Press Into Wall
- Isometric Elbow Extension Press (Thigh)
- Isometric Elbow Flexion Hold (Table)
- Isometric Elbow Press (Bend and Straighten)
- Isometric Hip Abduction (Wall Press)
- Isometric Neck Press (Hand Resistance)
- Isometric Pec Squeeze (Palms Together)
- Isometric Shoulder Extension Press (Wall)
- Isometric Shoulder External Rotation (Doorframe)
- Isometric Shoulder Flexion Press (Wall)
- Isometric Supination Hold (Towel)
- Isometric Wall Sit
- Isometric Wrist Extension Hold
- Isometric Wrist Flexion Hold
- Lateral Band Walk
- Levator Scapulae Stretch
- Long-Lever Adductor Squeeze
- McGill Side Plank
- Neck Side Stretch
- Nordic Curl Negative (slow)
- Open-and-Close Fist Pumps
- Overhead Tricep Stretch
- Pain-Free Elbow Bend and Straighten
- Pain-Free Wrist Glide
- Pallof Press (Isometric Hold)
- Pec Minor Stretch
- Pec Minor Stretch (doorway)
- Pendulum Shoulder Swing
- Pigeon Pose
- Pronator Self-Release
- Prone Knee Bend Hold
- Prone Shoulder External Rotation
- Prone T-Spine Extension
- Prone Thoracic Extension
- Quad Set (isometric)
- Scapular Setting (Isometric Squeeze)
- Scapular Setting (Isometric)
- Scapular Setting (Shoulder Blade Set)
- Seated Ankle Pump (Small Range)
- Seated Forward Fold
- Seated Heel Raise (Bodyweight)
- Seated Hip March (Low Lift)
- Seated Isometric Calf Press
- Seated Lat Press-Down Hold (Chair)
- Seated Toe Raise
- Short-Arc Quad Extension (Towel Roll)
- Shoulder CAR (Controlled Articular Rotation)
- Side-Lying Hip Abduction
- Single-Leg Balance
- Single-Leg Calf Raise
- Single-Leg Calf Raise (Eccentric)
- Single-Leg Glute Bridge
- Slow Step-Down
- Slow Step-Down (eccentric)
- Soft Towel Squeeze
- Soleus Stretch
- Standing Calf Raise (slow eccentric)
- Standing Hamstring Stretch
- Supine Abdominal Brace with Breathing
- Supine Hamstring Stretch (Strap)
- Supine Heel Slide (Braced)
- Supine Isometric Hamstring Press (Bent Knee)
- Supine Pelvic Tilt (Small Range)
- Supine Rib Breathing (Hands on Ribs)
- Supine Spinal Twist
- Supine Straight-Leg Raise
- Supported Heel Slide
- Supported Neck Nod (Head Resting)
- Supported Neck Rotation (Small Range)
- Supported Shoulder Slide (Table)
- Terminal Knee Extension (band)
- Thoracic Cat-Cow
- Thread the Needle (Thoracic Rotation)
- Thread-the-Needle Rotation
- Tibialis Raise
- Upper Trap Stretch
- VMO Wall Sit
- Wall Angel
- Wall Slide
- Wrist Circles
- Wrist Extensor Stretch
- Wrist Flexor Stretch

### Warm-ups (2)

- Cardio Warm-Up (Easy Walk / Bike)
- Diaphragmatic Breathing

### Power and speed (1)

- Band Resisted Broad Jumps

### Conditioning (6)

- Bear Crawl
- Brisk Walk
- Farmers Carry
- Incline Treadmill Walk
- Rowing Machine
- Skipping

### Cool-downs and stretching (4)

- Figure-4 Glute Stretch
- Forearm Flexor & Extensor Stretch
- Legs-Up-The-Wall
- Side-Bend Overhead Reach

## 8. The links that are already a judgement (13)

Every other link in the app is an exact name match. These were decided by looking at the movement, and are listed so they can be argued with. Any one of them can be removed with a single line, and that exercise goes back to a YouTube search.

| The app calls it | The video is called |
| --- | --- |
| Band Face Pull | Banded Face Pulls |
| Band Pull-Apart | Band Pull Aparts |
| Banded Clamshell | Banded Clamshells |
| Banded Pallof Press | Banded Palloff Press |
| Dead Bug | Deadbugs |
| Doorway Chest Opener | Doorway Pec Stretch |
| Doorway Chest Stretch | Doorway Pec Stretch |
| Glute Bridge | Glute Bridges |
| Hip Circles | Banded Hip Circles |
| Landmine Romanian Deadlift | Landmine Romanian Deadlifts |
| Landmine Split Stance Romanian Deadlift | Landmine Split Stance Romanian Deadlifts |
| Prone Y Raise | Bench Dumbbell Ys |
| Sled Push and Pull | Sled Push & Pull |
