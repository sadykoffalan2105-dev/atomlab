// Print compact inventory listing of merged g11 sections + OCR text of their pages.
// Usage: node scripts/textbook-inventory/g11merge-show.mjs <sectionId> [--ocr]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const inv = JSON.parse(fs.readFileSync(path.join(root, 'src/data/textbook/inventory-g11.json'), 'utf8'))
const [id, flag] = process.argv.slice(2)
const s = inv.sections.find((x) => x.sectionId === id)
console.log(`## ${s.sectionId} kp${s.kp} ${s.title} p${s.pageStart}-${s.pageEnd}`)
console.log('SUBSTANCES:')
for (const x of s.substances) console.log(`  ${x.formula ?? '-'} | ${x.nameRu} | ${x.kind}/${x.role} | p${x.pages.join(',')}${x.formulaInBook === false ? ' | f:added' : ''}`)
console.log('REACTIONS:')
for (const r of s.reactions) console.log(`  p${r.pages.join(',')} ${r.equationAscii}${r.isGeneralScheme ? ' [scheme]' : ''}${r.isIonic ? ' [ionic]' : ''}${r.note ? ' // ' + r.note : ''}`)
if (s.labWorks.length) console.log('LABWORKS:', s.labWorks.map((l) => l.title).join(' || '))
if (s.elementsMentioned?.length) console.log('ELEMENTS:', s.elementsMentioned.join(' '))
if (flag === '--ocr') {
  for (let p = s.pageStart; p <= s.pageEnd; p++) {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'scripts/kb/.cache/g11', `p${String(p).padStart(3, '0')}.json`), 'utf8'))
    console.log(`\n===== PAGE ${p} =====\n${j.text}`)
  }
}
