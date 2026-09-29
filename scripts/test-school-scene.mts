#!/usr/bin/env node
/**
 * ATOMLAB Cinema — контракт ШКОЛЬНЫХ сцен образования молекулы (движок src/lab/cinema/scenes/school).
 *
 * Для каждой спецификации (SchoolSceneSpec) проверяется химия и кадр, без WebGL:
 *   1. Баланс атомов: уравнение спецификации (коэффициенты × формулы) = атомы сцены; формула каждой
 *      молекулы = её атомы.
 *   2. Электроны внешнего слоя: у каждого атома в каждой фазе (реагенты, после разрыва, продукты)
 *      вклад в общие пары + 2 · неподелённые + неспаренные = число электронов внешнего слоя
 *      (chemistry/data/electronLevels); всего до = после.
 *   3. Общих пар в продуктах = сумме порядков связей; каждая неподелённая пара — из электронов своего
 *      атома; у каждой пары ровно два электрона.
 *   4. Геометрия = ядру: длины связей ±0,5 пм (bondData), углы ±0,5° (BOND_ANGLES) — в спецификации и
 *      в кадре сцены после шага molecule; сохранившиеся связи фрагментов не меняют длину при разрыве.
 *   5. Время: 6 шагов по порядку, 26–34 с, контракт лаборатории embryo → birth → complete в хвосте.
 *   6. Объекты видны только на своих шагах (каждые 1/60 с): электроны и облака — с шага atoms, штрихи
 *      продукта — с шага molecule, разорванные штрихи — до своего окна разрыва, подписи — в своих окнах;
 *      атомы и электроны не прыгают между кадрами.
 *   7. Тексты ru / en / uz: все шаги заполнены; дробные числа — из ядра (длины и углы спецификации),
 *      наборы чисел трёх языков совпадают.
 *   8. H₂O (эталон): все шаги и фазы — поштучно.
 *   9. Сцены из научных спецификаций (school/specs: CO₂, CO, SO₂, SO₃): уравнение, шаги, тексты,
 *      связи (порядок, донор пары, ключ длины), неподелённые пары, неспаренные электроны, углы и
 *      splitElectrons сцены = научной спецификации; ключевые фазы каждого вещества — поштучно.
 *  10. Кадр: электроны не заходят в шары атомов (переход по дуге), две неподелённые пары атома не
 *      совпадают в проекции, молекулы продукта не наезжают, стрелки донорных пар — от донора к акцептору.
 *
 * Запуск: npx tsx scripts/test-school-scene.mts
 */
import assert from 'node:assert/strict'
import { analyzeSchoolSpec, angleDegOf, bondLengthOf, electronsOfAtom, type Phase, type SchoolAnalysis } from '../src/lab/cinema/scenes/school/schoolAnalysis.ts'
import { buildSchoolModel, createSchoolState, EQUATION_PART_SEP, sampleSchoolState, type SchoolModel } from '../src/lab/cinema/scenes/school/schoolModel.ts'
import { SCHOOL_STEP_IDS, type SchoolLocale, type SchoolSceneSpec } from '../src/lab/cinema/scenes/school/schoolSpec.ts'
import { H2O_SPEC } from '../src/lab/cinema/scenes/h2o/h2oSpec.ts'
import { H2O_FINISH } from '../src/lab/cinema/scenes/h2o/h2oSteps.ts'
import { FIX_CO, FIX_NH4CL, FIX_NO2 } from '../src/lab/cinema/scenes/school/schoolFixtures.ts'
import { NO_SCENE_SPEC } from '../src/lab/cinema/scenes/no/noSpec.ts'
import { NO2_SCENE_SPEC } from '../src/lab/cinema/scenes/no2/no2Spec.ts'
import { N2O_SCENE_SPEC } from '../src/lab/cinema/scenes/n2o/n2oSpec.ts'
import { N2O5_SCENE_SPEC } from '../src/lab/cinema/scenes/n2o5/n2o5Spec.ts'
import { bondAngleDeg, bondLengthPm } from '../src/chemistry/data/bondData.ts'
import { CO2_SCHOOL_SPEC } from '../src/lab/cinema/scenes/co2/co2Spec.ts'
import { CO2_FINISH } from '../src/lab/cinema/scenes/co2/co2Steps.ts'
import { CO_SCHOOL_SPEC } from '../src/lab/cinema/scenes/co/coSpec.ts'
import { CO_FINISH } from '../src/lab/cinema/scenes/co/coSteps.ts'
import { SO2_SCHOOL_SPEC } from '../src/lab/cinema/scenes/so2/so2Spec.ts'
import { SO2_FINISH } from '../src/lab/cinema/scenes/so2/so2Steps.ts'
import { SO3_SCHOOL_SPEC } from '../src/lab/cinema/scenes/so3/so3Spec.ts'
import { SO3_FINISH } from '../src/lab/cinema/scenes/so3/so3Steps.ts'
import { SCHOOL_SPECS, lessonText, pairOrigins, stepTimings, type ParticleSpec, type SchoolScienceSpec } from '../src/lab/cinema/scenes/school/specs/index.ts'
import { effectiveLabNeeds } from '../src/lab/reactionLabNeeds.ts'

let passed = 0
function ok(name: string, fn: () => void): void {
  try {
    fn()
    passed++
  } catch (e) {
    console.error(`✗ ${name}`)
    throw e
  }
}

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
/** «H₂O» → { H: 2, O: 1 } (без скобок — у школьных оксидов их нет). */
function parseFormula(f: string): Map<string, number> {
  const out = new Map<string, number>()
  // Заряд иона (NH₄⁺, Cl⁻, SO₄²⁻) в счёт атомов не входит.
  const s = [...f.replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$/u, '')].map((c) => SUB[c] ?? c).join('')
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null
  let seen = 0
  while ((m = re.exec(s))) {
    if (!m[0]) break
    out.set(m[1]!, (out.get(m[1]!) ?? 0) + (m[2] ? Number(m[2]) : 1))
    seen += m[0].length
  }
  assert.equal(seen, s.length, `формула «${f}» не разобрана целиком`)
  return out
}
/** «2H₂ + O₂ → 2H₂O» → атомы левой и правой части. */
function parseSide(side: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const term of side.split('+').map((x) => x.trim())) {
    const m = /^(\d*)(.+)$/.exec(term)!
    const k = m[1] ? Number(m[1]) : 1
    for (const [el, c] of parseFormula(m[2]!.trim())) out.set(el, (out.get(el) ?? 0) + k * c)
  }
  return out
}
const sameCounts = (a: Map<string, number>, b: Map<string, number>) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)

