import { writeFileSync } from 'fs';
import { getAllPickableExercises } from './lib/exercise-db';
import { allAcuteExercises } from './lib/acute-rehab';
import { EXERCISE_VIDEOS } from './lib/exercise-videos';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const mapped = new Set(Object.keys(EXERCISE_VIDEOS).map(norm));

const rows = new Map<string, { name: string; count: number; cats: Set<string>; tiers: Set<string> }>();
for (const { template, tiers } of getAllPickableExercises()) {
  const k = norm(template.name);
  const r = rows.get(k) ?? { name: template.name, count: 0, cats: new Set(), tiers: new Set() };
  r.count++; r.cats.add(template.category); tiers.forEach((t) => r.tiers.add(t));
  rows.set(k, r);
}
for (const t of allAcuteExercises()) {
  const k = norm(t.name);
  const r = rows.get(k) ?? { name: t.name, count: 0, cats: new Set(), tiers: new Set() };
  r.count++; r.cats.add(t.category); r.tiers.add('bodyweight');
  rows.set(k, r);
}

const CAT_ORDER = ['main','accessory','neuro','mechanical','finisher','cardio','prehab','prep','cooldown'];
const pick = (c: Set<string>) => [...c].sort((a,b)=>CAT_ORDER.indexOf(a)-CAT_ORDER.indexOf(b))[0];
const lowestTier = (t: Set<string>) => ['bodyweight','dumbbells','fullgym'].find((x) => t.has(x)) ?? 'fullgym';

const missing = [...rows.values()]
  .filter((r) => !mapped.has(norm(r.name)))
  .map((r) => ({ name: r.name, count: r.count, category: pick(r.cats), tier: lowestTier(r.tiers) }));

const done = [...rows.values()].filter((r) => mapped.has(norm(r.name))).length;

writeFileSync(
  'C:/Users/archi/AppData/Local/Temp/claude/C--Users-archi-OneDrive-Desktop-Grow/99eb3416-d719-4101-baaa-4ec394a73985/scratchpad/missing-videos.json',
  JSON.stringify({ total: rows.size, done, missing }, null, 2)
);
console.log(`total ${rows.size}, with video ${done}, missing ${missing.length}`);
const byCat: Record<string, number> = {};
for (const m of missing) byCat[m.category] = (byCat[m.category] ?? 0) + 1;
for (const c of CAT_ORDER) if (byCat[c]) console.log(`  ${c}: ${byCat[c]}`);
