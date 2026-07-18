import { compoundsListAlphabeticalRu } from '../../data/compounds'
import { ORGANIC_MOLECULES } from '../../data/organicLab/organicMoleculeRegistry'
import type { CompoundDef, CompoundCategory } from '../../types/chemistry'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Авто-генерация знаний по КАЖДОМУ веществу каталога ATOMLAB
 * (неорганические соединения + органические молекулы), чтобы ИИ-учитель мог
 * ответить на «что такое вода», «что такое оксид меди», «формула серной кислоты».
 */

const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** H₂O → H2O для сопоставления с обычным вводом пользователя. */
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
  const parts = Object.entries(comp)
    .filter(([, n]) => n > 0)
    .map(([el, n]) => (n > 1 ? `${el}×${n}` : el))
  return parts.join(', ')
}

function buildCompoundChunk(c: CompoundDef): ChemistryKnowledgeChunk {
  const ascii = formulaAscii(c.formulaUnicode)
  const cat = categoryRu(c.category)

  const ru: string[] = []
  ru.push(`**${c.nameRu}** — ${cat}. Химическая формула: ${c.formulaUnicode}.`)
  if (c.descriptionRu?.trim()) ru.push(c.descriptionRu.trim())
  ru.push(`Состав: ${compositionRu(c.composition)}.`)
  if (c.laboratoryRecipeRu?.trim()) {
    ru.push(`Пример получения: ${c.laboratoryRecipeRu.trim()}.`)
  }

  const keywords = new Set<string>()
  keywords.add(c.nameRu.toLowerCase())
  keywords.add(c.nameRu.toLowerCase().replace(/ё/g, 'е'))
  keywords.add(c.formulaUnicode.toLowerCase())
  keywords.add(ascii.toLowerCase())
  keywords.add(cat)
  // Отдельные значимые слова названия (например «оксид», «меди», «серная»).
  for (const w of c.nameRu.toLowerCase().split(/[\s(),]+/)) {
    if (w.length >= 4) keywords.add(w)
  }

  return {
    id: `cmp-${c.id}`,
    topic: `${c.nameRu} (${c.formulaUnicode})`,
    keywords: [...keywords],
    ru: ru.join(' '),
    en: `**${c.nameRu}** (${c.formulaUnicode}) — ${c.category}. Composition: ${compositionRu(c.composition)}.`,
  }
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

function buildOrganicChunk(m: OrganicMoleculeDef): ChemistryKnowledgeChunk {
  const ascii = formulaAscii(m.formula)
  const cls = ORGANIC_CLASS_RU[m.classId] ?? 'органическое вещество'

  const ru: string[] = []
  ru.push(`**${m.nameRu}** — ${cls}. Формула: ${m.formula}.`)
  if (m.descriptionRu?.trim()) ru.push(m.descriptionRu.trim())
  if (m.functionalGroups && m.functionalGroups.length > 0) {
    const groups = m.functionalGroups.map((g) => g.labelRu || g.label).filter(Boolean)
    if (groups.length > 0) ru.push(`Функциональные группы: ${groups.join(', ')}.`)
  }
  if (m.equationRu?.trim()) ru.push(`Реакция/получение: ${m.equationRu.trim()}.`)

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

  return {
    id: `org-${m.id}`,
    topic: `${m.nameRu} (${m.formula})`,
    grades: [10, 11],
    keywords: [...keywords],
    ru: ru.join(' '),
    en: `**${m.nameEn ?? m.nameRu}** (${m.formula}) — ${m.classId}. ${m.descriptionEn ?? ''}`.trim(),
  }
}

export const GENERATED_COMPOUND_KNOWLEDGE: ChemistryKnowledgeChunk[] = [
  ...compoundsListAlphabeticalRu().map(buildCompoundChunk),
  ...ORGANIC_MOLECULES.map(buildOrganicChunk),
]
