/**
 * SMILES ↔ SkeletonGraph: разбор простого SMILES (циклы, ветви, кратности, [N+], [O-], [nH], ароматика → Кекуле,
 * / \ для цис/транс) и запись SMILES в форме Кекуле с заданным порядком обхода (канонический — в canonical.ts).
 */
import { bondKey, toMol, type BondOrder, type Mol, type SkeletonAtom, type SkeletonBond, type SkeletonGraph } from './graph'

const ORGANIC = ['Cl', 'Br', 'B', 'C', 'N', 'O', 'P', 'S', 'F', 'I']
const AROM = ['c', 'n', 'o', 's', 'p', 'b']

/** Ошибка разбора SMILES (позиция в строке). */
export class SmilesError extends Error {
  readonly pos: number
  constructor(msg: string, pos: number) { super(`${msg} (позиция ${pos})`); this.pos = pos }
}

/** Разбор SMILES. Ароматические кольца переводятся в форму Кекуле. */
export function parseSmiles(s: string): SkeletonGraph {
  const atoms: { el: string; charge: number; h?: number; ar: boolean }[] = []
  const bonds: { a: number; b: number; o: number; dir?: string }[] = []
  const stack: number[] = []
  const rings = new Map<number, { atom: number; o: number; dir?: string }>()
  let prev = -1
  let pendO = 0
  let pendDir: string | undefined
  let i = 0
  const addAtom = (el: string, charge: number, h: number | undefined, ar: boolean) => {
    const idx = atoms.length
    atoms.push({ el, charge, h, ar })
    if (prev >= 0) bonds.push({ a: prev, b: idx, o: pendO || (ar && atoms[prev].ar ? 4 : 1), dir: pendDir })
    prev = idx; pendO = 0; pendDir = undefined
  }
  while (i < s.length) {
    const c = s[i]
    if (c === '(') { stack.push(prev); i++; continue }
    if (c === ')') { if (!stack.length) throw new SmilesError('лишняя «)»', i); prev = stack.pop()!; i++; continue }
    if (c === '-') { pendO = 1; i++; continue }
    if (c === '=') { pendO = 2; i++; continue }
    if (c === '#') { pendO = 3; i++; continue }
    if (c === ':') { pendO = 4; i++; continue }
    if (c === '/' || c === '\\') { pendO = 1; pendDir = c; i++; continue }
    if (c === '.') { prev = -1; i++; continue }
    if (c === '%' || /\d/.test(c)) {
      let num: number
      if (c === '%') { num = parseInt(s.slice(i + 1, i + 3), 10); i += 3 } else { num = +c; i++ }
      if (prev < 0) throw new SmilesError('цифра цикла без атома', i)
      const open = rings.get(num)
      if (open) {
        const o = pendO || open.o || (atoms[prev].ar && atoms[open.atom].ar ? 4 : 1)
        bonds.push({ a: open.atom, b: prev, o, dir: pendDir ?? open.dir })
        rings.delete(num)
      } else rings.set(num, { atom: prev, o: pendO, dir: pendDir })
      pendO = 0; pendDir = undefined
      continue
    }
    if (c === '[') {
      const j = s.indexOf(']', i)
      if (j < 0) throw new SmilesError('нет «]»', i)
      const body = s.slice(i + 1, j)
      const m = /^(\d*)([A-Z][a-z]?|[cnospb])(@{0,2})(H\d?)?([+-]\d*|\+\+|--)?/.exec(body)
      if (!m) throw new SmilesError(`не понимаю атом [${body}]`, i)
      const ar = /^[cnospb]$/.test(m[2])
      const el = ar ? m[2].toUpperCase() : m[2]
      const h = m[4] ? (m[4].length > 1 ? +m[4].slice(1) : 1) : 0
      let charge = 0
      if (m[5]) charge = m[5] === '++' ? 2 : m[5] === '--' ? -2 : (m[5][0] === '+' ? 1 : -1) * (m[5].length > 1 ? +m[5].slice(1) : 1)
      addAtom(el, charge, h, ar)
      i = j + 1
      continue
    }
    const two = s.slice(i, i + 2)
    if (two === 'Cl' || two === 'Br') { addAtom(two, 0, undefined, false); i += 2; continue }
    if (ORGANIC.includes(c)) { addAtom(c, 0, undefined, false); i++; continue }
    if (AROM.includes(c)) { addAtom(c.toUpperCase(), 0, undefined, true); i++; continue }
    if (c === ' ' || c === '\t') break
    throw new SmilesError(`неизвестный символ «${c}»`, i)
  }
  if (rings.size) throw new SmilesError('незакрытый цикл', s.length)
  if (stack.length) throw new SmilesError('не хватает «)»', s.length)
  kekulize(atoms, bonds)
  const g: SkeletonGraph = {
    atoms: atoms.map((a): SkeletonAtom => ({ el: a.el, ...(a.charge ? { charge: a.charge } : {}), ...(a.h !== undefined ? { h: a.h } : {}) })),
    bonds: bonds.map((b): SkeletonBond => ({ a: b.a, b: b.b, o: b.o as BondOrder })),
  }
  return applyDirectionalStereo(g, bonds)
}

