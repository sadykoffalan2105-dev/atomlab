import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compoundById } from '../src/data/compounds'
import {
  validateReactorEquation,
} from '../src/chemistry/reactorEquationBalance'
import { getReactorVisualTier } from '../src/chemistry/reactorVisualTier'
import { isCatalogRenderable } from '../src/lab/synthesisGuarantee'
import {
  generateFromLaboratoryRecipe,
  parseReactionLeftSide,
} from '../src/chemistry/reactionLeftSideParser'

type AuditStatus = 'ok' | 'no_recipe' | 'no_balance' | 'no_geometry' | 'parse_fail'

type AuditRow = {
  id: string
  formula: string
  status: AuditStatus
  visualTier?: string
  productCoeff?: number
  note?: string
}

let idSeq = 0
function newId() {
  idSeq += 1
  return `audit-${idSeq}`
}

const rows: AuditRow[] = []
const priorityIds = ['mgo', 'cao', 'co2', 'so2', 'fe2o3', 'salt_nh4_3_po4', 'h2o', 'h2', 'o2']

for (const compound of Object.values(compoundById)) {
  const row: AuditRow = { id: compound.id, formula: compound.formulaUnicode, status: 'ok' }

  if (!isCatalogRenderable(compound)) {
    row.status = 'no_geometry'
    rows.push(row)
    continue
  }

  const g = generateFromLaboratoryRecipe(compound)
  const trimmed = g.manualLeft.trim()
  if (!trimmed) {
    row.status = 'no_recipe'
    row.note = 'empty left from recipe'
    rows.push(row)
    continue
  }

  const parsed = parseReactionLeftSide(trimmed, newId)
  if (!parsed.ok) {
    row.status = 'parse_fail'
    row.note = parsed.code
    rows.push(row)
    continue
  }

  const validated = validateReactorEquation(parsed.terms, compound, g.productCoeff)
  if (!validated.ok) {
    row.status = 'no_balance'
    row.note = validated.code
    rows.push(row)
    continue
  }

  row.productCoeff = g.productCoeff
  row.visualTier = getReactorVisualTier(parsed.terms)
  rows.push(row)
}

const byStatus = (s: AuditStatus) => rows.filter((r) => r.status === s)
const ok = byStatus('ok')
const failed = rows.filter((r) => r.status !== 'ok')

console.log('[validate:lab] compounds:', rows.length)
console.log('[validate:lab] ok:', ok.length)
console.log('[validate:lab] failed:', failed.length)
for (const s of ['no_recipe', 'parse_fail', 'no_balance', 'no_geometry'] as AuditStatus[]) {
  const n = byStatus(s).length
  if (n > 0) console.log(`  - ${s}: ${n}`)
}

const priority = rows.filter((r) => priorityIds.includes(r.id))
console.log('[validate:lab] priority cases:')
for (const p of priority) {
  console.log(`  ${p.id} (${p.formula}): ${p.status}${p.visualTier ? ` tier=${p.visualTier}` : ''}${p.note ? ` — ${p.note}` : ''}`)
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../video')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const reportPath = path.join(outDir, 'lab-synthesis-audit.json')
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2))
console.log('[validate:lab] report:', reportPath)

if (failed.length > 0) {
  console.error('[validate:lab] FAILED — first issues:')
  failed.slice(0, 12).forEach((r) => console.error(` - ${r.id}: ${r.status} ${r.note ?? ''}`))
  process.exit(1)
}

console.log('[validate:lab] OK')
