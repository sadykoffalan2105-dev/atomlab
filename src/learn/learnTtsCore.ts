import { stripMarkdownForSpeech } from './learnSpeechText'

export type LearnTtsLocale = 'ru' | 'en'

export type LearnTtsRequestBody = {
  text?: string
  locale?: LearnTtsLocale
}

export type LearnTtsResult = {
  status: number
  audioBase64?: string
  mimeType?: string
  source: 'openai' | 'browser' | 'error'
  error?: string
  headers?: Record<string, string>
}

const MAX_TTS_CHARS = 3600
const RATE_LIMIT = 24
const RATE_WINDOW_MS = 60_000

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export type LearnTtsRuntimeConfig = {
  openaiApiKey?: string
  openaiBaseUrl: string
  openaiTtsModel: string
  openaiTtsVoiceRu: string
  openaiTtsVoiceEn: string
  allowedOrigins: string[]
}

export function learnTtsRuntimeFromEnv(
  env: Record<string, string | undefined> = {},
): LearnTtsRuntimeConfig {
  const voice = env.OPENAI_TTS_VOICE
  return {
    openaiApiKey: env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiTtsModel: env.OPENAI_TTS_MODEL ?? 'tts-1-hd',
    openaiTtsVoiceRu: env.OPENAI_TTS_VOICE_RU ?? voice ?? 'nova',
    openaiTtsVoiceEn: env.OPENAI_TTS_VOICE_EN ?? voice ?? 'nova',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

function corsHeaders(origin: string | undefined, allowedOrigins: string[]): Record<string, string> {
  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
  const all = [...allowedOrigins, ...devOrigins]
  const ok = origin && all.some((o) => origin === o || origin.startsWith(o))
  return {
    'Access-Control-Allow-Origin': ok && origin ? origin : (all[0] ?? '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function learnTtsOptionsResponse(
  origin: string | undefined,
  runtime: LearnTtsRuntimeConfig,
): LearnTtsResult {
  return {
    status: 204,
    source: 'error',
    headers: corsHeaders(origin, runtime.allowedOrigins),
  }
}

function voiceForLocale(locale: LearnTtsLocale, runtime: LearnTtsRuntimeConfig): string {
  return locale === 'en' ? runtime.openaiTtsVoiceEn : runtime.openaiTtsVoiceRu
}

async function callOpenAiTts(
  text: string,
  locale: LearnTtsLocale,
  runtime: LearnTtsRuntimeConfig,
): Promise<string> {
  const apiKey = runtime.openaiApiKey
  if (!apiKey) throw new Error('no_api_key')

  const upstream = await fetch(`${runtime.openaiBaseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: runtime.openaiTtsModel,
      voice: voiceForLocale(locale, runtime),
      input: text,
      response_format: 'mp3',
      speed: locale === 'ru' ? 1.1 : 1.08,
    }),
  })

  if (!upstream.ok) {
    throw new Error(`upstream_${upstream.status}`)
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer())
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

export async function processLearnTts(
  body: LearnTtsRequestBody,
  meta: { origin?: string; clientIp?: string; runtime: LearnTtsRuntimeConfig },
): Promise<LearnTtsResult> {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(meta.origin, meta.runtime.allowedOrigins),
  }

  const ip = meta.clientIp ?? 'local'
  if (!checkRateLimit(ip)) {
    return { status: 429, source: 'error', error: 'rate_limit', headers }
  }

  const raw = (body.text ?? '').trim()
  if (!raw) {
    return { status: 400, source: 'error', error: 'empty_text', headers }
  }

  const locale: LearnTtsLocale = body.locale === 'en' ? 'en' : 'ru'
  const text = stripMarkdownForSpeech(raw).slice(0, MAX_TTS_CHARS)
  if (!text) {
    return { status: 400, source: 'error', error: 'empty_text', headers }
  }

  try {
    const audioBase64 = await callOpenAiTts(text, locale, meta.runtime)
    return {
      status: 200,
      audioBase64,
      mimeType: 'audio/mpeg',
      source: 'openai',
      headers,
    }
  } catch (err) {
    const code = err instanceof Error ? err.message : 'tts_failed'
    return {
      status: code === 'no_api_key' ? 503 : 502,
      source: 'error',
      error: code,
      headers,
    }
  }
}
