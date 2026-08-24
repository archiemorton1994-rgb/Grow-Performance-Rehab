/**
 * Contract test: the server side of the app.
 *
 * Three audits went over the client and none of them opened server/. This is the
 * first pass over it, and it found the two worst defects in the project.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. LOGIN CODES CAME FROM Math.random()
 * ─────────────────────────────────────────────────────────────────────────────
 * V8's Math.random is xorshift128+: fast, uniform, and not unpredictable. Its
 * state can be recovered from a modest run of outputs, and every request in the
 * process draws from one shared stream.
 *
 * Requesting a code is unauthenticated and the address is the caller's choice,
 * so the attack is ordinary rather than exotic: request a run of codes for
 * addresses you own, recover the generator state, trigger a code for somebody
 * else, and know what it is. The five-failure lockout is no help, because a
 * predicted code needs one attempt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. AND NOTHING CAPPED THE ENDPOINT AS A WHOLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Every limit was keyed on the email address, which stops somebody pestering one
 * person and stops nothing else. A script looping over made-up addresses met no
 * limit: each pass sent a real email through Resend, spending the mail quota and
 * the domain's sending reputation, and each distinct address added a permanent
 * entry to an in-memory map and a row to its table.
 *
 * Those two compound. Unlimited code generation is also unlimited sampling of
 * the generator whose state the first defect exposes.
 *
 * Run:  npx tsx tests/server-hardening.check.mjs
 */
import { readFileSync } from 'fs';

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

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const routes = read('server/routes.ts');
const routesCode = stripComments(routes);
const index = read('server/index.ts');
const indexCode = stripComments(index);
const storage = stripComments(read('server/storage.ts'));

console.log('\n[1] Credentials come from the crypto RNG');

