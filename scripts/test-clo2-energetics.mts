#!/usr/bin/env node
/**
 * ATOMLAB Cinema — энергетика, счётчик электронов и цвет раствора урока ClO₂.
 *
 * Проверяем числа, которые виджеты показывают ученику:
 *   • ΔG° = −2F·ΔE° ≈ −78 кДж/моль (−81 с E° = 0,936 В);
 *   • кажущиеся ΔG‡ по Эйрингу из констант скорости (≈ 40,2 / 44,5 / 46,8);
 *   • доли каналов Cl₂O₂ ≈ 72 : 28 (модель 2023 г.);
 *   • 54 валентных электрона на каждой стадии, 2b₁: 2 → 1;
 *   • цвет раствора из спектра — жёлтый, гуще → темнее и насыщеннее;
 *   • все три языковых пакета содержат новые разделы.
 *
 * Запуск: npx tsx scripts/test-clo2-energetics.mts
 */
import assert from 'node:assert/strict'
import {
  CLO2_2B1_RADICAL_AT,
  CLO2_2B1_SPLIT_AT,
  CLO2_CHLORATE_LEDGER,
  CLO2_ENERGETICS,
  CLO2_LEDGER_STAGES,
  CLO2_PLAYHEAD_MOVES,
  CLO2_PROFILE_MAIN,
  CLO2_PROFILE_POINTS,
  CLO2_RATE,
  CLO2_VALENCE_TOTAL,
  clo2LedgerStageAt,
  clo2OrbitalOccupancy,
  clo2OrbitalPhaseAt,
  clo2ProfilePosAt,
  clo2ProfilePosAtStepEnd,
  eyringBarrierKJ,
  eyringPrefactor,
  valenceElectrons,
} from '../src/lab/cinema/scenes/clo2/clo2Energetics.ts'
import {
  CLO2_BAND,
  CLO2_LESSON_COLOR,
  clo2Absorptivity,
  clo2SolutionColor,
  type Clo2SolutionColor,
} from '../src/lab/cinema/scenes/clo2/clo2Spectrum.ts'
import { CLO2_CUES, CLO2_END, CLO2_STEPS } from '../src/lab/cinema/scenes/clo2/clo2Steps.ts'
import { getClo2MechanismText, type Clo2Locale } from '../src/lab/cinema/scenes/clo2/clo2MechanismText.ts'

