/**
 * Органические реакции книг 10–11 классов в реакторе «шарами»:
 *  1) каждая органическая карточка каталога «Реакции учебника» (equations-g10/g11.json) открывается по своей
 *     ссылке, режим stageOnly organic, баланс атомов сходится (и в уравнении, и на экране реакции), вторая
 *     кнопка ведёт в органическую лабораторию;
 *  2) изомеры различаются по структурной записи учебника (этанол ≠ диметиловый эфир, пропаналь ≠ ацетон …),
 *     брутто-формула — изомер страницы (iso=) или самый школьный;
 *  3) частица реактора: 3D с водородами, состав графа = состав формулы, связи между существующими атомами.
 *
 * Run: npx tsx scripts/test-organic-reactor.mts
 */
import fs from 'node:fs'
import { equationImbalance, parseEquationText } from '../src/chemistry/equationFormula.ts'
import { parseCondensedFormula, skeletonComposition } from '../src/chemistry/organic/condensedFormula.ts'
import { scientificStageLayout } from '../src/components/lab/scientific/scientificReactorStageLayout.ts'
import { labCompoundById, labSpeciesKind } from '../src/data/labSpecies.ts'
import { labOrganicSpeciesFor, pickOrganic } from '../src/data/labOrganicSpecies.ts'
import { parseReactorLinkParams, resolveReactorEquation, type ReactorLinkOk } from '../src/lab/reactorDeepLink.ts'
import type { CompoundDef } from '../src/types/chemistry.ts'
import { buildOrganicV2Index, matchOrganicV2Reaction, organicV2IdFromBackHref } from '../src/lab/organicV2Bridge.ts'
import type { OV2ReactionsFile } from '../src/data/organicV2/types.ts'

const problems: string[] = []
let checks = 0
const ok = (cond: unknown, msg: string) => {
  checks++
  if (!cond) problems.push(msg)
}

// ── 2) изомеры по записи ──
const ISOMERS: [string, string][] = [
  ['CH3CH2OH', 'ethanol'],
  ['CH3-CH2-OH', 'ethanol'],
  ['C2H5OH', 'ethanol'],
  ['CH3OCH3', 'dimethyl-ether'],
  ['CH3CH2CHO', 'propanal'],
  ['CH3COCH3', 'acetone'],
  ['CH3COOH', 'acetic-acid'],
  ['HCOOCH3', 'methyl-formate'],
  ['CH3CH2COOH', 'propanoic-acid'],
  ['CH3COOCH3', 'methyl-acetate'],
  ['HCOOC2H5', 'ethyl-formate'],
  ['CH3COOC2H5', 'ethyl-acetate'],
  ['CH3CH2CH2OH', 'propanol'],
  ['CH3CH(OH)CH3', 'propan-2-ol'],
  ['C2H5OCH3', 'methoxyethane'],
  ['CH3-CH2-CH2-CH3', 'n-butane'],
  ['CH3-CH(CH3)-CH3', 'isobutane'],
  ['CH2=CH-CH2-CH3', 'but-1-ene'],
  ['CH3-CH=CH-CH3', 'but-2-ene'],
  ['CH3-CH2Cl', 'chloroethane'],
  ['CH2Cl-CH2Cl', '1-2-dichloroethane'],
  ['CH3CHCl2', '1-1-dichloroethane'],
  ['HOCH2CH2OH', 'ethylene-glycol'],
  ['C3H5(OH)3', 'glycerol'],
  ['HC≡CH', 'acetylene'],
  ['CH3C≡CH', 'propyne'],
  ['CH2=C=CH2', 'propadiene'],
  ['CH2=CH-CH=CH2', 'butadiene'],
  ['CH2=C(CH3)-CH=CH2', 'isoprene'],
  ['(CH3)2C=C(CH3)2', '2-3-dimethylbut-2-ene'],
  ['C6H5-CH=CH2', 'styrene'],
  ['C6H5-CH2-CH3', 'ethylbenzene'],
  ['C6H5-CH3', 'toluene'],
  ['C6H5OH', 'phenol'],
  ['C6H5CH2OH', 'benzyl-alcohol'],
  ['HOOC-C6H4-COOH', 'terephthalic-acid'],
  ['CH2OH(CHOH)4COH', 'glucose-open'],
  ['CH2OH(CHOH)4CH2OH', 'sorbitol'],
  ['(C17H35COO)3C3H5', 'tristearin'],
  ['(C17H33COO)3C3H5', 'triolein'],
  ['C17H33COOH', 'oleic-acid'],
]
const countsOf = (f: string) => {
  const p = parseEquationText(`${f} -> X`)
  return p?.reactants[0]?.counts ?? null
}
for (const [f, id] of ISOMERS) {
  const c = countsOf(f)
  ok(c, `${f}: формула не разобрана`)
  if (!c) continue
  const pick = pickOrganic(f, c)
  ok(pick?.registryId === id, `${f}: ожидался ${id}, получено ${pick?.registryId ?? 'null'} (${pick?.how})`)
}
// одинаковый состав — разные вещества
ok(pickOrganic('CH3CH2OH', { C: 2, H: 6, O: 1 })?.registryId !== pickOrganic('CH3OCH3', { C: 2, H: 6, O: 1 })?.registryId, 'этанол ≠ диметиловый эфир')
ok(pickOrganic('CH3CH2CHO', { C: 3, H: 6, O: 1 })?.registryId !== pickOrganic('CH3COCH3', { C: 3, H: 6, O: 1 })?.registryId, 'пропаналь ≠ ацетон')
// брутто-формула: подсказка страницы, иначе самый школьный изомер
ok(pickOrganic('C2H4O', { C: 2, H: 4, O: 1 }, 'ethylene-oxide')?.registryId === 'ethylene-oxide', 'C₂H₄O с подсказкой — этиленоксид')
ok(pickOrganic('C2H4O', { C: 2, H: 4, O: 1 })?.registryId === 'acetaldehyde', 'C₂H₄O без подсказки — этаналь')
ok(pickOrganic('C4H10', { C: 4, H: 10 })?.registryId === 'n-butane', 'C₄H₁₀ — н-бутан')
ok(pickOrganic('C6H12', { C: 6, H: 12 }, 'hex-1-ene')?.registryId === 'hex-1-ene', 'C₆H₁₂ с подсказкой — гексен-1')
// подсказка не меняет структурную запись
ok(pickOrganic('CH3CH2OH', { C: 2, H: 6, O: 1 }, 'dimethyl-ether')?.registryId === 'ethanol', 'подсказка не перебивает строение')
// брутто-запись строения не задаёт
ok(parseCondensedFormula('C4H10') == null, 'C4H10 — брутто, скелета нет')
// звено полимера
{
  const sk = parseCondensedFormula('(-CH2-CHCl-)n')
  ok(sk && sk.open.length === 2 && JSON.stringify(skeletonComposition(sk)) === JSON.stringify({ C: 2, H: 3, Cl: 1 }), 'звено ПВХ: 2 открытые связи, C₂H₃Cl')
}

