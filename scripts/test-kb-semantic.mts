/**
 * Проверка ML-поиска учителя (src/learn/kb/semantic.ts + src/data/kb/index/kb-vectors.json).
 *
 *   npx tsx scripts/test-kb-semantic.mts
 *
 * 1) соседи осмысленны: не меньше 15 из 20 терминов имеют ожидаемого соседа в топ-5;
 * 2) expandQuery для опечаток/синонимов даёт нужную основу (и не подставляет антонимы);
 * 3) rerankHits без векторов не меняет порядок, с векторами — сохраняет состав и длину;
 * 4) движок с хуками не падает и ищет не хуже: опечатка находит тот же § что и правильное слово.
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../src/learn/kb/analyzer.ts'
import { loadEngine } from './kb/lib/evalRun.mts'
import {
  expandQuery,
  nearestTerms,
  rerankHits,
  semanticReady,
  semanticVocabSize,
  setSemanticVectors,
  vectorOfQuery,
  cosine,
  type KbVectorsFile,
} from '../src/learn/kb/semantic.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const VECTORS = path.join(ROOT, 'src', 'data', 'kb', 'index', 'kb-vectors.json')

let failed = 0
function check(ok: boolean, msg: string) {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`)
}
const stem = (w: string) => analyzeTerms(w)[0] ?? w

// ---------------------------------------------------------------- 3a. без векторов — порядок не меняется
{
  const hits = [
    { id: 'a', text: 'оксиды это сложные вещества', score: 3 },
    { id: 'b', text: 'кислоты это сложные вещества', score: 2 },
    { id: 'c', text: 'соли это сложные вещества', score: 1 },
  ]
  const out = rerankHits('что такое оксиды', hits)
  check(!semanticReady() && out.map((h) => h.id).join('') === 'abc', 'rerankHits без векторов возвращает исходный порядок')
  check(expandQuery(['оксид']).length === 0, 'expandQuery без векторов пуст')
  check(nearestTerms('оксид').length === 0, 'nearestTerms без векторов пуст')
}

// ---------------------------------------------------------------- загрузка
const file = JSON.parse(fs.readFileSync(VECTORS, 'utf8')) as KbVectorsFile
setSemanticVectors(file)
const bytes = fs.statSync(VECTORS).size
check(semanticReady() && semanticVocabSize() >= 5000, `векторы загружены: ${semanticVocabSize()} основ × ${file.dim}`)
check(bytes <= 1.2 * 1024 * 1024, `kb-vectors.json ≤ 1,2 МБ (${(bytes / 1024).toFixed(0)} КБ)`)

// ---------------------------------------------------------------- 1. соседи
const NEIGHBOR_EXPECT: [string, string[]][] = [
  ['кислота', ['серн', 'солян', 'азотн', 'щавелев', 'салицилов', 'кислотн', 'hcl', 'h2so4', 'уксусн']],
  ['щёлочь', ['гидроксид', 'naoh', 'koh', 'нейтрализац', 'основан', 'избытк', 'раствор', 'цинкат', 'фенолят']],
  ['оксид', ['so2', 'co2', 'cao', 'sno', 'beo', 'n2o3', 'sb2o3', 'iv', 'оксидн']],
  ['валентность', ['двухвалент', 'индекс', 'равн', 'определя', 'трехвалент', 'одновалент', 'валентн']],
  ['моль', ['литр', 'объ', 'умнож', 'мол', 'масс', 'количеств', 'грамм', 'определ']],
  ['электролит', ['electrolyte', 'elektrolit', 'электролит', 'диссоциац', 'электролитическ', 'неэлектролит']],
  ['катализатор', ['давлен', 'температур', 'нагреван', 'платин', 'ускоря', 'скорост', 'атмосферн', 'катализ']],
  ['восстановитель', ['окислител', 'отда', 'qaytaruvchi', 'электрон', 'восстановлен', 'oksidlanadi']],
  ['галоген', ['галоген', 'неметалл', 'viia', 'халког', 'инертн', 'фтор', 'хлор', 'бром']],
  ['изотоп', ['изобар', 'изотон', 'дейтер', 'трит', 'нейтрон', 'массов', 'ядр']],
  ['окислитель', ['восстановител', 'qaytaruvchi', 'oksidlovchi', 'электрон', 'принима', 'окислен']],
  ['основание', ['слаб', 'nh4oh', 'гидроксид', 'щелоч', 'катион', 'кислот', 'сильн']],
  ['соль', ['хлорид', 'сульф', 'натр', 'кал', 'нитрат', 'карбонат', 'кислот']],
  ['раствор', ['растворен', 'мл', 'гр', 'концентрац', 'растворител', 'вод', 'массов']],
  ['металл', ['активн', 'неметалл', 'металлическ', 'metal', 'щелочн', 'ряд', 'вытесня']],
  ['молекула', ['связ', 'соедин', 'атом', 'ковалентн', 'ат', 'состо', 'ион']],
  ['атомы', ['ат', 'ядр', 'протон', 'электрон', 'нейтрон', 'электронейтральн', 'нулев']],
  ['индикатор', ['фенолфталеин', 'лакмус', 'метилоранж', 'универсальн', 'малинов', 'окраск', 'цвет']],
  ['водород', ['кислород', 'вытесн', 'гремуч', 'замест', 'h2', 'азот', 'сгора']],
  ['acid', ['кислот', 'kislota', 'sulfuric', 'nitric', 'hydrochloric', 'pentanoic', 'palmitic', 'adipic', 'carbonic']],
]
let good = 0
for (const [word, expect] of NEIGHBOR_EXPECT) {
  const s = stem(word)
  const top = nearestTerms(s, 5)
  const hit = top.some((n) => expect.includes(n.term))
  if (hit) good += 1
  console.log(`  ${hit ? '+' : '-'} ${word} (${s}): ${top.map((n) => `${n.term} ${n.cos.toFixed(2)}`).join(', ')}`)
}
check(good >= 15, `соседи осмысленны: ${good}/20 терминов имеют ожидаемого соседа в топ-5`)

// ---------------------------------------------------------------- 2. расширение запроса
const { engine } = loadEngine()
const df = (t: string) => engine.termDf(t)

type Case = { query: string; want: string; forbid?: string }
const CASES: Case[] = [
  { query: 'валентнось', want: 'валентн' },
  { query: 'щелочь', want: 'щелоч' },
  { query: 'кислата', want: 'кислот' },
  { query: 'малярная маса', want: 'молярн' },
  { query: 'малярная маса', want: 'масс' },
  { query: 'расстворимость', want: 'растворим' },
  { query: 'индекатор', want: 'индикатор' },
  { query: 'каталезатор', want: 'катализатор' },
  { query: 'степень акисления', want: 'окислен' },
  { query: 'переодическая система', want: 'периодическ' },
  { query: 'гедроксид', want: 'гидроксид' },
  { query: 'электроотрецательность', want: 'электроотрицательн' },
  { query: 'алотропия', want: 'аллотроп' },
  { query: 'дисоциация', want: 'диссоциац' },
  { query: 'нитрализация', want: 'нейтрализац' },
  { query: 'изатоп', want: 'изотоп' },
  { query: 'малекула', want: 'молекул' },
  { query: 'кислорот', want: 'кислород' },
  { query: 'углирод', want: 'углерод' },
  { query: 'аснование', want: 'основан' },
  { query: 'риакция', want: 'реакц' },
  { query: 'сульфад', want: 'сульфат' },
  { query: 'гелоген', want: 'галог' },
  { query: 'електролит', want: 'электрол' }, // основа слова «электролит» в индексе — «электрол»
  { query: 'амфатерный', want: 'амфотерн' },
  { query: 'катализатар', want: 'катализатор' },
  { query: 'валентнасть', want: 'валентн' },
  { query: 'оксит', want: 'оксид' },
  { query: 'галогены', want: 'галоген' }, // морфологический вариант основы «галог»
  { query: 'атом', want: 'атом' }, // «ат» → «атом»
  { query: 'электролит', want: 'электролит' }, // «электрол» → «электролит»
  { query: 'окислитель', want: 'окислител', forbid: 'восстановител' },
  { query: 'восстановитель', want: 'восстановител', forbid: 'окислител' },
  { query: 'кислота', want: 'кислот', forbid: 'щелоч' },
  { query: 'металлы', want: 'металл', forbid: 'неметалл' },
  { query: 'pH', want: 'показател' }, // через лексикон индекса (en:ph → «водородн показател») + векторы
]
let expOk = 0
for (const c of CASES) {
  const q = engine.analyzeQuery(c.query, 'ru')
  const stems = q.terms.map((t) => t.term)
  const extra = expandQuery(stems, df)
  const all = new Set([...stems, ...extra.map((e) => e.term)])
  const ok = all.has(c.want) && (!c.forbid || !all.has(c.forbid))
  if (ok) expOk += 1
  console.log(
    `  ${ok ? '+' : '-'} «${c.query}» → [${stems.join(', ')}] + {${extra.map((e) => `${e.term}:${e.weight.toFixed(2)}/${e.why}`).join(', ')}}` +
      (ok ? '' : ` — нужно «${c.want}»${c.forbid ? `, нельзя «${c.forbid}»` : ''}`),
  )
}
check(expOk >= CASES.length - 3, `expandQuery: ${expOk}/${CASES.length} случаев дают нужную основу (без антонимов)`)

// антонимы никогда не добавляются
{
  const extra = expandQuery(['окислител'], df).map((e) => e.term)
  check(!extra.includes('восстановител'), 'окислитель не расширяется до восстановителя')
}

// ---------------------------------------------------------------- 3b. с векторами
{
  const hits = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, text: i % 2 ? 'кислоты и соли, реакция нейтрализации' : 'оксиды металлов и неметаллов', score: 12 - i }))
  const out = rerankHits('что такое оксиды', hits)
  check(out.length === hits.length && new Set(out.map((h) => h.id)).size === 12, 'rerankHits с векторами сохраняет состав')
  check(out.every((h, i) => i === 0 || out[i - 1].score >= h.score), 'rerankHits сортирует по убыванию score')
  const q1 = vectorOfQuery('оксиды металлов')
  const q2 = vectorOfQuery('кислоты и основания')
  const q3 = vectorOfQuery('оксид металла')
  check(!!q1 && !!q2 && !!q3 && cosine(q1, q3) > cosine(q1, q2), 'вектор запроса: «оксиды металлов» ближе к «оксид металла», чем к «кислоты и основания»')
}

// ---------------------------------------------------------------- 4. движок с хуками: опечатки находят тот же параграф
const PAIRS: [string, string, number][] = [
  ['что такое валентность', 'что такое валентнось', 7],
  ['что такое индикаторы', 'что такое индекаторы', 7],
  ['что такое оксиды', 'что такое окситы', 8],
  ['электролитическая диссоциация', 'електролитическая дисоциация', 9],
  ['периодическая система элементов', 'переодическая система элементов', 8],
  ['молярная масса', 'малярная маса', 8],
]
let same = 0
for (const [goodQ, typoQ, grade] of PAIRS) {
  const a = engine.search(goodQ, { grade, limit: 5, locale: 'ru' })
  const b = engine.search(typoQ, { grade, limit: 5, locale: 'ru' })
  const keyOf = (h: { grade: number | null; chapterId?: string; sectionId?: string; kp?: string }) => `${h.grade}:${h.chapterId ?? ''}:${h.sectionId ?? h.kp ?? ''}`
  const ka = new Set(a.map(keyOf))
  const ok = b.some((h) => ka.has(keyOf(h)))
  if (ok) same += 1
  console.log(`  ${ok ? '+' : '-'} «${typoQ}» ≈ «${goodQ}»: ${b.slice(0, 2).map((h) => h.title).join(' | ')}`)
}
check(same >= PAIRS.length - 1, `опечатки находят тот же параграф: ${same}/${PAIRS.length}`)

// задержка
{
  const t0 = performance.now()
  let n = 0
  for (let i = 0; i < 40; i += 1) for (const q of ['что такое кислоты', 'степень окисления серы', 'получение водорода в лаборатории']) {
    engine.search(q, { grade: 8, limit: 8, locale: 'ru' })
    n += 1
  }
  const ms = (performance.now() - t0) / n
  check(ms < 25, `поиск с семантикой: ${ms.toFixed(2)} мс на запрос (кеш прогрет)`)
}

console.log(failed ? `\n${failed} проверок не прошли` : '\nвсе проверки пройдены')
process.exit(failed ? 1 : 0)
