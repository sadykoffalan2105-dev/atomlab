import { ELEMENTS } from '../../data/elements'
import { ELEMENT_NAMES_EN } from '../../data/elementNamesEn'
import { ELEMENT_NAMES_UZ } from '../../data/elementNamesUz'
import elementProfilesRaw from '../../data/elementRealLife/elementRealLifeProfiles.json'
import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Авто-генерация знаний по КАЖДОМУ химическому элементу (1–118).
 * Собирается из таблицы Менделеева + профилей «элемент в жизни»
 * (внешний вид, применение, получение), чтобы ИИ-учитель мог ответить
 * на «что такое кислород», «где применяют железо», «как получают алюминий».
 */

type ElementProfile = {
  z: number
  symbol: string
  captionRu?: string
  appearanceRu?: string
  usesRu?: string[]
  extractionRu?: string
}

const profileByZ = new Map<number, ElementProfile>(
  (elementProfilesRaw as ElementProfile[]).map((p) => [p.z, p]),
)

/** Категория элемента (groupBlock) → русское описание для школы. */
function categoryRu(groupBlock: string): string {
  const g = groupBlock.toLowerCase()
  if (g.includes('noble')) return 'благородный (инертный) газ'
  if (g.includes('alkali metal') && !g.includes('earth')) return 'щелочной металл'
  if (g.includes('alkaline')) return 'щёлочноземельный металл'
  if (g.includes('transition')) return 'переходный металл'
  if (g.includes('post-transition')) return 'постпереходный металл'
  if (g.includes('metalloid')) return 'полуметалл (металлоид)'
  if (g.includes('halogen')) return 'галоген (неметалл)'
  if (g.includes('lanthan')) return 'лантаноид (редкоземельный металл)'
  if (g.includes('actin')) return 'актиноид (радиоактивный металл)'
  if (g.includes('nonmetal')) return 'неметалл'
  if (g.includes('metal')) return 'металл'
  return 'химический элемент'
}

function stateRu(standardState: string): string {
  const s = standardState.toLowerCase()
  if (s.includes('gas')) return 'газ'
  if (s.includes('liquid')) return 'жидкость'
  if (s.includes('solid')) return 'твёрдое вещество'
  return '—'
}

function periodGroupHint(z: number): string {
  // Грубая, но полезная подсказка периода по номеру.
  if (z <= 2) return '1-й период'
  if (z <= 10) return '2-й период'
  if (z <= 18) return '3-й период'
  if (z <= 36) return '4-й период'
  if (z <= 54) return '5-й период'
  if (z <= 86) return '6-й период'
  return '7-й период'
}

function buildElementChunk(el: (typeof ELEMENTS)[number]): ChemistryKnowledgeChunk {
  const nameEn = ELEMENT_NAMES_EN[el.z - 1] ?? el.symbol
  const nameUz = ELEMENT_NAMES_UZ[el.z - 1] ?? el.symbol
  const prof = profileByZ.get(el.z)
  const cat = categoryRu(el.groupBlock)
  const st = stateRu(el.standardState)

  const factLines: string[] = []
  factLines.push(
    `**${el.nameRu}** (символ ${el.symbol}, ${nameEn}) — химический элемент №${el.z}, ${cat}.`,
  )
  factLines.push(
    `Относительная атомная масса ≈ ${Math.round(el.atomicMass * 100) / 100}. Агрегатное состояние (н.у.): ${st}. ${periodGroupHint(el.z)}.`,
  )
  if (el.oxidationStates && el.oxidationStates !== '—') {
    factLines.push(`Степени окисления: ${el.oxidationStates}.`)
  }
  if (el.electronConfiguration && el.electronConfiguration !== '—') {
    factLines.push(`Электронная конфигурация: ${el.electronConfiguration}.`)
  }
  if (el.electronegativity != null) {
    factLines.push(`Электроотрицательность ≈ ${el.electronegativity}.`)
  }
  if (el.yearDiscovered) {
    factLines.push(`Открыт(а): ${el.yearDiscovered}.`)
  }
  if (prof?.appearanceRu) factLines.push(prof.appearanceRu)
  if (prof?.usesRu && prof.usesRu.length > 0) {
    factLines.push(`Применение: ${prof.usesRu.slice(0, 4).join(', ')}.`)
  }
  if (prof?.extractionRu) factLines.push(`Получение: ${prof.extractionRu}`)

  const keywords = new Set<string>()
  keywords.add(el.nameRu.toLowerCase())
  keywords.add(el.nameRu.toLowerCase().replace(/ё/g, 'е'))
  keywords.add(nameEn.toLowerCase())
  keywords.add(nameUz.toLowerCase())
  // Символ добавляем только если он длиной ≥2 — иначе «O», «H» дают ложные совпадения.
  if (el.symbol.length >= 2) keywords.add(el.symbol.toLowerCase())

  const enParts: string[] = [
    `**${nameEn}** (${el.symbol}) — chemical element #${el.z}, ${el.groupBlock}. Atomic mass ≈ ${Math.round(el.atomicMass * 100) / 100}, state: ${el.standardState}.`,
  ]
  if (el.oxidationStates && el.oxidationStates !== '—') {
    enParts.push(`Oxidation states: ${el.oxidationStates}.`)
  }

  return {
    id: `el-${el.z}`,
    topic: `${el.nameRu} (${el.symbol}) — элемент №${el.z}`,
    keywords: [...keywords],
    ru: factLines.join(' '),
    en: enParts.join(' '),
  }
}

export const GENERATED_ELEMENT_KNOWLEDGE: ChemistryKnowledgeChunk[] = ELEMENTS.map(buildElementChunk)
