/**
 * «Этапы получения» карточки вещества → реактор лаборатории.
 *
 * У каждого шага (и у единственного рецепта) карточки — ссылка «Открыть в лаборатории»:
 *  1) уравнение есть среди 200 основных реакций — «/?reactor=1&mr=<id>&balance=1» (вещества стоят, ученик уравнивает);
 *  2) есть в банке школьных реакций — та же ссылка, что у раздела «Школьная реакция» (reaction=<id>&main=…);
 *  3) иначе — по записи уравнения «/?reactor=1&eq=<уравнение>&main=…» (resolveReactorEquation собирает рецепт на лету).
 * animated — реактор запустит синтез (не «только шарами») и сюжет реакции buildReactionStory строится.
 *
 * Модуль без React и three: его читают CompoundDetailModal и scripts/audit-catalog-lab-links.mts.
 */
import { buildReactionStory } from '../chemistry/reactionStory'
import { formulaCompositionKey, parseEquationText, type EquationSpecies } from '../chemistry/equationFormula'
import { SCHOOL_REACTION_BANK } from '../chemistry/schoolReactionBank'
import { MAIN_REACTIONS_200 } from '../data/catalog/mainReactions200'
import { reactorHrefForMainReaction } from '../data/catalog/mainReactions'
import { compoundById } from '../data/compounds'
import {
  isBankReactionReactorReady,
  mainReactionLinkSpec,
  reactorHrefForBank,
  reactorHrefForEquation,
  resolveReactorEquation,
  type ReactorLinkResult,
} from './reactorDeepLink'

export type ObtainingLinkKind = 'mr' | 'bank' | 'eq'

export type ObtainingLabLink = {
  readonly kind: ObtainingLinkKind
  /** Путь роутера для <Link to>. */
  readonly href: string
  readonly mainReactionId: string | null
  readonly bankId: string | null
  /** Уравнение, которое откроет реактор (Unicode, целые коэффициенты). */
  readonly equation: string
  /** Синтез запускается и сюжет реакции (перенос e⁻ / обмен ионами) строится. */
  readonly animated: boolean
}

/** Шаг-пояснение, а не реакция: «не N₂ + металл + O₂», «в школе не проводят: …», «MnO₂ — природный пиролюзит». */
export function isNegativeStepText(text: string): boolean {
  return /^\s*(не\s|в школе не|прямой .* не|или\s+не\s)/i.test(text)
}

/**
 * Запись шага → уравнение для реактора: без ↓ ↑, пометок концентрации и «+ Q», без ведущего «или».
 * Условия над стрелкой (→(t°), → (электролиз)) парсер уравнений понимает сам.
 */
