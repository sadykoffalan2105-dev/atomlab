#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «механизм получения ClO₂».
 *
 * Сцена 3D проверяется данными, а не глазами: раскадровка — чистая функция
 * sampleClo2Frame(t), поэтому весь урок можно просэмплировать в Node и
 * убедиться, что реакция идёт по настоящему механизму и без рывков:
 *   ClO₂⁻ + Cl₂ → ClOClO + Cl⁻            (перенос Cl⁺, медленная стадия)
 *   ClOClO + ClO₂⁻ → [ClOCl(O)OClO]⁻ → 2 ClO₂ + Cl⁻
 *
 * Запуск: npx tsx scripts/test-clo2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { BOND_ANGLE_DEG, BOND_LENGTH_A, ang, SCENE_PER_ANGSTROM } from '../src/lab/cinema/core/atoms.ts'
import { Ease, ease } from '../src/lab/cinema/core/easing.ts'
import { sampleScalar, sampleVec3, validateTrack } from '../src/lab/cinema/core/tracks.ts'
import { storyDuration } from '../src/lab/cinema/core/storyTime.ts'
import { createCueRunner, pulseAt } from '../src/lab/cinema/core/cues.ts'
import {
  CLO2_ARROWS,
  CLO2_ATOMS,
  CLO2_BONDS,
  CLO2_CUES,
  CLO2_END,
  CLO2_FINISH,
  CLO2_GEOM,
  CLO2_LABELS,
  CLO2_SEGMENTS,
  CLO2_STEPS,
  CLO2_STEP_IDS,
  clo2StepIndexAt,
  createClo2Frame,
  sampleClo2Frame,
  validateClo2Storyboard,
  type Clo2AtomId,
  type Clo2BondId,
  type Clo2Frame,
} from '../src/lab/cinema/scenes/clo2/storyboard.ts'
import { getClo2MechanismText, type Clo2Locale } from '../src/lab/cinema/scenes/clo2/clo2MechanismText.ts'
import { clo2StepStore } from '../src/lab/cinema/scenes/clo2/clo2StepStore.ts'
import { scientificSynthesisWatchdogMs } from '../src/lab/scientificSynthesis/clo2ScenarioTiming.ts'

const DT = 1 / 60
const cueAt = (id: string) => CLO2_CUES.find((c) => c.id === id)!.at

// ——— Ядро библиотеки: easing, дорожки, события ———
{
  for (const [name, fn] of Object.entries(Ease)) {
    assert.ok(Math.abs(fn(0)) < 1e-6, `ease ${name}: f(0) must be 0`)
    if (name !== 'spike' && name !== 'flash') assert.ok(Math.abs(fn(1) - 1) < 1e-6, `ease ${name}: f(1) must be 1`)
  }
  assert.equal(ease(undefined, 0.5), 0.5)

  const track = [
    { t: 0, v: 0 },
    { t: 1, v: 10 },
  ]
  assert.equal(sampleScalar(track, -1), 0, 'before first key — hold')
  assert.equal(sampleScalar(track, 5), 10, 'after last key — hold')
  assert.throws(() => validateTrack('broken', [{ t: 1 }, { t: 1 }]), /strictly increasing/)

  const arc = [
    { t: 0, v: [0, 0, 0] as const },
    { t: 1, v: [2, 0, 0] as const, arc: 0.5 },
  ]
  const out = new THREE.Vector3()
  sampleVec3(arc, 1, out)
  assert.ok(out.distanceTo(new THREE.Vector3(2, 0, 0)) < 1e-6, 'arc keeps the end key exact')

  // seek: всё строго раньше метки — «уже случилось», сама метка выстрелит снова.
  const fired: string[] = []
  const runner = createCueRunner([
    { at: 1, id: 'a' },
    { at: 2, id: 'b' },
    { at: 3, id: 'c' },
  ])
  runner.seek(2)
  runner.update(5, (id) => fired.push(id))
  assert.deepEqual(fired, ['b', 'c'], 'seek skips earlier cues and replays the rest')

  assert.equal(pulseAt(1, 2, 0.5), 0)
  assert.ok(pulseAt(2.06, 2, 0.5) > 0.9)
}

