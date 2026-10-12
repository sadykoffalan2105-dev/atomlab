/**
 * npm run brain:calc-mine — задачи с ответами из учебников Kimyo 7–11 → brain/calc/fixtures/textbook.jsonl.
 * Источник: src/data/kb/corpus/kb-corpus-g{7..11}.json, блоки «Пример N. … Решение … Ответ: …» и «Задача … Ответ: …».
 * Фильтр OCR-мусора: доля букв в условии ≥ 0,6, в ответе есть число (с единицей). Всё найденное пишется с checked:false
 * (сырьё — только отчёт в селфтесте); выверенные вручную задачи переносятся из прежнего файла как есть (checked:true —
 * по id не перезаписываются). --dry — только статистика.
 */
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../../brain/kb/shards.ts'

type Chunk = { id: string; grade: number; kp: string; type: string; text: string; pageStart?: number }
type Fixture = { id: string; grade: number; kp: string; source: 'example' | 'exercise' | 'labTask'; lang: 'ru'; statement: string; expect: { value: number; unit?: string; tol: { rel: number; abs: number } }[]; loose?: boolean; type?: string; checked?: boolean; page?: number }

const OUT = path.join(REPO_ROOT, 'brain', 'calc', 'fixtures', 'textbook.jsonl')
const dry = process.argv.includes('--dry')

const prev: Fixture[] = fs.existsSync(OUT)
  ? fs
      .readFileSync(OUT, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Fixture)
  : []
const keep = prev.filter((f) => f.checked)
const keepIds = new Set(keep.map((f) => f.id))

const letterShare = (s: string) => (s.match(/\p{L}/gu)?.length ?? 0) / Math.max(1, s.replace(/\s+/g, '').length)
const UNIT = /(г|кг|мг|л|мл|моль|%|г\/моль|моль\/л|кДж|Кл|А|ч|мин|с)(?![\p{L}])/u

function answers(ans: string): { value: number; unit?: string }[] {
  const out: { value: number; unit?: string }[] = []
  for (const m of ans.matchAll(/(\d+(?:[.,]\d+)?)\s*(г\/моль|моль\/л|кДж|моль|кг|мг|мл|г|л|%|Кл)?(?![\p{L}\d])/gu)) {
    const v = Number(m[1]!.replace(',', '.'))
    if (Number.isFinite(v)) out.push({ value: v, unit: m[2] })
  }
  return out
}

const found: Fixture[] = []
const stat: Record<number, { blocks: number; kept: number }> = {}
for (const g of [7, 8, 9, 10, 11]) {
  const file = path.join(REPO_ROOT, 'src', 'data', 'kb', 'corpus', `kb-corpus-g${g}.json`)
  if (!fs.existsSync(file)) continue
  const chunks = (JSON.parse(fs.readFileSync(file, 'utf8')) as { chunks: Chunk[] }).chunks
  stat[g] = { blocks: 0, kept: 0 }
  let n = 0
  for (const c of chunks) {
    const text = c.text.replace(/\s+/g, ' ')
    // «Пример 2. <условие> Решение. … Ответ: …»
    for (const m of text.matchAll(/(Пример|Задача)\s*(\d*)\s*[.:]\s*(.{15,500}?)\s*(?:Решение|Дано)\s*[.:]?(.{0,900}?)Ответ\s*[:.]\s*([^.;]{1,120})/gu)) {
      stat[g]!.blocks++
      const statement = m[3]!.trim()
      const ans = answers(m[5]!)
      if (letterShare(statement) < 0.6 || !ans.length || !UNIT.test(m[5]!)) continue
      if (!/\d/.test(statement)) continue
      const id = `g${g}-§${c.kp}-${m[1] === 'Пример' ? 'ex' : 'ta'}${m[2] || ++n}`
      if (keepIds.has(id) || found.some((f) => f.id === id)) continue
      found.push({
        id,
        grade: g,
        kp: c.kp,
        source: m[1] === 'Пример' ? 'example' : 'exercise',
        lang: 'ru',
        statement,
        expect: ans.slice(0, 2).map((a) => ({ value: a.value, ...(a.unit ? { unit: a.unit } : {}), tol: { rel: 0.01, abs: 0.01 } })),
        checked: false,
        page: c.pageStart,
      })
      stat[g]!.kept++
    }
  }
}
for (const [g, s] of Object.entries(stat)) console.log(`Kimyo ${g}: блоков «Пример/Задача … Ответ» ${s.blocks}, прошли фильтр ${s.kept}`)
console.log(`выверенных (checked) сохранено: ${keep.length}; сырых новых: ${found.length}`)
if (!dry) {
  fs.writeFileSync(OUT, [...keep, ...found].map((f) => JSON.stringify(f)).join('\n') + '\n')
  console.log(`→ ${path.relative(REPO_ROOT, OUT)}`)
}
