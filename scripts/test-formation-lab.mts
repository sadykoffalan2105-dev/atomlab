/**
 * «Как образуется» v2 в лаборатории (formation/lab): у каждого из 200 веществ каталога есть показ в реакторе
 * (кнопка — formationLabProductFor), история и этапы; запуск синтеза ровно по уравнению образования узнаётся
 * (formationForLabRun), а чужие реагенты — нет (иначе показ шёл бы не той реакции).
 * Запуск: npx tsx scripts/test-formation-lab.mts
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { equationSides, formationEquation } from '../src/chemistry/formationEquation'
import { formationForLabRun, formationLabProductFor, formationReagentSets } from '../src/components/lab/formation/lab/formationLabIndex'
import { formationStoryFor } from '../src/components/lab/formation/formationStory'

let checks = 0
const bad: string[] = []
const ok = (cond: boolean, msg: string) => {
  checks++
  if (!cond) bad.push(msg)
}

for (const id of CATALOG_TOP200_IDS) {
  ok(formationLabProductFor(id) === id, `${id}: нет кнопки «Как образуется» в реакторе`)
  ok(formationLabProductFor(null, [null, id]) === id, `${id}: не найден среди продуктов`)
  const story = formationStoryFor(id)
  ok(!!story && story.stages.length >= 3 && story.total > 5, `${id}: нет истории показа`)
  const eq = formationEquation(id)
  const shown = eq ? (eq.direct ?? eq.lab) : null
  const sides = shown ? equationSides(shown) : null
  ok(!!sides, `${id}: нет уравнения образования`)
  if (!sides) continue
  const left = sides.left.map(([, f]) => f)
  ok(formationReagentSets(id).length === 1, `${id}: набор реагентов не один`)
  ok(formationForLabRun(left, id) === id, `${id}: запуск ${shown} не узнан`)
  ok(formationForLabRun([...left].reverse(), id) === id, `${id}: порядок реагентов важен`)
  ok(formationForLabRun([...left, 'Xe'], id) == null, `${id}: лишний реагент принят`)
  // прямой путь есть — лабораторный способ показ v2 не запускает (история играет прямой путь)
  if (eq?.direct && eq.lab) {
    const labLeft = equationSides(eq.lab)?.left.map(([, f]) => f) ?? []
    const same = [...labLeft].sort().join('|') === [...left].sort().join('|')
    if (!same) ok(formationForLabRun(labLeft, id) == null, `${id}: лабораторный способ ${eq.lab} запускает показ прямого пути`)
  }
}
// вещество не из 200 — показа нет
const outside = Object.keys(compoundById).find((k) => !CATALOG_TOP200_IDS.includes(k))
if (outside) ok(formationLabProductFor(outside) == null, `${outside}: вне 200, а кнопка есть`)

if (bad.length) {
  console.error(`test-formation-lab: ${bad.length} ошибок из ${checks}`)
  for (const b of bad.slice(0, 30)) console.error('  ' + b)
  process.exit(1)
}
console.log(`test-formation-lab: ${checks}/${checks} проверок, веществ ${CATALOG_TOP200_IDS.length}`)
