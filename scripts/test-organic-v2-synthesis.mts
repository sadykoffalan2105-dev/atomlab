/**
 * Органика v2 · «Как образуется» — проверка сценария синтеза для ВСЕХ реакций reactions.json.
 *   npx tsx scripts/test-organic-v2-synthesis.mts
 * Проверяет: нет NaN; каждый атом с map есть слева и справа; изменения связей сценария = changes из данных;
 * продукт в конце — ровно RDKit-геометрия (жёсткое движение: длины связей не искажены);
 * траектории «Образования» не проходят ближе 0,6 Å от чужих атомов в середине пути (ни в одной реакции);
 * длительность этапов разумная; фразы учителя есть на 3 языках для всех этапов.
 */
import { readFileSync } from 'node:fs'
import type { OV2ReactionsFile } from '../src/data/organicV2/types.ts'
import {
  atomPositionsAt,
  bondLineScale,
  buildSynthesisScenario,
  speciesPositions,
  SYNTH_STAGE_KEYS,
} from '../src/chemistry/organicV2/synthesis/scenario.ts'
import { teacherLine, stageTitle } from '../src/chemistry/organicV2/synthesis/teacher.ts'
import { labelsOverlap, spreadLabels, type LabelBox } from '../src/components/organicV2/synthesis/labelLayout.ts'

const file = JSON.parse(readFileSync(new URL('../src/data/organicV2/reactions.json', import.meta.url), 'utf8')) as OV2ReactionsFile

let fail = 0
let warn = 0
const problems: string[] = []
const close: { id: string; n: number; min: number }[] = []
let grouped = 0
let maxTotal = 0
let minTotal = Infinity
let maxMs = 0
const t0all = performance.now()

