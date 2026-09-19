#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт урока «обжиг известняка: CaCO₃ (тв.) → CaO (тв.) + CO₂ (г.)».
 *
 * Сцена проверяется ДАННЫМИ, а не глазами: раскадровка — чистая функция
 * sampleCaoFrame(t), поэтому весь урок сэмплируется в Node.
 *
 * Что доказывает этот тест:
 *   • хронометраж: 6 шагов, 26–34 экранных секунды, cue'ы по возрастанию,
 *     контракт лаборатории embryo → birth → complete на месте;
 *   • раскадровка: дорожки монотонны, ни один ВИДИМЫЙ атом не прыгает
 *     больше чем на 0.09 ед. между кадрами 1/30 с;
 *   • кальцит: три одинаковые связи C–O 128,4 пм и углы O–C–O ровно 120°;
 *   • продукт: CO₂ строго линейная (180°) со связью 116 пм — короче карбонатной;
 *   • кислород: 66 пм в связи → 140 пм у свободного O²⁻ (более чем вдвое),
 *     кальций как был Ca²⁺ 100 пм, так и остался — степени окисления не меняются;
 *   • решётка CaO: 28 рёбер по 240,5 пм, чередование зарядов, ребро ячейки 481,1 пм;
 *   • энергия: сумма ступеней Гесса = ΔH реакции = +179,2 кДж/моль > 0 (ЭНДО),
 *     ΔS > 0 и T(ΔG = 0) ≈ 1119 K ниже температуры печи;
 *   • стехиометрия обжига и обеих реакций шага 5 сходится по атомам;
 *   • подписи локализуются (ru/en/uz), тексты есть в ru / en / uz для каждого шага.
 *
 * Запуск: npx tsx scripts/test-cao-cinema.mts
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
import { speciesRadiusPm } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import { ladderLevels } from '../src/lab/cinema/scenes/kit/energyLadderData.ts'
import {
  CAO_ATOMS,
  CAO_BONDS,
  CAO_CUES,
  CAO_END,
  CAO_GEOM,
  CAO_LABELS,
  CAO_SEGMENTS,
  CAO_STEPS,
  CAO_STEP_IDS,
  CAO_TIMING,
  ROCK_EDGES,
  createCaoFrame,
  sampleCaoFrame,
  validateCaoStoryboard,
} from '../src/lab/cinema/scenes/cao/caoStoryboard.ts'
import {
  CAO_EQUILIBRIUM_K,
  CAO_FOLLOW_UP_REACTIONS,
  CAO_KILN_C,
  CAO_LADDER,
  CAO_REACTION,
  CAO_REACTION_DH_KJ,
  CAO_REACTION_DS_J,
  CAO_SLAKING_DH_KJ,
  CAO_LIMEWATER_DH_KJ,
  validateCaoEnergetics,
} from '../src/lab/cinema/scenes/cao/caoEnergetics.ts'
import { CAO_TEXT_RU, getCaoMechanismText } from '../src/lab/cinema/scenes/cao/caoMechanismText.ts'

