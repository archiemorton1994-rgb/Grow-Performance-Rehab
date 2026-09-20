// Imported by its alias rather than as './store', which is not cosmetic: the
// component suites map '@/lib/store' to a mock, and a relative path walks
// straight past that mapping and loads the real store - which subscribes to the
// real workout engine at module scope and takes the whole suite down with it.
import { TIER_ORDER, type EquipmentTier } from '@/lib/store';
import { SUPPLY_TIERS, isSupplyTier, withKeptSupplies } from './kit';

/**
 * THE EQUIPMENT QUESTION, AS EVERY SCREEN THAT ASKS IT HAS TO ASK IT.
 *
 * Six screens put the same question to somebody: sign-up, the Profile
 * equipment sheet, and the "Equipment today" sheets on Home, Train, Restore and
 * the readiness screen. Until now each one carried its own list and its own
 * copy of the toggle rules, which is six chances to disagree - and they already
 * did, because the list every one of them showed was TIER_ORDER, the equipment
 * LADDER, and Archie's sixth decision adds an answer that is not on it.
 *
 * "Bench, box or sturdy step" is kit rather than a rung. A person with one is
 * no better equipped than a person without; they can simply do a few more of
 * the same exercises, so it supplies bench, box and blocks to the library and
 * never decides which pool a session is drawn from. See SUPPLY_TIERS and
 * KIT_BY_TIER in lib/kit.ts.
 *
 * That difference is exactly what the toggle rules have to respect, and what
 * five hand-written copies of them did not:
 *
 *   UNTICKING THE BENCH MUST NOT UNTICK THE GYM. Every copy of the rule
 *   answered "they have taken something off, so this is not a full gym any
 *   more" by dropping 'fullgym' alongside whatever was unticked. True of a
 *   rung. Not true of a bench, which a full gym has anyway.
 *
 *   THE LAST RUNG IS COUNTED IN RUNGS. The rule that stops somebody ticking
 *   every tile off asked whether the selection was empty. A selection holding
 *   only a bench is not empty and names no equipment at all, so the session
 *   would have been built for somebody with a bench and no body.
 */

/**
 * The tiles, in the order every picker draws them: the ladder, then the kit.
 *
 * Built from the two lists rather than written out, so a rung or a supply added
 * to either one appears in all six pickers at once instead of in whichever ones
 * somebody remembered.
 */
export const PICKER_TIERS: EquipmentTier[] = [...TIER_ORDER, ...SUPPLY_TIERS];

/** True when a selection names at least one rung of the ladder. */
export function hasRung(tiers: readonly EquipmentTier[]): boolean {
  return tiers.some((t) => !isSupplyTier(t));
}

/**
 * Ticking a tile.
 *
 * `keepLastRung` is the difference between a sheet and the pager. A sheet has
 * to hand a complete answer back the moment it closes, so the last rung cannot
 * be taken off; the pager has a Continue button that stays disabled until the
 * answer is usable, so somebody clearing the page to start again is allowed to
 * do exactly that.
 */
export function toggleEquipment(
  tiers: readonly EquipmentTier[],
  tier: EquipmentTier,
  opts: { keepLastRung?: boolean } = {}
): EquipmentTier[] {
  // Kit is its own question and answers nothing about the ladder, so it goes
  // on and comes off on its own.
  if (isSupplyTier(tier)) {
    return tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier];
  }
  // A full gym is every rung, so picking it picks the lot - and keeps the bench
  // somebody has at home, which a gym does not contradict.
  if (tier === 'fullgym') {
    if (!tiers.includes('fullgym')) return withKeptSupplies(TIER_ORDER, tiers);
    const next = tiers.filter((t) => t !== 'fullgym');
    return opts.keepLastRung && !hasRung(next) ? [...tiers] : next;
  }
  if (tiers.includes(tier)) {
    // Taking a rung off means this is not a full gym any more.
    const next = tiers.filter((t) => t !== tier && t !== 'fullgym');
    // Nothing left to train with, so the tap does not take. The rung stays and
    // so does any kit beside it, which is the half the old copies of this rule
    // got wrong: they rebuilt the answer as that one tier and the bench went.
    return opts.keepLastRung && !hasRung(next) ? withKeptSupplies([tier], tiers) : next;
  }
  return [...tiers, tier];
}
