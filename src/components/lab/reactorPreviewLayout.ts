import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { expandLeftTermsToPreviewSlots } from '../../chemistry/reactorEquationBalance'
import {
  getReactorVisualTier,
  previewModelsForTerm,
  type ReactorVisualTier,
} from '../../chemistry/reactorVisualTier'
import { getCachedPreviewAtoms } from '../../lab/reactorPreviewLayoutCache'

export type ReactorPreviewAtom = {
  z: number
  pos: [number, number, number]
  termIndex: number
  atomInTerm: number
  /** Стабильный id слагаемого — для React key / без remount при +/- других членов. */
  termId?: string
  /** Полный коэффициент слагаемого (для badge ×N). */
  termCoeff?: number
  /** Индекс визуальной модели 0..shown-1. */
  visualIndex?: number
}

export type BuildReactorPreviewOptions = {
  tier?: ReactorVisualTier
}

/**
 * Минимальный зазор между центрами атомов (мир. ед.).
 * Ниже ~0.45 Bohr-модели визуально сливаются → «пропали».
 */
export const PREVIEW_ATOM_MIN_GAP = 0.52

/** Сколько атомов на каждом кольце (центр → наружу): 1, 6, 12, 18… */
export function previewClusterRingCounts(atomCount: number): number[] {
  const n = Math.max(0, Math.floor(atomCount))
  if (n <= 0) return []
  if (n <= 8) return [n]
  const rings: number[] = [1]
  let left = n - 1
  let ring = 1
  while (left > 0) {
    const cap = ring * 6
    const take = Math.min(left, cap)
    rings.push(take)
    left -= take
    ring += 1
  }
  return rings
}

/** Радиус внешнего кольца кластера при заданном зазоре. */
export function layoutMiniRadius(atomCount: number, gap = PREVIEW_ATOM_MIN_GAP): number {
  if (atomCount <= 1) return 0
  if (atomCount === 2) return gap * 0.5 / 0.62
  if (atomCount <= 8) {
    // chord = 2 r sin(π/n) ≥ gap
    return gap / (2 * Math.sin(Math.PI / atomCount))
  }
  const rings = previewClusterRingCounts(atomCount)
  return gap * Math.max(0, rings.length - 1)
}

function layoutGroupRadius(groupCount: number, maxClusterSize: number): number {
  const base = 1.28 + Math.min(groupCount, 6) * 0.2
  if (groupCount <= 1) return base
  const clusterR = layoutMiniRadius(maxClusterSize)
  // Центр-к-центру ≥ 2·R_кластера + gap, с учётом эллиптической дуги (z×0.52).
  const needSep = 2 * clusterR + PREVIEW_ATOM_MIN_GAP
  const span = (172 * Math.PI) / 180
  const dTheta = span / Math.max(1, groupCount - 1)
  const arcZ = 0.52
  const rFromSep = needSep / (2 * Math.max(0.2, arcZ * Math.sin(dTheta / 2)))
  return Math.max(base, rFromSep)
}

/** Центры слагаемых на передней дуге (Cr | K | O₂) — компактно к камере. */
function groupCentersOnFrontArc(
  groupCount: number,
  radius: number,
): Array<[number, number, number]> {
  if (groupCount <= 0) return []
  if (groupCount === 1) return [[0, 0.12, 0.24]]
  const span = (172 * Math.PI) / 180
  const start = -Math.PI / 2 - span / 2
  return Array.from({ length: groupCount }, (_, i) => {
    const t = i / (groupCount - 1)
    const a = start + t * span
    const x = Math.sin(a) * radius
    const z = Math.cos(a) * radius * 0.52 + 0.22
    const y = 0.12 + Math.sin(a * 0.38) * 0.04
    return [x, y, z] as [number, number, number]
  })
}

/**
 * Позиция атома внутри кластера.
 * ≤8 — одно кольцо с гарантированным chord; >8 — концентрические кольца (без наложения).
 * Упаковка в плоскости XZ без сжатия оси — иначе «эллипс» схлопывает зазор к центру.
 */
