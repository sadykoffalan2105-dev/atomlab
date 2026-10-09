/**
 * C + O₂ → CO₂ — горение угля (Kimyo 7, § 4.5, с. 95). Модель сцены (чистые функции t):
 *  reagents — слой графита (уголь, C–C 142 пм), к краю летит O₂ (O=O 121 пм, σ + π);
 *  ignite — поджиг: колебания слоя растут, связь O=O рвётся (энергия активации);
 *  attack — атомы O садятся на крайний атом C, он отрывается от слоя (рвутся C–C);
 *  transfer — электронная плотность C смещается к O (O электроотрицательнее): C⁰ → C⁺⁴, O⁰ → O⁻² (ОВР, 4e⁻);
 *  bonds — две двойные связи C=O (σ + π), 116 пм, 180°; выделяется энергия;
 *  release — CO₂ уходит газом, горят соседние атомы края; ΔH = −393,5 кДж/моль;
 *  final — молекула O=C=O крупно.
 */
import {
  BOND_PM,
  add3,
  buildStages,
  jiggle,
  lerp3,
  pm,
  rCov,
  rotAxis,
  seg,
  sub3,
  track,
  type Bond,
  type CamKey,
  type Particle,
  type PFn,
  type RouteElectron,
  type RouteModel,
  type V3,
} from '../geom'

export const CO2_COMBUSTION_STAGES = [
  { key: 'reagents', dur: 5 },
  { key: 'ignite', dur: 4.5 },
  { key: 'attack', dur: 4.5 },
  { key: 'transfer', dur: 5.5 },
  { key: 'bonds', dur: 4.5 },
  { key: 'release', dur: 5 },
  { key: 'final', dur: 5.5 },
] as const

/** Высота слоя графита. */
export const SHEET_Y = -0.42
const UP: V3 = [0, 1, 0]

/** Узлы слоя графита (зигзаг-край спереди), активный атом края — в (0, SHEET_Y, 0). */
export function graphiteSheet(): { atoms: V3[]; bonds: [number, number][]; active: number; edge: number[] } {
  const d = pm(BOND_PM.CC_graphite)
  const s3 = Math.sqrt(3) * d
  const centers: V3[] = []
  for (const j of [-2, -1, 0]) {
    for (let i = -3; i <= 3; i++) {
      const x = s3 * (i + j / 2)
      if (Math.abs(x) > 1.1) continue
      centers.push([x, 0, 1.5 * d * j])
    }
  }
  const atoms: V3[] = []
  const key = (p: V3) => `${Math.round(p[0] * 1000)},${Math.round(p[2] * 1000)}`
  const seen = new Set<string>()
  for (const c of centers) {
    for (let k = 0; k < 6; k++) {
      const th = ((30 + 60 * k) * Math.PI) / 180
      const p: V3 = [c[0] + d * Math.cos(th), SHEET_Y, c[2] + d * Math.sin(th) - d]
      const kk = key(p)
      if (seen.has(kk)) continue
      seen.add(kk)
      atoms.push(p)
    }
  }
  const bonds: [number, number][] = []
  for (let a = 0; a < atoms.length; a++)
    for (let b = a + 1; b < atoms.length; b++) {
      const q = sub3(atoms[a]!, atoms[b]!)
      if (Math.abs(Math.hypot(q[0], q[1], q[2]) - d) < 0.01) bonds.push([a, b])
    }
  let active = 0
  let best = Infinity
  for (let i = 0; i < atoms.length; i++) {
    const p = atoms[i]!
    const s = Math.hypot(p[0], p[2])
    if (s < best) {
      best = s
      active = i
    }
  }
  // атомы края (z = 0, «вершины» зигзага) — горят следом за активным; ближние к центру — первыми
  const edge = atoms
    .map((p, i) => [p, i] as const)
    .filter(([p, i]) => i !== active && Math.abs(p[2]) < 0.01)
    .sort((a, b) => Math.abs(a[0][0]) - Math.abs(b[0][0]))
    .map(([, i]) => i)
  return { atoms, bonds, active, edge }
}

