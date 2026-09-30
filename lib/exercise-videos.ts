/**
 * Which @GrowPerformanceRehabilitation video demonstrates which exercise.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A VIDEO  (this is the only file you need to touch)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. Open the video on YouTube and copy the address bar. It looks like
 *        https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *      A Shorts link (youtube.com/shorts/…) or a share link (youtu.be/…) is
 *      fine too.
 *
 *   2. Add ONE line below, inside the braces, in this exact shape:
 *
 *        'Barbell Back Squat': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
 *
 *      The bit in quotes on the LEFT is the exercise name exactly as it appears
 *      in the app, capital letters and all. The bit on the RIGHT is the link.
 *      Keep the comma at the end.
 *
 *   3. Save. That is the whole job — no other file changes, no new release
 *      logic. The red YouTube button on that exercise's card now opens your
 *      video instead of running a YouTube search.
 *
 * If you spell the exercise name wrong, `npm run check` fails and tells you
 * which name it could not find, so a typo can never quietly become a dead
 * button. Anything not listed here keeps the old behaviour — a YouTube search
 * on the exercise name — so this file can be filled in a few videos at a time.
 *
 * `npm run video-status` writes EXERCISE-VIDEO-STATUS.md: every exercise in the
 * app, which ones have footage and which still need recording.
 *
 * MOST OF THIS FILE IS NOT WRITTEN BY HAND ANY MORE. Where an exercise's name is
 * EXACTLY the title of an upload - trim the spaces, ignore the capitals, nothing
 * else - the line is written for it, because an exact match is not a guess. A
 * name that is nearly the same IS a guess, so it is not linked: it goes on
 * docs/VIDEO-LINKING-REVIEW.md with both spellings shown, for Archie to rule on.
 * `npm run video-review` writes that page. If you decide a video does show a
 * movement under a different name, add the line here AND name it in
 * VIDEO_LINKS_DECIDED_BY_HAND at the bottom, or the gate will refuse it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Exercise name → the video that demonstrates it.
 *
 * Filled in from the 69 videos on the channel as at 13 August 2026. 68 of them
 * are attached to an exercise; the one that is not is a second upload of a
 * movement already covered by the first. The channel has grown to 232 uploads
 * since, most recently in the 26 September 2026 refresh at the bottom of this
 * table, so those figures are the history of the file rather than its state -
 * EXERCISE-VIDEO-STATUS.md always has the current ones.
 *
 * Thirty of those videos had no exercise to attach to, because the app simply
 * did not carry the movement — trap bar work, gorilla rows, banded monster
 * walks, and a plain front plank. Rather than leave the footage stranded, each
 * became a real exercise: see lib/channel-exercises.ts.
 *
 * NOTHING HERE IS A GUESS. A video is only attached where it demonstrates the
 * same movement — a different name for it is fine, a different grip, tempo or
 * implement is not. A red "watch the demo" button is a claim about which
 * movement this is, so where the claim could not be made confidently it was not
 * made at all, and the exercise keeps its YouTube search.
 */
