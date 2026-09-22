/**
 * Реактор, этап балансировки: «частица = формульная единица».
 *
 * Чистый модуль (без React и three в рантайме): по членам уравнения строит
 * настоящие частицы в том количестве, которое задаёт коэффициент.
 *
 *   • двухатомное простое вещество (H₂, O₂, N₂, Cl₂…) — coeff молекул по 2 атома
 *     на длине связи из bondData, с кратностью (O=O двойная, N≡N тройная);
 *   • металл — coeff атомов из фрагмента СВОЕЙ решётки (Na ОЦК, Mg ГПУ, Al/Pb ГЦК):
 *     атомы берутся из ближайших узлов, поэтому 2 Na стоят на расстоянии ближайших
 *     соседей решётки (371,6 пм), а не «где удобно»;
 *   • графит — атомы слоя (C–C 142,1 пм), кремний — алмазоподобная решётка,
 *     сера — фрагмент короны S₈, фосфор — вершины тетраэдра P₄;
 *   • сложный реагент (compoundId) — все атомы формулы каталога без лимита,
 *     геометрия нормирована по сумме ковалентных радиусов связанных атомов;
 *     металл без связей в формуле — катион с зарядом стабильного иона.
 *
 * Радиусы — из src/chemistry/data через тот же масштаб, что у сцен (kit/cpkAtoms:
 * pmToScene, SPECIES_SCALE): Кордеро для атома в молекуле, металлический для
 * металла, Шеннон для иона. Ни одного числа химии здесь нет — только правила.
 *
 * Здесь же — счётчик атомов «слева | справа» для ReactorAtomLedger: состав реагента
 * с compoundId берётся из каталога (compositionFromLeftTerms для них отдаёт null).
 */
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  getCrystal,
  ionChargesOf,
  isElementSymbol,
  radiusForSpecies,
  type BondKey,
  type ElementSymbol,
  type RadiusModel,
} from '../chemistry/data'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorCoProductTerm } from '../chemistry/scientificReactorRecipes'
import { compoundById } from '../data/compounds'
import { getElementByZ } from '../data/elements'
import type { CompoundDef } from '../types/chemistry'
import { latticeFragment } from './cinema/scenes/kit/lattice'
import { pmToScene, SPECIES_SCALE } from './cinema/scenes/kit/cpkAtoms'
import type { SubstanceKind } from './cinema/scenes/kit/materials'

export type Vec3 = [number, number, number]

/** Агрегатное состояние при 25 °C — символ IUPAC, одинаков во всех языках. */
export type ParticleState = 'g' | 'l' | 's'

export type ReactorParticleAtom = {
  el: ElementSymbol
  /** Смещение от центра частицы, мировые единицы сцены. */
  pos: Vec3
  /** Радиус частицы в пм (для карточки и тестов). */
  radiusPm: number
  /** Какой радиус взят: ковалентный (Кордеро), металлический или ионный (Шеннон). */
  radiusKind: RadiusModel
  /** Видимый радиус шара, мировые единицы (pmToScene · SPECIES_SCALE). */
  radius: number
  /** Заряд иона; 0 — нейтральный атом. */
  charge: number
}

export type ReactorParticleBond = { a: number; b: number; order: number }

export type ReactorParticle = {
  /** Стабильный ключ `${termId}#${instanceIdx}` — для анимации прилёта/улёта. */
  key: string
  termId: string
  termIndex: number
  instanceIdx: number
  /** Центр частицы, мировые единицы (кластер уже разложен в ряд). */
  center: Vec3
  atoms: ReactorParticleAtom[]
  bonds: ReactorParticleBond[]
  /** Подпись формульной единицы: «Cl₂ (g)», «Na (s)». */
  label: string
  state: ParticleState | null
}

/** Связь между частицами одного кластера (атомы фрагмента графита, S₈, Si). */
export type ReactorClusterLink = { pa: number; pb: number; order: number }

export type ReactorCluster = {
  termId: string
  termIndex: number
  coeff: number
  /** Формула без коэффициента: «Cl₂», «KMnO₄». */
  formula: string
  state: ParticleState | null
  /** «Cl₂ (g)» */
  label: string
  kind: SubstanceKind
  /** Индексы частиц кластера в общем массиве particles. */
  particles: number[]
  /** Связи между частицами кластера (индексы — позиции в `particles` кластера). */
  links: ReactorClusterLink[]
  center: Vec3
  /** Полуразмеры габарита кластера вместе с радиусами шаров. */
  halfExtent: Vec3
  /** Куда ставить подпись кластера (под ним). */
  labelPos: Vec3
}

