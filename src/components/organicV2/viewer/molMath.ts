/**
 * Органика v2 — чистая математика просмотрщика (без React и three): цвета/радиусы CPK, вписывание в кадр,
 * ориентация по главным осям, плоскость π-системы, проекция Ньюмена, торсионная энергия, вращение половины
 * молекулы, гибридизация/масса/стереометки, вид изомерии. Всё проверяется scripts/test-organic-v2-viewer.mts.
 *
 * Координаты молекул реестра уже правильные (RDKit ETKDGv3 + MMFF94): здесь их только поворачивают целиком
 * (для удобного ракурса) и вращают вокруг одинарной связи по просьбе ученика — длины и углы не меняются.
 */
import type { OV2Molecule } from '../../../data/organicV2/types'
import {
  classifyMolecule,
  sameConstitution,
  sameMolecule,
  skeletonFromOV2,
  canonicalCode,
  type OrganicClassKey,
  type SkeletonGraph,
} from '../../../chemistry/organicV2'

export type V3 = [number, number, number]

// ───────────────────────── элементы ─────────────────────────

/** Цвета CPK (школьные): C тёмно-серый, H белый, O красный, N синий, Cl зелёный, Br тёмно-красный, I фиолетовый, S жёлтый. */
export const CPK: Readonly<Record<string, string>> = {
  C: '#3d434d', H: '#f3f5f8', O: '#e3342f', N: '#2f62e8', Cl: '#2fbf55', Br: '#962626', I: '#7b33b8', S: '#f2c230',
  F: '#8fe06a', P: '#ff8a1f', Na: '#a965f2', K: '#8a46d4', Ca: '#4ad06a', Mg: '#5ad65a', B: '#ffb5b5', Si: '#d8b88a',
}
export const cpkColor = (el: string): string => CPK[el] ?? '#c58cff'

/** Радиус шара в «шарах-стержнях» (Å, условный: пропорционален ковалентному). */
const BALL: Readonly<Record<string, number>> = { H: 0.24, C: 0.36, N: 0.35, O: 0.34, F: 0.32, S: 0.46, P: 0.45, Cl: 0.44, Br: 0.5, I: 0.58, Na: 0.6, K: 0.7 }
export const ballRadius = (el: string): number => BALL[el] ?? 0.42

/** Ван-дер-Ваальсов радиус (Å, Бонди). */
const VDW: Readonly<Record<string, number>> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, F: 1.47, S: 1.8, P: 1.8, Cl: 1.75, Br: 1.85, I: 1.98, Na: 2.27, K: 2.75 }
export const vdwRadius = (el: string): number => VDW[el] ?? 1.8

/** Атомные массы (г/моль). */
const MASS: Readonly<Record<string, number>> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998, S: 32.06, P: 30.974, Cl: 35.45, Br: 79.904, I: 126.904,
  Na: 22.99, K: 39.098, Ca: 40.078, Mg: 24.305, B: 10.81, Si: 28.085,
}
export function molarMass(mol: Pick<OV2Molecule, 'atoms'>): number {
  let s = 0
  for (const a of mol.atoms) s += MASS[a.el] ?? 0
  return Math.round(s * 100) / 100
}

// ───────────────────────── векторы ─────────────────────────

export const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a: readonly number[], b: readonly number[]): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale = (a: readonly number[], k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: readonly number[], b: readonly number[]): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const len = (a: readonly number[]): number => Math.hypot(a[0], a[1], a[2])
export const norm = (a: readonly number[]): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const dist = (a: readonly number[], b: readonly number[]): number => len(sub(a, b))

/** Любой единичный вектор, перпендикулярный v. */
export function perpendicular(v: readonly number[]): V3 {
  const t: V3 = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  return norm(cross(v, t))
}

/** Угол a–b–c в градусах (вершина b). */
export function angleDeg(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const u = norm(sub(a, b))
  const w = norm(sub(c, b))
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, w)))) * 180) / Math.PI
}

