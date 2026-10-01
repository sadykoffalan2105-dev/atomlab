import type { ReactionStory, StoryLocale, StoryStepId } from '../../../../chemistry/reactionStory'
import type { ReactorEquationTerm } from '../../../../chemistry/reactorEquationBalance'
import { buildReactionStory } from '../../../../chemistry/reactionStory'
import { getElementByZ } from '../../../../data/elements'
import { labCompoundById } from '../../../../data/labSpecies'
import type { CompoundDef } from '../../../../types/chemistry'

/**
 * Урок «сюжет реакции» для панели механизма (lessons.ts → 'story' / 'story4'): тексты шагов берутся из
 * сюжета, который сейчас играет сцена (ReactionStoryScene). Сцена ставит сюжет до подключения к панели.
 */

export const STORY_STEP_IDS: readonly StoryStepId[] = ['reactants', 'breaking', 'electrons', 'formation', 'result']
export const STORY4_STEP_IDS: readonly StoryStepId[] = ['reactants', 'breaking', 'formation', 'result']

let current: ReactionStory | null = null

export function setCurrentStory(story: ReactionStory | null): void {
  current = story
}

export function getCurrentStory(): ReactionStory | null {
  return current
}

const LEGEND: Readonly<Record<StoryLocale, { electron: string; stick: string; ion: string; precipitate: string }>> = {
  ru: {
    electron: 'e⁻ — электрон: летит от восстановителя к окислителю',
    stick: 'палочка — ковалентная связь (общая пара электронов)',
    ion: 'шар с зарядом (Na⁺, Cl⁻) — ион; ионы касаются, палочек нет',
    precipitate: '↑ — газ улетает, ↓ — осадок оседает',
  },
  en: {
    electron: 'e⁻ — an electron: flies from the reducing agent to the oxidizing agent',
    stick: 'stick — a covalent bond (a shared electron pair)',
    ion: 'ball with a charge (Na⁺, Cl⁻) — an ion; ions touch, no sticks',
    precipitate: '↑ — gas escapes, ↓ — precipitate settles',
  },
  uz: {
    electron: 'e⁻ — elektron: qaytaruvchidan oksidlovchiga oʻtadi',
    stick: 'tayoqcha — kovalent bogʻ (umumiy elektron jufti)',
    ion: 'zaryadli shar (Na⁺, Cl⁻) — ion; ionlar tegib turadi, tayoqcha yoʻq',
    precipitate: '↑ — gaz chiqadi, ↓ — choʻkma choʻkadi',
  },
}

/** Текст урока в виде, который читает панель (LessonMechanismText). */
export function storyLessonText(locale: StoryLocale) {
  const s = current
  const steps: Record<string, { title: string; body: string; equation: string; speak: string }> = {}
  for (const id of STORY_STEP_IDS) {
    const t = s?.text[locale][id]
    steps[id] = { title: t?.title ?? '', body: t?.body ?? '', equation: t?.equation ?? '', speak: t?.title ?? '' }
  }
  const lg = LEGEND[locale]
  return {
    intro: { title: s?.equation ?? '', speak: s?.equation ?? '' },
    steps,
    legend: { electron: s?.redox ? lg.electron : '', stick: lg.stick, ion: lg.ion, precipitate: lg.precipitate },
    safety: '',
    energy: { title: '' },
  }
}

// ─── уравнение реакции из состояния реактора ───

export type StoryReactorInput = {
  readonly leftTerms: readonly ReactorEquationTerm[]
  readonly coProducts: readonly { readonly coeff: number; readonly compoundId?: string; readonly z?: number; readonly diatomic?: boolean }[]
  readonly productId: string
  readonly productCoeff: number
  readonly productIndex?: number
}

function termText(coeff: number, t: { compoundId?: string; z?: number; diatomic?: boolean }): string | null {
  const c = coeff > 1 ? String(coeff) : ''
  if (t.compoundId) {
    const cmp = labCompoundById[t.compoundId]
    if (!cmp) return null
    const q = cmp.charge ?? 0
    const charge = q === 0 ? '' : `^${Math.abs(q) === 1 ? '' : Math.abs(q)}${q > 0 ? '+' : '-'}`
    return `${c}${cmp.formulaUnicode}${charge && !/[⁺⁻]$/.test(cmp.formulaUnicode) ? charge : ''}`
  }
  if (t.z != null) {
    const el = getElementByZ(t.z)
    return el ? `${c}${el.symbol}${t.diatomic ? '2' : ''}` : null
  }
  return null
}

/** Уравнение «2Na + Cl2 → 2NaCl» из экрана реактора; null — не собрать или сюжет не строится. */
export function storyEquationFromReactor(input: StoryReactorInput): string | null {
  const left = input.leftTerms.filter((t) => t.coeff > 0).map((t) => termText(Math.round(t.coeff), t))
  if (left.length === 0 || left.some((x) => x == null)) return null
  const right: string[] = []
  const main = termText(Math.round(input.productCoeff), { compoundId: input.productId })
  if (!main) return null
  const at = input.productIndex != null && input.productIndex >= 0 ? Math.min(input.productIndex, input.coProducts.length) : input.coProducts.length
  input.coProducts.forEach((cp, i) => {
    if (i === at) right.push(main)
    const s = termText(Math.round(cp.coeff), cp)
    if (s) right.push(s)
  })
  if (at >= input.coProducts.length) right.push(main)
  const text = `${left.join(' + ')} → ${right.join(' + ')}`
  return buildReactionStory(text) ? text : null
}

/** Маршрут «элементы → вещество» без экрана реакции: коэффициент продукта — из состава. */
export function storyEquationFromFlight(flyTerms: readonly ReactorEquationTerm[], product: CompoundDef | null | undefined): string | null {
  if (!product || flyTerms.length === 0) return null
  const comp: Record<string, number> = {}
  for (const t of flyTerms) {
    if (t.compoundId) {
      const c = labCompoundById[t.compoundId]
      if (!c) return null
      for (const [e, k] of Object.entries(c.composition)) comp[e] = (comp[e] ?? 0) + k * t.coeff
    } else {
      const el = getElementByZ(t.z)
      if (!el) return null
      comp[el.symbol] = (comp[el.symbol] ?? 0) + (t.diatomic ? 2 : 1) * t.coeff
    }
  }
  const els = Object.keys(product.composition)
  if (els.length === 0) return null
  const k = (comp[els[0]!] ?? 0) / product.composition[els[0]!]!
  if (!Number.isInteger(k) || k < 1) return null
  for (const e of new Set([...els, ...Object.keys(comp)])) if ((product.composition[e] ?? 0) * k !== (comp[e] ?? 0)) return null
  return storyEquationFromReactor({ leftTerms: flyTerms, coProducts: [], productId: product.id, productCoeff: k })
}
