// Builds src/data/textbook/inventory-g10-part2.json from the hand-extracted data files
// scripts/textbook-inventory/g10p2-data-*.mjs (+ balance check + catalog mapping).
// Run from repo root. Catalog snapshot first: npx tsx scripts/textbook-inventory/export-catalog-g10p2.mts
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const rd = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const secs = rd('src/data/kb/corpus/kb-sections.json').g10;
const chunks = rd('src/data/kb/corpus/kb-corpus-g10.json').chunks;
const cat = rd('.smoke/textbook-inventory/catalog-snapshot-g10p2.json');
const dataDir = path.join(root, 'scripts/textbook-inventory');
const data = {};
for (const f of fs.readdirSync(dataDir).filter((f) => /^g10p2-data-.*\.mjs$/.test(f)).sort()) {
  Object.assign(data, (await import(pathToFileURL(path.join(dataDir, f)).href)).default);
}

// ---------- formula parsing ----------
const SUBD = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' };
const deUni = (s) => s.replace(/[₀-₉ₙ]/g, (c) => SUBD[c]).replace(/⁺/g, '+').replace(/⁻/g, '-');
function parseFormula(f0, n = 2) {
  let f = deUni(f0).trim();
  let charge = 0;
  const cm = f.match(/\^(\d*)([+-])$/);
  if (cm) { charge = (cm[1] ? Number(cm[1]) : 1) * (cm[2] === '+' ? 1 : -1); f = f.slice(0, cm.index); }
  f = f.replace(/[-–—=≡:~]/g, '').replace(/\s+/g, '');
  const parts = f.split(/[·*]/);
  const total = {};
  for (let part of parts) {
    let mult = 1;
    const mm = part.match(/^(\d+)(?=[A-Z(\[])/);
    if (mm) { mult = Number(mm[1]); part = part.slice(mm[1].length); }
    const stack = [{}];
    let i = 0;
    const num = () => { const m = part.slice(i).match(/^(\d+|n)/); if (!m) return 1; i += m[1].length; return m[1] === 'n' ? n : Number(m[1]); };
    while (i < part.length) {
      const ch = part[i];
      if (ch === '(' || ch === '[') { stack.push({}); i++; }
      else if (ch === ')' || ch === ']') { i++; const k = num(); const top = stack.pop(); for (const [e, c] of Object.entries(top)) stack.at(-1)[e] = (stack.at(-1)[e] || 0) + c * k; }
      else { const m = part.slice(i).match(/^([A-Z][a-z]?)/); if (!m) throw new Error(`bad formula ${f0} at ${part.slice(i)}`); i += m[1].length; const k = num(); stack.at(-1)[m[1]] = (stack.at(-1)[m[1]] || 0) + k; }
    }
    if (stack.length !== 1) throw new Error('brackets ' + f0);
    for (const [e, c] of Object.entries(stack[0])) total[e] = (total[e] || 0) + c * mult;
  }
  return { comp: total, charge };
}
const hill = (comp) => {
  const ks = Object.keys(comp).filter((k) => comp[k]);
  const order = ks.includes('C') ? ['C', 'H', ...ks.filter((k) => k !== 'C' && k !== 'H').sort()] : ks.sort();
  return order.filter((k) => comp[k]).map((k) => k + (comp[k] === 1 ? '' : comp[k])).join('');
};
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toUni = (f) => f
  .replace(/\^(\d*)([+-])$/, (_, d, s) => (d ? d.split('').map((x) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[x]).join('') : '') + (s === '+' ? '⁺' : '⁻'))
  .replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + d.split('').map((x) => SUB[x]).join(''))
  .replace(/\)n\b/g, ')ₙ');

