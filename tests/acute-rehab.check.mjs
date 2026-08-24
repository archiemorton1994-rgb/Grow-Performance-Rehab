/**
 * Contract test: a sore body part is never told to stretch itself.
 *
 * WHAT WENT WRONG
 * ───────────────
 * Naming a body part as the sore one got you stretches of that body part, by two
 * separate routes, both measured in the live app:
 *
 *   Restore -> Targeted Prehab -> Hamstrings
 *     Standing Hamstring Stretch       2 x 45s each side
 *     Supine Hamstring Stretch (Strap) 2 x 45s each side
 *     Nordic Curl Negative (slow)      3 x 5
 *     Hip Hinge Against Wall           "feel hamstring stretch at bottom"
 *     Pigeon Pose                      2 x 45s each side
 *     Seated Forward Fold              2 x 60s
 *
 *   Report hamstring pain on the readiness screen, then train
 *     The rehab slot appended to the session was PREHAB_BY_REGION[region][0] —
 *     the Standing Hamstring Stretch again, inside a normal training session.
 *
 * A strained muscle is a partially torn one. A 45-second hold at its longest
 * point pulls the repairing fibres apart, and a Nordic curl negative is the
 * heaviest lengthening load a hamstring can be given. The same shape of mistake
 * ran through the table: eccentric heel drops for an acute Achilles, a
 * Copenhagen hold for a fresh groin strain, end-range shoulder extension for a
 * strained biceps tendon.
 *
 * HOW THIS TEST IS WRITTEN
 * ────────────────────────
 * It generates real sessions through the real engine and reads the words the
 * user reads — name, reps and cue — against a vocabulary spelled out below. It
 * does not ask any policy table whether the policy is right, and it does not
 * check for specific exercise names. A new stretch added to an acute protocol
 * next year fails this without anyone having to remember it exists.
 *
 * Section 5 is the counterweight: it asserts that the maintenance path STILL
 * prescribes stretching. This was a routing change, not a purge — a version of
 * this fix that deleted stretching from the app would pass sections 1-4 and be
 * wrong, and section 5 is what makes those four mean something.
 *
 * Run:  npx tsx tests/acute-rehab.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import { readFileSync } from 'fs';

import { generateWorkout } from '../lib/workout-engine.ts';
import {
  ACUTE_PREHAB_BY_REGION,
  ACUTE_PROTOCOL_NOTES,
  PAIN_FREE_RULE,
  getRegionPrehabWorkout,
  getRegionPrehabExercise,
} from '../lib/exercise-db.ts';

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

const REGIONS = Object.keys(ACUTE_PROTOCOL_NOTES);

/**
 * STRETCHING, in words.
 *
 * Deliberately vocabulary and not a list of exercise names. It includes the
 * named poses because those are what the old protocols reached for, and the
 * verbs because a cue is where the instruction actually lives — "Hip Hinge
 * Against Wall" sounds like strength work and its cue said "feel hamstring
 * stretch at bottom".
 *
 * No negation handling on purpose. A protocol that bans stretching should not
 * contain the word at all, even to say "this is not a stretch": a cue is skimmed,
 * and both readings leave the same word behind. The six cues that did say that
 * were reworded rather than exempted.
 */
const STRETCH_WORDS =
  /\bstretch|stretches|stretching|lengthen|lengthening|\bfold\b|pigeon|child'?s pose|cobra|straddle|butterfly|scorpion|windmill|thread the needle|figure ?4|couch stretch|doorway|90\/90|end range|full[- ]range|as far as (?:you can|possible)|maximum range/i;

/**
 * TOO MUCH LOAD FOR A FRESH STRAIN, in words.
 *
 * "Eccentric" and the named heavy drills are the ones that matter. Nordic curls,
 * weighted heel drops and Copenhagen holds are correct treatments for a
 * long-standing problem and the wrong answer entirely in the first fortnight,
 * which is exactly why they had been chosen: each is the textbook exercise for
 * its region, just for a different stage of it.
 */
const HEAVY_WORDS =
  /eccentric|nordic|heel drop|copenhagen|\bdrop squat\b|depth (?:drop|jump)|slow step-down|barbell|\bbb\b|kettlebell|\bkb\b|weighted|1rm|max effort|to failure|amrap/i;

/** LEAVING THE GROUND, in words. */
const IMPACT_WORDS =
  /\bjump|jumping|plyo|burpee|\bhops?\b|hopping|bound(?:s|ing)?\b|skater|sprint|shuttle|\bruns?\b|running|\bjogs?\b|jogging|skip rope|jump rope|high knees|butt kick|pogo|double-?under/i;

const readable = (ex) => `${ex.name} ${ex.reps ?? ''} ${ex.cue ?? ''}`;

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[1] The targeted session for a sore region contains no stretching');
// ─────────────────────────────────────────────────────────────────────────────

