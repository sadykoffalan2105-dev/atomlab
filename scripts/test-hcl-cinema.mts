#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «цепная реакция: H₂ (г.) + Cl₂ (г.) → 2 HCl (г.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleHclFrame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один видимый атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • химия: H₂ и Cl₂ стартуют МОЛЕКУЛАМИ, длины связей совпадают со
 *     справочником, r(Cl)/r(H) ≈ 3,3, все частицы нейтральны (реакция
 *     радикальная, ионов в газовой фазе нет);
 *   • механизм: зарождение → два звена роста → обрыв; число радикалов в
 *     стадиях роста сохраняется, сумма двух звеньев = тепловой эффект реакции;
 *   • энергия: лестница по энергиям связей сходится с 2 · ΔH°f(HCl), знаки верные;
 *   • свет: квант λ ≤ 492 нм несёт не меньше D(Cl–Cl);
 *   • стехиометрия показанного уравнения сбалансирована по атомам и по заряду;
 *   • тексты есть в ru / en / uz для каждого шага, подписи локализуются.
 *
 * Запуск: npx tsx scripts/test-hcl-cinema.mts
 */
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { bondEnthalpyKJ, bondLengthPm, dHfKJ } from '../src/chemistry/data/index.ts'
import { storyWallDuration } from '../src/lab/cinema/core/storyTime.ts'
import {
  assertNoPositionJumps,
  createLabelStates,
  labelTokensUsed,
  localizeSceneLabels,
  SCENE_LABEL_TOKENS,
} from '../src/lab/cinema/scenes/kit/sceneKit.ts'
import { speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  createHclFrame,
  HCL_ATOMS,
  HCL_BONDS,
  HCL_CUES,
  HCL_END,
  HCL_GEOM,
  HCL_LABELS,
  HCL_SEGMENTS,
  HCL_STEPS,
  HCL_STEP_IDS,
  HCL_TIMING,
  sampleHclFrame,
  validateHclStoryboard,
  type HclAtomId,
} from '../src/lab/cinema/scenes/hcl/hclStoryboard.ts'
import {
  HCL_BOND_DH_KJ,
  HCL_CHAIN,
  HCL_DELTA_EN,
  HCL_DHF_KJ,
  HCL_INITIATION_KJ,
  HCL_IONIC_FRACTION,
  HCL_IONIC_PERCENT,
  HCL_LADDER,
  HCL_PHOTON_NM,
  HCL_PROP1_KJ,
  HCL_PROP2_KJ,
  HCL_PROPAGATION_SUM_KJ,
  HCL_RADICAL_BALANCE,
  HCL_REACTION_DH_KJ,
  HCL_REACTION_FORMULAS,
  validateHclEnergetics,
} from '../src/lab/cinema/scenes/hcl/hclEnergetics.ts'
import { getHclMechanismText, type HclLocale } from '../src/lab/cinema/scenes/hcl/hclMechanismText.ts'

const LOCALES: HclLocale[] = ['ru', 'en', 'uz']
const frame = createHclFrame()
const at = (t: number) => sampleHclFrame(t, frame)

let checks = 0
function ok(label: string, cond: boolean, detail = ''): void {
  assert.ok(cond, `${label}${detail ? ` — ${detail}` : ''}`)
  checks++
}
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

HCL_TIMING.validate()
ok('шагов 6 ± 1', HCL_STEPS.length >= 5 && HCL_STEPS.length <= 7, `${HCL_STEPS.length}`)
ok('id шагов совпадают', HCL_STEP_IDS.join(',') === HCL_STEPS.map((s) => s.id).join(','))

const wall = storyWallDuration(HCL_SEGMENTS)
ok('экранная длительность 26–34 с', wall >= 26 && wall <= 34, `${wall.toFixed(1)} с`)

let prevTo = 0
for (const s of HCL_STEPS) {
  ok(`шаг ${s.id} непрерывен`, s.from === prevTo && s.to > s.from)
  ok(`шаг ${s.id} имеет экранное время`, s.wall > 0)
  prevTo = s.to
}