// ---------- equations ----------
function splitSide(side) {
  return side.split(/\s+\+\s+/).map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = t.match(/^(\(n-1\)|\(n\+1\)|\(2n\+1\)|\(3n\+1\)\/2|\d+n|n|\d+\/\d+|\d+)?\s*(.+)$/);
    const coeffRaw = m[1] || '1';
    const ev = (nn) => Function('n', 'return ' + coeffRaw.replace(/(\d)n/, '$1*n'))(nn);
    return { formula: m[2], coeffRaw, coeff: /n/.test(coeffRaw) ? coeffRaw : ev(1), ev };
  });
}
function parseEq(e) {
  const m = e.split(/\s*(?:→|⇌|->|<=>)\s*/);
  if (m.length !== 2) throw new Error('arrow count ' + e);
  return { left: splitSide(m[0]), right: splitSide(m[1]) };
}
function balanceCheck(e) {
  const { left, right } = parseEq(e);
  for (const nn of [2, 3]) {
    const tot = (side) => { const t = { q: 0 }; for (const s of side) { const { comp, charge } = parseFormula(s.formula, nn); const k = s.ev(nn); for (const [el, c] of Object.entries(comp)) t[el] = (t[el] || 0) + c * k; t.q += charge * k; } return t; };
    const L = tot(left), R = tot(right);
    const els = new Set([...Object.keys(L), ...Object.keys(R)]);
    const diff = [...els].filter((k) => Math.abs((L[k] || 0) - (R[k] || 0)) > 1e-9).map((k) => `${k}:${L[k] || 0}/${R[k] || 0}`);
    if (diff.length) return { ok: false, diff: diff.join(' ') };
  }
  return { ok: true };
}