const profile = {
  name: 'probe',
  sex: 'male',
  experienceLevel: 'intermediate',
  goals: ['rehab'],
  bodyweightKg: 80,
};

/**
 * A targeted session for a sore region — what the Restore tab builds when the
 * user answers "sore or injured", which is also its default.
 */
function targetedSession(region, severity = 'moderate') {
  return generateWorkout(
    'prehab',
    'bodyweight',
    {
      hasAches: true,
      painRegion: region,
      painSeverity: severity,
      acute: true,
      energy: 'normal',
      timeAvailable: '45',
    },
    profile,
    undefined,
    undefined,
    3
  );
}

const stretchHits = [];
const heavyHits = [];
const impactHits = [];
let scanned = 0;

for (const region of REGIONS) {
  for (const severity of ['mild', 'moderate', 'severe']) {
    for (const ex of targetedSession(region, severity)) {
      scanned++;
      const text = readable(ex);
      if (STRETCH_WORDS.test(text)) stretchHits.push(`${region}/${severity} :: ${ex.name}`);
      if (HEAVY_WORDS.test(text)) heavyHits.push(`${region}/${severity} :: ${ex.name}`);
      if (IMPACT_WORDS.test(text)) impactHits.push(`${region}/${severity} :: ${ex.name}`);
    }
  }
}