/** Двугранный угол p0–p1–p2–p3, градусы в (−180; 180]. */
export function dihedralDeg(p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[]): number {
  const b0 = sub(p0, p1)
  const b1 = norm(sub(p2, p1))
  const b2 = sub(p3, p2)
  const v = sub(b0, scale(b1, dot(b0, b1)))
  const w = sub(b2, scale(b1, dot(b2, b1)))
  const x = dot(v, w)
  const y = dot(cross(b1, v), w)
  return (Math.atan2(y, x) * 180) / Math.PI
}

/** Поворот точки p вокруг оси (origin, единичный dir) на угол rad (правило правой руки). */
export function rotateAround(p: readonly number[], origin: readonly number[], dir: readonly number[], rad: number): V3 {
  const v = sub(p, origin)
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const kv = cross(dir, v)
  const kd = dot(dir, v)
  return add(origin, [
    v[0] * c + kv[0] * s + dir[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + dir[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + dir[2] * kd * (1 - c),
  ])
}

// ───────────────────────── соседи, ориентация, вписывание ─────────────────────────

export function neighbors(mol: Pick<OV2Molecule, 'atoms' | 'bonds'>): number[][] {
  const adj: number[][] = mol.atoms.map(() => [])
  for (const b of mol.bonds) {
    adj[b.a].push(b.b)
    adj[b.b].push(b.a)
  }
  return adj
}

/** Собственные векторы симметричной 3×3 (Якоби): столбцы по убыванию собственных значений. */
function eigenSym3(m: number[][]): { values: number[]; vectors: V3[] } {
  const a = m.map((r) => r.slice())
  const v = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q]
    if (off < 1e-14) break
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < 3; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i])
  return { values: idx.map((i) => a[i][i]), vectors: idx.map((i) => [v[0][i], v[1][i], v[2][i]] as V3) }
}

/**
 * Удобный ракурс: центр масс тяжёлых атомов в начало координат, длинная ось — по X, вторая — по Y,
 * «толщина» — к зрителю (Z), плюс лёгкий наклон для объёма. Поворот жёсткий: длины/углы не меняются.
 */
export function orientForView(points: readonly (readonly number[])[], tiltDeg = 18): V3[] {
  if (points.length === 0) return []
  const c: V3 = [0, 0, 0]
  for (const p of points) {
    c[0] += p[0] / points.length
    c[1] += p[1] / points.length
    c[2] += p[2] / points.length
  }
  const cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const p of points) {
    const d = sub(p, c)
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j]
  }
  const { vectors } = eigenSym3(cov)
  const ex = vectors[0]
  let ey = vectors[1]
  let ez = cross(ex, ey)
  if (len(ez) < 0.5) {
    ey = perpendicular(ex)
    ez = cross(ex, ey)
  }
  const t = (tiltDeg * Math.PI) / 180
  return points.map((p) => {
    const d = sub(p, c)
    let x = dot(d, ex)
    let y = dot(d, ey)
    let z = dot(d, ez)
    // наклон: вокруг X (вид немного сверху), затем вокруг Y
    const y1 = y * Math.cos(t) - z * Math.sin(t)
    const z1 = y * Math.sin(t) + z * Math.cos(t)
    y = y1
    z = z1
    const x2 = x * Math.cos(t * 1.3) + z * Math.sin(t * 1.3)
    const z2 = -x * Math.sin(t * 1.3) + z * Math.cos(t * 1.3)
    x = x2
    z = z2
    return [x, y, z]
  })
}

/** Радиус описанной сферы вокруг начала координат (с учётом радиусов атомов). */
export function boundingRadius(points: readonly (readonly number[])[], radii: readonly number[]): number {
  let r = 0
  points.forEach((p, i) => {
    r = Math.max(r, len(p) + (radii[i] ?? 0))
  })
  return Math.max(r, 1)
}

