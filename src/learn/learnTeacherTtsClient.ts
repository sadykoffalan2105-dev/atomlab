import { isPlausibleSpeechAudio } from './learnSpeechValidate'

export type TeacherTtsLocale = 'ru' | 'en'

const CHUNK_TIMEOUT_MS = 50_000
const PROBE_TIMEOUT_MS = 12_000

/** uz озвучиваем русским neural-голосом Dmitry. */
export function teacherTtsLocale(appLocale: 'ru' | 'en' | 'uz'): TeacherTtsLocale {
  return appLocale === 'en' ? 'en' : 'ru'
}

/**
 * Только основной API — без /teacher-api (там текст переписывается во «эич два о»).
 */
export function resolveTeacherTtsUrls(): string[] {
  const urls: string[] = []

  const explicit = import.meta.env.VITE_LEARN_TTS_URL as string | undefined
  if (explicit?.trim()) urls.push(explicit.trim())

  urls.push('/api/learn/tts')

  return [...new Set(urls)]
}

export function primaryTeacherTtsUrl(): string {
  return resolveTeacherTtsUrls()[0] ?? '/api/learn/tts'
}

export function isTeacherTtsAvailable(): boolean {
  return typeof window !== 'undefined'
}

type TtsPayload = {
  audioBase64?: string
  mimeType?: string
  source?: string
  error?: string
}

async function postTts(
  url: string,
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: chunk, locale, prepared: true }),
    signal,
  })
  if (!res.ok) return null

  const data = (await res.json()) as TtsPayload
  if (
    data.audioBase64 &&
    isPlausibleSpeechAudio(data.audioBase64, chunk) &&
    ['openai', 'edge', 'clone'].includes(data.source ?? 'edge')
  ) {
    return { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' }
  }
  return null
}

/** Один фрагмент → MP3 (Python Dmitry / OpenAI). */
export async function fetchTeacherTtsChunk(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!chunk.trim()) return null

  const timeout = AbortSignal.timeout?.(CHUNK_TIMEOUT_MS)
  const combined =
    timeout && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([signal, timeout])
      : signal

  for (const url of resolveTeacherTtsUrls()) {
    if (signal.aborted) return null
    try {
      const entry = await postTts(url, chunk, locale, combined)
      if (entry) return entry
    } catch {
      /* next */
    }
  }
  return null
}

/** Проверка: neural доступен для первой фразы (без воспроизведения). */
export async function probeTeacherNeuralTts(
  sampleChunk: string,
  locale: TeacherTtsLocale,
): Promise<boolean> {
  if (!sampleChunk.trim()) return false
  const probe = AbortSignal.timeout?.(PROBE_TIMEOUT_MS)
  if (!probe) return false
  try {
    const entry = await fetchTeacherTtsChunk(sampleChunk, locale, probe)
    return entry !== null
  } catch {
    return false
  }
}

/** Все фрагменты сразу — либо полный neural, либо ничего (без «половины neural + робот»). */
export async function fetchAllTeacherTtsChunks(
  chunks: string[],
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<Array<{ audioBase64: string; mimeType: string } | null>> {
  return Promise.all(chunks.map((chunk) => fetchTeacherTtsChunk(chunk, locale, signal)))
}
