import { compoundsListAlphabeticalRu } from '../../data/compounds'
import { ORGANIC_MOLECULES } from '../../data/organicLab/organicMoleculeRegistry'
import type { CompoundDef, CompoundCategory } from '../../types/chemistry'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Авто-генерация знаний по КАЖДОМУ веществу каталога ATOMLAB.
 * На одно вещество — несколько карточек (описание / получение / факты / условия),
 * чтобы RAG ловил «где применяют», «как получают», «откуда добывают».
 */

const SUB = '₀₁₂₃₄₅₆₇₈₉'

function formulaAscii(u: string): string {
  return u
    .split('')
    .map((ch) => {
      const i = SUB.indexOf(ch)
      return i >= 0 ? String(i) : ch
    })
    .join('')
    .replace(/[·•]/g, '*')
}

function categoryRu(cat: CompoundCategory): string {
  switch (cat) {
    case 'oxide':
      return 'оксид'
    case 'acid':
      return 'кислота'
    case 'base':
      return 'основание (гидроксид)'
    case 'salt':
      return 'соль'
    default:
      return 'вещество'
  }
}

function compositionRu(comp: Record<string, number>): string {
  return Object.entries(comp)
    .filter(([, n]) => n > 0)
    .map(([el, n]) => (n > 1 ? `${el}×${n}` : el))
    .join(', ')
}

function baseKeywords(c: CompoundDef, cat: string): string[] {
  const ascii = formulaAscii(c.formulaUnicode)
  const keywords = new Set<string>()
  keywords.add(c.nameRu.toLowerCase())
  keywords.add(c.nameRu.toLowerCase().replace(/ё/g, 'е'))
  keywords.add(c.formulaUnicode.toLowerCase())
  keywords.add(ascii.toLowerCase())
  keywords.add(cat)
  keywords.add(c.id)
  for (const w of c.nameRu.toLowerCase().split(/[\s(),-]+/)) {
    if (w.length >= 3) keywords.add(w)
  }
  return [...keywords]
}

function buildCompoundChunks(c: CompoundDef): ChemistryKnowledgeChunk[] {
  const ascii = formulaAscii(c.formulaUnicode)
  const cat = categoryRu(c.category)
  const kw = baseKeywords(c, cat)
  const out: ChemistryKnowledgeChunk[] = []

  const aboutRu: string[] = []
  aboutRu.push(`**${c.nameRu}** — ${cat}. Химическая формула: ${c.formulaUnicode}.`)
  if (c.descriptionRu?.trim()) aboutRu.push(c.descriptionRu.trim())
  aboutRu.push(`Состав: ${compositionRu(c.composition)}.`)
  out.push({
    id: `cmp-${c.id}`,
    topic: `${c.nameRu} (${c.formulaUnicode})`,
    keywords: [...kw, 'что такое', 'формула', 'состав'],
    ru: aboutRu.join(' '),
    en: `**${c.nameRu}** (${c.formulaUnicode}) — ${c.category}. Composition: ${compositionRu(c.composition)}.`,
  })

  if (c.laboratoryRecipeRu?.trim() || (c.obtainingStepsRu?.length ?? 0) > 0) {
    const obt: string[] = [`**Получение ${c.nameRu} (${c.formulaUnicode})**`]
    if (c.laboratoryRecipeRu?.trim()) obt.push(`Схема: ${c.laboratoryRecipeRu.trim()}.`)
    if (c.obtainingStepsRu?.length) {
      for (const step of c.obtainingStepsRu) {
        obt.push(`${step.step}) ${step.equation}${step.note ? ` — ${step.note}` : ''}`)
      }
    }
    out.push({
      id: `cmp-${c.id}-obtain`,
      topic: `Получение: ${c.nameRu}`,
      keywords: [...kw, 'получение', 'как получить', 'синтез', 'реакция получения', 'лабораторно'],
      ru: obt.join(' '),
      en: `Obtaining ${c.nameRu} (${c.formulaUnicode}): ${c.laboratoryRecipeRu ?? ''}`,
    })
  }

  const facts = c.factsRu
  if (facts?.source || facts?.usage || facts?.importance) {
    const parts: string[] = [`**${c.nameRu} (${c.formulaUnicode}) — дополнительно**`]
    if (facts.source) parts.push(`Добыча и происхождение: ${facts.source}`)
    if (facts.usage) parts.push(`Применение: ${facts.usage}`)
    if (facts.importance) parts.push(`Важность: ${facts.importance}`)
    out.push({
      id: `cmp-${c.id}-facts`,
      topic: `Факты: ${c.nameRu}`,
      keywords: [
        ...kw,
        'применение',
        'где используют',
        'добыча',
        'происхождение',
        'зачем нужен',
        'важность',
        'для чего',
      ],
      ru: parts.join(' '),
      en: `Facts about ${c.nameRu}: ${facts.usage ?? facts.importance ?? ''}`,
    })
  }

  const cond = c.synthesisConditionsRu
  if (cond && (cond.temperature || cond.pressure || cond.catalyst || cond.equipment)) {
    const rows = [
      cond.temperature ? `Температура: ${cond.temperature}` : null,
      cond.pressure ? `Давление: ${cond.pressure}` : null,
      cond.catalyst ? `Катализатор: ${cond.catalyst}` : null,
      cond.equipment ? `Оборудование: ${cond.equipment}` : null,
    ].filter(Boolean)
    out.push({
      id: `cmp-${c.id}-synth`,
      topic: `Условия синтеза: ${c.nameRu}`,
      keywords: [...kw, 'условия', 'температура', 'катализатор', 'давление', 'оборудование'],
      ru: `**Условия получения ${c.nameRu} (${c.formulaUnicode}).** ${rows.join('. ')}.`,
      en: `Synthesis conditions for ${c.nameRu}.`,
    })
  }

  return out
}

