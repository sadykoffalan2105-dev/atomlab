import type { CompoundDef } from '../types/chemistry'
import { isDiatomicNativeElement } from './diatomicElements'
import type { ReactorEquationTerm } from './reactorEquationBalance'
import { getElementBySymbol, getElementByZ } from '../data/elements'

export type ParseLeftSideErrorCode =
  | 'LEFT_EMPTY'
  | 'SEGMENT_PARSE_FAIL'
  | 'UNKNOWN_ELEMENT_SYMBOL'
  | 'MIXED_DIATOMIC'
  | 'NO_ADDENDUMS'

export type ParseLeftSideFail = {
  ok: false
  code: ParseLeftSideErrorCode
  params?: Record<string, string | number>
}

export type LabRecipeWarnCode = 'noEquals' | 'rhsMismatch'

/** Заменяет Unicode-подстрочные цифры на ASCII для разбора. */
function normalizeSubscripts(s: string): string {
  const map: Record<string, string> = {
    '\u2080': '0',
    '\u2081': '1',
    '\u2082': '2',
    '\u2083': '3',
    '\u2084': '4',
    '\u2085': '5',
    '\u2086': '6',
    '\u2087': '7',
    '\u2088': '8',
    '\u2089': '9',
  }
  let o = ''
  for (const ch of s) {
    o += map[ch] ?? ch
  }
  return o.replace(/\s+/g, '').replace(/·/g, '')
}

function parseOneAddendum(segment: string): { symbol: string; n: number; diatomic: boolean } | null {
  const s = normalizeSubscripts(segment.trim())
  if (!s) return null

  let i = 0
  let lead = ''
  while (i < s.length && s[i]! >= '0' && s[i]! <= '9') {
    lead += s[i]
    i++
  }
  const leadCoeff = lead ? parseInt(lead, 10) : 1
  if (!Number.isFinite(leadCoeff) || leadCoeff < 1) return null

  const rest = s.slice(i)
  if (!rest) return null

  let sym = ''
  let j = 0
  if (rest[0]! >= 'A' && rest[0]! <= 'Z') {
    sym += rest[0]
    j = 1
    if (rest[1] && rest[1] >= 'a' && rest[1] <= 'z') {
      sym += rest[1]
      j = 2
    }
  }
  if (!sym) return null

  const el = getElementBySymbol(sym)
  if (!el) return null

  const subStr = rest.slice(j)
  const subParsed = subStr ? parseInt(subStr, 10) : NaN

  if (isDiatomicNativeElement(el.z)) {
    if (subStr !== '' && subStr !== '2') return null
    return { symbol: el.symbol, n: leadCoeff, diatomic: true }
  }

  if (subStr !== '' && (!Number.isFinite(subParsed) || subParsed < 1)) return null
  const atomMult = subStr === '' ? 1 : subParsed!
  return { symbol: el.symbol, n: leadCoeff * atomMult, diatomic: false }
}

/**
 * Разбор левой части уравнения: «4Cr+4K+7O2» или с Unicode-подстрочными.
 */
export function parseReactionLeftSide(
  input: string,
  newId: () => string,
): { ok: true; terms: ReactorEquationTerm[] } | ParseLeftSideFail {
  const raw = input.trim()
  if (!raw) return { ok: false, code: 'LEFT_EMPTY' }

  const parts = raw.split(/\s*\+\s*/)
  const merged = new Map<string, { z: number; diatomic: boolean; n: number }>()

  for (const part of parts) {
    const p = part.trim()
    if (!p) continue
    const one = parseOneAddendum(p)
    if (!one) {
      return {
        ok: false,
        code: 'SEGMENT_PARSE_FAIL',
        params: { segment: p },
      }
    }
    const el = getElementBySymbol(one.symbol)
    if (!el) return { ok: false, code: 'UNKNOWN_ELEMENT_SYMBOL', params: { symbol: one.symbol } }

    const key = `${el.z}:${one.diatomic ? 'd' : 'a'}`
    const prev = merged.get(key)
    if (prev) {
      if (prev.diatomic !== one.diatomic) {
        return {
          ok: false,
          code: 'MIXED_DIATOMIC',
          params: { symbol: el.symbol },
        }
      }
      merged.set(key, { z: el.z, diatomic: one.diatomic, n: prev.n + one.n })
    } else {
      merged.set(key, { z: el.z, diatomic: one.diatomic, n: one.n })
    }
  }

  if (merged.size === 0) return { ok: false, code: 'NO_ADDENDUMS' }

  const terms: ReactorEquationTerm[] = []
  for (const { z, n, diatomic } of merged.values()) {
    if (diatomic) {
      terms.push({ id: newId(), z, coeff: n, diatomic: true })
    } else {
      terms.push({ id: newId(), z, coeff: n, diatomic: false })
    }
  }

  terms.sort((a, b) => (getElementByZ(a.z)?.symbol ?? '').localeCompare(getElementByZ(b.z)?.symbol ?? ''))

  return { ok: true, terms }
}

