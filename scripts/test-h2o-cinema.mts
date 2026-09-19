/**
 * Тест сцены «вода»: 2 H₂ (г.) + O₂ (г.) → 2 H₂O (г.).
 *
 * Проверяет ровно то, на чём сцена может незаметно разъехаться с химией:
 * хронометраж и контракт лаборатории, монотонность дорожек, отсутствие
 * скачков картинки, геометрию молекулы (длины связей, угол, неподелённые пары,
 * водородная связь), баланс уравнений по атомам И по заряду, сходимость
 * энергетической лестницы с табличной ΔH°f и локализацию 3D-подписей.
 *
 *   npx tsx scripts/test-h2o-cinema.mts
 */
import * as THREE from 'three'
import {
  createH2oFrame,
  H2O_ATOMS,
  H2O_GEOM,
  H2O_LABELS,
  H2O_STEP_IDS,
  H2O_TIMING,
  HBOND,
  LONE_PAIRS_A,
  LONE_PAIRS_B,
  OH_BONDS,
  REACTANT_BONDS,
  sampleH2oFrame,
  validateH2oStoryboard,
} from '../src/lab/cinema/scenes/h2o/h2oStoryboard'
import { H2O_LADDER, H2O_THERMO, validateH2oEnergetics } from '../src/lab/cinema/scenes/h2o/h2oEnergetics'
import { getH2oMechanismText, type H2oLocale } from '../src/lab/cinema/scenes/h2o/h2oMechanismText'
import {
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit'
import { assertLadderMatchesFormation } from '../src/lab/cinema/scenes/kit/energyLadderData'
import { assertIonSizeOrder, speciesRadius } from '../src/lab/cinema/scenes/kit/cpkAtoms'
import { bondEnthalpyKJ, bondLengthPm, dHfKJ } from '../src/chemistry/data'

let checks = 0
let failures = 0

function ok(cond: boolean, what: string): void {
  checks++
  if (!cond) {
    failures++
    console.error(`  ✗ ${what}`)
  }
}

function near(a: number, b: number, tol: number, what: string): void {
  ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (допуск ${tol})`)
}

function section(name: string): void {
  console.log(`\n— ${name}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Разбор формул: 2 H₂O, ½ O₂, HO, Na⁺, Cl⁻
// ─────────────────────────────────────────────────────────────────────────────

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function parseTerm(raw: string): { coef: number; atoms: Map<string, number>; charge: number } {
  let s = raw.trim().replace(/[·•*]/g, '').replace(/\s+/g, ' ')
  let coef = 1
  const m = s.match(/^(½|\d+(?:[.,]\d+)?)\s*/)
  if (m) {
    coef = m[1] === '½' ? 0.5 : Number(m[1]!.replace(',', '.'))
    s = s.slice(m[0].length)
  }
  // Заряд: хвост вида ⁺, ⁻, ²⁺, ³⁻
  let charge = 0
  const cm = s.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/)
  if (cm) {
    const n = cm[1] ? Number([...cm[1]].map((c) => SUP_DIGITS.indexOf(c)).join('')) : 1
    charge = cm[2] === '⁺' ? n : -n
    s = s.slice(0, s.length - cm[0].length)
  }
  const atoms = new Map<string, number>()
  const re = /([A-Z][a-z]?)([₀-₉]*)/g
  let hit: RegExpExecArray | null
  while ((hit = re.exec(s)) !== null) {
    if (!hit[1]) continue
    const n = hit[2] ? Number([...hit[2]].map((c) => SUB.indexOf(c)).join('')) : 1
    atoms.set(hit[1], (atoms.get(hit[1]) ?? 0) + n)
  }
  return { coef, atoms, charge }
}

function tally(side: string): { atoms: Map<string, number>; charge: number } {
  const atoms = new Map<string, number>()
  let charge = 0
  for (const term of side.split('+')) {
    const t = parseTerm(term)
    for (const [el, n] of t.atoms) atoms.set(el, (atoms.get(el) ?? 0) + n * t.coef)
    charge += t.charge * t.coef
  }
  return { atoms, charge }
}

/** Сводит уравнение по атомам И по заряду. */
function assertBalanced(equation: string): void {
  const [left, right] = equation.split('→')
  ok(Boolean(left && right), `уравнение «${equation}» содержит стрелку`)
  if (!left || !right) return
  const l = tally(left)
  const r = tally(right)
  const elements = new Set([...l.atoms.keys(), ...r.atoms.keys()])
  for (const el of elements) {
    near(l.atoms.get(el) ?? 0, r.atoms.get(el) ?? 0, 1e-9, `«${equation}»: атомов ${el}`)
  }
  near(l.charge, r.charge, 1e-9, `«${equation}»: заряд`)
}

// ─────────────────────────────────────────────────────────────────────────────

console.log('Сцена h2o — 2 H₂ (г.) + O₂ (г.) → 2 H₂O (г.)')

section('1. Хронометраж и контракт лаборатории')
H2O_TIMING.validate()
ok(true, 'H2O_TIMING.validate()')
ok(H2O_STEP_IDS.length >= 5 && H2O_STEP_IDS.length <= 7, `шагов 6 ± 1 (сейчас ${H2O_STEP_IDS.length})`)
ok(
  H2O_TIMING.wallDuration >= 26 && H2O_TIMING.wallDuration <= 34,
  `экранная длительность 26–34 с (сейчас ${H2O_TIMING.wallDuration.toFixed(1)})`,
)
for (const id of ['embryo', 'birth', 'complete'] as const) {
  ok(
    H2O_TIMING.cues.some((c) => c.id === id),
    `есть событие «${id}» — без него лаборатория зависнет`,
  )
}
{
  let prev = -Infinity
  for (const c of H2O_TIMING.cues) {
    ok(c.at >= prev, `события по возрастанию: «${c.id}» (${c.at})`)
    ok(c.at >= 0 && c.at <= H2O_TIMING.end, `событие «${c.id}» внутри [0, ${H2O_TIMING.end}]`)
    prev = c.at
  }
  let from = 0
  for (const s of H2O_TIMING.steps) {
    ok(s.from === from, `шаг «${s.id}» продолжает предыдущий`)
    ok(s.to > s.from && s.wall > 0, `шаг «${s.id}»: длительность положительна`)
    from = s.to
  }
}

section('2. Раскадровка и энергетика')
validateH2oStoryboard()
ok(true, 'validateH2oStoryboard()')
validateH2oEnergetics()
ok(true, 'validateH2oEnergetics()')
assertLadderMatchesFormation(H2O_LADDER, 2)
near(H2O_LADDER.sumKJ, dHfKJ('H2O(g)'), 2, 'сумма лестницы vs табличная ΔH°f(H₂O, г.)')
for (const s of H2O_LADDER.stages) assertBalanced(s.equation)

section('3. Кадр не щёлкает')
{
  const frame = createH2oFrame()
  const parts = H2O_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 1 }))
  assertNoPositionJumps(
    (t) => {
      sampleH2oFrame(t, frame)
      for (const p of parts) {
        p.pos.copy(frame.atoms[p.id as keyof typeof frame.atoms])
        p.opacity = frame.opacity[p.id as keyof typeof frame.opacity]
      }
      return parts
    },
    H2O_TIMING.end,
  )
  ok(true, 'ни один видимый атом не прыгает больше чем на 0.09 за 1/30 с')
}