// ---------- catalog mapping ----------
const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
const SYN = {
  'этиловый спирт': 'этанол', 'метиловый спирт': 'метанол', 'пропиловый спирт': 'пропанол', 'пропанол-1': 'пропанол', 'бутанол-1': 'бутанол', 'уксусный альдегид': 'ацетальдегид', 'этаналь': 'ацетальдегид',
  'муравьиный альдегид': 'формальдегид', 'метаналь': 'формальдегид', 'этановая кислота': 'уксусная кислота', 'метановая кислота': 'муравьиная кислота',
  'глицерол': 'глицерин', 'пропантриол-1,2,3': 'глицерин', 'этандиол-1,2': 'этиленгликоль', 'карболовая кислота': 'фенол', 'уксусноэтиловый эфир': 'этилацетат', 'этилэтаноат': 'этилацетат',
  'этен': 'этилен', 'этин': 'ацетилен', 'пропен': 'пропилен', 'метилбензол': 'толуол', 'хлористый метил': 'хлорметан', 'хлористый этил': 'хлорэтан', 'аминобензол': 'анилин', 'пропанон': 'ацетон', 'диметилкетон': 'ацетон',
  'виноградный сахар': 'глюкоза', 'фруктовый сахар': 'фруктоза', 'тростниковый сахар': 'сахароза', 'свекловичный сахар': 'сахароза', 'серный эфир': 'диэтиловый эфир',
  'оксид углерода (iv)': 'углекислый газ', 'диоксид углерода': 'углекислый газ', 'водяной пар': 'вода',
};
const orgByHill = {};
for (const o of cat.organic) { const h = hill(parseFormula(o.formula).comp); (orgByHill[h] ||= []).push(o); }
const cmpByHill = {};
for (const c of cat.compounds) { if (!c.composition) continue; const h = hill(c.composition); (cmpByHill[h] ||= []).push(c); }
Object.assign(SYN, {
  'пропанол-1': 'пропан-1-ол', 'пропиловый спирт': 'пропан-1-ол', 'бутанол-1': 'бутан-1-ол', 'бутиловый спирт': 'бутан-1-ол', 'гексан': 'н-гексан', 'бутан': 'н-бутан', 'пентан': 'н-пентан',
  'd-глюкоза': 'глюкоза', 'β-глюкоза': 'β-d-глюкопираноза', 'бутадиен': 'бутадиен-1,3', 'дивинил': 'бутадиен-1,3', 'гидроксибензол': 'фенол', 'пропилен': 'пропен', 'этилэтаноат': 'этилацетат',
  'метиловый эфир': 'диметиловый эфир', 'этиловый эфир': 'диэтиловый эфир', 'уксусноэтиловый эфир': 'этилацетат', 'этиловый эфир уксусной кислоты': 'этилацетат',
});
// name variants: full name, main part, and each parenthesised / comma-separated alias
const variants = (s) => {
  const n = norm(s);
  const out = new Set([n, n.replace(/\s*\(.*?\)\s*/g, ' ').trim()]);
  for (const m of n.matchAll(/\(([^)]*)\)/g)) for (const p of m[1].split(/[,;]/)) out.add(p.trim());
  return [...out].filter(Boolean).map((v) => SYN[v] || v);
};
const nameMatch = (a, b) => { const va = variants(a), vb = variants(b); return va.some((x) => vb.includes(x)); };
function mapSubstance(s) {
  const f = s.formula;
  if (!f) {
    const byName = [...cat.organic, ...cat.compounds].filter((c) => nameMatch(s.nameRu, c.nameRu));
    return byName.length === 1 ? { catalogId: byName[0].id, molecularFormula: null, mapNote: 'by name only (no formula in book)' } : { catalogId: null, molecularFormula: null };
  }
  let h; try { h = hill(parseFormula(f, 1).comp); } catch { return { catalogId: null, molecularFormula: null, mapNote: 'general/unparsed formula' }; }
  if (/n\)?$/.test(f) && /\)n$/.test(f)) return { catalogId: null, molecularFormula: null, mapNote: 'polymer' };
  if (/\^/.test(f)) return { catalogId: null, molecularFormula: h, mapNote: 'ion' };
  const org = orgByHill[h] || [], cmp = cmpByHill[h] || [];
  const all = [...org, ...cmp.filter((c) => !org.some((o) => o.id === c.id))];
  if (!all.length) return { catalogId: null, molecularFormula: h };
  const named = all.filter((c) => nameMatch(s.nameRu, c.nameRu));
  if (named.length === 1) return { catalogId: named[0].id, molecularFormula: h };
  const nameIsFormula = !/[а-яё]/i.test(s.nameRu);
  if (s.kind === 'organic') {
    // organic: isomers share formulas → accept a formula-only match only when the book names the substance by formula
    if (all.length === 1 && nameIsFormula && !s.isomerAmbiguous) return { catalogId: all[0].id, molecularFormula: h, mapNote: `formula match, name not given (catalog: ${all[0].nameRu})` };
    return { catalogId: null, molecularFormula: h, mapNote: `same molecular formula in catalog but different/unknown isomer: ${all.map((c) => c.id).join(',')}` };
  }
  if (all.length === 1) return { catalogId: all[0].id, molecularFormula: h };
  return { catalogId: named[0]?.id ?? all[0].id, molecularFormula: h, mapNote: `several catalog entries: ${all.map((c) => c.id).join(',')}` };
}
const sig = (side) => side.map((s) => { try { return hill(parseFormula(s.formula, 2).comp) + '*' + (typeof s.coeff === 'number' ? s.coeff : s.coeffRaw); } catch { return '?' + s.formula; } }).sort().join('+');
const bankSig = {};
for (const b of cat.bank) {
  try {
    const e = deUni(b.equationRu).replace(/\s*\([^)]*[а-яa-z°][^)]*\)\s*/g, ' ').replace(/[↑↓]/g, '').replace(/\s*=\s*/, ' → ');
    const p = parseEq(e.split(/[;]/)[0]);
    bankSig[sig(p.left) + '=>' + sig(p.right)] = b.id;
  } catch { /* skip */ }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    ['3C2H5OH + K2Cr2O7 + 4H2SO4 → 3CH3COOH + K2SO4 + Cr2(SO4)3 + 7H2O', false],
    ['3C2H5OH + 2K2Cr2O7 + 8H2SO4 → 3CH3COOH + 2K2SO4 + 2Cr2(SO4)3 + 11H2O', true],
    ['CH4 + H2O → CO + 2H2', false],
    ['(C6H10O5)n + nH2O → nC6H12O6', true],
    ['(C6H10O5)n + H2O → nC6H12O6', false],
    ['(C6H7O2(OH)3)n + 3nHNO3 → (C6H7O2(ONO2)3)n + 3nH2O', true],
    ['CH2OH(CHOH)4COH + 2[Ag(NH3)2]OH → CH2OH(CHOH)4COONH4 + 2Ag + 3NH3 + H2O', true],
    ['Cu^2+ + 2OH^- → Cu(OH)2', true],
    ['Cu^2+ + OH^- → Cu(OH)2', false],
  ];
  for (const [e, exp] of cases) { const r = balanceCheck(e); console.log(r.ok === exp ? 'PASS' : 'FAIL', e, r.diff || ''); }
  process.exit(0);
}

