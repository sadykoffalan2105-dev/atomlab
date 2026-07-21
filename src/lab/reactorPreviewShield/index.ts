export {
  REACTOR_SHIELD,
  createShieldSnapshot,
  bumpShieldOnCoeffEdit,
  shouldBumpShieldOnPreviewFrame,
  tickShieldPhase,
  resolveShieldPhase,
  resolveShieldRenderPolicy,
  shieldAllowsCanvasRemount,
  shieldAllowsGpuCompile,
  type ShieldPhase,
  type ShieldSnapshot,
  type ShieldRenderPolicy,
} from './reactorPreviewShield'
export {
  createShieldVisibilityState,
  canHidePreview,
  shieldForceShowActiveSlots,
  shieldHideAllSlots,
  type ShieldVisibilityReason,
  type ShieldVisibilityState,
} from './shieldVisibility'
export { createSoftWebGlRecovery, isWebGlDrawingBufferAlive, type SoftWebGlRecovery } from './shieldWebgl'
