/**
 * «Выровнять» — красивая раскладка рисунка Конструктора.
 * 1) Совпало с молекулой реестра → 2D скелетной формулы RDKit (p2) по каноническому соответствию атомов.
 * 2) Дерево (без циклов) → главная цепь зигзагом, ветви под 60°/90°, тройные связи — по прямой.
 * 3) Есть циклы → расслабление «пружинами» (длины 1, углы 120° через расстояния 1–3, отталкивание) от текущего рисунка.
 */
import type { OV2Molecule } from '../../../data/organicV2/types'
import { canonicalizeMol, skeletonFromOV2, toMol, type Mol } from '../../../chemistry/organicV2'
import { ringBondIds, toSkeleton, type CState } from './model'

const DEG = Math.PI / 180

/** Ранги канонической нумерации без цис/транс (совпадают у изоморфных графов). */
function ranks(m: Mol): number[] {
  return canonicalizeMol({ ...m, stereo: new Map() }).rank
}

/** Координаты из 2D RDKit молекулы реестра; null — если не удалось сопоставить атомы. */
export function layoutFromRegistry(s: CState, mol: OV2Molecule): CState | null {
  const sk = toSkeleton(s, { cisTrans: false })
  const mDrawn = toMol(sk.graph)
  const mReg = toMol(skeletonFromOV2(mol))
  if (mDrawn.n !== mReg.n) return null
  const rD = ranks(mDrawn), rR = ranks(mReg)
  const byRank = new Map<number, number>()
  rR.forEach((r, k) => byRank.set(r, k))
  // проверка: соответствие сохраняет элементы и связи
  for (let k = 0; k < mDrawn.n; k++) {
    const k2 = byRank.get(rD[k])
    if (k2 === undefined || mReg.el[k2] !== mDrawn.el[k]) return null
  }
  const pos = new Map<number, { x: number; y: number }>()
  for (let k = 0; k < mDrawn.n; k++) {
    const k2 = byRank.get(rD[k])!
    const p = mol.atoms[mReg.src[k2]].p2
    // RDKit: y вверх; SVG: y вниз
    pos.set(sk.ids[mDrawn.src[k]], { x: p[0], y: -p[1] })
  }
  return centered({ ...s, atoms: s.atoms.map((a) => ({ ...a, ...(pos.get(a.id) ?? {}) })) })
}

function centered(s: CState): CState {
  if (!s.atoms.length) return s
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const a of s.atoms) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y) }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return { ...s, atoms: s.atoms.map((a) => ({ ...a, x: a.x - cx, y: a.y - cy })) }
}

