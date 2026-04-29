import type { Atom3D, CompoundCategory, Vec3 } from '../types/chemistry'
import { getElementBySymbol } from '../data/elements'
import { mergeIonic } from './ionicComposition'

/** FNV-1a 32-bit — стабильный хэш строки для сида раскладки. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function makeRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function expandSymbols(composition: Record<string, number>): string[] {
  const keys = Object.keys(composition)
    .filter((k) => (composition[k] ?? 0) > 0)
    .sort((a, b) => a.localeCompare(b))
  const symbols: string[] = []
  for (const sym of keys) {
    const n = composition[sym] ?? 0
    for (let i = 0; i < n; i++) symbols.push(sym)
  }
  return symbols
}

function shuffleSymbols(symbols: string[], seed: number): string[] {
  const arr = [...symbols]
  const rnd = makeRng(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
  return arr
}

function centerAtOrigin(pos: number[][]): void {
  if (pos.length === 0) return
  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of pos) {
    cx += p[0]!
    cy += p[1]!
    cz += p[2]!
  }
  const n = pos.length
  cx /= n
  cy /= n
  cz /= n
  for (const p of pos) {
    p[0]! -= cx
    p[1]! -= cy
    p[2]! -= cz
  }
}

/** Масштаб по макс. расстоянию от начала координат (после centerAtOrigin). */
function normalizeExtent(pos: number[][], targetRadius: number): void {
  let m = 0
  for (const p of pos) {
    m = Math.max(m, Math.hypot(p[0]!, p[1]!, p[2]!))
  }
  if (m < 1e-8) return
  const s = targetRadius / m
  for (const p of pos) {
    p[0]! *= s
    p[1]! *= s
    p[2]! *= s
  }
}

type V3 = [number, number, number]

function vAdd(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
function vMul(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}
function vLen(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]) || 1
}
function vNorm(a: V3): V3 {
  const l = vLen(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}

function rotateY(v: V3, ang: number): V3 {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}
function rotateZ(v: V3, ang: number): V3 {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]
}

function tetraDirs(): V3[] {
  const t = 1 / Math.sqrt(3)
  return [
    [t, t, t],
    [t, -t, -t],
    [-t, t, -t],
    [-t, -t, t],
  ]
}

function trigonalPlanarDirs(): V3[] {
  const a = (2 * Math.PI) / 3
  return [
    [1, 0, 0],
    [Math.cos(a), Math.sin(a), 0],
    [Math.cos(2 * a), Math.sin(2 * a), 0],
  ]
}

function octaDirs(): V3[] {
  return [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]
}

function dirsForCount(k: number, seed: number): V3[] {
  if (k <= 0) return []
  if (k === 1) return [[1, 0, 0]]
  if (k === 2) return [[1, 0, 0], [-1, 0, 0]]
  if (k === 3) return trigonalPlanarDirs()
  if (k === 4) return tetraDirs()
  if (k === 5) {
    // trigonal bipyramidal (approx)
    return [
      ...trigonalPlanarDirs().map((v) => vMul(vNorm(v as V3), 1)),
      [0, 0, 1],
      [0, 0, -1],
    ]
  }
  if (k === 6) return octaDirs()

  // Fibonacci sphere with deterministic rotation
  const out: V3[] = []
  const rotA = ((seed >>> 0) / 0xffffffff) * Math.PI * 2
  const rotB = (((seed ^ 0x9e3779b9) >>> 0) / 0xffffffff) * Math.PI * 2
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < k; i++) {
    const y = 1 - (i / Math.max(1, k - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const v: V3 = [Math.cos(theta) * r, y, Math.sin(theta) * r]
    out.push(rotateZ(rotateY(v, rotA), rotB))
  }
  return out.map(vNorm)
}

function compositionKey(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
}

function pickCenterSymbol(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, n]) => (n ?? 0) > 0)
  if (entries.length === 0) return 'C'

  // Prefer a chemically plausible “central” atom: higher typical valence wins.
  // Tie-break: non-hydrogen, then smaller multiplicity, then higher Z.
  const typicalValence = (sym: string): number => {
    const s = sym.toUpperCase()
    if (s === 'H') return 1
    if (s === 'O') return 2
    if (s === 'N') return 3
    if (s === 'C') return 4
    if (s === 'P') return 5
    if (s === 'S') return 6
    // Metals / common centers in salts
    if (['NA','K','LI','CS','AG'].includes(s)) return 1
    if (['MG','CA','BA','SR','ZN','CU','FE','PB','SN','MN','NI','CO','AL','CR'].includes(s)) return 4
    return 3
  }

  const scored = entries.map(([sym, n]) => {
    const e = getElementBySymbol(sym)
    const z = e?.z ?? 0
    const isH = sym.toUpperCase() === 'H'
    return { sym, n, z, isH, v: typicalValence(sym) }
  })
  scored.sort((a, b) => {
    if (a.v !== b.v) return b.v - a.v
    if (a.isH !== b.isH) return a.isH ? 1 : -1
    if (a.n !== b.n) return a.n - b.n
    if (a.z !== b.z) return b.z - a.z
    return a.sym.localeCompare(b.sym)
  })
  return scored[0]!.sym
}