// ── 1) карточки книг ──
function geometryProblems(label: string, c: CompoundDef): string[] {
  const out: string[] = []
  const comp: Record<string, number> = {}
  for (const a of c.atoms) comp[a.symbol] = (comp[a.symbol] ?? 0) + 1
  const want = Object.entries(c.composition).filter(([, n]) => n > 0).sort()
  if (JSON.stringify(Object.entries(comp).sort()) !== JSON.stringify(want)) out.push(`${label}: атомы 3D ${JSON.stringify(comp)} ≠ состав ${JSON.stringify(c.composition)}`)
  if (c.atoms.some((a) => a.pos.some((v) => !Number.isFinite(v)))) out.push(`${label}: NaN в координатах`)
  if (c.bonds.some(([a, b]) => !c.atoms[a] || !c.atoms[b] || a === b)) out.push(`${label}: связь с несуществующим атомом`)
  // каждый водород связан
  const bonded = new Set(c.bonds.flatMap(([a, b]) => [a, b]))
  if (c.atoms.some((a, i) => a.symbol === 'H' && !bonded.has(i))) out.push(`${label}: несвязанный H`)
  return out
}

const organicIds = new Set<string>()
const perGrade: Record<number, { cards: number; organic: number; withAlt: number; synth: number }> = {}
const ov2Index = buildOrganicV2Index(
  (JSON.parse(fs.readFileSync('src/data/organicV2/reactions.json', 'utf8')) as OV2ReactionsFile).reactions,
)
for (const grade of [10, 11]) {
  const book = JSON.parse(fs.readFileSync(`src/data/textbook/equations-g${grade}.json`, 'utf8')) as {
    units: { unitId: string; reactions: { id: string; page: number | null; equationAscii: string; isGeneralScheme: boolean; lab: { ok: boolean; reason?: string; href?: string; altHref?: string } }[] }[]
  }
  const st = (perGrade[grade] = { cards: 0, organic: 0, withAlt: 0, synth: 0 })
  for (const u of book.units) {
    for (const rx of u.reactions) {
      if (rx.isGeneralScheme) continue
      st.cards++
      const label = `g${grade} p${rx.page} ${rx.equationAscii}`
      ok(rx.lab.ok || rx.lab.reason === 'nuclear', `${label}: не открывается (${rx.lab.reason})`)
      ok(rx.lab.reason !== 'organic', `${label}: осталась причина organic`)
      if (!rx.lab.ok || !rx.lab.href) continue
      const link = parseReactorLinkParams(new URLSearchParams(rx.lab.href.split('?')[1] ?? ''))
      ok(link, `${label}: ссылка не разбирается`)
      if (!link) continue
      const r = resolveReactorEquation(link.spec)
      ok(r.ok, `${label}: резолвер ${r.ok ? '' : r.code}`)
      if (!r.ok || r.stageOnly !== 'organic') continue
      st.organic++
      const res = r as ReactorLinkOk
      if (rx.lab.altHref) st.withAlt++
      // вторая кнопка — если в органической лаборатории есть урок с этими веществами (у C₂₃H₄₈ и пентанамида нет)
      ok(!rx.lab.altHref || rx.lab.altHref.startsWith('/organic?'), `${label}: вторая кнопка не в органическую лабораторию`)
      const parsed = parseEquationText(res.equationUnicode)
      ok(parsed && equationImbalance(parsed).length === 0, `${label}: уравнение ${res.equationUnicode} не уравнено`)
      const layout = scientificStageLayout(res.leftTerms, res.coProducts, res.productCompoundId, res.productCoeff, res.recipe?.productIndex)
      ok(layout.tally.equal, `${label}: счёт атомов на экране не сходится ${JSON.stringify(layout.tally.rows)}`)
      ok(layout.units.every((u) => u.atomCount > 0), `${label}: член без частиц`)
      ok(res.recipe?.stageOnly === true, `${label}: рецепт не stageOnly`)
      // органика v2: у экрана «шарами» есть синтез по атомному соответствию (кнопка запуска → SynthesisPlayer)
      const v2 = matchOrganicV2Reaction(ov2Index, { sourceId: organicV2IdFromBackHref(link.backHref), equation: res.equationUnicode })
      ok(v2, `${label}: нет синтеза v2 (реакции с атомным соответствием)`)
      if (v2) st.synth++
      for (const id of [...res.leftTerms.map((t) => t.compoundId), ...res.coProducts.map((t) => t.compoundId), res.productCompoundId]) {
        if (id && labSpeciesKind(id) === 'organic') organicIds.add(id)
      }
    }
  }
}
for (const id of organicIds) {
  const c = labCompoundById[id]
  ok(c, `${id}: нет частицы в labCompoundById`)
  if (c) for (const p of geometryProblems(id, c)) problems.push(p)
}
// частица восстанавливается по id (сохранённое состояние реактора)
{
  const sp = labOrganicSpeciesFor('CH3-CH2Cl', { C: 2, H: 5, Cl: 1 })
  ok(sp && labCompoundById[sp.compound.id]?.nameRu === 'Хлорэтан', 'org:CH3-CH2Cl по id — хлорэтан')
  ok(labCompoundById['org:C2H4O@ethylene-oxide']?.nameRu.startsWith('Этиленоксид'), 'org:C2H4O@ethylene-oxide по id — этиленоксид')
}
// изомер страницы из ссылки карточки: с. 61 — этиленоксид, с. 54 — циклопентан, с. 161 — α-глюкоза и фруктоза
{
  const g10 = JSON.parse(fs.readFileSync('src/data/textbook/equations-g10.json', 'utf8')) as {
    units: { reactions: { page: number | null; equationAscii: string; lab: { ok: boolean; href?: string } }[] }[]
  }
  const cards = g10.units.flatMap((u) => u.reactions)
  const namesOf = (page: number, ascii: string) => {
    const rx = cards.find((r) => r.page === page && r.equationAscii === ascii)
    if (!rx?.lab.ok || !rx.lab.href) return []
    const link = parseReactorLinkParams(new URLSearchParams(rx.lab.href.split('?')[1] ?? ''))
    const r = link ? resolveReactorEquation(link.spec) : null
    if (!r?.ok) return []
    return [...r.leftTerms.map((t) => t.compoundId), ...r.coProducts.map((t) => t.compoundId), r.productCompoundId].map(
      (id) => (id ? (labCompoundById[id]?.nameRu ?? id) : ''),
    )
  }
  ok(namesOf(61, '2C2H4 + O2 -> 2C2H4O').some((n) => n.startsWith('Этиленоксид')), 'с. 61: C₂H₄O — этиленоксид')
  ok(namesOf(54, 'BrCH2-CH2-CH2-CH2-CH2Br + Zn -> C5H10 + ZnBr2').includes('Циклопентан'), 'с. 54: C₅H₁₀ — циклопентан')
  const p161 = namesOf(161, 'C12H22O11 + H2O -> C6H12O6 + C6H12O6')
  ok(p161.some((n) => n.startsWith('α-Глюкоза')) && p161.includes('Фруктоза'), `с. 161: глюкоза и фруктоза (${p161.join(', ')})`)
}
// 7–9 классы: прежние формульные единицы не подменены
{
  const r = resolveReactorEquation({ equation: 'C2H5OH + 3O2 = 2CO2 + 3H2O' })
  ok(r.ok && r.leftTerms[0]?.compoundId === 'org_ethanol', 'C₂H₅OH 9 кл. — прежняя частица org_ethanol')
}

for (const g of [10, 11]) {
  const s = perGrade[g]!
  console.log(`g${g}: карточек ${s.cards} (без общих схем), органических в реакторе ${s.organic} (с синтезом v2 ${s.synth}), со второй кнопкой ${s.withAlt}`)
}
console.log(`органических частиц на экранах реакций: ${organicIds.size}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 60)) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`✓ органика книг в реакторе: ${checks} проверок пройдено`)
