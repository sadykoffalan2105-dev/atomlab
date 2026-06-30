/** Debug session logger (NDJSON ingest + localStorage fallback). */
const LS_KEY = 'debug-1744a2'

export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const payload = {
    sessionId: '1744a2',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  }
  // #region agent log
  try {
    const prev = JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as unknown[]
    prev.push(payload)
    localStorage.setItem(LS_KEY, JSON.stringify(prev.slice(-300)))
  } catch {
    /* ignore */
  }
  fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1744a2' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
}
