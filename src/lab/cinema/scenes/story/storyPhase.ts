/**
 * «ИТОГ КАК В ЖИЗНИ» для сюжета реакции (чистый TS, без three): фаза каждого продукта при 25 °C и окружение
 * частиц в кадре итога — то же правило, что у «Как образуется» v2 (components/lab/formation/story/phase-data.ts).
 *
 * Фаза продукта:
 *  • газ ↑ (fate 'gas') — копии молекулы вокруг расходятся и поднимаются (плавно, без колебаний);
 *  • осадок ↓ и выделившийся металл — кристалл: фрагмент решётки своего структурного типа позади продукта
 *    (генераторы story/lattice.ts через formationStoryFor; у кристаллических моделей карточки — сама модель);
 *  • вода и жидкости (H₂O, H₂SO₄, Br₂ …) — плотная укладка молекул вокруг (ближний порядок);
 *  • растворимая соль / кислота / щёлочь в водной реакции — ионы среди молекул воды;
 *  • остальное — по таблице фаз (ионный / молекулярный кристалл, полимер, каркас, газ, жидкость, раствор);
 *    вещества вне 200 — по классу: ионное → решётка (схема), металл → металлическая решётка, молекула-газ → газ.
 * Атомы сюжета не трогаем (они сохраняются в каждом кадре): окружение — отдельные частицы, появляются слоями от
 * продукта в шаге «Итог» и не перекрывают ни один атом сюжета.
 */
import { formationStoryFor, modelToScreen } from '../../../../components/lab/formation/formationStory'
import { buildSchoolHeroModel, type SchoolHeroModel } from '../../../../components/lab/hero/schoolHeroModel'
import { compoundById } from '../../../../data/compounds'
import type { ReactionStory } from '../../../../chemistry/reactionStory'
import { storyBallRadius, storyIonRadius, type StoryLayout } from './storyLayout'
import { METAL_LATTICE, storyProductPhases, type StoryProductInfo } from './storyPhaseInfo'

export { storyPhaseLines, storyProductPhases, type StoryProductInfo, type StoryProductPhase } from './storyPhaseInfo'

export type StoryEnvParticle = {
  readonly el: string
  /** положение в итоге (система сцены) */
  readonly x: number
  readonly y: number
  readonly z: number
  readonly r: number
  /** время появления (с) и порядок роста 0…1 */
  readonly t0: number
  /** дрейф газа: скорость (ед/с) — плавный разгон и остановка, без колебаний */
  readonly vx: number
  readonly vy: number
  readonly vz: number
  readonly term: number
}

export type StoryEnvBond = { readonly a: number; readonly b: number }

export type StoryEnv = {
  readonly particles: readonly StoryEnvParticle[]
  /** палочки внутри молекул окружения (вода, копии молекул газа/жидкости) */
  readonly bonds: readonly StoryEnvBond[]
  readonly products: readonly StoryProductInfo[]
  /** окно дрейфа газа: [from, to] */
  readonly driftFrom: number
  readonly driftTo: number
  /** габарит окружения в плоскости кадра (для кадра итога); null — окружения нет */
  readonly box: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number } | null
}

// ─── геометрия окружения ───

type BlockAtom = { el: string; x: number; y: number; z: number; r: number; k: number; u: number; charge: number }

const modelCache = new Map<string, SchoolHeroModel | null>()
function heroModel(id: string): SchoolHeroModel | null {
  if (!modelCache.has(id)) {
    const c = compoundById[id]
    let m: SchoolHeroModel | null = null
    try {
      m = c ? buildSchoolHeroModel(c) : null
    } catch {
      m = null
    }
    modelCache.set(id, m)
  }
  return modelCache.get(id)!
}

const storyR = (el: string, q: number) => (q ? storyIonRadius(el, q) : storyBallRadius(el))

/** Блок кристалла по карточке «Как образуется»: модель + фрагмент решётки, повёрнут как в карточке, мир модели → экран. */
function crystalBlock(id: string): BlockAtom[] | null {
  let fs: ReturnType<typeof formationStoryFor> = null
  try {
    fs = formationStoryFor(id)
  } catch {
    fs = null
  }
  const model = heroModel(id)
  if (!model) return null
  const out: BlockAtom[] = []
  // центральная формульная единица (модель): частица u = −1 (атомы молекулы — одна частица)
  model.atoms.forEach((a, i) => {
    const s = modelToScreen(model, a.pos)
    out.push({ el: a.el, x: s[0], y: s[1], z: s[2], r: a.r, k: 0, u: model.kind === 'crystal' ? -2 - i : -1, charge: a.charge })
  })
  if (fs && model.kind !== 'crystal') {
    for (const a of fs.latticeAtoms) {
      const s = modelToScreen(model, a.pos)
      out.push({ el: a.el, x: s[0], y: s[1], z: s[2], r: a.r, k: a.k, u: a.u ?? 1000 + out.length, charge: a.charge })
    }
  }
  return out.length ? out : null
}

