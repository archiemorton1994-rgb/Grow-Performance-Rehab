/**
 * Contract test: every exercise whose name IS the title of an upload opens that
 * upload, and nothing else was linked on a resemblance.
 *
 * WHAT THIS PREVENTS
 * ──────────────────
 * Archie asked for every exercise to be linked to the video on his channel with
 * the exact same name. Two different things can go wrong with that, and neither
 * one crashes:
 *
 *   a name matches a title and nothing is linked  -> a recording he made sits
 *                                                    unused and the card runs a
 *                                                    YouTube search instead
 *   a name NEARLY matches and gets linked anyway  -> the card plays a different
 *                                                    movement, confidently
 *
 * The second is the dangerous one. "Door Frame Rows" and "Doorframe Rows" are
 * almost certainly the same movement; "Seated Tib Raises" and "Tibialis Raise"
 * are almost certainly not, and neither pair can be told apart by spelling. So
 * the rule this file holds is that a link is an EXACT title match - trim and
 * case-fold, nothing else - or it is named in VIDEO_LINKS_DECIDED_BY_HAND
 * because somebody watched the video and said so.
 *
 * Everything is asked of the real resolver, videoUrlFor(), over the real
 * library and the real channel snapshot. Nothing here reads source code for a
 * spelling.
 *
 * Run:  npx tsx tests/videos-linked.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

import { getAllPickableExercises } from '../lib/exercise-db.ts';
import { allAcuteExercises } from '../lib/acute-rehab.ts';
import {
  EXERCISE_VIDEOS,
  VIDEO_LINKS_DECIDED_BY_HAND,
  videoUrlFor,
} from '../lib/exercise-videos.ts';
import { buildReview, REVIEW_PAGE } from '../scripts/generate-video-review.ts';

let failures = 0;
let total = 0;
function check(label, condition, detail) {
  total++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

/** Trim and case-fold, and nothing else. This is what exact means. */
const exactKey = (s) => s.trim().toLowerCase();
const idInLink = (url) => url.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)?.[1];

// ─── The two things being cross-referenced ───────────────────────────────────
const snapshot = JSON.parse(
  readFileSync(new URL('../scripts/channel-videos.json', import.meta.url), 'utf8')
);

/**
 * Every exercise the app can put on a card, by name.
 *
 * The acute-rehab protocols are unioned in for the same reason the report does
 * it: they are not on the builder's menu, but somebody doing one sees the video
 * button on every card.
 */
const exercises = new Map();
for (const { template } of getAllPickableExercises()) {
  const key = exactKey(template.name);
  exercises.set(key, exercises.get(key) ?? template);
}
for (const t of allAcuteExercises()) {
  const key = exactKey(t.name);
  exercises.set(key, exercises.get(key) ?? t);
}

const videosByTitle = new Map();
for (const v of snapshot.videos) {
  const key = exactKey(v.title);
  videosByTitle.set(key, [...(videosByTitle.get(key) ?? []), v]);
}
const titleById = new Map(snapshot.videos.map((v) => [v.id, v.title]));

console.log(
  `\n[1] The channel snapshot: ${snapshot.videos.length} uploads as at ${snapshot.capturedOn}, against ${exercises.size} exercises`
);

const duplicateIds = snapshot.videos
  .map((v) => v.id)
  .filter((id, i, all) => all.indexOf(id) !== i);
check(
  'every upload in the snapshot is listed once',
  duplicateIds.length === 0,
  `${duplicateIds.join(', ')} appear twice, so a count of the channel would be wrong`
);
const badIds = snapshot.videos.filter((v) => !/^[A-Za-z0-9_-]{6,}$/.test(v.id));
check(
  'every id in the snapshot is shaped like a YouTube id',
  badIds.length === 0,
  badIds.map((v) => `${v.title} -> ${v.id}`).join(' | ')
);
const emptyTitles = snapshot.videos.filter((v) => v.title.trim().length === 0);
check(
  'every upload in the snapshot has a title',
  emptyTitles.length === 0,
  `${emptyTitles.map((v) => v.id).join(', ')} have nothing to match on`
);

// ─── Every link the app can follow is on his channel ─────────────────────────
console.log('\n[2] Nothing points at a video that is not his');

