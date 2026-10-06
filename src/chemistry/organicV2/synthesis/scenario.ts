/**
 * Органика v2 · «Как образуется» — сценарий синтеза по атомному соответствию (чистая логика, без React/three).
 *
 * Вход — реакция учебника из reactions.json (участники с RDKit-координатами и номерами соответствия map).
 * Выход — сценарий из шести этапов и функции кадра (позиции атомов, толщина линий связей, электроны):
 *   0 «Исходные вещества» — участники разнесены вокруг главного реагента;
 *   1 «Реакционный центр» — сближаются, связи, которые изменятся, подсвечены;
 *   2 «Разрыв связей»     — связи (to = 0 или понижение порядка) растягиваются и гаснут по одной;
 *                           при hν/радикальном механизме — по одному неспаренному электрону (•) у каждого атома,
 *                           иначе (гетеролиз) — пара электронов у более электроотрицательного атома;
 *   3 «Образование связей» — фрагменты летят к новым партнёрам по дуге в обход чужих атомов,
 *                           новые связи появляются по одной (π→σ при присоединении — через гашение линии);
 *   4 «Продукты»          — продукты в своей RDKit-геометрии (поворот подогнан Кабшем к исходным атомам,
 *                           чтобы ничего не крутилось), разнесены; побочные H₂O/HCl — отдельно;
 *   5 «Итог»              — та же картинка, на доске уравнение, тип, условия, страница учебника.
 * Геометрия молекул НЕ пересчитывается — только жёсткие повороты/сдвиги RDKit-координат.
 */
import type { OV2Reaction, OV2Species } from '../../../data/organicV2/types'
import {
  type M3,
  type V3,
  add,
  centroid,
  clamp01,
  cross,
  dist,
  dot,
  easeInOut,
  kabsch,
  len,
  lerp3,
  m3FromQuat,
  mulMV,
  norm,
  pcaRotation,
  principalAxes,
  type Q4,
  quatFromM3,
  slerpFromIdentity,
  rotateOnto,
  scale,
  sub,
} from './math'

export type SynthStageKey = 'reactants' | 'center' | 'break' | 'form' | 'products' | 'summary'
export const SYNTH_STAGE_KEYS: readonly SynthStageKey[] = ['reactants', 'center', 'break', 'form', 'products', 'summary']

export interface SynthStage {
  readonly key: SynthStageKey
  readonly t0: number
  readonly t1: number
}

export interface SynthAtom {
  readonly map: number
  readonly el: string
  /** номер участника слева / справа (индекс в scenario.species) */
  readonly ls: number
  readonly rs: number
  /** «Исходные вещества» (разнесены) */
  readonly p0: V3
  /** «Реакционный центр» (сближены) */
  readonly p1: V3
  /** после разрыва связей (оторванные фрагменты чуть отодвинуты) */
  readonly pb: V3
  /** продукт на месте образования (Кабш к исходным атомам) */
  readonly p2: V3
  /** продукты разнесены */
  readonly p3: V3
  /** дуга полёта на этапе «Образование» (смещение в середине пути) */
  readonly bulge: V3
  /** атом участвует в изменении связей (реакционный центр) */
  readonly center: boolean
  /** номер фрагмента (связная часть после всех разрывов) */
  readonly frag: number
  /**
   * «Одна копия + ×N»: 1 — атом пришёл из НЕпоказанной копии реагента (появляется на месте в продукте),
   * -1 — уходит в непоказанную копию продукта (гаснет на месте), 0 — обычный.
   */
  readonly ghost: -1 | 0 | 1
}

export type SynthBondKind = 'keep' | 'break' | 'down' | 'form' | 'up'

export interface SynthBond {
  /** индексы атомов сценария */
  readonly i: number
  readonly j: number
  readonly from: 0 | 1 | 2 | 3
  readonly to: 0 | 1 | 2 | 3
  readonly kind: SynthBondKind
  /** момент изменения (для keep — 0) */
  readonly t: number
  /** длительность гашения/появления линии */
  readonly fade: number
}

export interface SynthElectron {
  /** атом, у которого электрон(ы) */
  readonly atom: number
  /** бывший партнёр — электроны рисуются на стороне бывшей связи */
  readonly partner: number
  readonly count: 1 | 2
  readonly t0: number
  readonly t1: number
}

export interface SynthSpecies {
  readonly index: number
  readonly side: 'L' | 'R'
  readonly ref: string
  readonly smiles: string
  readonly nameRu?: string
  /** индексы атомов сценария */
  readonly atoms: readonly number[]
  /** побочный неорганический продукт (H₂O, HCl, CO₂ …) */
  readonly byproduct: boolean
  /** концы цепи полимера: [атом, направление «…»] */
  readonly ends: readonly { readonly atom: number; readonly dir: V3 }[]
  /** продукт: поворот к главным осям на этапе «Продукты» и центры до/после */
  readonly turn?: { readonly q: Q4; readonly c2: V3; readonly c3: V3 }
  /** сколько таких молекул в уравнении (показана одна копия — первая); у остальных копий 0 и нет атомов */
  readonly copies: number
}

export interface SynthScenario {
  readonly reactionId: string
  readonly atoms: readonly SynthAtom[]
  readonly bonds: readonly SynthBond[]
  readonly species: readonly SynthSpecies[]
  readonly electrons: readonly SynthElectron[]
  readonly stages: readonly SynthStage[]
  readonly total: number
  /** гомолиз (hν, радикальный механизм, горение, крекинг) */
  readonly radical: boolean
  /** индекс главного исходного вещества */
  readonly main: number
  /** показана одна копия каждого участника (остальные — бейдж «×N») */
  readonly grouped: boolean
}

