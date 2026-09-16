// Shared helpers for the grade-9 part-2 textbook inventory (formula parsing, unicode, balance, mapping).
// Pure functions, no repo writes.

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([d, s]) => [s, d]))
const UNSUP = Object.fromEntries(Object.entries(SUP).map(([d, s]) => [s, d]))

/** ASCII authoring formula -> {ascii, unicode}. Charges: "Ca^2+", "Cl^-". Hydrates: "CaSO4*2H2O". */
export function formulaForms(src) {
  let f = String(src).trim()
  let charge = ''
  const m = f.match(/\^(\d*)([+-])$/)
  if (m) {
    charge = (m[1] || '') + m[2]
    f = f.slice(0, m.index)
  }
  const parts = f.split('*')
  const uni = parts
    .map((p, i) => {
      let lead = ''
      let rest = p
      if (i > 0) {
        const mm = p.match(/^(\d+)(.*)$/)
        if (mm) {
          lead = mm[1]
          rest = mm[2]
        }
      }
      return lead + rest.replace(/([A-Za-z\)\]])(\d+)/g, (_, a, d) => a + d.split('').map((x) => SUB[x]).join(''))
    })
    .join('·')
  const ascii = f + (charge ? `^${charge}` : '')
  const unicode = uni + (charge ? charge.split('').map((x) => SUP[x]).join('') : '')
  return { ascii, unicode }
}

/** Unicode formula (catalog / bank) -> ASCII digits. */
export function unicodeToAscii(s) {
  return String(s)
    .split('')
    .map((ch) => UNSUB[ch] ?? UNSUP[ch] ?? ch)
    .join('')
    .replace(/·/g, '*')
}

/** Parse formula -> {counts, charge}. Supports (), [], hydrates with *, charge ^n+ */
export function parseFormula(src) {
  let f = String(src).trim().replace(/[↑↓]/g, '')
  let charge = 0
  const m = f.match(/\^(\d*)([+-])$/)
  if (m) {
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
    f = f.slice(0, m.index)
  }
  if (f === 'e' || f === 'e-') return { counts: {}, charge: -1 }
  const counts = {}
  for (const part0 of f.split('*')) {
    let part = part0
    let mult = 1
    const mm = part.match(/^(\d+)(.*)$/)
    if (mm) {
      mult = Number(mm[1])
      part = mm[2]
    }
    const c = parseGroup(part)
    if (!c) return null
    for (const [k, v] of Object.entries(c)) counts[k] = (counts[k] || 0) + v * mult
  }
  return { counts, charge }
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
      while (i < s.length && /\d/.test(s[i])) num += s[i++]
      const top = stack.pop()
      const n = num ? Number(num) : 1
      const cur = stack[stack.length - 1]
      if (!cur) return null
      for (const [k, v] of Object.entries(top)) cur[k] = (cur[k] || 0) + v * n
    } else if (/[A-Z]/.test(ch)) {
      let el = ch
      i++
      while (i < s.length && /[a-z]/.test(s[i])) el += s[i++]
      let num = ''
      while (i < s.length && /\d/.test(s[i])) num += s[i++]
      const cur = stack[stack.length - 1]
      cur[el] = (cur[el] || 0) + (num ? Number(num) : 1)
    } else {
      return null
    }
  }
  if (stack.length !== 1) return null
  return stack[0]
}

export function compKey(counts) {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

const ARROWS = [
  ['<=>', '⇌'],
  ['->', '→'],
  ['=', '='],
]

/** Parse cleaned ASCII equation "2Na + 2H2O -> 2NaOH + H2". Returns sides with {formula, coeff}. */
export function parseEquation(eq) {
  let arrow = null
  let idx = -1
  for (const [a, u] of ARROWS) {
    const k = eq.indexOf(a)
    if (k >= 0) {
      arrow = { a, u }
      idx = k
      break
    }
  }
  if (!arrow) return null
  const left = eq.slice(0, idx)
  const right = eq.slice(idx + arrow.a.length)
  const side = (s) =>
    s
      .split(/\s\+\s/)
      .map((t) => t.trim())
      .filter((t) => t && t !== 'Q' && t !== '- Q')
      .map((t) => {
        const mm = t.match(/^(\d+(?:\/\d+)?)\s*(.+)$/)
        let coeff = 1
        let formula = t
        if (mm && /^[A-Z(\[e]/.test(mm[2])) {
          coeff = mm[1].includes('/') ? eval(mm[1]) : Number(mm[1])
          formula = mm[2]
        }
        formula = formula.replace(/[↑↓]/g, '').trim()
        return { formula, coeff }
      })
  return { arrow: arrow.u, reactants: side(left), products: side(right) }
}

export function checkBalance(parsed) {
  if (!parsed) return { ok: false, reason: 'unparsed' }
  const tally = (arr) => {
    const c = {}
    let q = 0
    for (const { formula, coeff } of arr) {
      const p = parseFormula(formula)
      if (!p) return null
      for (const [k, v] of Object.entries(p.counts)) c[k] = (c[k] || 0) + v * coeff
      q += p.charge * coeff
    }
    return { c, q }
  }
  const L = tally(parsed.reactants)
  const R = tally(parsed.products)
  if (!L || !R) return { ok: false, reason: 'unparsable formula' }
  const els = new Set([...Object.keys(L.c), ...Object.keys(R.c)])
  const diffs = []
  for (const e of els) if (Math.abs((L.c[e] || 0) - (R.c[e] || 0)) > 1e-9) diffs.push(`${e}:${L.c[e] || 0}≠${R.c[e] || 0}`)
  if (Math.abs(L.q - R.q) > 1e-9) diffs.push(`charge:${L.q}≠${R.q}`)
  return diffs.length ? { ok: false, reason: diffs.join(', ') } : { ok: true }
}

export function equationUnicode(parsed, conditions) {
  const side = (arr) =>
    arr.map(({ formula, coeff }) => (coeff !== 1 ? String(coeff) : '') + formulaForms(formula).unicode).join(' + ')
  const arrow = parsed.arrow === '=' ? '→' : parsed.arrow
  return `${side(parsed.reactants)} ${arrow}${conditions ? `(${conditions})` : ''} ${side(parsed.products)}`
}

export function inferKind(ascii) {
  const p = parseFormula(ascii)
  if (!p) return 'other'
  if (p.charge) return 'other'
  const els = Object.keys(p.counts)
  const f = ascii.split('*')[0]
  if (els.length === 1) return 'simple'
  if (els.includes('C') && els.includes('H') && !/CO3|HCO3|CN|SCN|NCS/.test(f) && !/^H2CO3$/.test(f)) return 'organic'
  // binary nitrides, carbides, phosphides, hydrides, silicides
  if (els.length === 2 && !els.includes('O') && !/^H/.test(f) && els.some((e) => ['N', 'C', 'P', 'H', 'Si', 'B'].includes(e))) return 'other'
  if (/OH\)|OH$/.test(f) && !/^H/.test(f)) return 'base'
  if (els.length === 2 && els.includes('O') && !/O2$/.test(f.replace(/^(Na|K|Ba|Li)2?O2$/, 'x'))) return 'oxide'
  if (els.length === 2 && els.includes('O')) return 'oxide'
  if (/^H[A-Z0-9(]/.test(f) && f !== 'H2O') return 'acid'
  if (els.length === 2 && els.includes('H')) return 'other'
  return 'salt'
}
