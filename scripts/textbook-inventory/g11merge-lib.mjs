/**
 * Shared chemistry helpers for the grade-11 merge (formula parsing, equation parsing,
 * atom/charge balance incl. nuclear species "A/Z/Sym", unicode rendering, slugs).
 */
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }
export const UNSUB = Object.fromEntries(Object.entries(SUB).map(([k, v]) => [v, k]))
export const UNSUP = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]))
export const fromUni = (s) => [...(s || '')].map((c) => UNSUB[c] ?? UNSUP[c] ?? c).join('')

export const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'.split(' '))

export function toUnicode(f) {
  if (f == null) return null
  if (isNuclear(f)) {
    const [a, z, s] = f.split('/')
    return [...a].map((c) => SUP[c]).join('') + [...z].map((c) => (c === '-' ? '₋' : c === '+' ? '₊' : SUB[c])).join('') + s
  }
  if (f === 'e^-') return 'e⁻'
  const [body, charge] = f.split('^')
  const parts = body.split('·').map((p, i) => {
    let lead = ''
    if (i > 0) { const m = p.match(/^\d+/); if (m) { lead = m[0]; p = p.slice(lead.length) } }
    return lead + p.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((c) => SUB[c]).join(''))
  })
  let out = parts.join('·')
  if (charge) out += [...charge].map((c) => SUP[c] ?? c).join('')
  return out
}

export const isNuclear = (f) => /^-?\d+\/[+-]?\d+\/\S+$/.test(f || '')

/** {counts, charge} or null (general-scheme letters, words) */
export function parseFormula(f) {
  if (f == null) return null
  if (f === 'e^-' || f === 'e') return { counts: {}, charge: -1, electron: true }
  let [body, ch] = f.split('^')
  let charge = 0
  if (ch) {
    const m = ch.match(/^(\d*)([+-])$/)
    if (!m) return null
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1)
  }
  const counts = {}
  for (let part of body.split('·')) {
    let mult = 1
    const lm = part.match(/^(\d+)(?=[A-Z(])/)
    if (lm) { mult = Number(lm[1]); part = part.slice(lm[1].length) }
    const stack = [{}]
    let i = 0
    while (i < part.length) {
      const c = part[i]
      if (c === '(' || c === '[') { stack.push({}); i++; continue }
      if (c === ')' || c === ']') {
        i++
        let d = ''
        while (i < part.length && /\d/.test(part[i])) d += part[i++]
        const n = d ? Number(d) : 1
        if (stack.length < 2) return null
        const top = stack.pop()
        const cur = stack[stack.length - 1]
        for (const [e, k] of Object.entries(top)) cur[e] = (cur[e] || 0) + k * n
        continue
      }
      const m = part.slice(i).match(/^([A-Z][a-z]?)(\d*)/)
      if (!m || !ELEMENTS.has(m[1])) return null
      const cur = stack[stack.length - 1]
      cur[m[1]] = (cur[m[1]] || 0) + (m[2] ? Number(m[2]) : 1)
      i += m[0].length
    }
    if (stack.length !== 1) return null
    for (const [e, k] of Object.entries(stack[0])) counts[e] = (counts[e] || 0) + k * mult
  }
  if (!Object.keys(counts).length) return null
  return { counts, charge }
}

export const compKey = (p) => (p ? Object.keys(p.counts).sort().map((e) => `${e}${p.counts[e]}`).join('') + (p.charge ? `q${p.charge}` : '') : null)

export function splitEquation(eq) {
  const m = eq.match(/\s(→|⇌|=|⇄|↔|->|<=>)\s/)
  if (!m) return null
  const idx = eq.indexOf(m[0])
  return { arrow: m[1], left: eq.slice(0, idx), right: eq.slice(idx + m[0].length) }
}

