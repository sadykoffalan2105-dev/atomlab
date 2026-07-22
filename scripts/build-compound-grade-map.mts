/**
 * Строит полную карту классов (7–9) для всех веществ каталога.
 * Источники: Kimyo g7–g9 (текст §), манифест программы, правила ФГОС.
 *
 * Запуск: npx tsx scripts/build-compound-grade-map.mts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compoundById } from '../src/data/compounds.ts'
import { CURRICULUM_COMPOUNDS } from '../src/data/curriculum/schoolInorganicManifest.ts'
import g7 from '../src/data/g7TextbookKnowledge.json' with { type: 'json' }
import g8 from '../src/data/g8TextbookKnowledge.json' with { type: 'json' }
import g9 from '../src/data/g9TextbookKnowledge.json' with { type: 'json' }
import type { CompoundDef } from '../src/types/chemistry.ts'

type Grade = 7 | 8 | 9
type Chapter =
  | 'вода'
  | 'оксиды'
  | 'кислоты'
  | 'основания'
  | 'соли'
  | 'металлы'
  | 'неметаллы'
  | 'кислород'
  | 'водород'
  | 'качественные'
  | 'азот'
  | 'сера'
  | 'фосфор'
  | 'хром'
  | 'хлор'
  | 'марганец'
  | 'кремний'
  | 'катализ'
  | 'прочее'

type Entry = { grades: Grade[]; chapter: Chapter }

const SUB = '₀₁₂₃₄₅₆₇₈₉'

function toAsciiFormula(f: string): string {
  let s = f
  for (let i = 0; i <= 9; i++) {
    s = s.split(SUB[i]!).join(String(i))
  }
  return s
    .replace(/·/g, '')
    .replace(/₂/g, '2')
    .replace(/₃/g, '3')
    .replace(/₄/g, '4')
    .replace(/₅/g, '5')
    .replace(/₆/g, '6')
    .replace(/₇/g, '7')
    .replace(/₈/g, '8')
    .replace(/₉/g, '9')
    .replace(/⁺/g, '+')
    .replace(/⁻/g, '-')
    .replace(/\s/g, '')
}

function textbookBlob(grade: Grade): string {
  const raw = grade === 7 ? g7 : grade === 8 ? g8 : g9
  const sections = (raw as { sections: { contentRu: string }[] }).sections
  return sections
    .filter((s) => (s.contentRu?.length ?? 0) > 120)
    .map((s) => s.contentRu)
    .join('\n')
    .toLowerCase()
}

const TB = {
  7: textbookBlob(7),
  8: textbookBlob(8),
  9: textbookBlob(9),
} as const

function mentionedInTextbook(c: CompoundDef, grade: Grade): boolean {
  const blob = TB[grade]
  const f = c.formulaUnicode
  const ascii = toAsciiFormula(f).toLowerCase()
  const patterns = [f.toLowerCase(), ascii, c.nameRu.toLowerCase()]
  if (c.id === 'nacl') patterns.push('nacl', 'поваренн', 'хлорид натрия')
  if (c.id === 'h2o') patterns.push('h2o', ' h₂o', 'вод')
  if (c.id.startsWith('salt_')) {
    const tail = c.id.replace('salt_', '').replace(/_/g, '')
    patterns.push(tail)
  }
  return patterns.some((p) => p.length >= 2 && blob.includes(p))
}

function gradesFromTextbook(c: CompoundDef): Grade[] {
  const g: Grade[] = []
  if (mentionedInTextbook(c, 7)) g.push(7)
  if (mentionedInTextbook(c, 8)) g.push(8)
  if (mentionedInTextbook(c, 9)) g.push(9)
  return g
}

const MANIFEST = new Map(CURRICULUM_COMPOUNDS.map((c) => [c.id, c]))

function inferChapter(c: CompoundDef): Chapter {
  const m = MANIFEST.get(c.id)
  if (m?.chapter) return m.chapter as Chapter

  const id = c.id
  if (id === 'h2o') return 'вода'
  if (id === 'h2o2') return 'кислород'
  if (id === 'fes2') return 'сера'
  if (id === 'nh3' || id === 'nh3_h2o') return 'азот'
  if (id === 'sio2' || id === 'h2sio3') return 'кремний'
  if (id === 'mno2') return 'катализ'
  if (id.includes('cr') || id.includes('cro')) return 'хром'
  if (id.includes('mno4')) return 'марганец'
  if (id.includes('clo') || id === 'cl2') return 'хлор'
  if (['so2', 'so3', 'h2s', 'h2so3', 'h2so4'].includes(id)) return 'сера'
  if (['no', 'no2', 'n2o', 'n2o5', 'hno2', 'hno3'].includes(id)) return 'азот'
  if (['p2o5', 'h3po4', 'h3po3'].includes(id)) return 'фосфор'
  if (id.startsWith('salt_ag_') && (id.includes('cl') || id.includes('br') || id.includes('i')))
    return 'качественные'
  if (id === 'salt_ba_so4') return 'качественные'

  if (c.category === 'oxide') return 'оксиды'
  if (c.category === 'acid') return 'кислоты'
  if (c.category === 'base') return 'основания'
  if (c.category === 'salt') return 'соли'
  return 'прочее'
}

function inferSaltGrades(id: string): Grade[] {
  const rest = id.replace('salt_', '')
  const parts = rest.split('_')
  const cat = parts[0] ?? ''
  const anion = parts.slice(1).join('_')

  const g9Anions = ['mno4', 'cr2o7', 'cro4', 'clo4', 'clo3', 'po4']
  if (g9Anions.some((a) => anion.includes(a))) return [9]
  if (anion.includes('no3') || anion.includes('no2')) {
    if (['pb', 'ag'].includes(cat)) return [8, 9]
    return [8, 9]
  }
  if (['ag', 'ba'].includes(cat) && (anion.includes('cl') || anion.includes('so4'))) return [8, 9]
  if (['na', 'k', 'li'].includes(cat)) {
    if (['cl', 'f', 'br'].includes(anion)) return [7, 8, 9]
    if (['so4', 'co3', 'hco3'].includes(anion)) return [7, 8, 9]
    return [8, 9]
  }
  if (
    [
      'mg',
      'ca',
      'ba',
      'sr',
      'zn',
      'cu',
      'fe2',
      'fe3',
      'al',
      'pb',
      'mn',
      'ni',
      'cobalt',
      'sn',
      'cr',
      'nh4',
    ].includes(cat)
  ) {
    return [8, 9]
  }
  if (cat === 'cs') return [9]
  return [8, 9]
}

function inferGradesRule(c: CompoundDef): Grade[] {
  const id = c.id

  const g7Ids = new Set([
    'h2o',
    'co2',
    'nacl',
    'mgo',
    'cao',
    'cuo',
    'fe2o3',
    'hcl',
    'h2co3',
    'naoh',
    'ca_oh_2',
    'salt_nahco3',
    'salt_ca_co3',
    'salt_k_cl',
  ])
  if (g7Ids.has(id)) return [7, 8, 9]

  if (c.category === 'oxide') {
    if (['co', 'so2', 'no2', 'sio2', 'cu2o', 'feo', 'bao', 'zno', 'al2o3', 'fe3o4', 'mno2'].includes(id))
      return [8, 9]
    if (['so3', 'no', 'n2o5', 'p2o5', 'cr2o3', 'cro3', 'clo2', 'n2o'].includes(id)) return [9]
    return [8, 9]
  }

  if (c.category === 'acid') {
    if (['hcl', 'h2co3'].includes(id)) return [7, 8, 9]
    if (['h2so4', 'hno3', 'hbr', 'hi', 'hf', 'hclo', 'hclo3'].includes(id)) return [8, 9]
    return [9]
  }

  if (c.category === 'base') {
    if (['naoh', 'ca_oh_2'].includes(id)) return [7, 8, 9]
    return [8, 9]
  }

  if (c.category === 'salt') return inferSaltGrades(id)

  if (id === 'fes2') return [9]
  if (id === 'nh3' || id === 'nh3_h2o') return [9]

  return [8, 9]
}

function mergeGrades(a: Grade[], b: Grade[]): Grade[] {
  const s = new Set<Grade>([...a, ...b])
  return ([7, 8, 9] as const).filter((g) => s.has(g))
}

const map: Record<string, Entry> = {}

for (const c of Object.values(compoundById)) {
  const manifest = MANIFEST.get(c.id)
  const fromBook = gradesFromTextbook(c)
  const fromRules = manifest ? ([...manifest.grades] as Grade[]) : inferGradesRule(c)
  const grades = mergeGrades(fromBook, fromRules)
  const chapter = (manifest?.chapter as Chapter | undefined) ?? inferChapter(c)
  map[c.id] = { grades: grades.length > 0 ? grades : [8], chapter }
}

const stats = { 7: 0, 8: 0, 9: 0, total: 0 }
for (const e of Object.values(map)) {
  stats.total++
  if (e.grades.includes(7)) stats[7]++
  if (e.grades.includes(8)) stats[8]++
  if (e.grades.includes(9)) stats[9]++
}

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'curriculum',
  'compoundGradeMap.generated.ts',
)

const body = `/**
 * АВТОГЕНЕРАЦИЯ — не редактировать вручную.
 * Пересборка: npx tsx scripts/build-compound-grade-map.mts
 * Источники: Kimyo 7–9, schoolInorganicManifest, правила ФГОС.
 * Статистика: 7 кл.=${stats[7]}, 8 кл.=${stats[8]}, 9 кл.=${stats[9]}, всего=${stats.total}
 */
import type { InorganicSchoolGrade } from './compoundGradeIndex'

export type InorganicChapter =
  | 'вода'
  | 'оксиды'
  | 'кислоты'
  | 'основания'
  | 'соли'
  | 'металлы'
  | 'неметаллы'
  | 'кислород'
  | 'водород'
  | 'качественные'
  | 'азот'
  | 'сера'
  | 'фосфор'
  | 'хром'
  | 'хлор'
  | 'марганец'
  | 'кремний'
  | 'катализ'
  | 'прочее'

export type CompoundGradeEntry = {
  grades: readonly InorganicSchoolGrade[]
  chapter: InorganicChapter
}

export const COMPOUND_GRADE_MAP: Readonly<Record<string, CompoundGradeEntry>> = ${JSON.stringify(map, null, 2)} as const
`

writeFileSync(outPath, body, 'utf8')
console.log('Wrote', outPath)
console.log('Stats:', stats)
