// Debug helper: dump pdfjs text items of one page (node scripts/kb/explore-page.mjs <grade> <page> [maxItems])
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const FILES = { 7: 'kimyo-7-ru-2022.pdf', 8: 'kimyo-8-ru.pdf', 9: 'kimyo-9-ru.pdf', 10: 'kimyo-10-ru-2022.pdf', 11: 'kimyo-11-ru.pdf' };
const [g, p, max = '80'] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(path.resolve('public/textbooks', FILES[g])));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
const page = await doc.getPage(Number(p));
const tc = await page.getTextContent({ includeMarkedContent: false });
await page.getOperatorList();
const fonts = {};
for (const it of tc.items) {
  if (!fonts[it.fontName]) {
    try { const f = page.commonObjs.get(it.fontName); fonts[it.fontName] = f?.name + (f?.bold ? ' [bold]' : ''); } catch { fonts[it.fontName] = '?'; }
  }
}
console.log('view', page.view, fonts);
for (const it of tc.items.slice(0, Number(max))) {
  const [, , c, d, e, f] = it.transform;
  console.log(JSON.stringify(it.str), 'x', e.toFixed(1), 'y', f.toFixed(1), 'h', Math.hypot(c, d).toFixed(1), 'w', it.width.toFixed(1), fonts[it.fontName], it.hasEOL ? 'EOL' : '');
}
