/** Render textbook PDF pages to PNG. Usage: node g7p2-render.mjs <grade> <outDir> <scale> <page...> */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const files = { 7: 'kimyo-7-ru-2022.pdf', 8: 'kimyo-8-ru.pdf', 9: 'kimyo-9-ru.pdf', 10: 'kimyo-10-ru-2022.pdf', 11: 'kimyo-11-ru.pdf' };
const [grade, outDir, scaleS, ...pages] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(root, 'public', 'textbooks', files[grade]))), verbosity: 0 }).promise;
for (const p of pages.map(Number)) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: Number(scaleS) });
  const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport: vp }).promise;
  const file = path.join(outDir, `g${grade}-p${String(p).padStart(3, '0')}.png`);
  fs.writeFileSync(file, await canvas.encode('png'));
  console.log(file);
}
