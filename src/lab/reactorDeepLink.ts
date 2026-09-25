/**
 * Ссылка «открыть реакцию в реакторе»: из банка школьных реакций (reaction=<id>)
 * или из текста уравнения (eq=<уравнение>), напр. из интерактивного учебника.
 *
 * resolveReactorEquation превращает уравнение в состояние реактора:
 *  - только простые вещества → одно сложное (разрешено из элементов) — обычный маршрут, без рецепта;
 *  - всё остальное — рецепт ScientificReactorRecipe, собранный на лету.
 *
 * Ссылки для <Link to>: «/?reactor=1&…» (без «#» — HashRouter добавит сам).
 */
import {
  formatEquationUnicode,
  formulaCompositionKey,
  formulaToUnicode,
  isElementSymbol,
  parseEquationText,
  equationImbalance,
  type EquationSpecies,
} from '../chemistry/equationFormula'
import { isDiatomicNativeElement } from '../chemistry/diatomicElements'
import { REACTOR_COEFF_MAX, REACTOR_EQUATION_MAX_TERMS } from '../chemistry/reactorLimits'
import { validateReactorEquation, type ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import {
  hasScientificReactorRecipe,
  type ReactorCoProductTerm,
  type ScientificReactorRecipe,
  type SciCoProductSpec,
  type SciLeftSpec,
} from '../chemistry/scientificReactorRecipes'
import {
  getSchoolReaction,
  primaryReactionForCompound,
  SCHOOL_REACTION_BANK,
} from '../chemistry/schoolReactionBank'
import { fromElementsPolicy } from '../chemistry/substanceSynthesisRoute'
import { compoundById } from '../data/compounds'
import { getElementBySymbol } from '../data/elements'
import {
  electronSpecies,
  ionSpeciesFor,
  organicSpeciesFor,
  simpleSpeciesFor,
  type LabSpeciesKind,
} from '../data/labSpecies'
import type { CompoundDef } from '../types/chemistry'

/**
 * Не больше продуктов справа (главный + побочные). 5 — ровно столько, сколько в самой
 * длинной реакции учебников 7–9 классов (8 кл., § 22: KMnO₄ + NaCl + H₂SO₄ → 5 веществ).
 */
export const REACTOR_LINK_MAX_PRODUCTS = 5

/**
 * Реакция открывается только «шарами» (экран реакции, счёт атомов и зарядов), без запуска
 * синтеза — анимация таких реакций появится позже:
 *  • electron — полуреакция с электронами (электролиз, коррозия);
 *  • ionic — ионное уравнение (диссоциация, краткая ионная форма);
 *  • organic — есть органическое вещество (CH₄, C₂H₅OH …);
 *  • simpleProduct — все продукты — простые вещества (2H₂O → 2H₂ + O₂).
 */
export type ReactorStageOnlyReason = 'electron' | 'ionic' | 'organic' | 'simpleProduct'

export type ReactorLinkSpec = {
  /** id реакции из SCHOOL_REACTION_BANK */
  reactionId?: string | null
  /** Текст уравнения (ASCII или Unicode); важнее reactionId, если заданы оба. */
  equation?: string | null
  /** Главный продукт (id вещества каталога), если в правой части несколько веществ. */
  main?: string | null
  /** Заголовок для сообщения в реакторе. */
  titleRu?: string | null
}

export type ReactorLinkFailCode =
  | 'ionic'
  | 'scheme'
  /** Общая формула с «n» — (C₆H₁₀O₅)n, H₂SO₄·nSO₃, Fe₂O₃·nH₂O, CₙH₂ₙ₊₂: не реакция с определённым составом. */
  | 'generalFormula'
  | 'unknownSubstance'
  | 'organic'
  | 'noCompoundProduct'
  | 'tooManyTerms'
  | 'unbalanced'

export type ReactorLinkFailDetails = {
  /** Формулы, которых нет в каталоге (unknownSubstance / organic), Unicode. */
  formulas?: string[]
  /** Расхождения атомов (unbalanced): «O: 2≠1». */
  imbalance?: string[]
  /** Уточнение: notFound (нет реакции в банке), parse (нет стрелки), chain, placeholder, reactants, products, coeff. */
  reason?: string
}

export type ReactorLinkOk = {
  ok: true
  leftTerms: ReactorEquationTerm[]
  productCompoundId: string
  productCoeff: number
  coProducts: ReactorCoProductTerm[]
  /** Нет — обычный маршрут «элементы → вещество» (атомное превью, без рецепта). */
  recipe?: ScientificReactorRecipe
  titleRu: string
  /** Условия над стрелкой, если были записаны. */
  conditions: string | null
  /** Уравнение с целыми коэффициентами, Unicode. */
  equationUnicode: string
  bankId: string | null
  /** Не null — только экран реакции, синтез не запускается (см. ReactorStageOnlyReason). */
  stageOnly: ReactorStageOnlyReason | null
}

export type ReactorLinkFail = {
  ok: false
  code: ReactorLinkFailCode
  details: ReactorLinkFailDetails
  titleRu: string | null
  equationUnicode: string | null
  bankId: string | null
}

export type ReactorLinkResult = ReactorLinkOk | ReactorLinkFail

export type ResolveReactorOptions = {
  newId?: () => string
  /** Все коэффициенты = 1: ученик уравнивает сам. */
  balanceSelf?: boolean
}

// ───────────────────────── каталог по составу ─────────────────────────

let compoundByKeyCache: Map<string, CompoundDef> | null = null

function compoundByCompositionKey(key: string): CompoundDef | null {
  if (!compoundByKeyCache) {
    const m = new Map<string, CompoundDef>()
    for (const c of Object.values(compoundById)) {
      const k = formulaCompositionKey(c.composition)
      if (!m.has(k)) m.set(k, c)
    }
    compoundByKeyCache = m
  }
  return compoundByKeyCache.get(key) ?? null
}

type ResolvedSpecies =
  | { kind: 'element'; z: number; diatomic: boolean; atomsPerUnit: number }
  /** lab — частица вне каталога (ион, электрон, органика): реакция только «шарами», без синтеза. */
  | { kind: 'compound'; compound: CompoundDef; glowZ: number; lab?: LabSpeciesKind }
  | { kind: 'missing'; organic: boolean; formula: string }

function glowZForCounts(counts: Readonly<Record<string, number>>): number {
  const syms = Object.keys(counts)
  const sym = syms.find((s) => s !== 'H' && s !== 'O') ?? syms[0]
  return (sym ? getElementBySymbol(sym)?.z : undefined) ?? 1
}

function chargeSuffix(q: number): string {
  if (q === 0) return ''
  const mag = Math.abs(q)
  return `^${mag === 1 ? '' : mag}${q > 0 ? '+' : '-'}`
}

function resolveSpecies(s: EquationSpecies): ResolvedSpecies {
  const counts = s.counts ?? {}
  const syms = Object.keys(counts)
  if (s.electron) return { kind: 'compound', compound: electronSpecies(), glowZ: 1, lab: 'electron' }
  if (s.charge !== 0) {
    // Ион — отдельная частица реактора: Na⁺ — шар с зарядом, SO₄²⁻ — тетраэдр.
    const ion = s.counts ? ionSpeciesFor(counts, s.charge) : null
    if (ion) return { kind: 'compound', compound: ion, glowZ: glowZForCounts(counts), lab: 'ion' }
    return { kind: 'missing', organic: false, formula: formulaToUnicode(`${s.formula}${chargeSuffix(s.charge)}`) }
  }
  const formula = formulaToUnicode(s.formula)
  if (syms.length === 1) {
    const sym = syms[0]!
    const n = counts[sym]!
    const el = isElementSymbol(sym) ? getElementBySymbol(sym) : undefined
    if (el) {
      const diatomicNative = isDiatomicNativeElement(el.z)
      if (diatomicNative && n === 2) return { kind: 'element', z: el.z, diatomic: true, atomsPerUnit: 1 }
      if (n === 1) return { kind: 'element', z: el.z, diatomic: false, atomsPerUnit: 1 }
      const compound = compoundByCompositionKey(formulaCompositionKey(counts))
      if (compound) return { kind: 'compound', compound, glowZ: el.z }
      // P₄, S₈ — в реакторе атомами.
      if (!diatomicNative) return { kind: 'element', z: el.z, diatomic: false, atomsPerUnit: n }
      return { kind: 'missing', organic: false, formula }
    }
  }
  const compound = compoundByCompositionKey(formulaCompositionKey(counts))
  if (compound) return { kind: 'compound', compound, glowZ: glowZForCounts(counts) }
  const organic = isOrganicFormula(s.formula, counts)
  if (organic) {
    // Органика школьных уравнений (CH₄, C₂H₅OH …): формульная единица с 3D-геометрией.
    const org = organicSpeciesFor(counts)
    if (org) return { kind: 'compound', compound: org, glowZ: 6, lab: 'organic' }
  }
  return { kind: 'missing', organic, formula }
}

/**
 * Органическое вещество: есть C и H, и углерод не только в неорганических группах
 * (гидрокарбонаты «Fe(HCO₃)₂», карбонаты, цианиды «HCN», роданиды «KSCN» — неорганика).
 */
export function isOrganicFormula(formula: string, counts: Readonly<Record<string, number>> | null | undefined): boolean {
  if (!counts || !((counts.C ?? 0) > 0 && (counts.H ?? 0) > 0)) return false
  const ascii = formula.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
  return /C(?![a-z])/.test(ascii.replace(/H?CO3|SCN|CN(?![a-z])/g, ''))
}

/** Ключ вещества для сравнения уравнений: id каталога или «z<номер>» для простого вещества. */
function speciesKey(r: ResolvedSpecies): string | null {
  if (r.kind === 'compound') return r.compound.id
  if (r.kind === 'element') return `z${r.z}`
  return null
}

/** Ключ уравнения без коэффициентов: «левые|правые», отсортированные. */
function equationSpeciesKey(left: readonly ResolvedSpecies[], right: readonly ResolvedSpecies[]): string | null {
  const l = left.map(speciesKey)
  const r = right.map(speciesKey)
  if ([...l, ...r].some((k) => k == null)) return null
  return `${[...l].sort().join('+')}|${[...r].sort().join('+')}`
}

let bankProductBySpeciesCache: Map<string, string> | null = null

/**
 * Главный продукт для eq= без reaction=: если в банке есть реакция с тем же набором
 * веществ слева и справа, берём её productId (фокус урока). Иначе в «Na₂O₂ + H₂SO₄ →
 * Na₂SO₄ + H₂O₂» главным стала бы соль (первое вещество справа, кроме воды), и научная
 * сцена H₂O₂ не включалась бы. Первая реакция банка с таким ключом побеждает.
 */
function bankProductForSpecies(key: string | null): string | null {
  if (!key) return null
  if (!bankProductBySpeciesCache) {
    const m = new Map<string, string>()
    for (const r of SCHOOL_REACTION_BANK) {
      if (!r.productId) continue
      const parsed = parseEquationText(r.equationRu)
      if (!parsed || parsed.isScheme || parsed.isIonic) continue
      const k = equationSpeciesKey(parsed.reactants.map(resolveSpecies), parsed.products.map(resolveSpecies))
      if (k && !m.has(k)) m.set(k, r.productId)
    }
    bankProductBySpeciesCache = m
  }
  return bankProductBySpeciesCache.get(key) ?? null
}

/** Наименьший множитель, делающий все коэффициенты целыми (дроби вида 1/2, 3/2, 1/3…). */
function integerScale(coeffs: readonly number[]): number | null {
  for (let m = 1; m <= 12; m++) {
    if (coeffs.every((c) => Math.abs(c * m - Math.round(c * m)) < 1e-6 && Math.round(c * m) >= 1)) return m
  }
  return null
}

function defaultIdFactory(): () => string {
  let n = 0
  return () => `deeplink-${++n}`
}

function fail(
  code: ReactorLinkFailCode,
  details: ReactorLinkFailDetails,
  ctx: { titleRu: string | null; equationUnicode: string | null; bankId: string | null },
): ReactorLinkFail {
  return { ok: false, code, details, ...ctx }
}

/**
 * Уравнение → состояние реактора (слагаемые, побочные продукты, главный продукт, рецепт).
 * Коэффициенты — из уравнения (дроби домножаются до целых), либо все 1 при balanceSelf.
 */
export function resolveReactorEquation(
  spec: ReactorLinkSpec,
  opts: ResolveReactorOptions = {},
): ReactorLinkResult {
  const newId = opts.newId ?? defaultIdFactory()
  const bank = spec.reactionId ? getSchoolReaction(spec.reactionId) : undefined
  const bankId = bank?.id ?? null
  const text = spec.equation?.trim() || bank?.equationRu || ''
  const titleHint = spec.titleRu?.trim() || bank?.titleRu || null

  if (!text) {
    return fail(
      'scheme',
      { reason: spec.reactionId ? 'notFound' : 'parse' },
      { titleRu: titleHint, equationUnicode: null, bankId },
    )
  }

  const parsed = parseEquationText(text)
  if (!parsed) return fail('scheme', { reason: 'parse' }, { titleRu: titleHint, equationUnicode: null, bankId })

  const rawUnicode = formatEquationUnicode(parsed)
  const ctx = { titleRu: titleHint ?? rawUnicode, equationUnicode: rawUnicode, bankId }

  if (parsed.isScheme) {
    const unparsed = [...parsed.reactants, ...parsed.products].filter((s) => s.counts == null)
    // «n» вместо числа (полимер, олеум, ржавчина, гомологический ряд) — общая формула, а не вещество.
    if (unparsed.some((s) => /(^|[^a-z])\d*n(?=[A-Z(\d+]|$)|\)n\b/.test(s.formula))) {
      return fail('generalFormula', { reason: 'placeholder' }, ctx)
    }
    return fail('scheme', { reason: unparsed.length > 0 ? 'placeholder' : 'chain' }, ctx)
  }

  const left = parsed.reactants.map(resolveSpecies)
  const right = parsed.products.map(resolveSpecies)
  const missing = [...left, ...right].filter((r): r is Extract<ResolvedSpecies, { kind: 'missing' }> => r.kind === 'missing')
  if (missing.length > 0) {
    const formulas = [...new Set(missing.map((m) => m.formula))]
    const code: ReactorLinkFailCode = missing.every((m) => m.organic) ? 'organic' : 'unknownSubstance'
    return fail(code, { formulas }, ctx)
  }

  if (parsed.reactants.length > REACTOR_EQUATION_MAX_TERMS) {
    return fail('tooManyTerms', { reason: 'reactants' }, ctx)
  }
  if (parsed.products.length > REACTOR_LINK_MAX_PRODUCTS) {
    return fail('tooManyTerms', { reason: 'products' }, ctx)
  }

  const imbalance = equationImbalance(parsed)
  if (imbalance.length > 0) return fail('unbalanced', { imbalance }, ctx)

  const scale = integerScale([...parsed.reactants, ...parsed.products].map((s) => s.coeff))
  if (scale == null) return fail('unbalanced', { reason: 'coeff' }, ctx)
  const intCoeff = (s: EquationSpecies) => Math.round(s.coeff * scale)

  // ── главный продукт ──
  const compoundIdxs = right
    .map((r, i) => (r.kind === 'compound' ? i : -1))
    .filter((i) => i >= 0)
  const labKinds = new Set<LabSpeciesKind>()
  for (const r of [...left, ...right]) if (r.kind === 'compound' && r.lab) labKinds.add(r.lab)
  const stageOnly: ReactorStageOnlyReason | null = labKinds.has('electron')
    ? 'electron'
    : labKinds.has('ion')
      ? 'ionic'
      : labKinds.has('organic')
        ? 'organic'
        : compoundIdxs.length === 0
          ? 'simpleProduct'
          : null

  let mainIdx: number
  let mainCompound: CompoundDef
  if (stageOnly) {
    // Синтеза нет, «главный» продукт — просто последний член ряда: берём последний продукт
    // уравнения, и сцена (побочные, затем главный) показывает продукты в порядке учебника.
    // Простое вещество справа (O₂, Hg) — частица реактора simple_*.
    let found: { idx: number; compound: CompoundDef } | null = null
    for (let i = right.length - 1; i >= 0 && !found; i--) {
      const r = right[i]!
      if (r.kind === 'compound') found = { idx: i, compound: r.compound }
      else if (r.kind === 'element') {
        const simple = simpleSpeciesFor(r.z, r.diatomic ? 2 : r.atomsPerUnit)
        if (simple) found = { idx: i, compound: simple }
      }
    }
    if (!found) return fail('noCompoundProduct', {}, ctx)
    mainIdx = found.idx
    mainCompound = found.compound
  } else {
    const idOf = (i: number) => (right[i] as Extract<ResolvedSpecies, { kind: 'compound' }>).compound.id
    const pick = (id: string | null | undefined) => (id ? compoundIdxs.find((i) => idOf(i) === id) : undefined)
    mainIdx =
      pick(spec.main) ??
      pick(bank?.productId) ??
      (bank ? undefined : pick(bankProductForSpecies(equationSpeciesKey(left, right)))) ??
      compoundIdxs.find((i) => idOf(i) !== 'h2o') ??
      compoundIdxs[0]!
    mainCompound = (right[mainIdx] as Extract<ResolvedSpecies, { kind: 'compound' }>).compound
  }
  const productTargetCoeff = intCoeff(parsed.products[mainIdx]!)

  // ── рецепт с целевыми коэффициентами ──
  const leftSpecs: SciLeftSpec[] = left.map((r, i) => {
    const k = intCoeff(parsed.reactants[i]!)
    if (r.kind === 'compound') {
      return { kind: 'compound', compoundId: r.compound.id, targetCoeff: k, glowZ: r.glowZ }
    }
    const el = r as Extract<ResolvedSpecies, { kind: 'element' }>
    return {
      kind: 'element',
      z: el.z,
      ...(el.diatomic ? { diatomic: true } : {}),
      targetCoeff: k * el.atomsPerUnit,
    }
  })
  const coSpecs: SciCoProductSpec[] = []
  right.forEach((r, i) => {
    if (i === mainIdx) return
    const k = intCoeff(parsed.products[i]!)
    if (r.kind === 'compound') {
      coSpecs.push({ compoundId: r.compound.id, targetCoeff: k })
      return
    }
    const el = r as Extract<ResolvedSpecies, { kind: 'element' }>
    coSpecs.push({ z: el.z, ...(el.diatomic ? { diatomic: true } : {}), targetCoeff: k * el.atomsPerUnit })
  })

  const allTargets = [
    ...leftSpecs.map((s) => s.targetCoeff),
    ...coSpecs.map((s) => s.targetCoeff),
    productTargetCoeff,
  ]
  if (allTargets.some((k) => k > REACTOR_COEFF_MAX)) return fail('tooManyTerms', { reason: 'coeff' }, ctx)

  const equationUnicode = formatEquationUnicode({
    arrow: parsed.arrow,
    reactants: parsed.reactants.map((s) => ({ ...s, coeff: intCoeff(s) })),
    products: parsed.products.map((s) => ({ ...s, coeff: intCoeff(s) })),
  })
  const titleRu = titleHint ?? equationUnicode
  const one = opts.balanceSelf === true
  const base = {
    ok: true as const,
    productCompoundId: mainCompound.id,
    productCoeff: one ? 1 : productTargetCoeff,
    titleRu,
    conditions: parsed.conditions,
    equationUnicode,
    bankId,
    stageOnly,
  }

  // ── обычный маршрут: только элементы → одно вещество ──
  const elementsOnly = leftSpecs.every((s) => s.kind === 'element') && coSpecs.length === 0
  if (!stageOnly && elementsOnly && fromElementsPolicy(mainCompound.id) !== 'forbidden') {
    const targetTerms: ReactorEquationTerm[] = leftSpecs.map((s) => {
      const el = s as Extract<SciLeftSpec, { kind: 'element' }>
      return { id: newId(), z: el.z, coeff: el.targetCoeff, ...(el.diatomic ? { diatomic: true as const } : {}) }
    })
    if (validateReactorEquation(targetTerms, mainCompound, productTargetCoeff).ok) {
      return {
        ...base,
        leftTerms: one ? targetTerms.map((t) => ({ ...t, coeff: 1 })) : targetTerms,
        coProducts: [],
      }
    }
  }

  const recipe: ScientificReactorRecipe = {
    productId: mainCompound.id,
    titleRu,
    left: leftSpecs,
    coProducts: coSpecs,
    productTargetCoeff,
    productIndex: mainIdx,
    ...(stageOnly ? { stageOnly: true } : {}),
  }
  const leftTerms: ReactorEquationTerm[] = leftSpecs.map((s) =>
    s.kind === 'compound'
      ? { id: newId(), z: s.glowZ, coeff: one ? 1 : s.targetCoeff, compoundId: s.compoundId, locked: true }
      : {
          id: newId(),
          z: s.z,
          coeff: one ? 1 : s.targetCoeff,
          ...(s.diatomic ? { diatomic: true as const } : {}),
          locked: true,
        },
  )
  const coProducts: ReactorCoProductTerm[] = coSpecs.map((s) =>
    s.compoundId != null
      ? { id: newId(), compoundId: s.compoundId, coeff: one ? 1 : s.targetCoeff, locked: true }
      : {
          id: newId(),
          z: s.z,
          ...(s.diatomic ? { diatomic: true as const } : {}),
          coeff: one ? 1 : s.targetCoeff,
          locked: true,
        },
  )
  return { ...base, leftTerms, coProducts, recipe }
}

// ───────────────────────── ссылки ─────────────────────────

export type ReactorHrefOptions = {
  /** id главного продукта */
  main?: string | null
  /** Коэффициенты 1 — ученик уравнивает сам. */
  balance?: boolean
  /** Куда вернуться: путь роутера «/learn/g/g8/read/p24» или короткий «g8:p24». */
  src?: string | null
  /** Заголовок реакции для сообщения в реакторе. */
  title?: string | null
}

function appendOptions(base: string, opts?: ReactorHrefOptions): string {
  let href = base
  if (opts?.main) href += `&main=${encodeURIComponent(opts.main)}`
  if (opts?.balance) href += '&balance=1'
  if (opts?.title) href += `&title=${encodeURIComponent(opts.title)}`
  if (opts?.src) href += `&src=${encodeURIComponent(opts.src)}`
  return href
}

/** «/?reactor=1&reaction=<id>» для <Link to>. */
export function reactorHrefForBank(reactionId: string, opts?: ReactorHrefOptions): string {
  return appendOptions(`/?reactor=1&reaction=${encodeURIComponent(reactionId)}`, opts)
}

/** «/?reactor=1&eq=<уравнение>» для <Link to>. */
export function reactorHrefForEquation(equation: string, opts?: ReactorHrefOptions): string {
  return appendOptions(`/?reactor=1&eq=${encodeURIComponent(equation)}`, opts)
}

export type ReactorLinkParams = {
  spec: ReactorLinkSpec
  balanceSelf: boolean
  /** Безопасный путь роутера для «← назад к учебнику» или null. */
  backHref: string | null
}

/** Путь возврата: только внутренние пути роутера. */
export function sanitizeBackHref(src: string | null | undefined): string | null {
  if (!src) return null
  const s = src.trim()
  const short = s.match(/^(g\d{1,2}):([A-Za-z0-9_-]+)$/)
  if (short) return `/learn/g/${short[1]}/book?unit=${short[2]}`
  if (!s.startsWith('/') || s.startsWith('//') || /[\\\s]/.test(s) || /^\/[a-z]+:/i.test(s)) return null
  return s
}

let productBankCache: Map<string, string | null> | null = null

/**
 * Реакция банка, дающая это вещество (или null).
 * Научный рецепт собран вручную ровно для ClO₂, поэтому ссылка
 * «#/?reactor=1&product=<id>» для остальных 199 веществ каталога не засевала
 * левую часть уравнения: кнопка «Проверить и запустить синтез» оставалась серой
 * и молча. Подбираем реакцию по продукту и работаем как с reaction=<bank-id>.
 */
export function bankReactionIdForProduct(productId: string | null | undefined): string | null {
  if (!productId) return null
  if (!productBankCache) productBankCache = new Map()
  const cached = productBankCache.get(productId)
  if (cached !== undefined) return cached
  const ids: string[] = []
  const primary = primaryReactionForCompound(productId)
  if (primary) ids.push(primary.id)
  for (const r of SCHOOL_REACTION_BANK) {
    if (r.productId === productId && !ids.includes(r.id)) ids.push(r.id)
  }
  // Сначала реакция, которую можно запустить; «только шарами» — если другой нет.
  const found =
    ids.find((id) => isBankReactionReactorReady(id) && isBankReactionSynthesizable(id)) ??
    ids.find((id) => isBankReactionReactorReady(id)) ??
    null
  productBankCache.set(productId, found)
  return found
}

/**
 * «product=<id>» без reaction= / eq= — подменяем реакцией банка.
 * Ссылки с genEq=1 и с разделом учебника не трогаем: у них свой сценарий.
 */
function productFallbackLinkParams(params: URLSearchParams): ReactorLinkParams | null {
  const productId = params.get('product')
  if (!productId || params.get('reactor') !== '1') return null
  if (params.get('genEq') === '1') return null
  if (params.get('learnG') || params.get('learnC') || params.get('learnS')) return null
  // Своё научное уравнение (ClO₂) важнее банка.
  if (hasScientificReactorRecipe(productId)) return null
  if (!compoundById[productId]) return null
  const bankId = bankReactionIdForProduct(productId)
  if (!bankId) return null
  return {
    spec: {
      reactionId: bankId,
      equation: null,
      main: productId,
      titleRu: params.get('title') || null,
    },
    balanceSelf: params.get('balance') === '1',
    backHref: sanitizeBackHref(params.get('src')),
  }
}

/** Параметры reaction= / eq= из query-строки; null — ссылка не про реакцию. */
export function parseReactorLinkParams(params: URLSearchParams): ReactorLinkParams | null {
  const reactionId = params.get('reaction')
  const equation = params.get('eq')
  if (!reactionId && !equation) return productFallbackLinkParams(params)
  return {
    spec: {
      reactionId: reactionId || null,
      equation: equation || null,
      main: params.get('main') || null,
      titleRu: params.get('title') || null,
    },
    balanceSelf: params.get('balance') === '1',
    backHref: sanitizeBackHref(params.get('src')),
  }
}

let bankSynthCache: Map<string, boolean> | null = null

/** Реакция банка открывается с запуском синтеза (не «только шарами»). */
export function isBankReactionSynthesizable(reactionId: string): boolean {
  if (!bankSynthCache) bankSynthCache = new Map()
  const cached = bankSynthCache.get(reactionId)
  if (cached != null) return cached
  const r = resolveReactorEquation({ reactionId })
  const ok = r.ok && r.stageOnly == null
  bankSynthCache.set(reactionId, ok)
  return ok
}

let bankSupportCache: Map<string, boolean> | null = null

/** Можно ли открыть реакцию банка в реакторе (кэш на все реакции). */
export function isBankReactionReactorReady(reactionId: string): boolean {
  if (!bankSupportCache) bankSupportCache = new Map()
  const cached = bankSupportCache.get(reactionId)
  if (cached != null) return cached
  const ok = resolveReactorEquation({ reactionId }).ok
  bankSupportCache.set(reactionId, ok)
  return ok
}
