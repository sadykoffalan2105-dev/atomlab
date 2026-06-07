/**
 * Генерирует фото-карточки 118 элементов в public/learn/elements/
 * npm run learn:prepare-element-life
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/elements')
const profilesPath = path.join(root, 'src/data/elementRealLife/elementRealLifeProfiles.json')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Install sharp: npm i -D sharp')
  process.exit(1)
}

/** Wikimedia Commons — реальные фото образцов (стабильные URL) */
const WIKI = {
  H: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Hydrogen_discharge_tube.jpg',
  He: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Helium_discharge_tube.jpg',
  Li: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Lithium_paraffin.jpg',
  Be: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Beryllium_300_mg.jpg',
  B: 'https://upload.wikimedia.org/wikipedia/commons/1/19/Boron_R105.jpg',
  C: 'https://upload.wikimedia.org/wikipedia/commons/6/68/Graphite-233436.jpg',
  N: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Liquid_nitrogen.jpg',
  O: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Liquid_oxygen_in_a_beaker_4.jpg',
  F: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Fluorine_gas.jpg',
  Ne: 'https://upload.wikimedia.org/wikipedia/commons/9/94/Neon_discharge_tube.jpg',
  Na: 'https://upload.wikimedia.org/wikipedia/commons/2/27/Na_%28Sodium%29.jpg',
  Mg: 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Magnesium_ crystals.jpg',
  Al: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Aluminium.jpg',
  Si: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Silicon-Carbide-trigonal-scaled.jpg',
  P: 'https://upload.wikimedia.org/wikipedia/commons/5/57/White_phosphorus.jpg',
  S: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Sulfur-sample.jpg',
  Cl: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Fluorine%2Chydrogen_fluoride%2Chydrogen_chloride%2Chydrogen_bromide%2Chydrogen_iodide%2Cwater%2Cammonia%2Chydrogen_sulfide%2Chydrogen_selenide%2Chydrogen_telluride%2Chydrogen_polonide%2Cmethane%2Cethane%2Cpropane%2Cbutane%2Cpentane%2Chexane%2Cdimethyl_ether%2Cmethanol%2Cethanol%2Cpropanol%2Cbutanol%2Cpentanol%2Chexanol%2Cmethylamine%2Cethylamine%2Cpropylamine%2Cbutylamine%2Cpentylamine%2Chexylamine%2Cdimethyl_sulfide%2Cdiethyl_sulfide%2Cmethyl_ethyl_sulfide%2Cdimethyl_disulfide%2Cmethylamine%2Cethylamine%2Cpropylamine%2Cbutylamine%2Cpentylamine%2Chexylamine%2Cdimethyl_sulfide%2Cdiethyl_sulfide%2Cmethyl_ethyl_sulfide%2Cdimethyl_disulfide.jpg',
  Ar: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Argon_discharge_tube.jpg',
  K: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Potassium-2.jpg',
  Ca: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Calcium_unoxidized.jpg',
  Fe: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Iron_electrolytic_and_1cm3_cube.jpg',
  Cu: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/NatCopper.jpg',
  Zn: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Zinc_fragment_sublimed_and_1cm3_cube.jpg',
  Ag: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Silver_crystal.jpg',
  Au: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Gold-crystals.jpg',
  Pb: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/Lead_electrolytic_and_1cm3_cube.jpg',
  U: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Uranium_1.jpg',
  Hg: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Mercury_in_a_thermometer.jpg',
  I: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Iodine-sample.jpg',
  Br: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Bromine_vial_in_acrylic_cube.jpg',
  Sn: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Tin-2.jpg',
  Ni: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Nickel_electrolytic_and_1cm3_cube.jpg',
  Cr: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Chromium_crystal_bar_and_1cm3_cube.jpg',
  Ti: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Titanium_crystal_bar.jpg',
}

const CATEGORY_UNSPLASH = {
  gas: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&q=85',
  metal: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=85',
  solid: 'https://images.unsplash.com/photo-1606107557192-5867caff0028?auto=format&fit=crop&w=900&q=85',
  lab: 'https://images.unsplash.com/photo-1582719471137-c3967ffb1c42?auto=format&fit=crop&w=900&q=85',
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cardSvg({ z, symbol, caption, cpkHex }) {
  const color = cpkHex?.startsWith('#') ? cpkHex : `#${cpkHex || '8899aa'}`
  const title = `${z}. ${symbol}`
  const cap = caption.length > 72 ? caption.slice(0, 69) + '…' : caption
  return `<svg width="800" height="560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0f1a"/>
      <stop offset="55%" style="stop-color:${color}55"/>
      <stop offset="100%" style="stop-color:#1a1028"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.45"/>
      <stop offset="100%" style="stop-color:${color};stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="560" fill="url(#bg)"/>
  <ellipse cx="400" cy="260" rx="280" ry="200" fill="url(#glow)"/>
  <text x="400" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(symbol)}</text>
  <text x="400" y="248" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#ffffffaa" text-anchor="middle">${escapeXml(title)}</text>
  <text x="400" y="420" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#e8eef8" text-anchor="middle">${escapeXml(cap)}</text>
  <rect x="24" y="24" width="752" height="512" rx="20" fill="none" stroke="${color}" stroke-width="2" opacity="0.5"/>
</svg>`
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

const raw = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'))
const cpkByZ = new Map(raw.map((e) => [e.atomicNumber, e.cPKHexColor]))
const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'))

fs.mkdirSync(outDir, { recursive: true })

let ok = 0
let fallback = 0

for (const p of profiles) {
  const file = `${String(p.z).padStart(3, '0')}-${p.symbol}.webp`
  const out = path.join(outDir, file)
  if (fs.existsSync(out)) {
    ok++
    continue
  }

  const wiki = WIKI[p.symbol]
  const cpk = cpkByZ.get(p.z)

  try {
    let buf
    if (wiki) {
      buf = await fetchBuffer(wiki)
      await sharp(buf)
        .resize(800, 560, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toFile(out)
      ok++
      continue
    }
  } catch {
    /* try fallback */
  }

  try {
    const catUrl = p.z <= 10 ? CATEGORY_UNSPLASH.gas : p.z <= 86 ? CATEGORY_UNSPLASH.metal : CATEGORY_UNSPLASH.lab
    const photo = await fetchBuffer(catUrl)
    const overlay = Buffer.from(cardSvg({ z: p.z, symbol: p.symbol, caption: p.captionRu, cpkHex: cpk }))
    const overlayPng = await sharp(overlay).resize(800, 560).png().toBuffer()
    await sharp(photo)
      .resize(800, 560, { fit: 'cover' })
      .composite([{ input: overlayPng, blend: 'over', opacity: 0.72 }])
      .webp({ quality: 84 })
      .toFile(out)
    fallback++
  } catch {
    const svg = cardSvg({ z: p.z, symbol: p.symbol, caption: p.captionRu, cpkHex: cpk })
    await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(out)
    fallback++
  }
}

console.log(`Element cards: ${ok} ready, ${fallback} generated/fallback. Output: ${outDir}`)