function miniAtomOffset(
  atomIndex: number,
  atomCount: number,
  miniR: number,
  gap = PREVIEW_ATOM_MIN_GAP,
): [number, number, number] {
  if (atomCount <= 1) return [0, 0, 0]
  if (atomCount === 2) {
    const x = atomIndex === 0 ? -miniR * 0.62 : miniR * 0.62
    return [x, 0, 0]
  }
  if (atomCount <= 8) {
    const a = (atomIndex / atomCount) * Math.PI * 2 - Math.PI / 2
    // Лёгкий Y-сдвиг для читаемости, XY/XZ-расстояние = miniR (gap).
    const y = (atomIndex % 2) * 0.02
    return [Math.cos(a) * miniR, y, Math.sin(a) * miniR]
  }

  const rings = previewClusterRingCounts(atomCount)
  let idx = atomIndex
  let ringI = 0
  while (ringI < rings.length && idx >= rings[ringI]!) {
    idx -= rings[ringI]!
    ringI += 1
  }
  const countOnRing = rings[ringI] ?? 1
  if (ringI === 0 && countOnRing === 1) return [0, 0, 0]

  const r = gap * ringI
  const a =
    (idx / Math.max(1, countOnRing)) * Math.PI * 2 - Math.PI / 2 + ringI * 0.12
  const y = (ringI % 2 === 0 ? 0 : 0.028) + (idx % 2) * 0.014
  return [Math.cos(a) * r, y, Math.sin(a) * r]
}

/** Мин. расстояние между центрами атомов (для тестов / диагностики). */
export function previewAtomsMinPairDistance(
  atoms: readonly { pos: [number, number, number] }[],
): number {
  if (atoms.length < 2) return Infinity
  let min = Infinity
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]!.pos
    for (let j = i + 1; j < atoms.length; j++) {
      const b = atoms[j]!.pos
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      if (d < min) min = d
    }
  }
  return min
}

/**
 * 4 Cr + 4 K + 7 O₂ → 15 моделей в трёх отдельных кластерах (O₂: один атом на коэффициент).
 * Для превью нельзя использовать expandLeftTermsToZSlots (удваивает O₂).
 */
export function buildReactorPreviewAtoms(
  terms: readonly ReactorEquationTerm[],
  opts?: BuildReactorPreviewOptions,
): ReactorPreviewAtom[] {
  const tier = opts?.tier ?? getReactorVisualTier(terms)
  return getCachedPreviewAtoms(terms, tier, () => buildReactorPreviewAtomsUncached(terms, tier))
}

function buildReactorPreviewAtomsUncached(
  terms: readonly ReactorEquationTerm[],
  tier: ReactorVisualTier,
): ReactorPreviewAtom[] {
  const activeTerms = terms.filter((t) => Math.floor(t.coeff) > 0)
  const shownPerTerm = activeTerms.map((term) =>
    previewModelsForTerm(Math.max(0, Math.floor(term.coeff)), tier, activeTerms.length),
  )
  const maxCluster = shownPerTerm.reduce((m, n) => Math.max(m, n), 0)
  const groupR = layoutGroupRadius(activeTerms.length, maxCluster)
  const centers = groupCentersOnFrontArc(activeTerms.length, groupR)
  const out: ReactorPreviewAtom[] = []

  activeTerms.forEach((term, gi) => {
    const c = Math.max(0, Math.floor(term.coeff))
    const shown = shownPerTerm[gi] ?? 0
    const [cx, cy, cz] = centers[gi] ?? [0, 0.12, 0.24]
    const miniR = layoutMiniRadius(shown)

    for (let ai = 0; ai < shown; ai++) {
      const [ox, oy, oz] = miniAtomOffset(ai, shown, miniR)
      out.push({
        z: term.z,
        pos: [cx + ox, cy + oy, cz + oz],
        termIndex: gi,
        atomInTerm: ai,
        termId: term.id,
        termCoeff: c,
        visualIndex: ai,
      })
    }
  })

  const expectedFull = expandLeftTermsToPreviewSlots(terms).length
  if (tier === 'full' && out.length !== expectedFull && expectedFull > 0) {
    const n = expectedFull
    const gap = PREVIEW_ATOM_MIN_GAP
    const flat: ReactorPreviewAtom[] = []
    let i = 0
    for (let ti = 0; ti < activeTerms.length; ti++) {
      const term = activeTerms[ti]!
      const c = Math.max(0, Math.floor(term.coeff))
      for (let ai = 0; ai < c; ai++) {
        // Vogel/sunflower — равномерная упаковка без наложений при fallback.
        const a = i * Math.PI * (3 - Math.sqrt(5))
        const r = gap * Math.sqrt(i + 0.35)
        flat.push({
          z: term.z,
          pos: [
            Math.cos(a) * r,
            0.12 + (i % 3) * 0.02,
            0.2 + Math.sin(a) * r,
          ],
          termIndex: ti,
          atomInTerm: ai,
          termId: term.id,
          termCoeff: c,
          visualIndex: ai,
        })
        i++
      }
    }
    void n
    return flat
  }

  return out
}

