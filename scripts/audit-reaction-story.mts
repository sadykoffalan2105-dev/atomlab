/**
 * Аудит раскладки «сюжета реакции» по всем 200 основным реакциям — без браузера, по геометрии раскладки.
 *
 * Для каждой реакции и трёх моментов (середина переноса e⁻, конец образования, итог) считает в плоскости кадра:
 *  • clash   — пары видимых атомов (лицевые копии), не связанные палочкой, чьи шары перекрываются сильнее 12 % суммы радиусов;
 *  • crop    — атом выходит за рамку кадра (extent раскладки) больше чем на 5 % её размера;
 *  • spread  — итог занимает < 35 % площади рамки (пустой кадр) или вытянут сильнее 4:1;
 *  • compact — реакция в компактном виде (стопка копий).
 * Режимы: desktop и lowPower (телефон). Выход — таблица по категориям и список худших реакций.
 *
 *   npx tsx scripts/audit-reaction-story.mts [--json out.json] [--ids mr001,mr002]
 */
import fs from 'node:fs'
import { MAIN_REACTIONS_200 } from '../src/data/catalog/mainReactions200.ts'
import { buildReactionStory } from '../src/chemistry/reactionStory.ts'
import { buildStoryLayout, smooth, storyAtomPos, storyAtomRadius, type StoryLayout } from '../src/lab/cinema/scenes/story/storyLayout.ts'

const args = process.argv.slice(2)
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : undefined
const only = args.includes('--ids') ? new Set(args[args.indexOf('--ids') + 1]!.split(',')) : null

type Moment = 'electrons' | 'formation' | 'result'
type Row = { id: string; eq: string; mode: 'desktop' | 'phone'; compact: boolean; clash: Record<Moment, number>; worst: number; crop: number; fill: number; aspect: number }

function stickVisible(lay: StoryLayout, k: number, t: number): boolean {
  const s = lay.sticks[k]!
  if (s.kind === 'kept') return true
  if (s.kind === 'broken') return t < s.t1
  return t > s.t0
}

function frontAt(lay: StoryLayout, i: number, t: number): boolean {
  const left = t < lay.moveFrom[i]! + lay.moveDur * 0.5
  return (left ? lay.layerL[i] : lay.layerR[i]) === 0
}

function measure(lay: StoryLayout, t: number): { clash: number; worst: number; box: { minX: number; maxX: number; minY: number; maxY: number }; crop: number } {
  const n = lay.n
  const P = new Float32Array(n * 3)
  const R = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    storyAtomPos(lay, i, t, P, i * 3)
    R[i] = storyAtomRadius(lay, i, t)
  }
  const bonded = new Set<number>()
  lay.sticks.forEach((s, k) => {
    if (stickVisible(lay, k, t)) bonded.add(s.a * 100000 + s.b).add(s.b * 100000 + s.a)
  })
  let clash = 0
  let worst = 0
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  const vis: number[] = []
  for (let i = 0; i < n; i++) if (frontAt(lay, i, t)) vis.push(i)
  for (const i of vis) {
    box.minX = Math.min(box.minX, P[i * 3]! - R[i]!)
    box.maxX = Math.max(box.maxX, P[i * 3]! + R[i]!)
    box.minY = Math.min(box.minY, P[i * 3 + 1]! - R[i]!)
    box.maxY = Math.max(box.maxY, P[i * 3 + 1]! + R[i]!)
  }
  for (let a = 0; a < vis.length; a++) {
    for (let b = a + 1; b < vis.length; b++) {
      const i = vis[a]!
      const j = vis[b]!
      if (bonded.has(i * 100000 + j)) continue
      const d = Math.hypot(P[i * 3]! - P[j * 3]!, P[i * 3 + 1]! - P[j * 3 + 1]!)
      const over = 1 - d / (R[i]! + R[j]!)
      if (over > 0.12) {
        clash++
        worst = Math.max(worst, over)
      }
    }
  }
  // рамка кадра — как ReactionStoryScene.extentAt: исходные → итог во время образования
  const u = smooth(lay.formFrom + 0.2, lay.formTo, t)
  const A = lay.extentL
  const B = lay.extentR
  const e = { w: A.w + (B.w - A.w) * u, h: A.h + (B.h - A.h) * u, cx: A.cx + (B.cx - A.cx) * u, cy: A.cy + (B.cy - A.cy) * u }
  const fx0 = e.cx - e.w / 2
  const fx1 = e.cx + e.w / 2
  const fy0 = e.cy - e.h / 2
  const fy1 = e.cy + e.h / 2
  const crop = Math.max(0, (fx0 - box.minX) / e.w, (box.maxX - fx1) / e.w, (fy0 - box.minY) / e.h, (box.maxY - fy1) / e.h)
  return { clash, worst, box, crop }
}

