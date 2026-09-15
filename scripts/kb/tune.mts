/**
 * Coordinate-descent tuning of the search weights (src/learn/kb/engine.ts DEFAULT_TUNING).
 * Tunes on a deterministic "dev" half of the answerable questions and reports the "test" half separately,
 * so improvements that only fit the noisy quiz labels are visible.
 *
 *   npx tsx scripts/kb/tune.mts [--rounds 2]
 * Prints the best tuning as JSON; copy the values you accept into DEFAULT_TUNING.
 */
import { DEFAULT_TUNING, type KbTuning } from '../../src/learn/kb/engine.ts'
import { buildEvalSet, type EvalItem } from './lib/evalSet.mts'
import { indexedSections, loadEngine, metrics, runItems } from './lib/evalRun.mts'
import { fnv1a } from './lib/holdout.mts'

const rounds = Number(process.argv[process.argv.indexOf('--rounds') + 1] || 2)
const { engine } = loadEngine()
const sections = indexedSections(engine)
const items = buildEvalSet().items.filter((i) => i.gold.some((g) => sections.has(g)))
const dev = items.filter((i) => i.id.startsWith('card-') || fnv1a(`${i.id}|${i.lang}|dev`) % 2 === 0)
const test = items.filter((i) => i.id.startsWith('card-') || fnv1a(`${i.id}|${i.lang}|dev`) % 2 === 1)

const GROUPS: [string, (i: EvalItem) => boolean][] = [
  ['g7', (i) => i.grade === 7 && i.lang === 'ru' && !i.id.startsWith('card-')],
  ['g8', (i) => i.grade === 8 && i.lang === 'ru' && !i.id.startsWith('card-')],
  ['g9', (i) => i.grade === 9 && i.lang === 'ru' && !i.id.startsWith('card-')],
  ['g10-11', (i) => i.grade >= 10 && i.lang === 'ru'],
  ['en', (i) => i.lang === 'en' && !i.id.startsWith('card-')],
  ['uz', (i) => i.lang === 'uz' && !i.id.startsWith('card-')],
  ['cards', (i) => i.id.startsWith('card-')],
]

/** section labels (MRR, R@5) and, where the quiz answer is checkable, the label-free answer-bearing A@5 */
function groupScore(m: ReturnType<typeof metrics>): number {
  const labels = (m.mrr + m.r5) / 2
  return m.na ? 0.5 * labels + 0.5 * m.a5 : labels
}

function objective(set: EvalItem[], t: KbTuning): number {
  engine.tuning = t
  const withGrade = runItems(engine, set, { useGrade: true, variant: 'q' })
  const noGrade = runItems(engine, set, { useGrade: false, variant: 'q' })
  let score = 0
  for (const [, pred] of GROUPS) {
    const a = metrics(withGrade.filter((r) => pred(r.item)))
    const b = metrics(noGrade.filter((r) => pred(r.item)))
    score += 0.75 * groupScore(a) + 0.25 * groupScore(b)
  }
  return score / GROUPS.length
}

type Knob = { name: string; get: (t: KbTuning) => number; set: (t: KbTuning, v: number) => KbTuning; values: number[] }
const knob = (name: keyof KbTuning, values: number[]): Knob => ({
  name,
  get: (t) => t[name] as number,
  set: (t, v) => ({ ...t, [name]: v }),
  values,
})
const arrKnob = (name: 'boost' | 'b', idx: number, values: number[]): Knob => ({
  name: `${name}[${idx}]`,
  get: (t) => t[name][idx],
  set: (t, v) => {
    const arr = [...t[name]] as [number, number, number]
    arr[idx] = v
    return { ...t, [name]: arr }
  },
  values,
})
const typeKnob = (type: keyof KbTuning['typePrior'], values: number[]): Knob => ({
  name: `typePrior.${type}`,
  get: (t) => t.typePrior[type],
  set: (t, v) => ({ ...t, typePrior: { ...t.typePrior, [type]: v } }),
  values,
})

const KNOBS: Knob[] = [
  knob('k1', [0.8, 1.2, 1.6, 2.2]),
  arrKnob('boost', 0, [1.5, 2.6, 4, 6]),
  arrKnob('boost', 1, [0.8, 1.6, 2.5]),
  arrKnob('b', 0, [0.2, 0.35, 0.6]),
  arrKnob('b', 2, [0.5, 0.75, 0.9]),
  knob('lenFloor', [0, 0.2, 0.35, 0.5, 0.7]),
  knob('coordFloor', [0.1, 0.25, 0.35, 0.5, 0.7]),
  knob('coordPow', [0.7, 1, 1.5, 2]),
  knob('gradeSame', [1.2, 1.35, 1.6, 2]),
  knob('gradeNear', [0.8, 0.92, 1]),
  knob('gradeFar', [0.6, 0.8, 0.9]),
  typeKnob('card', [0.6, 0.75, 0.9, 1]),
  knob('cardIntent', [1.2, 1.45, 1.8, 2.4, 3]),
  typeKnob('summary', [0.7, 0.85, 0.92, 1]),
  typeKnob('faq', [0.7, 0.9, 1]),
  typeKnob('definition', [0.8, 1, 1.15]),
  knob('definitionIntent', [1, 1.2, 1.35, 1.6]),
  knob('latinOriginal', [0.1, 0.2, 0.3, 0.5]),
  knob('translitWeight', [0.3, 0.45, 0.6, 0.8, 1]),
  knob('proximityStep', [0, 0.06, 0.12, 0.2]),
  knob('titleCoverage', [0, 0.15, 0.3, 0.5, 0.8]),
  knob('definesBoost', [0, 0.15, 0.3, 0.5, 0.8]),
  knob('proximityMax', [0.2, 0.36, 0.6]),
  knob('kpBoost', [1.5, 2.2, 3]),
  knob('maxPerSection', [1, 2, 3, 4]),
]

let best: KbTuning = { ...DEFAULT_TUNING }
let bestScore = objective(dev, best)
console.log(`[tune] dev ${dev.length} / test ${test.length}; start dev=${bestScore.toFixed(4)} test=${objective(test, best).toFixed(4)}`)
for (let r = 0; r < rounds; r += 1) {
  for (const k of KNOBS) {
    const current = k.get(best)
    let localBest = current
    for (const v of k.values) {
      if (v === current) continue
      const cand = k.set(best, v)
      const s = objective(dev, cand)
      if (s > bestScore + 0.002) {
        bestScore = s
        localBest = v
        best = cand
      }
    }
    if (localBest !== current) console.log(`[tune] r${r} ${k.name}: ${current} → ${localBest}  dev=${bestScore.toFixed(4)}`)
  }
}
console.log(`[tune] final dev=${bestScore.toFixed(4)} test=${objective(test, best).toFixed(4)} (default test=${objective(test, DEFAULT_TUNING).toFixed(4)})`)
console.log(JSON.stringify(best))