let checks = 0
const ok = (cond: boolean, msg: string) => {
  checks++
  assert.ok(cond, msg)
}
const near = (a: number, b: number, tol: number, msg: string) => {
  checks++
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (допуск ${tol})`)
}

/** Мировые единицы → пикометры (обратная к pmToScene). */
const PM_PER_UNIT = CAO_GEOM.data.co3Pm / CAO_GEOM.co3Len
const toPm = (u: number) => u * PM_PER_UNIT

// ─────────────────────────────────────────────────────────────────────────────
// 1. Хронометраж и контракт лаборатории
// ─────────────────────────────────────────────────────────────────────────────

CAO_TIMING.validate()
checks++

ok(CAO_STEPS.length === 6, `шагов ${CAO_STEPS.length}, ожидалось 6 ± 1`)
ok(CAO_STEP_IDS.length === CAO_STEPS.length, 'список id шагов разошёлся со списком шагов')

const wall = storyWallDuration(CAO_SEGMENTS)
ok(wall >= 26 && wall <= 34, `экранная длительность ${wall.toFixed(1)} с вне 26–34`)
near(wall, CAO_TIMING.wallDuration, 1e-9, 'wallDuration хронометража')

for (let i = 1; i < CAO_STEPS.length; i++) {
  ok(CAO_STEPS[i]!.from === CAO_STEPS[i - 1]!.to, `разрыв между шагами «${CAO_STEPS[i - 1]!.id}» и «${CAO_STEPS[i]!.id}»`)
}

const cueIds = CAO_CUES.map((c) => c.id)
for (const id of ['embryo', 'birth', 'complete']) ok(cueIds.includes(id), `нет обязательного события «${id}»`)
ok(
  cueIds.indexOf('embryo') < cueIds.indexOf('birth') && cueIds.indexOf('birth') < cueIds.indexOf('complete'),
  'порядок обязан быть embryo → birth → complete',
)
for (const c of CAO_CUES) ok(c.at >= 0 && c.at <= CAO_END, `событие «${c.id}» вне сюжета`)

// ─────────────────────────────────────────────────────────────────────────────
// 2. Раскадровка: дорожки и отсутствие скачков
// ─────────────────────────────────────────────────────────────────────────────

validateCaoStoryboard()
checks++

const frame = createCaoFrame()
const scratch = CAO_ATOMS.map((a) => ({ id: a.id, pos: new THREE.Vector3(), opacity: 0 }))

assertNoPositionJumps(
  (t) => {
    sampleCaoFrame(t, frame)
    for (let i = 0; i < CAO_ATOMS.length; i++) {
      const def = CAO_ATOMS[i]!
      scratch[i]!.pos.copy(frame.atoms[def.id]!)
      scratch[i]!.opacity = frame.opacity[def.id]!
    }
    return scratch
  },
  CAO_END,
)
checks++

// Ни одна частица не улетает за разумные пределы сцены и не уходит в NaN.
for (let t = 0; t <= CAO_END; t += 0.25) {
  sampleCaoFrame(t, frame)
  for (const a of CAO_ATOMS) {
    const p = frame.atoms[a.id]!
    ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `NaN в позиции «${a.id}» при t=${t}`)
    ok(frame.radius[a.id]! > 0, `нулевой радиус «${a.id}» при t=${t}`)
    ok(frame.opacity[a.id]! >= -1e-6 && frame.opacity[a.id]! <= 1 + 1e-6, `прозрачность «${a.id}» вне 0..1 при t=${t}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Химия кадра: кальцит, CO₂, радиусы
// ─────────────────────────────────────────────────────────────────────────────

const CARBONS = CAO_ATOMS.filter((a) => a.role === 'carbon').map((a) => a.id)
ok(CARBONS.length === 8, `карбонат-ионов ${CARBONS.length}, ожидалось 8`)

const angleDeg = (c: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number => {
  const u = new THREE.Vector3().subVectors(a, c).normalize()
  const v = new THREE.Vector3().subVectors(b, c).normalize()
  return (Math.acos(Math.min(1, Math.max(-1, u.dot(v)))) * 180) / Math.PI
}

// (а) Кальцит при t = 2 c: три ОДИНАКОВЫЕ связи C–O и углы ровно 120°.
sampleCaoFrame(2, frame)
for (const cId of CARBONS) {
  const g = cId.slice(1)
  const c = frame.atoms[cId]!
  const o = [frame.atoms[`o${g}s`]!, frame.atoms[`o${g}a`]!, frame.atoms[`o${g}b`]!]
  for (const oi of o) near(toPm(c.distanceTo(oi)), CAO_GEOM.data.co3Pm, 0.05, `C–O в CO₃²⁻ (${cId})`)
  near(angleDeg(c, o[0]!, o[1]!), 120, 0.05, `угол O–C–O (${cId})`)
  near(angleDeg(c, o[1]!, o[2]!), 120, 0.05, `угол O–C–O (${cId})`)
  near(angleDeg(c, o[2]!, o[0]!), 120, 0.05, `угол O–C–O (${cId})`)
  // Треугольник ПЛОСКИЙ: три кислорода и углерод в одной плоскости.
  const n = new THREE.Vector3()
    .subVectors(o[1]!, o[0]!)
    .cross(new THREE.Vector3().subVectors(o[2]!, o[0]!))
    .normalize()
  near(n.dot(new THREE.Vector3().subVectors(c, o[0]!)), 0, 1e-6, `группа CO₃²⁻ (${cId}) обязана быть плоской`)
}

// (б) После разрыва (t = 14,5 c): CO₂ строго линейная, связь короче карбонатной.
sampleCaoFrame(14.5, frame)
for (const cId of CARBONS) {
  const g = cId.slice(1)
  const c = frame.atoms[cId]!
  const a = frame.atoms[`o${g}a`]!
  const b = frame.atoms[`o${g}b`]!
  near(angleDeg(c, a, b), 180, 0.05, `угол O=C=O в CO₂ (${cId})`)
  near(toPm(c.distanceTo(a)), CAO_GEOM.data.co2Pm, 0.05, `C=O в CO₂ (${cId})`)
  near(toPm(c.distanceTo(b)), CAO_GEOM.data.co2Pm, 0.05, `C=O в CO₂ (${cId})`)
}
ok(CAO_GEOM.data.co2Pm < CAO_GEOM.data.co3Pm, 'связь C=O в CO₂ обязана быть короче C–O в карбонате')

// (в) Радиусы: кислород растёт вдвое, кальций не меняется вовсе.
const O_COV_PM = speciesRadiusPm('O', 0)
const O_ION_PM = speciesRadiusPm('O', -2)
const CA_ION_PM = speciesRadiusPm('Ca', 2)
near(O_COV_PM, 66, 0.001, 'ковалентный радиус кислорода')
near(O_ION_PM, 140, 0.001, 'ионный радиус O²⁻ (Shannon, КЧ 6)')
near(CA_ION_PM, 100, 0.001, 'ионный радиус Ca²⁺ (Shannon, КЧ 6)')
ok(O_ION_PM / O_COV_PM > 2, `O²⁻ / O(связ.) = ${(O_ION_PM / O_COV_PM).toFixed(2)}, ожидалось > 2`)
ok(CA_ION_PM < speciesRadiusPm('Ca', 0), 'катион Ca²⁺ обязан быть меньше атома Ca')

sampleCaoFrame(1, frame)
const oBefore = frame.radius.o0s!
const caBefore = frame.radius.ca0!
sampleCaoFrame(19.5, frame)
const oAfter = frame.radius.o0s!
const caAfter = frame.radius.ca0!
near(toPm(oBefore), O_COV_PM * 0.72, 0.01, 'кислород в карбонате рисуется ковалентным радиусом')
near(toPm(oAfter), O_ION_PM * 0.72, 0.01, 'свободный кислород рисуется ионным радиусом O²⁻')
near(caBefore, caAfter, 1e-9, 'радиус Ca²⁺ обязан быть одинаковым до и после обжига')

// (г) Решётка CaO: рёбра по 240,5 пм, всегда катион — анион.
const roleOf = new Map(CAO_ATOMS.map((a) => [a.id, a.role]))
ok(ROCK_EDGES.length === 28, `рёбер фрагмента CaO ${ROCK_EDGES.length}, ожидалось 28`)
for (const [a, b] of ROCK_EDGES) {
  const ra = roleOf.get(a)
  const rb = roleOf.get(b)
  ok((ra === 'ca' && rb === 'oxide') || (ra === 'oxide' && rb === 'ca'), `ребро ${a}–${b}: соседи обязаны быть разноимённые`)
  near(toPm(frame.atoms[a]!.distanceTo(frame.atoms[b]!)), CAO_GEOM.data.rock.caOPm, 0.05, `d(Ca–O) на ребре ${a}–${b}`)
}
near(CAO_GEOM.data.rock.caOPm * 2, CAO_GEOM.data.rock.aPm, 0.01, 'ребро ячейки CaO = 2 d(Ca–O)')
ok(CAO_GEOM.data.rock.densityGCm3 > CAO_GEOM.data.calcite.densityGCm3, 'CaO обязан быть плотнее кальцита')

// (д) Слои кальцита: соседние слои кальция стоят через c/6.
const caY = [...new Set(CAO_ATOMS.filter((a) => a.role === 'ca').map((a) => Math.round(frame.atoms[a.id]!.y * 1e4)))]
ok(caY.length >= 1, 'слои кальция не найдены')
near(toPm(CAO_GEOM.layer * 2), CAO_GEOM.data.calcite.cPm / 6, 0.05, 'расстояние между слоями Ca²⁺ = c/6')

// ─────────────────────────────────────────────────────────────────────────────
// 4. Связи кадра
// ─────────────────────────────────────────────────────────────────────────────

ok(CAO_BONDS.length === 8 * 3 + 28 + 5, `связей ${CAO_BONDS.length}, ожидалось 57`)
const byId = new Map(CAO_ATOMS.map((a) => [a.id, a]))
for (const b of CAO_BONDS) {
  ok(byId.has(b.a) && byId.has(b.b), `связь ${b.a}–${b.b} ссылается на несуществующую частицу`)
}
// Связь C–O(оставшегося) обязана исчезнуть после разрыва, а C=O — остаться.
sampleCaoFrame(2, frame)
const stayIx = CAO_BONDS.findIndex((b) => b.kind === 'stay')
const co2Ix = CAO_BONDS.findIndex((b) => b.kind === 'co2')
ok(frame.bondOpacity[stayIx]! > 0.9, 'до обжига связь C–O обязана быть видна')
sampleCaoFrame(14.5, frame)
ok(frame.bondOpacity[stayIx]! < 0.02, 'после разрыва связь C–O обязана исчезнуть')
ok(frame.bondOpacity[co2Ix]! > 0.9, 'связи C=O в CO₂ обязаны остаться')

// ─────────────────────────────────────────────────────────────────────────────
// 5. Энергетика
// ─────────────────────────────────────────────────────────────────────────────

validateCaoEnergetics()
checks++

near(CAO_REACTION_DH_KJ, 179.2, 0.05, 'ΔH обжига известняка (по ΔH°f из CRC)')
ok(CAO_REACTION_DH_KJ > 0, 'обжиг известняка — ЭНДОТЕРМИЧЕСКАЯ реакция')
near(CAO_REACTION_DS_J, 160.2, 0.05, 'ΔS° обжига (выделяется газ)')
near(CAO_EQUILIBRIUM_K, 1119, 2, 'температура ΔG° = 0')
ok(CAO_KILN_C + 273.15 > CAO_EQUILIBRIUM_K, 'печь обязана быть горячее точки равновесия')
near(CAO_SLAKING_DH_KJ, -64.5, 0.05, 'ΔH гашения извести')
near(CAO_LIMEWATER_DH_KJ, -114.7, 0.05, 'ΔH помутнения известковой воды')

near(CAO_LADDER.sumKJ, CAO_LADDER.tableKJ, 0.01, 'сумма ступеней Гесса = ΔH реакции')
ok(CAO_LADDER.stages.length === 3, `ступеней лестницы ${CAO_LADDER.stages.length}, ожидалось 3`)
const levels = ladderLevels(CAO_LADDER)
ok(levels[levels.length - 1]! > 0, 'итоговый уровень лестницы обязан быть ВЫШЕ нуля (эндотермическая реакция)')
ok(Math.max(...levels) === levels[1], 'после распада на простые вещества уровень энергии максимален')
let lastAt = -Infinity
for (const s of CAO_LADDER.stages) {
  ok(s.at >= lastAt, `ступени лестницы обязаны идти по времени сюжета: «${s.id}»`)
  ok(s.at >= 0 && s.at <= CAO_END, `ступень «${s.id}» вне сюжета`)
  lastAt = s.at
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Стехиометрия показанных уравнений
// ─────────────────────────────────────────────────────────────────────────────

const parseFormula = (f: string): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const m of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!m[1]) continue
    out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1)
  }
  return out
}
const countSide = (side: readonly { formula: string; coeff: number }[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const term of side) {
    for (const [el, n] of Object.entries(parseFormula(term.formula))) out[el] = (out[el] ?? 0) + n * term.coeff
  }
  return out
}
const assertBalanced = (name: string, left: readonly { formula: string; coeff: number }[], right: readonly { formula: string; coeff: number }[]) => {
  const l = countSide(left)
  const r = countSide(right)
  const els = new Set([...Object.keys(l), ...Object.keys(r)])
  for (const el of els) ok((l[el] ?? 0) === (r[el] ?? 0), `${name}: ${el} слева ${l[el] ?? 0}, справа ${r[el] ?? 0}`)
}

