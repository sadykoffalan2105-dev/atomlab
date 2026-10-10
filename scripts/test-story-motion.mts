/**
 * Нормы движения «сюжета реакции» v2 по всем 200 основным реакциям (как test-formation-motion для «Как образуется»):
 *  • тепловые колебания: |Δr| ≤ 4 пм (в масштабе сюжета, STORY_PM_K), частота самой быстрой составляющей ≤ 1,5 Гц,
 *    уровень 0 в t = 0 (плавный разгон), 0 после разрыва + 1 с, 0 в «Итоге»; за кадр (60 к/с) смещение не прыгает;
 *  • прочие периодические эффекты сцены ≤ 1,5 Гц (STORY_FX_HZ и проверка исходника сцены на Math.sin(t * ω));
 *  • «Итог» без колебаний: у каждого атома и каждой частицы окружения скорость по каждой оси меняет знак не больше
 *    одного раза (плавное движение, а не дрожание); никаких скачков на всём ролике: смещение за кадр ≤ 0,5 ед.
 *    (нет «телепорта»), и скорость меняется плавно — шаг соседних кадров отличается ≤ 0,15 ед. (нет разрыва скорости; быстрые перелёты по дорожкам глубины — до ~0,1);
 *  • окружение итога: у каждого продукта есть фаза; частицы не входят в атомы сюжета; дрейф газа монотонный,
 *    скорость 0 в начале и в конце; у кристаллов (осадок, ионный / молекулярный / металл) — фрагмент решётки;
 *  • пары: неподелённых 0…4 на атом, σ на каждой разрываемой/новой связи участников, π — по кратности; пары
 *    видны только на шагах «Разрыв / Перенос e⁻ / Образование».
 *   npx tsx scripts/test-story-motion.mts
 */
import { readFileSync } from 'node:fs'
import { MAIN_REACTIONS_200 } from '../src/data/catalog/mainReactions200.ts'
import { buildReactionStory } from '../src/chemistry/reactionStory.ts'
import { buildStoryLayout, storyAtomPos } from '../src/lab/cinema/scenes/story/storyLayout.ts'
import { STORY_FX_HZ, STORY_PM_K, STORY_VIB, storyVibLevel, storyVibOffset, storyVibWindow } from '../src/lab/cinema/scenes/story/storyMotion.ts'
import { buildStoryPairs, pairsVisibility } from '../src/lab/cinema/scenes/story/storyPairs.ts'
import { buildStoryEnv, envDrift } from '../src/lab/cinema/scenes/story/storyPhase.ts'

let fails = 0
let checks = 0
const bad: string[] = []
function ok(c: boolean, msg: string): void {
  checks++
  if (!c) {
    fails++
    if (bad.length < 40) bad.push(msg)
  }
}