export type ReactorParticleSet = {
  particles: ReactorParticle[]
  clusters: ReactorCluster[]
  atomCount: number
  /** Габарит всего ряда: центр и полуразмеры (мировые единицы). */
  center: Vec3
  halfExtent: Vec3
}

// ─────────────────────────────────────────────────────────────────────────────
// Классификация простых веществ
// ─────────────────────────────────────────────────────────────────────────────

/** Двухатомные простые вещества: ключ связи в bondData и её кратность. */
const DIATOMIC_BOND: Partial<Record<ElementSymbol, { key: BondKey; order: number }>> = {
  H: { key: 'H-H', order: 1 },
  N: { key: 'N#N', order: 3 },
  O: { key: 'O=O', order: 2 },
  F: { key: 'F-F', order: 1 },
  Cl: { key: 'Cl-Cl', order: 1 },
  Br: { key: 'Br-Br', order: 1 },
  I: { key: 'I-I', order: 1 },
}

/** Ковалентные каркасы простых веществ: решётка из crystalData; связи — ближайшие соседи решётки. */
const NETWORK_CRYSTAL: Partial<Record<ElementSymbol, { crystal: string; bond: boolean; layer?: boolean }>> = {
  C: { crystal: 'graphite', bond: true, layer: true },
  Si: { crystal: 'si', bond: true },
}

/** Размер фрагмента решётки в ячейках: узлов в нём больше любого коэффициента реактора. */
const FRAGMENT_CELLS: Readonly<[number, number, number]> = [3, 3, 3]

/** Зазор между частицами одного кластера (и основа зазора между кластерами), пм. */
function gapPm(): number {
  // Зазор задаём через ковалентный радиус водорода (самый малый атом ядра):
  // это масштаб «щель в один маленький атом» — не число химии, а правило раскладки.
  return 2 * ATOMIC_DATA.H.covalentRadiusPm
}

function standardStateOf(sym: ElementSymbol): ParticleState | null {
  const el = getElementByZ(ATOMIC_DATA[sym].z)
  const s = (el?.standardState ?? '').toLowerCase()
  if (s.startsWith('gas')) return 'g'
  if (s.startsWith('liquid')) return 'l'
  if (s.startsWith('solid')) return 's'
  return null
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

function subscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[d] ?? d)
    .join('')
}

export function stateLabel(formula: string, state: ParticleState | null): string {
  return state ? `${formula} (${state})` : formula
}

/** Элемент члена уравнения (null — неизвестный Z или элемент вне ядра). */
function termElement(term: ReactorEquationTerm): ElementSymbol | null {
  const sym = getElementByZ(term.z)?.symbol
  return sym && isElementSymbol(sym) ? sym : null
}

function isMetal(sym: ElementSymbol): boolean {
  return ATOMIC_DATA[sym].metallicRadiusPm != null
}

/** Катион металла: наименьший положительный заряд из таблицы ионов (Na⁺, K⁺, Ba²⁺, Mg²⁺). */
export function stableCationCharge(sym: ElementSymbol): number | null {
  const pos = ionChargesOf(sym).filter((q) => q > 0)
  return pos.length > 0 ? pos[0]! : null
}

/** Анион неметалла: наибольший по модулю отрицательный заряд (O²⁻, Cl⁻, S²⁻). */
function stableAnionCharge(sym: ElementSymbol): number | null {
  const neg = ionChargesOf(sym).filter((q) => q < 0)
  return neg.length > 0 ? neg[0]! : null
}