/** Ароматические связи (o=4) → чередование 1/2 перебором паросочетания. */
function kekulize(atoms: { el: string; charge: number; h?: number; ar: boolean }[], bonds: { a: number; b: number; o: number }[]): void {
  const arBonds = bonds.filter((b) => b.o === 4)
  if (!arBonds.length) return
  arBonds.forEach((b) => { b.o = 1 })
  // каким ароматическим атомам нужна двойная связь
  const used = atoms.map(() => 0)
  for (const b of bonds) { used[b.a] += b.o; used[b.b] += b.o }
  const need = atoms.map((a, i) => {
    if (!a.ar) return false
    if (a.h !== undefined && a.h > 0 && a.el !== 'C') return false // [nH]
    if (a.el === 'O' || a.el === 'S') return a.charge > 0
    if (a.el === 'N') return a.charge > 0 ? true : used[i] + (a.h ?? 0) < 3
    return used[i] + (a.h ?? 0) < 4 // C: σ-связей + H < 4 → нужна π
  })
  const nb = new Map<number, { b: { o: number }; to: number }[]>()
  for (const b of arBonds) {
    if (!nb.has(b.a)) nb.set(b.a, [])
    if (!nb.has(b.b)) nb.set(b.b, [])
    nb.get(b.a)!.push({ b, to: b.b }); nb.get(b.b)!.push({ b, to: b.a })
  }
  const matched = atoms.map(() => false)
  const order = atoms.map((_, i) => i).filter((i) => need[i])
  const solve = (k: number): boolean => {
    while (k < order.length && matched[order[k]]) k++
    if (k >= order.length) return true
    const v = order[k]
    for (const e of nb.get(v) ?? []) {
      if (!need[e.to] || matched[e.to]) continue
      matched[v] = matched[e.to] = true; e.b.o = 2
      if (solve(k + 1)) return true
      matched[v] = matched[e.to] = false; e.b.o = 1
    }
    return false
  }
  if (!solve(0)) throw new SmilesError('не удаётся расставить двойные связи в ароматическом кольце', 0)
}

