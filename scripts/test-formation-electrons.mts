/**
 * Электроны «Как образуется» — 200 веществ каталога, шаг 1/30 с по всему показу (без браузера, та же функция положения,
 * что у 3D-вида — story/electrons.ts electronPosAt):
 *  1  ни одна видимая точка (и летящая) не внутри шара: |e − c_k| ≥ r_k(t)·keep + 0,5·eR;
 *  2  центры неподвижных точек ≥ 2,2·eR;
 *  3  перенос e⁻ = Σ зарядов катионов формульной единицы (не кристалл), общих пар = Σ кратностей связей;
 *  4  сцены пути (route): шары без пересечений (d ≥ r_a·sc_a + r_b·sc_b, кроме связанных палочкой), точки вне шаров;
 *  5  облака (cloudLimit / lobeLimit): K₂O, CaO, NaCl, MgO, Al₂O₃ — при касании R_eff ≤ 0,92·(d − r_j).
 * Запуск: npx tsx scripts/test-formation-electrons.mts [id …]  → «ОК: 0 нарушений» или список id / этап / t.
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationEquation } from '../src/chemistry/formationEquation'
import { buildSchoolHeroModel, type V3 } from '../src/components/lab/hero/schoolHeroModel'
import { atomPosAt, atomRadiusAt, buildFormationStory, clamp01, routeKeyAt, stageIndexAt, type FormationStory } from '../src/components/lab/formation/formationStory'
import { cloudLimit, electronPosAt, electronTOut, lobeLimit } from '../src/components/lab/formation/story/electrons'

const only = process.argv.slice(2)
const ids = only.length ? only : [...CATALOG_TOP200_IDS]
const DT = 1 / 30
const problems = new Map<string, string[]>()
const counts: Record<string, number> = {}
const add = (id: string, cat: string, msg: string) => {
  counts[cat] = (counts[cat] ?? 0) + 1
  if (!problems.has(id)) problems.set(id, [])
  const l = problems.get(id)!
  const key = (m: string) => m.replace(/t=[0-9.]+/, '').replace(/\([^)]*\)|[0-9.]+·eR|[0-9]+ %/g, '')
  if (l.length < 6 && !l.some((x) => key(x) === key(`${cat} ${msg}`))) l.push(`${cat} ${msg}`)
}
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const stageAt = (s: FormationStory, t: number) => s.stages[stageIndexAt(s, t)]!.key

let checkedE = 0
for (const id of ids) {
  const c = compoundById[id]
  const plan = formationPlan(id)
  const model = c ? buildSchoolHeroModel(c) : null
  if (!c || !plan || !model) {
    add(id, '0', 'нет модели / плана')
    continue
  }
  const story = buildFormationStory(plan, model, formationEquation(id))
  const n = model.atoms.length
  const eR = story.eR
  const live: V3[] = model.atoms.map(() => [0, 0, 0])
  const R = new Array<number>(n).fill(0)
  const E = story.electrons
  const ep: V3[] = E.map(() => [0, 0, 0])
  const rs = story.routeStage
  const RP = (rs?.atoms ?? []).map(() => [0, 0, 0] as V3)
  const bonded = new Set(model.bonds.map((b) => `${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}`))
  void bonded
  // ── 3: счёт переноса и пар ──
  if (story.scenario !== 'redoxDecomposition') {
    if (plan.mode === 'ionic' && model.kind !== 'crystal') {
      let q = 0
      for (const u of plan.units) {
        const ch = plan.species[u.species]!.charge
        if (ch > 0) q += ch
      }
      if (story.transferred !== q) add(id, '3', `перенос ${story.transferred} e⁻ ≠ Σ зарядов катионов ${q}`)
      const tr = E.filter((e) => e.kind === 'transfer').length
      if (tr !== story.transferred) add(id, '3', `точек переноса ${tr} ≠ transferred ${story.transferred}`)
    }
    if (model.kind !== 'crystal') {
      let p = 0
      for (const b of model.bonds) p += Math.max(1, Math.min(3, Math.round(b.order)))
      if (story.sharedPairs !== p) add(id, '3', `общих пар ${story.sharedPairs} ≠ Σ кратностей ${p}`)
    }
  }
  const tEnd = story.total
  const rsTimes = rs ? [rs.t0, rs.t0 + rs.dur] : null
  for (let t = 0; t <= tEnd; t += DT) {
    const hide = rs ? clamp01((t - rs.t0) / 0.5) * (1 - clamp01((t - (rs.t0 + rs.dur - 0.5)) / 0.5)) : 0
    const keep = 1 - hide
    // ── 1, 2: точки сюжета ──
    let any = false
    for (const e of E) if (t >= e.tIn && t <= electronTOut(story, e) + 0.5) any = true
    if (any) {
      for (let i = 0; i < n; i++) {
        atomPosAt(story, i, t, live[i]!)
        R[i] = atomRadiusAt(story, i, t, model.atoms[i]!.r) * keep
      }
      const still: number[] = []
      for (let k = 0; k < E.length; k++) {
        const st = electronPosAt(story, model, E[k]!, t, live, ep[k]!)
        if (st.sc < 0.05) continue
        checkedE++
        for (let a = 0; a < n; a++) {
          if (R[a]! <= 0) continue
          const d = dist(ep[k]!, live[a]!)
          if (d < R[a]! + 0.5 * eR - 1e-9)
            add(id, '1', `${stageAt(story, t)} t=${t.toFixed(2)}: e${k}(${E[k]!.kind}${st.kind === 2 ? ', летит' : ''}) внутри ${model.atoms[a]!.el}${a} (${((R[a]! + 0.5 * eR - d) / eR).toFixed(2)}·eR)`)
        }
        if (st.kind !== 2 && st.sc >= 0.5) still.push(k)
      }
      for (let x = 0; x < still.length; x++)
        for (let y = x + 1; y < still.length; y++) {
          const d = dist(ep[still[x]!]!, ep[still[y]!]!)
          if (d < 2.2 * eR - 1e-9) add(id, '2', `${stageAt(story, t)} t=${t.toFixed(2)}: e${still[x]}–e${still[y]} ${(d / eR).toFixed(2)}·eR < 2,2·eR`)
        }
    }
    // ── 4: сцена пути ──
    if (rs && rsTimes && story.scenario !== 'redoxDecomposition' && t >= rsTimes[0]! && t <= rsTimes[1]!) {
      const sc = rs.atoms.map((a) => clamp01((t - a.tIn) / 0.5) * (1 - clamp01((t - a.tOut) / 0.4)))
      rs.atoms.forEach((a, i) => routeKeyAt(a.keys, t, RP[i]!))
      const stick = new Set<string>()
      for (const s of rs.sticks) if (t > s.t0 - 0.05 && t < s.tOut + 0.45) stick.add(`${Math.min(s.a, s.b)}:${Math.max(s.a, s.b)}`)
      for (let i = 0; i < RP.length; i++) {
        if (sc[i]! <= 0.2) continue
        for (let j = i + 1; j < RP.length; j++) {
          if (sc[j]! <= 0.2 || stick.has(`${i}:${j}`)) continue
          const need = rs.atoms[i]!.r * sc[i]! + rs.atoms[j]!.r * sc[j]!
          const d = dist(RP[i]!, RP[j]!)
          if (d < need - 1e-9) add(id, '4', `путь t=${(t - rs.t0).toFixed(2)}: ${rs.atoms[i]!.el}#${i}–${rs.atoms[j]!.el}#${j} перекрытие ${(((need - d) / need) * 100).toFixed(0)} %`)
        }
      }
      const reR = 1.15 * eR
      for (let k = 0; k < rs.electrons.length; k++) {
        const e = rs.electrons[k]!
        const s = clamp01((t - e.tIn) / 0.4) * (1 - clamp01((t - e.tOut) / 0.4))
        if (s < 0.05) continue
        const q = routeKeyAt(e.keys, t, [0, 0, 0])
        for (let i = 0; i < RP.length; i++) {
          const r = rs.atoms[i]!.r * sc[i]!
          if (r <= 0) continue
          if (dist(q, RP[i]!) < r + 0.5 * reR - 1e-9) add(id, '4', `путь t=${(t - rs.t0).toFixed(2)}: e${k} внутри ${rs.atoms[i]!.el}#${i}`)
        }
      }
    }
  }
}

// ── 5: облака — предел по соседям (чистые функции, те же, что во FormationClouds) ──
for (const id of ['k2o', 'cao', 'nacl', 'mgo', 'al2o3']) {
  const c = compoundById[id]
  const model = c ? buildSchoolHeroModel(c) : null
  if (!model) {
    console.log(`(облака: нет модели ${id} — пропуск)`)
    continue
  }
  const C = model.atoms.map((a) => a.pos as V3)
  const Rr = model.atoms.map((a) => a.r)
  for (let i = 0; i < C.length; i++) {
    const r = Rr[i]!
    for (const f of [1.15, 1.2, 1.75, 3]) {
      const Re = cloudLimit(i, f * r, C, Rr)
      for (let j = 0; j < C.length; j++) {
        if (j === i) continue
        const d = dist(C[i]!, C[j]!)
        if (Re > 0.92 * (d - Rr[j]!) + 1e-9) add(id, '5', `облако ${model.atoms[i]!.el}${i} R=${f}r заходит в ${model.atoms[j]!.el}${j}`)
      }
    }
    // лепесток по направлению к ближайшему соседу
    let jn = -1
    let dn = Infinity
    for (let j = 0; j < C.length; j++) if (j !== i && dist(C[i]!, C[j]!) < dn) ((dn = dist(C[i]!, C[j]!)), (jn = j))
    if (jn >= 0) {
      const u: V3 = [(C[jn]![0] - C[i]![0]) / dn, (C[jn]![1] - C[i]![1]) / dn, (C[jn]![2] - C[i]![2]) / dn]
      const L = lobeLimit(i, u, 2.5 * r, 0.42 * r, C, Rr)
      if (L > 0.92 * (dn - Rr[jn]!) + 1e-9) add(id, '5', `лепесток ${model.atoms[i]!.el}${i} заходит в ${model.atoms[jn]!.el}${jn}`)
    }
  }
}

let total = 0
for (const [id, list] of problems) {
  total += list.length
  console.log(`${id}: ${list.join('; ')}`)
}
console.log(`Электроны «Как образуется»: веществ ${ids.length}, проверено положений точек ${checkedE}, с нарушениями ${problems.size} ${JSON.stringify(counts)}`)
console.log(problems.size === 0 ? 'ОК: 0 нарушений' : `НАРУШЕНИЙ: ${Object.values(counts).reduce((a, b) => a + b, 0)}`)
process.exitCode = problems.size === 0 ? 0 : 1