export const EXERCISE_VIDEOS: Record<string, string> = {
  // ── Matched automatically on the video title ───────────────────────────
  'Band Pull-Apart': 'https://www.youtube.com/shorts/HB0yMwKDxQA',
  'Banded Clamshell': 'https://www.youtube.com/shorts/gnCpgLadixo',
  'Banded Good Morning': 'https://www.youtube.com/shorts/NfvoD1rsgls',
  'Banded Lateral Walk': 'https://www.youtube.com/shorts/cZDYVxn38LY',
  'Barbell Bulgarian Split Squat': 'https://www.youtube.com/shorts/uI9Bp7vrICg',
  'Barbell Good Morning': 'https://www.youtube.com/shorts/sMVNO3e78OM',
  'Bulgarian Split Squat': 'https://www.youtube.com/shorts/4Rv283FcR9A',
  'DB Bicep Curl': 'https://www.youtube.com/shorts/JDiuwl1C6gY',
  'DB Hammer Curl': 'https://www.youtube.com/shorts/ddLnW_AhnCA',
  'DB Lateral Raise': 'https://www.youtube.com/shorts/VJpw-_FZdi8',
  'Dead Bug': 'https://www.youtube.com/shorts/X8KA_F1vqk4',
  'Depth Jump': 'https://www.youtube.com/shorts/7ycVBlIF3r8',
  'Dumbbell Bench Press': 'https://www.youtube.com/shorts/lV1C-jOp55g',
  'Glute Bridge': 'https://www.youtube.com/shorts/PKXzz7XSxv4',
  'Landmine Press': 'https://www.youtube.com/shorts/vL4UV9-NY_o',
  'Push Up': 'https://www.youtube.com/shorts/f4LAlzZ7jMs',
  'Squat Jump': 'https://www.youtube.com/shorts/mHL97bDjXdM',

  // ── Movements added BECAUSE they had been filmed ───────────────────────
  // Each of these was on the channel with nothing in the app to attach it to,
  // so the exercise was written to match the video. See lib/channel-exercises.ts.
  'Alternating Dumbbell Bench Press': 'https://www.youtube.com/shorts/RB5ANXpinuE',
  'Alternating Dumbbell Curl': 'https://www.youtube.com/shorts/763mOmEIQI8',
  'Alternating Dumbbell Overhead Press': 'https://www.youtube.com/shorts/80Ro5q41PJw',
  'Banded March': 'https://www.youtube.com/shorts/mMkzfRz_djc',
  'Banded Monster Walk': 'https://www.youtube.com/shorts/qWBa9MSasTM',
  'Bench Dumbbell Reverse Fly': 'https://www.youtube.com/shorts/ykk0R4hSGo4',
  'Box Squat': 'https://www.youtube.com/shorts/6uPr0ee_wa4',
  'DB Split Squat Jump': 'https://www.youtube.com/shorts/ovXoUaJ0xnU',
  'DB Split-Stance Romanian Deadlift': 'https://www.youtube.com/shorts/JWExVh6hRrI',
  'DB Squat Jump': 'https://www.youtube.com/shorts/3ai2sjIyy5A',
  'Gorilla Row': 'https://www.youtube.com/shorts/s8iywanevOY',
  'KB Romanian Deadlift': 'https://www.youtube.com/shorts/QffukPkOKsg',
  'KB Side Lunge': 'https://www.youtube.com/shorts/eI6JDGd2Nf0',
  'Kneeling Rock-Back': 'https://www.youtube.com/shorts/JS9vTaMTfwM',
  'Medball Floor Chest Pass': 'https://www.youtube.com/shorts/9hWzbW2XQ9c',
  'Plank': 'https://www.youtube.com/shorts/iH-ZhUE3j3U',
  'Seated Box Jump': 'https://www.youtube.com/shorts/n76RaN51AFg',
  'Seated Shoulder External Rotation (Band)': 'https://www.youtube.com/shorts/JqRjE-haFOM',
  'Seated Single-Arm Cable Row': 'https://www.youtube.com/shorts/OmgSriop7qM',
  'Seated Wide-Grip Cable Row': 'https://www.youtube.com/shorts/Az1vn7b1_Gg',
  'Single-Arm Dumbbell Overhead Press': 'https://www.youtube.com/shorts/V5-MAHfu7fM',
  'Skater Jump': 'https://www.youtube.com/shorts/7uQetCi9mbc',
  'Sled Row': 'https://www.youtube.com/shorts/KPBZu2djV0M',
  'Split Squat Jump': 'https://www.youtube.com/shorts/7yT5smEHvSI',
  'Standing Dumbbell Row': 'https://www.youtube.com/shorts/XTbgWQAyO6Y',
  'Supine Med Ball Throw': 'https://www.youtube.com/shorts/3GCUM05ig5o',
  'Trap Bar Deadlift': 'https://www.youtube.com/shorts/3yjg8We2hEc',
  'Trap Bar Jump': 'https://www.youtube.com/shorts/CRWrBIcRJKg',
  'Trapbar Romanian Deadlift': 'https://www.youtube.com/shorts/sK90sn5FYgo',
  'Trap Bar Row': 'https://www.youtube.com/shorts/5jnD2PFf_Mc',

  // ── Decided by Archie, 13 Aug 2026 ────────────────────────────────────
  // Four cases where two things could each have claimed the other and the
  // choice was his to make, not mine.
  //
  // Two uploads are titled "Kettlebell Swings"; either demonstrates the
  // movement, so the swing entries take the first.
  '90/90 Hip Switch': 'https://www.youtube.com/shorts/ZSysWQWU8js',
  // Video "Barbell Jump Squats" - a loaded jump squat is what the app calls it.
  'Loaded Jump Squat': 'https://www.youtube.com/shorts/S_sk9nCqscI',
  // The app's Seated Cable Row is cued "pull to navel, squeeze shoulder blades"
  // with the rhomboids as its primary muscle, which is the CLOSE-grip row - so
  // that is the video it gets. The wide-grip upload became its own exercise
  // rather than being forced onto this one.
  'Seated Cable Row': 'https://www.youtube.com/shorts/dKKsJMlmogM',

  // ── Decided by Archie, 29 Sep 2026 ────────────────────────────────────
  // He asked for the hip drill to be plain hip circles rather than banded ones
  // - "change banded hip circles to just hip circles" - so the record needs no
  // band and the app has a Hip Circles it has never had before. The only
  // footage of the movement is his upload titled "Banded Hip Circles", filmed
  // with a band on.
  //
  // THIS IS THE ONE PLACE A BAND IS ALLOWED TO DIFFER between the card and the
  // demo, and it is a judgement rather than a rule. The note at the top of this
  // file says a different implement is not a match, and it is right: a band
  // changes a squat. Here the band is the optional part of the same movement,
  // it is his own drill, and he asked for the band to come off - so the demo
  // shows exactly what the card asks for, with a band the card does not
  // mention. One line to delete if he would rather it ran a search.
  'Hip Circles': 'https://www.youtube.com/shorts/K9wrVgGKcS4',

  // ── Same movement, different wording. Each one checked by hand. ────────
  // video "Barbell Back Squat"
  'Back Squat': 'https://www.youtube.com/shorts/MnJz6MVIoIE',
  // video "Banded Face Pulls"
  'Band Face Pull': 'https://www.youtube.com/shorts/brxLZz3K0Qo',
  // video "Box Jumps"
  'Box Jump (Step-Down)': 'https://www.youtube.com/shorts/bDZuhqCWkNM',
  // video "Chin Ups"
  'Chin-Up': 'https://www.youtube.com/shorts/LJJCoB1wr08',
  // video "Dumbbell Bulgarian Spilt Squat" (title has a typo)
  'DB Bulgarian Split Squat': 'https://www.youtube.com/shorts/6uvGppVwer4',
  // video "Bench Dumbbell Face Pulls"
  'DB Face Pull': 'https://www.youtube.com/shorts/Yk8fT7vxzZM',
  // video "Standing Dumbbell Press" - the seated one is a separate entry
  'DB Shoulder Press': 'https://www.youtube.com/shorts/pFDyKWvEBow',
  // the database carries this movement under two names
  'Doorway Chest Opener': 'https://www.youtube.com/shorts/E272OXbzJgg',
  // video "Doorway Pec Stretch" - same position, arm at 90 in a doorway
  'Doorway Chest Stretch': 'https://www.youtube.com/shorts/E272OXbzJgg',
  // video "Kettlebell Goblet Squats"
  'Goblet Squat': 'https://www.youtube.com/shorts/AwnvtTwmTt0',
  // video "Incline Dumbbell Bench Press"
  'Incline DB Press': 'https://www.youtube.com/shorts/36aFWMgjmYs',
  // video "Kettlebell Swings"
  'KB / DB Swing': 'https://www.youtube.com/shorts/6x-elUqiBJ0',
  // same movement, the name records the tempo prescribed
  'KB Swing (Explosive)': 'https://www.youtube.com/shorts/6x-elUqiBJ0',
  // same movement, the name records the tempo prescribed
  'KB Swing (Steady)': 'https://www.youtube.com/shorts/6x-elUqiBJ0',
  // video "Wide Grip Pulldowns"
  'Lat Pulldown': 'https://www.youtube.com/shorts/uyjFVVPrycU',
  // video "Side Lunge"
  'Lateral Lunge': 'https://www.youtube.com/shorts/xeLW4r3Jznk',
  // video "Medball Slams"
  'Med Ball Overhead Slam': 'https://www.youtube.com/shorts/lucmyeFhqWQ',
  // video "Plank Taps"
  'Plank Shoulder Tap': 'https://www.youtube.com/shorts/u47TJ9pDvWU',
  // video "Bench Dumbbell Ys" - prone Y on a bench
  'Prone Y Raise': 'https://www.youtube.com/shorts/2VPD8D6-qwE',
  // video "Pull Ups"
  'Pull-Up': 'https://www.youtube.com/shorts/x3lc-RqEcag',
  // video "Sled Push & Pull"
  'Sled Push/Pull Complex': 'https://www.youtube.com/shorts/7KYhdRNN8c8',
  // The same footage, under the name the app actually serves it as. Archie's two
  // sled drags became one record called "Sled Push and Pull" on 30 September
  // 2026, and his video is titled "Sled Push & Pull", so the demo button on that
  // card opens the right clip instead of running a YouTube search. The line
  // above is the old catalogue's name for the same complex and is kept because
  // this file is the only record of which video shows which movement.
  'Sled Push and Pull': 'https://www.youtube.com/shorts/7KYhdRNN8c8',

  // ───────────────────────────────────────────────────────────────────────────
  // SECOND BATCH — 24 uploads added after the 13 August snapshot.
  //
  // Seven matched a movement the app already carried and are mapped here.
  // Sixteen had no home and became real exercises in lib/channel-exercises.ts,
  // mapped below by their new names. One is a second take of something already
  // covered and is deliberately unused — see the note at the bottom.
  // ───────────────────────────────────────────────────────────────────────────

  // Already in the app:
  // video "Walking Lunges"
  'Walking Lunges': 'https://www.youtube.com/shorts/PWfIF3QyJXk',
  // video "Dumbbell Walking Lunges"
  'Dumbbell Walking Lunge': 'https://www.youtube.com/shorts/rigx3wKlmE4',
  // video "Banded Palloff Press" - the app spells it Pallof, one f
  'Banded Pallof Press': 'https://www.youtube.com/shorts/f_9v7DUy8mo',
  // video "Calf Raises"
  'Calf Raise': 'https://www.youtube.com/shorts/_a4USpdkYEU',
  // video "Seated Dumbbell Press"
  'Seated DB Shoulder Press': 'https://www.youtube.com/shorts/2qz5IqK9w6o',
  // video "Shoulder CARs (Controlled Articular Rotations)" - exact name match
  'Shoulder CARs (Controlled Articular Rotations)':
    'https://www.youtube.com/shorts/BpXtcAzYnSY',
  // video "Cable Single Arm Tricep Extensions", titled "Single Arm Cable Tricep
  // Extensions" in August - the app's entry is the same single-arm pushdown,
  // named without the word "tricep"
  'Single Arm Cable Extension': 'https://www.youtube.com/shorts/SU3KkNX7cCg',

  // Added to the app for these videos (lib/channel-exercises.ts):
  // video "Cable Lateral Raises"
  'Cable Lateral Raise': 'https://www.youtube.com/shorts/wtGks2lKJ9M',
  // video "Seated Dumbbell Lateral Raises", titled "Seated Lateral Raises" in August
  'Seated DB Lateral Raise': 'https://www.youtube.com/shorts/UsZgojyINOg',
  // video "Cable Single Arm Curls", titled "Single Arm Cable Curls" in August
  'Single-Arm Cable Curl': 'https://www.youtube.com/shorts/hMJysvlxaqY',
  // video "Cable Hip Abduction"
  'Cable Hip Abduction': 'https://www.youtube.com/shorts/NTNYykzuwUs',
  // video "Cable Hip Extensions"
  'Cable Hip Extension': 'https://www.youtube.com/shorts/qrJC1I1XaWQ',
  // video "Cable Hip Flexion"
  'Cable Hip Flexion': 'https://www.youtube.com/shorts/Zcitq7bqwjk',
  // video "Landmine Single Arm Rows"
  'Landmine Single-Arm Row': 'https://www.youtube.com/shorts/Ml92Kc8xaA0',
  // video "Landmine Romanian Deadlifts"
  'Landmine Romanian Deadlift': 'https://www.youtube.com/shorts/J-vaoprV2uM',
  // video "Landmine Split Stance Romanian Deadlifts"
  'Landmine Split Stance Romanian Deadlift': 'https://www.youtube.com/shorts/R-l6_GQMJ_M',
  // video "Landmine Split Squats"
  'Landmine Split Squat': 'https://www.youtube.com/shorts/TGb7vq84olQ',
  // video "Landmine Goblet Squats"
  'Landmine Goblet Squat': 'https://www.youtube.com/shorts/i4YH9rWYm_A',
  // video "Bent Knee Calf Raises"
  'Bent-Knee Calf Raise': 'https://www.youtube.com/shorts/7vFpu7FOUWg',
  // video "Bent Knee Single Leg Calf Raise"
  'Bent-Knee Single-Leg Calf Raise': 'https://www.youtube.com/shorts/I4aTkSDhj2Q',
  // video "Seated Calf Raises"
  'Seated Calf Raise': 'https://www.youtube.com/shorts/gtMaEijS97k',
  // video "Weighted Seated Calf Raises"
  'Weighted Seated Calf Raise': 'https://www.youtube.com/shorts/OHldOsbk0iw',
  // video "Seated Tib Raises", titled "Tib Raises" in August
  'Tib Raise': 'https://www.youtube.com/shorts/di7H803LkK0',

  // ───────────────────────────────────────────────────────────────────────────
  // THIRD BATCH — 10 more uploads.
  // ───────────────────────────────────────────────────────────────────────────

  // Already in the app:
  // video "Wall Sit"
  'Wall Sit': 'https://www.youtube.com/shorts/jiU3ETsPeKU',
  // video "Spanish Squats"
  'Spanish Squat': 'https://www.youtube.com/shorts/a7NjWDSBxHI',
  // video "Bodyweight Squats"
  'Bodyweight Squat': 'https://www.youtube.com/shorts/PYhFE-z9RFY',
  // video "Hip Hinges" - the app's unloaded hinge
  'Bodyweight Hip Hinge': 'https://www.youtube.com/shorts/GzW9LKufDVM',
  // video "Bent Knee Ankle Dorsiflexion" - the app's entry is the same
  // knee-over-toe wall drill, which is the bent-knee version by definition
  'Ankle Dorsiflexion Drill': 'https://www.youtube.com/shorts/xVFiyGocri0',

  // Added to the app for these videos (lib/channel-exercises.ts):
  // video "Banded VMO Extensions"
  'Banded VMO Extension': 'https://www.youtube.com/shorts/IOTqFAgZuKc',
  // video "Leg Swings"
  'Leg Swing': 'https://www.youtube.com/shorts/wx2ZP3GTHTA',
  // video "Lateral Leg Swings"
  'Lateral Leg Swing': 'https://www.youtube.com/shorts/LoMfSTdFTgg',
  // video "Seated Butterflies"
  'Seated Butterfly': 'https://www.youtube.com/shorts/mRNLmtW2bQ8',

  // NEEDS A DECISION: "Single Leg Romanian Deadlift" (tZQ94VAPp1w).
  // The app carries this movement twice, as Single Leg Romanian Deadlift
  // (Barbell) and Single Leg Romanian Deadlift (Dumbbell). Which one the video
  // shows depends on what is in his hands, and the title does not say. There is
  // now a second upload as well, "Single Leg Barbell Romanian Deadlift"
  // (9AIEC3yGft4), which looks like the barbell half of the pair but is still a
  // near miss on the name rather than a match. Both are on the review list.

  // NO LONGER STRANDED: U5EdqKJDX6s, which the August snapshot called "Single
  // Arm Cable Rows". Archie has since renamed it "Cable Single Arm Rows", which
  // is the exact name of a record the library already carries, so it is mapped
  // in the batch below and the standing and seated takes now have a card each.

  // ───────────────────────────────────────────────────────────────────────────
  // FOURTH BATCH - the 26 September 2026 refresh, matched on the name alone.
  //
  // The channel had grown from 103 uploads to 232 while scripts/channel-videos.json
  // still held the August list, so 129 recordings were invisible to the app.
  // Archie asked for "every exercise linked to the video with the exact same
  // name", and that is all this block is: the app's own name for the exercise,
  // character for character, is the title of the upload. Nothing here needed a
  // judgement, which is why it could be done in one pass.
  //
  // EXACT MEANS EXACT. Leading and trailing spaces are ignored and capital
  // letters are ignored. Nothing else is. "Door Frame Rows" did NOT take the
  // upload called "Doorframe Rows", and "Tibialis Raise" did not take "Seated
  // Tib Raises", because a name that is nearly the same is a guess about which
  // movement was filmed, and a red demo button is a claim, not a hint. Every
  // near miss is written up in docs/VIDEO-LINKING-REVIEW.md for Archie to rule
  // on, with both spellings side by side, and NOTHING on that list is wired
  // here until he does.
  //
  // Thirty-nine of these lines name a record that already carried the same video
  // on itself as a bare `videoId`. They are written out anyway so this file is
  // what its own header claims to be: the one place that records which video
  // shows which movement. The id is identical in every case, so no button
  // changes what it opens.
  //
  // tests/videos-linked.check.mjs holds this promise open in both directions: a
  // name that matches a title exactly and is NOT mapped fails, and a mapping
  // that is not an exact match fails unless it is on the hand-decided list
  // below.
  // ───────────────────────────────────────────────────────────────────────────
  'Alternating Dumbbell Shoulder Press': 'https://www.youtube.com/shorts/80Ro5q41PJw',
  'Alternating Reverse Lunges': 'https://www.youtube.com/shorts/yXKRIO3zDs8',
  'Assault Bike': 'https://www.youtube.com/shorts/F3CVY9Jp5Cc',
  'Assisted Bulgarian Split Squats': 'https://www.youtube.com/shorts/L3rN8BcAPhc',
  'Assisted Reverse Lunges': 'https://www.youtube.com/shorts/LFpa78G9-ow',
  'Assisted Squats': 'https://www.youtube.com/shorts/-yTqNYbssTQ',
  'Band Assisted Chin Up': 'https://www.youtube.com/shorts/H2MpKsqe7EE',
  'Band Pull Aparts': 'https://www.youtube.com/shorts/HB0yMwKDxQA',
  'Band Resisted Barbell Press': 'https://www.youtube.com/shorts/XCmXWPQLvSg',
  'Band Resisted Deadlifts': 'https://www.youtube.com/shorts/XklHwpwpLqM',
  'Banded Face Pulls': 'https://www.youtube.com/shorts/brxLZz3K0Qo',
  'Banded Good Mornings': 'https://www.youtube.com/shorts/NfvoD1rsgls',
  'Banded Serratus Punch': 'https://www.youtube.com/shorts/rOyobzypmAE',
  'Barbell Back Squat': 'https://www.youtube.com/shorts/MnJz6MVIoIE',
  'Barbell Bulgarian Split Squats': 'https://www.youtube.com/shorts/uI9Bp7vrICg',
  'Barbell Deadlift': 'https://www.youtube.com/shorts/ixaMn2pUAY4',
  'Barbell Floor Press': 'https://www.youtube.com/shorts/OC4SEg1-DAc',
  'Barbell Front Squat': 'https://www.youtube.com/shorts/gpvzkexdReo',
  'Barbell Good Mornings': 'https://www.youtube.com/shorts/sMVNO3e78OM',
  'Barbell Jump Squats': 'https://www.youtube.com/shorts/S_sk9nCqscI',
  'Barbell Reverse Lunges': 'https://www.youtube.com/shorts/lyU-zhUyaZU',
  'Barbell Row': 'https://www.youtube.com/shorts/tj1ynFut8MY',
  'Barbell Suitcase Hold': 'https://www.youtube.com/shorts/XBCZf9wiCAs',
  'Bench Dips': 'https://www.youtube.com/shorts/mjsDYU-zMoQ',
  'Bench Dumbbell Face Pulls': 'https://www.youtube.com/shorts/Yk8fT7vxzZM',
  'Bench Press Ups': 'https://www.youtube.com/shorts/0HpiLlesfNs',
  'Bent Over Dumbbell Rows': 'https://www.youtube.com/shorts/XTbgWQAyO6Y',
  'Bird Dog': 'https://www.youtube.com/shorts/XY1PVJtBjr8',
  'Bodyweight Squats': 'https://www.youtube.com/shorts/PYhFE-z9RFY',
  'Box Jumps': 'https://www.youtube.com/shorts/bDZuhqCWkNM',
  'Box Step Downs': 'https://www.youtube.com/shorts/kDietxFGmTs',
  'Box Step Over': 'https://www.youtube.com/shorts/yyKpmjILhkw',
  'Box Step Ups': 'https://www.youtube.com/shorts/Uw1bUuNKv9Y',
  'Broad Jumps': 'https://www.youtube.com/shorts/qKVtaBiyEZw',
  'Cable Pull Through': 'https://www.youtube.com/shorts/DxvHI-JucQI',
  'Cable Reverse Woodchops': 'https://www.youtube.com/shorts/dz6hVWO2N2w',
  'Cable Romanian Deadlift': 'https://www.youtube.com/shorts/bZKa57FVxRg',
  'Cable Single Arm Rows': 'https://www.youtube.com/shorts/U5EdqKJDX6s',
  'Cable Woodchops': 'https://www.youtube.com/shorts/jNO0cmTvaMo',
  'Chin Ups': 'https://www.youtube.com/shorts/LJJCoB1wr08',
  'Curtsy Lunge': 'https://www.youtube.com/shorts/sOJ2LtQMfmA',
  'Decline Press Ups': 'https://www.youtube.com/shorts/4v4cnn0-r0M',
  'Deficit Barbell Deadlift': 'https://www.youtube.com/shorts/ZbEe2t25Kf4',
  'Deficit Kettlebell Deadlift': 'https://www.youtube.com/shorts/fqiukOX81Gc',
  'Deficit Press Ups': 'https://www.youtube.com/shorts/LXa5PRe6vX8',
  'Deficit Romanian Deadlift': 'https://www.youtube.com/shorts/Y1k8JyLDzTg',
  'Depth Jumps': 'https://www.youtube.com/shorts/7ycVBlIF3r8',
  'Duck Walks': 'https://www.youtube.com/shorts/uHecEl_1xx0',
  'Dumbbell Alternating Reverse Lunges': 'https://www.youtube.com/shorts/SN-Whqyd2Ks',
  'Dumbbell Curtsy Lunge': 'https://www.youtube.com/shorts/ZnwYwtUVc8U',
  'Dumbbell Farmers Carry': 'https://www.youtube.com/shorts/_H6hztGwlMk',
  'Dumbbell Floor Press': 'https://www.youtube.com/shorts/gqhHHOJQ3dY',
  'Dumbbell Split Squat Jumps': 'https://www.youtube.com/shorts/ovXoUaJ0xnU',
  'Dumbbell Suitcase Carry': 'https://www.youtube.com/shorts/R7tyUCNMftA',
  'Dumbbell Suitcase Hold': 'https://www.youtube.com/shorts/31qjtgLqROs',
  'Dumbbell Walking Lunges': 'https://www.youtube.com/shorts/rigx3wKlmE4',
  'Earthquake Carry': 'https://www.youtube.com/shorts/Q2kj16PHB10',
  'Elevated Feet Rack Rows': 'https://www.youtube.com/shorts/-9Gwn68csPM',
  'Gorilla Rows': 'https://www.youtube.com/shorts/s8iywanevOY',
  'Hanging Knee Raises': 'https://www.youtube.com/shorts/1D-geVl_1Bk',
  'High Pulls': 'https://www.youtube.com/shorts/ho3tkJ5eI6Y',
  'Incline Dumbbell Bench Press': 'https://www.youtube.com/shorts/36aFWMgjmYs',
  'Kettlebell Box Squats': 'https://www.youtube.com/shorts/S1aLTFj_xTE',
  'Kettlebell Box Step Over': 'https://www.youtube.com/shorts/kwsBaYjN8UA',
  'Kettlebell Curtsy Lunge': 'https://www.youtube.com/shorts/ZY1Uq4ivua8',
  'Kettlebell Farmers Carry': 'https://www.youtube.com/shorts/Wr8Kgr54soE',
  'Kettlebell Goblet Squats': 'https://www.youtube.com/shorts/AwnvtTwmTt0',
  'Kettlebell Halos': 'https://www.youtube.com/shorts/_9vJRZ34Fxc',
  'Kettlebell Marches': 'https://www.youtube.com/shorts/TsmHp1nysP8',
  'Kettlebell Reverse Lunges': 'https://www.youtube.com/shorts/NMkJFomcBN0',
  'Kettlebell Side Lunge': 'https://www.youtube.com/shorts/eI6JDGd2Nf0',
  'Kettlebell Suitcase Carry': 'https://www.youtube.com/shorts/EqwawkAPPr0',
  'Kneeling Cable Rotations': 'https://www.youtube.com/shorts/Bo19adoX96o',
  'Kneeling Incline Press Ups': 'https://www.youtube.com/shorts/pLjf2g4Nrrg',
  'Kneeling Press Ups': 'https://www.youtube.com/shorts/iAM0R9JXLnI',
  'Landmine Goblet Squats': 'https://www.youtube.com/shorts/i4YH9rWYm_A',
  'Landmine Rotations': 'https://www.youtube.com/shorts/HijWQP870QY',
  'Landmine Single Arm Rows': 'https://www.youtube.com/shorts/Ml92Kc8xaA0',
  'Landmine Split Squats': 'https://www.youtube.com/shorts/TGb7vq84olQ',
  'Medball Slams': 'https://www.youtube.com/shorts/lucmyeFhqWQ',
  'Pause Deadlifts': 'https://www.youtube.com/shorts/hRo6y9yJWcU',
  'Pause Squats': 'https://www.youtube.com/shorts/bI5dKMy50vc',
  'Pin Squats': 'https://www.youtube.com/shorts/iimUf-jXK-0',
  'Plank Taps': 'https://www.youtube.com/shorts/u47TJ9pDvWU',
  'Plate Bench Press': 'https://www.youtube.com/shorts/yJznf1hiL0E',
  'Plate Squeeze Press': 'https://www.youtube.com/shorts/Wf0nhUidHaU',
  'Pull Ups': 'https://www.youtube.com/shorts/x3lc-RqEcag',
  'Rack Pull': 'https://www.youtube.com/shorts/a5Yg3f-RgKU',
  'Rack Rows': 'https://www.youtube.com/shorts/FQX8xghigIA',
  'Reeves Deadlift': 'https://www.youtube.com/shorts/TfSTcvjDJf4',
  'Seated Box Jumps': 'https://www.youtube.com/shorts/n76RaN51AFg',
  'Seated Close Grip Rows': 'https://www.youtube.com/shorts/dKKsJMlmogM',
  'Seated Dumbbell Press': 'https://www.youtube.com/shorts/2qz5IqK9w6o',
  'Seated Single Arm Rows': 'https://www.youtube.com/shorts/OmgSriop7qM',
  'Seated Wide Grip Rows': 'https://www.youtube.com/shorts/Az1vn7b1_Gg',
  'Side Lunge': 'https://www.youtube.com/shorts/xeLW4r3Jznk',
  'Side Plank with Abduction': 'https://www.youtube.com/shorts/0kzWaGiHxJU',
  'Single Arm Dumbbell Press': 'https://www.youtube.com/shorts/V5-MAHfu7fM',
  'Skater Jumps': 'https://www.youtube.com/shorts/7uQetCi9mbc',
  'Slamball Split Jumps': 'https://www.youtube.com/shorts/ClH1En6rT5I',
  'Slamball Squat Jumps': 'https://www.youtube.com/shorts/XI8jEKUCelE',
  'Sled Rows': 'https://www.youtube.com/shorts/KPBZu2djV0M',
  'Snatch Grip Deficit Deadlift': 'https://www.youtube.com/shorts/VCGtuNUmmDM',
  'Split Squat Jumps': 'https://www.youtube.com/shorts/7yT5smEHvSI',
  'Standing Dumbbell Press': 'https://www.youtube.com/shorts/pFDyKWvEBow',
  'Standing Quad Stretch': 'https://www.youtube.com/shorts/8hiFKtyYNfE',
  'Suitcase Deadlift': 'https://www.youtube.com/shorts/E50FUvQoFt4',
  'Sumo Deadlift': 'https://www.youtube.com/shorts/6duZDJ4PdXs',
  'Supine Medball Throws': 'https://www.youtube.com/shorts/3GCUM05ig5o',
  'Trapbar Deadlift (high handles)': 'https://www.youtube.com/shorts/3yjg8We2hEc',
  'Trapbar Deadlift (low handles)': 'https://www.youtube.com/shorts/dNEiynURLvg',
  'Trapbar Farmers Carry': 'https://www.youtube.com/shorts/veXGQD_Dj5s',
  'Trapbar Rows': 'https://www.youtube.com/shorts/5jnD2PFf_Mc',
  'TRX Face Pulls': 'https://www.youtube.com/shorts/qNu_HoAIVFk',
  'TRX Push Ups': 'https://www.youtube.com/shorts/3F44yRdK5cQ',
  'TRX Rows': 'https://www.youtube.com/shorts/xwptes-6N4Q',
  'Wall Hip Hinge': 'https://www.youtube.com/shorts/cf4IYtzLPFc',
};

