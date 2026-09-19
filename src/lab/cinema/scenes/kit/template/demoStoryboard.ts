import * as THREE from 'three'
import { sampleScalar, sampleVec3, type ScalarTrack, type Vec3Track } from '../../../core/tracks'
import { bondLength, speciesRadius } from '../cpkAtoms'
import {
  appearTrack,
  createLabelStates,
  defineSceneTiming,
  fadeTrack,
  rampTrack,
  sampleLabels,
  validateTracks,
  type SceneFinish,
  type SceneLabelDef,
  type SceneLabelState,
  type SceneStep,
} from '../sceneKit'

/**
 * ШАБЛОН СЦЕНЫ (H₂ + Cl₂ → 2 HCl, три шага) — рабочий, но нарочно крошечный:
 * его копируют и наращивают до шести шагов. Показывает весь обязательный минимум:
 * шаги, cue'ы контракта лаборатории, дорожки, кадр без аллокаций, проверки.
 *
 * Химия — из src/chemistry/data: длины связей H–H 74.1 пм, Cl–Cl 198.8 пм,
 * H–Cl 127.5 пм, радиусы ковалентные. Простые вещества — ДВУХАТОМНЫЕ молекулы.
 */

export const DEMO_STEP_IDS = ['reactants', 'exchange', 'product'] as const
export type DemoStepId = (typeof DEMO_STEP_IDS)[number]
export type DemoCueId = 'swap' | 'embryo' | 'birth' | 'complete'

const STEPS: readonly SceneStep<DemoStepId>[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.5, ease: 'power1.inOut' },
  { id: 'exchange', from: 4, to: 9, wall: 6.0, ease: 'sine.inOut' },
  { id: 'product', from: 9, to: 13, wall: 4.5, ease: 'power1.inOut' },
]

export const DEMO_FINISH: SceneFinish = { from: 13, to: 13.8, wall: 1.2, ease: 'power2.in' }

export const DEMO_TIMING = defineSceneTiming<DemoStepId, DemoCueId>({
  steps: STEPS,
  finish: DEMO_FINISH,
  cues: [
    { at: 6.5, id: 'swap' },
    { at: 13.2, id: 'embryo' },
    { at: 13.5, id: 'birth' },
    { at: DEMO_FINISH.to, id: 'complete' },
  ],
})

export type DemoAtomId = 'h1' | 'h2' | 'cl1' | 'cl2'

export const DEMO_ATOMS: readonly { id: DemoAtomId; el: 'H' | 'Cl' }[] = [
  { id: 'h1', el: 'H' },
  { id: 'h2', el: 'H' },
  { id: 'cl1', el: 'Cl' },
  { id: 'cl2', el: 'Cl' },
]

const HH = bondLength('H-H') / 2
const CC = bondLength('Cl-Cl') / 2
const HCL = bondLength('H-Cl')

const POS: Record<DemoAtomId, Vec3Track> = {
  h1: [
    { t: 0, v: [-1.6, HH, 0] },
    { t: 4, v: [-1.4, HH, 0], ease: 'smooth' },
    { t: 9, v: [-HCL, 0.6, 0], ease: 'smooth' },
  ],
  h2: [
    { t: 0, v: [-1.6, -HH, 0] },
    { t: 4, v: [-1.4, -HH, 0], ease: 'smooth' },
    { t: 9, v: [-HCL, -0.6, 0], ease: 'smooth' },
  ],
  cl1: [
    { t: 0, v: [1.6, CC, 0] },
    { t: 4, v: [1.4, CC, 0], ease: 'smooth' },
    { t: 9, v: [0, 0.6, 0], ease: 'smooth' },
  ],
  cl2: [
    { t: 0, v: [1.6, -CC, 0] },
    { t: 4, v: [1.4, -CC, 0], ease: 'smooth' },
    { t: 9, v: [0, -0.6, 0], ease: 'smooth' },
  ],
}

const RADIUS = {
  H: speciesRadius('H', 0),
  Cl: speciesRadius('Cl', 0),
}

const ZOOM: ScalarTrack = [
  { t: 0, v: 0.9 },
  { t: 9, v: 1.05, ease: 'smooth' },
]
const EXO = appearTrack(9.2, 0.8)
const FADE = fadeTrack(DEMO_FINISH)
const GLOW = rampTrack(4, 0, 6.5, 1, 'smooth')

const LABELS: readonly SceneLabelDef[] = [
  { id: 'h2', kind: 'species', dy: 0.24, keys: [{ t: 0, text: 'H₂ (g)' }], windows: [[0.6, 6.4]] },
  { id: 'cl2', kind: 'species', dy: 0.24, keys: [{ t: 0, text: 'Cl₂ (g)' }], windows: [[0.6, 6.4]] },
  { id: 'hcl', kind: 'species', dy: 0.9, keys: [{ t: 0, text: '2 HCl (g)' }], windows: [[9.4, 13.4]] },
]

export type DemoFrame = {
  atoms: Record<DemoAtomId, THREE.Vector3>
  radius: Record<DemoAtomId, number>
  center: THREE.Vector3
  exo: number
  fade: number
  glow: number
  labels: SceneLabelState[]
  camera: { zoom: number }
}

export function createDemoFrame(): DemoFrame {
  const atoms = {} as Record<DemoAtomId, THREE.Vector3>
  const radius = {} as Record<DemoAtomId, number>
  for (const a of DEMO_ATOMS) {
    atoms[a.id] = new THREE.Vector3()
    radius[a.id] = RADIUS[a.el]
  }
  return {
    atoms,
    radius,
    center: new THREE.Vector3(),
    exo: 0,
    fade: 0,
    glow: 0,
    labels: createLabelStates(LABELS),
    camera: { zoom: 1 },
  }
}

export function sampleDemoFrame(t: number, frame: DemoFrame): DemoFrame {
  for (const a of DEMO_ATOMS) sampleVec3(POS[a.id], t, frame.atoms[a.id])
  frame.exo = sampleScalar(EXO, t)
  frame.fade = sampleScalar(FADE, t)
  frame.glow = sampleScalar(GLOW, t)
  frame.camera.zoom = sampleScalar(ZOOM, t)
  frame.center.copy(frame.atoms.h1).add(frame.atoms.cl1).multiplyScalar(0.5)

  sampleLabels(LABELS, frame.labels, t, (def, st) => {
    if (def.id === 'h2') st.pos.copy(frame.atoms.h1).lerp(frame.atoms.h2, 0.5)
    else if (def.id === 'cl2') st.pos.copy(frame.atoms.cl1).lerp(frame.atoms.cl2, 0.5)
    else st.pos.copy(frame.center)
    st.pos.y += def.dy
  }, frame.fade)
  return frame
}

export function validateDemoStoryboard(): void {
  validateTracks({ ...POS, ZOOM, EXO, FADE, GLOW })
  DEMO_TIMING.validate()
}