// ——— Шаги урока и хронометраж ———
{
  validateClo2Storyboard()
  assert.equal(CLO2_STEPS.length, 8)
  assert.deepEqual(
    CLO2_STEPS.map((s) => s.id),
    [...CLO2_STEP_IDS],
  )
  let prev = 0
  for (const s of CLO2_STEPS) {
    assert.equal(s.from, prev, `step ${s.id} starts where the previous one ended`)
    assert.ok(s.to > s.from && s.wall > 0, `step ${s.id} has story and screen time`)
    prev = s.to
  }
  assert.equal(CLO2_FINISH.from, prev, 'the finale follows the last step')
  assert.equal(storyDuration(CLO2_SEGMENTS), CLO2_END)

  // Шаги с переносом электронов идут замедленно — это и есть «под микроскопом».
  for (const id of ['clTransfer', 'split'] as const) {
    const s = CLO2_STEPS.find((x) => x.id === id)!
    assert.ok(s.wall > (s.to - s.from) * 1.6, `${id} must be slow-motion`)
  }

  assert.equal(clo2StepIndexAt(0), 0)
  assert.equal(clo2StepIndexAt(CLO2_STEPS[2]!.to), 2, 'the end of a step belongs to it')
  assert.equal(clo2StepIndexAt(CLO2_STEPS[2]!.to + 0.01), 3)

  // Каждое химическое событие лежит внутри «своего» шага.
  const stepOf = (id: string) => CLO2_STEPS[clo2StepIndexAt(cueAt(id))]!.id
  assert.equal(stepOf('bubble'), 'reagents')
  assert.equal(stepOf('clTransfer'), 'clTransfer')
  assert.equal(stepOf('chlorideOut'), 'clTransfer')
  assert.equal(stepOf('adduct'), 'attack')
  assert.equal(stepOf('split'), 'split')
  assert.equal(stepOf('radicals'), 'split')

  // Контракт лаборатории — только после последнего шага.
  const lastStepEnd = CLO2_STEPS[CLO2_STEPS.length - 1]!.to
  for (const id of ['embryo', 'birth', 'complete']) assert.ok(cueAt(id) > lastStepEnd, `${id} fires only in the finale`)
  assert.ok(cueAt('embryo') < cueAt('birth') && cueAt('birth') < cueAt('complete'))
  assert.equal(cueAt('complete'), CLO2_END)

  const fired: string[] = []
  const runner = createCueRunner(CLO2_CUES)
  for (let t = 0; t <= CLO2_END + 0.2; t += 0.4) runner.update(t, (id) => fired.push(id))
  assert.equal(fired.length, CLO2_CUES.length, 'cues survive frame drops and fire once')

  // Урок по шагам ждёт ученика: сторож лаборатории — только бюджет на старт сцены.
  const watchdog = scientificSynthesisWatchdogMs('clo2')!
  assert.ok(watchdog > 3000 && watchdog < 15000, `watchdog is a start-up budget, got ${watchdog}`)
}

// ——— Сэмплирование всего урока ———
const frame = createClo2Frame()
const at = (t: number): Clo2Frame => sampleClo2Frame(t, frame)
const dist = (a: Clo2AtomId, b: Clo2AtomId) => frame.atoms[a].distanceTo(frame.atoms[b])
const angleAt = (a: Clo2AtomId, c: Clo2AtomId, b: Clo2AtomId) => {
  const u = frame.atoms[a].clone().sub(frame.atoms[c]).normalize()
  const w = frame.atoms[b].clone().sub(frame.atoms[c]).normalize()
  return (Math.acos(Math.min(1, Math.max(-1, u.dot(w)))) * 180) / Math.PI
}
const A = (x: number) => x / SCENE_PER_ANGSTROM
const bond = (id: Clo2BondId) => frame.bonds[id]

