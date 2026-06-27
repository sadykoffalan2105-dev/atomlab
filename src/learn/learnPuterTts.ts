/**
 * Мужской голос (AWS Polly Maxim) через Puter.js — без своего сервера.
 * Puter может запросить sign-in popup при первом обращении к облаку.
 */
import type { LearnTtsLocale } from './learnTtsCore'

const PUTER_SRC = 'https://js.puter.com/v2/'
const LOAD_TIMEOUT_MS = 12_000
const TTS_TIMEOUT_MS = 22_000
const AUTH_TIMEOUT_MS = 45_000

type PuterTts = (
  text: string,
  opts: { voice?: string; engine?: string; language?: string },
) => Promise<HTMLAudioElement>

type PuterAuth = {
  isSignedIn?: () => boolean | Promise<boolean>
  signIn?: () => Promise<unknown>
  getUser?: () => Promise<unknown>
}

declare global {
  interface Window {
    puter?: { ai?: { txt2speech?: PuterTts }; auth?: PuterAuth }
  }
}

const PUTER_VOICE: Record<LearnTtsLocale, string> = {
  ru: 'Maxim',
  en: 'Matthew',
}
const PUTER_ENGINE: Record<LearnTtsLocale, string[]> = {
  ru: ['standard', 'neural'],
  en: ['neural', 'standard'],
}
const PUTER_LANG: Record<LearnTtsLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
}

let puterLoad: Promise<boolean> | null = null
let puterAuthAttempt: Promise<boolean> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

function loadPuter(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false)
  }
  if (window.puter?.ai?.txt2speech) return Promise.resolve(true)
  if (puterLoad) return puterLoad

  puterLoad = new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => resolve(ok)
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS)

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PUTER_SRC}"]`)
    const onReady = () => {
      clearTimeout(timer)
      finish(!!window.puter?.ai?.txt2speech)
    }

    if (existing) {
      if (window.puter?.ai?.txt2speech) {
        onReady()
        return
      }
      existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', () => finish(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = PUTER_SRC
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = onReady
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })

  return puterLoad
}

async function isPuterSignedIn(): Promise<boolean> {
  const auth = window.puter?.auth
  if (!auth?.isSignedIn) return false
  try {
    const v = auth.isSignedIn()
    return typeof v === 'boolean' ? v : await v
  } catch {
    return false
  }
}

/** Sign-in popup — вызывать из user gesture (клик «Озвучить»). */
export async function ensurePuterSignedIn(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false
  const ready = await loadPuter()
  if (!ready || signal?.aborted) return false
  if (await isPuterSignedIn()) return true
  if (puterAuthAttempt) return puterAuthAttempt

  const auth = window.puter?.auth
  if (!auth?.signIn) return false

  puterAuthAttempt = withTimeout(
    auth.signIn().then(() => true).catch(() => false),
    AUTH_TIMEOUT_MS,
    signal,
  ).finally(() => {
    puterAuthAttempt = null
  })

  return puterAuthAttempt
}

/** Синхронный старт из обработчика клика — грузит Puter и открывает auth при необходимости. */
export function warmupPuterFromUserGesture(): void {
  void (async () => {
    const ready = await loadPuter()
    if (!ready) return
    if (await isPuterSignedIn()) return
    void ensurePuterSignedIn()
  })()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

async function audioToBase64(audio: HTMLAudioElement): Promise<{ audioBase64: string; mimeType: string } | null> {
  const src = audio?.src
  if (!src) return null
  const res = await fetch(src)
  if (!res.ok) return null
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.length < 200) return null
  return {
    audioBase64: bytesToBase64(buf),
    mimeType: res.headers.get('content-type') || 'audio/mpeg',
  }
}

/** Мужской Polly-голос через Puter → base64 MP3. */
export async function synthesizePuterSpeech(
  text: string,
  locale: LearnTtsLocale,
  signal?: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim() || signal?.aborted) return null

  const ready = await withTimeout(loadPuter(), LOAD_TIMEOUT_MS, signal).catch(() => false)
  if (!ready || signal?.aborted) return null

  await ensurePuterSignedIn(signal).catch(() => false)

  const tts = window.puter?.ai?.txt2speech
  if (!tts) return null

  const voice = PUTER_VOICE[locale]
  const language = PUTER_LANG[locale]

  for (const engine of PUTER_ENGINE[locale]) {
    if (signal?.aborted) return null
    try {
      const audio = await withTimeout(
        tts(text, { voice, engine, language }),
        TTS_TIMEOUT_MS,
        signal,
      )
      if (signal?.aborted) return null
      const out = await audioToBase64(audio)
      if (out) return out
    } catch {
      /* next engine */
    }
  }
  return null
}

/** Предзагрузка Puter на странице обучения. */
export function preloadPuterTts(): void {
  void loadPuter()
}
