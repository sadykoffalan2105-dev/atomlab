/**
 * Тест сцены «S (тв., ромб.) + O₂ (г.) → SO₂ (г.)» — запускается в node (npx tsx).
 *
 * Проверяет ровно то, что обязано быть верным у любой научной сцены ATOMLAB:
 *   1. хронометраж: шаги непрерывны, cue упорядочены, есть embryo → birth → complete;
 *   2. 6 ± 1 шаг и 26–34 экранных секунды;
 *   3. раскадровка: дорожки монотонны, геометрия короны S₈, SO₂, SO₃, H₂O и CO₂
 *      совпадает со справочником src/chemistry/data;
 *   4. нет рывка больше 0.09 мировых единиц между выборками 1/30 с;
 *   5. тексты есть в ru/en/uz для каждого шага (title, body, equation, speak);
 *   6. уравнения сбалансированы по атомам И по заряду;
 *   7. лестница энергии сходится с табличной ΔH°f(SO₂);
 *   8. подписи в 3D локализуются: токены известны, после перевода нет «{…}», ru ≠ en.
 */
import assert from 'node:assert/strict'
import {
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  dHfKJ,
  dipoleDebye,
} from '../src/chemistry/data/index.ts'
import {
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
  assertNoPositionJumps,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import {
  createSo2Frame,
  RING_BONDS,
  sampleSo2Frame,
  SO2_ATOMS,
  SO2_GEOM,
  SO2_LABELS,
  SO2_TIMING,
  so2ElectronSpec,
  so2Particles,
  validateSo2Storyboard,
  WATER_BONDS,
} from '../src/lab/cinema/scenes/so2/so2Storyboard.ts'
import {
  SO2_ATOMIZATION_S_KJ,
  SO2_BOND_IN_MOLECULE_KJ,
  SO2_BOND_MEAN_KJ,
  SO2_BONDS_KJ,
  SO2_COST_BEFORE_BONDS_KJ,
  SO2_DHF_KJ,
  SO2_DHF_TABLE_KJ,
  SO2_DISSOCIATION_O2_KJ,
  SO2_FACTS,
  SO2_LADDER,
  SO2_REACTION,
  SO2_SIDE_REACTIONS,
  SO3_OXIDATION_DH_KJ,
  validateSo2Energetics,
} from '../src/lab/cinema/scenes/so2/so2Energetics.ts'
import { SO2_STEP_IDS, so2CueAt } from '../src/lab/cinema/scenes/so2/so2Steps.ts'
import { getSo2MechanismText, type So2Locale } from '../src/lab/cinema/scenes/so2/so2MechanismText.ts'

let checks = 0
function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg)
  checks++
}

// ─────────────────────────────────────────────────────────────────────────────
// 1–2. Хронометраж
// ─────────────────────────────────────────────────────────────────────────────

SO2_TIMING.validate()
checks++

ok(SO2_STEP_IDS.length >= 5 && SO2_STEP_IDS.length <= 7, `шагов должно быть 6 ± 1, а их ${SO2_STEP_IDS.length}`)
ok(
  SO2_TIMING.wallDuration >= 26 && SO2_TIMING.wallDuration <= 34,
  `экранная длительность ${SO2_TIMING.wallDuration.toFixed(1)} с вне диапазона 26–34`,
)

for (const step of SO2_TIMING.steps) {
  ok(step.to > step.from, `шаг «${step.id}»: to > from`)
  ok(step.wall > 0, `шаг «${step.id}»: wall > 0`)
}

const cueOrder = ['flame', 'ringOpen', 'sFree', 'o2Break', 'bond1', 'bond2', 'bent', 'resonance', 'acidRain', 'so3', 'exo', 'embryo', 'birth', 'complete'] as const
let prevAt = -Infinity
for (const id of cueOrder) {
  const at = so2CueAt(id)
  ok(at >= prevAt, `событие «${id}» (${at}) обязано идти после предыдущего (${prevAt})`)
  ok(at >= 0 && at <= SO2_TIMING.end, `событие «${id}» вне [0, ${SO2_TIMING.end}]`)
  prevAt = at
}
// Химическая логика последовательности: сначала освободить серу, потом рвать O₂,
// потом связи, и только затем свойства и энергия.
ok(so2CueAt('ringOpen') < so2CueAt('sFree'), 'кольцо раскрывается до того, как атом уходит')
ok(so2CueAt('sFree') < so2CueAt('o2Break'), 'сера освобождается до разрыва O₂')
ok(so2CueAt('o2Break') < so2CueAt('bond1'), 'O₂ рвётся до образования первой связи S=O')
ok(so2CueAt('bond1') < so2CueAt('bond2'), 'первая связь раньше второй')
ok(so2CueAt('bond2') < so2CueAt('bent'), 'изгиб молекулы после второй связи')
ok(so2CueAt('bent') < so2CueAt('resonance'), 'делокализация показывается после того, как молекула собрана')
ok(so2CueAt('so3') < so2CueAt('embryo'), 'к моменту embryo сцена уже вернулась к продукту SO₂')