// ——— Геометрия: экспериментальные длины и углы ———
{
  at(1)
  for (const [c, o1, o2] of [
    ['clA', 'oA1', 'oA2'],
    ['clB', 'oB1', 'oB2'],
  ] as const) {
    assert.ok(Math.abs(A(dist(c, o1)) - BOND_LENGTH_A.ClO_chlorite) < 1e-6, `${c}: chlorite Cl–O 1.57 Å`)
    assert.ok(Math.abs(angleAt(o1, c, o2) - BOND_ANGLE_DEG.chlorite) < 1e-3, `${c}: chlorite 110.5°`)
  }
  assert.ok(Math.abs(A(dist('clX', 'clY')) - BOND_LENGTH_A.ClCl) < 1e-6, 'Cl₂ 1.988 Å')

  at(cueAt('clTransfer') + 0.01)
  assert.ok(Math.abs(A(dist('oA1', 'clX')) - 1.69) < 0.02, 'new O–Cl bond at 1.69 Å')
  assert.ok(Math.abs(angleAt('clA', 'oA1', 'clX') - 110) < 1, 'Cl–O–Cl bent at the bridging O (lone-pair direction)')

  at(19)
  // Пирамида AX₃E у центрального хлора в комплексе.
  const a1 = angleAt('oB1', 'clA', 'oA1')
  const a2 = angleAt('oB1', 'clA', 'oA2')
  assert.ok(Math.abs(a1 - a2) < 0.5 && a1 > 104 && a1 < 110, `adduct: pyramidal O–Cl–O, got ${a1.toFixed(1)}°`)
  const n = frame.atoms.oA1.clone().sub(frame.atoms.clA).cross(frame.atoms.oA2.clone().sub(frame.atoms.clA)).normalize()
  const oop = Math.abs(n.dot(frame.atoms.oB1.clone().sub(frame.atoms.clA).normalize()))
  assert.ok(oop > 0.3, 'adduct: the attacking O is out of the O–Cl–O plane (not flat)')

  at(CLO2_END)
  for (const [c, o1, o2] of [
    ['clA', 'oA1', 'oA2'],
    ['clB', 'oB1', 'oB2'],
  ] as const) {
    assert.ok(Math.abs(A(dist(c, o1)) - BOND_LENGTH_A.ClO_radical) < 1e-6, `${c}: ClO₂ Cl–O 1.47 Å`)
    assert.ok(Math.abs(angleAt(o1, c, o2) - BOND_ANGLE_DEG.clo2) < 1e-3, `${c}: ClO₂ 117.4°`)
  }
  assert.ok(CLO2_GEOM.radius.clAnion > CLO2_GEOM.radius.cl, 'Cl⁻ is larger than the Cl atom')
  assert.equal(frame.anion.clX, 1)
  assert.equal(frame.anion.clY, 1)
}

