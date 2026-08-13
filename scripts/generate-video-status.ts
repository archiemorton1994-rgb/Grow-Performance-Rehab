/**
 * Write EXERCISE-VIDEO-STATUS.md — every exercise in the app, and whether it has
 * a @GrowPerformanceRehabilitation video yet.
 *
 * The point of the file is the "still to record" list: a shooting list, ordered
 * so the most valuable footage is at the top rather than alphabetically.
 * "Valuable" here means how many different sessions the movement can appear in,
 * which is a decent proxy for how many people will tap the button on it.
 *
 * Run:  npm run video-status
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { getAllPickableExercises } from '../lib/exercise-db';
import { allAcuteExercises } from '../lib/acute-rehab';
import { EXERCISE_VIDEOS, CHANNEL_HANDLE, isValidVideoUrl } from '../lib/exercise-videos';
import type { ExerciseTemplate } from '../lib/exercise-db';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'EXERCISE-VIDEO-STATUS.md');

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const mapped = new Set(Object.keys(EXERCISE_VIDEOS).map(norm));

/**
 * Every distinct exercise NAME, with how many database entries carry it.
 *
 * The acute-rehab protocols are unioned in explicitly. They are deliberately not
 * part of getAllPickableExercises() — they are prescribed for an injured area,
 * not offered on a menu — but a user doing one sees the red video button on
 * every card, so they need footage like anything else.
 */
const entries = new Map<string, { name: string; count: number; templates: ExerciseTemplate[] }>();
const everyTemplate = [
  ...getAllPickableExercises().map(({ template }) => template),
  ...allAcuteExercises(),
];
for (const template of everyTemplate) {
  const key = norm(template.name);
  const row = entries.get(key) ?? { name: template.name, count: 0, templates: [] };
  row.count++;
  row.templates.push(template);
  entries.set(key, row);
}

const CATEGORY_ORDER = [
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

/** The block an exercise most often appears in, for grouping the shooting list. */
function primaryCategory(templates: ExerciseTemplate[]): string {
  const counts = new Map<string, number>();
  for (const t of templates) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0])
  )[0][0];
}

const rows = [...entries.values()].map((r) => ({
  name: r.name,
  count: r.count,
  category: primaryCategory(r.templates),
  hasVideo: mapped.has(norm(r.name)) || r.templates.some((t) => !!t.youtubeUrl || !!t.videoId),
}));

const done = rows.filter((r) => r.hasVideo);
const todo = rows.filter((r) => !r.hasVideo);

// Names in the table that match nothing in the app. A typo here is a dead
// button, so it is reported at the top rather than buried.
const orphans = Object.keys(EXERCISE_VIDEOS).filter((k) => !entries.has(norm(k)));
const badUrls = Object.entries(EXERCISE_VIDEOS).filter(([, url]) => !isValidVideoUrl(url));

const byCategory = new Map<string, typeof todo>();
for (const r of todo) {
  const list = byCategory.get(r.category) ?? [];
  list.push(r);
  byCategory.set(r.category, list);
}

const CATEGORY_TITLES: Record<string, string> = {
  main: 'Main lifts — the squat, bench and deadlift variations a session is built around',
  accessory: 'Accessories — the supporting work in every strength session',
  prehab: 'Rehab and prehab — the Restore tab, and the rehab slot inside a session',
  prep: 'Warm-ups',
  neuro: 'Power and speed work',
  mechanical: 'Mechanical drop sets',
  finisher: 'Finishers',
  cardio: 'Conditioning',
  cooldown: 'Cool-downs and stretching',
};

const pct = ((done.length / rows.length) * 100).toFixed(1);

const lines: string[] = [];
lines.push('# Exercise video status');
lines.push('');
lines.push(
  '<!-- GENERATED FILE - do not edit by hand. Run `npm run video-status` to refresh. -->'
);
lines.push('');
lines.push(
  `Every exercise the app can put in front of someone, and whether there is a ${CHANNEL_HANDLE} video for it yet.`
);
lines.push('');
lines.push(`**${done.length} of ${rows.length} recorded (${pct}%). ${todo.length} still to go.**`);
lines.push('');
lines.push(
  'An exercise with no video is not broken — its red button runs a YouTube search on the exercise name, which is what the app has always done. Recording one is a single line in `lib/exercise-videos.ts`; see the instructions at the top of that file.'
);
lines.push('');

if (orphans.length > 0) {
  lines.push('## ⚠ Names that match no exercise');
  lines.push('');
  lines.push(
    'These are listed in `lib/exercise-videos.ts` but no exercise in the app has that name, so the video will never open. Almost always a typo or a renamed exercise.'
  );
  lines.push('');
  for (const o of orphans) lines.push(`- \`${o}\``);
  lines.push('');
}

if (badUrls.length > 0) {
  lines.push('## ⚠ Links that are not a YouTube video');
  lines.push('');
  for (const [name, url] of badUrls) lines.push(`- \`${name}\` → \`${url}\``);
  lines.push('');
}

if (done.length > 0) {
  lines.push('## Recorded');
  lines.push('');
  for (const r of done.sort((a, b) => a.name.localeCompare(b.name))) lines.push(`- ${r.name}`);
  lines.push('');
}

lines.push('## Still to record');
lines.push('');
lines.push(
  'Grouped by where the exercise appears, and within each group the ones used in the most sessions come first — those are the buttons most people will press.'
);
lines.push('');

for (const cat of CATEGORY_ORDER) {
  const list = byCategory.get(cat);
  if (!list || list.length === 0) continue;
  lines.push(`### ${CATEGORY_TITLES[cat] ?? cat} (${list.length})`);
  lines.push('');
  for (const r of list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))) {
    lines.push(`- ${r.name}${r.count > 1 ? `  _(used in ${r.count} places)_` : ''}`);
  }
  lines.push('');
}

// Anything with a category not in CATEGORY_ORDER, so nothing can be dropped.
const listed = new Set(CATEGORY_ORDER);
for (const [cat, list] of byCategory) {
  if (listed.has(cat)) continue;
  lines.push(`### ${cat} (${list.length})`);
  lines.push('');
  for (const r of list.sort((a, b) => a.name.localeCompare(b.name))) lines.push(`- ${r.name}`);
  lines.push('');
}

writeFileSync(OUT, lines.join('\n'));

console.log('wrote EXERCISE-VIDEO-STATUS.md');
console.log(`  distinct exercises : ${rows.length}`);
console.log(`  with a video       : ${done.length}`);
console.log(`  still to record    : ${todo.length}`);
if (orphans.length) console.log(`  UNMATCHED NAMES    : ${orphans.length} — ${orphans.join(', ')}`);
if (badUrls.length) console.log(`  MALFORMED LINKS    : ${badUrls.length}`);
