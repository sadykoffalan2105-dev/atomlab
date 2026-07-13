/**
 * Контракт стабильности синтеза — сценарии и инварианты.
 * Pure TS: используется в автотестах и runtime-guards.
 */
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { SynthesisContinuityInput, SynthesisContinuityView } from './synthesisAntiBlink'
import { resolveSynthesisContinuity } from './synthesisAntiBlink'
import { isVisualCoverageOk } from './visualCoverageController'
import { canIdleGpuPrewarm } from './synthesisPrewarmPolicy'

export type SynthesisStabilityScenario =
  | 'coeff_burst_edit'
  | 'coeff_burst_idle_gap'
  | 'balanced_idle'
  | 'synth_before_product_paint'
  | 'synth_product_handoff'
  | 'settled_handoff'

export type ScenarioExpectation = {
  previewVisible: boolean
  previewMounted: boolean
  productMesh: boolean
  productSlot: boolean
  coverageOk: boolean
  idlePrewarmOk?: boolean
}

const BASE_INPUT: Omit<
  SynthesisContinuityInput,
  'coeffEditBurst' | 'productPainted' | 'productRevealReady' | 'synthActive' | 'synthesisRunActive' | 'showSettledHero' | 'gpuPrewarmAllowed' | 'prewarmReady'
> = {
  runId: 0,
  synthesisPhase: '',
  mountReactorPreview: true,
  reactorViewOpen: true,
  productCompoundId: 'h2o',
  earlyProductReveal: false,
  forceProductSlot: false,
  keepPreviewDuringProduct: true,
  stickyMountRef: { current: null },
  previewStickyRef: { current: null },
}

export function buildScenarioInput(
  scenario: SynthesisStabilityScenario,
): SynthesisContinuityInput {
  switch (scenario) {
    case 'coeff_burst_edit':
      return {
        ...BASE_INPUT,
        synthActive: false,
        synthesisRunActive: false,
        showSettledHero: false,
        gpuPrewarmAllowed: false,
        prewarmReady: false,
        productRevealReady: false,
        productPainted: false,
        coeffEditBurst: true,
      }
    case 'coeff_burst_idle_gap':
      return {
        ...BASE_INPUT,
        synthActive: false,
        synthesisRunActive: false,
        showSettledHero: false,
        gpuPrewarmAllowed: true,
        prewarmReady: false,
        productRevealReady: false,
        productPainted: false,
        coeffEditBurst: true,
      }
    case 'balanced_idle':
      return {
        ...BASE_INPUT,
        synthActive: false,
        synthesisRunActive: false,
        showSettledHero: false,
        gpuPrewarmAllowed: false,
        prewarmReady: false,
        productRevealReady: false,
        productPainted: false,
        coeffEditBurst: false,
      }
    case 'synth_before_product_paint':
      return {
        ...BASE_INPUT,
        runId: 3,
        synthActive: true,
        synthesisRunActive: true,
        showSettledHero: false,
        gpuPrewarmAllowed: false,
        prewarmReady: false,
        productRevealReady: true,
        productPainted: false,
        forceProductSlot: true,
        coeffEditBurst: false,
      }
    case 'synth_product_handoff':
      return {
        ...BASE_INPUT,
        runId: 3,
        synthActive: true,
        synthesisRunActive: true,
        showSettledHero: false,
        gpuPrewarmAllowed: false,
        prewarmReady: true,
        productRevealReady: true,
        productPainted: true,
        forceProductSlot: true,
        coeffEditBurst: false,
      }
    case 'settled_handoff':
      return {
        ...BASE_INPUT,
        runId: 0,
        synthActive: false,
        synthesisRunActive: false,
        showSettledHero: true,
        gpuPrewarmAllowed: false,
        prewarmReady: true,
        productRevealReady: true,
        productPainted: false,
        coeffEditBurst: false,
      }
  }
}

export function expectedForScenario(scenario: SynthesisStabilityScenario): ScenarioExpectation {
  switch (scenario) {
    case 'coeff_burst_edit':
    case 'coeff_burst_idle_gap':
      return {
        previewVisible: true,
        previewMounted: true,
        productMesh: false,
        productSlot: false,
        coverageOk: true,
        idlePrewarmOk: false,
      }
    case 'balanced_idle':
      return {
        previewVisible: true,
        previewMounted: true,
        productMesh: false,
        productSlot: false,
        coverageOk: true,
        idlePrewarmOk: true,
      }
    case 'synth_before_product_paint':
      return {
        previewVisible: false,
        previewMounted: true,
        productMesh: true,
        productSlot: true,
        coverageOk: true,
      }
    case 'synth_product_handoff':
      return {
        previewVisible: false,
        previewMounted: true,
        productMesh: true,
        productSlot: true,
        coverageOk: true,
      }
    case 'settled_handoff':
      return {
        previewVisible: false,
        previewMounted: true,
        productMesh: true,
        productSlot: true,
        coverageOk: true,
      }
  }
}

export function evaluateScenario(scenario: SynthesisStabilityScenario): {
  view: SynthesisContinuityView
  coverageOk: boolean
  idlePrewarmOk: boolean
} {
  const input = buildScenarioInput(scenario)
  const view = resolveSynthesisContinuity(input)
  const editMode = scenario === 'coeff_burst_edit' || scenario === 'coeff_burst_idle_gap'
  const coverageOk = isVisualCoverageOk({
    continuity: view,
    mergeFx: false,
    convergeFx: false,
    editMode,
  })
  const idlePrewarmOk = canIdleGpuPrewarm({
    reactorOpen: true,
    coeffEditBurst: input.coeffEditBurst === true,
    coeffEditing: input.coeffEditBurst === true,
    synthesisRunActive: input.synthesisRunActive,
    hasProduct: input.productCompoundId != null,
  })
  return { view, coverageOk, idlePrewarmOk }
}

/** Не возвращать пустой layout при ненулевых terms — shell обязателен. */
export function assertLayoutShellInvariant(
  terms: readonly ReactorEquationTerm[],
  atoms: readonly unknown[],
  shell: readonly unknown[],
): boolean {
  if (terms.length === 0) return atoms.length === 0
  return atoms.length > 0 || shell.length > 0
}