function makeAtom(el: ElementSymbol, posPm: Vec3, model: RadiusModel, charge = 0): ReactorParticleAtom {
  const radiusPm = model === 'ionic' ? radiusForSpecies(el, charge) : radiusForSpecies(el, 0, { model })
  return {
    el,
    pos: [pmToScene(posPm[0]), pmToScene(posPm[1]), pmToScene(posPm[2])],
    radiusPm,
    radiusKind: model,
    radius: pmToScene(radiusPm) * SPECIES_SCALE,
    charge,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Фрагменты «естественной формы» простых веществ (атом на единицу коэффициента)
// ─────────────────────────────────────────────────────────────────────────────

type FragmentTemplate = {
  /** Позиции атомов в пм, отсортированы «от центра наружу», центр первого — (0,0,0). */
  posPm: Vec3[]
  /** Пары соседей (ковалентные связи фрагмента); у металлов пусто. */
  bonds: Array<[number, number]>
  /** Расстояние ближайших соседей, пм. */
  nnPm: number
}

const fragmentCache = new Map<string, FragmentTemplate | null>()

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Упорядочивает точки: сначала центральная, затем по расстоянию до неё (жадно — компактный рост). */
function orderCompact(points: Vec3[], start: number): Vec3[] {
  const c = points[start]!
  const idx = points.map((_, i) => i)
  idx.sort((i, j) => {
    const d = dist(points[i]!, c) - dist(points[j]!, c)
    if (Math.abs(d) > 1e-6) return d
    // Равные расстояния: детерминированно по координатам (x, затем y, затем z).
    const pi = points[i]!
    const pj = points[j]!
    return pi[0] - pj[0] || pj[1] - pi[1] || pi[2] - pj[2]
  })
  return idx.map((i) => {
    const p = points[i]!
    return [p[0] - c[0], p[1] - c[1], p[2] - c[2]] as Vec3
  })
}

function bondsByDistance(posPm: Vec3[], lengthPm: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const tol = lengthPm * 0.03
  for (let i = 0; i < posPm.length; i++) {
    for (let j = i + 1; j < posPm.length; j++) {
      if (Math.abs(dist(posPm[i]!, posPm[j]!) - lengthPm) <= tol) out.push([i, j])
    }
  }
  return out
}

function nearestNeighbourPm(posPm: Vec3[]): number {
  let min = Infinity
  for (let i = 0; i < posPm.length; i++) {
    for (let j = i + 1; j < posPm.length; j++) min = Math.min(min, dist(posPm[i]!, posPm[j]!))
  }
  return min
}

/** Фрагмент решётки из crystalData (металл или ковалентный каркас). */
function latticeTemplate(crystalId: string, el: ElementSymbol, opts: { layer?: boolean; bond?: boolean }): FragmentTemplate | null {
  const cr = getCrystal(crystalId)
  if (!cr || !cr.basis || cr.basis.length === 0) return null
  let frag
  try {
    frag = latticeFragment(crystalId, FRAGMENT_CELLS, { includeBoundary: true })
  } catch {
    return null
  }
  const pts: Vec3[] = []
  for (let i = 0; i < frag.sites.length; i++) {
    if (frag.sites[i]!.el === el) pts.push(frag.posPm[i]! as Vec3)
  }
  if (pts.length === 0) return null
  // Стартовый узел — ближайший к середине фрагмента.
  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of pts) {
    cx += p[0]
    cy += p[1]
    cz += p[2]
  }
  const mid: Vec3 = [cx / pts.length, cy / pts.length, cz / pts.length]
  let start = 0
  let best = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = dist(pts[i]!, mid)
    if (d < best - 1e-6) {
      best = d
      start = i
    }
  }
  let src = pts
  if (opts.layer) {
    // Графит: только атомы одного слоя (ось c решётки смотрит в +Y сцены).
    const y0 = pts[start]![1]
    const layer = pts.filter((p) => Math.abs(p[1] - y0) < 1)
    start = layer.findIndex((p) => p === pts[start])
    src = layer
  }
  const posPm = orderCompact(src, Math.max(0, start))
  const nnPm = nearestNeighbourPm(posPm.slice(0, Math.min(posPm.length, 64)))
  // Связи каркаса — пары на расстоянии ближайших соседей самой решётки (графит 142,1 пм:
  // табличная 'C-C' 154 пм относится к алканам и сюда не годится).
  const bonds = opts.bond ? bondsByDistance(posPm, nnPm) : []
  return { posPm, bonds, nnPm }
}

