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
 *
 * Запуск: npx tsx scripts/test-school-scene.mts
 */
import assert from 'node:assert/strict'
import { analyzeSchoolSpec, angleDegOf, bondLengthOf, electronsOfAtom, type Phase, type SchoolAnalysis } from '../src/lab/cinema/scenes/school/schoolAnalysis.ts'
import { buildSchoolModel, createSchoolState, sampleSchoolState, type SchoolModel } from '../src/lab/cinema/scenes/school/schoolModel.ts'
import { SCHOOL_STEP_IDS, type SchoolLocale, type SchoolSceneSpec } from '../src/lab/cinema/scenes/school/schoolSpec.ts'
import { H2O_SPEC } from '../src/lab/cinema/scenes/h2o/h2oSpec.ts'
import { H2O_FINISH } from '../src/lab/cinema/scenes/h2o/h2oSteps.ts'
import { bondAngleDeg, bondLengthPm } from '../src/chemistry/data/bondData.ts'

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
  const s = [...f].map((c) => SUB[c] ?? c).join('')
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

function checkSpec(spec: SchoolSceneSpec): { a: SchoolAnalysis; m: SchoolModel } {
  const a = analyzeSchoolSpec(spec)
  const m = buildSchoolModel(spec)
  const tag = `[${spec.id}]`

  ok(`${tag} баланс атомов`, () => {
    const [l, r] = spec.equation.split('→')
    assert.ok(l && r, `${tag} уравнение без стрелки`)
    const left = parseSide(l.replace(/⇄/g, ''))
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
      a.atoms.forEach((x, i) => assert.equal(electronsOfAtom(ph, i), x.valence, `${tag} фаза ${name}: у ${x.id} не ${x.valence} электронов`))
    }
    const total = a.atoms.reduce((s, x) => s + x.valence, 0)
    assert.equal(a.electrons.length, total)
  })

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
      if (p.kind === 'lone') assert.equal(e.owner, p.atom, `${tag} неподелённая пара у атома ${a.atoms[p.atom]!.id} из чужого электрона`)
      if (p.kind === 'single') assert.equal(e.owner, p.atom, `${tag} неспаренный электрон не своего атома`)
    }
    a.P.bonds.forEach((b, k) => b.pairs.forEach((o, q) => {
      const two = a.electrons.filter((e) => e.p.kind === 'bond' && e.p.bond === k && e.p.pair === q)
      assert.equal(two.length, 2)
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

  ok(`${tag} тексты ru / en / uz`, () => {
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
const SPECS: SchoolSceneSpec[] = [H2O_SPEC]
const built = SPECS.map(checkSpec)

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
  ok('H₂O: хвост совпадает с h2oSteps', () => {
    assert.equal(H2O_FINISH.from, m.finish.from)
    assert.equal(H2O_FINISH.to, m.finish.to)
  })
}

console.log(`✓ school scenes: ${passed} проверок, спецификаций: ${SPECS.length}`)
