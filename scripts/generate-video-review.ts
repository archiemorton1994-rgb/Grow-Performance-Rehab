/**
 * Write docs/VIDEO-LINKING-REVIEW.md - everything the 26 September 2026 channel
 * refresh could NOT decide on its own.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * Archie asked for every exercise to be linked to the video with the exact same
 * name. Exact matches are safe, because an exact match is not a guess, so they
 * are wired automatically in lib/exercise-videos.ts. Everything else is a
 * judgement about which movement was filmed, and a red "watch the demo" button
 * is a claim rather than a hint - the wrong video on a card is worse than no
 * video at all, because an exercise with no footage falls back to a YouTube
 * search on its own name and that has always worked.
 *
 * So this is the list he reads before any of it is wired: the near misses with
 * both spellings side by side, the uploads nothing opens, the exercises still
 * without footage, and the handful of cases where the channel itself is
 * ambiguous.
 *
 * Run:  npm run video-review
 * Or:   npx tsx scripts/generate-video-review.ts --check   (fails if out of date)
 */
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getAllPickableExercises } from '../lib/exercise-db';
import { allAcuteExercises } from '../lib/acute-rehab';
import {
  EXERCISE_VIDEOS,
  CHANNEL_HANDLE,
  VIDEO_LINKS_DECIDED_BY_HAND,
} from '../lib/exercise-videos';
import type { ExerciseTemplate } from '../lib/exercise-db';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'docs', 'VIDEO-LINKING-REVIEW.md');
const SNAPSHOT = join(HERE, 'channel-videos.json');

type Video = { id: string; title: string };
type Snapshot = { capturedOn: string; videos: Video[] };

/** Trim and case-fold, and nothing else. This is what "exact" means here. */
const exactKey = (s: string) => s.trim().toLowerCase();
const idInLink = (url: string) =>
  url.match(/(?:shorts\/|watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/)?.[1];
const watch = (id: string) => `https://www.youtube.com/shorts/${id}`;

/**
 * The nine uploads Archie renamed between the August and September captures.
 *
 * Recorded because the old titles are quoted in code comments and in earlier
 * decisions, and because two of the renames move which movement a title refers
 * to rather than just tidying the wording up.
 */
const RETITLED_SINCE_AUGUST: { id: string; was: string }[] = [
  { id: 'SU3KkNX7cCg', was: 'Single Arm Cable Tricep Extensions' },
  { id: 'hMJysvlxaqY', was: 'Single Arm Cable Curls' },
  { id: 'U5EdqKJDX6s', was: 'Single Arm Cable Rows' },
  { id: 'di7H803LkK0', was: 'Tib Raises' },
  { id: 'UsZgojyINOg', was: 'Seated Lateral Raises' },
  { id: 'XTbgWQAyO6Y', was: 'Standing Dumbbell Rows' },
  { id: '3yjg8We2hEc', was: 'Trapbar Deadlift' },
  { id: '6uPr0ee_wa4', was: 'Box Squat' },
  { id: '80Ro5q41PJw', was: 'Alternating Dumbbell Press' },
];

function everyExercise(): ExerciseTemplate[] {
  return [...getAllPickableExercises().map(({ template }) => template), ...allAcuteExercises()];
}

/**
 * Break a name into the words that carry its meaning.
 *
 * The app writes DB and KB where the channel writes Dumbbell and Kettlebell,
 * spells trap bar as one word in some places and two in others, and pluralises
 * to taste. Folding those differences is what lets a pair be RECOGNISED as a
 * near miss and put in front of Archie. It is never used to decide a link.
 */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bdbs?\b/g, 'dumbbell'],
  [/\bkbs?\b/g, 'kettlebell'],
  [/\btrap bar\b/g, 'trapbar'],
  [/\bmed ball\b/g, 'medball'],
  [/\bslam ball\b/g, 'slamball'],
  [/\bbw\b/g, 'bodyweight'],
  [/\bt ?spine\b/g, 'thoracic'],
  [/\brdls?\b/g, 'romanian deadlift'],
];
const FILLER = new Set([
  'the',
  'a',
  'with',
  'and',
  'of',
  'to',
  'on',
  'in',
  'into',
  'at',
  'per',
  'for',
  'each',
]);
const singular = (w: string) =>
  w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