/** Корона S₈ (D₄d): S–S и ∠S–S–S из bondData; атомы по кольцу подряд. */
function sulfurRingTemplate(): FragmentTemplate {
  const d = bondLengthPm('S-S')
  const ang = (bondAngleDeg('sulfurRing') * Math.PI) / 180
  // Корона: 8 атомов на двух параллельных окружностях (4 сверху, 4 снизу),
  // соседние по кольцу — на разных ярусах. Радиус R и полувысота h из условий:
  // |S_i S_{i+1}| = d и ∠S_{i-1} S_i S_{i+1} = ang.
  // Хорда через одного (на одном ярусе): 2R·sin(π/4)·… — решаем численно.
  const n = 8
  const dPhi = (2 * Math.PI) / n
  let best: { R: number; h: number } = { R: d, h: 0 }
  let bestErr = Infinity
  // Для заданного R высота из длины связи: d² = 2R²(1 − cos dPhi) + (2h)².
  for (let R = d * 0.6; R <= d * 2.5; R += d * 0.0005) {
    const planar = 2 * R * R * (1 - Math.cos(dPhi))
    const hh = d * d - planar
    if (hh < 0) break
    const h = Math.sqrt(hh) / 2
    const a: Vec3 = [R * Math.cos(-dPhi), -h, R * Math.sin(-dPhi)]
    const b: Vec3 = [R, h, 0]
    const c: Vec3 = [R * Math.cos(dPhi), -h, R * Math.sin(dPhi)]
    const ba: Vec3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
    const bc: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]]
    const cos = (ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2]) / (Math.hypot(...ba) * Math.hypot(...bc))
    const err = Math.abs(Math.acos(Math.max(-1, Math.min(1, cos))) - ang)
    if (err < bestErr) {
      bestErr = err
      best = { R, h }
    }
  }
  const ring: Vec3[] = []
  for (let i = 0; i < n; i++) {
    const phi = i * dPhi
    ring.push([best.R * Math.cos(phi), i % 2 === 0 ? best.h : -best.h, best.R * Math.sin(phi)])
  }
  // Порядок роста — по кольцу, чтобы 2 S были соседями по связи.
  const c0 = ring[0]!
  const posPm = ring.map((p) => [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]] as Vec3)
  const bonds: Array<[number, number]> = []
  for (let i = 0; i < n - 1; i++) bonds.push([i, i + 1])
  bonds.push([n - 1, 0])
  return { posPm, bonds, nnPm: d }
}

/** Тетраэдр P₄: ребро P–P из bondData. */
function phosphorusTemplate(): FragmentTemplate {
  const d = bondLengthPm('P-P')
  const k = d / Math.SQRT2 / 2
  const raw: Vec3[] = [
    [k, k, k],
    [-k, -k, k],
    [-k, k, -k],
    [k, -k, -k],
  ]
  const c0 = raw[0]!
  const posPm = raw.map((p) => [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]] as Vec3)
  const bonds: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ]
  return { posPm, bonds, nnPm: d }
}

/** Металл без записи решётки: плотнейшая упаковка на расстоянии 2·r_мет (определение r_мет при КЧ 12). */
function closePackedTemplate(el: ElementSymbol): FragmentTemplate {
  const r = ATOMIC_DATA[el].metallicRadiusPm ?? ATOMIC_DATA[el].covalentRadiusPm
  const d = 2 * r
  const pts: Vec3[] = []
  // ГЦК-узлы куба 3×3×3 с ребром a = d·√2.
  const a = d * Math.SQRT2
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        pts.push([i * a, j * a, k * a])
        pts.push([i * a + a / 2, j * a + a / 2, k * a])
        pts.push([i * a + a / 2, j * a, k * a + a / 2])
        pts.push([i * a, j * a + a / 2, k * a + a / 2])
      }
  const start = pts.findIndex((p) => p[0] === 0 && p[1] === 0 && p[2] === 0)
  return { posPm: orderCompact(pts, start), bonds: [], nnPm: d }
}

/** Шаблон «естественной формы» элемента (кэш). null — рисуем одиночными атомами. */
export function elementFragmentTemplate(el: ElementSymbol): FragmentTemplate | null {
  if (fragmentCache.has(el)) return fragmentCache.get(el)!
  let t: FragmentTemplate | null = null
  const net = NETWORK_CRYSTAL[el]
  if (net) t = latticeTemplate(net.crystal, el, { layer: net.layer, bond: net.bond })
  else if (el === 'S') t = sulfurRingTemplate()
  else if (el === 'P') t = phosphorusTemplate()
  else if (isMetal(el)) t = latticeTemplate(`${el.toLowerCase()}_metal`, el, {}) ?? closePackedTemplate(el)
  fragmentCache.set(el, t)
  return t
}