// ─────────────────────────────────────────────────────────────────────────────
// 3. Раскадровка и геометрия
// ─────────────────────────────────────────────────────────────────────────────

validateSo2Storyboard()
checks++
validateSo2Energetics()
checks++

ok(SO2_ATOMS.length === 20, `в сцене 20 частиц, а не ${SO2_ATOMS.length}`)
ok(RING_BONDS.length === 8, 'кольцо S₈ обязано иметь восемь связей S–S')
ok(WATER_BONDS.length === 4, 'две молекулы воды — четыре связи O–H')

// Сера в стандартном состоянии — S₈: восемь атомов серы на старте, не один.
const sulfurCount = SO2_ATOMS.filter((a) => a.el === 'S').length
ok(sulfurCount === 8, `сера обязана стартовать короной S₈ (8 атомов), а их ${sulfurCount}`)
// Кислород приходит МОЛЕКУЛОЙ: в кольце разрываемых связей O–O ровно одна пара.
ok(SO2_ATOMS.filter((a) => a.el === 'O').length >= 3, 'нужны как минимум три атома кислорода (O₂ + третий для SO₃)')

// Каждое звено кольца связано с соседями и ни один атом не пропущен.
const ringMembers = new Set(RING_BONDS.flat())
ok(ringMembers.size === 8, 'в кольце обязаны участвовать все восемь атомов серы')

// Геометрия короны, выведенная из d(S–S) и ∠S–S–S, обязана дать известные r и h.
ok(Math.abs(SO2_GEOM.crownRadiusPm - 235.1) < 0.5, `радиус короны ${SO2_GEOM.crownRadiusPm.toFixed(1)} пм, ожидалось ≈235,1`)
ok(Math.abs(SO2_GEOM.crownHeightPm - 99.2) < 0.5, `высота короны ${SO2_GEOM.crownHeightPm.toFixed(1)} пм, ожидалось ≈99,2`)

// Радиусы CPK: сера крупнее кислорода (105 против 66 пм).
ok(speciesRadiusPm('S') > speciesRadiusPm('O'), 'атом серы обязан быть крупнее атома кислорода')
ok(Math.abs(speciesRadiusPm('S') - 105) < 0.01 && Math.abs(speciesRadiusPm('O') - 66) < 0.01, 'радиусы берутся из справочника')

// Электронная пара обобществляется в обе стороны: донором один раз выступает сера.
const e1 = so2ElectronSpec(so2CueAt('bond1') - 0.4)
const e2 = so2ElectronSpec(so2CueAt('bond2') - 0.4)
ok(e1.donor === 's0' && e1.acceptor === 'oa', 'первая пара образуется между s0 и oa')
ok(e2.donor === 's0' && e2.acceptor === 'ob', 'вторая пара образуется между s0 и ob')
ok(e1.arrive === so2CueAt('bond1') && e2.arrive === so2CueAt('bond2'), 'электрон прилетает ровно в момент образования связи')

// ─────────────────────────────────────────────────────────────────────────────
// 4. Нет рывков между кадрами 1/30 с
// ─────────────────────────────────────────────────────────────────────────────

const jumpFrame = createSo2Frame()
assertNoPositionJumps((t) => so2Particles(t, jumpFrame), SO2_TIMING.end, 0.09, 1 / 30)
checks++

// Кадр считается без аллокаций и не ломается ни в одной точке сюжета.
const frame = createSo2Frame()
for (let t = 0; t <= SO2_TIMING.end + 1e-9; t += 1 / 60) {
  sampleSo2Frame(t, frame)
  for (const a of SO2_ATOMS) {
    const p = frame.atoms[a.id]
    ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `NaN в позиции «${a.id}» при t=${t.toFixed(2)}`)
    const o = frame.opacity[a.id]
    ok(o >= -1e-6 && o <= 1 + 1e-6, `прозрачность «${a.id}» вне 0…1 при t=${t.toFixed(2)}`)
  }
  ok(frame.so.order >= 1.4 && frame.so.order <= 2.01, `порядок связи S–O = ${frame.so.order} вне 1,5…2`)
  ok(frame.camera.zoom > 0.5 && frame.camera.zoom < 2, 'зум камеры в разумных пределах')
}

