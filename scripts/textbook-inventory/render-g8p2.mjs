/**
 * Render grade-8 textbook pages to PNG (visual check of formulas/arrows).
 * Usage: node scripts/textbook-inventory/render-g8p2.mjs <scale> <page> [page...]
 * Output: .smoke/textbook-inventory/g8p2-pages/p<NNN>.png
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const [scaleStr, ...pages] = process.argv.slice(2)
const outDir = path.join(root, '.smoke', 'textbook-inventory', 'g8p2-pages')
fs.mkdirSync(outDir, { recursive: true })
const data = new Uint8Array(fs.readFileSync(path.join(root, 'public', 'textbooks', 'kimyo-8-ru.pdf')))
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise
for (const p of pages) {
  const page = await doc.getPage(Number(p))
  const vp = page.getViewport({ scale: Number(scaleStr) })
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise
  const file = path.join(outDir, `p${String(p).padStart(3, '0')}.png`)
  fs.writeFileSync(file, await canvas.encode('png'))
  console.log(file)
}
