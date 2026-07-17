import type { PreviewFramePolicy } from './previewFramePolicy'

/** Удержание pin/lockVisualTier после последнего горячего +/- (оседание коэффициентов). */
export const PREVIEW_SETTLE_PIN_MS = 1200

/** Продлить settle-окно, пока идёт hot edit. */
export function bumpSettlePinUntil(
  hotCoeffEdit: boolean,
  nowMs: number,
  untilMs: number,
): number {
  if (!hotCoeffEdit) return untilMs
  return Math.max(untilMs, nowMs + PREVIEW_SETTLE_PIN_MS)
}

export function isSettlePinActive(nowMs: number, untilMs: number): boolean {
  return untilMs > 0 && nowMs < untilMs
}

/**
 * После отпускания +/- ещё держим pin + lockVisualTier,
 * чтобы слоты не остались THREE.visible=false и Bohr не remount'ился на idle.
 */
export function withSettlePinPolicy(
  policy: PreviewFramePolicy,
  settlePin: boolean,
  groupVisible: boolean,
): PreviewFramePolicy {
  if (!settlePin || !groupVisible || policy.flightActive) return policy
  if (policy.pinEveryFrame && policy.lockVisualTier) return policy
  return {
    ...policy,
    pinEveryFrame: true,
    lockVisualTier: true,
  }
}
