/**
 * Химически корректные 3D-модели для веществ каталога без PubChem/ручной геометрии:
 * VSEPR для молекул, ионные кластеры с правильной формой многоатомных ионов,
 * кристаллогидраты (вода вокруг катиона), двойные соли и минералы.
 * Масштаб: одинарная связь ≈ 0.5–0.6 ед., O–H ≈ 0.31–0.34.
 */
import type { Atom3D, CompoundCategory, Vec3 } from '../types/chemistry'

type V = [number, number, number]
type Bond = [number, number]

export interface Frag {
  sym: string[]
  pos: V[]
  bonds: Bond[]
  /** Знак заряда для чередования катион/анион в кластере (0 — нейтральная молекула). */
  charge: number
}

export type InorganicGeometryKind = 'molecule' | 'ionic' | 'network'

export interface InorganicGeometryDetailed {
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
  kind: InorganicGeometryKind
  /** Индексы атомов по фрагментам (ионы, молекулы воды, ...). */
  fragments: number[][]
}

// ---------- vector helpers ----------
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V): number => Math.hypot(a[0], a[1], a[2])
const norm = (a: V): V => {
  const l = len(a)
  return l < 1e-9 ? [1, 0, 0] : mul(a, 1 / l)
}
const dist = (a: V, b: V): number => len(sub(a, b))
function rotate(v: V, axis: V, ang: number): V {
  const k = norm(axis)
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))
}
/** Любой единичный вектор, перпендикулярный d. */
function perp(d: V): V {
  const ref: V = Math.abs(d[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0]
  return norm(cross(d, ref))
}

// ---------- element data ----------
const COV_R: Record<string, number> = {
  H: 0.31, Li: 1.28, Be: 0.96, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11,
  P: 1.07, S: 1.05, Cl: 1.02, K: 2.03, Ca: 1.76, Sc: 1.7, Ti: 1.6, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26,
  Ni: 1.24, Cu: 1.32, Zn: 1.22, Ga: 1.22, Ge: 1.2, As: 1.19, Se: 1.2, Br: 1.2, Kr: 1.16, Rb: 2.2, Sr: 1.95, Zr: 1.75,
  Mo: 1.54, Ag: 1.45, Cd: 1.44, In: 1.42, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Xe: 1.4, Cs: 2.44, Ba: 2.15, W: 1.62,
  Pt: 1.36, Au: 1.36, Hg: 1.32, Pb: 1.46, Bi: 1.48,
}
const VALENCE_E: Record<string, number> = {
  H: 1, B: 3, Al: 3, Ga: 3, C: 4, Si: 4, Ge: 4, Sn: 4, Pb: 4, N: 5, P: 5, As: 5, Sb: 5, Bi: 5, O: 6, S: 6, Se: 6, Te: 6,
  F: 7, Cl: 7, Br: 7, I: 7, Xe: 8, Kr: 8, Be: 2, Mg: 2, Zn: 2, Cd: 2, Hg: 2, Ti: 4, V: 5, Cr: 6, Mn: 7, Fe: 8, Au: 3,
  Pt: 4, W: 6, Sc: 3, Cu: 2, Ni: 2, Co: 2, Ag: 1,
}
const NONMETALS = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Te', 'I', 'Xe'])
const isMetal = (s: string): boolean => !NONMETALS.has(s)

/** Длина связи по ковалентным радиусам (масштаб приложения), зажата в [0.29, 0.74]. */
export function bondLen(a: string, b: string, order = 1): number {
  const ra = COV_R[a] ?? 1.4
  const rb = COV_R[b] ?? 1.4
  const k = order >= 3 ? 0.84 : order === 2 ? 0.9 : 1
  return Math.min(0.74, Math.max(0.29, (ra + rb) * 0.32 * k))
}

// ---------- VSEPR directions ----------
const TET: V[] = ([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] as V[]).map(norm)
const TRIG: V[] = [0, 1, 2].map((i) => {
  const a = Math.PI / 2 + (i * 2 * Math.PI) / 3
  return [Math.cos(a), Math.sin(a), 0] as V
})
const SQP: V[] = [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]]
const OCT: V[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const TBP: V[] = [...TRIG, [0, 0, 1], [0, 0, -1]]
function bentDirs(angleDeg: number): V[] {
  const h = (angleDeg * Math.PI) / 360
  return [[Math.sin(h), -Math.cos(h), 0], [-Math.sin(h), -Math.cos(h), 0]]
}

/** Направления лигандов для AXnEm. */
export function vseprDirs(n: number, lonePairs: number): V[] {
  const m = Math.max(0, lonePairs)
  if (n <= 1) return [[1, 0, 0]]
  if (n === 2) {
    if (m === 0 || m >= 3) return [[1, 0, 0], [-1, 0, 0]]
    return m === 1 ? bentDirs(119) : bentDirs(104.5)
  }
  if (n === 3) {
    if (m === 0) return TRIG
    if (m === 1) return [TET[0]!, TET[1]!, TET[2]!]
    return [[0, 1, 0], [0, -1, 0], [1, 0, 0]]
  }
  if (n === 4) {
    if (m === 0) return TET
    if (m === 1) return [[0, 0, 1], [0, 0, -1], TRIG[0]!, TRIG[1]!]
    return SQP
  }
  if (n === 5) {
    if (m === 0) return TBP
    return [...SQP, [0, 0, 1]]
  }
  if (n === 6) return OCT
  const out: V[] = [[0, 0, 1], [0, 0, -1]]
  for (let i = 0; i < n - 2; i++) {
    const a = (i * 2 * Math.PI) / (n - 2)
    out.push([Math.cos(a), Math.sin(a), 0])
  }
  return out
}

// ---------- fragment construction ----------
interface Lig {
  sym: string
  /** Кратность связи с центром (влияет на длину и подсчёт электронов). */
  order?: number
  /** Атомы, «висящие» на лиганде: H у OH/NH3/H2O, N у CN, S у NCS... */
  tail?: { sym: string; n: number; order?: number; linear?: boolean }
  len?: number
}

function fragOf(sym: string[], pos: V[], bonds: Bond[], charge: number): Frag {
  return { sym, pos, bonds, charge }
}

const mono = (sym: string, charge: number): Frag => fragOf([sym], [[0, 0, 0]], [], charge)

function diatomic(a: string, b: string, charge: number, order = 1, l?: number): Frag {
  const d = l ?? bondLen(a, b, order)
  return fragOf([a, b], [[-d / 2, 0, 0], [d / 2, 0, 0]], [[0, 1]], charge)
}

/** Центр + лиганды по направлениям dirs; хвосты лигандов (H у OH и т.п.) ставятся автоматически. */
function star(center: string, ligs: Lig[], dirs: V[], charge: number): Frag {
  const sym: string[] = [center]
  const pos: V[] = [[0, 0, 0]]
  const bonds: Bond[] = []
  ligs.forEach((lg, i) => {
    const d = dirs[i] ?? dirs[dirs.length - 1] ?? [1, 0, 0]
    const l = lg.len ?? bondLen(center, lg.sym, lg.order ?? 1)
    const p = mul(d, l)
    const li = sym.length
    sym.push(lg.sym)
    pos.push(p)
    bonds.push([0, li])
    if (lg.tail) {
      const t = lg.tail
      const tl = bondLen(lg.sym, t.sym, t.order ?? 1)
      if (t.linear) {
        sym.push(t.sym)
        pos.push(add(p, mul(d, tl)))
        bonds.push([li, sym.length - 1])
      } else if (t.n === 1) {
        // изогнутый угол центр–лиганд–хвост ≈ 109°
        const q = rotate(perp(d), d, i * 2.1 + 0.7)
        const hd = norm(add(mul(d, 0.326), mul(q, 0.945)))
        sym.push(t.sym)
        pos.push(add(p, mul(hd, tl)))
        bonds.push([li, sym.length - 1])
      } else {
        // пирамидальный/тетраэдрический хвост (NH3, H2O): остальные вершины тетраэдра
        const q0 = perp(d)
        for (let k = 0; k < t.n; k++) {
          const q = rotate(q0, d, (k * 2 * Math.PI) / 3 + i * 0.9)
          const hd = norm(add(mul(d, 0.333), mul(q, 0.943)))
          sym.push(t.sym)
          pos.push(add(p, mul(hd, tl)))
          bonds.push([li, sym.length - 1])
        }
      }
    }
  })
  return centerFrag(fragOf(sym, pos, bonds, charge))
}

function centerFrag(f: Frag): Frag {
  if (f.pos.length === 0) return f
  let c: V = [0, 0, 0]
  for (const p of f.pos) c = add(c, p)
  c = mul(c, 1 / f.pos.length)
  return { ...f, pos: f.pos.map((p) => sub(p, c)) }
}

/** Электронные пары центрального атома для VSEPR. */
function lonePairs(center: string, ligs: Lig[], charge = 0): number {
  const ve = VALENCE_E[center]
  if (ve === undefined) return 0
  let used = 0
  for (const lg of ligs) {
    const o = lg.order ?? (lg.sym === 'O' || lg.sym === 'S' || lg.sym === 'Se' ? (lg.tail ? 1 : 2) : 1)
    used += o
  }
  const rest = ve - used - charge
  return Math.max(0, Math.floor(rest / 2))
}

/** Обобщённая молекула AXn (в т.ч. смешанные лиганды) по VSEPR. */
function axn(center: string, ligs: Lig[], charge = 0, forceDirs?: V[]): Frag {
  const dirs = forceDirs ?? vseprDirs(ligs.length, lonePairs(center, ligs, charge))
  return star(center, ligs, dirs, charge)
}

function repeat(lg: Lig, n: number): Lig[] {
  return Array.from({ length: n }, () => ({ ...lg }))
}

/** Кислородный ион/кислота: центр X, nO атомов O, из них nH несут водород. */
function oxo(center: string, nO: number, nH: number, charge: number, forceDirs?: V[], extra: Lig[] = []): Frag {
  const ligs: Lig[] = []
  for (let i = 0; i < nO; i++) {
    if (i < nH) ligs.push({ sym: 'O', order: 1, tail: { sym: 'H', n: 1 } })
    else ligs.push({ sym: 'O', order: 2 })
  }
  ligs.push(...extra)
  // Кислородные анионы: терминальные O считаем двойными для подсчёта пар (даёт правильные формы SO3²⁻, ClO3⁻ ...)
  const lp = lonePairs(center, ligs, charge)
  const dirs = forceDirs ?? vseprDirs(ligs.length, lp)
  return star(center, ligs, dirs, charge)
}

/** Два центра X, соединённые мостиковым O (Cl₂O₇, Cr₂O₇²⁻, H₄P₂O₇, As₂O₅, B₂O₃ ...). */
function bridged(x: string, y: string, termPerX: number, nH: number, charge: number): Frag {
  const lb = bondLen(x, y)
  const lt = bondLen(x, y, 2)
  const half = (125 * Math.PI) / 360
  const sym: string[] = [y]
  const pos: V[] = [[0, 0, 0]]
  const bonds: Bond[] = []
  let hLeft = nH
  for (let s = 0; s < 2; s++) {
    const sign = s === 0 ? 1 : -1
    const dx: V = norm([sign * Math.sin(half), Math.cos(half), 0])
    const xp = mul(dx, lb)
    const xi = sym.length
    sym.push(x)
    pos.push(xp)
    bonds.push([0, xi])
    // терминальные атомы: тетраэдрические направления относительно связи X–O(мост)
    const back = mul(dx, -1)
    const q0 = perp(back)
    const n = termPerX
    for (let k = 0; k < n; k++) {
      let td: V
      if (n === 1) td = dx
      else if (n === 2) {
        const q = rotate(q0, dx, s * 1.3 + k * Math.PI)
        td = norm(add(mul(dx, Math.cos((120 * Math.PI) / 180) * -1), mul(q, Math.sin((120 * Math.PI) / 180))))
      } else {
        const q = rotate(q0, dx, s * 1.05 + (k * 2 * Math.PI) / n)
        td = norm(add(mul(dx, 0.333), mul(q, 0.943)))
      }
      const withH = hLeft > 0 && (s === 0 ? k % 2 === 0 || nH > n : k % 2 === 1 || nH > n)
      const ti = sym.length
      const l = withH ? lb : lt
      const tp = add(xp, mul(td, l))
      sym.push(y)
      pos.push(tp)
      bonds.push([xi, ti])
      if (withH) {
        hLeft--
        const q = perp(td)
        const hd = norm(add(mul(td, 0.326), mul(q, 0.945)))
        sym.push('H')
        pos.push(add(tp, mul(hd, bondLen(y, 'H'))))
        bonds.push([ti, sym.length - 1])
      }
    }
  }
  // если H остались (редко) — досыпаем на любые терминальные O без H
  return centerFrag(fragOf(sym, pos, bonds, charge))
}

/** Клетка X₄Y₆(+t терминальных Y): P₄O₁₀ (t=4), P₄O₆ (t=0), P₄S₇ (t=1). */
function cage4(x: string, y: string, t: number, charge: number): Frag {
  const lb = bondLen(x, y)
  const lt = bondLen(x, y, 2)
  const dXX = 2 * lb * Math.sin((127 * Math.PI) / 360)
  const R = (dXX * Math.sqrt(6)) / 4
  const sym: string[] = []
  const pos: V[] = []
  const bonds: Bond[] = []
  const verts = TET.map((d) => mul(d, R))
  for (const v of verts) {
    sym.push(x)
    pos.push(v)
  }
  const midDist = Math.sqrt(Math.max(0, R * R - (dXX * dXX) / 4))
  const push = Math.sqrt(Math.max(0, lb * lb - (dXX * dXX) / 4))
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const md = norm(add(verts[i]!, verts[j]!))
      const m = midDist + push
      sym.push(y)
      pos.push(mul(md, m))
      const oi = sym.length - 1
      bonds.push([i, oi], [j, oi])
    }
  }
  for (let i = 0; i < Math.min(4, t); i++) {
    sym.push(y)
    pos.push(mul(TET[i]!, R + lt))
    bonds.push([i, sym.length - 1])
  }
  return fragOf(sym, pos, bonds, charge)
}

