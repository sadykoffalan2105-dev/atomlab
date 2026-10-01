/**
 * 200 основных реакций (docs/plans/reactions-top200.md): каждая собирается в реакторе «только уравнять».
 *  1. Ссылка «Уравнять в реакторе» (mr=<id>&balance=1) разбирается в спецификацию этой реакции.
 *  2. resolveReactorEquation — ok, stageOnly null (синтез запускается), с balanceSelf все коэффициенты = 1.
 *  3. Единственный минимальный целочисленный набор коэффициентов (ядро матрицы состава одномерно) = уравнению.
 *  4. Проверка реактора: при коэффициентах 1 «уравнено» только если эталон весь из единиц; при эталоне — уравнено.
 *  5. Сцена реактора (scientificStageLayout): число частиц каждого вещества = коэффициенту — на 1 и на эталоне;
 *     счёт атомов сцены совпадает со счётом по формулам; при эталоне все строки равны.
 *  6. Виды частиц: ионное вещество (по «Как образуется», formationPlan) — ионами, как в плане; молекулярное —
 *     одной связной молекулой; простое вещество — атомами / двухатомной молекулой.
 *  7. Все вещества — из 200 каталога или простые; типы покрыты; id уникальны; уравнения без дублей.
 * Запуск: npx tsx scripts/test-reactions200.mts
 */
