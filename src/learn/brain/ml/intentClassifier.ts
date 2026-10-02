/**
 * Классификатор намерений ученика в браузере (без сети и ключей).
 *
 * - базовая модель: src/data/teacher/intentModel.json (dynamic import — отдельный чанк, кеш в памяти);
 * - дообучение в моменте: teachIntent(text, intent) хранит перцептронные дельты признаков в
 *   localStorage (atomlab.teacher.intent-deltas) — они складываются с логитами базовой модели;
 * - explainIntent — вклад признаков для диагностики.
 */
import { INTENTS, type Intent } from './intentFeatures'
import { IntentModel, type IntentDeltas, type IntentModelFile, type IntentPrediction } from './intentModelCore'

export type { Intent } from './intentFeatures'
export type { IntentPrediction } from './intentModelCore'

export const DELTAS_KEY = 'atomlab.teacher.intent-deltas'
const MAX_DELTA_FEATURES = 1500
const LEARN_RATE = 0.8
const MAX_PASSES = 6

/* ------------------------------------------------------------ модель */

let modelPromise: Promise<IntentModel | null> | null = null
let modelSync: IntentModel | null = null

export function loadIntentModel(): Promise<IntentModel | null> {
  if (!modelPromise) {
    modelPromise = import('../../../data/teacher/intentModel.json')
      .then((mod) => {
        const file = (mod as { default: IntentModelFile }).default
        modelSync = new IntentModel(file)
        return modelSync
      })
      .catch((err: unknown) => {
        console.warn('[intent] не удалось загрузить модель', err)
        modelPromise = null
        return null
      })
  }
  return modelPromise
}

/** Для тестов: подставить модель напрямую (без dynamic import). */
export function setIntentModel(file: IntentModelFile): void {
  modelSync = new IntentModel(file)
  modelPromise = Promise.resolve(modelSync)
}

/* ------------------------------------------------------------ дельты (дообучение) */

let memoryDeltas: IntentDeltas | null = null
let useMemoryOnly = false
let cache: IntentDeltas | null = null

/** Для тестов и приватного режима: дельты только в памяти процесса. */
export function setIntentMemoryBackend(): void {
  useMemoryOnly = true
  memoryDeltas = {}
  cache = null
}

function readDeltas(): IntentDeltas {
  if (cache) return cache
  if (useMemoryOnly) return (cache = memoryDeltas ?? (memoryDeltas = {}))
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELTAS_KEY) : null
    const parsed = raw ? (JSON.parse(raw) as IntentDeltas) : {}
    return (cache = parsed && typeof parsed === 'object' ? parsed : {})
  } catch {
    return (cache = {})
  }
}

function writeDeltas(d: IntentDeltas): void {
  cache = d
  if (useMemoryOnly) {
    memoryDeltas = d
    return
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DELTAS_KEY, JSON.stringify(d))
  } catch {
    /* приватный режим — живём в памяти */
  }
}

export function forgetIntentDeltas(): void {
  writeDeltas({})
  try {
    if (!useMemoryOnly && typeof localStorage !== 'undefined') localStorage.removeItem(DELTAS_KEY)
  } catch {
    /* ignore */
  }
}

export function intentDeltaStats(): { features: number; corrections: number } {
  const d = readDeltas()
  const features = Object.keys(d).length
  const corrections = Number((d.__meta as { n?: number } | undefined)?.n ?? 0)
  return { features, corrections }
}

/** Ограничить число признаков в дельтах (убираем самые слабые). */
function prune(d: IntentDeltas): IntentDeltas {
  const keys = Object.keys(d).filter((k) => k !== '__meta')
  if (keys.length <= MAX_DELTA_FEATURES) return d
  const weight = (k: string) => Object.values(d[k]!).reduce((s, v) => s + Math.abs(v), 0)
  keys.sort((a, b) => weight(b) - weight(a))
  const next: IntentDeltas = {}
  if (d.__meta) next.__meta = d.__meta
  for (const k of keys.slice(0, MAX_DELTA_FEATURES)) next[k] = d[k]!
  return next
}

/* ------------------------------------------------------------ предсказание */

const isIntent = (s: string): s is Intent => (INTENTS as readonly string[]).includes(s)

/** Предсказать намерение: { intent, p, top3 }. null — модель недоступна или текст пуст. */
export async function predictIntent(text: string): Promise<IntentPrediction | null> {
  if (!text.trim()) return null
  const model = modelSync ?? (await loadIntentModel())
  if (!model) return null
  return model.predict(text, readDeltas())
}

/** Синхронно, если модель уже загружена (иначе null). */
export function predictIntentSync(text: string): IntentPrediction | null {
  if (!modelSync || !text.trim()) return null
  return modelSync.predict(text, readDeltas())
}

/**
 * Обучение в моменте: сдвинуть дельты так, чтобы `text` относился к `intent`
 * (перцептрон поверх базовой модели; несколько проходов, пока нужный класс не победит).
 */
export async function teachIntent(text: string, intent: Intent | string): Promise<boolean> {
  if (!isIntent(intent) || !text.trim()) return false
  const model = modelSync ?? (await loadIntentModel())
  if (!model) return false
  const d = readDeltas()
  let changed = false
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const { logits, names } = model.logits(text, d)
    const target = model.intents.indexOf(intent)
    let best = 0
    for (let c = 1; c < logits.length; c++) if (logits[c]! > logits[best]!) best = c
    // нужный класс уже впереди с запасом — хватит
    if (best === target && logits[target]! - Math.max(...logits.filter((_, i) => i !== target)) > 1.0) break
    const x = names.length ? 1 / Math.sqrt(names.length) : 0
    const loser = best === target ? -1 : best
    for (const n of names) {
      if (n.startsWith('s:len') || n === 's:cyr' || n === 's:lat') continue // форма не должна «запоминать» ученика
      const row = (d[n] ??= {})
      row[intent] = (row[intent] ?? 0) + LEARN_RATE * x
      if (loser >= 0) {
        const lk = model.intents[loser]!
        row[lk] = (row[lk] ?? 0) - LEARN_RATE * x
      }
    }
    changed = true
  }
  if (changed) {
    const meta = (d.__meta ??= {})
    meta.n = (meta.n ?? 0) + 1
    writeDeltas(prune(d))
  }
  return changed
}

/** Диагностика: топ-3 и главные признаки за/против первого варианта. */
export async function explainIntent(text: string): Promise<{
  prediction: IntentPrediction
  contributions: { feature: string; value: number }[]
  deltasUsed: number
} | null> {
  const model = modelSync ?? (await loadIntentModel())
  if (!model || !text.trim()) return null
  const d = readDeltas()
  const prediction = model.predict(text, d)
  const classId = model.intents.indexOf(prediction.intent)
  const contributions = model.contributions(text, classId, d).slice(0, 12)
  const names = new Set(model.logits(text).names)
  const deltasUsed = Object.keys(d).filter((k) => names.has(k)).length
  return { prediction, contributions, deltasUsed }
}
