# Grow — where the work is up to

Living handover doc. It lives in the repo so it travels with a `git clone` —
Claude Code's own memory does not move between machines.

Last updated: 2026-08-03.

---

## Setting up a new machine

```bash
git clone https://github.com/archiemorton1994-rgb/Grow-Performance-Rehab.git
cd Grow-Performance-Rehab
npm install
```

`npm install` runs `patch-package` via `postinstall`. Two patches must apply —
if either fails, stop and fix it rather than continuing:

- `react-native-view-shot+4.0.3.patch`
- `react-native-body-highlighter+3.2.0.patch` — removes the ponytail from the
  two female body assets

Then confirm the toolchain:

```bash
npm run check
```

That runs `tsc --noEmit`, `expo lint`, and 34 contract tests. It should exit 0.
It is the safety net for this repo — treat a red `check` as a hard stop.

Git identity is set locally (not global) to Archie Morton /
archiemorton1994@gmail.com. A fresh clone will need that again:

```bash
git config user.name "Archie Morton"
git config user.email "archiemorton1994@gmail.com"
```

### What is not in the repo

- **Secrets** live in Replit's environment, never here. `SESSION_SECRET`,
  `RESEND_API_KEY`, `EXPO_PUBLIC_REVENUECAT_API_KEY`, and the review-account
  variables below. Never hardcode or print them.
- **`.claude/settings.local.json`** is a per-machine permission allowlist and is
  gitignored. A new machine builds its own as you approve things.
- **Claude Code memory** (`~/.claude/projects/<project>/memory/`) is per-machine.
  Copy that folder across if you want the accumulated preferences; otherwise
  this document is the source of truth.

---

## How work is done here

- Small commits, each self-contained, pushed incrementally straight to `main`.
  No PRs. Archie pulls into Replit from GitHub.
- `npm run check` before every commit.
- Changes that are visible in the app get verified in the browser preview, not
  just typechecked.
- Archie does not read code — explanations should be in plain terms, and
  claims about behaviour need to be verified rather than asserted.

### Two traps that have bitten repeatedly

1. **Files are CRLF.** Anchors written with `\n` silently fail to match. Use
   `\r?\n`, or read the file's own line ending first.
2. **Escaping regexes through the shell mangles them.** Write patch scripts to
   a file and run the file. Inline `node -e` with regex literals has corrupted
   source twice.

---

## Current state

All work is pushed. `main` == `origin/main`.

### Recently completed

| Commit | What |
|---|---|
| `8607c8c` | Env-gated App Store review account (server-side, see below) |
| `4e3fb7c` | Female session artwork, switched on profile sex |
| `3cabad2` | `scripts/prepare-session-assets.mjs` — repeatable asset export |
| `7a02af7` | Profile tour card no longer slides under the tab bar |
| `b0b0e19` | Onboarding welcome screen redesign |
| `2b6528c` | Subscription screen rewrite + made scrollable |
| `0ae9130` | **Custom exercise pool fix** — 130 → 443 reachable exercises |
| `c239c36` | Body-map fallback regions for the weekly sessions |
| `d9892ff` | Swap alternatives for all 48 weekly exercises + wired 3 orphaned tests in |
| `c4096f1` | Badge name collisions fixed |
| `9f7ac24` | "Personal best" terminology, Achievements empty state, milestones outrank PBs |
| `85a5368` | Body-map labels corrected; female hair removed |
| `51b7244` | **elbow_wrist split into elbow + wrist** (data model, persist v27) |
| `8db630d` | Custom session rebuilt around a catalogue rail |

### Still to do

In priority order. The first three were explicitly requested and are specced.

1. **Goals drive programming.** Constraints Archie gave: applies to **new users
   only** — do not re-programme anyone mid-plan; treat as guidance since reps
   are editable anyway; and **1RM estimation must stay correct** when someone
   does higher reps at lower weight. Intended shapes:
   - strength → ≤5 reps, near-max loads
   - power/speed → same rep range as strength, more sets
   - hypertrophy (build muscle) → moderate reps
   - fat loss → more conditioning work at the end
   Users can pick several goals, so it has to combine them sensibly.
