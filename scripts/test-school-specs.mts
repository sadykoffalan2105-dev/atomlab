#!/usr/bin/env node
/**
 * ATOMLAB — научные спецификации школьных сцен первых 10 веществ каталога 7 класса
 * (src/lab/cinema/scenes/school/specs). Всё сверяется с научным ядром src/chemistry/data и с разметкой
 * учебников src/data/textbook/equations-g*.json; числа из текстов ИЗВЛЕКАЮТСЯ и сверяются.
 *
 *   0. Новые данные ядра: энергии N–O/N–N выведены по ΔH°f, длины упорядочены по порядку связи.
 *   1. Шаги: шесть по стандарту, по 4–7 с, всего 26–34 с.
 *   2. Реакция: баланс атомов, уравнение = сумме членов, главная ссылка есть на своей странице учебника.
 *   3. Атомы: заряд ядра, слои, внешние электроны — из ядра; неспаренные — по правилу Хунда из конфигурации.
 *   4. Частицы: состав = формуле; валентные электроны − заряд = 2·пары + 2·неподелённые + неспаренные;
 *      формальные заряды; у C, N, O не больше 8 электронов; длины/углы/диполи разрешаются в ядро; форма.
 *   5. Механизм: рвутся связи реагентов, образуются связи продуктов, донорно-акцепторная — там, где она есть.
 *   6. Валентность: «совпадает» ↔ число общих пар; «формальная» ↔ не совпадает; степени окисления в сумме = заряд.
 *   7. Тексты RU/EN/UZ: всё заполнено; каждое число шага — из ядра / условий / страниц; наборы чисел по полям равны;
 *      в шагах нет энергетики; итог = уравнение; схема слоёв = ядро.
 *   8. Химия каждой сцены: C≡O с донорно-акцепторной, NO и NO₂ — один неспаренный электрон, N₂O — N–N–O,
 *      у азота в N₂O₅ и HNO₃ четыре связи, SO₃ — 120° и μ = 0, H₂O — 104,5°.
 *
 * Запуск: npx tsx scripts/test-school-specs.mts
 */
import { readFileSync } from 'node:fs'
import {
  ATOMIC_DATA,
  BOND_ANGLES,
  BOND_DATA,
  bondLengthPm,
  DIPOLE_MOMENTS,
  dHfKJ,
  parseFormula,
  REAGENT_GEOMETRY,
  reagentAngleDeg,
  reagentBondPm,
  type ElementSymbol,
} from '../src/chemistry/data/index.ts'
import { atomLevels } from '../src/chemistry/data/electronLevels.ts'
import { ionicRadiusPm } from '../src/chemistry/data/atomicData.ts'
import {
  isTextbookRef,
  lessonText,
  pairOrigins,
  particleDipoleD,
  stepTimings,
  textbookOf,
  resolveAngleDeg,
  resolveLengthPm,
  SCHOOL_LOCALES,
  SCHOOL_SPEC_IDS,
  SCHOOL_SPECS,
  SCHOOL_STEP_IDS,
  SOLUTION_SPECS,
  SOLUTION_STEP_IDS,
  type L10n,
  type ParticleSpec,
  type SchoolScienceSpec,
  type SchoolSource,
  type TextbookRef,
} from '../src/lab/cinema/scenes/school/specs/index.ts'