function water(): Frag {
  return axn('O', repeat({ sym: 'H' }, 2), 0, bentDirs(104.5))
}

/** Цепочка sp³ (зигзаг) с заместителями; для карбоксильного C — плоские O. */
interface ChainAtom {
  sym: string
  subs: string[]
  planar?: boolean
}
function chain(atoms: ChainAtom[], charge: number): Frag {
  const sym: string[] = []
  const pos: V[] = []
  const bonds: Bond[] = []
  const l = 0.52
  const idx: number[] = []
  atoms.forEach((a, i) => {
    const p: V = [i * l * 0.8165, (i % 2) * l * 0.5773, 0]
    idx.push(sym.length)
    sym.push(a.sym)
    pos.push(p)
    if (i > 0) bonds.push([idx[i - 1]!, idx[i]!])
  })
  atoms.forEach((a, i) => {
    const ci = idx[i]!
    const p = pos[ci]!
    const up = i % 2 === 1 ? 1 : -1
    const hasPrev = i > 0
    const hasNext = i < atoms.length - 1
    let dirs: V[]
    if (a.planar) {
      const nb: V[] = []
      if (hasPrev) nb.push(norm(sub(pos[idx[i - 1]!]!, p)))
      if (hasNext) nb.push(norm(sub(pos[idx[i + 1]!]!, p)))
      if (nb.length === 0) dirs = TRIG
      else if (nb.length === 1) dirs = [rotate(nb[0]!, [0, 0, 1], (2 * Math.PI) / 3), rotate(nb[0]!, [0, 0, 1], (-2 * Math.PI) / 3)]
      else dirs = [norm(mul(add(nb[0]!, nb[1]!), -1))]
    } else {
      dirs = [norm([0, up * 0.577, 0.816]), norm([0, up * 0.577, -0.816])]
      if (!hasNext) dirs.push(norm([0.8165, -up * 0.5773, 0]))
      if (!hasPrev) dirs.push(norm([-0.8165, -up * 0.5773, 0]))
    }
    a.subs.forEach((s, k) => {
      const d = dirs[k] ?? dirs[dirs.length - 1]!
      const bl = a.planar ? bondLen(a.sym, s, 2) * 1.05 : bondLen(a.sym, s)
      sym.push(s)
      pos.push(add(p, mul(d, bl)))
      bonds.push([ci, sym.length - 1])
    })
  })
  return centerFrag(fragOf(sym, pos, bonds, charge))
}

