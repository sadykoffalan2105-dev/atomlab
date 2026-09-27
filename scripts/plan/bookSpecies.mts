/**
 * Вещества из реакций учебников 7–11 (src/data/textbook/equations-gN.json): разбор формул и сопоставление с каталогом.
 * Общий код для scripts/plan/coverage-books.mts, scripts/test-catalog-textbook-substances.mts,
 * scripts/verify-catalog-200.mts и генератора классов простых веществ.
 */
import fs from 'node:fs'

export type BookRx = {
  id: string
  page: number | null
  equation: string
  equationAscii: string
  isIonic: boolean
  isGeneralScheme: boolean
  exercise?: boolean
  lab: { ok: boolean; reason?: string; altHref?: string }
}
export type BookUnit = { unitId: string; kp: string; reactions: BookRx[] }

export const BOOK_GRADES = [7, 8, 9, 10, 11] as const
export type BookGrade = (typeof BOOK_GRADES)[number]

const SUB = '₀₁₂₃₄₅₆₇₈₉'
export const normFormula = (f: string) =>
  f.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d))).replace(/[↑↓\s]/g, '').replace(/·/g, '*').replace(/[‐‑–—]/g, '-')

/** Брутто-состав формулы (скобки, гидраты); null — не формула. */
export function formulaCounts(f0: string): Record<string, number> | null {
  const f = normFormula(f0).replace(/[-=≡]/g, '').replace(/\((тв|г|ж|р-р|aq|s|g|l|конц|разб)\.?\)$/i, '')
  if (!/^[A-Z(\[]/.test(f)) return null
  const out: Record<string, number> = {}
  for (const part0 of f.split('*')) {
    const m0 = /^(\d+)(.*)$/.exec(part0)
    const k0 = m0 ? Number(m0[1]) : 1
    const part = m0 ? m0[2]! : part0
    const stack: Record<string, number>[] = [{}]
    const re = /([A-Z][a-z]?|\(|\)|\[|\])(\d*)/g
    let m: RegExpExecArray | null
    let consumed = 0
    while ((m = re.exec(part))) {
      if (m.index !== consumed) return null
      consumed = m.index + m[0].length
      const [, tok, num] = m
      if (tok === '(' || tok === '[') stack.push({})
      else if (tok === ')' || tok === ']') {
        const top = stack.pop()
        if (!top || !stack.length) return null
        for (const [e, c] of Object.entries(top)) stack[stack.length - 1]![e] = (stack[stack.length - 1]![e] ?? 0) + c * (num ? Number(num) : 1)
      } else stack[stack.length - 1]![tok!] = (stack[stack.length - 1]![tok!] ?? 0) + (num ? Number(num) : 1)
    }
    if (consumed !== part.length || stack.length !== 1) return null
    for (const [e, c] of Object.entries(stack[0]!)) out[e] = (out[e] ?? 0) + c * k0
  }
  return Object.keys(out).length ? out : null
}

export const compositionKey = (c: Record<string, number>) => Object.keys(c).sort().map((e) => e + c[e]).join('')

/** Вещества уравнения (без ионов, e⁻, радикалов, общих схем). */
export function equationSpecies(eq: string): string[] {
  const s = eq.replace(/\s*\(([^)]*)\)\s*$/, '')
  // «=» — стрелка только там, где нет настоящей стрелки: иначе это двойная связь (CH₂=CH₂)
  const hasArrow = /→|->|⇄|⇌|<=>|<->/.test(s)
  const parts = s.split(hasArrow ? /\s*(?:→|->|⇄|⇌|<=>|<->)\s*/ : /\s*=\s*/)
  if (parts.length < 2) return []
  const out: string[] = []
  for (const side of parts) for (const t of side.split(/\s\+\s/)) {
    const x = t.trim().replace(/^\d+\s*/, '').replace(/^n(?=[A-Z(])/, '')
    if (!x || /\^|[⁺⁻•·]$|e\^?-|^e[⁻-]$|\bR\b|Me|Hal|\bn\b|ₙ|\)n$/.test(x) || /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(x)) continue
    out.push(x)
  }
  return out
}

export function readBook(grade: number, root = '.'): BookUnit[] {
  const book = JSON.parse(fs.readFileSync(`${root}/src/data/textbook/equations-g${grade}.json`, 'utf8')) as { units: BookUnit[] }
  return book.units
}

export type BookSpecies = {
  /** Формула, как в первом уравнении, где встретилась. */
  formula: string
  key: string
  counts: Record<string, number>
  grades: Set<number>
  /** Первая страница по классам. */
  firstPage: Map<number, number>
}

/** Все вещества из реакций книг (без общих схем): ключ состава → вещество. */
export function collectBookSpecies(root = '.'): Map<string, BookSpecies> {
  const all = new Map<string, BookSpecies>()
  for (const g of BOOK_GRADES) {
    for (const u of readBook(g, root)) for (const r of u.reactions) {
      if (r.isGeneralScheme) continue
      for (const sp of equationSpecies(r.equationAscii || r.equation)) {
        const c = formulaCounts(sp)
        if (!c) continue
        const k = compositionKey(c)
        const cur = all.get(k) ?? { formula: sp, key: k, counts: c, grades: new Set<number>(), firstPage: new Map<number, number>() }
        cur.grades.add(g)
        if (typeof r.page === 'number' && (cur.firstPage.get(g) ?? Infinity) > r.page) cur.firstPage.set(g, r.page)
        all.set(k, cur)
      }
    }
  }
  return all
}

/**
 * Атомарные обозначения учебника, которые не отдельные вещества: «[H]» — атомарный водород-восстановитель,
 * «O» — атомарный кислород (электролиз, 9 кл.). В каталоге им соответствуют H₂ и O₂.
 */
export const ATOMIC_NOTATION_ALIAS: Readonly<Record<string, string>> = { H1: 'H2', O1: 'O2' }