// ——— Порядок событий механизма: какие связи рвутся и образуются ———
{
  const visible = (id: Clo2BondId, t: number) => (at(t), bond(id).opacity > 0.5)
  const tT = cueAt('clTransfer')
  const tA = cueAt('adduct')
  const tS = cueAt('split')

  // Cl–O хлорита не рвутся никогда.
  for (const id of ['clA_oA1', 'clA_oA2', 'clB_oB1', 'clB_oB2'] as const) {
    for (let t = 0; t <= CLO2_END; t += 0.25) assert.ok(visible(id, t), `${id} must exist at t=${t}`)
  }
  // Шаг 3: новая O–Cl образуется одновременно с разрывом Cl–Cl.
  assert.ok(visible('clX_clY', tT - 0.3) && !visible('clX_clY', tT + 0.3), 'Cl–Cl breaks at the Cl⁺ transfer')
  assert.ok(!visible('oA1_clX', 9.3) && visible('oA1_clX', tT + 0.05), 'O–Cl forms at the Cl⁺ transfer')
  assert.ok(!visible('oA1_clX', 9.3) && visible('clX_clY', 9.3), 'no moment with Cl bonded to both before the transfer')
  // Шаг 5: мостик — только после подхода второго хлорита.
  assert.ok(!visible('oB1_clA', 17) && visible('oB1_clA', tA), 'bridge O–Cl forms on the adduct')
  // Шаг 6: обе связи комплекса рвутся на распаде.
  assert.ok(visible('oA1_clX', tS - 0.3) && !visible('oA1_clX', tS + 0.3), 'terminal Cl–O breaks on the split')
  assert.ok(visible('oB1_clA', tS - 0.3) && !visible('oB1_clA', tS + 0.3), 'bridge O–Cl breaks on the split')
  for (const id of ['clX_clY', 'oA1_clX', 'oB1_clA'] as const) assert.ok(!visible(id, CLO2_END), `${id} is gone in the products`)

  // Связь нарисована — значит атомы рядом (не «резинка» через полкадра).
  // Рвущаяся связь может растянуться, но не больше чем в 1,6 раза.
  const rest: Record<Clo2BondId, number> = {
    clA_oA1: BOND_LENGTH_A.ClO_chlorite,
    clA_oA2: BOND_LENGTH_A.ClO_chlorite,
    clB_oB1: BOND_LENGTH_A.ClO_chlorite,
    clB_oB2: BOND_LENGTH_A.ClO_chlorite,
    clX_clY: BOND_LENGTH_A.ClCl,
    oA1_clX: 1.69,
    oB1_clA: 1.85,
  }
  for (let t = 0; t <= CLO2_END; t += DT * 3) {
    at(t)
    for (const b of CLO2_BONDS) {
      const s = bond(b.id)
      if (s.opacity < 0.5) continue
      const d = A(s.from.distanceTo(s.to))
      assert.ok(d < rest[b.id] * 1.6, `${b.id} drawn across ${d.toFixed(2)} Å at t=${t.toFixed(2)}`)
    }
  }
}

// ——— Степени окисления и подписи ———
{
  const label = (id: string, t: number) => {
    at(t)
    const i = CLO2_LABELS.findIndex((l) => l.id === id)
    return frame.labels[i]!
  }
  const tT = cueAt('clTransfer')
  const tS = cueAt('split')
  assert.equal(label('ox_clA', 2).text, '+3')
  assert.equal(label('ox_clA', CLO2_END - 1).text, '+4')
  assert.equal(label('ox_clX', tT - 0.3).text, '0')
  assert.equal(label('ox_clX', tT + 0.3).text, '+1', 'Cl⁺ in ClOClO')
  assert.equal(label('ox_clX', tS + 0.3).text, '−1', 'second Cl⁻ after the split')
  assert.equal(label('ox_clY', tT + 0.3).text, '−1', 'first Cl⁻ after the transfer')
  // +3 → +4 только после гомолиза, не раньше.
  assert.equal(label('ox_clA', tS - 0.2).text, '+3')
  // Частичные заряды — только пока молекула Cl₂ цела.
  assert.ok(label('delta_clX', 8).opacity > 0.9 && label('delta_clX', tT + 0.1).opacity === 0)
  // Никакого «NaCl · осадок»: соль в растворе — это ионы.
  for (const l of CLO2_LABELS) for (const k of l.keys) assert.ok(!/осад|precip/i.test(k.text), `label ${l.id}`)

  // Итог по степеням окисления сходится: Σ = 2·(+3) + 2·0 = 2·(+4) + 2·(−1) = +6.
  const ox = (s: string) => Number(s.replace('−', '-'))
  const sum = (t: number) =>
    ['ox_clA', 'ox_clB', 'ox_clX', 'ox_clY'].reduce((acc, id) => acc + ox(label(id, t).text), 0)
  assert.equal(sum(4), 6)
  assert.equal(sum(CLO2_END - 1), 6)
}

