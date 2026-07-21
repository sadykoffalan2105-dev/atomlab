/**
 * ReactorPreviewShield — собственный движок защиты превью синтеза.
 *
 * Инварианты (нельзя нарушать):
 * 1. При pre-synth / +/- атомы на экране каждый кадр (THREE.visible=true для 0..n-1).
 * 2. Электроны всегда анимируются (previewStatic=false).
 * 3. Canvas НЕ remount'ится из‑за context loss во время/после edit.
 * 4. Пул слотов ≥ expected синхронно (нет «дыр» на rapid +/-).
 * 5. Visual tier (lite/full) не дёргается на каждом клике.
 */

export const REACTOR_SHIELD = {
  /** Pin + lock после последнего +/- (мс). */
  settleMs: 1200,
  /** Запрет GPU-compile после edit (мс). */
  gpuCooldownMs: 2200,
  /** Полный запрет Canvas remount после edit (мс) — кроме hard recovery мёртвого WebGL. */
  remountBanMs: 8000,
  /**
   * Soft recover предпочтителен; если context не вернулся за hardRecoverAfterMs —
   * разрешаем один remount (иначе вечный белый canvas / «битая картинка»).
   */
  softRecoverOnly: true,
  /** Ждать soft restore дольше на dichromate GPU hitch; потом remount. */
  hardRecoverAfterMs: 2800,
  /** Плотное уравнение (дихромат и т.п.) — сразу lite, без flip-flop. */
  denseLiteFromAtoms: 10,
} as const

export type ShieldPhase = 'idle' | 'hot' | 'settle' | 'cooldown'

export type ShieldSnapshot = {
  phase: ShieldPhase
  hotUntil: number
  settleUntil: number
  gpuBanUntil: number
  remountBanUntil: number
  /** Sticky lite: один раз включили — не снимаем до длинного idle. */
  stickyLite: boolean
}

export type ShieldRenderPolicy = {
  phase: ShieldPhase
  pinEveryFrame: boolean
  lockVisualTier: boolean
  /** Всегда true в pre-synth при atomCount>0. */
  electronAnimate: boolean
  /** Всегда false в зоне щита — иначе орбиты «замирают». */
  previewStatic: false
  forceLite: boolean
  allowGpuCompile: boolean
  allowCanvasRemount: boolean
  syncPoolImmediate: boolean
}

export function createShieldSnapshot(): ShieldSnapshot {
  return {
    phase: 'idle',
    hotUntil: 0,
    settleUntil: 0,
    gpuBanUntil: 0,
    remountBanUntil: 0,
    stickyLite: false,
  }
}

export function bumpShieldOnCoeffEdit(
  snap: ShieldSnapshot,
  nowMs: number,
  atomCount: number,
): ShieldSnapshot {
  const hotUntil = nowMs + 480
  const settleUntil = Math.max(snap.settleUntil, nowMs + REACTOR_SHIELD.settleMs)
  const gpuBanUntil = Math.max(snap.gpuBanUntil, nowMs + REACTOR_SHIELD.gpuCooldownMs)
  const remountBanUntil = Math.max(snap.remountBanUntil, nowMs + REACTOR_SHIELD.remountBanMs)
  const stickyLite =
    snap.stickyLite || atomCount >= REACTOR_SHIELD.denseLiteFromAtoms
  return {
    phase: 'hot',
    hotUntil,
    settleUntil,
    gpuBanUntil,
    remountBanUntil,
    stickyLite,
  }
}

/**
 * bump разрешён только на реальный +/- / burst.
 * previewOnlyMode сам по себе bump'ить нельзя — иначе каждый invalidate
 * держит щит в hot навсегда (мигание / hitch на dense).
 */
export function shouldBumpShieldOnPreviewFrame(opts: {
  hotCoeffEdit: boolean
  coeffEditBurst: boolean
  coeffEditing: boolean
}): boolean {
  return opts.hotCoeffEdit || opts.coeffEditBurst || opts.coeffEditing
}

