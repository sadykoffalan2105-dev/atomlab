#!/usr/bin/env node
/**
 * ATOMLAB — проверка базисов кристаллов (crystalData.basis) — контракт генератора решёток.
 *
 * Базис — полное содержимое конвенциональной ячейки, уже размноженное симметрией. Если в нём ошибка
 * (потерян или задвоен атом при размножении, перепутана установка, чужая дробь), генератор решётки
 * построит «красивый», но ложный кристалл. Поэтому проверяется всё, что из базиса ПЕРЕСЧИТЫВАЕТСЯ:
 *   • состав: число атомов каждого элемента = Z × формула; ионные ячейки электронейтральны;
 *   • рентгеновская плотность из масс базиса (IUPAC 2021) и объёма ячейки = densityGCm3 (0.3 %);
 *     у фаз не при 298 K — при своей temperatureK;
 *   • кратчайшие расстояния пар по периодической решётке = bondData / cationAnionPm записи;
 *   • ни одна пара не ближе 0.7 × ожидаемой связи (ловит задвоение атома операцией симметрии);
 *   • КЧ из базиса = coordination записи;
 *   • углы кварца (Si–O–Si, O–Si–O) = bondData.
 * Если проверка не сходится — неверны координаты, а не допуск.
 *
 * Запуск: npx tsx scripts/test-crystal-basis.mts
 */
import assert from 'node:assert/strict'

import { ATOMIC_DATA, ionicRadiusPm, molarMassGMol, parseFormula, type ElementSymbol } from '../src/chemistry/data/atomicData.ts'
import { bondAngleDeg, bondLengthPm, BOND_DATA } from '../src/chemistry/data/bondData.ts'
import { CRYSTAL_DATA, CRYSTAL_IDS, type CrystalDatum } from '../src/chemistry/data/crystalData.ts'

let checks = 0
const ok = (cond: boolean, message: string) => {
  assert.ok(cond, message)
  checks++
}
const near = (a: number, b: number, tol: number, message: string) =>
  ok(Math.abs(a - b) <= tol, `${message}: ${a.toFixed(3)} против ${b.toFixed(3)} (допуск ±${tol})`)
const section = (title: string) => console.log(`\n── ${title}`)

const NA = 6.02214076e23
type V3 = readonly [number, number, number]

/** Матрица дробные → декартовы (пм) для произвольной ячейки: a вдоль x, b в плоскости xy. */
function cellMatrix(c: CrystalDatum): { m: (f: V3) => V3; volumePm3: number } {
  const a = c.cellPm.a
  const b = c.cellPm.b ?? a
  const cc = c.cellPm.c ?? a
  const d2r = Math.PI / 180
  const al = (c.cellAnglesDeg?.alpha ?? 90) * d2r
  const be = (c.cellAnglesDeg?.beta ?? 90) * d2r
  const ga = (c.cellAnglesDeg?.gamma ?? 90) * d2r
  const ax: V3 = [a, 0, 0]
  const bx: V3 = [b * Math.cos(ga), b * Math.sin(ga), 0]
  const cx0 = cc * Math.cos(be)
  const cy0 = (cc * (Math.cos(al) - Math.cos(be) * Math.cos(ga))) / Math.sin(ga)
  const cz0 = Math.sqrt(Math.max(0, cc * cc - cx0 * cx0 - cy0 * cy0))
  const cx: V3 = [cx0, cy0, cz0]
  const volumePm3 = ax[0] * (bx[1] * cx[2] - bx[2] * cx[1])
  return {
    m: (f) => [
      f[0] * ax[0] + f[1] * bx[0] + f[2] * cx[0],
      f[0] * ax[1] + f[1] * bx[1] + f[2] * cx[1],
      f[0] * ax[2] + f[1] * bx[2] + f[2] * cx[2],
    ],
    volumePm3,
  }
}

type Neighbor = { readonly j: number; readonly d: number; readonly vec: V3 }

