/**
 * Обучение классификатора намерений ученика: мультиномиальная логистическая регрессия (softmax)
 * на символьных n-граммах, основах слов и признаках формы. Отбор признаков по частоте и взаимной
 * информации, веса квантуются в int8 → src/data/teacher/intentModel.json (≤ 400 КБ).
 *
 *   npm run teacher:intent-train
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { INTENTS, extractIntentFeatures, type Intent } from '../../src/learn/brain/ml/intentFeatures.ts'
import { IntentModel, encodeInt8, softmax, type IntentModelFile } from '../../src/learn/brain/ml/intentModelCore.ts'
import { HOLDOUT } from './intent-holdout.mts'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, 'data', 'intent-dataset.json')
const OUT = join(here, '..', '..', 'src', 'data', 'teacher', 'intentModel.json')
const MAX_FEATURES = Number(process.env.INTENT_MAX_FEATURES ?? 6500)
const EPOCHS = Number(process.env.INTENT_EPOCHS ?? 24)
const LR = 0.5
const L2 = 2e-5
const SIZE_LIMIT = 400 * 1024

interface Row { text: string; intent: Intent }
const ds = JSON.parse(readFileSync(DATA, 'utf8')) as { train: Row[]; heldout: Row[] }
const C = INTENTS.length
const classId = new Map<string, number>(INTENTS.map((k, i) => [k, i]))

// ---------------------------------------------------------------- признаки + отбор
const trainFeats = ds.train.map((r) => extractIntentFeatures(r.text))
const df = new Map<string, number>()
const dfc = new Map<string, Int32Array>()
for (let i = 0; i < trainFeats.length; i++) {
  const c = classId.get(ds.train[i]!.intent)!
  for (const f of trainFeats[i]!) {
    df.set(f, (df.get(f) ?? 0) + 1)
    let arr = dfc.get(f)
    if (!arr) dfc.set(f, (arr = new Int32Array(C)))
    arr[c]!++
  }
}
const N = trainFeats.length
const classCount = new Int32Array(C)
for (const r of ds.train) classCount[classId.get(r.intent)!]!++
/** Взаимная информация признака с меткой (бинарный признак). */
function mutualInfo(f: string): number {
  const n1 = df.get(f)!
  const p1 = n1 / N
  const p0 = 1 - p1
  const counts = dfc.get(f)!
  let mi = 0
  for (let c = 0; c < C; c++) {
    const pc = classCount[c]! / N
    const p11 = counts[c]! / N
    const p01 = pc - p11
    if (p11 > 0) mi += p11 * Math.log(p11 / (p1 * pc))
    if (p01 > 0 && p0 > 0) mi += p01 * Math.log(p01 / (p0 * pc))
  }
  return mi
}
const candidates = [...df.keys()].filter((f) => df.get(f)! >= 2 || f.startsWith('s:'))
const ranked = candidates.map((f) => [f, mutualInfo(f)] as const).sort((a, b) => b[1] - a[1])
const features = ranked.slice(0, MAX_FEATURES).map(([f]) => f)
const index = new Map(features.map((f, i) => [f, i]))
const F = features.length
console.log(`[train-intent] обучающих ${N}, кандидатов признаков ${df.size}, после отбора ${F}`)

const trainX = trainFeats.map((fs) => {
  const ids: number[] = []
  for (const f of fs) {
    const id = index.get(f)
    if (id !== undefined) ids.push(id)
  }
  return { ids, x: fs.length ? 1 / Math.sqrt(fs.length) : 0 }
})
const trainY = ds.train.map((r) => classId.get(r.intent)!)

