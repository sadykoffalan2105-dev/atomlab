/**
 * Скан ДЗ: камера / файл → превью + текст.
 * OCR: браузерный (если доступен) или ручная расшифровка учителем.
 */

export type ScanImageResult = {
  dataUrl: string
  width: number
  height: number
  /** Если браузер/движок смог вытащить текст */
  ocrText?: string
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
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

async function tryBrowserOcr(dataUrl: string): Promise<string | undefined> {
  // Experimental: некоторые Chromium-сборки / Electron могут дать TextDetector.
  const Detector = (window as unknown as { TextDetector?: new (o: { types: string[] }) => {
    detect: (img: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
  } }).TextDetector
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
    const text = bits.map((b) => b.rawValue ?? '').filter(Boolean).join('\n').trim()
    return text || undefined
  } catch {
    return undefined
  }
}

export async function loadHomeworkImageFile(file: File): Promise<ScanImageResult> {
  const raw = await readFileAsDataUrl(file)
  const dataUrl = await preprocessHomeworkImage(raw)
  const probe = new Image()
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    probe.onload = () => resolve({ width: probe.width, height: probe.height })
    probe.onerror = () => resolve({ width: 0, height: 0 })
    probe.src = dataUrl
  })
  const ocrText = await tryBrowserOcr(dataUrl)
  return { dataUrl, width: dims.width, height: dims.height, ocrText }
}

export async function captureHomeworkFromCamera(): Promise<ScanImageResult | null> {
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
    const ocrText = await tryBrowserOcr(dataUrl)
    return { dataUrl, width: w, height: h, ocrText }
  } finally {
    for (const t of stream.getTracks()) t.stop()
  }
}