/**
 * THE MAPPINGS THAT ARE A JUDGEMENT, NOT A NAME MATCH.
 *
 * Every other line in the table above puts an exercise with an upload whose
 * title is the same words in the same order, so no opinion is involved. These
 * thirteen are the exceptions: somebody looked at the movement and decided the
 * demo shows it under a different name. Each is recorded here with the title of
 * the video it was given, so the decision is written down rather than lost in a
 * comment, and so the check can tell a decision apart from a slip.
 *
 * tests/videos-linked.check.mjs will FAIL on any live exercise whose video is
 * not an exact title match and is not on this list. That is the whole point: a
 * near miss cannot be added quietly. Putting one here is how somebody says out
 * loud that they watched the video and it is the right movement.
 *
 * The rule the list is judged against is at the top of this file: a different
 * name for the same movement is fine, a different grip, tempo or implement is
 * not. Hip Circles is the one deliberate exception and it says so where it sits.
 */
export const VIDEO_LINKS_DECIDED_BY_HAND: Readonly<Record<string, string>> = {
  'Band Face Pull': 'Banded Face Pulls',
  'Band Pull-Apart': 'Band Pull Aparts',
  'Banded Clamshell': 'Banded Clamshells',
  'Banded Pallof Press': 'Banded Palloff Press',
  'Dead Bug': 'Deadbugs',
  'Doorway Chest Opener': 'Doorway Pec Stretch',
  'Doorway Chest Stretch': 'Doorway Pec Stretch',
  'Glute Bridge': 'Glute Bridges',
  'Hip Circles': 'Banded Hip Circles',
  'Landmine Romanian Deadlift': 'Landmine Romanian Deadlifts',
  'Landmine Split Stance Romanian Deadlift': 'Landmine Split Stance Romanian Deadlifts',
  'Prone Y Raise': 'Bench Dumbbell Ys',
  'Sled Push and Pull': 'Sled Push & Pull',
};