function applyDirectionalStereo(g: SkeletonGraph, raw: { a: number; b: number; o: number; dir?: string }[]): SkeletonGraph {
  if (!raw.some((b) => b.dir)) return g
  const flip = (c: string) => (c === '/' ? '\\' : '/')
  const bonds = g.bonds.map((b) => ({ ...b })) as { a: number; b: number; o: BondOrder; cisTrans?: 'cis' | 'trans'; ref?: [number, number] }[]
  bonds.forEach((db) => {
    if (db.o !== 2) return
    // левый конец — атом с меньшим индексом (записан раньше)
    const L = Math.min(db.a, db.b), R = Math.max(db.a, db.b)
    const side = (end: number, isLeft: boolean): { x: number; e: string } | null => {
      for (const r of raw) {
        if (!r.dir || r.o !== 1) continue
        if (r.a !== end && r.b !== end) continue
        const x = r.a === end ? r.b : r.a
        // r записана как "p dir q", p = r.a (раньше), q = r.b
        const e = isLeft ? (r.b === end ? r.dir : flip(r.dir)) : (r.a === end ? r.dir : flip(r.dir))
        return { x, e }
      }
      return null
    }
    const l = side(L, true), r = side(R, false)
    if (!l || !r) return
    db.cisTrans = l.e === r.e ? 'trans' : 'cis'
    db.ref = db.a === L ? [l.x, r.x] : [r.x, l.x]
  })
  return { atoms: g.atoms, bonds }
}

const SMILES_VAL: Record<string, number[]> = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1] }

function atomText(m: Mol, i: number): string {
  const el = m.el[i], ch = m.ch[i], h = m.hc[i]
  const used = m.adj[i].reduce((s, e) => s + e.o, 0)
  const vals = SMILES_VAL[el]
  if (vals && ch === 0) {
    const v = vals.find((x) => x >= used)
    if (v !== undefined && v - used === h) return el
  }
  const hs = h ? (h > 1 ? `H${h}` : 'H') : ''
  const cs = ch ? (ch > 0 ? '+' : '-') + (Math.abs(ch) > 1 ? Math.abs(ch) : '') : ''
  return `[${el}${hs}${cs}]`
}

/**
 * Запись SMILES (Кекуле) из Mol. `rank` задаёт порядок обхода (меньший — раньше); по умолчанию — индексы.
 * Цис/транс записывается символами / и \.
 */