/** Все соседи атома i в радиусе rMax с учётом периодических образов ±2 ячейки. */
function neighbors(c: CrystalDatum, i: number, rMax: number): Neighbor[] {
  const basis = c.basis!
  const { m } = cellMatrix(c)
  const pi = m(basis[i].frac)
  const out: Neighbor[] = []
  for (let j = 0; j < basis.length; j++) {
    const f = basis[j].frac
    for (let x = -2; x <= 2; x++)
      for (let y = -2; y <= 2; y++)
        for (let z = -2; z <= 2; z++) {
          const p = m([f[0] + x, f[1] + y, f[2] + z])
          const vec: V3 = [p[0] - pi[0], p[1] - pi[1], p[2] - pi[2]]
          const d = Math.hypot(vec[0], vec[1], vec[2])
          if (d > 1e-6 && d <= rMax) out.push({ j, d, vec })
        }
  }
  return out.sort((p, q) => p.d - q.d)
}

/** Кратчайшее расстояние от атомов элемента A до атомов элемента B. */
function shortest(c: CrystalDatum, A: ElementSymbol, B: ElementSymbol, rMax = 600): number {
  let best = Infinity
  c.basis!.forEach((s, i) => {
    if (s.el !== A) return
    for (const n of neighbors(c, i, rMax)) if (c.basis![n.j].el === B && n.d < best) best = n.d
  })
  return best
}

/** Различные длины A–B в первой координационной сфере (до cutoff), округлённые до 0.1 пм. */
function distinctLengths(c: CrystalDatum, A: ElementSymbol, B: ElementSymbol, cutoff: number): number[] {
  const set = new Set<number>()
  c.basis!.forEach((s, i) => {
    if (s.el !== A) return
    for (const n of neighbors(c, i, cutoff)) if (c.basis![n.j].el === B) set.add(Math.round(n.d * 10) / 10)
  })
  return [...set].sort((x, y) => x - y)
}

/** КЧ: сколько соседей B вокруг каждого A на расстоянии ≤ cutoff (все A обязаны давать одно число). */
function coordinationOf(c: CrystalDatum, A: ElementSymbol, B: ElementSymbol, cutoff: number): number[] {
  const out: number[] = []
  c.basis!.forEach((s, i) => {
    if (s.el !== A) return
    out.push(neighbors(c, i, cutoff).filter((n) => c.basis![n.j].el === B).length)
  })
  return out
}

