/**
 * Verifies the embedded Russian Snowball stemmer against the reference `snowball-stemmers`
 * package over the vocabulary of the textbook JSON files.
 * Usage: npx tsx scripts/kb/test-stemmer.mts <path to node_modules containing snowball-stemmers>
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { stemRussian } from '../../src/learn/kb/stemRu.ts'

const refDir = process.argv[2]
if (!refDir) {
  console.error('usage: test-stemmer.mts <dir with node_modules/snowball-stemmers>')
  process.exit(2)
}
const require = createRequire(path.join(path.resolve(refDir), 'index.js'))
const snowball = require('snowball-stemmers')
const ref = snowball.newStemmer('russian')

const words = new Set<string>()
for (const g of [7, 8, 9]) {
  const raw = fs.readFileSync(`src/data/g${g}TextbookKnowledge.json`, 'utf8').toLowerCase()
  for (const m of raw.matchAll(/[а-яё]+/g)) words.add(m[0])
}
let bad = 0
const examples: string[] = []
for (const w of words) {
  const a = stemRussian(w)
  const b = ref.stem(w.replace(/ё/g, 'е'))
  if (a !== b) {
    bad += 1
    if (examples.length < 30) examples.push(`${w}: ours=${a} ref=${b}`)
  }
}
console.log(`words=${words.size} mismatches=${bad}`)
for (const e of examples) console.log('  ' + e)
process.exit(bad ? 1 : 0)