export function writeSmiles(m: Mol, rank?: number[]): string {
  const rk = rank ?? m.el.map((_, i) => i)
  const visited = new Array(m.n).fill(false)
  const parts: string[] = []
  // 1-й проход: дерево обхода, замыкания циклов, порядок записи
  const pos = new Array(m.n).fill(-1)
  let t = 0
  const children: number[][] = Array.from({ length: m.n }, () => [])
  const closures: { a: number; b: number; o: BondOrder }[] = []
  const treeParent = new Array(m.n).fill(-1)
  const sortedNb = (v: number) => [...m.adj[v]].sort((p, q) => rk[p.to] - rk[q.to])
  const dfs1 = (v: number, parent: number) => {
    visited[v] = true; pos[v] = t++
    for (const e of sortedNb(v)) {
      if (e.to === parent) continue
      if (visited[e.to]) { if (pos[e.to] < pos[v]) closures.push({ a: e.to, b: v, o: e.o }); continue }
      children[v].push(e.to); treeParent[e.to] = v
      dfs1(e.to, v)
    }
  }
  const starts = m.el.map((_, i) => i).sort((p, q) => rk[p] - rk[q])
  const roots: number[] = []
  for (const s0 of starts) if (!visited[s0]) { roots.push(s0); dfs1(s0, -1) }
  // символы направления для цис/транс (только связи дерева)
  const dir = new Map<string, string>() // ключ "p>q" — связь записана от p к q
  const flip = (c: string) => (c === '/' ? '\\' : '/')
  const writtenBefore = (x: number, y: number) => pos[x] < pos[y]
  const isTree = (x: number, y: number) => treeParent[x] === y || treeParent[y] === x
  const getDir = (x: number, y: number): string | undefined => dir.get(`${x}>${y}`) ?? dir.get(`${y}>${x}`)
  for (const [key, st] of m.stereo) {
    const [i0, j0] = key.split('-').map(Number)
    const [a, b] = writtenBefore(i0, j0) ? [i0, j0] : [j0, i0]
    const ra0 = a === i0 ? st.ref[0] : st.ref[1], rb0 = a === i0 ? st.ref[1] : st.ref[0]
    const pick = (end: number, other: number, pref: number) => {
      const cands = m.adj[end].map((e) => e.to).filter((x) => x !== other && isTree(x, end))
      const withDir = cands.find((x) => getDir(x, end))
      return withDir ?? (cands.includes(pref) ? pref : cands[0])
    }
    const x = pick(a, b, ra0), y = pick(b, a, rb0)
    if (x === undefined || y === undefined) continue
    // если опорный атом сменился на другого соседа — цис/транс меняется
    let v = st.v
    if (x !== ra0) v = v === 'cis' ? 'trans' : 'cis'
    if (y !== rb0) v = v === 'cis' ? 'trans' : 'cis'
    const eff = (p: number, q: number, end: number, left: boolean): string | undefined => {
      const c = dir.get(`${p}>${q}`)
      if (!c) return undefined
      return left ? (q === end ? c : flip(c)) : (p === end ? c : flip(c))
    }
    const keyOf = (u: number, w: number) => (writtenBefore(u, w) ? [u, w] : [w, u])
    const [lp, lq] = keyOf(x, a), [rp, rq] = keyOf(b, y)
    let e1 = eff(lp, lq, a, true)
    let e2 = eff(rp, rq, b, false)
    if (!e1 && !e2) e1 = '/'
    if (!e1) e1 = v === 'trans' ? e2! : flip(e2!)
    if (!e2) e2 = v === 'trans' ? e1 : flip(e1)
    if (!dir.has(`${lp}>${lq}`)) dir.set(`${lp}>${lq}`, lq === a ? e1 : flip(e1))
    if (!dir.has(`${rp}>${rq}`)) dir.set(`${rp}>${rq}`, rp === b ? e2 : flip(e2))
  }
  // номера циклов
  const ringNums = new Map<number, { num: number; o: BondOrder; partner: number }[]>()
  const free: number[] = []
  let next = 1
  const ringAt: { atom: number; num: number; o: BondOrder; open: boolean }[][] = Array.from({ length: m.n }, () => [])
  const closeOrder = [...closures].sort((p, q) => pos[p.a] - pos[q.a] || pos[p.b] - pos[q.b])
  // выдаём номера в порядке открытия, освобождаем после закрытия
  const events: { at: number; c: (typeof closures)[0]; open: boolean }[] = []
  for (const c of closeOrder) { events.push({ at: pos[c.a], c, open: true }); events.push({ at: pos[c.b], c, open: false }) }
  events.sort((p, q) => p.at - q.at || (p.open === q.open ? 0 : p.open ? 1 : -1))
  const numOf = new Map<(typeof closures)[0], number>()
  for (const ev of events) {
    if (ev.open) {
      const num = free.length ? free.sort((p, q) => p - q).shift()! : next++
      numOf.set(ev.c, num)
      ringAt[ev.c.a].push({ atom: ev.c.b, num, o: ev.c.o, open: true })
    } else {
      const num = numOf.get(ev.c)!
      ringAt[ev.c.b].push({ atom: ev.c.a, num, o: ev.c.o, open: false })
      free.push(num)
    }
  }
  void ringNums
  const bondSym = (o: BondOrder) => (o === 2 ? '=' : o === 3 ? '#' : '')
  const write = (v: number, parent: number): string => {
    let out = ''
    if (parent >= 0) {
      const e = m.adj[v].find((x) => x.to === parent)!
      out += e.o === 1 ? dir.get(`${parent}>${v}`) ?? '' : bondSym(e.o)
    }
    out += atomText(m, v)
    for (const r of ringAt[v]) out += (r.open ? bondSym(r.o) : '') + (r.num > 9 ? `%${r.num}` : r.num)
    const ch = children[v]
    ch.forEach((c, k) => { const s2 = write(c, v); out += k < ch.length - 1 ? `(${s2})` : s2 })
    return out
  }
  for (const r of roots) parts.push(write(r, -1))
  return parts.join('.')
}

/** SMILES скелета в порядке индексов (не канонический). */
export function toSmiles(g: SkeletonGraph): string {
  return writeSmiles(toMol(g))
}

export { bondKey }
