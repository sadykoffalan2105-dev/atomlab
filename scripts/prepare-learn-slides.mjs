/**
 * Готовит s02–s04: три разных кадра из постера (кроп + лёгкий тон), не три копии.
 * npm run learn:prepare-slides
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

const variants = [
  { name: 's02', extract: { left: 80, top: 60, width: 900, height: 506 } },
  { name: 's03', extract: { left: 420, top: 120, width: 900, height: 506 } },
  { name: 's04', extract: { left: 200, top: 280, width: 900, height: 506 } },
]

const posters = fs.readdirSync(postersDir).filter((f) => f.startsWith('topic_') && f.endsWith('.png'))
let ok = 0
for (const file of posters) {
  const topicId = file.replace(/\.png$/, '')
  const outDir = path.join(slidesRoot, topicId)
  fs.mkdirSync(outDir, { recursive: true })
  const src = path.join(postersDir, file)
  const meta = await sharp(src).metadata()
  const w = meta.width ?? 1200
  const h = meta.height ?? 675
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const ex = v.extract
    const left = Math.min(ex.left, Math.max(0, w - ex.width - 4))
    const top = Math.min(ex.top, Math.max(0, h - ex.height - 4))
    const tint = i === 0 ? 1.02 : i === 1 ? 0.96 : 1.08
    const out = path.join(outDir, `${v.name}.jpg`)
    let pipe = sharp(src).extract({ left, top, width: Math.min(ex.width, w - left), height: Math.min(ex.height, h - top) })
    pipe = pipe.resize(1920, 1080, { fit: 'cover' }).modulate({ brightness: tint, saturation: 1.05 })
    await pipe.jpeg({ quality: 84, mozjpeg: true }).toFile(out)
    ok++
  }
}
console.log(`Prepared ${ok} distinct slide JPEGs for ${posters.length} sections.`)
