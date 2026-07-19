/**
 * Unified Context Engine — граф контекста, объединяющий три потока сигналов
 * (камера / аудио+STT / лаборатория) в единое сведённое состояние за миллисекунды.
 *
 * Реализовано как граф активаций: узлы держат «энергию» с экспоненциальным
 * затуханием во времени, рёбра распространяют активацию между связанными
 * наблюдениями (например, «отвёл взгляд» усиливает «упало внимание»).
 * На выходе — FusedContext: то, чем оперирует мозг при принятии решений.
 */
import {
  DEFAULT_AUDIO_SIGNAL,
  DEFAULT_VISION_SIGNAL,
  type AudioSignal,
  type EmotionState,
  type EngagementLevel,
  type FusedContext,
  type LabCorrectness,
  type LabSignal,
  type VisionSignal,
} from './brainTypes'

interface GraphNode {
  id: string
  activation: number
  lastMs: number
}

interface GraphEdge {
  from: string
  to: string
  weight: number
}

function nowMs(): number {
  return Date.now()
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/** Половина активации теряется за HALF_LIFE_MS без подкрепления. */
const HALF_LIFE_MS = 4000

export class ContextGraph {
  private readonly nodes = new Map<string, GraphNode>()
  private readonly edges: GraphEdge[] = []

  private vision: VisionSignal = { ...DEFAULT_VISION_SIGNAL }
  private audio: AudioSignal = { ...DEFAULT_AUDIO_SIGNAL }
  private lab: LabSignal | null = null

  // Сглаженные интегральные показатели.
  private attention = 0.7
  private integrityRisk = 0
  private lastFinalTranscript = ''

  constructor() {
    // Базовые причинно-следственные рёбра между наблюдениями.
    this.link('gaze_away', 'attention_drop', 0.7)
    this.link('face_absent', 'attention_drop', 0.9)
    this.link('secondary_screen', 'integrity_risk', 0.8)
    this.link('gaze_away', 'integrity_risk', 0.25)
    this.link('frustrated', 'needs_support', 0.8)
    this.link('confused', 'needs_support', 0.7)
    this.link('bored', 'attention_drop', 0.55)
    this.link('tired', 'attention_drop', 0.5)
    this.link('tired', 'needs_support', 0.45)
    this.link('curious', 'can_advance', 0.55)
    this.link('lab_error', 'needs_support', 0.5)
    this.link('confident', 'can_advance', 0.7)
  }

  private link(from: string, to: string, weight: number): void {
    this.edges.push({ from, to, weight })
  }

  private decayed(node: GraphNode, at: number): number {
    const dt = Math.max(0, at - node.lastMs)
    const factor = Math.pow(0.5, dt / HALF_LIFE_MS)
    return node.activation * factor
  }

  private bump(id: string, amount: number, at: number): void {
    const node = this.nodes.get(id)
    if (!node) {
      this.nodes.set(id, { id, activation: clamp01(amount), lastMs: at })
      return
    }
    node.activation = clamp01(this.decayed(node, at) + amount)
    node.lastMs = at
  }

  private propagate(at: number): void {
    for (const edge of this.edges) {
      const src = this.nodes.get(edge.from)
      if (!src) continue
      const a = this.decayed(src, at)
      if (a <= 0.02) continue
      this.bump(edge.to, a * edge.weight * 0.5, at)
    }
  }

  ingestVision(sig: VisionSignal): void {
    this.vision = sig
    const at = sig.tsMs || nowMs()
    if (!sig.facePresent) this.bump('face_absent', 0.8, at)
    if (!sig.gaze.onScreen) this.bump('gaze_away', 0.6, at)
    if (sig.secondaryScreenSuspected) this.bump('secondary_screen', 0.7, at)
    if (sig.faceCount > 1) this.bump('integrity_risk', 0.5, at)
    if (sig.emotion === 'frustrated') this.bump('frustrated', 0.7 * sig.confidence + 0.3, at)
    if (sig.emotion === 'confused') this.bump('confused', 0.6 * sig.confidence + 0.3, at)
    if (sig.emotion === 'confident') this.bump('confident', 0.5 * sig.confidence + 0.3, at)
    if (sig.emotion === 'bored') this.bump('bored', 0.55 * sig.confidence + 0.25, at)
    if (sig.emotion === 'tired') this.bump('tired', 0.5 * sig.confidence + 0.25, at)
    if (sig.emotion === 'curious') this.bump('curious', 0.5 * sig.confidence + 0.25, at)
    this.propagate(at)
    this.recompute(at)
  }

  ingestAudio(sig: AudioSignal): void {
    this.audio = sig
    const at = sig.tsMs || nowMs()
    if (sig.finalTranscript && sig.finalTranscript !== this.lastFinalTranscript) {
      this.lastFinalTranscript = sig.finalTranscript
      // Активная речь = вовлечён в диалог.
      this.bump('attention_drop', -0.3, at)
    }
    this.recompute(at)
  }

  ingestLab(sig: LabSignal): void {
    this.lab = sig
    const at = sig.tsMs || nowMs()
    if (sig.correctness === 'error') this.bump('lab_error', 0.6, at)
    this.propagate(at)
    this.recompute(at)
  }

  private activationOf(id: string, at: number): number {
    const node = this.nodes.get(id)
    return node ? clamp01(this.decayed(node, at)) : 0
  }

  private recompute(at: number): void {
    const attentionDrop = this.activationOf('attention_drop', at)
    const targetAttention = clamp01(1 - attentionDrop)
    // Плавно приближаемся к цели, чтобы не дёргать стратегию на шуме.
    this.attention = this.attention * 0.7 + targetAttention * 0.3

    this.integrityRisk = clamp01(
      Math.max(this.activationOf('integrity_risk', at), this.activationOf('secondary_screen', at) * 0.9),
    )
  }

  private engagementLevel(at: number): EngagementLevel {
    if (this.activationOf('integrity_risk', at) > 0.55) return 'suspicious'
    if (!this.vision.facePresent || this.activationOf('face_absent', at) > 0.6) return 'absent'
    if (this.attention < 0.45) return 'distracted'
    return 'focused'
  }

  private dominantEmotion(at: number): { emotion: EmotionState; confidence: number } {
    // Если камера только что дала эмоцию с хорошей уверенностью — не теряем её в графе.
    if (this.vision.emotion !== 'neutral' && this.vision.confidence >= 0.35) {
      const fresh =
        this.vision.emotion === 'bored'
          ? this.activationOf('bored', at)
          : this.vision.emotion === 'tired'
            ? this.activationOf('tired', at)
            : this.vision.emotion === 'curious'
              ? this.activationOf('curious', at)
              : this.activationOf(this.vision.emotion, at)
      if (fresh >= 0.2 || this.vision.confidence >= 0.45) {
        return {
          emotion: this.vision.emotion,
          confidence: clamp01(Math.max(this.vision.confidence, fresh)),
        }
      }
    }

    const candidates: { emotion: EmotionState; energy: number }[] = [
      { emotion: 'frustrated', energy: this.activationOf('frustrated', at) },
      { emotion: 'confused', energy: this.activationOf('confused', at) },
      { emotion: 'confident', energy: this.activationOf('confident', at) },
      { emotion: 'bored', energy: this.activationOf('bored', at) },
      { emotion: 'tired', energy: this.activationOf('tired', at) },
      { emotion: 'curious', energy: this.activationOf('curious', at) },
    ]
    candidates.sort((a, b) => b.energy - a.energy)
    const top = candidates[0]!
    if (top.energy < 0.22) return { emotion: 'neutral', confidence: 0.4 }
    return { emotion: top.emotion, confidence: clamp01(top.energy) }
  }

  /** Свести всё в единый мгновенный контекст. */
  fuse(): FusedContext {
    const at = nowMs()
    const { emotion, confidence } = this.dominantEmotion(at)
    const labCorrectness: LabCorrectness | null = this.lab ? this.lab.correctness : null
    return {
      tsMs: at,
      attention: clamp01(this.attention),
      emotion,
      emotionConfidence: confidence,
      engagement: this.engagementLevel(at),
      speaking: this.audio.speaking,
      integrityRisk: this.integrityRisk,
      labCorrectness,
      lastTranscript: this.audio.finalTranscript || this.audio.partialTranscript,
      present: this.vision.facePresent,
    }
  }

  reset(): void {
    this.nodes.clear()
    this.vision = { ...DEFAULT_VISION_SIGNAL }
    this.audio = { ...DEFAULT_AUDIO_SIGNAL }
    this.lab = null
    this.attention = 0.7
    this.integrityRisk = 0
    this.lastFinalTranscript = ''
  }
}
