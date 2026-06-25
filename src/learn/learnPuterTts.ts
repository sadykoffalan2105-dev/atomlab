/**
 * Мужской голос (AWS Polly Maxim) через Puter.js — без своего сервера.
 * Используется, когда Netlify/Render TTS недоступны (нет деплоя бэкенда).
 */
import type { TeacherTtsLocale } from './learnTeacherTtsClient'

const PUTER_SRC = 'https://js.puter.com/v2/'
const LOAD_TIMEOUT_MS = 8_000
const TTS_TIMEOUT_MS = 18_000

type PuterTts = (
  text: string,
  opts: { voice?: string; engine?: string; language?: string },
) => Promise<HTMLAudioElement>

declare global {
  interface Window {
    puter?: { ai?: { txt2speech?: PuterTts } }
  }
}

const PUTER_VOICE: Record<TeacherTtsLocale, string> = {
  ru: 'Maxim',
  en: 'Matthew',
}
const PUTER_ENGINE: Record<TeacherTtsLocale, string> = {
  ru: 'standard',
  en: 'neural',
}
const PUTER_LANG: Record<TeacherTtsLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
}

let puterLoad: Promise<boolean> | null = null

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
    script.onload = onReady
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })

  return puterLoad
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
  locale: TeacherTtsLocale,
  signal?: AbortSignal,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim() || signal?.aborted) return null

  const ready = await withTimeout(loadPuter(), LOAD_TIMEOUT_MS, signal).catch(() => false)
  if (!ready || signal?.aborted) return null

  const tts = window.puter?.ai?.txt2speech
  if (!tts) return null

  const voice = PUTER_VOICE[locale]
  const language = PUTER_LANG[locale]
  const engines = [PUTER_ENGINE[locale], 'standard']

  for (const engine of engines) {
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
