/**
 * Компактный список единиц программы Kimyo 7–11 для инструментов учителя на сайте
 * (план урока / тест / проверка работы): src/learn/brain/remote/teacherUnits.json.
 *
 * Источник — src/data/kb/curriculum/kimyo-map.json (2,9 МБ, в сайт не тянем): берём только
 * id единицы (тот же, что ждёт сервер в /teacher/plan|test), класс, номер, вид, названия ru/uz/en,
 * подпись «Kimyo 8, §12» и главу. Запуск: npx tsx scripts/brain/build-teacher-units.mts [--check]
 *   --check — не писать, а сверить с уже лежащим файлом (код 1, если устарел).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type L3 = { ru?: string; uz?: string; en?: string }
type MapUnit = {
  id: string
  grade: string
  kp: string | number
  kind?: string
  title?: L3
  label?: L3
  chapter?: { num?: number; title?: L3 } | null
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const src = join(root, 'src', 'data', 'kb', 'curriculum', 'kimyo-map.json')
const out = join(root, 'src', 'learn', 'brain', 'remote', 'teacherUnits.json')

const map = JSON.parse(readFileSync(src, 'utf8')) as { grades: Record<string, { units: MapUnit[] }> }
const l3 = (x: L3 | undefined): { ru: string; uz: string; en: string } => ({
  ru: (x?.ru ?? '').trim(),
  uz: (x?.uz ?? x?.ru ?? '').trim(),
  en: (x?.en ?? x?.ru ?? '').trim(),
})

const units = Object.keys(map.grades).flatMap((g) =>
  map.grades[g]!.units.map((u) => ({
    id: u.id,
    g: u.grade || g,
    kp: String(u.kp),
    kind: u.kind ?? 'paragraph',
    t: l3(u.title),
    l: l3(u.label),
    ...(u.chapter && typeof u.chapter.num === 'number' ? { ch: { n: u.chapter.num, t: l3(u.chapter.title) } } : {}),
  })),
)

const json = JSON.stringify({ version: 1, source: 'kimyo-map.json', count: units.length, units }) + '\n'
if (process.argv.includes('--check')) {
  let cur = ''
  try {
    cur = readFileSync(out, 'utf8')
  } catch {
    // файла нет
  }
  if (cur !== json) {
    console.error(`teacherUnits.json устарел — пересоберите: npx tsx scripts/brain/build-teacher-units.mts`)
    process.exit(1)
  }
  console.log(`teacherUnits.json актуален: ${units.length} единиц`)
} else {
  writeFileSync(out, json)
  console.log(`teacherUnits.json: ${units.length} единиц, ${(json.length / 1024).toFixed(1)} КБ`)
}
