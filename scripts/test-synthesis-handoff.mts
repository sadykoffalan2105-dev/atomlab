import assert from 'node:assert/strict'
import { resolveSynthesisProductSlot } from '../src/lab/synthesisProductSlot.ts'
import { resolveSynthesisContinuity } from '../src/lab/synthesisAntiBlink.ts'
import { LAB_COSMIC_BG } from '../src/components/lab/LabSynthesisCosmicBackdrop.tsx'

function mockSticky<T>(initial: T | null = null) {
  return { current: initial }
}

{
  // Cold run right after coeff edit: Bohr stays, product micro-prewarm only.
  const stickyMountRef = mockSticky(null)
  const previewStickyRef = mockSticky(null)
  const view = resolveSynthesisContinuity({
    runId: 7,
    synthActive: true,
    synthesisRunActive: true,
    synthesisPhase: 'product',
    showSettledHero: false,
    mountReactorPreview: true,
    reactorViewOpen: true,
    gpuPrewarmAllowed: true,
    prewarmReady: false,
    productCompoundId: 'salt_k2cr2o7',
    earlyProductReveal: true,
    forceProductSlot: true,
    productRevealReady: false,
    productPainted: false,
    keepPreviewDuringProduct: true,
    coeffEditBurst: false,
    coeffEditing: false,
    allowIdleProductPrewarm: true,
    stickyMountRef,
    previewStickyRef,
  })
  assert.equal(view.reactorPreviewVisible, true, 'synth start: Bohr visible until paint')
  assert.equal(view.productMeshMounted, true, 'synth start: product mesh mounts')
  assert.equal(view.productSlotVisible, false, 'synth start: full slot waits reveal/GPU')
}

{
  type CompoundDef = import('../src/types/chemistry.ts').CompoundDef
  const compound = { id: 'nacl' } as CompoundDef
  const cold = resolveSynthesisProductSlot({
    productForSlot: compound,
    productSlotVisible: true,
    productPrewarmActive: true,
    showSettledHero: false,
    synthLive: true,
    prewarmReady: false,
    prewarmCompoundId: null,
  })
  assert.equal(cold.visible, false)
  assert.equal(cold.prewarm, true)
}

{
  // Clear color must stay cosmic — no red/near-black jump.
  assert.equal(LAB_COSMIC_BG, '#0a0c18')
}

console.log('test-synthesis-handoff: all passed')