// ---------------------------------------------------------------- обучение (softmax, Adagrad)
const W = new Float64Array(F * C)
const B = new Float64Array(C)
const G = new Float64Array(F * C).fill(1e-8)
const GB = new Float64Array(C).fill(1e-8)
let seed = 12345
const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
const order = trainX.map((_, i) => i)
const logits = new Float64Array(C)
for (let ep = 0; ep < EPOCHS; ep++) {
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  let loss = 0
  for (const i of order) {
    const { ids, x } = trainX[i]!
    const y = trainY[i]!
    for (let c = 0; c < C; c++) logits[c] = B[c]!
    for (const id of ids) {
      const base = id * C
      for (let c = 0; c < C; c++) logits[c]! += W[base + c]! * x
    }
    const p = softmax(logits)
    loss -= Math.log(Math.max(p[y]!, 1e-12))
    for (let c = 0; c < C; c++) {
      const g = p[c]! - (c === y ? 1 : 0)
      GB[c]! += g * g
      B[c]! -= (LR / Math.sqrt(GB[c]!)) * g
      for (const id of ids) {
        const k = id * C + c
        const gw = g * x + L2 * W[k]!
        G[k]! += gw * gw
        W[k]! -= (LR / Math.sqrt(G[k]!)) * gw
      }
    }
  }
  if (ep % 4 === 3 || ep === EPOCHS - 1) console.log(`[train-intent] эпоха ${ep + 1}: loss ${(loss / N).toFixed(4)}`)
}

// ---------------------------------------------------------------- квантование int8 (масштаб по классу)
const scale: number[] = []
for (let c = 0; c < C; c++) {
  let max = 1e-6
  for (let f = 0; f < F; f++) max = Math.max(max, Math.abs(W[f * C + c]!))
  scale.push(127 / max)
}
const q = new Int8Array(F * C)
for (let f = 0; f < F; f++) for (let c = 0; c < C; c++) q[f * C + c] = Math.max(-127, Math.min(127, Math.round(W[f * C + c]! * scale[c]!)))

// ---------------------------------------------------------------- оценка
function evaluate(model: IntentModel, rows: Row[], label: string, verbose = false): number {
  let ok = 0
  const errors: string[] = []
  const perIntent = new Map<string, [number, number]>()
  for (const r of rows) {
    const pred = model.predict(r.text)
    const pi = perIntent.get(r.intent) ?? [0, 0]
    pi[1]++
    if (pred.intent === r.intent) {
      ok++
      pi[0]++
    } else errors.push(`  ✗ «${r.text}» → ${pred.intent} (${pred.p.toFixed(2)}), ожидалось ${r.intent}`)
    perIntent.set(r.intent, pi)
  }
  const acc = ok / rows.length
  console.log(`[train-intent] ${label}: accuracy ${(acc * 100).toFixed(1)} % (${ok}/${rows.length})`)
  if (verbose) {
    const weak = [...perIntent.entries()].filter(([, [a, b]]) => a / b < 0.9).map(([k, [a, b]]) => `${k} ${a}/${b}`)
    if (weak.length) console.log(`[train-intent]   слабые намерения: ${weak.join(', ')}`)
    for (const e of errors.slice(0, 40)) console.log(e)
  }
  return acc
}

const file: IntentModelFile = {
  v: 1,
  intents: [...INTENTS],
  features,
  scale: scale.map((s) => Number(s.toPrecision(6))),
  bias: Array.from(B, (b) => Number(b.toPrecision(5))),
  w: encodeInt8(q),
}
const model = new IntentModel(file)
const accHeld = evaluate(model, ds.heldout, 'отложенная выборка (генератор)')
const accHand = evaluate(model, HOLDOUT, 'рукописный набор (150 живых фраз)', true)
file.meta = {
  trained: new Date().toISOString().slice(0, 10),
  train: N,
  heldout: ds.heldout.length,
  features: F,
  accHeldout: Number(accHeld.toFixed(4)),
  accHandwritten: Number(accHand.toFixed(4)),
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(file), 'utf8')
const size = statSync(OUT).size
console.log(`[train-intent] модель → ${OUT} (${(size / 1024).toFixed(0)} КБ, лимит ${SIZE_LIMIT / 1024} КБ)`)
if (size > SIZE_LIMIT) {
  console.error('[train-intent] ОШИБКА: модель больше лимита — уменьшите INTENT_MAX_FEATURES')
  process.exit(1)
}