check(
  'the login code is generated with randomInt',
  /function generateOtp\(\): string \{\s*\r?\n\s*return String\(randomInt\(100000, 1000000\)\);/.test(
    routesCode
  ),
  'Math.random is recoverable from its own output, and a login code is a credential'
);
check(
  'and randomInt comes from node:crypto',
  /import \{ randomInt \} from 'node:crypto';/.test(routesCode),
  ''
);
check(
  'nothing anywhere in the server reaches for Math.random',
  !/Math\.random/.test(routesCode) && !/Math\.random/.test(indexCode) && !/Math\.random/.test(storage),
  'a predictable number is one refactor away from being a credential again'
);

console.log('\n[2] The whole endpoint has a ceiling, not just each address');

/**
 * Lifted and run rather than read. A limiter that exists but is off by one is
 * a limiter that passes a regex and fails in production.
 */
const ceilingSrc = routes.match(
  /function exceedsGlobalRequestCeiling\(now: number\): boolean \{\r?\n([\s\S]*?)\r?\n\}/
);
const maxMatch = routes.match(/const GLOBAL_REQUEST_MAX = (\d+);/);
const windowMatch = routes.match(/const GLOBAL_REQUEST_WINDOW_MS = ([^;]+);/);

check(
  'the ceiling function is there to be run',
  !!ceilingSrc && !!maxMatch && !!windowMatch,
  'without it the rest of this section is testing nothing'
);

if (ceilingSrc && maxMatch && windowMatch) {
  const MAX = parseInt(maxMatch[1], 10);
  const WINDOW = 10 * 60 * 1000;
  const body = ceilingSrc[1]
    .replace(/GLOBAL_REQUEST_WINDOW_MS/g, String(WINDOW))
    .replace(/GLOBAL_REQUEST_MAX/g, String(MAX))
    .replace(/globalRequestWindowStart/g, 'state.start')
    .replace(/globalRequestCount/g, 'state.count');
  const exceeds = new Function('state', 'now', body);

  const state = { count: 0, start: 0 };
  let blockedAt = null;
  for (let i = 1; i <= MAX + 5; i++) {
    if (exceeds(state, 1000) && blockedAt === null) blockedAt = i;
  }
  check(
    `the first ${MAX} requests in a window are allowed and the next is not`,
    blockedAt === MAX + 1,
    `blocked at request ${blockedAt}, expected ${MAX + 1}`
  );

  // A new window starts clean.
  const after = exceeds(state, 1000 + WINDOW + 1);
  check('and the window resets', after === false, 'the ceiling never lifted');

  check(
    'the ceiling is above any plausible run of real sign-ins',
    MAX >= 100,
    `${MAX} in ten minutes would lock out real users on a good day`
  );
  check(
    'and low enough that a flood is stopped rather than merely slowed',
    MAX <= 1000,
    `${MAX} emails per ten minutes is still 144,000 a day`
  );
}

check(
  'it is applied on the request-code route, before anything is sent',
  /exceedsGlobalRequestCeiling\(Date\.now\(\)\)/.test(routesCode) &&
    routesCode.indexOf('exceedsGlobalRequestCeiling(Date.now())') <
      routesCode.indexOf('const code = generateOtp()'),
  'a flood must cost no mail and no stored state'
);

console.log('\n[3] The rate-limit maps do not grow forever');

check(
  'dead entries are pruned on write',
  /private prune\(now: number\): void \{/.test(routesCode) &&
    /if \(this\.mem\.size > PRUNE_ABOVE_TRACKED_EMAILS\) this\.prune\(Date\.now\(\)\);/.test(
      routesCode
    ),
  'the map was keyed by every address that had ever hit an unauthenticated endpoint'
);
check(
  'and pruning only drops entries whose window has passed',
  /ts\.length === 0 \|\| ts\[ts\.length - 1\] <= windowStart/.test(routesCode),
  'evicting a live entry would hand somebody a fresh allowance'
);

console.log('\n[4] A 500 does not describe itself to the caller');

check(
  'server errors return a fixed message',
  /status < 500 \? \(error\.message \?\? '[^']+'\) : '[^']+'/.test(indexCode),
  'error.message on an unexpected 500 is a Postgres column name, a file path, or a library internal'
);
check(
  'the real one still reaches the log',
  /console\.error\('Internal Server Error:', err\);/.test(indexCode),
  'hiding it from the operator as well would be the opposite mistake'
);
check(
  'deliberate 4xx messages are untouched',
  /status < 500/.test(indexCode),
  'those were written to be read by a person'
);

console.log('\n[5] Smaller things that were still worth fixing');

check(
  'the login code is not in the email subject line',
  /subject: 'Your Grow login code',/.test(routesCode) &&
    !/subject: `Your Grow login code: \$\{code\}`/.test(routesCode),
  'a subject line shows on a lock screen, on a watch, and over a shoulder'
);
check(
  'localhost is only a permitted origin in development',
  /process\.env\.NODE_ENV === 'development' &&\s*\r?\n?\s*\(origin\?\.startsWith\('http:\/\/localhost:'\)/.test(
    indexCode
  ),
  'in production a page on the user\'s own machine is not an origin this API answers'
);
check(
  'a training history is not serialised just to log 79 characters of it',
  /path === '\/api\/user\/data'/.test(indexCode) && /\[body omitted\]/.test(indexCode),
  'the busiest endpoint in the app was stringifying megabytes and discarding all but a line'
);
check(
  'and any oversized response body is skipped too',
  /serialised\.length > TOO_BIG_TO_LOG/.test(indexCode),
  'naming one route leaves the next one to find out the hard way'
);

console.log('\n[6] What was already right, and must stay right');

check(
  'every data route takes the user id from the verified token',
  !/req\.(body|query|params)\.userId/.test(routesCode) &&
    (routesCode.match(/payload\.userId/g) ?? []).length >= 4,
  'reading an id from the request is how one account reads another'
);
check(
  'SQL is parameterised everywhere',
  !/pool\.query\(\s*`[^`]*\$\{/.test(routesCode) && !/pool\.query\(\s*`[^`]*\$\{/.test(storage),
  'string interpolation into SQL is the other half of that same failure'
);
check(
  'the session secret has no fallback value',
  /const JWT_SECRET = process\.env\.SESSION_SECRET;/.test(routesCode) &&
    /throw new Error\('SESSION_SECRET environment variable is required'\)/.test(routesCode),
  'a default secret ships silently and makes every token forgeable'
);
check(
  'the dev login-code exposure fails closed',
  /const IS_DEVELOPMENT = process\.env\.NODE_ENV === 'development';/.test(indexCode) ||
    /const IS_DEVELOPMENT = process\.env\.NODE_ENV === 'development';/.test(routesCode),
  'checking for "not production" leaks live codes whenever NODE_ENV is unset'
);
check(
  'the crash-log endpoint is capped in size and rate',
  /express\.text\(\{ type: '\*\/\*', limit: '10kb' \}\)/.test(routesCode) &&
    /CRASH_LOG_MAX_PER_WINDOW/.test(routesCode),
  'it is unauthenticated by necessity, so it has to be bounded by something'
);
check(
  'deleting an account clears the rows that have no foreign key to cascade',
  /DELETE FROM otps WHERE email/.test(storage) && /DELETE FROM rate_limits WHERE email/.test(storage),
  'otps and rate_limits are keyed by email, so nothing removes them automatically'
);

console.log(`\nserver-hardening: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
