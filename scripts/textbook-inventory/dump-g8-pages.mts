/** Dump grade-8 page text (lines cache + grade-8 formula case repair) for manual inventory reading. */
import fs from 'node:fs'
import path from 'node:path'
import { addKnownFormulas, repairFormulas, repairLoneSymbols } from '../kb/lib/textRepair.mts'
import { appFormulas } from '../kb/lib/cards.mts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const [from, to, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]]
addKnownFormulas(await appFormulas())
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/kb/.cache/lines-g8.json'), 'utf8')) as { page: number; lines: { t: string }[] }[]
let s = ''
const json: Record<number, string> = {}
for (const p of pages) {
  if (p.page < from || p.page > to) continue
  const text = p.lines.map((l) => repairLoneSymbols(repairFormulas(l.t, 'case'))).join('\n')
  json[p.page] = text
  s += `\n===== PAGE ${p.page} =====\n` + text + '\n'
}
fs.writeFileSync(out, s)
fs.writeFileSync(out.replace(/\.txt$/, '.json'), JSON.stringify(json))
console.log('pages', Object.keys(json).length, 'chars', s.length)