const ORGANIC_CLASS_RU: Record<string, string> = {
  alkane: 'алкан (предельный углеводород)',
  cycloalkane: 'циклоалкан',
  alkene: 'алкен (непредельный, двойная связь)',
  alkadiene: 'алкадиен (две двойные связи)',
  alkyne: 'алкин (тройная связь)',
  arene: 'арен (ароматический углеводород)',
  alcohol: 'спирт',
  polyol: 'многоатомный спирт',
  phenol: 'фенол',
  ether: 'простой эфир',
  aldehyde: 'альдегид',
  ketone: 'кетон',
  acid: 'карбоновая кислота',
  ester: 'сложный эфир',
  carb: 'углевод',
  halo: 'галогенопроизводное',
  nitrogen: 'азотсодержащее органическое вещество',
}

function buildOrganicChunks(m: OrganicMoleculeDef): ChemistryKnowledgeChunk[] {
  const ascii = formulaAscii(m.formula)
  const cls = ORGANIC_CLASS_RU[m.classId] ?? 'органическое вещество'
  const keywords = new Set<string>()
  keywords.add(m.nameRu.toLowerCase())
  keywords.add(m.nameRu.toLowerCase().replace(/ё/g, 'е'))
  if (m.nameEn) keywords.add(m.nameEn.toLowerCase())
  keywords.add(m.formula.toLowerCase())
  keywords.add(ascii.toLowerCase())
  keywords.add(cls)
  for (const w of m.nameRu.toLowerCase().split(/[\s(),]+/)) {
    if (w.length >= 4) keywords.add(w)
  }

  const out: ChemistryKnowledgeChunk[] = []
  const ru: string[] = []
  ru.push(`**${m.nameRu}** — ${cls}. Формула: ${m.formula}.`)
  if (m.descriptionRu?.trim()) ru.push(m.descriptionRu.trim())
  if (m.functionalGroups?.length) {
    const groups = m.functionalGroups.map((g) => g.labelRu || g.label).filter(Boolean)
    if (groups.length) ru.push(`Функциональные группы: ${groups.join(', ')}.`)
  }
  out.push({
    id: `org-${m.id}`,
    topic: `${m.nameRu} (${m.formula})`,
    grades: [10, 11],
    keywords: [...keywords],
    ru: ru.join(' '),
    en: `**${m.nameEn ?? m.nameRu}** (${m.formula}) — ${m.classId}. ${m.descriptionEn ?? ''}`.trim(),
  })

  if (m.equationRu?.trim()) {
    out.push({
      id: `org-${m.id}-rxn`,
      topic: `Реакции: ${m.nameRu}`,
      grades: [10, 11],
      keywords: [...keywords, 'реакция', 'получение', 'синтез'],
      ru: `**${m.nameRu} (${m.formula}).** Реакция/получение: ${m.equationRu.trim()}.`,
      en: `Reactions of ${m.nameEn ?? m.nameRu}: ${m.equationRu}`,
    })
  }

  return out
}

export const GENERATED_COMPOUND_KNOWLEDGE: ChemistryKnowledgeChunk[] = [
  ...compoundsListAlphabeticalRu().flatMap(buildCompoundChunks),
  ...ORGANIC_MOLECULES.flatMap(buildOrganicChunks),
]