function meaningWords(name: string): string[] {
  let t = exactKey(name);
  for (const [re, to] of ABBREVIATIONS) t = t.replace(re, to);
  t = t
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t
    .split(' ')
    .filter((w) => w && !FILLER.has(w))
    .map(singular);
}

/** True when two words are the same but for one letter, so Pallof finds Palloff. */
function oneLetterApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let differences = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    differences++;
    if (differences > 1) return false;
    if (short.length === long.length) {
      i++;
      j++;
    } else {
      j++;
    }
  }
  return differences + (long.length - j) + (short.length - i) <= 1;
}

function sameWords(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  let loose = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (!oneLetterApart(a[i], b[i])) return false;
    loose++;
    if (loose > 1) return false;
  }
  return true;
}

type Closeness = 1 | 2 | 3;
const CLOSENESS_TITLE: Record<Closeness, string> = {
  1: 'The same words, spelled or spaced differently',
  2: 'One name is the other with a word or two added',
  3: 'Most of the words are shared',
};

function closeness(appName: string, title: string): Closeness | null {
  const a = meaningWords(appName);
  const b = meaningWords(title);
  if (a.length === 0 || b.length === 0) return null;
  // Run the words together before comparing, so a name split across two words
  // still finds the same name written as one. This is the Door Frame Rows and
  // Doorframe Rows case, which is the pair Archie asked about by name.
  const runTogether = (words: string[]) => words.join('');
  if (sameWords(a, b) || oneLetterApart(runTogether(a), runTogether(b))) return 1;
  const longer = runTogether(a).length >= runTogether(b).length ? runTogether(a) : runTogether(b);
  const shorter = runTogether(a).length >= runTogether(b).length ? runTogether(b) : runTogether(a);
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.6) return 2;
  const sa = new Set(a);
  const sb = new Set(b);
  const shared = [...sa].filter((w) => sb.has(w));
  if (shared.length < 2) return null;
  if ((shared.length === sa.size || shared.length === sb.size) && Math.abs(sa.size - sb.size) <= 2)
    return 2;
  if (shared.length / new Set([...a, ...b]).size >= 0.5) return 3;
  return null;
}

