/**
 * Вход в VR и выход (WebXR на встроенном three, без @react-three/xr). Кнопка (LabXrButton) живёт вне <Canvas>,
 * поэтому рендерер регистрирует LabXrRoot. Анимационный цикл в сессии R3F переключает сам (sessionstart).
 */
import type * as THREE from 'three'
import { labEvents } from '../labEvents'
import { labAudio } from '../audio/labAudio'
import { labXr } from './labXrStore'
import { applyStand, initBaseSpace, resetBaseSpace } from './xrLocomotion'

let glRef: THREE.WebGLRenderer | null = null
let prevQuality: 'low' | 'high' | null = null

export function registerXrRenderer(gl: THREE.WebGLRenderer | null) {
  glRef = gl
}

/** Эмуляция без шлема: …#/vr-lab?xrEmulate=1 (проверки Playwright и показ на ПК). */
export function xrEmulateRequested(): boolean {
  return typeof window !== 'undefined' && /[?&]xrEmulate=1/.test(window.location.hash + window.location.search)
}

/** Мобильный шлем (Quest и т. п.): вход в VR переводит качество в low, выход — возвращает прежнее. */
export function isMobileXr(): boolean {
  return typeof navigator !== 'undefined' && /OculusBrowser|Quest|Android/i.test(navigator.userAgent)
}

function lowerQuality() {
  if (!isMobileXr()) return
  prevQuality = labXr.get().run?.quality ?? 'high'
  labEvents.emit({ type: 'uiCommand', cmd: 'quality', quality: 'low' })
  labXr.set({ lowDetail: true })
}

function restoreQuality() {
  if (prevQuality) labEvents.emit({ type: 'uiCommand', cmd: 'quality', quality: prevQuality })
  prevQuality = null
  labXr.set({ lowDetail: false })
}

function onSessionEnd() {
  resetBaseSpace()
  labXr.set({ presenting: false })
  restoreQuality()
  // OrbitControls возвращается в позу вида «Стол»
  labEvents.emit({ type: 'uiCommand', cmd: 'view', view: 'desk' })
}

export async function enterXr(): Promise<boolean> {
  labAudio.unlockNow()
  if (xrEmulateRequested() && !navigator.xr) {
    labXr.set({ presenting: true, emulated: true })
    return true
  }
  const xr = navigator.xr
  const gl = glRef
  if (!xr || !gl) return false
  const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] })
  const feats = (session as XRSession & { enabledFeatures?: readonly string[] }).enabledFeatures
  gl.xr.enabled = true
  gl.xr.setReferenceSpaceType(feats && !feats.includes('local-floor') ? 'local' : 'local-floor')
  gl.xr.setFoveation(1)
  gl.xr.setFramebufferScaleFactor(1.0)
  lowerQuality()
  session.addEventListener('end', onSessionEnd, { once: true })
  try {
    await gl.xr.setSession(session)
  } catch (err) {
    restoreQuality()
    void session.end().catch(() => {})
    throw err
  }
  await initBaseSpace(session)
  applyStand(gl, labXr.get().stand)
  labXr.set({ presenting: true, emulated: false })
  return true
}

export async function exitXr(): Promise<void> {
  const s = labXr.get()
  if (s.emulated) {
    labXr.set({ presenting: false, emulated: false })
    labEvents.emit({ type: 'uiCommand', cmd: 'view', view: 'desk' })
    return
  }
  await glRef?.xr.getSession()?.end()
}
