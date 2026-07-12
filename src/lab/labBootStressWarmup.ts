import type { CompoundDef } from '../types/chemistry'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { simulateCoeffEditLayoutSteps } from './previewLayoutPolicy'
import { buildPreviewLayoutWasmSync } from '../wasm/reactorPreviewLayoutWasm'
import { compoundById } from '../data/compounds'

/** Типичное тяжёлое уравнение K₂Cr₂O₇ (4 Cr + 4 K + 7 O₂). */
export const K2CR2O7_PREVIEW_TERMS: ReactorEquationTerm[] = [
  { id: 'cr', z: 24, coeff: 4 },
  { id: 'k', z: 19, coeff: 4 },
  { id: 'o2', z: 8, coeff: 7, diatomic: true },
]

/** Быстрая симуляция rapid +/- на boot — прогревает layout-кэш и WASM. */
export function warmupDichromateCoeffStress(): void {
  const base = K2CR2O7_PREVIEW_TERMS

  buildReactorPreviewAtoms(base, { tier: 'full' })
  buildReactorPreviewAtoms(base, { tier: 'lite' })
  buildPreviewLayoutWasmSync(base, 'full')
  buildPreviewLayoutWasmSync(base, 'lite')

  for (let ti = 0; ti < base.length; ti++) {
    const term = base[ti]!
    const c0 = Math.max(1, Math.floor(term.coeff))
    const range: number[] = []
    for (let c = Math.max(1, c0 - 2); c <= c0 + 2; c++) range.push(c)
    simulateCoeffEditLayoutSteps(base, ti, range)
  }

  // Соседние «школьные» тяжёлые уравнения
  const variants: ReactorEquationTerm[][] = [
    [
      { id: 'cr', z: 24, coeff: 3 },
      { id: 'k', z: 19, coeff: 3 },
      { id: 'o2', z: 8, coeff: 5, diatomic: true },
    ],
    [
      { id: 'cr', z: 24, coeff: 5 },
      { id: 'k', z: 19, coeff: 5 },
      { id: 'o2', z: 8, coeff: 8, diatomic: true },
    ],
  ]
  for (const terms of variants) {
    buildPreviewLayoutWasmSync(terms, 'lite')
    simulateCoeffEditLayoutSteps(terms, 0, [2, 3, 4, 5])
  }
}

/** Подгрузка геометрии продукта и lab-chunks для cold-start синтеза. */
export async function warmupDichromateProductAssets(): Promise<void> {
  const compound = compoundById.salt_k2cr2o7
  if (!compound) return
  void compound
  await Promise.all([
    import('../components/lab/CatalogSubstanceDisplay'),
    import('../components/lab/MoleculeMesh').catch(() => undefined),
    import('../chemistry/catalogGeometryOverrides'),
  ])
}

export function getDichromateCompound(): CompoundDef | undefined {
  return compoundById.salt_k2cr2o7
}
