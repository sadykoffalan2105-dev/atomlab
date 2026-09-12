import { compoundById } from '../data/compounds'
import { getElementBySymbol } from '../data/elements'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { PREVIEW_ATOM_MIN_GAP } from '../components/lab/reactorPreviewLayout'

export type ReactorMoleculeAtom = { z: number; pos: [number, number, number] }
export type ReactorMoleculeBond = readonly [number, number]

export type ReactorMoleculeTemplate = {
  atoms: readonly ReactorMoleculeAtom[]
  bonds: readonly ReactorMoleculeBond[]
}

/** Больше атомов в термине — читаемого бонда в компактном превью уже не получится. */
const MAX_TEMPLATE_ATOMS = 6

/**
 * Целевая длина самой короткой связи после нормализации — тот же масштаб,
 * что и минимальный безопасный зазор между центрами Bohr-моделей в реакторе
 * (PREVIEW_ATOM_MIN_GAP): ниже атомы визуально сливаются, выше кластер
 * термина раздувается и наезжает на соседний.
 */
const TARGET_BOND_LENGTH = PREVIEW_ATOM_MIN_GAP
/** Жёсткий потолок на габарит кластера — даже если связей нет (напр. NaCl). */
const MAX_TEMPLATE_RADIUS = PREVIEW_ATOM_MIN_GAP * 1.35

function centerAndScale(
  rawAtoms: readonly ReactorMoleculeAtom[],
  bonds: readonly ReactorMoleculeBond[],
): readonly ReactorMoleculeAtom[] {
  if (rawAtoms.length <= 1) return rawAtoms.map((a) => ({ z: a.z, pos: [0, 0, 0] }))

  const cx = rawAtoms.reduce((s, a) => s + a.pos[0], 0) / rawAtoms.length
  const cy = rawAtoms.reduce((s, a) => s + a.pos[1], 0) / rawAtoms.length
  const cz = rawAtoms.reduce((s, a) => s + a.pos[2], 0) / rawAtoms.length
  const centered = rawAtoms.map((a) => ({
    z: a.z,
    pos: [a.pos[0] - cx, a.pos[1] - cy, a.pos[2] - cz] as [number, number, number],
  }))

  const dist = (i: number, j: number) => {
    const [ax, ay, az] = centered[i]!.pos
    const [bx, by, bz] = centered[j]!.pos
    return Math.hypot(ax - bx, ay - by, az - bz)
  }

  let minBond = Infinity
  for (const [i, j] of bonds) {
    if (centered[i] && centered[j]) minBond = Math.min(minBond, dist(i, j))
  }
  const boundingRadius = centered.reduce(
    (m, a) => Math.max(m, Math.hypot(a.pos[0], a.pos[1], a.pos[2])),
    0,
  )
  if (boundingRadius < 1e-4) return centered

  // Калибруемся по самой короткой связи (реальная химия читается лучше всего),
  // но никогда не раздуваем кластер сверх MAX_TEMPLATE_RADIUS — иначе термин
  // наезжает на соседний в дуге groupCentersOnFrontArc (напр. далёкий ионный
  // Na в хлорите).
  const byBond = Number.isFinite(minBond) ? TARGET_BOND_LENGTH / minBond : Infinity
  const byRadius = MAX_TEMPLATE_RADIUS / boundingRadius
  const scale = Math.min(byBond, byRadius)

  return centered.map((a) => ({
    z: a.z,
    pos: [a.pos[0] * scale, a.pos[1] * scale, a.pos[2] * scale] as [number, number, number],
  }))
}

/**
 * Реальная (нормализованная под масштаб превью-кластера) мини-молекула для
 * слагаемого уравнения — атомы формулы на своих местах и связи между ними,
 * вместо N одинаковых шаров одного «заглавного» элемента.
 *
 * null — показывать нечего сверх обычного одиночного атома: простое вещество
 * без диатомной пары (школьный маршрут, напр. просто Na) или термин, чья
 * геометрия слишком велика/не найдена для компактного превью.
 */
export function resolveReactorTermMolecule(
  term: ReactorEquationTerm,
): ReactorMoleculeTemplate | null {
  if (term.compoundId) {
    const compound = compoundById[term.compoundId]
    if (!compound || compound.atoms.length < 2 || compound.atoms.length > MAX_TEMPLATE_ATOMS) {
      return null
    }
    const raw: ReactorMoleculeAtom[] = []
    for (const a of compound.atoms) {
      const el = getElementBySymbol(a.symbol)
      if (!el) return null
      raw.push({ z: el.z, pos: [a.pos[0], a.pos[1], a.pos[2]] })
    }
    return { atoms: centerAndScale(raw, compound.bonds), bonds: compound.bonds }
  }

  if (term.diatomic) {
    const half = TARGET_BOND_LENGTH / 2
    return {
      atoms: [
        { z: term.z, pos: [-half, 0, 0] },
        { z: term.z, pos: [half, 0, 0] },
      ],
      bonds: [[0, 1]],
    }
  }

  return null
}

/**
 * Индексы слагаемых (в порядке активных терминов, coeff>0), для которых есть
 * настоящая геометрия молекулы — ReactorTermsPreview рендерит их через
 * ReactorTermMoleculeOverlay вместо обычных N одинаковых Bohr-шаров и должен
 * скрыть свои слоты для этих терминов, чтобы не показать оба варианта разом.
 */
export function reactorTermsWithMolecule(
  terms: readonly ReactorEquationTerm[],
): ReadonlySet<number> {
  const activeTerms = terms.filter((t) => Math.floor(t.coeff) > 0)
  const out = new Set<number>()
  activeTerms.forEach((term, i) => {
    if (resolveReactorTermMolecule(term)) out.add(i)
  })
  return out
}