section('4. Химия: простые вещества и продукт')
{
  const frame = createH2oFrame()
  const d = (t: number, a: keyof typeof frame.atoms, b: keyof typeof frame.atoms) => {
    sampleH2oFrame(t, frame)
    return frame.atoms[a].distanceTo(frame.atoms[b])
  }
  const toPm = (scene: number) => (scene / 0.285) * 100

  // Простые вещества — ДВУХАТОМНЫЕ молекулы с настоящими длинами связей.
  near(toPm(d(0, 'h1', 'h2')), bondLengthPm('H-H'), 0.1, 'H–H в молекуле H₂ №1, пм')
  near(toPm(d(0, 'h3', 'h4')), bondLengthPm('H-H'), 0.1, 'H–H в молекуле H₂ №2, пм')
  near(toPm(d(0, 'o1', 'o2')), bondLengthPm('O=O'), 0.1, 'O=O в молекуле кислорода, пм')
  ok(REACTANT_BONDS.some(([, , order]) => order === 2), 'связь в O₂ нарисована ДВОЙНОЙ')
  ok(REACTANT_BONDS.filter(([, , order]) => order === 1).length === 2, 'две одинарные связи H–H')

  // Продукт: четыре связи O–H и два валентных угла.
  sampleH2oFrame(17, frame)
  for (const [h, o] of OH_BONDS) {
    near(toPm(frame.atoms[h].distanceTo(frame.atoms[o])), bondLengthPm('O-H'), 0.1, `связь ${o}–${h}, пм`)
  }
  for (const [o, ha, hb] of [
    ['o1', 'h1', 'h3'],
    ['o2', 'h2', 'h4'],
  ] as const) {
    const u = frame.atoms[ha].clone().sub(frame.atoms[o])
    const v = frame.atoms[hb].clone().sub(frame.atoms[o])
    near((u.angleTo(v) * 180) / Math.PI, H2O_GEOM.angleDeg, 0.1, `угол H–O–H у ${o}, град`)
  }

  // Водородная связь — межмолекулярная, длиннее ковалентной ровно как в воде.
  near(toPm(frame.atoms[HBOND[0]].distanceTo(frame.atoms[HBOND[1]])), bondLengthPm('O-H...O'), 0.1, 'H···O, пм')
  const oo = toPm(frame.atoms.o1.distanceTo(frame.atoms.o2))
  ok(oo > 272 && oo < 288, `O···O между молекулами ${oo.toFixed(1)} пм (в воде 276–280)`)
  ok(bondLengthPm('O-H...O') > bondLengthPm('O-H'), 'водородная связь ДЛИННЕЕ ковалентной O–H')
  ok(bondEnthalpyKJ('O-H...O') < bondEnthalpyKJ('O-H') / 10, 'водородная связь на порядок слабее ковалентной')
}