import assert from 'node:assert/strict'
import { minimalIntegerCoefficients } from '../src/chemistry/equationNullspace.ts'
import { parseEquationText } from '../src/chemistry/equationFormula.ts'
import { formationPlan } from '../src/chemistry/formationPlan.ts'
import { isReactorEquationBalanced, type ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import { isScientificEquationBalanced, type ReactorCoProductTerm } from '../src/chemistry/scientificReactorRecipes.ts'
import { scientificStageLayout, STAGE_MAX_VISIBLE_COPIES, type ScientificStageLayout } from '../src/components/lab/scientific/scientificReactorStageLayout.ts'
import { CATALOG_TOP200 } from '../src/data/catalog/catalogTop200.ts'
import { MAIN_REACTIONS_200, MAIN_REACTION_TYPE_ORDER, mainReactionSkeleton } from '../src/data/catalog/mainReactions.ts'
import { compoundById } from '../src/data/compounds.ts'
import { labCompoundById } from '../src/data/labSpecies.ts'
import {
  parseReactorLinkParams,
  reactorHrefForMainReaction,
  resolveReactorEquation,
  type ReactorLinkOk,
} from '../src/lab/reactorDeepLink.ts'

let checks = 0
const failures: string[] = []
function ok(cond: unknown, msg: string): void {
  checks++
  if (!cond) failures.push(msg)
}

ok(MAIN_REACTIONS_200.length === 200, `реакций ${MAIN_REACTIONS_200.length}, нужно 200`)
ok(new Set(MAIN_REACTIONS_200.map((r) => r.id)).size === 200, 'id реакций не уникальны')
ok(new Set(MAIN_REACTIONS_200.map((r) => r.equation)).size === 200, 'уравнения повторяются')
for (const type of MAIN_REACTION_TYPE_ORDER) {
  ok(MAIN_REACTIONS_200.some((r) => r.type === type), `нет ни одной реакции типа ${type}`)
}
ok(MAIN_REACTIONS_200.filter((r) => r.qualitative).length >= 8, 'качественных реакций меньше 8')

const isSimpleId = (id: string) => Object.keys(compoundById[id]?.composition ?? {}).length === 1

/** Связные компоненты единицы сцены (по связям раскладки). */
function unitComponents(layout: ScientificStageLayout, unitIndex: number): number[][] {
  const u = layout.units[unitIndex]!
  const idx = Array.from({ length: u.atomCount }, (_, i) => u.atomStart + i)
  const parent = new Map(idx.map((i) => [i, i]))
  const find = (i: number): number => (parent.get(i) === i ? i : (parent.set(i, find(parent.get(i)!)), parent.get(i)!))
  for (const b of layout.bonds) if (b.unit === unitIndex) parent.set(find(b.a), find(b.b))
  const groups = new Map<number, number[]>()
  for (const i of idx) groups.set(find(i), [...(groups.get(find(i)) ?? []), i])
  return [...groups.values()]
}

function stageFor(res: ReactorLinkOk): ScientificStageLayout {
  return scientificStageLayout(
    res.leftTerms,
    res.coProducts.map((c) => ({ id: c.id, coeff: c.coeff, compoundId: c.compoundId ?? undefined, z: c.z, diatomic: c.diatomic })),
    res.productCompoundId,
    res.productCoeff,
    res.recipe?.productIndex,
  )
}

function balancedInReactor(res: ReactorLinkOk, left: readonly ReactorEquationTerm[], co: readonly ReactorCoProductTerm[], k: number): boolean {
  const product = labCompoundById[res.productCompoundId]
  if (res.recipe) return isScientificEquationBalanced(left, co, product, k, labCompoundById, res.recipe)
  return isReactorEquationBalanced(left, product, k)
}

/** Ионы формульной единицы по плану «Как образуется»: «Na⁺×2 SO₄²⁻×1». */
const planIons = (id: string): string | null => {
  const plan = formationPlan(id)
  if (!plan || plan.mode !== 'ionic') return null
  return plan.species
    .filter((s) => s.charge !== 0)
    .map((s) => `${s.formula}×${s.count}`)
    .sort()
    .join(' ')
}

const kindIssues = new Map<string, string>()

for (const r of MAIN_REACTIONS_200) {
  const tag = `${r.id} ${r.equation}`
  // 1. ссылка
  const href = reactorHrefForMainReaction(r.id)
  const link = parseReactorLinkParams(new URLSearchParams(href.slice(href.indexOf('?') + 1)))
  ok(link && link.balanceSelf && link.mainReactionId === r.id, `${tag}: ссылка ${href} не ведёт на реакцию с balance=1`)
  if (!link) continue
  ok(!/\d/.test((link.spec.titleRu ?? '').replace(/[₀-₉]/g, '')) || Boolean(r.titleRu), `${tag}: заголовок ссылки подсказывает коэффициенты`)

  // 2. реактор
  const res = resolveReactorEquation(link.spec, { balanceSelf: true })
  const target = resolveReactorEquation(link.spec)
  ok(res.ok && target.ok, `${tag}: реактор не открыл реакцию (${res.ok ? '' : res.code})`)
  if (!res.ok || !target.ok) continue
  ok(res.stageOnly == null, `${tag}: только «шарами» (${res.stageOnly}) — синтез не запустится`)
  ok(res.productCompoundId === r.main, `${tag}: главный продукт ${res.productCompoundId}, ожидался ${r.main}`)
  const ones = [...res.leftTerms.map((t) => t.coeff), ...res.coProducts.map((c) => c.coeff), res.productCoeff]
  ok(ones.every((k) => k === 1), `${tag}: с balance=1 коэффициенты ${ones.join(',')} — должны быть все 1`)
  ok(res.equationUnicode === r.equation, `${tag}: эталон реактора ${res.equationUnicode} ≠ ${r.equation}`)
  ok(res.leftTerms.every((t) => t.locked), `${tag}: вещество слева можно удалить — должно быть закреплено`)

  // 3. единственность коэффициентов
  const parsed = parseEquationText(r.equation)
  ok(parsed && !parsed.isScheme && !parsed.isIonic, `${tag}: уравнение не разбирается`)
  if (!parsed) continue
  const all = [...parsed.reactants, ...parsed.products]
  const minimal = minimalIntegerCoefficients(all.map((s) => s.counts ?? {}), parsed.reactants.length)
  ok(minimal != null, `${tag}: коэффициенты не единственны (ядро матрицы состава не одномерно)`)
  ok(minimal && minimal.every((v, i) => v === all[i]!.coeff), `${tag}: минимальный набор ${minimal?.join(',')} ≠ уравнению`)
  ok(!/(^|[\s+→⇄])\d/.test(mainReactionSkeleton(r.equation).replace(/[₀-₉]/g, '')), `${tag}: в скелете остались коэффициенты: ${mainReactionSkeleton(r.equation)}`)

  // 4. проверка реактора
  const allOnes = all.every((s) => s.coeff === 1)
  ok(
    balancedInReactor(res, res.leftTerms, res.coProducts, res.productCoeff) === allOnes,
    `${tag}: при коэффициентах 1 реактор говорит «${allOnes ? 'не ' : ''}уравнено»`,
  )
  ok(balancedInReactor(target, target.leftTerms, target.coProducts, target.productCoeff), `${tag}: при эталоне реактор не видит баланса`)

  // 5. сцена: число частиц = коэффициент
  for (const [label, state] of [['коэфф. 1', res], ['эталон', target]] as const) {
    const layout = stageFor(state)
    const want = new Map<string, number>()
    for (const t of state.leftTerms) want.set(t.id, t.coeff)
    for (const c of state.coProducts) want.set(c.id, c.coeff)
    want.set(`product:${state.productCompoundId}`, state.productCoeff)
    ok(layout.terms.length === want.size, `${tag} [${label}]: на сцене ${layout.terms.length} веществ, в уравнении ${want.size}`)
    for (const [key, k] of want) {
      ok(k <= STAGE_MAX_VISIBLE_COPIES, `${tag}: коэффициент ${k} больше, чем сцена показывает частиц (${STAGE_MAX_VISIBLE_COPIES})`)
      const n = layout.units.filter((u) => u.termKey === key).length
      ok(n === k, `${tag} [${label}]: частиц ${key} на сцене ${n}, коэффициент ${k}`)
      const term = layout.terms.find((t) => t.key === key)
      ok(term && term.coeff === k && term.hiddenCopies === 0, `${tag} [${label}]: подпись ${key} — ${term?.coeff}/${term?.hiddenCopies}`)
    }
    if (label === 'эталон') ok(layout.tally.equal, `${tag}: при эталоне счёт атомов сцены не сходится: ${JSON.stringify(layout.tally.rows)}`)
    // счёт атомов сцены = атомы частиц на сцене (каждая частица — целая формульная единица)
    const leftAtoms = layout.atoms.filter((a) => layout.units[a.unit]!.side === 'left').length
    const tallyLeft = layout.tally.rows.filter((row) => row.kind !== 'charge').reduce((s, row) => s + row.left, 0)
    ok(leftAtoms === tallyLeft, `${tag} [${label}]: атомов слева на сцене ${leftAtoms}, по счёту ${tallyLeft}`)
  }

  // 6. виды частиц
  const layout = stageFor(target)
  const allTerms: { key: string; compoundId?: string | null; z?: number; diatomic?: boolean }[] = [
    ...target.leftTerms.map((t) => ({ key: t.id, compoundId: t.compoundId, z: t.z, diatomic: t.diatomic })),
    ...target.coProducts.map((c) => ({ key: c.id, compoundId: c.compoundId, z: c.z, diatomic: c.diatomic })),
    { key: `product:${target.productCompoundId}`, compoundId: target.productCompoundId },
  ]
  for (const t of allTerms) {
    const ui = layout.units.findIndex((u) => u.termKey === t.key)
    if (ui < 0) continue
    const term = layout.terms.find((x) => x.key === t.key)!
    if (!t.compoundId || isSimpleId(t.compoundId)) {
      const comps = unitComponents(layout, ui)
      ok(comps.length === 1, `${tag}: простое вещество ${term.formula} распалось на ${comps.length} частей`)
      continue
    }
    const id = t.compoundId
    ok(CATALOG_TOP200.has(id), `${tag}: ${id} не из 200 веществ каталога`)
    const want = planIons(id)
    const comps = unitComponents(layout, ui)
    const unit = layout.units[ui]!
    const charged = layout.atoms.slice(unit.atomStart, unit.atomStart + unit.atomCount).some((a) => /[+-]$/.test(a.role))
    if (want) {
      // ионное: подпись ионов и частицы по плану
      const got = (term.ionFormula ?? '')
        .split(/\s+/u)
        .filter(Boolean)
        .map((p) => {
          const m = /^(\d*)(.+)$/.exec(p)!
          return `${m[2]}×${m[1] ? Number(m[1]) : 1}`
        })
        .sort()
        .join(' ')
      if (got !== want) kindIssues.set(id, `ионное: на сцене «${term.ionFormula ?? 'молекула'}» (${comps.length} частей), по плану ${want}`)
    } else if (comps.length !== 1 || charged || term.ionFormula) {
      kindIssues.set(id, `молекулярное: на сцене ${comps.length} частей${term.ionFormula ? ` (${term.ionFormula})` : ''}`)
    }
  }
}

for (const [id, msg] of kindIssues) ok(false, `вид частицы ${compoundById[id]?.formulaUnicode ?? id}: ${msg}`)

if (failures.length) {
  console.error(`✗ ${failures.length} из ${checks} проверок:`)
  for (const f of failures.slice(0, 400)) console.error('  -', f)
  process.exit(1)
}
console.log(`✓ 200 основных реакций: ${checks} проверок`)
assert.ok(true)