let checks = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail?: unknown): void {
  checks++
  if (!cond) failures.push(detail === undefined ? name : `${name} — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

// ─────────────────────────────────────────────────────────────────────────────
// 0. Новые данные ядра
// ─────────────────────────────────────────────────────────────────────────────
{
  const N = dHfKJ('N(g)')
  const O = dHfKJ('O(g)')
  const NO = dHfKJ('NO(g)')
  const NO2 = dHfKJ('NO2(g)')
  /** ΔH°f(N₂O, г), кДж/моль — Gurvich (NIST CCCBDB); в thermoData записи нет, число названо в note связи. */
  const N2O = 81.6
  ok('E(N–O в NO₂) = атомизация NO₂ / 2', near(BOND_DATA['N-O(NO2)'].enthalpyKJ, (N + 2 * O - NO2) / 2, 0.06))
  ok('D(N–NO) = ΔH°f(N) + ΔH°f(NO) − ΔH°f(N₂O)', near(BOND_DATA['N-N(N2O)'].enthalpyKJ, N + NO - N2O, 0.05))
  ok('D(NN–O) = ΔH°f(O) − ΔH°f(N₂O)', near(BOND_DATA['N-O(N2O)'].enthalpyKJ, O - N2O, 0.05))
  for (const k of ['N-O(NO2)', 'N-N(N2O)', 'N-O(N2O)'] as const) {
    ok(`${k}: выведено — derived + note`, Boolean(BOND_DATA[k].derived && BOND_DATA[k].note))
    ok(`${k}: ΔH°f(N₂O) / вывод назван в note`, /ΔH°f|атомизац/.test(BOND_DATA[k].note ?? ''))
  }
  ok('N≡N < N–N в N₂O < N=N (порядок между 2 и 3)', bondLengthPm('N#N') < bondLengthPm('N-N(N2O)') && bondLengthPm('N-N(N2O)') < bondLengthPm('N=N'))
  ok('N–O: NO < N₂O < N–O одинарная (гидроксиламин)', bondLengthPm('N=O') < bondLengthPm('N-O(N2O)') && bondLengthPm('N-O(N2O)') < bondLengthPm('N-O'))
  ok('N–O в NO₂ (1½) длиннее, чем в NO (2½)', bondLengthPm('N-O(NO2)') > bondLengthPm('N=O'))
  ok('C≡O (CO) короче C=O (CO₂) короче C=O карбонила', bondLengthPm('C#O') < bondLengthPm('C=O(CO2)') && bondLengthPm('C=O(CO2)') < bondLengthPm('C=O'))
  ok('S=O в SO₃ короче, чем в SO₂', bondLengthPm('S=O(SO3)') < bondLengthPm('S=O'))
  ok('N₂O линейна (180°)', BOND_ANGLES.nitrousOxide.deg === 180)
  ok('угол NO₂ 134,1° — один набор с 119,3 пм', BOND_ANGLES.nitrogenDioxide.deg === 134.1 && bondLengthPm('N-O(NO2)') === 119.3)
  ok('диполи NO, NO₂, N₂O (CCCBDB)', DIPOLE_MOMENTS.NO?.debye === 0.159 && DIPOLE_MOMENTS.NO2?.debye === 0.316 && DIPOLE_MOMENTS.N2O?.debye === 0.161)
  // N₂O₅ (г): мостиковая длиннее концевой; состав по числу связей
  ok('N₂O₅: мостиковая N–O длиннее концевой', reagentBondPm('n2o5', 'N–O(мост)') > reagentBondPm('n2o5', 'N=O'))
  const n5 = REAGENT_GEOMETRY.n2o5.bondCounts
  ok('N₂O₅: 4 концевые + 1 мостиковый O = 5 O, у каждого N по 3 соседа', n5['N=O']! / 1 + n5['N–O(мост)']! / 2 === parseFormula('N2O5').O && (n5['N=O']! + n5['N–O(мост)']!) / 2 === 3)
  ok('N₂O₅: угол O=N=O близок к NO₂, N–O–N меньше', near(reagentAngleDeg('n2o5', '∠O=N=O'), BOND_ANGLES.nitrogenDioxide.deg, 1) && reagentAngleDeg('n2o5', '∠N–O–N') < 120)
  ok('кристалл N₂O₅: N–O в NO₂⁺ короче, чем в NO₃⁻', reagentBondPm('n2o5Crystal', 'N–O(NO₂⁺)') < reagentBondPm('n2o5Crystal', 'N–O(NO₃⁻)'))
  ok('HNO₃: N–OH одинарная длиннее концевых', reagentBondPm('hno3', 'N–O(H)') > reagentBondPm('hno3', 'N=O(цис)') && reagentBondPm('hno3', 'N=O(цис)') > reagentBondPm('hno3', 'N=O(транс)'))
  ok(
    'HNO₃ плоская: три угла при азоте в сумме 360°',
    near(reagentAngleDeg('hno3', '∠O=N=O') + reagentAngleDeg('hno3', '∠HO–N=O(цис)') + reagentAngleDeg('hno3', '∠HO–N=O(транс)'), 360, 0.02),
  )
  const h = REAGENT_GEOMETRY.hno3.bondCounts
  const f = parseFormula('HNO3')
  ok('HNO₃: число связей согласовано с формулой', h['N=O(цис)']! + h['N=O(транс)']! + h['N–O(H)']! === f.O && h['O–H'] === f.H)
}

// ─────────────────────────────────────────────────────────────────────────────
// Учебники: разметка уравнений по страницам
// ─────────────────────────────────────────────────────────────────────────────
type BookReaction = { page: number; equation: string; bankId: string | null }
type BookUnit = { reactions: BookReaction[] }
const books: Record<number, BookReaction[]> = {}
for (const g of [7, 8, 9]) {
  const j = JSON.parse(readFileSync(new URL(`../src/data/textbook/equations-g${g}.json`, import.meta.url), 'utf8')) as { units: BookUnit[] }
  books[g] = j.units.flatMap((u) => u.reactions)
}
/** Уравнение → канон «коэф·формула» обеих частей (без состояний и стрелок). */
function canon(eq: string): string {
  const [l, r] = eq.split(/→|⇄|⇌|=|->/).map((s) => s.trim())
  const side = (s: string) =>
    s
      .split('+')
      .map((t) => t.trim().replace(/[↑↓]/g, ''))
      .filter(Boolean)
      .map((t) => {
        const m = /^(\d*)(.*)$/.exec(t)!
        return `${m[1] || '1'}·${m[2]!.trim()}`
      })
      .sort()
      .join('+')
  return `${side(l ?? '')}=${side(r ?? '')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Извлечение чисел из текста (как в test-nacl-cinema)
// ─────────────────────────────────────────────────────────────────────────────
type Num = { v: number; dec: number; raw: string }
function numbers(s: string): Num[] {
  const out: Num[] = []
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)/g)) {
    const body = m[1]!.replace(',', '.')
    const dec = body.includes('.') ? body.split('.')[1]!.length : 0
    out.push({ v: Number(body), dec, raw: m[0] })
  }
  return out
}
const matches = (n: Num, v: number) => Math.abs(n.v - Math.round(Math.abs(v) * 10 ** n.dec) / 10 ** n.dec) < 1e-9
const isCount = (n: Num) => n.dec === 0 && n.v <= 12
const sortedNums = (s: string) =>
  numbers(s)
    .map((n) => n.v)
    .sort((a, b) => a - b)
    .join(' ')

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные
// ─────────────────────────────────────────────────────────────────────────────
const SUP: Record<string, number> = { '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6 }
/** Неспаренные электроны по конфигурации внешних подуровней (правило Хунда): '2s² 2p⁴' → 2. */
function hund(config: string): { electrons: number; unpaired: number } {
  let electrons = 0
  let unpaired = 0
  for (const m of config.matchAll(/\d([spdf])([¹²³⁴⁵⁶]+)/g)) {
    const orbitals = { s: 1, p: 3, d: 5, f: 7 }[m[1] as 's' | 'p' | 'd' | 'f']
    const e = [...m[2]!].reduce((a, ch) => a * 10 + SUP[ch]!, 0)
    electrons += e
    unpaired += e <= orbitals ? e : 2 * orbitals - e
  }
  return { electrons, unpaired }
}
const PERIOD2 = new Set<ElementSymbol>(['C', 'N', 'O'])
/** Таблица валентностей учебника 7 кл., с. 52. */
const BOOK_VALENCE_TABLE: Partial<Record<ElementSymbol, readonly number[]>> = {
  H: [1],
  Na: [1],
  O: [2],
  Cl: [1, 3, 5, 7],
  N: [1, 2, 3, 4],
  C: [2, 4],
  S: [2, 4, 6],
}

function bondPairsOf(p: ParticleSpec, atomId: string): number {
  return p.bonds.filter((b) => b.a === atomId || b.b === atomId).reduce((s, b) => s + b.pairs, 0)
}
function valenceE(el: ElementSymbol): number {
  return ATOMIC_DATA[el].valenceElectrons
}
function particleElectrons(p: ParticleSpec): number {
  return p.atoms.reduce((s, a) => s + valenceE(a.element), 0) - p.charge
}
function formula(p: ParticleSpec): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {}
  for (const a of p.atoms) out[a.element] = (out[a.element] ?? 0) + 1
  return out
}
const sameCounts = (a: Partial<Record<string, number>>, b: Partial<Record<string, number>>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0))
}
function allL10n(x: unknown, path: string, out: Array<[string, L10n]>): void {
  if (x == null || typeof x !== 'object') return
  const o = x as Record<string, unknown>
  if (typeof o.ru === 'string' && typeof o.en === 'string' && typeof o.uz === 'string' && Object.keys(o).length === 3) {
    out.push([path, o as unknown as L10n])
    return
  }
  for (const [k, v] of Object.entries(o)) allL10n(v, `${path}.${k}`, out)
}
function refsOf(spec: SchoolScienceSpec): TextbookRef[] {
  const all: SchoolSource[] = [
    ...spec.reaction.sources,
    ...(spec.reaction.heatSource ? [spec.reaction.heatSource] : []),
    ...(spec.reaction.conditions.temperatureSource ? [spec.reaction.conditions.temperatureSource] : []),
    spec.valence.schoolSource,
    ...spec.observations.map((o) => o.source),
    ...spec.uses.map((o) => o.source),
    ...spec.caveats.flatMap((c) => (c.source ? [c.source] : [])),
    ...spec.atoms.flatMap((a) => (a.excited ? [a.excited.source] : [])),
    ...spec.steps.flatMap((s) => s.sources ?? []),
  ]
  return all.filter(isTextbookRef)
}

// ─────────────────────────────────────────────────────────────────────────────
// По спецификациям
// ─────────────────────────────────────────────────────────────────────────────
const specs = SCHOOL_SPEC_IDS.map((id) => SCHOOL_SPECS[id]).filter((s): s is SchoolScienceSpec => Boolean(s))
ok('спецификации всех 10 веществ на месте', specs.length === SCHOOL_SPEC_IDS.length, `${specs.length} из ${SCHOOL_SPEC_IDS.length}: ${specs.map((s) => s.id).join(', ')}`)

