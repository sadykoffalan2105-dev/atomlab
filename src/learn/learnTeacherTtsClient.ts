import type { LearnTtsLocale } from './learnTtsCore'
import { isPlausibleSpeechAudio } from './learnSpeechValidate'
import { synthesizeEdgeNeuralSpeechBrowser } from './learnEdgeTtsBrowser'
import { synthesizePuterSpeech, warmupPuterFromUserGesture } from './learnPuterTts'
import { isAtomlabDesktop } from '../electronBridge.types'

export type TeacherTtsLocale = LearnTtsLocale

export type NeuralTtsSource = 'edge-browser' | 'edge-server' | 'edge-desktop' | 'puter'

export type NeuralTtsResult = {
  audioBase64: string
  mimeType: string
  source: NeuralTtsSource
}

const SERVER_PROBE_MS = 9_000

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T | null> {
  if (signal?.aborted) return Promise.resolve(null)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onAbort = () => finish(null)
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => finish(null), ms)
    promise.then((v) => finish(v)).catch(() => finish(null))
  })
}

type TtsPayload = {
  audioBase64?: string
  mimeType?: string
  source?: string
  error?: string
}

async function postTtsOnce(
  url: string,
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<NeuralTtsResult | null> {
  if (signal.aborted) return null
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: chunk, locale, prepared: true }),
    signal,
  })
  const contentType = res.headers.get('content-type') ?? ''
  if (!res.ok || !contentType.includes('json')) return null
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
    return {
      audioBase64: data.audioBase64,
      mimeType: data.mimeType ?? 'audio/mpeg',
      source: 'edge-server',
    }
  }
  return null
}

async function fetchViaDesktopElectron(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<NeuralTtsResult | null> {
  if (signal.aborted || !isAtomlabDesktop()) return null
  const api = window.atomlabDesktop
  if (!api?.synthesizeTeacherTts) return null
  try {
    const entry = await withTimeout(
      api.synthesizeTeacherTts(chunk, locale),
      18_000,
      signal,
    )
    if (!entry || signal.aborted || !isPlausibleSpeechAudio(entry.audioBase64, chunk)) return null
    return { ...entry, source: 'edge-desktop' }
  } catch {
    return null
  }
}

async function fetchViaBrowserEdge(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<NeuralTtsResult | null> {
  if (signal.aborted) return null
  try {
    const entry = await withTimeout(
      synthesizeEdgeNeuralSpeechBrowser(chunk, locale),
      14_000,
      signal,
    )
    if (!entry || signal.aborted || !isPlausibleSpeechAudio(entry.audioBase64, chunk)) return null
    return { ...entry, source: 'edge-browser' }
  } catch {
    return null
  }
}

async function fetchViaPuter(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<NeuralTtsResult | null> {
  if (signal.aborted) return null
  try {
    const entry = await synthesizePuterSpeech(chunk, locale, signal)
    if (!entry || signal.aborted || !isPlausibleSpeechAudio(entry.audioBase64, chunk)) return null
    return { ...entry, source: 'puter' }
  } catch {
    return null
  }
}

async function fetchViaServers(
  urls: string[],
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<{ result: NeuralTtsResult; url: string } | null> {
  if (!urls.length || signal.aborted) return null

  const controllers = urls.map(() => new AbortController())
  controllers.forEach((c, i) => {
    signal.addEventListener('abort', () => c.abort(), { once: true })
    void i
  })

  const attempts = urls.map((url, i) =>
    withTimeout(
      postTtsOnce(url, chunk, locale, controllers[i]!.signal).then((r) =>
        r ? { result: r, url } : null,
      ),
      SERVER_PROBE_MS,
      controllers[i]!.signal,
    ),
  )

  try {
    while (attempts.length > 0) {
      if (signal.aborted) return null
      const winner = await Promise.race(
        attempts.map((p, idx) => p.then((r) => ({ r, idx }))),
      )
      if (winner.r) {
        controllers.forEach((c) => c.abort())
        return winner.r
      }
      attempts.splice(winner.idx, 1)
    }
  } finally {
    controllers.forEach((c) => c.abort())
  }
  return null
}

let cachedWorkingTtsUrl: string | null = null

export const PUBLIC_NEURAL_TTS_URLS = [
  'https://atomlab-alan-sadykov.netlify.app/api/learn/tts',
  'https://atomlab-learn-tts.onrender.com/api/learn/tts',
  ...(import.meta.env.VITE_LEARN_TTS_CF_URL
    ? [String(import.meta.env.VITE_LEARN_TTS_CF_URL).trim()]
    : []),
] as const

export function teacherTtsLocale(appLocale: 'ru' | 'en' | 'uz'): TeacherTtsLocale {
  if (appLocale === 'en') return 'en'
  if (appLocale === 'uz') return 'uz'
  return 'ru'
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

function isNetlifyHost(): boolean {
  return typeof window !== 'undefined' && /\.netlify\.app$/i.test(window.location.hostname)
}

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)
}

function isGitHubPages(): boolean {
  return typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)
}

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

export function primeTeacherVoiceOnUserGesture(): void {
  if (isAtomlabDesktop() && window.atomlabDesktop?.synthesizeTeacherTts) {
    void window.atomlabDesktop.synthesizeTeacherTts('Готов.', 'ru')
  }
  void warmupPuterFromUserGesture()
}

export async function fetchTeacherTtsChunk(
  chunk: string,
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!chunk.trim()) return null

  const urls = resolveTeacherTtsUrls()
  const ordered =
    cachedWorkingTtsUrl && urls.includes(cachedWorkingTtsUrl)
      ? [cachedWorkingTtsUrl, ...urls.filter((u) => u !== cachedWorkingTtsUrl)]
      : urls

  const browserEdge = await fetchViaBrowserEdge(chunk, locale, signal)
  if (browserEdge) return browserEdge

  const desktop = await fetchViaDesktopElectron(chunk, locale, signal)
  if (desktop) return desktop

  const puter = await fetchViaPuter(chunk, locale, signal)
  if (puter) return puter

  const server = await fetchViaServers(ordered, chunk, locale, signal)
  if (server) {
    cachedWorkingTtsUrl = server.url
    return server.result
  }

  return null
}

export async function probeTeacherNeuralTts(
  sampleChunk: string,
  locale: TeacherTtsLocale,
): Promise<boolean> {
  if (!sampleChunk.trim()) return false
  const probe = AbortSignal.timeout?.(18_000)
  if (!probe) return false
  try {
    const entry = await fetchTeacherTtsChunk(sampleChunk, locale, probe)
    return entry !== null
  } catch {
    return false
  }
}

export async function fetchAllTeacherTtsChunks(
  chunks: string[],
  locale: TeacherTtsLocale,
  signal: AbortSignal,
): Promise<Array<{ audioBase64: string; mimeType: string } | null>> {
  return Promise.all(chunks.map((chunk) => fetchTeacherTtsChunk(chunk, locale, signal)))
}
