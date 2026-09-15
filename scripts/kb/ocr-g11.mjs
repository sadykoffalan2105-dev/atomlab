/**
 * Grade 11 textbook OCR (the PDF has no text layer: glyphs are vector outlines).
 *
 * Renders each page with pdfjs-dist + @napi-rs/canvas and recognises it with
 * tesseract.js (rus+eng). Results are cached per page in scripts/kb/.cache/g11/,
 * so re-runs only process missing pages.
 *
 * Usage: node scripts/kb/ocr-g11.mjs [--from N] [--to N] [--workers N] [--scale S] [--dir g11] [--force]
 * (--dir: cache sub-folder of scripts/kb/.cache, e.g. to compare render scales)
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker } from 'tesseract.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const tessCache = path.join(here, '.cache', 'tessdata');
const pdfPath = path.join(root, 'public', 'textbooks', 'kimyo-11-ru.pdf');

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const force = args.includes('--force');
const cacheDir = path.join(here, '.cache', arg('dir', 'g11'));
const scale = Number(arg('scale', '3.2'));
const workersN = Math.max(1, Number(arg('workers', String(Math.min(6, Math.max(2, os.cpus().length - 4))))));

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(tessCache, { recursive: true });

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
const from = Number(arg('from', '1'));
const to = Math.min(doc.numPages, Number(arg('to', String(doc.numPages))));

const cacheFile = (n) => path.join(cacheDir, `p${String(n).padStart(3, '0')}.json`);
const todo = [];
for (let n = from; n <= to; n += 1) {
  if (force || !fs.existsSync(cacheFile(n))) todo.push(n);
}
console.log(`[ocr-g11] pages ${from}-${to}: ${todo.length} to OCR, workers=${workersN}, scale=${scale}`);
if (!todo.length) process.exit(0);

async function renderPage(n) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale });
  const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, canvas, viewport: vp }).promise;
  const png = await canvas.encode('png');
  page.cleanup();
  return { png, width: canvas.width, height: canvas.height };
}

function compactResult(n, res, dims) {
  const blocks = res.data.blocks || [];
  const paragraphs = [];
  for (const b of blocks) {
    for (const p of b.paragraphs || []) {
      const lines = (p.lines || []).map((l) => ({
        t: l.text.replace(/\n$/, ''),
        b: [l.bbox.x0, l.bbox.y0, l.bbox.x1, l.bbox.y1],
        c: Math.round(l.confidence),
        h: l.rowAttributes ? Math.round(l.rowAttributes.row_height) : undefined,
      }));
      if (lines.length) paragraphs.push({ b: [p.bbox.x0, p.bbox.y0, p.bbox.x1, p.bbox.y1], lines });
    }
  }
  return {
    page: n,
    width: dims.width,
    height: dims.height,
    scale,
    conf: Math.round(res.data.confidence),
    text: res.data.text,
    paragraphs,
  };
}

const queue = [...todo];
let done = 0;
const t0 = Date.now();

async function runWorker(id) {
  const worker = await createWorker(['rus', 'eng'], 1, {
    cachePath: tessCache,
    logger: () => {},
  });
  await worker.setParameters({ preserve_interword_spaces: '0' });
  while (queue.length) {
    const n = queue.shift();
    try {
      const img = await renderPage(n);
      const res = await worker.recognize(img.png, {}, { text: true, blocks: true });
      fs.writeFileSync(cacheFile(n), JSON.stringify(compactResult(n, res, img)));
      done += 1;
      const el = (Date.now() - t0) / 1000;
      console.log(`[ocr-g11] w${id} p${n} conf=${Math.round(res.data.confidence)} (${done}/${todo.length}, ${el.toFixed(0)}s, ~${((el / done) * (todo.length - done)).toFixed(0)}s left)`);
    } catch (err) {
      console.error(`[ocr-g11] p${n} failed:`, err?.message || err);
    }
  }
  await worker.terminate();
}

await Promise.all(Array.from({ length: workersN }, (_, i) => runWorker(i + 1)));
console.log(`[ocr-g11] finished in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
