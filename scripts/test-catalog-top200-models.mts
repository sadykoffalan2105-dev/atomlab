/**
 * 3D-модели 200 веществ каталога (docs/plans/catalog-top200.md, §2) — для КАЖДОГО из CATALOG_TOP200_IDS:
 *  1) модель есть (buildSchoolHeroModel) и её источник известен (кристалл / школьная сцена / ядро / формульная единица);
 *  2) состав модели = формуле (у P₂O₅ — молекула P₄O₁₀, formulaMultiple = 2); у кристалла — те же элементы;
 *  3) сумма зарядов = 0 (ионы формульной единицы; у молекулы зарядов нет);
 *  4) связи: у ионного вещества — только ВНУТРИ многоатомных ионов (между ионами палочек нет); валентности
 *     по школьной графической формуле (H — I, O — II, S — II/IV/VI, P — III/V, Cl — I/III/V/VII …);
 *  5) геометрия корня = шаблону (жёстко, ± 1 пм) и шаблон = ядру (REAGENT_GEOMETRY / BOND_DATA, ± 1 пм / ± 1°);
 *  6) шары не перекрываются: частицы касаются (радиусы Шеннона, допуск 1 пм), формульная единица связна
 *     (каждый ион касается соседа), несвязанные атомы молекулы не входят друг в друга;
 *  7) семейство «по корню» назначено (catalogFamilies), и корень вещества есть среди ионов модели.
 * Запуск: npx tsx scripts/test-catalog-top200-models.mts (npm run test:catalog-200-models)
 */