check(`sessions generated and read (${scanned} exercises)`, scanned > 200, `only ${scanned}`);
check(
  'no stretching of any kind reaches a sore region',
  stretchHits.length === 0,
  [...new Set(stretchHits)].slice(0, 8).join(' | ')
);
check(
  'nothing heavy, eccentric or loaded reaches a sore region',
  heavyHits.length === 0,
  [...new Set(heavyHits)].slice(0, 8).join(' | ')
);
check(
  'nothing that leaves the ground reaches a sore region',
  impactHits.length === 0,
  [...new Set(impactHits)].slice(0, 8).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[2] The rehab slot inside a STRENGTH session is acute too');
// ─────────────────────────────────────────────────────────────────────────────
// This is the route that was hardest to see: a normal training session, with a
// stretch of the sore muscle quietly appended to the end of it.

const strengthHits = [];
let strengthScanned = 0;
let acuteSeen = 0;

for (const region of REGIONS) {
  for (const type of ['squat', 'bench', 'deadlift']) {
    const w = generateWorkout(
      type,
      'fullgym',
      { hasAches: true, painRegion: region, painSeverity: 'mild', energy: 'normal', timeAvailable: '45' },
      profile,
      undefined,
      undefined,
      3
    );
    const rehab = w.filter((e) => e.category === 'prehab');
    strengthScanned += rehab.length;
    for (const ex of rehab) {
      if (ex.id?.startsWith('acute-')) acuteSeen++;
      if (STRETCH_WORDS.test(readable(ex))) strengthHits.push(`${type}/${region} :: ${ex.name}`);
    }
  }
}

check(
  `every strength session has a rehab slot (${strengthScanned} found)`,
  strengthScanned >= REGIONS.length * 3,
  `expected ${REGIONS.length * 3}, saw ${strengthScanned}`
);
check(
  'that slot comes from the acute protocol',
  acuteSeen === strengthScanned,
  `${strengthScanned - acuteSeen} came from somewhere else`
);
check(
  'and it is not a stretch of the muscle the user just reported',
  strengthHits.length === 0,
  [...new Set(strengthHits)].slice(0, 8).join(' | ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[3] Every protocol carries the pain rule');
// ─────────────────────────────────────────────────────────────────────────────

const missingRule = [];
const missingHelp = [];
for (const region of REGIONS) {
  const d = ACUTE_PROTOCOL_NOTES[region]?.disclaimer ?? '';
  // The threshold, spelled out. "2/10" and "2 out of 10" both count; a
  // disclaimer that says "listen to your body" and nothing else does not.
  if (!/\b2\s*(?:\/|out of)\s*10\b/i.test(d)) missingRule.push(region);
  // And what to do when it is worse than that.
  if (!/stop|seek|assess|physio|doctor|gp\b/i.test(d)) missingHelp.push(region);
}

check(
  `all ${REGIONS.length} protocols state the 0-2/10 threshold`,
  missingRule.length === 0,
  missingRule.join(', ')
);
check(
  'all of them say what to do if it hurts more than that',
  missingHelp.length === 0,
  missingHelp.join(', ')
);
check(
  'the shared one-line rule states it too',
  /\b2\s*(?:\/|out of)\s*10\b/i.test(PAIN_FREE_RULE),
  PAIN_FREE_RULE
);
// The shared rule is what a user sees when they report TWO OR MORE sore areas —
// there is no single protocol to quote, so the app falls back to this. It used
// to stop at "it should settle as soon as you stop", dropping the escalation
// advice that all twenty per-region disclaimers carry. The person reporting more
// pain was getting less guidance, which is exactly backwards.
check(
  'and the shared rule says what to do if it hurts more than that',
  /stop|seek|assess|physio|doctor|gp\b/i.test(PAIN_FREE_RULE),
  PAIN_FREE_RULE
);
check(
  'every protocol says what it deliberately leaves out',
  REGIONS.every((r) => (ACUTE_PROTOCOL_NOTES[r]?.avoid ?? []).length >= 3),
  REGIONS.filter((r) => (ACUTE_PROTOCOL_NOTES[r]?.avoid ?? []).length < 3).join(', ')
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[4] The rule reaches the screen, and cannot be dismissed');
// ─────────────────────────────────────────────────────────────────────────────

const sessionSrc = readFileSync(new URL('../app/session.tsx', import.meta.url), 'utf8');

check(
  'the session screen renders the pain-free banner',
  /<PainFreeRangeBanner\b[\s\S]{0,240}?text=\{painFreeText\}/.test(sessionSrc),
  'the banner is not on the screen'
);
check(
  'it appears whenever the session actually contains acute work',
  /exercises\.some\(\(ex\) => ex\.id\?\.startsWith\('acute-'\)\)/.test(sessionSrc),
  'the trigger must be read off the exercises, not re-derived from the pain inputs'
);
/**
 * IT COLLAPSES. IT DOES NOT DISAPPEAR.
 *
 * This check used to require no dismiss control at all, on the grounds that the
 * pain rule sets the dose for everything under it and is not a notification.
 * That reasoning still holds and is why the rule below is what it is; what
 * changed is that the banner also sat above the exercise list for a whole
 * session on a 4.7-inch phone, and was reported as making the screen unusable:
 * "needs to be able to be closed. currently you cant press X to get rid of it,
 * leading to a really cluttered screen".
 *
 * Both things are true, so the close button shrinks it to a single line instead
 * of removing it. The bulk goes and the sentence stays. What this section
 * protects is that nothing turns that back into a real dismissal, because the
 * acute exercises carry technique cues and not the rule: if this line goes, the
 * pain limit is nowhere on the screen it governs.
 */
const painFreeComponent = sessionSrc.slice(
  sessionSrc.indexOf('export function PainFreeRangeBanner'),
  sessionSrc.indexOf('function RestoreFailedBanner')
);

check(
  'the pain-free banner component was found',
  painFreeComponent.length > 400,
  'it has moved and this section is checking nothing'
);
check(
  'being dismissed never removes it from the screen',
  !/if \(!text \|\| dismissed\) return null;/.test(painFreeComponent) &&
    /if \(!text\) return null;/.test(painFreeComponent),
  'returning null on dismiss takes the only statement of the pain limit off the screen'
);
check(
  'dismissing collapses it to a line that still names the rule',
  /pain-free-range-banner-collapsed/.test(painFreeComponent) &&
    /if \(dismissed\) \{/.test(painFreeComponent),
  ''
);
check(
  'and the collapsed line can be opened again',
  /onRestore/.test(painFreeComponent) &&
    /onRestore=\{\(\) => setPainFreeBannerDismissed\(false\)\}/.test(sessionSrc),
  'collapsing something with no way back is a dismissal with extra steps'
);
check(
  'the rule itself still appears in full somewhere on the screen',
  /\{text\}/.test(painFreeComponent),
  ''
);
check(
  'it falls back to the shared rule when several regions hurt',
  /return PAIN_FREE_RULE;/.test(sessionSrc),
  ''
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[5] Stretching still exists — this was routing, not deletion');
// ─────────────────────────────────────────────────────────────────────────────
// Without this, a change that simply removed every stretch from the app would
// pass all of the above. Flexibility work is good and is still prescribed; what
// changed is that a sore region no longer routes to it.

const flex = generateWorkout(
  'flexibility',
  'bodyweight',
  { hasAches: false, energy: 'normal', timeAvailable: '30' },
  profile,
  undefined,
  undefined,
  3
);
const flexStretches = flex.filter((e) => STRETCH_WORDS.test(readable(e)));
check(
  `the flexibility session still prescribes stretching (${flexStretches.length} of ${flex.length})`,
  flexStretches.length >= 3,
  'stretching was removed from the app rather than routed away from injuries'
);

const maintenance = getRegionPrehabWorkout('hamstrings');
check(
  'and the maintenance list for a region is untouched',
  maintenance.some((e) => STRETCH_WORDS.test(readable(e))),
  'the non-acute path should still be the flexibility-led work it always was'
);

// The route back. Someone six weeks into a rehab block is not injured today and
// should not be stuck on the acute protocol forever — the Restore tab asks, and
// answering "feels fine" has to actually reach the fuller work.
const settled = generateWorkout(
  'prehab',
  'bodyweight',
  {
    hasAches: true,
    painRegion: 'hamstrings',
    acute: false,
    energy: 'normal',
    timeAvailable: '45',
  },
  profile,
  undefined,
  undefined,
  3
);
check(
  'answering "feels fine" reaches the fuller maintenance session',
  settled.some((e) => STRETCH_WORDS.test(readable(e))),
  'there must be a way out of the acute protocol once the area has settled'
);
check(
  'and it is a longer session than the acute one',
  settled.length > targetedSession('hamstrings').length,
  `${settled.length} vs ${targetedSession('hamstrings').length}`
);
check(
  'while the acute list for the same region has none of it',
  !getRegionPrehabWorkout('hamstrings', { acute: true }).some((e) =>
    STRETCH_WORDS.test(readable(e))
  ),
  ''
);
check(
  'the single-exercise accessor splits the same way',
  STRETCH_WORDS.test(readable(getRegionPrehabExercise('hamstrings'))) &&
    !STRETCH_WORDS.test(readable(getRegionPrehabExercise('hamstrings', { acute: true }))),
  'getRegionPrehabExercise is the one the strength sessions call'
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[6] Every region has a real protocol, and the exported map matches');
// ─────────────────────────────────────────────────────────────────────────────

const thin = REGIONS.filter((r) => (ACUTE_PREHAB_BY_REGION[r] ?? []).length < 4);
check(
  `all ${REGIONS.length} regions have at least 4 exercises`,
  thin.length === 0,
  thin.join(', ')
);

// Effort is prescribed as a fraction rather than a weight, because in the first
// days after a strain the correct load is whatever does not hurt. At least one
// exercise per protocol has to actually say so.
const noEffortCue = REGIONS.filter(
  (r) =>
    !ACUTE_PREHAB_BY_REGION[r].some((e) =>
      /(?:a )?(?:third|quarter|half)(?: of)? (?:your |my )?(?:effort|strength|hardest)|about half effort|submaximal/i.test(
        e.cue
      )
    )
);
check(
  'every protocol prescribes effort as a fraction, not a weight',
  noEffortCue.length === 0,
  noEffortCue.join(', ')
);

let map = null;
try {
  map = JSON.parse(readFileSync(new URL('../ACUTE-REHAB-MAP.json', import.meta.url), 'utf8'));
} catch (e) {
  // reported by the check below
}
check('ACUTE-REHAB-MAP.json exists', map !== null, 'run `npm run acute-map`');

if (map) {
  const mapRegions = map.injurySites.map((s) => s.region);
  check(
    'the exported map covers every region',
    REGIONS.every((r) => mapRegions.includes(r)),
    REGIONS.filter((r) => !mapRegions.includes(r)).join(', ')
  );

  const drifted = [];
  for (const site of map.injurySites) {
    const live = (ACUTE_PREHAB_BY_REGION[site.region] ?? []).map((e) => e.name).join('|');
    const exported = site.replacement.map((e) => e.exercise).join('|');
    if (live !== exported) drifted.push(site.region);
  }
  check(
    'and matches the code exactly',
    drifted.length === 0,
    `${drifted.join(', ')} — run \`npm run acute-map\``
  );

  const withdrawn = map.injurySites.reduce((n, s) => n + s.withdrawn.length, 0);
  check(
    `it records what was withdrawn and why (${withdrawn} entries)`,
    withdrawn >= 40,
    'a mapping table with no "before" column cannot be checked against the problem'
  );
}

// The rules in prose, for the person who owns the app and does not read code.
// Generated from the same source as the JSON, so the two cannot disagree.
let rules = '';
try {
  rules = readFileSync(new URL('../PREHAB-SAFETY-RULES.md', import.meta.url), 'utf8');
} catch {
  // reported below
}
check('PREHAB-SAFETY-RULES.md exists', rules.length > 0, 'run `npm run acute-map`');
if (rules) {
  check(
    'it states the pain rule',
    /\b2 out of 10\b/.test(rules),
    'the one instruction that makes the rest safe'
  );
  check(
    'it names every injury site',
    REGIONS.every((r) => rules.includes(`### ${ACUTE_PROTOCOL_NOTES[r].plainName}`)),
    REGIONS.filter((r) => !rules.includes(`### ${ACUTE_PROTOCOL_NOTES[r].plainName}`)).join(', ')
  );
  check(
    'and lists both what is given and what is withheld',
    /\*\*Given instead:\*\*/.test(rules) && /\*\*Withheld, and why:\*\*/.test(rules),
    ''
  );
}

console.log('');
if (failures > 0) {
  console.error(`acute-rehab: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`acute-rehab: all ${total} checks passed\n`);
  process.exitCode = 0;
}