for (const spec of specs) {
  const P = `[${spec.id}]`
  const byId = new Map(spec.particles.map((p) => [p.id, p]))
  ok(`${P} id совпадает с ключом`, SCHOOL_SPECS[spec.id] === spec)
  ok(`${P} вещество каталога — частица сцены`, byId.get(spec.focus)?.formula === spec.substance)

  // 1. Шаги
  ok(`${P} шесть шагов в порядке стандарта`, spec.steps.map((s) => s.id).join() === SCHOOL_STEP_IDS.join())
  for (const s of spec.steps) ok(`${P} ${s.id}: 4–7 с`, s.seconds >= 4 && s.seconds <= 7, s.seconds)
  const total = spec.steps.reduce((a, s) => a + s.seconds, 0)
  ok(`${P} всего 26–34 с`, total >= 26 && total <= 34, total)
  ok(`${P} шаг «атомы» помечен уровнем 8 (строение атома — Kimyo 8)`, spec.steps.find((s) => s.id === 'atoms')?.level === 8)

  // 2. Реакция
  const r = spec.reaction
  const left: Partial<Record<string, number>> = {}
  const right: Partial<Record<string, number>> = {}
  for (const [terms, into] of [
    [r.reactants, left],
    [r.products, right],
  ] as const) {
    for (const t of terms) {
      for (const [el, n] of Object.entries(parseFormula(t.formula))) into[el] = (into[el] ?? 0) + (n as number) * t.coef
      const p = byId.get(t.particle)
      ok(`${P} член ${t.formula}: частица ${t.particle} есть и с той же формулой`, p?.formula === t.formula)
      ok(`${P} член ${t.formula}: роль частицы`, p?.role === (terms === r.reactants ? 'reactant' : 'product'))
      if (p) ok(`${P} ${p.id}: атомы частицы = формуле`, sameCounts(formula(p), parseFormula(p.formula)), p.formula)
    }
  }
  ok(`${P} баланс атомов`, sameCounts(left, right), { left, right })
  const built = `${r.reactants.map((t) => `${t.coef > 1 ? t.coef : ''}${t.formula}`).join(' + ')} ${r.reversible ? '⇄' : '→'} ${r.products.map((t) => `${t.coef > 1 ? t.coef : ''}${t.formula}`).join(' + ')}`
  ok(`${P} уравнение = членам`, built === r.equation, `${built} | ${r.equation}`)
  {
    const main = r.sources[0]!
    const hit = books[main.grade]!.find((b) => main.pages.includes(b.page) && canon(b.equation) === canon(r.equation))
    ok(`${P} главная ссылка: реакция есть в учебнике ${main.grade} кл. на с. ${main.pages.join(', ')}`, Boolean(hit), canon(r.equation))
    if (hit && r.bankId && hit.bankId) ok(`${P} bankId = разметке учебника`, hit.bankId === r.bankId, `${hit.bankId} | ${r.bankId}`)
    for (const s of r.sources) ok(`${P} ссылка ${s.grade} кл. ${s.section}: страницы и тема`, s.pages.length > 0 && s.title.length > 3 && s.what.length > 3)
  }
  if (r.conditions.temperatureC != null) ok(`${P} температура из учебника — со ссылкой`, Boolean(r.conditions.temperatureSource))
  if (r.reversible) ok(`${P} обратимая — есть ⇄`, r.equation.includes('⇄'))

  // 3. Атомы
  const els = new Set(Object.keys(left))
  ok(`${P} атомы = элементам реакции`, spec.atoms.length === els.size && spec.atoms.every((a) => els.has(a.element)))
  for (const a of spec.atoms) {
    const d = ATOMIC_DATA[a.element]
    ok(`${P} ${a.element}: заряд ядра = z`, a.z === d.z)
    ok(`${P} ${a.element}: слои = electronLevels`, a.levels.join() === atomLevels(d.z).join())
    ok(`${P} ${a.element}: внешних = валентных электронов ядра`, a.outer === d.valenceElectrons && a.outer === a.levels[a.levels.length - 1])
    const g = hund(a.config)
    ok(`${P} ${a.element}: конфигурация даёт внешние электроны`, g.electrons === a.outer, a.config)
    ok(`${P} ${a.element}: неспаренные по Хунду`, g.unpaired === a.unpaired, `${a.config} → ${g.unpaired}`)
    if (a.excited) {
      const ge = hund(a.excited.config)
      ok(`${P} ${a.element}*: возбуждённое — те же электроны, больше неспаренных`, ge.electrons === a.outer && ge.unpaired === a.excited.unpaired && ge.unpaired > a.unpaired)
    }
    const table = BOOK_VALENCE_TABLE[a.element]
    ok(`${P} ${a.element}: валентности = таблице учебника (с. 52)`, Boolean(table) && table!.join() === a.schoolValences.join(), a.schoolValences)
  }

  // 4. Частицы
  for (const p of spec.particles) {
    const Q = `${P} ${p.id}`
    const ids = new Set(p.atoms.map((a) => a.id))
    ok(`${Q}: id атомов уникальны`, ids.size === p.atoms.length)
    for (const b of p.bonds) {
      ok(`${Q}: связь ${b.a}–${b.b} между атомами частицы`, ids.has(b.a) && ids.has(b.b) && b.a !== b.b)
      ok(`${Q}: ${b.a}–${b.b} — 1…3 общие пары`, [1, 2, 3].includes(b.pairs))
      if (b.dative) ok(`${Q}: донор ${b.dative.donor} — один из атомов связи`, b.dative.donor === b.a || b.dative.donor === b.b)
      if (b.realOrder != null) ok(`${Q}: ${b.a}–${b.b} порядок на деле в пределах ±1 от показанного`, Math.abs(b.realOrder - b.pairs) <= 1 && b.realOrder !== b.pairs)
      const el = (id: string) => p.atoms.find((a) => a.id === id)!.element
      ok(`${Q}: ${b.a}–${b.b} полярность = разные элементы`, b.polar === (el(b.a) !== el(b.b)))
      let len = NaN
      try {
        len = resolveLengthPm(b.length)
      } catch (e) {
        ok(`${Q}: длина ${b.a}–${b.b} разрешается в ядро`, false, String(e))
      }
      ok(`${Q}: длина ${b.a}–${b.b} из ядра 50–400 пм`, len > 50 && len < 400, len)
      if ('bond' in b.length) ok(`${Q}: ключ ${b.length.bond} в BOND_DATA`, Boolean(BOND_DATA[b.length.bond]))
    }
    const pairsSeen = new Set(p.bonds.map((b) => [b.a, b.b].sort().join('|')))
    ok(`${Q}: без повторных связей`, pairsSeen.size === p.bonds.length)
    for (const k of [...Object.keys(p.lonePairs), ...Object.keys(p.unpaired), ...Object.keys(p.delocalized ?? {})]) ok(`${Q}: пары/электроны у существующего атома ${k}`, ids.has(k))
    // электронный баланс
    const shared = p.bonds.reduce((s, b) => s + b.pairs, 0)
    const lp = Object.values(p.lonePairs).reduce((s, n) => s + n, 0)
    const un = Object.values(p.unpaired).reduce((s, n) => s + n, 0)
    const de = Object.values(p.delocalized ?? {}).reduce((s, n) => s + n, 0)
    ok(`${Q}: валентные электроны − заряд = 2·общие + 2·неподелённые + неспаренные`, particleElectrons(p) === 2 * shared + 2 * lp + un + de, `${particleElectrons(p)} vs ${2 * shared}+${2 * lp}+${un}+${de}`)
    let chargeSum = 0
    for (const a of p.atoms) {
      const bp = bondPairsOf(p, a.id)
      const own = 2 * (p.lonePairs[a.id] ?? 0) + (p.unpaired[a.id] ?? 0) + (p.delocalized?.[a.id] ?? 0)
      const fc = valenceE(a.element) - own - bp
      ok(`${Q}: формальный заряд ${a.id} = ${fc}`, fc === (a.charge ?? 0), `указано ${a.charge ?? 0}`)
      chargeSum += a.charge ?? 0
      const around = 2 * (bp + (p.lonePairs[a.id] ?? 0)) + (p.unpaired[a.id] ?? 0)
      if (PERIOD2.has(a.element)) ok(`${Q}: у ${a.id} (2-й период) не больше 8 электронов`, around <= 8, around)
      if (a.element === 'H') ok(`${Q}: у ${a.id} не больше 2 электронов`, around <= 2, around)
    }
    ok(`${Q}: сумма зарядов атомов = заряд частицы`, chargeSum === p.charge)
    // связность молекулы
    if (p.kind === 'molecule') {
      const seen = new Set([p.atoms[0]!.id])
      for (let i = 0; i < p.atoms.length; i++) for (const b of p.bonds) if (seen.has(b.a) || seen.has(b.b)) (seen.add(b.a), seen.add(b.b))
      ok(`${Q}: молекула связна`, seen.size === p.atoms.length)
    }
    // углы и форма
    for (const an of p.angles ?? []) {
      ok(`${Q}: угол по атомам частицы`, an.atoms.every((x) => ids.has(x)))
      const deg = resolveAngleDeg(an.ref)
      ok(`${Q}: угол из ядра 60–180°`, deg > 60 && deg <= 180, deg)
    }
    const degs = (p.angles ?? []).map((a) => resolveAngleDeg(a.ref))
    if (p.shape === 'linear') ok(`${Q}: линейная — 180°`, degs.length > 0 && degs.every((d) => d === 180))
    if (p.shape === 'bent') ok(`${Q}: угловая — угол меньше 180°`, degs.length > 0 && degs.every((d) => d < 180))
    if (p.shape === 'trigonal-planar') ok(`${Q}: треугольник — 120°`, degs.length > 0 && degs.every((d) => d === 120))
    if (p.shape === 'diatomic') ok(`${Q}: двухатомная`, p.atoms.length === 2)
    if (p.dipoleKey) {
      const d = particleDipoleD(p)
      ok(`${Q}: диполь ${p.dipoleKey} есть в ядре`, d != null)
      if (d != null) ok(`${Q}: полярность = диполю (${d} D)`, p.polarity === (d === 0 ? 'nonpolar' : 'polar'))
    }
  }

  // 5. Механизм
  const m = spec.mechanism
  const bondOf = (pid: string, a: string, b: string) => byId.get(pid)?.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
  for (const e of m.breaks) ok(`${P} рвётся ${e.particle} ${e.a}–${e.b}: связь реагента`, byId.get(e.particle)?.role === 'reactant' && Boolean(bondOf(e.particle, e.a, e.b)))
  for (const e of m.forms) {
    const b = bondOf(e.particle, e.a, e.b)
    ok(`${P} образуется ${e.particle} ${e.a}–${e.b}: связь продукта`, byId.get(e.particle)?.role === 'product' && Boolean(b))
    ok(`${P} ${e.particle} ${e.a}–${e.b}: донорно-акцепторная ↔ how`, (e.how !== 'shared-pair') === Boolean(b?.dative))
    if (b?.dative) ok(`${P} ${e.particle} ${e.a}–${e.b}: «только д-а» ↔ одна пара`, (e.how === 'dative') === (b.pairs === 1))
  }
  for (const e of m.kept ?? []) ok(`${P} сохраняется ${e.particle} ${e.a}–${e.b}`, Boolean(bondOf(e.particle, e.a, e.b)))
  for (const p of spec.particles) {
    for (const b of p.bonds) {
      const mentioned = [...m.breaks, ...m.forms, ...(m.kept ?? [])].some((e) => e.particle === p.id && ((e.a === b.a && e.b === b.b) || (e.a === b.b && e.b === b.a)))
      // Связи, которые не участвуют в сюжете, допустимы только у «зрителей» (например, H₂O в разложении NH₄NO₃ — продукт, его связи образуются)
      ok(`${P} ${p.id} ${b.a}–${b.b}: судьба связи названа (рвётся / образуется / сохраняется)`, mentioned)
    }
  }
  if (spec.bondType === 'ionic') ok(`${P} ионная связь — переход электрона`, Boolean(m.electronTransfer))
  // Раскладка электронов атома реагента перед связыванием: вклад в НЕразорванные связи + 2·пары + неспаренные
  // = внешние электроны (C* в CO₂: 0 + 0 + 4; S в SO₂ внутри SO₃: 4 + 0 + 2; акцептор O: 0 + 6 + 0).
  for (const se of m.splitElectrons ?? []) {
    const p = byId.get(se.particle)
    const at = p?.atoms.find((a) => a.id === se.atom)
    ok(`${P} splitElectrons ${se.particle}.${se.atom}: атом реагента`, p?.role === 'reactant' && Boolean(at))
    if (!p || !at) continue
    let contrib = 0
    for (const b of p.bonds) {
      if (b.a !== at.id && b.b !== at.id) continue
      if (m.breaks.some((e) => e.particle === p.id && ((e.a === b.a && e.b === b.b) || (e.a === b.b && e.b === b.a)))) continue
      for (const o of pairOrigins(b)) contrib += o === 'ab' ? 1 : (o === 'a') === (b.a === at.id) ? 2 : 0
    }
    ok(`${P} splitElectrons ${se.particle}.${se.atom}: электроны сходятся`, contrib + 2 * se.lone + se.unpaired === ATOMIC_DATA[at.element].valenceElectrons, `${contrib} + 2·${se.lone} + ${se.unpaired}`)
  }

  // 6. Валентность
  {
    const v = spec.valence
    const p = byId.get(v.particle)
    ok(`${P} валентность — к частице сцены`, Boolean(p))
    if (p) {
      for (const [el, school] of Object.entries(v.school) as Array<[ElementSymbol, number]>) {
        const atoms = p.atoms.filter((a) => a.element === el)
        const verdict = v.verdict[el]
        ok(`${P} ${el}: валентность ${school} есть в таблице учебника`, (BOOK_VALENCE_TABLE[el] ?? []).includes(school) || verdict === 'formal')
        if (verdict === 'match') ok(`${P} ${el}: «совпадает» — у каждого атома ${school} общих пар`, atoms.length > 0 && atoms.every((a) => bondPairsOf(p, a.id) === school))
        if (verdict === 'formal') ok(`${P} ${el}: «формальная» — число пар ≠ ${school}`, atoms.some((a) => bondPairsOf(p, a.id) !== school))
        if (verdict === 'ionic') ok(`${P} ${el}: «ионная» — |заряд иона| = ${school}`, atoms.every((a) => Math.abs(a.charge ?? 0) === school))
        ok(`${P} ${el}: вердикт указан`, Boolean(verdict))
      }
      const ox = Object.entries(v.oxidation).reduce((s, [el, n]) => s + (n as number) * p.atoms.filter((a) => a.element === el).length, 0)
      ok(`${P} степени окисления в сумме = заряд частицы`, ox === p.charge, ox)
    }
  }

  // 7. Тексты
  const l10n: Array<[string, L10n]> = []
  allL10n(spec, spec.id, l10n)
  for (const [path, t] of l10n) {
    for (const loc of SCHOOL_LOCALES) ok(`${path} [${loc}] заполнено`, t[loc].trim().length > 0)
    ok(`${path}: числа RU/EN/UZ совпадают`, sortedNums(t.ru) === sortedNums(t.en) && sortedNums(t.ru) === sortedNums(t.uz), `${sortedNums(t.ru)} | ${sortedNums(t.en)} | ${sortedNums(t.uz)}`)
  }
  const allowed: number[] = []
  for (const a of spec.atoms) allowed.push(a.z)
  for (const p of spec.particles) {
    allowed.push(particleElectrons(p))
    for (const b of p.bonds) allowed.push(resolveLengthPm(b.length))
    for (const an of p.angles ?? []) allowed.push(resolveAngleDeg(an.ref))
    const d = particleDipoleD(p)
    if (d != null) allowed.push(d)
  }
  if (r.conditions.temperatureC != null) allowed.push(r.conditions.temperatureC)
  for (const t of refsOf(spec)) allowed.push(...t.pages, t.grade, ...numbers(t.section).map((n) => n.v))
  for (const s of spec.steps) {
    for (const loc of SCHOOL_LOCALES) {
      const tx = s.text[loc]
      for (const k of ['title', 'body', 'equation', 'note', 'speak'] as const) {
        ok(`${P} ${s.id} [${loc}] ${k} заполнено`, tx[k].trim().length > 0)
        for (const n of numbers(tx[k])) {
          if (isCount(n)) continue
          ok(`${P} ${s.id} [${loc}] ${k}: число ${n.raw} из ядра / условий / страниц`, allowed.some((v) => matches(n, v)), tx[k].slice(0, 90))
        }
      }
      ok(`${P} ${s.id} [${loc}]: без энергетики`, !/кДж|kJ|ΔH|Дж\b/.test(JSON.stringify(tx)))
    }
    for (const k of ['title', 'body', 'equation', 'note', 'speak'] as const) {
      ok(`${P} ${s.id}.${k}: числа RU/EN/UZ совпадают`, sortedNums(s.text.ru[k]) === sortedNums(s.text.en[k]) && sortedNums(s.text.ru[k]) === sortedNums(s.text.uz[k]), `${sortedNums(s.text.ru[k])} | ${sortedNums(s.text.en[k])} | ${sortedNums(s.text.uz[k])}`)
    }
    ok(`${P} ${s.id}: что показать — описано`, s.show.length > 0)
  }
  // Числа вне шагов (оговорки, наблюдения, пояснения) — из ядра, страниц или СВОЕГО источника (строка ссылки
  // обязана содержать число: «t кип. −21,3 °С» учебника, «99,2 %» и т. п.).
  const srcNums = (s?: SchoolSource): number[] =>
    s ? numbers(isTextbookRef(s) ? `${s.what} ${s.asInBook ?? ''} ${s.pages.join(' ')} ${s.section}` : s.reference).map((n) => n.v) : []
  const checkNums = (label: string, t: L10n, extra: number[]) => {
    for (const n of numbers(t.ru)) {
      if (isCount(n)) continue
      ok(`${P} ${label}: число ${n.raw} — из ядра, страницы или источника`, allowed.some((v) => matches(n, v)) || extra.some((v) => matches(n, v)), t.ru.slice(0, 100))
    }
  }
  for (const c of spec.caveats) checkNums(`оговорка ${c.id}`, c.text, [...srcNums(c.source), ...srcNums(c.evidence)])
  for (const c of spec.caveats) if (c.kind === 'textbook-error') ok(`${P} оговорка ${c.id}: ошибка учебника — со ссылкой на учебник`, Boolean(c.source && isTextbookRef(c.source)))
  for (const o of [...spec.observations, ...spec.uses]) checkNums('наблюдение', o.text, srcNums(o.source))
  checkNums('условия', r.conditions.text, [...srcNums(r.conditions.temperatureSource), ...r.sources.flatMap((s) => srcNums(s))])
  checkNums('валентность', spec.valence.explain, srcNums(spec.valence.schoolSource))
  checkNums('безопасность', spec.safety, [])
  checkNums('вступление', spec.intro.speak, [])
  for (const p of spec.particles) {
    if (p.resonance) (checkNums(`${p.id} показ`, p.resonance.show, []), checkNums(`${p.id} на деле`, p.resonance.real, []))
    if (p.schematic) checkNums(`${p.id} схема`, p.schematic, [])
  }
  // Подписи в 3D — числа только из ядра; легенда и подписи на трёх языках (равенство чисел — выше, allL10n).
  checkNums('подпись реагентов', spec.captions.reactants, [])
  checkNums('подпись итога', spec.captions.result, [])
  if (spec.captions.condition) checkNums('подпись условия', spec.captions.condition, [])
  // Мост к движку A: тексты урока и время шагов.
  for (const loc of SCHOOL_LOCALES) {
    const lt = lessonText(spec, loc)
    ok(`${P} [${loc}] lessonText: шесть шагов движка`, SCHOOL_STEP_IDS.every((id) => lt.steps[id]?.title.length > 0))
    ok(`${P} [${loc}] lessonText: легенда заполнена`, Object.values(lt.legend).every((s) => s.length > 0))
  }
  {
    const tm = stepTimings(spec)
    ok(`${P} время шагов сплошное и = сумме длительностей`, tm.every((x, i) => i === 0 || x.from === tm[i - 1]!.to) && near(tm[tm.length - 1]!.to, total, 1e-9))
    const tb = textbookOf(spec)
    ok(`${P} textbookOf = главная ссылка`, tb.grade === r.sources[0]!.grade && tb.page === r.sources[0]!.pages[0])
  }
  // Учёт электронов «по-движковому» (агент A): вклад в пары ('ab' — 1, донор 'a'/'b' — 2) + 2·неподелённые
  // + неспаренные = электроны внешнего слоя НЕЙТРАЛЬНОГО атома. Для нейтральных молекул это обязано сходиться —
  // иначе донорно-акцепторные пары размечены не там.
  for (const p of spec.particles) {
    if (p.kind !== 'molecule' || p.charge !== 0) continue
    for (const a of p.atoms) {
      let contrib = 0
      for (const b of p.bonds) {
        if (b.a !== a.id && b.b !== a.id) continue
        for (const o of pairOrigins(b)) contrib += o === 'ab' ? 1 : (o === 'a') === (b.a === a.id) ? 2 : 0
      }
      const total2 = contrib + 2 * (p.lonePairs[a.id] ?? 0) + (p.unpaired[a.id] ?? 0)
      ok(`${P} ${p.id} ${a.id}: учёт движка — ${ATOMIC_DATA[a.element].valenceElectrons} внешних электронов`, total2 === ATOMIC_DATA[a.element].valenceElectrons, total2)
    }
  }
  const sum = spec.steps.find((s) => s.id === 'result')!
  for (const loc of SCHOOL_LOCALES) ok(`${P} итог [${loc}] = уравнение реакции`, sum.text[loc].equation === r.equation, sum.text[loc].equation)
  const atomsStep = spec.steps.find((s) => s.id === 'atoms')!
  for (const a of spec.atoms) {
    for (const loc of SCHOOL_LOCALES) ok(`${P} схема слоёв ${a.element} [${loc}] = ядру`, atomsStep.text[loc].equation.includes(`${a.element} (+${a.z}): ${a.levels.join(', ')}`), atomsStep.text[loc].equation)
  }
  ok(`${P} есть оговорки`, spec.caveats.length > 0)
  ok(`${P} есть наблюдения`, spec.observations.length > 0)
  ok(`${P} id оговорок уникальны`, new Set(spec.caveats.map((c) => c.id)).size === spec.caveats.length)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Химия каждой сцены — адресные проверки
// ─────────────────────────────────────────────────────────────────────────────
const S = (id: string) => SCHOOL_SPECS[id as keyof typeof SCHOOL_SPECS]
const particle = (id: string, pid: string) => S(id)?.particles.find((p) => p.id === pid)
const unpairedTotal = (p?: ParticleSpec) => Object.values(p?.unpaired ?? {}).reduce((s, n) => s + n, 0)
{
  const w = particle('h2o', 'H2O')
  if (w) ok('H₂O: угол 104,5° и две неподелённые пары у O', resolveAngleDeg(w.angles![0]!.ref) === 104.5 && w.lonePairs.Ow === 2)
  const c2 = particle('co2', 'CO2')
  if (c2) ok('CO₂: O=C=O, 180°, μ = 0, у C нет неподелённых пар', c2.bonds.every((b) => b.pairs === 2) && resolveAngleDeg(c2.angles![0]!.ref) === 180 && particleDipoleD(c2) === 0 && !(c2.lonePairs.C ?? 0))
  const co = particle('co', 'CO')
  if (co) {
    const b = co.bonds[0]!
    ok('CO: тройная связь, одна пара — донорно-акцепторная от O', b.pairs === 3 && b.dative?.donor === co.atoms.find((a) => a.element === 'O')!.id)
    ok('CO: по одной неподелённой паре у C и O', Object.values(co.lonePairs).every((n) => n === 1) && Object.keys(co.lonePairs).length === 2)
    ok('CO: длина C≡O из ядра (112,8)', resolveLengthPm(b.length) === bondLengthPm('C#O'))
  }
  const so2 = particle('so2', 'SO2')
  if (so2) ok('SO₂: угловая 119,5°, неподелённая пара у S', resolveAngleDeg(so2.angles![0]!.ref) === 119.5 && so2.lonePairs.S === 1)
  const so3 = particle('so3', 'SO3')
  if (so3) ok('SO₃: плоский треугольник 120°, μ = 0, у S нет неподелённых пар', resolveAngleDeg(so3.angles![0]!.ref) === 120 && particleDipoleD(so3) === 0 && !(so3.lonePairs.S ?? 0))
  if (S('so3')) ok('SO₃: катализатор V₂O₅ и обратимость', S('so3')!.reaction.conditions.catalyst === 'V₂O₅' && S('so3')!.reaction.reversible)
  const no = particle('no', 'NO')
  if (no) ok('NO: 11 электронов, один неспаренный', particleElectrons(no) === 11 && unpairedTotal(no) === 1)
  if (S('no')) {
    ok('NO: реакция эндотермическая, нужна молния / высокая температура', S('no')!.reaction.heat === 'endo' && Boolean(S('no')!.reaction.conditions.electricDischarge))
    ok('NO: тройная связь N≡N рвётся', S('no')!.mechanism.breaks.some((e) => e.particle === 'N2'))
  }
  const no2 = particle('no2', 'NO2')
  if (no2) {
    ok('NO₂: 17 электронов, один неспаренный — у азота', particleElectrons(no2) === 17 && unpairedTotal(no2) === 1 && (no2.unpaired[no2.atoms.find((a) => a.element === 'N')!.id] ?? 0) === 1)
    ok('NO₂: угол 134,1°, две равные связи из ядра', resolveAngleDeg(no2.angles![0]!.ref) === 134.1 && no2.bonds.every((b) => resolveLengthPm(b.length) === bondLengthPm('N-O(NO2)')))
  }
  const n2o = particle('n2o', 'N2O')
  if (n2o) {
    const o = n2o.atoms.find((a) => a.element === 'O')!
    const nb = (id: string) => n2o.bonds.filter((b) => b.a === id || b.b === id).length
    ok('N₂O: порядок атомов N–N–O (O концевой, центральный — N)', nb(o.id) === 1 && n2o.atoms.filter((a) => a.element === 'N').some((a) => nb(a.id) === 2))
    ok('N₂O: есть донорно-акцепторная пара N→O', n2o.bonds.some((b) => b.dative && n2o.atoms.find((a) => a.id === b.dative!.donor)!.element === 'N'))
    ok('N₂O: линейная, μ ≠ 0', resolveAngleDeg(n2o.angles![0]!.ref) === 180 && (particleDipoleD(n2o) ?? 0) > 0)
  }
  for (const [sid, pid] of [
    ['n2o5', 'N2O5'],
    ['n2o5', 'HNO3'],
  ] as const) {
    const p = particle(sid, pid)
    if (p) for (const a of p.atoms.filter((x) => x.element === 'N')) ok(`${pid}: у азота ${a.id} четыре общие пары (не пять)`, bondPairsOf(p, a.id) === 4)
  }
  if (S('n2o5')) ok('N₂O₅: школьная валентность V — формальная', S('n2o5')!.valence.school.N === 5 && S('n2o5')!.valence.verdict.N === 'formal')
  if (S('co')) ok('CO: школьная валентность C II — формальная', S('co')!.valence.school.C === 2 && S('co')!.valence.verdict.C === 'formal')
  const nacl = particle('nacl', 'NaCl')
  if (nacl) ok('NaCl: ионы Na⁺ и Cl⁻, связей-пар нет', nacl.bonds.length === 0 && nacl.atoms.some((a) => a.charge === 1) && nacl.atoms.some((a) => a.charge === -1))
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Обмен в растворе (BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl): ионы, вода, осадок
// ─────────────────────────────────────────────────────────────────────────────
const SUP_DIGIT: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
/** Сумма зарядов стороны ионного уравнения: «Ba²⁺ + 2Cl⁻» → 0. */
function ionicSideCharge(side: string): number {
  let q = 0
  for (const raw of side.split(' + ')) {
    const t = raw.trim().replace(/[↓↑]/g, '')
    const m = /^(\d*)(.*?)([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])?$/.exec(t)!
    const coef = Number(m[1] || '1')
    const mag = m[4] ? Number([...m[3]!].map((c) => SUP_DIGIT[c]).join('') || '1') : 0
    q += coef * (m[4] === '⁻' ? -mag : mag)
  }
  return q
}
const solutionSpecs = Object.values(SOLUTION_SPECS)
ok('обмен в растворе: спецификация BaSO₄ на месте', solutionSpecs.length === 1 && SOLUTION_SPECS.baso4?.id === 'baso4')
for (const spec of solutionSpecs) {
  const P = `[${spec.id}]`
  const byId = new Map(spec.particles.map((p) => [p.id, p]))
  ok(`${P} вещество каталога — осадок`, byId.get(spec.focus)?.formula === spec.substance && byId.get(spec.focus)?.kind === 'precipitate')
  // шаги
  ok(`${P} шесть шагов обмена в растворе`, spec.steps.map((s) => s.id).join() === SOLUTION_STEP_IDS.join())
  for (const s of spec.steps) ok(`${P} ${s.id}: 4–7 с`, s.seconds >= 4 && s.seconds <= 7, s.seconds)
  const total = spec.steps.reduce((a, s) => a + s.seconds, 0)
  ok(`${P} всего 26–34 с`, total >= 26 && total <= 34, total)
  // реакция: баланс атомов по формулам, уравнение = членам
  const r = spec.reaction
  const left: Partial<Record<string, number>> = {}
  const right: Partial<Record<string, number>> = {}
  const WATER = parseFormula('H2O')
  for (const [terms, into, side] of [
    [r.reactants, left, 'reactant'],
    [r.products, right, 'product'],
  ] as const) {
    for (const t of terms) {
      const f = parseFormula(t.formula)
      for (const [el, n] of Object.entries(f)) into[el] = (into[el] ?? 0) + (n as number) * t.coef
      // формула + water·H₂O = атомы частиц раствора; сумма зарядов частиц = 0
      const want: Partial<Record<string, number>> = { ...f }
      for (const [el, n] of Object.entries(WATER)) want[el] = (want[el] ?? 0) + (n as number) * (t.water ?? 0)
      const got: Partial<Record<string, number>> = {}
      let q = 0
      for (const x of t.particles) {
        const p = byId.get(x.particle)
        ok(`${P} ${t.formula}: частица ${x.particle} есть`, Boolean(p))
        if (!p) continue
        if (side === 'product' && p.kind === 'precipitate') ok(`${P} ${t.formula}: осадок — продукт`, p.role === 'product')
        for (const a of p.atoms) got[a.element] = (got[a.element] ?? 0) + x.count
        q += p.charge * x.count
      }
      ok(`${P} ${t.formula} + ${t.water ?? 0}H₂O = частицам раствора`, sameCounts(want, got), { want, got })
      ok(`${P} ${t.formula}: сумма зарядов частиц = 0`, q === 0, q)
      ok(`${P} ${t.formula}: осадок помечен ↓ ↔ частица-осадок`, Boolean(t.precipitate) === t.particles.some((x) => byId.get(x.particle)?.kind === 'precipitate'))
    }
  }
  ok(`${P} баланс атомов`, sameCounts(left, right), { left, right })
  const term = (t: { coef: number; formula: string; precipitate?: boolean }) => `${t.coef > 1 ? t.coef : ''}${t.formula}${t.precipitate ? '↓' : ''}`
  const built = `${r.reactants.map(term).join(' + ')} → ${r.products.map(term).join(' + ')}`
  ok(`${P} уравнение = членам`, built === r.equation, `${built} | ${r.equation}`)
  {
    const main = r.sources[0]!
    const hit = books[main.grade]!.find((b) => main.pages.includes(b.page) && canon(b.equation) === canon(r.equation))
    ok(`${P} главная ссылка: реакция есть в учебнике ${main.grade} кл. на с. ${main.pages.join(', ')}`, Boolean(hit), canon(r.equation))
    if (hit) ok(`${P} bankId = разметке учебника`, hit.bankId === r.bankId, `${hit.bankId} | ${r.bankId}`)
    for (const g of [8, 9] as const) ok(`${P} источник ${g} кл. есть`, r.sources.some((x) => x.grade === g))
    const g8 = r.sources.find((x) => x.grade === 8)!
    ok(`${P} 8 кл. § 32: реакция есть в разметке на с. 139`, books[8]!.some((b) => g8.pages.includes(b.page) && canon(b.equation) === canon(r.equation)))
    for (const s of r.sources) ok(`${P} ссылка ${s.grade} кл. ${s.section}: страницы и тема`, s.pages.length > 0 && s.title.length > 3 && s.what.length > 3)
  }
  ok(`${P} без нагревания`, r.conditions.heating === false)
  // ионные уравнения: заряды сторон сходятся
  for (const eq of [r.ionicFull, r.ionicShort]) {
    const [l, rr] = eq.split('→')
    ok(`${P} ионное «${eq}»: сумма зарядов слева = справа = 0`, ionicSideCharge(l!) === 0 && ionicSideCharge(rr!) === 0, `${ionicSideCharge(l!)} | ${ionicSideCharge(rr!)}`)
  }
  ok(`${P} сокращённое ионное = Ba²⁺ + SO₄²⁻ → BaSO₄↓`, r.ionicShort === 'Ba²⁺ + SO₄²⁻ → BaSO₄↓')
  // частицы: электроны, формальные заряды, длины и углы — в ядро
  for (const p of spec.particles) {
    const Q = `${P} ${p.id}`
    const ids = new Set(p.atoms.map((a) => a.id))
    ok(`${Q}: состав = формуле`, sameCounts(formula(p), parseFormula(p.formula.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, ''))), p.formula)
    const shared = p.bonds.reduce((acc, b) => acc + b.pairs, 0)
    const lp = Object.values(p.lonePairs).reduce((acc, n) => acc + n, 0)
    const un = Object.values(p.unpaired).reduce((acc, n) => acc + n, 0)
    ok(`${Q}: валентные электроны − заряд = 2·общие + 2·неподелённые + неспаренные`, particleElectrons(p) === 2 * shared + 2 * lp + un)
    let chargeSum = 0
    for (const a of p.atoms) {
      const bp = bondPairsOf(p, a.id)
      const fc = valenceE(a.element) - 2 * (p.lonePairs[a.id] ?? 0) - (p.unpaired[a.id] ?? 0) - bp
      ok(`${Q}: формальный заряд ${a.id} = ${fc}`, fc === (a.charge ?? 0), `указано ${a.charge ?? 0}`)
      chargeSum += a.charge ?? 0
      const around = 2 * (bp + (p.lonePairs[a.id] ?? 0)) + (p.unpaired[a.id] ?? 0)
      if (PERIOD2.has(a.element)) ok(`${Q}: у ${a.id} не больше 8 электронов`, around <= 8, around)
    }
    ok(`${Q}: сумма зарядов атомов = заряд частицы`, chargeSum === p.charge)
    for (const b of p.bonds) {
      ok(`${Q}: связь ${b.a}–${b.b} внутри частицы`, ids.has(b.a) && ids.has(b.b))
      const len = resolveLengthPm(b.length)
      ok(`${Q}: длина ${b.a}–${b.b} из ядра`, len > 50 && len < 400, len)
    }
    for (const an of p.angles ?? []) ok(`${Q}: угол из ядра`, resolveAngleDeg(an.ref) > 60 && resolveAngleDeg(an.ref) <= 180)
    if (p.kind === 'ion' || p.kind === 'precipitate') ok(`${Q}: ион/осадок — ионная полярность`, p.polarity === 'ionic')
  }
  const so4 = byId.get('SO4')!
  ok(`${P} SO₄²⁻: 4 одинаковые S–O из ядра, резонанс не рисуется`, so4.bonds.length === 4 && so4.bonds.every((b) => b.pairs === 1 && resolveLengthPm(b.length) === reagentBondPm('sulfate', 'S–O') && b.realOrder === 1.5) && Boolean(so4.resonance))
  ok(`${P} SO₄²⁻: тетраэдр 109,47°`, so4.shape === 'tetrahedral' && resolveAngleDeg(so4.angles![0]!.ref) === reagentAngleDeg('sulfate', '∠O–S–O'))
  const h3o = byId.get('H3O')!
  ok(`${P} H₃O⁺: пирамида, O–H и угол из ядра (Tang & Oka)`, h3o.shape === 'pyramidal' && resolveLengthPm(h3o.bonds[0]!.length) === reagentBondPm('hydronium', 'O–H') && resolveAngleDeg(h3o.angles![0]!.ref) < 120)
  const baso4 = byId.get('BaSO4')!
  ok(`${P} BaSO₄: без связей Ba–O (ионный кристалл)`, baso4.bonds.every((b) => b.a !== 'Ba' && b.b !== 'Ba') && baso4.charge === 0)
  // вода: реальные и показанные оболочки; ориентация по знаку заряда
  for (const h of spec.hydration) {
    const p = byId.get(h.particle)
    ok(`${P} оболочка ${h.particle}: частица есть`, Boolean(p))
    ok(`${P} оболочка ${h.particle}: показано ≤ реального`, h.shown >= 1 && h.shown <= h.realCount)
    if (p) ok(`${P} оболочка ${h.particle}: к катиону O, к аниону H`, h.facing === (p.charge > 0 ? 'O' : 'H'))
  }
  // тексты: заполнены, числа RU/EN/UZ совпадают, числа — из ядра / страниц / facts, без энергетики
  const l10n: Array<[string, L10n]> = []
  allL10n(spec, spec.id, l10n)
  for (const [path, t] of l10n) {
    for (const loc of SCHOOL_LOCALES) ok(`${path} [${loc}] заполнено`, t[loc].trim().length > 0)
    ok(`${path}: числа RU/EN/UZ совпадают`, sortedNums(t.ru) === sortedNums(t.en) && sortedNums(t.ru) === sortedNums(t.uz), `${sortedNums(t.ru)} | ${sortedNums(t.en)} | ${sortedNums(t.uz)}`)
  }
  const allowed: number[] = []
  for (const p of spec.particles) {
    for (const b of p.bonds) allowed.push(resolveLengthPm(b.length))
    for (const an of p.angles ?? []) allowed.push(resolveAngleDeg(an.ref))
    for (const a of p.atoms) {
      if (!a.charge || p.kind === 'molecule') continue
      for (const cn of [6, 8, 12]) {
        const rr = ionicRadiusPm(a.element, a.charge, cn)
        if (rr != null) allowed.push(rr)
      }
    }
  }
  for (const f of spec.facts) {
    allowed.push(f.value)
    ok(`${P} число ${f.id} названо в источнике`, numbers(isTextbookRef(f.source) ? f.source.what : f.source.reference).some((n) => matches(n, f.value)), f.value)
  }
  for (const h of spec.hydration) allowed.push(h.realCount, h.shown)
  const refs = [...r.sources, ...spec.steps.flatMap((s) => (s.sources ?? []).filter(isTextbookRef)), ...spec.caveats.flatMap((c) => (c.source && isTextbookRef(c.source) ? [c.source] : []))]
  for (const t of refs) allowed.push(...t.pages, t.grade, ...numbers(t.section).map((n) => n.v))
  const srcNums = (x?: SchoolSource): number[] =>
    x ? numbers(isTextbookRef(x) ? `${x.what} ${x.asInBook ?? ''} ${x.pages.join(' ')} ${x.section}` : x.reference).map((n) => n.v) : []
  for (const s of spec.steps) {
    for (const loc of SCHOOL_LOCALES) {
      const tx = s.text[loc]
      for (const k of ['title', 'body', 'equation', 'note', 'speak'] as const) {
        ok(`${P} ${s.id} [${loc}] ${k} заполнено`, tx[k].trim().length > 0)
        for (const n of numbers(tx[k])) {
          if (isCount(n)) continue
          ok(`${P} ${s.id} [${loc}] ${k}: число ${n.raw} из ядра / страниц / facts`, allowed.some((v) => matches(n, v)), tx[k].slice(0, 90))
        }
      }
      ok(`${P} ${s.id} [${loc}]: без энергетики`, !/кДж|kJ|ΔH|Дж\b/.test(JSON.stringify(tx)))
    }
    ok(`${P} ${s.id}: что показать — описано`, s.show.length > 0)
  }
  for (const c of spec.caveats) {
    for (const n of numbers(c.text.ru)) {
      if (isCount(n)) continue
      ok(`${P} оговорка ${c.id}: число ${n.raw} — из ядра, страницы или источника`, allowed.some((v) => matches(n, v)) || [...srcNums(c.source), ...srcNums(c.evidence)].some((v) => matches(n, v)), c.text.ru.slice(0, 100))
    }
  }
  for (const loc of SCHOOL_LOCALES) ok(`${P} итог [${loc}] = уравнение реакции`, spec.steps.find((s) => s.id === 'result')!.text[loc].equation === r.equation)
  ok(`${P} уровни: пробирка — 7 кл., ионы — 9 кл., кристаллик — 8 кл.`, spec.steps.find((s) => s.id === 'ions')?.level === 9 && spec.steps.find((s) => s.id === 'nucleus')?.level === 8 && spec.steps.find((s) => s.id === 'tubes')?.level === 7)
  ok(`${P} есть оговорки и наблюдения`, spec.caveats.length > 0 && spec.observations.length > 0)
}

if (failures.length > 0) {
  console.error(`✗ school specs: ${failures.length} из ${checks} проверок не прошли:`)
  for (const f of failures.slice(0, 200)) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`✓ school specs: ${checks} проверок пройдено (${[...specs, ...solutionSpecs].map((s) => s.id).join(', ')})`)
for (const s of specs) {
  const focus = s.particles.find((p) => p.id === s.focus)!
  console.log(`  ${s.substance.padEnd(5)} ${s.reaction.equation.padEnd(28)} ${s.steps.reduce((a, x) => a + x.seconds, 0)} с; ${focus.bonds.map((b) => `${b.a}–${b.b}×${b.pairs}${b.dative ? '(д-а)' : ''}`).join(' ') || 'ионы'}`)
}
process.exit(0)