assertBalanced('CaCO₃ → CaO + CO₂', CAO_REACTION.left, CAO_REACTION.right)
for (const r of CAO_FOLLOW_UP_REACTIONS) {
  assertBalanced(`реакция «${r.id}»`, r.left, r.right)
  ok(r.dHKJ < 0, `реакция «${r.id}» обязана быть экзотермической`)
}

// Сам КАДР тоже сходится по атомам: 8 CaCO₃ → 8 CaO + 8 CO₂.
const sceneCount = (role: string) => CAO_ATOMS.filter((a) => a.role === role).length
ok(sceneCount('ca') === 8 && sceneCount('carbon') === 8 && sceneCount('oxide') === 8 && sceneCount('gas') === 16,
  `состав фрагмента: Ca ${sceneCount('ca')}, C ${sceneCount('carbon')}, O(ост.) ${sceneCount('oxide')}, O(газ) ${sceneCount('gas')}`)
ok(sceneCount('ca') === sceneCount('carbon'), 'на каждый Ca²⁺ обязан приходиться ровно один CO₃²⁻')

// ─────────────────────────────────────────────────────────────────────────────
// 7. Подписи в 3D: только токены, локализуются в ru/en/uz
// ─────────────────────────────────────────────────────────────────────────────

for (const token of labelTokensUsed(CAO_LABELS)) {
  ok(token in SCENE_LABEL_TOKENS.ru, `в словаре подписей нет токена «{${token}}»`)
}
// Состояния вещества и единицы обязаны идти ТОКЕНАМИ, а не английским текстом.
for (const def of CAO_LABELS) {
  for (const k of def.keys) {
    const bare = k.text.replace(/\{\w+\}/g, '')
    ok(!/\b(pm|kJ\/mol|kJ)\b/.test(bare), `подпись «${def.id}»: единицу надо писать токеном — «${k.text}»`)
    ok(!/\(\s*(s|g|l|aq)\s*\)/.test(bare), `подпись «${def.id}»: агрегатное состояние надо писать токеном — «${k.text}»`)
  }
}
const localized: Record<string, string[]> = {}
for (const locale of ['ru', 'en', 'uz'] as const) {
  const states = createLabelStates(CAO_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) ok(!/\{\w+\}/.test(st.text), `${locale}: подпись «${st.id}» не переведена — «${st.text}»`)
  localized[locale] = states.map((s) => s.text)
}
ok(localized.ru!.join('|') !== localized.en!.join('|'), 'русские подписи обязаны отличаться от английских')

