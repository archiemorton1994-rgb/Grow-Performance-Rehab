import { WeightUnit } from '@/lib/store';

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === 'lbs') {
    return `${(kg * 2.20462).toFixed(1)} lbs`;
  }
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded} kg`;
}

export function kgToDisplayUnit(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? parseFloat((kg * 2.20462).toFixed(1)) : kg;
}

export function displayUnitToKg(val: number, unit: WeightUnit): number {
  return unit === 'lbs' ? parseFloat((val / 2.20462).toFixed(2)) : val;
}

export function formatWeightValue(kg: number, unit: WeightUnit): number {
  return kgToDisplayUnit(kg, unit);
}

/**
 * Convert any "<number> kg" / "<num>–<num> kg" tokens inside a free-form load
 * string (e.g. "10–18 kg per hand", "80 kg", "12 kg per hand") into the user's
 * display unit. Non-numeric labels like "Bodyweight", "Light band", or
 * "Low intensity" pass through unchanged. Source strings live in the exercise
 * database in kg — this is the render-boundary transform.
 */
export function convertLoadString(load: string, unit: WeightUnit): string {
  if (!load || unit === 'kg') return load;
  // Match a number, optional en-dash/hyphen + second number, then "kg".
  return load.replace(
    /(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*kgs?\b/gi,
    (_m, a: string, b?: string) => {
      const aLbs = Math.round(parseFloat(a) * 2.20462);
      if (b) {
        const bLbs = Math.round(parseFloat(b) * 2.20462);
        return `${aLbs}–${bLbs} lbs`;
      }
      return `${aLbs} lbs`;
    },
  );
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  then.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