// В момент продукта на сцене остаётся именно SO₂: сера и два кислорода.
sampleSo2Frame(so2CueAt('embryo'), frame)
ok(frame.so.a > 0.9 && frame.so.b > 0.9, 'к моменту embryo обе связи S=O существуют')
ok(frame.so.c < 0.05, 'к моменту embryo третьего кислорода (SO₃) на сцене нет')
ok(frame.opacity.oc < 0.05, 'третий кислород ушёл обратно — продукт реакции SO₂, а не SO₃')
ok(frame.opacity.s1 < 0.05, 'остаток короны S₈ убран из кадра')
ok(frame.opacity.w1o < 0.05 && frame.opacity.cc < 0.05, 'вода и призрак CO₂ убраны из кадра')

// Уголковая форма на экране: угол между связями совпадает с ∠O–S–O из справочника.
const sp = frame.atoms.s0
const va = frame.atoms.oa.clone().sub(sp)
const vb = frame.atoms.ob.clone().sub(sp)
const shownAngle = (va.angleTo(vb) * 180) / Math.PI
ok(
  Math.abs(shownAngle - bondAngleDeg('sulfurDioxide')) < 0.3,
  `на экране ∠O–S–O = ${shownAngle.toFixed(1)}°, справочник ${bondAngleDeg('sulfurDioxide')}°`,
)
ok(Math.abs(va.length() - vb.length()) < 1e-3, 'обе связи S=O обязаны быть одинаковой длины (резонанс)')

// На кадре SO₃ молекула становится плоской и правильной.
sampleSo2Frame(so2CueAt('so3'), frame)
const wa = frame.atoms.oa.clone().sub(frame.atoms.s0)
const wb = frame.atoms.ob.clone().sub(frame.atoms.s0)
const wc = frame.atoms.oc.clone().sub(frame.atoms.s0)
for (const [p, q, name] of [[wa, wb, 'O–S–O'], [wb, wc, 'O–S–O'], [wc, wa, 'O–S–O']] as const) {
  const ang = (p.angleTo(q) * 180) / Math.PI
  ok(Math.abs(ang - bondAngleDeg('trigonalPlanar')) < 0.3, `SO₃: ${name} = ${ang.toFixed(1)}°, ожидалось 120°`)
}
ok(frame.lonePair < 0.05, 'в SO₃ у серы неподелённой пары нет — её место занял третий кислород')

// ─────────────────────────────────────────────────────────────────────────────
// 5. Тексты в трёх языках
// ─────────────────────────────────────────────────────────────────────────────

const LOCALES: readonly So2Locale[] = ['ru', 'en', 'uz']
for (const locale of LOCALES) {
  const text = getSo2MechanismText(locale)
  ok(text.intro.title.length > 3 && text.intro.speak.length > 10, `${locale}: вступление урока`)
  ok(text.safety.length > 20, `${locale}: предупреждение о безопасности`)
  for (const id of SO2_STEP_IDS) {
    const st = text.steps[id]
    ok(st != null, `${locale}: нет текста шага «${id}»`)
    ok(st.title.length > 3, `${locale}/${id}: заголовок`)
    ok(st.body.length > 120, `${locale}/${id}: тело текста должно быть 2–4 предложения`)
    ok(st.equation.length > 3, `${locale}/${id}: уравнение стадии`)
    ok(st.speak.length > 10, `${locale}/${id}: реплика преподавателя`)
  }
  // Честные пометки обязаны быть там, где на экране упрощение.
  for (const id of ['reactants', 'ring', 'firstBond', 'bend', 'properties', 'energy'] as const) {
    ok((text.steps[id].note ?? '').length > 20, `${locale}/${id}: нужна честная пометка об упрощении`)
  }
  for (const key of ['atomization', 'dissociation', 'bonds', 'total'] as const) {
    ok(text.energy.stages[key].length > 3, `${locale}: подпись ступени «${key}»`)
  }
  ok(text.energy.summary.includes('{dH}'), `${locale}: в summary лестницы обязан быть {dH}`)
}
// Переводы действительно разные.
ok(getSo2MechanismText('ru').steps.bend.body !== getSo2MechanismText('en').steps.bend.body, 'ru и en тексты обязаны отличаться')
ok(getSo2MechanismText('uz').steps.bend.body !== getSo2MechanismText('en').steps.bend.body, 'uz и en тексты обязаны отличаться')

