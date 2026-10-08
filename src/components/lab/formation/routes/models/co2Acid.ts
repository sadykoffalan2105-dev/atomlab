/**
 * CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O — мрамор и соляная кислота (Kimyo 8, с. 16; аппарат Киппа). Модель сцены:
 *  reagents — поверхность мрамора (ионный кристалл Ca²⁺ CO₃²⁻; CO₃²⁻ — плоский треугольник 120°, C–O 129 пм),
 *             в растворе молекулы HCl (127 пм) среди молекул воды;
 *  dissociate — HCl → H⁺ + Cl⁻: общая пара уходит к более электроотрицательному Cl;
 *  protonate1 — CO₃²⁻ отрывается от кристалла, H⁺ садится на неподелённую пару O → HCO₃⁻; Ca²⁺ уходит в раствор;
 *  protonate2 — второй H⁺ → H₂CO₃ (угольная кислота, непрочная);
 *  decompose — H₂CO₃ → CO₂ + H₂O: H переходит к соседнему OH, связь C–O(H) рвётся (пара уходит к O),
 *              пара O–H становится π-связью C=O; O–C–O раскрывается 120° → 180°, 116 пм;
 *  gas — CO₂ уходит пузырьком (газ ↑ — поэтому реакция обмена идёт до конца), в растворе остаются Ca²⁺ и 2Cl⁻;
 *  final — итог: CaCl₂ (ионы в растворе), CO₂↑, H₂O. Степени окисления не меняются (C⁺⁴ → C⁺⁴) — не ОВР.
 */
import {
  BOND_PM,
  ION_PM,
  add3,
  buildStages,
  lerp3,
  mul3,
  norm3,
  pm,
  rCov,
  rIon,
  rotAxis,
  seg,
  step,
  track,
  trackN,
  type Bond,
  type CamKey,
  type Fn,
  type Particle,
  type PFn,
  type RouteElectron,
  type RouteModel,
  type V3,
} from '../geom'

export const CO2_ACID_STAGES = [
  { key: 'reagents', dur: 5 },
  { key: 'dissociate', dur: 4.5 },
  { key: 'protonate1', dur: 4.5 },
  { key: 'protonate2', dur: 4.5 },
  { key: 'decompose', dur: 5.5 },
  { key: 'gas', dur: 5 },
  { key: 'final', dur: 5.5 },
] as const

/** Высота поверхности мрамора. */
export const SURF_Y = -0.62
const UP: V3 = [0, 1, 0]
const dir2 = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
/** Точка плоскости CO₃: X = (1,0,0), B(φ) = (0, sin φ, −cos φ): φ = 0 — лежит в кристалле, 90° — стоит к камере. */
const inPlane = (c: V3, phi: number, a: number, b: number): V3 => [c[0] + a, c[1] + b * Math.sin(phi), c[2] - b * Math.cos(phi)]
/** Квадратичная кривая Безье. */
const bez = (s: V3, q: V3, e: V3, u: number): V3 => add3(add3(mul3(s, (1 - u) * (1 - u)), q, 2 * u * (1 - u)), e, u * u)