const resolved = new Map();
for (const [key, template] of exercises) {
  const url = videoUrlFor(template);
  if (url) resolved.set(key, url);
}
const offChannel = [...resolved.entries()].filter(([, url]) => !titleById.has(idInLink(url) ?? ''));
check(
  `all ${resolved.size} exercises with a video open one that is in the snapshot`,
  offChannel.length === 0,
  offChannel
    .map(([key, url]) => `${exercises.get(key).name} -> ${url}`)
    .join(' | ') + ' — a mistyped id opens nothing and says nothing'
);

const datedTitle = /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/;
const linkedToADate = [...resolved.entries()].filter(([, url]) =>
  datedTitle.test((titleById.get(idInLink(url) ?? '') ?? '').trim())
);
check(
  'no exercise is linked to an upload whose title is only a date',
  linkedToADate.length === 0,
  `${linkedToADate
    .map(([key]) => exercises.get(key).name)
    .join(', ')} — a date says nothing about which movement was filmed`
);

// ─── The promise: an exact name match is linked ──────────────────────────────
console.log('\n[3] Every exact name match is linked to that video');

/**
 * The titles that only one upload carries.
 *
 * Where two uploads share a title, an exact name match does not identify a
 * video, so those are deliberately left for Archie and asserted separately
 * below.
 */
const unambiguousTitles = new Map(
  [...videosByTitle.entries()].filter(([, list]) => list.length === 1).map(([k, l]) => [k, l[0]])
);
const exactPairs = [...exercises.keys()]
  .filter((key) => unambiguousTitles.has(key))
  .map((key) => ({ key, video: unambiguousTitles.get(key) }));
const missed = exactPairs.filter(({ key, video }) => idInLink(resolved.get(key) ?? '') !== video.id);
check(
  `all ${exactPairs.length} exercises whose name is exactly an upload's title open it`,
  missed.length === 0,
  missed
    .map(
      ({ key, video }) =>
        `${exercises.get(key).name} should open ${video.id} and opens ${
          resolved.get(key) ?? 'nothing'
        }`
    )
    .join(' | ')
);
check(
  'that is most of the coverage, so the pass really ran',
  exactPairs.length > 100,
  `only ${exactPairs.length} exact matches found — has the snapshot gone stale again?`
);

// ─── No guesses ──────────────────────────────────────────────────────────────
console.log('\n[4] Nothing was linked on a resemblance');

const decided = new Map(Object.entries(VIDEO_LINKS_DECIDED_BY_HAND).map(([k, v]) => [exactKey(k), v]));
const guessed = [];
for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
  const key = exactKey(name);
  if (!exercises.has(key)) continue; // a retired catalogue name; the other check owns those
  const id = idInLink(url);
  const title = id ? titleById.get(id) : undefined;
  if (title !== undefined && exactKey(title) === key) continue;
  if (decided.has(key)) continue;
  guessed.push(`${name} -> "${title ?? id}"`);
}
check(
  'every mapped exercise either matches its video title exactly or is on the hand-decided list',
  guessed.length === 0,
  `${guessed.join(' | ')} — if the video really does show that movement, say so in VIDEO_LINKS_DECIDED_BY_HAND`
);

const ambiguousTitles = [...videosByTitle.entries()].filter(([, list]) => list.length > 1);
const autoAmbiguous = ambiguousTitles.filter(([key]) => Object.keys(EXERCISE_VIDEOS).some((n) => exactKey(n) === key));
check(
  `a title two uploads share is never mapped by name (${ambiguousTitles.length} such title(s))`,
  autoAmbiguous.length === 0,
  `${autoAmbiguous
    .map(([, list]) => `${list[0].title} (${list.map((v) => v.id).join(' and ')})`)
    .join(' | ')} — an exact match on that name does not say which video`
);

// ─── The hand-decided list is honest ────────────────────────────────────────
console.log('\n[5] The hand-decided list says what it claims');