/** Раскладка дерева: главная цепь (самый длинный путь по C) — зигзагом слева направо. */
function layoutTree(s: CState): CState {
  const adj = new Map<number, { to: number; o: number }[]>()
  for (const a of s.atoms) adj.set(a.id, [])
  for (const b of s.bonds) { adj.get(b.a)!.push({ to: b.b, o: b.o }); adj.get(b.b)!.push({ to: b.a, o: b.o }) }
  const el = new Map(s.atoms.map((a) => [a.id, a.el]))
  const pos = new Map<number, { x: number; y: number }>()
  const seen = new Set<number>()
  let offsetY = 0
  for (const start of s.atoms) {
    if (seen.has(start.id)) continue
    // компонента связности
    const comp: number[] = []
    const q = [start.id]; seen.add(start.id)
    while (q.length) { const v = q.shift()!; comp.push(v); for (const e of adj.get(v)!) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to) } }
    // самый длинный путь: две волны BFS (предпочитаем C на концах)
    const far = (src: number) => {
      const par = new Map<number, number>([[src, -1]]); const dist = new Map([[src, 0]])
      const qq = [src]; let best = src
      while (qq.length) {
        const v = qq.shift()!
        const better = dist.get(v)! > dist.get(best)! || (dist.get(v) === dist.get(best) && el.get(v) === 'C' && el.get(best) !== 'C')
        if (better) best = v
        for (const e of adj.get(v)!) if (!par.has(e.to)) { par.set(e.to, v); dist.set(e.to, dist.get(v)! + 1); qq.push(e.to) }
      }
      return { best, par }
    }
    const a = far(comp[0]).best
    const { best: b, par } = far(a)
    const path: number[] = []
    for (let v = b; v !== -1; v = par.get(v)!) path.push(v)
    path.reverse()
    // цепь: зигзаг 30° вверх/вниз; у тройной связи и =C= — прямо
    let ang = -30 * DEG
    let x = 0, y = 0
    const local = new Map<number, { x: number; y: number }>()
    local.set(path[0], { x, y })
    const dirIn = new Map<number, number>()
    for (let k = 1; k < path.length; k++) {
      const prevO = adj.get(path[k - 1])!
      const linear = prevO.some((e) => e.o === 3) || prevO.filter((e) => e.o === 2).length >= 2
      if (k > 1 && !linear) ang = ang < 0 ? 30 * DEG : -30 * DEG
      x += Math.cos(ang); y += Math.sin(ang)
      local.set(path[k], { x, y })
      dirIn.set(path[k], ang)
    }
    dirIn.set(path[0], path.length > 1 ? dirIn.get(path[1])! : 0)
    // ветви: обход от цепи
    const onPath = new Set(path)
    const place = (v: number, from: number, dir: number) => {
      const kids = adj.get(v)!.filter((e) => e.to !== from && !local.has(e.to))
      if (!kids.length) return
      const linear = adj.get(v)!.some((e) => e.o === 3) || adj.get(v)!.filter((e) => e.o === 2).length >= 2
      const fans = linear ? [0] : kids.length === 1 ? [zig(v, dir)] : kids.length === 2 ? [60, -60] : [90, 0, -90]
      kids.forEach((e, k) => {
        const d = dir + (fans[k] ?? 0) * DEG
        const p = local.get(v)!
        local.set(e.to, { x: p.x + Math.cos(d), y: p.y + Math.sin(d) })
        place(e.to, v, d)
      })
    }
    const zigMemo = new Map<number, number>()
    const zig = (v: number, _dir: number) => { const z = (zigMemo.get(v) ?? 1) * 60; zigMemo.set(v, -(zigMemo.get(v) ?? 1)); return z }
    path.forEach((v, k) => {
      const kids = adj.get(v)!.filter((e) => !onPath.has(e.to))
      if (!kids.length) return
      const p = local.get(v)!
      // направление «наружу» от цепи: противоположно биссектрисе соседних связей цепи
      const nbs = [path[k - 1], path[k + 1]].filter((u) => u !== undefined).map((u) => local.get(u)!)
      let out: number
      if (nbs.length === 2) {
        const bx = (nbs[0].x - p.x) + (nbs[1].x - p.x), by = (nbs[0].y - p.y) + (nbs[1].y - p.y)
        out = Math.hypot(bx, by) < 1e-6 ? -90 * DEG : Math.atan2(-by, -bx)
      } else if (nbs.length === 1) out = Math.atan2(p.y - nbs[0].y, p.x - nbs[0].x)
      else out = -90 * DEG
      const fans = kids.length === 1 ? [0] : kids.length === 2 ? (nbs.length === 2 ? [-90, 90].map((d) => d) : [60, -60]) : [90, 0, -90]
      kids.forEach((e, i) => {
        // у атома цепи с двумя ветвями (четвертичный C) — вверх и вниз
        const d = nbs.length === 2 && kids.length === 2 ? (i === 0 ? -90 * DEG : 90 * DEG) : out + fans[i] * DEG
        local.set(e.to, { x: p.x + Math.cos(d), y: p.y + Math.sin(d) })
        place(e.to, v, d)
      })
    })
    for (const [id, p] of local) pos.set(id, { x: p.x, y: p.y + offsetY })
    let ymax = -Infinity
    for (const p of local.values()) ymax = Math.max(ymax, p.y)
    offsetY += ymax + 2.5
  }
  return centered({ ...s, atoms: s.atoms.map((a) => ({ ...a, ...(pos.get(a.id) ?? {}) })) })
}

/** Расслабление пружинами (для циклов вне реестра). */
function relax(s: CState, iters = 260): CState {
  const ids = s.atoms.map((a) => a.id)
  const ix = new Map(ids.map((id, i) => [id, i]))
  const P = s.atoms.map((a) => [a.x, a.y])
  const adj: number[][] = ids.map(() => [])
  for (const b of s.bonds) { adj[ix.get(b.a)!].push(ix.get(b.b)!); adj[ix.get(b.b)!].push(ix.get(b.a)!) }
  // целевые расстояния: связь 1; через атом — по углу 120° (√3), у кольца n — по углу правильного n-угольника
  const ring = ringBondIds(s)
  const pairs: [number, number, number, number][] = []
  for (const b of s.bonds) pairs.push([ix.get(b.a)!, ix.get(b.b)!, 1, 1])
  adj.forEach((nb, c) => {
    for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) {
      const deg = nb.length >= 4 ? 90 : nb.length === 3 || nb.length === 2 ? 120 : 120
      void ring
      pairs.push([nb[i], nb[j], 2 * Math.sin((deg * DEG) / 2), 0.35])
      void c
    }
  })
  for (let it = 0; it < iters; it++) {
    for (const [i, j, d0, k] of pairs) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1]
      const d = Math.hypot(dx, dy) || 1e-3
      const f = ((d - d0) / d) * 0.5 * k
      P[i][0] += dx * f; P[i][1] += dy * f; P[j][0] -= dx * f; P[j][1] -= dy * f
    }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1]
      const d = Math.hypot(dx, dy) || 1e-3
      if (d < 1.4) { const f = ((1.4 - d) / d) * 0.12; P[i][0] -= dx * f; P[i][1] -= dy * f; P[j][0] += dx * f; P[j][1] += dy * f }
    }
  }
  return centered({ ...s, atoms: s.atoms.map((a, i) => ({ ...a, x: P[i][0], y: P[i][1] })) })
}

/** «Выровнять»: реестр → RDKit 2D, дерево → зигзаг, иначе — пружины. */
export function tidyLayout(s: CState, registryMol?: OV2Molecule | null): CState {
  if (!s.atoms.length) return s
  if (registryMol) {
    const r = layoutFromRegistry(s, registryMol)
    if (r) return r
  }
  if (ringBondIds(s).size === 0) return layoutTree(s)
  return relax(s)
}
