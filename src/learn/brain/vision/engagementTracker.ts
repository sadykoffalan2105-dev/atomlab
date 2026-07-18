/**
 * Computer Vision & Engagement Tracking.
 *
 * Обрабатывает видеопоток веб-камеры в реальном времени и выдаёт VisionSignal:
 *  • присутствие и число лиц (списывание вдвоём),
 *  • направление взгляда/поворот головы (смотрит ли в экран лаборатории),
 *  • накопленное время «взгляд в сторону»,
 *  • подозрение на второй экран/телефон,
 *  • грубую оценку эмоции (нейтрально/растерян/фрустрация/уверен/скучает).
 *
 * Работает без внешних ML-зависимостей: попиксельный анализ на уменьшенном
 * кадре + опциональный нативный FaceDetector. Анализатор лица подключаемый
 * (FaceAnalyzer) — при желании можно подставить модель с ландмарками/эмоциями.
 */
import type { EmotionState, EngagementLevel, VisionSignal } from '../brainTypes'

// --- Нативный FaceDetector (экспериментальный API, нет в стандартных d.ts) ---
interface NativeDetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number }
}
interface NativeFaceDetector {
  detect(source: CanvasImageSource): Promise<NativeDetectedFace[]>
}
type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector

function getFaceDetectorCtor(): FaceDetectorCtor | null {
  const w = window as unknown as { FaceDetector?: FaceDetectorCtor }
  return typeof w.FaceDetector === 'function' ? w.FaceDetector : null
}

export interface FaceObservation {
  present: boolean
  count: number
  /** Центр лица по X 0..1 (0 — левый край кадра). */
  cx: number
  /** Центр лица по Y 0..1. */
  cy: number
  /** Относительный размер лица 0..1 (доля кадра). */
  size: number
  brightness: number
  /** Межкадровое движение 0..1. */
  motion: number
  /** Подозрение на второй экран/телефон в кадре. */
  secondaryScreen: boolean
}

export interface FrameInput {
  data: Uint8ClampedArray
  width: number
  height: number
  prevLuma: Float32Array | null
  lumaOut: Float32Array
}

export interface FaceAnalyzer {
  analyze(input: FrameInput): FaceObservation
}

function isSkin(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return (
    r > 95 &&
    g > 40 &&
    b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g &&
    r > b
  )
}

/** Эвристический анализатор по пикселям — работает везде, без моделей. */
export class HeuristicFaceAnalyzer implements FaceAnalyzer {
  analyze(input: FrameInput): FaceObservation {
    const { data, width, height, prevLuma, lumaOut } = input
    const total = width * height
    let brightnessSum = 0
    let skinCount = 0
    let sumX = 0
    let sumY = 0
    let motionSum = 0
    let glowCount = 0

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const r = data[p]!
      const g = data[p + 1]!
      const b = data[p + 2]!
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      lumaOut[i] = luma
      brightnessSum += luma

      if (prevLuma) motionSum += Math.abs(luma - prevLuma[i]!)

      const x = i % width
      const y = (i / width) | 0

      if (isSkin(r, g, b)) {
        skinCount++
        sumX += x
        sumY += y
      }

      // Второй экран/телефон: очень яркий холодный (синеватый) блик в нижней части.
      if (luma > 0.82 && b >= r && y > height * 0.55) glowCount++
    }

    const brightness = brightnessSum / total
    const motion = prevLuma ? Math.min(1, (motionSum / total) * 6) : 0
    const coverage = skinCount / total
    const present = coverage > 0.02
    const cx = skinCount > 0 ? sumX / skinCount / width : 0.5
    const cy = skinCount > 0 ? sumY / skinCount / height : 0.5
    const size = Math.min(1, coverage * 4)
    const secondaryScreen = glowCount / total > 0.03

    return { present, count: present ? 1 : 0, cx, cy, size, brightness, motion, secondaryScreen }
  }
}

export interface EngagementTrackerOptions {
  fps?: number
  /** Разрешение уменьшенного кадра для анализа. */
  sampleWidth?: number
  sampleHeight?: number
  analyzer?: FaceAnalyzer
  onSignal: (signal: VisionSignal) => void
}

const AWAY_ABSENT_MS = 2500

export class EngagementTracker {
  private readonly video: HTMLVideoElement
  private readonly analyzer: FaceAnalyzer
  private readonly onSignal: (signal: VisionSignal) => void
  private readonly sampleW: number
  private readonly sampleH: number
  private readonly intervalMs: number

  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private prevLuma: Float32Array | null = null
  private lumaA: Float32Array
  private lumaB: Float32Array
  private useA = true

  private lookAwaySinceMs: number | null = null
  private emotionSmoothed: EmotionState = 'neutral'
  private emotionHold = 0
  private motionHistory: number[] = []

  // Нативный детектор лиц (если доступен) — запускается реже, кэширует результат.
  private faceDetector: NativeFaceDetector | null = null
  private lastFaces: NativeDetectedFace[] | null = null
  private lastDetectMs = 0
  private detecting = false