// ─── частоты эффектов ───
ok(STORY_VIB.hz * 1.11 <= 1.5 + 1e-9, `колебания: 1,11·${STORY_VIB.hz} Гц > 1,5`)
ok(STORY_VIB.ampPm <= 4, `амплитуда ${STORY_VIB.ampPm} пм > 4`)
for (const [k, hz] of Object.entries(STORY_FX_HZ)) ok(hz <= 1.5, `эффект ${k}: ${hz} Гц > 1,5`)
const src = readFileSync(new URL('../src/lab/cinema/scenes/story/ReactionStoryScene.ts', import.meta.url), 'utf8')
for (const m of src.matchAll(/Math\.sin\(\s*t\s*\*\s*([\d.]+)/g)) ok(Number(m[1]) / (2 * Math.PI) <= 1.5, `сцена: Math.sin(t * ${m[1]}) — ${(Number(m[1]) / (2 * Math.PI)).toFixed(2)} Гц > 1,5`)
ok(!/0\.018 \* sway/.test(src), 'сцена: старое «дыхание» 0,018 ед. (≈ 8 пм) в «Итоге» осталось')

const AMAX = STORY_VIB.ampPm * STORY_PM_K
const FPS = 60
let maxAmpPm = 0
let maxStep = 0
let maxJerk = 0
let worstOsc = 0
let reactions = 0
const phases: Record<string, number> = {}
let envTotal = 0
let pairsLone = 0
let pairsBond = 0

/** Счётчик смен знака скорости (с мёртвой зоной) — дрожание даёт много смен. */
function signFlips(xs: number[], dead: number): number {
  let flips = 0
  let prev = 0
  for (let k = 1; k < xs.length; k++) {
    const v = xs[k]! - xs[k - 1]!
    if (Math.abs(v) < dead) continue
    const s = Math.sign(v)
    if (prev && s !== prev) flips++
    prev = s
  }
  return flips
}

for (const r of MAIN_REACTIONS_200) {
  const story = buildReactionStory(r.equation)
  if (!story) {
    ok(false, `${r.id}: сюжет не построен`)
    continue
  }
  reactions++
  for (const lowPower of [false, true]) {
    const tag = `${r.id}${lowPower ? ' [тел.]' : ''}`
    const lay = buildStoryLayout(story, { lowPower })
    const w = storyVibWindow(lay.steps, lay.breakFrom)
    const res = lay.steps.find((s) => s.id === 'result')!
    const brk = lay.steps.find((s) => s.id === 'breaking')!
    ok(storyVibLevel(w, 0) === 0, `${tag}: колебания не с нуля`)
    ok(storyVibLevel(w, lay.breakFrom + 1.0001) === 0, `${tag}: колебания не затухли через 1 с после разрыва`)
    ok(storyVibLevel(w, res.from) === 0, `${tag}: колебания в «Итоге»`)
    const n = lay.n
    const off = [0, 0, 0]
    const pos = new Float32Array(n * 3)
    const prev = new Float32Array(n * 3)
    const lastStep = new Float32Array(n).fill(-1)
    const frames = Math.ceil(lay.end * FPS)
    // траектории «Итога» (для поиска дрожания)
    const trace: number[][] = Array.from({ length: n * 3 }, () => [])
    for (let f = 0; f <= frames; f++) {
      const t = Math.min(lay.end, f / FPS)
      for (let i = 0; i < n; i++) {
        storyAtomPos(lay, i, t, pos, i * 3)
        storyVibOffset(w, i, t, off, 0)
        const a = Math.hypot(off[0]!, off[1]!, off[2]!)
        maxAmpPm = Math.max(maxAmpPm, a / STORY_PM_K)
        if (a > AMAX * 1.0001) ok(false, `${tag}: |Δr| = ${(a / STORY_PM_K).toFixed(2)} пм > 4 (атом ${i}, t ${t.toFixed(2)})`)
        for (let c = 0; c < 3; c++) pos[i * 3 + c] = pos[i * 3 + c]! + off[c]!
        if (f > 0) {
          const st = Math.hypot(pos[i * 3]! - prev[i * 3]!, pos[i * 3 + 1]! - prev[i * 3 + 1]!, pos[i * 3 + 2]! - prev[i * 3 + 2]!)
          maxStep = Math.max(maxStep, st)
          if (st > 0.5) ok(false, `${tag}: скачок ${st.toFixed(3)} ед. за кадр (атом ${i}, t ${t.toFixed(2)})`)
          if (lastStep[i]! >= 0) {
            const jerk = Math.abs(st - lastStep[i]!)
            maxJerk = Math.max(maxJerk, jerk)
            if (jerk > 0.15) ok(false, `${tag}: рывок ${jerk.toFixed(3)} ед. (атом ${i}, t ${t.toFixed(2)})`)
          }
          lastStep[i] = st
        }
        if (t >= res.from) for (let c = 0; c < 3; c++) trace[i * 3 + c]!.push(pos[i * 3 + c]!)
      }
      prev.set(pos)
    }
    let osc = 0
    for (const tr of trace) osc = Math.max(osc, signFlips(tr, 1e-6))
    worstOsc = Math.max(worstOsc, osc)
    ok(osc <= 1, `${tag}: в «Итоге» атом колеблется (смен знака скорости ${osc})`)

    // окружение итога
    const env = buildStoryEnv(story, lay, { lowPower })
    envTotal += env.particles.length
    ok(env.products.length === story.terms.filter((x) => x.side === 'right').length, `${tag}: фаза есть не у всех продуктов`)
    for (const p of env.products) {
      phases[p.phase] = (phases[p.phase] ?? 0) + (lowPower ? 0 : 1)
      ok(p.caption.every((x) => x.length > 3 && !/undefined|\bNaN\b/.test(x)), `${tag}: пустая подпись фазы ${p.formula}`)
      const own = env.particles.filter((q) => q.term === p.term).length
      const term = story.terms.find((x) => x.index === p.term)!
      if (term.fate === 'precipitate') ok(own > 0 && p.phase !== 'gas' && p.phase !== 'solution', `${tag}: осадок ${p.formula} без решётки (${p.phase}, ${own})`)
      if (term.fate === 'gas') ok(p.phase === 'gas', `${tag}: газ ${p.formula} — фаза ${p.phase}`)
    }
    for (const q of env.particles) {
      for (let i = 0; i < n; i++) {
        if (lay.layerR[i]) continue
        const d = Math.hypot(lay.p4[i * 3]! - q.x, lay.p4[i * 3 + 1]! - q.y, lay.p4[i * 3 + 2]! - q.z)
        if (d < (lay.radiusR[i]! + q.r) * 1.0) ok(false, `${tag}: частица окружения ${q.el} входит в атом ${lay.el[i]} (${d.toFixed(3)})`)
      }
    }
    // дрейф газа: монотонный, скорость 0 на концах
    const d0 = envDrift(env, env.driftFrom)
    const d1 = envDrift(env, env.driftTo)
    ok(d0 === 0, `${tag}: дрейф не с нуля`)
    let last = -1
    for (let k = 0; k <= 50; k++) {
      const v = envDrift(env, env.driftFrom + ((env.driftTo - env.driftFrom) * k) / 50)
      ok(v >= last - 1e-12, `${tag}: дрейф газа немонотонный`)
      last = v
    }
    const eps = 1e-3
    ok(Math.abs(envDrift(env, env.driftFrom + eps) - d0) / eps < 0.01, `${tag}: дрейф стартует рывком`)
    ok(Math.abs(d1 - envDrift(env, env.driftTo - eps)) / eps < 0.01, `${tag}: дрейф останавливается рывком`)

    // пары
    const pr = buildStoryPairs(story, lay, { lowPower })
    if (!lowPower) {
      pairsLone += pr.lone.length
      pairsBond += pr.bond.length
    }
    ok(pairsVisibility(pr, brk.from - 0.01) === 0, `${tag}: пары видны до разрыва`)
    ok(pairsVisibility(pr, res.from + 0.51) === 0, `${tag}: пары видны в «Итоге»`)
    const per = new Map<string, number>()
    for (const lp of pr.lone) {
      const k = `${lp.atom}|${lp.t0}`
      per.set(k, (per.get(k) ?? 0) + 1)
      ok(Math.abs(Math.hypot(lp.dx, lp.dy, lp.dz) - 1) < 1e-6, `${tag}: направление пары не единичное`)
    }
    for (const [k, c] of per) ok(c <= 4, `${tag}: у атома ${k} ${c} неподелённых пар > 4`)
    const sig = new Map<number, number>()
    for (const b of pr.bond) if (b.kind === 'sigma') sig.set(b.stick, (sig.get(b.stick) ?? 0) + 1)
    for (const b of pr.bond) {
      const s = lay.sticks[b.stick]!
      ok(s.kind !== 'kept', `${tag}: пара на сохранённой связи`)
      ok(sig.get(b.stick) === 1, `${tag}: σ-пар на связи ${sig.get(b.stick)}`)
      if (b.kind === 'pi') ok(s.order >= 2, `${tag}: π-пара на одинарной связи`)
    }
    // окружение в «Итоге» тоже без колебаний: только монотонный дрейф
    for (const q of env.particles.slice(0, 40)) {
      const xs: number[] = []
      const ys: number[] = []
      for (let f = 0; f <= 60; f++) {
        const t = res.from + ((lay.end - res.from) * f) / 60
        const dr = envDrift(env, t)
        xs.push(q.x + q.vx * dr)
        ys.push(q.y + q.vy * dr)
      }
      ok(signFlips(xs, 1e-9) === 0 && signFlips(ys, 1e-9) === 0, `${tag}: частица окружения колеблется`)
    }
  }
}

console.log(`реакций: ${reactions}; макс. амплитуда колебаний ${maxAmpPm.toFixed(2)} пм (норма 4); макс. смещение за кадр ${maxStep.toFixed(3)} ед., макс. рывок ${maxJerk.toFixed(3)} ед.; макс. смен знака скорости в «Итоге» ${worstOsc}`)
console.log(`фазы продуктов: ${JSON.stringify(phases)}; частиц окружения (ПК+тел.): ${envTotal}; пар: неподелённых ${pairsLone}, общих ${pairsBond}`)
if (bad.length) console.error(bad.map((x) => `  ✗ ${x}`).join('\n'))
console.log(`test-story-motion: ${checks - fails}/${checks} проверок`)
if (fails) {
  console.log('FAIL')
  process.exit(1)
}
console.log('OK')
