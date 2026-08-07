import type { WeightUnit } from './store';

/**
 * What to actually put on the bar.
 *
 * Asked for: "a visual modal/utility for barbell lifts that calculates and
 * displays the exact plate breakdown per side, supporting 20kg/45lb standard
 * bar weights and standard plate increments."
 *
 * The app tells people to lift 87.5 kg and has never once told them that is a
 * 20 kg bar with 15, 15, 2.5 and 1.25 a side. That arithmetic is easy and
 * everybody gets it wrong occasionally, usually while tired and mid-session.
 */

/** Standard Olympic bar, per unit. */
export const BAR_WEIGHT: Record<WeightUnit, number> = { kg: 20, lbs: 45 };

/**
 * Plates a normal gym has, heaviest first.
 *
 * 1.25 kg and 1 lb are included because the app's own progression works in
 * 2.5 kg steps and a 2.5 kg jump on the bar is 1.25 a side — without the small
 * plates half the weights it prescribes would be unloadable.
 */
export const PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

export interface PlatePlan {
  /** Plates for ONE side, heaviest first, with repeats listed separately. */
  perSide: number[];
  /** The bar used. */
  bar: number;
  /** What the plan actually comes to — may be under `target` if unloadable. */
  achievable: number;
  /** target - achievable, in the same unit. 0 when it comes out exactly. */
  shortfall: number;
  /** True when the target is below the bar, or not a barbell weight at all. */
  belowBar: boolean;
}

/**
 * Work out the plates for a target weight.
 *
 * Greedy from the heaviest plate down, which is both optimal for these
 * denominations and what a person actually does when loading a bar.
 */
export function calculatePlates(
  targetWeight: number,
  unit: WeightUnit,
  barWeight = BAR_WEIGHT[unit]
): PlatePlan {
  const plates = PLATES[unit];
  if (!Number.isFinite(targetWeight) || targetWeight <= barWeight) {
    return {
      perSide: [],
      bar: barWeight,
      achievable: barWeight,
      shortfall: Math.max(0, targetWeight - barWeight),
      belowBar: true,
    };
  }

  // Everything is per side, so the arithmetic happens on half the load and the
  // display never has to divide anything.
  let remainingPerSide = (targetWeight - barWeight) / 2;
  const perSide: number[] = [];
  for (const plate of plates) {
    while (remainingPerSide >= plate - 1e-9) {
      perSide.push(plate);
      remainingPerSide -= plate;
    }
  }

  const loaded = perSide.reduce((sum, p) => sum + p, 0) * 2;
  const achievable = parseFloat((barWeight + loaded).toFixed(2));
  return {
    perSide,
    bar: barWeight,
    achievable,
    shortfall: parseFloat(Math.max(0, targetWeight - achievable).toFixed(2)),
    belowBar: false,
  };
}

/** Plates grouped for display: [{ weight, count }], heaviest first. */
export function groupPlates(perSide: number[]): { weight: number; count: number }[] {
  const out: { weight: number; count: number }[] = [];
  for (const p of perSide) {
    const last = out[out.length - 1];
    if (last && last.weight === p) last.count++;
    else out.push({ weight: p, count: 1 });
  }
  return out;
}

/** "20 kg bar + 15, 15, 2.5 per side" — one line, for a card or a note. */
export function describePlates(plan: PlatePlan, unit: WeightUnit): string {
  if (plan.belowBar) return `Under a ${plan.bar} ${unit} bar`;
  if (plan.perSide.length === 0) return `Empty ${plan.bar} ${unit} bar`;
  const groups = groupPlates(plan.perSide)
    .map((g) => (g.count > 1 ? `${g.weight}×${g.count}` : `${g.weight}`))
    .join(' + ');
  return `${plan.bar} ${unit} bar · ${groups} per side`;
}

/**
 * Whether an exercise is loaded on a barbell.
 *
 * Name-based, like the rest of the app's classification: the database has no
 * "uses a barbell" field, and adding one to 447 exercises would go stale. The
 * cost of a false positive here is a calculator button on a card that does not
 * need one, so the patterns are deliberately specific rather than generous.
 */
export function isBarbellExercise(name: string, equipmentRequired?: string): boolean {
  if (/dumbbell|\bdb\b|kettlebell|\bkb\b|band|cable|machine|bodyweight/i.test(name)) return false;
  if (/barbell|\bbar\b|deadlift|back squat|front squat|bench press|overhead press|power clean|snatch|romanian|good morning|hip thrust|\bohp\b|military press|zercher|landmine/i.test(name)) {
    return true;
  }
  return equipmentRequired === 'fullgym' && /squat|press|row|clean|deadlift/i.test(name);
}