function minDist(a: string, b: string): number {
  const A = a.toUpperCase()
  const B = b.toUpperCase()
  if (A === 'H' && B === 'H') return 0.5
  if (A === 'H' || B === 'H') return 0.56
  return 0.62
}

function relaxPositions(symbols: string[], pos: V3[], seed: number, fixed: Set<number>) {
  const rnd = makeRng(seed ^ 0xa5a5a5a5)
  const iters = 34
  for (let it = 0; it < iters; it++) {
    const step = 0.028 * (1 - it / iters)
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const pi = pos[i]!
        const pj = pos[j]!
        const dx = pi[0] - pj[0]
        const dy = pi[1] - pj[1]
        const dz = pi[2] - pj[2]
        const d = Math.hypot(dx, dy, dz) || 1e-6
        const md = minDist(symbols[i]!, symbols[j]!)
        if (d >= md) continue
        const push = (md - d) * step
        const ux = dx / d
        const uy = dy / d
        const uz = dz / d
        if (!fixed.has(i)) pos[i] = [pi[0] + ux * push, pi[1] + uy * push, pi[2] + uz * push]
        if (!fixed.has(j)) pos[j] = [pj[0] - ux * push, pj[1] - uy * push, pj[2] - uz * push]
      }
    }
    // tiny deterministic jitter to break deadlocks
    for (let i = 0; i < pos.length; i++) {
      if (fixed.has(i)) continue
      const p = pos[i]!
      const j = (rnd() - 0.5) * 0.006
      pos[i] = [p[0] + j, p[1] - j, p[2] + j * 0.7]
    }
  }
}