2. **Notification set.** A core set of prompts — "Feeling sore?" leading into a
   recovery session, and similar nudges toward conditioning for someone whose
   goal is fat loss.
3. **Track Your Goals.** Archie left the design to us. Current thinking: a
   fourth tab inside Stats rather than a new screen, assembled from data
   already stored (bodyweight log, conditioning set counts, strength trend)
   plus a weekly-or-fortnightly weight-update prompt.

Smaller items noted but not done:

- The custom session screen still shows movement-pattern and difficulty chips
  as their own row. Worth collapsing behind a single "Filters" control — that
  is the remaining source of vertical clutter.
- Some exercises carry no `targetRegions` at all: `Bench Press` and
  `Barbell Row` resolve to none while `Barbell Bench Press` correctly gives
  chest/tricep/front_shoulder. The body map falls back per session type now, but
  the underlying mapping gaps deserve a pass.
- The 138 `targetRegions` / `triggerRegions` sites that referenced the old
  combined `elbow_wrist` now list **both** joints. That is deliberate and loses
  no coverage, but narrowing individual exercises to one joint is a real content
  improvement available later.
- Three jest suites fail to *run* (`session-pain-adaptation`,
  `session-bar-kav`, `body-diagram-component`) — a pre-existing RN/babel config
  problem, not caused by recent work. `npm test` is red regardless of code
  health; `npm run check` is the meaningful gate.
- Male session artwork is lower resolution than the female set (111–237px vs
  600px). Re-exporting needs new source art with real transparency — the 1024px
  originals recoverable from git commit `197d27f` have a black background and
  barbell plates in the same luminance range, so automated cutout is unreliable.

---

## App Store submission

Full notes were delivered separately as a document. The essentials:

- **Reviewers cannot receive the OTP email.** `devCode` is development-only, so
  an env-gated review account exists: set `REVIEW_ACCOUNT_EMAIL`,
  `REVIEW_ACCOUNT_CODE` (exactly 6 digits) and `REVIEW_ACCOUNT_EXPIRES`
  (`YYYY-MM-DD`) on the **production server**. Inert unless email and code are
  both valid. Startup logs `[Review] Review account ENABLED for <email>`.
  **Unset `REVIEW_ACCOUNT_EMAIL` once approved.**
- **The reviewer still hits the paywall.** `RC_DEV_BYPASS = __DEV__` is false in
  TestFlight and App Store builds. Grant a RevenueCat **promotional entitlement**
  named `premium` to the review account. The RevenueCat App User ID is the
  user's database UUID, which only exists after that account signs in once on a
  real iOS build — so sign in first, then grant.

---

## Architecture notes worth knowing

- **State**: Zustand with `persist`, currently **version 27**. `migrate()`
  backfills missing fields and handles renames. The v27 migration splits
  `elbow_wrist` into `elbow` + `wrist` across `lastPainRegion`,
  `completedSessions[].painRegion` / `.painRegions`, and
  `activeSession.painRegion`.
- **Contract tests** are `tests/*.check.mjs`, all wired into `npm run check`.
  They are source-assertion tests, so they can pass while doing nothing —
  mutation-test any new guard by breaking the thing it protects.
- **Body diagram**: adding a `PainRegion` means updating `lib/store.ts`,
  `BODY_DIAGRAM_LABELS`, `MUSCLE_SET` (muscles only), the front/back slug maps
  and their reverses, the cycle orders, `REGION_ANCHOR`, and both hotspot
  renderers. The contract tests check most of it. Their region parsers strip
  `//` comments — a comment naming a retired region used to be read as a live
  union member.
- **Reanimated entering animations are disabled on web**
  (`app/_layout.tsx`, `skipEntering={Platform.OS === 'web'}`). The browser
  preview therefore cannot show motion. Anything animation-related needs a
  device check.
- **The browser preview cannot scroll programmatically.** That environment
  no-ops `Element.scrollTo()`, which react-native-web's `ScrollView.scrollTo`
  builds on. Direct `scrollTop` assignment works.