/** Id решётки металла, если она есть в crystalData с базисом. */
export function metalCrystalId(el: ElementSymbol): string | null {
  const id = `${el.toLowerCase()}_metal`
  const cr = getCrystal(id)
  return cr && cr.basis && cr.basis.length > 0 ? id : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Сложные реагенты (compoundId): все атомы формулы
// ─────────────────────────────────────────────────────────────────────────────

type CompoundTemplate = { atoms: ReactorParticleAtom[]; bonds: ReactorParticleBond[] }

const compoundCache = new Map<string, CompoundTemplate | null>()

function compoundTemplate(c: CompoundDef): CompoundTemplate | null {
  if (compoundCache.has(c.id)) return compoundCache.get(c.id)!
  const syms: ElementSymbol[] = []
  for (const a of c.atoms) {
    if (!isElementSymbol(a.symbol)) {
      compoundCache.set(c.id, null)
      return null
    }
    syms.push(a.symbol)
  }
  const n = syms.length
  const bonded = new Array<boolean>(n).fill(false)
  for (const [i, j] of c.bonds) {
    bonded[i] = true
    bonded[j] = true
  }
  const hasCation = syms.some((s, i) => isMetal(s) && !bonded[i])
  // Заряды: металл без связей — катион; неметалл без связей рядом с катионом — анион.
  const charge = syms.map((s, i) => {
    if (bonded[i]) return 0
    if (isMetal(s)) return stableCationCharge(s) ?? 0
    if (hasCation) return stableAnionCharge(s) ?? 0
    return 0
  })
  const model = (i: number): RadiusModel => (charge[i] !== 0 ? 'ionic' : 'covalent')
  const rPm = syms.map((s, i) => (model(i) === 'ionic' ? radiusForSpecies(s, charge[i]!) : radiusForSpecies(s, 0, { model: 'covalent' })))
  const raw = c.atoms.map((a) => [a.pos[0], a.pos[1], a.pos[2]] as Vec3)
  // Нормировка по габариту: средняя связь каталога = средней сумме ковалентных радиусов.
  let k = 1
  if (c.bonds.length > 0) {
    let cur = 0
    let target = 0
    for (const [i, j] of c.bonds) {
      cur += dist(raw[i]!, raw[j]!)
      target += rPm[i]! + rPm[j]!
    }
    if (cur > 1e-9) k = target / cur
  } else if (n > 1) {
    // Без связей (ионная пара): ближайшая пара = сумма радиусов частиц.
    let best = Infinity
    let bi = 0
    let bj = 1
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = dist(raw[i]!, raw[j]!)
        if (d < best) {
          best = d
          bi = i
          bj = j
        }
      }
    if (best > 1e-9) k = (rPm[bi]! + rPm[bj]!) / best
  }
  const posPm = raw.map((p) => [p[0] * k, p[1] * k, p[2] * k] as Vec3)
  // Несвязанные частицы (K⁺ у MnO₄⁻) не должны входить в соседей: отодвигаем по лучу от центра.
  const cen: Vec3 = [0, 0, 0]
  for (const p of posPm) {
    cen[0] += p[0] / n
    cen[1] += p[1] / n
    cen[2] += p[2] / n
  }
  for (let i = 0; i < n; i++) {
    if (bonded[i]) continue
    for (let iter = 0; iter < 8; iter++) {
      let worst = 0
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const need = rPm[i]! + rPm[j]!
        const d = dist(posPm[i]!, posPm[j]!)
        if (d < need) worst = Math.max(worst, need - d)
      }
      if (worst <= 0) break
      const p = posPm[i]!
      let dx = p[0] - cen[0]
      let dy = p[1] - cen[1]
      let dz = p[2] - cen[2]
      const len = Math.hypot(dx, dy, dz)
      if (len < 1e-6) {
        dx = 1
        dy = 0
        dz = 0
      } else {
        dx /= len
        dy /= len
        dz /= len
      }
      p[0] += dx * worst
      p[1] += dy * worst
      p[2] += dz * worst
    }
  }
  // Центр частицы — центр габарита.
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const p of posPm)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a]!, p[a]!)
      hi[a] = Math.max(hi[a]!, p[a]!)
    }
  const mid: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
  const atoms = syms.map((s, i) => {
    const p = posPm[i]!
    return makeAtom(s, [p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]], model(i), charge[i]!)
  })
  const bonds = c.bonds.map(([a, b]) => ({ a, b, order: 1 }))
  const t = { atoms, bonds }
  compoundCache.set(c.id, t)
  return t
}