const rows: Row[] = []
const chem: string[] = []
for (const r of MAIN_REACTIONS_200) {
  if (only && !only.has(r.id)) continue
  const story = buildReactionStory(r.equation)
  if (!story) {
    chem.push(`${r.id}: сюжет не построен (${r.equation})`)
    continue
  }
  for (const mode of ['desktop', 'phone'] as const) {
    const lay = buildStoryLayout(story, { lowPower: mode === 'phone' })
    const st = (id: string) => lay.steps.find((s) => s.id === id)
    const tE = st('electrons')
    const tF = st('formation')!
    const tR = st('result')!
    const times: Record<Moment, number> = {
      electrons: tE ? tE.to - 0.15 : (tF.from + tF.to) / 2,
      formation: tF.to - 0.1,
      result: tR.to - 0.2,
    }
    const clash = {} as Record<Moment, number>
    let worst = 0
    let crop = 0
    let res: ReturnType<typeof measure> | null = null
    for (const m of Object.keys(times) as Moment[]) {
      const x = measure(lay, times[m])
      clash[m] = x.clash
      worst = Math.max(worst, x.worst)
      crop = Math.max(crop, x.crop)
      if (m === 'result') res = x
    }
    const bw = res!.box.maxX - res!.box.minX
    const bh = res!.box.maxY - res!.box.minY
    // доля кадра итога (камера наезжает на продукт — рамка итога extentR)
    const fill = (bw * bh) / (lay.extentR.w * lay.extentR.h)
    rows.push({ id: r.id, eq: r.equation, mode, compact: lay.compact, clash, worst, crop, fill, aspect: Math.max(bw / bh, bh / bw) })
  }
}

const cat = (pred: (x: Row) => boolean, mode: Row['mode']) => rows.filter((x) => x.mode === mode && pred(x))
for (const mode of ['desktop', 'phone'] as const) {
  const clashE = cat((x) => x.clash.electrons > 0, mode)
  const clashF = cat((x) => x.clash.formation > 0, mode)
  const clashR = cat((x) => x.clash.result > 0, mode)
  const crop = cat((x) => x.crop > 0.05, mode)
  const empty = cat((x) => x.fill < 0.35, mode)
  const thin = cat((x) => x.aspect > 4, mode)
  const compact = cat((x) => x.compact, mode)
  console.log(`\n[${mode}] реакций: ${rows.filter((x) => x.mode === mode).length}`)
  console.log(`  наложения — перенос e⁻: ${clashE.length}, образование: ${clashF.length}, итог: ${clashR.length}`)
  console.log(`  выход за кадр > 5 %: ${crop.length}; пустой итог (< 35 % рамки): ${empty.length}; вытянут > 4:1: ${thin.length}; компактный вид: ${compact.length}`)
  const worst = rows
    .filter((x) => x.mode === mode)
    .map((x) => ({ x, s: x.clash.electrons + x.clash.formation + x.clash.result + (x.crop > 0.05 ? 5 : 0) }))
    .filter((y) => y.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 15)
  for (const { x } of worst) {
    console.log(`   ${x.id} ${x.eq.slice(0, 58).padEnd(58)} e:${x.clash.electrons} f:${x.clash.formation} r:${x.clash.result} max:${(x.worst * 100).toFixed(0)}% crop:${(x.crop * 100).toFixed(0)}%${x.compact ? ' [compact]' : ''}`)
  }
}
if (chem.length) console.log('\nхимия:', chem.join('\n  '))
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1))
