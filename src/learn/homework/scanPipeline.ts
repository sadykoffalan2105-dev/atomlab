/**
 * Скан ДЗ: камера / файл → превью + текст.
 * OCR: TextDetector (если есть) → Tesseract.js (rus+eng).
 */

import type { AppLocale } from '../../i18n/types'

export type ScanImageResult = {
  dataUrl: string
  width: number
  height: number
  /** Если браузер/движок смог вытащить текст */
  ocrText?: string
}

export type ScanLoadOptions = {
  locale?: AppLocale
  signal?: AbortSignal
}

type TesseractWorker = {
  recognize: (image: string) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
  reinitialize: (langs: string | string[]) => Promise<unknown>
}

let tessWorker: TesseractWorker | null = null
let tessLangs = ''
let tessBoot: Promise<TesseractWorker> | null = null

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)
}

/** Усиливаем контраст для рукописи перед OCR / просмотром. */
export async function preprocessHomeworkImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const maxW = 1600
      const scale = Math.min(1, maxW / Math.max(1, img.width))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const frame = ctx.getImageData(0, 0, w, h)
      const d = frame.data
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
        const v = g < 140 ? Math.max(0, g * 0.75) : Math.min(255, g * 1.15 + 20)
        d[i] = d[i + 1] = d[i + 2] = v
      }
      ctx.putImageData(frame, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.88))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function cleanOcrText(raw: string): string | undefined {
  const text = raw
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim()
  if (text.length < 8) return undefined
  // Отсев мусора OCR: слишком мало букв/цифр
  const useful = (text.match(/[\p{L}\p{N}]/gu) ?? []).length
  if (useful < 8) return undefined
  return text
}

async function tryBrowserOcr(dataUrl: string): Promise<string | undefined> {
  // Experimental: некоторые Chromium-сборки / Electron могут дать TextDetector.
  const Detector = (
    window as unknown as {
      TextDetector?: new (o: { types: string[] }) => {
        detect: (img: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
      }
    }
  ).TextDetector
  if (!Detector) return undefined
  try {
    const img = new Image()
    const loaded = new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('img'))
    })
    img.src = dataUrl
    await loaded
    const detector = new Detector({ types: ['text'] })
    const bits = await detector.detect(img)
    return cleanOcrText(bits.map((b) => b.rawValue ?? '').filter(Boolean).join('\n'))
  } catch {
    return undefined
  }
}

function ocrLangsForLocale(locale?: AppLocale): string {
  if (locale === 'en') return 'eng'
  // uz + ru: кириллица/латиница; eng помогает формулам и латинице
  return 'rus+eng'
}

async function getTesseractWorker(langs: string, signal?: AbortSignal): Promise<TesseractWorker> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (tessWorker && tessLangs === langs) return tessWorker
  if (tessBoot && tessLangs === langs) return tessBoot

  if (tessWorker) {
    try {
      await tessWorker.terminate()
    } catch {
      /* ignore */
    }
    tessWorker = null
  }

  tessLangs = langs
  tessBoot = (async () => {
    const { createWorker } = await import('tesseract.js')
    const worker = (await createWorker(langs, undefined, {
      logger: () => undefined,
    })) as unknown as TesseractWorker
    tessWorker = worker
    return worker
  })()

  try {
    return await tessBoot
  } finally {
    tessBoot = null
  }
}

async function tryTesseractOcr(
  dataUrl: string,
  locale?: AppLocale,
  signal?: AbortSignal,
): Promise<string | undefined> {
  try {
    const langs = ocrLangsForLocale(locale)
    const worker = await getTesseractWorker(langs, signal)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const result = await worker.recognize(dataUrl)
    return cleanOcrText(result.data.text ?? '')
  } catch {
    return undefined
  }
}

async function runOcr(
  dataUrl: string,
  locale?: AppLocale,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const quick = await tryBrowserOcr(dataUrl)
  if (quick) return quick
  return tryTesseractOcr(dataUrl, locale, signal)
}

export async function loadHomeworkImageFile(
  file: File,
  opts?: ScanLoadOptions,
): Promise<ScanImageResult> {
  if (!isLikelyImageFile(file)) {
    throw new Error('unsupported_image')
  }
  const raw = await readFileAsDataUrl(file)
  const dataUrl = await preprocessHomeworkImage(raw)
  const probe = new Image()
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    probe.onload = () => resolve({ width: probe.width, height: probe.height })
    probe.onerror = () => resolve({ width: 0, height: 0 })
    probe.src = dataUrl
  })
  if (dims.width < 8 || dims.height < 8) {
    throw new Error('bad_image')
  }
  const ocrText = await runOcr(dataUrl, opts?.locale, opts?.signal)
  return { dataUrl, width: dims.width, height: dims.height, ocrText }
}

export async function captureHomeworkFromCamera(
  opts?: ScanLoadOptions,
): Promise<ScanImageResult | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } },
    audio: false,
  })
  try {
    const video = document.createElement('video')
    video.srcObject = stream
    video.playsInline = true
    await video.play()
    await new Promise((r) => setTimeout(r, 350))
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, w, h)
    const raw = canvas.toDataURL('image/jpeg', 0.92)
    const dataUrl = await preprocessHomeworkImage(raw)
    const ocrText = await runOcr(dataUrl, opts?.locale, opts?.signal)
    return { dataUrl, width: w, height: h, ocrText }
  } finally {
    for (const t of stream.getTracks()) t.stop()
  }
}