/** Бензольное кольцо C₆ с заместителями по позициям (index 0 — ipso). */
function benzene(subs: (Frag | 'H')[], charge: number): Frag {
  const r = 0.48
  const sym: string[] = []
  const pos: V[] = []
  const bonds: Bond[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    sym.push('C')
    pos.push([r * Math.cos(a), r * Math.sin(a), 0])
  }
  for (let i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6])
  for (let i = 0; i < 6; i++) {
    const d = norm(pos[i]!)
    const s = subs[i] ?? 'H'
    if (s === 'H') {
      sym.push('H')
      pos.push(add(pos[i]!, mul(d, bondLen('C', 'H'))))
      bonds.push([i, sym.length - 1])
    } else {
      // подвесить фрагмент: его первый атом на расстоянии связи от кольца
      const base = sym.length
      const l = bondLen('C', s.sym[0]!)
      const anchor = add(pos[i]!, mul(d, l))
      const off = sub(anchor, s.pos[0]!)
      s.sym.forEach((ss, k) => {
        sym.push(ss)
        pos.push(add(s.pos[k]!, off))
      })
      for (const [a, b] of s.bonds) bonds.push([base + a, base + b])
      bonds.push([i, base])
    }
  }
  return centerFrag(fragOf(sym, pos, bonds, charge))
}

function alkyl(n: number): ChainAtom[] {
  const out: ChainAtom[] = []
  for (let i = 0; i < n; i++) out.push({ sym: 'C', subs: i === 0 ? ['H', 'H', 'H'] : ['H', 'H'] })
  return out
}
const carboxylate = (nC: number): Frag => chain([...alkyl(nC), { sym: 'C', subs: ['O', 'O'], planar: true }], -1)

// ---------- known ions ----------
type Sig = [string, number][]
interface IonDef {
  sig: Sig
  build: () => Frag
}
const T = (c: string, n: number, h = 0, q = -1): (() => Frag) => () => oxo(c, n, h, q, TET)
const P3 = (c: string, q = -1): (() => Frag) => () => oxo(c, 3, 0, q, TRIG)
const PYR = (c: string, q = -1): (() => Frag) => () => oxo(c, 3, 0, q, [TET[0]!, TET[1]!, TET[2]!])
const BENT = (c: string, ang: number, q = -1): (() => Frag) => () => oxo(c, 2, 0, q, bentDirs(ang))
const LIN2 = (c: string, q = -1): (() => Frag) => () => oxo(c, 2, 0, q, [[1, 0, 0], [-1, 0, 0]])