function buildStarGroup(symbols: string[], centerIndex: number, seed: number, bondLen: number): { pos: V3[]; bonds: [number, number][] } {
  const n = symbols.length
  const pos: V3[] = new Array(n).fill(null).map(() => [0, 0, 0])
  const bonds: [number, number][] = []

  const outers: number[] = []
  for (let i = 0; i < n; i++) if (i !== centerIndex) outers.push(i)
  const dirs = dirsForCount(Math.max(0, outers.length), seed)

  pos[centerIndex] = [0, 0, 0]

  const typicalValence = (sym: string): number => {
    const s = sym.toUpperCase()
    if (s === 'H') return 1
    if (s === 'O') return 2
    if (s === 'N') return 3
    if (s === 'C') return 4
    if (s === 'P') return 5
    if (s === 'S') return 6
    if (['NA','K','LI','CS','AG'].includes(s)) return 1
    if (['MG','CA','BA','SR','ZN','CU','FE','PB','SN','MN','NI','CO','AL','CR'].includes(s)) return 4
    return 3
  }

  // Place all outers around the center using VSEPR-like directions.
  for (let k = 0; k < outers.length; k++) {
    const i = outers[k]!
    const d = dirs[k] ?? [1, 0, 0]
    pos[i] = vMul(d, bondLen)
  }

  // Build bonds with a simple valence cap:
  // center bonds first (up to its typical valence), then attach remaining atoms to non-H atoms with free valence.
  const cap = new Array<number>(n).fill(0).map((_, i) => typicalValence(symbols[i]!))
  const used = new Array<number>(n).fill(0)

  const isH = (i: number) => (symbols[i] ?? '').toUpperCase() === 'H'
  const preferOuter = [...outers].sort((a, b) => (isH(a) === isH(b) ? 0 : isH(a) ? 1 : -1))

  const attach = (a0: number, b0: number) => {
    const a = Math.min(a0, b0)
    const b = Math.max(a0, b0)
    bonds.push([a, b])
    used[a0]++
    used[b0]++
  }

  for (const i of preferOuter) {
    if (used[centerIndex] >= cap[centerIndex]) break
    if (used[i] >= cap[i]) continue
    attach(centerIndex, i)
  }

  // Remaining atoms: attach to a non-H neighbor with available valence (prefer center, then other heavies).
  const heavies = [...Array(n).keys()].filter((i) => !isH(i)).sort((a, b) => (a === centerIndex ? -1 : b === centerIndex ? 1 : 0))
  for (const i of preferOuter) {
    if (bonds.some(([a, b]) => (a === Math.min(i, centerIndex) && b === Math.max(i, centerIndex)))) continue
    if (used[i] >= cap[i]) continue
    // find host
    let host = -1
    for (const h of heavies) {
      if (h === i) continue
      if (used[h] >= cap[h]) continue
      host = h
      break
    }
    if (host >= 0) attach(host, i)
  }

  return { pos, bonds }
}

type IonDef = {
  id: string
  charge: number
  comp: Record<string, number>
  /** Build positions and internal bonds for ONE ion unit. */
  build: (seed: number) => { symbols: string[]; pos: V3[]; bonds: [number, number][] }
}

function buildMonatomic(sym: string): (seed: number) => { symbols: string[]; pos: V3[]; bonds: [number, number][] } {
  return () => ({ symbols: [sym], pos: [[0, 0, 0]], bonds: [] })
}

function buildPolyatomicCenterOuter(center: string, outer: string, outerCount: number, planar = false) {
  return (seed: number) => {
    const symbols = [center, ...new Array(outerCount).fill(outer)]
    const bondLen = outer === 'H' ? 0.72 : 0.62
    let dirs: V3[]
    if (outerCount === 3 && planar) dirs = trigonalPlanarDirs()
    else dirs = dirsForCount(outerCount, seed)
    const pos: V3[] = [[0, 0, 0]]
    for (let i = 0; i < outerCount; i++) pos.push(vMul(vNorm(dirs[i] ?? [1, 0, 0]), bondLen))
    const bonds: [number, number][] = []
    for (let i = 1; i < symbols.length; i++) bonds.push([0, i])
    return { symbols, pos, bonds }
  }
}

const CATIONS: IonDef[] = [
  { id: 'na', charge: 1, comp: { Na: 1 }, build: buildMonatomic('Na') },
  { id: 'k', charge: 1, comp: { K: 1 }, build: buildMonatomic('K') },
  { id: 'li', charge: 1, comp: { Li: 1 }, build: buildMonatomic('Li') },
  { id: 'ag', charge: 1, comp: { Ag: 1 }, build: buildMonatomic('Ag') },
  { id: 'cs', charge: 1, comp: { Cs: 1 }, build: buildMonatomic('Cs') },
  { id: 'nh4', charge: 1, comp: { N: 1, H: 4 }, build: buildPolyatomicCenterOuter('N', 'H', 4) },
  { id: 'mg', charge: 2, comp: { Mg: 1 }, build: buildMonatomic('Mg') },
  { id: 'ca', charge: 2, comp: { Ca: 1 }, build: buildMonatomic('Ca') },
  { id: 'ba', charge: 2, comp: { Ba: 1 }, build: buildMonatomic('Ba') },
  { id: 'sr', charge: 2, comp: { Sr: 1 }, build: buildMonatomic('Sr') },
  { id: 'zn', charge: 2, comp: { Zn: 1 }, build: buildMonatomic('Zn') },
  { id: 'cu2', charge: 2, comp: { Cu: 1 }, build: buildMonatomic('Cu') },
  { id: 'fe2', charge: 2, comp: { Fe: 1 }, build: buildMonatomic('Fe') },
  { id: 'pb2', charge: 2, comp: { Pb: 1 }, build: buildMonatomic('Pb') },
  { id: 'sn2', charge: 2, comp: { Sn: 1 }, build: buildMonatomic('Sn') },
  { id: 'mn2', charge: 2, comp: { Mn: 1 }, build: buildMonatomic('Mn') },
  { id: 'ni2', charge: 2, comp: { Ni: 1 }, build: buildMonatomic('Ni') },
  { id: 'co2', charge: 2, comp: { Co: 1 }, build: buildMonatomic('Co') },
  { id: 'al', charge: 3, comp: { Al: 1 }, build: buildMonatomic('Al') },
  { id: 'fe3', charge: 3, comp: { Fe: 1 }, build: buildMonatomic('Fe') },
  { id: 'cr3', charge: 3, comp: { Cr: 1 }, build: buildMonatomic('Cr') },
]

