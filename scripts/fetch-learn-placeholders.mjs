/**
 * Генерирует нейтральные плейсхолдеры s02–s04 (градиент + тема), если JPEG нет.
 * npm run learn:fetch-placeholders
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const postersDir = path.join(root, 'public/learn/posters')
const slidesRoot = path.join(root, 'public/learn/slides')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Install sharp: npm i -D sharp')
  process.exit(1)
}

const themes = [
  { name: 's02', colors: ['#1a2744', '#2d5a87'], label: 'Fact' },
  { name: 's03', colors: ['#1e3d32', '#3d8b6e'], label: 'Lab' },
  { name: 's04', colors: ['#3d2a1a', '#8b5a2d'], label: 'Summary' },
]

const posters = fs.existsSync(postersDir)
  ? fs.readdirSync(postersDir).filter((f) => f.startsWith('topic_') && f.endsWith('.png'))
  : []

let created = 0
for (const file of posters) {
  const topicId = file.replace(/\.png$/, '')
  const outDir = path.join(slidesRoot, topicId)
  fs.mkdirSync(outDir, { recursive: true })
  for (const theme of themes) {
    const out = path.join(outDir, `${theme.name}.jpg`)
    if (fs.existsSync(out)) continue
    const svg = `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${theme.colors[0]}"/>
          <stop offset="100%" style="stop-color:${theme.colors[1]}"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="960" y="540" font-family="Segoe UI, sans-serif" font-size="48" fill="#ffffff99" text-anchor="middle">${theme.label}</text>
    </svg>`
    await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(out)
    created++
  }
}
console.log(`Created ${created} placeholder slide JPEGs for ${posters.length} topics.`)