/** Агрегатное состояние соединения: соль/основание — твёрдое, иначе по ядру термохимии нет — не пишем. */
function compoundState(c: CompoundDef): ParticleState | null {
  if (c.category === 'salt' || c.category === 'base') return 's'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Сборка частиц и раскладка кластеров
// ─────────────────────────────────────────────────────────────────────────────

function particleExtent(atoms: readonly ReactorParticleAtom[]): Vec3 {
  const e: Vec3 = [0, 0, 0]
  for (const a of atoms)
    for (let k = 0; k < 3; k++) e[k] = Math.max(e[k]!, Math.abs(a.pos[k]!) + a.radius)
  return e
}

type TermBuild = {
  cluster: Omit<ReactorCluster, 'particles' | 'center' | 'labelPos'>
  particles: Array<Omit<ReactorParticle, 'center' | 'termIndex'> & { local: Vec3 }>
}

/** Раскладка молекулярных частиц кластера: столбцы по 3, центр кластера — (0,0,0). */
function moleculeGrid(count: number, ext: Vec3): Vec3[] {
  const g = pmToScene(gapPm())
  const dx = 2 * ext[0] + g
  const dy = 2 * ext[1] + g
  const cols = Math.ceil(count / 3)
  const out: Vec3[] = []
  for (let k = 0; k < count; k++) {
    const col = Math.floor(k / 3)
    const row = k % 3
    const rowsInCol = Math.min(3, count - col * 3)
    out.push([(col - (cols - 1) / 2) * dx, ((rowsInCol - 1) / 2 - row) * dy, 0])
  }
  return out
}

function buildTerm(term: ReactorEquationTerm): TermBuild | null {
  const coeff = Math.max(0, Math.floor(term.coeff))
  if (coeff <= 0) return null
  const parts: TermBuild['particles'] = []

  if (term.compoundId) {
    const c = compoundById[term.compoundId]
    if (!c) return null
    const tpl = compoundTemplate(c)
    if (!tpl) return null
    const state = compoundState(c)
    const label = stateLabel(c.formulaUnicode, state)
    const ext = particleExtent(tpl.atoms)
    const grid = moleculeGrid(coeff, ext)
    for (let k = 0; k < coeff; k++) {
      parts.push({
        key: `${term.id}#${k}`,
        termId: term.id,
        instanceIdx: k,
        local: grid[k]!,
        atoms: tpl.atoms,
        bonds: tpl.bonds,
        label,
        state,
      })
    }
    const hasIon = tpl.atoms.some((a) => a.charge !== 0)
    return {
      cluster: {
        termId: term.id,
        termIndex: 0,
        coeff,
        formula: c.formulaUnicode,
        state,
        label,
        kind: hasIon ? 'ion' : 'covalent',
        links: [],
        halfExtent: [0, 0, 0],
      },
      particles: parts,
    }
  }

  const el = termElement(term)
  if (!el) return null
  const state = standardStateOf(el)

  const di = DIATOMIC_BOND[el]
  if (term.diatomic && di) {
    const half = bondLengthPm(di.key) / 2
    const atoms = [makeAtom(el, [-half, 0, 0], 'covalent'), makeAtom(el, [half, 0, 0], 'covalent')]
    const bonds = [{ a: 0, b: 1, order: di.order }]
    const formula = `${el}${subscript(2)}`
    const label = stateLabel(formula, state)
    const grid = moleculeGrid(coeff, particleExtent(atoms))
    for (let k = 0; k < coeff; k++) {
      parts.push({ key: `${term.id}#${k}`, termId: term.id, instanceIdx: k, local: grid[k]!, atoms, bonds, label, state })
    }
    return {
      cluster: {
        termId: term.id,
        termIndex: 0,
        coeff,
        formula,
        state,
        label,
        kind: state === 'g' ? 'gas' : 'covalent',
        links: [],
        halfExtent: [0, 0, 0],
      },
      particles: parts,
    }
  }

  // Атом на единицу коэффициента — из фрагмента естественной формы.
  const tpl = elementFragmentTemplate(el)
  const metal = isMetal(el)
  const model: RadiusModel = metal ? 'metallic' : 'covalent'
  const atom = makeAtom(el, [0, 0, 0], model)
  const label = stateLabel(el, state)
  const links: ReactorClusterLink[] = []
  let locals: Vec3[]
  if (tpl && coeff <= tpl.posPm.length) {
    const chosen = tpl.posPm.slice(0, coeff)
    // Центр кластера — центр габарита выбранных узлов.
    const lo: Vec3 = [Infinity, Infinity, Infinity]
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const p of chosen)
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a]!, p[a]!)
        hi[a] = Math.max(hi[a]!, p[a]!)
      }
    const mid: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
    locals = chosen.map((p) => [pmToScene(p[0] - mid[0]), pmToScene(p[1] - mid[1]), pmToScene(p[2] - mid[2])] as Vec3)
    for (const [i, j] of tpl.bonds) if (i < coeff && j < coeff) links.push({ pa: i, pb: j, order: 1 })
  } else {
    locals = moleculeGrid(coeff, particleExtent([atom]))
  }
  for (let k = 0; k < coeff; k++) {
    parts.push({ key: `${term.id}#${k}`, termId: term.id, instanceIdx: k, local: locals[k]!, atoms: [atom], bonds: [], label, state })
  }
  return {
    cluster: {
      termId: term.id,
      termIndex: 0,
      coeff,
      formula: el,
      state,
      label,
      kind: metal ? 'metal' : state === 'g' ? 'gas' : 'covalent',
      links,
      halfExtent: [0, 0, 0],
    },
    particles: parts,
  }
}

