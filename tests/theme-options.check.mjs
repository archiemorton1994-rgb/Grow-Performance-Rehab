/**
 * Contract test: the app has two looks, and nobody is left holding the third.
 *
 * WHY THIS EXISTS
 * ───────────────
 * There used to be a third theme, called "System" in settings and "Match my
 * phone" in the builder, which followed the device's colour scheme. Archie's
 * call: to the person using it, it looks the same as Light, so it is a button
 * that buys nothing. It is gone.
 *
 * Removing an option that was PERSISTED is the dangerous half. The value is
 * already on thousands of devices. Take the branch out of useColors without
 * converting the stored value and the code falls through to its last case,
 * which is Dark: somebody who picked "Match my phone" on a light-scheme phone
 * opens the app after the update and it is black. They never chose that, and
 * the control that would explain it is no longer on screen.
 *
 * So the value is converted, to LIGHT rather than Dark, and this file holds
 * every boundary where a stale one can still arrive:
 *
 *   1. PERSISTED STATE. The real store is rehydrated from a real
 *      previous-version blob, through the real migrate().
 *   2. THE VERSION BUMP. A migration that runs is a version above the one
 *      already in the wild. 33 shipped; if the number had not moved, migrate()
 *      would never be called on an upgrading device and every assertion here
 *      would be describing code that never runs. That is exactly how
 *      dataOwnerId wiped people (see tests/sync-safety.check.mjs).
 *   3. THE SETTER. Nothing can put 'system' back by calling the store.
 *   4. A SYNCED PAYLOAD. themePreference is deliberately not part of
 *      SyncPayload today, so this asserts the rule rather than the wiring: a
 *      server copy written by an older build may still say 'system', and
 *      merging one must never leave the store holding it. If the field is ever
 *      added to the payload without normalising, this fails.
 *   5. THE OPTIONS THEMSELVES. The settings row and the builder's "Choose your
 *      look" question both draw from THEME_OPTIONS, and every value it offers
 *      has to be one the store keeps unchanged.
 *
 * NOTHING HERE READS THE SOURCE FOR A SPELLING. Every assertion runs the
 * shipped code: the real persist migration, the real setter, the real
 * mergeServerData, and the real arrays the screens map over.
 *
 * Run:  npx tsx tests/theme-options.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

globalThis.__DEV__ = false;

import './_persist-shim.mjs';
import { useAppStore } from '../lib/store.ts';
import {
  THEME_OPTIONS,
  DEFAULT_THEME_PREFERENCE,
  normaliseThemePreference,
} from '../lib/theme-options.ts';
import { PROFILE_TREE } from '../lib/profile-tree.ts';

let passed = 0;
let failed = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    if (detail) console.log(`      ${detail}`);
    failed++;
  }
}

const STORAGE_KEY = 'grow-app-storage';

/**
 * Put a real persisted blob where the store looks for one and load it the way
 * a cold start does: version compare, migrate(), merge. Returns the theme the
 * app would be painting.
 */
async function rehydrateWith(state, version) {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState().themePreference;
}

const BASE = { onboardingComplete: true, completedSessions: [], earnedBadges: [] };

// ─── 1. The stored value ─────────────────────────────────────────────────────
console.log('\n[1] A device that chose "Match my phone" comes back on Light');

const SHIPPED_VERSION = 33; // the last version released with three themes

check(
  'a previous-version device holding the retired theme rehydrates as light',
  (await rehydrateWith({ ...BASE, themePreference: 'system' }, SHIPPED_VERSION)) === 'light',
  'it came back as ' +
    useAppStore.getState().themePreference +
    '; falling through to dark turns the app black under somebody who never asked for it'
);

const staleVersions = [0, 1, 20, 28, SHIPPED_VERSION];
const missed = [];
for (const v of staleVersions) {
  const got = await rehydrateWith({ ...BASE, themePreference: 'system' }, v);
  if (got !== 'light') missed.push(`v${v} -> ${got}`);
}
check(
  'from every older version, not just the most recent one',
  missed.length === 0,
  missed.join(' | ') + '; a migration gated on one version number strands everyone else'
);

check(
  'a device already on dark is left on dark',
  (await rehydrateWith({ ...BASE, themePreference: 'dark' }, SHIPPED_VERSION)) === 'dark',
  'the migration is changing a choice it was not asked to touch'
);
check(
  'a device already on light is left on light',
  (await rehydrateWith({ ...BASE, themePreference: 'light' }, SHIPPED_VERSION)) === 'light',
  'the migration is changing a choice it was not asked to touch'
);

// Seeded to the wrong answer first, so "it came back dark" cannot be the value
// that was already sitting there.
useAppStore.setState({ themePreference: 'light' });
check(
  'a device from before the field existed still gets the dark default',
  (await rehydrateWith({ ...BASE }, 1)) === DEFAULT_THEME_PREFERENCE &&
    DEFAULT_THEME_PREFERENCE === 'dark',
  'new and very old installs open on Dark; the default is ' + DEFAULT_THEME_PREFERENCE
);