section('5. Неподелённые пары и полярность')
ok(LONE_PAIRS_A.length === 2 && LONE_PAIRS_B.length === 2, 'у каждого кислорода ровно ДВЕ неподелённые пары')
near(H2O_GEOM.lonePairAngleDeg, 109.47, 0.01, 'лепестки нарисованы под тетраэдрическим углом')
ok(H2O_GEOM.data.enO > H2O_GEOM.data.enH, 'ЭО(O) > ЭО(H) — пара смещена к кислороду')
near(H2O_GEOM.data.deltaEN, 1.24, 0.01, 'ΔЭО(O−H)')
near(H2O_GEOM.data.partialH, 0.33, 0.02, 'δ+ на водороде, e (из μ = 2qd·cos(θ/2))')
near(H2O_GEOM.data.partialO, -0.66, 0.04, 'δ− на кислороде, e')
near(2 * H2O_GEOM.data.partialH + H2O_GEOM.data.partialO, 0, 1e-6, 'молекула в целом нейтральна')
near(H2O_GEOM.data.dipoleD, 1.85, 1e-9, 'дипольный момент, D')
// Ни одного иона: атомы остаются атомами, радиус ковалентный и постоянный.
ok(speciesRadius('H', 0) < speciesRadius('O', 0), 'атом H меньше атома O')
assertIonSizeOrder('O', -2)

section('6. Энергия по связям')
near(H2O_THERMO.bond.hh, 436, 1e-9, 'E(H–H), кДж/моль')
near(H2O_THERMO.bond.oo, 498, 1e-9, 'E(O=O), кДж/моль')
near(H2O_THERMO.bond.oh, 463, 1e-9, 'E(O–H), кДж/моль')
near(H2O_THERMO.breakKJ, 2 * 436 + 498, 1e-9, 'на разрыв 2 H–H и O=O, кДж')
near(H2O_THERMO.formKJ, -4 * 463, 1e-9, 'при образовании 4 связей O–H, кДж')
near(H2O_THERMO.burn2mol.fromBonds, -482, 1e-9, 'итог по связям на 2 моля, кДж')
near(H2O_THERMO.burn2mol.fromFormation, -483.6, 0.1, 'итог по ΔH°f на 2 моля, кДж')
ok(Math.abs(H2O_THERMO.burn2mol.deltaKJ) <= 2, 'расчёт по связям и по ΔH°f сходятся в пределах 2 кДж')
near(H2O_THERMO.gasKJ, -241.8, 1e-9, 'ΔH°f(H₂O, г.)')
near(H2O_THERMO.liquidKJ, -285.8, 1e-9, 'ΔH°f(H₂O, ж.)')
near(H2O_THERMO.condensationKJ, -44, 0.1, 'теплота конденсации, кДж/моль')
ok(H2O_THERMO.gasKJ < 0, 'образование воды ЭКЗОтермично')

section('7. Уравнения сбалансированы по атомам и по заряду')
for (const eq of [
  '2 H₂ + O₂ → 2 H₂O',
  '2 H₂ → 4 H',
  'O₂ → 2 O',
  '4 H + 2 O → 2 H₂O',
  'H₂ + ½ O₂ → H₂O',
]) {
  assertBalanced(eq)
}