/**
 * Много копий (KMnO₄, жиры, горение, ОВР — десятки молекул): показываем по одной копии каждого участника.
 * Порог — 8 и больше молекул в уравнении или больше 90 атомов слева.
 */
export function copyGroups(r: OV2Reaction): { grouped: boolean; copies: number[]; shown: boolean[] } {
  const first = new Map<string, number>()
  const copies = r.species.map(() => 0)
  const shown = r.species.map(() => true)
  r.species.forEach((s, si) => {
    const k = `${s.side}|${s.ref}|${s.smiles}`
    const f = first.get(k)
    if (f == null) {
      first.set(k, si)
      copies[si] = 1
    } else {
      copies[f]++
      shown[si] = false
    }
  })
  const leftAtoms = r.species.reduce((n, s) => n + (s.side === 'L' ? s.atoms.length : 0), 0)
  const hasCopies = copies.some((c) => c > 1)
  const grouped = hasCopies && !r.polymer && (r.species.length >= 8 || leftAtoms > 90)
  if (!grouped) return { grouped, copies: r.species.map(() => 1), shown: r.species.map(() => true) }
  return { grouped, copies, shown }
}

// ─── справочные данные ───────────────────────────────────────────────────────

const ELECTRONEG: Record<string, number> = {
  H: 2.2, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Cl: 3.16, Br: 2.96, I: 2.66, S: 2.58, P: 2.19, Si: 1.9,
  Na: 0.93, K: 0.82, Li: 0.98, Mg: 1.31, Ca: 1.0, Cu: 1.9, Ag: 1.93, Zn: 1.65, Al: 1.61, Fe: 1.83, Hg: 2.0, Mn: 1.55,
  Cr: 1.66, Ba: 0.89, B: 2.04, Pt: 2.28, Ni: 1.91, Pd: 2.2, Sn: 1.96, Pb: 2.33,
}
const VALENCE: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, H: 1 }
const INORGANIC_BYPRODUCT = /^inorg:/

export const electronegativity = (el: string): number => ELECTRONEG[el] ?? 2

const STAGE_BASE = { reactants: 2.4, center: 2.4, products: 2.6, summary: 2.4 }

// ─── построение ──────────────────────────────────────────────────────────────

interface Placed {
  idx: number
  pos: V3[]
}

function speciesWeights(els: readonly string[]): number[] {
  return els.map((e) => (e === 'H' ? 0.35 : 1))
}

/** Минимальное расстояние между двумя наборами точек (досрочный выход, как только меньше stop). */
function minDistSets(a: readonly V3[], b: readonly V3[], stop = -1): number {
  let m = Infinity
  for (const p of a) for (const q of b) {
    const dx = p[0] - q[0]
    const dy = p[1] - q[1]
    const dz = p[2] - q[2]
    const d = dx * dx + dy * dy + dz * dz
    if (d < m) {
      m = d
      if (m < stop * stop) return Math.sqrt(m)
    }
  }
  return Math.sqrt(m)
}

/** Сдвигает набор точек, пока он не отойдёт от «занятых» точек на minGap (по направлению dir). */
function pushAway(pos: V3[], occupied: readonly V3[], dir: V3, minGap: number): void {
  if (!occupied.length) return
  // занятые точки, до которых вообще можно дотянуться (сдвиг не больше 30 Å)
  const c = centroid(pos)
  let r = 0
  for (const p of pos) r = Math.max(r, dist(p, c))
  const reach = r + minGap + 30
  const occ = occupied.filter((q) => dist(q, c) < reach)
  for (let k = 0; k < 80; k++) {
    const d = minDistSets(pos, occ, minGap)
    if (d >= minGap) return
    const step = Math.max(0.3, Math.min(1.5, minGap - d))
    for (let i = 0; i < pos.length; i++) pos[i] = add(pos[i], scale(dir, step))
  }
}

/**
 * Координаты участника; у ионных солей (NaCl, K₂SO₄, Ca(OH)₂…) ионы в данных стоят в одной точке —
 * раздвигаем несвязанные части до ионного контакта (≥ 2,4 Å), иначе Br «прячется» внутри Na.
 */
const ION_GAP = 2.4
const spreadCache = new WeakMap<OV2Species, V3[]>()
export function speciesPositions(s: OV2Species): V3[] {
  const hit = spreadCache.get(s)
  if (hit) return hit
  const pos = s.atoms.map((a) => [a.p[0], a.p[1], a.p[2]] as V3)
  const n = pos.length
  // сбой 3D у металла в соли ((CH₃COO)₂Ca: Ca за 170 Å от своих O) — ставим атом между соседями по связям
  const nb: number[][] = Array.from({ length: n }, () => [])
  for (const b of s.bonds) {
    nb[b.a].push(b.b)
    nb[b.b].push(b.a)
  }
  for (let i = 0; i < n; i++) {
    if (!nb[i].length || !nb[i].every((j) => dist(pos[i], pos[j]) > 3.2)) continue
    const c = centroid(nb[i].map((j) => pos[j]))
    if (nb[i].length >= 2) pos[i] = c
    else {
      const j = nb[i][0]
      const others = nb[j].filter((k) => k !== i)
      const away = others.length ? sub(pos[j], centroid(others.map((k) => pos[k]))) : ([1, 0, 0] as V3)
      pos[i] = add(pos[j], scale(norm(away, [1, 0, 0]), 2))
    }
  }
  const par = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x])))
  for (const b of s.bonds) par[find(b.a)] = find(b.b)
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = groups.get(r)
    if (g) g.push(i)
    else groups.set(r, [i])
  }
  if (groups.size > 1) {
    const frs = [...groups.values()].sort((a, b) => b.length - a.length)
    const settled: number[] = [...frs[0]]
    const c0 = centroid(frs[0].map((i) => pos[i]))
    const DIRS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, -0.7, 0]]
    frs.slice(1).forEach((fr, k) => {
      const c = centroid(fr.map((i) => pos[i]))
      const away = sub(c, c0)
      const dir = len(away) > 0.3 ? norm(away, [1, 0, 0]) : DIRS[k % DIRS.length]
      for (let it = 0; it < 60; it++) {
        let m = Infinity
        for (const i of fr) for (const j of settled) m = Math.min(m, dist(pos[i], pos[j]))
        if (m >= ION_GAP) break
        for (const i of fr) pos[i] = add(pos[i], scale(dir, Math.max(0.15, ION_GAP - m)))
      }
      settled.push(...fr)
    })
  }
  spreadCache.set(s, pos)
  return pos
}

