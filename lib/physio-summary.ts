import { PAIN_CATEGORIES } from '@/lib/store';
import type { CompletedSession, OneRepMax, UserProfile, PainRegion } from '@/lib/store';

/**
 * A plain-text summary a user can hand to whoever is treating them.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The app already knows the things a clinician has to spend a consultation
 * extracting: which area was flagged, on which dates, how bad it was said to be,
 * what the session did about it, and what the person was actually lifting while
 * it hurt. The assistant will even say "you have flagged this in 5 of your last
 * 10 sessions, going back 9 weeks, worth having someone look at it."
 *
 * And then there was nowhere for any of it to go. No share, no export, nothing.
 * The advice ended at the point it became useful.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * ────────────────────────────────
 * It does not diagnose, grade, or interpret. Every line is a count, a date or a
 * weight that the user themselves entered. The reader is the professional; this
 * is their intake notes written for them, not an opinion competing with theirs.
 *
 * Pure, and free of React Native imports, so a contract test can run it over
 * real histories rather than checking that a button exists.
 */

const REGION_LABELS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const group of Object.values(PAIN_CATEGORIES)) {
    for (const r of group.regions) out[r.id] = r.label;
  }
  return out;
})();

const SEVERITY_WORDS: Record<string, string> = {
  mild: 'mild',
  moderate: 'moderate',
  severe: 'severe',
};

export interface PhysioSummaryInput {
  profile: UserProfile | null;
  sessions: CompletedSession[];
  oneRepMaxes: OneRepMax[];
  weightUnit: 'kg' | 'lbs';
  /** Injected so the output is deterministic under test. */
  now?: number;
}

const DAY = 86400000;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown date';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function weight(kg: number, unit: 'kg' | 'lbs'): string {
  if (unit === 'lbs') return `${Math.round(kg * 2.20462)} lbs`;
  return `${Math.round(kg * 10) / 10} kg`;
}

/** Every region flagged, newest episode first, with how often and over how long. */
function painLines(sessions: CompletedSession[], unit: 'kg' | 'lbs'): string[] {
  const byRegion = new Map<PainRegion, { dates: string[]; severities: string[] }>();
  for (const s of sessions) {
    if (!s.hadAches) continue;
    const regions = s.painRegions?.length ? s.painRegions : s.painRegion ? [s.painRegion] : [];
    for (const r of regions) {
      const entry = byRegion.get(r) ?? { dates: [], severities: [] };
      entry.dates.push(s.date);
      if (s.painSeverity) entry.severities.push(s.painSeverity);
      byRegion.set(r, entry);
    }
  }
  if (byRegion.size === 0) return [];

  const rows = [...byRegion.entries()].map(([region, e]) => {
    const sorted = [...e.dates].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const worst =
      e.severities.includes('severe')
        ? 'severe'
        : e.severities.includes('moderate')
          ? 'moderate'
          : e.severities.includes('mild')
            ? 'mild'
            : null;
    const spanDays = Math.round((Date.parse(last) - Date.parse(first)) / DAY);
    const span =
      sorted.length === 1
        ? `once, on ${fmtDate(first)}`
        : `${sorted.length} times between ${fmtDate(first)} and ${fmtDate(last)}` +
          (spanDays >= 7 ? `, a span of ${Math.round(spanDays / 7)} weeks` : '');
    return {
      last,
      text:
        `- ${REGION_LABELS[region] ?? region}: reported ${span}` +
        (worst ? `. Worst reported as ${SEVERITY_WORDS[worst]}.` : '.'),
    };
  });
  rows.sort((a, b) => b.last.localeCompare(a.last));
  return rows.map((r) => r.text);
}

/** What the person was actually lifting, so the reader can judge the load. */
function liftLines(sessions: CompletedSession[], unit: 'kg' | 'lbs'): string[] {
  const best = new Map<string, { kg: number; reps: number; date: string }>();
  for (const s of sessions) {
    for (const log of s.exerciseLogs ?? []) {
      if (log.category !== 'main') continue;
      for (const set of log.sets ?? []) {
        if (!set.completed || set.skipped || set.weight <= 0) continue;
        const prev = best.get(log.exerciseName);
        if (!prev || set.weight > prev.kg) {
          best.set(log.exerciseName, { kg: set.weight, reps: set.reps, date: s.date });
        }
      }
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1].kg - a[1].kg)
    .slice(0, 6)
    .map(
      ([name, b]) =>
        `- ${name}: heaviest ${weight(b.kg, unit)} for ${b.reps} ${
          b.reps === 1 ? 'rep' : 'reps'
        }, on ${fmtDate(b.date)}`
    );
}

export function buildPhysioSummary(input: PhysioSummaryInput): string {
  const now = input.now ?? Date.now();
  const sessions = [...(input.sessions ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const unit = input.weightUnit ?? 'kg';
  const name = input.profile?.name?.trim();

  const out: string[] = [];
  out.push(name ? `Training summary for ${name}` : 'Training summary');
  out.push(`Prepared ${fmtDate(new Date(now).toISOString())} from the Grow app.`);
  out.push('');

  if (sessions.length === 0) {
    out.push('No sessions have been completed yet, so there is nothing to report.');
    return out.join('\n');
  }

  const first = sessions[0].date;
  const last = sessions[sessions.length - 1].date;
  const weeks = Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / DAY / 7));
  out.push('TRAINING');
  out.push(
    `- ${sessions.length} sessions completed between ${fmtDate(first)} and ${fmtDate(last)}.`
  );
  out.push(`- That is roughly ${Math.round((sessions.length / weeks) * 10) / 10} a week.`);
  const lowEnergy = sessions.filter((s) => s.energy === 'low').length;
  if (lowEnergy > 0) {
    out.push(
      `- ${lowEnergy} of those ${lowEnergy === 1 ? 'was' : 'were'} logged on a day they reported low energy.`
    );
  }
  out.push('');

  const pains = painLines(sessions, unit);
  out.push('REPORTED PAIN');
  if (pains.length === 0) {
    out.push('- No pain or soreness was reported in any session.');
  } else {
    out.push(
      '- Reported by the user at the start of a session. The app adapts the session around'
    );
    out.push('  whatever is flagged, taking out what would load the area and putting gentle work');
    out.push('  for it in, with a pain limit attached.');
    out.push('');
    for (const line of pains) out.push(line);
  }
  out.push('');

  const lifts = liftLines(sessions, unit);
  if (lifts.length > 0) {
    out.push('HEAVIEST WORK LOGGED');
    for (const line of lifts) out.push(line);
    out.push('');
  }

  const orms = [...(input.oneRepMaxes ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  if (orms.length > 0) {
    out.push('RECORDED ONE REP MAXES');
    const seen = new Set<string>();
    for (const o of orms) {
      if (seen.has(o.lift)) continue;
      seen.add(o.lift);
      out.push(
        `- ${o.lift.charAt(0).toUpperCase() + o.lift.slice(1)}: ${weight(o.weight, unit)} on ${fmtDate(o.date)}`
      );
    }
    out.push('');
  }

  out.push(
    'This is a record of what was entered into a training app. It is not a clinical assessment.'
  );
  return out.join('\n');
}
