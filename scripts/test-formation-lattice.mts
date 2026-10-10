/**
 * Фрагмент решётки «Как образуется» (story/lattice.ts, view/latticeDraw.ts) — все 200 веществ каталога:
 *  (1) 'generator': якорь каждой частицы модели + latticeSnap = узел решётки (≤ 1 пм); |latticeSnap| ≤ 0,15·d_CA;
 *      доля 'generator' среди ионных веществ со структурным типом (есть ячейка и базис) ≥ 85 % (список ушедших в схему);
 *  (2) 0 пересечений шаров разных частиц (модель ∪ фрагмент ∪ копии) при полном размере: 0,92·d ≥ r_i + r_j − 1e-6
 *      (атомы одной частицы и связанные палочкой не считаются);
 *  (3) оболочки: |центроид S1| ≤ 0,25·R_m, ext_S1 ≤ 2,1·R_m (1 : 1 каменная соль — транс-сосед на 1,5·d: ≈ 1,9–2,05·R_m),
 *      частиц ≤ 60, атомов ≤ 240; кадр: R_m / R_кадра ≥ 0,45; копии молекул — все позади модели (z экрана < 0), 0,72·r;
 *  (4) КЧ по S1: число соседей противоположного знака (≤ 1,08·d) у иона модели = табличному (phase-data, код решётки);
 *      d(катион–анион) фрагмента = модели ±1 %;
 *  (5) время: рост атома фрагмента [t_k; t_k + 0,5] внутри своего этапа; latticeWin[0] ≥ t0(«Решётка») + 0,3 (ионные),
 *      ≥ fin.t0 + 0,2 (копии); ОВР-разложение — внутри «Готово»;
 *  (6) непрерывность: шаг 1/120 с по всему показу (как test-formation-motion) — |Δ| положения атома модели
 *      (phaseAtomPos, с усадкой в узлы) ≤ 0,08·R_m.
 * Запуск: npx tsx scripts/test-formation-lattice.mts  (npm run test:formation-lattice)
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationScript } from '../src/chemistry/formationScripts'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { formationStoryFor, screenToModel, modelToScreen } from '../src/components/lab/formation/formationStory'
import { latticeDataExists, latticeFor, latticeGenKey, CONTACT_TOL, COPY_R, type LatticeAtom } from '../src/components/lab/formation/story/lattice'
import { phaseRow, type LatticeCode } from '../src/components/lab/formation/story/phase-data'
import { phaseAtomPos } from '../src/components/lab/formation/FormationPhaseScene'
import { frameRadius } from '../src/components/lab/formation/view/latticeDraw'

type V3 = [number, number, number]
const PM = 0.00285
const CN: Partial<Record<LatticeCode, [number, number]>> = {
  RS: [6, 6], CsCl: [8, 8], ZB: [4, 4], WZ: [4, 4], AF: [4, 8], CUP: [2, 4], COR: [6, 4], CdI2: [6, 3], L3: [6, 2], RUT: [6, 3], NiAs: [6, 6],
}
const sub = (a: readonly number[], b: readonly number[]): V3 => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
const len = (a: readonly number[]) => Math.hypot(a[0]!, a[1]!, a[2]!)

const bad: string[] = []
const info: string[] = []
const ext19: string[] = []
const flag = (id: string, m: string) => bad.push(`${id}: ${m}`)
let nGenKey = 0
let nGen = 0
const fallback: string[] = []
let checks = 0
const t0 = performance.now()

for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  const plan = formationPlan(id)
  const model = c ? buildSchoolHeroModel(c) : null
  const story = formationStoryFor(id)
  if (!c || !plan || !model || !story) {
    flag(id, 'нет модели / сценария')
    continue
  }
  const script = formationScript(id)
  const lat = latticeFor(script, plan, model, (s) => screenToModel(model, s))
  const Rm = model.radius
  const redox = story.scenario === 'redoxDecomposition'
  const ionicFrag = lat.kind === 'ionic' && model.kind !== 'crystal' && plan.mode === 'ionic'
  const gk = ionicFrag ? latticeGenKey(script, plan) : null
  if (gk && !latticeDataExists(gk, id)) info.push(`${id}: генератор «${gk}» без базиса — схема`)
  if (gk && latticeDataExists(gk, id)) {
    nGenKey++
    if (lat.src === 'generator') nGen++
    else fallback.push(`${id}(${lat.gen})`)
  }
  if (story.latticeAtoms.length !== lat.atoms.length) flag(id, 'story.latticeAtoms ≠ latticeFor')
  const snap = story.latticeSnap
  // положения модели в конце показа (с усадкой)
  const PF: V3[] = model.atoms.map((a, i) => (snap ? [a.pos[0] + snap[i]![0], a.pos[1] + snap[i]![1], a.pos[2] + snap[i]![2]] : [...a.pos]) as V3)
  const unitOf = new Map<number, number>()
  plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const bonded = new Set(model.bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`))

  // ── (1) узлы ──
  let dCA = Infinity
  if (lat.src === 'generator' || lat.nodes?.length) {
    const nodes = lat.nodes ?? []
    const cats = nodes.filter((n) => n.ion > 0)
    const ans = nodes.filter((n) => n.ion < 0)
    for (const x of cats) for (const y of ans) dCA = Math.min(dCA, len(sub(x.node, y.node)))
    for (const n of nodes) {
      const heavy = n.atoms.filter((a) => model.atoms[a]!.el !== 'H')
      const use = heavy.length ? heavy : n.atoms
      const anc: V3 = [0, 0, 0]
      for (const a of use) for (let q = 0; q < 3; q++) anc[q] += PF[a]![q]! / use.length
      checks++
      if (len(sub(anc, n.node)) > PM) flag(id, `якорь частицы (${n.atoms.map((a) => model.atoms[a]!.el).join('')}) не в узле: ${(len(sub(anc, n.node)) / PM).toFixed(2)} пм`)
    }
    if (snap) {
      const m = snap.reduce((q, v) => Math.max(q, len(v)), 0)
      checks++
      if (m > 0.15 * dCA + 1e-9) flag(id, `|latticeSnap| ${(m / dCA).toFixed(3)}·d_CA > 0,15`)
    }
  }

  // ── (2) пересечения ──
  // ион — одноатомная заряженная частица (Na⁺, O²⁻): для пары ионов норма 0,92·d ≥ Σr, иначе d ≥ Σr (общие нормы)
  type Ball = { el: string; pos: V3; r: number; part: string; model: boolean; ai?: number; ion: boolean }
  const balls: Ball[] = []
  const modelOne = plan.mode !== 'ionic' // молекула — одна частица
  const ionAtom = (i: number) => {
    const u = plan.units[unitOf.get(i) ?? -1]
    return !!u && u.atoms.length === 1 && plan.species[u.species]!.charge !== 0
  }
  model.atoms.forEach((a, i) => balls.push({ el: a.el, pos: PF[i]!, r: a.r, part: modelOne ? 'm' : `m${unitOf.get(i) ?? i}`, model: true, ai: i, ion: ionAtom(i) }))
  for (const a of story.latticeAtoms) balls.push({ el: a.el, pos: a.pos as V3, r: a.r, part: `f${a.u ?? -1}`, model: false, ion: a.charge !== 0 })
  let worst = Infinity
  let wAt = ''
  for (let i = 0; i < balls.length; i++)
    for (let j = i + 1; j < balls.length; j++) {
      const x = balls[i]!
      const y = balls[j]!
      if (x.part === y.part) continue
      if (x.model && y.model && bonded.has(`${Math.min(x.ai!, y.ai!)}-${Math.max(x.ai!, y.ai!)}`)) continue
      const d = len(sub(x.pos, y.pos))
      checks++
      const k = ((x.ion && y.ion ? 0.92 : 1) * d) / (x.r + y.r)
      if (k < worst) ((worst = k), (wAt = `${x.el}${x.model ? '(м)' : ''}–${y.el}${y.model ? '(м)' : ''}${x.ion && y.ion ? ' (ионы, 0,92·d)' : ''}`))
    }
  if (worst < 1 - 1e-6) flag(id, `пересечение ${wAt}: d·норма = ${worst.toFixed(3)}·(r₁ + r₂)`)

  // ── (3) оболочки, кадр, копии ──
  const s1 = story.latticeAtoms.filter((a) => a.shell === 1)
  if (s1.length) {
    const byU = new Map<number, LatticeAtom[]>()
    for (const a of story.latticeAtoms) byU.set(a.u ?? -1, [...(byU.get(a.u ?? -1) ?? []), a])
    // центроид S1 по частицам (узлам) относительно центроида узлов частиц модели: оболочка — вокруг ионов модели
    // (у 1 : 1 с крупным анионом — SO₄²⁻, NO₃⁻ — центр описанной сферы модели смещён к аниону, а S1 симметрична
    // относительно середины катион–анион; сравниваем частицы с частицами)
    const s1u = [...byU.values()].filter((l) => l[0]!.shell === 1)
    const anc = (l: { el: string; pos: readonly number[] }[]): V3 => {
      const h = l.filter((a) => a.el !== 'H')
      const use = h.length ? h : l
      const c3: V3 = [0, 0, 0]
      for (const a of use) for (let q = 0; q < 3; q++) c3[q] += a.pos[q]! / use.length
      return c3
    }
    const cen: V3 = [0, 0, 0]
    for (const l of s1u) {
      const c3 = anc(l)
      for (let q = 0; q < 3; q++) cen[q] += c3[q]! / s1u.length
    }
    const mNodes = lat.nodes ?? []
    if (mNodes.length) {
      const mc: V3 = [0, 0, 0]
      for (const n of mNodes) for (let q = 0; q < 3; q++) mc[q] += n.node[q]! / mNodes.length
      for (let q = 0; q < 3; q++) cen[q] -= mc[q]!
    }
    const ext1 = s1.reduce((m, a) => Math.max(m, len(a.pos) + a.r), 0)
    checks += 4
    if (len(cen) > 0.25 * Rm) flag(id, `|центроид S1| ${(len(cen) / Rm).toFixed(2)}·R_m > 0,25`)
    if (ext1 > 2.1 * Rm) flag(id, `ext_S1 ${(ext1 / Rm).toFixed(2)}·R_m > 2,1`)
    if (ext1 > 1.9 * Rm) ext19.push(`${id} ${(ext1 / Rm).toFixed(2)}R`)
    if (byU.size > 60) flag(id, `частиц фрагмента ${byU.size} > 60`)
    if (story.latticeAtoms.length > 240) flag(id, `атомов фрагмента ${story.latticeAtoms.length} > 240`)
  }
  if (story.latticeAtoms.length) {
    const tEnd = story.total
    const R = frameRadius(story, model, Rm, 1)
    checks++
    if (Rm / R < 0.45 - 1e-9) flag(id, `модель ${((100 * Rm) / R).toFixed(0)} % кадра < 45 %`)
    void tEnd
  }
  if (lat.kind === 'molecular' || (lat.kind === 'ionic' && lat.src === 'schema' && !s1.length)) {
    const byU = new Map<number, LatticeAtom[]>()
    for (const a of story.latticeAtoms) byU.set(a.u ?? -1, [...(byU.get(a.u ?? -1) ?? []), a])
    const o: V3 = [0, 0, 0]
    for (const a of model.atoms) for (let q = 0; q < 3; q++) o[q] += a.pos[q]! / model.atoms.length
    for (const [, l] of byU) {
      const c3: V3 = [0, 0, 0]
      for (const a of l) for (let q = 0; q < 3; q++) c3[q] += a.pos[q]! / l.length
      const z = modelToScreen(model, sub(c3, o))[2]
      checks++
      if (!(z < 0)) flag(id, `копия не позади модели: z экрана ${z.toFixed(3)}`)
    }
    const ratio = story.latticeAtoms[0] ? story.latticeAtoms[0].r / model.atoms[0]!.r : COPY_R.molecular
    checks++
    if (Math.abs(ratio - COPY_R.molecular) > 1e-6) flag(id, `радиус копии ${ratio.toFixed(2)}·r ≠ 0,72`)
  }

  // ── (4) КЧ по S1 ──
  const code = phaseRow(id)?.code
  const want = code ? CN[code] : undefined
  if (want && lat.src === 'generator' && lat.nodes) {
    const all = [...lat.nodes.map((n) => ({ ion: n.ion, c: n.node, model: true }))]
    const byU = new Map<number, LatticeAtom[]>()
    for (const a of lat.atoms) byU.set(a.u ?? -1, [...(byU.get(a.u ?? -1) ?? []), a])
    for (const [, l] of byU) {
      const heavy = l.filter((a) => a.el !== 'H')
      const use = heavy.length ? heavy : l
      const c3: V3 = [0, 0, 0]
      for (const a of use) for (let q = 0; q < 3; q++) c3[q] += a.pos[q]! / use.length
      all.push({ ion: l[0]!.ion ?? 1, c: c3, model: false })
    }
    let dFrag = Infinity
    for (const x of all) for (const y of all) if (!x.model && !y.model && x.ion > 0 && y.ion < 0) dFrag = Math.min(dFrag, len(sub(x.c, y.c)))
    checks++
    if (Math.abs(dFrag - dCA) > 0.01 * dCA) flag(id, `d(кат–ан) фрагмента ${(dFrag / dCA).toFixed(3)}·d модели (±1 %)`)
    const cnOf = (n: (typeof all)[number]) => all.filter((o) => o.ion === -n.ion && len(sub(o.c, n.c)) <= CONTACT_TOL * dCA).length
    const mc = lat.nodes.filter((n) => n.ion > 0).map((n) => cnOf({ ion: n.ion, c: n.node, model: true }))
    const ma = lat.nodes.filter((n) => n.ion < 0).map((n) => cnOf({ ion: n.ion, c: n.node, model: true }))
    checks += 2
    if (!mc.every((x) => x === want[0])) flag(id, `${code}: КЧ катионов модели ${mc.join('/')} ≠ ${want[0]}`)
    if (!ma.every((x) => x === want[1])) flag(id, `${code}: КЧ анионов модели ${ma.join('/')} ≠ ${want[1]}`)
  }

  // ── (5) время ──
  if (story.latticeAtoms.length) {
    const [w0, w1] = story.latticeWin
    const fin = story.stages[story.stages.length - 1]!
    const latS = story.stages.find((s) => s.key === 'lattice')
    const stage = lat.kind === 'ionic' && latS && !redox ? latS : fin
    const minW0 = lat.kind === 'ionic' ? stage.t0 + 0.3 - 1e-9 : fin.t0 + 0.2 - 1e-9
    checks++
    if (w0 < minW0) flag(id, `latticeWin[0] ${w0.toFixed(2)} < ${minW0.toFixed(2)}`)
    for (const a of story.latticeAtoms) {
      const ta = w0 + a.k * (w1 - w0)
      checks++
      if (ta < stage.t0 - 1e-9 || ta + 0.5 > stage.t0 + stage.dur + 1e-9) {
        flag(id, `атом фрагмента растёт вне этапа ${stage.key}: [${ta.toFixed(2)}; ${(ta + 0.5).toFixed(2)}] ⊄ [${stage.t0.toFixed(2)}; ${(stage.t0 + stage.dur).toFixed(2)}]`)
        break
      }
    }
  }

  // ── (6) непрерывность ──
  {
    const n = model.atoms.length
    const prev: V3[] = model.atoms.map(() => [0, 0, 0])
    const cur: V3 = [0, 0, 0]
    let maxJ = 0
    let at = ''
    for (let i = 0; i < n; i++) phaseAtomPos(story, model, i, 0, prev[i]!)
    for (let f = 1; f <= Math.ceil(story.total * 120); f++) {
      const t = f / 120
      for (let i = 0; i < n; i++) {
        phaseAtomPos(story, model, i, t, cur)
        const d = len(sub(cur, prev[i]!))
        if (d > maxJ) ((maxJ = d), (at = `${model.atoms[i]!.el}${i} t=${t.toFixed(2)}`))
        prev[i]![0] = cur[0]
        prev[i]![1] = cur[1]
        prev[i]![2] = cur[2]
      }
    }
    checks++
    if (maxJ > 0.08 * Rm) flag(id, `скачок ${(maxJ / Rm).toFixed(3)}·R_m (${at})`)
  }
}

const share = nGenKey ? nGen / nGenKey : 1
console.log(`test-formation-lattice: веществ ${CATALOG_TOP200_IDS.length}, проверок ${checks}, ${((performance.now() - t0) / 1000).toFixed(1)} с`)
console.log(`  'generator': ${nGen}/${nGenKey} ионных со структурным типом (${(share * 100).toFixed(1)} %), схема: ${fallback.join(' ') || '—'}`)
if (ext19.length) console.log(`  ext_S1 > 1,9·R_m (≤ 2,1): ${ext19.length} — ${ext19.slice(0, 8).join(', ')}${ext19.length > 8 ? ' …' : ''}`)
for (const x of info) console.log('  ' + x)
if (share < 0.85) bad.push(`доля 'generator' ${(share * 100).toFixed(1)} % < 85 %`)
if (bad.length) {
  console.log(`НАРУШЕНИЙ: ${bad.length}`)
  for (const b of bad.slice(0, 80)) console.log('  ' + b)
  process.exit(1)
}
console.log('ОК: 0 нарушений')
