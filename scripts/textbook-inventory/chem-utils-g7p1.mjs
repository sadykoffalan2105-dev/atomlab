// Helpers for textbook inventory (grade 7 part 1): formula parsing, unicode formatting,
// equation parsing and balance checking. Pure functions, no repo writes.

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]))
const UNSUP = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]))

/** ASCII formula -> unicode with subscripts. Charge after '^' becomes superscript: SO4^2- -> SO₄²⁻ */
export function toUnicode(f) {
  if (f == null) return null
  let charge = ''
  let body = f
  const ci = f.indexOf('^')
  if (ci >= 0) {
    body = f.slice(0, ci)
    charge = f
      .slice(ci + 1)
      .split('')
      .map((c) => SUP[c] ?? c)
      .join('')
  }
  // hydrate / adduct parts separated by '*' or '·'
  const parts = body.split(/[*·]/)
  const conv = parts.map((p, idx) => {
    let out = ''
    let lead = true
    for (let i = 0; i < p.length; i++) {
      const ch = p[i]
      if (/[0-9]/.test(ch)) {
        if (lead && idx > 0) out += ch // hydrate coefficient like 10H2O
        else out += SUB[ch]
      } else {
        lead = false
        out += ch
      }
    }
    return out
  })
  return conv.join('·') + charge
}

/** unicode formula -> ASCII */
export function toAscii(u) {
  return u
    .split('')
    .map((c) => UNSUB[c] ?? (UNSUP[c] != null ? UNSUP[c] : c))
    .join('')
    .replace(/·/g, '*')
}

/** Parse ASCII formula into element counts. Supports (), [], hydrates with '*'/'·', charges (ignored). */
export function parseFormula(f) {
  if (!f) return null
  let s = f.replace(/\^.*$/, '')
  const parts = s.split(/[*·]/)
  const total = {}
  for (let p of parts) {
    let mult = 1
    const m = p.match(/^(\d+)(.*)$/)
    if (m) {
      mult = Number(m[1])
      p = m[2]
    }
    const counts = parseGroup(p)
    if (!counts) return null
    for (const [e, n] of Object.entries(counts)) total[e] = (total[e] ?? 0) + n * mult
  }
  return total
}

function parseGroup(s) {
  const stack = [{}]
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(' || ch === '[') {
      stack.push({})
      i++
    } else if (ch === ')' || ch === ']') {
      i++
      let num = ''
      while (i < s.length && /[0-9]/.test(s[i])) num += s[i++]
      const n = num ? Number(num) : 1
      const top = stack.pop()
      if (!top || stack.length === 0) return null
      const cur = stack[stack.length - 1]
      for (const [e, c] of Object.entries(top)) cur[e] = (cur[e] ?? 0) + c * n
    } else if (/[A-Z]/.test(ch)) {
      let el = ch
      i++
      while (i < s.length && /[a-z]/.test(s[i])) el += s[i++]
      let num = ''
      while (i < s.length && /[0-9]/.test(s[i])) num += s[i++]
      const n = num ? Number(num) : 1
      const cur = stack[stack.length - 1]
      cur[el] = (cur[el] ?? 0) + n
    } else {
      return null
    }
  }
  if (stack.length !== 1) return null
  return stack[0]
}

export function compKey(counts) {
  if (!counts) return null
  return Object.keys(counts)
    .filter((k) => counts[k] > 0)
    .sort()
    .map((k) => `${k}${counts[k]}`)
    .join('')
}

/** Split equation into sides. Returns {left, right, arrow} or null. */
export function splitEquation(eq) {
  const m = eq.match(/\s*(⇌|⇄|↔|→|->|=|⟶)(\([^)]*\))?\s*/)
  if (!m) return null
  const idx = eq.indexOf(m[0])
  return { left: eq.slice(0, idx), right: eq.slice(idx + m[0].length), arrow: m[1] }
}

/** Parse one side "2H2 + O2" -> [{formula, coeff}] (ASCII). Strips ↑ ↓ and +Q/-Q. */
export function parseSide(side) {
  const cleaned = toAscii(side.replace(/\s*[-–+]\s*(Q|энергия)\s*$/, ''))
    .replace(/[↑↓]/g, '')
    .replace(/\(\s*(t°|t|kat|кат\.?|hv|hν|свет|электрический ток)\s*\)/gi, '')
  const terms = cleaned
    .split(/\s\+\s|\s\+|\+\s/)
    .map((t) => t.trim())
    .filter((t) => t && !/^[-+]?\s*Q$/.test(t))
  const out = []
  for (const t of terms) {
    const m = t.match(/^(\d+)\s*([A-Z(\[].*)$/)
    if (m) out.push({ formula: m[2].trim(), coeff: Number(m[1]) })
    else out.push({ formula: t, coeff: 1 })
  }
  return out
}

export function parseEquation(eq) {
  const sp = splitEquation(eq)
  if (!sp) return null
  return { reactants: parseSide(sp.left), products: parseSide(sp.right), arrow: sp.arrow }
}

/** Returns {balanced, parsed, diff} */
export function checkBalance(reactants, products) {
  const tally = (list) => {
    const t = {}
    for (const { formula, coeff } of list) {
      const c = parseFormula(formula)
      if (!c) return null
      for (const [e, n] of Object.entries(c)) t[e] = (t[e] ?? 0) + n * coeff
    }
    return t
  }
  const L = tally(reactants)
  const R = tally(products)
  if (!L || !R) return { balanced: null, parsed: false, diff: null }
  const els = new Set([...Object.keys(L), ...Object.keys(R)])
  const diff = {}
  for (const e of els) if ((L[e] ?? 0) !== (R[e] ?? 0)) diff[e] = [(L[e] ?? 0), (R[e] ?? 0)]
  return { balanced: Object.keys(diff).length === 0, parsed: true, diff }
}
