/**
 * CaCO₃ →(t°) CaO + CO₂↑ — обжиг известняка (Kimyo 7, с. 107). Модель сцены (4 формульные единицы):
 *  reagents — фрагмент кристалла: слой Ca²⁺ и слой плоских CO₃²⁻ (как в кальците; Ca–O ≈ 232 пм, C–O 129 пм, 120°);
 *  heat — нагрев ≈ 900 °C: тепловые колебания растут, энергия поглощается;
 *  break — в CO₃²⁻ рвётся одна связь C–O: пара электронов уходит к O → ион O²⁻ остаётся с Ca²⁺;
 *          оставшиеся O–C–O раскрываются 120° → 180°, связи 129 → 116 пм, вторая C=O — из неподелённой пары O;
 *  escape — CO₂ улетает газом, разлагаются соседние единицы;
 *  cao — Ca²⁺ и O²⁻ перестраиваются в решётку CaO (тип NaCl, Ca–O 240 пм);
 *  final — итог: CaO (негашёная известь) + CO₂↑. ΔH = +178 кДж/моль; C⁺⁴ → C⁺⁴ — не ОВР.
 */
import {
  BOND_PM,
  ION_PM,
  add3,
  buildStages,
  jiggle,
  lerp3,
  pm,
  rCov,
  rIon,
  rotAxis,
  seg,
  track,
  type Bond,
  type CamKey,
  type Particle,
  type PFn,
  type RouteElectron,
  type RouteModel,
  type V3,
} from '../geom'

export const CO2_CALCINATION_STAGES = [
  { key: 'reagents', dur: 5 },
  { key: 'heat', dur: 5 },
  { key: 'break', dur: 5.5 },
  { key: 'escape', dur: 4.5 },
  { key: 'cao', dur: 5.5 },
  { key: 'final', dur: 5 },
] as const

export const CA_Y = -0.35
export const CO3_Y = 0.2
/** Центр фрагмента CaO 2×2×2 и половина его ребра: ребро = Ca–O = 240 пм (= a/2 решётки, a = 481 пм). */
export const CAO_C: V3 = [0, -0.3, 0]
export const CAO_H = pm(BOND_PM.CaO) / 2
const UP: V3 = [0, 1, 0]
const xz = (deg: number, L: number): V3 => [L * Math.cos((deg * Math.PI) / 180), 0, L * Math.sin((deg * Math.PI) / 180)]

/** Колонки (sx, sz): единица 0 — передняя левая (крупный план разрыва). */
export const UNITS: { sx: -1 | 1; sz: -1 | 1 }[] = [
  { sx: -1, sz: 1 },
  { sx: 1, sz: 1 },
  { sx: 1, sz: -1 },
  { sx: -1, sz: -1 },
]
/** Узлы куба CaO колонки (sx, sz): чётность (sx+sy+sz) — Ca, нечётность — O. */
export function caoSites(sx: -1 | 1, sz: -1 | 1): { ca: V3; o: V3 } {
  const lo: V3 = [CAO_C[0] + sx * CAO_H, CAO_C[1] - CAO_H, CAO_C[2] + sz * CAO_H]
  const hi: V3 = [lo[0], CAO_C[1] + CAO_H, lo[2]]
  // индексы 0/1: (sx+1)/2 + 0 + (sz+1)/2 чётно → Ca внизу
  const even = (((sx + 1) / 2 + (sz + 1) / 2) & 1) === 0
  return even ? { ca: lo, o: hi } : { ca: hi, o: lo }
}