// ——— Электроны: пары двигаются вместе, одиночные — при гомолизе ———
{
  const e = (id: string) => frame.electrons.find((x) => x.id === id)!
  const near = (id: string, atom: Clo2AtomId, r = 0.45) => e(id).pos.distanceTo(frame.atoms[atom]) < r

  at(8)
  assert.ok(near('e1', 'oA1') && near('e2', 'oA1'), 'lone pair sits on the attacking O')
  assert.ok(e('e1').pos.distanceTo(e('e2').pos) > 0.08, 'a pair is drawn as two electrons')
  at(cueAt('clTransfer') + 0.4)
  assert.ok(near('e3', 'clY') && near('e4', 'clY'), 'the Cl–Cl pair leaves with the chloride')
  at(15)
  const mid = frame.atoms.oA1.clone().add(frame.atoms.clX).multiplyScalar(0.5)
  assert.ok(e('e1').pos.distanceTo(mid) < 0.15, 'the O lone pair became the O–Cl bond')
  at(cueAt('split') + 0.5)
  assert.ok(near('e1', 'clX') && near('e2', 'clX'), 'heterolysis: both electrons go to the leaving Cl')
  assert.ok(near('e5', 'clA', 0.5) && near('e6', 'oB1', 0.5), 'homolysis: one electron to each half')
  at(CLO2_END - 2)
  assert.ok(e('e5').opacity < 0.01 && e('e6').opacity < 0.01, 'the unpaired electrons are shown as the delocalised cloud')
  assert.ok(frame.clouds.A.amount > 0.99 && frame.clouds.B.amount > 0.99, 'both ClO₂ radicals carry their π* cloud')

  // Электроны не прыгают: максимальная скорость ограничена.
  const prev = new Map<string, THREE.Vector3>()
  for (let t = 0; t <= CLO2_END; t += DT) {
    at(t)
    for (const el of frame.electrons) {
      if (el.opacity < 0.05) {
        prev.delete(el.id)
        continue
      }
      const p = prev.get(el.id)
      if (p) {
        const v = p.distanceTo(el.pos) / DT
        assert.ok(v < 4.5, `${el.id} jumps at t=${t.toFixed(2)} (${v.toFixed(2)} u/s)`)
        p.copy(el.pos)
      } else prev.set(el.id, el.pos.clone())
    }
  }

  // Стрелки: полная — пара, полустрелка — один электрон; одиночных ровно две (гомолиз).
  const singles = CLO2_ARROWS.filter((a) => a.kind === 'single')
  assert.equal(singles.length, 2)
  for (const a of singles) assert.ok(a.draw[0] > cueAt('adduct') && a.fade[1] <= cueAt('split') + 0.2, `${a.id} belongs to the split`)
  for (const a of CLO2_ARROWS) {
    at((a.draw[1] + a.fade[0]) / 2)
    const s = frame.arrows[CLO2_ARROWS.indexOf(a)]!
    assert.ok(s.opacity > 0.9 && s.draw > 0.99, `${a.id} is fully drawn before it fades`)
    assert.ok(s.p0.distanceTo(s.p1) > 0.18, `${a.id} is long enough to read`)
  }
}