/**
 * Расстояние камеры, чтобы сфера радиуса r целиком влезла в кадр (вертикальный FOV, соотношение сторон),
 * с запасом margin (1.08 = 8 % поля).
 */
export function fitDistance(r: number, fovDeg: number, aspect: number, margin = 1.08): number {
  const vf = (fovDeg * Math.PI) / 180
  const hf = 2 * Math.atan(Math.tan(vf / 2) * Math.max(aspect, 0.05))
  const f = Math.min(vf, hf)
  return (r * margin) / Math.sin(f / 2)
}

/**
 * Нормаль к плоскости σ-скелета у кратной связи a=b (π-облака лежат вдоль неё, над и под связью).
 * Берётся из соседей a и b; если соседей нет (C≡C, O=C=O) — любой перпендикуляр.
 */
export function piNormal(pos: readonly (readonly number[])[], adj: readonly (readonly number[])[], a: number, b: number): V3 {
  const axis = norm(sub(pos[b], pos[a]))
  for (const [c, other] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const n of adj[c]) {
      if (n === other) continue
      const v = sub(pos[n], pos[c])
      const nn = cross(axis, v)
      if (len(nn) > 0.2) return norm(nn)
    }
  }
  return perpendicular(axis)
}

// ───────────────────────── вращение вокруг одинарной связи и Ньюмен ─────────────────────────

/** Атомы «задней» половины: всё, что достижимо из b, не проходя через связь a–b. null — связь в цикле. */
export function sideOf(adj: readonly (readonly number[])[], a: number, b: number): number[] | null {
  const seen = new Set<number>([b])
  const stack = [b]
  while (stack.length) {
    const x = stack.pop()!
    for (const y of adj[x]) {
      if (x === b && y === a) continue
      if (y === a) return null
      if (!seen.has(y)) {
        seen.add(y)
        stack.push(y)
      }
    }
  }
  return [...seen]
}

/** Можно ли крутить связь: одинарная, не в цикле, у обоих концов есть ещё заместители. */
export function isRotatable(mol: Pick<OV2Molecule, 'atoms' | 'bonds'>, adj: readonly (readonly number[])[], bi: number): boolean {
  const bd = mol.bonds[bi]
  if (!bd || bd.o !== 1) return false
  if (adj[bd.a].length < 2 || adj[bd.b].length < 2) return false
  return sideOf(adj, bd.a, bd.b) !== null
}

/** Размер ветви (число тяжёлых атомов), растущей из n в сторону от c. */
function branchWeight(mol: Pick<OV2Molecule, 'atoms'>, adj: readonly (readonly number[])[], c: number, n: number): number {
  const s = sideOf(adj, c, n)
  if (!s) return 99
  return s.filter((i) => mol.atoms[i].el !== 'H').length
}

export interface NewmanSub {
  readonly atom: number
  readonly el: string
  /** подпись: H, CH₃, C₂H₅, OH, Cl … */
  readonly label: string
  /** угол на проекции, градусы (0 — вверх, по часовой) */
  readonly angle: number
}

export interface NewmanData {
  readonly front: readonly NewmanSub[]
  readonly back: readonly NewmanSub[]
  /** двугранный угол между опорными заместителями (самыми крупными), градусы 0…360 */
  readonly phi: number
  readonly refFront: number
  readonly refBack: number
  /** тип пары опорных групп для энергии */
  readonly pair: TorsionPair
}

export type TorsionPair = 'HH' | 'HX' | 'XX'