/** The channel every video here must come from. */
export const CHANNEL_HANDLE = '@GrowPerformanceRehabilitation';
export const CHANNEL_URL = 'https://www.youtube.com/@GrowPerformanceRehabilitation';

/**
 * A link that opens a video and nothing else.
 *
 * Accepts the three shapes a person actually copies out of YouTube. Anything
 * else is rejected by the contract test rather than shipped, because the failure
 * it prevents is silent: a malformed link opens YouTube's home page and the user
 * has no idea the app meant to show them something.
 */
export const VIDEO_URL_PATTERN =
  /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)[A-Za-z0-9_-]{6,}|youtu\.be\/[A-Za-z0-9_-]{6,})(?:[?&][^\s]*)?$/;

export function isValidVideoUrl(url: string): boolean {
  return VIDEO_URL_PATTERN.test(url);
}

/**
 * The exact video for an exercise, or nothing.
 *
 * Three sources, most specific first:
 *
 *   1. `youtubeUrl` on the template — a full link written next to the exercise
 *      itself, for the rare case where that is more convenient than the table.
 *   2. this table, keyed by name — the normal place, and the one the guide above
 *      describes.
 *   3. `videoId` on the template — the original field, a bare YouTube id.
 *
 * Returns undefined when there is no footage, which is the signal to the caller
 * to keep doing what it has always done and open a search.
 *
 * Name matching is case- and space-insensitive so "DB  Row" and "Db Row" find
 * the same entry. It is NOT fuzzy beyond that: a near-miss must fail loudly in
 * the contract test rather than quietly resolve to the wrong movement.
 */