const ANIONS: IonDef[] = [
  { id: 'cl', charge: -1, comp: { Cl: 1 }, build: buildMonatomic('Cl') },
  { id: 'br', charge: -1, comp: { Br: 1 }, build: buildMonatomic('Br') },
  { id: 'i', charge: -1, comp: { I: 1 }, build: buildMonatomic('I') },
  { id: 'f', charge: -1, comp: { F: 1 }, build: buildMonatomic('F') },
  { id: 'no2', charge: -1, comp: { N: 1, O: 2 }, build: buildPolyatomicCenterOuter('N', 'O', 2, true) },
  { id: 'no3', charge: -1, comp: { N: 1, O: 3 }, build: buildPolyatomicCenterOuter('N', 'O', 3, true) },
  { id: 'mno4', charge: -1, comp: { Mn: 1, O: 4 }, build: buildPolyatomicCenterOuter('Mn', 'O', 4) },
  { id: 'clo3', charge: -1, comp: { Cl: 1, O: 3 }, build: buildPolyatomicCenterOuter('Cl', 'O', 3, true) },
  { id: 'clo4', charge: -1, comp: { Cl: 1, O: 4 }, build: buildPolyatomicCenterOuter('Cl', 'O', 4) },
  { id: 'so4', charge: -2, comp: { S: 1, O: 4 }, build: buildPolyatomicCenterOuter('S', 'O', 4) },
  { id: 'so3', charge: -2, comp: { S: 1, O: 3 }, build: buildPolyatomicCenterOuter('S', 'O', 3, true) },
  { id: 'co3', charge: -2, comp: { C: 1, O: 3 }, build: buildPolyatomicCenterOuter('C', 'O', 3, true) },
  { id: 's2', charge: -2, comp: { S: 1 }, build: buildMonatomic('S') },
  { id: 'sio3', charge: -2, comp: { Si: 1, O: 3 }, build: buildPolyatomicCenterOuter('Si', 'O', 3, true) },
  { id: 'cro4', charge: -2, comp: { Cr: 1, O: 4 }, build: buildPolyatomicCenterOuter('Cr', 'O', 4) },
  { id: 'cr2o7', charge: -2, comp: { Cr: 2, O: 7 }, build: (seed) => {
    // Two tetra-like CrO4 groups sharing one O (schematic)
    const a = buildPolyatomicCenterOuter('Cr', 'O', 4)(seed)
    // remove one outer O from each and merge as a bridge
    const sym: string[] = []
    const pos: V3[] = []
    const bonds: [number, number][] = []
    // first: keep center + 3 O
    sym.push(a.symbols[0]!, a.symbols[1]!, a.symbols[2]!, a.symbols[3]!)
    pos.push([0, 0, 0], a.pos[1]!, a.pos[2]!, a.pos[3]!)
    bonds.push([0, 1], [0, 2], [0, 3])
    // bridge O at +x
    const bridgeIdx = sym.length
    sym.push('O')
    pos.push([0.62, 0, 0])
    bonds.push([0, bridgeIdx])
    // second Cr shifted right
    const c2 = sym.length
    sym.push('Cr')
    pos.push([1.24, 0, 0])
    bonds.push([c2, bridgeIdx])
    // add 3 O around second
    const dirs = dirsForCount(3, seed ^ 0x2468ace0)
    for (let i = 0; i < 3; i++) {
      sym.push('O')
      const p = vAdd(pos[c2]!, vMul(vNorm(dirs[i] ?? [0, 1, 0]), 0.62))
      pos.push(p)
      bonds.push([c2, sym.length - 1])
    }
    return { symbols: sym, pos, bonds }
  } },
  { id: 'po4', charge: -3, comp: { P: 1, O: 4 }, build: buildPolyatomicCenterOuter('P', 'O', 4) },
  { id: 'hco3', charge: -1, comp: { H: 1, C: 1, O: 3 }, build: (seed) => {
    const base = buildPolyatomicCenterOuter('C', 'O', 3, true)(seed)
    // attach H to first O (schematic)
    const oIdx = 1
    const oPos = base.pos[oIdx]!
    const hPos = vAdd(oPos, vMul(vNorm(oPos), 0.46))
    return {
      symbols: [...base.symbols, 'H'],
      pos: [...base.pos, hPos],
      bonds: [...base.bonds, [oIdx, base.symbols.length]],
    }
  } },
]

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function tryDecomposeSalt(composition: Record<string, number>): { cation: IonDef; anion: IonDef; nCat: number; nAn: number } | null {
  const target = compositionKey(composition)
  for (const cat of CATIONS) {
    for (const an of ANIONS) {
      const merged = mergeIonic({ comp: cat.comp, charge: cat.charge }, { comp: an.comp, charge: an.charge })
      if (compositionKey(merged) !== target) continue
      const g = gcd(Math.abs(cat.charge), Math.abs(an.charge))
      const nCat = Math.abs(an.charge) / g
      const nAn = Math.abs(cat.charge) / g
      return { cation: cat, anion: an, nCat, nAn }
    }
  }
  return null
}

