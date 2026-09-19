/**
 * Тест сцены «Синтез аммиака»: N₂ (г) + 3 H₂ (г) ⇌ 2 NH₃ (г).
 *
 *   npx tsx scripts/test-nh3-cinema.mts      (npm run test:nh3-cinema)
 *
 * Что проверяем:
 *   1. хронометраж: шаги непрерывны, 6 ± 1 шаг, 26–34 с экранного времени,
 *      cue упорядочены и есть контракт лаборатории embryo → birth → complete;
 *   2. раскадровка: дорожки монотонны, геометрия пирамиды и решётки Fe верны;
 *   3. кадр не «щёлкает»: между выборками 1/30 с видимый атом не прыгает > 0.09;
 *   4. химия: стехиометрия сбалансирована по атомам И по заряду, реакция обратима,
 *      энергетическая лестница по связям сходится с расчётом по ΔH°f;
 *   5. тексты есть в ru/en/uz для каждого шага и не совпадают между языками;
 *   6. 3D-подписи локализуются: все токены известны, после перевода не остаётся «{…}».
 */
import * as THREE from 'three'
import { bondEnthalpyKJ, bondLengthPm, bondAngleDeg, dipoleDebye } from '../src/chemistry/data/index.ts'
import {
  SCENE_LABEL_TOKENS,
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import {
  FE_ATOMS,
  FE_BONDS,
  NH3_ATOMS,
  NH3_END,
  NH3_GEOM,
  NH3_LABELS,
  NH3_STEPS,
  NH3_TIMING,
  createNh3Frame,
  nh3VisibleAt,
  sampleNh3Frame,
  validateNh3Storyboard,
} from '../src/lab/cinema/scenes/nh3/nh3Storyboard.ts'
import {
  HABER,
  NH3_DELTA_N,
  NH3_ENTHALPY,
  NH3_LADDER,
  NH3_REACTION,
  NH3_REACTION_DH_KJ,
  NN_BOND_KJ,
  validateNh3Energetics,
} from '../src/lab/cinema/scenes/nh3/nh3Energetics.ts'
import { getNh3MechanismText, type Nh3Locale } from '../src/lab/cinema/scenes/nh3/nh3MechanismText.ts'
import { NH3_STEP_IDS } from '../src/lab/cinema/scenes/nh3/nh3Steps.ts'

let checks = 0
let failed = 0

function ok(cond: unknown, msg: string): void {
  checks++
  if (!cond) {
    failed++
    console.error(`  ✗ ${msg}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

function must(fn: () => void, msg: string): void {
  checks++
  try {
    fn()
  } catch (e) {
    failed++
    console.error(`  ✗ ${msg}: ${(e as Error).message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
section('1. Хронометраж и события')
// ─────────────────────────────────────────────────────────────────────────────

must(() => NH3_TIMING.validate(), 'NH3_TIMING.validate()')
ok(NH3_STEPS.length >= 5 && NH3_STEPS.length <= 7, `шагов 6 ± 1 (сейчас ${NH3_STEPS.length})`)
ok(
  NH3_TIMING.wallDuration >= 26 && NH3_TIMING.wallDuration <= 34,
  `экранная длительность 26–34 с (сейчас ${NH3_TIMING.wallDuration.toFixed(1)})`,
)

let prevTo = 0
for (const s of NH3_STEPS) {
  ok(s.from === prevTo, `шаг «${s.id}»: from ${s.from} стыкуется с предыдущим ${prevTo}`)
  ok(s.to > s.from, `шаг «${s.id}»: to > from`)
  ok(s.wall > 0, `шаг «${s.id}»: wall > 0`)
  prevTo = s.to
}

let lastCue = -Infinity
for (const c of NH3_TIMING.cues) {
  ok(c.at >= lastCue, `событие «${c.id}» идёт по возрастанию`)
  ok(c.at >= 0 && c.at <= NH3_END, `событие «${c.id}» внутри [0, ${NH3_END}]`)
  lastCue = c.at
}
const cueIds = NH3_TIMING.cues.map((c) => c.id)
ok(cueIds.indexOf('embryo') >= 0, 'есть cue embryo (контракт лаборатории)')
ok(cueIds.indexOf('birth') > cueIds.indexOf('embryo'), 'birth после embryo')
ok(cueIds.indexOf('complete') > cueIds.indexOf('birth'), 'complete после birth')

// Ключевые события идут в химически правильном порядке.
const at = (id: string) => NH3_TIMING.cues.find((c) => c.id === id)!.at
ok(at('adsorb') < at('split'), 'сначала адсорбция, потом разрыв N≡N')
ok(at('split') < at('nh'), 'связи N–H появляются ПОСЛЕ разрыва тройной связи')
ok(at('nh') < at('nh2') && at('nh2') < at('nh3'), 'NH → NH₂ → NH₃ строго по порядку')
ok(at('nh3') < at('desorb'), 'десорбция только у готовой молекулы')
ok(at('desorb') < at('equilibrium') && at('equilibrium') < at('exo'), 'равновесие и энергия — в конце')

// ─────────────────────────────────────────────────────────────────────────────
section('2. Раскадровка')
// ─────────────────────────────────────────────────────────────────────────────

must(() => validateNh3Storyboard(), 'validateNh3Storyboard()')
must(() => validateNh3Energetics(), 'validateNh3Energetics()')

ok(NH3_ATOMS.filter((a) => a.el === 'N').length === 2, 'в кадре ровно 2 атома азота')
ok(NH3_ATOMS.filter((a) => a.el === 'H').length === 6, 'в кадре ровно 6 атомов водорода')
ok(FE_ATOMS.length === 18, `фрагмент катализатора: 18 атомов Fe (сейчас ${FE_ATOMS.length})`)
ok(FE_BONDS.length === 24, `24 связи Fe–Fe (сейчас ${FE_BONDS.length})`)

// Размеры частиц — из справочника, без ионов: N 71 пм, H 31 пм, Fe 126 пм.
ok(speciesRadiusPm('N', 0) === 71, 'ковалентный радиус N = 71 пм')
ok(speciesRadiusPm('H', 0) === 31, 'ковалентный радиус H = 31 пм')
ok(NH3_GEOM.radius.n > NH3_GEOM.radius.h, 'на экране атом N крупнее атома H')
ok(NH3_GEOM.radius.fe > NH3_GEOM.radius.n, 'атом Fe крупнее атома N')

// Длины связей и угол — ровно справочные.
ok(Math.abs(NH3_GEOM.data.nnPm - bondLengthPm('N#N')) < 1e-9, 'd(N≡N) взято из bondData')
ok(Math.abs(NH3_GEOM.data.nhPm - bondLengthPm('N-H')) < 1e-9, 'd(N–H) взято из bondData')
ok(Math.abs(NH3_GEOM.data.angleDeg - bondAngleDeg('ammonia')!) < 1e-9, 'угол H–N–H взят из bondData')
ok(NH3_GEOM.data.dipoleD === dipoleDebye('NH3'), 'дипольный момент взят из bondData')
ok(
  Math.abs(NH3_GEOM.pyramid.betaDeg - 67.9) < 0.2,
  `угол связи с осью C₃ ≈ 67,9° (сейчас ${NH3_GEOM.pyramid.betaDeg.toFixed(2)}°)`,
)

// ─────────────────────────────────────────────────────────────────────────────
section('3. Кадр не «щёлкает»')
// ─────────────────────────────────────────────────────────────────────────────

const frame = createNh3Frame()
must(() => assertNoPositionJumps((t) => nh3VisibleAt(t, frame), NH3_END, 0.09, 1 / 30), 'нет скачков > 0.09 за 1/30 с')

// Молекулы не проваливаются сквозь катализатор: азот всегда над верхним слоем.
const probe = createNh3Frame()
let below = 0
for (let t = at('adsorb'); t <= at('desorb'); t += 0.1) {
  sampleNh3Frame(t, probe)
  for (const id of ['n1', 'n2'] as const) if (probe.atoms[id].y < -0.62) below++
}
ok(below === 0, `азот не проваливается под поверхность железа (нарушений ${below})`)

// Пока молекула не собрана, длина связи N–H равна справочной ровно.
const wantNh = NH3_GEOM.bond.nh
let nhErr = 0
for (let t = at('nh3') + 0.6; t <= NH3_END; t += 0.25) {
  sampleNh3Frame(t, probe)
  for (const [n, h] of [
    ['n1', 'h1'],
    ['n1', 'h2'],
    ['n1', 'h5'],
    ['n2', 'h3'],
    ['n2', 'h4'],
    ['n2', 'h6'],
  ] as const) {
    if (Math.abs(probe.atoms[n].distanceTo(probe.atoms[h]) - wantNh) > 1e-6) nhErr++
  }
}
ok(nhErr === 0, `в готовой молекуле все шесть связей N–H строго 101,2 пм (нарушений ${nhErr})`)

// Угол H–N–H в готовой молекуле — справочные 106,7° на всём хвосте сцены.
const a1 = new THREE.Vector3()
const a2 = new THREE.Vector3()
let angErr = 0
for (let t = at('nh3') + 0.6; t <= NH3_END; t += 0.25) {
  sampleNh3Frame(t, probe)
  for (const [x, y] of [
    ['h1', 'h2'],
    ['h2', 'h5'],
    ['h5', 'h1'],
  ] as const) {
    a1.copy(probe.atoms[x]).sub(probe.atoms.n1)
    a2.copy(probe.atoms[y]).sub(probe.atoms.n1)
    const deg = (Math.acos(a1.dot(a2) / (a1.length() * a2.length())) * 180) / Math.PI
    if (Math.abs(deg - NH3_GEOM.data.angleDeg) > 0.05) angErr++
  }
}
ok(angErr === 0, `угол H–N–H держится 106,7° (нарушений ${angErr})`)

// Катализатор не расходуется: атомы железа неподвижны и не исчезают.
sampleNh3Frame(NH3_END, probe)
let feMoved = 0
for (const f of FE_ATOMS) {
  const p = probe.atoms[f.id]
  if (Math.abs(p.x - f.pos[0]) > 1e-9 || Math.abs(p.y - f.pos[1]) > 1e-9 || Math.abs(p.z - f.pos[2]) > 1e-9) feMoved++
  if (probe.opacity[f.id] < 0.99) feMoved++
}
ok(feMoved === 0, `катализатор цел и виден в конце сцены (нарушений ${feMoved})`)

// Тройная связь действительно рвётся: кратность 3 → 0.
sampleNh3Frame(0, probe)
ok(Math.abs(probe.nn.order - 3) < 1e-9, 'на старте кратность связи N–N равна 3')
sampleNh3Frame(at('split') + 1, probe)
ok(probe.nn.opacity < 0.02, 'после cue split связь N≡N исчезла')

// ─────────────────────────────────────────────────────────────────────────────
section('4. Химия: стехиометрия, обратимость, энергия')
// ─────────────────────────────────────────────────────────────────────────────

/** Разбор ASCII-формулы вида «N2», «H2», «NH3» в счётчик атомов. */
function parseFormula(f: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!m[1]) continue
    out.set(m[1], (out.get(m[1]) ?? 0) + (m[2] ? Number(m[2]) : 1))
  }
  return out
}

function sideAtoms(side: readonly { formula: string; coeff: number }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const term of side) {
    for (const [el, n] of parseFormula(term.formula)) out.set(el, (out.get(el) ?? 0) + n * term.coeff)
  }
  return out
}

const left = sideAtoms(NH3_REACTION.left)
const right = sideAtoms(NH3_REACTION.right)
const elements = new Set([...left.keys(), ...right.keys()])
for (const el of elements) {
  ok(left.get(el) === right.get(el), `баланс по ${el}: слева ${left.get(el)}, справа ${right.get(el)}`)
}
ok(left.get('N') === 2 && left.get('H') === 6, 'в уравнении 2 атома N и 6 атомов H')
// Заряд: реакция целиком между нейтральными частицами, ионов нет ни с одной стороны.
ok(NH3_REACTION.left.every((t) => !/[+-]/.test(t.formula)), 'слева нет заряженных частиц')
ok(NH3_REACTION.right.every((t) => !/[+-]/.test(t.formula)), 'справа нет заряженных частиц')
ok(NH3_REACTION.reversible, 'реакция помечена как обратимая (⇌)')
ok(NH3_DELTA_N === -2, `Δn(газ) = −2 (сейчас ${NH3_DELTA_N})`)

// Двухатомные простые вещества: и азот, и водород входят в реакцию МОЛЕКУЛАМИ.
ok(NH3_REACTION.left.some((t) => t.formula === 'N2'), 'азот вступает как N₂, а не как атомы')
ok(NH3_REACTION.left.some((t) => t.formula === 'H2' && t.coeff === 3), 'водород вступает как 3 H₂')

// Энергия: ступени по связям и независимый расчёт по ΔH°f.
const stageSum = NH3_LADDER.stages.reduce((s, x) => s + x.dH, 0)
ok(Math.abs(stageSum - NH3_LADDER.sumKJ) < 1e-6, 'сумма ступеней совпадает с sumKJ лестницы')
ok(Math.abs(NH3_LADDER.sumKJ - NH3_LADDER.tableKJ) <= 5, `по связям ${NH3_LADDER.sumKJ} ≈ по ΔH°f ${NH3_LADDER.tableKJ}`)
ok(NH3_ENTHALPY.fromFormation < 0, 'реакция экзотермическая по ΔH°f')
ok(NH3_REACTION_DH_KJ === -92, `ΔH уравнения = −92 кДж (сейчас ${NH3_REACTION_DH_KJ})`)
ok(NN_BOND_KJ === bondEnthalpyKJ('N#N') && NN_BOND_KJ === 945, 'E(N≡N) = 945 кДж/моль из bondData')
ok(bondEnthalpyKJ('H-H') === 436, 'E(H–H) = 436 кДж/моль из bondData')
ok(bondEnthalpyKJ('N-H') === 391, 'E(N–H) = 391 кДж/моль из bondData')

const nnStage = NH3_LADDER.stages.find((s) => s.id === 'nn')!
const hhStage = NH3_LADDER.stages.find((s) => s.id === 'hh')!
const nhStage = NH3_LADDER.stages.find((s) => s.id === 'nh')!
ok(nnStage.dH === 945, 'ступень N≡N = +945 кДж')
ok(hhStage.dH === 3 * 436, 'ступень 3 H–H = +1308 кДж')
ok(nhStage.dH === -6 * 391, 'ступень 6 N–H = −2346 кДж')
for (const s of NH3_LADDER.stages) {
  ok(s.at >= 0 && s.at <= NH3_END, `ступень «${s.id}» привязана ко времени внутри сюжета`)
}

// Катализатор: барьер ниже, тепловой эффект тот же.
ok(HABER.eaCatalystKJ[1] < HABER.eaPlainKJ, 'Eₐ на железе ниже энергии разрыва N≡N')
ok(HABER.eaPlainKJ === NN_BOND_KJ, 'барьер без катализатора взят как E(N≡N), а не выдуман')
ok(HABER.pressureMPa[0] === 20 && HABER.pressureMPa[1] === 30, 'давление процесса 20–30 МПа')
ok(HABER.tempC[0] === 400 && HABER.tempC[1] === 500, 'температура процесса 400–500 °C')

// ─────────────────────────────────────────────────────────────────────────────
section('5. Тексты ru / en / uz')
// ─────────────────────────────────────────────────────────────────────────────

const LOCALES: Nh3Locale[] = ['ru', 'en', 'uz']
for (const locale of LOCALES) {
  const text = getNh3MechanismText(locale)
  ok(text.intro.title.length > 0, `${locale}: есть заголовок урока`)
  ok(text.safety.length > 20, `${locale}: есть предупреждение о безопасности`)
  ok(text.energy.stages.nn.length > 0 && text.energy.stages.nh.length > 0, `${locale}: подписаны ступени лестницы`)
  ok(text.energy.summary.includes('{dH}'), `${locale}: в summary лестницы есть подстановка {dH}`)
  for (const id of NH3_STEP_IDS) {
    const st = text.steps[id]
    ok(!!st, `${locale}: есть текст шага «${id}»`)
    if (!st) continue
    ok(st.title.length > 0, `${locale}/${id}: есть заголовок`)
    ok(st.body.length > 120, `${locale}/${id}: тело из 2–4 предложений`)
    ok(st.equation.length > 0, `${locale}/${id}: есть уравнение стадии`)
    ok(st.speak.length > 0, `${locale}/${id}: есть реплика преподавателя`)
    ok(!/\bN2\b|\bH2\b|\bNH3\b/.test(st.equation), `${locale}/${id}: в уравнении настоящие индексы, а не N2/H2/NH3`)
    ok(!st.equation.includes('->'), `${locale}/${id}: стрелка написана символом, а не «->»`)
  }
  // Обратимость: итоговое уравнение всегда со знаком ⇌.
  ok(text.steps.equilibrium.equation.includes('⇌'), `${locale}: уравнение равновесия со знаком ⇌`)
  ok(text.steps.energy.equation.includes('⇌'), `${locale}: итоговое уравнение со знаком ⇌`)
}

const ru = getNh3MechanismText('ru')
const en = getNh3MechanismText('en')
const uz = getNh3MechanismText('uz')
for (const id of NH3_STEP_IDS) {
  ok(ru.steps[id].body !== en.steps[id].body, `«${id}»: ru ≠ en`)
  ok(ru.steps[id].body !== uz.steps[id].body, `«${id}»: ru ≠ uz`)
  ok(en.steps[id].body !== uz.steps[id].body, `«${id}»: en ≠ uz`)
}

// ─────────────────────────────────────────────────────────────────────────────
section('6. Подписи в 3D локализуются')
// ─────────────────────────────────────────────────────────────────────────────

for (const token of labelTokensUsed(NH3_LABELS)) {
  ok(SCENE_LABEL_TOKENS.ru[token] !== undefined, `токен «{${token}}» есть в словаре подписей`)
}
for (const locale of LOCALES) {
  const states = createLabelStates(NH3_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) ok(!/\{\w+\}/.test(st.text), `${locale}: подпись «${st.id}» переведена полностью`)
}
{
  const r = createLabelStates(NH3_LABELS)
  const e = createLabelStates(NH3_LABELS)
  localizeSceneLabels(r, 'ru')
  localizeSceneLabels(e, 'en')
  ok(r.some((st, i) => st.text !== e[i]!.text), 'подписи ru и en различаются (токены реально подставились)')
}
// Подписи говорят на языке химии: только формулы, символы и единицы СИ.
for (const def of NH3_LABELS) {
  for (const k of def.keys) {
    ok(!/[а-яА-Я]/.test(k.text), `подпись «${def.id}» без кириллицы: «${k.text}»`)
    ok(!k.text.includes('->'), `подпись «${def.id}»: стрелка символом`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${failed === 0 ? '✓ ВСЁ ЗЕЛЁНОЕ' : '✗ ЕСТЬ ОШИБКИ'}: проверок ${checks}, ошибок ${failed}`)
if (failed > 0) process.exit(1)
