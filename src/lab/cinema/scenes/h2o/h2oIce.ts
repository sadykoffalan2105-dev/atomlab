/**
 * Лёд Ih для финала урока «вода»: кислородная подрешётка — из ядра (crystalData 'ice' через
 * kit/lattice), атомы H — по ПРАВИЛАМ ЛЬДА (Бернал — Фаулер):
 *   • на каждой линии O···O ровно один H;
 *   • у каждого O ровно два «своих» H (молекула H₂O сохраняется).
 *
 * В базисе ядра H нет — во льду они разупорядочены. Здесь строится ОДНА допустимая расстановка:
 * граф соседей O···O периодической сверхъячейки (каждый O — 4 соседа) ориентируется по эйлерову
 * циклу — у каждой вершины ровно 2 выходящих ребра и 2 входящих. Выходящее ребро = «мой H стоит
 * на этой линии». H ставится на линию O···O на длине связи O–H из bondData (схема: во льду H
 * чуть смещён с линии, а связь O–H немного длиннее — это названо в note шага).
 *
 * Чистый модуль без THREE: строится один раз при загрузке, читают раскадровка и тест.
 */
import { bondLengthPm, getCrystal } from '../../../../chemistry/data'
import { pmToScene } from '../kit/cpkAtoms'
import { cellMatrix, FIRST_SHELL_RATIO, latticeFragment, periodicNeighbors, type LatticeFragment, type Vec3 } from '../kit/lattice'

export const ICE = getCrystal('ice')!

/** Фрагмент: целое число ячеек, без замыкающих граней (атомы с дробями в [0, n)) — 16 молекул. */
export const ICE_CELLS: Vec3 = [2, 2, 1]
export const ICE_FRAG: LatticeFragment = latticeFragment('ice', ICE_CELLS, { includeBoundary: false })

/** Ребро периодического графа O···O: i → j через трансляцию сверхъячейки t (в сверхъячейках). */
export type IceEdge = { i: number; j: number; t: Vec3; lengthPm: number }

export type IceMolecule = {
  /** индекс узла O во фрагменте */
  site: number
  /** позиция O, мировые единицы */
  o: Vec3
  /** две позиции H, мировые единицы (на линиях O···O к соседям j) */
  h: [Vec3, Vec3]
  /** к какому узлу (или его образу) смотрит каждый H */
  to: [number, number]
  /** лежит ли сосед-акцептор внутри фрагмента без трансляции (тогда есть видимая водородная связь) */
  inside: [boolean, boolean]
}

/** Водородная связь внутри фрагмента: донор (молекула, номер H) → акцептор O. */
export type IceHBond = { donor: number; hIndex: 0 | 1; acceptor: number; ooPm: number }

const sub = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: Readonly<Vec3>) => Math.hypot(a[0], a[1], a[2])

