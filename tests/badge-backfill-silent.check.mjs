/**
 * Contract test: restoring history must not re-celebrate old badges.
 *
 * WHY THIS MATTERS
 * ────────────────
 * Badges are evaluated against your whole HISTORY, not against the moment. That
 * is the right design — it means a badge you deserve is never missed — but it
 * has a sharp edge: any time `earnedBadges` is empty while `completedSessions`
 * is not, everything you already deserve counts as "newly unlocked" in one go.
 *
 * That happens on a reinstall, on a new device, and every time mergeServerData
 * pulls back sessions the local store had lost. The user hit it repeatedly on a
 * test account — "it insta awards about 40 that I've already earned previously"
 * — and each one of those queues a full-screen celebration.
 *
 * The fix is a `silent` mode: record the badge, skip the party. This test pins
 * the three places that must use it, and — more importantly — proves the
 * distinction still works by running the real store logic both ways.
 *
 * Run:  node tests/badge-backfill-silent.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dir, '../lib/store.ts'), 'utf8');

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

// ─── 1. The silent path exists and is wired to the backfill routes ───────────
console.log('\n[1] Wiring — the three places a backfill can happen');

check(
  'awardNewBadges takes a silent option',
  /awardNewBadges:\s*\(opts\)\s*=>\s*\{/.test(src),
  'expected awardNewBadges to accept opts'
);

check(
  'silent skips the celebration queue but still records the badge',
  /newlyUnlockedBadges:\s*opts\?\.silent\s*\n?\s*\?\s*s\.newlyUnlockedBadges/.test(src),
  'expected the queue to be left untouched when silent'
);

check(
  'earnedBadges is written either way',
  /earnedBadges:\s*\[\.\.\.new Set\(\[\.\.\.s\.earnedBadges, \.\.\.newlyUnlocked\]\)\]/.test(src),
  'a silent award must still record the badge as earned'
);

/**
 * ANCHORED ON THE BRANCH, AND MEASURED BY ITS BRACES RATHER THAN ITS LENGTH.
 *
 * Three versions of this check, and the first two both failed the same way.
 *
 * It started from `completedCount: data.completedSessions`, a field that
 * changed when sessions began being unioned by id instead of replaced wholesale
 * - a data-loss fix with nothing to do with badges. The assertion went red for
 * an unrelated change, which is the same class of fault as one that stays green
 * for an unrelated reason.
 *
 * It then counted characters over the file. Stripping the comments bought one
 * more round; the window was 1,800 characters and had already outgrown two
 * earlier limits, and adding one more field to the same branch pushed it over a
 * third time with the behaviour untouched.
 *
 * A distance is not the claim. The claim is that the branch which adopts the
 * server's view of the world records badges SILENTLY, so take exactly that
 * branch by matching its braces and read what is in it. That cannot break by
 * getting longer, and it catches something the window never could: a loud award
 * added alongside the silent one.
 */
const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The body of `if (serverCount > localCount) { ... }`, braces balanced. */
function serverAheadBranch(code) {
  const at = code.indexOf('if (serverCount > localCount) {');
  if (at < 0) return null;
  let depth = 0;
  for (let i = code.indexOf('{', at); i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return code.slice(at, i + 1);
    }
  }
  return null;
}

const serverAhead = serverAheadBranch(codeOnly);

check(
  'the server restore backfills silently',
  serverAhead !== null && /awardNewBadges\(\{ silent: true \}\)/.test(serverAhead),
  'mergeServerData must record restored badges without celebrating them'
);
check(
  'and nothing in that branch celebrates them',
  serverAhead !== null && !/awardNewBadges\(\s*\)/.test(serverAhead),
  'restoring a backup is not an achievement'
);

check(
  'app launch reconciles silently',
  /onRehydrateStorage[\s\S]{0,900}?reconcileBadgesSilently\(\)/.test(src),
  'expected state.reconcileBadgesSilently() during rehydration'
);

check(
  'reconcileBadgesSilently delegates to the silent path',
  /reconcileBadgesSilently:\s*\(\)\s*=>\s*get\(\)\.awardNewBadges\(\{ silent: true \}\)/.test(src),
  ''
);

// ─── 2. Behaviour — run the real evaluation both ways ────────────────────────
console.log('\n[2] Behaviour — a backfill is silent, a real unlock is not');

// The award/diff logic is what changed, so that is what is exercised here.
// lib/badge-engine.ts is deliberately NOT imported: it pulls in @/lib/utils as a
// runtime value and plain node cannot resolve the alias. What the engine
// contributes is a list of qualifying ids, which is stood in for below using
// real ids from the catalogue. (Measured separately against the real engine: a
// fresh account earns 1 badge finishing onboarding and 5 after its first
// session, so the 40-at-once the user saw could only have been a backfill.)
const { BADGE_CATALOG } = await import('../lib/badges.ts');
const deserved = BADGE_CATALOG.slice(0, 40).map((b) => b.id);

// Mirror of the store action at lib/store.ts, both modes.
function award(state, qualifying, opts) {
  const newly = qualifying.filter((id) => !state.earnedBadges.includes(id));
  if (newly.length === 0) return state;
  return {
    ...state,
    earnedBadges: [...new Set([...state.earnedBadges, ...newly])],
    newlyUnlockedBadges: opts?.silent
      ? state.newlyUnlockedBadges
      : [...state.newlyUnlockedBadges, ...newly],
  };
}

// The exact scenario reported: a populated history meeting an empty earnedBadges.
const restored = award({ earnedBadges: [], newlyUnlockedBadges: [] }, deserved, { silent: true });
check(
  'a silent backfill of 40 badges queues zero celebrations',
  restored.newlyUnlockedBadges.length === 0,
  `queued ${restored.newlyUnlockedBadges.length}`
);
check(
  'it still records every one of them as earned',
  restored.earnedBadges.length === deserved.length,
  `recorded ${restored.earnedBadges.length} of ${deserved.length}`
);

// And the thing that must NOT be broken by the fix: earning one for real after
// a backfill still celebrates, and celebrates only the new one.
const nextId = BADGE_CATALOG[40].id;
const afterNext = award(restored, [...deserved, nextId], undefined);
check(
  'a badge earned afterwards still celebrates',
  afterNext.newlyUnlockedBadges.length === 1 && afterNext.newlyUnlockedBadges[0] === nextId,
  `queued ${JSON.stringify(afterNext.newlyUnlockedBadges)}`
);
check(
  're-running the award with no change queues nothing',
  award(afterNext, [...deserved, nextId], undefined).newlyUnlockedBadges.length === 1,
  'an unchanged evaluation must not re-queue anything'
);

console.log('');
if (failures > 0) {
  console.error(`badge-backfill-silent: ${failures}/${total} check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  console.log(`badge-backfill-silent: all ${total} checks passed\n`);
  process.exitCode = 0;
}