export function isRadicalReaction(r: OV2Reaction): boolean {
  const c = r.conditions ?? ''
  return /hν|hv|свет|УФ/i.test(c) || r.type === 'substitutionRadical' || r.type === 'combustion' || r.type === 'cracking'
    || /радикал/i.test(r.typeRu ?? '') || /•/.test(r.equation)
}

export function buildSynthesisScenario(reaction: OV2Reaction): SynthScenario {
  const radical = isRadicalReaction(reaction)
  const sp = reaction.species
  const groups = copyGroups(reaction)
  const shown = groups.shown
  const ghost: (-1 | 0 | 1)[] = []

  // 1) атомы сценария — по номеру соответствия
  const mapIndex = new Map<number, number>()
  const atomsEl: string[] = []
  const atomMap: number[] = []
  const ls: number[] = []
  const rs: number[] = []
  const leftPos: (V3 | null)[] = []
  sp.forEach((s, si) => {
    if (s.side !== 'L' || !shown[si]) return
    s.map.forEach((m, k) => {
      const id = atomsEl.length
      mapIndex.set(m, id)
      atomsEl.push(s.atoms[k].el)
      atomMap.push(m)
      ls.push(si)
      rs.push(-1)
      ghost.push(0)
      leftPos.push(null)
    })
  })
  // атомы показанных продуктов из непоказанных копий реагентов — «появляются» (ls = -1)
  sp.forEach((s, si) => {
    if (s.side !== 'R' || !shown[si]) return
    s.map.forEach((m, k) => {
      if (mapIndex.has(m)) return
      const id = atomsEl.length
      mapIndex.set(m, id)
      atomsEl.push(s.atoms[k].el)
      atomMap.push(m)
      ls.push(-1)
      rs.push(-1)
      ghost.push(1)
      leftPos.push(null)
    })
  })
  const speciesAtoms: number[][] = sp.map(() => [])
  sp.forEach((s, si) => {
    if (!shown[si]) return
    s.map.forEach((m) => {
      const id = mapIndex.get(m)
      if (id == null) return
      if (s.side === 'L' && ghost[id] === 1) return
      speciesAtoms[si].push(id)
      if (s.side === 'R') rs[id] = si
    })
  })
  const N = atomsEl.length
  // реагент показан, а его продукт — нет: атом гаснет на месте
  for (let i = 0; i < N; i++) if (ghost[i] === 0 && rs[i] < 0) ghost[i] = -1
  const isGhost = (i: number) => ghost[i] !== 0

  // 2) связи слева/справа → виды изменений
  const key = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a)
  const lOrder = new Map<number, number>()
  const rOrder = new Map<number, number>()
  const adjL: number[][] = Array.from({ length: N }, () => [])
  for (const [si, s] of sp.entries()) {
    if (!shown[si]) continue
    for (const b of s.bonds) {
      const i = mapIndex.get(s.map[b.a])
      const j = mapIndex.get(s.map[b.b])
      if (i == null || j == null) continue
      ;(s.side === 'L' ? lOrder : rOrder).set(key(i, j), b.o)
      if (s.side === 'L') {
        adjL[i].push(j)
        adjL[j].push(i)
      }
    }
  }
  const pairs = new Set<number>([...lOrder.keys(), ...rOrder.keys()])
  // порядок изменений — как в reactions.json (changes), остальные следом
  const changeOrder = new Map<number, number>()
  reaction.changes.forEach((c, k) => {
    const i = mapIndex.get(c.a)
    const j = mapIndex.get(c.b)
    if (i != null && j != null) changeOrder.set(key(i, j), k)
  })
  type Raw = { i: number; j: number; from: 0 | 1 | 2 | 3; to: 0 | 1 | 2 | 3; kind: SynthBondKind; ord: number }
  const raw: Raw[] = []
  for (const k of pairs) {
    const i = Math.floor(k / 65536)
    const j = k % 65536
    let from = (lOrder.get(k) ?? 0) as 0 | 1 | 2 | 3
    let to = (rOrder.get(k) ?? 0) as 0 | 1 | 2 | 3
    // связь «призрачного» атома не меняется — она появляется/гаснет вместе с атомом
    if (isGhost(Math.floor(k / 65536)) || isGhost(k % 65536)) {
      const o = Math.max(from, to) as 0 | 1 | 2 | 3
      from = o
      to = o
    }
    const kind: SynthBondKind = from === to ? 'keep' : to === 0 ? 'break' : from === 0 ? 'form' : to < from ? 'down' : 'up'
    raw.push({ i, j, from, to, kind, ord: changeOrder.get(k) ?? 1e6 + raw.length })
  }
  raw.sort((a, b) => a.ord - b.ord)
  const center = new Array<boolean>(N).fill(false)
  for (const b of raw) if (b.kind !== 'keep') {
    center[b.i] = true
    center[b.j] = true
  }

  // 3) фрагменты: связные части левого графа без разорванных связей
  const broken = new Set(raw.filter((b) => b.kind === 'break').map((b) => key(b.i, b.j)))
  const frag = new Array<number>(N).fill(-1)
  let nFrag = 0
  for (let s = 0; s < N; s++) {
    if (frag[s] >= 0) continue
    const stack = [s]
    frag[s] = nFrag
    while (stack.length) {
      const u = stack.pop()!
      for (const v of adjL[u]) {
        if (frag[v] >= 0 || broken.has(key(u, v))) continue
        frag[v] = nFrag
        stack.push(v)
      }
    }
    nFrag++
  }
  const fragSize = new Array<number>(nFrag).fill(0)
  for (let i = 0; i < N; i++) fragSize[frag[i]]++

  // 4) раскладка исходных веществ: главный (больше всех атомов) — по главным осям; остальные — к своим партнёрам
  const leftIdx = sp.map((s, i) => (s.side === 'L' && shown[i] ? i : -1)).filter((i) => i >= 0)
  let main = leftIdx[0]
  for (const i of leftIdx) if (sp[i].atoms.length > sp[main].atoms.length) main = i
  const formedPartners = raw.filter((b) => b.kind === 'form')
  const placed: Placed[] = []
  const placedSet = new Set<number>()
  const occupied = (): V3[] => placed.flatMap((p) => p.pos)
  const localPos = (si: number): V3[] => speciesPositions(sp[si]).map((p) => [...p] as V3)

  {
    const pts = localPos(main)
    const { axes, c } = principalAxes(pts)
    const pos = pts.map((p) => {
      const d = sub(p, c)
      return [dot(d, axes[0]), dot(d, axes[1]), dot(d, axes[2])] as V3
    })
    placed.push({ idx: main, pos })
    placedSet.add(main)
  }
  const posOf = (atom: number): V3 | null => {
    const si = ls[atom]
    const pl = placed.find((p) => p.idx === si)
    if (!pl) return null
    return pl.pos[speciesAtoms[si].indexOf(atom)]
  }
  let guard = 0
  while (placedSet.size < leftIdx.length && guard++ < 400) {
    // следующий участник: у кого есть новая связь с уже размещённым
    let next = -1
    let partnerAtoms: number[] = []
    let ownAtoms: number[] = []
    for (const si of leftIdx) {
      if (placedSet.has(si)) continue
      const pa: number[] = []
      const own: number[] = []
      for (const b of formedPartners) {
        if (ls[b.i] === si && placedSet.has(ls[b.j])) { own.push(b.i); pa.push(b.j) }
        else if (ls[b.j] === si && placedSet.has(ls[b.i])) { own.push(b.j); pa.push(b.i) }
      }
      if (pa.length) { next = si; partnerAtoms = pa; ownAtoms = own; break }
    }
    const occ = occupied()
    const occC = centroid(occ)
    if (next < 0) {
      // не связан ни с кем из размещённых — справа от всех
      next = leftIdx.find((si) => !placedSet.has(si))!
      const pts = localPos(next)
      const c = centroid(pts)
      let maxX = -Infinity
      for (const p of occ) maxX = Math.max(maxX, p[0])
      let minLocal = Infinity
      for (const p of pts) minLocal = Math.min(minLocal, p[0] - c[0])
      const pos = pts.map((p) => add(sub(p, c), [maxX - minLocal + 2.6, 0, 0]))
      pushAway(pos, occ, [1, 0, 0], 2.2)
      placed.push({ idx: next, pos })
      placedSet.add(next)
      continue
    }
    const pts = localPos(next)
    const c = centroid(pts)
    const ownLocal = ownAtoms.map((a) => pts[speciesAtoms[next].indexOf(a)])
    const ownC = centroid(ownLocal)
    const partnerC = centroid(partnerAtoms.map((a) => posOf(a)!))
    // направление подхода: от центра занятой области к партнёрам; если вырождено — к уходящим атомам или ⟂ плоскости
    let normal = sub(partnerC, occC)
    if (len(normal) < 0.8) {
      const leaving: V3[] = []
      for (const b of raw) {
        if (b.kind !== 'break') continue
        if (partnerAtoms.includes(b.i) && posOf(b.j)) leaving.push(posOf(b.j)!)
        else if (partnerAtoms.includes(b.j) && posOf(b.i)) leaving.push(posOf(b.i)!)
      }
      if (leaving.length) normal = sub(centroid(leaving), partnerC)
      if (len(normal) < 0.3) {
        const local = occ.filter((p) => dist(p, partnerC) < 2.2)
        normal = local.length >= 3 ? principalAxes(local).axes[2] : [0, 1, 0]
        if (dot(normal, [0.2, 1, 0.35]) < 0) normal = scale(normal, -1)
      }
    }
    normal = norm(normal, [0, 1, 0])
    // поворот: реагирующие атомы смотрят на партнёров
    const inward = norm(sub(ownC, c), [-normal[0], -normal[1], -normal[2]])
    const R: M3 = len(sub(ownC, c)) < 0.2 ? rotateOnto([1, 0, 0], [1, 0, 0]) : rotateOnto(inward, scale(normal, -1))
    const rel = pts.map((p) => mulMV(R, sub(p, c)))
    const ownRel = mulMV(R, sub(ownC, c))
    const target = add(partnerC, scale(normal, 2.5))
    const pos = rel.map((p) => add(sub(p, ownRel), target))
    pushAway(pos, occ, normal, 2.0)
    placed.push({ idx: next, pos })
    placedSet.add(next)
  }
  // p1 — «сближены»; p0 — разнесены вдоль направления от главного
  const p1: V3[] = new Array(N)
  const p0: V3[] = new Array(N)
  const mainC = centroid(placed[0].pos)
  const placedPos0: V3[][] = []
  for (const pl of placed) {
    const c = centroid(pl.pos)
    const dir = pl.idx === main ? ([0, 0, 0] as V3) : norm(sub(c, mainC), [1, 0, 0])
    let shifted = pl.pos.map((p) => add(p, scale(dir, 3.4)))
    if (pl.idx !== main) {
      const occ0 = placedPos0.flat()
      shifted = shifted.map((p) => [...p] as V3)
      pushAway(shifted, occ0, dir, 3.4)
    }
    placedPos0.push(shifted)
    speciesAtoms[pl.idx].forEach((a, k) => {
      p1[a] = pl.pos[k]
      p0[a] = shifted[k]
    })
  }
  void leftPos
  // общий поворот: разнос участников — в плоскости экрана (камера смотрит вдоль z), главная ось — по x
  {
    const G = pcaRotation(p0.filter((p, i) => p && ghost[i] !== 1))
    for (let i = 0; i < N; i++) {
      if (ghost[i] === 1) continue
      p0[i] = mulMV(G, p0[i])
      p1[i] = mulMV(G, p1[i])
    }
  }

  // 5) этапы и времена
  const breaks = raw.filter((b) => b.kind === 'break' || b.kind === 'down')
  const forms = raw.filter((b) => b.kind === 'form' || b.kind === 'up')
  const dBreak = Math.min(5, Math.max(1.6, 0.9 + 0.5 * breaks.length))
  const dForm = Math.min(6, Math.max(2.8, 2.2 + 0.35 * forms.length))
  const durs = [STAGE_BASE.reactants, STAGE_BASE.center, dBreak, dForm, STAGE_BASE.products, STAGE_BASE.summary]
  const stages: SynthStage[] = []
  let acc = 0
  SYNTH_STAGE_KEYS.forEach((k, i) => {
    stages.push({ key: k, t0: acc, t1: acc + durs[i] })
    acc += durs[i]
  })
  const total = acc
  const sBreak = stages[2]
  const sForm = stages[3]

  const bonds: SynthBond[] = []
  const breakSlot = dBreak / Math.max(1, breaks.length)
  const breakFade = Math.min(0.45, breakSlot * 0.7)
  breaks.forEach((b, k) => {
    bonds.push({ i: b.i, j: b.j, from: b.from, to: b.to, kind: b.kind, t: sBreak.t0 + breakSlot * (k + 0.85), fade: breakFade })
  })
  const formStart = sForm.t0 + dForm * 0.5
  const formSlot = (dForm * 0.46) / Math.max(1, forms.length)
  const formFade = Math.min(0.45, Math.max(0.12, formSlot * 0.8))
  forms.forEach((b, k) => {
    bonds.push({ i: b.i, j: b.j, from: b.from, to: b.to, kind: b.kind, t: formStart + formSlot * (k + 0.2), fade: formFade })
  })
  for (const b of raw) if (b.kind === 'keep') bonds.push({ i: b.i, j: b.j, from: b.from, to: b.to, kind: 'keep', t: 0, fade: 0 })

  // 6) разрыв: меньший фрагмент отъезжает от партнёра на 0,45 Å (связь «растягивается»)
  const pb: V3[] = Array.from({ length: N }, (_, i) => (p1[i] ? ([...p1[i]] as V3) : ([0, 0, 0] as V3)))
  const fragShift: V3[] = Array.from({ length: nFrag }, () => [0, 0, 0] as V3)
  for (const b of breaks) {
    if (b.kind !== 'break') continue
    const fi = frag[b.i]
    const fj = frag[b.j]
    if (fi === fj) continue
    // уходит меньший; при равенстве — менее электроотрицательный (H от C, Na от Cl)
    let mover = fragSize[fi] < fragSize[fj] ? b.i : fragSize[fj] < fragSize[fi] ? b.j : -1
    if (mover < 0) mover = electronegativity(atomsEl[b.i]) <= electronegativity(atomsEl[b.j]) ? b.i : b.j
    const other = mover === b.i ? b.j : b.i
    const dir = norm(sub(p1[mover], p1[other]))
    fragShift[frag[mover]] = add(fragShift[frag[mover]], scale(dir, 0.45))
  }
  for (let i = 0; i < N; i++) if (ghost[i] !== 1) pb[i] = add(p1[i], fragShift[frag[i]])

  // 7) продукты: Кабш каждого продукта к исходным позициям своих атомов, затем разведение наложений
  const rightIdx = sp.map((s, i) => (s.side === 'R' && shown[i] ? i : -1)).filter((i) => i >= 0)
  const p2: V3[] = new Array(N)
  const prodPos = new Map<number, V3[]>()
  const realPb = pb.filter((_, i) => ghost[i] !== 1)
  let realMaxX = -Infinity
  for (const p of realPb) realMaxX = Math.max(realMaxX, p[0])
  const realC = realPb.length ? centroid(realPb) : ([0, 0, 0] as V3)
  for (const si of rightIdx) {
    const s = sp[si]
    const q = speciesPositions(s).map((p) => [...p] as V3)
    const ids = s.map.map((m) => mapIndex.get(m)!)
    const kIdx = ids.map((a, k) => (ghost[a] === 1 ? -1 : k)).filter((k) => k >= 0)
    if (kIdx.length >= 3 || (kIdx.length && kIdx.length === ids.length)) {
      // «появляющиеся» атомы не тянут поворот (вес 0)
      const w = speciesWeights(s.atoms.map((a) => a.el)).map((x, k) => (ghost[ids[k]] === 1 ? 0 : x))
      const target = ids.map((a) => (ghost[a] === 1 ? ([0, 0, 0] as V3) : pb[a]))
      const { R, cq, cp } = kabsch(q, target, w)
      prodPos.set(si, q.map((p) => add(mulMV(R, sub(p, cq)), cp)))
    } else if (kIdx.length) {
      // 1–2 опорных атома — только сдвиг
      const qc = centroid(kIdx.map((k) => q[k]))
      const tc = centroid(kIdx.map((k) => pb[ids[k]]))
      prodPos.set(si, q.map((p) => add(sub(p, qc), tc)))
    } else {
      // продукт целиком из непоказанных копий — справа от всех
      const qc = centroid(q)
      prodPos.set(si, q.map((p) => add(sub(p, qc), [realMaxX + 3, realC[1], realC[2]])))
    }
  }
  // главный продукт: фокус — самый большой органический; побочные неорганические — потом
  const byproduct = (si: number) => INORGANIC_BYPRODUCT.test(sp[si].ref) && sp[si].atoms.length <= 6
  const prodOrder = [...rightIdx].sort((a, b) => {
    const ba = byproduct(a) ? 1 : 0
    const bb = byproduct(b) ? 1 : 0
    if (ba !== bb) return ba - bb
    return sp[b].atoms.length - sp[a].atoms.length
  })
  const settled: V3[] = []
  for (const si of prodOrder) {
    const pos = prodPos.get(si)!
    if (settled.length) {
      const c = centroid(pos)
      const dir = norm(sub(c, centroid(settled)), [0, -1, 0.3])
      pushAway(pos, settled, dir, 1.9)
    }
    settled.push(...pos)
  }
  for (const si of rightIdx) {
    const ids = sp[si].map.map((m) => mapIndex.get(m)!)
    prodPos.get(si)!.forEach((p, k) => (p2[ids[k]] = p))
  }
  // «призраки»: появляющиеся стоят на месте в продукте с самого начала (невидимы), гаснущие — остаются на месте разрыва
  for (let i = 0; i < N; i++) {
    if (ghost[i] === 1) {
      p0[i] = p2[i]
      p1[i] = p2[i]
      pb[i] = p2[i]
    } else if (ghost[i] === -1) p2[i] = pb[i]
  }
  // p3 — разнесены и развёрнуты главными осями к зрителю (плавный поворот, без искажений); главный — на месте,
  // остальные отодвинуты (побочные — ещё дальше)
  const p3: V3[] = p2.map((p) => [...p] as V3)
  const prodRot = new Map<number, { q: Q4; c2: V3; c3: V3 }>()
  const turned = (si: number): { pos: V3[]; q: Q4; c2: V3 } => {
    const ids = sp[si].map.map((m) => mapIndex.get(m)!)
    const pos = ids.map((a) => p2[a])
    const c2 = centroid(pos)
    const R = sp[si].atoms.length >= 3 ? pcaRotation(pos) : ([1, 0, 0, 0, 1, 0, 0, 0, 1] as M3)
    return { pos: pos.map((p) => add(mulMV(R, sub(p, c2)), c2)), q: quatFromM3(R), c2 }
  }
  const mainProd = prodOrder[0]
  const mainT = turned(mainProd)
  const mainProdC = mainT.c2
  const settled3: V3[] = [...mainT.pos]
  const place3 = (si: number, pos: V3[], q: Q4, c2: V3) => {
    const ids = sp[si].map.map((m) => mapIndex.get(m)!)
    pos.forEach((p, k) => (p3[ids[k]] = p))
    prodRot.set(si, { q, c2, c3: centroid(pos) })
  }
  place3(mainProd, mainT.pos, mainT.q, mainT.c2)
  for (const si of prodOrder.slice(1)) {
    const tr = turned(si)
    let dir = sub(tr.c2, mainProdC)
    dir = norm([dir[0], dir[1], dir[2] * 0.2], [1, 0, 0])
    if (groups.grouped) {
      // «одна копия + ×N»: продукты собраны плотной группой вокруг главного (веером по своим направлениям) —
      // иначе ряд из далёких копий мельчит кадр (KMnO₄, горение, ОВР)
      const moved = tr.pos.map((p) => add(sub(p, tr.c2), add(mainProdC, scale(dir, 0.5))))
      pushAway(moved, settled3, dir, 2.4)
      place3(si, moved, tr.q, tr.c2)
      settled3.push(...moved)
      continue
    }
    const moved = tr.pos.map((p) => add(p, scale(dir, byproduct(si) ? 2.4 : 1.6)))
    pushAway(moved, settled3, dir, byproduct(si) ? 3.6 : 3.0)
    place3(si, moved, tr.q, tr.c2)
    settled3.push(...moved)
  }

  // 8) дуги полёта: фрагмент целиком, в обход атомов других фрагментов (проверка в 3 точках пути)
  const bulgeFrag: V3[] = Array.from({ length: nFrag }, () => [0, 0, 0] as V3)
  const fragAtoms: number[][] = Array.from({ length: nFrag }, () => [])
  for (let i = 0; i < N; i++) fragAtoms[frag[i]].push(i)
  const formedPairs = new Set(raw.filter((b) => b.kind === 'form').map((b) => key(b.i, b.j)))
  const travel = fragAtoms.map((ids) => len(sub(centroid(ids.map((a) => p2[a])), centroid(ids.map((a) => pb[a])))))
  const SAMPLES = [0.3, 0.5, 0.7]
  const posAt = (a: number, s: number, bul: V3): V3 => add(lerp3(pb[a], p2[a], easeInOut(s)), scale(bul, Math.sin(Math.PI * s)))
  const fragOrder = fragAtoms.map((_, f) => f).sort((a, b) => travel[b] - travel[a])
  // соседи по пути: атомы других фрагментов, которые вообще могут оказаться рядом (иначе O(N²) на больших жирах)
  const fragMid = fragAtoms.map((ids) => lerp3(centroid(ids.map((a) => pb[a])), centroid(ids.map((a) => p2[a])), 0.5))
  const fragRad = fragAtoms.map((ids, f) => {
    let r = 0
    for (const a of ids) r = Math.max(r, dist(pb[a], fragMid[f]), dist(p2[a], fragMid[f]))
    return r
  })
  // зазор пути фрагмента f (с дугой bul) до ВСЕХ остальных фрагментов (их текущие дуги), кроме будущих партнёров
  const clearance = (f: number, bul: V3, stopBelow: number): number => {
    let m = Infinity
    const near: number[] = []
    for (let g = 0; g < nFrag; g++) {
      if (g !== f && dist(fragMid[f], fragMid[g]) < fragRad[f] + fragRad[g] + len(bul) + len(bulgeFrag[g]) + 1.5) near.push(g)
    }
    if (!near.length) return m
    for (const s of SAMPLES) {
      for (const a of fragAtoms[f]) {
        const pa = posAt(a, s, bul)
        for (const g of near) {
          for (const b of fragAtoms[g]) {
            if (formedPairs.has(key(a, b)) || ghost[b] !== 0) continue
            const d = dist(pa, posAt(b, s, bulgeFrag[g]))
            if (d < m) {
              m = d
              if (m <= stopBelow) return m
            }
          }
        }
      }
    }
    return m
  }
  // два прохода: дуга каждого движущегося фрагмента подбирается с учётом уже выбранных дуг всех остальных
  // (в том числе стоящих на месте — их раньше не проверяли, отсюда пролёты «сквозь» атомы)
  const moving = fragOrder.filter((f) => travel[f] > 0.25)
  for (let pass = 0; pass < 2 && moving.length; pass++) {
    let worst = Infinity
    for (const f of moving) {
      const now = clearance(f, bulgeFrag[f], -1)
      worst = Math.min(worst, now)
      if (pass > 0 && now >= 0.8) continue
      const ids = fragAtoms[f]
      const d = norm(sub(centroid(ids.map((a) => p2[a])), centroid(ids.map((a) => pb[a]))))
      const u = norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]))
      const w = norm(cross(d, u))
      const cands: V3[] = [[0, 0, 0]]
      for (const r of [1.1, 2.0, 3.0, 4.2, 5.6, 7.2]) {
        cands.push(scale(w, r), scale(w, -r), scale(u, r), scale(u, -r))
        const r2 = r * Math.SQRT1_2
        cands.push(add(scale(w, r2), scale(u, r2)), add(scale(w, -r2), scale(u, r2)), add(scale(w, r2), scale(u, -r2)), add(scale(w, -r2), scale(u, -r2)))
      }
      let best: V3 = bulgeFrag[f]
      let bestClr = now
      if (bestClr < 1.2) {
        for (const c of cands) {
          // досрочный выход clearance возвращает лишь верхнюю оценку — такой кандидат просто «не лучше»
          const stop = Math.min(bestClr + 0.05, 1.2)
          const clr = clearance(f, c, stop)
          if (clr <= stop) continue
          best = c
          bestClr = clr
          if (clr >= 1.2) break
        }
      }
      bulgeFrag[f] = best
    }
    if (worst >= 0.8) break
  }

  // 9) электроны разрыва
  const electrons: SynthElectron[] = []
  const formTimeOf = new Map<number, number>()
  for (const b of bonds) if (b.kind === 'form' || b.kind === 'up') {
    formTimeOf.set(b.i, Math.min(formTimeOf.get(b.i) ?? Infinity, b.t))
    formTimeOf.set(b.j, Math.min(formTimeOf.get(b.j) ?? Infinity, b.t))
  }
  for (const b of bonds) {
    if (b.kind !== 'break') continue
    const end = (a: number) => Math.min(formTimeOf.get(a) ?? sForm.t1, sForm.t1)
    if (radical) {
      electrons.push({ atom: b.i, partner: b.j, count: 1, t0: b.t, t1: end(b.i) })
      electrons.push({ atom: b.j, partner: b.i, count: 1, t0: b.t, t1: end(b.j) })
    } else {
      const ei = electronegativity(atomsEl[b.i])
      const ej = electronegativity(atomsEl[b.j])
      const a = ei >= ej ? b.i : b.j
      electrons.push({ atom: a, partner: a === b.i ? b.j : b.i, count: 2, t0: b.t, t1: end(a) })
    }
  }

  // 10) концы цепей полимеров («…»): атом с недобранной валентностью
  const species: SynthSpecies[] = sp.map((s, si) => {
    const ids = speciesAtoms[si]
    const ends: { atom: number; dir: V3 }[] = []
    if (shown[si] && (s.ref.startsWith('polymer:') || reaction.polymer)) {
      const deg = new Array<number>(s.atoms.length).fill(0)
      const nb: number[][] = s.atoms.map(() => [])
      for (const b of s.bonds) {
        deg[b.a] += b.o
        deg[b.b] += b.o
        nb[b.a].push(b.b)
        nb[b.b].push(b.a)
      }
      s.atoms.forEach((a, k) => {
        const v = VALENCE[a.el]
        if (v == null || a.ch !== 0 || deg[k] >= v) return
        if (!s.ref.startsWith('polymer:')) return
        const posArr = s.side === 'L' ? p1 : p2
        const self = posArr[ids[k]]
        const nbC = nb[k].length ? centroid(nb[k].map((n) => posArr[ids[n]])) : add(self, [-1, 0, 0])
        ends.push({ atom: ids[k], dir: norm(sub(self, nbC)) })
      })
    }
    return {
      index: si,
      side: s.side,
      ref: s.ref,
      smiles: s.smiles,
      nameRu: s.nameRu,
      atoms: ids,
      byproduct: s.side === 'R' && byproduct(si),
      turn: prodRot.get(si),
      ends,
      copies: groups.copies[si],
    }
  })

  const atoms: SynthAtom[] = []
  for (let i = 0; i < N; i++) {
    atoms.push({
      map: atomMap[i],
      el: atomsEl[i],
      ls: ls[i],
      rs: rs[i],
      p0: p0[i],
      p1: p1[i],
      pb: pb[i],
      p2: p2[i],
      p3: p3[i],
      bulge: bulgeFrag[frag[i]],
      center: center[i],
      frag: frag[i],
      ghost: ghost[i],
    })
  }
  return { reactionId: reaction.id, atoms, bonds, species, electrons, stages, total, radical, main, grouped: groups.grouped }
}

