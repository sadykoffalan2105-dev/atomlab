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
  /** Полный коэффициент слагаемого (для badge ×N). */
  termCoeff?: number
  /** Индекс визуальной модели 0..shown-1. */
  visualIndex?: number
}

export type BuildReactorPreviewOptions = {
  tier?: ReactorVisualTier
}

function layoutGroupRadius(groupCount: number): number {
  return 1.05 + Math.min(groupCount, 6) * 0.14
}

function layoutMiniRadius(atomCount: number): number {
  if (atomCount <= 1) return 0
  return 0.18 + Math.min(atomCount, 10) * 0.034
}

/** Центры слагаемых на передней дуге (Cr | K | O₂) — компактно к камере. */
function groupCentersOnFrontArc(
  groupCount: number,
  radius: number,
): Array<[number, number, number]> {
  if (groupCount <= 0) return []
  if (groupCount === 1) return [[0, 0.12, 0.24]]
  const span = (158 * Math.PI) / 180
  const start = -Math.PI / 2 - span / 2
  return Array.from({ length: groupCount }, (_, i) => {
    const t = i / (groupCount - 1)
    const a = start + t * span
    const x = Math.sin(a) * radius
    const z = Math.cos(a) * radius * 0.48 + 0.18
    const y = 0.1 + Math.sin(a * 0.42) * 0.035
    return [x, y, z] as [number, number, number]
  })
}

/** Мини-дуга внутри кластера (для 7 O — не плотное кольцо). */
function miniAtomOffset(
  atomIndex: number,
  atomCount: number,
  miniR: number,
): [number, number, number] {
  if (atomCount <= 1) return [0, 0, 0]
  if (atomCount === 2) {
    const x = atomIndex === 0 ? -miniR : miniR
    return [x, 0, 0]
  }
  const useArc = atomCount >= 5
  const span = useArc ? (110 * Math.PI) / 180 : Math.PI * 2
  const start = useArc ? -span / 2 : -Math.PI / 2
  const t = atomCount === 1 ? 0 : atomIndex / (atomCount - 1)
  const a = start + t * span
  return [Math.sin(a) * miniR, Math.cos(a) * miniR * 0.2, Math.cos(a) * miniR * 0.1]
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
  const groupR = layoutGroupRadius(activeTerms.length)
  const centers = groupCentersOnFrontArc(activeTerms.length, groupR)
  const out: ReactorPreviewAtom[] = []

  activeTerms.forEach((term, gi) => {
    const c = Math.max(0, Math.floor(term.coeff))
    const shown = previewModelsForTerm(c, tier, activeTerms.length)
    const [cx, cy, cz] = centers[gi] ?? [0, 0.12, 0.24]
    const miniR = layoutMiniRadius(shown)

    for (let ai = 0; ai < shown; ai++) {
      const [ox, oy, oz] = miniAtomOffset(ai, shown, miniR)
      out.push({
        z: term.z,
        pos: [cx + ox, cy + oy, cz + oz],
        termIndex: gi,
        atomInTerm: ai,
        termCoeff: c,
        visualIndex: ai,
      })
    }
  })

  const expectedFull = expandLeftTermsToPreviewSlots(terms).length
  if (tier === 'full' && out.length !== expectedFull && expectedFull > 0) {
    const slots = expandLeftTermsToPreviewSlots(terms)
    const n = slots.length
    const r = 0.55 + Math.min(n, 12) * 0.06
    return slots.map((z, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
      return {
        z,
        pos: [Math.cos(a) * r, 0.12 + Math.sin(a * 0.5) * 0.04, 0.2 + Math.sin(a) * r * 0.35] as [
          number,
          number,
          number,
        ],
        termIndex: 0,
        atomInTerm: i,
      }
    })
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

export function reactorPreviewAtomScale(
  totalAtoms: number,
  base = PREVIEW_BASE_ATOM_SCALE,
): number {
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  const countFactor = clamp(11 / Math.max(11, totalAtoms), 0.62, 1)
  const denseBoost = totalAtoms > 14 ? 0.94 : 1
  return Math.max(PREVIEW_MIN_ATOM_SCALE, base * countFactor * denseBoost)
}

/** Центр реакции в лабораторной сцене (совпадает с SynthesisConvergeStreams). */
export const REACTION_CENTER: [number, number, number] = [0, 0.12, 0]

/** Множитель «отдаления» стартовых точек полёта от превью-кластеров. */
export const SYNTHESIS_APPROACH_SPREAD = 1.92

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
  spread = SYNTHESIS_APPROACH_SPREAD,
): ReactorPreviewAtom[] {
  return buildReactorPreviewAtoms(terms).map((a) => ({
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
