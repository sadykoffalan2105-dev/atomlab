import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const toc = JSON.parse(fs.readFileSync(path.join(root, 'g7-toc-complete.json'), 'utf8'))

const CHAPTER_META = {
  1: {
    titleRu: 'Глава I. Вещества',
    titleEn: 'Ch. I. Substances',
    summaryRu:
      'Свойства веществ, смеси, практикум в кабинете химии, физические и химические явления.',
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
    for (const e of toc.filter((x) => x.ch === ch)) {
      const sid = `s${String(e.sec).padStart(2, '0')}`
      const title = lang === 'ru' ? e.titleRu : e.titleEn
      lines.push(`  'learn.g7.${cid}.${sid}.title': '§${e.sec}. ${esc(title)}',`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function patchFile(relPath, lang) {
  const file = path.join(root, '..', relPath)
  let src = fs.readFileSync(file, 'utf8')
  const start = "  'learn.g7.c1.title':"
  const end = "  'learn.g8.title':"
  const i0 = src.indexOf(start)
  const i1 = src.indexOf(end)
  if (i0 < 0 || i1 < 0) throw new Error(`markers not found in ${relPath}`)
  src = src.slice(0, i0) + gen(lang) + '\n\n' + src.slice(i1)
  fs.writeFileSync(file, src, 'utf8')
  console.log('patched', relPath)
}

patchFile('src/i18n/learn/gradesOutlineRu.ts', 'ru')
patchFile('src/i18n/learn/gradesOutlineEn.ts', 'en')
