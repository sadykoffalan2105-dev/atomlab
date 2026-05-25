export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const opts = { failIfMajorPerformanceCaveat: false as const }
    const ctx =
      canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts) ||
      canvas.getContext('experimental-webgl', opts as WebGLContextAttributes)
    return !!ctx
  } catch {
    return false
  }
}
