(globalThis as any).__DEV__ = false;
import { getAllPickableExercises } from './lib/exercise-db';
import { tierOf, patternGroupOf, canBeMainLift, PATTERN_GROUP_LABELS } from './lib/exercise-classification';
const all = getAllPickableExercises();
const tiers = new Map<string,number>(), groups = new Map<string,number>();
for (const p of all) {
  tiers.set(tierOf(p.template), (tiers.get(tierOf(p.template))??0)+1);
  const g = patternGroupOf(p.template);
  groups.set(g, (groups.get(g)??0)+1);
}
console.log('tier:'); for (const [k,v] of [...tiers].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)} ${k}`);
console.log('\npattern group:'); for (const [k,v] of [...groups].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)} ${k}`);
console.log('\nMain-lift eligible was 22 (category==="main"), now:', all.filter(p=>canBeMainLift(p.template)).length);
console.log('\nsample compounds per pattern:');
for (const g of ['knee_dominant','hip_dominant','horizontal_push','vertical_push','horizontal_pull','vertical_pull'] as any[]) {
  const names = all.filter(p=>canBeMainLift(p.template) && patternGroupOf(p.template)===g).map(p=>p.template.name);
  console.log(`  ${PATTERN_GROUP_LABELS[g]} (${names.length}): ${names.slice(0,6).join(', ')}`);
}