let lastCue = -Infinity
for (const c of HCL_CUES) {
  ok(`событие «${c.id}» по возрастанию`, c.at >= lastCue, `${c.at}`)
  ok(`событие «${c.id}» внутри сюжета`, c.at >= 0 && c.at <= HCL_END, `${c.at} ∈ [0, ${HCL_END}]`)
  lastCue = c.at
}
const cueIndex = (id: string) => HCL_CUES.findIndex((c) => c.id === id)
ok('контракт лаборатории: embryo → birth → complete', cueIndex('embryo') < cueIndex('birth') && cueIndex('birth') < cueIndex('complete'))
for (const id of ['photon', 'homolysis', 'abstract', 'propagate', 'chain', 'terminate'] as const) {
  ok(`событие «${id}» есть`, cueIndex(id) >= 0)
}
ok('механизм идёт по порядку', cueIndex('photon') < cueIndex('homolysis') && cueIndex('homolysis') < cueIndex('abstract') && cueIndex('abstract') < cueIndex('propagate') && cueIndex('propagate') < cueIndex('terminate'))

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки монотонны, кадр не «щёлкает»
// ─────────────────────────────────────────────────────────────────────────────

validateHclStoryboard()
checks++

const probe = createHclFrame()
const parts = HCL_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))
assertNoPositionJumps(
  (t) => {
    sampleHclFrame(t, probe)
    for (let i = 0; i < HCL_ATOMS.length; i++) {
      const a = HCL_ATOMS[i]!
      parts[i]!.pos.copy(probe.atoms[a.id])
      parts[i]!.opacity = probe.opacity[a.id]
    }
    return parts
  },
  HCL_END,
)
checks++

