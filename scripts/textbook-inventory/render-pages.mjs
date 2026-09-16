/** Render textbook PDF pages to PNG (for visually checking formulas). Usage: node render-pages.mjs <pdf> <outDir> <scale> <page> [page...] */
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const [pdfPath, outDir, scaleArg, ...pages] = process.argv.slice(2);
const scale = Number(scaleArg);
fs.mkdirSync(outDir, { recursive: true });
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), verbosity: 0 }).promise;
for (const p of pages.map(Number)) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale });
  const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport: vp }).promise;
  fs.writeFileSync(path.join(outDir, `p${String(p).padStart(3, '0')}.png`), await canvas.encode('png'));
  page.cleanup();
}
console.log('rendered', pages.join(','));