// And the same conversion inside a builder somebody was halfway through when
// the update arrived. Their saved answer is to a question that no longer offers
// it, so on resume the screen would draw nothing as chosen.
await rehydrateWith(
  { ...BASE, themePreference: 'system', onboardingDraft: { treeAnswers: { look: 'system' } } },
  SHIPPED_VERSION
);
check(
  'a half-finished builder has its saved look converted too',
  useAppStore.getState().onboardingDraft?.treeAnswers?.look === 'light',
  'the draft still answers ' +
    useAppStore.getState().onboardingDraft?.treeAnswers?.look +
    '; the builder would resume on a question with nothing highlighted'
);
await rehydrateWith(
  { ...BASE, onboardingDraft: { treeAnswers: { look: 'dark', units: 'kg' } } },
  SHIPPED_VERSION
);
check(
  'and a draft that answered dark keeps its answer, with the rest of it intact',
  useAppStore.getState().onboardingDraft?.treeAnswers?.look === 'dark' &&
    useAppStore.getState().onboardingDraft?.treeAnswers?.units === 'kg',
  'the draft is now ' + JSON.stringify(useAppStore.getState().onboardingDraft?.treeAnswers)
);

// ─── 2. The version bump ─────────────────────────────────────────────────────
console.log('\n[2] And the migration is actually reached');

const storeVersion = useAppStore.persist.getOptions().version;
check(
  'the persist version is above the one that shipped with three themes',
  typeof storeVersion === 'number' && storeVersion > SHIPPED_VERSION,
  `version is ${storeVersion}; migrate() only runs when the stored number is lower, so without the bump none of section 1 happens on a real phone`
);

// ─── 3. The setter ───────────────────────────────────────────────────────────
console.log('\n[3] Nothing can put the retired theme back');

useAppStore.getState().setThemePreference('system');
check(
  'setting the retired theme leaves the store on light',
  useAppStore.getState().themePreference === 'light',
  'the store is holding ' + useAppStore.getState().themePreference
);
for (const { value } of THEME_OPTIONS) {
  useAppStore.getState().setThemePreference(value);
  check(
    `choosing ${value} in settings is the theme the app then paints`,
    useAppStore.getState().themePreference === value,
    'an option the screen offers that the store will not keep is a control that does not work'
  );
}

// ─── 4. A payload from an older build ────────────────────────────────────────
console.log('\n[4] A synced copy written by an older build cannot restore it');

const serverSessions = [
  { id: 'S1', date: '2026-01-01', type: 'strength', exerciseLogs: [] },
  { id: 'S2', date: '2026-01-03', type: 'strength', exerciseLogs: [] },
];
for (const local of ['dark', 'light']) {
  useAppStore.setState({
    themePreference: local,
    completedSessions: [],
    completedCount: 0,
    resetPendingUpload: false,
  });
  useAppStore.getState().mergeServerData({
    completedSessions: serverSessions,
    themePreference: 'system',
  });
  const after = useAppStore.getState().themePreference;
  check(
    `merging a server copy that says 'system' over a ${local} device does not leave it on 'system'`,
    after === 'dark' || after === 'light',
    `the store is holding ${after}; useColors has no branch for it and the app would paint dark`
  );
  check(
    `and the ${local} device keeps its own look, because the theme is per device`,
    after === local,
    `it became ${after}; the look is not in SyncPayload, so nothing should be adopting it`
  );
}

// ─── 5. The options the screens offer ────────────────────────────────────────
console.log('\n[5] The buttons on screen');

const settingsValues = THEME_OPTIONS.map((o) => o.value);
check(
  'settings offers exactly dark and light',
  settingsValues.length === 2 &&
    settingsValues.includes('dark') &&
    settingsValues.includes('light'),
  'it offers ' + settingsValues.join(', ')
);
check(
  'and no retired theme among them',
  !settingsValues.includes('system'),
  'the option is still on screen'
);
check(
  'every option has a label to draw',
  THEME_OPTIONS.every((o) => typeof o.label === 'string' && o.label.trim().length > 0),
  'a button with no words on it'
);

const lookNode = PROFILE_TREE.find((n) => n.id === 'look');
check(
  'the builder still asks for a look',
  !!lookNode && Array.isArray(lookNode.options),
  'the "Choose your look" question has gone missing entirely'
);
const builderValues = (lookNode?.options ?? []).map((o) => o.value);
check(
  'the builder offers the same two, in the same order',
  builderValues.join(',') === settingsValues.join(','),
  `builder offers ${builderValues.join(', ')} and settings offers ${settingsValues.join(', ')}; two lists drift`
);
check(
  'so the builder cannot write a look the store would have to convert',
  builderValues.every((v) => normaliseThemePreference(v) === v),
  'an answer the builder can give that does not survive being stored'
);

console.log(`\n${passed}/${passed + failed} passed`);
process.exitCode = failed === 0 ? 0 : 1;