// ─── кадр ────────────────────────────────────────────────────────────────────

export function stageIndexAt(sc: SynthScenario, t: number): number {
  for (let i = sc.stages.length - 1; i >= 0; i--) if (t >= sc.stages[i].t0) return i
  return 0
}

/** Позиции всех атомов в момент t → out (x,y,z подряд). */
export function atomPositionsAt(sc: SynthScenario, t: number, out: Float32Array): void {
  const [, c, b, f, p] = sc.stages
  const n = sc.atoms.length
  if (t < c.t0) {
    for (let i = 0; i < n; i++) put(out, i, sc.atoms[i].p0)
    return
  }
  if (t < b.t0) {
    const s = easeInOut((t - c.t0) / ((c.t1 - c.t0) * 0.7))
    for (let i = 0; i < n; i++) put(out, i, lerp3(sc.atoms[i].p0, sc.atoms[i].p1, s))
    return
  }
  if (t < f.t0) {
    // фрагменты отходят по мере разрыва своих связей — плавно в течение этапа
    const s = easeInOut((t - b.t0) / (b.t1 - b.t0))
    for (let i = 0; i < n; i++) put(out, i, lerp3(sc.atoms[i].p1, sc.atoms[i].pb, s))
    return
  }
  if (t < p.t0) {
    const raw = clamp01((t - f.t0) / ((f.t1 - f.t0) * 0.62))
    const s = easeInOut(raw)
    const k = Math.sin(Math.PI * raw)
    for (let i = 0; i < n; i++) {
      const a = sc.atoms[i]
      put(out, i, add(lerp3(a.pb, a.p2, s), scale(a.bulge, k)))
    }
    return
  }
  const s = easeInOut((t - p.t0) / ((p.t1 - p.t0) * 0.7))
  if (s >= 1) {
    for (let i = 0; i < n; i++) put(out, i, sc.atoms[i].p3)
    return
  }
  // жёсткий поворот каждого продукта (slerp) + перенос центра
  const mats = sc.species.map((sp) => (sp.turn ? m3FromQuat(slerpFromIdentity(sp.turn.q, s)) : null))
  for (let i = 0; i < n; i++) {
    const a = sc.atoms[i]
    const sp = a.rs >= 0 ? sc.species[a.rs] : null
    const M = a.rs >= 0 ? mats[a.rs] : null
    if (!sp?.turn || !M) {
      put(out, i, lerp3(a.p2, a.p3, s))
      continue
    }
    put(out, i, add(mulMV(M, sub(a.p2, sp.turn.c2)), lerp3(sp.turn.c2, sp.turn.c3, s)))
  }
}