function buildIce(): { edges: IceEdge[]; molecules: IceMolecule[]; hbonds: IceHBond[] } {
  const frag = ICE_FRAG
  const n = frag.sites.length
  const m = cellMatrix('ice')
  const [nx, ny, nz] = ICE_CELLS
  const A: Vec3 = [m.a[0] * nx, m.a[1] * nx, m.a[2] * nx]
  const B: Vec3 = [m.b[0] * ny, m.b[1] * ny, m.b[2] * ny]
  const C: Vec3 = [m.c[0] * nz, m.c[1] * nz, m.c[2] * nz]
  const shift = (t: Readonly<Vec3>): Vec3 => [
    t[0] * A[0] + t[1] * B[0] + t[2] * C[0],
    t[0] * A[1] + t[1] * B[1] + t[2] * C[1],
    t[0] * A[2] + t[1] * B[2] + t[2] * C[2],
  ]
  const lim = periodicNeighbors('ice')[0]!.minPm * FIRST_SHELL_RATIO

  // 1. Периодический граф: каждое ребро один раз (i < j, либо i === j не бывает при таких сверхъячейках).
  const edges: IceEdge[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      for (let u = -1; u <= 1; u++) {
        for (let v = -1; v <= 1; v++) {
          for (let w = -1; w <= 1; w++) {
            if (i === j && u === 0 && v === 0 && w === 0) continue
            const t: Vec3 = [u, v, w]
            const s = shift(t)
            const q: Vec3 = [frag.posPm[j]![0] + s[0], frag.posPm[j]![1] + s[1], frag.posPm[j]![2] + s[2]]
            const d = len(sub(q, frag.posPm[i]!))
            if (d > lim) continue
            if (i === j) throw new Error('h2o/ice: сверхъячейка слишком мала — узел видит свой образ')
            edges.push({ i, j, t, lengthPm: d })
          }
        }
      }
    }
  }
  const degree = new Array<number>(n).fill(0)
  for (const e of edges) {
    degree[e.i]!++
    degree[e.j]!++
  }
  const cn = Object.values(ICE.coordination)[0]!
  degree.forEach((d, i) => {
    if (d !== cn) throw new Error(`h2o/ice: у O${i} ${d} соседей, по ядру КЧ ${cn}`)
  })

  // 2. Эйлеров цикл (Хирхольцер) — ориентация: у каждой вершины out = in = КЧ/2 = 2.
  const adj: number[][] = Array.from({ length: n }, () => [])
  edges.forEach((e, k) => {
    adj[e.i]!.push(k)
    adj[e.j]!.push(k)
  })
  const used = new Array<boolean>(edges.length).fill(false)
  const dir = new Array<1 | -1>(edges.length).fill(1) // 1: i → j, −1: j → i
  const ptr = new Array<number>(n).fill(0)
  for (let start = 0; start < n; start++) {
    const stack: number[] = [start]
    while (stack.length > 0) {
      const vtx = stack[stack.length - 1]!
      let advanced = false
      while (ptr[vtx]! < adj[vtx]!.length) {
        const k = adj[vtx]![ptr[vtx]!++]!
        if (used[k]) continue
        used[k] = true
        const e = edges[k]!
        const other = e.i === vtx ? e.j : e.i
        dir[k] = e.i === vtx ? 1 : -1
        stack.push(other)
        advanced = true
        break
      }
      if (!advanced) stack.pop()
    }
  }

  // 3. Молекулы: H на выходящих рёбрах.
  const dOH = bondLengthPm('O-H')
  const off = frag.offsetScene
  const toScene = (p: Readonly<Vec3>): Vec3 => [pmToScene(p[0]) + off[0], pmToScene(p[1]) + off[1], pmToScene(p[2]) + off[2]]
  const hs: { h: Vec3; to: number; inside: boolean }[][] = Array.from({ length: n }, () => [])
  edges.forEach((e, k) => {
    const from = dir[k] === 1 ? e.i : e.j
    const to = dir[k] === 1 ? e.j : e.i
    const t: Vec3 = dir[k] === 1 ? e.t : [-e.t[0], -e.t[1], -e.t[2]]
    const s = shift(t)
    const q: Vec3 = [frag.posPm[to]![0] + s[0], frag.posPm[to]![1] + s[1], frag.posPm[to]![2] + s[2]]
    const v = sub(q, frag.posPm[from]!)
    const l = len(v)
    const p = frag.posPm[from]!
    const hPm: Vec3 = [p[0] + (v[0] / l) * dOH, p[1] + (v[1] / l) * dOH, p[2] + (v[2] / l) * dOH]
    hs[from]!.push({ h: toScene(hPm), to, inside: t[0] === 0 && t[1] === 0 && t[2] === 0 })
  })
  const molecules: IceMolecule[] = frag.sites.map((s, i) => {
    const list = hs[i]!
    if (list.length !== 2) throw new Error(`h2o/ice: у O${i} ${list.length} атомов H вместо двух — нарушено правило льда`)
    return {
      site: i,
      o: [s.posScene[0], s.posScene[1], s.posScene[2]],
      h: [list[0]!.h, list[1]!.h],
      to: [list[0]!.to, list[1]!.to],
      inside: [list[0]!.inside, list[1]!.inside],
    }
  })
  const hbonds: IceHBond[] = []
  molecules.forEach((mol, i) => {
    for (const k of [0, 1] as const) {
      if (!mol.inside[k]) continue
      const acc = mol.to[k]
      hbonds.push({ donor: i, hIndex: k, acceptor: acc, ooPm: len(sub(frag.posPm[acc]!, frag.posPm[i]!)) })
    }
  })
  return { edges, molecules, hbonds }
}

const BUILT = buildIce()
/** Периодический граф O···O сверхъячейки (для теста правил льда). */
export const ICE_EDGES: readonly IceEdge[] = BUILT.edges
/** 16 молекул льда: O из ядра, H по правилам льда. */
export const ICE_MOLECULES: readonly IceMolecule[] = BUILT.molecules
/** Водородные связи внутри фрагмента (донор H → акцептор O). */
export const ICE_HBONDS: readonly IceHBond[] = BUILT.hbonds
/** Подписи решётки — только символы и числа ядра. */
export const ICE_OO_PM = ICE.cationAnionPm
