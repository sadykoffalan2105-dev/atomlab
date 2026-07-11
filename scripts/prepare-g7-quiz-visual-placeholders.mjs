/**
 * Плейсхолдеры PNG для вопросов теста 7 класса (пока нет AI-фото).
 * npm run learn:quiz-visual-placeholders
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/quiz-visuals')

const CHAPTER_COLORS = {
  1: ['#1a2744', '#3d6ea8'],
  2: ['#2a1a44', '#6a3da8'],
  3: ['#1a3d32', '#3d8b6e'],
  4: ['#3d2a1a', '#8b6a2d'],
  5: ['#1a2a3d', '#4a7ab0'],
  6: ['#1a3d3d', '#2d8b8b'],
  7: ['#3d1a2a', '#a83d6a'],
  8: ['#2a2a1a', '#7a7a3d'],
}

function chapterOf(id) {
  const m = id.match(/^(?:g\d+-)?c(\d+)/i) || id.match(/^c(\d+)/i)
  return m ? Number(m[1]) : 1
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Install sharp: npm i -D sharp')
  process.exit(1)
}

// Import catalog via dynamic import of compiled data — read from TS export using tsx child
const { execSync } = await import('node:child_process')
const jsonPath = path.join(root, 'scripts/.g7-quiz-visual-catalog.json')
execSync(`npx tsx scripts/export-g7-quiz-visual-catalog.ts`, { cwd: root, stdio: 'inherit' })

const catalog = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

let created = 0
let skipped = 0

for (const [id, entry] of Object.entries(catalog)) {
  const out = path.join(outDir, `${id}.png`)
  if (fs.existsSync(out)) {
    skipped++
    continue
  }
  const ch = chapterOf(id)
  const [c0, c1] = CHAPTER_COLORS[ch] ?? CHAPTER_COLORS[1]
  const title = escapeXml(entry.caption.slice(0, 72))
  const svg = `<svg width="1792" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${c0}"/>
        <stop offset="100%" style="stop-color:${c1}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="896" y="480" font-family="Segoe UI, Arial, sans-serif" font-size="42" fill="#ffffffcc" text-anchor="middle">${title}</text>
    <text x="896" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#ffffff88" text-anchor="middle">Kimyo · 7 класс · ${id}</text>
  </svg>`
  await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toFile(out)
  created++
}

console.log(`Quiz placeholders: created ${created}, skipped ${skipped} (already exist), total ${Object.keys(catalog).length}`)
