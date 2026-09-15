/** Client for local Python teacher service (Ollama + RAG + Edge TTS). */

export type TeacherChatMessage = { role: 'user' | 'assistant'; content: string }

export type TeacherChatResult = {
  text: string
  source: 'ollama' | 'error'
}

const HEALTH_TIMEOUT_MS = 2_500
/** Неудачную проверку здоровья повторяем не чаще раза в минуту (раньше — никогда за сессию). */
const HEALTH_RETRY_MS = 60_000
const CHAT_TIMEOUT_MS = 25_000

let teacherHealthOk: boolean | null = null
let teacherHealthAt = 0
let healthPromise: Promise<boolean> | null = null

export function resolveTeacherServiceUrl(): string | null {
  const explicit = import.meta.env.VITE_TEACHER_SERVICE_URL as string | undefined
  if (explicit?.trim()) return explicit.trim().replace(/\/$/, '')
  if (import.meta.env.DEV) return '/teacher-api'
  return null
}

export function isTeacherServiceConfigured(): boolean {
  return resolveTeacherServiceUrl() !== null
}

export function getTeacherTtsUrl(): string | null {
  const base = resolveTeacherServiceUrl()
  return base ? `${base}/v1/tts` : null
}

/** Сигнал, который срабатывает по таймауту ИЛИ по внешней отмене. */
function timeoutSignal(ms: number, outer?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), ms)
  const onAbort = () => ctrl.abort(outer?.reason)
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason)
    else outer.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: ctrl.signal,
    dispose: () => {
      clearTimeout(timer)
      outer?.removeEventListener('abort', onAbort)
    },
  }
}

export async function checkTeacherServiceHealth(force = false): Promise<boolean> {
  const base = resolveTeacherServiceUrl()
  if (!base) {
    teacherHealthOk = false
    return false
  }
  const fresh = teacherHealthOk === true || Date.now() - teacherHealthAt < HEALTH_RETRY_MS
  if (!force && teacherHealthOk !== null && fresh) return teacherHealthOk
  if (!force && healthPromise) return healthPromise

  healthPromise = (async () => {
    const t = timeoutSignal(HEALTH_TIMEOUT_MS)
    try {
      const res = await fetch(`${base}/health`, { signal: t.signal })
      teacherHealthOk = res.ok
      return res.ok
    } catch {
      teacherHealthOk = false
      return false
    } finally {
      t.dispose()
      teacherHealthAt = Date.now()
      healthPromise = null
    }
  })()

  return healthPromise
}

export async function requestTeacherChat(
  messages: TeacherChatMessage[],
  context: Record<string, unknown>,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<TeacherChatResult | null> {
  const base = resolveTeacherServiceUrl()
  if (!base || opts.signal?.aborted) return null

  const healthy = await checkTeacherServiceHealth()
  if (!healthy || opts.signal?.aborted) return null

  const t = timeoutSignal(opts.timeoutMs ?? CHAT_TIMEOUT_MS, opts.signal)
  try {
    const res = await fetch(`${base}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
      signal: t.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      reply?: string | null
      source?: string
      error?: string
    }
    const reply = data.reply?.trim()
    if (reply) {
      return { text: reply, source: 'ollama' }
    }
  } catch {
    if (!opts.signal?.aborted) {
      teacherHealthOk = false
      teacherHealthAt = Date.now()
    }
  } finally {
    t.dispose()
  }
  return null
}
