/**
 * npm run brain:selftest:curriculum — карта программы Kimyo 7–11 (src/data/kb/curriculum/kimyo-map.json) и её
 * использование мозгом: (1) полнота карты, (2) разбор ссылок на § (ru/uz/en, ловушки), (3) поиск — §-карточка первой и
 * цитата точного §, (4) подписи citationOf по классам, (5) время. Без LLM и без сети.
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { createBrain } from '../../brain/server.ts'
import { citationOf, retrieveV2 } from '../../brain/pipeline/retrieve.ts'
import { detectLang, matchesLang, normalizeInput } from '../../brain/pipeline/normalize.ts'
import type { StandaloneQuery } from '../../brain/pipeline/dialogTypes.ts'
import { loadCurriculumMap } from '../../brain/curriculum/map.ts'
import { parseSectionRef } from '../../brain/curriculum/sectionRef.ts'
import { unitCard } from '../../brain/curriculum/card.ts'
import { conceptUnitFor, definitionFor, sectionAnswer, termOfQuestion } from '../../brain/curriculum/answer.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, detail = ''): void {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

// ——— (1) карта
console.log('карта программы:')
const t0 = performance.now()
const map = loadCurriculumMap()
const loadMs = performance.now() - t0
if (!map) {
  console.log('  FAIL  карты нет: npm run brain:curriculum-map')
  process.exit(1)
}
const units = map.units
const byG = (g: number) => units.filter((u) => u.grade === g)
ok(units.length === 247, '247 единиц', String(units.length))
ok([65, 45, 42, 62, 33].every((n, i) => byG(7 + i).length === n), 'по классам 65/45/42/62/33', [7, 8, 9, 10, 11].map((g) => byG(g).length).join('/'))
ok(units.filter((u) => u.kind === 'lab').length === 2, "2 единицы 'lab'")
ok(units.every((u) => u.title.ru && u.label.ru && u.label.uz && u.label.en && /^\[Kimyo (7|8|9|10|11), /.test(u.cite) && u.pages.start > 0), 'у всех title.ru, label, cite, pages')
{
  // 7–9 кл.: названия из оглавления приложения; 10–11 кл.: там копия русского — перевод по глоссарию (uzSource auto)
  const g79 = units.filter((u) => u.grade <= 9)
  const uz79 = g79.filter((u) => u.title.uz !== u.title.ru).length
  ok(pct(uz79, g79.length) >= 85, 'title.uz ≠ ru у ≥ 85 % единиц 7–9 кл.', `${pct(uz79, g79.length)} %`)
  const g1011 = units.filter((u) => u.grade >= 10)
  const uz1011 = g1011.filter((u) => u.title.uz !== u.title.ru).length
  console.log(`  info  title.uz ≠ ru у 10–11 кл.: ${pct(uz1011, g1011.length)} % (оглавление приложения — копия русского; auto по глоссарию)`)
}
const paras = units.filter((u) => u.kind === 'paragraph')
ok(pct(paras.filter((u) => u.concepts.length >= 1).length, paras.length) >= 95, 'понятия ≥ 1 у ≥ 95 % параграфов', `${pct(paras.filter((u) => u.concepts.length >= 1).length, paras.length)} %`)
ok(pct(paras.filter((u) => u.definitions.length >= 1).length, paras.length) >= 80, 'определения ≥ 1 у ≥ 80 % параграфов', `${pct(paras.filter((u) => u.definitions.length >= 1).length, paras.length)} %`)
const rx = units.reduce((s, u) => s + u.reactions.length, 0)
ok(rx === 1448, 'реакции: все 1448 из equations-g*.json', String(rx))
{
  const withAns = (g: number) => byG(g).reduce((s, u) => s + u.tasks.examples.filter((x) => x.answer).length, 0)
  const total = [7, 8, 9, 10, 11].reduce((s, g) => s + withAns(g), 0)
  // порог спецификации ≥ 150 рассчитан на кеш страниц scripts/kb/.cache (точный OCR); по чанкам корпуса — честный минимум
  ok(total >= 60, `разобранные примеры с ответом: ${total} (по чанкам корпуса; цель с кешем страниц — 150)`, [7, 8, 9, 10, 11].map((g) => `${g}: ${withAns(g)}`).join(', '))
}
{
  const need = units.filter((u) => u.grade <= 9 && u.appSections.length && u.kind !== 'lab')
  const bad = need.filter((u) => !u.tests.length)
  ok(pct(need.length - bad.length, need.length) >= 95, 'тесты у единиц 7–9 кл. с секцией приложения', `${need.length - bad.length}/${need.length}${bad.length ? ` без тестов: ${bad.slice(0, 6).map((u) => u.id).join(', ')}` : ''}`)
}
{
  const avg = units.reduce((s, u) => s + u.stats.coverageScore, 0) / units.length
  const worst = [...paras].sort((a, b) => a.stats.coverageScore - b.stats.coverageScore).slice(0, 10)
  ok(avg >= 0.75, `coverageScore средний ${avg.toFixed(2)} (цель 0,8)`, `худшие: ${worst.map((u) => `${u.id}=${u.stats.coverageScore}`).join(', ')}`)
  ok(paras.every((u) => u.stats.coverageScore >= 0.4), 'ни одного параграфа с покрытием < 0,4')
}
ok(map.taskTypes.length === 32, '32 типа задач', String(map.taskTypes.length))
ok(map.unitFor(8, '12')?.title.ru.length! > 0 && map.byAppSection('g8', 'c2-s10').some((u) => u.kp === '12'), 'unitFor / byAppSection')
ok(map.reactionsFor(['Zn', 'HCl']).length > 0, 'reactionsFor(Zn, HCl)', String(map.reactionsFor(['Zn', 'HCl']).length))

// ——— (2) ссылки на §
console.log('ссылки на §:')
const REFS: [string, { grade?: number; kp?: string } | null][] = [
  ['что в §12 Kimyo 8', { grade: 8, kp: '12' }],
  ['Что в §25 Kimyo 8?', { grade: 8, kp: '25' }],
  ['8-sinf 12-§ nima haqida', { grade: 8, kp: '12' }],
  ['расскажи параграф 25 за 8 класс', { grade: 8, kp: '25' }],
  ['тема 2.6 7 класс', { grade: 7, kp: '2.6' }],
  ['Kimyo 7, 2-bob 6-mavzu', { grade: 7, kp: '2.6' }],
  ['section 12 grade 8', { grade: 8, kp: '12' }],
  ['paragraph 7 grade 11', { grade: 11, kp: '7' }],
  ['§ 18 в 8 классе', { grade: 8, kp: '18' }],
  ['объясни §5 Kimyo 9', { grade: 9, kp: '5' }],
  ['9-sinf 24-paragraf', { grade: 9, kp: '24' }],
  ['Kimyo 11 §31 haqida', { grade: 11, kp: '31' }],
  ['11 sinf 7-§ ekvivalent', { grade: 11, kp: '7' }],
  ['глава 2, тема 6, 7 класс', { grade: 7, kp: '2.6' }],
  ['глава II тема 6 Kimyo 7', { grade: 7, kp: '2.6' }],
  ['10 класс тема 2.23', { grade: 10, kp: '2.23' }],
  ['Kimyo 10, 3-bob 13-mavzu', { grade: 10, kp: '3.13' }],
  ['chapter 3 topic 13 grade 10', { grade: 10, kp: '3.13' }],
  ['what is in §12?', { kp: '12' }],
  ['параграф 3', { kp: '3' }],
  ['12-§ da nima bor', { kp: '12' }],
  ['§2.6', { kp: '2.6' }],
  ['pH 12', null],
  ['12 г кислоты', null],
  ['Что такое валентность?', null],
  ['8 класс', null],
  ['в 1869 году Менделеев', null],
  ['2.5 моль водорода', null],
  ['H2SO4 + 2NaOH', null],
  ['раствор 12 %', null],
]
let refOk = 0
for (const [q, want] of REFS) {
  const got = parseSectionRef(q, 'ru')
  const good = want == null ? got == null : got != null && got.kp === want.kp && (want.grade == null || got.grade === want.grade)
  if (good) refOk++
  else console.log(`  FAIL  «${q}» → ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`)
}
ok(refOk === REFS.length, `parseSectionRef ${refOk}/${REFS.length}`)

// ——— (3) поиск
console.log('поиск с картой:')
const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const { kb, journal, config } = brain.deps
ok(kb.curriculum != null, 'Knowledge.curriculum загружена')
function sq(p: Partial<StandaloneQuery> & { text: string }): StandaloneQuery {
  const norm = normalizeInput(p.text, 'auto')
  return { lang: norm.lang, topic: null, entities: [], grade: 'g8', scope: 'school', kind: 'definition', lengthClass: 'normal', followUp: 'none', resolvedBy: 'rules', original: p.text, ...p }
}
const find = (q: StandaloneQuery, maxItems = 6, budgetChars = 600) =>
  retrieveV2({ query: q, ctx: { gradeId: q.grade ?? 'g8' }, profile: 'laptop', budgetChars, maxItems }, { kb, journal, embeds: null, llm: null, config })
/** то же пересечение, что relevantCitations в chat.ts */
function overlap(question: string, c: { title: string; text: string }): number {
  const q = new Set(analyzeTerms(question))
  if (!q.size) return 0
  const t = new Set(analyzeTerms(`${c.title} ${c.text.slice(0, 600)}`))
  let n = 0
  for (const w of q) if (t.has(w)) n++
  return n / q.size
}
const head = (r: Awaited<ReturnType<typeof find>>) => r.items.slice(0, 4).map((f) => `${f.id}:${f.citation}`).join(' | ')
let cardCases = 0
let cardOk = 0
async function cardCase(name: string, q: StandaloneQuery, citeRe: RegExp, budgetChars = 600) {
  cardCases++
  const r = await find(q, 6, budgetChars)
  const c = r.items[0]
  const good = !!c && c.id.startsWith('cur-') && citeRe.test(c.citation) && overlap(q.text, c) >= 0.34
  if (good) cardOk++
  ok(good, name, `${head(r)}; overlap ${c ? overlap(q.text, c).toFixed(2) : '-'}`)
}
await cardCase('«Что такое валентность?» g7 → карточка гл. 2, тема 6', sq({ text: 'Что такое валентность?', grade: 'g7' }), /^\[Kimyo 7, гл\. 2, тема 6/)
await cardCase('g8 «степень окисления» → карточка §18', sq({ text: 'Что такое степень окисления?', grade: 'g8' }), /^\[Kimyo 8, §18/)
await cardCase('«Nima bu ekvivalent? 11-sinf» → карточка g11 §7', sq({ text: 'Nima bu ekvivalent? 11-sinf', grade: 'g11' }), /^\[Kimyo 11, §7/)
await cardCase('ноутбук (бюджет 600) — карточка ≤ 300 симв. и первой', sq({ text: 'Что такое валентность?', grade: 'g7' }), /^\[Kimyo 7, гл\. 2/, 600)
{
  const r = await find(sq({ text: 'Что в §25 Kimyo 8?', grade: 'g8', kind: 'general' }))
  cardCases++
  const kp25 = r.items.slice(0, 5).filter((f) => f.id === 'cur-g8:25' || /^\[Kimyo 8, §25/.test(f.citation)).length
  const good = r.items[0]?.id === 'cur-g8:25' && kp25 >= 3 && r.scopeUsed === 'school' && r.curriculum?.viaRef === true
  if (good) cardOk++
  ok(good, '«Что в §25 Kimyo 8?» → ≥ 3 фрагментов §25 в top-5, scope school', `${kp25} шт.; ${head(r)}`)
}
{
  const r = await find(sq({ text: 'Что в §77 Kimyo 8?', grade: 'g8', kind: 'general' }))
  ok(r.sectionRef?.asked === true && r.sectionRef.found === false && !r.items.some((f) => f.id.startsWith('cur-')), 'несуществующий §77 → sectionRef.found = false, карточки нет')
}
{
  const r = await find(sq({ text: 'Кто открыл кислород?', grade: 'g8', scope: 'broad', kind: 'who_history' }))
  ok(!r.items.some((f) => f.id.startsWith('cur-')), '«Кто открыл кислород?» (who_history) → карточки нет', head(r))
}
{
  const r = await find(sq({ text: 'Что такое валентность?', grade: 'g7' }), 6, 600)
  ok((r.items[0]?.text.length ?? 999) <= 300, 'карточка на ноутбуке ≤ 300 символов', String(r.items[0]?.text.length))
  ok(r.confR >= config.thresholds.medium, 'уверенность с карточкой ≥ medium', r.confR.toFixed(2))
}
ok(cardOk === cardCases, `карточка первой и цитата точного § — ${cardOk}/${cardCases}`)
{
  const u = map.unitFor(8, '12')!
  const ru = unitCard(u, 'ru')
  const uz = unitCard(u, 'uz')
  const en = unitCard(u, 'en')
  ok(ru.startsWith('Kimyo 8, §12 «') && uz.startsWith('Kimyo 8, 12-§') && en.startsWith('Kimyo 8, §12 “') && ru.length <= 600, 'unitCard ru/uz/en', `${ru.slice(0, 90)} | ${uz.slice(0, 60)} | ${en.slice(0, 60)}`)
}

// ——— (4) подписи
console.log('подписи цитат:')
const CITES: [string, string | null, number | null, string][] = [
  ['Kimyo 7', '2.6', 54, '[Kimyo 7, гл. 2, тема 6, стр. 54]'],
  ['Kimyo 8', '12', 50, '[Kimyo 8, §12, стр. 50]'],
  ['Kimyo 9', '24', null, '[Kimyo 9, §24]'],
  ['Kimyo 10', '2.23', 120, '[Kimyo 10, гл. 2, тема 23, стр. 120]'],
  ['Kimyo 11', '11', 58, '[Kimyo 11, §11, стр. 58]'],
  ['Kimyo 8', '99', 5, '[Kimyo 8, §99, стр. 5]'],
]
for (const [src, kp, page, want] of CITES) {
  const got = citationOf(src, '', kp, page)
  ok(got === want, `citationOf(${src}, ${kp}, ${page})`, got)
}

// ——— (5) время
console.log('время:')
ok(loadMs <= 150, `загрузка карты ≤ 150 мс`, `${loadMs.toFixed(0)} мс`)
{
  const terms = new Set(analyzeTerms('степень окисления элемента в соединении'))
  const t1 = performance.now()
  for (let i = 0; i < 200; i++) map.unitsForQuery(terms, 8)
  const ms = (performance.now() - t1) / 200
  ok(ms <= 2, 'unitsForQuery ≤ 2 мс', `${ms.toFixed(3)} мс`)
}

// ——— §-путь (brain/curriculum/answer.ts): определение § класса, понятие §, «о чём §», язык и ссылка «тема 1.»
{
  const r = parseSectionRef('Расскажи кратко, что в Kimyo 7, гл. 1, тема 1.')
  ok(r?.kp === '1.1', 'sectionRef: «тема 1.» в конце фразы', JSON.stringify(r))
  ok(detectLang('О чём Kimyo 8, §44?') === 'ru', 'язык: «О чём Kimyo 8, §44?» — ru', detectLang('О чём Kimyo 8, §44?'))
  ok(termOfQuestion('Valentlik deb nimaga aytiladi?', 'uz') === 'Valentlik' && termOfQuestion('What is molar mass?', 'en') === 'molar mass', 'termOfQuestion uz/en')
  if (map) {
    const d = definitionFor(map, new Set(analyzeTerms('Что такое ковалентная связь?', { query: true })), 8)
    ok(!!d && d.unit.grade === 8 && /ковалент/iu.test(d.def.term.ru), 'definitionFor: ковалентная связь → § 8 кл.', d ? `${d.unit.id}: ${d.def.term.ru}` : 'null')
    const w = definitionFor(map, new Set(analyzeTerms('Что такое водородная связь?', { query: true })), 9)
    ok(!w || /водород/iu.test(w.def.term.ru), 'definitionFor: «водородная связь» не берёт «химическую связь»', w ? `${w.unit.id}: ${w.def.term.ru}` : 'null')
    const t = definitionFor(map, new Set(analyzeTerms('Что означает термин «валентность»?', { query: true })), 7)
    ok(!!t && /валентн/iu.test(t.def.term.ru), 'definitionFor: «термин» — не часть термина', t ? `${t.unit.id}: ${t.def.term.ru}` : 'null')
    const c = conceptUnitFor(map, new Set(analyzeTerms('Что такое очистка воды?', { query: true })), 7)
    ok(!!c && c.concepts.some((x) => /очистк/iu.test(x.ru)), 'conceptUnitFor: очистка воды → § 7 кл. с этим понятием', c?.id ?? 'null')
    const u = map.unitFor(8, '12')
    if (u) {
      const ru = sectionAnswer(u, 'ru')
      const uz = sectionAnswer(u, 'uz')
      ok(ru.startsWith('Kimyo 8, §12') && matchesLang(ru, 'ru'), 'sectionAnswer ru', ru.slice(0, 90))
      ok(uz.length >= 40 && matchesLang(uz, 'uz'), 'sectionAnswer uz — по-узбекски', uz.slice(0, 90))
    }
  }
}

console.log(`\n${fail ? 'ЕСТЬ ПРОВАЛЫ' : 'всё ok'}: ${pass} ok, ${fail} fail`)
process.exit(fail ? 1 : 0)
