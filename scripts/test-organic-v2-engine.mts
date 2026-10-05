/**
 * Тесты движка Конструктора органики v2 (src/chemistry/organicV2).
 * Запуск: npx tsx scripts/test-organic-v2-engine.mts [--verbose]
 */
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry'
import type { SkeletonGraph } from '../src/chemistry/organicV2'
import { nameSkeleton, canonicalCode, parseSmiles, toSmiles, hillFormula } from '../src/chemistry/organicV2'

const VERBOSE = process.argv.includes('--verbose')
let failed = 0
const ok = (cond: boolean, msg: string) => { if (!cond) { failed++; console.log('  ✗ ' + msg) } else if (VERBOSE) console.log('  ✓ ' + msg) }

/** Граф реестра (с явными H) → SkeletonGraph. */
export function registryToSkeleton(m: (typeof ORGANIC_MOLECULES)[number]): SkeletonGraph {
  const idx = new Map(m.graph.atoms.map((a, i) => [a.id, i]))
  return {
    atoms: m.graph.atoms.map((a) => ({ el: a.element })),
    bonds: m.graph.bonds.map((b) => ({ a: idx.get(b.a)!, b: idx.get(b.b)!, o: Math.round(b.order) as 1 | 2 | 3 })),
  }
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[\s‑–—-]+/g, '-').replace(/[«»"]/g, '').trim()

// ───────── намер против реестра ─────────
{
  console.log('Намер ИЮПАК против реестра')
  const CLASSES = new Set(['alkane', 'cycloalkane', 'alkene', 'alkyne', 'alkadiene', 'halo', 'alcohol', 'aldehyde', 'ketone', 'acid', 'ester', 'ether', 'arene'])
  let total = 0, hit = 0
  const miss: string[] = []
  for (const m of ORGANIC_MOLECULES) {
    if (!CLASSES.has(m.classId)) continue
    total++
    const g = registryToSkeleton(m)
    const nm = nameSkeleton(g)
    const reg = m.nameRu
    // «A (B)» в реестре — синонимы
    const regVariants = [reg, ...reg.split(/[()]/).map((s) => s.trim()).filter(Boolean)].map(norm)
    const mine = nm.synonymsRu.map(norm)
    if (regVariants.some((r) => mine.includes(r))) hit++
    else miss.push(`${m.id} [${m.classId}] реестр «${reg}» ↔ движок «${nm.synonymsRu.slice(0, 4).join(' | ')}» (${hillFormula(g)})`)
  }
  const pct = (100 * hit) / total
  console.log(`  совпало ${hit}/${total} = ${pct.toFixed(1)} %`)
  for (const s of miss) console.log('   · ' + s)
  ok(pct >= 90, `намер ≥ 90 % (${pct.toFixed(1)} %)`)
}

void canonicalCode; void parseSmiles; void toSmiles
console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЁ ЗЕЛЁНОЕ')
process.exit(failed ? 1 : 0)
