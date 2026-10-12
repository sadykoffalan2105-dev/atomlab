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

/** Главы 8–9 классов в карте только по-русски — переводы uz/en, чтобы в узбекском/английском интерфейсе не было кириллицы. */
const CH_I18N: Record<string, { uz: string; en: string; always?: boolean }> = {
  'Повторение основных понятий курса химии 7 класса': { uz: '7-sinf kimyo kursining asosiy tushunchalarini takrorlash', en: 'Review of the main concepts of grade 7 chemistry' },
  'Периодический закон и периодическая таблица элементов. Строение атома': { uz: 'Davriy qonun va elementlar davriy jadvali. Atom tuzilishi', en: 'The periodic law and the periodic table. Atomic structure' },
  'Общая характеристика элементов главной подгруппы шестой группы': { uz: 'VI guruh bosh guruhchasi elementlarining umumiy tavsifi', en: 'General properties of the group VI main-subgroup elements' },
  'Подгруппа азота': { uz: 'Azot guruhchasi', en: 'The nitrogen subgroup' },
  'Практические занятия и лабораторные опыты': { uz: 'Amaliy mashg‘ulotlar va laboratoriya tajribalari', en: 'Practical work and laboratory experiments' },
  'Повторение наиболее важных тем курса химии 8 класса': { uz: '8-sinf kimyo kursining eng muhim mavzularini takrorlash', en: 'Review of the key topics of grade 8 chemistry' },
  'Теория электролитической диссоциации': { uz: 'Elektrolitik dissotsilanish nazariyasi', en: 'Electrolytic dissociation theory' },
  'Неметаллы. Группа углерода': { uz: 'Metallmaslar. Uglerod guruhi', en: 'Nonmetals. The carbon group' },
  // в карте uz/en этих глав — словарные слова со строчной («kimyoviy bogʻ», «metal») — заменяем названиями глав
  'Химические связи': { uz: 'Kimyoviy bog‘lanish', en: 'Chemical bonding', always: true },
  'Неметаллы': { uz: 'Metallmaslar', en: 'Nonmetals', always: true },
  'Металлы': { uz: 'Metallar', en: 'Metals', always: true },
  'Обобщение знаний, полученных по неорганической химии': { uz: 'Anorganik kimyo bo‘yicha bilimlarni umumlashtirish', en: 'Summary of inorganic chemistry' },
}
const CYR = /[А-Яа-яЁё]/
const chL3 = (x: L3 | undefined) => {
  const v = l3(x)
  const tr = CH_I18N[v.ru]
  if (tr) {
    if (tr.always || !x?.uz || CYR.test(v.uz)) v.uz = tr.uz
    if (tr.always || !x?.en || CYR.test(v.en)) v.en = tr.en
  }
  return v
}

const units = Object.keys(map.grades).flatMap((g) =>
  map.grades[g]!.units.map((u) => ({
    id: u.id,
    g: u.grade || g,
    kp: String(u.kp),
    kind: u.kind ?? 'paragraph',
    t: l3(u.title),
    l: l3(u.label),
    ...(u.chapter && typeof u.chapter.num === 'number' ? { ch: { n: u.chapter.num, t: chL3(u.chapter.title) } } : {}),
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