const ION_DEFS: IonDef[] = [
  // тетраэдрические
  { sig: [['S', 1], ['O', 4]], build: T('S', 4, 0, -2) },
  { sig: [['P', 1], ['O', 4]], build: T('P', 4, 0, -3) },
  { sig: [['Cl', 1], ['O', 4]], build: T('Cl', 4) },
  { sig: [['Mn', 1], ['O', 4]], build: T('Mn', 4) },
  { sig: [['Cr', 1], ['O', 4]], build: T('Cr', 4, 0, -2) },
  { sig: [['Si', 1], ['O', 4]], build: T('Si', 4, 0, -4) },
  { sig: [['Se', 1], ['O', 4]], build: T('Se', 4, 0, -2) },
  { sig: [['As', 1], ['O', 4]], build: T('As', 4, 0, -3) },
  { sig: [['W', 1], ['O', 4]], build: T('W', 4, 0, -2) },
  { sig: [['Mo', 1], ['O', 4]], build: T('Mo', 4, 0, -2) },
  { sig: [['V', 1], ['O', 4]], build: T('V', 4, 0, -3) },
  { sig: [['S', 2], ['O', 3]], build: () => oxo('S', 3, 0, -2, TET, [{ sym: 'S', order: 2 }]) },
  // кислые
  { sig: [['H', 1], ['S', 1], ['O', 4]], build: T('S', 4, 1) },
  { sig: [['H', 1], ['P', 1], ['O', 4]], build: T('P', 4, 1, -2) },
  { sig: [['H', 2], ['P', 1], ['O', 4]], build: T('P', 4, 2) },
  { sig: [['H', 1], ['S', 1], ['O', 3]], build: () => oxo('S', 3, 1, -1, [TET[0]!, TET[1]!, TET[2]!]) },
  { sig: [['H', 1], ['C', 1], ['O', 3]], build: () => oxo('C', 3, 1, -1, TRIG) },
  { sig: [['H', 1], ['Se', 1], ['O', 4]], build: T('Se', 4, 1) },
  // плоские
  { sig: [['N', 1], ['O', 3]], build: P3('N') },
  { sig: [['C', 1], ['O', 3]], build: P3('C', -2) },
  { sig: [['B', 1], ['O', 3]], build: P3('B', -3) },
  { sig: [['Si', 1], ['O', 3]], build: P3('Si', -2) },
  { sig: [['P', 1], ['O', 3]], build: P3('P', -1) },
  // пирамидальные
  { sig: [['S', 1], ['O', 3]], build: PYR('S', -2) },
  { sig: [['Cl', 1], ['O', 3]], build: PYR('Cl') },
  { sig: [['Br', 1], ['O', 3]], build: PYR('Br') },
  { sig: [['I', 1], ['O', 3]], build: PYR('I') },
  { sig: [['Se', 1], ['O', 3]], build: PYR('Se', -2) },
  { sig: [['As', 1], ['O', 3]], build: PYR('As', -3) },
  // изогнутые / линейные
  { sig: [['N', 1], ['O', 2]], build: BENT('N', 115) },
  { sig: [['Cl', 1], ['O', 2]], build: BENT('Cl', 118) },
  { sig: [['Al', 1], ['O', 2]], build: LIN2('Al') },
  { sig: [['Zn', 1], ['O', 2]], build: LIN2('Zn', -2) },
  { sig: [['Be', 1], ['O', 2]], build: LIN2('Be', -2) },
  { sig: [['Cr', 1], ['O', 2]], build: LIN2('Cr') },
  { sig: [['Si', 1], ['O', 2]], build: LIN2('Si', 0) },
  // двухцентровые
  { sig: [['Cr', 2], ['O', 7]], build: () => bridged('Cr', 'O', 3, 0, -2) },
  { sig: [['P', 2], ['O', 7]], build: () => bridged('P', 'O', 3, 0, -4) },
  { sig: [['S', 2], ['O', 7]], build: () => bridged('S', 'O', 3, 0, -2) },
  { sig: [['C', 2], ['O', 4]], build: () => chain([{ sym: 'C', subs: ['O', 'O'], planar: true }, { sym: 'C', subs: ['O', 'O'], planar: true }], -2) },
  // малые
  { sig: [['O', 1], ['H', 1]], build: () => diatomic('O', 'H', -1) },
  { sig: [['C', 1], ['N', 2]], build: () => star('C', [{ sym: 'N', order: 2 }, { sym: 'N', order: 2 }], [[1, 0, 0], [-1, 0, 0]], -2) },
  { sig: [['C', 1], ['N', 1]], build: () => diatomic('C', 'N', -1, 3) },
  { sig: [['N', 1], ['C', 1], ['S', 1]], build: () => star('C', [{ sym: 'N', order: 2 }, { sym: 'S', order: 2 }], [[1, 0, 0], [-1, 0, 0]], -1) },
  { sig: [['Cl', 1], ['O', 1]], build: () => diatomic('Cl', 'O', -1) },
  { sig: [['O', 1], ['Cl', 1]], build: () => diatomic('O', 'Cl', -1) },
  { sig: [['Br', 1], ['O', 1]], build: () => diatomic('Br', 'O', -1) },
  { sig: [['O', 3]], build: () => oxo('O', 2, 0, -1, bentDirs(114)) },
  { sig: [['O', 2]], build: () => diatomic('O', 'O', -1) },
  { sig: [['S', 2]], build: () => diatomic('S', 'S', -2) },
  { sig: [['C', 2]], build: () => diatomic('C', 'C', -2, 3) },
  { sig: [['N', 1], ['H', 4]], build: () => axn('N', repeat({ sym: 'H' }, 4), 1, TET) },
  { sig: [['N', 1], ['H', 2]], build: () => axn('N', repeat({ sym: 'H' }, 2), -1, bentDirs(104)) },
  { sig: [['H', 3], ['O', 1]], build: () => axn('O', repeat({ sym: 'H' }, 3), 1) },
  // органические анионы
  { sig: [['C', 17], ['H', 35], ['C', 1], ['O', 2]], build: () => carboxylate(17) },
  { sig: [['C', 15], ['H', 31], ['C', 1], ['O', 2]], build: () => carboxylate(15) },
  { sig: [['C', 1], ['H', 3], ['C', 1], ['H', 2], ['C', 1], ['H', 2], ['C', 1], ['O', 2]], build: () => carboxylate(3) },
  { sig: [['C', 2], ['H', 5], ['C', 1], ['O', 2]], build: () => carboxylate(2) },
  { sig: [['C', 1], ['H', 3], ['C', 1], ['O', 2]], build: () => carboxylate(1) },
  { sig: [['H', 1], ['C', 1], ['O', 2]], build: () => chain([{ sym: 'C', subs: ['O', 'O', 'H'], planar: true }], -1) },
  { sig: [['C', 6], ['H', 5], ['S', 1], ['O', 3]], build: () => benzene([oxo('S', 3, 0, -1, [TET[1]!, TET[2]!, TET[3]!])], -1) },
  { sig: [['C', 6], ['H', 5], ['O', 1]], build: () => benzene([mono('O', -1)], -1) },
  { sig: [['O', 1], ['C', 6], ['H', 5]], build: () => benzene([mono('O', -1)], -1) },
  { sig: [['C', 2], ['H', 5], ['O', 1]], build: () => chain([...alkyl(2), { sym: 'O', subs: [] }], -1) },
  { sig: [['C', 1], ['H', 3], ['O', 1]], build: () => chain([...alkyl(1), { sym: 'O', subs: [] }], -1) },
]
ION_DEFS.sort((a, b) => b.sig.reduce((s, [, n]) => s + n, 0) - a.sig.reduce((s, [, n]) => s + n, 0))

// ---------- formula parsing ----------
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
export function normalizeFormula(f: string): string {
  return f
    .replace(/[₀-₉]/g, (c) => SUB[c] ?? c)
    .replace(/[·*×∙•]/g, '·')
    .replace(/[⁺⁻⁰-⁹]/g, '')
    .replace(/\s+/g, '')
}

interface TokEl { kind: 'el'; sym: string; n: number }
interface TokGroup { kind: 'group'; items: Tok[]; n: number; bracket: boolean }
type Tok = TokEl | TokGroup

function tokenize(s: string): Tok[] | null {
  let i = 0
  const parseSeq = (close: string | null): Tok[] | null => {
    const out: Tok[] = []
    while (i < s.length) {
      const ch = s[i]!
      if (ch === close) return out
      if (ch === '(' || ch === '[') {
        const cl = ch === '(' ? ')' : ']'
        i++
        const items = parseSeq(cl)
        if (!items || s[i] !== cl) return null
        i++
        const m = /^\d+/.exec(s.slice(i))
        const n = m ? parseInt(m[0], 10) : 1
        if (m) i += m[0].length
        out.push({ kind: 'group', items, n, bracket: ch === '[' })
        continue
      }
      const m = /^([A-Z][a-z]?)(\d*)/.exec(s.slice(i))
      if (!m) return null
      i += m[0].length
      out.push({ kind: 'el', sym: m[1]!, n: m[2] ? parseInt(m[2], 10) : 1 })
    }
    return close ? null : out
  }
  return parseSeq(null)
}

