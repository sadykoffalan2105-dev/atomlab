/**
 * ЭЛЕКТРОННЫЕ ПАРЫ И ОБЛАКА-ЛЕПЕСТКИ сюжета реакции (чистый TS, без three) — как в «Как образуется» v2.
 *
 * На шагах «Разрыв / Перенос e⁻ / Образование» у атомов, участвующих в связях (концы разрываемых и новых палочек,
 * доноры и акцепторы e⁻), видны:
 *  • неподелённые пары — по Льюису (board/lewis.ts distributeElectrons: октет, сначала более электроотрицательные):
 *    лепесток наружу, против соседей; пара — два электрона рядом, поперёк направления лепестка;
 *  • общие пары: σ — на оси связи (в её середине, два e⁻ поперёк оси), π — сбоку от оси (вдоль связи), по одной
 *    на каждую лишнюю кратность; у разрываемой связи пара гаснет вместе с палочкой, у новой — появляется с ней.
 * Слева — пары исходных частиц (до отлёта атома к продукту), справа — пары продукта (после прихода на место).
 */
import { distributeElectrons, type LBond } from '../../../../components/lab/formation/board/lewis'
import type { ReactionStory, StorySide } from '../../../../chemistry/reactionStory'
import { smooth, type StoryLayout } from './storyLayout'

/** Неподелённая пара: атом, направление (единичный вектор в плоскости кадра с лёгкой глубиной), окно видимости. */
export type StoryLonePair = { readonly atom: number; readonly dx: number; readonly dy: number; readonly dz: number; readonly t0: number; readonly t1: number }
/** Общая пара на палочке k раскладки: σ (на оси) или π (сбоку, side = ±1). */
export type StoryBondPair = { readonly stick: number; readonly kind: 'sigma' | 'pi'; readonly side: number }
export type StoryPairs = {
  readonly lone: readonly StoryLonePair[]
  readonly bond: readonly StoryBondPair[]
  /** атомы-участники (лепестки σ у концов палочек и облака пар) */
  readonly atoms: readonly number[]
  /** общее окно показа [on, off] */
  readonly on: number
  readonly off: number
}

/** Неподелённые пары каждого атома стороны (ионное вещество — по ионам, молекула — целиком). */
function lonePairsOf(side: StorySide): number[] {
  const out = new Array<number>(side.atoms.length).fill(0)
  const run = (atoms: readonly number[], charge: number) => {
    const idx = new Map(atoms.map((a, k) => [a, k]))
    const bonds: LBond[] = side.bonds.flatMap((b) => (idx.has(b.a) && idx.has(b.b) ? [{ a: idx.get(b.a)!, b: idx.get(b.b)!, order: b.order }] : []))
    const r = distributeElectrons(atoms.map((a) => side.atoms[a]!.el), bonds, charge)
    if (r) atoms.forEach((a, k) => (out[a] = r.lone[k]!))
  }
  for (const u of side.units) {
    if (u.kind === 'metal') continue
    if (u.kind === 'ionic') for (const g of u.groups) run(side.groups[g]!.atoms, side.groups[g]!.charge)
    else run(u.atoms, u.charge)
  }
  return out
}

/** Направления k неподелённых пар: против суммы направлений на соседей, веером в плоскости кадра (с лёгкой глубиной). */
function loneDirs(k: number, nb: readonly [number, number][]): [number, number, number][] {
  if (k <= 0) return []
  let sx = 0
  let sy = 0
  for (const [x, y] of nb) {
    const d = Math.hypot(x, y) || 1
    sx += x / d
    sy += y / d
  }
  let base = Math.atan2(-sy, -sx)
  if (nb.length === 0) base = Math.PI / 2
  else if (Math.hypot(sx, sy) < 0.2) base = Math.atan2(nb[0]![1], nb[0]![0]) + Math.PI / 2
  // свободный атом / ион — пары по четырём сторонам; у связанного — веер в свободной стороне
  const spread = nb.length === 0 ? (2 * Math.PI) / k : nb.length === 1 ? Math.min(1.25, (2.6 / Math.max(1, k - 1)) * 0.95) : 0.95
  const out: [number, number, number][] = []
  for (let q = 0; q < k; q++) {
    const a = nb.length === 0 ? base + q * spread + Math.PI / 4 : base + (q - (k - 1) / 2) * spread
    const z = k > 2 ? (q % 2 ? -0.35 : 0.35) : 0.15
    const c = Math.sqrt(1 - z * z)
    out.push([Math.cos(a) * c, Math.sin(a) * c, z])
  }
  return out
}

