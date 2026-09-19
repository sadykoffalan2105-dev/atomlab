#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «горение угля: C (графит) + O₂ (г.) → CO₂ (г.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleCo2Frame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с и ни один не проваливается
 *     внутрь соседа;
 *   • химия: углерод стартует ГРАФИТОМ (2 слоя, соты, КЧ 3, C–C 141,8 пм,
 *     межслоевое 335 пм), кислород — МОЛЕКУЛОЙ O₂ 120,8 пм;
 *   • продукт: линейная O=C=O, угол ровно 180°, обе связи ровно 116,0 пм,
 *     промежуточная частица угловая (155°), μ = 0 Д при Δχ = 0,89;
 *   • угарный газ: связь C≡O короче и прочнее, чем C=O в CO₂;
 *   • энергия: сумма цикла Гесса = табличная ΔH°f = −393,5 кДж/моль, знаки верные,
 *     оценка по средним энергиям связей расходится на ожидаемые ≈ 10 кДж;
 *   • стехиометрия обоих показанных уравнений и электронный/зарядовый баланс;
 *   • подписи: только токены кита, локализуются в ru/en/uz без остатка;
 *   • тексты есть в ru / en / uz для каждого шага.
 *
 * Запуск: npx tsx scripts/test-co2-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  BACKGROUND_O2,
  BREAKING_BONDS,
  CO2_ATOMS,
  CO2_BENT_ANGLE_DEG,
  CO2_CUES,
  CO2_END,
  CO2_GEOM,
  CO2_LABELS,
  CO2_SEGMENTS,
  CO2_STEPS,
  CO2_STEP_IDS,
  CO2_TIMING,
  GRAPHITE_BONDS,
  createCo2Frame,
  sampleCo2Frame,
  validateCo2Storyboard,
  type Co2AtomId,
} from '../src/lab/cinema/scenes/co2/co2Storyboard.ts'
import {
  CO2_BOND_ESTIMATE_GAP_KJ,
  CO2_BOND_EXACT_KJ,
  CO2_BOND_GAIN_KJ,
  CO2_BOND_TABLE_KJ,
  CO2_COST_KJ,
  CO2_DHF_KJ,
  CO2_DHF_TABLE_KJ,
  CO2_DH_FROM_BONDS_KJ,
  CO2_FACTS,
  CO2_HALF_REACTIONS,
  CO2_LADDER,
  CO2_REACTION,
  CO_DHF_KJ,
  CO_REACTION,
  CO_REACTION_DH_KJ,
  validateCo2Energetics,
} from '../src/lab/cinema/scenes/co2/co2Energetics.ts'
import { getCo2MechanismText, type Co2Locale } from '../src/lab/cinema/scenes/co2/co2MechanismText.ts'

const LOCALES: Co2Locale[] = ['ru', 'en', 'uz']
const frame = createCo2Frame()
const at = (t: number) => sampleCo2Frame(t, frame)
const cue = (id: string) => CO2_TIMING.cueAt(id as Parameters<typeof CO2_TIMING.cueAt>[0])

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

CO2_TIMING.validate()
ok('шагов 6 ± 1', CO2_STEPS.length >= 5 && CO2_STEPS.length <= 7, `${CO2_STEPS.length}`)
ok('id шагов совпадают', CO2_STEP_IDS.join(',') === CO2_STEPS.map((s) => s.id).join(','))

const wall = storyWallDuration(CO2_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)

let prevTo = 0
for (const s of CO2_STEPS) {
  ok(`шаг ${s.id} непрерывен`, s.from === prevTo && s.to > s.from)
  ok(`шаг ${s.id} имеет экранное время`, s.wall > 0)
  prevTo = s.to
}