// ---------- build ----------
const N = secs.length, start = Math.ceil(N / 2);
const out = { grade: 10, part: 2, source: 'public/textbooks/kimyo-10-ru-2022.pdf', splitRule: `kb-sections.json g10: ${N} sections, part 2 = indices ${start}..${N - 1}`, generatedAt: new Date().toISOString(), sections: [] };
const problems = [];
for (let i = start; i < N; i++) {
  const s = secs[i]; const [chapterId, sid] = s.id.split('-');
  const ck = chunks.filter((x) => x.chapterId === chapterId && x.sectionId === sid);
  const d = data[s.id];
  if (!d) problems.push('NO DATA ' + s.id);
  const sec = { sectionId: s.id, chapterId, kp: s.kp, title: s.title, pageStart: Math.min(...ck.map((x) => x.pageStart)), pageEnd: Math.max(...ck.map((x) => x.pageEnd)), substances: [], reactions: [], labWorks: [], chains: [] };
  for (const t of d?.subs || []) {
    const [f0, nameRu, kind, role, page, quote, opt = {}] = t;
    const inBook = !(f0 && f0.startsWith('~'));
    const formula = f0 ? f0.replace(/^~/, '') : null;
    const sub = { formula, formulaUnicode: formula ? toUni(formula) : null, formulaInBook: formula ? inBook : false, nameRu, kind, role, page, quote };
    if (quote && quote.length > 160) problems.push(`quote>160 ${s.id} ${nameRu}`);
    if (formula) { try { parseFormula(formula); } catch (e) { problems.push(`${s.id} formula ${formula}: ${e.message}`); } }
    Object.assign(sub, mapSubstance({ ...sub, isomerAmbiguous: opt.iso }));
    if (opt.note) sub.note = opt.note;
    sec.substances.push(sub);
  }
  for (const r of d?.rx || []) {
    const rec = { equationAsInBook: r.b, equation: r.e, reactants: [], products: [], conditions: r.c || null, type: r.t, ...(r.st ? { subtype: r.st } : {}), isGeneralScheme: !!r.g, isIonic: !!r.i, page: r.p, quote: r.q || null };
    try {
      const p = parseEq(r.e);
      rec.reactants = p.left.map((x) => ({ formula: x.formula, coeff: x.coeff }));
      rec.products = p.right.map((x) => ({ formula: x.formula, coeff: x.coeff }));
      if (!r.g && !r.nb) {
        const bc = balanceCheck(r.e);
        rec.balanced = bc.ok;
        if (!bc.ok) problems.push(`UNBALANCED ${s.id} p${r.p}: ${r.e} [${bc.diff}]`);
      } else rec.balanced = null;
      rec.bankId = bankSig[sig(p.left) + '=>' + sig(p.right)] || null;
    } catch (e) { problems.push(`${s.id} eq parse: ${r.e} ${e.message}`); rec.bankId = null; }
    if (r.q && r.q.length > 160) problems.push(`rx quote>160 ${s.id} p${r.p}`);
    if (r.n) rec.note = r.n;
    sec.reactions.push(rec);
  }
  sec.labWorks = (d?.labs || []).map((l) => ({ title: l.title, page: l.p, substances: l.subs }));
  sec.chains = (d?.chains || []).map((c) => ({ textAsInBook: c.b, page: c.p, ...(c.n ? { note: c.n } : {}) }));
  if (d?.notes) sec.notes = d.notes;
  out.sections.push(sec);
}
fs.mkdirSync(path.join(root, 'src/data/textbook'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/textbook/inventory-g10-part2.json'), JSON.stringify(out, null, 1));
const all = out.sections.flatMap((x) => x.substances);
const rx = out.sections.flatMap((x) => x.reactions);
console.log(JSON.stringify({
  sections: out.sections.length, withData: out.sections.filter((x) => data[x.sectionId]).length, substances: all.length,
  uniqueFormulas: new Set(all.filter((x) => x.formula).map((x) => x.formula)).size,
  uniqueMolecular: new Set(all.filter((x) => x.molecularFormula).map((x) => x.molecularFormula)).size,
  uniqueNames: new Set(all.map((x) => norm(x.nameRu))).size,
  noFormula: all.filter((x) => !x.formula).length, mappedSubstances: all.filter((x) => x.catalogId).length,
  uniqueCatalogIds: new Set(all.filter((x) => x.catalogId).map((x) => x.catalogId)).size,
  reactions: rx.length, unbalancedAsBook: rx.filter((r) => r.balanced === false).length, generalSchemes: rx.filter((r) => r.isGeneralScheme).length, bankMapped: rx.filter((r) => r.bankId).length,
  labWorks: out.sections.reduce((a, x) => a + x.labWorks.length, 0), chains: out.sections.reduce((a, x) => a + x.chains.length, 0),
}, null, 1));
if (process.argv.includes('--map')) for (const x of all) console.log(`${x.formula}\t${x.nameRu}\t${x.catalogId}\t${x.mapNote || ''}`);
console.log(problems.join('\n'));
