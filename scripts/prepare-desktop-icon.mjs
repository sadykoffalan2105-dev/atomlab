import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = path.join(root, 'public', 'favicon.svg')
const outDir = path.join(root, 'build')
const outPath = path.join(outDir, 'icon.png')

fs.mkdirSync(outDir, { recursive: true })

await sharp(svgPath)
  .resize(512, 512, {
    fit: 'contain',
    background: { r: 3, g: 4, b: 10, alpha: 1 },
  })
  .png()
  .toFile(outPath)

console.log(`Desktop icon: ${outPath}`)
