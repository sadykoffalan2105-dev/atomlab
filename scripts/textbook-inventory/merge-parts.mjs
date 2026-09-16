// Сводит inventory-gN-part1/2.json в inventory-gN.json + substances-gN.json + reactions-gN.json
// (формат как у агентной сводки 8/11 класса). Запуск: node scripts/textbook-inventory/merge-parts.mjs 7 9 10
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('src/data/textbook')
const grades = process.argv.slice(2).map(Number).filter(Boolean)

const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const toAscii = (s) =>
  String(s ?? '')
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, ' ')
    .trim()

function slug(eq) {
  return toAscii(eq)
    .toLowerCase()
    .replace(/[↑↓]/g, '')
    .replace(/\s*(=|→|->|⇌|<=>)\s*/g, '--')
    .replace(/\s*\+\s*/g, '-')
    .replace(/[^a-z0-9()\-]+/g, '')
    .replace(/[()]/g, '')
    .slice(0, 80)
}

for (const g of grades) {
  const parts = [1, 2]
    .map((p) => `inventory-g${g}-part${p}.json`)
    .filter((f) => fs.existsSync(path.join(DIR, f)))
    .map(read)
  if (parts.length === 0) {
    console.log(`g${g}: no parts`)
    continue
  }
  const sections = []
  const seen = new Set()
  for (const part of parts) {
    for (const s of part.sections ?? []) {
      const key = `${s.sectionId}|${s.title}`
      if (seen.has(key)) continue
      seen.add(key)
      sections.push(s)
    }
  }

  const subs = new Map()
  const rxs = new Map()
  for (const s of sections) {
    for (const x of s.substances ?? []) {
      const key = x.formula ? `f:${toAscii(x.formula)}` : `n:${String(x.nameRu ?? '').toLowerCase()}`
      let e = subs.get(key)
      if (!e) {
        e = {
          formula: x.formula ? toAscii(x.formula) : null,
          formulaUnicode: x.formulaUnicode ?? x.formula ?? null,
          nameRu: x.nameRu ?? null,
          kind: x.kind ?? 'other',
          catalogId: x.catalogId ?? null,
          sections: [],
          roles: [],
          firstPage: x.page ?? null,
        }
        subs.set(key, e)
      }
      if (!e.catalogId && x.catalogId) e.catalogId = x.catalogId
      if (!e.nameRu && x.nameRu) e.nameRu = x.nameRu
      if (!e.sections.includes(s.sectionId)) e.sections.push(s.sectionId)
      if (x.role && !e.roles.includes(x.role)) e.roles.push(x.role)
      if (x.page != null && (e.firstPage == null || x.page < e.firstPage)) e.firstPage = x.page
    }
    for (const r of s.reactions ?? []) {
      const eqAscii = r.equationAscii ?? toAscii(r.equation ?? r.equationAsInBook)
      const id = slug(eqAscii)
      if (!id) continue
      let e = rxs.get(id)
      if (!e) {
        e = {
          id,
          equation: eqAscii,
          equationUnicode: r.equation ?? r.equationAsInBook ?? eqAscii,
          reactants: r.reactants ?? [],
          products: r.products ?? [],
          conditions: r.conditions ?? null,
          type: r.type ?? 'other',
          sections: [],
          page: r.page ?? null,
          pages: [],
          bankId: r.bankId ?? null,
          isGeneralScheme: Boolean(r.isGeneralScheme),
          isIonic: Boolean(r.isIonic),
          balanced: r.balanced ?? null,
        }
        rxs.set(id, e)
      }
      if (!e.bankId && r.bankId) e.bankId = r.bankId
      if (!e.sections.includes(s.sectionId)) e.sections.push(s.sectionId)
      if (r.page != null && !e.pages.includes(r.page)) e.pages.push(r.page)
    }
  }

  const now = new Date().toISOString()
  fs.writeFileSync(
    path.join(DIR, `inventory-g${g}.json`),
    JSON.stringify({ grade: g, generatedAt: now, mergedFrom: parts.map((p) => p.part ?? '?'), sections }),
  )
  const substances = [...subs.values()]
  const reactions = [...rxs.values()]
  fs.writeFileSync(
    path.join(DIR, `substances-g${g}.json`),
    JSON.stringify({ grade: g, generatedAt: now, count: substances.length, substances }),
  )
  fs.writeFileSync(
    path.join(DIR, `reactions-g${g}.json`),
    JSON.stringify({ grade: g, generatedAt: now, count: reactions.length, reactions }),
  )
  const mapped = substances.filter((x) => x.catalogId).length
  console.log(
    `g${g}: sections ${sections.length}, substances ${substances.length} (catalog-mapped ${mapped}), reactions ${reactions.length} (bank ${reactions.filter((r) => r.bankId).length})`,
  )
}