let prevCue = -Infinity
for (const c of CO2_CUES) {
  ok(`cue ${c.id} внутри сюжета`, c.at >= 0 && c.at <= CO2_END, `${c.at}`)
  ok(`cue ${c.id} по возрастанию`, c.at >= prevCue)
  prevCue = c.at
}
const cueIndex = (id: string) => CO2_CUES.findIndex((c) => c.id === id)
ok('контракт лаборатории embryo → birth → complete', cueIndex('embryo') < cueIndex('birth') && cueIndex('birth') < cueIndex('complete'))
ok('complete совпадает с концом сюжета', CO2_CUES[cueIndex('complete')]!.at === CO2_END)

// Каждый сюжетный cue обязан лежать внутри «своего» шага — иначе пошаговый
// режим покажет событие не на том экране урока.
const stepOf = (t: number) => CO2_STEPS[CO2_TIMING.stepIndexAt(t)]!.id
ok('ignite на шаге «реагенты»', stepOf(cue('ignite')) === 'reactants')
ok('detach на шаге «атом покидает слой»', stepOf(cue('detach')) === 'erosion')
ok('o2Break и bond1 на шаге «первая связь»', stepOf(cue('o2Break')) === 'firstBond' && stepOf(cue('bond1')) === 'firstBond')
ok('bond2 и linear на шаге «выпрямление»', stepOf(cue('bond2')) === 'linear' && stepOf(cue('linear')) === 'linear')
ok('dipole на шаге «полярность»', stepOf(cue('dipole')) === 'polarity')
ok('exo и coWarn на шаге «энергия»', stepOf(cue('exo')) === 'energy' && stepOf(cue('coWarn')) === 'energy')

for (let i = 0; i < CO2_STEPS.length; i++) {
  const s = CO2_STEPS[i]!
  ok(`stepIndexAt(${s.id})`, CO2_TIMING.stepIndexAt((s.from + s.to) / 2) === i)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки, отсутствие рывков и провалов друг в друга
// ─────────────────────────────────────────────────────────────────────────────

validateCo2Storyboard()

const scratch = createCo2Frame()
const buf = CO2_ATOMS.map((a) => ({ id: a.id as string, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps(
  (t) => {
    sampleCo2Frame(t, scratch)
    for (let i = 0; i < CO2_ATOMS.length; i++) {
      const id = CO2_ATOMS[i]!.id
      buf[i]!.pos.copy(scratch.atoms[id])
      buf[i]!.opacity = scratch.opacity[id]
    }
    return buf
  },
  CO2_END,
  0.09,
  1 / 30,
)
checks++

// Фоновые молекулы кислорода тоже не должны дёргаться.
{
  const prev = BACKGROUND_O2.flatMap(() => [new THREE.Vector3(), new THREE.Vector3()])
  let started = false
  let worst = 0
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    at(t)
    for (let k = 0; k < prev.length; k++) {
      if (started) worst = Math.max(worst, prev[k]!.distanceTo(frame.bg.pos[k]!))
      prev[k]!.copy(frame.bg.pos[k]!)
    }
    started = true
  }
  ok('фоновые молекулы O₂ дрейфуют плавно', worst <= 0.09, worst.toFixed(4))
}

// Два видимых атома не проваливаются друг в друга: центры не ближе 0.78 суммы
// радиусов. Связанные пары дальше (C–C 0.404 против 0.312, C=O 0.331 против 0.291).
{
  let worst = Infinity
  let where = ''
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    at(t)
    const vis = CO2_ATOMS.filter((a) => frame.opacity[a.id] > 0.05)
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i]!.id
        const b = vis[j]!.id
        const ratio = frame.atoms[a].distanceTo(frame.atoms[b]) / (frame.radius[a] + frame.radius[b])
        if (ratio < worst) {
          worst = ratio
          where = `${a}–${b} при t=${t.toFixed(2)}`
        }
      }
    }
  }
  ok('атомы нигде не проваливаются друг в друга', worst >= 0.78, `худшая пара ${where}, отношение ${worst.toFixed(3)}`)
}