type PlacedUnit = {
  side: -1 | 1
  unitIndex: number
  start: number
  end: number
}

function placeIonsSeparatedSymmetric(
  units: { symbols: string[]; pos: V3[]; bonds: [number, number][]; side: -1 | 1; unitIndex: number }[],
): { symbols: string[]; pos: V3[]; bonds: [number, number][]; placedUnits: PlacedUnit[] } {
  const symbols: string[] = []
  const pos: V3[] = []
  const bonds: [number, number][] = []
  const placedUnits: PlacedUnit[] = []

  const left = units.filter((u) => u.side === -1)
  const right = units.filter((u) => u.side === 1)
  const sep = 1.42
  const spread = 0.72

  const stableSort = (arr: typeof units) =>
    [...arr].sort((a, b) => (a.unitIndex !== b.unitIndex ? a.unitIndex - b.unitIndex : a.symbols.length - b.symbols.length))

  function placeCluster(arrIn: typeof units, side: -1 | 1) {
    const arr = stableSort(arrIn)
    const baseZ = side === -1 ? 0.18 : -0.18
    const rot = side === -1 ? 0 : Math.PI
    for (let idx = 0; idx < arr.length; idx++) {
      const u = arr[idx]!
      const baseX = side * sep
      const baseY = arr.length <= 1 ? 0 : (idx - (arr.length - 1) / 2) * spread
      const start = symbols.length
      for (let i = 0; i < u.symbols.length; i++) {
        symbols.push(u.symbols[i]!)
        const p = rotateZ(u.pos[i]!, rot)
        pos.push([p[0] + baseX, p[1] + baseY, p[2] + baseZ])
      }
      for (const [a, b] of u.bonds) bonds.push([a + start, b + start])
      placedUnits.push({ side, unitIndex: u.unitIndex, start, end: symbols.length })
    }
  }

  placeCluster(left, -1)
  placeCluster(right, 1)
  return { symbols, pos, bonds, placedUnits }
}