  constructor(video: HTMLVideoElement, options: EngagementTrackerOptions) {
    this.video = video
    this.analyzer = options.analyzer ?? new HeuristicFaceAnalyzer()
    this.onSignal = options.onSignal
    this.sampleW = options.sampleWidth ?? 160
    this.sampleH = options.sampleHeight ?? 120
    this.intervalMs = Math.round(1000 / Math.min(12, Math.max(3, options.fps ?? 6)))
    const len = this.sampleW * this.sampleH
    this.lumaA = new Float32Array(len)
    this.lumaB = new Float32Array(len)

    const Ctor = getFaceDetectorCtor()
    if (Ctor) {
      try {
        this.faceDetector = new Ctor({ fastMode: true, maxDetectedFaces: 3 })
      } catch {
        this.faceDetector = null
      }
    }
  }

  start(): void {
    if (this.timer) return
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.sampleW
    this.canvas.height = this.sampleH
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.ctx = null
    this.canvas = null
    this.prevLuma = null
    this.lastFaces = null
    this.lookAwaySinceMs = null
  }

  private maybeDetectFaces(): void {
    if (!this.faceDetector || !this.canvas || this.detecting) return
    const now = Date.now()
    if (now - this.lastDetectMs < 450) return
    this.detecting = true
    this.lastDetectMs = now
    this.faceDetector
      .detect(this.canvas)
      .then((faces) => {
        this.lastFaces = faces
      })
      .catch(() => {
        this.lastFaces = null
      })
      .finally(() => {
        this.detecting = false
      })
  }

  private classifyEmotion(onScreen: boolean, yaw: number, motion: number): EmotionState {
    this.motionHistory.push(motion)
    if (this.motionHistory.length > 12) this.motionHistory.shift()
    const avgMotion =
      this.motionHistory.reduce((s, v) => s + v, 0) / Math.max(1, this.motionHistory.length)

    let candidate: EmotionState = 'neutral'
    if (motion > 0.4 && !onScreen) candidate = 'frustrated'
    else if (!onScreen && avgMotion < 0.08) candidate = 'bored'
    else if (onScreen && avgMotion < 0.06 && Math.abs(yaw) > 0.18) candidate = 'confused'
    else if (onScreen && avgMotion > 0.12 && avgMotion < 0.35 && Math.abs(yaw) < 0.15) {
      candidate = 'confident'
    }

    // Гистерезис, чтобы эмоция не мигала на шуме.
    if (candidate === this.emotionSmoothed) {
      this.emotionHold = Math.min(6, this.emotionHold + 1)
    } else {
      this.emotionHold -= 1
      if (this.emotionHold <= 0) {
        this.emotionSmoothed = candidate
        this.emotionHold = 2
      }
    }
    return this.emotionSmoothed
  }

  private tick(): void {
    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas) return
    if (this.video.readyState < 2 || this.video.videoWidth === 0) return

    try {
      ctx.drawImage(this.video, 0, 0, this.sampleW, this.sampleH)
    } catch {
      return // кадр ещё не готов / cross-origin
    }

    let image: ImageData
    try {
      image = ctx.getImageData(0, 0, this.sampleW, this.sampleH)
    } catch {
      return
    }

    const lumaOut = this.useA ? this.lumaA : this.lumaB
    const obs = this.analyzer.analyze({
      data: image.data,
      width: this.sampleW,
      height: this.sampleH,
      prevLuma: this.prevLuma,
      lumaOut,
    })
    this.prevLuma = lumaOut
    this.useA = !this.useA

    this.maybeDetectFaces()

    // Уточнение по нативному детектору лиц, если результат свежий.
    let cx = obs.cx
    let cy = obs.cy
    let size = obs.size
    let count = obs.count
    let present = obs.present
    if (this.lastFaces && Date.now() - this.lastDetectMs < 1500) {
      count = this.lastFaces.length
      present = count > 0
      const primary = this.lastFaces[0]
      if (primary) {
        const bb = primary.boundingBox
        cx = (bb.x + bb.width / 2) / this.sampleW
        cy = (bb.y + bb.height / 2) / this.sampleH
        size = Math.min(1, (bb.width * bb.height) / (this.sampleW * this.sampleH) * 3)
      }
    }

    const now = Date.now()
    const yaw = (cx - 0.5) * 2
    const pitch = (0.45 - cy) * 2
    const onScreen =
      present && Math.abs(cx - 0.5) < 0.24 && cy > 0.15 && cy < 0.75 && size > 0.08

    if (onScreen) {
      this.lookAwaySinceMs = null
    } else if (this.lookAwaySinceMs == null) {
      this.lookAwaySinceMs = now
    }
    const lookingAwayMs = this.lookAwaySinceMs ? now - this.lookAwaySinceMs : 0

    const emotion = this.classifyEmotion(onScreen, yaw, obs.motion)

    let engagement: EngagementLevel = 'focused'
    if (count > 1 || obs.secondaryScreen) engagement = 'suspicious'
    else if (!present || lookingAwayMs > AWAY_ABSENT_MS) engagement = 'absent'
    else if (!onScreen) engagement = 'distracted'

    // Достоверность выше, когда лицо крупное и стабильное.
    const confidence = Math.min(1, size * 1.5 + (this.faceDetector ? 0.2 : 0))

    const signal: VisionSignal = {
      tsMs: now,
      facePresent: present,
      faceCount: count,
      gaze: { onScreen, yaw, pitch },
      engagement,
      emotion,
      confidence,
      lookingAwayMs,
      secondaryScreenSuspected: obs.secondaryScreen || count > 1,
      brightness: obs.brightness,
    }
    this.onSignal(signal)
  }
}
