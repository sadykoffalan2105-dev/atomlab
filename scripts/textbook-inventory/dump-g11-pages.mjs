// Dump OCR page cache text for grade 11 pages [from..to] into one text file with page markers.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const [from, to, out] = process.argv.slice(2);
let s = '';
for (let p = Number(from); p <= Number(to); p++) {
  const f = path.join(root, 'scripts', 'kb', '.cache', 'g11', `p${String(p).padStart(3, '0')}.json`);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  s += `\n===== PAGE ${p} (conf ${j.conf}) =====\n${j.text}\n`;
}
fs.writeFileSync(out, s);
console.log(out, s.length);
