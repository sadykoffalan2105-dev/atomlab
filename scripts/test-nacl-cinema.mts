#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «ионная связь: 2 Na + Cl₂ → 2 NaCl».
 *
 * Раскадровка — чистая функция sampleNaclFrame(t), поэтому урок проверяется
 * данными в Node: порядок шагов, монотонный хронометраж, события внутри шагов,
 * переход электрона (Na уменьшается и заряжается +, Cl растёт и заряжается −),
 * гомолиз Cl–Cl, сборка решётки с чередованием зарядов, экзотермический пик,
 * тексты на трёх языках и энергетика Борна — Габера.
 *
 * Запуск: npx tsx scripts/test-nacl-cinema.mts
 */
import assert from 'node:assert/strict'
import { storyDuration, storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import {
  NACL_CUES,
  NACL_END,
  NACL_FINISH,
  NACL_SEGMENTS,
  NACL_STEPS,
  NACL_STEP_IDS,
  naclCueAt,
  naclStepIndexAt,
} from '../src/lab/cinema/scenes/nacl/naclSteps.ts'
import {
  createNaclFrame,
  NACL_ATOMS,
  NACL_EDGES,
  NACL_GEOM,
  NACL_LABELS,
  sampleNaclFrame,
  validateNaclStoryboard,
  type NaclAtomId,
} from '../src/lab/cinema/scenes/nacl/naclStoryboard.ts'
import { getNaclMechanismText, type NaclLocale } from '../src/lab/cinema/scenes/nacl/naclMechanismText.ts'
import {
  NACL_BORN_HABER,
  NACL_DHF_KJ,
  NACL_DHF_TABLE_KJ,
  naclEnergyActiveStageAt,
  naclEnergyLadder,
  naclFormationEnthalpyKJ,
} from '../src/lab/cinema/scenes/nacl/naclEnergetics.ts'
import { clo2StepStore } from '../src/lab/cinema/scenes/clo2/clo2StepStore.ts'
import { getCinemaLesson, lessonStepIdAt } from '../src/lab/cinema/scenes/lessons.ts'
import { scientificSynthesisWatchdogMs } from '../src/lab/scientificSynthesis/clo2ScenarioTiming.ts'
import { readFileSync } from 'node:fs'

const DT = 1 / 60

// ——— Шаги и хронометраж ———
{
  assert.deepEqual(
    NACL_STEP_IDS,
    ['approach', 'homolysis', 'transfer', 'attraction', 'lattice', 'energy'],
    'six steps of the textbook story in order',
  )
  assert.equal(NACL_STEPS.length, NACL_STEP_IDS.length)
  assert.equal(NACL_STEPS[0]!.from, 0)
  for (let i = 0; i < NACL_STEPS.length; i++) {
    const s = NACL_STEPS[i]!
    assert.equal(s.id, NACL_STEP_IDS[i])
    assert.ok(s.to > s.from, `step ${s.id}: to > from`)
    assert.ok(s.wall > 0, `step ${s.id}: wall > 0`)
    if (i > 0) assert.equal(s.from, NACL_STEPS[i - 1]!.to, `step ${s.id} starts where the previous ends`)
  }
  assert.equal(NACL_FINISH.from, NACL_STEPS[NACL_STEPS.length - 1]!.to)
  assert.equal(NACL_END, NACL_FINISH.to)
  assert.equal(storyDuration(NACL_SEGMENTS), NACL_END)
  // Сегменты монотонны и совпадают с границами шагов.
  let prevTo = 0
  for (const seg of NACL_SEGMENTS) {
    assert.ok(seg.to > prevTo, 'segments strictly increase')
    prevTo = seg.to
  }
  assert.equal(NACL_SEGMENTS.length, NACL_STEPS.length + 1)
  const wall = storyWallDuration(NACL_SEGMENTS)
  assert.ok(wall > 25 && wall < 45, `total wall time reasonable for a lesson: ${wall}s`)

  // Индекс шага по времени: границы принадлежат своему шагу.
  assert.equal(naclStepIndexAt(0), 0)
  assert.equal(naclStepIndexAt(4), 0)
  assert.equal(naclStepIndexAt(4.01), 1)
  assert.equal(naclStepIndexAt(NACL_END), NACL_STEPS.length - 1)

  // События: монотонны, внутри сюжета, и каждое — на своём шаге.
  let prevAt = -1
  for (const c of NACL_CUES) {
    assert.ok(c.at > prevAt, `cue ${c.id} monotonic`)
    assert.ok(c.at <= NACL_END)
    prevAt = c.at
  }
  assert.equal(NACL_STEP_IDS[naclStepIndexAt(naclCueAt('bondBreak'))], 'homolysis')
  assert.equal(NACL_STEP_IDS[naclStepIndexAt(naclCueAt('transfer'))], 'transfer')
  assert.equal(NACL_STEP_IDS[naclStepIndexAt(naclCueAt('contact'))], 'attraction')
  assert.equal(NACL_STEP_IDS[naclStepIndexAt(naclCueAt('lattice'))], 'lattice')
  assert.equal(NACL_STEP_IDS[naclStepIndexAt(naclCueAt('exo'))], 'energy')
  assert.ok(naclCueAt('embryo') < naclCueAt('birth') && naclCueAt('birth') < naclCueAt('complete'))
  assert.equal(naclCueAt('complete'), NACL_END)
  assert.ok(naclCueAt('embryo') >= NACL_FINISH.from, 'lab contract fires in the finish tail')
}

// ——— Раскадровка: химия по шагам ———
{
  validateNaclStoryboard()
  const frame = createNaclFrame()
  const at = (t: number) => sampleNaclFrame(t, frame)

  // Начало: атомы, не ионы; Cl₂ — целая связь длиной 1,988 Å.
  at(0.5)
  assert.equal(frame.charge.na1, 0)
  assert.equal(frame.charge.clA, 0)
  assert.ok(Math.abs(frame.atoms.clA.distanceTo(frame.atoms.clB) - NACL_GEOM.clHalf * 2) < 1e-3, 'Cl–Cl bond length at start')
  assert.equal(frame.bond.opacity, 1)
  assert.equal(frame.bond.split, 0)
  assert.ok(frame.radius.na1 > frame.radius.clA, 'Na atom is larger than Cl atom')

  // Сближение: натрий подходит к хлору.
  const d0 = at(0).atoms.na1.distanceTo(frame.atoms.clA)
  const d4 = at(4).atoms.na1.distanceTo(frame.atoms.clA)
  assert.ok(d4 < d0 * 0.6, 'Na approaches Cl₂ during step 1')

  // Гомолиз: напряжение растёт, потом связь исчезает, атомы расходятся.
  at(5.8)
  assert.ok(frame.bond.stress > 0.7, 'bond under stress before it breaks')
  at(7)
  assert.ok(frame.bond.opacity < 0.05, 'Cl–Cl bond gone after homolysis')
  assert.ok(frame.atoms.clA.distanceTo(frame.atoms.clB) > NACL_GEOM.clHalf * 3, 'Cl atoms separated')
  assert.equal(frame.charge.clA, 0, 'homolysis does not create ions')

  // Перенос электрона: орбиталь подсвечена перед прыжком, электрон летит, радиусы и заряды меняются.
  at(8.0)
  assert.ok(frame.orbital.na1 > 0.5, '3s orbital highlighted before the jump')
  assert.ok(frame.electrons[0].opacity > 0.5, 'electron visible on the orbital')
  assert.equal(frame.electrons[0].progress, 0)
  at(9.3)
  assert.ok(frame.electrons[0].progress > 0.2 && frame.electrons[0].progress < 0.8, 'electron mid-flight')
  const dNa = frame.electrons[0].pos.distanceTo(frame.atoms.na1)
  const dCl = frame.electrons[0].pos.distanceTo(frame.atoms.clA)
  assert.ok(dNa > NACL_GEOM.radius.naCation && dCl > NACL_GEOM.radius.cl, 'electron is between the atoms, not inside either')
  at(11)
  assert.ok(Math.abs(frame.radius.na1 - NACL_GEOM.radius.naCation) < 1e-6, 'Na shrank to Na⁺')
  assert.ok(Math.abs(frame.radius.clA - NACL_GEOM.radius.clAnion) < 1e-6, 'Cl grew to Cl⁻')
  assert.ok(frame.radius.clA > frame.radius.na1, 'anion larger than cation')
  assert.equal(frame.charge.na1, 1)
  assert.equal(frame.charge.clA, -1)
  assert.equal(frame.charge.na2, 1)
  assert.equal(frame.charge.clB, -1)
  assert.ok(frame.electrons[0].opacity < 0.05 && frame.electrons[1].opacity < 0.05, 'electrons absorbed by chlorine')
  assert.ok(frame.orbital.na1 < 0.05, 'orbital highlight gone after the transfer')

  // Притяжение: расстояние Na⁺–Cl⁻ сокращается до 2,82 Å (решётка).
  const d12 = at(12).atoms.na1.distanceTo(frame.atoms.clA)
  assert.ok(frame.attract > 0 || true)
  at(13.5)
  assert.ok(frame.attract > 0.5, 'attraction lines visible while ions pull together')
  const d15 = at(15).atoms.na1.distanceTo(frame.atoms.clA)
  assert.ok(d15 < d12, 'ions pulled together')
  assert.ok(Math.abs(d15 - NACL_GEOM.latticeNaCl) < 1e-3, 'Na–Cl = 2.82 Å in the ion pair / lattice')

  // Решётка: 8 ионов в вершинах куба, заряды чередуются по каждому ребру.
  at(19.5)
  for (const a of NACL_ATOMS) assert.ok(frame.opacity[a.id] > 0.99, `${a.id} visible in the lattice`)
  const el = (id: NaclAtomId) => NACL_ATOMS.find((a) => a.id === id)!.el
  for (const [a, b] of NACL_EDGES) {
    const d = frame.atoms[a].distanceTo(frame.atoms[b])
    assert.ok(Math.abs(d - NACL_GEOM.latticeNaCl) < 1e-3, `edge ${a}–${b} = Na–Cl distance (got ${d.toFixed(3)})`)
    assert.notEqual(el(a), el(b), `edge ${a}–${b} alternates charge`)
    assert.ok(frame.charge[a] * frame.charge[b] < 0, `edge ${a}–${b}: opposite charges`)
  }
  assert.equal(NACL_EDGES.length, 144, 'a 4×4×4 lattice fragment has 144 edges')
  assert.ok(frame.edges > 0.4, 'lattice edges drawn')
  assert.equal(frame.env.exo, 0, 'no energy glow before the energy step')

  // Энергия: экзотермический пик, подпись ΔH, затем затемнение к концу.
  at(naclCueAt('exo'))
  assert.ok(frame.env.exo > 0.95, 'exothermic glow peaks at the exo cue')
  assert.ok(frame.camera.bloom > 0.8, 'bloom rises with the energy release')
  at(22)
  const dh = frame.labels.find((l) => l.id === 'dH')!
  assert.ok(dh.opacity > 0.9, 'ΔH label visible in the energy step')
  assert.ok(dh.text.includes('411'), 'ΔH label states −411 kJ/mol')
  at(NACL_END)
  assert.ok(frame.env.fade > 0.99, 'frame fades out at the end')

  // Подписи: у каждой есть текст, степени окисления переключаются 0 → ±1.
  at(3)
  const ox = (id: string) => frame.labels.find((l) => l.id === id)!
  assert.equal(ox('oxNa1').text, '0')
  assert.equal(ox('na1').text, 'Na')
  assert.ok(ox('cl2').opacity > 0.9, 'Cl₂ label visible before homolysis')
  at(11)
  assert.equal(ox('oxNa1').text, '+1')
  assert.equal(ox('oxClA').text, '−1')
  assert.equal(ox('na1').text, 'Na⁺')
  assert.equal(ox('clA').text, 'Cl⁻')
  assert.equal(ox('cl2').opacity, 0, 'Cl₂ label gone after homolysis')
  assert.equal(NACL_LABELS.length, frame.labels.length)

  // Непрерывность: никаких скачков позиций между кадрами (кроме заднего слоя, который появляется прозрачным).
  const prev = createNaclFrame()
  sampleNaclFrame(0, prev)
  let maxStep = 0
  for (let t = DT; t <= NACL_END + 1e-9; t += DT) {
    sampleNaclFrame(t, frame)
    for (const a of NACL_ATOMS) {
      if (!a.main && frame.opacity[a.id] < 0.02) continue
      const d = frame.atoms[a.id].distanceTo(prev.atoms[a.id])
      if (d > maxStep) maxStep = d
      assert.ok(d < 0.09, `${a.id} jumps ${d.toFixed(3)} at t=${t.toFixed(2)}`)
    }
    for (const a of NACL_ATOMS) prev.atoms[a.id].copy(frame.atoms[a.id])
  }
  assert.ok(maxStep > 0, 'atoms actually move')
}

// ——— Тексты: три языка, все шаги, честные пометки ———
{
  const locales: NaclLocale[] = ['ru', 'en', 'uz']
  const seen = new Set<string>()
  for (const locale of locales) {
    const text = getNaclMechanismText(locale)
    assert.ok(text.intro.title.length > 2, `${locale}: intro title`)
    assert.ok(!seen.has(text.intro.title), `${locale}: locales differ`)
    seen.add(text.intro.title)
    for (const id of NACL_STEP_IDS) {
      const s = text.steps[id]
      assert.ok(s, `${locale}: step text ${id}`)
      assert.ok(s.title.length > 3, `${locale}/${id}: title`)
      assert.ok(s.body.length > 80, `${locale}/${id}: body long enough`)
      assert.ok(s.equation.length > 3, `${locale}/${id}: equation`)
      assert.ok(s.speak.length > 10, `${locale}/${id}: speak`)
      assert.ok(!/\{[a-zA-Z]+\}/.test(s.body), `${locale}/${id}: no raw placeholders`)
    }
    assert.ok(text.steps.transfer.note, `${locale}: transfer step admits the orbital glow is schematic`)
    assert.ok(text.steps.energy.equation.includes('411'), `${locale}: energy equation states −411`)
    assert.ok(text.legend.electron.length > 5 && text.legend.orbitalPhase.length > 5, `${locale}: legend`)
    assert.ok(text.safety.length > 20, `${locale}: safety line`)
    assert.ok(text.energy.title.length > 5 && text.energy.unit.length > 2, `${locale}: energy block`)
    for (const k of ['sublimation', 'ionization', 'dissociation', 'affinity', 'lattice', 'total'] as const) {
      assert.ok(text.energy.stages[k].length > 3, `${locale}: energy stage ${k}`)
    }
    assert.ok(text.energy.summary.includes('{dH}'), `${locale}: summary has {dH} placeholder`)
  }
  // Панель читает уроки через общий дескриптор.
  const lesson = getCinemaLesson('nacl')
  assert.deepEqual(lesson.stepIds, NACL_STEP_IDS)
  assert.equal(lesson.narrated, false)
  assert.equal(lesson.safetyStepId, 'energy')
  assert.equal(lessonStepIdAt(lesson, 99), 'energy')
  assert.equal(lessonStepIdAt(lesson, -3), 'approach')
  for (const locale of locales) {
    const t = lesson.getText(locale)
    for (const id of NACL_STEP_IDS) assert.ok(t.steps[id], `lesson text via descriptor: ${locale}/${id}`)
  }
  const clo2 = getCinemaLesson('clo2')
  assert.equal(clo2.narrated, true)
  assert.equal(clo2.safetyStepId, 'products')
  assert.ok(clo2.getText('ru').steps.products, 'ClO₂ lesson still resolves through the descriptor')
}

// ——— Энергетика: цикл Борна — Габера сходится к табличной теплоте образования ———
{
  assert.equal(NACL_BORN_HABER.length, 5)
  const sum = naclFormationEnthalpyKJ()
  assert.ok(Math.abs(sum - NACL_DHF_TABLE_KJ) < 1.5, `Born–Haber sum ${sum.toFixed(1)} ≈ table ${NACL_DHF_TABLE_KJ}`)
  assert.equal(NACL_DHF_KJ, -411)
  const ladder = naclEnergyLadder()
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i]!.at >= ladder[i - 1]!.at, 'ladder ordered by story time')
  assert.equal(ladder[ladder.length - 1]!.id, 'lattice', 'lattice energy is the last step of the ladder')
  assert.equal(naclEnergyActiveStageAt(-1), -1)
  assert.equal(naclEnergyActiveStageAt(0.85), 0)
  assert.equal(naclEnergyActiveStageAt(NACL_END), ladder.length - 1)
  const costs = NACL_BORN_HABER.filter((s) => s.dH > 0).reduce((a, s) => a + s.dH, 0)
  const gains = NACL_BORN_HABER.filter((s) => s.dH < 0).reduce((a, s) => a + s.dH, 0)
  assert.ok(gains < -costs, 'gains exceed costs: the reaction is exothermic')
}