function countsOf(toks: Tok[], acc: Record<string, number> = {}, mult = 1): Record<string, number> {
  for (const t of toks) {
    if (t.kind === 'el') acc[t.sym] = (acc[t.sym] ?? 0) + t.n * mult
    else countsOf(t.items, acc, mult * t.n)
  }
  return acc
}

// ---------- ion recognition ----------
function matchSig(run: TokEl[], start: number, sig: Sig): number | null {
  // Сигнатура должна идти подряд; последний элемент может «забрать» часть счётчика.
  let j = start
  for (let k = 0; k < sig.length; k++) {
    const [sym, n] = sig[k]!
    const t = run[j]
    if (!t || t.sym !== sym) return null
    if (t.n < n) return null
    if (t.n > n && k !== sig.length - 1 && !(k === 0)) return null
    if (t.n > n && k === 0 && sig.length > 1) return null
    j++
  }
  return j
}

function complexIon(items: Tok[]): Frag | null {
  const first = items[0]
  if (!first || first.kind !== 'el' || first.n !== 1) return null
  const metal = first.sym
  const ligs: Lig[] = []
  for (const t of items.slice(1)) {
    if (t.kind === 'el') {
      for (let k = 0; k < t.n; k++) ligs.push({ sym: t.sym, len: bondLen(metal, t.sym) * 1.08 })
      continue
    }
    const c = countsOf(t.items)
    const key = Object.entries(c).sort().map(([s, n]) => s + n).join('')
    const l = bondLen(metal, 'O') * 1.1
    for (let k = 0; k < t.n; k++) {
      if (key === 'H1O1') ligs.push({ sym: 'O', len: l, tail: { sym: 'H', n: 1 } })
      else if (key === 'C1N1') ligs.push({ sym: 'C', len: l, tail: { sym: 'N', n: 1, order: 3, linear: true } })
      else if (key === 'H3N1') ligs.push({ sym: 'N', len: l, tail: { sym: 'H', n: 3 } })
      else if (key === 'H2O1') ligs.push({ sym: 'O', len: l, tail: { sym: 'H', n: 2 } })
      else if (key === 'C1N1S1') ligs.push({ sym: 'N', len: l, tail: { sym: 'C', n: 1, order: 2, linear: true } })
      else return null
    }
  }
  if (ligs.some((lg) => lg.tail?.sym === 'C' && lg.sym === 'N')) {
    // NCS: добавить S за C — упрощённо через второй хвост невозможно; собираем вручную
    const base = star(metal, ligs, coordDirs(metal, ligs.length), 0)
    const sym = [...base.sym]
    const pos = [...base.pos]
    const bonds = [...base.bonds]
    base.sym.forEach((s, i) => {
      if (s !== 'C') return
      const nIdx = bonds.find(([, b]) => b === i)?.[0]
      if (nIdx === undefined) return
      const d = norm(sub(pos[i]!, pos[nIdx]!))
      sym.push('S')
      pos.push(add(pos[i]!, mul(d, bondLen('C', 'S', 2))))
      bonds.push([i, sym.length - 1])
    })
    return centerFrag(fragOf(sym, pos, bonds, -1))
  }
  return star(metal, ligs, coordDirs(metal, ligs.length), 0)
}

const SQUARE_PLANAR_METALS = new Set(['Cu', 'Pt', 'Pd', 'Au', 'Ni'])
function coordDirs(metal: string, n: number): V[] {
  if (n === 4 && SQUARE_PLANAR_METALS.has(metal)) return SQP
  return vseprDirs(n, 0)
}

/** Разложить токены на фрагменты ионов. */
function ionFragments(toks: Tok[], out: Frag[]): boolean {
  let run: TokEl[] = []
  const flush = (): boolean => {
    let i = 0
    while (i < run.length) {
      let matched = false
      for (const def of ION_DEFS) {
        const end = matchSig(run, i, def.sig)
        if (end === null) continue
        // возможные остатки счётчиков: у первого (если один элемент) и последнего
        const first = run[i]!
        const last = run[end - 1]!
        const lastNeed = def.sig[def.sig.length - 1]![1]
        const firstNeed = def.sig[0]![1]
        out.push(def.build())
        if (def.sig.length === 1) {
          const rest = first.n - firstNeed
          if (rest > 0) run[i] = { kind: 'el', sym: first.sym, n: rest }
          else i = end
        } else {
          const rest = last.n - lastNeed
          if (rest > 0) {
            run[end - 1] = { kind: 'el', sym: last.sym, n: rest }
            i = end - 1
          } else i = end
        }
        matched = true
        break
      }
      if (matched) continue
      const t = run[i]!
      for (let k = 0; k < t.n; k++) out.push(mono(t.sym, isMetal(t.sym) ? 1 : -1))
      i++
    }
    run = []
    return true
  }
  for (const t of toks) {
    if (t.kind === 'el') {
      run.push({ ...t })
      continue
    }
    flush()
    if (t.bracket) {
      const cx = complexIon(t.items)
      if (!cx) return false
      for (let k = 0; k < t.n; k++) out.push({ ...cx, charge: cx.charge })
      continue
    }
    const inner: Frag[] = []
    if (!ionFragments(t.items, inner)) return false
    for (let k = 0; k < t.n; k++) for (const f of inner) out.push(f)
  }
  flush()
  return true
}

// ---------- packing ----------
const PAD = 0.36
const DIRS: V[] = (() => {
  const out: V[] = []
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) out.push(norm([x, y, z]))
  const g = (1 + Math.sqrt(5)) / 2
  for (const a of [-1, 1]) for (const b of [-g, g]) out.push(norm([0, a, b]), norm([a, b, 0]), norm([b, 0, a]))
  return out
})()

function fragRadius(f: Frag): number {
  let m = 0
  for (const p of f.pos) m = Math.max(m, len(p))
  return m + PAD
}

function orient(f: Frag, k: number): Frag {
  if (f.pos.length <= 1) return f
  const axis: V = norm([1, 0.6 + 0.1 * (k % 3), 0.3 + 0.2 * (k % 5)])
  const ang = k * 2.39996
  return { ...f, pos: f.pos.map((p) => rotate(p, axis, ang)) }
}

