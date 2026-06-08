import {
  HUMAN_TTS_INSTRUCTIONS,
  HUMAN_TTS_MODEL,
  HUMAN_TTS_SPEED,
  HUMAN_TTS_VOICE,
  prepareTextForHumanTts,
} from './learnSpeechText'
import { synthesizeEdgeNeuralSpeech } from './learnEdgeTts'

export type LearnTtsLocale = 'ru' | 'en'
export type LearnTtsProvider = 'auto' | 'edge' | 'openai'

export type LearnTtsRequestBody = {
  text?: string
  locale?: LearnTtsLocale
}

export type LearnTtsSource = 'edge' | 'openai' | 'browser' | 'error'

export type LearnTtsResult = {
  status: number
  audioBase64?: string
  mimeType?: string
  source: LearnTtsSource
  error?: string
  headers?: Record<string, string>
}

const MAX_TTS_CHARS = 3600
const RATE_LIMIT = 28
const RATE_WINDOW_MS = 60_000

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export type LearnTtsRuntimeConfig = {
  provider: LearnTtsProvider
  openaiApiKey?: string
  openaiBaseUrl: string
  openaiTtsModel: string
  openaiTtsVoiceRu: string
  openaiTtsVoiceEn: string
  edgeVoiceRu?: string
  edgeVoiceEn?: string
  openaiTtsInstructionsRu?: string
  openaiTtsInstructionsEn?: string
  allowedOrigins: string[]
}

export function learnTtsRuntimeFromEnv(
  env: Record<string, string | undefined> = {},
): LearnTtsRuntimeConfig {
  const voice = env.OPENAI_TTS_VOICE
  const providerRaw = (env.LEARN_TTS_PROVIDER ?? 'auto').toLowerCase()
  const provider: LearnTtsProvider =
    providerRaw === 'edge' || providerRaw === 'openai' ? providerRaw : 'auto'

  return {
    provider,
    openaiApiKey: env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiTtsModel: env.OPENAI_TTS_MODEL ?? HUMAN_TTS_MODEL,
    openaiTtsVoiceRu: env.OPENAI_TTS_VOICE_RU ?? voice ?? HUMAN_TTS_VOICE.ru,
    openaiTtsVoiceEn: env.OPENAI_TTS_VOICE_EN ?? voice ?? HUMAN_TTS_VOICE.en,
    edgeVoiceRu: env.EDGE_TTS_VOICE_RU,
    edgeVoiceEn: env.EDGE_TTS_VOICE_EN,
    openaiTtsInstructionsRu: env.OPENAI_TTS_INSTRUCTIONS_RU ?? HUMAN_TTS_INSTRUCTIONS.ru,
    openaiTtsInstructionsEn: env.OPENAI_TTS_INSTRUCTIONS_EN ?? HUMAN_TTS_INSTRUCTIONS.en,
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

function edgeVoiceForLocale(locale: LearnTtsLocale, runtime: LearnTtsRuntimeConfig): string | undefined {
  return locale === 'en' ? runtime.edgeVoiceEn : runtime.edgeVoiceRu
}

function instructionsForLocale(locale: LearnTtsLocale, runtime: LearnTtsRuntimeConfig): string | undefined {
  return locale === 'en' ? runtime.openaiTtsInstructionsEn : runtime.openaiTtsInstructionsRu
}

function supportsInstructions(model: string): boolean {
  return model.includes('gpt-4o') || model.includes('mini-tts')
}

function ttsSpeed(locale: LearnTtsLocale): number {
  return HUMAN_TTS_SPEED[locale]
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

async function callOpenAiTts(
  text: string,
  locale: LearnTtsLocale,
  runtime: LearnTtsRuntimeConfig,
): Promise<string> {
  const apiKey = runtime.openaiApiKey
  if (!apiKey) throw new Error('no_api_key')

  const models = [runtime.openaiTtsModel, HUMAN_TTS_MODEL, 'gpt-4o-mini-tts'].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  )

  let lastStatus = 502
  for (const model of models) {
    const body: Record<string, string | number> = {
      model,
      voice: voiceForLocale(locale, runtime),
      input: text,
      response_format: 'mp3',
      speed: ttsSpeed(locale),
    }
    const instructions = instructionsForLocale(locale, runtime)
    if (instructions && supportsInstructions(model)) {
      body.instructions = instructions
    }

    const upstream = await fetch(`${runtime.openaiBaseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (upstream.ok) {
      return bytesToBase64(new Uint8Array(await upstream.arrayBuffer()))
    }
    lastStatus = upstream.status
  }

  throw new Error(`upstream_${lastStatus}`)
}

async function synthesizeWithEdge(
  text: string,
  locale: LearnTtsLocale,
  runtime: LearnTtsRuntimeConfig,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  return synthesizeEdgeNeuralSpeech(text, locale, edgeVoiceForLocale(locale, runtime))
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
  const text = prepareTextForHumanTts(raw, locale).slice(0, MAX_TTS_CHARS)
  if (!text) {
    return { status: 400, source: 'error', error: 'empty_text', headers }
  }

  const { provider, openaiApiKey } = meta.runtime

  if (provider === 'auto' || provider === 'edge') {
    const edge = await synthesizeWithEdge(text, locale, meta.runtime)
    if (edge) {
      return {
        status: 200,
        audioBase64: edge.audioBase64,
        mimeType: edge.mimeType,
        source: 'edge',
        headers,
      }
    }
    if (provider === 'edge') {
      return { status: 502, source: 'error', error: 'edge_unavailable', headers }
    }
  }

  if (!openaiApiKey) {
    return { status: 503, source: 'error', error: 'no_api_key', headers }
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