export function cleanObtainingEquation(text: string): string {
  return text
    .replace(/^\s*или\s+/i, '')
    .replace(/\s*—.*$/s, '')
    .replace(/[↓↑]/g, '')
    .replace(/\((?:разб|конц|р-р|раствор|изб|холод|тв|г|ж)\.?\)/gi, '')
    .replace(/\s*\+\s*Q\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function speciesKey(list: readonly EquationSpecies[], scale: number): string | null {
  const parts: string[] = []
  for (const s of list) {
    if (!s.counts) return null
    parts.push(`${Math.round(s.coeff * scale)}*${formulaCompositionKey(s.counts)}${s.charge ? `^${s.charge}` : ''}`)
  }
  return parts.sort().join('+')
}

/** Ключ уравнения без стрелки и порядка слагаемых: «1*Cl:2+1*H:2=2*Cl:1|H:1». */
export function equationKey(text: string): string | null {
  const p = parseEquationText(text)
  if (!p || p.isScheme) return null
  const all = [...p.reactants, ...p.products].map((s) => s.coeff)
  // дроби (½O₂) → целые
  let scale = 1
  for (let k = 1; k <= 12; k++) {
    if (all.every((c) => Math.abs(c * k - Math.round(c * k)) < 1e-6)) {
      scale = k
      break
    }
  }
  const l = speciesKey(p.reactants, scale)
  const r = speciesKey(p.products, scale)
  return l && r ? `${l}=${r}` : null
}

let mrByKey: Map<string, string> | null = null
let bankByKey: Map<string, string> | null = null

function mainReactionIdForKey(key: string): string | null {
  if (!mrByKey) {
    mrByKey = new Map()
    for (const r of MAIN_REACTIONS_200) {
      const k = equationKey(r.equation)
      if (k && !mrByKey.has(k)) mrByKey.set(k, r.id)
    }
  }
  return mrByKey.get(key) ?? null
}

function bankIdForKey(key: string): string | null {
  if (!bankByKey) {
    bankByKey = new Map()
    for (const r of SCHOOL_REACTION_BANK) {
      const k = r.equationRu ? equationKey(r.equationRu) : null
      if (k && !bankByKey.has(k)) bankByKey.set(k, r.id)
    }
  }
  return bankByKey.get(key) ?? null
}

function productFormulaKeys(text: string): string[] {
  const p = parseEquationText(text)
  return p ? p.products.map((s) => (s.counts ? formulaCompositionKey(s.counts) : '')) : []
}

function animatedOf(r: ReactorLinkResult): boolean {
  return r.ok && r.stageOnly == null && buildReactionStory(r.equationUnicode) != null
}

const cache = new Map<string, ObtainingLabLink | null>()

/**
 * Ссылка шага получения в реактор (null — шаг не уравнение или реактор его не собирает).
 * compoundId — вещество карточки: главный продукт, если стоит справа.
 */
export function obtainingStepLabLink(compoundId: string, stepText: string): ObtainingLabLink | null {
  const ck = `${compoundId}\u0000${stepText}`
  const hit = cache.get(ck)
  if (hit !== undefined) return hit
  const out = build(compoundId, stepText)
  cache.set(ck, out)
  return out
}

function build(compoundId: string, stepText: string): ObtainingLabLink | null {
  if (!stepText || isNegativeStepText(stepText)) return null
  const eq = cleanObtainingEquation(stepText)
  const key = equationKey(eq)
  if (!key) return null
  const c = compoundById[compoundId]
  const ownKey = c ? formulaCompositionKey(parseEquationText(`X → ${c.formulaUnicode}`)?.products[0]?.counts ?? {}) : ''
  const main = ownKey && productFormulaKeys(eq).includes(ownKey) ? compoundId : null

  const mr = mainReactionIdForKey(key)
  if (mr) {
    const r = MAIN_REACTIONS_200.find((x) => x.id === mr)!
    const res = resolveReactorEquation(mainReactionLinkSpec(r))
    if (res.ok) {
      return { kind: 'mr', href: reactorHrefForMainReaction(mr), mainReactionId: mr, bankId: null, equation: res.equationUnicode, animated: animatedOf(res) }
    }
  }
  const bank = bankIdForKey(key)
  if (bank && isBankReactionReactorReady(bank)) {
    const res = resolveReactorEquation({ reactionId: bank, main })
    if (res.ok) {
      return {
        kind: 'bank',
        href: reactorHrefForBank(bank, main ? { main } : undefined),
        mainReactionId: null,
        bankId: bank,
        equation: res.equationUnicode,
        animated: animatedOf(res),
      }
    }
  }
  const res = resolveReactorEquation({ equation: eq, main })
  if (!res.ok) return null
  return {
    kind: 'eq',
    href: reactorHrefForEquation(eq, main ? { main } : undefined),
    mainReactionId: null,
    bankId: null,
    equation: res.equationUnicode,
    animated: animatedOf(res),
  }
}

/** Шаги «Этапов получения» карточки (единственный рецепт — тоже шаг). */
export function obtainingMethodsOf(compoundId: string): { equation: string; note?: string }[] {
  const c = compoundById[compoundId]
  if (!c) return []
  const steps = c.obtainingStepsRu ?? []
  if (steps.length > 0) return steps.map((s) => (s.note ? { equation: s.equation, note: s.note } : { equation: s.equation }))
  const recipe = c.laboratoryRecipeRu?.trim()
  return recipe ? [{ equation: recipe.replace(/\s+—\s+.*$/s, '') }] : []
}