for (const r of file.reactions) {
  const t0 = performance.now()
  const sc = buildSynthesisScenario(r)
  maxMs = Math.max(maxMs, performance.now() - t0)
  const err = (m: string) => {
    fail++
    if (problems.length < 60) problems.push(`${r.id}: ${m}`)
  }
  // 1) соответствие атомов
  const lMaps = new Set<number>()
  const rMaps = new Set<number>()
  for (const s of r.species) for (const m of s.map) (s.side === 'L' ? lMaps : rMaps).add(m)
  for (const m of lMaps) if (!rMaps.has(m)) err(`атом map ${m} есть слева, нет справа`)
  for (const m of rMaps) if (!lMaps.has(m)) err(`атом map ${m} есть справа, нет слева`)
  if (sc.grouped) {
    // «одна копия + ×N»: у каждого участника ровно одна показанная копия, число копий = число молекул
    grouped++
    const seen = new Map<string, number>()
    r.species.forEach((s, si) => {
      const k = `${s.side}|${s.ref}|${s.smiles}`
      seen.set(k, (seen.get(k) ?? 0) + 1)
      const x = sc.species[si]
      if (x.copies === 0 && x.atoms.length) err(`непоказанная копия ${s.ref} с атомами`)
    })
    for (const [k, n] of seen) {
      const shown = sc.species.filter((x) => `${x.side}|${x.ref}|${x.smiles}` === k && x.copies > 0)
      if (shown.length !== 1) err(`участник ${k}: показано копий ${shown.length}`)
      else if (shown[0].copies !== n) err(`участник ${k}: ×${shown[0].copies} вместо ×${n}`)
    }
    for (const a of sc.atoms) {
      if ((a.ls < 0) !== (a.ghost === 1)) err(`атом ${a.map}: нет участника слева, но не «появляется»`)
      if ((a.rs < 0) !== (a.ghost === -1)) err(`атом ${a.map}: нет участника справа, но не «гаснет»`)
    }
    if (sc.atoms.length > lMaps.size) err(`группировка увеличила сцену: ${sc.atoms.length} из ${lMaps.size}`)
  } else {
    if (sc.atoms.length !== lMaps.size) err(`атомов в сценарии ${sc.atoms.length} ≠ ${lMaps.size}`)
    for (const a of sc.atoms) if (a.ls < 0 || a.rs < 0) err(`атом ${a.map} без участника слева/справа`)
  }

  // 2) изменения связей = changes данных
  const want = new Set(r.changes.map((c) => `${Math.min(c.a, c.b)}-${Math.max(c.a, c.b)}:${c.from}>${c.to}`))
  const got = new Set(
    sc.bonds.filter((b) => b.kind !== 'keep').map((b) => {
      const a = sc.atoms[b.i].map
      const c = sc.atoms[b.j].map
      return `${Math.min(a, c)}-${Math.max(a, c)}:${b.from}>${b.to}`
    }),
  )
  if (!sc.grouped) for (const w of want) if (!got.has(w)) err(`изменение ${w} из changes не найдено в сценарии`)
  for (const g of got) if (!want.has(g)) err(`лишнее изменение ${g} (нет в changes)`)

  // 3) NaN и кадры
  const pos = new Float32Array(sc.atoms.length * 3)
  for (let k = 0; k <= 60; k++) {
    const t = (sc.total * k) / 60
    atomPositionsAt(sc, t, pos)
    for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) { err(`NaN в t=${t.toFixed(2)}`); break }
    for (const b of sc.bonds) for (let l = 0; l < 3; l++) if (!Number.isFinite(bondLineScale(b, l, t))) err('NaN толщины связи')
  }
  // 4) конечная геометрия продуктов = RDKit (длины всех связей продукта)
  atomPositionsAt(sc, sc.total, pos)
  const idOf = new Map(sc.atoms.map((a, i) => [a.map, i]))
  for (const [si, s] of r.species.entries()) {
    if (s.side !== 'R' || sc.species[si].copies === 0) continue
    const sp0 = speciesPositions(s) // RDKit, ионы раздвинуты, сбой 3D у металла исправлен
    for (const b of s.bonds) {
      const pa = sp0[b.a]
      const pb = sp0[b.b]
      const d0 = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
      const i = idOf.get(s.map[b.a])!
      const j = idOf.get(s.map[b.b])!
      const d1 = Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2])
      if (Math.abs(d1 - d0) > 0.01) { err(`связь продукта ${s.ref} искажена: ${d0.toFixed(3)} → ${d1.toFixed(3)}`); break }
    }
  }
  // 5) траектории: в середине пути — не ближе 0,6 Å к атомам других фрагментов (кроме будущих партнёров)
  const formed = new Set(sc.bonds.filter((b) => b.kind === 'form').map((b) => `${Math.min(b.i, b.j)}-${Math.max(b.i, b.j)}`))
  const f = sc.stages[3]
  let nClose = 0
  let minD = Infinity
  for (const s of [0.3, 0.5, 0.7]) {
    atomPositionsAt(sc, f.t0 + (f.t1 - f.t0) * 0.62 * s, pos)
    for (let i = 0; i < sc.atoms.length; i++) {
      for (let j = i + 1; j < sc.atoms.length; j++) {
        if (sc.atoms[i].frag === sc.atoms[j].frag || sc.atoms[i].ghost || sc.atoms[j].ghost) continue
        if (formed.has(`${i}-${j}`)) continue
        const d = Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2])
        if (d < minD) minD = d
        if (d < 0.6) nClose++
      }
    }
  }
  if (nClose) close.push({ id: r.id, n: nClose, min: minD })
  // 6) длительность
  maxTotal = Math.max(maxTotal, sc.total)
  minTotal = Math.min(minTotal, sc.total)
  if (sc.total > 26 || sc.total < 12) err(`длительность ${sc.total.toFixed(1)} с вне 12…26 с`)
  for (const st of sc.stages) if (st.t1 - st.t0 < 1.2) err(`этап ${st.key} короче 1,2 с`)
  // 7) учитель
  for (const lang of ['ru', 'en', 'uz'] as const) {
    for (const k of SYNTH_STAGE_KEYS) {
      if (!stageTitle(k, lang)) err(`нет названия этапа ${k}/${lang}`)
      const line = teacherLine(r, sc, k, lang)
      if (!line || line.includes('undefined') || line.includes('NaN')) err(`плохая фраза ${k}/${lang}: ${line}`)
    }
  }
}

