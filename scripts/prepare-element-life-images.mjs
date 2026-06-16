/**
 * Генерирует фото-карточки 118 элементов в public/learn/elements/
 * npm run learn:prepare-element-life
 * node scripts/prepare-element-life-images.mjs --force
 * node scripts/prepare-element-life-images.mjs --wiki  — попытка Wikimedia (медленно, с паузой)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_WIKI_PHOTOS } from './elementWikiPhotos.mjs'
import { renderElementSamplePhoto } from './elementPhotoRenderer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/elements')
const profilesPath = path.join(root, 'src/data/elementRealLife/elementRealLifeProfiles.json')
const force = process.argv.includes('--force')
const tryWiki = process.argv.includes('--wiki')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Install sharp: npm i -D sharp')
  process.exit(1)
}

async function fetchBuffer(url, attempt = 1) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'ATOMLAB/1.0 (education; element photos)' },
  })
  if (res.status === 429 && attempt < 6) {
    const wait = 4000 * attempt
    console.warn(`  rate limit, retry in ${wait / 1000}s…`)
    await sleep(wait)
    return fetchBuffer(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

function wikiMarkerPath(out) {
  return `${out}.wiki`
}

function hasWikiPhoto(out) {
  return fs.existsSync(wikiMarkerPath(out))
}

const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'))
const metaByZ = new Map(raw.map((e) => [e.atomicNumber, e]))
const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'))

fs.mkdirSync(outDir, { recursive: true })

let rendered = 0
let wikiOk = 0
let skipped = 0

for (const p of profiles) {
  const file = `${String(p.z).padStart(3, '0')}-${p.symbol}.webp`
  const out = path.join(outDir, file)
  const wikiUrl = ELEMENT_WIKI_PHOTOS[p.symbol]

  if (!force && fs.existsSync(out) && (!tryWiki || hasWikiPhoto(out) || !wikiUrl)) {
    skipped++
    continue
  }

  const meta = metaByZ.get(p.z)
  const cpk = meta?.cPKHexColor?.replace(/^#/, '') ?? '8899aa'

  if (tryWiki && wikiUrl) {
    try {
      await sleep(4000)
      const buf = await fetchBuffer(wikiUrl)
      await sharp(buf)
        .rotate()
        .resize(1200, 675, { fit: 'cover', position: 'attention' })
        .sharpen({ sigma: 0.6 })
        .webp({ quality: 88 })
        .toFile(out)
      fs.writeFileSync(wikiMarkerPath(out), wikiUrl, 'utf8')
      wikiOk++
      console.log(`✓ ${file} (wiki)`)
      continue
    } catch (err) {
      console.warn(`✗ ${file} wiki: ${err.message}`)
      if (hasWikiPhoto(out)) {
        console.log(`  kept previous wiki ${file}`)
        continue
      }
      continue
    }
  }

  await renderElementSamplePhoto({
    z: p.z,
    symbol: p.symbol,
    cpkHex: cpk,
    groupBlock: meta?.groupBlock ?? '',
    standardState: meta?.standardState ?? 'Solid',
    outPath: out,
  })
  rendered++
  console.log(`✓ ${file} (render)`)
}

console.log(`\nDone: ${rendered} rendered, ${wikiOk} wiki, ${skipped} skipped. → ${outDir}`)