/** Те же позиции, что превью — для сходящегося полёта при синтезе (без кольца). */
export function buildSynthesisConvergeAtoms(
  terms: readonly ReactorEquationTerm[],
  opts?: BuildReactorPreviewOptions,
): ReactorPreviewAtom[] {
  return buildReactorPreviewAtoms(terms, opts)
}

export type TermGroupCenter = {
  z: number
  termIndex: number
  pos: [number, number, number]
}

/** Центры кластеров (по одному на слагаемое) — для потоков синтеза без шаров. */
export function getTermGroupCenters(terms: readonly ReactorEquationTerm[]): TermGroupCenter[] {
  const atoms = buildReactorPreviewAtoms(terms)
  const buckets = new Map<number, ReactorPreviewAtom[]>()
  for (const a of atoms) {
    const list = buckets.get(a.termIndex) ?? []
    list.push(a)
    buckets.set(a.termIndex, list)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([termIndex, arr]) => {
      const n = arr.length
      const cx = arr.reduce((s, a) => s + a.pos[0], 0) / n
      const cy = arr.reduce((s, a) => s + a.pos[1], 0) / n
      const cz = arr.reduce((s, a) => s + a.pos[2], 0) / n
      return { z: arr[0]!.z, termIndex, pos: [cx, cy, cz] as [number, number, number] }
    })
}

export const PREVIEW_BASE_ATOM_SCALE = 0.88
export const PREVIEW_MIN_ATOM_SCALE = 0.58
/** v1.2.0: fixed visual scale — coeff drives instance count, not size. */
export const PREVIEW_ATOM_SCALE = PREVIEW_BASE_ATOM_SCALE

export function reactorPreviewAtomScale(
  totalAtoms: number,
  base = PREVIEW_ATOM_SCALE,
): number {
  void totalAtoms
  return base
}

/** Центр реакции в лабораторной сцене (совпадает с SynthesisConvergeStreams). */
export const REACTION_CENTER: [number, number, number] = [0, 0.12, 0]

/** Множитель «отдаления» стартовых точек полёта от превью-кластеров. */
export const SYNTHESIS_APPROACH_SPREAD = 2.35

export function scalePositionOutwardFromCenter(
  pos: [number, number, number],
  center: [number, number, number],
  spread: number,
): [number, number, number] {
  const [px, py, pz] = pos
  const [cx, cy, cz] = center
  return [
    cx + (px - cx) * spread,
    cy + (py - cy) * spread + (spread > 1 ? 0.035 : 0),
    cz + (pz - cz) * spread + 0.1,
  ]
}

/** Стартовые позиции каждого атома — дальше от центра, чем в превью. */
export function buildSynthesisApproachAtoms(
  terms: readonly ReactorEquationTerm[],
  opts?: { spread?: number; tier?: import('../../chemistry/reactorVisualTier').ReactorVisualTier },
): ReactorPreviewAtom[] {
  const spread = opts?.spread ?? SYNTHESIS_APPROACH_SPREAD
  const tier = opts?.tier
  return buildReactorPreviewAtoms(terms, tier ? { tier } : undefined).map((a) => ({
    ...a,
    pos: scalePositionOutwardFromCenter(a.pos, REACTION_CENTER, spread),
  }))
}

/** Центры слагаемых на дуге подхода (цветные лучи). */
export function getTermApproachOrigins(
  terms: readonly ReactorEquationTerm[],
  spread = SYNTHESIS_APPROACH_SPREAD,
): TermGroupCenter[] {
  return getTermGroupCenters(terms).map((c) => ({
    ...c,
    pos: scalePositionOutwardFromCenter(c.pos, REACTION_CENTER, spread),
  }))
}

export function synthesisFlyAtomScale(totalAtoms: number, base = 0.34): number {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  return base * clamp(5 / Math.max(5, totalAtoms), 0.22, 1)
}
