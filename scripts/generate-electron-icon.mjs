/**
 * Генерирует PNG + ICO для electron-builder / NSIS из build/icon.svg.
 */
import { readFile, copyFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'build', 'icon.svg')
const png512 = join(root, 'build', 'icon.png')
const png256 = join(root, 'build', 'icon-256.png')
const png128 = join(root, 'build', 'icon-128.png')
const png64 = join(root, 'build', 'icon-64.png')
const png48 = join(root, 'build', 'icon-48.png')
const png32 = join(root, 'build', 'icon-32.png')
const png16 = join(root, 'build', 'icon-16.png')
const icoPath = join(root, 'build', 'icon.ico')
const favicon = join(root, 'public', 'favicon.svg')

const svg = await readFile(svgPath)

const sizes = [
  [512, png512],
  [256, png256],
  [128, png128],
  [64, png64],
  [48, png48],
  [32, png32],
  [16, png16],
]

for (const [size, out] of sizes) {
  await sharp(svg).resize(size, size).png().toFile(out)
}

const ico = await pngToIco([png16, png32, png48, png64, png128, png256])
await writeFile(icoPath, ico)
await copyFile(svgPath, favicon)

console.log('[electron-icon] build/icon.png, build/icon.ico, public/favicon.svg ready')
