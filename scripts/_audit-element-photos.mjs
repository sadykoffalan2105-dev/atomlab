import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_WIKI_PHOTOS } from './elementWikiPhotos.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'))
const profiles = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/elementRealLife/elementRealLifeProfiles.json'), 'utf8'),
)
const dir = path.join(root, 'public/learn/elements')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webp'))

const pz = new Set(profiles.map((p) => p.z))
const wikiSyms = new Set(Object.keys(ELEMENT_WIKI_PHOTOS))

const missingWebp = []
const missingWiki = []
const missingProfile = []
const renderedOnly = []
const wikiMarked = []

for (const e of raw) {
  const fn = `${String(e.atomicNumber).padStart(3, '0')}-${e.symbol}.webp`
  if (!files.includes(fn)) missingWebp.push(fn)
  if (!wikiSyms.has(e.symbol)) missingWiki.push(`${e.atomicNumber}-${e.symbol}`)
  if (!pz.has(e.atomicNumber)) missingProfile.push(`${e.atomicNumber}-${e.symbol}`)
  const full = path.join(dir, fn)
  if (fs.existsSync(`${full}.wiki`)) wikiMarked.push(fn)
  else if (fs.existsSync(full)) renderedOnly.push(fn)
}

console.log('elements', raw.length)
console.log('webp files', files.length, 'missing', missingWebp.length, missingWebp.join(', '))
console.log('profiles missing', missingProfile.length, missingProfile.join(', '))
console.log('wiki URLs missing', missingWiki.length, missingWiki.join(', '))
console.log('wiki-sourced photos', wikiMarked.length)
console.log('rendered-only photos', renderedOnly.length)