/** Пары и облака по раскладке: только лицевые копии; не больше maxAtoms участников. */
export function buildStoryPairs(story: ReactionStory, lay: StoryLayout, opts: { lowPower?: boolean } = {}): StoryPairs {
  const sB = lay.steps.find((s) => s.id === 'breaking')!
  const sR = lay.steps.find((s) => s.id === 'result')!
  const on = sB.from
  const off = sR.from + 0.5
  const n = lay.n
  const maxAtoms = opts.lowPower ? 12 : 28
  // участники: концы разрываемых и новых палочек, доноры и акцепторы (лицевые копии)
  const part = new Set<number>()
  const front = (i: number) => !lay.layerL[i] && !lay.layerR[i]
  lay.sticks.forEach((s) => {
    if (s.kind === 'kept') return
    if (front(s.a)) part.add(s.a)
    if (front(s.b)) part.add(s.b)
  })
  for (const i of [...lay.donors, ...lay.acceptors]) if (front(i)) part.add(i)
  const atoms = [...part].slice(0, maxAtoms)
  const pset = new Set(atoms)
  const loneL = lonePairsOf(story.left)
  const loneR = lonePairsOf(story.right)
  // соседи атома слева (палочки kept + broken) и справа (kept + formed), положения p0 / p3
  const nbOf = (i: number, right: boolean): [number, number][] => {
    const P = right ? lay.p3 : lay.p0
    const out: [number, number][] = []
    for (const s of lay.sticks) {
      if (right ? s.kind === 'broken' : s.kind === 'formed') continue
      const o = s.a === i ? s.b : s.b === i ? s.a : -1
      if (o < 0) continue
      out.push([P[o * 3]! - P[i * 3]!, P[o * 3 + 1]! - P[i * 3 + 1]!])
    }
    return out
  }
  const lone: StoryLonePair[] = []
  for (const i of atoms) {
    const mf = lay.moveFrom[i]!
    const moving = Math.hypot(lay.p3[i * 3]! - lay.p1[i * 3]!, lay.p3[i * 3 + 1]! - lay.p1[i * 3 + 1]!) > 0.1
    // слева: до отлёта к продукту (неподвижный атом — до середины образования); справа — после прихода
    const tSwap = moving ? mf + lay.moveDur * 0.5 : (lay.formFrom + lay.formTo) / 2
    const kl = Math.min(4, loneL[i] ?? 0)
    const kr = Math.min(4, loneR[story.map[i]!] ?? 0)
    for (const d of loneDirs(kl, nbOf(i, false))) lone.push({ atom: i, dx: d[0], dy: d[1], dz: d[2], t0: on, t1: tSwap })
    for (const d of loneDirs(kr, nbOf(i, true))) lone.push({ atom: i, dx: d[0], dy: d[1], dz: d[2], t0: tSwap, t1: off })
  }
  const bond: StoryBondPair[] = []
  lay.sticks.forEach((s, k) => {
    if (s.kind === 'kept' || !pset.has(s.a) || !pset.has(s.b)) return
    bond.push({ stick: k, kind: 'sigma', side: 0 })
    for (let q = 1; q < s.order; q++) bond.push({ stick: k, kind: 'pi', side: q % 2 ? 1 : -1 })
  })
  void n
  return { lone, bond, atoms, on, off }
}

/** Видимость пар в момент t (общее окно шага): плавно включается на разрыве и гаснет в начале «Итога». */
export function pairsVisibility(p: StoryPairs, t: number): number {
  return smooth(p.on, p.on + 0.5, t) * (1 - smooth(p.off - 0.5, p.off, t))
}
