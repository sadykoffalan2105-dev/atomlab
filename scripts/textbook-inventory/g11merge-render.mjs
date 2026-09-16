/**
 * Render grade-11 textbook pages to PNG for visual verification of the merged inventory.
 * Usage: node scripts/textbook-inventory/g11merge-render.mjs <scale> <page> [page...]
 * Output: .smoke/textbook-inventory/g11merge-pages/p<NNN>.png (optionally cropped: page:top-bottom as fractions, e.g. 55:0-0.5)
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const [scaleStr, ...pages] = process.argv.slice(2)
const outDir = path.join(root, '.smoke', 'textbook-inventory', 'g11merge-pages')
fs.mkdirSync(outDir, { recursive: true })
const data = new Uint8Array(fs.readFileSync(path.join(root, 'public', 'textbooks', 'kimyo-11-ru.pdf')))
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise
for (const spec of pages) {
  const [p, crop] = spec.split(':')
  const page = await doc.getPage(Number(p))
  const vp = page.getViewport({ scale: Number(scaleStr) })
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise
  let outCanvas = canvas
  let suffix = ''
  if (crop) {
    const [a, b] = crop.split('-').map(Number)
    const y0 = Math.floor(canvas.height * a), y1 = Math.ceil(canvas.height * b)
    outCanvas = createCanvas(canvas.width, y1 - y0)
    outCanvas.getContext('2d').drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, canvas.width, y1 - y0)
    suffix = `-${a}-${b}`
  }
  const file = path.join(outDir, `p${String(p).padStart(3, '0')}${suffix}.png`)
  fs.writeFileSync(file, await outCanvas.encode('png'))
  console.log(file, outCanvas.width, outCanvas.height)
}