export function parseSide(side) {
  return side.split(/\s\+\s/).map((t) => t.trim()).filter(Boolean).map((t) => {
    t = t.replace(/[↑↓]/g, '')
    if (isNuclear(t)) return { formula: t, coeff: 1 }
    const m = t.match(/^(\d+)(?=[A-Za-z(\[])/)
    const coeff = m ? Number(m[1]) : 1
    const formula = m ? t.slice(m[1].length) : t
    return { formula, coeff }
  })
}

const PARTICLE_Z = { p: 1, n: 0, 'β': null, e: -1 }
export function balanceCheck(reactants, products) {
  const all = [...reactants, ...products]
  if (all.some((x) => isNuclear(x.formula))) {
    const tot = (list) => list.reduce((acc, { formula, coeff }) => {
      if (!isNuclear(formula)) { acc.bad = true; return acc }
      const [a, z] = formula.split('/')
      acc.A += Number(a) * coeff; acc.Z += Number(z) * coeff
      return acc
    }, { A: 0, Z: 0, bad: false })
    const L = tot(reactants), R = tot(products)
    if (L.bad || R.bad) return { balanced: null, detail: 'mixed nuclear/chemical species' }
    const diff = []
    if (L.A !== R.A) diff.push(`mass number: ${L.A}≠${R.A}`)
    if (L.Z !== R.Z) diff.push(`charge: ${L.Z}≠${R.Z}`)
    return { balanced: diff.length === 0, detail: diff.join('; ') || null, mode: 'nuclear' }
  }
  const tot = (list) => {
    const c = {}; let q = 0
    for (const { formula, coeff } of list) {
      const p = parseFormula(formula)
      if (!p) return null
      for (const [e, k] of Object.entries(p.counts)) c[e] = (c[e] || 0) + k * coeff
      q += p.charge * coeff
    }
    return { c, q }
  }
  const L = tot(reactants), R = tot(products)
  if (!L || !R) return { balanced: null, detail: 'unparseable species' }
  const els = new Set([...Object.keys(L.c), ...Object.keys(R.c)])
  const diff = [...els].filter((e) => (L.c[e] || 0) !== (R.c[e] || 0)).map((e) => `${e}: ${L.c[e] || 0}≠${R.c[e] || 0}`)
  if (L.q !== R.q) diff.push(`charge: ${L.q}≠${R.q}`)
  return { balanced: diff.length === 0, detail: diff.join('; ') || null, mode: 'atoms+charge' }
}

export function equationUnicode(eq) {
  return eq.split(/(\s\+\s|\s(?:→|⇌|=|⇄)\s|\s\/\s)/).map((tok) => {
    if (/^\s/.test(tok)) return tok
    if (isNuclear(tok)) return toUnicode(tok)
    const m = tok.match(/^(\d*)(.*?)([↑↓]?)$/)
    if (/^\d*e\^-$/.test(tok)) return tok.replace('e^-', 'e⁻')
    const isScheme = !parseFormula(m[2])
    return m[1] + (isScheme ? m[2] : toUnicode(m[2])) + m[3]
  }).join('')
}
export const equationAscii = (eq) => eq.replace(/→/g, '->').replace(/⇌|⇄/g, '<=>').replace(/[↑↓]/g, '')

/** "Cu^2+" -> "cu2p", "SO4^2-" -> "so42m", "27/13/Al" -> "al27", "e^-" -> "e" */
export function speciesSlug(f) {
  if (isNuclear(f)) {
    const [a, , s] = f.split('/')
    const sym = { 'β': 'beta', p: 'p', n: 'n' }[s] ?? s.toLowerCase()
    return `${sym}${a}`
  }
  if (f === 'e^-') return 'e'
  return f.replace(/\^(\d*)\+/, (_, d) => `${d}p`).replace(/\^(\d*)-/, (_, d) => `${d}m`)
    .replace(/·/g, 'x').replace(/[()[\]]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase()
}

export function reactionSig(reactants, products) {
  const side = (list) => list.map(({ formula, coeff }) => `${compKey(parseFormula(formula)) ?? formula}*${coeff}`).sort().join('|')
  return side(reactants) + '=>' + side(products)
}
export function speciesSig(reactants, products) {
  const side = (list) => [...new Set(list.map(({ formula }) => compKey(parseFormula(formula)) ?? formula))].sort().join('|')
  return side(reactants) + '=>' + side(products)
}
