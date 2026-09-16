/**
 * Проверка 3D-геометрии всех веществ каталога:
 * состав атомов = composition, нет наложений (< 0.45), связи 0.28–0.75,
 * молекулы связны, многоатомные ионы связны внутри, валентности не превышены.
 * Код выхода 1 — только при ошибках у веществ, которые строит inorganicGeometry.
 *   npm run verify:geometry
 */
import { compoundById } from '../src/data/compounds'
import { INORGANIC_RAW } from '../src/data/inorganicCompounds.data'
import { TEXTBOOK_EXTRA_RAW } from '../src/data/textbookCompounds.data'
import { getMolecularGeometryOrNull } from '../src/chemistry/catalogGeometryOverrides'
import { buildInorganicGeometryDetailed } from '../src/chemistry/inorganicGeometry'
import type { RawCompoundDef } from '../src/types/chemistry'

const rawById = new Map<string, RawCompoundDef>()
for (const r of [...INORGANIC_RAW, ...TEXTBOOK_EXTRA_RAW]) rawById.set(r.id, r)

const MAX_VALENCE: Record<string, number> = {
  H: 1, O: 3, C: 4, N: 4, B: 4, F: 1, Cl: 7, Br: 7, I: 7, S: 6, Se: 6, Te: 6, P: 6, As: 6, Sb: 6, Si: 6, Ge: 4, Xe: 8, Al: 6,
}

type Source = 'raw' | 'override' | 'inorganic' | 'placeholder' | 'hand'

function sourceOf(id: string): Source {
  const raw = rawById.get(id)
  if (!raw) return 'hand'
  if (raw.atoms && raw.atoms.length > 0 && raw.bonds !== undefined) return 'raw'
  if (getMolecularGeometryOrNull(id)) return 'override'
  if (buildInorganicGeometryDetailed(raw.formulaUnicode, raw.composition, raw.category, raw.id)) return 'inorganic'
  return 'placeholder'
}

function connected(n: number, ids: number[], bonds: readonly (readonly [number, number])[]): boolean {
  if (ids.length <= 1) return true
  const set = new Set(ids)
  const adj = new Map<number, number[]>()
  for (const i of ids) adj.set(i, [])
  for (const [a, b] of bonds) {
    if (set.has(a) && set.has(b)) {
      adj.get(a)!.push(b)
      adj.get(b)!.push(a)
    }
  }
  const seen = new Set<number>([ids[0]!])
  const stack = [ids[0]!]
  while (stack.length) {
    const v = stack.pop()!
    for (const w of adj.get(v) ?? []) if (!seen.has(w)) {
      seen.add(w)
      stack.push(w)
    }
  }
  void n
  return seen.size === ids.length
}

const failures: { id: string; source: Source; msg: string }[] = []
const bySource: Record<Source, number> = { raw: 0, override: 0, inorganic: 0, placeholder: 0, hand: 0 }
const kinds: Record<string, number> = {}

for (const c of Object.values(compoundById)) {
  const src = sourceOf(c.id)
  bySource[src]++
  const errs: string[] = []
  const atoms = c.atoms
  const bonds = c.bonds
  // состав
  const got: Record<string, number> = {}
  for (const a of atoms) got[a.symbol] = (got[a.symbol] ?? 0) + 1
  const keys = new Set([...Object.keys(got), ...Object.keys(c.composition)])
  for (const k of keys) if ((got[k] ?? 0) !== (c.composition[k] ?? 0)) errs.push(`composition ${k}: atoms ${got[k] ?? 0} vs ${c.composition[k] ?? 0}`)
  // связи
  const bonded = new Set<string>()
  const deg = new Array<number>(atoms.length).fill(0)
  for (const [a, b] of bonds) {
    if (a === b || a < 0 || b < 0 || a >= atoms.length || b >= atoms.length) {
      errs.push(`bad bond index ${a}-${b}`)
      continue
    }
    bonded.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
    deg[a]!++
    deg[b]!++
    const d = Math.hypot(...atoms[a]!.pos.map((v, i) => v - atoms[b]!.pos[i]!))
    if (d < 0.28 || d > 0.75) errs.push(`bond ${atoms[a]!.symbol}${a}-${atoms[b]!.symbol}${b} length ${d.toFixed(2)}`)
  }
  // наложения
  let overlaps = 0
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) {
      if (bonded.has(`${i}-${j}`)) continue
      const d = Math.hypot(...atoms[i]!.pos.map((v, k) => v - atoms[j]!.pos[k]!))
      if (d < 0.45) {
        overlaps++
        if (overlaps <= 2) errs.push(`atoms ${atoms[i]!.symbol}${i} and ${atoms[j]!.symbol}${j} too close (${d.toFixed(2)})`)
      }
    }
  if (overlaps > 2) errs.push(`... ${overlaps} overlapping pairs total`)
  // валентности
  atoms.forEach((a, i) => {
    const max = MAX_VALENCE[a.symbol] ?? 8
    if (deg[i]! > max) errs.push(`valence ${a.symbol}${i} = ${deg[i]} > ${max}`)
  })
  // связность
  if (src === 'inorganic') {
    const raw = rawById.get(c.id)!
    const det = buildInorganicGeometryDetailed(raw.formulaUnicode, raw.composition, raw.category, raw.id)!
    kinds[det.kind] = (kinds[det.kind] ?? 0) + 1
    if (det.kind === 'molecule') {
      if (!connected(atoms.length, atoms.map((_, i) => i), bonds)) errs.push('molecule not connected')
    } else {
      det.fragments.forEach((ids, k) => {
        if (!connected(atoms.length, ids, bonds)) errs.push(`fragment #${k} (${ids.map((i) => atoms[i]!.symbol).join('')}) not connected`)
      })
      if (det.kind === 'ionic') {
        const fragOf = new Map<number, number>()
        det.fragments.forEach((ids, k) => ids.forEach((i) => fragOf.set(i, k)))
        for (const [a, b] of bonds) if (fragOf.get(a) !== fragOf.get(b)) errs.push(`bond crosses ions ${a}-${b}`)
      }
    }
  } else if (c.category !== 'salt' && atoms.length > 1) {
    if (!connected(atoms.length, atoms.map((_, i) => i), bonds)) errs.push('not connected')
  }
  for (const msg of errs) failures.push({ id: c.id, source: src, msg })
}

const mine = failures.filter((f) => f.source === 'inorganic')
const others = failures.filter((f) => f.source !== 'inorganic')
console.log(`compounds: ${Object.keys(compoundById).length}; by source:`, bySource)
console.log('inorganicGeometry kinds:', kinds)
const print = (title: string, list: typeof failures) => {
  if (!list.length) return
  console.log(`\n${title} (${new Set(list.map((f) => f.id)).size} compounds, ${list.length} issues):`)
  for (const f of list) console.log(`  [${f.source}] ${f.id}: ${f.msg}`)
}
print('FAILURES in inorganicGeometry', mine)
print('Issues in other sources (informational)', others)
if (mine.length) {
  console.log(`\nverify:geometry FAILED: ${new Set(mine.map((f) => f.id)).size} compounds`)
  process.exit(1)
}
console.log('\nverify:geometry OK (0 failures for inorganicGeometry)')
