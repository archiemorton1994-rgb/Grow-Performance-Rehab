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
