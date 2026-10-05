/**
 * Органика v2 в реакторе лаборатории: таблица соответствия «карточка учебника → реакция v2» и её покрытие.
 *
 *  1) каждая органическая карточка «Реакции учебника» (equations-g10/g11.json, вместе с общими схемами)
 *     открывается в реакторе (stageOnly 'organic') и сопоставлена с реакцией v2 (src/lab/organicV2Bridge.ts)
 *     — или честно стоит в списке исключений с причиной; покрытие 10 кл. ≥ 300 из 312;
 *  2) сопоставление по ссылке учебника согласовано с уравнением (состав органических участников совпал),
 *     расхождения — только у общих схем (там пример v2 и пример реактора могут отличаться);
 *  3) неорганические карточки не сопоставляются (их синтез — прежний, не трогаем);
 *  4) уравнения 7–9 кл. с органикой (CH₄ + 2O₂, C₂H₅OH + 3O₂ …) тоже находят реакцию v2 по составу.
 *
 * Run: npx tsx scripts/test-organic-v2-reactor.mts
 */
import fs from 'node:fs'
import { buildOrganicV2Index, equationKeys, matchOrganicV2Reaction, organicV2IdFromBackHref, ov2ReactionKeys } from '../src/lab/organicV2Bridge.ts'
import { parseReactorLinkParams, resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'
import type { OV2ReactionsFile } from '../src/data/organicV2/types.ts'

const problems: string[] = []
let checks = 0
const ok = (cond: unknown, msg: string) => {
  checks++
  if (!cond) problems.push(msg)
}

const file = JSON.parse(fs.readFileSync('src/data/organicV2/reactions.json', 'utf8')) as OV2ReactionsFile
const index = buildOrganicV2Index(file.reactions)

/** Карточки, у которых синтеза v2 нет, — с причиной (их реактор показывает «шарами»). */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  'g10-c3-s20-r4':
    'общая схема (C₆H₁₀O₅)n + n/2 H₂O → n/2 C₁₂H₂₂O₁₁: гидролиза крахмала до мальтозы в данных v2 нет (есть мальтоза → 2 глюкозы, с. 165 r5)',
}

type Card = { id: string; page: number | null; equation: string; equationAscii: string; isGeneralScheme: boolean; lab: { ok: boolean; reason?: string; href?: string } }
type Row = { key: string; grade: number; how: string; ov2: string; eq: string; general: boolean; agree: boolean }
const rows: Row[] = []
type Stat = { cards: number; open: number; organic: number; matched: number; inorganic: number; source: number; equation: number; organicPart: number; exc: number }
const stat: Record<number, Stat> = {}
for (const grade of [10, 11]) {
  const book = JSON.parse(fs.readFileSync(`src/data/textbook/equations-g${grade}.json`, 'utf8')) as { units: { unitId: string; reactions: Card[] }[] }
  const st: Stat = (stat[grade] = { cards: 0, open: 0, organic: 0, matched: 0, inorganic: 0, source: 0, equation: 0, organicPart: 0, exc: 0 })
  for (const u of book.units) {
    for (const rx of u.reactions) {
      st.cards++
      const key = `g${grade}-${u.unitId}-${rx.id}`
      const label = `${key} (с. ${rx.page}) ${rx.equation}`
      if (!rx.lab.ok || !rx.lab.href) {
        ok(rx.lab.reason === 'nuclear' || rx.lab.reason === 'scheme', `${label}: не открывается (${rx.lab.reason})`)
        continue
      }
      st.open++
      const link = parseReactorLinkParams(new URLSearchParams(rx.lab.href.split('?')[1] ?? ''))
      ok(link, `${label}: ссылка не разбирается`)
      if (!link) continue
      const r = resolveReactorEquation(link.spec)
      ok(r.ok, `${label}: резолвер ${r.ok ? '' : r.code}`)
      if (!r.ok) continue
      const sourceId = organicV2IdFromBackHref(link.backHref)
      ok(sourceId === key, `${label}: id из src ${sourceId} ≠ ${key}`)
      if (r.stageOnly !== 'organic') {
        // неорганика: синтез прежний; мост для неё не вызывается (страница зовёт его только при stageOnly 'organic')
        st.inorganic++
        continue
      }
      st.organic++
      const m = matchOrganicV2Reaction(index, { sourceId, equation: r.equationUnicode })
      if (!m) {
        if (EXCEPTIONS[key]) st.exc++
        else problems.push(`${label}: нет реакции v2 (уравнение реактора ${r.equationUnicode})`)
        continue
      }
      ok(!EXCEPTIONS[key], `${key}: сопоставлена (${m.reaction.id}), а стоит в исключениях — убрать`)
      st.matched++
      st[m.how]++
      const ek = equationKeys(r.equationUnicode)
      const vk = ov2ReactionKeys(m.reaction)
      const agree = ek != null && (ek.full === vk.full || ek.organic === vk.organic)
      rows.push({ key, grade, how: m.how, ov2: m.reaction.id, eq: r.equationUnicode, general: rx.isGeneralScheme, agree })
      ok(
        agree || rx.isGeneralScheme,
        `${label}: реакция v2 ${m.reaction.id} «${m.reaction.equation}» не совпадает с уравнением реактора ${r.equationUnicode}`,
      )
    }
  }
}

