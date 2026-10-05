#!/usr/bin/env node
/**
 * Органика v2 — проверка src/data/organicV2/reactions.json (контракт src/data/organicV2/types.ts).
 *
 *  1. Каждая реакция: тип из списка, атомы и связи участников согласованы, номера соответствия 1..N уникальны
 *     на каждой стороне и совпадают слева и справа, элемент атома с одним номером одинаков (сохранение атомов
 *     ⇒ уравнение уравнено), сумма формальных зарядов слева = справа.
 *  2. changes = ровно разница связей (по номерам соответствия) между левой и правой частью.
 *  3. routes / uses ссылаются на существующие реакции, молекула действительно продукт / исходное вещество.
 *  4. У каждой из молекул реестра (ORGANIC_MOLECULES) есть ≥ 1 маршрут получения.
 *  5. Покрытие учебника: органические реакции equations-g10/g11 (кроме чистых схем и ионных) — ≥ 95 % в файле.
 *
 * Запуск: npx tsx scripts/validate-organic-v2-reactions.mts
 */
import fs from 'node:fs'
import { parseEquationText } from '../src/chemistry/equationFormula.ts'
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import type { OV2Reaction, OV2ReactionsFile, OV2ReactionType } from '../src/data/organicV2/types.ts'
import { isOrganicFormula } from '../src/lab/reactorDeepLink.ts'

const TYPES: readonly OV2ReactionType[] = [
  'combustion', 'substitutionRadical', 'substitution', 'addition', 'hydrogenation', 'halogenation',
  'hydrohalogenation', 'hydration', 'elimination', 'dehydration', 'dehydrogenation', 'dehydrohalogenation',
  'esterification', 'hydrolysis', 'polymerization', 'polycondensation', 'oxidation', 'reduction', 'nitration',
  'sulfonation', 'fermentation', 'cracking', 'isomerization', 'wurtz', 'acidBase', 'metal', 'trimerization', 'other',
]

const file = JSON.parse(fs.readFileSync('src/data/organicV2/reactions.json', 'utf8')) as OV2ReactionsFile
const errors: string[] = []
const err = (rx: OV2Reaction | string, msg: string) =>
  errors.push(`${typeof rx === 'string' ? rx : rx.id}: ${msg}`)

const byId = new Map<string, OV2Reaction>()
const typeCount = new Map<string, number>()
let atomsTotal = 0

for (const rx of file.reactions) {
  if (byId.has(rx.id)) err(rx, 'повтор id')
  byId.set(rx.id, rx)
  if (!TYPES.includes(rx.type)) err(rx, `неизвестный тип ${rx.type}`)
  typeCount.set(rx.type, (typeCount.get(rx.type) ?? 0) + 1)
  if (!rx.equation) err(rx, 'нет уравнения')
  if (rx.source.grade !== 10 && rx.source.grade !== 11) err(rx, 'source.grade не 10/11')
  if (!rx.species.some((s) => s.side === 'L') || !rx.species.some((s) => s.side === 'R')) err(rx, 'пустая сторона')

  // номер соответствия → элемент (по сторонам), связи по номерам
  const el = { L: new Map<number, string>(), R: new Map<number, string>() }
  const bonds = { L: new Map<string, number>(), R: new Map<string, number>() }
  const arom = { L: new Set<string>(), R: new Set<string>() }
  const charge = { L: 0, R: 0 }
  for (const sp of rx.species) {
    if (sp.map.length !== sp.atoms.length) {
      err(rx, `${sp.ref}: map ${sp.map.length} ≠ атомов ${sp.atoms.length}`)
      continue
    }
    if (!/^(inorg:|new:|polymer:)/.test(sp.ref) && !sp.ref) err(rx, 'пустой ref')
    sp.atoms.forEach((a, i) => {
      const m = sp.map[i]
      if (!Number.isInteger(m) || m < 1) err(rx, `${sp.ref}: плохой номер ${m}`)
      if (el[sp.side].has(m)) err(rx, `сторона ${sp.side}: номер ${m} повторяется`)
      el[sp.side].set(m, a.el)
      charge[sp.side] += a.ch
      if (!a.p.every(Number.isFinite) || !a.p2.every(Number.isFinite) || !Number.isFinite(a.q))
        err(rx, `${sp.ref}: нечисловые координаты/заряд у атома ${i}`)
    })
    for (const b of sp.bonds) {
      if (b.a < 0 || b.b < 0 || b.a >= sp.atoms.length || b.b >= sp.atoms.length || b.a === b.b) {
        err(rx, `${sp.ref}: связь вне атомов ${b.a}-${b.b}`)
        continue
      }
      const x = sp.map[b.a]
      const y = sp.map[b.b]
      const key = x < y ? `${x}-${y}` : `${y}-${x}`
      bonds[sp.side].set(key, b.o)
      if (b.ar) arom[sp.side].add(key)
    }
  }
  atomsTotal += el.L.size
  if (el.L.size !== el.R.size) err(rx, `атомов слева ${el.L.size}, справа ${el.R.size} — не уравнено`)
  for (const [m, e] of el.L) {
    const r = el.R.get(m)
    if (r == null) err(rx, `номер ${m} (${e}) есть только слева`)
    else if (r !== e) err(rx, `номер ${m}: ${e} слева, ${r} справа`)
  }
  if (el.L.size === el.R.size && Math.max(...el.L.keys()) !== el.L.size) err(rx, 'номера не 1..N')
  if (charge.L !== charge.R) err(rx, `заряд слева ${charge.L}, справа ${charge.R}`)

  // changes = разница связей
  const want = new Map<string, [number, number]>()
  for (const k of new Set([...bonds.L.keys(), ...bonds.R.keys()])) {
    const f = bonds.L.get(k) ?? 0
    const t = bonds.R.get(k) ?? 0
    // ароматическая связь осталась ароматической — сдвиг формы Кекуле не считается изменением
    if (arom.L.has(k) && arom.R.has(k)) continue
    if (f !== t) want.set(k, [f, t])
  }
  const got = new Map<string, [number, number]>()
  for (const c of rx.changes) {
    const k = c.a < c.b ? `${c.a}-${c.b}` : `${c.b}-${c.a}`
    if (got.has(k)) err(rx, `changes: связь ${k} дважды`)
    got.set(k, [c.from, c.to])
  }
  for (const [k, [f, t]] of want) {
    const g = got.get(k)
    if (!g || g[0] !== f || g[1] !== t) err(rx, `changes: нет/неверно ${k} ${f}→${t}`)
  }
  for (const k of got.keys()) if (!want.has(k)) err(rx, `changes: лишняя ${k}`)
  if (rx.type !== 'isomerization' && rx.changes.length === 0 && !rx.polymer) err(rx, 'нет ни одного изменения связей')
}