// ——— Непрерывность и столкновения ———
{
  const prev = new Map<Clo2AtomId, THREE.Vector3>()
  const r = (id: Clo2AtomId) => (id.startsWith('cl') ? CLO2_GEOM.radius.cl : id.startsWith('na') ? CLO2_GEOM.radius.na : CLO2_GEOM.radius.o)
  let minGap = Infinity
  for (let t = 0; t <= CLO2_END; t += DT) {
    at(t)
    for (const a of CLO2_ATOMS) {
      const p = frame.atoms[a.id]
      assert.ok(Number.isFinite(p.x + p.y + p.z), `${a.id} is NaN at t=${t.toFixed(2)}`)
      const q = prev.get(a.id)
      if (q) {
        const v = q.distanceTo(p) / DT
        assert.ok(v < 3.5, `${a.id} teleports at t=${t.toFixed(2)} (${v.toFixed(2)} u/s)`)
        q.copy(p)
      } else prev.set(a.id, p.clone())
    }
    for (let i = 0; i < CLO2_ATOMS.length; i++) {
      for (let j = i + 1; j < CLO2_ATOMS.length; j++) {
        const a = CLO2_ATOMS[i]!.id
        const b = CLO2_ATOMS[j]!.id
        const bonded = CLO2_BONDS.some((x) => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && bond(x.id).opacity > 0.02)
        if (bonded) continue
        const gap = dist(a, b) - r(a) - r(b)
        if (gap < minGap) minGap = gap
        assert.ok(gap > 0.05, `${a} and ${b} interpenetrate at t=${t.toFixed(2)} (gap ${gap.toFixed(3)})`)
      }
    }
  }
  assert.ok(minGap < 0.4, 'the reacting particles do come close')

  // Na⁺ — наблюдатели: всю реакцию далеко от хлора и кислорода.
  for (let t = 0; t <= CLO2_END; t += 0.5) {
    at(t)
    for (const na of ['na1', 'na2'] as const) {
      for (const other of ['clA', 'clB', 'clX', 'clY', 'oA1', 'oB1'] as const) {
        assert.ok(dist(na, other) > 0.6, `${na} crowds ${other} at t=${t}`)
      }
    }
  }
}

// ——— Среда и камера ———
{
  at(1)
  assert.ok(frame.env.bubble.opacity > 0.5, 'Cl₂ arrives as a gas bubble')
  at(cueAt('bubble') + 0.8)
  assert.equal(frame.env.bubble.opacity, 0, 'the bubble dissolves')
  at(cueAt('split') - 0.5)
  assert.equal(frame.env.clo2Tint, 0, 'no yellow ClO₂ before it exists')
  at(CLO2_END - 1)
  assert.ok(frame.env.clo2Tint > 0.05, 'the solution turns yellow')
  at(0)
  assert.equal(frame.camera.shake, 0)
  at(cueAt('clTransfer') + 0.05)
  assert.ok(frame.camera.shake > 0.5, 'the camera kicks at the Cl⁺ transfer')
}

// ——— Тексты урока на трёх языках ———
{
  for (const locale of ['ru', 'en', 'uz'] as Clo2Locale[]) {
    const pack = getClo2MechanismText(locale)
    assert.ok(pack.intro.title && pack.safety, `${locale}: intro and safety`)
    for (const id of CLO2_STEP_IDS) {
      const s = pack.steps[id]
      assert.ok(s, `${locale}: step ${id}`)
      for (const k of ['title', 'body', 'equation', 'speak'] as const) assert.ok(s[k].trim().length > 0, `${locale}.${id}.${k}`)
    }
    const all = JSON.stringify(pack)
    assert.ok(!/NaCl\s*·?\s*(осадок|precipitate|choʻkma\b(?! emas))/i.test(all), `${locale}: NaCl must not be called a precipitate`)
    assert.ok(pack.steps.clTransfer.equation.includes('ClOClO'), `${locale}: step 3 equation`)
    assert.ok(pack.steps.split.equation.includes('2 ClO₂'), `${locale}: step 6 equation`)
    assert.ok(/2e⁻/.test(pack.steps.balance.equation), `${locale}: electron balance`)
  }
}

