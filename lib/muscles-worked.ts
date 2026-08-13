import type { PainRegion } from './store';

/**
 * The MUSCLES a region's work lands on.
 *
 * WHY THIS EXISTS
 * ───────────────
 * `targetRegions` is a list of places on the body you can point at when
 * something hurts, so it mixes muscles with joints: 'knee', 'hip_groin',
 * 'elbow', 'wrist', 'ankle_achilles'. That is the right vocabulary for "where
 * does it hurt" and the wrong one for "what did I train". The session summary
 * was reading it as the second and printing
 *
 *     Quads · Hamstrings · Glutes · Knee · Hip · Lower Back · +5 more
 *
 * — three muscles, two joints, a region, and a count standing in for the rest.
 *
 * A joint is not trained; the muscles that move it are. So each joint maps to
 * the muscles that actually did the work, which also means a session made
 * entirely of joint-tagged work — an elbow rehab session is the real case —
 * still names something instead of coming back empty.
 *
 * WHY THIS IS ITS OWN FILE
 * ────────────────────────
 * It started next to BODY_DIAGRAM_LABELS in components/BodyDiagram.tsx, which
 * imports react-native and so cannot be loaded by a test runner. This is pure
 * data and one pure function; keeping it here is what lets
 * tests/muscles-worked.check.mjs actually call it rather than read it.
 */
const MUSCLES_OF_REGION: Record<PainRegion, string[]> = {
  // ── Muscles — themselves ─────────────────────────────────────────────────
  chest: ['Chest'],
  bicep: ['Biceps'],
  tricep: ['Triceps'],
  core_ribs: ['Core'],
  quads: ['Quads'],
  hamstrings: ['Hamstrings'],
  glutes: ['Glutes'],
  lat_mid_back: ['Lats'],
  upper_back: ['Traps'],
  lower_back: ['Lower Back'],
  calf_shin: ['Calves'],
  neck: ['Neck'],
  // The pain screen needs "Front Shoulder" and "Rear Shoulder" to tell two
  // complaints apart. A list of what you trained wants the muscle, and the
  // muscle is the deltoid.
  front_shoulder: ['Front Delts'],
  rear_shoulder: ['Rear Delts'],

  // ── Joints — the muscles that move them ──────────────────────────────────
  knee: ['Quads', 'Hamstrings'],
  hip_groin: ['Glutes', 'Adductors'],
  elbow: ['Biceps', 'Triceps'],
  wrist: ['Forearms'],
  ankle_achilles: ['Calves'],
};

/** Regions whose entry above is derived rather than the region itself. */
export const JOINT_REGIONS: PainRegion[] = [
  'knee',
  'hip_groin',
  'elbow',
  'wrist',
  'ankle_achilles',
];

/** Every muscle name this module can produce. */
export const ALL_MUSCLE_NAMES: string[] = [
  ...new Set(Object.values(MUSCLES_OF_REGION).flat()),
].sort();

/**
 * Turn a region → count tally into an ordered list of muscle names.
 *
 * A joint's contribution is halved on the way in. A knee exercise does train the
 * quads, but not as squarely as something tagged 'quads' does, and without the
 * discount three knee drills would outrank the squat that was the point of the
 * session. It only affects the ORDER — everything worked is named, whatever its
 * weight, because this list is the key to a body map printed beside it and a key
 * that stops halfway is not one.
 */
export function musclesWorked(counts: Partial<Record<PainRegion, number>>): string[] {
  const weights = new Map<string, number>();
  for (const [region, count] of Object.entries(counts) as [PainRegion, number][]) {
    if (!count || count <= 0) continue;
    const muscles = MUSCLES_OF_REGION[region];
    if (!muscles) continue;
    const share = JOINT_REGIONS.includes(region) ? count / 2 : count;
    for (const m of muscles) weights.set(m, (weights.get(m) ?? 0) + share);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([muscle]) => muscle);
}

/** Exposed for the contract test, which checks every PainRegion has an entry. */
export const MUSCLE_MAP_FOR_TEST = MUSCLES_OF_REGION;