const EMPTY: ReactorParticleSet = { particles: [], clusters: [], atomCount: 0, center: [0, 0, 0], halfExtent: [0, 0, 0] }

/**
 * Частицы всех членов уравнения, разложенные в ряд слева направо (порядок
 * уравнения). Координаты — мировые единицы масштаба сцен; вписывание в кадр
 * делает рендер одним равномерным множителем (отношения размеров сохраняются).
 */
export function buildReactorParticles(terms: readonly ReactorEquationTerm[]): ReactorParticleSet {
  const builds: TermBuild[] = []
  for (const t of terms) {
    const b = buildTerm(t)
    if (b) builds.push(b)
  }
  if (builds.length === 0) return EMPTY
  // Габарит каждого кластера.
  const boxes = builds.map((b) => {
    const lo: Vec3 = [Infinity, Infinity, Infinity]
    const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (const p of b.particles)
      for (const a of p.atoms)
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k]!, p.local[k]! + a.pos[k]! - a.radius)
          hi[k] = Math.max(hi[k]!, p.local[k]! + a.pos[k]! + a.radius)
        }
    return { lo, hi }
  })
  const g = pmToScene(gapPm()) * 6
  const widths = boxes.map((bx) => bx.hi[0] - bx.lo[0])
  const total = widths.reduce((s, w) => s + w, 0) + g * (builds.length - 1)
  let x = -total / 2
  const particles: ReactorParticle[] = []
  const clusters: ReactorCluster[] = []
  let atomCount = 0
  let minY = Infinity
  let maxY = -Infinity
  let maxZ = 0
  builds.forEach((b, ti) => {
    const bx = boxes[ti]!
    // Сдвиг кластера: левый край на x, по вертикали — центр габарита в 0.
    const ox = x - bx.lo[0]
    const oy = -(bx.lo[1] + bx.hi[1]) / 2
    const oz = -(bx.lo[2] + bx.hi[2]) / 2
    const idxs: number[] = []
    for (const p of b.particles) {
      idxs.push(particles.length)
      particles.push({
        key: p.key,
        termId: p.termId,
        termIndex: ti,
        instanceIdx: p.instanceIdx,
        center: [p.local[0] + ox, p.local[1] + oy, p.local[2] + oz],
        atoms: p.atoms,
        bonds: p.bonds,
        label: p.label,
        state: p.state,
      })
      atomCount += p.atoms.length
    }
    const half: Vec3 = [(bx.hi[0] - bx.lo[0]) / 2, (bx.hi[1] - bx.lo[1]) / 2, (bx.hi[2] - bx.lo[2]) / 2]
    const center: Vec3 = [x + half[0], 0, 0]
    minY = Math.min(minY, -half[1])
    maxY = Math.max(maxY, half[1])
    maxZ = Math.max(maxZ, half[2])
    clusters.push({
      ...b.cluster,
      termIndex: ti,
      particles: idxs,
      center,
      halfExtent: half,
      labelPos: [center[0], -half[1], 0],
    })
    x += widths[ti]! + g
  })
  return {
    particles,
    clusters,
    atomCount,
    center: [0, (minY + maxY) / 2, 0],
    halfExtent: [total / 2, (maxY - minY) / 2, maxZ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Счётчик атомов «слева | справа»
// ─────────────────────────────────────────────────────────────────────────────

export type Composition = Record<string, number>

/** Состав ОДНОЙ формульной единицы члена уравнения (для двухатомного — молекулы X₂). */
export function termUnitComposition(term: { z?: number; compoundId?: string; diatomic?: boolean }): Composition | null {
  if (term.compoundId) {
    const c = compoundById[term.compoundId]
    if (!c) return null
    const out: Composition = {}
    for (const [s, n] of Object.entries(c.composition)) {
      const k = Math.max(0, Math.floor(Number(n)))
      if (k > 0) out[s] = k
    }
    return out
  }
  if (term.z == null) return null
  const sym = getElementByZ(term.z)?.symbol
  if (!sym) return null
  return { [sym]: term.diatomic ? 2 : 1 }
}

function addScaled(into: Composition, unit: Composition, k: number): void {
  for (const [s, n] of Object.entries(unit)) into[s] = (into[s] ?? 0) + n * k
}

/** Атомы слева по элементам (реагенты с compoundId — по составу каталога). */
export function leftTermsComposition(terms: readonly ReactorEquationTerm[]): Composition {
  const out: Composition = {}
  for (const t of terms) {
    const k = Math.max(0, Math.floor(t.coeff))
    if (k <= 0) continue
    const u = termUnitComposition(t)
    if (u) addScaled(out, u, k)
  }
  return out
}

/** Атомы справа: продукт × коэффициент + побочные продукты. */
export function rightSideComposition(
  product: CompoundDef | null,
  productCoeff: number,
  coProducts: readonly ReactorCoProductTerm[] = [],
): Composition {
  const out: Composition = {}
  const k = Math.max(0, Math.floor(productCoeff))
  if (product && k > 0) {
    for (const [s, n] of Object.entries(product.composition)) {
      const m = Math.max(0, Math.floor(Number(n)))
      if (m > 0) out[s] = (out[s] ?? 0) + m * k
    }
  }
  for (const cp of coProducts) {
    const c = Math.max(0, Math.floor(cp.coeff))
    if (c <= 0) continue
    const u = termUnitComposition(cp)
    if (u) addScaled(out, u, c)
  }
  return out
}

export type LedgerRow = { el: string; left: number; right: number; ok: boolean }

export type AtomLedger = { rows: LedgerRow[]; balanced: boolean; hasRight: boolean }

/**
 * Строки счётчика по элементам в порядке появления слева, затем справа.
 * balanced — все строки сошлись и обе стороны не пусты.
 */
export function buildAtomLedger(left: Composition, right: Composition): AtomLedger {
  const order: string[] = []
  for (const s of Object.keys(left)) if (!order.includes(s)) order.push(s)
  for (const s of Object.keys(right)) if (!order.includes(s)) order.push(s)
  const rows = order.map((el) => {
    const l = left[el] ?? 0
    const r = right[el] ?? 0
    return { el, left: l, right: r, ok: l === r }
  })
  const hasRight = Object.keys(right).length > 0
  const hasLeft = Object.keys(left).length > 0
  return { rows, balanced: hasLeft && hasRight && rows.every((r) => r.ok), hasRight }
}

/** Сумма атомов частиц по элементам — для сверки частиц со счётчиком (тест). */
export function particleSetComposition(set: ReactorParticleSet): Composition {
  const out: Composition = {}
  for (const p of set.particles) for (const a of p.atoms) out[a.el] = (out[a.el] ?? 0) + 1
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Карточка атома: кто отдаёт / принимает электроны
// ─────────────────────────────────────────────────────────────────────────────

export type ElectronRole =
  | { kind: 'donor'; electrons: number }
  | { kind: 'acceptor'; electrons: number }
  | { kind: 'shares' }
  | { kind: 'none' }

/**
 * Роль атома в реакции с партнёрами по уравнению:
 *   • металл — отдаёт n e⁻ по стабильному катиону (Na → Na⁺: 1, Mg → Mg²⁺: 2);
 *   • неметалл с большей ЭО, чем у всех партнёров, и экзотермическим сродством
 *     (EA < 0) — принимает до октета |q| e⁻ (Cl⁻: 1, O²⁻: 2);
 *   • иначе (близкие ЭО) — обобществляет пары (ковалентная связь).
 */
export function electronRole(el: ElementSymbol, partners: readonly ElementSymbol[]): ElectronRole {
  const d = ATOMIC_DATA[el]
  const others = partners.filter((p) => p !== el)
  if (isMetal(el)) {
    const q = stableCationCharge(el)
    return q ? { kind: 'donor', electrons: q } : { kind: 'none' }
  }
  if (d.electronegativity == null || others.length === 0) return { kind: 'none' }
  const eo = d.electronegativity
  const otherEo = others.map((p) => ATOMIC_DATA[p].electronegativity ?? eo)
  const hasMetalPartner = others.some((p) => isMetal(p))
  const maxOther = Math.max(...otherEo)
  if (hasMetalPartner && eo > maxOther && d.electronAffinityKJ < 0) {
    const q = stableAnionCharge(el)
    return q ? { kind: 'acceptor', electrons: -q } : { kind: 'shares' }
  }
  return { kind: 'shares' }
}
