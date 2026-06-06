/** Generates g7 i18n snippet from scripts/g7-toc-complete.json */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const toc = JSON.parse(fs.readFileSync(path.join(root, 'g7-toc-complete.json'), 'utf8'))

const CHAPTER_META = {
  1: {
    titleRu: 'Глава I. Вещества',
    titleEn: 'Ch. I. Substances',
    summaryRu: 'Свойства веществ, смеси, практикум в кабинете химии, физические и химические явления.',
    summaryEn: 'Substance properties, mixtures, lab practice, physical and chemical changes.',
  },
  2: {
    titleRu: 'Глава II. Химический элемент, химический символ',
    titleEn: 'Ch. II. Chemical element and symbol',
    summaryRu: 'Атом, формулы, моль, валентность, уравнения реакций.',
    summaryEn: 'Atom, formulas, mole, valency, reaction equations.',
  },
  3: {
    titleRu: 'Глава III. Периодическая система',
    titleEn: 'Ch. III. Periodic system',
    summaryRu: 'Характеристика элементов, природные семейства, таблица Менделеева.',
    summaryEn: 'Element characteristics, families, Mendeleev table.',
  },
  4: {
    titleRu: 'Глава IV. Воздух. Кислород. Оксиды',
    titleEn: 'Ch. IV. Air, oxygen, oxides',
    summaryRu: 'Состав воздуха, кислород, горение, озон, оксиды.',
    summaryEn: 'Air composition, oxygen, combustion, ozone, oxides.',
  },
  5: {
    titleRu: 'Глава V. Водород. Кислоты',
    titleEn: 'Ch. V. Hydrogen and acids',
    summaryRu: 'Водород, кислоты, взаимодействие с металлами, кислотные дожди.',
    summaryEn: 'Hydrogen, acids, reactions with metals, acid rain.',
  },
  6: {
    titleRu: 'Глава VI. Вода',
    titleEn: 'Ch. VI. Water',
    summaryRu: 'Состав и свойства воды, нейтрализация, загрязнение и очистка.',
    summaryEn: 'Water composition and properties, neutralization, pollution.',
  },
  7: {
    titleRu: 'Глава VII. Химия в организме человека',
    titleEn: 'Ch. VII. Chemistry in the human body',
    summaryRu: 'Элементы в организме, белки, жиры, углеводы, витамины, минералы.',
    summaryEn: 'Elements in the body, nutrients, vitamins, minerals.',
  },
  8: {
    titleRu: 'Глава VIII. Полезные ископаемые',
    titleEn: 'Ch. VIII. Useful minerals',
    summaryRu: 'Геологические соединения, месторождения Узбекистана, экология добычи.',
    summaryEn: 'Geological compounds, deposits, mining ecology.',
  },
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function gen(lang) {
  const lines = []
  for (let ch = 1; ch <= 8; ch++) {
    const meta = CHAPTER_META[ch]
    const cid = `c${ch}`
    lines.push(`  'learn.g7.${cid}.title': '${esc(lang === 'ru' ? meta.titleRu : meta.titleEn)}',`)
    lines.push(
      `  'learn.g7.${cid}.summary': '${esc(lang === 'ru' ? meta.summaryRu : meta.summaryEn)}',`,
    )
    const sections = toc.filter((e) => e.ch === ch)
    for (const e of sections) {
      const sid = `s${String(e.sec).padStart(2, '0')}`
      const title = lang === 'ru' ? e.titleRu : e.titleEn
      lines.push(`  'learn.g7.${cid}.${sid}.title': '§${e.sec}. ${esc(title)}',`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

console.log('=== RU ===\n' + gen('ru'))
console.log('\n=== EN ===\n' + gen('en'))