function groupLabel(mol: Pick<OV2Molecule, 'atoms'>, adj: readonly (readonly number[])[], c: number, n: number): string {
  const el = mol.atoms[n].el
  const hs = adj[n].filter((x) => x !== c && mol.atoms[x].el === 'H').length
  const heavy = adj[n].filter((x) => x !== c && mol.atoms[x].el !== 'H').length
  if (el === 'H') return 'H'
  const sb = (k: number) => (k > 1 ? String(k).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]) : '')
  if (el === 'C' && heavy === 0) return `CH${sb(hs)}`
  if (el === 'C') {
    const w = branchWeight(mol, adj, c, n)
    if (w === 2 && heavy === 1) {
      const nn = adj[n].find((x) => x !== c && mol.atoms[x].el !== 'H')!
      if (mol.atoms[nn].el === 'C' && adj[nn].filter((x) => mol.atoms[x].el === 'H').length === 3) return 'C₂H₅'
    }
    return 'R'
  }
  if (heavy === 0) return hs ? `${el}H${sb(hs)}` : el
  return el
}

/**
 * Проекция Ньюмена вдоль связи a→b: a — передний атом (линии из центра), b — задний (круг).
 * Углы считаются в плоскости, перпендикулярной оси, в базисе (u — «вверх» по опорному заместителю переднего атома).
 */
export function newmanProjection(mol: Pick<OV2Molecule, 'atoms'>, pos: readonly (readonly number[])[], adj: readonly (readonly number[])[], a: number, b: number): NewmanData {
  const axis = norm(sub(pos[b], pos[a]))
  const fr = adj[a].filter((x) => x !== b)
  const bk = adj[b].filter((x) => x !== a)
  const pick = (c: number, list: number[]) =>
    list.slice().sort((x, y) => branchWeight(mol, adj, c, y) - branchWeight(mol, adj, c, x) || y - x)[0]
  const refFront = pick(a, fr)
  const refBack = pick(b, bk)
  const proj = (c: number, n: number): V3 => {
    const v = sub(pos[n], pos[c])
    return sub(v, scale(axis, dot(v, axis)))
  }
  const up = norm(proj(a, refFront))
  // смотрим вдоль оси a→b: «вправо» = up × axis даёт отображение по часовой стрелке
  const right = norm(cross(up, axis))
  const ang = (c: number, n: number) => {
    const p = proj(c, n)
    const deg = (Math.atan2(dot(p, right), dot(p, up)) * 180) / Math.PI
    return (deg + 360) % 360
  }
  const mk = (c: number, list: number[]): NewmanSub[] =>
    list.map((n) => ({ atom: n, el: mol.atoms[n].el, label: groupLabel(mol, adj, c, n), angle: ang(c, n) }))
  const front = mk(a, fr)
  const back = mk(b, bk)
  const phi = (dihedralDeg(pos[refFront], pos[a], pos[b], pos[refBack]) + 360) % 360
  const hf = mol.atoms[refFront].el === 'H'
  const hb = mol.atoms[refBack].el === 'H'
  const pair: TorsionPair = hf && hb ? 'HH' : hf || hb ? 'HX' : 'XX'
  return { front, back, phi, refFront, refBack, pair }
}

/**
 * Торсионная энергия (кДж/моль) как ряд Фурье V(φ) = c₀ + Σ Cₙ cos nφ (то же, что Σ Vₙ/2·(1 ± cos nφ)).
 * Параметры подобраны по школьным/справочным значениям:
 *  - H/H (этан): барьер 12 кДж/моль, V = 6·(1 + cos 3φ);
 *  - H/CH₃ (пропан): барьер 14 кДж/моль;
 *  - CH₃/CH₃ (бутан): анти 0, гош 3,8, заслонённая H/CH₃ 16, син (CH₃/CH₃) 19 кДж/моль.
 */
export function torsionEnergy(phiDeg: number, pair: TorsionPair): number {
  const f = (phiDeg * Math.PI) / 180
  if (pair === 'HH') return 6 * (1 + Math.cos(3 * f))
  if (pair === 'HX') return 7 * (1 + Math.cos(3 * f))
  return 9.7667 + 2.2667 * Math.cos(f) - 0.2667 * Math.cos(2 * f) + 7.2333 * Math.cos(3 * f)
}

export type ConformationKey = 'eclipsed' | 'staggered' | 'gauche' | 'anti' | 'syn' | 'between'