// Радиус и прозрачность не щёлкают.
{
  let prev: Record<string, { r: number; o: number }> | null = null
  for (let t = 0; t <= CO2_END + 1e-9; t += 1 / 30) {
    at(t)
    const now: Record<string, { r: number; o: number }> = {}
    for (const a of CO2_ATOMS) now[a.id] = { r: frame.radius[a.id], o: frame.opacity[a.id] }
    if (prev) {
      for (const a of CO2_ATOMS) {
        ok(`радиус ${a.id} без скачка при t=${t.toFixed(2)}`, Math.abs(now[a.id]!.r - prev[a.id]!.r) <= 0.02)
        ok(`прозрачность ${a.id} без скачка при t=${t.toFixed(2)}`, Math.abs(now[a.id]!.o - prev[a.id]!.o) <= 0.12)
      }
    }
    prev = now
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Химия кадра
// ─────────────────────────────────────────────────────────────────────────────

// 3.1 Справочник графита — из crystalData, не руками.
ok('графит P6₃/mmc (194)', CO2_FACTS.graphite.spaceGroup === 'P6₃/mmc' && CO2_FACTS.graphite.spaceGroupNo === 194)
ok('решётка гексагональная', CO2_FACTS.graphite.latticeType === 'гексагональная')
ok('C–C в слое 141.8 пм', CO2_FACTS.graphite.ccPm === 141.8)
ok('между слоями 335.45 пм = c/2', Math.abs(CO2_FACTS.graphite.layerPm - CO2_FACTS.graphite.cellCPm / 2) < 1e-6)
ok('КЧ углерода в слое 3', CO2_FACTS.graphite.coordination === 3)
ok('a = 246.12 пм', CO2_FACTS.graphite.cellAPm === 246.12)

// 3.2 Фрагмент графита: два слоя сот, КЧ 3 внутри слоя, слои НЕ связаны.
{
  const lattice = CO2_ATOMS.filter((a) => /^[GB]\d+$/.test(a.id))
  ok('во фрагменте 47 атомов решётки + реагирующий = 48', lattice.length === 47)
  ok('все атомы фрагмента — углерод', lattice.every((a) => a.el === 'C'))
  ok('58 связей C–C остаются после ухода атома', GRAPHITE_BONDS.length === 58)
  ok('реагирующий атом держался на двух связях', BREAKING_BONDS.length === 2)
  ok('рвущиеся связи выходят из c0', BREAKING_BONDS.every(([a]) => a === 'c0'))
  // Ни одна связь не соединяет верхний слой с нижним: слои держит только
  // ван-дер-ваальсово притяжение, и это принципиально для графита.
  const layerOf = (id: Co2AtomId) => (id === 'c0' ? 0 : id.startsWith('G') ? 0 : id.startsWith('B') ? 1 : -1)
  for (const [a, b] of [...GRAPHITE_BONDS, ...BREAKING_BONDS]) {
    ok(`связь ${a}–${b} внутри одного слоя`, layerOf(a) === layerOf(b))
  }
}

at(1.0)
{
  // Длины связей в слое — ровно справочные 141.8 пм.
  for (const [a, b] of GRAPHITE_BONDS) {
    const d = frame.atoms[a].distanceTo(frame.atoms[b])
    ok(`связь ${a}–${b} = 141.8 пм`, Math.abs(d - CO2_GEOM.ccScene) < 1e-6, d.toFixed(5))
  }
  for (const [a, b] of BREAKING_BONDS) {
    const d = frame.atoms[a].distanceTo(frame.atoms[b])
    ok(`краевая связь ${a}–${b} = 141.8 пм`, Math.abs(d - CO2_GEOM.ccScene) < 1e-6)
  }
  ok('фрагмент графита виден на старте', frame.graphite.opacity > 0.9 && frame.opacity.c0 > 0.9)
  ok('на старте молекула CO₂ ещё не собрана', frame.coBond.opacityA === 0 && frame.coBond.opacityB === 0)
  ok('на старте предупреждения про CO нет', frame.coWarn === 0)
}

// 3.3 Кислород стартует ДВУХАТОМНОЙ молекулой с настоящей длиной связи.
at(2.0)
{
  const d = frame.atoms.oA.distanceTo(frame.atoms.oB)
  ok('на старте O₂ — молекула с длиной связи 120.8 пм', Math.abs(d - CO2_GEOM.ooScene) < 1e-6, d.toFixed(5))
  ok('связь O=O видна', frame.o2Bond.opacity > 0.9)
  ok('фоновые молекулы кислорода тоже двухатомные', frame.bg.pos.length === BACKGROUND_O2.length * 2)
  for (let k = 0; k < BACKGROUND_O2.length; k++) {
    const len = frame.bg.pos[k * 2]!.distanceTo(frame.bg.pos[k * 2 + 1]!)
    ok(`фоновая O₂ №${k + 1} = 120.8 пм`, Math.abs(len - CO2_GEOM.ooScene) < 1e-6, len.toFixed(5))
  }
  ok('слева нет одиночных атомов кислорода', !CO2_REACTION.left.some((t) => t.formula === 'O'))
}

// 3.4 Связь O=O рвётся ГОМОЛИТИЧЕСКИ: оба атома остаются нейтральными.
at(cue('o2Break') + 0.5)
ok('после разрыва связь O=O гаснет', frame.o2Bond.opacity < 0.5)
ok('разрыв симметричный: оба атома кислорода нейтральны', frame.charge.oA === 0 && frame.charge.oB === 0)
ok('ионов в ковалентной реакции не возникает', CO2_ATOMS.every((a) => Math.abs(frame.charge[a.id]) < 1e-9))

// 3.5 Атом покинул слой: краевые связи погасли, атом виден.
at(cue('detach') + 0.6)
ok('краевые связи разорваны', frame.edgeBond.opacity < 0.5)
ok('ушедший атом виден', frame.opacity.c0 > 0.9)
{
  const home = frame.atoms.c0.clone()
  at(0.5)
  ok('атом действительно сдвинулся из узла решётки', home.distanceTo(frame.atoms.c0) > 0.1)
}

// 3.6 Первая связь C=O — ровно 116.0 пм.
at(cue('bond1') + 0.4)
{
  const d = frame.atoms.c0.distanceTo(frame.atoms.oA)
  ok('первая связь C=O = 116.0 пм', Math.abs(d - CO2_GEOM.coScene) < 1e-6, d.toFixed(5))
  ok('связь нарисована', frame.coBond.opacityA > 0.5)
  ok('вторая связь ещё не замкнута', frame.coBond.opacityB < 0.5)
}

// 3.7 Промежуточная частица УГЛОВАЯ, готовая молекула — ЛИНЕЙНАЯ.
const angleAt = (t: number): number => {
  at(t)
  const a = frame.atoms.oA.clone().sub(frame.atoms.c0).normalize()
  const b = frame.atoms.oB.clone().sub(frame.atoms.c0).normalize()
  return (Math.acos(Math.min(1, Math.max(-1, a.dot(b)))) * 180) / Math.PI
}
{
  const bent = angleAt(cue('bond2') + 0.4)
  ok('сразу после второй связи частица УГЛОВАЯ (≈155°)', Math.abs(bent - CO2_BENT_ANGLE_DEG) < 1.5, `${bent.toFixed(1)}°`)
  const linear = angleAt(cue('linear') + 0.2)
  ok('молекула выпрямилась ровно в 180°', Math.abs(linear - CO2_FACTS.angleDeg) < 0.2, `${linear.toFixed(2)}°`)
  const end = angleAt(CO2_END - 0.4)
  ok('к концу сюжета молекула остаётся линейной', Math.abs(end - 180) < 0.2, `${end.toFixed(2)}°`)
  ok('угол растёт, а не скачет', bent < linear)
}

// Обе связи всё время после замыкания держат СПРАВОЧНУЮ длину 116.0 пм.
for (let t = cue('bond2') + 0.5; t <= CO2_END; t += 0.25) {
  at(t)
  const dA = frame.atoms.c0.distanceTo(frame.atoms.oA)
  const dB = frame.atoms.c0.distanceTo(frame.atoms.oB)
  ok(`C=O(A) = 116.0 пм при t=${t.toFixed(2)}`, Math.abs(dA - CO2_GEOM.coScene) < 1e-6)
  ok(`C=O(B) = 116.0 пм при t=${t.toFixed(2)}`, Math.abs(dB - CO2_GEOM.coScene) < 1e-6)
}

// 3.8 Полярность: δ+ на углероде, δ− на кислородах, а молекула симметрична.
at(cue('dipole') + 0.2)
ok('на углероде δ+', frame.charge.c0 > 0.3)
ok('на кислородах δ−', frame.charge.oA < -0.2 && frame.charge.oB < -0.2)
ok('частичные заряды НЕ целые: это не ионы', Math.abs(frame.charge.c0) < 1 && Math.abs(frame.charge.oA) < 1)
ok('оба кислорода заряжены одинаково — молекула симметрична', Math.abs(frame.charge.oA - frame.charge.oB) < 1e-9)
ok('стрелки диполей включены', frame.dipole > 0.8)
{
  // Векторная сумма двух диполей связей строго ноль: длины равны, направления встречны.
  const a = frame.atoms.oA.clone().sub(frame.atoms.c0)
  const b = frame.atoms.oB.clone().sub(frame.atoms.c0)
  ok('векторная сумма диполей связей = 0', a.clone().add(b).length() < 1e-6, a.clone().add(b).length().toExponential(1))
  ok('справочный дипольный момент CO₂ = 0 Д', CO2_FACTS.dipoleD === 0)
  ok('связь при этом полярна: Δχ(O − C) = 0.89', Math.abs(CO2_FACTS.deltaChi - 0.89) < 1e-9)
}
ok('камео воды показано на шаге полярности', frame.water > 0.5)
at(cue('dipole') + 0.2)
{
  // Вода нарисована настоящей: угол H–O–H 104.45°, связи O–H справочной длины.
  const h1 = frame.atoms.wH1.clone().sub(frame.atoms.wO)
  const h2 = frame.atoms.wH2.clone().sub(frame.atoms.wO)
  const ang = (Math.acos(Math.min(1, Math.max(-1, h1.clone().normalize().dot(h2.clone().normalize())))) * 180) / Math.PI
  ok('угол H–O–H = 104.45°', Math.abs(ang - 104.45) < 0.05, `${ang.toFixed(2)}°`)
  ok('связи O–H одинаковой длины', Math.abs(h1.length() - h2.length()) < 1e-9)
}

// 3.9 Угарный газ: C≡O короче и прочнее, чем C=O в CO₂.
at(cue('coWarn') + 0.8)
{
  const d = frame.atoms.coC.distanceTo(frame.atoms.coO)
  ok('предупреждение про CO показано', frame.coWarn > 0.5 && frame.opacity.coC > 0.5)
  ok('длина C≡O = 112.8 пм из справочника', Math.abs(d - (CO2_GEOM.coScene * CO2_FACTS.coTriplePm) / CO2_FACTS.coPm) < 1e-6, d.toFixed(5))
  ok('C≡O короче C=O', CO2_FACTS.coTriplePm < CO2_FACTS.coPm)
  ok('C≡O прочнее C=O', CO2_FACTS.coTripleKJ > CO2_BOND_TABLE_KJ)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Энергия: цикл Гесса
// ─────────────────────────────────────────────────────────────────────────────

validateCo2Energetics()
ok('сумма цикла = табличная ΔH°f', Math.abs(CO2_DHF_KJ - CO2_DHF_TABLE_KJ) < 1e-9, `${CO2_DHF_KJ} против ${CO2_DHF_TABLE_KJ}`)
ok('образование CO₂ экзотермично', CO2_DHF_KJ < 0)
ok('ступеней ровно три', CO2_LADDER.stages.length === 3)
ok('ступени идут по времени сюжета', CO2_LADDER.stages.every((s, i, all) => i === 0 || s.at >= all[i - 1]!.at))
for (const s of CO2_LADDER.stages) {
  ok(`ступень ${s.id} внутри сюжета`, s.at >= 0 && s.at <= CO2_END, `${s.at}`)
  ok(`ступень ${s.id} с уравнением`, s.equation.trim().length > 0)
}
ok('атомизация и диссоциация — вверх (затраты)', CO2_LADDER.stages.filter((s) => s.dH > 0).length === 2)
ok('образование связей — вниз (выигрыш)', CO2_LADDER.stages.filter((s) => s.dH < 0).length === 1)
ok('затраты +1215.1 кДж/моль', Math.abs(CO2_COST_KJ - 1215.1) < 0.05, `${CO2_COST_KJ}`)
ok('выигрыш на связях больше затрат по модулю', Math.abs(CO2_BOND_GAIN_KJ) > CO2_COST_KJ)
{
  const levels = ladderLevels(CO2_LADDER)
  ok('лестница стартует с нуля', levels[0] === 0)
  ok('лестница заканчивается на ΔH°f', Math.abs(levels[levels.length - 1]! - CO2_DHF_TABLE_KJ) < 1e-9)
  ok('до образования связей процесс ещё эндотермический', levels[2]! > 0, `${levels[2]!.toFixed(1)}`)
}
// Честный вывод урока: по средним энергиям связей ответ хуже, и мы знаем насколько.
ok('оценка по средним связям = −383.3 кДж/моль', Math.abs(CO2_DH_FROM_BONDS_KJ + 383.3) < 0.05, `${CO2_DH_FROM_BONDS_KJ}`)
ok('расхождение оценки ≈ 10 кДж/моль', Math.abs(CO2_BOND_ESTIMATE_GAP_KJ - 10.2) < 0.2, `${CO2_BOND_ESTIMATE_GAP_KJ}`)
ok('настоящая связь C=O в CO₂ = 804.3 кДж/моль', Math.abs(CO2_BOND_EXACT_KJ - 804.3) < 0.05, `${CO2_BOND_EXACT_KJ}`)
ok('справочная средняя C=O(CO₂) = 799 кДж/моль', CO2_BOND_TABLE_KJ === 799)
ok('в самой CO₂ связь прочнее средней табличной', CO2_BOND_EXACT_KJ > CO2_BOND_TABLE_KJ)
// Ветка неполного сгорания.
ok('ΔH°f(CO) = −110.5 кДж/моль', CO_DHF_KJ === -110.5)
ok('на моль углерода полное сгорание даёт больше тепла', CO2_DHF_KJ < CO_DHF_KJ)
ok('2 C + O₂ → 2 CO даёт −221 кДж', Math.abs(CO_REACTION_DH_KJ + 221) < 1e-9, `${CO_REACTION_DH_KJ}`)

// ─────────────────────────────────────────────────────────────────────────────
// 5. Стехиометрия и электронный баланс
// ─────────────────────────────────────────────────────────────────────────────

/** Разбирает «CO2» / «O2» / «C» в состав по элементам. */
function composition(formula: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!m[1]) continue
    out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1)
  }
  return out
}