function dist(p: readonly number[], q: readonly number[]): number {
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
}
function angle(a: readonly number[], c: readonly number[], b: readonly number[]): number {
  const u = [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!]
  const v = [b[0]! - c[0]!, b[1]! - c[1]!, b[2]! - c[2]!]
  const d = (u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(...u) * Math.hypot(...v))
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

function checkSpec(spec: SchoolSceneSpec, opts: { texts?: boolean } = {}): { a: SchoolAnalysis; m: SchoolModel } {
  const a = analyzeSchoolSpec(spec)
  const m = buildSchoolModel(spec)
  const tag = `[${spec.id}]`

  ok(`${tag} баланс атомов`, () => {
    // Стрелка «→» или обратимая «⇄» (2SO₂ + O₂ ⇄ 2SO₃).
    const [l, r] = spec.equation.split(/→|⇄/)
    assert.ok(l && r, `${tag} уравнение без стрелки`)
    const left = parseSide(l)
    const right = parseSide(r)
    assert.ok(sameCounts(left, right), `${tag} уравнение не уравнено`)
    const atoms = new Map<string, number>()
    for (const x of spec.atoms) atoms.set(x.element, (atoms.get(x.element) ?? 0) + 1)
    assert.ok(sameCounts(left, atoms), `${tag} атомы сцены ≠ левой части уравнения`)
    for (const mol of [...spec.reactants, ...spec.products]) {
      const got = new Map<string, number>()
      for (const id of mol.atoms) {
        const el = spec.atoms.find((x) => x.id === id)!.element
        got.set(el, (got.get(el) ?? 0) + 1)
      }
      assert.ok(sameCounts(parseFormula(mol.formula), got), `${tag} ${mol.id}: формула ${mol.formula} ≠ атомам`)
    }
  })

  ok(`${tag} электроны внешнего слоя по фазам`, () => {
    for (const [name, ph] of [['R', a.R], ['S', a.S], ['P', a.P]] as [string, Phase][]) {
      a.atoms.forEach((x, i) =>
        assert.equal(electronsOfAtom(ph, i), x.valence - ph.charge[i]!, `${tag} фаза ${name}: у ${x.id} не ${x.valence - ph.charge[i]!} электронов`),
      )
    }
    for (const [name, ph] of [['R', a.R], ['P', a.P]] as [string, Phase][]) {
      assert.equal(ph.charge.reduce((x, y) => x + y, 0), a.R.charge.reduce((x, y) => x + y, 0), `${tag} фаза ${name}: заряд не сохраняется`)
    }
    const total = a.atoms.reduce((s, x) => s + x.valence, 0)
    assert.equal(a.electrons.length, total)
  })

  const ionic = [...spec.reactants, ...spec.products].some((mol) => mol.charges || mol.bonds.some((b) => b.breakTo))
  ok(`${tag} общие пары = порядкам связей; пары по два электрона`, () => {
    const order = a.P.bonds.reduce((s, b) => s + b.pairs.length, 0)
    const inBonds = a.electrons.filter((e) => e.p.kind === 'bond').length
    assert.equal(inBonds, 2 * order)
    const slots = new Map<string, number>()
    for (const e of a.electrons) {
      const p = e.p
      const key = p.kind === 'bond' ? `b${p.bond}:${p.pair}:${p.slot}` : p.kind === 'lone' ? `l${p.atom}:${p.pair}:${p.slot}` : `s${p.atom}:${p.index}`
      assert.ok(!slots.has(key), `${tag} два электрона на одном месте ${key}`)
      slots.set(key, 1)
      // С ионами (заряды) электроны переходят между атомами — «свой электрон» проверяем у нейтральных.
      if (!ionic && p.kind === 'lone') assert.equal(e.owner, p.atom, `${tag} неподелённая пара у атома ${a.atoms[p.atom]!.id} из чужого электрона`)
      if (!ionic && p.kind === 'single') assert.equal(e.owner, p.atom, `${tag} неспаренный электрон не своего атома`)
    }
    a.P.bonds.forEach((b, k) => b.pairs.forEach((o, q) => {
      const two = a.electrons.filter((e) => e.p.kind === 'bond' && e.p.bond === k && e.p.pair === q)
      assert.equal(two.length, 2)
      if (ionic) return
      if (o === 'ab') assert.deepEqual(new Set(two.map((e) => e.owner)), new Set([b.a, b.b]), `${tag} пара 'ab' не из двух атомов`)
      else two.forEach((e) => assert.equal(e.owner, o === 'a' ? b.a : b.b, `${tag} донорская пара не от донора`))
    }))
  })

  ok(`${tag} геометрия = ядру`, () => {
    for (const mol of [...spec.reactants, ...spec.products]) {
      for (const b of mol.bonds) {
        const L = bondLengthOf(spec, b)
        const d = dist(mol.coords[b.a]!, mol.coords[b.b]!)
        assert.ok(Math.abs(d - L) <= 0.5, `${tag} ${mol.id} ${b.a}–${b.b}: ${d.toFixed(2)} пм ≠ ${L}`)
      }
      for (const an of mol.angles ?? []) {
        const want = angleDegOf(spec, an)
        const got = angle(mol.coords[an.a]!, mol.coords[an.center]!, mol.coords[an.b]!)
        assert.ok(Math.abs(got - want) <= 0.5, `${tag} ${mol.id} угол ${an.a}–${an.center}–${an.b}: ${got.toFixed(2)}° ≠ ${want}°`)
      }
    }
    a.S.bonds.forEach((b) => {
      const d = dist(a.S.pos[b.a]!, a.S.pos[b.b]!)
      assert.ok(Math.abs(d - b.lengthPm) <= 0.5, `${tag} split: сохранившаяся связь ${a.atoms[b.a]!.id}–${a.atoms[b.b]!.id} = ${d.toFixed(2)} пм`)
    })
  })

  ok(`${tag} время и контракт лаборатории`, () => {
    assert.deepEqual(spec.steps.map((s) => s.id), [...SCHOOL_STEP_IDS])
    const total = m.finish.from
    assert.ok(total >= 26 && total <= 34, `${tag} длительность ${total} с вне 26–34`)
    spec.steps.forEach((s) => assert.ok(s.to - s.from >= 4 && s.to - s.from <= 8, `${tag} шаг ${s.id}: ${s.to - s.from} с`))
    for (const id of ['embryo', 'birth', 'complete'] as const) assert.ok(m.timing.cueAt(id) >= m.finish.from, `${tag} cue ${id} раньше хвоста`)
  })

  ok(`${tag} объекты — на своих шагах, без скачков`, () => {
    const st = createSchoolState(m)
    const prevA = new Float32Array(st.atomPos.length)
    const prevE = new Float32Array(st.elPos.length)
    const step = m.step
    let first = true
    for (let t = 0; t <= m.finish.to + 1e-9; t += 1 / 60) {
      sampleSchoolState(m, t, st)
      if (t < step.pairs.from || t >= step.molecule.from) {
        st.flashAmount.forEach((x) => assert.equal(x, 0, `${tag} вспышка пары вне шага pairs (t = ${t.toFixed(2)})`))
      }
      if (t < step.atoms.from) {
        st.elAlpha.forEach((x) => assert.equal(x, 0, `${tag} электрон виден до шага atoms (t = ${t.toFixed(2)})`))
        assert.equal(st.cloudAmount, 0)
      }
      m.sticks.forEach((s, k) => {
        if (s.phase === 'p' && t < step.molecule.from) assert.equal(st.stickAlpha[k], 0, `${tag} штрих продукта до шага molecule`)
        if (s.phase === 'r' && s.pair >= a.keptPairs[s.bond]!) {
          const bi = a.broken.findIndex((x) => x.rBond === s.bond && x.pair === s.pair)
          if (t >= m.breakWin[bi]!.t0 + 0.5) assert.equal(st.stickAlpha[k], 0, `${tag} разорванный штрих виден после разрыва`)
        }
      })
      m.labels.forEach((l, k) => {
        if (l.anchor.kind === 'atom') return
        if (t < l.from || t > l.to) assert.equal(st.labelOpacity[k], 0, `${tag} подпись ${l.id} видна вне окна (t = ${t.toFixed(2)})`)
      })
      if (!first) {
        for (let i = 0; i < st.atomPos.length; i += 3) {
          const d = Math.hypot(st.atomPos[i]! - prevA[i]!, st.atomPos[i + 1]! - prevA[i + 1]!, st.atomPos[i + 2]! - prevA[i + 2]!)
          assert.ok(d < 12, `${tag} атом прыгнул на ${d.toFixed(1)} пм при t = ${t.toFixed(2)}`)
        }
        for (let i = 0; i < st.elPos.length; i += 3) {
          const d = Math.hypot(st.elPos[i]! - prevE[i]!, st.elPos[i + 1]! - prevE[i + 1]!, st.elPos[i + 2]! - prevE[i + 2]!)
          assert.ok(d < 16, `${tag} электрон ${i / 3} прыгнул на ${d.toFixed(1)} пм при t = ${t.toFixed(2)}`)
        }
      }
      prevA.set(st.atomPos)
      prevE.set(st.elPos)
      first = false
    }
    // Кадр после шага molecule: геометрия ровно по ядру.
    sampleSchoolState(m, m.step.molecule.from + 2, st)
    const P = (i: number) => [st.atomPos[i * 3]!, st.atomPos[i * 3 + 1]!, st.atomPos[i * 3 + 2]!]
    a.P.bonds.forEach((b) => {
      const d = dist(P(b.a), P(b.b))
      assert.ok(Math.abs(d - b.lengthPm) <= 0.5, `${tag} кадр: ${a.atoms[b.a]!.id}–${a.atoms[b.b]!.id} = ${d.toFixed(2)} пм`)
    })
    for (const mol of spec.products) {
      for (const an of mol.angles ?? []) {
        const got = angle(P(a.index.get(an.a)!), P(a.index.get(an.center)!), P(a.index.get(an.b)!))
        assert.ok(Math.abs(got - angleDegOf(spec, an)) <= 0.5, `${tag} кадр: угол ${got.toFixed(2)}°`)
      }
    }
  })

  if (opts.texts !== false) ok(`${tag} тексты ru / en / uz`, () => {
    const allowed = new Set<number>()
    for (const mol of [...spec.reactants, ...spec.products]) {
      for (const b of mol.bonds) allowed.add(bondLengthOf(spec, b))
      for (const an of mol.angles ?? []) allowed.add(angleDegOf(spec, an))
    }
    const nums: Record<SchoolLocale, number[]> = { ru: [], en: [], uz: [] }
    for (const loc of ['ru', 'en', 'uz'] as const) {
      const tx = spec.text[loc]
      assert.ok(tx.intro.title && tx.intro.speak && tx.safety && tx.legend.electron && tx.legend.sharedPair && tx.legend.lonePair)
      for (const id of SCHOOL_STEP_IDS) {
        const s = tx.steps[id]
        assert.ok(s.title && s.body && s.equation && s.speak, `${tag} ${loc}: шаг ${id} не заполнен`)
        for (const str of [s.body, s.equation, s.note ?? '']) {
          for (const mm of str.matchAll(/(\d+)[.,](\d+)/g)) {
            const v = Number(`${mm[1]}.${mm[2]}`)
            assert.ok(allowed.has(v), `${tag} ${loc} ${id}: число ${mm[0]} не из ядра (${[...allowed].join(', ')})`)
            nums[loc].push(v)
          }
        }
      }
      for (const c of [spec.captions.reactants, spec.captions.result, spec.captions.condition]) if (c) assert.ok(c[loc], `${tag} подпись без ${loc}`)
    }
    assert.deepEqual(nums.en, nums.ru, `${tag} числа en ≠ ru`)
    assert.deepEqual(nums.uz, nums.ru, `${tag} числа uz ≠ ru`)
  })
  return { a, m }
}

// ——— все спецификации ———
const SPECS: SchoolSceneSpec[] = [
  H2O_SPEC,
  CO2_SCHOOL_SPEC,
  CO_SCHOOL_SPEC,
  SO2_SCHOOL_SPEC,
  SO3_SCHOOL_SPEC,
  NO_SCENE_SPEC,
  NO2_SCENE_SPEC,
  N2O_SCENE_SPEC,
  N2O5_SCENE_SPEC,
]
const built = SPECS.map(checkSpec)

// ——— Прочность движка: учебные «заготовки» с донорно-акцепторной парой, тройной связью,
// сохранённой связью и неспаренным электроном (не сцены — только механика движка, без текстов) ———
for (const fx of [FIX_CO, FIX_NO2, FIX_NH4CL]) {
  const { a } = checkSpec(fx, { texts: false })
  ok(`[${fx.id}] механика`, () => {
    if (fx.id === 'fixture-nh4cl') {
      const n = a.index.get('N1')!
      const h = a.index.get('H4')!
      const cl = a.index.get('Cl1')!
      assert.equal(a.S.charge[h], 1, 'после гетеролиза — H⁺')
      assert.equal(a.S.charge[cl], -1, 'после гетеролиза — Cl⁻')
      assert.equal(a.P.charge[n], 1, 'N⁺ в NH₄⁺')
      assert.equal(a.P.atoms[cl]!.lone, 4, 'Cl⁻: 4 неподелённые пары')
      assert.equal(a.formed.length, 1, 'образуется одна связь N–H')
      assert.equal(a.broken.length, 1)
    } else if (fx.id === 'fixture-co') {
      assert.equal(a.formed.length, 6, 'CO: 3 пары × 2 молекулы')
      assert.equal(a.formed.filter((f) => a.P.bonds[f.pBond]!.pairs[f.pair] !== 'ab').length, 2, 'по одной донорной паре')
    } else {
      assert.equal(a.persistPairs.filter((x) => x === 2).length, 2, 'N=O сохраняется в обеих молекулах')
      assert.equal(a.broken.length, 2, 'рвётся только O=O')
      assert.equal(a.formed.length, 2)
      const n1 = a.index.get('N1')!
      assert.equal(a.P.atoms[n1]!.single, 1, 'неспаренный электрон остаётся на N')
    }
  })
}

// ——— оксиды азота поштучно (научные спецификации specs/no*.ts, n2o*.ts) ———
{
  const byId = (id: string) => built[SPECS.findIndex((s) => s.id === id)]!.a
  const [no, no2, n2o, n2o5] = [byId('no'), byId('no2'), byId('n2o'), byId('n2o5')]
  const at = (a: SchoolAnalysis, id: string) => a.index.get(id)!
  ok('NO: N≡N и O=O рвутся, у N в NO пара + неспаренный, у O две пары; 11 электронов', () => {
    assert.equal(no!.broken.length, 5, '3 пары N≡N + 2 пары O=O')
    assert.equal(no!.formed.length, 4, 'по две пары N=O в двух молекулах')
    for (const n of ['N1', 'N2']) {
      assert.equal(no!.S.atoms[at(no!, n)]!.single, 3, `${n} после разрыва: 3 неспаренных`)
      assert.equal(no!.P.atoms[at(no!, n)]!.lone, 1)
      assert.equal(no!.P.atoms[at(no!, n)]!.single, 1, `${n} в NO: один неспаренный электрон`)
    }
    const perMol = electronsOfAtom(no!.P, at(no!, 'N1')) + electronsOfAtom(no!.P, at(no!, 'O1'))
    assert.equal(perMol, 11)
  })
  ok('NO₂: N=O сохраняется, рвётся только O=O, N→O — пара азота, неспаренный остаётся на N', () => {
    assert.equal(no2!.persistPairs.filter((x) => x === 2).length, 2)
    assert.equal(no2!.broken.length, 2)
    const dative = no2!.formed.filter((f) => no2!.P.bonds[f.pBond]!.pairs[f.pair] !== 'ab')
    assert.equal(dative.length, 2, 'в каждой NO₂ одна донорно-акцепторная пара')
    for (const [n, o] of [['N1', 'O3'], ['N2', 'O4']] as const) {
      assert.equal(no2!.S.atoms[at(no2!, o)]!.lone, 3, `${o} — акцептор: 3 пары`)
      assert.equal(no2!.P.atoms[at(no2!, n)]!.single, 1)
      // Пара донора в фазе S смотрит на акцептор.
      const d = no2!.S.atoms[at(no2!, n)]!.loneDirs[0]!
      const u = no2!.S.pos[at(no2!, o)]!.map((v, k) => v - no2!.S.pos[at(no2!, n)]![k]!)
      const cos = (d[0] * u[0]! + d[1] * u[1]! + d[2] * u[2]!) / Math.hypot(...u)
      assert.ok(cos > 0.95, `пара ${n} не смотрит на ${o} (cos ${cos.toFixed(2)})`)
    }
  })
  ok('N₂O: ионы NH₄⁺ и NO₃⁻ → нейтральные атомы (splitCharges), N→O сохраняется, N≡N образуется', () => {
    assert.equal(n2o!.R.charge[at(n2o!, 'N1')], 1, 'NH₄⁺')
    assert.equal(n2o!.R.charge[at(n2o!, 'O3')], -1, 'O⁻ нитрата')
    n2o!.S.charge.forEach((q, i) => assert.equal(q, 0, `после разрыва ${n2o!.atoms[i]!.id} не нейтрален`))
    // Азоту аммония возвращается именно его электрон.
    const back = n2o!.electrons.filter((e) => e.owner === at(n2o!, 'N1') && e.r.kind === 'lone')
    assert.equal(back.length, 1, 'электрон N1 в фазе R — в паре O⁻')
    assert.equal(back[0]!.s.kind === 'lone' || back[0]!.s.kind === 'single' ? back[0]!.s.atom : -1, at(n2o!, 'N1'))
    const kept = n2o!.P.bonds.findIndex((b) => b.a === at(n2o!, 'N2') && b.b === at(n2o!, 'O2'))
    assert.equal(n2o!.persistPairs[kept], 1, 'N→O нитрата сохраняется')
    assert.equal(n2o!.P.atoms[at(n2o!, 'N1')]!.lone, 1)
    assert.equal(n2o!.P.atoms[at(n2o!, 'O2')]!.lone, 3)
  })
  ok('N₂O₅ + H₂O: гетеролиз (breakTo) → NO₃⁻, NO₂⁺, OH⁻, H⁺; у N в HNO₃ четыре общие пары', () => {
    assert.equal(n2o5!.S.charge[at(n2o5!, 'H1')], 1, 'H⁺')
    assert.equal(n2o5!.S.charge[at(n2o5!, 'O6')], -1, 'OH⁻')
    assert.equal(n2o5!.S.charge[at(n2o5!, 'O1')], -1, 'мостиковый O⁻')
    assert.equal(n2o5!.S.charge[at(n2o5!, 'N2')], 1, 'NO₂⁺')
    n2o5!.P.charge.forEach((q, i) => assert.equal(q, 0, `в HNO₃ ${n2o5!.atoms[i]!.id} не нейтрален`))
    for (const n of ['N1', 'N2']) {
      const pairs = n2o5!.P.bonds.filter((b) => b.a === at(n2o5!, n) || b.b === at(n2o5!, n)).reduce((x, b) => x + b.pairs.length, 0)
      assert.equal(pairs, 4, `${n}: четыре общие пары`)
      assert.equal(n2o5!.P.atoms[at(n2o5!, n)]!.lone + n2o5!.P.atoms[at(n2o5!, n)]!.single, 0)
    }
    // Пара разорванной O–H воды уходит в связь O–N второй кислоты, пара мостика — в O–H первой.
    const ohBond = n2o5!.P.bonds.findIndex((b) => b.a === at(n2o5!, 'H1') && b.b === at(n2o5!, 'O1'))
    const onBond = n2o5!.P.bonds.findIndex((b) => b.a === at(n2o5!, 'N2') && b.b === at(n2o5!, 'O6'))
    const brokenPairOf = (a: string, b: string) => n2o5!.broken.findIndex((x) => {
      const rb = n2o5!.R.bonds[x.rBond]!
      return (rb.a === at(n2o5!, a) && rb.b === at(n2o5!, b)) || (rb.a === at(n2o5!, b) && rb.b === at(n2o5!, a))
    })
    const bridge = brokenPairOf('N2', 'O1')
    const water = brokenPairOf('O6', 'H1')
    const into = (bi: number) => new Set(n2o5!.electrons.filter((e) => e.broken === bi).map((e) => (e.p.kind === 'bond' ? e.p.bond : -1)))
    assert.deepEqual(into(bridge), new Set([ohBond]))
    assert.deepEqual(into(water), new Set([onBond]))
  })
}

// ——— H₂O поштучно ———
{
  const { a, m } = built[0]!
  const id = (i: number) => a.atoms[i]!.id
  ok('H₂O: фазы по учебнику', () => {
    const O = [...a.index].filter(([k]) => k.startsWith('O')).map(([, v]) => v)
    const H = [...a.index].filter(([k]) => k.startsWith('H')).map(([, v]) => v)
    for (const i of O) {
      assert.equal(a.R.atoms[i]!.lone, 2, `${id(i)} в O₂: 2 неподелённые пары`)
      assert.equal(a.S.atoms[i]!.lone, 2)
      assert.equal(a.S.atoms[i]!.single, 2, `${id(i)} после разрыва: 2 неспаренных`)
      assert.equal(a.P.atoms[i]!.lone, 2, `${id(i)} в воде: 2 неподелённые пары`)
      assert.equal(a.P.atoms[i]!.single, 0)
    }
    for (const i of H) {
      assert.equal(a.S.atoms[i]!.single, 1)
      assert.equal(a.P.atoms[i]!.lone + a.P.atoms[i]!.single, 0)
    }
    assert.equal(a.broken.length, 4, 'рвутся 2 пары H–H и 2 пары O=O')
    assert.equal(a.formed.length, 4, 'образуются 4 пары O–H')
    assert.equal(a.electrons.length, 16)
    assert.equal(bondLengthPm('O-H'), 95.8)
    assert.equal(bondAngleDeg('water'), 104.5)
  })
  ok('H₂O: неподелённые пары O — с другой стороны от связей O–H', () => {
    a.P.bonds.forEach((b) => {
      const o = a.atoms[b.a]!.element === 'O' ? b.a : b.b
      const h = o === b.a ? b.b : b.a
      const u = [a.P.pos[h]![0] - a.P.pos[o]![0], a.P.pos[h]![1] - a.P.pos[o]![1], a.P.pos[h]![2] - a.P.pos[o]![2]]
      const ul = Math.hypot(...u)
      for (const d of a.P.atoms[o]!.loneDirs) {
        const cos = (d[0] * u[0]! + d[1] * u[1]! + d[2] * u[2]!) / ul
        assert.ok(cos < 0, `неподелённая пара ${id(o)} смотрит на связь O–H (cos = ${cos.toFixed(2)})`)
      }
    })
  })
  ok('H₂O: кадр каждого шага', () => {
    const st = createSchoolState(m)
    const vis = (arr: Float32Array) => [...arr].filter((x) => x > 0.5).length
    const lab = (id: string) => st.labelOpacity[m.labels.findIndex((l) => l.id === id)]!
    const at = (id: string) => st.atomPos.slice(a.index.get(id)! * 3, a.index.get(id)! * 3 + 3)
    const rSticks = m.sticks.map((x, k) => (x.phase === 'r' ? k : -1)).filter((k) => k >= 0)
    const pSticks = m.sticks.map((x, k) => (x.phase === 'p' ? k : -1)).filter((k) => k >= 0)
    // 1. Реагенты: 2 штриха H–H и 2 штриха O=O, электронов и облаков нет, формулы и «гремучая смесь» видны.
    sampleSchoolState(m, m.step.reactants.to - 0.01, st)
    assert.equal(rSticks.filter((k) => st.stickAlpha[k]! > 0.9).length, 4)
    assert.equal(vis(st.elAlpha), 0)
    assert.equal(st.cloudAmount, 0)
    assert.ok(lab('molR-O2') > 0.9 && lab('caption-reactants') > 0.9)
    // 2. Строение атомов: все 16 электронов внешнего слоя, облака, схемы слоёв H и O.
    sampleSchoolState(m, m.step.atoms.to - 0.3, st)
    assert.equal(vis(st.elAlpha), 16)
    assert.ok(st.cloudAmount > 0.9)
    assert.ok(lab('layers-H') > 0.9 && lab('layers-O') > 0.9)
    // 3. Разрыв: штрихов нет, 4 + 2·2 = 8 неспаренных (ореол) электронов, атомы в позициях split.
    sampleSchoolState(m, m.step.breaking.to - 0.01, st)
    assert.equal(rSticks.filter((k) => st.stickAlpha[k]! > 0.01).length, 0)
    assert.equal([...st.elGlow].filter((g) => g > 0.9).length, 8)
    for (const id of ['H1', 'O1', 'H4']) assert.ok(dist(at(id), H2O_SPEC.split[id]!) < 0.5, `${id} не в split`)
    // Облака «худеют»: у H заполнение 1/2, у O 6/8.
    assert.ok(Math.abs(st.cloudFill[a.index.get('H1')!]! - 0.5) < 1e-6 && Math.abs(st.cloudFill[a.index.get('O1')!]! - 0.75) < 1e-6)
    // 4. Общие пары: неспаренных не осталось, облака заполнены (H — 2, O — 8).
    sampleSchoolState(m, m.step.pairs.to - 0.01, st)
    assert.equal([...st.elGlow].filter((g) => g > 0.9).length, 0)
    for (let i = 0; i < a.atoms.length; i++) assert.ok(st.cloudFill[i]! > 0.999, `облако ${a.atoms[i]!.id} не заполнено`)
    // 5. Молекула: 4 штриха O–H, точки общих пар стянуты в штрихи, видны 8 электронов неподелённых пар, угол подписан.
    sampleSchoolState(m, m.step.molecule.to - 0.01, st)
    assert.equal(pSticks.filter((k) => st.stickAlpha[k]! > 0.99).length, 4)
    assert.equal(vis(st.elAlpha), 8)
    assert.ok(lab('angle-H1-O1-H2') > 0.9 && lab('molP-W1') > 0.9)
    // 6. Итог: уравнение и подпись «вода» видны, геометрия та же.
    sampleSchoolState(m, m.step.result.to - 0.01, st)
    assert.ok(lab('equation') > 0.9 && lab('caption-result') > 0.9)
    assert.ok(Math.abs(dist(at('O1'), at('H1')) - 95.8) < 0.5)
    // Хвост: всё гаснет.
    sampleSchoolState(m, m.finish.to, st)
    assert.equal(vis(st.elAlpha), 0)
    assert.equal(st.fade, 0)
  })
  ok('H₂O: хвост совпадает с h2oSteps', () => {
    assert.equal(H2O_FINISH.from, m.finish.from)
    assert.equal(H2O_FINISH.to, m.finish.to)
  })
}

// ——— сцены из научных спецификаций: химия сцены = химии спецификации ———
type MolSig = { bonds: string[]; lone: string[]; unpaired: string[]; angles: string[] }
const sortJ = (xs: string[]) => [...xs].sort()
function sceneMolSig(spec: SchoolSceneSpec, mol: SchoolSceneSpec['products'][number]): MolSig {
  const el = (id: string) => spec.atoms.find((x) => x.id === id)!.element
  return {
    bonds: sortJ(
      mol.bonds.map((b) => {
        const pairs = b.pairs.map((o) => (o === 'ab' ? 'ab' : `донор ${el(o === 'a' ? b.a : b.b)}`)).join(',')
        return `${sortJ([el(b.a), el(b.b)]).join('-')}:${pairs}:${b.bondKey}`
      }),
    ),
    lone: sortJ(Object.entries(mol.lonePairs ?? {}).filter(([, n]) => n).map(([id, n]) => `${el(id)}:${n}`)),
    unpaired: sortJ(Object.entries(mol.unpaired ?? {}).filter(([, n]) => n).map(([id, n]) => `${el(id)}:${n}`)),
    angles: sortJ((mol.angles ?? []).map((an) => `${an.angleKey}`)),
  }
}
function particleSig(p: ParticleSpec): MolSig {
  const el = (id: string) => p.atoms.find((x) => x.id === id)!.element
  return {
    bonds: sortJ(
      p.bonds.map((b) => {
        const pairs = pairOrigins(b).map((o) => (o === 'ab' ? 'ab' : `донор ${el(o === 'a' ? b.a : b.b)}`)).join(',')
        return `${sortJ([el(b.a), el(b.b)]).join('-')}:${pairs}:${'bond' in b.length ? b.length.bond : '?'}`
      }),
    ),
    lone: sortJ(Object.entries(p.lonePairs).filter(([, n]) => n).map(([id, n]) => `${el(id)}:${n}`)),
    unpaired: sortJ(Object.entries(p.unpaired).filter(([, n]) => n).map(([id, n]) => `${el(id)}:${n}`)),
    angles: sortJ((p.angles ?? []).map((an) => ('angle' in an.ref ? an.ref.angle : '?'))),
  }
}
function checkScience(spec: SchoolSceneSpec, sci: SchoolScienceSpec): void {
  const tag = `[${spec.id} ↔ specs/${sci.id}]`
  ok(`${tag} уравнение, шаги и тексты — из спецификации`, () => {
    assert.equal(spec.equation, sci.reaction.equation)
    assert.deepEqual(spec.steps, stepTimings(sci))
    assert.equal(spec.textbook.page, sci.reaction.sources[0]!.pages[0])
    for (const loc of ['ru', 'en', 'uz'] as const) assert.deepEqual(spec.text[loc], lessonText(sci, loc), `${tag} текст ${loc}`)
    assert.deepEqual(spec.captions, sci.captions)
  })
  ok(`${tag} молекулы сцены = частицам спецификации`, () => {
    const side = (mols: SchoolSceneSpec['reactants'], terms: SchoolScienceSpec['reaction']['reactants']) => {
      // Число молекул каждой формулы = коэффициенту уравнения.
      for (const t of terms) assert.equal(mols.filter((m) => m.formula === t.formula).length, t.coef, `${tag} ${t.formula}: не ${t.coef} шт.`)
      assert.equal(mols.length, terms.reduce((s, t) => s + t.coef, 0))
      for (const mol of mols) {
        const term = terms.find((t) => t.formula === mol.formula)!
        const p = sci.particles.find((x) => x.id === term.particle)!
        const got = sceneMolSig(spec, mol)
        const want = particleSig(p)
        assert.deepEqual(got.bonds, want.bonds, `${tag} ${mol.id}: связи`)
        assert.deepEqual(got.lone, want.lone, `${tag} ${mol.id}: неподелённые пары`)
        assert.deepEqual(got.unpaired, want.unpaired, `${tag} ${mol.id}: неспаренные электроны`)
        for (const k of got.angles) assert.ok(want.angles.includes(k), `${tag} ${mol.id}: угол ${k} не из спецификации`)
      }
    }
    side(spec.reactants, sci.reaction.reactants)
    side(spec.products, sci.reaction.products)
  })
  ok(`${tag} раскладка электронов перед связыванием (splitElectrons)`, () => {
    const want = new Map<string, string>()
    for (const se of sci.mechanism.splitElectrons ?? []) {
      const p = sci.particles.find((x) => x.id === se.particle)!
      const el = p.atoms.find((x) => x.id === se.atom)!.element
      for (const mol of spec.reactants.filter((m) => m.formula === p.formula)) {
        for (const id of mol.atoms) if (spec.atoms.find((x) => x.id === id)!.element === el) want.set(id, `${se.lone}+${se.unpaired}`)
      }
    }
    const got = new Map(Object.entries(spec.splitElectrons ?? {}).map(([id, v]) => [id, `${v.lone}+${v.unpaired}`]))
    assert.deepEqual(got, want)
  })
}
for (const [spec, sci] of [
  [CO2_SCHOOL_SPEC, SCHOOL_SPECS.co2],
  [CO_SCHOOL_SPEC, SCHOOL_SPECS.co],
  [SO2_SCHOOL_SPEC, SCHOOL_SPECS.so2],
  [SO3_SCHOOL_SPEC, SCHOOL_SPECS.so3],
] as const) {
  checkScience(spec, sci)
}
ok('хвосты сцен совпадают с *Steps', () => {
  for (const [spec, fin] of [
    [CO2_SCHOOL_SPEC, CO2_FINISH],
    [CO_SCHOOL_SPEC, CO_FINISH],
    [SO2_SCHOOL_SPEC, SO2_FINISH],
    [SO3_SCHOOL_SPEC, SO3_FINISH],
  ] as const) {
    const m = buildSchoolModel(spec)
    assert.equal(fin.from, m.finish.from, `${spec.id}: хвост`)
    assert.equal(fin.to, m.finish.to, `${spec.id}: хвост`)
  }
})

// ——— поштучно: CO₂, CO, SO₂, SO₃ ———
const analysisOf = (spec: SchoolSceneSpec) => built[SPECS.indexOf(spec)]!
const ofEl = (a: SchoolAnalysis, el: string) => a.atoms.map((x, i) => (x.element === el ? i : -1)).filter((i) => i >= 0)
/** Косинус между направлением неподелённой пары и направлением на партнёра по связи. */
function loneCos(a: SchoolAnalysis, i: number, q: number): number[] {
  const d = a.P.atoms[i]!.loneDirs[q]!
  return a.P.bonds
    .filter((b) => b.a === i || b.b === i)
    .map((b) => {
      const j = b.a === i ? b.b : b.a
      const u = [a.P.pos[j]![0] - a.P.pos[i]![0], a.P.pos[j]![1] - a.P.pos[i]![1], a.P.pos[j]![2] - a.P.pos[i]![2]]
      return (d[0] * u[0]! + d[1] * u[1]! + d[2] * u[2]!) / Math.hypot(...u)
    })
}
/** Видимые точки электронов на шаге (альфа > 0,5). */
function visibleAt(m: SchoolModel, t: number): number {
  const st = createSchoolState(m)
  sampleSchoolState(m, t, st)
  return [...st.elAlpha].filter((x) => x > 0.5).length
}
ok('CO₂: C +6 )2 )4 — пара и 2 неспаренных; перед связями 4 неспаренных; O=C=O без пар у C', () => {
  const { a, m } = analysisOf(CO2_SCHOOL_SPEC)
  const [c] = ofEl(a, 'C')
  assert.deepEqual([a.R.atoms[c!]!.lone, a.R.atoms[c!]!.single], [1, 2], 'C на шаге atoms: 1 пара + 2 неспаренных')
  assert.deepEqual([a.S.atoms[c!]!.lone, a.S.atoms[c!]!.single], [0, 4], 'C перед связями: 4 неспаренных')
  assert.deepEqual([a.P.atoms[c!]!.lone, a.P.atoms[c!]!.single], [0, 0])
  for (const o of ofEl(a, 'O')) assert.equal(a.P.atoms[o]!.lone, 2, 'у каждого O в CO₂ две неподелённые пары')
  assert.equal(a.broken.length, 2, 'рвётся только O=O (2 пары)')
  assert.equal(a.formed.length, 4, 'две двойные связи: 4 пары')
  assert.equal(bondLengthPm('C=O(CO2)'), 116.0)
  assert.equal(bondAngleDeg('carbonDioxide'), 180)
  // Кадр шага atoms: 4 + 2·6 = 16 точек; шага molecule: 8 точек неподелённых пар O.
  assert.equal(visibleAt(m, m.step.atoms.to - 0.3), 16)
  assert.equal(visibleAt(m, m.step.molecule.to - 0.01), 8)
})
ok('CO: C≡O — 2 обменные пары + донорная пара O; по неподелённой паре у C и O на оси снаружи', () => {
  const { a, m } = analysisOf(CO_SCHOOL_SPEC)
  assert.equal(a.formed.length, 6)
  a.P.bonds.forEach((b) => {
    const donors = b.pairs.filter((o) => o !== 'ab').map((o) => a.atoms[o === 'a' ? b.a : b.b]!.element)
    assert.deepEqual(donors, ['O'], 'донор третьей пары — кислород')
    assert.equal(b.pairs.length, 3)
    assert.ok(Math.abs(b.lengthPm - 112.8) < 1e-9)
  })
  for (const i of [...ofEl(a, 'C'), ...ofEl(a, 'O')]) {
    assert.equal(a.P.atoms[i]!.lone, 1)
    assert.equal(a.P.atoms[i]!.single, 0)
    for (const cos of loneCos(a, i, 0)) assert.ok(cos < -0.999, `неподелённая пара ${a.atoms[i]!.id} не на оси снаружи (cos = ${cos.toFixed(3)})`)
  }
  // Донорная пара — электроны O: после образования у O 2 (обменные) + 2 (донор) + 2 (своя пара) = 6.
  assert.equal(visibleAt(m, m.step.atoms.to - 0.3), 2 * 4 + 2 * 6)
  assert.equal(visibleAt(m, m.step.molecule.to - 0.01), 8, 'после шага molecule — 4 неподелённые пары')
  // Стрелка донорной пары «O → C» у первой молекулы; «окошко» свободного места у обоих C.
  const dat = m.labels.filter((l) => l.id.startsWith('dative-'))
  assert.equal(dat.length, 1)
  assert.equal(dat[0]!.text.ru, 'донорная пара O → C')
  assert.deepEqual(m.acceptors.map((x) => a.atoms[x.atom]!.element), ['C', 'C'])
  const st = createSchoolState(m)
  sampleSchoolState(m, m.step.atoms.to - 0.3, st)
  for (const x of m.acceptors) assert.ok(st.cloudHole[x.atom]! > 0.9, 'окошко у C на шаге atoms')
  sampleSchoolState(m, m.step.molecule.from + 0.1, st)
  for (const x of m.acceptors) assert.equal(st.cloudHole[x.atom], 0, 'окошко закрылось, когда пара O встала')
})
ok('SO₂: S +16 )2 )8 )6; перед связями пара + 4 неспаренных; у S одна неподелённая пара снаружи угла', () => {
  const { a, m } = analysisOf(SO2_SCHOOL_SPEC)
  const [s] = ofEl(a, 'S')
  assert.deepEqual([a.R.atoms[s!]!.lone, a.R.atoms[s!]!.single], [2, 2])
  assert.deepEqual([a.S.atoms[s!]!.lone, a.S.atoms[s!]!.single], [1, 4])
  assert.deepEqual([a.P.atoms[s!]!.lone, a.P.atoms[s!]!.single], [1, 0])
  for (const cos of loneCos(a, s!, 0)) assert.ok(cos < -0.4, `пара S смотрит на связь S=O (cos = ${cos.toFixed(2)})`)
  for (const o of ofEl(a, 'O')) assert.equal(a.P.atoms[o]!.lone, 2)
  assert.equal(a.formed.length, 4)
  assert.equal(bondAngleDeg('sulfurDioxide'), 119.5)
  assert.equal(visibleAt(m, m.step.molecule.to - 0.01), 10, 'пара S + по две пары у O')
})
ok('SO₃: S=O молекул SO₂ сохраняются, рвётся только O=O; третья S=O — из пары S и неспаренных O', () => {
  const { a, m } = analysisOf(SO3_SCHOOL_SPEC)
  assert.equal(a.broken.length, 2, 'рвутся только 2 пары O=O')
  assert.deepEqual(a.keptPairs.filter((x) => x === 2).length, 4, 'четыре связи S=O сохраняются целиком')
  assert.equal(a.formed.length, 4, 'по одной новой двойной связи у каждого S')
  for (const s of ofEl(a, 'S')) {
    assert.deepEqual([a.R.atoms[s]!.lone, a.R.atoms[s]!.single], [1, 0], 'S в SO₂: одна неподелённая пара')
    assert.deepEqual([a.S.atoms[s]!.lone, a.S.atoms[s]!.single], [0, 2], 'пара S распаривается')
    assert.deepEqual([a.P.atoms[s]!.lone, a.P.atoms[s]!.single], [0, 0], 'у S в SO₃ пар нет')
  }
  for (const o of ofEl(a, 'O')) assert.equal(a.P.atoms[o]!.lone, 2)
  assert.equal(bondLengthPm('S=O(SO3)'), 141.98)
  assert.equal(bondAngleDeg('sulfurTrioxide'), 120)
  // Сохранённые штрихи S=O видны весь шаг breaking.
  const st = createSchoolState(m)
  sampleSchoolState(m, m.step.breaking.to - 0.01, st)
  const kept = m.sticks.map((x, k) => (x.phase === 'r' && x.pair < a.keptPairs[x.bond]! ? k : -1)).filter((k) => k >= 0)
  assert.equal(kept.length, 8)
  for (const k of kept) assert.ok(st.stickAlpha[k]! > 0.1, 'штрих сохранённой S=O погас при разрыве')
  assert.equal(visibleAt(m, m.step.molecule.to - 0.01), 24, 'по две пары у шести O')
  // Неподелённая пара S в SO₂ подсвечена на шаге atoms (она распарится для новой связи).
  sampleSchoolState(m, m.step.atoms.to - 0.3, st)
  const lit = a.electrons.map((e, k) => (e.r.kind === 'lone' && a.atoms[e.owner]!.element === 'S' ? st.elGlow[k]! : -1)).filter((g) => g >= 0)
  assert.equal(lit.length, 4)
  for (const g of lit) assert.ok(g > 0.6)
  // Итог: обратимая стрелка и катализатор над ней.
  const eq = m.labels.find((l) => l.id === 'equation')!
  assert.equal(eq.kind, 'equation')
  assert.deepEqual(eq.text.ru.split(EQUATION_PART_SEP), ['2SO₂ + O₂', '⇄', 't°, кат. V₂O₅', '2SO₃'])
})

// ——— кадр: электроны вне шаров, пары не сливаются, молекулы продукта не наезжают, стрелки донорных пар ———
for (const [si, spec] of SPECS.entries()) {
  const { a, m } = built[si]!
  const tag = `[${spec.id}]`
  const st = createSchoolState(m)
  const molOf = new Map<number, number>()
  spec.products.forEach((p, k) => p.atoms.forEach((id) => molOf.set(a.index.get(id)!, k)))
  ok(`${tag} электроны не заходят в шары атомов (каждые 1/60 с шагов atoms…result)`, () => {
    for (let t = m.step.atoms.from; t < m.finish.from; t += 1 / 60) {
      sampleSchoolState(m, t, st)
      for (let k = 0; k < a.electrons.length; k++) {
        if (st.elAlpha[k]! < 0.3) continue
        for (let i = 0; i < a.atoms.length; i++) {
          const d = Math.hypot(st.elPos[k * 3]! - st.atomPos[i * 3]!, st.elPos[k * 3 + 1]! - st.atomPos[i * 3 + 1]!, st.elPos[k * 3 + 2]! - st.atomPos[i * 3 + 2]!)
          // Допуск 1 пм: точка радиусом 6 пм у поверхности шара видна.
          assert.ok(d >= m.ballR[i]! - 1, `${tag} t = ${t.toFixed(2)}: электрон ${k} (${a.atoms[a.electrons[k]!.owner]!.id}) в шаре ${a.atoms[i]!.id}: ${d.toFixed(1)} < ${m.ballR[i]!.toFixed(1)} пм`)
        }
      }
    }
  })
  ok(`${tag} неподелённые пары одного атома не совпадают в проекции кадра`, () => {
    // Кадры покоя: конец шагов atoms, breaking, pairs и всё время после того, как встала геометрия.
    const times: number[] = []
    for (const w of [m.step.atoms, m.step.breaking, m.step.pairs]) times.push(w.to - 0.02)
    for (let t = m.step.molecule.from + 1.3; t < m.finish.from; t += 1 / 30) times.push(t)
    for (const t of times) {
      sampleSchoolState(m, t, st)
      const phase = t < m.step.breaking.from ? 'r' : t < m.step.pairs.from ? 's' : 'p'
      for (let i = 0; i < a.atoms.length; i++) {
        const c = new Map<number, [number, number]>()
        a.electrons.forEach((e, k) => {
          const pl = phase === 'r' ? e.r : phase === 's' ? e.s : e.p
          if (pl.kind !== 'lone' || pl.atom !== i || st.elAlpha[k]! < 0.3) return
          const q = c.get(pl.pair) ?? [0, 0]
          c.set(pl.pair, [q[0] + st.elPos[k * 3]! / 2, q[1] + st.elPos[k * 3 + 1]! / 2])
        })
        const pts = [...c.values()]
        for (let x = 0; x < pts.length; x++) {
          for (let y = x + 1; y < pts.length; y++) {
            const d = Math.hypot(pts[x]![0] - pts[y]![0], pts[x]![1] - pts[y]![1])
            // Центры пар дальше 20 пм — в кадре две пары по две точки, а не одна.
            assert.ok(d >= 20, `${tag} t = ${t.toFixed(2)}: две пары ${a.atoms[i]!.id} совпадают в проекции (${d.toFixed(1)} пм)`)
          }
        }
      }
    }
  })
  ok(`${tag} молекулы продукта не наезжают друг на друга (шаги pairs…result)`, () => {
    for (let t = m.step.pairs.to - 0.3; t < m.finish.from; t += 1 / 30) {
      sampleSchoolState(m, t, st)
      for (let i = 0; i < a.atoms.length; i++) {
        for (let j = i + 1; j < a.atoms.length; j++) {
          if (molOf.get(i) === molOf.get(j)) continue
          // В проекции кадра: облака внешнего слоя соседних молекул не перекрываются.
          const d = Math.hypot(st.atomPos[i * 3]! - st.atomPos[j * 3]!, st.atomPos[i * 3 + 1]! - st.atomPos[j * 3 + 1]!)
          assert.ok(d >= m.cloudR[i]! + m.cloudR[j]!, `${tag} t = ${t.toFixed(2)}: ${a.atoms[i]!.id} и ${a.atoms[j]!.id} разных молекул: ${d.toFixed(1)} пм`)
        }
      }
    }
  })
  ok(`${tag} стрелки донорно-акцепторных пар: по одной на каждую пару 'a' / 'b' продукта`, () => {
    const want = a.P.bonds.reduce((s, b) => s + b.pairs.filter((o) => o !== 'ab').length, 0)
    assert.equal(m.arrows.length, want)
    for (const ar of m.arrows) {
      const stick = m.sticks[ar.stick]!
      assert.equal(stick.phase, 'p')
      const b = a.P.bonds[stick.bond]!
      const o = b.pairs[stick.pair]!
      assert.equal(ar.donor, o === 'a' ? b.a : b.b, `${tag} стрелка не от донора`)
      assert.equal(ar.acceptor, o === 'a' ? b.b : b.a)
    }
  })
  ok(`${tag} подпись угла — не больше одного знака после запятой`, () => {
    for (const l of m.labels.filter((x) => x.id.startsWith('angle-'))) assert.match(l.text.ru, /= \d+(\.\d)?°$/, `${tag} ${l.text.ru}`)
  })
}
ok('стрелки: CO — O → C, NO₂ и N₂O — N → O, HNO₃ — N → O (у каждой молекулы)', () => {
  const pairsOf = (spec: SchoolSceneSpec) => {
    const { a, m } = analysisOf(spec)
    return m.arrows.map((x) => `${a.atoms[x.donor]!.element}→${a.atoms[x.acceptor]!.element}`)
  }
  assert.deepEqual(pairsOf(CO_SCHOOL_SPEC), ['O→C', 'O→C'])
  assert.deepEqual(pairsOf(NO2_SCENE_SPEC), ['N→O', 'N→O'])
  assert.deepEqual(pairsOf(N2O_SCENE_SPEC), ['N→O'])
  assert.deepEqual(pairsOf(N2O5_SCENE_SPEC), ['N→O', 'N→O'])
  assert.deepEqual(pairsOf(H2O_SPEC), [])
})
ok('CO₂: в итоговой подписи 180° не повторяется (угол подписан у молекулы)', () => {
  const { m } = analysisOf(CO2_SCHOOL_SPEC)
  assert.ok(m.labels.some((l) => l.id.startsWith('angle-') && l.text.ru.includes('180')))
  assert.ok(!CO2_SCHOOL_SPEC.captions.result.ru.includes('180'))
})
ok('N₂O₅: ∠ONO подписан с одним знаком (130,3°)', () => {
  const { m } = analysisOf(N2O5_SCENE_SPEC)
  assert.ok(m.labels.some((l) => l.text.ru === '∠ONO = 130.3°'), m.labels.filter((l) => l.id.startsWith('angle-')).map((l) => l.text.ru).join('; '))
})
ok('CO₂: кадр шага atoms — по центру композиции (C слева, O₂ справа)', () => {
  const { m } = analysisOf(CO2_SCHOOL_SPEC)
  const e = m.extent[1]!
  assert.ok(e.cx < -20, `центр габарита ${e.cx.toFixed(1)} пм — не у центра композиции`)
})
ok('zn-hcl: без условий (цинк реагирует с соляной кислотой без нагрева)', () => {
  const needs = effectiveLabNeeds({ needsHeat: true }, 'salt_zn_cl', 'zn-hcl')
  assert.ok(needs && !needs.needsHeat && !needs.needsCatalyst && !needs.needsPressure, JSON.stringify(needs))
})

console.log(`✓ school scenes: ${passed} проверок, спецификаций: ${SPECS.length}`)