section('8. Тексты урока в ru / en / uz')
for (const locale of ['ru', 'en', 'uz'] as H2oLocale[]) {
  const text = getH2oMechanismText(locale)
  ok(Boolean(text.intro.title && text.intro.speak), `${locale}: вступление`)
  ok(Boolean(text.safety), `${locale}: предупреждение о безопасности`)
  ok(Boolean(text.legend.electron && text.legend.orbitalPhase && text.legend.water), `${locale}: легенда`)
  ok(Boolean(text.energy.title && text.energy.unit && text.energy.caption && text.energy.sources), `${locale}: энергия`)
  ok(text.energy.summary.includes('{dH}'), `${locale}: в aria-подписи лестницы есть {dH}`)
  for (const stage of H2O_LADDER.stages) {
    ok(Boolean((text.energy.stages as Record<string, string>)[stage.id]), `${locale}: подпись ступени «${stage.id}»`)
  }
  for (const id of H2O_STEP_IDS) {
    const st = text.steps[id]
    ok(Boolean(st), `${locale}: шаг «${id}» есть`)
    if (!st) continue
    ok(st.title.length > 3, `${locale}/${id}: заголовок`)
    ok(st.body.split(/[.!?]\s/).length >= 2, `${locale}/${id}: тело из 2+ предложений`)
    ok(st.body.length > 140, `${locale}/${id}: тело подробное`)
    ok(Boolean(st.equation), `${locale}/${id}: уравнение стадии`)
    ok(Boolean(st.speak) && st.speak.length > 10, `${locale}/${id}: реплика преподавателя`)
  }
  // Шаги, где обязательно должна стоять честная пометка об упрощении.
  for (const id of ['spark', 'bonds', 'molecule', 'polarity', 'energy'] as const) {
    ok(Boolean(text.steps[id].note), `${locale}/${id}: есть честная пометка note`)
  }
}
{
  const ru = getH2oMechanismText('ru')
  const en = getH2oMechanismText('en')
  const uz = getH2oMechanismText('uz')
  ok(ru.intro.title !== en.intro.title && en.intro.title !== uz.intro.title, 'тексты действительно разные в трёх языках')
}

section('9. Подписи в 3D локализуются')
{
  const used = labelTokensUsed(H2O_LABELS)
  ok(used.length > 0, 'подписи используют токены состояний/единиц')
  for (const token of used) {
    ok(Boolean(SCENE_LABEL_TOKENS.ru[token]), `токен «{${token}}» есть в словаре ru`)
  }
  const rendered: Record<string, string[]> = {}
  for (const locale of ['ru', 'en', 'uz'] as const) {
    const states = createLabelStates(H2O_LABELS)
    localizeSceneLabels(states, locale)
    for (const st of states) ok(!/\{\w+\}/.test(st.text), `${locale}: в подписи «${st.id}» не осталось токенов`)
    rendered[locale] = states.map((s) => s.text)
  }
  ok(rendered.ru!.join('|') !== rendered.en!.join('|'), 'русские подписи отличаются от английских')
}

section('10. Числа на подписях взяты из справочника')
{
  const byId = new Map(H2O_LABELS.map((l) => [l.id, l.keys[0]!.text]))
  ok(byId.get('dHH') === `${Math.round(bondLengthPm('H-H'))} {pm}`, 'подпись длины H–H')
  ok(byId.get('dOO') === `${Math.round(bondLengthPm('O=O'))} {pm}`, 'подпись длины O=O')
  ok(byId.get('dOH') === `${Math.round(bondLengthPm('O-H'))} {pm}`, 'подпись длины O–H')
  ok(byId.get('hbond') === `${Math.round(bondLengthPm('O-H...O'))} {pm}`, 'подпись водородной связи')
  ok(byId.get('angle') === `${H2O_GEOM.angleDeg}°`, 'подпись валентного угла')
  ok(byId.get('endo') === `+${Math.round(H2O_THERMO.breakKJ)} {kJ}`, 'подпись затрат на разрыв связей')
  ok(byId.get('dHf') === `ΔH°f = −${Math.abs(Math.round(dHfKJ('H2O(g)')))} {kJmol}`, 'подпись ΔH°f пара')
  ok(byId.get('dHl') === `H₂O ({l}): −${Math.abs(Math.round(dHfKJ('H2O(l)')))} {kJmol}`, 'подпись ΔH°f жидкости')
  // Состояния вещества проставлены: газ у реагентов и продукта, жидкость — отдельной строкой.
  ok([...byId.values()].some((t) => t.includes('H₂ ({g})')), 'водород подписан как ГАЗ')
  ok([...byId.values()].some((t) => t.includes('O₂ ({g})')), 'кислород подписан как ГАЗ')
  ok([...byId.values()].some((t) => t.includes('H₂O ({g})')), 'вода подписана как ПАР')
}

console.log(`\n${failures === 0 ? '✓' : '✗'} проверок: ${checks}, ошибок: ${failures}`)
if (failures > 0) process.exit(1)