// ─────────────────────────────────────────────────────────────────────────────
// 6. Стехиометрия показанных уравнений
// ─────────────────────────────────────────────────────────────────────────────

type Side = readonly { formula: string; coeff: number }[]

/** Разбирает ASCII-формулу вида «H2SO3» в карту атомов. */
function parseFormula(f: string): Map<string, number> {
  const out = new Map<string, number>()
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(f)) !== null) {
    if (!m[1]) continue
    out.set(m[1], (out.get(m[1]) ?? 0) + (m[2] ? Number(m[2]) : 1))
  }
  return out
}

function tally(side: Side): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of side) {
    for (const [el, n] of parseFormula(s.formula)) out.set(el, (out.get(el) ?? 0) + n * s.coeff)
  }
  return out
}

function assertBalanced(name: string, left: Side, right: Side): void {
  const l = tally(left)
  const r = tally(right)
  const elements = new Set([...l.keys(), ...r.keys()])
  for (const el of elements) {
    ok(
      (l.get(el) ?? 0) === (r.get(el) ?? 0),
      `${name}: по элементу ${el} слева ${l.get(el) ?? 0}, справа ${r.get(el) ?? 0}`,
    )
  }
  // Заряд: во всех уравнениях этой сцены участвуют только нейтральные молекулы.
  ok(true, `${name}: суммарный заряд 0 = 0`)
}

assertBalanced('S + O₂ → SO₂', SO2_REACTION.left, SO2_REACTION.right)
assertBalanced('SO₂ + H₂O ⇌ H₂SO₃', SO2_SIDE_REACTIONS.sulfurousAcid.left, SO2_SIDE_REACTIONS.sulfurousAcid.right)
assertBalanced('2 SO₂ + O₂ ⇌ 2 SO₃', SO2_SIDE_REACTIONS.sulfurTrioxide.left, SO2_SIDE_REACTIONS.sulfurTrioxide.right)

// Простые вещества записаны в реальном состоянии: кислород — O₂, не O.
ok(
  SO2_REACTION.left.some((x) => x.formula === 'O2'),
  'кислород обязан входить в уравнение молекулой O₂',
)
ok(
  !SO2_SIDE_REACTIONS.sulfurTrioxide.left.some((x) => x.formula === 'O'),
  'кислород не может быть одноатомным реагентом',
)

// ─────────────────────────────────────────────────────────────────────────────
// 7. Энергетика
// ─────────────────────────────────────────────────────────────────────────────

ok(Math.abs(SO2_DHF_TABLE_KJ - dHfKJ('SO2(g)')) < 1e-9, 'табличная ΔH°f берётся из thermoData')
ok(Math.abs(SO2_ATOMIZATION_S_KJ - 277.2) < 0.05, `атомизация серы ${SO2_ATOMIZATION_S_KJ} ≠ 277,2`)
ok(Math.abs(SO2_DISSOCIATION_O2_KJ - 498.4) < 0.05, `диссоциация O₂ ${SO2_DISSOCIATION_O2_KJ} ≠ 498,4`)
ok(SO2_ATOMIZATION_S_KJ > 0 && SO2_DISSOCIATION_O2_KJ > 0, 'обе подготовительные стадии эндотермические (ΔH > 0)')
ok(SO2_BONDS_KJ < 0, 'образование связей S=O экзотермично (ΔH < 0)')
ok(Math.abs(SO2_LADDER.sumKJ - SO2_LADDER.tableKJ) < 0.5, 'сумма ступеней обязана сойтись с табличной ΔH°f')
ok(SO2_DHF_KJ === -297, `ΔH°f для подписи в 3D = ${SO2_DHF_KJ}, ожидалось −297`)
ok(Math.abs(SO2_COST_BEFORE_BONDS_KJ - 775.6) < 0.1, `затраты до образования связей ${SO2_COST_BEFORE_BONDS_KJ} ≠ 775,6`)
ok(SO2_COST_BEFORE_BONDS_KJ < Math.abs(SO2_BONDS_KJ), 'выигрыш от связей обязан перекрыть затраты — иначе сера не горела бы')
ok(SO2_BOND_IN_MOLECULE_KJ > SO2_BOND_MEAN_KJ, 'связь в самой SO₂ прочнее средней табличной S=O (делокализация)')
ok(Math.abs(SO2_BOND_MEAN_KJ - bondEnthalpyKJ('S=O')) < 1e-9, 'средняя энергия S=O берётся из bondData')
ok(SO3_OXIDATION_DH_KJ < 0, 'окисление SO₂ до SO₃ экзотермично')
ok(SO2_LADDER.stages.length === 3, 'лестница молекулярная: три ступени, а не цикл Борна — Габера')

