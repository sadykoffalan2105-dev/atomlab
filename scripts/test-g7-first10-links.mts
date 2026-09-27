#!/usr/bin/env node
/**
 * Карточка вещества → лаборатория со школьной сценой (первые 10 веществ каталога 7 класса).
 *
 * Для каждого вещества:
 *   1. реакция карточки (G7_FIRST10_SCENE_REACTIONS) = реакции его научной спецификации
 *      (school/specs/<id>.ts: bankId, уравнение; у реакции банка — та же запись);
 *   2. ссылка карточки открывается в реакторе, синтез запускается (не «только шарами»);
 *   3. для реакции ссылки scientificSceneFor даёт сцену — в лаборатории играет школьная сцена этого
 *      вещества, и кнопка карточки зовёт «▶ Смотреть, как образуется».
 *   4. 3D-модель карточки каталога CO, NO, NO₂, SO₂, N₂O, N₂O₅ = ядру (длины и углы bondData).
 *
 * Запуск: npx tsx scripts/test-g7-first10-links.mts
 */
import assert from 'node:assert/strict'
import { getSchoolReaction, primaryReactionForCompound } from '../src/chemistry/schoolReactionBank.ts'
import { resolveReactorEquation } from '../src/lab/reactorDeepLink.ts'
import { G7_FIRST10_SCENE_REACTIONS, schoolSceneLinkForCompound } from '../src/lab/schoolSceneLinks.ts'
import { scientificSceneFor } from '../src/lab/scientificSynthesis/sceneSignatures.ts'
import { SCHOOL_SPEC_IDS, SCHOOL_SPECS } from '../src/lab/cinema/scenes/school/specs/index.ts'
import { compoundById } from '../src/data/compounds.ts'
import { BOND_ANGLES, bondLengthPm, reagentAngleDeg, reagentBondPm } from '../src/chemistry/data/bondData.ts'

const norm = (s: string) => s.replace(/⇌/g, '⇄').replace(/\s+/g, ' ').trim()
let passed = 0

assert.deepEqual(Object.keys(G7_FIRST10_SCENE_REACTIONS).sort(), [...SCHOOL_SPEC_IDS].sort(), 'таблица карточек = 10 веществ спецификаций')

for (const id of SCHOOL_SPEC_IDS) {
  const spec = SCHOOL_SPECS[id]
  const row = G7_FIRST10_SCENE_REACTIONS[id]!
  // 1. Реакция карточки = реакции спецификации.
  assert.equal(row.bankId, spec.reaction.bankId, `${id}: bankId карточки ≠ спецификации`)
  assert.equal(row.equation, spec.reaction.equation, `${id}: уравнение карточки ≠ спецификации`)
  if (row.bankId) {
    const bank = getSchoolReaction(row.bankId)
    assert.ok(bank, `${id}: реакции ${row.bankId} нет в банке`)
    // Банк пишет обратимые реакции своей стрелкой — сравниваем состав, а не стрелку.
    const strip = (s: string) => norm(s).replace(/[→⇄]/g, '=')
    assert.equal(strip(bank.equationRu), strip(spec.reaction.equation), `${id}: запись банка «${bank.equationRu}» ≠ «${spec.reaction.equation}»`)
    // Предпочтительная реакция вещества в каталоге — та же (у N₂O₅ сцена — его реакция с водой, продукт HNO₃:
    // «получение» N₂O₅ в каталоге реакций остаётся своим, 2HNO₃ + P₂O₅).
    if (row.main === id) assert.equal(primaryReactionForCompound(id)?.id, row.bankId, `${id}: primaryReactionForCompound ≠ реакции сцены`)
  }
  // 2. Ссылка открывается в реакторе, синтез запускается.
  const link = schoolSceneLinkForCompound(id)
  assert.ok(link, `${id}: у карточки нет ссылки в лабораторию`)
  const r = resolveReactorEquation(row.bankId ? { reactionId: row.bankId, main: row.main } : { equation: row.equation, main: row.main })
  assert.ok(r.ok, `${id}: реактор не собирает реакцию карточки`)
  if (!r.ok || !link) continue
  assert.equal(r.stageOnly, null, `${id}: реакция только «шарами» — синтез не запустится`)
  assert.equal(r.productCompoundId, row.main, `${id}: главный продукт реактора ≠ ${row.main}`)
  assert.ok(link.href.includes('reactor=1'), `${id}: ссылка не в реактор`)
  // 3. Сцена.
  const scene = scientificSceneFor(r.productCompoundId, r.leftTerms)
  assert.ok(scene, `${id}: для реакции карточки нет сцены (продукт ${r.productCompoundId})`)
  assert.equal(link.hasScene, true, `${id}: кнопка карточки не зовёт смотреть анимацию`)
  passed++
}

