/**
 * Contract test: the achievement chime cannot break anything.
 *
 * WHY THIS MATTERS
 * ────────────────
 * This is the app's first native audio dependency, and it exists to play half a
 * second of noise when a badge unlocks. That is the least important thing in the
 * app attached to one of the more fragile kinds of dependency — and this app's
 * recent history is native modules and modals taking the whole screen down. Two
 * separate freeze bugs, both from something incidental breaking something
 * central.
 *
 * So almost every assertion here is about CONTAINMENT rather than about sound.
 * The worst outcome this feature is allowed to produce is silence.
 *
 * Run:  node tests/achievement-sound.check.mjs
 * Exit: 0 = all pass, 1 = one or more failures
 */

import { readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, rel), 'utf8');
const sounds = read('../lib/sounds.ts');
const layout = read('../app/_layout.tsx');
const banner = read('../components/AchievementBanner.tsx');
const profile = read('../app/(tabs)/profile.tsx');
const pkg = JSON.parse(read('../package.json'));

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

// ─── 1. It cannot take the app down ──────────────────────────────────────────
console.log('\n[1] A missing or broken audio module is silence, not a crash');

check(
  'expo-audio is NOT imported at the top of the module',
  !/^import .*expo-audio/m.test(sounds),
  'a top-level import of a missing native module throws at module-evaluation time, which on the startup path is a white screen rather than a missing sound'
);
check(
  'it is required lazily, inside a try',
  /try \{[\s\S]{0,600}?require\('expo-audio'\)/.test(sounds),
  ''
);
check(
  'a failure is remembered so it is not retried on every unlock',
  /unavailable = true/.test(sounds),
  'retrying a broken native require on every badge is a stutter on the celebration'
);
check(
  'the play path is wrapped too',
  /export function playAchievementSound\(\)[\s\S]{0,500}?try \{[\s\S]{0,400}?\} catch/.test(sounds),
  'a rejected promise from the audio system must not surface as an unhandled rejection mid-celebration'
);
check(
  'promise-returning calls are defended individually',
  /\?\.catch\?\.\(\(\) => \{\}\)/.test(sounds),
  ''
);
check(
  'one player, created once',
  /if \(player\) return player;/.test(sounds),
  'a player per unlock leaks native objects, and badges unlock several at a time'
);
check(
  'web is skipped outright',
  /if \(Platform\.OS === 'web'\) return;/.test(sounds),
  ''
);

// ─── 2. It is wired to the moment the user sees, not the moment it is awarded ─
console.log('\n[2] The sound lands on the celebration');

check(
  'the toast queue plays it when a celebration is presented',
  /setCurrentToast\(next\);[\s\S]{0,400}?playAchievementSound\(\)/.test(layout),
  'awarding happens on screens the user may not be looking at, and during silent backfills'
);
check(
  'the session-summary banner plays it on drop-in',
  /playAchievementSound\(\)/.test(banner),
  ''
);
check(
  'the banner plays once per drop-in, not once per badge',
  /\}, \[badges\.length\]\);/.test(banner) &&
    banner.indexOf('playAchievementSound()') < banner.indexOf('}, [badges.length]);'),
  'this banner steps through a run of unlocks on a 3.2s timer, and a chime every 3.2 seconds is an alarm'
);

// ─── 3. It can be turned off ─────────────────────────────────────────────────
console.log('\n[3] Anyone who does not want it can switch it off');

check('there is a setting', /achievementSoundEnabled/.test(profile), '');
check(
  'both play sites respect it',
  /if \(achievementSoundEnabled\) playAchievementSound\(\)/.test(layout) &&
    /if \(soundEnabled\) playAchievementSound\(\)/.test(banner),
  'a setting one surface ignores is worse than no setting'
);
check(
  'the toggle demonstrates itself when switched on',
  /if \(value\) playAchievementSound\(\)/.test(profile),
  'a sound toggle you cannot hear is a guess'
);

// ─── 4. The asset exists and is small ────────────────────────────────────────
console.log('\n[4] The asset is present and not a download');

let size = -1;
try {
  size = statSync(join(__dir, '../assets/sounds/achievement.wav')).size;
} catch {
  /* reported below */
}
check('the chime is checked in', size > 0, 'lib/sounds.ts requires it at runtime');
check(
  `it is small enough to bundle (${Math.round(size / 1024)} KB)`,
  size > 0 && size < 200 * 1024,
  'a celebration sound is not worth a megabyte of app size'
);
check(
  'expo-audio is a declared dependency',
  !!pkg.dependencies?.['expo-audio'],
  'the lazy require means a missing dependency fails silently — so the manifest is the only place this can be caught'
);

console.log('');
if (failures > 0) {
  console.error(`achievement-sound: ${failures}/${total} check(s) FAILED\n`);
  process.exit(1);
} else {
  console.log(`achievement-sound: all ${total} checks passed\n`);
  process.exit(0);
}