/**
 * Как parseReactionLeftSide, но у каждого слагаемого коэффициент 1 (для ручного уравнивания по эталону).
 */
export function parseReactionLeftSideUnitCoeffs(
  input: string,
  newId: () => string,
): { ok: true; terms: ReactorEquationTerm[] } | ParseLeftSideFail {
  const parsed = parseReactionLeftSide(input, newId)
  if (!parsed.ok) return parsed
  return {
    ok: true,
    terms: parsed.terms.map((t) => ({
      ...t,
      id: newId(),
      coeff: 1,
    })),
  }
}

/** Обратное преобразование термов в строку левой части (для поля ввода). */
export function formatLeftSideFromTerms(terms: readonly ReactorEquationTerm[]): string {
  return terms
    .map((t) => {
      const el = getElementByZ(t.z)
      const sym = el?.symbol ?? '?'
      const c = t.coeff
      const coeffStr = c === 1 ? '' : String(c)
      if (t.diatomic) {
        const body = `${sym}\u2082`
        return `${coeffStr}${body}`
      }
      return `${coeffStr}${sym}`
    })
    .join(' + ')
}

/** Убирает стехиометрические коэффициенты слева от «=» — ученик расставляет их вручную. */
export function stripLeftSideCoefficients(left: string): string {
  return left
    .split(/\s*\+\s*/)
    .map((part) => part.trim().replace(/^\d+/, ''))
    .filter((part) => part.length > 0)
    .join(' + ')
}

export function splitLaboratoryRecipe(recipe: string): { left: string; right: string } | null {
  const idx = recipe.indexOf('=')
  if (idx === -1) return null
  return { left: recipe.slice(0, idx).trim(), right: recipe.slice(idx + 1).trim() }
}

function normalizeFormulaCompare(s: string): string {
  return normalizeSubscripts(s).replace(/\s+/g, '').toLowerCase()
}

export function parseProductSideCoeffAndFormula(rhs: string): { coeff: number; formulaRest: string } {
  const t = rhs.trim()
  const m = t.match(/^(\d+)\s*(.+)$/)
  if (m) {
    const c = parseInt(m[1], 10)
    return { coeff: Number.isFinite(c) && c > 0 ? c : 1, formulaRest: m[2].trim() }
  }
  return { coeff: 1, formulaRest: t }
}

/** Левая часть и коэффициент продукта из `laboratoryRecipeRu` (первый «=»). */
export function generateFromLaboratoryRecipe(compound: CompoundDef): {
  manualLeft: string
  productCoeff: number
  warn?: LabRecipeWarnCode
} {
  const sp = splitLaboratoryRecipe(compound.laboratoryRecipeRu)
  if (!sp) {
    return { manualLeft: '', productCoeff: 1, warn: 'noEquals' }
  }
  const { coeff, formulaRest } = parseProductSideCoeffAndFormula(sp.right)
  const nc = normalizeFormulaCompare(formulaRest)
  const nf = normalizeFormulaCompare(compound.formulaUnicode)
  const warn: LabRecipeWarnCode | undefined =
    nc !== nf && formulaRest.length > 0 ? 'rhsMismatch' : undefined
  return { manualLeft: sp.left, productCoeff: coeff, warn }
}