const notLive = Object.keys(VIDEO_LINKS_DECIDED_BY_HAND).filter((n) => !exercises.has(exactKey(n)));
check(
  `all ${decided.size} names on the hand-decided list are exercises the app serves`,
  notLive.length === 0,
  `${notLive.join(', ')} — a decision about a card nobody can reach is dead weight`
);
const notMapped = Object.keys(VIDEO_LINKS_DECIDED_BY_HAND).filter(
  (n) => !Object.keys(EXERCISE_VIDEOS).some((k) => exactKey(k) === exactKey(n))
);
check(
  'every name on it is actually mapped to a video',
  notMapped.length === 0,
  `${notMapped.join(', ')} — listed as decided and linked to nothing`
);
const wrongTitle = [];
for (const [name, claimedTitle] of Object.entries(VIDEO_LINKS_DECIDED_BY_HAND)) {
  const url = resolved.get(exactKey(name));
  const actual = url ? titleById.get(idInLink(url) ?? '') : undefined;
  if (actual === undefined || exactKey(actual) !== exactKey(claimedTitle)) {
    wrongTitle.push(`${name} says "${claimedTitle}" and opens "${actual ?? 'nothing'}"`);
  }
}
check(
  'each one records the real title of the video it opens',
  wrongTitle.length === 0,
  `${wrongTitle.join(' | ')} — the written-down decision has to be the decision in force`
);
const notActuallyAJudgement = Object.keys(VIDEO_LINKS_DECIDED_BY_HAND).filter((n) => {
  const url = resolved.get(exactKey(n));
  const actual = url ? titleById.get(idInLink(url) ?? '') : undefined;
  return actual !== undefined && exactKey(actual) === exactKey(n);
});
check(
  'and nothing sits on it that is really an exact match',
  notActuallyAJudgement.length === 0,
  `${notActuallyAJudgement.join(', ')} — the list is for judgements, not a place to park a match`
);

// ─── The shooting list does not send him after footage he already has ───────
console.log('\n[6] The report calls a video used when the app opens it');

/**
 * A link can live in two places: the table, or a bare `videoId` on the exercise
 * record. EXERCISE-VIDEO-STATUS.md used to read only the table, so 24 uploads
 * were listed as unused that a card opens perfectly well - which sends somebody
 * off to attach footage that is already attached, or worse, to film it again.
 */
const openableIds = new Set(
  [...resolved.values()].map((url) => idInLink(url)).filter(Boolean)
);
let report = '';
try {
  report = readFileSync(new URL('../EXERCISE-VIDEO-STATUS.md', import.meta.url), 'utf8');
} catch {
  // reported below
}
const listedAsUnused = (report.match(/## Uploads not yet used by the app([\s\S]*?)(?:\n## |$)/)?.[1] ?? '')
  .split('\n')
  .filter((line) => line.startsWith('- '))
  .map((line) => line.match(/shorts\/([A-Za-z0-9_-]+)/)?.[1])
  .filter(Boolean);
check('EXERCISE-VIDEO-STATUS.md lists the unused uploads', report.length > 0, 'run `npm run video-status`');
const wronglyListed = listedAsUnused.filter((id) => openableIds.has(id));
check(
  `none of the ${listedAsUnused.length} uploads it calls unused is one a card opens`,
  wronglyListed.length === 0,
  `${wronglyListed.join(', ')} — the app opens these already`
);

// ─── The review page ────────────────────────────────────────────────────────
console.log('\n[7] The page Archie reads is current');

let onDisk = '';
try {
  onDisk = readFileSync(REVIEW_PAGE, 'utf8');
} catch {
  // reported below
}
check('docs/VIDEO-LINKING-REVIEW.md exists', onDisk.length > 0, 'run `npm run video-review`');
check(
  'it matches what the library and the channel say today',
  onDisk === buildReview(),
  'run `npm run video-review` — a stale decision list is worse than none'
);

/**
 * AND THE OBVIOUS NEAR MISSES REALLY ARE ON IT.
 *
 * Derived a different way from the page's own grouping on purpose: squash every
 * name down to its letters and digits and drop one trailing s, and any pair that
 * then matches is as close as two names get without being the same. If a pair
 * like that is missing from the page, Archie is never asked about it and the
 * footage sits unused for ever, which is the quiet half of this job going wrong.
 */
const squash = (s) => {
  const letters = s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return letters.endsWith('s') ? letters.slice(0, -1) : letters;
};
const unusedUploads = snapshot.videos.filter((v) => !openableIds.has(v.id));
const obvious = [];
for (const [key, template] of exercises) {
  if (resolved.has(key)) continue;
  for (const v of unusedUploads) {
    if (squash(template.name) !== squash(v.title)) continue;
    if (!onDisk.includes(`| ${template.name} | ${v.title} | `)) {
      obvious.push(`${template.name} / ${v.title}`);
    }
  }
}
check(
  'every all-but-identical name pair is on the page for him to rule on',
  obvious.length === 0,
  `${obvious.join(' | ')} — as good as the same name, and nobody is being asked`
);

console.log('');
if (failures > 0) {
  console.error(`videos-linked: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`videos-linked: all ${total} checks passed\n`);
  process.exitCode = 0;
}