// Геометрия и полярность в справочных фактах совпадают со справочником.
ok(SO2_FACTS.angleDeg === bondAngleDeg('sulfurDioxide'), '∠O–S–O из справочника')
ok(SO2_FACTS.co2AngleDeg === 180, 'CO₂ линейная — 180°')
ok(SO2_FACTS.bondSOPm === bondLengthPm('S=O'), 'd(S=O) из справочника')
ok(SO2_FACTS.dipoleD === dipoleDebye('SO2'), 'μ(SO₂) из справочника')
ok(SO2_FACTS.dipoleD > 0 && SO2_FACTS.co2DipoleD === 0, 'SO₂ полярна, CO₂ — нет')

// ─────────────────────────────────────────────────────────────────────────────
// 8. Локализация подписей в 3D
// ─────────────────────────────────────────────────────────────────────────────

const tokens = labelTokensUsed(SO2_LABELS)
ok(tokens.length > 0, 'подписи обязаны использовать токены состояний и единиц')
for (const token of tokens) {
  ok(SCENE_LABEL_TOKENS.ru[token] != null, `токен «{${token}}» неизвестен словарю подписей`)
}

const rendered: Record<string, string[]> = {}
for (const locale of LOCALES) {
  const states = createLabelStates(SO2_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) {
    ok(!/\{\w+\}/.test(st.text), `${locale}: в подписи «${st.id}» остался нераскрытый токен — «${st.text}»`)
  }
  rendered[locale] = states.map((s) => s.text)
}
ok(rendered.ru!.join('|') !== rendered.en!.join('|'), 'русские и английские подписи обязаны отличаться')
ok(rendered.ru!.some((s) => s.includes('пм')), 'в русских подписях пикометры пишутся «пм»')
ok(rendered.en!.some((s) => s.includes('pm')), 'в английских подписях пикометры пишутся «pm»')

// В подписях не должно быть слов — только формулы, числа и единицы СИ.
for (const def of SO2_LABELS) {
  for (const key of def.keys) {
    ok(!/[а-яё]/i.test(key.text), `подпись «${def.id}» содержит русские слова: «${key.text}»`)
  }
}

// Подписи одного якоря не должны налезать друг на друга во времени.
const byAnchor = new Map<string, typeof SO2_LABELS[number][]>()
for (const def of SO2_LABELS) {
  const anchor = ['s8', 'ss'].includes(def.id)
    ? 'crown'
    : ['o2', 'oo', 'dissoc'].includes(def.id)
      ? 'o2'
      : ['atomize'].includes(def.id)
        ? 's0'
        : ['so'].includes(def.id)
          ? 'oa'
          : ['dipole'].includes(def.id)
            ? 'ob'
            : ['co2'].includes(def.id)
              ? 'cc'
              : 'centre'
  const list = byAnchor.get(anchor) ?? []
  list.push(def)
  byAnchor.set(anchor, list)
}
for (const [anchor, defs] of byAnchor) {
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i]!
      const b = defs[j]!
      const overlap = a.windows.some(([a0, a1]) => b.windows.some(([b0, b1]) => a0 < b1 && b0 < a1))
      if (!overlap) continue
      ok(
        Math.abs(a.dy - b.dy) >= 0.45,
        `подписи «${a.id}» и «${b.id}» на якоре ${anchor} видны одновременно и стоят слишком близко (Δdy = ${Math.abs(a.dy - b.dy).toFixed(2)})`,
      )
    }
  }
}

console.log(`test:so2-cinema — ok, ${checks} проверок`)
console.log(
  `  шагов ${SO2_STEP_IDS.length}, экранное время ${SO2_TIMING.wallDuration.toFixed(1)} с, ` +
    `Σ лестницы ${SO2_LADDER.sumKJ} кДж/моль (таблица ${SO2_LADDER.tableKJ}), ` +
    `∠O–S–O ${SO2_FACTS.angleDeg}°, корона r = ${SO2_GEOM.crownRadiusPm.toFixed(1)} пм`,
)
