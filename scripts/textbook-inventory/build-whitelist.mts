// Белый список каталога по учебникам Kimyo 7–11.
// Сопоставляет вещества из src/data/textbook/substances-gN.json с каталогом по составу (и органику по формуле),
// пишет src/data/textbook/textbookWhitelist.json и отчёт .smoke/textbook-inventory/whitelist-report.json.
// Запуск: npx tsx scripts/textbook-inventory/build-whitelist.mts
import fs from 'node:fs'
import path from 'node:path'
;(globalThis as { __ATOMLAB_CATALOG_ALL__?: boolean }).__ATOMLAB_CATALOG_ALL__ = true
const { compoundById } = await import('../../src/data/compounds')
const { ORGANIC_MOLECULES } = await import('../../src/data/organicLab/organicMoleculeRegistry')

type Sub = { formula: string | null; formulaUnicode?: string | null; nameRu?: string | null; kind?: string; catalogId?: string | null; sections?: string[]; roles?: string[]; firstPage?: number | null }

const DIR = path.resolve('src/data/textbook')
const GRADES = [7, 8, 9, 10, 11]

import { ascii, parseComposition } from './formula.mts'

const compKey = (c: Record<string, number>) =>
  Object.entries(c)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([el, n]) => `${el}${n}`)
    .join('')

const inorganicByKey = new Map<string, string[]>()
for (const c of Object.values(compoundById)) {
  const k = compKey(c.composition)
  const arr = inorganicByKey.get(k) ?? []
  arr.push(c.id)
  inorganicByKey.set(k, arr)
}
const organicByKey = new Map<string, string[]>()
const organicByName = new Map<string, string>()
for (const m of ORGANIC_MOLECULES) {
  const comp = parseComposition(m.formula)
  if (comp) {
    const k = compKey(comp)
    const arr = organicByKey.get(k) ?? []
    arr.push(m.id)
    organicByKey.set(k, arr)
  }
  organicByName.set(m.nameRu.toLowerCase(), m.id)
}

const inorganicIds = new Set<string>()
const organicIds = new Set<string>()
const evidence: Record<string, { grades: number[]; names: string[]; firstPage: number | null }> = {}
const unmapped = new Map<string, { formula: string | null; nameRu: string | null; kind: string; grades: Set<number>; sections: number }>()

for (const g of GRADES) {
  const file = path.join(DIR, `substances-g${g}.json`)
  if (!fs.existsSync(file)) continue
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { substances: Sub[] }
  for (const s of data.substances) {
    const ids: string[] = []
    const comp = s.formula ? parseComposition(s.formula) : null
    if (comp) {
      const k = compKey(comp)
      for (const id of inorganicByKey.get(k) ?? []) ids.push(id)
      for (const id of organicByKey.get(k) ?? []) ids.push(id)
    }
    if (ids.length === 0 && s.catalogId && (compoundById[s.catalogId] || ORGANIC_MOLECULES.some((m) => m.id === s.catalogId))) {
      ids.push(s.catalogId)
    }
    if (ids.length === 0 && s.nameRu) {
      const byName = organicByName.get(s.nameRu.toLowerCase())
      if (byName) ids.push(byName)
    }
    if (ids.length === 0) {
      const key = s.formula ? `f:${ascii(s.formula)}` : `n:${(s.nameRu ?? '').toLowerCase()}`
      const u = unmapped.get(key) ?? { formula: s.formula, nameRu: s.nameRu ?? null, kind: s.kind ?? 'other', grades: new Set<number>(), sections: 0 }
      u.grades.add(g)
      u.sections += s.sections?.length ?? 1
      unmapped.set(key, u)
      continue
    }
    for (const id of ids) {
      if (compoundById[id]) inorganicIds.add(id)
      else organicIds.add(id)
      const ev = (evidence[id] ??= { grades: [], names: [], firstPage: null })
      if (!ev.grades.includes(g)) ev.grades.push(g)
      if (s.nameRu && !ev.names.includes(s.nameRu) && ev.names.length < 4) ev.names.push(s.nameRu)
      if (ev.firstPage == null && s.firstPage != null) ev.firstPage = s.firstPage
    }
  }
}

const allInorganic = Object.keys(compoundById)
const extraInorganic = allInorganic.filter((id) => !inorganicIds.has(id))
const extraOrganic = ORGANIC_MOLECULES.map((m) => m.id).filter((id) => !organicIds.has(id))

fs.writeFileSync(
  path.join(DIR, 'textbookWhitelist.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: 'Вещества каталога, найденные в учебниках Kimyo 7–11 (по составу формулы). Сгенерировано build-whitelist.mts.',
      inorganic: [...inorganicIds].sort(),
      organic: [...organicIds].sort(),
      evidence,
    },
    null,
    1,
  ),
)

fs.writeFileSync(
  path.join(DIR, 'catalogWhitelist.json'),
  JSON.stringify({ inorganic: [...inorganicIds].sort(), organic: [...organicIds].sort() }, null, 1) + '\n',
)

fs.mkdirSync('.smoke/textbook-inventory', { recursive: true })
const unmappedList = [...unmapped.values()]
  .map((u) => ({ ...u, grades: [...u.grades] }))
  .sort((a, b) => b.sections - a.sections)
fs.writeFileSync(
  '.smoke/textbook-inventory/whitelist-report.json',
  JSON.stringify({ extraInorganic, extraOrganic, unmapped: unmappedList }, null, 1),
)

const byCat: Record<string, [number, number]> = {}
for (const c of Object.values(compoundById)) {
  const e = (byCat[c.category] ??= [0, 0])
  e[1]++
  if (inorganicIds.has(c.id)) e[0]++
}
console.log('inorganic in textbooks:', inorganicIds.size, 'of', allInorganic.length, byCat)
console.log('organic in textbooks:', organicIds.size, 'of', ORGANIC_MOLECULES.length)
console.log('extra organic:', extraOrganic.join(', '))
console.log('unmapped textbook substances (candidates to add):', unmappedList.length)
console.log(
  unmappedList
    .slice(0, 60)
    .map((u) => `${u.formula ?? '—'} ${u.nameRu ?? ''} [${u.kind}; g${u.grades.join(',')}; x${u.sections}]`)
    .join('\n'),
)
