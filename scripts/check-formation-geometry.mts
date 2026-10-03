/**
 * Геометрическая проверка «Как образуется» для 200 веществ каталога — без браузера, по сюжету (formationStory):
 *  P  перекрытие шаров РАЗНЫХ частиц сильнее 25 % суммы радиусов (кроме связанных палочкой, момента слияния
 *     ±1 с вокруг появления / исчезновения палочки и подмены атома «копией»);
 *  R  то же внутри сцены пути (этап 'route', только полностью видимые атомы);
 *  T  фрагмент решётки накрывает модель: атом решётки ближе 0,45·d(катион–анион) к атому модели (ионные),
 *     у молекулярной укладки / цепи — перекрытие шаров с моделью сильнее 25 %;
 *  F  не в кадре: видимый атом сцены пути / решётки / электрон вне описанной сферы, по которой камера подгоняет кадр
 *     (та же формула, что во FormationMoleculeView);
 *  S  пустая подпись этапа (заголовок / главная строка / пояснение, RU / EN / UZ).
 * Запуск: npx tsx scripts/check-formation-geometry.mts [id …]  — итог «0 проблем» или список по веществам.
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationEquation } from '../src/chemistry/formationEquation'
import { buildSchoolHeroModel, type V3 } from '../src/components/lab/hero/schoolHeroModel'
import { atomPosAt, atomRadiusAt, buildFormationStory, clamp01, easeInOut, routeKeyAt, type FormationStory } from '../src/components/lab/formation/formationStory'
import { formationStageTexts } from '../src/components/lab/formation/formationStageText'

const only = process.argv.slice(2)
const ids = only.length ? only : [...CATALOG_TOP200_IDS]
const problems = new Map<string, string[]>()
const add = (id: string, msg: string) => {
  if (!problems.has(id)) problems.set(id, [])
  const l = problems.get(id)!
  if (l.length < 8 && !l.includes(msg)) l.push(msg)
}
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const OVER = 0.25

function routeSticksAt(story: FormationStory, t: number, slack: number): Set<string> {
  const s = new Set<string>()
  for (const x of story.routeStage?.sticks ?? []) if (t > x.t0 - slack && t < x.tOut + 0.4 + slack) s.add(`${Math.min(x.a, x.b)}:${Math.max(x.a, x.b)}`)
  return s
}

for (const id of ids) {
  const c = compoundById[id]
  const plan = formationPlan(id)
  const model = c ? buildSchoolHeroModel(c) : null
  if (!c || !plan || !model) {
    add(id, 'нет модели / плана')
    continue
  }
  const story = buildFormationStory(plan, model, formationEquation(id))
  const n = model.atoms.length
  const unitOf = new Map<number, number>()
  plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const bonded = new Set(model.bonds.map((b) => `${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}`))
  const live: V3[] = model.atoms.map(() => [0, 0, 0])
  const finalT0 = story.stages[story.stages.length - 1]!.t0
  const rs = story.routeStage
  // ── P: модель в конце каждого этапа (состояние покоя), кроме сцены пути (модель спрятана) ──
  if (model.kind !== 'crystal')
    for (const st of story.stages) {
      if (st.key === 'route') continue
      const t = st.t0 + 0.97 * st.dur
      for (let i = 0; i < n; i++) atomPosAt(story, i, t, live[i]!)
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          if (bonded.has(`${i}:${j}`)) continue
          // одна частица (ион / молекула) — её форма задана моделью карточки
          if (unitOf.get(i) != null && unitOf.get(i) === unitOf.get(j)) continue
          const ri = atomRadiusAt(story, i, t, model.atoms[i]!.r)
          const rj = atomRadiusAt(story, j, t, model.atoms[j]!.r)
          const ov = (ri + rj - dist(live[i]!, live[j]!)) / (ri + rj)
          if (ov > OVER) add(id, `P ${st.key}: ${model.atoms[i]!.el}${i}–${model.atoms[j]!.el}${j} перекрытие ${(ov * 100).toFixed(0)} %`)
        }
    }
  // ── R / F: сцена пути ──
  if (rs) {
    const P = rs.atoms.map(() => [0, 0, 0] as V3)
    for (let t = rs.t0 + 0.3; t < rs.t0 + rs.dur - 0.05; t += 0.1) {
      const vis = rs.atoms.map((a) => clamp01((t - a.tIn) / 0.5) * (1 - clamp01((t - a.tOut) / 0.4)))
      rs.atoms.forEach((a, i) => routeKeyAt(a.keys, t, P[i]!))
      const near = routeSticksAt(story, t, 1.0)
      for (let i = 0; i < P.length; i++) {
        if (vis[i]! < 0.999) continue
        for (let j = i + 1; j < P.length; j++) {
          if (vis[j]! < 0.999 || near.has(`${i}:${j}`)) continue
          const ri = rs.atoms[i]!.r
          const rj = rs.atoms[j]!.r
          const ov = (ri + rj - dist(P[i]!, P[j]!)) / (ri + rj)
          if (ov > OVER) add(id, `R t=${(t - rs.t0).toFixed(1)}: ${rs.atoms[i]!.el}#${i}–${rs.atoms[j]!.el}#${j} перекрытие ${(ov * 100).toFixed(0)} %`)
        }
      }
      // кадр — как во FormationMoleculeView, когда исходные вещества спрятаны (hide > 0,5)
      const hide = clamp01((t - rs.t0) / 0.5) * (1 - clamp01((t - (rs.t0 + rs.dur - 0.5)) / 0.5))
      if (hide > 0.5) {
        let R = 0
        for (let i = 0; i < P.length; i++) R = Math.max(R, Math.hypot(...P[i]!) + rs.atoms[i]!.r)
        R = Math.max(R * 1.08, 0.35 * model.radius)
        for (const e of rs.electrons) {
          if (t < e.tIn + 0.4 || t > e.tOut) continue
          const q = routeKeyAt(e.keys, t, [0, 0, 0])
          if (Math.hypot(...q) > R + 1e-6) add(id, `F сцена пути: электрон вне кадра (t=${(t - rs.t0).toFixed(1)})`)
        }
        if (R > 40 * Math.max(...rs.atoms.map((a) => a.r))) add(id, 'F сцена пути: кадр слишком крупный — частицы мелкие')
      }
    }
  }
  // ── T / F: решётка ──
  if (story.latticeAtoms.length) {
    const ionic = story.latticeKind === 'ionic'
    let dCA = Infinity
    if (ionic) {
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const ui = unitOf.get(i)
          const uj = unitOf.get(j)
          if (ui == null || uj == null || ui === uj) continue
          const qi = plan.species[plan.units[ui]!.species]!.charge
          const qj = plan.species[plan.units[uj]!.species]!.charge
          if (qi > 0 && qj < 0) dCA = Math.min(dCA, dist(model.atoms[i]!.pos as V3, model.atoms[j]!.pos as V3))
        }
    }
    for (const L of story.latticeAtoms)
      for (let i = 0; i < n; i++) {
        const d = dist(L.pos, model.atoms[i]!.pos as V3)
        // 0,45·d(кат–ан) — для «тяжёлых» атомов; H (OH⁻, NH₄⁺, H₂O) соседних частиц законно ближе — для них правило 25 %
        if (ionic && Number.isFinite(dCA) && L.el !== 'H' && model.atoms[i]!.el !== 'H') {
          if (d < 0.45 * dCA) add(id, `T решётка: ${L.el} ближе ${(d / dCA).toFixed(2)}·d(кат–ан) к ${model.atoms[i]!.el}${i}`)
        } else {
          const rL = L.r
          const ov = (rL + model.atoms[i]!.r - d) / (rL + model.atoms[i]!.r)
          if (ov > OVER) add(id, `T решётка (${story.latticeKind}): ${L.el} накрывает ${model.atoms[i]!.el}${i} (${(ov * 100).toFixed(0)} %)`)
        }
      }
    // кадр решётки: при latO = 1 описанная сфера включает все атомы фрагмента — проверяем формулу на полной видимости
    const [w0] = story.latticeWin
    const fin = story.stages[story.stages.length - 1]!
    const fadeAt = ionic ? finalT0 + 2.6 : fin.t0 + fin.dur - 1.6
    const tFull = Math.min(fadeAt - 0.01, w0 + 1.2)
    const latO = clamp01((tFull - w0 + 0.2) / 0.8) * (1 - clamp01((tFull - fadeAt) / 1.4))
    if (latO > 0.99) {
      let R = model.radius
      for (const a of story.latticeAtoms) R = Math.max(R, model.radius + (Math.hypot(...a.pos) + a.r - model.radius) * latO)
      const out = story.latticeAtoms.find((a) => Math.hypot(...a.pos) + 0.8 * a.r > R + 1e-6)
      if (out) add(id, 'F решётка вне кадра')
    }
    void easeInOut
  }
  // ── S: подписи этапов ──
  for (const loc of ['ru', 'en', 'uz'] as const) {
    let tx
    try {
      tx = formationStageTexts(plan, story, formationEquation(id), loc, '')
    } catch (e) {
      add(id, `S подписи (${loc}): ошибка ${(e as Error).message}`)
      continue
    }
    for (const s of tx.stages) if (!s.title?.trim() || !s.main?.trim() || !s.sub?.trim()) add(id, `S пустая подпись этапа ${s.key} (${loc})`)
    if (tx.stages.length !== story.stages.length) add(id, `S подписей ${tx.stages.length} ≠ этапов ${story.stages.length}`)
  }
}

let total = 0
for (const [id, list] of problems) {
  total += list.length
  console.log(`${id}: ${list.join('; ')}`)
}
const byCat: Record<string, number> = {}
for (const list of problems.values()) for (const m of list) byCat[m[0]!] = (byCat[m[0]!] ?? 0) + 1
console.log(`Геометрия «Как образуется»: веществ ${ids.length}, с проблемами ${problems.size}, проблем ${total} ${JSON.stringify(byCat)}`)
console.log(total === 0 ? 'ОК: 0 проблем' : `ПРОБЛЕМ: ${total}`)
process.exitCode = total === 0 ? 0 : 1