// ——— Мост сцена ↔ панель ———
{
  const calls: string[] = []
  clo2StepStore.attach(7, {
    playStep: (i) => calls.push(`play:${i}`),
    replayStep: () => calls.push('replay'),
    finish: () => calls.push('finish'),
  })
  assert.equal(clo2StepStore.getSnapshot().status, 'playing')
  clo2StepStore.next()
  assert.deepEqual(calls, [], '«Далее» is ignored while a step is playing')
  clo2StepStore.report(7, 0, 'paused')
  clo2StepStore.next()
  assert.deepEqual(calls, ['play:1'])
  clo2StepStore.report(99, 5, 'paused')
  assert.equal(clo2StepStore.getSnapshot().step, 0, 'a stale run cannot overwrite the snapshot')
  clo2StepStore.report(7, CLO2_STEPS.length - 1, 'paused')
  clo2StepStore.next()
  assert.equal(calls.at(-1), 'finish', '«Далее» on the last step finishes the lesson')
  clo2StepStore.detach(99)
  assert.equal(clo2StepStore.getSnapshot().runId, 7, 'detach of another run is ignored')
  clo2StepStore.detach(7)
  assert.equal(clo2StepStore.getSnapshot().runId, 0)
}

// ——— Порядок связей, орбитали, колебания ———
{
  const order = (id: Clo2BondId, t: number) => (at(t), frame.bondChem[id].order)
  const tT = cueAt('clTransfer')
  const tA = cueAt('adduct')
  const tS = cueAt('split')
  // Хлорит — резонанс (1,5); ClOClO — Cl–O и Cl=O; радикал — 1,75.
  assert.equal(order('clA_oA1', 2), 1.5)
  assert.equal(order('clA_oA2', 2), 1.5)
  assert.equal(order('clA_oA1', tT + 0.2), 1, 'bridging O–Cl in ClOClO is single')
  assert.equal(order('clA_oA2', tT + 0.2), 2, 'terminal Cl=O in ClOClO is double')
  assert.equal(order('clB_oB1', tA + 0.2), 1, 'attacking O of chlorite B becomes single')
  assert.equal(order('clB_oB2', tA + 0.2), 2)
  for (const id of ['clA_oA1', 'clA_oA2', 'clB_oB1', 'clB_oB2'] as const) {
    assert.equal(order(id, CLO2_END), 1.75, `${id}: ClO₂ radical bond order 1.5 + 0.25`)
    assert.ok(order(id, tS - 0.2) !== 1.75, `${id}: order changes only after the split`)
  }
  // Разрыв: Cl–Cl и концевая O–Cl — гетеролиз к хлору; мостик — гомолиз.
  at(0)
  assert.equal(frame.bondChem.clX_clY.split, 1)
  assert.equal(frame.bondChem.oA1_clX.split, 1)
  assert.equal(frame.bondChem.oB1_clA.split, 0)

  const orb = (t: number) => (at(t), frame.orbitals)
  assert.ok(orb(8).lonePairA > 0.99 && orb(8).sigmaStarCl2 > 0.99, 'donor lone pair and acceptor σ* are shown on approach')
  assert.equal(orb(tT + 0.1).sigmaStarCl2, 0, 'σ* disappears once Cl–Cl is broken')
  assert.equal(orb(tT + 0.1).lonePairA, 0, 'the lone pair has become the O–Cl bond')
  assert.ok(orb(17).lonePairB > 0.99 && orb(tA + 0.1).lonePairB === 0, 'second donor pair on attack')
  assert.equal(orb(tS).somoA, 0, 'no radical orbital before the split')
  assert.ok(orb(CLO2_END).somoA > 0.99 && orb(CLO2_END).somoB > 0.99, 'both ClO₂ carry the singly occupied 2b1')
  // Облако-сфера больше не нужно тем, у кого есть орбиталь: электроны e5/e6 уходят в SOMO.
  at(CLO2_END - 1)
  assert.ok(frame.vibration.radicalA > 0.3, 'radicals keep vibrating')
  at(9.6)
  assert.equal(frame.vibration.cl2, 0, 'Cl₂ stretch is silent at the moment of transfer (no fake energy)')
}

console.log('test-clo2-cinema: all passed')