// Подписи не должны налезать друг на друга: у одного якоря dy различаются.
const byAnchor = new Map<string, number[]>()
for (const d of CAO_LABELS) {
  const list = byAnchor.get(d.anchor) ?? []
  list.push(d.dy)
  byAnchor.set(d.anchor, list)
}
for (const [anchor, dys] of byAnchor) {
  const sorted = [...dys].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    const overlap = Math.abs(sorted[i]! - sorted[i - 1]!) < 0.4
    if (!overlap) continue
    // Наложение допустимо, только если окна видимости не пересекаются.
    const same = CAO_LABELS.filter((d) => d.anchor === anchor && (d.dy === sorted[i] || d.dy === sorted[i - 1]))
    const [x, y] = same
    if (!x || !y || x === y) continue
    const overlapped = x.windows.some((wa) => y.windows.some((wb) => wa[0] < wb[1] && wb[0] < wa[1]))
    ok(!overlapped, `подписи «${x.id}» и «${y.id}» у якоря ${anchor} налезают друг на друга`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Тексты урока в ru / en / uz
// ─────────────────────────────────────────────────────────────────────────────

for (const locale of ['ru', 'en', 'uz'] as const) {
  const text = getCaoMechanismText(locale)
  ok(text.intro.title.length > 0 && text.intro.speak.length > 0, `${locale}: нет вступления`)
  ok(text.safety.length > 30, `${locale}: нет предупреждения о безопасности`)
  ok(text.legend.electron.length > 0 && text.legend.vibration.length > 0 && text.legend.water.length > 0, `${locale}: неполная легенда`)
  for (const id of CAO_STEP_IDS) {
    const s = text.steps[id]
    ok(!!s, `${locale}: нет текста шага «${id}»`)
    ok(s!.title.length > 0, `${locale}/${id}: нет заголовка`)
    ok(s!.body.split('. ').length >= 2, `${locale}/${id}: тело шага короче двух предложений`)
    ok(s!.equation.length > 0, `${locale}/${id}: нет уравнения стадии`)
    ok(s!.speak.length > 0, `${locale}/${id}: нет реплики преподавателя`)
  }
  for (const key of ['decompose', 'co2', 'cao', 'total'] as const) {
    ok(text.energy.stages[key].length > 0, `${locale}: нет подписи ступени «${key}»`)
  }
  ok(text.energy.summary.includes('{dH}'), `${locale}: в aria-подписи лестницы нет плейсхолдера {dH}`)
}
// Каждый шаг честно называет, что нарисовано схематично.
for (const id of CAO_STEP_IDS) ok((CAO_TEXT_RU.steps[id].note ?? '').length > 20, `ru/${id}: нет честной пометки note`)
// Ключевой факт урока обязан прозвучать: это НЕ окислительно-восстановительная реакция.
ok(/не\s+окислительно/i.test(CAO_TEXT_RU.steps.release.body), 'ru: шаг «release» обязан сказать, что степени окисления не меняются')
ok(/1119|846/.test(CAO_TEXT_RU.steps.energy.body), 'ru: шаг «energy» обязан назвать температуру равновесия')

console.log(`test-cao-cinema: OK — ${checks} проверок, сцена ${wall.toFixed(1)} c / ${CAO_END} c сюжета, ΔH = +${CAO_REACTION_DH_KJ.toFixed(1)} кДж/моль`)