const angleDeg = (u: V3, v: V3) =>
  (Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI

// ─────────────────────────────────────────────────────────────────────────────
section('1. Обязательные базисы присутствуют')
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED = [
  'nacl', 'mgo', 'na_metal', 'mg_metal', 'graphite',
  'si', 'quartz', 'litharge', 'massicot', 'pb_metal', 'al_metal', 'corundum', 'ice', 'dry_ice',
] as const
for (const id of REQUIRED) {
  const c = CRYSTAL_DATA[id]
  ok(c != null, `${id}: запись есть в CRYSTAL_DATA`)
  ok(Array.isArray(c.basis) && c.basis.length > 0, `${id}: базис задан`)
  ok(c.setting != null, `${id}: установка ячейки (setting) задана`)
}
// Фазы, которых при 298 K нет: ячейка и плотность обязаны нести свою температуру.
for (const id of ['ice', 'dry_ice'] as const) {
  const T = CRYSTAL_DATA[id].temperatureK
  ok(T != null && T < 273.15, `${id}: temperatureK задана и ниже 0 °C (${T} K)`)
}
near(CRYSTAL_DATA.dry_ice.temperatureK!, 150, 0, 'сухой лёд: ячейка Simon & Peters при 150 K')

// ─────────────────────────────────────────────────────────────────────────────
section('2. Состав, электронейтральность, дроби')
// ─────────────────────────────────────────────────────────────────────────────

const withBasis = CRYSTAL_IDS.filter((id) => CRYSTAL_DATA[id].basis)
for (const id of withBasis) {
  const c = CRYSTAL_DATA[id]
  const basis = c.basis!
  for (const s of basis) {
    ok(s.frac.every((v) => v >= 0 && v < 1), `${id}: дроби атома ${s.el} в [0, 1) — ${s.frac.join(', ')}`)
    ok(ATOMIC_DATA[s.el] != null, `${id}: элемент ${s.el} есть в ядре`)
  }
  // нет задвоенных узлов (операция симметрии, давшая тот же атом дважды)
  for (let i = 0; i < basis.length; i++)
    for (let j = i + 1; j < basis.length; j++) {
      const same = basis[i].frac.every((v, k) => {
        const dv = Math.abs(v - basis[j].frac[k])
        return dv < 1e-4 || dv > 1 - 1e-4
      })
      ok(!same, `${id}: узлы ${i} и ${j} не совпадают`)
    }
  const formula = parseFormula(c.formula)
  const omit = new Set(c.basisOmits ?? [])
  for (const [el, n] of Object.entries(formula) as [ElementSymbol, number][]) {
    if (omit.has(el)) {
      ok(Boolean(c.note && /разупорядоч|неупорядоч/.test(c.note)), `${id}: пропуск ${el} в базисе объяснён в note`)
      ok(!basis.some((s) => s.el === el), `${id}: ${el} объявлен пропущенным и действительно отсутствует`)
      continue
    }
    const count = basis.filter((s) => s.el === el).length
    ok(count === c.z * n, `${id}: атомов ${el} в ячейке ${count} = Z·n = ${c.z}·${n}`)
  }
  ok(basis.every((s) => formula[s.el] != null), `${id}: в базисе нет элементов вне формулы`)
  if (c.ionic) {
    ok(basis.every((s) => s.charge != null), `${id}: у ионной решётки заряд задан у каждого узла`)
    const q = basis.reduce((acc, s) => acc + (s.charge ?? 0), 0)
    ok(q === 0, `${id}: ячейка электронейтральна (Σq = ${q})`)
  } else {
    ok(basis.every((s) => s.charge == null), `${id}: у неионной решётки формальные заряды в базисе не ставятся`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
section('3. Рентгеновская плотность из базиса')
// ─────────────────────────────────────────────────────────────────────────────

for (const id of withBasis) {
  const c = CRYSTAL_DATA[id]
  // масса ячейки: атомы базиса + пропущенные намеренно (H льда) по формуле
  let massU = c.basis!.reduce((acc, s) => acc + ATOMIC_DATA[s.el].atomicMassU, 0)
  const formula = parseFormula(c.formula)
  for (const el of c.basisOmits ?? []) massU += c.z * (formula[el] ?? 0) * ATOMIC_DATA[el].atomicMassU
  near(massU, c.z * molarMassGMol(formula), 1e-6, `${id}: масса ячейки = Z·M(формулы)`)
  const V = cellMatrix(c).volumePm3 * 1e-30 // пм³ → см³
  const rho = massU / (NA * V)
  const rel = Math.abs(rho - c.densityGCm3) / rho
  ok(
    rel <= 0.003,
    `${id}: ρ из базиса ${rho.toFixed(4)} против ${c.densityGCm3}${c.temperatureK ? ` (при ${c.temperatureK} K)` : ''} — ${(rel * 100).toFixed(3)} %`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
section('4. Кратчайшие расстояния и защита от задвоения')
// ─────────────────────────────────────────────────────────────────────────────

for (const id of withBasis) {
  const c = CRYSTAL_DATA[id]
  let best = Infinity
  c.basis!.forEach((_, i) => {
    const n = neighbors(c, i, 700)[0]
    if (n && n.d < best) best = n.d
  })
  near(best, c.cationAnionPm, 0.1, `${id}: кратчайшее расстояние в решётке = cationAnionPm`)
  ok(best >= 0.7 * c.cationAnionPm, `${id}: ни одна пара не ближе 0.7 × ожидаемой связи`)
}

// Кубические и гексагональные правила nn(a)
{
  const nnRule: ReadonlyArray<readonly [string, ElementSymbol, ElementSymbol, number, string]> = [
    ['nacl', 'Na', 'Cl', CRYSTAL_DATA.nacl.cellPm.a / 2, 'a/2'],
    ['mgo', 'Mg', 'O', CRYSTAL_DATA.mgo.cellPm.a / 2, 'a/2'],
    ['si', 'Si', 'Si', (CRYSTAL_DATA.si.cellPm.a * Math.sqrt(3)) / 4, 'a·√3/4'],
    ['na_metal', 'Na', 'Na', (CRYSTAL_DATA.na_metal.cellPm.a * Math.sqrt(3)) / 2, 'a·√3/2'],
    ['pb_metal', 'Pb', 'Pb', CRYSTAL_DATA.pb_metal.cellPm.a / Math.SQRT2, 'a/√2'],
    ['al_metal', 'Al', 'Al', CRYSTAL_DATA.al_metal.cellPm.a / Math.SQRT2, 'a/√2'],
    ['graphite', 'C', 'C', CRYSTAL_DATA.graphite.cellPm.a / Math.sqrt(3), 'a/√3'],
    [
      'mg_metal',
      'Mg',
      'Mg',
      Math.min(
        CRYSTAL_DATA.mg_metal.cellPm.a,
        Math.sqrt(CRYSTAL_DATA.mg_metal.cellPm.a ** 2 / 3 + CRYSTAL_DATA.mg_metal.cellPm.c! ** 2 / 4),
      ),
      'min(a, √(a²/3 + c²/4))',
    ],
  ]
  for (const [id, A, B, expected, how] of nnRule) {
    near(shortest(CRYSTAL_DATA[id], A, B), expected, 0.05, `${id}: ${A}–${B} из базиса = ${how}`)
  }
}

// Адресные сверки с bondData и ориентирами документа
near(shortest(CRYSTAL_DATA.nacl, 'Na', 'Cl'), 282.0, 0.05, 'NaCl: Na⁺···Cl⁻ в кристалле 282.0 пм (газовая пара — 236.1)')
ok(shortest(CRYSTAL_DATA.nacl, 'Na', 'Cl') > bondLengthPm('Na-Cl'), 'NaCl: в кристалле расстояние БОЛЬШЕ, чем в газовой паре')
near(shortest(CRYSTAL_DATA.mgo, 'Mg', 'O'), 210.6, 0.05, 'MgO: Mg²⁺···O²⁻ 210.6 пм')
near(shortest(CRYSTAL_DATA.si, 'Si', 'Si'), bondLengthPm('Si-Si'), 0.05, 'Si: Si–Si из базиса = bondData')
near(shortest(CRYSTAL_DATA.litharge, 'Pb', 'O'), bondLengthPm('Pb-O'), 0.05, 'глёт: Pb–O из базиса = bondData')
near(shortest(CRYSTAL_DATA.litharge, 'Pb', 'O'), 231.8, 0.5, 'глёт: Pb–O = 231.8 ± 0.5 пм (z(Pb) ≈ 0.238)')
{
  const c = CRYSTAL_DATA.litharge
  const z = c.basis!.find((s) => s.el === 'Pb')!.frac[2]
  const fromCell = Math.hypot(c.cellPm.a / 2, z * c.cellPm.c!)
  near(shortest(c, 'Pb', 'O'), fromCell, 1e-6, 'глёт: Pb–O = √((a/2)² + (z·c)²)')
  ok(z > 0.237 && z < 0.239, `глёт: z(Pb) = ${z} в диапазоне 0.237–0.239`)
  // слои смотрят друг на друга через щель с парами 6s²: Pb···Pb через щель ≈ 385 пм
  const pbpb = shortest(c, 'Pb', 'Pb')
  ok(pbpb > 1.5 * bondLengthPm('Pb-O'), `глёт: Pb···Pb ${pbpb.toFixed(1)} пм — одноимённые ионы не соседи`)
}
{
  const L = distinctLengths(CRYSTAL_DATA.quartz, 'Si', 'O', 200)
  const expected = BOND_DATA['Si-O'].lengthsPm!
  ok(L.length === expected.length, `кварц: неэквивалентных Si–O ${L.length} (${L.join(', ')}) = bondData`)
  L.forEach((d, k) => near(d, expected[k], 0.1, `кварц: Si–O №${k + 1} = bondData`))
  near((L[0] + L[1]) / 2, bondLengthPm('Si-O'), 0.1, 'кварц: средняя Si–O = bondData.lengthPm')
}
{
  const L = distinctLengths(CRYSTAL_DATA.corundum, 'Al', 'O', 210)
  // Kirfel & Eichhorn 1990 / Lewis et al. 1982: 185.4 ×3 и 197.1 ×3 пм
  ok(L.length === 2, `корунд: две длины Al–O (${L.join(', ')})`)
  near(L[0], 185.4, 0.1, 'корунд: короткая Al–O')
  near(L[1], 197.1, 0.1, 'корунд: длинная Al–O')
  near(L[0], CRYSTAL_DATA.corundum.cationAnionPm, 0.1, 'корунд: cationAnionPm = короткая Al–O')
  // сумма радиусов Шеннона при ФАКТИЧЕСКИХ КЧ (Al 6, O 4) воспроизводит среднюю Al–O
  near((ionicRadiusPm('Al', 3, 6) as number) + (ionicRadiusPm('O', -2, 4) as number), (L[0] + L[1]) / 2, 1.5, 'корунд: r(Al³⁺, КЧ6) + r(O²⁻, КЧ4) ≈ средняя Al–O')
}
{
  const L = distinctLengths(CRYSTAL_DATA.massicot, 'Pb', 'O', 260)
  // Hill 1985: 222.1, 224.9, 248.1 ×2
  ok(L.length === 3, `массикот: три разные Pb–O (${L.join(', ')})`)
  near(L[0], 222.1, 0.1, 'массикот: Pb–O короткая')
  near(L[1], 224.9, 0.1, 'массикот: Pb–O вторая')
  near(L[2], 248.1, 0.1, 'массикот: Pb–O длинные')
}
{
  const co = shortest(CRYSTAL_DATA.dry_ice, 'C', 'O')
  ok(co >= 115 && co <= 116, `сухой лёд: C=O ${co.toFixed(2)} пм в 115–116`)
  near(co, bondLengthPm('C=O(CO2)'), 1.0, 'сухой лёд: C=O в кристалле ≈ газовой r_e (116.0)')
  const cc = shortest(CRYSTAL_DATA.dry_ice, 'C', 'C')
  near(cc, CRYSTAL_DATA.dry_ice.cellPm.a / Math.SQRT2, 0.05, 'сухой лёд: центры молекул — ГЦК (a/√2)')
}
{
  const oo = shortest(CRYSTAL_DATA.ice, 'O', 'O')
  near(oo, 276, 1, 'лёд Ih: O···O ≈ 276 пм')
  ok((BOND_DATA['O-H...O'].context ?? '').includes('276'), 'bondData: водородная связь называет 276 пм льда Ih')
  near(oo - bondLengthPm('O-H'), bondLengthPm('O-H...O'), 5, 'лёд Ih: O···O − O–H ≈ H···O водородной связи')
}
{
  const c = CRYSTAL_DATA.graphite
  // межслоевое: у атома 2b (0,0,¼) сосед по вертикали — (0,0,¾) на c/2
  const i = c.basis!.findIndex((s) => s.frac[0] === 0 && s.frac[1] === 0)
  const vert = neighbors(c, i, 400).find((n) => Math.abs(n.vec[0]) < 1e-6 && Math.abs(n.vec[1]) < 1e-6)
  near(vert!.d, c.cellPm.c! / 2, 0.05, 'графит: межслоевое расстояние = c/2')
}

// ─────────────────────────────────────────────────────────────────────────────
section('5. Координационные числа из базиса = coordination записи')
// ─────────────────────────────────────────────────────────────────────────────

// [id, центр, сосед, cutoff пм, ключ coordination]
const CN_SPEC: ReadonlyArray<readonly [string, ElementSymbol, ElementSymbol, number, string]> = [
  ['nacl', 'Na', 'Cl', 300, 'Na⁺'],
  ['nacl', 'Cl', 'Na', 300, 'Cl⁻'],
  ['mgo', 'Mg', 'O', 230, 'Mg²⁺'],
  ['mgo', 'O', 'Mg', 230, 'O²⁻'],
  ['na_metal', 'Na', 'Na', 400, 'Na'],
  ['mg_metal', 'Mg', 'Mg', 330, 'Mg'],
  ['graphite', 'C', 'C', 160, 'C (в слое)'],
  ['si', 'Si', 'Si', 260, 'Si'],
  ['quartz', 'Si', 'O', 200, 'Si'],
  ['quartz', 'O', 'Si', 200, 'O'],
  ['litharge', 'Pb', 'O', 260, 'Pb²⁺'],
  ['litharge', 'O', 'Pb', 260, 'O²⁻'],
  ['massicot', 'Pb', 'O', 260, 'Pb²⁺'],
  ['massicot', 'O', 'Pb', 260, 'O²⁻'],
  ['pb_metal', 'Pb', 'Pb', 380, 'Pb'],
  ['al_metal', 'Al', 'Al', 310, 'Al'],
  ['corundum', 'Al', 'O', 215, 'Al³⁺'],
  ['corundum', 'O', 'Al', 215, 'O²⁻'],
  ['ice', 'O', 'O', 290, 'O (по O)'],
  ['dry_ice', 'C', 'O', 130, 'C (по O)'],
  ['dry_ice', 'C', 'C', 420, 'CO₂ (соседних молекул)'],
]
for (const [id, A, B, cutoff, key] of CN_SPEC) {
  const c = CRYSTAL_DATA[id]
  const cns = coordinationOf(c, A, B, cutoff)
  const expected = c.coordination[key]
  ok(expected != null, `${id}: в coordination есть ключ «${key}»`)
  ok(cns.length > 0 && cns.every((n) => n === expected), `${id}: КЧ ${A} по ${B} из базиса [${[...new Set(cns)].join(', ')}] = ${expected}`)
  // cutoff не «подогнан»: следующая сфера соседей заметно дальше первой
  const firstShell = neighbors(c, c.basis!.findIndex((s) => s.el === A), 800).filter((n) => c.basis![n.j].el === B)
  const inside = firstShell.filter((n) => n.d <= cutoff)
  const outside = firstShell.find((n) => n.d > cutoff)
  if (outside && inside.length) {
    ok(outside.d > inside[inside.length - 1].d * 1.04, `${id}: КЧ ${A}/${B} — граница сферы однозначна (${inside[inside.length - 1].d.toFixed(1)} → ${outside.d.toFixed(1)} пм)`)
  }
}

// Ионные решётки: у каждого катиона ближайший сосед — анион (и наоборот)
for (const id of withBasis.filter((x) => CRYSTAL_DATA[x].ionic)) {
  const c = CRYSTAL_DATA[id]
  c.basis!.forEach((s, i) => {
    const first = neighbors(c, i, 700)[0]
    const other = c.basis![first.j]
    ok(Math.sign(other.charge!) === -Math.sign(s.charge!), `${id}: ближайший сосед ${s.el}${s.charge} — противоион (${other.el})`)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
section('6. Углы кварца = bondData')
// ─────────────────────────────────────────────────────────────────────────────
{
  const c = CRYSTAL_DATA.quartz
  const siOSi: number[] = []
  const oSiO: number[] = []
  c.basis!.forEach((s, i) => {
    const nb = neighbors(c, i, 200).filter((n) => c.basis![n.j].el !== s.el)
    for (let p = 0; p < nb.length; p++)
      for (let q = p + 1; q < nb.length; q++) (s.el === 'O' ? siOSi : oSiO).push(angleDeg(nb[p].vec, nb[q].vec))
  })
  ok(siOSi.length === 6, `кварц: 6 мостиковых O дают по одному углу Si–O–Si (${siOSi.length})`)
  near(siOSi[0], bondAngleDeg('quartzSiOSi'), 0.3, 'кварц: ∠Si–O–Si из базиса')
  const mean = oSiO.reduce((a, x) => a + x, 0) / oSiO.length
  near(mean, bondAngleDeg('quartzOSiO'), 0.3, 'кварц: средний ∠O–Si–O из базиса')
  ok(Math.min(...oSiO) > 108 && Math.max(...oSiO) < 111, `кварц: тетраэдр почти правильный (${Math.min(...oSiO).toFixed(1)}…${Math.max(...oSiO).toFixed(1)}°)`)
}

console.log(`\n✅ базисы кристаллов: ${checks} проверок пройдено`)