export function buildReview(): string {
  const snapshot: Snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));

  const displayName = new Map<string, string>();
  const byName = new Map<string, ExerciseTemplate[]>();
  for (const t of everyExercise()) {
    const k = exactKey(t.name);
    if (!displayName.has(k)) displayName.set(k, t.name);
    byName.set(k, [...(byName.get(k) ?? []), t]);
  }

  const videosByTitle = new Map<string, Video[]>();
  for (const v of snapshot.videos) {
    const k = exactKey(v.title);
    videosByTitle.set(k, [...(videosByTitle.get(k) ?? []), v]);
  }
  const titleById = new Map(snapshot.videos.map((v) => [v.id, v.title]));

  const tableByKey = new Map(
    Object.entries(EXERCISE_VIDEOS).map(([name, url]) => [exactKey(name), url])
  );

  /** Every video id a live exercise can open, from the table or from its own record. */
  const openable = new Map<string, string[]>();
  for (const [key, templates] of byName) {
    const ids = new Set<string>();
    const fromTable = tableByKey.get(key);
    if (fromTable) {
      const id = idInLink(fromTable);
      if (id) ids.add(id);
    }
    for (const t of templates) {
      if (t.videoId) ids.add(t.videoId);
      if (t.youtubeUrl) {
        const id = idInLink(t.youtubeUrl);
        if (id) ids.add(id);
      }
    }
    if (ids.size > 0) openable.set(key, [...ids]);
  }
  const openableIds = new Set([...openable.values()].flat());

  const withoutVideo = [...byName.keys()].filter((k) => !openable.has(k));
  const unusedUploads = snapshot.videos.filter((v) => !openableIds.has(v.id));

  // Which unused uploads are nonetheless named in the table, against a movement
  // the app no longer carries.
  const retiredClaim = new Map<string, string[]>();
  for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
    const id = idInLink(url);
    if (!id || openableIds.has(id)) continue;
    retiredClaim.set(id, [...(retiredClaim.get(id) ?? []), name]);
  }

  const L: string[] = [];
  const say = (s = '') => L.push(s);
  let section = 0;
  const next = () => ++section;

  say('# Video linking: what still needs Archie');
  say();
  say(
    '<!-- GENERATED FILE - do not edit by hand. Run `npm run video-review` to refresh. -->'
  );
  say();
  say(
    `The app now reads ${snapshot.videos.length} uploads from ${CHANNEL_HANDLE}, captured ${snapshot.capturedOn}. Every exercise whose name is EXACTLY the title of an upload has been linked to it, and **${openable.size} of the app's ${byName.size} exercises now open a video**. Before this refresh the app still held the August list of 103 uploads and only 72 exercises had footage.`
  );
  say();
  say(
    'This page is the rest of the job, and none of it has been wired. An exercise with no video is not broken: its red button runs a YouTube search on the exercise name, which is what the app has always done. A video on the WRONG card is broken quietly, so nothing below is attached on a resemblance, however obvious the resemblance looks.'
  );
  say();
  say('Everything here needs one word: yes, no, or film it.');
  say();

  // ── Where the channel itself is unclear ───────────────────────────────────
  say(`## ${next()}. Where the channel itself is unclear`);
  say();
  const undatedTitles = snapshot.videos.filter((v) =>
    /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(v.title.trim())
  );
  const duplicateTitles = [...videosByTitle.values()].filter((list) => list.length > 1);
  if (undatedTitles.length === 0 && duplicateTitles.length === 0) {
    say('Nothing. Every upload has a title of its own.');
    say();
  }
  for (const v of undatedTitles) {
    say(
      `- **An upload with no real title: "${v.title}"** (${watch(v.id)}). The title is the date it went up, so there is no way to tell from here which movement it shows. Nothing is linked to it. Renaming it on YouTube is enough to bring it in on the next refresh.`
    );
  }
  for (const list of duplicateTitles) {
    const key = exactKey(list[0].title);
    const inApp = displayName.get(key);
    const opens = openable.get(key) ?? [];
    say(
      `- **Two uploads share the title "${list[0].title}"**: ${list
        .map((v) => watch(v.id))
        .join(' and ')}. Two videos cannot both be the demo for one card, so this was left out of the automatic pass.${
        inApp
          ? ` The app has an exercise called exactly that (${inApp}).${
              opens.length ? ` Its card opens ${watch(opens[0])} today, the take chosen in August.` : ''
            } Which of the two should it be?`
          : ' No exercise carries that exact name today.'
      }`
    );
  }
  say();

  // ── Sibling entries that took a video each ───────────────────────────────
  /**
   * Two exercises whose names differ only inside the brackets, each linked to a
   * different upload on an exact title match.
   *
   * The link is not a guess, because each name IS the title. What a name match
   * cannot check is whether the two are the right way round, and getting a high
   * and a low handle the wrong way about on a trap bar deadlift would show
   * somebody the other lift entirely. So it is wired and flagged, not withheld.
   */
  const stem = (n: string) =>
    n
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const siblings = new Map<string, { name: string; id: string }[]>();
  for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
    const key = exactKey(name);
    if (!displayName.has(key) || !name.includes('(')) continue;
    const id = idInLink(url);
    const title = id ? titleById.get(id) : undefined;
    if (!id || !title || exactKey(title) !== key) continue;
    siblings.set(stem(name), [...(siblings.get(stem(name)) ?? []), { name, id }]);
  }
  const pairedSiblings = [...siblings.values()].filter((l) => l.length > 1);
  if (pairedSiblings.length > 0) {
    say(`## ${next()}. Wired on the name, worth one look`);
    say();
    say(
      'Two exercises whose names are the same but for the words in brackets, each now opening the upload with its own exact title. The names match character for character, so nothing was guessed, but a name cannot tell anybody whether the two are the right way round. One look at each confirms it.'
    );
    say();
    for (const list of pairedSiblings) {
      for (const s of list) say(`- ${s.name} opens "${titleById.get(s.id)}" - ${watch(s.id)}`);
    }
    say();
  }

  // ── A table name that reads like an exact match and is not ────────────────
  const misleading: string[] = [];
  for (const [name, url] of Object.entries(EXERCISE_VIDEOS)) {
    const key = exactKey(name);
    const mappedId = idInLink(url);
    const sameTitle = videosByTitle.get(key);
    if (!mappedId || !sameTitle) continue;
    if (sameTitle.some((v) => v.id === mappedId)) continue;
    misleading.push(
      `- \`${name}\` in \`lib/exercise-videos.ts\` opens "${
        titleById.get(mappedId) ?? mappedId
      }" (${watch(mappedId)}), and there is now a DIFFERENT upload titled exactly "${
        sameTitle[0].title
      }" (${watch(sameTitle[0].id)}). Nothing is broken today${
        displayName.has(key) ? '' : ', and the app does not serve that name any more'
      }, but the two are easy to mix up.`
    );
  }
  if (misleading.length > 0) {
    say(`## ${next()}. A name that looks like an exact match and is not`);
    say();
    say('The traps to know about before wiring anything else by hand.');
    say();
    for (const m of misleading) say(m);
    say();
  }

  // ── Renames on the channel ───────────────────────────────────────────────
  say(`## ${next()}. ${RETITLED_SINCE_AUGUST.length} uploads were renamed since August`);
  say();
  say(
    'Worth knowing because the old titles are quoted in the code and in earlier decisions, and because two of the renames change which movement the title points at.'
  );
  say();
  say('| Was called | Now called | Video |');
  say('| --- | --- | --- |');
  for (const r of RETITLED_SINCE_AUGUST) {
    say(`| ${r.was} | ${titleById.get(r.id) ?? 'gone from the channel'} | ${watch(r.id)} |`);
  }
  say();

  // ── Near misses ──────────────────────────────────────────────────────────
  const nearest = new Map<Closeness, string[]>([
    [1, []],
    [2, []],
    [3, []],
  ]);
  for (const key of [...withoutVideo].sort((a, b) => a.localeCompare(b))) {
    const appName = displayName.get(key)!;
    for (const v of unusedUploads) {
      const how = closeness(appName, v.title);
      if (how === null) continue;
      nearest.get(how)!.push(`| ${appName} | ${v.title} | ${watch(v.id)} |`);
    }
  }
  const nearTotal = [...nearest.values()].reduce((n, l) => n + l.length, 0);
  say(`## ${next()}. Near misses: ${nearTotal} pairs, none of them linked`);
  say();
  say(
    "On the left is the app's name for the exercise, on the right the title of an upload nothing is using. They are grouped by how close the wording is, closest first. A tick against any row is enough to wire it."
  );
  say();
  for (const level of [1, 2, 3] as Closeness[]) {
    const rows = nearest.get(level)!;
    if (rows.length === 0) continue;
    say(`### ${CLOSENESS_TITLE[level]} (${rows.length})`);
    say();
    say('| The app calls it | The video is called | Video |');
    say('| --- | --- | --- |');
    for (const r of rows) say(r);
    say();
  }

  // ── Uploads nothing opens ────────────────────────────────────────────────
  say(`## ${next()}. Uploads no exercise opens (${unusedUploads.length})`);
  say();
  say(
    'Footage on the channel that no card in the app can reach. Each one is either a movement the library does not carry, which means the exercise has to be written before the video has anywhere to go, or a near miss from the section above.'
  );
  say();
  const heldForRetired = unusedUploads.filter((v) => retiredClaim.has(v.id));
  if (heldForRetired.length > 0) {
    say(
      `${heldForRetired.length} of them ARE named in \`lib/exercise-videos.ts\`, against a movement the deleted Train catalogue had and the library does not. Those mappings are kept on purpose so the footage is not lost, and they re-attach the day the movement joins the library, but no card opens them today. They are marked below.`
    );
    say();
  }
  for (const v of unusedUploads) {
    const claim = retiredClaim.get(v.id);
    say(
      `- ${v.title} - ${watch(v.id)}${
        claim ? `  _(held for the retired name ${claim.join(', ')})_` : ''
      }`
    );
  }
  say();

  // ── Exercises with no footage ────────────────────────────────────────────
  const CATEGORY_TITLES: Record<string, string> = {
    main: 'Main lifts',
    accessory: 'Accessories',
    prehab: 'Rehab and prehab drills',
    prep: 'Warm-ups',
    neuro: 'Power and speed',
    mechanical: 'Mechanical drop sets',
    finisher: 'Finishers',
    cardio: 'Conditioning',
    cooldown: 'Cool-downs and stretching',
  };
  const ORDER = [
    'main',
    'accessory',
    'prehab',
    'prep',
    'neuro',
    'mechanical',
    'finisher',
    'cardio',
    'cooldown',
  ];
  const grouped = new Map<string, string[]>();
  for (const key of withoutVideo) {
    const category = (byName.get(key) ?? [])[0]?.category ?? 'other';
    grouped.set(category, [...(grouped.get(category) ?? []), displayName.get(key)!]);
  }
  say(`## ${next()}. Exercises with no video at all (${withoutVideo.length})`);
  say();
  say(
    'The shooting list, grouped by where the exercise turns up. EXERCISE-VIDEO-STATUS.md orders the same list by how many sessions each movement can appear in, which is the better order to film in.'
  );
  say();
  for (const category of [...ORDER, ...[...grouped.keys()].filter((c) => !ORDER.includes(c))]) {
    const list = grouped.get(category);
    if (!list || list.length === 0) continue;
    say(`### ${CATEGORY_TITLES[category] ?? category} (${list.length})`);
    say();
    for (const n of list.sort((a, b) => a.localeCompare(b))) say(`- ${n}`);
    say();
  }

  // ── The judgement calls already made ─────────────────────────────────────
  say(
    `## ${next()}. The links that are already a judgement (${
      Object.keys(VIDEO_LINKS_DECIDED_BY_HAND).length
    })`
  );
  say();
  say(
    'Every other link in the app is an exact name match. These were decided by looking at the movement, and are listed so they can be argued with. Any one of them can be removed with a single line, and that exercise goes back to a YouTube search.'
  );
  say();
  say('| The app calls it | The video is called |');
  say('| --- | --- |');
  for (const [name, title] of Object.entries(VIDEO_LINKS_DECIDED_BY_HAND).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    say(`| ${name} | ${title} |`);
  }
  say();

  return L.join('\n');
}

/**
 * Only write anything when this file is what was RUN.
 *
 * tests/videos-linked.check.mjs imports buildReview() to compare the page with
 * the one on disk. Without this guard that import would rewrite the page first
 * and the comparison would always pass, which is the exact shape of a test that
 * cannot fail.
 */
if (process.argv[1]?.includes('generate-video-review')) {
  const markdown = buildReview();
  if (process.argv.includes('--check')) {
    let onDisk = '';
    try {
      onDisk = readFileSync(OUT, 'utf8');
    } catch {
      // reported below
    }
    if (onDisk !== markdown) {
      console.error('docs/VIDEO-LINKING-REVIEW.md is out of date - run `npm run video-review`');
      process.exitCode = 1;
    } else {
      console.log('docs/VIDEO-LINKING-REVIEW.md is current');
    }
  } else {
    writeFileSync(OUT, markdown);
    console.log('wrote docs/VIDEO-LINKING-REVIEW.md');
  }
}

/** Where the page lives, so a check can read it without guessing the path. */
export const REVIEW_PAGE = OUT;
