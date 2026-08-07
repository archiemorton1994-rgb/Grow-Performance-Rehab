(globalThis as any).__DEV__ = false;
import { writeFileSync } from 'fs';
import { getAllPickableExercises } from '../lib/exercise-db';
import {
  RESTRICTED_BY_REGION,
  STRESS_TAG_LABELS,
  restrictedTagsFor,
  restrictedTagsOn,
  stressTagsFor,
} from '../lib/exercise-safety';
import { PAIN_CATEGORIES } from '../lib/store';
import type { PainRegion } from '../lib/store';

const all = getAllPickableExercises();
const groups = Object.values(PAIN_CATEGORIES) as any[];

const out: string[] = [];
out.push('# Injury screening — what the app blocks, and for whom');
out.push('');
out.push(
  'This is generated from the live rules in `lib/exercise-safety.ts`. It exists so the'
);
out.push(
  'mapping can be checked by someone qualified without reading any code. If something here'
);
out.push('is wrong, say which line and it changes — the rules are plain data, not logic.');
out.push('');
out.push('**What this does and does not do.** It only ever REMOVES exercises. It never decides');
out.push('that something is *good* for a complaint — the targeted rehab sessions do that, and');
out.push('they are deliberately exempt from this screen. Where something is removed, a');
out.push('replacement is chosen from the same category and movement pattern, and the user is');
out.push('told what was swapped and can put it back with one tap.');
out.push('');
out.push('**One rule applies on top of all of this:** a BEGINNER who reports any complaint at');
out.push('all also loses every high-impact exercise, not just the ones that load the sore');
out.push('joint. Experienced lifters keep whatever their specific complaint does not rule out.');
out.push('');

for (const g of groups) {
  out.push(`## ${g.label}`);
  out.push('');
  for (const r of g.regions as { id: PainRegion; label: string }[]) {
    const tags = RESTRICTED_BY_REGION[r.id] ?? [];
    const banned = restrictedTagsFor([r.id], 'intermediate');
    const blocked = all.filter(
      (p) => restrictedTagsOn(p.template.name, banned, p.template.movementPattern).length > 0
    );
    const pct = Math.round((blocked.length / all.length) * 100);

    out.push(`### ${r.label}`);
    out.push('');
    out.push(`Avoids: ${tags.map((t) => STRESS_TAG_LABELS[t]).join(', ')}.`);
    out.push('');
    out.push(`Blocks **${blocked.length} of ${all.length}** exercises (${pct}%).`);
    out.push('');
    // A representative sample rather than the full list: the point is to let a
    // reader sanity-check the rule, not to audit 447 names per region.
    const sample = blocked
      .map((p) => p.template.name)
      .sort()
      .slice(0, 12);
    if (sample.length > 0) {
      out.push('Examples of what it removes:');
      out.push('');
      for (const n of sample) out.push(`- ${n}`);
      if (blocked.length > sample.length) {
        out.push(`- …and ${blocked.length - sample.length} more`);
      }
      out.push('');
    }
    // The ones most likely to be argued about: things a reader might expect to
    // be blocked but which are allowed.
    const notable = all
      .filter((p) => restrictedTagsOn(p.template.name, banned, p.template.movementPattern).length === 0)
      .filter((p) => {
        const tagsOn = stressTagsFor(p.template.name, p.template.movementPattern);
        return tagsOn.length > 0;
      })
      .map((p) => p.template.name)
      .sort()
      .slice(0, 6);
    if (notable.length > 0) {
      out.push('Still allowed (loaded, but not in a way this complaint rules out):');
      out.push('');
      for (const n of notable) out.push(`- ${n}`);
      out.push('');
    }
  }
}

out.push('## The categories a movement can fall into');
out.push('');
for (const [tag, label] of Object.entries(STRESS_TAG_LABELS)) {
  out.push(`- **${label}** (\`${tag}\`)`);
}
out.push('');

writeFileSync('docs/injury-screening.md', out.join('\n') + '\n');
console.log('written: docs/injury-screening.md');
