/**
 * Проверка «Как образуется» в реакторе (пути получения CO₂): модели сцен — чистые функции времени.
 *  • длительность показа 25–45 с, этапы по порядку;
 *  • ни одной NaN-координаты (шаг 0,05 с), все частицы реакции видны с начала;
 *  • электронейтральность: сумма зарядов частиц реакции = 0 в любой момент;
 *  • геометрия по справочнику: исходные (O=O 121, C–O в CO₃²⁻ 129, 120°, HCl 127, графит 142 пм),
 *    промежуточные (H₂CO₃: C=O 121, C–OH 134 пм), продукты (CO₂ 116 пм, 180°; H₂O 96 пм, 104,5°; CaO 240 пм);
 *  • шары не налезают друг на друга (кроме связанных палочкой): расстояние ≥ 0,8 суммы радиусов.
 * Запуск: npx tsx scripts/test-formation-routes.mts
 */
import { angleDeg, dist3, labelAt, type RouteModel, type V3 } from '../src/components/lab/formation/routes/geom'
import { co2CombustionModel, graphiteSheet } from '../src/components/lab/formation/routes/models/co2Combustion'
import { co2AcidModel } from '../src/components/lab/formation/routes/models/co2Acid'
import { co2CalcinationModel, UNITS } from '../src/components/lab/formation/routes/models/co2Calcination'
import { ROUTE_TEXTS } from '../src/components/lab/formation/routes/texts/co2Routes'

let fails = 0
let checks = 0
const ok = (cond: boolean, msg: string) => {
  checks++
  if (!cond) {
    fails++
    console.log('  ✗', msg)
  }
}
const K = 0.00285
const pmOf = (d: number) => d / K
const P = (m: RouteModel, id: string, t: number): V3 => {
  const p = m.particles.find((x) => x.id === id)
  if (!p) throw new Error(id)
  return p.pos(t)
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

function common(name: string, m: RouteModel, tIn: number) {
  console.log(`— ${name}: ${m.stages.list.length} этапов, ${m.stages.total.toFixed(1)} с, частиц ${m.particles.length}, электронов ${m.electrons.length}`)
  ok(m.stages.total >= 25 && m.stages.total <= 45, `${name}: длительность ${m.stages.total}`)
  const real = m.particles.filter((p) => !p.decor)
  for (const p of real) ok(p.k(tIn) > 0.5, `${name}: ${p.id} не виден в начале`)
  let worst = { r: 9, a: '', b: '', t: 0 }
  for (let t = 0; t <= m.stages.total + 1e-9; t += 0.05) {
    // NaN
    for (const p of m.particles) {
      const v = p.pos(t)
      if (!v.every(Number.isFinite) || !Number.isFinite(p.r(t)) || !Number.isFinite(p.k(t))) {
        ok(false, `${name}: NaN у ${p.id} при t=${t.toFixed(2)}`)
        return
      }
      labelAt(p, t)
    }
    for (const e of m.electrons) if (!e.pos(t).every(Number.isFinite)) ok(false, `${name}: NaN у электрона ${e.id} t=${t.toFixed(2)}`)
    // заряд
    const q = real.reduce((s, p) => s + (p.q ? p.q(t) : 0), 0)
    if (q !== 0) ok(false, `${name}: заряд ${q} при t=${t.toFixed(2)}`)
    // наложения шаров (без связанных)
    const vis = m.particles.filter((p) => p.k(t) > 0.5)
    const bonded = new Set(m.bonds.filter((b) => b.k(t) > 0.05).map((b) => [b.a, b.b].sort().join('|')))
    for (let i = 0; i < vis.length; i++)
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i]!
        const b = vis[j]!
        if (bonded.has([a.id, b.id].sort().join('|'))) continue
        const r = dist3(a.pos(t), b.pos(t)) / (a.r(t) + b.r(t))
        if (r < worst.r) worst = { r, a: a.id, b: b.id, t }
      }
  }
  console.log(`  ближе всего (без связи): ${worst.a}…${worst.b} = ${worst.r.toFixed(2)} суммы радиусов при t=${worst.t.toFixed(2)}`)
  ok(worst.r >= 0.8, `${name}: шары ${worst.a} и ${worst.b} налезают (${worst.r.toFixed(2)}) t=${worst.t.toFixed(2)}`)
  // тексты: этапы есть на трёх языках
  const tx = ROUTE_TEXTS[name as keyof typeof ROUTE_TEXTS]
  ok(!!tx, `${name}: нет текстов`)
  if (tx) {
    for (const s of m.stages.list) {
      const st = tx.stages[s.key]
      ok(!!st && st.title.every((x) => x.length > 0) && st.main.every((x) => x.length > 0), `${name}: текст этапа ${s.key}`)
    }
    for (const h of tx.hud) ok(m.stages.list.some((s) => s.key === h.stage), `${name}: HUD на неизвестный этап ${h.stage}`)
  }
}

// ── 1. C + O₂ → CO₂ ──
{
  const m = co2CombustionModel()
  common('co2-combustion', m, 0.8)
  const T = m.stages.total
  ok(near(pmOf(dist3(P(m, 'Oa', 0.5), P(m, 'Ob', 0.5))), 121, 1), 'O=O 121 пм в начале')
  const sh = graphiteSheet()
  const d = sh.bonds.map(([a, b]) => pmOf(dist3(sh.atoms[a]!, sh.atoms[b]!)))
  ok(d.every((x) => near(x, 142, 0.5)), 'графит: C–C 142 пм')
  ok(sh.bonds.filter(([a, b]) => a === sh.active || b === sh.active).length === 2, 'активный атом края — 2 соседа (зигзаг)')
  const c = P(m, 'C', T)
  ok(near(pmOf(dist3(c, P(m, 'Oa', T))), 116, 1) && near(pmOf(dist3(c, P(m, 'Ob', T))), 116, 1), 'CO₂: C=O 116 пм')
  ok(near(angleDeg(c, P(m, 'Oa', T), P(m, 'Ob', T)), 180, 0.5), 'CO₂: 180°')
  ok(m.electrons.length === 8, 'электронов 8 (4 у C + 2×2 у O)')
}