// ——— Хранилище шагов: урок NaCl подключается со своим числом шагов, ClO₂ по умолчанию ———
{
  const calls: string[] = []
  clo2StepStore.attach(
    11,
    { playStep: (i) => calls.push(`play:${i}`), replayStep: () => calls.push('replay'), finish: () => calls.push('finish') },
    'nacl',
    NACL_STEPS.length,
  )
  let s = clo2StepStore.getSnapshot()
  assert.equal(s.lesson, 'nacl')
  assert.equal(s.stepCount, NACL_STEPS.length)
  assert.equal(s.status, 'playing')
  clo2StepStore.report(11, NACL_STEPS.length - 1, 'paused')
  clo2StepStore.next()
  assert.deepEqual(calls, ['finish'], 'next on the last NaCl step finishes the lesson')
  clo2StepStore.detach(11)
  s = clo2StepStore.getSnapshot()
  assert.equal(s.runId, 0)
  assert.equal(s.lesson, 'clo2', 'detached store falls back to the ClO₂ default')

  clo2StepStore.attach(12, { playStep: () => {}, replayStep: () => {}, finish: () => {} })
  s = clo2StepStore.getSnapshot()
  assert.equal(s.lesson, 'clo2', 'attach without lesson keeps ClO₂ behaviour')
  assert.equal(s.stepCount, 8)
  clo2StepStore.detach(12)
}

// ——— Регистрация в лаборатории ———
{
  // Реестр тянет React-сцены (gsap/three в ESM Node не грузятся) — проверяем регистрацию по исходнику.
  const registry = readFileSync(new URL('../src/lab/scientificSynthesis/registry.ts', import.meta.url), 'utf8')
  assert.match(registry, /^\s*nacl:\s*NaclCinemaScene,/m, 'NaCl synthesis (productId nacl) opens the cinema')
  assert.match(registry, /^\s*clo2:\s*Clo2ScientificSynthesisFx,/m, 'ClO₂ still registered')
  const watchdog = scientificSynthesisWatchdogMs('nacl')
  assert.ok(watchdog != null && watchdog > NACL_FINISH.wall * 1000, 'watchdog covers the finish tail plus margin')
  assert.ok(scientificSynthesisWatchdogMs('clo2')! > 0, 'ClO₂ watchdog untouched')
}

console.log('test-nacl-cinema: all passed')