for (const [name, reaction] of [
  ['C + O₂ → CO₂', CO2_REACTION],
  ['2 C + O₂ → 2 CO', CO_REACTION],
] as const) {
  const side = (terms: readonly { formula: string; coeff: number }[]) => {
    const acc: Record<string, number> = {}
    for (const t of terms) {
      for (const [el, n] of Object.entries(composition(t.formula))) acc[el] = (acc[el] ?? 0) + n * t.coeff
    }
    return acc
  }
  const left = side(reaction.left)
  const right = side(reaction.right)
  ok(`${name}: одинаковый набор элементов`, Object.keys(left).sort().join() === Object.keys(right).sort().join())
  for (const el of Object.keys(left)) ok(`${name}: баланс по ${el}`, left[el] === right[el], `${left[el]} против ${right[el]}`)
  ok(`${name}: кислород взят МОЛЕКУЛОЙ O₂`, reaction.left.some((t) => t.formula === 'O2'))
  ok(`${name}: углерод взят простым веществом C`, reaction.left.some((t) => t.formula === 'C'))
}

{
  const given = CO2_HALF_REACTIONS.filter((h) => h.id === 'oxidation').reduce((s, h) => s + h.electrons * h.times, 0)
  const taken = CO2_HALF_REACTIONS.filter((h) => h.id === 'reduction').reduce((s, h) => s + h.electrons * h.times, 0)
  ok('электронный баланс полуреакций', given === taken && given === 4, `отдано ${given}, принято ${taken}`)
  const chargeLeft = CO2_HALF_REACTIONS.reduce((s, h) => s + h.chargeLeft * h.times, 0)
  const chargeRight = CO2_HALF_REACTIONS.reduce((s, h) => s + h.chargeRight * h.times, 0)
  ok('зарядовый баланс суммарного уравнения', chargeLeft === 0 && chargeRight === 0)
  ok('кислород восстанавливается МОЛЕКУЛОЙ, а не атомом', CO2_HALF_REACTIONS.some((h) => h.equation.includes('O₂⁰')))
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Подписи в 3D и тексты ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

{
  const o2 = CO2_LABELS.find((l) => l.id === 'o2')!
  ok('подпись O₂ видна до разрыва связи', o2.windows[0]![1] <= cue('o2Break'))
  const oFree = CO2_LABELS.find((l) => l.id === 'oAfree')!
  ok('подпись отдельного O появляется только после разрыва', oFree.windows[0]![0] >= cue('o2Break'))
  const mol = CO2_LABELS.find((l) => l.id === 'mol')!
  ok('подпись O=C=O появляется не раньше выпрямления', mol.windows[0]![0] >= cue('linear') - 0.5)
  const coWarn = CO2_LABELS.find((l) => l.id === 'coWarn')!
  ok('предупреждение про CO — только на шаге энергии', coWarn.windows[0]![0] >= CO2_TIMING.stepById('energy').from)
  for (const l of CO2_LABELS) {
    for (const w of l.windows) ok(`окно подписи ${l.id} корректно`, w[0] < w[1] && w[0] >= 0 && w[1] <= CO2_END + 1e-9)
  }

  // Подписи, висящие на одном якоре и пересекающиеся по времени, разведены по высоте.
  for (let i = 0; i < CO2_LABELS.length; i++) {
    for (let j = i + 1; j < CO2_LABELS.length; j++) {
      const a = CO2_LABELS[i]!
      const b = CO2_LABELS[j]!
      if (a.anchor !== b.anchor) continue
      const overlap = a.windows.some((wa) => b.windows.some((wb) => wa[0] < wb[1] - 0.2 && wb[0] < wa[1] - 0.2))
      if (!overlap) continue
      ok(`подписи ${a.id} и ${b.id} не налезают друг на друга`, Math.abs(a.dy - b.dy) >= 0.42, `Δdy = ${Math.abs(a.dy - b.dy).toFixed(2)}`)
    }
  }

  // Подписи локализуются: раскадровка пишет токены, сцена подставляет язык.
  const known = new Set(Object.keys(SCENE_LABEL_TOKENS.ru))
  for (const token of labelTokensUsed(CO2_LABELS)) {
    ok(`токен подписи {${token}} есть в словаре кита`, known.has(token))
  }
  // Единицы и состояния НЕ зашиты по-английски мимо токенов.
  for (const l of CO2_LABELS) {
    for (const k of l.keys) {
      const bare = k.text.replace(/\{\w+\}/g, '')
      ok(
        `подпись ${l.id} без зашитой английской единицы: «${k.text}»`,
        !/\b(pm|kJ\/mol|kJ)\b/.test(bare) && !/\((s|g|l|aq)\)/.test(bare),
      )
    }
  }
  for (const locale of LOCALES) {
    const states = createLabelStates(CO2_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) {
      ok(`[${locale}] подпись ${st.id} без нераскрытых токенов: «${st.text}»`, !/\{\w+\}/.test(st.text))
      ok(`[${locale}] подпись ${st.id} непустая`, st.text.trim().length > 0)
    }
  }
  const ru = createLabelStates(CO2_LABELS)
  const en = createLabelStates(CO2_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok(
    'подписи ru отличаются от en (состояния и единицы переведены)',
    ru.some((s, i) => s.text !== en[i]!.text),
  )
  const ruCc = ru.find((s) => s.id === 'cc')!.text
  ok(`подпись C–C по-русски в пикометрах: «${ruCc}»`, ruCc.includes('пм') && !ruCc.includes('pm'))
  const ruDh = ru.find((s) => s.id === 'dH')!.text
  ok(`подпись ΔH°f по-русски: «${ruDh}»`, ruDh.includes('кДж/моль') && ruDh.includes('−393.5'))
}

for (const locale of LOCALES) {
  const text = getCo2MechanismText(locale)
  ok(`[${locale}] есть заголовок урока`, text.intro.title.length > 0)
  ok(`[${locale}] есть предупреждение о безопасности`, text.safety.length > 20)
  ok(`[${locale}] предупреждение говорит про угарный газ`, /CO|is gazi/.test(text.safety))
  for (const id of CO2_STEP_IDS) {
    const s = text.steps[id]
    ok(`[${locale}] шаг ${id}: заголовок`, !!s && s.title.trim().length > 0)
    ok(`[${locale}] шаг ${id}: 2–4 предложения`, s.body.split(/[.!?]\s/).length >= 2, `${s.body.length} симв.`)
    ok(`[${locale}] шаг ${id}: уравнение`, s.equation.trim().length > 0)
    ok(`[${locale}] шаг ${id}: реплика`, s.speak.trim().length > 0)
  }
  ok(`[${locale}] честная пометка есть у каждого шага`, CO2_STEP_IDS.every((id) => !!text.steps[id].note))
  for (const s of CO2_LADDER.stages) {
    ok(`[${locale}] подпись ступени ${s.id}`, (text.energy.stages as Record<string, string>)[s.id]?.length > 0)
  }
  ok(`[${locale}] единица энергии`, text.energy.unit.length > 0)
  ok(`[${locale}] итоговая строка лестницы`, text.energy.stages.total.length > 0)
  ok(`[${locale}] aria-подпись лестницы`, text.energy.summary.includes('{dH}'))
  ok(`[${locale}] сказано, что свободный атом C — ступень расчёта, а не механизм`, /Гесс|Hess|Gess/.test(text.steps.erosion.note!))
  ok(`[${locale}] сказано, что орбитали нарисованы схематично`, text.steps.linear.note!.length > 40)
  ok(`[${locale}] нет выдуманных частиц в текстах`, !/C⁴⁺ \(/.test(JSON.stringify(text)))
}

console.log(`✓ co2 cinema: ${checks} проверок пройдено`)
console.log(`  шагов ${CO2_STEPS.length}, экранное время ${wall.toFixed(1)} с, сюжет ${CO2_END} с`)
console.log(`  фрагмент графита: 2 слоя × 24 атома, ${GRAPHITE_BONDS.length + BREAKING_BONDS.length} связей C–C, C–C ${CO2_FACTS.graphite.ccPm} пм, между слоями ${CO2_FACTS.graphite.layerPm} пм`)
console.log(`  продукт: O=C=O, ${CO2_FACTS.angleDeg}°, C=O ${CO2_FACTS.coPm} пм, μ = ${CO2_FACTS.dipoleD} Д при Δχ = ${CO2_FACTS.deltaChi}`)
console.log(`  цикл Гесса: Σ = ${CO2_DHF_KJ} кДж/моль (таблица ${CO2_DHF_TABLE_KJ}); по средним связям ${CO2_DH_FROM_BONDS_KJ} (разница ${CO2_BOND_ESTIMATE_GAP_KJ})`)
console.log(`  неполное сгорание: 2 C + O₂ → 2 CO, ΔH°f(CO) = ${CO_DHF_KJ} кДж/моль, C≡O ${CO2_FACTS.coTriplePm} пм / ${CO2_FACTS.coTripleKJ} кДж/моль`)