function pack(frags: Frag[]): { atoms: Atom3D[]; bonds: Bond[]; fragments: number[][] } {
  const placed: { f: Frag; c: V; r: number }[] = []
  frags.forEach((f0, k) => {
    const f = orient(f0, k)
    const r = fragRadius(f)
    if (placed.length === 0) {
      placed.push({ f, c: [0, 0, 0], r })
      return
    }
    let best: { c: V; score: number } | null = null
    for (const p of placed) {
      for (const d of DIRS) {
        const c = add(p.c, mul(d, p.r + r))
        let ok = true
        for (const q of placed) {
          if (dist(c, q.c) < q.r + r - 1e-6) {
            ok = false
            break
          }
        }
        if (!ok) continue
        let score = len(c)
        if (f.charge !== 0 && p.f.charge !== 0 && Math.sign(f.charge) === Math.sign(p.f.charge)) score += 0.8
        if (f.charge === 0 && p.f.charge <= 0 && p.f.pos.length > 1) score += 0.3
        if (!best || score < best.score - 1e-9) best = { c, score }
      }
    }
    placed.push({ f, c: best ? best.c : [0, 0, placed.length * 1.2], r })
  })
  const atoms: Atom3D[] = []
  const bonds: Bond[] = []
  const fragments: number[][] = []
  for (const p of placed) {
    const base = atoms.length
    const ids: number[] = []
    p.f.sym.forEach((s, i) => {
      const q = add(p.f.pos[i]!, p.c)
      atoms.push({ symbol: s, pos: [q[0], q[1], q[2]] as Vec3 })
      ids.push(base + i)
    })
    for (const [a, b] of p.f.bonds) bonds.push([base + a, base + b])
    fragments.push(ids)
  }
  // центрирование по габаритам
  if (atoms.length) {
    const mn: V = [Infinity, Infinity, Infinity]
    const mx: V = [-Infinity, -Infinity, -Infinity]
    for (const a of atoms) for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i]!, a.pos[i]!)
      mx[i] = Math.max(mx[i]!, a.pos[i]!)
    }
    const c: V = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]
    for (const a of atoms) a.pos = [a.pos[0] - c[0], a.pos[1] - c[1], a.pos[2] - c[2]]
  }
  return { atoms, bonds, fragments }
}

/** Порядок фрагментов: катион, вода, анион, катион, анион ... */
function interleave(frags: Frag[]): Frag[] {
  const cat = frags.filter((f) => f.charge > 0)
  const an = frags.filter((f) => f.charge < 0)
  const neu = frags.filter((f) => f.charge === 0)
  const out: Frag[] = []
  const n = Math.max(cat.length, an.length)
  for (let i = 0; i < n; i++) {
    if (cat[i]) out.push(cat[i]!)
    if (i === 0) out.push(...neu)
    if (an[i]) out.push(an[i]!)
  }
  if (n === 0) out.push(...neu)
  return out
}

// ---------- molecules table ----------
const H = (n: number): Lig[] => repeat({ sym: 'H' }, n)
const X = (s: string, n: number, order = 1): Lig[] => repeat({ sym: s, order }, n)
const LIN: V[] = [[1, 0, 0], [-1, 0, 0]]

function p4(): Frag {
  const R = (bondLen('P', 'P') * Math.sqrt(6)) / 4
  const pos = TET.map((d) => mul(d, R))
  return fragOf(['P', 'P', 'P', 'P'], pos, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], 0)
}
function s8(): Frag {
  const l = bondLen('S', 'S')
  const h = 0.25
  const R = Math.sqrt(Math.max(0.01, l * l - 4 * h * h)) / (2 * Math.sin(Math.PI / 8))
  const sym: string[] = []
  const pos: V[] = []
  const bonds: Bond[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    sym.push('S')
    pos.push([R * Math.cos(a), R * Math.sin(a), i % 2 ? h : -h])
    bonds.push([i, (i + 1) % 8])
  }
  return fragOf(sym, pos, bonds, 0)
}
function n2h4(): Frag {
  const l = bondLen('N', 'N')
  const a = star('N', H(2), [TET[2]!, TET[3]!], 0)
  const b = star('N', H(2), [TET[0]!, TET[1]!], 0)
  return join(a, 0, b, 0, l, 0)
}
/** Склеить два фрагмента связью между атомами ai и bi вдоль оси x. */
function join(a: Frag, ai: number, b: Frag, bi: number, l: number, charge: number): Frag {
  const oa = mul(a.pos[ai]!, -1)
  const ob = mul(b.pos[bi]!, -1)
  const sym = [...a.sym, ...b.sym]
  const pos = [...a.pos.map((p) => add(add(p, oa), [-l / 2, 0, 0] as V)), ...b.pos.map((p) => add(add(p, ob), [l / 2, 0, 0] as V))]
  const bonds: Bond[] = [...a.bonds, ...b.bonds.map(([x, y]) => [x + a.sym.length, y + a.sym.length] as Bond), [ai, a.sym.length + bi]]
  return centerFrag(fragOf(sym, pos, bonds, charge))
}
function n2o4(): Frag {
  const a = star('N', X('O', 2, 2), [TRIG[0]!, TRIG[1]!], 0)
  const b = star('N', X('O', 2, 2), [mul(TRIG[0]!, -1), mul(TRIG[1]!, -1)], 0)
  return join(a, 0, b, 0, 0.56, 0)
}
function n2o3(): Frag {
  const a = star('N', X('O', 2, 2), [TRIG[0]!, TRIG[1]!], 0)
  const b = star('N', X('O', 1, 2), [mul(TRIG[1]!, -1)], 0)
  return join(a, 0, b, 0, 0.6, 0)
}
function feco5(): Frag {
  return star('Fe', repeat({ sym: 'C', len: 0.6, tail: { sym: 'O', n: 1, order: 3, linear: true } }, 5), TBP, 0)
}
function cyanogen(): Frag {
  const l = bondLen('C', 'N', 3)
  const c = bondLen('C', 'C')
  return fragOf(['N', 'C', 'C', 'N'], [[-c / 2 - l, 0, 0], [-c / 2, 0, 0], [c / 2, 0, 0], [c / 2 + l, 0, 0]], [[0, 1], [1, 2], [2, 3]], 0)
}
function hcn(): Frag {
  const l = bondLen('C', 'N', 3)
  const h = bondLen('C', 'H')
  return centerFrag(fragOf(['H', 'C', 'N'], [[-h, 0, 0], [0, 0, 0], [l, 0, 0]], [[0, 1], [1, 2]], 0))
}
function nh2oh(): Frag {
  const a = star('N', H(2), [TET[2]!, TET[3]!], 0)
  const b = star('O', H(1), [TET[0]!], 0)
  return join(a, 0, b, 0, bondLen('N', 'O'), 0)
}
function b4o7h2(): Frag {
  // кольцо B–O–B–O–B–O–B–O с терминальными O (приближённо)
  const r = 0.62
  const sym: string[] = []
  const pos: V[] = []
  const bonds: Bond[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    sym.push(i % 2 ? 'O' : 'B')
    pos.push([r * Math.cos(a), r * Math.sin(a), 0])
    bonds.push([i, (i + 1) % 8])
  }
  const term = [0, 2, 4]
  term.forEach((bi, k) => {
    const d = norm(pos[bi]!)
    const oi = sym.length
    sym.push('O')
    pos.push(add(pos[bi]!, mul(d, k === 2 ? bondLen('B', 'O', 2) : bondLen('B', 'O'))))
    bonds.push([bi, oi])
    if (k < 2) {
      const q = perp(d)
      sym.push('H')
      pos.push(add(pos[oi]!, mul(norm(add(mul(d, 0.326), mul(q, 0.945))), bondLen('O', 'H'))))
      bonds.push([oi, sym.length - 1])
    }
  })
  return centerFrag(fragOf(sym, pos, bonds, 0))
}