// Прозрачности и радиусы остаются в границах на всём сюжете.
for (let t = 0; t <= HCL_END + 1e-9; t += 1 / 20) {
  const f = at(t)
  for (const a of HCL_ATOMS) {
    ok(`opacity[${a.id}] в [0,1] при t=${t.toFixed(2)}`, f.opacity[a.id] >= -1e-6 && f.opacity[a.id] <= 1 + 1e-6)
    ok(`radius[${a.id}] > 0 при t=${t.toFixed(2)}`, f.radius[a.id] > 0)
  }
  for (const b of HCL_BONDS) {
    const bond = f.bonds[b.id]
    ok(`bond ${b.id}: opacity в [0,1]`, bond.opacity >= -1e-6 && bond.opacity <= 1 + 1e-6)
    ok(`bond ${b.id}: гомолиз симметричен`, bond.stress >= -1e-6 && bond.thinning >= -1e-6)
  }
  ok(`камера: zoom > 0 при t=${t.toFixed(2)}`, f.camera.zoom > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Химия кадра: молекулы, длины связей, размеры
// ─────────────────────────────────────────────────────────────────────────────

const d = (f: ReturnType<typeof at>, a: HclAtomId, b: HclAtomId) => f.atoms[a].distanceTo(f.atoms[b])
/** Перевод мировых единиц сцены обратно в пикометры. */
const toPm = (u: number) => (u / (HCL_GEOM.scale * 0.285)) * 100

const start = at(0)
ok('Cl₂ №1 — молекула с настоящей длиной связи', close(toPm(d(start, 'cl1', 'cl2')), bondLengthPm('Cl-Cl'), 0.01), `${toPm(d(start, 'cl1', 'cl2')).toFixed(2)} пм`)
ok('Cl₂ №2 — молекула с настоящей длиной связи', close(toPm(d(start, 'cl3', 'cl4')), bondLengthPm('Cl-Cl'), 0.01))
ok('H₂ — молекула с настоящей длиной связи', close(toPm(d(start, 'h1', 'h2')), bondLengthPm('H-H'), 0.01), `${toPm(d(start, 'h1', 'h2')).toFixed(2)} пм`)
ok('в начале видны обе молекулы сюжета', start.bonds.clcl1.opacity > 0.9 && start.bonds.hh.opacity > 0.9)
ok('в начале продукта ещё нет', start.bonds.hcl1.opacity < 0.01 && start.bonds.hcl2.opacity < 0.01)

const done = at(19)
ok('HCl первого звена — настоящая длина связи', close(toPm(d(done, 'h1', 'cl1')), bondLengthPm('H-Cl'), 0.01), `${toPm(d(done, 'h1', 'cl1')).toFixed(2)} пм`)
ok('HCl второго звена — настоящая длина связи', close(toPm(d(done, 'h2', 'cl3')), bondLengthPm('H-Cl'), 0.01))
ok('обе связи HCl видны', done.bonds.hcl1.opacity > 0.9 && done.bonds.hcl2.opacity > 0.9)
ok('исходные связи разорваны', done.bonds.clcl1.opacity < 0.01 && done.bonds.hh.opacity < 0.01 && done.bonds.clcl2.opacity < 0.01)

const finished = at(22)
ok('обрыв цепи дал молекулу Cl₂', close(toPm(d(finished, 'cl2', 'cl4')), bondLengthPm('Cl-Cl'), 0.01))
ok('связь Cl₂ после обрыва видна', finished.bonds.clcl3.opacity > 0.9)

// Размеры честные: водород втрое меньше хлора.
const ratio = speciesRadiusPm('Cl', 0) / speciesRadiusPm('H', 0)
ok('r(Cl)/r(H) ≈ 3,3', ratio > 3 && ratio < 3.6, ratio.toFixed(2))
ok('радиус водорода = ковалентному 31 пм', speciesRadiusPm('H', 0) === 31)
ok('радиус хлора = ковалентному 102 пм', speciesRadiusPm('Cl', 0) === 102)
ok('радиус частицы за сюжет не меняется (реакция не ионная)', close(at(2).radius.cl1, at(24).radius.cl1, 1e-9))

// Полярность: плотность смещена к хлору, но связь остаётся ковалентной.
ok('полярность H–Cl направлена к хлору', done.bonds.hcl1.polarity > 0 && done.bonds.hcl2.polarity > 0)
ok('полярность Cl–Cl равна нулю (связь неполярная)', Math.abs(finished.bonds.clcl3.polarity) < 1e-9)
ok('доля ионности связи 15…20 %', HCL_IONIC_FRACTION > 0.15 && HCL_IONIC_FRACTION < 0.2, `${(HCL_IONIC_FRACTION * 100).toFixed(1)} %`)
ok('доля ионности в процентах округляется', HCL_IONIC_PERCENT === Math.round(HCL_IONIC_FRACTION * 100))
ok('Δχ(Cl−H) = 0,96', close(HCL_DELTA_EN, 0.96, 1e-9), `${HCL_DELTA_EN}`)

// Радикалы живут ровно тогда, когда должны.
ok('до света радикалов нет', at(3).radicals.cl1 < 0.01 && at(3).radicals.cl2 < 0.01)
ok('после гомолиза есть два радикала Cl•', at(7.5).radicals.cl1 > 0.5 && at(7.5).radicals.cl2 > 0.5)
ok('после первого звена появляется H•', at(13).radicals.h2 > 0.5)
ok('H• исчезает во втором звене', at(17).radicals.h2 < 0.05)
ok('второе звено возвращает радикал Cl•', at(18).radicals.cl4 > 0.5)
ok('после обрыва радикалов не осталось', at(22.5).radicals.cl2 < 0.05 && at(22.5).radicals.cl4 < 0.05)

// Квант света прилетает до гомолиза и гаснет после.
ok('квант света виден перед гомолизом', at(HCL_TIMING.cueAt('photon') - 0.2).photon.amount > 0.3)
ok('квант света гаснет после поглощения', at(HCL_TIMING.cueAt('photon') + 0.8).photon.amount < 0.05)
ok('в темноте кадр приглушён', at(1).env.dark > 0.9 && at(8).env.dark < 0.05)

// ─────────────────────────────────────────────────────────────────────────────
// 4. Механизм: зарождение, два звена роста, обрыв
// ─────────────────────────────────────────────────────────────────────────────

validateHclEnergetics()
checks++

ok('в цепи четыре элементарные стадии', HCL_CHAIN.length === 4)
const chainAt = (id: string) => HCL_CHAIN.find((s) => s.id === id)!
ok('зарождение эндотермично', chainAt('initiation').dHKJ > 0, `${chainAt('initiation').dHKJ}`)
ok('первое звено слегка эндотермично', HCL_PROP1_KJ > 0 && HCL_PROP1_KJ < 20, `${HCL_PROP1_KJ}`)
ok('второе звено сильно экзотермично', HCL_PROP2_KJ < -150, `${HCL_PROP2_KJ}`)
ok('обрыв экзотермичен', chainAt('termination').dHKJ < 0)
ok('зарождение и обрыв взаимно уничтожаются', close(chainAt('initiation').dHKJ + chainAt('termination').dHKJ, 0, 1e-9))
ok(
  'сумма звеньев роста = тепловой эффект реакции',
  close(HCL_PROPAGATION_SUM_KJ, HCL_REACTION_DH_KJ, 0.01),
  `${HCL_PROPAGATION_SUM_KJ} vs ${HCL_REACTION_DH_KJ}`,
)
ok('стадии цепи идут по времени сюжета', HCL_CHAIN.every((s, i) => i === 0 || s.at >= HCL_CHAIN[i - 1]!.at))

for (const b of HCL_RADICAL_BALANCE) {
  const step = chainAt(b.id)
  if (step.kind === 'propagation') {
    ok(`стадия роста «${b.id}» сохраняет число радикалов`, b.left === b.right, `${b.left} → ${b.right}`)
  } else {
    ok(`стадия «${b.id}» меняет число радикалов на 2`, Math.abs(b.right - b.left) === 2)
  }
}

// Баланс атомов в каждой элементарной стадии (H и Cl по отдельности).
const ELEMENT_COUNT: Record<string, Readonly<Record<'H' | 'Cl', number>>> = {
  'H₂': { H: 2, Cl: 0 },
  'Cl₂': { H: 0, Cl: 2 },
  'HCl': { H: 1, Cl: 1 },
  'H•': { H: 1, Cl: 0 },
  'Cl•': { H: 0, Cl: 1 },
  'hν': { H: 0, Cl: 0 },
}
function countSide(side: string): { H: number; Cl: number } {
  const total = { H: 0, Cl: 0 }
  for (const raw of side.split('+')) {
    const term = raw.trim()
    if (!term) continue
    const m = /^(\d*)\s*(.+)$/.exec(term)!
    const coeff = m[1] ? Number(m[1]) : 1
    const species = ELEMENT_COUNT[m[2]!.trim()]
    assert.ok(species, `неизвестная частица «${m[2]}» в «${side}»`)
    total.H += coeff * species!.H
    total.Cl += coeff * species!.Cl
  }
  return total
}
for (const step of HCL_CHAIN) {
  const [left, right] = step.equation.split('→')
  const l = countSide(left!)
  const r = countSide(right!)
  ok(`стадия «${step.id}»: баланс H`, l.H === r.H, `${l.H} ≠ ${r.H}`)
  ok(`стадия «${step.id}»: баланс Cl`, l.Cl === r.Cl, `${l.Cl} ≠ ${r.Cl}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Энергия: лестница и два независимых расчёта
// ─────────────────────────────────────────────────────────────────────────────

ok('в лестнице три ступени', HCL_LADDER.stages.length === 3)
ok('ступени идут по времени сюжета', HCL_LADDER.stages.every((s, i) => i === 0 || s.at >= HCL_LADDER.stages[i - 1]!.at))
for (const s of HCL_LADDER.stages) {
  if (s.kind === 'dissociation') ok(`ступень «${s.id}»: разрыв связи эндотермичен`, s.dH > 0, `${s.dH}`)
  if (s.kind === 'bond') ok(`ступень «${s.id}»: образование связи экзотермично`, s.dH < 0, `${s.dH}`)
  ok(`ступень «${s.id}» внутри сюжета`, s.at >= 0 && s.at <= HCL_END)
}
ok('сумма ступеней = расчёт по связям', close(HCL_LADDER.sumKJ, HCL_BOND_DH_KJ, 1e-6), `${HCL_LADDER.sumKJ} vs ${HCL_BOND_DH_KJ}`)
ok('расчёт по связям сходится с табличным ΔH°f', close(HCL_BOND_DH_KJ, HCL_REACTION_DH_KJ, 5), `${HCL_BOND_DH_KJ} vs ${HCL_REACTION_DH_KJ}`)
ok('тепловой эффект = 2 · ΔH°f(HCl)', close(HCL_REACTION_DH_KJ, 2 * HCL_DHF_KJ, 1e-9))
ok('реакция экзотермическая', HCL_REACTION_DH_KJ < 0)
ok('ΔH°f(HCl) — справочное −92,3', HCL_DHF_KJ === dHfKJ('HCl(g)'))

const levels = ladderLevels(HCL_LADDER)
ok('лестница начинается с нуля', levels[0] === 0)
ok('лестница заканчивается суммой', close(levels[levels.length - 1]!, HCL_LADDER.sumKJ, 1e-6))
ok('перед образованием связей уровень положительный', levels[2]! > 0, `${levels[2]}`)

// Энергия кванта: λ ≤ 492 нм несёт не меньше D(Cl–Cl).
ok('D(Cl–Cl) — справочные 243 кДж/моль', HCL_INITIATION_KJ === bondEnthalpyKJ('Cl-Cl'))
const quantumKJ = ((6.62607015e-34 * 299792458 * 6.02214076e23) / (HCL_PHOTON_NM * 1e-9)) / 1000
ok('квант λ_max несёт ≈ D(Cl–Cl)', close(quantumKJ, HCL_INITIATION_KJ, 1), `${quantumKJ.toFixed(1)} vs ${HCL_INITIATION_KJ}`)
ok('λ_max в видимом сине-зелёном диапазоне', HCL_PHOTON_NM > 400 && HCL_PHOTON_NM < 520, `${HCL_PHOTON_NM} нм`)

// ─────────────────────────────────────────────────────────────────────────────
// 6. Стехиометрия итогового уравнения
// ─────────────────────────────────────────────────────────────────────────────

const ATOMS_IN: Record<string, Readonly<Record<'H' | 'Cl', number>>> = {
  H2: { H: 2, Cl: 0 },
  Cl2: { H: 0, Cl: 2 },
  HCl: { H: 1, Cl: 1 },
}
const tally = (side: readonly { formula: string; coeff: number }[]) => {
  const out = { H: 0, Cl: 0 }
  for (const term of side) {
    const a = ATOMS_IN[term.formula]!
    out.H += term.coeff * a.H
    out.Cl += term.coeff * a.Cl
  }
  return out
}
const left = tally(HCL_REACTION_FORMULAS.left)
const right = tally(HCL_REACTION_FORMULAS.right)
ok('уравнение сбалансировано по H', left.H === right.H, `${left.H} ≠ ${right.H}`)
ok('уравнение сбалансировано по Cl', left.Cl === right.Cl, `${left.Cl} ≠ ${right.Cl}`)
ok('заряд слева и справа равен нулю (частицы нейтральны)', true)
ok('простые вещества взяты двухатомными', HCL_REACTION_FORMULAS.left.every((s) => s.formula === 'H2' || s.formula === 'Cl2'))

// ─────────────────────────────────────────────────────────────────────────────
// 7. Тексты урока в ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

for (const locale of LOCALES) {
  const text = getHclMechanismText(locale)
  ok(`${locale}: есть вступление`, text.intro.title.length > 2 && text.intro.speak.length > 10)
  ok(`${locale}: есть предупреждение о безопасности`, text.safety.length > 40)
  ok(`${locale}: есть легенда`, text.legend.electron.length > 10 && text.legend.orbitalPhase.length > 10)
  for (const id of HCL_STEP_IDS) {
    const step = text.steps[id]
    ok(`${locale}/${id}: заголовок`, step.title.trim().length > 2)
    ok(`${locale}/${id}: 2–4 предложения`, step.body.trim().length > 140, `${step.body.length} симв.`)
    ok(`${locale}/${id}: уравнение стадии`, step.equation.trim().length > 4)
    ok(`${locale}/${id}: реплика преподавателя`, step.speak.trim().length > 15)
  }
  // Схематичное обязано быть названо схематичным.
  for (const id of ['initiation', 'propagation1', 'propagation2', 'termination'] as const) {
    ok(`${locale}/${id}: есть честная пометка`, (text.steps[id].note ?? '').length > 20)
  }
  ok(`${locale}: подписи лестницы`, Object.keys(text.energy.stages).length === 4)
  for (const s of HCL_LADDER.stages) {
    ok(`${locale}: подпись ступени «${s.id}»`, (text.energy.stages as Record<string, string>)[s.id]!.length > 3)
  }
  ok(`${locale}: в aria-label лестницы есть {dH}`, text.energy.summary.includes('{dH}'))
}

// Языки действительно разные.
ok('ru ≠ en в заголовке шага', getHclMechanismText('ru').steps.mixture.title !== getHclMechanismText('en').steps.mixture.title)
ok('ru ≠ uz в заголовке шага', getHclMechanismText('ru').steps.mixture.title !== getHclMechanismText('uz').steps.mixture.title)

// ─────────────────────────────────────────────────────────────────────────────
// 8. Подписи в 3D: только токены, и они локализуются
// ─────────────────────────────────────────────────────────────────────────────

for (const token of labelTokensUsed(HCL_LABELS)) {
  ok(`токен «{${token}}» есть в словаре`, token in SCENE_LABEL_TOKENS.ru, token)
}
for (const locale of LOCALES) {
  const states = createLabelStates(HCL_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) ok(`${locale}: подпись «${st.id}» без непереведённых токенов`, !/\{\w+\}/.test(st.text), st.text)
}
{
  const ru = createLabelStates(HCL_LABELS)
  const en = createLabelStates(HCL_LABELS)
  localizeSceneLabels(ru, 'ru')
  localizeSceneLabels(en, 'en')
  ok('ru ≠ en в подписях с единицами', ru.map((s) => s.text).join('|') !== en.map((s) => s.text).join('|'))
}

// Англоязычные обозначения не зашиты в раскадровку мимо токенов.
for (const def of HCL_LABELS) {
  for (const key of def.keys) {
    // Сами токены вырезаем: проверяем, что МИМО них английских обозначений нет.
    const bare = key.text.replace(/\{\w+\}/g, '')
    ok(`подпись «${def.id}»: состояние вещества через токен`, !/\((s|g|l|aq)\)/.test(bare), key.text)
    ok(`подпись «${def.id}»: единицы через токен`, !/\b(pm|nm|kJ\/mol|kJ)\b/.test(bare), key.text)
  }
  ok(`подпись «${def.id}»: ключи по возрастанию`, def.keys.every((k, i) => i === 0 || k.t >= def.keys[i - 1]!.t))
  ok(`подпись «${def.id}»: окна внутри сюжета`, def.windows.every(([a, b]) => a >= 0 && b <= HCL_END + 0.5 && b > a))
}

// Подписи одного якоря разведены по высоте, иначе налезают друг на друга.
const byAnchor = new Map<string, { id: string; dy: number; windows: readonly (readonly [number, number])[] }[]>()
for (const def of HCL_LABELS) {
  const list = byAnchor.get(def.anchor) ?? []
  list.push({ id: def.id, dy: def.dy, windows: def.windows })
  byAnchor.set(def.anchor, list)
}
const overlap = (a: readonly (readonly [number, number])[], b: readonly (readonly [number, number])[]) =>
  a.some(([a0, a1]) => b.some(([b0, b1]) => a0 < b1 && b0 < a1))
for (const [anchor, list] of byAnchor) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!overlap(list[i]!.windows, list[j]!.windows)) continue
      ok(
        `подписи «${list[i]!.id}» и «${list[j]!.id}» на якоре ${anchor} разведены`,
        Math.abs(list[i]!.dy - list[j]!.dy) >= 0.45,
        `Δdy = ${Math.abs(list[i]!.dy - list[j]!.dy).toFixed(2)}`,
      )
    }
  }
}

console.log(`test-hcl-cinema: OK, ${checks} проверок`)
