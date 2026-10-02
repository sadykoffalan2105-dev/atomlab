/**
 * Ядро модели намерений: формат файла, квантованные веса (int8, base64), логиты и softmax.
 * Общий код для обучения (scripts/teacher-ml) и браузера (intentClassifier.ts).
 */
import { extractIntentFeatures } from './intentFeatures'

export interface IntentModelFile {
  v: 1
  intents: string[]
  /** Имена признаков в порядке строк матрицы весов. */
  features: string[]
  /** Масштаб int8 → float по классам: w = q / scale[c]. */
  scale: number[]
  bias: number[]
  /** Int8-матрица [features × intents] построчно, base64. */
  w: string
  meta?: Record<string, unknown>
}

/** Онлайн-дельты (дообучение в браузере): признак → { намерение → добавка к логиту }. */
export type IntentDeltas = Record<string, Record<string, number>>

export function decodeInt8(b64: string): Int8Array {
  let bytes: Uint8Array
  if (typeof atob === 'function') {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } else {
    bytes = new Uint8Array(Buffer.from(b64, 'base64'))
  }
  return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length)
}

export function encodeInt8(arr: Int8Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.length)
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

export function softmax(logits: ArrayLike<number>): number[] {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (logits[i]! > max) max = logits[i]!
  const exps: number[] = []
  let sum = 0
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i]! - max)
    exps.push(e)
    sum += e
  }
  return exps.map((e) => e / sum)
}

/** Активные признаки реплики с нормировкой на единичную длину: [индекс/имя, вес]. */
export function featurize(text: string, index: Map<string, number>): { names: string[]; ids: number[]; x: number } {
  const names = extractIntentFeatures(text)
  const ids: number[] = []
  for (const n of names) {
    const id = index.get(n)
    if (id !== undefined) ids.push(id)
  }
  const x = names.length ? 1 / Math.sqrt(names.length) : 0
  return { names, ids, x }
}

export interface IntentPrediction {
  intent: string
  p: number
  top3: { intent: string; p: number }[]
  probs: number[]
}

export class IntentModel {
  readonly intents: string[]
  readonly features: string[]
  readonly index: Map<string, number>
  private readonly w: Int8Array
  private readonly scale: number[]
  private readonly bias: number[]
  private readonly C: number

  constructor(file: IntentModelFile) {
    this.intents = file.intents
    this.features = file.features
    this.index = new Map(file.features.map((f, i) => [f, i]))
    this.w = decodeInt8(file.w)
    this.scale = file.scale
    this.bias = file.bias
    this.C = file.intents.length
  }

  weight(featureId: number, classId: number): number {
    return this.w[featureId * this.C + classId]! / this.scale[classId]!
  }

  logits(text: string, deltas?: IntentDeltas): { logits: number[]; names: string[] } {
    const { names, ids, x } = featurize(text, this.index)
    const logits = this.bias.slice()
    for (const id of ids) {
      const base = id * this.C
      for (let c = 0; c < this.C; c++) logits[c]! += (this.w[base + c]! / this.scale[c]!) * x
    }
    if (deltas) {
      for (const n of names) {
        const d = deltas[n]
        if (!d) continue
        for (const k in d) {
          const c = this.intents.indexOf(k)
          if (c >= 0) logits[c]! += d[k]! * x
        }
      }
    }
    return { logits, names }
  }

  predict(text: string, deltas?: IntentDeltas): IntentPrediction {
    const { logits } = this.logits(text, deltas)
    const probs = softmax(logits)
    const order = probs.map((_, i) => i).sort((a, b) => probs[b]! - probs[a]!)
    const top3 = order.slice(0, 3).map((i) => ({ intent: this.intents[i]!, p: probs[i]! }))
    return { intent: top3[0]!.intent, p: top3[0]!.p, top3, probs }
  }

  /** Вклад признаков в логит класса (для диагностики). */
  contributions(text: string, classId: number, deltas?: IntentDeltas): { feature: string; value: number }[] {
    const { names, x } = featurize(text, this.index)
    const out: { feature: string; value: number }[] = []
    for (const n of names) {
      const id = this.index.get(n)
      let v = id !== undefined ? this.weight(id, classId) * x : 0
      const d = deltas?.[n]?.[this.intents[classId]!]
      if (d) v += d * x
      if (v !== 0) out.push({ feature: n, value: v })
    }
    return out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  }
}
