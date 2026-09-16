// Verification helper (grade 7 merge): prints raw page text of a section + compact inventory of both parts.
// Usage: node scripts/textbook-inventory/g7merge-show.mjs <sectionId> [text|inv|both]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const merged = path.join(root, 'src/data/textbook/inventory-g7.json');
const secs = fs.existsSync(merged) && process.env.USE_PARTS !== '1'
  ? read('src/data/textbook/inventory-g7.json').sections
  : [...read('src/data/textbook/inventory-g7-part1.json').sections, ...read('src/data/textbook/inventory-g7-part2.json').sections];
const raw = fs.readFileSync(path.join(root, 'scripts/kb/.cache/raw/g7-raw.txt'), 'utf8').split('\f');
const [id, mode = 'both'] = process.argv.slice(2);
const s = secs.find((x) => x.sectionId === id);
if (!s) { console.log('no section', id); process.exit(1); }
if (mode !== 'inv') {
  for (let p = s.pageStart; p <= s.pageEnd; p += 1) {
    console.log(`\n===== PAGE ${p} =====`);
    console.log(raw[p - 1].replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n'));
  }
}
if (mode !== 'text') {
  console.log(`\n##### INVENTORY ${s.sectionId} ${s.kp} ${s.title} pp.${s.pageStart}-${s.pageEnd}`);
  console.log('SUBSTANCES:');
  console.log(s.substances.map((x) => `${x.formula ?? '-'}${x.formulaInferred ? `(inf ${x.formulaInferred})` : ''}${x.formulaInBook === false ? '(notInBook)' : ''} ${x.nameRu ?? ''} [${x.kind}/${x.role} p${x.page}${x.fromExercise ? ' ex' : ''}] ${x.catalogId ?? ''}`).join('\n'));
  console.log('REACTIONS:');
  for (const r of s.reactions) console.log(`  p${r.page} ${r.equation}  | book: ${r.equationAsInBook ?? '-'} | ${r.type} bal=${r.balanced} bank=${r.bankId}${r.fromExercise ? ' EX' : ''}${r.inferred || r.printedInBook === false ? ' INF' : ''}${r.note ? ' // ' + r.note : ''}`);
  if (s.labWorks.length) console.log('LABS:', s.labWorks.map((l) => `p${l.page} ${l.title}`).join(' | '));
  if (s.elementsMentioned) console.log('ELEMENTS:', s.elementsMentioned.join(' '));
  if (s.notes) console.log('NOTES:', JSON.stringify(s.notes));
}