// ——— 3D-модель карточки каталога = ядру (длины в масштабе 0,004 ед./пм ± 0,5 пм, углы ± 0,5°) ———
{
  const U = 0.004
  const dist = (p: readonly number[], q: readonly number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
  const angle = (a: readonly number[], c: readonly number[], b: readonly number[]) => {
    const u = [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!]
    const v = [b[0]! - c[0]!, b[1]! - c[1]!, b[2]! - c[2]!]
    return (Math.acos((u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI
  }
  /** Ожидание: связи «AB» → пм (мультимножество), углы «A-B-C» с центром B → градусы. */
  const WANT: Record<string, { bonds: Record<string, number[]>; angles: Record<string, number[]> }> = {
    co: { bonds: { CO: [bondLengthPm('C#O')] }, angles: {} },
    no: { bonds: { NO: [bondLengthPm('N=O')] }, angles: {} },
    no2: { bonds: { NO: [bondLengthPm('N-O(NO2)'), bondLengthPm('N-O(NO2)')] }, angles: { 'O-N-O': [BOND_ANGLES.nitrogenDioxide.deg] } },
    so2: { bonds: { OS: [bondLengthPm('S=O'), bondLengthPm('S=O')] }, angles: { 'O-S-O': [BOND_ANGLES.sulfurDioxide.deg] } },
    n2o: { bonds: { NN: [bondLengthPm('N-N(N2O)')], NO: [bondLengthPm('N-O(N2O)')] }, angles: { 'N-N-O': [BOND_ANGLES.nitrousOxide.deg] } },
    n2o5: {
      bonds: { NO: [...Array(2).fill(reagentBondPm('n2o5', 'N–O(мост)')), ...Array(4).fill(reagentBondPm('n2o5', 'N=O'))] },
      angles: { 'N-O-N': [reagentAngleDeg('n2o5', '∠N–O–N')] },
    },
  }
  for (const [id, want] of Object.entries(WANT)) {
    const c = compoundById[id]!
    const got: Record<string, number[]> = {}
    for (const [i, j] of c.bonds) {
      const key = [c.atoms[i]!.symbol, c.atoms[j]!.symbol].sort().join('')
      ;(got[key] ??= []).push(dist(c.atoms[i]!.pos, c.atoms[j]!.pos) / U)
    }
    assert.deepEqual(Object.keys(got).sort(), Object.keys(want.bonds).sort(), `${id}: связи модели каталога`)
    for (const [k, list] of Object.entries(want.bonds)) {
      const g = [...got[k]!].sort((x, y) => x - y)
      const w = [...list].sort((x, y) => x - y)
      assert.equal(g.length, w.length, `${id}: связей ${k}`)
      g.forEach((x, n) => assert.ok(Math.abs(x - w[n]!) <= 0.5, `${id}: ${k} = ${x.toFixed(1)} пм ≠ ${w[n]} пм`))
    }
    for (const [k, [deg]] of Object.entries(want.angles)) {
      const [ea, ec, eb] = k.split('-')
      let found = false
      c.atoms.forEach((ctr, ci) => {
        if (ctr.symbol !== ec) return
        const nb = c.bonds.filter(([i, j]) => i === ci || j === ci).map(([i, j]) => (i === ci ? j : i))
        for (const x of nb) for (const y of nb) {
          if (x >= y) continue
          const sx = c.atoms[x]!.symbol
          const sy = c.atoms[y]!.symbol
          if (!((sx === ea && sy === eb) || (sx === eb && sy === ea))) continue
          found = true
          const v = angle(c.atoms[x]!.pos, ctr.pos, c.atoms[y]!.pos)
          assert.ok(Math.abs(v - deg!) <= 0.5, `${id}: ∠${k} = ${v.toFixed(1)}° ≠ ${deg}°`)
        }
      })
      assert.ok(found, `${id}: нет угла ${k}`)
    }
  }
  // Концевые O–N–O у N₂O₅: 134,2°.
  const n5 = compoundById.n2o5!
  n5.atoms.forEach((a, ci) => {
    if (a.symbol !== 'N') return
    const term = n5.bonds.filter(([i, j]) => i === ci || j === ci).map(([i, j]) => (i === ci ? j : i)).filter((k) => dist(n5.atoms[k]!.pos, a.pos) / U < 130)
    assert.equal(term.length, 2)
    const v = angle(n5.atoms[term[0]!]!.pos, a.pos, n5.atoms[term[1]!]!.pos)
    assert.ok(Math.abs(v - reagentAngleDeg('n2o5', '∠O=N=O')) <= 0.5, `n2o5: ∠ONO концевых = ${v.toFixed(1)}°`)
  })
}

console.log(`✓ g7 first10 links: сцена по ссылке карточки — ${passed} из ${SCHOOL_SPEC_IDS.length}`)