export function videoUrlFor(exercise: {
  name: string;
  videoId?: string;
  youtubeUrl?: string;
}): string | undefined {
  if (exercise.youtubeUrl) return exercise.youtubeUrl;

  const mapped = lookup(exercise.name);
  if (mapped) return mapped;

  if (exercise.videoId) return `https://www.youtube.com/watch?v=${exercise.videoId}`;
  return undefined;
}

let normalised: Map<string, string> | null = null;

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookup(name: string): string | undefined {
  if (!normalised) {
    normalised = new Map(
      Object.entries(EXERCISE_VIDEOS).map(([key, url]) => [normalise(key), url])
    );
  }
  return normalised.get(normalise(name));
}

/** Every exercise name that has footage. Used by the coverage report. */
export function mappedExerciseNames(): string[] {
  return Object.keys(EXERCISE_VIDEOS);
}

/**
 * FILMED, AND THE MOVEMENT IS NOT ON ARCHIE'S LIST.
 *
 * Eighty-one of the mappings above are for exercises the app used to have and
 * does not any more: the old Train catalogue was deleted when every session
 * moved onto docs/EXERCISE-LIBRARY.md, and it took a cable lateral raise, a
 * hammer curl, a barbell good morning and seventy-eight others with it.
 *
 * THE MAPPINGS STAY, and this list is why. The footage exists and is the only
 * record of which video demonstrates which movement - the channel snapshot in
 * scripts/channel-videos.json holds titles and ids, not what they are for. If
 * Archie adds a hammer curl to the library next month, its video is already
 * attached and nobody has to remember that it was filmed.
 *
 * Written out rather than counted, so that a mapping added with a TYPO in the
 * name is not quietly waved through as one more exercise the app does not have.
 * tests/exercise-videos.check.mjs asserts this list and the orphans agree in
 * BOTH directions: a new orphan fails, and a name that comes back into the app
 * has to be taken off this list.
 */
