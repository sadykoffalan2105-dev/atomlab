/**
 * Электроны сцен пути — всегда снаружи шаров и раздельны (та же норма, что у «Как образуется» v3):
 *  • центр точки не ближе r_vis + GAP к центру любого видимого шара, GAP = 1,25·eR, r_vis = r·(0,2 + 0,8k) — как рисует
 *    RouteAtoms; точка внутри — выносится по радиусу шара на его поверхность + GAP (проекция непрерывна по t: точка
 *    «обтекает» шар, а не прыгает);
 *  • две видимые точки не ближе 2,3·eR: раздвигаются поровну вдоль линии между ними (в «шейке» между двумя шарами
 *    проекции иначе свели бы пару в одну точку), затем снова выносятся из шаров.
 * Положения всех точек считаются вместе на момент t (кэш по t — RouteAtoms, след и ореол спрашивают один кадр).
 */
import type { RouteModel, V3 } from '../geom'

/** Радиус точки электрона RouteAtoms (9 пм в мировых единицах). */
export const ROUTE_E_R = 9 * 0.00285
const GAP = 1.25 * ROUTE_E_R
const SEP = 2.3 * ROUTE_E_R
const ROUNDS = 5

/** Обернуть pos(t) всех электронов модели: точки вне шаров и не ближе 2,3·eR друг к другу. */
export function keepElectronsOutside(m: RouteModel): RouteModel {
  const parts = m.particles
  const raw = m.electrons.map((e) => e.pos)
  const vis = m.electrons.map((e) => e.k)
  const n = raw.length
  let cacheT = NaN
  const cache: V3[] = raw.map(() => [0, 0, 0])

  const project = (p: V3, balls: { c: V3; r: number }[]) => {
    for (let pass = 0; pass < 6; pass++) {
      let moved = false
      for (const b of balls) {
        const dx = p[0] - b.c[0]
        if (dx > b.r || dx < -b.r) continue
        const dy = p[1] - b.c[1]
        const dz = p[2] - b.c[2]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= b.r * b.r) continue
        const d = Math.sqrt(d2)
        if (d < 1e-6) p[2] = b.c[2] + b.r
        else {
          p[0] = b.c[0] + (dx / d) * b.r
          p[1] = b.c[1] + (dy / d) * b.r
          p[2] = b.c[2] + (dz / d) * b.r
        }
        moved = true
      }
      if (!moved) break
    }
  }

  const solve = (t: number) => {
    if (t === cacheT) return
    cacheT = t
    const balls: { c: V3; r: number }[] = []
    for (const b of parts) {
      const k = b.k(t)
      if (k <= 0.005) continue
      balls.push({ c: b.pos(t), r: b.r(t) * (0.2 + 0.8 * Math.min(1, k)) + GAP })
    }
    const on: boolean[] = []
    for (let i = 0; i < n; i++) {
      const q = raw[i]!(t)
      cache[i] = [q[0], q[1], q[2]]
      on.push(vis[i]!(t) > 0.01)
      project(cache[i]!, balls)
    }
    for (let round = 0; round < ROUNDS; round++) {
      let moved = false
      for (let a = 0; a < n; a++) {
        if (!on[a]) continue
        for (let b = a + 1; b < n; b++) {
          if (!on[b]) continue
          const A = cache[a]!
          const B = cache[b]!
          let dx = B[0] - A[0]
          let dy = B[1] - A[1]
          let dz = B[2] - A[2]
          let d = Math.hypot(dx, dy, dz)
          if (d >= SEP) continue
          if (d < 1e-6) ((dx = 1), (dy = 0), (dz = 0), (d = 1))
          else ((dx /= d), (dy /= d), (dz /= d))
          const h = (SEP - Math.min(d, SEP)) / 2
          const ux = dx * h
          const uy = dy * h
          const uz = dz * h
          A[0] -= ux
          A[1] -= uy
          A[2] -= uz
          B[0] += ux
          B[1] += uy
          B[2] += uz
          moved = true
        }
      }
      if (!moved) break
      for (let i = 0; i < n; i++) if (on[i]) project(cache[i]!, balls)
    }
  }

  m.electrons.forEach((e, i) => {
    e.pos = (t: number): V3 => {
      solve(t)
      const p = cache[i]!
      return [p[0], p[1], p[2]]
    }
  })
  return m
}
