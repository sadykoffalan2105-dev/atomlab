/**
 * Органика v2 · аудит атомного соответствия по школьным механизмам (Kimyo 10).
 *   npx tsx scripts/audit-organic-v2-mechanisms.mts [--verbose]
 *
 * Для каждой реакции строит граф «до» и «после» по номерам соответствия (map) и проверяет правила учебника:
 *  1. этерификация/гидролиз — рвётся/образуется связь АЦИЛ–O, а не O–алкил (O спирта остаётся в эфире,
 *     вода — из OH кислоты и H спирта; гидролиз — обратно; так же для эфиров HNO₃/H₂SO₄);
 *  2. присоединение HX/H₂O к несимметричной C=C / C≡C — по Марковникову (H к C с большим числом H);
 *  3. отщепление H₂O/HX от спирта/галогеналкана — по Зайцеву (H уходит от соседнего C с меньшим числом H);
 *  4. замещение H на X (радикальное hν, FeBr₃/FeCl₃, нитрование, сульфирование): X садится на тот же C,
 *     от которого ушёл H, и этот H уходит в HX/H₂O; кольцо бензола не меняется (не присоединение);
 *     нитрование — O воды из HNO₃;
 *  5. присоединение H₂/Hal₂ к C=C — оба атома из ОДНОЙ молекулы, к двум C бывшей кратной связи;
 *  6. Кучеров — O карбонила из воды, по Марковникову;
 *  7. полимеризация — новые C–C только между атомами бывших кратных связей;
 *  8. Вюрц — новая C–C между атомами, потерявшими галоген; галоген уходит к Na;
 *  9. окисление альдегида (Ag₂O, Cu(OH)₂, [O], O₂) — C=O альдегида сохраняется, новый O садится на тот же C
 *     вместо H альдегидной группы;
 * 10. брожение — связи C–C только рвутся (не больше 3), новых C–C нет;
 * 11. общий запрет: в реакции, где C–C не меняется по химии, нет одновременно разрыва и образования C–C.
 * Код возврата 1 — если есть нарушения.
 */
import { readFileSync } from 'node:fs'
import type { OV2ReactionsFile } from '../src/data/organicV2/types.ts'
import { mechanismViolations, type Violation } from './organic-v2/mechanisms.mts'

const file = JSON.parse(readFileSync(new URL('../src/data/organicV2/reactions.json', import.meta.url), 'utf8')) as OV2ReactionsFile
const verbose = process.argv.includes('--verbose')
const checked: Record<string, number> = {}
const out: Violation[] = []
for (const r of file.reactions) out.push(...mechanismViolations(r, checked))

const byRule: Record<string, number> = {}
for (const v of out) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1
const ids = new Set(out.map((v) => v.id))
console.log(`Аудит механизмов: ${file.reactions.length} реакций; проверок по правилам:`, checked)
console.log(`Нарушений: ${out.length} в ${ids.size} реакциях`, byRule)
const shown = new Set<string>()
for (const v of out) {
  if (!verbose && shown.has(v.id + v.rule)) continue
  shown.add(v.id + v.rule)
  const r = file.reactions.find((x) => x.id === v.id)!
  console.log(`  ✗ [${v.rule}] ${v.id} (${r.type}) ${r.equation}\n      ${v.msg}`)
}
process.exit(out.length ? 1 : 0)
