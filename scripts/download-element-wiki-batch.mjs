/**
 * Download wiki photos for specific elements only.
 * node scripts/download-element-wiki-batch.mjs Tc Pm Bk
 * node scripts/download-element-wiki-batch.mjs --missing-wiki
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_WIKI_PHOTOS } from './elementWikiPhotos.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/elements')
const profiles = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/elementRealLife/elementRealLifeProfiles.json'), 'utf8'),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sharp = (await import('sharp')).default

async function fetchBuffer(url, attempt = 1) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ATOMLAB/1.0 (education; element photos)' },
  })
  if (res.status === 429 && attempt < 8) {
    const wait = 8000 * attempt
    console.warn(`  rate limit, retry in ${wait / 1000}s…`)
    await sleep(wait)
    return fetchBuffer(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

const args = process.argv.slice(2)
const missingWiki = args.includes('--missing-wiki')
const symbols = missingWiki
  ? profiles
      .filter((p) => ELEMENT_WIKI_PHOTOS[p.symbol] && !fs.existsSync(path.join(outDir, `${String(p.z).padStart(3, '0')}-${p.symbol}.webp.wiki`)))
      .map((p) => p.symbol)
  : args.filter((a) => !a.startsWith('--'))

if (symbols.length === 0) {
  console.error('Usage: node scripts/download-element-wiki-batch.mjs Tc Pm ... | --missing-wiki')
  process.exit(1)
}

console.log(`Downloading ${symbols.length} elements…`)

let ok = 0
let fail = 0
for (const sym of symbols) {
  const p = profiles.find((x) => x.symbol === sym)
  const url = ELEMENT_WIKI_PHOTOS[sym]
  if (!p || !url) {
    console.warn(`skip ${sym}: no profile or wiki URL`)
    continue
  }
  const file = `${String(p.z).padStart(3, '0')}-${sym}.webp`
  const out = path.join(outDir, file)
  try {
    await sleep(7000)
    const buf = await fetchBuffer(url)
    await sharp(buf)
      .rotate()
      .resize(1200, 675, { fit: 'cover', position: 'attention' })
      .sharpen({ sigma: 0.6 })
      .webp({ quality: 88 })
      .toFile(out)
    fs.writeFileSync(`${out}.wiki`, url, 'utf8')
    ok++
    console.log(`✓ ${file}`)
  } catch (err) {
    fail++
    console.warn(`✗ ${file}: ${err.message}`)
  }
}

console.log(`Done: ${ok} ok, ${fail} failed`)