/** Металлическая решётка: два плотноупакованных слоя (ГЦК/ГПУ) или квадратные слои ОЦК, центр — (0, 0, 0). */
function metalBlock(el: string): BlockAtom[] {
  const r = storyBallRadius(el)
  const d = 2 * r
  const out: BlockAtom[] = []
  const kind = METAL_LATTICE[el] ?? 'fcc'
  for (let layer = 0; layer < 2; layer++) {
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        let x: number
        let y: number
        if (kind === 'bcc') {
          x = (i + layer * 0.5) * d * 1.155
          y = (j + layer * 0.5) * d * 1.155
        } else {
          x = (i + j * 0.5 + layer * 0.5) * d
          y = (j * Math.sqrt(3)) / 2 * d + (layer * d) / (2 * Math.sqrt(3))
        }
        const z = -layer * d * (kind === 'bcc' ? 0.577 : 0.816)
        const rr = Math.hypot(x, y)
        out.push({ el, x, y, z, r, k: Math.min(1, rr / (4 * d)), u: out.length, charge: 0 })
      }
    }
  }
  return out
}

/** Атомный каркас простого вещества (C — графит, Si — алмазоподобный): гофрированная сотовая сетка, два слоя. */
function networkBlock(el: string): BlockAtom[] {
  const out: BlockAtom[] = []
  const L = 1
  const buckle = el === 'C' ? 0 : 0.33
  for (let layer = 0; layer < 2; layer++) {
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const x0 = (i + j * 0.5) * L * Math.sqrt(3) + layer * L * 0.866
        const y0 = j * L * 1.5
        for (const [dx, dy, dz] of [[0, 0, buckle], [0, L, -buckle]] as const) {
          const x = x0 + dx
          const y = y0 + dy
          out.push({ el, x, y, z: dz - layer * L * 1.6, r: 0.5, k: Math.min(1, Math.hypot(x, y) / 5), u: out.length, charge: 0 })
        }
      }
    }
  }
  return out
}

/** Вода: O и два H (∠104,5°), палочки — по правилу сюжета (сумма радиусов × 1,32). */
function waterAt(cx: number, cy: number, cz: number, ang: number): { el: string; x: number; y: number; z: number; r: number }[] {
  const rO = storyBallRadius('O')
  const rH = storyBallRadius('H')
  const L = (rO + rH) * 1.32
  const h = (104.5 / 2) * (Math.PI / 180)
  const pts: { el: string; x: number; y: number; z: number; r: number }[] = [{ el: 'O', x: cx, y: cy, z: cz, r: rO }]
  for (const s of [-1, 1]) {
    const a = ang + s * h
    pts.push({ el: 'H', x: cx + Math.sin(a) * L, y: cy - Math.cos(a) * L, z: cz + s * 0.06, r: rH })
  }
  return pts
}

type Cluster = { term: number; atoms: number[]; cx: number; cy: number; rho: number; zFront: number; zBack: number }