export function co2AcidModel(): RouteModel {
  const stages = buildStages(CO2_ACID_STAGES)
  const R = stages.W('reagents')
  const D = stages.W('dissociate')
  const P1 = stages.W('protonate1')
  const P2 = stages.W('protonate2')
  const Dc = stages.W('decompose')
  const G = stages.W('gas')
  const F = stages.W('final')

  const rC = rCov('C')
  const rO = rCov('O')
  const rH = rCov('H') * 1.1
  const rCl = rCov('Cl')
  const rClm = rIon(ION_PM.Cl1)
  const rCa = rIon(ION_PM.Ca2)
  const dCO3 = pm(BOND_PM.CO_carbonate) // 0,368
  const dCOH = pm(BOND_PM.CO_h2co3_single) // 0,382
  const dCOd = pm(BOND_PM.CO_h2co3_double) // 0,345
  const dCO2 = pm(BOND_PM.CO_co2) // 0,331
  const dOH = pm(BOND_PM.OH) // 0,274
  const dHCl = pm(BOND_PM.HCl) / 2

  // ── CO₃²⁻ → HCO₃⁻ → H₂CO₃ → CO₂: центр, наклон плоскости φ, поворот в финале ──
  const center = track([
    { t: P1.t0 + 0.4, p: [0, SURF_Y, 0] },
    { t: P1.t1 - 0.3, p: [0, -0.12, 0.05] },
    { t: G.t0 + 0.4, p: [0, -0.12, 0.05] },
    { t: G.t1, p: [0.05, 0.7, 0] },
  ])
  const phi = (t: number) => (Math.PI / 2) * seg(t, P1.t0 + 0.4, P1.t1 - 0.3)
  const spin = (t: number) => 0.9 * seg(t, F.t0, F.t1)
  // углы и длины в плоскости (градусы / мировые единицы)
  const a1 = trackN([
    { t: Dc.t0 + 2.2, v: 90 },
    { t: Dc.t0 + 4.2, v: 60 },
    { t: G.t0 + 0.4, v: 60 },
    { t: G.t0 + 3.0, v: 0 },
  ])
  const a2 = (t: number) => a1(t) + 180 * seg(t, Dc.t0 + 2.2, Dc.t0 + 4.2) + 120 * (1 - seg(t, Dc.t0 + 2.2, Dc.t0 + 4.2))
  const L1 = trackN([
    { t: P2.t0 + 2.5, v: dCO3 },
    { t: P2.t1, v: dCOd },
    { t: Dc.t0 + 2.2, v: dCOd },
    { t: Dc.t0 + 4.2, v: dCO2 },
  ])
  const L2 = trackN([
    { t: P2.t0 + 2.5, v: dCO3 },
    { t: P2.t1, v: dCOH },
    { t: Dc.t0 + 2.2, v: dCOH },
    { t: Dc.t0 + 4.2, v: dCO2 },
  ])
  const L3 = trackN([
    { t: P1.t0 + 2.5, v: dCO3 },
    { t: P1.t1, v: dCOH },
  ])
  const at = (t: number, ang: number, L: number): V3 => {
    const [ca, sa] = dir2(ang)
    const c = center(t)
    const p = inPlane([0, 0, 0], phi(t), L * ca, L * sa)
    return add3(c, rotAxis(p, UP, spin(t)))
  }
  const pC: PFn = (t) => center(t)
  const pO1: PFn = (t) => at(t, a1(t), L1(t))
  const pO2: PFn = (t) => at(t, a2(t), L2(t))
  // O₃ — до распада на CO₃; затем уходит водой вправо вниз
  const W: V3 = [0.7, -0.3, 0.3]
  const o3Bound = (t: number) => at(t, 330, L3(t))
  const pO3: PFn = (t) => {
    const u = seg(t, Dc.t0 + 1.8, Dc.t0 + 3.6)
    const drift: V3 = [0.03 * Math.sin(0.5 * t), 0.03 * Math.sin(0.37 * t + 1), 0]
    return u <= 0 ? o3Bound(t) : add3(lerp3(o3Bound(t), W, u), drift, u)
  }
  // смещения H в плоскости (после поворота в финале — вместе с водой не крутятся: вода уже отдельно)
  const site = (t: number, from: PFn, ang: number): V3 => add3(from(t), inPlane([0, 0, 0], phi(t), ...(dir2(ang).map((x) => x * dOH) as [number, number])))
  const site3a = (t: number) => site(t, pO3, 40) // H1 на O3 (вверх-вправо)
  const site3b = (t: number) => site(t, pO3, 40 - 104.5) // H2 на O3 после переноса (вода: 104,5°)
  const site2 = (t: number) => site(t, pO2, 280) // H2 на O2 (вниз, к O3)

  // ── HCl: подлетают, распадаются на H⁺ и Cl⁻ ──
  const u1 = norm3([-0.8, -0.6, 0])
  const u2 = norm3([0.55, -0.83, 0])
  const h1c = track([
    { t: R.t0, p: [1.35, 0.82, 0.25] },
    { t: R.t0 + 4, p: [0.85, 0.42, 0.15] },
  ])
  const h2c = track([
    { t: R.t0 + 0.4, p: [-1.15, 0.98, -0.12] },
    { t: R.t0 + 4.4, p: [-0.55, 0.62, -0.1] },
  ])
  const sepAt = (lag: number) => (t: number) => seg(t, D.t0 + 1.8 + lag, D.t0 + 3.6 + lag)
  const s1 = sepAt(0)
  const s2 = sepAt(0.6)
  const h1Free: PFn = (t) => add3(h1c(t), u1, dHCl + 0.25 * s1(t))
  const h2Free: PFn = (t) => add3(h2c(t), u2, dHCl + 0.25 * s2(t))
  // Cl⁻ после распада уходят вглубь раствора (не заслоняют карбонат), дальше — тепловое движение
  const cl1Away: V3 = [1.25, 0.55, -0.6]
  const cl2Away: V3 = [-1.2, 1.0, -0.6]
  const cl1: PFn = (t) => {
    const p = add3(h1c(t), u1, -(dHCl + 0.16 * s1(t)))
    return add3(lerp3(p, cl1Away, seg(t, D.t1 - 0.6, P1.t0 + 2.4)), [0.04 * Math.sin(0.4 * t), 0.04 * Math.sin(0.31 * t), 0], seg(t, P1.t0, P1.t1))
  }
  const cl2: PFn = (t) => {
    const p = add3(h2c(t), u2, -(dHCl + 0.16 * s2(t)))
    return add3(lerp3(p, cl2Away, seg(t, D.t1 - 0.3, P1.t0 + 2.8)), [0.04 * Math.sin(0.35 * t + 2), 0.04 * Math.sin(0.29 * t + 1), 0], seg(t, P2.t0, P2.t1))
  }
  // H1⁺ → O3 (протонирование 1); H2⁺ → O2 (протонирование 2, в обход слева снизу); H2 → O3 (распад)
  const pH1: PFn = (t) => {
    const u = seg(t, P1.t0 + 1.0, P1.t0 + 3.4)
    if (u <= 0) return h1Free(t)
    return lerp3(h1Free(t), site3a(t), u)
  }
  const pH2: PFn = (t) => {
    const u = seg(t, P2.t0 + 0.8, P2.t0 + 3.4)
    if (u <= 0) return h2Free(t)
    if (t < Dc.t0 + 0.5) return u >= 1 ? site2(t) : bez(h2Free(t), [-0.95, -0.55, 0.0], site2(t), u)
    const v = seg(t, Dc.t0 + 0.5, Dc.t0 + 2.0)
    return v >= 1 ? site3b(t) : lerp3(site2(t), site3b(t), v)
  }
  // Ca²⁺ уходит из кристалла в раствор
  const pCa = track([
    { t: P1.t0 + 1.5, p: [-0.85, SURF_Y, 0] },
    { t: P2.t1, p: [-0.95, 0.0, 0.2] },
  ])

  const tDis1 = D.t0 + 2.4
  const tDis2 = D.t0 + 3.0
  const tB1 = P1.t0 + 3.2
  const tB2 = P2.t0 + 3.2
  const sup = (q: number) => (q === 1 ? '⁺' : q === -1 ? '⁻' : '')
  const hQ = (tDis: number, tBind: number): Fn => (t) => (t >= tDis && t < tBind ? 1 : 0)
  const particles: Particle[] = [
    { id: 'Ca', el: 'Ca', label: 'Ca²⁺', q: () => 2, r: () => rCa, pos: (t) => add3(pCa(t), [0.03 * Math.sin(0.3 * t), 0.03 * Math.sin(0.41 * t), 0], seg(t, P2.t1, F.t1)), k: () => 1 },
    { id: 'C', el: 'C', label: 'C', r: () => rC, pos: pC, k: () => 1 },
    { id: 'O1', el: 'O', label: 'O', r: () => rO, pos: pO1, k: () => 1 },
    { id: 'O2', el: 'O', label: 'O', q: (t) => (t < tB2 ? -1 : 0), r: () => rO, pos: pO2, k: () => 1 },
    { id: 'O3', el: 'O', label: 'O', q: (t) => (t < tB1 ? -1 : 0), r: () => rO, pos: pO3, k: () => 1 },
    { id: 'H1', el: 'H', label: (t) => `H${sup(hQ(tDis1, tB1)(t))}`, q: hQ(tDis1, tB1), r: () => rH, pos: pH1, k: (t) => seg(t, R.t0, R.t0 + 0.6) },
    { id: 'H2', el: 'H', label: (t) => `H${sup(hQ(tDis2, tB2)(t))}`, q: hQ(tDis2, tB2), r: () => rH, pos: pH2, k: (t) => seg(t, R.t0 + 0.4, R.t0 + 1) },
    { id: 'Cl1', el: 'Cl', label: step(tDis1, 'Cl', 'Cl⁻'), q: step(tDis1, 0, -1), r: (t) => rCl + (rClm - rCl) * seg(t, D.t0 + 2.0, D.t0 + 3.0), pos: cl1, k: (t) => seg(t, R.t0, R.t0 + 0.6) },
    { id: 'Cl2', el: 'Cl', label: step(tDis2, 'Cl', 'Cl⁻'), q: step(tDis2, 0, -1), r: (t) => rCl + (rClm - rCl) * seg(t, D.t0 + 2.6, D.t0 + 3.6), pos: cl2, k: (t) => seg(t, R.t0 + 0.4, R.t0 + 1) },
  ]

  // ── фон: поверхность мрамора (2 Ca²⁺ + 3 CO₃²⁻) и молекулы воды ──
  const slab: { el: 'Ca' | 'CO3'; p: V3 }[] = [
    { el: 'Ca', p: [0.85, SURF_Y, 0] },
    { el: 'CO3', p: [-0.85, SURF_Y, -0.85] },
    { el: 'Ca', p: [0, SURF_Y, -0.85] },
    { el: 'CO3', p: [0.85, SURF_Y, -0.85] },
    { el: 'CO3', p: [1.7, SURF_Y, 0] },
  ]
  const bonds: Bond[] = []
  slab.forEach((s, i) => {
    if (s.el === 'Ca') {
      particles.push({ id: `sCa${i}`, el: 'Ca', label: '', q: () => 2, r: () => rCa, pos: () => s.p, k: () => 1, decor: true })
      return
    }
    particles.push({ id: `sC${i}`, el: 'C', label: '', r: () => rC, pos: () => s.p, k: () => 1, decor: true })
    for (const [j, ang] of [90, 210, 330].entries()) {
      const [ca, sa] = dir2(ang)
      const p = inPlane(s.p, 0, dCO3 * ca, dCO3 * sa)
      particles.push({ id: `sO${i}_${j}`, el: 'O', label: '', q: () => (j === 0 ? 0 : -1), r: () => rO, pos: () => p, k: () => 1, decor: true })
      bonds.push({ a: `sC${i}`, b: `sO${i}_${j}`, n: j === 0 ? 2 : 1, k: () => 1, decor: true })
    }
  })
  const waters: { o: V3; b: number }[] = [
    { o: [-1.3, 0.25, -0.45], b: 20 },
    { o: [0.45, 1.0, -0.55], b: 200 },
    { o: [-0.35, -0.25, -0.7], b: 120 },
    { o: [1.25, -0.2, 0.25], b: 300 },
    { o: [-1.35, 1.0, 0.15], b: 250 },
    { o: [1.55, 0.15, -0.75], b: 300 },
  ]
  waters.forEach((w, i) => {
    const drift = (t: number): V3 => add3(w.o, [0.04 * Math.sin(0.3 * t + i), 0.04 * Math.sin(0.23 * t + 2 * i), 0.03 * Math.sin(0.27 * t + i)])
    const h = (s: -1 | 1): PFn => (t) => {
      const [ca, sa] = dir2(w.b + s * 52.25 + 12 * Math.sin(0.2 * t + i))
      return add3(drift(t), [dOH * ca, dOH * sa, 0.05 * s])
    }
    particles.push({ id: `wO${i}`, el: 'O', label: '', r: () => rO, pos: drift, k: () => 1, decor: true })
    particles.push({ id: `wH${i}a`, el: 'H', label: '', r: () => rH, pos: h(-1), k: () => 1, decor: true })
    particles.push({ id: `wH${i}b`, el: 'H', label: '', r: () => rH, pos: h(1), k: () => 1, decor: true })
    bonds.push({ a: `wO${i}`, b: `wH${i}a`, n: 1, k: () => 1, decor: true })
    bonds.push({ a: `wO${i}`, b: `wH${i}b`, n: 1, k: () => 1, decor: true })
  })

  // ── связи активных частиц ──
  bonds.push({ a: 'H1', b: 'Cl1', n: 1, k: (t) => seg(t, R.t0, R.t0 + 0.6) * (1 - seg(t, D.t0 + 1.4, D.t0 + 2.2)) })
  bonds.push({ a: 'H2', b: 'Cl2', n: 1, k: (t) => seg(t, R.t0 + 0.4, R.t0 + 1) * (1 - seg(t, D.t0 + 2.0, D.t0 + 2.8)) })
  bonds.push({ a: 'C', b: 'O1', n: 2, k: () => 1 })
  bonds.push({ a: 'C', b: 'O2', n: 1, k: (t) => 1 - seg(t, Dc.t0 + 2.4, Dc.t0 + 3.0) })
  bonds.push({ a: 'C', b: 'O2', n: 2, k: (t) => seg(t, Dc.t0 + 2.4, Dc.t0 + 3.4) })
  bonds.push({ a: 'C', b: 'O3', n: 1, k: (t) => 1 - seg(t, Dc.t0 + 0.8, Dc.t0 + 1.8) })
  bonds.push({ a: 'O3', b: 'H1', n: 1, k: (t) => seg(t, P1.t0 + 3.0, P1.t0 + 3.8) })
  bonds.push({ a: 'O2', b: 'H2', n: 1, k: (t) => seg(t, P2.t0 + 3.0, P2.t0 + 3.8) * (1 - seg(t, Dc.t0 + 0.5, Dc.t0 + 1.2)) })
  bonds.push({ a: 'O3', b: 'H2', n: 1, k: (t) => seg(t, Dc.t0 + 1.6, Dc.t0 + 2.2) })

  // ── электроны ──
  const electrons: RouteElectron[] = []
  const pair = (id: string, tone: RouteElectron['tone'], from: PFn, to: PFn, perp: V3, t0: number, m0: number, m1: number, t1: number) => {
    for (const s of [-1, 1] as const) {
      electrons.push({
        id: `${id}${s}`,
        tone,
        k: (t) => seg(t, t0, t0 + 0.4) * (1 - seg(t, t1, t1 + 0.6)),
        pos: (t) => add3(lerp3(from(t), to(t), seg(t, m0, m1)), perp, 0.045 * s),
      })
    }
  }
  const Z: V3 = [0, 0, 0.12]
  // HCl: общая пара уходит к Cl
  for (const [n, h, c, lag] of [[1, h1Free, cl1, 0], [2, h2Free, cl2, 0.6]] as const) {
    const mid: PFn = (t) => add3(lerp3(h(t), c(t), 0.5), Z)
    // пара садится на поверхность Cl⁻ со стороны H (снаружи шара — его видно)
    const onCl: PFn = (t) => {
      const cc = c(t)
      const hh = h(t)
      return add3(add3(cc, norm3([hh[0] - cc[0], hh[1] - cc[1], hh[2] - cc[2]]), 0.34), [0, 0, 0.1])
    }
    pair(`eHCl${n}`, 'cl', mid, onCl, [0, 1, 0], D.t0 + 0.2 + lag, D.t0 + 1.0 + lag, D.t0 + 2.2 + lag, D.t0 + 3.0 + lag)
  }
  // протонирование: неподелённая пара O → связь O–H
  const lone = (o: PFn, s: (t: number) => V3): PFn => (t) => add3(lerp3(o(t), s(t), 0.55), Z)
  const bondMid = (a: PFn, b: PFn): PFn => (t) => add3(lerp3(a(t), b(t), 0.45), Z)
  pair('eP1', 'o', lone(pO3, site3a), bondMid(pO3, pH1), [0.5, 0.5, 0], P1.t0 + 0.8, P1.t0 + 2.6, P1.t0 + 3.4, P1.t0 + 3.6)
  pair('eP2', 'o', lone(pO2, site2), bondMid(pO2, pH2), [0.5, 0, 0], P2.t0 + 0.8, P2.t0 + 2.6, P2.t0 + 3.4, P2.t0 + 3.6)
  // распад: пара C–O3 → к O3 (связь O3–H2); пара O2–H2 → π-связь C=O2
  pair('eD1', 'c', bondMid(pC, pO3), (t) => add3(lerp3(pO3(t), site3b(t), 0.5), Z), [0.5, 0.5, 0], Dc.t0 + 0.2, Dc.t0 + 0.8, Dc.t0 + 1.8, Dc.t0 + 2.2)
  const piC2: PFn = (t) => {
    const m = lerp3(pC(t), pO2(t), 0.5)
    return add3(add3(m, [0, 0, 0.16]), inPlane([0, 0, 0], phi(t), ...(dir2(a2(t) + 90).map((x) => x * 0.08) as [number, number])))
  }
  pair('eD2', 'o', (t) => add3(lerp3(pO2(t), site2(t), 0.45), Z), piC2, [0.5, 0, 0], Dc.t0 + 0.2, Dc.t0 + 1.2, Dc.t0 + 3.0, Dc.t0 + 3.4)

  const cam: CamKey[] = [
    { t: -1, d: 1, yaw: 0.28, pitch: 0.4, zoom: 0.98, focus: [0, 0.02, 0] },
    { t: D.t0, d: 1.8, yaw: 0.18, pitch: 0.26, zoom: 1.12, focus: [0.15, 0.4, 0] },
    { t: P1.t0 + 0.3, d: 2.2, yaw: 0.22, pitch: 0.2, zoom: 1.35, focus: [0.15, -0.15, 0] },
    { t: P2.t0 + 0.3, d: 2.2, yaw: 0.08, pitch: 0.16, zoom: 1.32, focus: [-0.15, -0.15, 0] },
    { t: Dc.t0, d: 1.8, yaw: 0.06, pitch: 0.08, zoom: 1.5, focus: [0.12, -0.25, 0] },
    { t: G.t0 + 0.3, d: 2.6, yaw: 0.2, pitch: 0.16, zoom: 1.15, focus: [0.05, 0.25, 0] },
    { t: F.t0, d: 2.4, yaw: 0.36, pitch: 0.22, zoom: 0.92, focus: [0, 0.08, 0] },
  ]

  return { stages, particles, bonds, electrons, cam, fit: 1.3, decorDim: 0.24 }
}