/** Название конформации по двугранному углу опорных групп. */
export function conformationName(phiDeg: number, pair: TorsionPair): ConformationKey {
  const p = ((phiDeg % 360) + 360) % 360
  const d = Math.min(p, 360 - p) // 0…180
  const near = (x: number) => Math.abs(d - x) <= 12
  if (pair === 'XX') {
    if (near(0)) return 'syn'
    if (near(180)) return 'anti'
    if (near(60)) return 'gauche'
    if (near(120)) return 'eclipsed'
    return 'between'
  }
  const m = d % 120
  if (m <= 12 || m >= 108) return 'eclipsed'
  if (Math.abs(m - 60) <= 12) return 'staggered'
  return 'between'
}

// ───────────────────────── карточка: гибридизация, стереометки ─────────────────────────

export function hybridCounts(mol: Pick<OV2Molecule, 'atoms'>): { sp3: number; sp2: number; sp: number } {
  const r = { sp3: 0, sp2: 0, sp: 0 }
  for (const a of mol.atoms) {
    if (a.el !== 'C') continue
    if (a.hyb === 'sp3') r.sp3++
    else if (a.hyb === 'sp2') r.sp2++
    else if (a.hyb === 'sp') r.sp++
  }
  return r
}

export interface StereoMark {
  readonly kind: 'cip' | 'ez'
  readonly atoms: readonly number[]
  /** R, S, E, Z */
  readonly label: string
  /** для E/Z у дизамещённого алкена — цис/транс (иначе undefined: E/Z ≠ цис/транс) */
  readonly cisTrans?: 'cis' | 'trans'
}

export function stereoMarks(mol: Pick<OV2Molecule, 'atoms' | 'bonds'>): StereoMark[] {
  const adj = neighbors(mol)
  const out: StereoMark[] = []
  mol.atoms.forEach((a, i) => {
    if (a.cip) out.push({ kind: 'cip', atoms: [i], label: a.cip })
  })
  for (const b of mol.bonds) {
    if (!b.ez) continue
    const heavyOther = (c: number, o: number) => adj[c].filter((x) => x !== o && mol.atoms[x].el !== 'H').length
    const simple = heavyOther(b.a, b.b) === 1 && heavyOther(b.b, b.a) === 1
    out.push({ kind: 'ez', atoms: [b.a, b.b], label: b.ez, cisTrans: simple ? (b.ez === 'Z' ? 'cis' : 'trans') : undefined })
  }
  return out
}

/** Порядковый номер атома среди атомов того же элемента (для подписи «C3»). */
export function atomCaption(mol: Pick<OV2Molecule, 'atoms'>, i: number): string {
  const el = mol.atoms[i].el
  let k = 0
  for (let j = 0; j <= i; j++) if (mol.atoms[j].el === el) k++
  return `${el}${k}`
}

// ───────────────────────── вид изомерии ─────────────────────────

export type IsomerKind = 'same' | 'chain' | 'groupPosition' | 'bondPosition' | 'interclass' | 'cisTrans' | 'optical' | 'structural'

const MULTI_CLASSES: ReadonlySet<OrganicClassKey> = new Set(['alkene', 'alkyne', 'alkadiene', 'cycloalkene'])

/** Углеродный скелет: только C, все связи одинарные. */
function carbonSkeleton(g: SkeletonGraph): SkeletonGraph {
  const keep: number[] = []
  g.atoms.forEach((a, i) => {
    if (a.el === 'C') keep.push(i)
  })
  const map = new Map(keep.map((x, k) => [x, k]))
  return {
    atoms: keep.map(() => ({ el: 'C' })),
    bonds: g.bonds.filter((b) => map.has(b.a) && map.has(b.b)).map((b) => ({ a: map.get(b.a)!, b: map.get(b.b)!, o: 1 as const })),
  }
}