export const VIDEO_NAMES_NOT_IN_THE_APP: readonly string[] = [
  '90/90 Hip Switch',
  'Alternating Dumbbell Curl',
  'Alternating Dumbbell Overhead Press',
  'Ankle Dorsiflexion Drill',
  'Back Squat',
  'Banded Good Morning',
  'Banded Lateral Walk',
  'Banded March',
  'Banded Monster Walk',
  'Banded VMO Extension',
  'Barbell Bulgarian Split Squat',
  'Barbell Good Morning',
  'Bench Dumbbell Reverse Fly',
  'Bent-Knee Calf Raise',
  'Bent-Knee Single-Leg Calf Raise',
  'Bodyweight Hip Hinge',
  'Bodyweight Squat',
  'Box Jump (Step-Down)',
  'Box Squat',
  'Cable Hip Abduction',
  'Cable Hip Extension',
  'Cable Hip Flexion',
  'Cable Lateral Raise',
  'Calf Raise',
  'Chin-Up',
  'DB Bicep Curl',
  'DB Bulgarian Split Squat',
  'DB Face Pull',
  'DB Hammer Curl',
  'DB Lateral Raise',
  'DB Shoulder Press',
  'DB Split Squat Jump',
  'DB Split-Stance Romanian Deadlift',
  'DB Squat Jump',
  'Depth Jump',
  'Dumbbell Walking Lunge',
  'Goblet Squat',
  'Gorilla Row',
  'Incline DB Press',
  'KB / DB Swing',
  'KB Romanian Deadlift',
  'KB Side Lunge',
  'KB Swing (Explosive)',
  'KB Swing (Steady)',
  'Kneeling Rock-Back',
  'Landmine Goblet Squat',
  'Landmine Single-Arm Row',
  'Landmine Split Squat',
  'Lat Pulldown',
  'Lateral Leg Swing',
  'Lateral Lunge',
  'Leg Swing',
  'Loaded Jump Squat',
  'Med Ball Overhead Slam',
  'Plank Shoulder Tap',
  'Pull-Up',
  'Seated Box Jump',
  'Seated Butterfly',
  'Seated Cable Row',
  'Seated Calf Raise',
  'Seated DB Lateral Raise',
  'Seated DB Shoulder Press',
  'Seated Shoulder External Rotation (Band)',
  'Seated Single-Arm Cable Row',
  'Seated Wide-Grip Cable Row',
  'Shoulder CARs (Controlled Articular Rotations)',
  'Single Arm Cable Extension',
  'Single-Arm Cable Curl',
  'Single-Arm Dumbbell Overhead Press',
  'Skater Jump',
  'Sled Push/Pull Complex',
  'Sled Row',
  'Spanish Squat',
  'Split Squat Jump',
  'Standing Dumbbell Row',
  'Supine Med Ball Throw',
  'Tib Raise',
  'Trap Bar Deadlift',
  'Trap Bar Jump',
  'Trap Bar Row',
  'Weighted Seated Calf Raise',
];
