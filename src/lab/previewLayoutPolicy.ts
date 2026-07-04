import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { shouldForceSyncPreviewLayout, ATOMLAB_SYNC_BUILD_ATOM_CAP } from './atomlabPerfGuard'

export const SYNC_BUILD_ATOM_CAP = ATOMLAB_SYNC_BUILD_ATOM_CAP

export function pickLayoutAtoms(
  built: readonly ReactorPreviewAtom[],
  shell: readonly ReactorPreviewAtom[],
  editing = false,
  expectedCount = 0,
): readonly ReactorPreviewAtom[] {
  if (built.length === 0) {
    return shell.length > 0 ? shell : built
  }
  if (!editing || expectedCount <= 0) {
    return built
  }
  if (expectedCount > built.length && shell.length > built.length) {
    return shell
  }
  return built
}

export function buildPreviewLayoutForEdit(
  terms: readonly ReactorEquationTerm[],
  shell: readonly ReactorPreviewAtom[],
  editing = true,
): readonly ReactorPreviewAtom[] {
  let atomEstimate = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) atomEstimate += c
  }
  const built = buildReactorPreviewAtoms(terms, {
    tier: atomEstimate > SYNC_BUILD_ATOM_CAP ? 'lite' : 'full',
  })
  return pickLayoutAtoms(built, shell, editing, atomEstimate)
}

/** Симуляция rapid +/-: каждый шаг даёт ненулевой layout при валидных terms. */
export function simulateCoeffEditLayoutSteps(
  baseTerms: readonly ReactorEquationTerm[],
  coeffIndex: number,
  coeffRange: readonly number[],
): readonly ReactorPreviewAtom[][] {
  const steps: ReactorPreviewAtom[][] = []
  let shell: readonly ReactorPreviewAtom[] = []
  for (const coeff of coeffRange) {
    const terms = baseTerms.map((t, i) =>
      i === coeffIndex ? { ...t, coeff } : t,
    )
    const atoms = buildPreviewLayoutForEdit(terms, shell)
    steps.push([...atoms])
    if (atoms.length > 0) shell = atoms
  }
  return steps
}

export function shouldScheduleIdleLayoutRebuild(
  atomEstimate: number,
  coeffEditing: boolean,
  shellNonempty: boolean,
  forceSync: boolean,
): boolean {
  if (coeffEditing) return false
  if (forceSync || !shellNonempty) return false
  return atomEstimate > SYNC_BUILD_ATOM_CAP
}

export function estimatePreviewAtomCount(terms: readonly ReactorEquationTerm[]): number {
  let n = 0
  for (const t of terms) {
    const c = Math.floor(t.coeff)
    if (c > 0) n += c
  }
  return n
}

export function termsSignature(terms: readonly ReactorEquationTerm[]): string {
  if (!terms.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

export function shouldForceSyncLayout(atomEstimate: number, coeffEditing: boolean): boolean {
  return shouldForceSyncPreviewLayout(atomEstimate, coeffEditing)
}