// ── 2. CaCO₃ + 2HCl → CaCl₂ + CO₂ + H₂O ──
{
  const m = co2AcidModel()
  common('co2-acid', m, 1.2)
  const W = m.stages.W
  const t0 = 1.2
  const c0 = P(m, 'C', t0)
  for (const o of ['O1', 'O2', 'O3']) ok(near(pmOf(dist3(c0, P(m, o, t0))), 129, 1), `CO₃²⁻: C–${o} 129 пм`)
  ok(near(angleDeg(c0, P(m, 'O1', t0), P(m, 'O2', t0)), 120, 0.5) && near(angleDeg(c0, P(m, 'O2', t0), P(m, 'O3', t0)), 120, 0.5), 'CO₃²⁻: 120°')
  ok(near(pmOf(dist3(P(m, 'H1', t0), P(m, 'Cl1', t0))), 127, 1) && near(pmOf(dist3(P(m, 'H2', t0), P(m, 'Cl2', t0))), 127, 1), 'HCl 127 пм')
  const th = W('decompose').t0
  const ch = P(m, 'C', th)
  ok(near(pmOf(dist3(ch, P(m, 'O1', th))), 121, 1), 'H₂CO₃: C=O 121 пм')
  ok(near(pmOf(dist3(ch, P(m, 'O2', th))), 134, 1) && near(pmOf(dist3(ch, P(m, 'O3', th))), 134, 1), 'H₂CO₃: C–OH 134 пм')
  ok(near(pmOf(dist3(P(m, 'O3', th), P(m, 'H1', th))), 96, 2) && near(pmOf(dist3(P(m, 'O2', th), P(m, 'H2', th))), 96, 2), 'H₂CO₃: O–H ≈ 96 пм')
  const T = m.stages.total
  const c = P(m, 'C', T)
  ok(near(pmOf(dist3(c, P(m, 'O1', T))), 116, 1) && near(pmOf(dist3(c, P(m, 'O2', T))), 116, 1), 'CO₂: 116 пм')
  ok(near(angleDeg(c, P(m, 'O1', T), P(m, 'O2', T)), 180, 0.5), 'CO₂: 180°')
  const o = P(m, 'O3', T)
  ok(near(pmOf(dist3(o, P(m, 'H1', T))), 96, 1) && near(pmOf(dist3(o, P(m, 'H2', T))), 96, 1), 'H₂O: 96 пм')
  ok(near(angleDeg(o, P(m, 'H1', T), P(m, 'H2', T)), 104.5, 0.5), 'H₂O: 104,5°')
  const lab = (id: string, t: number) => labelAt(m.particles.find((p) => p.id === id)!, t)
  ok(lab('Cl1', T) === 'Cl⁻' && lab('Cl2', T) === 'Cl⁻' && lab('H1', T) === 'H' && lab('H1', W('protonate1').t0) === 'H⁺', 'подписи Cl⁻, H⁺ → H')
}

// ── 3. CaCO₃ → CaO + CO₂ ──
{
  const m = co2CalcinationModel()
  common('co2-calcination', m, 0.9)
  const t0 = 0.9
  for (let k = 0; k < UNITS.length; k++) {
    const c = P(m, `C${k}`, t0)
    for (const o of ['Oa', 'Ob', 'Of']) ok(near(pmOf(dist3(c, P(m, `${o}${k}`, t0))), 129, 12), `CO₃²⁻ #${k}: C–${o} ≈ 129 пм (с колебаниями)`)
    ok(near(angleDeg(c, P(m, `Oa${k}`, t0), P(m, `Ob${k}`, t0)), 120, 4), `CO₃²⁻ #${k}: ≈ 120°`)
  }
  const T = m.stages.total
  const c = P(m, 'C0', T)
  ok(near(pmOf(dist3(c, P(m, 'Oa0', T))), 116, 1) && near(pmOf(dist3(c, P(m, 'Ob0', T))), 116, 1), 'CO₂: 116 пм')
  ok(near(angleDeg(c, P(m, 'Oa0', T), P(m, 'Ob0', T)), 180, 0.5), 'CO₂: 180°')
  // CaO: у каждого Ca²⁺ ближайшие O²⁻ на 240 пм (с колебаниями ±10)
  for (let k = 0; k < UNITS.length; k++) {
    const ca = P(m, `Ca${k}`, T)
    const ds = UNITS.map((_, j) => pmOf(dist3(ca, P(m, `Of${j}`, T)))).sort((a, b) => a - b)
    ok(near(ds[0]!, 240, 10) && near(ds[2]!, 240, 10), `CaO: Ca²⁺ #${k} — три O²⁻ на 240 пм (${ds.slice(0, 3).map((x) => x.toFixed(0)).join(', ')})`)
  }
  ok(labelAt(m.particles.find((p) => p.id === 'Of0')!, T) === 'O²⁻', 'подпись O²⁻')
}

console.log(fails ? `ОШИБОК: ${fails} из ${checks}` : `OK: ${checks} проверок`)
process.exit(fails ? 1 : 0)
