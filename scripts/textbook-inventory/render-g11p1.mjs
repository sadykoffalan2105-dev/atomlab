/**
 * Render textbook PDF pages (or vertical slices) to PNG for visual checks of formulas (grade 11 part 1).
 * Usage: node scripts/textbook-inventory/render-g11p1.mjs <pdfName> <outDir> <scale> <spec...>
 *   spec = page | page:y0:y1  (y0/y1 are fractions of the page height)
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const [pdfName, outDir, scaleStr, ...specs] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(path.join(root, 'public', 'textbooks', pdfName)));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
fs.mkdirSync(outDir, { recursive: true });
for (const spec of specs) {
  const [pStr, y0s = '0', y1s = '1'] = spec.split(':');
  const n = Number(pStr);
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: Number(scaleStr) });
  const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport: vp }).promise;
  const y0 = Math.floor(canvas.height * Number(y0s));
  const y1 = Math.ceil(canvas.height * Number(y1s));
  let out = canvas;
  if (y0 > 0 || y1 < canvas.height) {
    const c2 = doc.canvasFactory.create(canvas.width, y1 - y0);
    c2.context.drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, canvas.width, y1 - y0);
    out = c2.canvas;
  }
  const file = path.join(outDir, `p${String(n).padStart(3, '0')}-${y0s}-${y1s}.png`);
  fs.writeFileSync(file, await out.encode('png'));
  page.cleanup();
  console.log(file);
}
