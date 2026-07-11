/**
 * Уникальное фото к каждому вопросу 7 класса:
 * берём постер/слайд § как основу и делаем карточку 1792×1024 с подписью.
 * Уже готовые крупные PNG (эталон §1 / DALL·E) не перезаписываем.
 *
 * node scripts/render-g7-quiz-visuals-from-posters.mjs
 * node scripts/render-g7-quiz-visuals-from-posters.mjs --prefix=g7-c1-
 * node scripts/render-g7-quiz-visuals-from-posters.mjs --force
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/quiz-visuals')
const postersDir = path.join(root, 'public/learn/posters')
const slidesDir = path.join(root, 'public/learn/slides')
const catalogPath = path.join(root, 'scripts/.g7-quiz-visual-catalog.json')
const KEEP_MIN_BYTES = 250_000

const args = process.argv.slice(2)
const force = args.includes('--force')
const prefixArg = args.find((a) => a.startsWith('--prefix='))
const onlyPrefix = prefixArg ? prefixArg.split('=')[1] : null

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Install sharp: npm i -D sharp')
  process.exit(1)
}

execSync('npx tsx scripts/export-g7-quiz-visual-catalog.ts', { cwd: root, stdio: 'inherit' })
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function findBaseImage(id) {
  const m = id.match(/^g7-c(\d+)-s(\d+)/i)
  if (!m) return null
  const ch = m[1]
  const sec = m[2]
  const poster = path.join(postersDir, `topic_g7_c${ch}_s${sec}.png`)
  if (fs.existsSync(poster)) return poster
  const slideDir = path.join(slidesDir, `topic_g7_c${ch}_s${sec}`)
  if (fs.existsSync(slideDir)) {
    const jpgs = fs
      .readdirSync(slideDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
    if (jpgs[0]) return path.join(slideDir, jpgs[0])
  }
  return null
}

function wrapCaption(text, maxLen = 64) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen - 1).replace(/\s+\S*$/, '') + '…'
}

const CHAPTER_COLORS = {
  1: ['#0f172a', '#1d4ed8'],
  2: ['#1e1b4b', '#7c3aed'],
  3: ['#052e16', '#059669'],
  4: ['#1c1917', '#d97706'],
  5: ['#0c4a6e', '#0284c7'],
  6: ['#134e4a', '#0d9488'],
  7: ['#4a044e', '#c026d3'],
  8: ['#1c1917', '#a3a3a3'],
}

function chapterOf(id) {
  const m = id.match(/^(?:g\d+-)?c(\d+)/i)
  return m ? Number(m[1]) : 1
}

async function renderFallback(id, caption) {
  const ch = chapterOf(id)
  const [c0, c1] = CHAPTER_COLORS[ch] ?? CHAPTER_COLORS[1]
  const title = escapeXml(wrapCaption(caption, 70))
  const svg = `<svg width="1792" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${c0}"/>
        <stop offset="100%" style="stop-color:${c1}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="240" cy="220" r="120" fill="#ffffff18"/>
    <circle cx="1520" cy="780" r="180" fill="#ffffff12"/>
    <text x="896" y="470" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="#f8fafc" text-anchor="middle">${title}</text>
    <text x="896" y="545" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#cbd5e1" text-anchor="middle">Kimyo · 7 класс · ${escapeXml(id)}</text>
  </svg>`
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer()
}

async function renderFromPhoto(basePath, id, caption) {
  const W = 1792
  const H = 1024
  const barH = 168
  const label = wrapCaption(caption, 78)
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00000000"/>
        <stop offset="55%" stop-color="#00000055"/>
        <stop offset="100%" stop-color="#000000cc"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <rect x="0" y="${H - barH}" width="${W}" height="${barH}" fill="#020617e6"/>
    <text x="64" y="${H - 88}" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#f8fafc">${escapeXml(label)}</text>
    <text x="64" y="${H - 42}" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#94a3b8">ATOMLAB · Kimyo 7 · ${escapeXml(id)}</text>
  </svg>`)

  const base = await sharp(basePath)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.92, saturation: 1.05 })
    .toBuffer()

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 8 })
    .toBuffer()
}

let done = 0
let skipped = 0
let failed = 0

const entries = Object.entries(catalog).filter(([id]) => id.startsWith('g7-c'))
  .filter(([id]) => !onlyPrefix || id.startsWith(onlyPrefix))

for (const [id, entry] of entries) {
  const out = path.join(outDir, `${id}.png`)
  if (fs.existsSync(out) && !force) {
    const size = fs.statSync(out).size
    // keep real DALL·E / hand assets
    if (size >= KEEP_MIN_BYTES) {
      skipped++
      continue
    }
  }

  try {
    const base = findBaseImage(id)
    const buf = base
      ? await renderFromPhoto(base, id, entry.caption || id)
      : await renderFallback(id, entry.caption || id)
    fs.writeFileSync(out, buf)
    done++
    if (done % 25 === 0) console.log(`… ${done} rendered`)
  } catch (err) {
    failed++
    console.error(`FAIL ${id}:`, err.message)
  }
}

console.log(`Quiz photo cards: rendered ${done}, kept ${skipped}, failed ${failed}, total ${entries.length}`)