function put(out: Float32Array, i: number, v: V3) {
  out[i * 3] = v[0]
  out[i * 3 + 1] = v[1]
  out[i * 3 + 2] = v[2]
}

/** Толщина (0…1) линии k связи в момент t: до изменения видны from линий, после — to; переход — гашение/появление. */
export function bondLineScale(b: SynthBond, line: number, t: number): number {
  const before = line < b.from ? 1 : 0
  const after = line < b.to ? 1 : 0
  if (before === after) return before
  if (after === 0) {
    // гаснет к моменту b.t
    return 1 - clamp01((t - (b.t - b.fade)) / b.fade)
  }
  return clamp01((t - b.t) / b.fade)
}

/** Сколько линий у связи максимум (для instancing). */
export const bondLines = (b: SynthBond): number => Math.max(1, b.from, b.to)

/** Видимость атома (0…1): «призраки» копий появляются/гаснут в середине этапа «Образование связей». */
export function atomVisibility(sc: SynthScenario, i: number, t: number): number {
  const g = sc.atoms[i].ghost
  if (!g) return 1
  const f = sc.stages[3]
  const s = clamp01((t - (f.t0 + (f.t1 - f.t0) * 0.25)) / ((f.t1 - f.t0) * 0.35))
  return g === 1 ? s : 1 - s
}

/** Видимость электронов (0…1) в момент t. */
export function electronAlpha(e: SynthElectron, t: number): number {
  if (t < e.t0 || t > e.t1 + 0.3) return 0
  const up = clamp01((t - e.t0) / 0.25)
  const down = 1 - clamp01((t - e.t1) / 0.3)
  return Math.min(up, down)
}

/** Рамка кадра: центр и радиус облака атомов (для камеры); vis — видимость атомов (невидимые не считаются). */
export function boundsOf(pos: Float32Array, n: number, vis?: Float32Array): { c: V3; r: number } {
  let x = 0, y = 0, z = 0
  let k = 0
  for (let i = 0; i < n; i++) {
    if (vis && vis[i] < 0.05) continue
    x += pos[i * 3]
    y += pos[i * 3 + 1]
    z += pos[i * 3 + 2]
    k++
  }
  const c: V3 = k ? [x / k, y / k, z / k] : [0, 0, 0]
  let r = 1
  for (let i = 0; i < n; i++) {
    if (vis && vis[i] < 0.05) continue
    const d = Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2])
    if (d > r) r = d
  }
  return { c, r }
}