/** Скелет «C + гетероатомы» без кратностей — у изомеров положения кратной связи он совпадает. */
function heavySaturated(g: SkeletonGraph): SkeletonGraph {
  const keep: number[] = []
  g.atoms.forEach((a, i) => {
    if (a.el !== 'H') keep.push(i)
  })
  const map = new Map(keep.map((x, k) => [x, k]))
  return {
    atoms: keep.map((i) => ({ el: g.atoms[i].el })),
    bonds: g.bonds.filter((b) => map.has(b.a) && map.has(b.b)).map((b) => ({ a: map.get(b.a)!, b: map.get(b.b)!, o: 1 as const })),
  }
}

function safeCode(g: SkeletonGraph): string {
  try {
    return canonicalCode(g)
  } catch {
    return JSON.stringify(g.atoms.map((a) => a.el).sort())
  }
}

export interface IsomerVerdict {
  readonly kind: IsomerKind
  /** атомы второй молекулы, которые стоит подсветить (чем она отличается) */
  readonly highlight: readonly number[]
}

/**
 * Вид изомерии молекулы b относительно a (одинаковая брутто-формула).
 * Порядок проверок: та же молекула → цис/транс или оптическая (одинаковое строение) → межклассовая
 * (разные классы) → цепь (разный углеродный скелет) → положение кратной связи / функциональной группы.
 */
export function isomerKind(a: OV2Molecule, b: OV2Molecule): IsomerVerdict {
  const ga = skeletonFromOV2(a)
  const gb = skeletonFromOV2(b)
  const adjB = neighbors(b)
  const groupAtoms = b.groups.flatMap((g) => (g.key === 'arene' ? [] : g.atoms)).filter((i) => b.atoms[i].el !== 'H')
  const multiAtoms = b.bonds.filter((x) => x.o > 1 && !x.ar).flatMap((x) => [x.a, x.b])
  if (sameConstitution(ga, gb)) {
    const ezB = b.bonds.filter((x) => x.ez)
    const ezA = a.bonds.filter((x) => x.ez).map((x) => x.ez).sort().join()
    if (ezB.length && ezB.map((x) => x.ez).sort().join() !== ezA) {
      return { kind: 'cisTrans', highlight: ezB.flatMap((x) => [x.a, x.b, ...adjB[x.a], ...adjB[x.b]]).filter((i) => b.atoms[i].el !== 'H') }
    }
    const cipB = b.atoms.map((x, i) => (x.cip ? i : -1)).filter((i) => i >= 0)
    const cipA = a.atoms.map((x) => x.cip ?? '').join()
    if (cipB.length && b.atoms.map((x) => x.cip ?? '').join() !== cipA) return { kind: 'optical', highlight: cipB }
    return { kind: sameMolecule(ga, gb) ? 'same' : 'cisTrans', highlight: [] }
  }
  let ca: OrganicClassKey = 'other'
  let cb: OrganicClassKey = 'other'
  try {
    ca = classifyMolecule(ga)
    cb = classifyMolecule(gb)
  } catch {
    /* класс не определён — считаем «структурной» */
  }
  if (ca !== cb) return { kind: 'interclass', highlight: groupAtoms.length ? groupAtoms : multiAtoms }
  const skA = safeCode(carbonSkeleton(ga))
  const skB = safeCode(carbonSkeleton(gb))
  if (skA !== skB) {
    const branch = b.atoms
      .map((x, i) => (x.el === 'C' && adjB[i].filter((n) => b.atoms[n].el === 'C').length >= 3 ? i : -1))
      .filter((i) => i >= 0)
    return { kind: 'chain', highlight: branch.length ? branch : groupAtoms }
  }
  if (MULTI_CLASSES.has(cb) && safeCode(heavySaturated(ga)) === safeCode(heavySaturated(gb))) {
    return { kind: 'bondPosition', highlight: multiAtoms }
  }
  if (groupAtoms.length) return { kind: 'groupPosition', highlight: groupAtoms }
  return { kind: 'structural', highlight: [] }
}