import {
  BOND_DATA,
  REAGENT_GEOMETRY,
  type ElementSymbol,
  type ReagentGeometryKey,
} from '../src/chemistry/data'
import { compoundById } from '../src/data/compounds'
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { FAMILY_TABLE_IDS, familyOf } from '../src/data/catalog/catalogFamilies'
import { buildSchoolHeroModel, type SchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { buildFormulaUnit, ionTemplate, type FormulaUnit } from '../src/components/lab/hero/formulaUnitModel'
import { pmToScene } from '../src/lab/cinema/scenes/kit/cpkAtoms'

let fails = 0
let checks = 0
function ok(cond: boolean, msg: string): void {
  checks++
  if (!cond) {
    fails++
    console.error(`  ✗ ${msg}`)
  }
}

const K = pmToScene(1)
type P = readonly number[]
const d3 = (p: P, q: P) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!)
const ang3 = (a: P, o: P, b: P) => {
  const u = [a[0]! - o[0]!, a[1]! - o[1]!, a[2]! - o[2]!]
  const v = [b[0]! - o[0]!, b[1]! - o[1]!, b[2]! - o[2]!]
  const c = (u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(u[0]!, u[1]!, u[2]!) * Math.hypot(v[0]!, v[1]!, v[2]!))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

// ─── валентности по школьной графической формуле ──────────────────────────────
const VALENCE: Partial<Record<ElementSymbol, readonly number[]>> = {
  H: [1],
  O: [2],
  F: [1],
  Cl: [1, 3, 5, 7],
  Br: [1],
  I: [1],
  S: [2, 4, 6],
  N: [2, 3, 4],
  P: [3, 5],
  C: [4],
  Si: [4],
  Mn: [7],
  Cr: [6],
  V: [5],
}
/** Исключения школьной формулы: C≡O (C и O — III), O=O→O (центр — III, конец — I). */
const VALENCE_EXTRA: Record<string, Partial<Record<ElementSymbol, readonly number[]>>> = {
  co: { C: [3], O: [3] },
  tb_o3: { O: [1, 3] },
}

// ─── ожидаемые длины по ядру ───────────────────────────────────────────────────
const ELS = /[A-Z][a-z]?|Э/g
function labelEls(label: string): string[] {
  return (label.replace(/\(.*?\)/g, '').match(ELS) ?? []) as string[]
}
/** Все длины ядра для пары элементов в записях geometry, пм. */
function coreLengths(keys: readonly ReagentGeometryKey[], a: string, b: string): number[] {
  const out: number[] = []
  for (const k of keys) {
    for (const [label, v] of Object.entries(REAGENT_GEOMETRY[k].bondsPm)) {
      if (label.includes('···')) continue
      const e = labelEls(label)
      if (e.length === 2 && ((e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) out.push(v)
    }
  }
  return out
}
function bondDataLength(a: string, b: string): number | null {
  const rec = BOND_DATA as Record<string, { lengthPm: number }>
  return rec[`${a}-${b}`]?.lengthPm ?? rec[`${b}-${a}`]?.lengthPm ?? null
}

type Pt = { el: string; p: P }
/** Длины связей и углы ядра: каждая связь пары (A,B) = одному из чисел ядра; каждый угол ядра встречается. */
function checkCoreGeometry(id: string, where: string, atoms: readonly Pt[], bonds: readonly { a: number; b: number }[], keys: readonly ReagentGeometryKey[]): void {
  for (const bd of bonds) {
    const A = atoms[bd.a]!
    const B = atoms[bd.b]!
    const L = d3(A.p, B.p)
    const vals = coreLengths(keys, A.el, B.el)
    const bdl = bondDataLength(A.el, B.el)
    const expect = vals.length ? vals : bdl != null ? [bdl] : []
    if (!expect.length) continue
    ok(
      expect.some((v) => Math.abs(v - L) <= 1),
      `${id} ${where}: связь ${A.el}–${B.el} ${L.toFixed(1)} пм, в ядре ${expect.join(' / ')}`,
    )
  }
  // углы: для каждого угла ядра — хотя бы одна тройка X–Y–Z модели с этим углом ± 1°
  const nb = atoms.map(() => [] as number[])
  for (const bd of bonds) {
    nb[bd.a]!.push(bd.b)
    nb[bd.b]!.push(bd.a)
  }
  for (const k of keys) {
    for (const [label, v] of Object.entries(REAGENT_GEOMETRY[k].anglesDeg ?? {})) {
      if (label.includes('···')) continue
      const e = labelEls(label)
      if (e.length !== 3) continue
      const match = (el: string, want: string) => want === 'Э' || el === want
      let seen = 0
      let hit = false
      atoms.forEach((Y, y) => {
        if (!match(Y.el, e[1]!)) return
        for (const x of nb[y]!)
          for (const z of nb[y]!) {
            if (x >= z && !(e[0] !== e[2])) continue
            if (x === z) continue
            if (!match(atoms[x]!.el, e[0]!) || !match(atoms[z]!.el, e[2]!)) continue
            seen++
            if (Math.abs(ang3(atoms[x]!.p, Y.p, atoms[z]!.p) - v) <= 1) hit = true
          }
      })
      if (seen) ok(hit, `${id} ${where}: угол ${label} = ${v}° из ядра (${k}) не найден в модели`)
    }
  }
}

// ─── проверки ────────────────────────────────────────────────────────────────
const sources = new Map<string, number>()
const top = new Set(CATALOG_TOP200_IDS)
ok(CATALOG_TOP200_IDS.length === 200, `в списке ${CATALOG_TOP200_IDS.length} веществ, нужно 200`)
for (const id of FAMILY_TABLE_IDS) ok(top.has(id), `семейство назначено веществу вне 200: ${id}`)

for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  if (!c) {
    ok(false, `${id}: нет в compounds`)
    continue
  }
  const m: SchoolHeroModel | null = buildSchoolHeroModel(c)
  ok(!!m, `${id} (${c.formulaUnicode}): нет 3D-модели`)
  if (!m) continue
  sources.set(m.source, (sources.get(m.source) ?? 0) + 1)
  ok(m.source !== 'catalog', `${id} (${c.formulaUnicode}): модель по сырой геометрии каталога, нужна по ядру`)

  // 7) семейство
  const fam = familyOf(id)
  ok(!!fam, `${id}: семейство не назначено`)

  // 2) состав
  const counts: Record<string, number> = {}
  for (const a of m.atoms) counts[a.el] = (counts[a.el] ?? 0) + 1
  const comp = c.composition as Record<string, number>
  if (m.kind === 'crystal') {
    ok(
      Object.keys(counts).sort().join() === Object.keys(comp).sort().join(),
      `${id}: элементы кристалла ${Object.keys(counts)} ≠ формуле ${Object.keys(comp)}`,
    )
    continue
  }
  const mult = m.formulaMultiple ?? 1
  const want = Object.entries(comp)
    .map(([el, n]) => `${el}${n * mult}`)
    .sort()
    .join(' ')
  const got = Object.entries(counts)
    .map(([el, n]) => `${el}${n}`)
    .sort()
    .join(' ')
  ok(want === got, `${id} (${c.formulaUnicode}): состав модели ${got}, по формуле ${want}`)

  // 3) заряды
  if (m.ions) {
    const q = m.ions.reduce((s, i) => s + i.charge, 0)
    ok(q === 0, `${id}: сумма зарядов ионов ${q}`)
    const covered = new Set(m.ions.flatMap((i) => i.atoms))
    ok(covered.size === m.atoms.length, `${id}: не все атомы принадлежат ионам`)
  } else {
    ok(
      m.atoms.every((a) => a.charge === 0),
      `${id}: у молекулы заряженные атомы`,
    )
  }

  // 4) связи и валентности
  const ionOf = new Map<number, number>()
  m.ions?.forEach((ion, k) => ion.atoms.forEach((a) => ionOf.set(a, k)))
  const sumOrder = m.atoms.map(() => 0)
  const nbEl = m.atoms.map(() => [] as string[])
  for (const b of m.bonds) {
    ok(b.order >= 1 && b.order <= 3, `${id}: кратность ${b.order}`)
    sumOrder[b.a]! += b.order
    sumOrder[b.b]! += b.order
    nbEl[b.a]!.push(m.atoms[b.b]!.el)
    nbEl[b.b]!.push(m.atoms[b.a]!.el)
    if (m.ions) ok(ionOf.get(b.a) === ionOf.get(b.b), `${id}: палочка между разными ионами (${m.atoms[b.a]!.label}–${m.atoms[b.b]!.label})`)
  }
  m.atoms.forEach((a, i) => {
    const ionIdx = ionOf.get(i)
    const ion = ionIdx != null ? m.ions![ionIdx]! : null
    const inPolyIon = ion != null && ion.charge !== 0 && ion.atoms.length > 1
    const mono = ion != null && ion.atoms.length === 1
    if (mono) {
      ok(sumOrder[i] === 0, `${id}: у простого иона ${a.label} есть связи`)
      return
    }
    const allowed = [...(VALENCE[a.el] ?? []), ...(VALENCE_EXTRA[id]?.[a.el] ?? [])]
    if (!allowed.length) return
    if (inPolyIon) {
      // в многоатомном ионе заряд «сидит» на O: O — I или II, центр — не больше высшей валентности
      if (a.el === 'H') ok(sumOrder[i] === 1, `${id}: H в ${ion!.label} — ${sumOrder[i]} связи`)
      else if (a.el === 'O') ok(sumOrder[i]! >= 1 && sumOrder[i]! <= 2, `${id}: O в ${ion!.label} — валентность ${sumOrder[i]}`)
      else ok(sumOrder[i]! >= 1 && sumOrder[i]! <= Math.max(...allowed), `${id}: ${a.el} в ${ion!.label} — ${sumOrder[i]} связей`)
      return
    }
    // O с одной связью у N (N→O, донорно-акцепторная) — как в школьной формуле NO₂, HNO₃, N₂O₄
    const okO1 = a.el === 'O' && sumOrder[i] === 1 && nbEl[i]!.includes('N')
    ok(allowed.includes(sumOrder[i]!) || okO1, `${id} (${c.formulaUnicode}): валентность ${a.el} = ${sumOrder[i]}, допустимо ${allowed.join('/')}`)
  })

  // 5–6) формульная единица / молекула по ядру
  if (m.source !== 'unit') continue
  const u: FormulaUnit | null = buildFormulaUnit(id)
  ok(!!u, `${id}: источник unit, но buildFormulaUnit = null`)
  if (!u) continue
  ok(u.atoms.length === m.atoms.length, `${id}: число атомов модели ≠ формульной единице`)
  u.atoms.forEach((a, i) => ok(Math.abs(m.atoms[i]!.r - a.drawPm * K) < 1e-9, `${id}: радиус шара ${a.label} ≠ формульной единице`))

  if (u.kind === 'molecule') {
    checkCoreGeometry(id, 'молекула', u.atoms, u.bonds, u.geometry)
    // несвязанные атомы не входят друг в друга
    const bonded = new Set(u.bonds.flatMap((b) => [`${b.a}|${b.b}`, `${b.b}|${b.a}`]))
    for (let i = 0; i < u.atoms.length; i++)
      for (let j = i + 1; j < u.atoms.length; j++) {
        if (bonded.has(`${i}|${j}`)) continue
        const A = u.atoms[i]!
        const B = u.atoms[j]!
        ok(d3(A.p, B.p) >= A.drawPm + B.drawPm, `${id}: шары ${A.el}${i} и ${B.el}${j} перекрываются (${d3(A.p, B.p).toFixed(0)} пм)`)
      }
    continue
  }

  // ионное: каждый многоатомный ион = шаблону (жёстко) и шаблон = ядру
  for (const ion of u.ions) {
    const t = ionTemplate(ion.key)
    ok(t.atoms.length === ion.atoms.length, `${id}: ион ${ion.label} — ${ion.atoms.length} атомов, в шаблоне ${t.atoms.length}`)
    for (let i = 0; i < t.atoms.length; i++)
      for (let j = i + 1; j < t.atoms.length; j++) {
        const dm = d3(u.atoms[ion.atoms[i]!]!.p, u.atoms[ion.atoms[j]!]!.p)
        const dt = d3(t.atoms[i]!.p, t.atoms[j]!.p)
        ok(Math.abs(dm - dt) <= 1, `${id}: ион ${ion.label} искажён (${dm.toFixed(1)} против ${dt.toFixed(1)} пм)`)
      }
    if (ion.geometry) {
      const keys: ReagentGeometryKey[] = [ion.geometry]
      if (ion.key === 'HSO4' || ion.key === 'HPO4' || ion.key === 'H2PO4') keys.push('acidOH')
      const pts = t.atoms.map((a) => ({ el: a.el, p: a.p }))
      checkCoreGeometry(id, `ион ${ion.label}`, pts, t.bonds.map(([a, b]) => ({ a, b })), keys)
    }
  }
  // касание: нет перекрытий между частицами (допуск 1 пм), граф касаний связен
  const touch = u.ions.map(() => new Set<number>())
  for (let i = 0; i < u.ions.length; i++)
    for (let j = i + 1; j < u.ions.length; j++) {
      let gap = Infinity
      for (const a of u.ions[i]!.atoms)
        for (const b of u.ions[j]!.atoms) {
          const A = u.atoms[a]!
          const B = u.atoms[b]!
          const c = A.contact != null && B.contact != null ? A.contact + B.contact : A.drawPm + B.drawPm + 8
          gap = Math.min(gap, d3(A.p, B.p) - c)
        }
      ok(gap >= -1, `${id}: ${u.ions[i]!.label} и ${u.ions[j]!.label} перекрываются на ${(-gap).toFixed(1)} пм`)
      if (gap <= 2) {
        touch[i]!.add(j)
        touch[j]!.add(i)
      }
    }
  const seen = new Set<number>([0])
  const stack = [0]
  while (stack.length) for (const n of touch[stack.pop()!]!) if (!seen.has(n)) (seen.add(n), stack.push(n))
  ok(seen.size === u.ions.length, `${id}: формульная единица распалась — касаются ${seen.size} из ${u.ions.length} частиц`)
  // 7) корень вещества — среди ионов
  const root = fam?.root
  if (root && fam?.family.id !== 'ammoniaHydrate') ok(u.ions.some((i) => i.label === root.formula), `${id}: корня ${root.formula} нет среди ионов ${u.ions.map((i) => i.label).join(', ')}`)
}

console.log(`источники моделей: ${[...sources].map(([k, n]) => `${k} ${n}`).join(', ')}`)
console.log(`${checks - fails}/${checks} проверок`)
if (fails) {
  console.error(`test-catalog-top200-models: ${fails} ошибок`)
  process.exit(1)
}
console.log('test-catalog-top200-models: OK — 200 моделей: состав, заряды, валентности, геометрия ядра, касание, семейства')
