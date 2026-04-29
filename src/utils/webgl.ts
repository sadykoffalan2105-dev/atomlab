export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: true })
    const ok = !!ctx
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_webgl',
        location: 'webgl.ts:isWebGLAvailable',
        message: 'webgl availability',
        data: { ok },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return ok
  } catch {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_webgl',
        location: 'webgl.ts:isWebGLAvailable',
        message: 'webgl availability threw',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return false
  }
}