const near = (actual: number, expected: number, tol: number, msg: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} ≉ ${expected} ± ${tol}`)

const cueAt = (id: string) => CLO2_CUES.find((c) => c.id === id)!.at

// ——— Термодинамика и кинетика ———
{
  const e = CLO2_ENERGETICS
  near(e.dG0KJ, -78, 1, 'ΔG° (E° 0,954 В)')
  near(e.dG0AltKJ, -81, 1, 'ΔG° (E° 0,936 В)')
  assert.ok(e.dG0AltKJ < e.dG0KJ, 'меньший E°(ClO₂/ClO₂⁻) — реакция выгоднее')

  near(eyringPrefactor(), 6.21e12, 0.01e12, 'kB·T/h при 298,15 K')
  near(e.ts1KJ, 40.2, 0.3, 'ΔG‡ стадии 1 (k₁ = 5,7·10⁵)')
  near(e.ts1Model2023KJ, 40.5, 0.3, 'ΔG‡ стадии 1 (модель 2023 г.)')
  near(e.ts2KJ, 44.5, 0.3, 'ΔG‡ канала ClO₂')
  near(e.chlorateTsKJ, 46.8, 0.3, 'ΔG‡ хлоратного канала')
  near(e.branchGapKJ, e.chlorateTsKJ - e.ts2KJ, 1e-9, 'ΔΔG‡ = разность барьеров')
  // погрешность k₁ ±0,2·10⁵ → ΔG‡ меняется меньше чем на 0,1 кДж/моль
  near(eyringBarrierKJ(CLO2_RATE.k1 + CLO2_RATE.k1Err), e.ts1KJ, 0.1, 'чувствительность ΔG‡ к погрешности k₁')

  near(e.clo2Fraction * 100, 72, 1, 'доля канала ClO₂, %')
  near(e.chlorateFraction * 100, 28, 1, 'доля хлоратного канала, %')
  near(e.clo2Fraction + e.chlorateFraction, 1, 1e-12, 'доли в сумме 1')
  // доля по разности барьеров совпадает с долей по константам
  const R = 8.314462618e-3
  near(1 / (1 + Math.exp(-e.branchGapKJ / (R * 298.15))), e.clo2Fraction, 1e-9, 'доля из ΔΔG‡')

  near(e.halfLifeS * 1000, 0.12, 0.005, 't½ Cl₂ при 10 мМ хлорита, мс')
}

// ——— Модель профиля ———
{
  const ids = CLO2_PROFILE_POINTS.map((p) => p.id)
  assert.deepEqual(ids, ['reactants', 'ts1', 'clOclO', 'ts2', 'adduct', 'products', 'chlorateBranch'])
  const byId = Object.fromEntries(CLO2_PROFILE_POINTS.map((p) => [p.id, p]))

  assert.equal(byId.reactants!.gKJ, 0)
  assert.equal(byId.ts1!.gKJ, CLO2_ENERGETICS.ts1KJ, 'ts1 на общей шкале: его реагенты — исходные')
  assert.equal(byId.products!.gKJ, CLO2_ENERGETICS.dG0KJ)
  for (const id of ['clOclO', 'adduct'] as const) {
    assert.equal(byId[id]!.kind, 'schematic', `${id} — не измерено`)
    assert.equal(byId[id]!.gKJ, null, `${id} — на общей шкале нет значения`)
  }
  assert.equal(byId.ts2!.gKJ, null, 'ts2 отсчитан от схематичной ямы — на общей шкале не определён')
  assert.equal(byId.ts2!.barrierFrom, 'clOclO')
  near(byId.ts2!.drawKJ - byId.clOclO!.drawKJ, CLO2_ENERGETICS.ts2KJ, 1e-9, 'рисунок: пик ts2 = яма + барьер')
  assert.ok(byId.ts1!.drawKJ > byId.ts2!.drawKJ, 'рисунок не внушает, что стадия 2 медленнее стадии 1')
  assert.equal(byId.chlorateBranch!.barrierKJ, CLO2_ENERGETICS.chlorateTsKJ)
  // Конец хлоратной ветки — из табличных ΔfG° (NBS): ниже продуктов ClO₂, выбор пути — кинетический.
  near(CLO2_ENERGETICS.chlorateEndKJ, -96.25, 0.1, 'ΔG° ветки 2ClO₂⁻ + Cl₂ + H₂O → ClO₃⁻ + 2HOCl + Cl⁻')
  assert.equal(byId.chlorateBranch!.gKJ, CLO2_ENERGETICS.chlorateEndKJ)
  assert.ok(byId.chlorateBranch!.drawKJ < byId.products!.drawKJ, 'хлорат термодинамически ниже ClO₂')
  near(CLO2_ENERGETICS.clo2MolarShare, 2e5 / 2.39e5, 1e-9, 'мольная доля ClO₂ ≈ 0,84 (путь R7 даёт 2 ClO₂)')
  near(byId.chlorateBranch!.fraction!, CLO2_ENERGETICS.chlorateFraction, 1e-12, 'доля ветки')

  for (const p of CLO2_PROFILE_POINTS) {
    if (p.gKJ !== null) assert.equal(p.drawKJ, p.gKJ, `${p.id}: известный уровень рисуется как есть`)
    assert.ok(p.x >= 0 && p.x <= 1, `${p.id}: x в 0…1`)
    assert.ok(p.caveat, `${p.id}: есть оговорка`)
  }
  for (let i = 1; i < CLO2_PROFILE_MAIN.length; i++) {
    assert.ok(CLO2_PROFILE_MAIN[i]!.x > CLO2_PROFILE_MAIN[i - 1]!.x, 'основной путь идёт слева направо')
    const roles = [CLO2_PROFILE_MAIN[i - 1]!.role, CLO2_PROFILE_MAIN[i]!.role]
    assert.ok(!(roles[0] === 'maximum' && roles[1] === 'maximum'), 'между двумя пиками — яма')
  }
  const adduct = byId.adduct!
  assert.ok(byId.chlorateBranch!.x > adduct.x, 'развилка после комплекса')
}

// ——— Бегунок ———
{
  const stops = CLO2_PLAYHEAD_MOVES.flat()
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i]!.t > stops[i - 1]!.t, 'остановки бегунка идут по времени')
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i]!.pos >= stops[i - 1]!.pos, 'бегунок не едет назад')
  for (const s of stops) near(clo2ProfilePosAt(s.t), s.pos, 1e-9, `бегунок точно в остановке t=${s.t}`)

  const idx = (id: string) => CLO2_PROFILE_MAIN.findIndex((p) => p.id === id)
  const stepMid = (id: string) => {
    const s = CLO2_STEPS.find((x) => x.id === id)!
    return { from: s.from, to: s.to, mid: (s.from + s.to) / 2 }
  }
  assert.equal(clo2ProfilePosAt(stepMid('reagents').mid), idx('reactants'))
  assert.equal(clo2ProfilePosAt(stepMid('approach').mid), idx('reactants'))
  assert.equal(clo2ProfilePosAt(cueAt('clTransfer')), idx('ts1'))
  assert.equal(clo2ProfilePosAt(stepMid('intermediate').mid), idx('clOclO'))
  assert.equal(clo2ProfilePosAt(cueAt('adduct')), idx('adduct'))
  assert.equal(clo2ProfilePosAt(stepMid('products').mid), idx('products'))
  assert.equal(clo2ProfilePosAt(stepMid('balance').mid), idx('products'))
  assert.equal(clo2ProfilePosAt(CLO2_END + 5), idx('products'))

  let prev = -1
  let maxJump = 0
  for (let t = -1; t <= CLO2_END + 1; t += 1 / 120) {
    const p = clo2ProfilePosAt(t)
    assert.ok(p >= prev - 1e-12, `бегунок монотонен (t=${t.toFixed(3)})`)
    if (prev >= 0) maxJump = Math.max(maxJump, p - prev)
    prev = p
  }
  assert.ok(maxJump < 0.02, `бегунок без рывков: шаг за 1/120 с = ${maxJump}`)

  // без анимации: сразу позиция конца шага, внутри шага постоянна
  for (const s of CLO2_STEPS) {
    const end = clo2ProfilePosAt(s.to)
    for (const t of [s.from + 1e-3, (s.from + s.to) / 2, s.to]) {
      assert.equal(clo2ProfilePosAtStepEnd(t), end, `reduced motion: шаг ${s.id}`)
    }
  }
}

// ——— Валентные электроны ———
{
  assert.equal(CLO2_VALENCE_TOTAL, 54)
  const expect: Record<string, string> = {
    start: '40 + 14',
    afterClTransfer: '26 + 8 + 20',
    complex: '46 + 8',
    end: '38 + 16',
  }
  for (const s of CLO2_LEDGER_STAGES) {
    const sum = s.species.reduce((a, sp) => a + valenceElectrons(sp), 0)
    assert.equal(sum, 54, `стадия ${s.id}: ${s.formula} = ${sum}`)
    assert.equal(s.total, 54)
    assert.equal(s.breakdown, expect[s.id], `стадия ${s.id}: разложение`)
    // атомы и заряд сохраняются
    const cl = s.species.reduce((a, sp) => a + sp.count * sp.cl, 0)
    const o = s.species.reduce((a, sp) => a + sp.count * sp.o, 0)
    const q = s.species.reduce((a, sp) => a + sp.count * sp.charge, 0)
    assert.deepEqual([cl, o, q], [4, 4, -2], `стадия ${s.id}: Cl, O, заряд`)
  }
  // побочный путь: 2ClO₂⁻ + Cl₂ + H₂O → ClO₃⁻ + 2HOCl + Cl⁻ — 54 + 8 (вода)
  assert.equal(
    CLO2_CHLORATE_LEDGER.reduce((a, sp) => a + valenceElectrons(sp), 0),
    54 + valenceElectrons({ formula: 'H₂O', count: 1, cl: 0, o: 1, h: 2, charge: 0 }),
  )

  assert.equal(clo2LedgerStageAt(0), 0)
  assert.equal(clo2LedgerStageAt(cueAt('chlorideOut') - 1e-3), 0)
  assert.equal(clo2LedgerStageAt(cueAt('chlorideOut')), 1)
  assert.equal(clo2LedgerStageAt(cueAt('adduct')), 2)
  assert.equal(clo2LedgerStageAt(cueAt('split')), 3)
  assert.equal(clo2LedgerStageAt(CLO2_END), 3)

  assert.equal(CLO2_2B1_SPLIT_AT, cueAt('split'))
  assert.equal(CLO2_2B1_RADICAL_AT, cueAt('radicals'))
  assert.equal(clo2OrbitalOccupancy(clo2OrbitalPhaseAt(0)), 2, 'хлорит: 2b₁²')
  assert.equal(clo2OrbitalPhaseAt(CLO2_2B1_SPLIT_AT - 1e-3), 0)
  assert.equal(clo2OrbitalPhaseAt(CLO2_2B1_SPLIT_AT), 1)
  assert.equal(clo2OrbitalPhaseAt(CLO2_2B1_RADICAL_AT), 2)
  assert.equal(clo2OrbitalOccupancy(clo2OrbitalPhaseAt(CLO2_END)), 1, 'ClO₂: 2b₁¹')
}

// ——— Цвет раствора ———
function hsv(c: Clo2SolutionColor): { h: number; s: number; v: number } {
  const [r, g, b] = c.srgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  return { h, s: max > 0 ? d / max : 0, v: max }
}
const luminance = (c: Clo2SolutionColor) => 0.2126 * c.linearRgb[0] + 0.7152 * c.linearRgb[1] + 0.0722 * c.linearRgb[2]

{
  near(clo2Absorptivity(CLO2_BAND.lambdaMaxNm), 1250, 1e-9, 'ε в максимуме')
  near(clo2Absorptivity(1e7 / (1e7 / 359 + CLO2_BAND.fwhmCm1 / 2)), 625, 1e-6, 'ε на полуширине')

  const water = clo2SolutionColor(0, 1)
  assert.equal(water.hex, 0xffffff, 'чистая вода — белая')
  near(water.transmittanceAt(450), 1, 1e-12, 'T воды = 1')

  const lesson = CLO2_LESSON_COLOR
  const { h, s } = hsv(lesson)
  const [r, g, b] = lesson.srgb
  assert.match(lesson.css, /^#[0-9a-f]{6}$/)
  assert.equal(lesson.css, `#${lesson.hex.toString(16).padStart(6, '0')}`)
  assert.ok(h >= 40 && h <= 70, `цвет урока жёлтый: оттенок ${h.toFixed(1)}°`)
  assert.ok(b < r - 0.1 && b < g - 0.1, `синий канал заметно ниже: ${lesson.css}`)
  assert.ok(s > 0.15, `цвет урока не белый: насыщенность ${s.toFixed(2)}`)
  // Гауссова полоса с FWHM 5500 см⁻¹ режет только фиолетовый/синий — это светло-жёлтый
  // с лёгкой зеленцой (R чуть ниже G), как у жёлтых светофильтров. R ≥ G строго
  // получается у более густых растворов, где хвост полосы задевает сине-зелёный.
  assert.ok(r >= g - 0.1, `R и G почти равны (жёлтый, не зелёный): ${lesson.css}`)
  const dense = clo2SolutionColor(0.05, 1)
  assert.ok(dense.srgb[0] >= dense.srgb[1] && dense.srgb[1] > dense.srgb[2], `50 мМ: R ≥ G > B (${dense.css})`)
  const dh = hsv(dense).h
  assert.ok(dh >= 40 && dh <= 70, `50 мМ: оттенок ${dh.toFixed(1)}°`)

  near(lesson.transmittanceAt(359), Math.pow(10, -1250 * 0.005), 1e-12, 'T(359) по Бугеру — Ламберту — Беру')
  assert.ok(lesson.transmittanceAt(420) < lesson.transmittanceAt(500), 'синий поглощается сильнее зелёного')
  assert.ok(lesson.transmittanceAt(600) > 0.999, 'красный проходит')

  // гуще → темнее и насыщеннее; тот же эффект у длинной кюветы (важно только c·l)
  const series = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05].map((c) => clo2SolutionColor(c, 1))
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1]!
    const z = series[i]!
    assert.ok(z.xyz[1] < a.xyz[1], `Y падает: ${a.concMolar} → ${z.concMolar}`)
    assert.ok(luminance(z) < luminance(a), `яркость hex падает: ${a.css} → ${z.css}`)
    assert.ok(hsv(z).s > hsv(a).s, `насыщенность растёт: ${a.css} → ${z.css}`)
  }
  assert.equal(clo2SolutionColor(0.01, 1).hex, clo2SolutionColor(0.005, 2).hex, 'зависит от c·l')
  console.log(`  цвет раствора 5 мМ / 1 см: ${lesson.css}; 50 мМ: ${dense.css}`)
}