export function tickShieldPhase(snap: ShieldSnapshot, nowMs: number): ShieldSnapshot {
  if (nowMs < snap.hotUntil) {
    return snap.phase === 'hot' ? snap : { ...snap, phase: 'hot' }
  }
  if (nowMs < snap.settleUntil) {
    return snap.phase === 'settle' ? snap : { ...snap, phase: 'settle' }
  }
  if (nowMs < snap.gpuBanUntil) {
    return snap.phase === 'cooldown' ? snap : { ...snap, phase: 'cooldown' }
  }
  // Длинный idle — можно снять sticky lite (осторожно, только после полного cooldown).
  if (snap.stickyLite && nowMs >= snap.gpuBanUntil + 2500) {
    return { ...snap, phase: 'idle', stickyLite: false }
  }
  return snap.phase === 'idle' ? snap : { ...snap, phase: 'idle' }
}

export function resolveShieldPhase(
  snap: ShieldSnapshot,
  nowMs: number,
  hotCoeffEdit: boolean,
): ShieldPhase {
  if (hotCoeffEdit || nowMs < snap.hotUntil) return 'hot'
  if (nowMs < snap.settleUntil) return 'settle'
  if (nowMs < snap.gpuBanUntil) return 'cooldown'
  return 'idle'
}

/**
 * Политика рендера под щитом.
 * preSynthesis=true → электроны и pin обязательны при atomCount>0.
 */
export function resolveShieldRenderPolicy(opts: {
  snap: ShieldSnapshot
  nowMs: number
  hotCoeffEdit: boolean
  preSynthesis: boolean
  atomCount: number
  groupVisible: boolean
  flightActive: boolean
  externalForceLite: boolean
}): ShieldRenderPolicy {
  const {
    snap,
    nowMs,
    hotCoeffEdit,
    preSynthesis,
    atomCount,
    groupVisible,
    flightActive,
    externalForceLite,
  } = opts

  const phase = resolveShieldPhase(snap, nowMs, hotCoeffEdit)
  const dense = atomCount >= REACTOR_SHIELD.denseLiteFromAtoms || snap.stickyLite

  const forceLite =
    externalForceLite ||
    dense ||
    (phase === 'hot' && atomCount > 8) ||
    (phase === 'settle' && dense)

  const pinEveryFrame =
    !flightActive &&
    groupVisible &&
    atomCount > 0 &&
    (phase === 'hot' || phase === 'settle' || (preSynthesis && hotCoeffEdit))

  // Pre-synth: электроны всегда, пока есть атомы и нет полёта GSAP.
  const electronAnimate =
    !flightActive && atomCount > 0 && (preSynthesis || phase === 'hot' || phase === 'settle')
      ? true
      : !flightActive && atomCount > 0 && groupVisible

  return {
    phase,
    pinEveryFrame: pinEveryFrame || (preSynthesis && atomCount > 0 && !flightActive && (phase === 'hot' || phase === 'settle')),
    lockVisualTier: phase === 'hot' || phase === 'settle' || dense,
    electronAnimate,
    previewStatic: false,
    forceLite,
    allowGpuCompile: phase === 'idle' && nowMs >= snap.gpuBanUntil && !hotCoeffEdit,
    allowCanvasRemount:
      !REACTOR_SHIELD.softRecoverOnly &&
      phase === 'idle' &&
      nowMs >= snap.remountBanUntil &&
      !hotCoeffEdit,
    syncPoolImmediate: phase === 'hot' || phase === 'settle' || hotCoeffEdit,
  }
}

/** Можно ли сейчас remount'ить Canvas (почти всегда false — soft recover). */
export function shieldAllowsCanvasRemount(
  snap: ShieldSnapshot,
  nowMs: number,
  editing: boolean,
): boolean {
  if (REACTOR_SHIELD.softRecoverOnly) return false
  if (editing) return false
  if (nowMs < snap.remountBanUntil) return false
  return true
}

/** Можно ли idle GPU compile / product queue. */
export function shieldAllowsGpuCompile(
  snap: ShieldSnapshot,
  nowMs: number,
  editing: boolean,
): boolean {
  if (editing) return false
  if (nowMs < snap.gpuBanUntil) return false
  return snap.phase === 'idle' || nowMs >= snap.settleUntil
}