// ── 4) 7–9 кл. и каталог: по составу ──
const BY_EQUATION: [string, string][] = [
  ['CH4 + 2O2 = CO2 + 2H2O', 'combustion'],
  ['C2H5OH + 3O2 = 2CO2 + 3H2O', 'combustion'],
  ['CH2=CH2 + Br2 -> CH2Br-CH2Br', 'halogenation'],
  ['HC≡CH + H2O -> CH3-CHO', 'hydration'],
  ['CH3COOH + C2H5OH -> CH3COOC2H5 + H2O', 'esterification'],
  ['CH4 + Cl2 -> CH3Cl + HCl', 'substitutionRadical'],
]
for (const [eq, type] of BY_EQUATION) {
  const r = resolveReactorEquation({ equation: eq })
  ok(r.ok && r.stageOnly === 'organic', `${eq}: не органика в реакторе`)
  const m = matchOrganicV2Reaction(index, { equation: r.ok ? r.equationUnicode : eq })
  ok(m && m.reaction.type === type, `${eq}: ожидалась реакция v2 типа ${type}, получено ${m ? `${m.reaction.id} (${m.reaction.type})` : 'null'}`)
}
// неорганика не сопоставляется ни с чем органическим
for (const eq of ['2H2 + O2 -> 2H2O', 'CaCO3 -> CaO + CO2', 'NaOH + HCl -> NaCl + H2O']) {
  const m = matchOrganicV2Reaction(index, { equation: eq })
  ok(m == null, `${eq}: неорганика сопоставилась с ${m?.reaction.id}`)
}
// id из src
ok(organicV2IdFromBackHref('/learn/g/g10/book?page=26&unit=c1-s06&rx=r2') === 'g10-c1-s06-r2', 'id из src')
ok(organicV2IdFromBackHref('/learn/g/g9/book?unit=c1') == null, 'src 9 кл. — не органика v2')

const s10 = stat[10]!
const COVER_MIN = 300
ok(s10.matched >= COVER_MIN, `покрытие 10 кл.: ${s10.matched} из ${s10.cards} < ${COVER_MIN}`)
for (const g of [10, 11]) {
  const s = stat[g]!
  console.log(
    `g${g}: карточек ${s.cards}, открываются ${s.open}, органических ${s.organic} → синтез v2 ${s.matched} ` +
      `(по ссылке ${s.source}, по уравнению ${s.equation}, по органическим участникам ${s.organicPart}), исключений ${s.exc}, неорганических ${s.inorganic}`,
  )
}
const disagree = rows.filter((r) => !r.agree)
if (disagree.length) {
  console.log(`общие схемы: пример v2 ≠ пример реактора — ${disagree.length}:`)
  for (const r of disagree) console.log(`  ${r.key} → ${r.ov2}: ${r.eq}`)
}
fs.mkdirSync('.tmp', { recursive: true })
fs.writeFileSync('.tmp/organic-v2-reactor-map.json', JSON.stringify(rows, null, 1))
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems.slice(0, 80)) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`✓ органика v2 в реакторе: ${checks} проверок пройдено`)
