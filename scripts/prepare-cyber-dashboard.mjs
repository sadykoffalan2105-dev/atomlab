/**
 * Генерация webp/albedo для cyber-дашборда из source.png
 * Usage: node scripts/prepare-cyber-dashboard.mjs [sceneId]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sceneId = process.argv[2] ?? 'topic_g7_c1_s01'
const dir = path.join(root, 'public/learn/dashboard')
const source = path.join(dir, `${sceneId}_source.png`)

if (!fs.existsSync(source)) {
  console.error(`[prepare-cyber] missing ${source}`)
  process.exit(1)
}

const meta = await sharp(source).metadata()
console.log(`[prepare-cyber] source ${meta.width}×${meta.height}`)

await sharp(source)
  .resize(2048, null, { kernel: sharp.kernel.lanczos3 })
  .sharpen({ sigma: 0.7 })
  .webp({ quality: 92, effort: 6 })
  .toFile(path.join(dir, `${sceneId}@2x.webp`))

await sharp(source)
  .resize(1536, null, { kernel: sharp.kernel.lanczos3 })
  .sharpen({ sigma: 0.5 })
  .webp({ quality: 90, effort: 6 })
  .toFile(path.join(dir, `${sceneId}.webp`))

await sharp(source)
  .resize(2048, null, { kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 92 })
  .toFile(path.join(dir, `${sceneId}_albedo.webp`))

console.log(`[prepare-cyber] OK → ${sceneId}.webp, @2x, _albedo`)
