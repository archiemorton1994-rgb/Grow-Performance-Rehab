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
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Exercise name → the video that demonstrates it.
 *
 * Filled in from the 69 videos on the channel as at 13 August 2026. 38 of them
 * name a movement the app also has; the other 31 are exercises the app does not
 * carry (trap-bar work, gorilla rows, banded monster walks) or are a variation
 * specific enough that pointing an existing exercise at them would be wrong.
 *
 * NOTHING HERE IS A GUESS. A video was only attached where it demonstrates the
 * same movement — a different name for it is fine, a different grip, tempo or
 * implement is not. Where two videos could both plausibly claim one exercise
 * (two "Kettlebell Swings" uploads; wide- and close-grip seated rows against a
 * single "Seated Cable Row") neither was used, because a red "watch the demo"
 * button is a claim about which movement this is.
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
  'Push-Up': 'https://www.youtube.com/shorts/f4LAlzZ7jMs',
  'Squat Jump': 'https://www.youtube.com/shorts/mHL97bDjXdM',

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
