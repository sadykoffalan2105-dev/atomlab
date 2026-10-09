/**
 * Нормы движения «Как образуется» (категория P аудита scripts/audit-formation-200.mts) — быстрый отдельный тест:
 *  1. vibOf(story): ampPm ≤ VIB_LIMITS.ampPm (4 пм), hz ≤ VIB_LIMITS.hzMax (1,5 Гц) у всех 200;
 *  2. если есть src/components/lab/formation/motion.ts (vibOffset) — у 7 ОВР-веществ (и у всех 200 по этапам) vibOffset
 *     при 120 Гц по всему показу: |смещение| ≤ 4 пм·K, в этапах «Решётка» / «Готово» ≤ 0,3 пм·K, частота по нулям ≤ 1,5 Гц,
 *     в начале нагрева (heat.t0) < 0,2 пм·K — без скачка; в FormationMoleculeView.tsx HEAT_AMP_PM ≤ 4 и нет «7 + 11 *»;
 *     нет motion.ts — «P: skip (нет motion.ts)»;
 *  3. atomPosAt непрерывен: |Δ| за 1/120 с ≤ 0,08·R_model у всех 200 (нет телепортаций).
 * K = pmToScene(1) — сколько единиц сцены в 1 пм.
 * Запуск: npx tsx scripts/test-formation-motion.mts  (npm run test:formation-motion)
 */
import { readFileSync } from 'node:fs'
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { atomPosAt, formationStoryFor, type FormationStory } from '../src/components/lab/formation/formationStory'
import { VIB_LIMITS, vibOf } from '../src/components/lab/formation/story/phase'
import { pmToScene } from '../src/lab/cinema/scenes/kit/cpkAtoms'

type V3 = [number, number, number]
export type MotionResult = { flagged: Set<string>; notes: string[]; skipped: boolean; continuityChecked: number }

const K = pmToScene(1)
const HZ = 120