function addInterIonBondsAllConnected(
  placed: { symbols: string[]; pos: V3[]; bonds: [number, number][]; placedUnits: PlacedUnit[] },
): void {
  const { symbols, pos, bonds, placedUnits } = placed
  const isMetal = (sym: string) => ['NA', 'K', 'LI', 'CS', 'AG', 'MG', 'CA', 'BA', 'SR', 'ZN', 'CU', 'FE', 'PB', 'SN', 'MN', 'NI', 'CO', 'AL', 'CR'].includes(sym.toUpperCase())
  const isGoodAnchor = (sym: string) => {
    const s = sym.toUpperCase()
    return s === 'O' || s === 'F' || s === 'CL' || s === 'BR' || s === 'I' || s === 'S' || s === 'N'
  }

  const leftUnits = placedUnits.filter((u) => u.side === -1)
  const rightUnits = placedUnits.filter((u) => u.side === 1)
  if (leftUnits.length === 0 || rightUnits.length === 0) return

  // Collect candidate indices for anchors on the right (anions)
  const rightAnchorIdx: number[] = []
  for (const u of rightUnits) {
    for (let i = u.start; i < u.end; i++) {
      if (isGoodAnchor(symbols[i]!)) rightAnchorIdx.push(i)
    }
  }
  if (rightAnchorIdx.length === 0) return

  // For each left unit (cations), connect its first atom (usually metal center) to nearest anchors
  for (const u of leftUnits) {
    const catIdx = u.start
    const catSym = symbols[catIdx] ?? ''
    if (!isMetal(catSym)) continue
    const pC = pos[catIdx]!

    const scored = rightAnchorIdx
      .map((ai) => {
        const pA = pos[ai]!
        const d = Math.hypot(pC[0] - pA[0], pC[1] - pA[1], pC[2] - pA[2])
        return { ai, d }
      })
      .sort((a, b) => a.d - b.d)

    // attach 2 bonds if possible to make the whole salt graph connected and “палочки везде”
    const picks = scored.slice(0, 2)
    for (const { ai } of picks) bonds.push([catIdx, ai])
  }
}