// ——— Тексты ———
{
  const locales: Clo2Locale[] = ['ru', 'en', 'uz']
  for (const loc of locales) {
    const t = getClo2MechanismText(loc)
    for (const [key, value] of Object.entries(t.energy)) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${loc}.energy.${key} заполнен`)
    }
    for (const [key, value] of Object.entries(t.ledger)) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${loc}.ledger.${key} заполнен`)
    }
    assert.ok(t.energy.mainLabel.includes('{pct}') && t.energy.branchLabel.includes('{pct}'), `${loc}: доли в подписях`)
    for (const k of ['{dG}', '{ts1}', '{ts2}', '{main}', '{side}']) assert.ok(t.energy.summary.includes(k), `${loc}.summary ${k}`)
    for (const k of ['{ts2}', '{tsCl}', '{main}', '{side}']) assert.ok(t.energy.chlorateModels.includes(k), `${loc}.chlorateModels ${k}`)
    assert.ok(t.energy.caveat.includes('{dG}') && t.energy.caveat.includes('{dGAlt}'), `${loc}.caveat ΔG°`)
    assert.ok(t.energy.halfLife.includes('{ms}'), `${loc}.halfLife`)
    assert.ok(t.energy.chlorateModels.includes('2002') && t.energy.chlorateModels.includes('2023'), `${loc}: обе модели хлората`)
    assert.ok(t.energy.sources.includes('Nicoson') && t.energy.sources.includes('2023'), `${loc}: источники`)
    for (const k of ['{n}', '{breakdown}', '{occ}']) assert.ok(t.ledger.aria.includes(k), `${loc}.ledger.aria ${k}`)
    // старые разделы на месте
    assert.ok(t.steps.split.note && t.legend.pairArrow && t.safety, `${loc}: прежний текст цел`)
  }
}

console.log('test-clo2-energetics: OK')