const MOLECULES: Record<string, () => Frag> = {
  H2: () => diatomic('H', 'H', 0, 1, 0.3),
  O2: () => diatomic('O', 'O', 0, 2),
  N2: () => diatomic('N', 'N', 0, 3),
  F2: () => diatomic('F', 'F', 0),
  Cl2: () => diatomic('Cl', 'Cl', 0),
  Br2: () => diatomic('Br', 'Br', 0),
  I2: () => diatomic('I', 'I', 0),
  CuCl: () => diatomic('Cu', 'Cl', 0),
  O3: () => oxo('O', 2, 0, 0, bentDirs(117)),
  P4: p4,
  S8: s8,
  BH3: () => axn('B', H(3), 0, TRIG),
  AlH3: () => axn('Al', H(3), 0, TRIG),
  CS2: () => axn('C', X('S', 2, 2), 0, LIN),
  COCl2: () => axn('C', [{ sym: 'O', order: 2 }, ...X('Cl', 2)], 0, TRIG),
  HCN: hcn,
  '(CN)2': cyanogen,
  C2N2: cyanogen,
  NOCl: () => axn('N', [{ sym: 'O', order: 2 }, { sym: 'Cl' }], 0, bentDirs(113)),
  N2H4: n2h4,
  NH2OH: nh2oh,
  N2O3: n2o3,
  N2O4: n2o4,
  Cl2O7: () => bridged('Cl', 'O', 3, 0, 0),
  Mn2O7: () => bridged('Mn', 'O', 3, 0, 0),
  Br2O7: () => bridged('Br', 'O', 3, 0, 0),
  I2O7: () => bridged('I', 'O', 3, 0, 0),
  Cl2O5: () => bridged('Cl', 'O', 2, 0, 0),
  Cl2O3: () => bridged('Cl', 'O', 1, 0, 0),
  Cl2O: () => oxo('O', 0, 0, 0, bentDirs(111), X('Cl', 2)),
  B2O3: () => bridged('B', 'O', 1, 0, 0),
  As2O5: () => bridged('As', 'O', 2, 0, 0),
  As2O3: () => bridged('As', 'O', 1, 0, 0),
  Sb2O3: () => bridged('Sb', 'O', 1, 0, 0),
  As2S3: () => bridged('As', 'S', 1, 0, 0),
  P2S3: () => bridged('P', 'S', 1, 0, 0),
  P2O5: () => bridged('P', 'O', 2, 0, 0),
  P4O10: () => cage4('P', 'O', 4, 0),
  P4O6: () => cage4('P', 'O', 0, 0),
  P4S7: () => cage4('P', 'S', 1, 0),
  'Fe(CO)5': feco5,
  HgCl2: () => axn('Hg', X('Cl', 2), 0, LIN),
  TiCl4: () => axn('Ti', X('Cl', 4), 0, TET),
  GeCl4: () => axn('Ge', X('Cl', 4), 0, TET),
  SnCl4: () => axn('Sn', X('Cl', 4), 0, TET),
  SbCl3: () => axn('Sb', X('Cl', 3), 0, [TET[0]!, TET[1]!, TET[2]!]),
  PtCl4: () => axn('Pt', X('Cl', 4), 0, SQP),
  AuCl3: () => axn('Au', X('Cl', 3), 0, TRIG),
  XeF4: () => axn('Xe', X('F', 4), 0, SQP),
  XeF2: () => axn('Xe', X('F', 2), 0, LIN),
  ClF3: () => axn('Cl', X('F', 3), 0, [[0, 1, 0], [0, -1, 0], [1, 0, 0]]),
  H2B4O7: b4o7h2,
  H4P2O7: () => bridged('P', 'O', 3, 4, 0),
  H2Cr2O7: () => bridged('Cr', 'O', 3, 2, 0),
  H4V2O7: () => bridged('V', 'O', 3, 4, 0),
  H2S2O7: () => bridged('S', 'O', 3, 2, 0),
  HPO3: () => oxo('P', 3, 1, 0, TRIG),
  H2SiO3: () => oxo('Si', 3, 2, 0, TRIG),
  HAlO2: () => oxo('Al', 2, 1, 0, LIN),
}

/** Формулы соединений с ковалентной решёткой: кластер с «контактными» связями. */
const NETWORK = new Set(['SiC', 'TiC', 'WC', 'AlN', 'AlP', 'Si3N4', 'BN', 'Fe3C', 'B4C', 'Al4C3', 'Mg2Si', 'CrN', 'FeN', 'GaAs'])
/** Ионные соединения из готовых фрагментов (не разбираются по общим правилам). */
const SPECIAL_IONIC: Record<string, () => Frag[]> = {
  HAuCl4: () => [mono('H', 1), axn('Au', X('Cl', 4), -1, SQP)],
  H2SiF6: () => [mono('H', 1), mono('H', 1), axn('Si', X('F', 6), -2, OCT)],
  'C3H5(ONa)3': () => [
    mono('Na', 1), mono('Na', 1), mono('Na', 1),
    chain([{ sym: 'C', subs: ['H', 'H', 'O'] }, { sym: 'C', subs: ['H', 'O'] }, { sym: 'C', subs: ['H', 'H', 'O'] }], -3),
  ],
  NaOCH2CH2ONa: () => [mono('Na', 1), mono('Na', 1), chain([{ sym: 'O', subs: [] }, { sym: 'C', subs: ['H', 'H'] }, { sym: 'C', subs: ['H', 'H'] }, { sym: 'O', subs: [] }], -2)],
  'Fe(OC6H5)3': () => [mono('Fe', 1), benzene([mono('O', -1)], -1), benzene([mono('O', -1)], -1), benzene([mono('O', -1)], -1)],
  CaOCl2: () => [mono('Ca', 1), diatomic('O', 'Cl', -1), mono('Cl', -1)],
}

function hydroxideMolecule(f: string): Frag | null {
  const m = /^([A-Z][a-z]?)(?:\(OH\)(\d+)|OH)$/.exec(f)
  if (!m || !isMetal(m[1]!)) return null
  const n = m[2] ? parseInt(m[2], 10) : 1
  return star(m[1]!, repeat({ sym: 'O', tail: { sym: 'H', n: 1 } }, n), vseprDirs(n, 0), 0)
}

function acidMolecule(f: string): Frag | null {
  let m = /^H(\d*)([A-Z][a-z]?)O(\d+)$/.exec(f)
  if (m) {
    const nH = m[1] ? parseInt(m[1], 10) : 1
    const nO = parseInt(m[3]!, 10)
    if (nH > nO) return null
    return oxo(m[2]!, nO, nH, 0)
  }
  m = /^H(\d*)([A-Z][a-z]?)2O(\d+)$/.exec(f)
  if (m) {
    const nH = m[1] ? parseInt(m[1], 10) : 1
    const nO = parseInt(m[3]!, 10)
    if (nO % 2 === 1 && nO >= 3) return bridged(m[2]!, 'O', (nO - 1) / 2, nH, 0)
  }
  m = /^H(\d*)(S|Se|Te|F|Cl|Br|I|N)$/.exec(f)
  if (m) {
    const nH = m[1] ? parseInt(m[1], 10) : 1
    return axn(m[2]!, H(nH), 0)
  }
  return null
}

