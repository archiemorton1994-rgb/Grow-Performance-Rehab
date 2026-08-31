/**
 * Contract test: the answers a user gives are kept, and the ones that would
 * break the app are refused out loud.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Two promises, both about the numbers and choices a person types into this app.
 *
 * 1. "I answered eight questions" has to survive a reload. Every answer in
 *    onboarding used to live in component state and be written only by the final
 *    step, so a refresh on step nine — routine on web, and exactly what a
 *    backgrounded phone amounts to once the OS evicts the app — dropped the lot
 *    and reopened on the welcome screen with factory defaults. Nobody fills in an
 *    eight-step form twice.
 *
 *    The dangerous fix is one that saves the draft somewhere the rest of the app
 *    mistakes for a finished profile. `onboardingComplete` is what the gate in
 *    app/_layout.tsx routes on, and a half-finished answer sheet must never make
 *    it true.
 *
 * 2. "75 kg" and "9999 kg" cannot both be accepted in silence. Bodyweight scales
 *    the whole load heuristic and a 1RM sets the working weight directly, so a
 *    stray digit does not produce a slightly-off session — it produces one the
 *    session screen then REFUSES to log, because that has its own 500 kg
 *    plausibility ceiling. The app prescribes a weight and then rejects it, and
 *    nothing on screen connects the two.
 *
 * HOW IT TESTS
 * ────────────
 * By running the shipped code, not by reading it. The validators and the store
 * actions are lifted out of the real source files, compiled, and executed against
 * the exact values from the bug report (9999, 0.0001, 1e5, 10000). Every
 * extraction throws loudly if the code it is looking for has moved, so this file
 * cannot quietly degrade into checking nothing.
 *
 * Run:  node tests/onboarding-answers.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dir, '..', p), 'utf8');
const storeSrc = read('lib/store.ts');
const onboardingSrc = read('app/onboarding.tsx');
const bodyweightSrc = read('lib/bodyweight.ts');
const utilsSrc = read('lib/utils.ts');
const profileSrc = read('app/(tabs)/profile.tsx');
const layoutSrc = read('app/_layout.tsx');

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

// ─── Lifting real code out of real files ─────────────────────────────────────
// A missing marker is a hard error, never a skipped check: a probe that reads
// nothing and reports success is worse than no probe at all.

/** The block starting at `marker`, brace-matched to its close. */
function extractBlock(src, marker, label) {
  const start = src.indexOf(marker);
  if (start === -1) {
    throw new Error(`cannot find ${label}: no "${marker}" in the source. This check verifies nothing until that is fixed.`);
  }
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced braces extracting ${label}`);
}

/** The single line starting at `marker`, trailing comma and all. */
function extractLine(src, marker, label) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`cannot find ${label}: no "${marker}" in the source.`);
  return src.slice(start, src.indexOf('\n', start)).trim();
}

/** TypeScript in, runnable JavaScript out. */
const toJs = (tsText) =>
  ts.transpileModule(tsText, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;

// ─── 1. The numbers the load maths multiplies by ─────────────────────────────
console.log('\n[1] Bounds exist, and are the ones the rest of the app agrees with');

const boundsSrc = ['MIN_BODYWEIGHT_KG', 'MAX_BODYWEIGHT_KG', 'MIN_ONE_REP_MAX_KG', 'MAX_ONE_REP_MAX_KG']
  .map((name) => extractLine(storeSrc, `export const ${name} =`, name).replace('export ', ''))
  .join('\n');
const bounds = new Function(`${boundsSrc}\nreturn { MIN_BODYWEIGHT_KG, MAX_BODYWEIGHT_KG, MIN_ONE_REP_MAX_KG, MAX_ONE_REP_MAX_KG };`)();

check(
  `bodyweight is bounded (${bounds.MIN_BODYWEIGHT_KG}-${bounds.MAX_BODYWEIGHT_KG} kg)`,
  bounds.MIN_BODYWEIGHT_KG > 0 && bounds.MAX_BODYWEIGHT_KG > bounds.MIN_BODYWEIGHT_KG,
  ''
);
check(
  `a one-rep max is bounded (${bounds.MIN_ONE_REP_MAX_KG}-${bounds.MAX_ONE_REP_MAX_KG} kg)`,
  bounds.MIN_ONE_REP_MAX_KG > 0 && bounds.MAX_ONE_REP_MAX_KG > bounds.MIN_ONE_REP_MAX_KG,
  ''
);

// The session bar refuses to log anything above MAX_PLAUSIBLE_KG. If onboarding
// accepts a 1RM above that, the app can prescribe a weight its own logger will
// not take — the exact dead end this fix exists to close.
const sessionCeiling = Number(
  (read('app/session.tsx').match(/const MAX_PLAUSIBLE_KG = (\d+);/) ?? [])[1]
);
check(
  `the 1RM ceiling does not exceed what a set can be logged at (${sessionCeiling} kg)`,
  Number.isFinite(sessionCeiling) && bounds.MAX_ONE_REP_MAX_KG <= sessionCeiling,
  `1RM ceiling ${bounds.MAX_ONE_REP_MAX_KG} vs session bar ceiling ${sessionCeiling}`
);

// ─── 2. Onboarding refuses absurd entries, and says what is wrong ────────────
console.log('\n[2] Onboarding says what is wrong with a number it will not take');

// The screens' own "is this a number a human typed" rule, lifted with them —
// rejecting "1e5" is half of what is being tested here.
// bodyweightIssue moved to lib/bodyweight.ts, shared by onboarding and Profile.
// There used to be two copies and they had drifted: Profile's understood kg and
// lbs, onboarding's assumed kg - so "176" typed by a US user during onboarding
// was read as 176 KILOS and refused as implausible, while the same number in
// Profile was accepted as 80 kg. It takes a unit now, so this does too.
const onboardingNumber = extractLine(bodyweightSrc, 'export const TYPED_NUMBER =', 'TYPED_NUMBER').replace('export ', '');
const LB_PER_KG_LINE = extractLine(utilsSrc, 'const LB_PER_KG =', 'LB_PER_KG');
const conversions = ['kgToDisplayUnit', 'displayUnitToKg']
  .map((name) => toJs(extractBlock(utilsSrc, `export function ${name}(`, name).replace('export ', '')))
  .join('\n');
const bodyweightIssueRaw = new Function(
  `${toJs(boundsSrc)}
${LB_PER_KG_LINE}
${conversions}
${onboardingNumber}
${toJs(extractBlock(bodyweightSrc, 'export function bodyweightIssue(', 'bodyweightIssue').replace('export ', ''))}
return bodyweightIssue;`
)();
/** The onboarding case: kilograms, the default and what these inputs mean. */
const bodyweightIssue = (text) => bodyweightIssueRaw(text, 'kg');
/**
 * IMPORTED, not extracted.
 *
 * It used to be pulled out of app/onboarding.tsx by name and evaluated, because
 * that file imports react-native and cannot be imported under tsx. So this was
 * testing a COPY of the function, and it broke the moment the function moved.
 *
 * It now lives in lib/one-rep-max-input.ts with no React Native import in it,
 * which means this runs the real thing.
 */
const { oneRepMaxIssue } = await import('../lib/one-rep-max-input.ts');

// The exact values from the bug report, plus the ones a real person types.
const REJECTED_BW = ['9999', '0.0001', '1e5', '100000', '0', '-5', 'abc', ''];
const ACCEPTED_BW = ['75', '82.5', '60', String(bounds.MIN_BODYWEIGHT_KG), String(bounds.MAX_BODYWEIGHT_KG)];

for (const input of REJECTED_BW) {
  check(`bodyweight "${input}" is refused`, bodyweightIssue(input) !== null, 'it was accepted');
}
for (const input of ACCEPTED_BW) {
  const issue = bodyweightIssue(input);
  check(`bodyweight "${input}" is accepted`, issue === null, `refused with: ${issue}`);
}

// "Refused" is only half the fix. The complaint was a button that greys out with
// no explanation, so an out-of-range value has to be told the range.
const tooHigh = bodyweightIssue('9999') ?? '';
check(
  'the message for an out-of-range bodyweight names the range',
  tooHigh.includes(String(bounds.MIN_BODYWEIGHT_KG)) && tooHigh.includes(String(bounds.MAX_BODYWEIGHT_KG)),
  `said: "${tooHigh}"`
);
check(
  'it explains why the number matters, not just that it is wrong',
  /starting weights|loads|sessions/i.test(tooHigh),
  `said: "${tooHigh}"`
);

check('a blank best lift is still allowed (the step is optional)', oneRepMaxIssue('') === null, '');
check('a blank-with-spaces best lift is still allowed', oneRepMaxIssue('   ') === null, '');
for (const input of ['10000', '1e4', String(bounds.MAX_ONE_REP_MAX_KG + 1), '0']) {
  check(`a ${input} kg one-rep max is refused`, oneRepMaxIssue(input) !== null, 'it was accepted');
}
for (const input of ['140', '100', String(bounds.MAX_ONE_REP_MAX_KG)]) {
  const issue = oneRepMaxIssue(input);
  check(`a ${input} kg one-rep max is accepted`, issue === null, `refused with: ${issue}`);
}
const ormTooHigh = oneRepMaxIssue('10000') ?? '';
check(
  'the message for an out-of-range best lift names the range',
  ormTooHigh.includes(String(bounds.MIN_ONE_REP_MAX_KG)) && ormTooHigh.includes(String(bounds.MAX_ONE_REP_MAX_KG)),
  `said: "${ormTooHigh}"`
);

// A validator nothing consults is decoration. In the tree there is one gate,
// issueFor, and one place the message is drawn, so what has to be proved is
// that every typed question is routed through it and that nothing can advance
// while it has something to say.
const builder = read('components/ProfileTree.tsx');

check(
  'the bodyweight answer is put through its validator',
  /bodyweightIssue\(t, weightUnit\)/.test(builder),
  'and blank has to pass, because the question is optional'
);
check(
  'a blank bodyweight is still allowed through',
  /t\.trim\(\) === '' \? null : bodyweightIssue/.test(builder),
  'nobody should have to type their weight to use the app'
);
check(
  'every best-lift box is put through its validator, not just the first',
  /for \(const f of node\.subFields\) \{[\s\S]{0,180}?oneRepMaxIssue\(String\(answers\[f\.key\]/.test(
    builder
  ),
  'it used to return true unconditionally, so 10000 kg reached the store'
);
check(
  'and the age answer too, which is a question the pager never asked',
  /if \(node\.id === 'age'\) return ageIssue/.test(builder),
  'a new question with no validator is the old bug with a new name'
);
check(
  'nothing advances while any of them has something to say',
  /issueFor\(focusNode\) === null &&/.test(builder),
  'canAdvance has to consult the validator, or the gate is decoration'
);
check(
  'and the message is rendered, not just computed',
  /issue={state === 'focus' \? issueFor\(node\) : null}/.test(builder) &&
    /<Text style={styles\.issueText}>{issue}<\/Text>/.test(builder),
  'a validator whose message never reaches the screen is the same silent refusal as before'
);
// ─── 3. The profile screen, in whichever unit the user uses ──────────────────
console.log('\n[3] Editing bodyweight later is held to the same rule');

// The unit conversion is stubbed with the standard factor rather than lifted from
// lib/utils.ts: what is under test here is the bound and its message, not the
// conversion, and this check has no business breaking when that file is edited.
const CONVERSION = `
  function kgToDisplayUnit(kg, unit) { return unit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(1)) : kg; }
  function displayUnitToKg(v, unit) { return unit === 'lbs' ? parseFloat((v / 2.20462).toFixed(2)) : v; }
`;
const profileIssue = new Function(
  `${toJs(boundsSrc)}\n${CONVERSION}\n${extractLine(bodyweightSrc, 'export const TYPED_NUMBER =', 'TYPED_NUMBER').replace('export ', '')}\n${toJs(extractBlock(bodyweightSrc, 'export function bodyweightIssue(', 'bodyweightIssue').replace('export ', ''))}\nreturn bodyweightIssue;`
)();

for (const input of ['9999', '0.0001', '1e5', '0', 'abc']) {
  check(`profile refuses "${input}" kg`, profileIssue(input, 'kg') !== null, 'it was accepted');
}
check('profile accepts 80 kg', profileIssue('80', 'kg') === null, '');
check('profile accepts 176 lbs', profileIssue('176', 'lbs') === null, `refused with: ${profileIssue('176', 'lbs')}`);
check('profile refuses 9999 lbs', profileIssue('9999', 'lbs') !== null, 'it was accepted');

// The message quotes a range in the user's own unit. Converting a kg bound into
// lbs and rounding it the wrong way would name a number that is then refused,
// which is a worse dead end than the one being fixed. So: type the numbers the
// message names, and they must be accepted.
for (const unit of ['kg', 'lbs']) {
  const quoted = (profileIssue('99999', unit) ?? '').match(/\d+(\.\d+)?/g) ?? [];
  check(
    `the ${unit} message names a range that is itself accepted (${quoted.join(' and ')})`,
    quoted.length >= 2 && quoted.every((n) => profileIssue(n, unit) === null),
    `these were named but refused: ${quoted.filter((n) => profileIssue(n, unit) !== null).join(', ')}`
  );
}

check(
  'both bodyweight fields on the profile screen use it',
  /const bwError =[\s\S]{0,160}?bodyweightIssue\(bwText, weightUnit\)/.test(profileSrc) &&
    /const editWeightError =[\s\S]{0,160}?bodyweightIssue\(editWeight, weightUnit\)/.test(profileSrc),
  'the standalone weight modal and the edit-details modal are two separate inputs'
);
check(
  'neither can be saved while it is wrong',
  /disabled=\{bwError !== null\}/.test(profileSrc) &&
    /if \(bwError !== null\) return;/.test(profileSrc) &&
    /if \(!editWeightValid \|\| !editNameValid\) return;/.test(profileSrc),
  ''
);

// ─── 4. The store refuses one too, whoever asks ──────────────────────────────
console.log('\n[4] An impossible bodyweight cannot reach saved state from anywhere');

// Four screens write a bodyweight and only two of them are covered above, so the
// store is the place this has to hold for all of them.
const storeState = {
  userProfile: { name: 'A', sex: 'male', experienceLevel: 'beginner', goals: ['fitness'], bodyweightKg: 80 },
  bodyweightLog: [{ date: '2026-01-01', kg: 80 }],
  bodyweightUpdatedAt: null,
  onboardingComplete: false,
  onboardingDraft: null,
};
const set = (patch) => Object.assign(storeState, typeof patch === 'function' ? patch(storeState) : patch);
const get = () => ({ ...storeState, awardNewBadges: () => {} });
const actions = new Function(
  'set',
  'get',
  `${toJs(boundsSrc)}
   ${toJs(extractBlock(storeSrc, 'function isPlausibleBodyweightKg(', 'isPlausibleBodyweightKg'))}
   return {
     ${extractBlock(storeSrc, 'setUserProfile: (profile) => {', 'setUserProfile')},
     ${extractBlock(storeSrc, 'setOnboardingComplete: (complete) => {', 'setOnboardingComplete')},
     ${extractLine(storeSrc, 'saveOnboardingDraft: (draft) => set(', 'saveOnboardingDraft')}
   };`
)(set, get);

actions.setUserProfile({ bodyweightKg: 100000 });
check(
  'a 100000 kg bodyweight is dropped rather than saved',
  storeState.userProfile.bodyweightKg === 80,
  `it became ${storeState.userProfile.bodyweightKg}`
);
actions.setUserProfile({ name: 'Renamed', bodyweightKg: 9999 });
check(
  'the rest of that same save still lands',
  storeState.userProfile.name === 'Renamed' && storeState.userProfile.bodyweightKg === 80,
  'rejecting one field must not silently discard the others'
);
actions.setUserProfile({ bodyweightKg: 82 });
check(
  'a real bodyweight still saves, and is still logged',
  storeState.userProfile.bodyweightKg === 82 && storeState.bodyweightLog.length === 2,
  `weight=${storeState.userProfile.bodyweightKg} log=${storeState.bodyweightLog.length}`
);

// ─── 5. A half-finished form comes back, and is still half-finished ──────────
console.log('\n[5] A reload does not throw the answers away');

/**
 * WHAT THIS SECTION USED TO CHECK, AND WHY IT NO LONGER CAN.
 *
 * The pager held one useState per answer and saved the draft in an effect, so
 * every answer had to appear in that effect's dependency array or a reload lost
 * it silently. It also cleared the equipment whenever the experience level
 * changed, and that effect ran on mount too, so restoring a draft wiped the
 * equipment it had just restored unless the effect could tell a change from a
 * mount. Three checks guarded those three traps.
 *
 * The tree holds ONE answers object, keyed by question id, and hands the whole
 * thing to the caller on every change. There is no per-answer state to forget,
 * no dependency array to get wrong, and nothing that clears on mount. The traps
 * are gone rather than guarded, which is the better outcome and the reason the
 * old checks are not simply reworded here.
 *
 * What still has to be true is what those checks were protecting.
 */
const builderScreen = read('app/onboarding.tsx');
const builderTree = read('components/ProfileTree.tsx');

check(
  'the builder starts from the saved draft',
  /initialAnswers=\{draft\?\.treeAnswers/.test(builderScreen),
  'an eight-question form that restarts from nothing is a form most people do not fill in twice'
);
check(
  'and the whole answer set is saved on every change, not answer by answer',
  /onAnswersChange\?\.\(next\)/.test(builderTree) &&
    /treeAnswers: answers/.test(builderScreen),
  'saving them one at a time is what let the pager drop the ones nobody remembered to list'
);
check(
  'nothing is cleared when the builder mounts',
  !/useEffect\([\s\S]{0,200}?setAnswers\(\{\}\)/.test(builderTree),
  'the pager cleared equipment on an effect that also ran on mount, so a restore wiped what it had just restored'
);

// The draft is device state, so it has to survive the app being killed.
const partialize = extractBlock(storeSrc, 'partialize: (state) => {', 'partialize');
check(
  'the draft is persisted, not dropped on the way to storage',
  !/onboardingDraft:/.test(partialize),
  'partialize strips the keys listed in it; the draft must not be one of them'
);

// ─── 6. Half-finished must never read as finished ────────────────────────────
console.log('\n[6] A saved draft is not a finished profile');

storeState.onboardingComplete = false;
storeState.onboardingDraft = null;
actions.saveOnboardingDraft({ step: 9, name: 'Half Way', bodyweight: '82' });
check(
  'saving answers mid-flow does not complete onboarding',
  storeState.onboardingComplete === false && storeState.onboardingDraft.name === 'Half Way',
  'the gate in app/_layout.tsx routes on onboardingComplete'
);
check(
  'saving answers mid-flow does not write the profile',
  storeState.userProfile.name === 'Renamed',
  'the draft must stay separate from userProfile until the flow finishes'
);
actions.setOnboardingComplete(true);
check(
  'finishing clears the draft',
  storeState.onboardingComplete === true && storeState.onboardingDraft === null,
  'a leftover draft would restore stale answers over a finished profile'
);
actions.saveOnboardingDraft({ step: 3 });
actions.setOnboardingComplete(false);
check(
  'a device that is wiped back to un-onboarded starts from nothing',
  storeState.onboardingComplete === false,
  ''
);

check(
  'the gate still routes on onboardingComplete alone',
  /if \(!onboardingComplete\) \{/.test(layoutSrc) && !/onboardingDraft/.test(layoutSrc),
  'if the draft could influence routing, a half-filled form could let someone into the app'
);

// ─── What the two optional questions say ─────────────────────────────────────
console.log('\n[Copy on the units and bodyweight questions]');

/**
 * READ OFF THE QUESTION OBJECTS, not off a screen.
 *
 * These four intents were guarded by regexing app/onboarding.tsx, which meant
 * they were really checking where the copy lived. The questions are data now
 * (lib/profile-tree.ts), so the checks run against the thing itself.
 */
const { PROFILE_TREE } = await import('../lib/profile-tree.ts');
const node = (id) => PROFILE_TREE.find((n) => n.id === id);
const units = node('units');
const bw = node('bodyweight');

check(
  'both questions were found, so the checks below mean something',
  !!units && !!bw,
  'the questions have moved and this section has gone blind'
);
check(
  'the unit question gives the choice and leaves it there',
  !/default in the (UK|US)|usually used/i.test(JSON.stringify(units)) &&
    units.options.some((o) => /Kilograms \(kg\)/.test(o.label)) &&
    units.options.some((o) => /Pounds \(lbs\)/.test(o.label)),
  'it explained where each unit is "usually used", which is a geography lesson nobody asked for on a two-option question'
);
check(
  'and still says it can be changed later',
  /change it anytime in settings/i.test(units.hint ?? ''),
  'the one piece of context worth keeping'
);

/**
 * THE BODYWEIGHT QUESTION NO LONGER READS ANYONE THEIR ASSUMED WEIGHT.
 *
 * Skipping still falls back to ASSUMED_BODYWEIGHT_KG internally, because the
 * first session has to start somewhere. Printing that number is a different
 * matter. The people most likely to leave this blank are the ones least likely
 * to want a guess about their weight read back to them, and it is exactly those
 * people the guess will be furthest out for. It was in the placeholder too,
 * sitting in the box before they had typed anything.
 */
check(
  'answering it is optional, and the way past says what skipping means',
  bw.optional === true && (bw.skipLabel ?? '').length > 3,
  'nobody should have to type their weight to use the app'
);
check(
  'it never prints the assumed figure at the user',
  !/\b165|\b75 ?kg|ASSUMED/.test(JSON.stringify(bw)),
  'it said "the app assumes 165.3 lbs", and put the same number in the input as a placeholder'
);
const builderSrc = read('components/ProfileTree.tsx');
check(
  'the placeholder is not a number either',
  /if \(node\.id === 'bodyweight'\) return 'Optional';/.test(builderSrc),
  'a guessed weight sitting in the box is the same problem in a quieter voice'
);
check(
  'and it says what actually happens instead, which is also true',
  /tune your weights from how your first few sessions go/.test(bw.hint ?? ''),
  'starting loads are an opening bid; the answers and the reps are what set the weight'
);
check(
  'the fallback itself is untouched, because a first session needs a number',
  /ASSUMED_BODYWEIGHT_KG/.test(read('lib/bodyweight.ts')),
  'this is about what is said out loud, not about how the app works'
);

console.log('');
if (failures > 0) {
  console.error(`onboarding-answers: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`onboarding-answers: all ${total} checks passed\n`);
  process.exitCode = 0;
}
