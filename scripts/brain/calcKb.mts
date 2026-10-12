/**
 * Лёгкая база для проверок калькулятора: только qaBank (вещества, элементы, реакции) — без BM25-шардов (быстро).
 */
import fs from 'node:fs'
import path from 'node:path'
import { Knowledge, REPO_ROOT, type QaBank } from '../../brain/kb/shards.ts'

export function lightKnowledge(): Knowledge {
  const kb = new Knowledge()
  kb.qa = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src', 'data', 'teacher', 'qaBank.json'), 'utf8')) as QaBank
  for (const e of kb.qa.elements) {
    kb.elementBySymbol.set(e.s, e)
    kb.elementByZ.set(e.z, e)
  }
  for (const s of kb.qa.substances) if (!kb.substanceByFormula.has(s.fa)) kb.substanceByFormula.set(s.fa, s)
  return kb
}