// 8) раскладка подписей: после spreadLabels рамки не пересекаются (случайные скопления по 2…16 подписей,
//    в т. ч. «Глицерин» и «Уксусная кислота» в одной точке, как в гидролизе жира)
{
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  let bad = 0
  const cases: LabelBox[][] = [[{ x: 200, y: 150, w: 92, h: 34 }, { x: 205, y: 152, w: 128, h: 34 }]]
  for (let c = 0; c < 400; c++) {
    const k = 2 + Math.floor(rnd() * 15)
    const spread = 20 + rnd() * 260
    cases.push(Array.from({ length: k }, () => ({ x: 300 + (rnd() - 0.5) * spread, y: 200 + (rnd() - 0.5) * spread * 0.5, w: 50 + rnd() * 110, h: 22 + rnd() * 18 })))
  }
  for (const boxes of cases) {
    const off = spreadLabels(boxes)
    const moved = boxes.map((b, i) => ({ ...b, x: b.x + off[i].dx, y: b.y + off[i].dy }))
    if (labelsOverlap(moved)) bad++
  }
  if (bad) {
    fail++
    problems.push(`подписи: ${bad} из ${cases.length} раскладок с пересечением рамок`)
  }
  console.log(`подписи: ${cases.length} раскладок, пересечений ${bad}`)
}

const closeShare = close.length / file.reactions.length
for (const c of close.slice(0, 12)) console.log(`  близко: ${c.id} — ${c.n} пар < 0,6 Å (мин ${c.min.toFixed(2)} Å)`)
if (close.length) {
  fail++
  problems.push(`траектории: ${close.length} реакций с пролётом ближе 0,6 Å (нужно 0)`)
}
console.log(`реакций: ${file.reactions.length}; длительность ${minTotal.toFixed(1)}…${maxTotal.toFixed(1)} с; сборка сценария max ${maxMs.toFixed(1)} мс, всего ${(performance.now() - t0all).toFixed(0)} мс`)
console.log(`одна копия + ×N: ${grouped} реакций`)
console.log(`пролёт ближе 0,6 Å: ${close.length} реакций (${(closeShare * 100).toFixed(1)} %, нужно 0)`)
// ионы солей (NaBr, K₂SO₄, Ca(OH)₂…) не стоят друг в друге: несвязанные части участника — не ближе 2,3 Å
let ionPairs = 0
const ionBad = new Set<string>()
const longBond = new Set<string>()
for (const r of file.reactions) {
  for (const s of r.species) {
    const n = s.atoms.length
    const par = Array.from({ length: n }, (_, i) => i)
    const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x])))
    for (const b of s.bonds) par[find(b.a)] = find(b.b)
    const roots = s.atoms.map((_, i) => find(i))
    // сбой 3D (атом за десятки Å от соседей по связи) исправлен в speciesPositions
    const pp = speciesPositions(s)
    for (const b of s.bonds) {
      const d = Math.hypot(pp[b.a][0] - pp[b.b][0], pp[b.a][1] - pp[b.b][1], pp[b.a][2] - pp[b.b][2])
      if (d > 6) longBond.add(`${s.ref} (${d.toFixed(1)} Å)`)
    }
    if (new Set(roots).size < 2) continue
    ionPairs++
    const p = speciesPositions(s)
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (roots[i] !== roots[j] && Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]) < 2.3) ionBad.add(s.ref)
  }
}
console.log(`ионные участники: ${ionPairs}, частей ближе 2,3 Å: ${ionBad.size}`)
console.log(`связей длиннее 6 Å (сбой 3D): ${longBond.size}`)
if (longBond.size) {
  fail++
  problems.push(`сбой 3D: ${[...longBond].slice(0, 8).join(', ')}`)
}
if (ionBad.size) {
  fail++
  problems.push(`ионы в одной точке: ${[...ionBad].slice(0, 8).join(', ')}`)
}
if (problems.length) console.log(problems.join('\n'))
console.log(fail ? `ОШИБОК: ${fail}` : `OK (предупреждений: ${warn})`)
process.exit(fail ? 1 : 0)