export function co2CalcinationModel(): RouteModel {
  const stages = buildStages(CO2_CALCINATION_STAGES)
  const R = stages.W('reagents')
  const H = stages.W('heat')
  const B = stages.W('break')
  const E = stages.W('escape')
  const C = stages.W('cao')
  const F = stages.W('final')

  const rC = rCov('C')
  const rO = rCov('O')
  const rO2m = rIon(ION_PM.O2)
  const rCa = rIon(ION_PM.Ca2)
  const dCO3 = pm(BOND_PM.CO_carbonate)
  const dCO2 = pm(BOND_PM.CO_co2)
  const amp = (t: number) => pm(4) + pm(10) * seg(t, H.t0, H.t0 + 3) - pm(9) * seg(t, C.t0, C.t1)

  const particles: Particle[] = []
  const bonds: Bond[] = []
  const electrons: RouteElectron[] = []

  UNITS.forEach((u, k) => {
    const main = k === 0
    const c0: V3 = [u.sx * 0.5, CO3_Y, u.sz * 0.5]
    const ca0: V3 = [u.sx * 0.5, CA_Y, u.sz * 0.5]
    const sites = caoSites(u.sx, u.sz)
    // время разрыва и масштаб: единица 0 — подробно, остальные — быстрее, по очереди
    const b = main ? B.t0 + 0.6 : E.t0 + 0.2 + 0.5 * (k - 1)
    const s = main ? 1 : 0.6
    const at = (tau: number) => b + tau * s
    const appear = (t: number) => seg(t, R.t0 + 0.15 * k, R.t0 + 0.15 * k + 0.7)
    const sh = (t: number, seed: number, fade = 1): V3 => jiggle(seed + 10 * k, t, amp(t) * fade)

    // CO₂: центр (подъём), раскрытие угла, длины
    const lift = main
      ? track([
          { t: E.t0, p: c0 },
          { t: E.t0 + 3, p: [-0.3, 0.95, 0.35] },
        ])
      : track([
          { t: at(2.4), p: c0 },
          { t: at(5.5), p: [c0[0] + u.sx * 0.9, 2.1, c0[2] + u.sz * 0.3] },
        ])
    const away = (t: number) => seg(t, main ? E.t0 : at(2.4), main ? E.t0 + 3 : at(5.5))
    const open = (t: number) => seg(t, at(1.0), at(2.6))
    const L = (t: number) => dCO3 + (dCO2 - dCO3) * open(t)
    const spin = (t: number) => (main ? 0.9 * seg(t, E.t0, F.t1) : 1.4 * away(t))
    const gone = (t: number) => (main ? 1 : 1 - seg(t, at(4.0), at(5.5)))
    const off = (deg: number) => (t: number) => rotAxis(xz(deg, L(t)), UP, spin(t))
    const pC: PFn = (t) => add3(lift(t), sh(t, 1, 1 - away(t)))
    // треугольник CO₃²⁻: уходящий O смотрит наружу (вперёд у передних, назад у задних), два других — через 120°;
    // при разрыве они расходятся на 180° (ось CO₂ — по x)
    const thF = 90 * u.sz
    const pOa: PFn = (t) => add3(add3(lift(t), off(thF + 120 - 30 * open(t))(t)), sh(t, 2, 1 - away(t)))
    const pOb: PFn = (t) => add3(add3(lift(t), off(thF + 240 + 30 * open(t))(t)), sh(t, 3, 1 - away(t)))
    // O, который станет O²⁻: от CO₃ вниз к Ca²⁺, затем — узел решётки CaO
    const mid: V3 = [c0[0], -0.08, c0[2] + 0.36 * u.sz]
    const fStart: V3 = add3(c0, xz(thF, dCO3))
    // в колонке, где O²⁻ уходит вниз, а Ca²⁺ вверх, O²⁻ сначала опускается снаружи (дальше от центра по z),
    // потом заходит в узел — пути ионов не пересекаются
    const oLow = sites.o[1] < CAO_C[1]
    const toSite = oLow
      ? track([
          { t: C.t0 + 0.3, p: mid },
          { t: C.t0 + 2.0, p: [sites.o[0], sites.o[1], u.sz * 0.98] },
          { t: C.t0 + 3.5, p: sites.o },
        ])
      : track([
          { t: C.t0 + 0.5, p: mid },
          { t: C.t0 + 3.2, p: sites.o },
        ])
    const pOf: PFn = (t) => {
      const p0 = t < C.t0 ? lerp3(fStart, mid, seg(t, at(1.0), at(2.6))) : toSite(t)
      return add3(p0, sh(t, 4))
    }
    const pCa: PFn = (t) => add3(lerp3(ca0, sites.ca, seg(t, C.t0 + 0.3, C.t0 + 2.4)), sh(t, 5))
    const tq = at(1.5)
    const lab = (s0: string, s1: string) => (t: number) => (main ? (t < tq ? s0 : s1) : '')

    particles.push({ id: `Ca${k}`, el: 'Ca', label: main ? 'Ca²⁺' : '', q: () => 2, r: () => rCa, pos: pCa, k: appear })
    particles.push({ id: `C${k}`, el: 'C', label: main ? 'C' : '', r: () => rC, pos: pC, k: (t) => appear(t) * gone(t) })
    particles.push({ id: `Oa${k}`, el: 'O', label: main ? 'O' : '', r: () => rO, pos: pOa, k: (t) => appear(t) * gone(t) })
    particles.push({ id: `Ob${k}`, el: 'O', label: main ? 'O' : '', q: (t) => (t < tq ? -1 : 0), r: () => rO, pos: pOb, k: (t) => appear(t) * gone(t) })
    particles.push({
      id: `Of${k}`,
      el: 'O',
      label: lab('O', 'O²⁻'),
      q: (t) => (t < tq ? -1 : -2),
      r: (t) => rO + (rO2m - rO) * seg(t, at(1.2), at(2.2)),
      pos: pOf,
      k: appear,
    })
    bonds.push({ a: `C${k}`, b: `Oa${k}`, n: 2, k: (t) => appear(t) * gone(t) })
    bonds.push({ a: `C${k}`, b: `Ob${k}`, n: 1, k: (t) => appear(t) * (1 - seg(t, at(1.6), at(2.2))) })
    bonds.push({ a: `C${k}`, b: `Ob${k}`, n: 2, k: (t) => seg(t, at(1.6), at(2.6)) * gone(t) })
    bonds.push({ a: `C${k}`, b: `Of${k}`, n: 1, k: (t) => appear(t) * (1 - seg(t, at(0.8), at(1.6))) })

    if (main) {
      const pair = (id: string, tone: RouteElectron['tone'], from: PFn, to: PFn, t0: number, m0: number, m1: number, t1: number) => {
        for (const sg of [-1, 1] as const)
          electrons.push({
            id: `${id}${sg}`,
            tone,
            k: (t) => seg(t, t0, t0 + 0.4) * (1 - seg(t, t1, t1 + 0.6)),
            pos: (t) => add3(lerp3(from(t), to(t), seg(t, m0, m1)), [0.04 * sg, 0.03 * sg, 0]),
          })
      }
      // пара связи C–O уходит к O (O²⁻)
      pair('eBreak', 'c', (t) => add3(lerp3(pC(t), pOf(t), 0.5), [0, 0.12, 0]), (t) => add3(pOf(t), [0, 0.1 + rO2m * seg(t, at(1.2), at(2.2)), 0.08]), at(0.1), at(0.3), at(1.5), at(2.6))
      // неподелённая пара O(b) становится π-связью C=O
      pair('ePi', 'o', (t) => add3(pOb(t), [0, 0.16, 0.06]), (t) => add3(lerp3(pC(t), pOb(t), 0.5), [0, 0.15, 0.06]), at(0.6), at(1.4), at(2.6), at(3.0))
      // в CO₃²⁻: подписи зарядов через тексты сцены
    }
  })

  const cam: CamKey[] = [
    { t: -1, d: 1, yaw: 0.45, pitch: 0.42, zoom: 1, focus: [0, -0.05, 0] },
    { t: R.t0 + 2.4, d: 2.6, yaw: 0.2, pitch: 0.5, zoom: 1.05, focus: [0, 0, 0] },
    { t: H.t0, d: 2, yaw: 0.32, pitch: 0.3, zoom: 1.0, focus: [0, -0.05, 0] },
    { t: B.t0 + 0.2, d: 1.8, yaw: -0.8, pitch: 0.32, zoom: 1.45, focus: [-0.5, 0.05, 0.6] },
    { t: E.t0 + 0.2, d: 2.4, yaw: 0.3, pitch: 0.3, zoom: 0.95, focus: [-0.1, 0.35, 0.1] },
    { t: C.t0 + 0.2, d: 2.4, yaw: 0.55, pitch: 0.32, zoom: 1.2, focus: [0, -0.25, 0] },
    { t: F.t0, d: 2.4, yaw: 0.3, pitch: 0.2, zoom: 1.0, focus: [-0.1, 0.25, 0.1] },
  ]

  return { stages, particles, bonds, electrons, cam, fit: 1.15 }
}
