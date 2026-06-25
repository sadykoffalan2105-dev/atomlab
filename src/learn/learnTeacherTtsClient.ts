import { isPlausibleSpeechAudio } from './learnSpeechValidate'
import { synthesizeEdgeNeuralSpeechBrowser } from './learnEdgeTtsBrowser'

export type TeacherTtsLocale = 'ru' | 'en'

const CHUNK_TIMEOUT_MS = 50_000
const PROBE_TIMEOUT_MS = 12_000

/** Нет serverless /api на статическом хостинге — не спамим 404 на каждый фрагмент. */
let cachedWorkingTtsUrl: string | null = null

/**
 * Публичные бэкенды neural TTS (мужской Dmitry). Порядок важен.
 * Netlify — основной (деплой через CLI в GitHub Actions).
 * Render — запасной (render.yaml, если подключён репозиторий).
 */
const PUBLIC_NEURAL_TTS_URLS = [
  'https://atomlab-alan-sadykov.netlify.app/api/learn/tts',
  'https://atomlab-learn-tts.onrender.com/api/learn/tts',
] as const

/** uz озвучиваем русским neural-голосом Dmitry. */
export function teacherTtsLocale(appLocale: 'ru' | 'en' | 'uz'): TeacherTtsLocale {
  return appLocale === 'en' ? 'en' : 'ru'
}

function normalizeTtsUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (typeof window !== 'undefined') {
    try {
      return new URL(t.startsWith('/') ? t : `/${t}`, window.location.origin).href
    } catch {
      return t
    }
  }
  return t
}

/** Сейчас мы на самом Netlify-сайте? Тогда хватит same-origin /api/learn/tts. */
function isNetlifyHost(): boolean {
  return typeof window !== 'undefined' && /\.netlify\.app$/i.test(window.location.hostname)
}

/** Запущены как локальный статический preview/dev без серверного /api? */
function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)
}

/** Статичный GitHub Pages без своего /api? */
function isGitHubPages(): boolean {
  return typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)
}

/**
 * URL для neural TTS (по приоритету):
 * 1) VITE_LEARN_TTS_URL (явный, из сборки GitHub Pages)
 * 2) VITE_LEARN_CHAT_URL → …/api/learn/tts (Vercel)
 * 3) публичные бэкенды (Netlify CLI / Render) — для GitHub Pages и прочего статика
 * 4) same-origin BASE_URL/api/learn/tts (локальный Vite / Netlify same-origin)
 */
export function resolveTeacherTtsUrls(): string[] {
  const urls: string[] = []

  const explicit = import.meta.env.VITE_LEARN_TTS_URL as string | undefined
  if (explicit?.trim()) urls.push(normalizeTtsUrl(explicit))

  const chatUrl = import.meta.env.VITE_LEARN_CHAT_URL as string | undefined
  if (chatUrl?.trim()) {
    const derived = chatUrl.trim().replace(/\/api\/learn\/chat\/?$/i, '/api/learn/tts')
    urls.push(normalizeTtsUrl(derived))
  }

  if (isGitHubPages() || (!isNetlifyHost() && !isLocalHost())) {
    for (const u of PUBLIC_NEURAL_TTS_URLS) urls.push(u)
  }

  // same-origin /api — только если хостинг может отдавать serverless (не GitHub Pages).
  if (!isGitHubPages()) {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
    urls.push(normalizeTtsUrl(`${base}api/learn/tts`))
  }

  if (isNetlifyHost()) {
    for (const u of PUBLIC_NEURAL_TTS_URLS) urls.push(u)
  }

  return [...new Set(urls.filter(Boolean))]
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

  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('json')) {
    return null
  }

  let data: TtsPayload
  try {
    data = (await res.json()) as TtsPayload
  } catch {
    return null
  }

  if (
    data.audioBase64 &&
    isPlausibleSpeechAudio(data.audioBase64, chunk) &&
    ['openai', 'edge', 'clone'].includes(data.source ?? 'edge')
  ) {
    return { audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' }
  }
  return null
}

/**
 * Прямой вызов Edge TTS из браузера работает ТОЛЬКО в Microsoft Edge:
 * Chrome/Firefox/Safari не могут выставить обязательные WebSocket-заголовки
 * (Microsoft, конец 2025) и получают 403. В остальных браузерах не тратим
 * время на заведомо мёртвое соединение, а сразу идём на серверный бэкенд / Web Speech.
 */
function isMicrosoftEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\bEdg(?:A|iOS|)?\//.test(navigator.userAgent)
}

/** Тот же neural-голос (ru-RU-DmitryNeural) напрямую из браузера — только в Edge. */
async function fetchTeacherTtsChunkBrowser(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (signal.aborted) return null
  if (!isMicrosoftEdgeBrowser()) return null
  try {
    const entry = await synthesizeEdgeNeuralSpeechBrowser(chunk, locale)
    if (signal.aborted) return null
    if (entry && isPlausibleSpeechAudio(entry.audioBase64, chunk)) return entry
  } catch {
    /* fallthrough */
  }
  return null
}
/** Один фрагмент → MP3 (Vercel/Python Dmitry, иначе браузерный Edge Neural). */
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

  const urls = resolveTeacherTtsUrls()
  const ordered =
    cachedWorkingTtsUrl && urls.includes(cachedWorkingTtsUrl)
      ? [cachedWorkingTtsUrl, ...urls.filter((u) => u !== cachedWorkingTtsUrl)]
      : urls

  for (const url of ordered) {
    if (signal.aborted) return null
    try {
      const entry = await postTts(url, chunk, locale, combined)
      if (entry) {
        cachedWorkingTtsUrl = url
        return entry
      }
    } catch {
      /* next */
    }
  }

  // 1) В браузере Microsoft Edge — настоящий ru-RU-DmitryNeural напрямую.
  return fetchTeacherTtsChunkBrowser(chunk, locale, signal)
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