function buildSaltGeometry(composition: Record<string, number>, compoundId: string) {
  const seed = hash32(compoundId) ^ 0x5c1f3a91
  const dec = tryDecomposeSalt(composition)
  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
    body: JSON.stringify({
      sessionId: 'c09a52',
      runId: 'pre-fix',
      hypothesisId: 'H_salt_dec',
      location: 'placeholderMolecule.ts:buildSaltGeometry',
      message: 'salt decomposition',
      data: {
        compoundId,
        ok: !!dec,
        nCat: dec?.nCat ?? null,
        nAn: dec?.nAn ?? null,
        cation: dec ? { id: dec.cation.id, charge: dec.cation.charge, comp: dec.cation.comp } : null,
        anion: dec ? { id: dec.anion.id, charge: dec.anion.charge, comp: dec.anion.comp } : null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  if (!dec) return null

  const units: { symbols: string[]; pos: V3[]; bonds: [number, number][]; side: -1 | 1; unitIndex: number }[] = []
  for (let i = 0; i < dec.nCat; i++) {
    const u = dec.cation.build(seed ^ (i * 0x9e3779b9))
    units.push({ ...u, side: -1, unitIndex: i })
  }
  for (let i = 0; i < dec.nAn; i++) {
    const u = dec.anion.build(seed ^ 0x85ebca6b ^ (i * 0xc2b2ae35))
    units.push({ ...u, side: 1, unitIndex: i })
  }
  const placed = placeIonsSeparatedSymmetric(units)
  addInterIonBondsAllConnected(placed)
  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
    body: JSON.stringify({
      sessionId: 'c09a52',
      runId: 'pre-fix',
      hypothesisId: 'H_salt_out',
      location: 'placeholderMolecule.ts:buildSaltGeometry',
      message: 'salt geometry built',
      data: { compoundId, symbolsLen: placed.symbols.length, bondsLen: placed.bonds.length, bonds: placed.bonds.slice(0, 24) },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
  return placed
}

function buildAutoMoleculeGeometry(
  composition: Record<string, number>,
  compoundId: string,
  category: CompoundCategory,
): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  const seed = hash32(compoundId) ^ 0xdeadbeef

  if (category === 'salt') {
    const salt = buildSaltGeometry(composition, compoundId)
    if (salt) {
      // spacing/overlap guard (no inter-ion bonds, but keep polyatomic internal bonds)
      const fixed = new Set<number>()
      relaxPositions(salt.symbols, salt.pos, seed, fixed)
      const posArr = salt.pos.map((p) => [...p] as number[])
      centerAtOrigin(posArr)
      normalizeExtent(posArr, 0.92)
      const atoms: Atom3D[] = salt.symbols.map((symbol, i) => ({
        symbol,
        pos: [posArr[i]![0]!, posArr[i]![1]!, posArr[i]![2]!] as Vec3,
      }))
      return { atoms, bonds: salt.bonds }
    }
    // fallback: no bonds for salts if we cannot decompose reliably
  }

  const centerSym = pickCenterSymbol(composition)
  const symbols = shuffleSymbols(expandSymbols(composition), seed)
  if (symbols.length === 0) return { atoms: [], bonds: [] }
  // ensure a center atom exists and put it at index 0
  const idx = symbols.findIndex((s) => s.toLowerCase() === centerSym.toLowerCase())
  if (idx > 0) {
    const t = symbols[0]!
    symbols[0] = symbols[idx]!
    symbols[idx] = t
  }
  const bondLen = symbols.length <= 2 ? 0.85 : 0.72
  const group = buildStarGroup(symbols, 0, seed, bondLen)
  const fixed = new Set<number>([0])
  relaxPositions(symbols, group.pos, seed, fixed)

  const posArr = group.pos.map((p) => [...p] as number[])
  centerAtOrigin(posArr)
  normalizeExtent(posArr, 0.88)

  const atoms: Atom3D[] = symbols.map((symbol, i) => ({
    symbol,
    pos: [posArr[i]![0]!, posArr[i]![1]!, posArr[i]![2]!] as Vec3,
  }))
  return { atoms, bonds: group.bonds }
}

/**
 * Упрощённая цепочка по составу (устаревший вариант; оставлен для отладки).
 */
export function buildChainMolecule(composition: Record<string, number>): {
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
} {
  const symbols = expandSymbols(composition)
  if (symbols.length === 0) {
    return { atoms: [], bonds: [] }
  }
  const step = 0.62
  const startX = (-(symbols.length - 1) * step) / 2
  const atoms: Atom3D[] = symbols.map((symbol, i) => ({
    symbol,
    pos: [startX + i * step, 0, 0] as Vec3,
  }))
  const bonds: [number, number][] = []
  for (let i = 0; i < atoms.length - 1; i++) bonds.push([i, i + 1])
  return { atoms, bonds }
}

/**
 * Детерминированная 3D-раскладка и MST-связи: у каждого `compoundId` свой силуэт.
 */
export function buildSignatureMolecule(
  composition: Record<string, number>,
  compoundId: string,
  category: CompoundCategory,
): { atoms: Atom3D[]; bonds: readonly (readonly [number, number])[] } {
  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
    body: JSON.stringify({
      sessionId: 'c09a52',
      runId: 'pre-fix',
      hypothesisId: 'H_entry',
      location: 'placeholderMolecule.ts:buildSignatureMolecule',
      message: 'buildSignatureMolecule entry',
      data: { compoundId, category, composition },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  const out = buildAutoMoleculeGeometry(composition, compoundId, category)

  // #region agent log
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
    body: JSON.stringify({
      sessionId: 'c09a52',
      runId: 'pre-fix',
      hypothesisId: 'H_exit',
      location: 'placeholderMolecule.ts:buildSignatureMolecule',
      message: 'buildSignatureMolecule exit',
      data: { compoundId, category, atomsLen: out.atoms.length, bondsLen: out.bonds.length, bonds: out.bonds.slice(0, 24) },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return out
}