/** Окружение итога по раскладке сюжета: частицы, палочки, подписи фаз. */
export function buildStoryEnv(story: ReactionStory, lay: StoryLayout, opts: { lowPower?: boolean } = {}): StoryEnv {
  const products = storyProductPhases(story)
  const res = lay.steps.find((s) => s.id === 'result') ?? lay.steps[lay.steps.length - 1]!
  const tRes = res.from
  const parts: StoryEnvParticle[] = []
  const bonds: StoryEnvBond[] = []
  const P = lay.p4
  const n = lay.n
  const rAt = (i: number) => lay.radiusR[i]!
  const capTotal = opts.lowPower ? 60 : 150
  // атомы сюжета в итоге — препятствия (окружение не перекрывает ни один)
  const blocked = (x: number, y: number, z: number, r: number) => {
    for (let i = 0; i < n; i++) {
      if (lay.layerR[i]) continue
      const d = Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z)
      if (d < (rAt(i) + r) * 1.02) return true
    }
    for (const q of parts) if (Math.hypot(q.x - x, q.y - y, q.z - z) < (q.r + r) * 0.98) return true
    return false
  }
  // кластеры продуктов (лицевые копии)
  const clusters = new Map<number, Cluster>()
  for (const tl of lay.termLabels) {
    if (tl.side !== 'right') continue
    const atoms = tl.atoms.filter((i) => !lay.layerR[i])
    if (!atoms.length) continue
    let cx = 0
    let cy = 0
    for (const i of atoms) {
      cx += P[i * 3]! / atoms.length
      cy += P[i * 3 + 1]! / atoms.length
    }
    let rho = 0
    let zF = Infinity
    let zB = -Infinity
    for (const i of atoms) {
      rho = Math.max(rho, Math.hypot(P[i * 3]! - cx, P[i * 3 + 1]! - cy) + rAt(i))
      zF = Math.min(zF, P[i * 3 + 2]! - rAt(i))
      zB = Math.max(zB, P[i * 3 + 2]! + rAt(i))
    }
    const term = story.terms.find((t) => t.side === 'right' && `${t.coeff > 1 ? t.coeff : ''}${t.formula}` === tl.text.replace(/ [↑↓]$/, ''))
    clusters.set(term ? term.index : -1 - clusters.size, { term: term ? term.index : -1, atoms, cx, cy, rho, zFront: zF, zBack: zB })
  }
  const push = (p: Omit<StoryEnvParticle, 'term'>, term: number) => {
    if (parts.length >= capTotal) return -1
    parts.push({ ...p, term })
    return parts.length - 1
  }
  // копия молекулы продукта (лицевая единица): атомы и палочки относительно центра
  const unitCopy = (c: Cluster) => {
    const unitOf = (i: number) => story.right.atoms[story.map[i]!]!.unit
    const u0 = unitOf(c.atoms[0]!)
    const atoms = c.atoms.filter((i) => unitOf(i) === u0)
    let mx = 0
    let my = 0
    let mz = 0
    for (const i of atoms) {
      mx += P[i * 3]! / atoms.length
      my += P[i * 3 + 1]! / atoms.length
      mz += P[i * 3 + 2]! / atoms.length
    }
    const rel = atoms.map((i) => ({ el: lay.el[i]!, x: P[i * 3]! - mx, y: P[i * 3 + 1]! - my, z: P[i * 3 + 2]! - mz, r: rAt(i), i }))
    const set = new Set(atoms.map((i) => story.map[i]!))
    const bl = story.right.bonds.filter((b) => set.has(b.a) && set.has(b.b))
    const inv = new Map(atoms.map((i, k) => [story.map[i]!, k]))
    let ext = 0
    for (const a of rel) ext = Math.max(ext, Math.hypot(a.x, a.y, a.z) + a.r)
    return { rel, bonds: bl.map((b) => [inv.get(b.a)!, inv.get(b.b)!] as const), ext }
  }
  const placeCopy = (c: Cluster, copy: ReturnType<typeof unitCopy>, x: number, y: number, z: number, ang: number, t0: number, v: [number, number, number]) => {
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const pts = copy.rel.map((a) => ({ el: a.el, x: x + a.x * ca - a.y * sa, y: y + a.x * sa + a.y * ca, z: z + a.z, r: a.r }))
    if (pts.some((p) => blocked(p.x, p.y, p.z, p.r))) return false
    const ids = pts.map((p) => push({ ...p, t0, vx: v[0], vy: v[1], vz: v[2] }, c.term))
    if (ids.some((q) => q < 0)) return false
    for (const [a, b] of copy.bonds) bonds.push({ a: ids[a]!, b: ids[b]! })
    return true
  }
  let driftFrom = Infinity
  let driftTo = -Infinity
  for (const p of products) {
    const c = clusters.get(p.term)
    if (!c) continue
    const t0 = tRes + 0.15
    if (p.phase === 'gas' || p.phase === 'liquid') {
      const copy = unitCopy(c)
      const diam = 2 * Math.max(0.3, copy.ext)
      const gas = p.phase === 'gas'
      // газ: копии на расстоянии ~1,2 диаметра (реально в ~10 раз дальше — подпись), дрейф наружу и вверх;
      // жидкость: плотно (шаг 1,08 диаметра), в два ряда по глубине
      const ring = gas ? 6 : 10
      const dist = gas ? c.rho + diam * 0.75 : c.rho + diam * 0.42
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * Math.PI * 2 + 0.4
        const zz = gas ? -0.5 - 0.35 * (k % 3) : -0.25 - (k % 2) * diam * 0.55
        const x = c.cx + Math.cos(a) * dist * (gas ? 1 : 0.95)
        const y = c.cy + Math.sin(a) * dist * (gas ? 0.8 : 0.7)
        const sp = gas ? 0.16 : 0
        const v: [number, number, number] = gas ? [Math.cos(a) * sp, Math.max(0.05, Math.sin(a) * sp + 0.12), -0.04] : [0, 0, 0]
        placeCopy(c, copy, x, y, zz, a * 1.7 + k, t0 + (k / ring) * 0.6, v)
      }
      if (gas) {
        driftFrom = Math.min(driftFrom, tRes + 0.1)
        driftTo = Math.max(driftTo, lay.end)
      }
    } else if (p.phase === 'solution') {
      // молекулы воды кольцом вокруг частиц продукта, на разной глубине
      const waters = opts.lowPower ? 5 : 7
      const dist = c.rho + 0.42
      for (let k = 0; k < waters; k++) {
        const a = (k / waters) * Math.PI * 2 + 0.25
        const pts = waterAt(c.cx + Math.cos(a) * dist, c.cy + Math.sin(a) * dist * 0.78, -0.35 - (k % 2) * 0.4, a + Math.PI / 2)
        if (pts.some((q) => blocked(q.x, q.y, q.z, q.r))) continue
        const ids = pts.map((q) => push({ ...q, t0: t0 + (k / waters) * 0.6, vx: 0, vy: 0, vz: 0 }, c.term))
        if (ids.some((q) => q < 0)) break
        bonds.push({ a: ids[0]!, b: ids[1]! }, { a: ids[0]!, b: ids[2]! })
      }
    } else {
      // кристалл: блок решётки позади продукта (его частицы — лицевой слой)
      const el0 = lay.el[c.atoms[0]!]!
      const block = p.phase === 'metal' ? metalBlock(el0) : p.id ? crystalBlock(p.id) : p.phase === 'network' ? networkBlock(el0) : null
      if (!block || block.length === 0) continue
      // масштаб: ни одна пара соседей не входит друг в друга (ионы касаются, атомы одной молекулы — как палочки сюжета)
      let s = 0
      const rs = block.map((a) => storyR(a.el, a.charge))
      for (let a = 0; a < block.length; a++) {
        for (let b = a + 1; b < block.length; b++) {
          const A = block[a]!
          const B = block[b]!
          const d = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z)
          if (d < 1e-6) continue
          const same = A.u === B.u && A.u >= -1
          s = Math.max(s, ((rs[a]! + rs[b]!) * (same ? 1.32 : 1.0)) / d)
        }
      }
      if (!Number.isFinite(s) || s <= 0) continue
      let bx = 0
      let by = 0
      let bz = 0
      for (const a of block) {
        bx += a.x / block.length
        by += a.y / block.length
        bz += a.z / block.length
      }
      const keepR = Math.max(c.rho + 0.9, 1.7)
      const pts = block
        .map((a, q) => ({ el: a.el, x: (a.x - bx) * s, y: (a.y - by) * s, z: (a.z - bz) * s, r: rs[q]!, k: a.k }))
        .filter((a) => Math.hypot(a.x, a.y) <= keepR)
      if (!pts.length) continue
      let zMax = -Infinity
      for (const a of pts) zMax = Math.max(zMax, a.z + a.r)
      const dz = c.zFront - 0.06 - zMax
      const cap = Math.min(opts.lowPower ? 28 : 64, capTotal - parts.length)
      const sorted = pts.sort((a, b) => a.k - b.k || Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, Math.max(0, cap))
      const kMax = Math.max(1e-6, ...sorted.map((a) => Math.hypot(a.x, a.y)))
      for (const a of sorted) {
        const x = c.cx + a.x
        const y = c.cy + a.y
        const z = a.z + dz
        if (blocked(x, y, z, a.r)) continue
        push({ el: a.el, x, y, z, r: a.r, t0: t0 + 0.9 * (Math.hypot(a.x, a.y) / kMax), vx: 0, vy: 0, vz: 0 }, c.term)
      }
    }
  }
  let box: StoryEnv['box'] = null
  if (parts.length) {
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    const dt = Number.isFinite(driftFrom) ? driftTo - driftFrom : 0
    for (const q of parts) {
      const ex = q.vx * dt
      const ey = q.vy * dt
      b.minX = Math.min(b.minX, q.x - q.r, q.x + ex - q.r)
      b.maxX = Math.max(b.maxX, q.x + q.r, q.x + ex + q.r)
      b.minY = Math.min(b.minY, q.y - q.r, q.y + ey - q.r)
      b.maxY = Math.max(b.maxY, q.y + q.r, q.y + ey + q.r)
    }
    box = b
  }
  return { particles: parts, bonds, products, driftFrom: Number.isFinite(driftFrom) ? driftFrom : tRes, driftTo: Number.isFinite(driftTo) ? driftTo : lay.end, box }
}

/** Дрейф газа: доля пути 0…1 — плавный разгон и остановка к концу ролика (без колебаний). */
export function envDrift(env: StoryEnv, t: number): number {
  const a = env.driftFrom
  const b = env.driftTo
  if (t <= a) return 0
  if (t >= b) return b - a
  const x = (t - a) / (b - a)
  // интеграл гладкой скорости: путь (b − a) · S(x) — скорость 0 в начале и в конце
  return (b - a) * x * x * (3 - 2 * x)
}