/** Простая молекула из неметаллов: AXn или X2Yn. */
function genericMolecule(toks: Tok[]): Frag | null {
  const counts = countsOf(toks)
  const els = Object.keys(counts)
  if (els.some(isMetal)) return null
  if (els.length === 1) {
    const s = els[0]!
    const n = counts[s]!
    if (n === 2) return diatomic(s, s, 0)
    return null
  }
  const nonH = els.filter((e) => e !== 'H')
  // центр — элемент с count 1 и наименьшей электроотрицательностью (эвристика: не O/галоген)
  const centers = els.filter((e) => counts[e] === 1)
  const pick = centers.find((e) => !['O', 'F', 'Cl', 'Br', 'I', 'H'].includes(e)) ?? centers.find((e) => e !== 'H' && e !== 'O')
  if (pick) {
    const ligs: Lig[] = []
    for (const e of els) {
      if (e === pick) continue
      const isTerminalO = e === 'O' || e === 'S'
      ligs.push(...repeat({ sym: e, order: isTerminalO ? 2 : 1 }, counts[e]!))
    }
    if (ligs.length >= 1 && ligs.length <= 7) return axn(pick, ligs, 0)
  }
  if (nonH.length === 2) {
    const [a, b] = nonH.map((e) => [e, counts[e]!] as const).sort((p, q) => p[1] - q[1])
    if (a && b && a[1] === 2 && counts.H === undefined) {
      const y = b[1]
      if (y % 2 === 1) return bridged(a[0], b[0], (y - 1) / 2, 0, 0)
      const half = y / 2
      const s1 = star(a[0], X(b[0], half, 2), vseprDirs(half + 1, 0).slice(1), 0)
      const s2 = star(a[0], X(b[0], half, 2), vseprDirs(half + 1, 0).slice(1).map((d) => mul(d, -1)), 0)
      return join(s1, 0, s2, 0, bondLen(a[0], a[0]), 0)
    }
  }
  return null
}

/** Добавить «контактные» связи между соседними атомами разных фрагментов (ковалентные решётки). */
function addContactBonds(atoms: Atom3D[], bonds: Bond[], cap = 4): void {
  const deg = new Array<number>(atoms.length).fill(0)
  for (const [a, b] of bonds) {
    deg[a]!++
    deg[b]!++
  }
  const pairs: { i: number; j: number; d: number }[] = []
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      const ai = atoms[i]!
      const aj = atoms[j]!
      if (ai.symbol === aj.symbol) continue
      const d = Math.hypot(ai.pos[0] - aj.pos[0], ai.pos[1] - aj.pos[1], ai.pos[2] - aj.pos[2])
      if (d <= 0.75) pairs.push({ i, j, d })
    }
  pairs.sort((p, q) => p.d - q.d)
  for (const p of pairs) {
    if (deg[p.i]! >= cap || deg[p.j]! >= cap) continue
    bonds.push([p.i, p.j])
    deg[p.i]!++
    deg[p.j]!++
  }
}

function fragmentsForPart(part: string): { frags: Frag[]; molecule: boolean } | null {
  const f = normalizeFormula(part)
  if (f === 'H2O') return { frags: [water()], molecule: true }
  const sp = SPECIAL_IONIC[f]
  if (sp) return { frags: sp(), molecule: false }
  const molB = MOLECULES[f]
  if (molB) return { frags: [molB()], molecule: true }
  const toks = tokenize(f)
  if (!toks) return null
  const counts = countsOf(toks)
  const els = Object.keys(counts)
  const hasMetal = els.some(isMetal)
  const hasNH4 = /NH4/.test(f)
  const hyd = hydroxideMolecule(f)
  if (hyd) return { frags: [hyd], molecule: true }
  if (f.startsWith('H') && !hasNH4) {
    const ac = acidMolecule(f)
    if (ac) return { frags: [ac], molecule: true }
  }
  if (!hasMetal && !hasNH4) {
    const gm = genericMolecule(toks)
    if (gm) return { frags: [gm], molecule: true }
  }
  const frags: Frag[] = []
  if (!ionFragments(toks, frags)) return null
  return { frags, molecule: false }
}

function sameCounts(atoms: Atom3D[], composition: Record<string, number>): boolean {
  const got: Record<string, number> = {}
  for (const a of atoms) got[a.symbol] = (got[a.symbol] ?? 0) + 1
  const keys = new Set([...Object.keys(got), ...Object.keys(composition).filter((k) => (composition[k] ?? 0) > 0)])
  for (const k of keys) if ((got[k] ?? 0) !== (composition[k] ?? 0)) return false
  return true
}

/**
 * Полная сборка с метаданными (для проверок): null — если формулу не удалось разобрать
 * или состав не совпал с `composition`.
 */
export function buildInorganicGeometryDetailed(
  formulaUnicode: string,
  composition: Record<string, number>,
  _category: CompoundCategory,
  _id: string,
): InorganicGeometryDetailed | null {
  const f = normalizeFormula(formulaUnicode)
  if (!f) return null
  // гидраты / двойные соли / минералы: части через «·» с множителями
  const parts = f.split('·').filter(Boolean)
  const all: Frag[] = []
  let anyIonic = false
  for (const [pi, raw] of parts.entries()) {
    const m = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(raw)
    const mult = m ? Math.max(1, Math.round(parseFloat(m[1]!.replace(',', '.')))) : 1
    const body = m ? m[2]! : raw
    const r = fragmentsForPart(body)
    if (!r) return null
    if (!r.molecule || (pi > 0 && parts.length > 1) || parts.length > 1) anyIonic = anyIonic || !r.molecule || parts.length > 1
    for (let k = 0; k < mult; k++) for (const fr of r.frags) all.push(fr)
  }
  if (all.length === 0) return null
  const network = parts.length === 1 && NETWORK.has(f)
  let kind: InorganicGeometryKind = network ? 'network' : anyIonic || all.length > 1 ? 'ionic' : 'molecule'
  if (kind === 'molecule' && all.length === 1) {
    const fr = all[0]!
    const atoms = fr.sym.map((s, i) => ({ symbol: s, pos: [fr.pos[i]![0], fr.pos[i]![1], fr.pos[i]![2]] as Vec3 }))
    if (!sameCounts(atoms, composition)) return null
    return { atoms, bonds: fr.bonds, kind, fragments: [atoms.map((_, i) => i)] }
  }
  const packed = pack(interleave(all))
  if (!sameCounts(packed.atoms, composition)) return null
  if (network) addContactBonds(packed.atoms, packed.bonds)
  if (kind !== 'network' && all.every((fr) => fr.charge === 0)) kind = 'ionic'
  return { atoms: packed.atoms, bonds: packed.bonds, kind, fragments: packed.fragments }
}

/** Геометрия для каталога: атомы + связи (внутри ионов) или null. */
export function buildInorganicGeometry(
  formulaUnicode: string,
  composition: Record<string, number>,
  category: CompoundCategory,
  id: string,
): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } | null {
  const d = buildInorganicGeometryDetailed(formulaUnicode, composition, category, id)
  return d ? { atoms: d.atoms, bonds: d.bonds } : null
}