export async function checkMotion(ids: readonly string[] = CATALOG_TOP200_IDS, opts: { continuity?: boolean } = {}): Promise<MotionResult> {
  const flagged = new Set<string>()
  const notes: string[] = []
  const flag = (id: string, msg: string) => {
    flagged.add(id)
    notes.push(`P ${id}: ${msg}`)
  }
  // motion.ts (исполнитель A) может ещё не быть в ветке — тогда динамическая часть пропускается.
  let vibOffset: ((s: FormationStory, i: number, t: number, out: V3) => V3) | null = null
  try {
    const mod = (await import('../src/components/lab/formation/motion')) as { vibOffset?: typeof vibOffset }
    vibOffset = typeof mod.vibOffset === 'function' ? mod.vibOffset : null
  } catch {
    vibOffset = null
  }
  if (vibOffset) {
    const src = readFileSync(new URL('../src/components/lab/formation/FormationMoleculeView.tsx', import.meta.url), 'utf8')
    const amp = /HEAT_AMP_PM\s*=\s*([\d.]+)/.exec(src)
    if (amp && Number(amp[1]) > VIB_LIMITS.ampPm) flag('view', `HEAT_AMP_PM = ${amp[1]} > ${VIB_LIMITS.ampPm}`)
    if (/7\s*\+\s*11\s*\*/.test(src)) flag('view', 'в FormationMoleculeView.tsx осталась частота «7 + 11 *» (7–18 Гц)')
  }
  let continuityChecked = 0
  for (const id of ids) {
    const story = formationStoryFor(id)
    const c = compoundById[id]
    const model = c ? buildSchoolHeroModel(c) : null
    if (!story || !model) continue
    const v = vibOf(story)
    if (v.ampPm > VIB_LIMITS.ampPm) flag(id, `vib.ampPm ${v.ampPm} > ${VIB_LIMITS.ampPm}`)
    if (v.hz > VIB_LIMITS.hzMax) flag(id, `vib.hz ${v.hz} > ${VIB_LIMITS.hzMax}`)
    const n = model.atoms.length
    const dt = 1 / HZ
    if (vibOffset) {
      const st = (k: string) => story.stages.find((s) => s.key === k)
      const calm = ['lattice', 'final'].map(st).filter(Boolean) as { t0: number; dur: number }[]
      const heat = st('heat')
      const o: V3 = [0, 0, 0]
      let maxA = 0
      let maxCalm = 0
      for (let i = 0; i < n; i++) {
        let prev = 0
        let cross = 0
        let active = 0
        for (let t = 0; t <= story.total; t += dt) {
          vibOffset(story, i, t, o)
          const a = Math.hypot(o[0], o[1], o[2])
          if (!Number.isFinite(a)) {
            flag(id, `vibOffset(${i}, ${t.toFixed(2)}) = NaN`)
            break
          }
          maxA = Math.max(maxA, a)
          if (calm.some((s) => t >= s.t0 + 0.05 && t < s.t0 + s.dur)) maxCalm = Math.max(maxCalm, a)
          // частота по нулям x-компоненты на участках с колебаниями
          if (a > 1e-6) {
            if (prev !== 0 && Math.sign(o[0]) !== Math.sign(prev)) cross++
            active += dt
            prev = o[0]
          }
        }
        if (cross > 0 && active > 1) {
          const hz = cross / 2 / active
          if (hz > VIB_LIMITS.hzMax + 0.05) flag(id, `атом ${i}: частота колебаний ≈ ${hz.toFixed(2)} Гц > ${VIB_LIMITS.hzMax}`)
        }
        if (heat) {
          vibOffset(story, i, heat.t0, o)
          if (Math.hypot(o[0], o[1], o[2]) >= 0.2 * K) flag(id, `атом ${i}: скачок в начале нагрева (${(Math.hypot(o[0], o[1], o[2]) / K).toFixed(2)} пм)`)
        }
      }
      if (maxA > VIB_LIMITS.ampPm * K * 1.001) flag(id, `vibOffset max ${(maxA / K).toFixed(2)} пм > ${VIB_LIMITS.ampPm}`)
      if (maxCalm > VIB_LIMITS.latticeAmpPm * K * 1.001) flag(id, `в «Решётке»/«Готово» колебания ${(maxCalm / K).toFixed(2)} пм > ${VIB_LIMITS.latticeAmpPm}`)
    }
    if (opts.continuity !== false) {
      // непрерывность atomPosAt: шаг за 1/120 с ≤ 0,08·R_model
      const lim = 0.08 * model.radius
      const a: V3 = [0, 0, 0]
      const b: V3 = [0, 0, 0]
      let worst = 0
      let at = ''
      for (let i = 0; i < n; i++) {
        atomPosAt(story, i, 0, a)
        for (let t = dt; t <= story.total + 1e-9; t += dt) {
          atomPosAt(story, i, t, b)
          const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
          if (!Number.isFinite(d)) {
            worst = Infinity
            at = `атом ${i}, t = ${t.toFixed(2)}: NaN`
            break
          }
          if (d > worst) {
            worst = d
            at = `атом ${i}, t = ${t.toFixed(2)} с`
          }
          a[0] = b[0]
          a[1] = b[1]
          a[2] = b[2]
        }
      }
      continuityChecked++
      if (worst > lim) flag(id, `atomPosAt: скачок ${(worst / model.radius).toFixed(3)}·R за 1/120 с (${at}) > 0,08·R`)
    }
  }
  return { flagged, notes, skipped: !vibOffset, continuityChecked }
}

if (process.argv[1] && /test-formation-motion/.test(process.argv[1])) {
  const t0 = Date.now()
  const r = await checkMotion()
  if (r.skipped) console.log('P: skip (нет motion.ts) — проверены только vibOf и непрерывность atomPosAt')
  for (const n of r.notes) console.log(`  ${n}`)
  console.log(`Непрерывность atomPosAt: ${r.continuityChecked} веществ, нарушений P: ${r.flagged.size} (${((Date.now() - t0) / 1000).toFixed(1)} с)`)
  if (r.flagged.size) process.exit(1)
  console.log('ОК: нормы движения соблюдены')
}
