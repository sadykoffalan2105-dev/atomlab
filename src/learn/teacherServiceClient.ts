/** Client for local Python teacher service (Ollama + RAG + Edge TTS). */

export type TeacherChatMessage = { role: 'user' | 'assistant'; content: string }

export type TeacherChatResult = {
  text: string
  source: 'ollama' | 'error'
}

let teacherHealthOk: boolean | null = null
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

export async function checkTeacherServiceHealth(force = false): Promise<boolean> {
  const base = resolveTeacherServiceUrl()
  if (!base) {
    teacherHealthOk = false
    return false
  }
  if (!force && teacherHealthOk !== null) return teacherHealthOk
  if (!force && healthPromise) return healthPromise

  healthPromise = (async () => {
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(2500),
      })
      teacherHealthOk = res.ok
      return res.ok
    } catch {
      teacherHealthOk = false
      return false
    } finally {
      healthPromise = null
    }
  })()

  return healthPromise
}

export async function requestTeacherChat(
  messages: TeacherChatMessage[],
  context: Record<string, unknown>,
): Promise<TeacherChatResult | null> {
  const base = resolveTeacherServiceUrl()
  if (!base) return null

  const healthy = await checkTeacherServiceHealth()
  if (!healthy) return null

  try {
    const res = await fetch(`${base}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    })
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
    teacherHealthOk = false
  }
  return null
}
