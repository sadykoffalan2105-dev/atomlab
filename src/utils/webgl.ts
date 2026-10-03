let webglAvailableCache: boolean | null = null

/**
 * Есть ли WebGL. Проверка — ОДИН раз за сессию (кеш), пробный контекст сразу освобождается.
 * Раньше каждый вызов (а его делают на каждой перерисовке карточек и превью) создавал новый WebGL-контекст и не
 * отдавал его: после ~16 штук браузер гасил самый старый — живой 3D-холст («Как образуется» у NaCl пропадал).
 */
export function isWebGLAvailable(): boolean {
  if (webglAvailableCache !== null) return webglAvailableCache
  try {
    const canvas = document.createElement('canvas')
    const opts = { failIfMajorPerformanceCaveat: false as const }
    const ctx = (canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts as WebGLContextAttributes)) as WebGLRenderingContext | null
    webglAvailableCache = !!ctx
    // пробный контекст не держим: иначе он занимает место в лимите активных контекстов браузера
    ctx?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglAvailableCache = false
  }
  return webglAvailableCache
}
