// Dumps raw page text for grade-10 part-2 sections (by kb-sections order) for manual inventory.
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const rd = (p) => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const c = rd('src/data/kb/corpus/kb-corpus-g10.json').chunks;
const secs = rd('src/data/kb/corpus/kb-sections.json').g10;
const raw = fs.readFileSync(new URL('scripts/kb/.cache/raw/g10-raw.txt', root), 'utf8').split('\f');
const outDir = new URL('.smoke/textbook-inventory/g10p2-pages/', root);
const N = secs.length, start = Math.ceil(N / 2);
const out = [];
for (let i = start; i < N; i++) {
  const s = secs[i]; const [ch, sid] = s.id.split('-');
  const ck = c.filter((x) => x.chapterId === ch && x.sectionId === sid);
  const ps = Math.min(...ck.map((x) => x.pageStart)), pe = Math.max(...ck.map((x) => x.pageEnd));
  const next = secs[i + 1]; const pEnd = next ? next.page - 1 : raw.length - 1;
  out.push({ i, id: s.id, kp: s.kp, page: s.page, ps, pe, pEnd });
  let txt = `#### ${s.id} ${s.kp} ${s.title} (sec.page ${s.page}, chunks ${ps}-${pe})\n`;
  for (let p = s.page; p <= Math.max(pEnd, pe); p++) txt += `\n===== PAGE ${p} =====\n` + raw[p - 1];
  fs.writeFileSync(new URL(`sec-${String(i).padStart(2, '0')}-${s.id}.txt`, outDir), txt);
}
fs.writeFileSync(new URL('sections.json', outDir), JSON.stringify(out, null, 1));
console.table(out);