/** Сколько соседних атомов края сгорает следом (фон). */
const BURN = 2

export function co2CombustionModel(): RouteModel {
  const stages = buildStages(CO2_COMBUSTION_STAGES)
  const R = stages.W('reagents')
  const I = stages.W('ignite')
  const A = stages.W('attack')
  const T = stages.W('transfer')
  const Bo = stages.W('bonds')
  const Re = stages.W('release')
  const F = stages.W('final')

  const dCO = pm(BOND_PM.CO_co2) // 0,331
  const hOO = pm(BOND_PM.OO) / 2
  const rC = rCov('C')
  const rO = rCov('O')
  const sheet = graphiteSheet()

  // ── центр молекулы: отрыв от слоя, затем подъём газом; поворот вокруг вертикали ──
  const molC = track([
    { t: A.t0 + 0.8, p: [0, SHEET_Y, 0] },
    { t: A.t0 + 3.0, p: [0, 0.3, 0] },
    { t: Re.t0 + 0.3, p: [0, 0.3, 0] },
    { t: Re.t0 + 3.6, p: [0, 0.78, 0] },
  ])
  const spin = (t: number) => 1.1 * seg(t, Re.t0 + 0.6, F.t0 + 1.5)
  // активный C: колебания при поджиге (до 10 пм), затем — центр молекулы
  const cPos: PFn = (t) => add3(molC(t), jiggle(1, t, pm(10) * seg(t, I.t0, I.t0 + 2) * (1 - seg(t, A.t0 + 0.6, A.t0 + 1.4))))
  // полу-расстояние C…O: до связи 0,46, на связи — 116 пм
  const halfX = (t: number) => 0.46 + (dCO - 0.46) * seg(t, Bo.t0 + 0.2, Bo.t0 + 1.6)
  // O₂ подлетает (ось поворачивается к горизонтали), рвётся; атомы O садятся по оси x вокруг C
  const o2c = track([
    { t: R.t0, p: [-1.05, 0.62, -0.25] },
    { t: R.t0 + 4.2, p: [0, 0.35, 0] },
  ])
  const o2tilt = (t: number) => ((35 * Math.PI) / 180) * (1 - seg(t, R.t0 + 1, R.t0 + 4.2))
  const oSep = (t: number) => hOO + (0.42 - hOO) * seg(t, I.t0 + 2.6, I.t0 + 4.2)
  const oPos = (sign: -1 | 1): PFn => (t) => {
    if (t < A.t0) {
      const a = o2tilt(t)
      return add3(o2c(t), [Math.cos(a), Math.sin(a), 0], sign * oSep(t))
    }
    if (t < A.t1) {
      const free: V3 = [sign * 0.42, 0.35, 0]
      return lerp3(free, add3(molC(t), [sign * 0.46, 0, 0]), seg(t, A.t0 + 0.4, A.t0 + 3.2))
    }
    return add3(molC(t), rotAxis([sign * halfX(t), 0, 0], UP, spin(t)))
  }

  const burnAt = (n: number) => Re.t0 + 0.8 + n * 0.9
  const particles: Particle[] = []
  sheet.atoms.forEach((p, i) => {
    if (i === sheet.active) return
    const ei = sheet.edge.indexOf(i)
    const tb = ei >= 0 && ei < BURN ? burnAt(ei) : 1e6
    particles.push({
      id: `g${i}`,
      el: 'C',
      label: '',
      r: () => rC,
      pos: (t) => add3(p, jiggle(i + 3, t, pm(6) * seg(t, I.t0, I.t0 + 2) * (1 - seg(t, Re.t1, F.t0 + 1)))),
      k: (t) => 1 - seg(t, tb, tb + 0.5),
      decor: true,
    })
  })
  particles.push({ id: 'C', el: 'C', label: 'C', r: () => rC, pos: cPos, k: () => 1 })
  particles.push({ id: 'Oa', el: 'O', label: 'O', r: () => rO, pos: oPos(-1), k: (t) => seg(t, R.t0, R.t0 + 0.6) })
  particles.push({ id: 'Ob', el: 'O', label: 'O', r: () => rO, pos: oPos(1), k: (t) => seg(t, R.t0, R.t0 + 0.6) })

  // фоновые CO₂ от сгоревших соседей края: рождаются на месте атома и поднимаются
  sheet.edge.slice(0, BURN).forEach((gi, n) => {
    const base = sheet.atoms[gi]!
    const t0 = burnAt(n)
    const c = track([
      { t: t0, p: add3(base, [0, 0.28, 0]) },
      { t: t0 + 3.4, p: add3(base, [0.2 * Math.sign(base[0] || 1), 0.95, -0.3]) },
    ])
    const kk = (t: number) => seg(t, t0 + 0.35, t0 + 0.85) * (1 - seg(t, F.t0 + 0.4, F.t0 + 1.4))
    const ax = (t: number): V3 => rotAxis([1, 0, 0], UP, 0.8 + 0.9 * n + 0.6 * (t - t0))
    particles.push({ id: `bc${n}`, el: 'C', label: '', r: () => rC, pos: c, k: kk, decor: true })
    particles.push({ id: `bo${n}a`, el: 'O', label: '', r: () => rO, pos: (t) => add3(c(t), ax(t), -dCO), k: kk, decor: true })
    particles.push({ id: `bo${n}b`, el: 'O', label: '', r: () => rO, pos: (t) => add3(c(t), ax(t), dCO), k: kk, decor: true })
  })

  const bonds: Bond[] = []
  for (const [a, b] of sheet.bonds) {
    const ida = a === sheet.active ? 'C' : `g${a}`
    const idb = b === sheet.active ? 'C' : `g${b}`
    if (a === sheet.active || b === sheet.active) {
      bonds.push({ a: ida, b: idb, n: 1, k: (t) => 1 - seg(t, A.t0 + 0.6, A.t0 + 1.6), decor: true })
      continue
    }
    const e = [sheet.edge.indexOf(a), sheet.edge.indexOf(b)].filter((x) => x >= 0 && x < BURN)
    const tb = e.length ? burnAt(Math.min(...e)) : 1e6
    bonds.push({ a: ida, b: idb, n: 1, k: (t) => 1 - seg(t, tb - 0.3, tb + 0.4), decor: true })
  }
  // O=O до разрыва; затем две C=O (σ + π) по очереди
  bonds.push({ a: 'Oa', b: 'Ob', n: 2, k: (t) => seg(t, R.t0, R.t0 + 0.6) * (1 - seg(t, I.t0 + 2.4, I.t0 + 3.0)) })
  bonds.push({ a: 'C', b: 'Oa', n: 2, k: (t) => seg(t, Bo.t0 + 0.8, Bo.t0 + 1.8) })
  bonds.push({ a: 'C', b: 'Ob', n: 2, k: (t) => seg(t, Bo.t0 + 1.4, Bo.t0 + 2.4) })
  for (let n = 0; n < BURN; n++) {
    bonds.push({ a: `bc${n}`, b: `bo${n}a`, n: 2, k: () => 1, decor: true })
    bonds.push({ a: `bc${n}`, b: `bo${n}b`, n: 2, k: () => 1, decor: true })
  }

  // ── электроны: 4 валентных у C и по 2 неспаренных у каждого O → 4 общие пары (2 σ + 2 π), смещены к O ──
  const electrons: RouteElectron[] = []
  const eIn = (t: number) => seg(t, T.t0, T.t0 + 0.5)
  const eOut = (t: number) => 1 - seg(t, Bo.t0 + 1.8, Bo.t0 + 2.8)
  const pO = { a: oPos(-1), b: oPos(1) }
  // Ровная раскладка: σ-пара — на оси связи (электрон C ближе к C, электрон O ближе к O; центр пары смещён к O),
  // π-пара — над осью у C=Oa и под осью у C=Ob (вторая π — в перпендикулярной плоскости, наклонена к зрителю).
  const slot = (side: 'a' | 'b', kind: 's' | 'p', who: 'c' | 'o'): PFn => (t) => {
    const base = lerp3(cPos(t), pO[side](t), who === 'c' ? 0.5 : 0.75)
    const off: V3 = kind === 's' ? [0, 0, 0.09] : side === 'a' ? [0, 0.15, 0.05] : [0, -0.11, 0.11]
    return add3(base, rotAxis(off, UP, spin(t)))
  }
  // до смещения: электроны на окружности вокруг своего атома (в плоскости экрана, чуть к зрителю)
  const ring = (center: PFn, R: number, deg: number): PFn => (t) => {
    const a = (deg * Math.PI) / 180
    return add3(center(t), [R * Math.cos(a), R * Math.sin(a), 0.06])
  }
  const HOME: Record<'a' | 'b', { c: Record<'s' | 'p', number>; o: Record<'s' | 'p', number> }> = {
    a: { c: { s: 180, p: 135 }, o: { s: 0, p: 45 } },
    b: { c: { s: 0, p: -45 }, o: { s: 180, p: 225 } },
  }
  const moveWin = { a: [T.t0 + 1.2, T.t0 + 3.0], b: [T.t0 + 1.8, T.t0 + 3.6] } as const
  for (const side of ['a', 'b'] as const) {
    for (const kind of ['s', 'p'] as const) {
      const [m0, m1] = moveWin[side]
      const hC = ring(cPos, rC + 0.065, HOME[side].c[kind])
      const hO = ring(pO[side], rO + 0.06, HOME[side].o[kind])
      const sC = slot(side, kind, 'c')
      const sO = slot(side, kind, 'o')
      electrons.push({ id: `eC${side}${kind}`, tone: 'c', k: (t) => eIn(t) * eOut(t), pos: (t) => lerp3(hC(t), sC(t), seg(t, m0, m1)) })
      electrons.push({ id: `eO${side}${kind}`, tone: 'o', k: (t) => eIn(t) * eOut(t), pos: (t) => lerp3(hO(t), sO(t), seg(t, m0 + 0.15, m1)) })
    }
  }

  const cam: CamKey[] = [
    { t: -1, d: 1, yaw: 0.3, pitch: 0.46, zoom: 1, focus: [0, -0.05, 0] },
    { t: R.t0 + 2.2, d: 2.4, yaw: 0.12, pitch: 0.4, zoom: 1.08, focus: [-0.1, 0, 0] },
    { t: I.t0, d: 2, yaw: 0.22, pitch: 0.36, zoom: 1.25, focus: [0, 0.05, 0] },
    { t: A.t0 + 0.6, d: 2.4, yaw: 0.34, pitch: 0.3, zoom: 1.3, focus: [0, -0.1, 0] },
    { t: A.t0 + 2.6, d: 1.6, yaw: 0.26, pitch: 0.1, zoom: 1.45, focus: [0, 0.22, 0] },
    { t: T.t0, d: 1.6, yaw: 0.16, pitch: 0.02, zoom: 1.75, focus: [0, 0.3, 0] },
    { t: Bo.t0 + 2.2, d: 2, yaw: 0.36, pitch: 0.06, zoom: 1.7, focus: [0, 0.3, 0] },
    { t: Re.t0 + 0.2, d: 2.6, yaw: 0.3, pitch: 0.3, zoom: 1.0, focus: [0, 0.32, 0] },
    { t: F.t0, d: 2.2, yaw: 0.22, pitch: 0.1, zoom: 1.85, focus: [0, 0.78, 0] },
    { t: F.t0 + 2.6, d: 3, yaw: 0.62, pitch: 0.16, zoom: 1.85, focus: [0, 0.78, 0] },
  ]

  return { stages, particles, bonds, electrons, cam, fit: 1.15 }
}
