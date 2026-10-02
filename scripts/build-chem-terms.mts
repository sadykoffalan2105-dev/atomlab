#!/usr/bin/env node
/**
 * Словарь химических терминов для пост-коррекции распознанной речи
 * (src/learn/brain/speech/chemTerms.generated.ts).
 *
 * Источники — только данные проекта:
 *   • названия элементов RU/EN/UZ (src/data/elementNames*.ts);
 *   • названия веществ каталога (nameRu из compounds.ts / inorganicCompounds.data.ts);
 *   • слова корпуса учебников 7–11 + глоссарий, которые начинаются с основы из
 *     лексикона src/data/kb/index/kb-lexicon.json (ru:) — это и есть «химические» слова;
 *   • KNOWN_WORDS — самые частые обычные слова корпуса, которые НЕ являются терминами:
 *     такие слова исправлять нельзя («масса» не должна стать «масло»).
 *
 * Запуск: npx tsx scripts/build-chem-terms.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ELEMENT_NAMES_RU } from '../src/data/elementNamesRu.ts'
import { ELEMENT_NAMES_EN } from '../src/data/elementNamesEn.ts'
import { ELEMENT_NAMES_UZ } from '../src/data/elementNamesUz.ts'
import { compoundById } from '../src/data/compounds.ts'

const root = resolve(import.meta.dirname, '..')
const read = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf8'))

const lexicon = read('src/data/kb/index/kb-lexicon.json') as { phrases: Record<string, unknown> }
const stems = new Set<string>()
for (const key of Object.keys(lexicon.phrases)) {
  if (!key.startsWith('ru:')) continue
  for (const stem of key.slice(3).split(/\s+/)) if (stem.length >= 4) stems.add(stem)
}

/** Текст корпусов: любые строковые поля документов. */
function corpusText(file: string): string {
  const data = read(file) as unknown
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk)
  }
  walk(data)
  return out.join('\n')
}

const freq = new Map<string, number>()
for (const f of ['g7', 'g8', 'g9', 'g10', 'g11', 'common', 'book']) {
  const text = corpusText(`src/data/kb/corpus/kb-corpus-${f}.json`)
  for (const m of text.toLowerCase().replace(/ё/g, 'е').matchAll(/[а-я]{4,}/g)) {
    freq.set(m[0], (freq.get(m[0]) ?? 0) + 1)
  }
}
const glossary = corpusText('src/data/kb/corpus/kb-glossary.json').toLowerCase().replace(/ё/g, 'е')
for (const m of glossary.matchAll(/[а-я]{4,}/g)) freq.set(m[0], (freq.get(m[0]) ?? 0) + 2)

const stemList = [...stems]
const isChemWord = (w: string) => stemList.some((s) => w.startsWith(s) && w.length - s.length <= 5)

const chem = new Set<string>()
const known = new Map<string, number>()
for (const [w, n] of freq) {
  if (isChemWord(w)) chem.add(w)
  else if (n >= 2) known.set(w, n)
}
for (const name of [...ELEMENT_NAMES_RU, ...ELEMENT_NAMES_EN, ...ELEMENT_NAMES_UZ]) {
  chem.add(name.toLowerCase().replace(/ё/g, 'е'))
}
for (const c of Object.values(compoundById)) {
  for (const w of (c.nameRu ?? '').toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z]+/)) {
    if (w.length >= 4) chem.add(w)
  }
}

const chemTerms = [...chem].sort()
const knownWords = [...known.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3000)
  .map(([w]) => w)
  .sort()

const header = `/* Сгенерировано scripts/build-chem-terms.mts — не редактировать вручную.
 * Источники: лексикон базы знаний, корпус учебников Kimyo 7–11, глоссарий,
 * названия элементов RU/EN/UZ и веществ каталога. */
`
const body =
  `${header}/** Химические термины (${chemTerms.length}) — кандидаты для исправления ослышек. */\n` +
  `export const CHEM_TERMS: readonly string[] = ${JSON.stringify(chemTerms)}\n\n` +
  `/** Частые обычные слова корпуса (${knownWords.length}) — их не исправляем. */\n` +
  `export const KNOWN_WORDS: readonly string[] = ${JSON.stringify(knownWords)}\n`
writeFileSync(resolve(root, 'src/learn/brain/speech/chemTerms.generated.ts'), body, 'utf8')
console.log(`chem terms: ${chemTerms.length}, known words: ${knownWords.length}`)