// маршруты и свойства
const regIds = ORGANIC_MOLECULES.map((m) => m.id)
for (const [mid, ids] of Object.entries(file.routes)) {
  for (const id of ids) {
    const rx = byId.get(id)
    if (!rx) err(`routes[${mid}]`, `нет реакции ${id}`)
    else if (!rx.species.some((s) => s.side === 'R' && s.ref === mid)) err(`routes[${mid}]`, `${id}: не продукт`)
  }
}
for (const [mid, ids] of Object.entries(file.uses)) {
  for (const id of ids) {
    const rx = byId.get(id)
    if (!rx) err(`uses[${mid}]`, `нет реакции ${id}`)
    else if (!rx.species.some((s) => s.side === 'L' && s.ref === mid)) err(`uses[${mid}]`, `${id}: не исходное`)
  }
}
const noRoute = regIds.filter((id) => !(file.routes[id]?.length))
for (const id of noRoute) err(`routes[${id}]`, 'нет ни одного маршрута получения')

// покрытие учебника
type Unit = { unitId: string; reactions: { id: string; equationAscii: string }[] }
let organicBook = 0
let inFile = 0
const missing: string[] = []
for (const grade of [10, 11] as const) {
  const book = JSON.parse(fs.readFileSync(`src/data/textbook/equations-g${grade}.json`, 'utf8')) as { units: Unit[] }
  for (const u of book.units) {
    for (const r of u.reactions) {
      const p = parseEquationText(r.equationAscii)
      const organic = p
        ? [...p.reactants, ...p.products].some(
            (s) => s.counts && (isOrganicFormula(s.formula, s.counts) || ((s.counts.C ?? 0) > 0 && /COO|OOC/.test(s.formula) && !/CO3/.test(s.formula))),
          )
        : /C\d*H/.test(r.equationAscii)
      if (!organic) continue
      const pureScheme = !p || p.isIonic || /C[nm]H|\bn\/2/.test(r.equationAscii)
      if (pureScheme) continue
      organicBook++
      const id = `g${grade}-${u.unitId}-${r.id}`
      if (byId.has(id)) inFile++
      else missing.push(`${id}  ${r.equationAscii}`)
    }
  }
}
const pct = organicBook ? (100 * inFile) / organicBook : 0
if (pct < 95) errors.push(`покрытие учебника ${pct.toFixed(1)} % < 95 %`)

const book = file.reactions.filter((r) => /^g1[01]-/.test(r.id)).length
const gen = file.reactions.length - book
console.log(`реакций: ${file.reactions.length} (учебник ${book}, общие схемы ${gen}), атомов слева всего ${atomsTotal}`)
console.log(`маршруты: ${regIds.length - noRoute.length}/${regIds.length} молекул реестра; uses: ${Object.keys(file.uses).length}`)
console.log(`покрытие учебника: ${inFile}/${organicBook} органических без чистых схем = ${pct.toFixed(1)} %`)
if (missing.length) console.log('не в файле:\n  ' + missing.join('\n  '))
console.log('типы: ' + [...typeCount].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '))
if (errors.length) {
  console.error(`ОШИБКИ (${errors.length}):\n  ` + errors.slice(0, 60).join('\n  '))
  process.exit(1)
}
console.log('OK')
