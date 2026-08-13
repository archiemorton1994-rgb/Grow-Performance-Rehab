/**
 * Write ACUTE-REHAB-MAP.json — the whole acute-rehab table in a form anyone can
 * read without opening a code editor.
 *
 * For each injury site it records what the app USED to serve, why each of those
 * was withdrawn, and what it serves instead. That "before" column is the point:
 * a mapping table that only lists the replacements cannot be checked against the
 * problem it was written to solve.
 *
 * Run:  npm run acute-map
 *
 * The file is generated, never hand-edited. tests/acute-rehab.check.mjs fails if
 * it drifts from lib/acute-rehab.ts, so a protocol change that forgets to
 * regenerate it is caught rather than shipped.
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  ACUTE_PREHAB_BY_REGION,
  ACUTE_PROTOCOL_NOTES,
  PAIN_FREE_RULE,
  getRegionPrehabWorkout,
} from '../lib/exercise-db';
import type { PainRegion } from '../lib/store';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ACUTE-REHAB-MAP.json');

/**
 * Why a withdrawn exercise was withdrawn, in plain English.
 *
 * Read off the exercise's own name, reps and cue rather than hand-labelled, so
 * an exercise added to the maintenance list later is classified too instead of
 * silently coming out blank.
 */
function whyWithdrawn(name: string, reps: string, cue: string): string | null {
  const t = `${name} ${reps} ${cue}`;
  if (/nordic|heel drop|copenhagen/i.test(t))
    return 'A near-maximal load on the injured tissue. Correct for a long-standing problem, far too much for a fresh one.';
  if (/eccentric|slow step-down|\(3s down\)|lower .* in 3/i.test(t))
    return 'Heavy lowering work. It loads the muscle while it is getting longer, which is how strains happen and re-happen.';
  if (/pigeon|figure ?4|child'?s pose|forward fold|couch stretch|doorway|straddle|butterfly|90\/90/i.test(t))
    return 'A long passive hold that parks the healing tissue at its full length.';
  if (/stretch|lengthen/i.test(t))
    return 'Stretching the injured tissue. Pulling on a muscle that is still repairing separates the fibres that are knitting back together.';
  if (/single-leg calf raise|wall sit|hollow body|side plank/i.test(t))
    return 'More load than an irritated area can take inside a 0-2/10 pain limit.';
  if (/full[- ]range|maximum end range|end range/i.test(t))
    return 'Driven deliberately to the end of the range, which for a fresh sprain is the position of injury.';
  return null;
}

const regions = Object.keys(ACUTE_PROTOCOL_NOTES) as PainRegion[];

const doc = {
  $comment:
    'GENERATED FILE - do not edit by hand. Run `npm run acute-map` after changing lib/acute-rehab.ts.',
  purpose:
    'Maps each injury site to the gentle, low-load rehab that replaces the stretching and heavy loading the app used to serve for it.',
  painRule: PAIN_FREE_RULE,
  appliesWhen: [
    'The user picks a body region on the Restore tab (Recovery or Targeted Prehab).',
    'The user reports pain in a region on the readiness screen before a training session.',
  ],
  allowedKinds: {
    isometric: 'The muscle works, nothing moves, nothing lengthens.',
    controlled_isotonic: 'Short range, light load, slow, well inside the middle of the range.',
    activation: 'Switching the area on without loading it.',
    mobility_low_load: 'Keeping a joint moving, explicitly stopping short of the end of the range.',
    circulation: 'Moving blood and swelling, with no muscular demand at all.',
  },
  forbidden: [
    'static or passive stretching of the injured tissue',
    'aggressive or ballistic dynamic movement',
    'heavy eccentric loading',
    'anything that leaves the ground',
  ],
  injurySites: regions.map((region) => {
    const notes = ACUTE_PROTOCOL_NOTES[region];
    // The maintenance list, minus the shared cardio warm-up, which is unchanged.
    const previous = getRegionPrehabWorkout(region).filter((e) => e.category !== 'prep');
    return {
      region,
      name: notes.plainName,
      disclaimer: notes.disclaimer,
      avoid: notes.avoid,
      // What the region used to be served, and what became of each one.
      //
      // The acute protocol is a separate list, not an edit of this one, so
      // nothing here is "kept" in the sense of still being in the session — an
      // exercise either reappears in the replacement below (at a lower dose) or
      // it does not. Saying "kept" was wrong and visibly so: it listed Floor
      // Angel for the chest while the avoid list two lines up said not to do it.
      previouslyServed: previous.map((e) => {
        const reason = whyWithdrawn(e.name, e.reps, e.cue);
        const carriedOver = ACUTE_PREHAB_BY_REGION[region].some((a) => a.name === e.name);
        return {
          exercise: e.name,
          previousPrescription: `${e.sets} x ${e.reps}`,
          status: reason
            ? 'withdrawn'
            : carriedOver
              ? 'carried over at a lower dose'
              : 'not used in the acute phase',
          reason:
            reason ??
            (carriedOver
              ? 'Safe in the acute phase; the sets, reps and coaching are dialled down.'
              : 'Nothing wrong with it, but the acute protocol is a shorter, gentler list and this did not make it.'),
        };
      }),
      withdrawn: previous
        .map((e) => ({
          exercise: e.name,
          previousPrescription: `${e.sets} x ${e.reps}`,
          reason: whyWithdrawn(e.name, e.reps, e.cue),
        }))
        .filter((e) => e.reason !== null),
      replacement: ACUTE_PREHAB_BY_REGION[region].map((e) => ({
        exercise: e.name,
        sets: e.sets,
        reps: e.reps,
        load: e.suggestedLoad,
        cue: e.cue,
      })),
    };
  }),
};

writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');

// ─── The same thing in prose ─────────────────────────────────────────────────
// The JSON is what a program reads. This is what a person reads — and the
// person who owns this app is a rehab professional who does not read code, so
// the rules being reviewable by them is the point of writing them down at all.
// Generated from the same source, so the two cannot say different things.

const RULES = join(dirname(fileURLToPath(import.meta.url)), '..', 'PREHAB-SAFETY-RULES.md');

const md: string[] = [];
md.push('# Prehab safety rules');
md.push('');
md.push('<!-- GENERATED FILE - do not edit by hand. Run `npm run acute-map` to refresh. -->');
md.push('');
md.push(
  'What the app is allowed to give someone who has told it a body part hurts. `ACUTE-REHAB-MAP.json` is the same information for a program to read; this is the version to argue with.'
);
md.push('');
md.push('## When these rules apply');
md.push('');
for (const w of doc.appliesWhen) md.push(`- ${w}`);
md.push('');
md.push(
  'On the Restore tab the user is asked outright — **"sore or injured"** or **"feels fine"** — and it defaults to sore. Answering "feels fine" gives the fuller mobility-led session that rotates across weeks, which is what someone well into a rehab block should be doing. On the readiness screen no question is needed: reporting pain there is the answer.'
);
md.push('');
md.push('## The pain rule');
md.push('');
md.push(`> ${doc.painRule}`);
md.push('');
md.push(
  'It is shown on screen as a banner that **cannot be dismissed**. Every other banner in the app reports a decision the app has already made; this one is an instruction, and it is the only thing setting the dose. The protocols prescribe effort as a fraction of the user\'s own — "about a third of your effort" — rather than as a weight, because in the first days after a strain the correct load is whatever does not hurt. Without the number that defines "does not hurt", the prescriptions underneath are incomplete.'
);
md.push('');
md.push('## What may be prescribed');
md.push('');
for (const [k, v] of Object.entries(doc.allowedKinds)) {
  md.push(`- **${k.replace(/_/g, ' ')}** — ${v}`);
}
md.push('');
md.push('## What may never be prescribed');
md.push('');
for (const f of doc.forbidden) md.push(`- ${f}`);
md.push('');
md.push(
  'This is enforced, not merely intended: `tests/acute-rehab.check.mjs` generates a real session for every region at every severity and reads the name, reps and coaching cue of everything in it against a vocabulary of stretching, heavy loading and impact. It also checks the opposite — that the ordinary flexibility session **still** prescribes stretching, because a version of this that simply deleted stretching from the app would otherwise look correct.'
);
md.push('');
md.push('## Site by site');
md.push('');
for (const site of doc.injurySites) {
  md.push(`### ${site.name}`);
  md.push('');
  md.push(`*${site.disclaimer}*`);
  md.push('');
  md.push('**Given instead:**');
  md.push('');
  for (const r of site.replacement) md.push(`- ${r.exercise} — ${r.sets} x ${r.reps} (${r.load})`);
  md.push('');
  md.push('**Withheld, and why:**');
  md.push('');
  if (site.withdrawn.length === 0) md.push('- nothing was being given here that had to be stopped');
  for (const w of site.withdrawn) {
    md.push(`- **${w.exercise}** (was ${w.previousPrescription}) — ${w.reason}`);
  }
  md.push('');
  md.push('**Also to be avoided:**');
  md.push('');
  for (const a of site.avoid) md.push(`- ${a}`);
  md.push('');
}

writeFileSync(RULES, md.join('\n'));

const withdrawn = doc.injurySites.reduce((n, s) => n + s.withdrawn.length, 0);
const replacements = doc.injurySites.reduce((n, s) => n + s.replacement.length, 0);
console.log(`wrote ACUTE-REHAB-MAP.json and PREHAB-SAFETY-RULES.md`);
console.log(`  injury sites : ${doc.injurySites.length}`);
console.log(`  withdrawn    : ${withdrawn}`);
console.log(`  replacements : ${replacements}`);
