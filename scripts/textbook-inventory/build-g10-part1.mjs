// Builds src/data/textbook/inventory-g10-part1.json from hand-extracted data files
// scripts/textbook-inventory/g10-part1-data*.mjs (+ atom balance check + catalog mapping).
// Run from repo root: node scripts/textbook-inventory/build-g10-part1.mjs
// Catalog snapshot (read-only reuse): .smoke/textbook-inventory/catalog-snapshot-g10p2.json
//   (produced by scripts/textbook-inventory/export-catalog-g10p2.mts from compounds.ts / organicMoleculeRegistry.ts / schoolReactionBank)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const rd = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const secList = rd('src/data/kb/corpus/kb-sections.json').g10;
const cat = rd('.smoke/textbook-inventory/catalog-snapshot-g10p2.json');
const dir = path.join(root, 'scripts/textbook-inventory');
const mod = await import(pathToFileURL(path.join(dir, 'g10-part1-data.mjs')).href);
for (const f of ['g10-part1-data-b.mjs', 'g10-part1-data-c.mjs', 'g10-part1-data-d.mjs']) await import(pathToFileURL(path.join(dir, f)).href);
const data = mod.sections;

const warnings = [];
const warn = (m) => warnings.push(m);

// ---------- formulas ----------
const SUBD = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n' };
const deUni = (s) => s.replace(/[₀-₉ₙ]/g, (c) => SUBD[c]).replace(/⁺/g, '+').replace(/⁻/g, '-');
function parseFormula(f0) {
  let f = deUni(f0).trim().replace(/[↑↓]/g, '');
  f = f.replace(/\d*[+-]$/, (m) => (/^[A-Z][a-z]?\d*[+-]$/.test(f) ? '' : m)); // ion charge like Hg2+
  f = f.replace(/\*/g, '');
  f = f.replace(/[-–—=≡]/g, '').replace(/\s+/g, '');
  const parts = f.split(/[·]/);
  const total = {};
  for (let part of parts) {
    let mult = 1;
    const mm = part.match(/^(\d+)(?=[A-Z(])/);
    if (mm) { mult = Number(mm[1]); part = part.slice(mm[1].length); }
    const stack = [{}];
    let i = 0;
    const num = () => { const m = part.slice(i).match(/^(\d+|n)/); if (!m) return 1; i += m[1].length; return m[1] === 'n' ? 1 : Number(m[1]); };
    while (i < part.length) {
      const ch = part[i];
      if (ch === '(' || ch === '[') { stack.push({}); i++; }
      else if (ch === ')' || ch === ']') { i++; const k = num(); const top = stack.pop(); for (const [e, c] of Object.entries(top)) stack.at(-1)[e] = (stack.at(-1)[e] || 0) + c * k; }
      else { const m = part.slice(i).match(/^([A-Z][a-z]?)/); if (!m) throw new Error(`bad formula ${f0} at "${part.slice(i)}"`); i += m[1].length; const k = num(); stack.at(-1)[m[1]] = (stack.at(-1)[m[1]] || 0) + k; }
    }
    if (stack.length !== 1) throw new Error('brackets ' + f0);
    for (const [e, c] of Object.entries(stack[0])) total[e] = (total[e] || 0) + c * mult;
  }
  return total;
}
const hill = (comp) => {
  const ks = Object.keys(comp).filter((k) => comp[k]);
  const order = ks.includes('C') ? ['C', ...(ks.includes('H') ? ['H'] : []), ...ks.filter((k) => k !== 'C' && k !== 'H').sort()] : ks.sort();
  return order.map((k) => k + (comp[k] === 1 ? '' : comp[k])).join('');
};
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const toUni = (f) => f
  .replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + d.split('').map((x) => SUB[x]).join(''))
  .replace(/\)n(?![a-z])/g, ')ₙ')
  .replace(/-/g, '–')
  .replace(/Hg₂\+$/, 'Hg²⁺');
const isGeneralFormula = (f) => /R|CnH|\bA\b|\bB\b|\bC\b(?=\s*$)|^[ABC]+$/.test(f) || /^(A|B|C|AB|AC)$/.test(f);

// ---------- equations ----------
function parseTerm(t0) {
  let t = t0.trim().replace(/[↑↓]/g, '').trim();
  let coeff = 1;
  const m = t.match(/^(\d+n|\d+|n)(?=[A-Z(\[]|HC|CH)/);
  if (m) { coeff = m[1] === 'n' ? 1 : m[1].endsWith('n') ? Number(m[1].slice(0, -1)) : Number(m[1]); t = t.slice(m[1].length); }
  return { formula: t, coeff, coeffRaw: m ? m[1] : '1' };
}
function parseEquation(eq) {
  const arrow = eq.includes('⇌') ? '⇌' : '→';
  const [l, r] = eq.split(arrow);
  if (r === undefined) throw new Error('no arrow: ' + eq);
  const side = (s) => s.split(/\s\+\s/).map(parseTerm);
  return { reactants: side(l), products: side(r) };
}
const WORDISH = /[а-яё]|\[O\]|\[H\]/i;
function balanceOf(parsed) {
  const sum = (arr) => {
    const t = {};
    for (const x of arr) { const c = parseFormula(x.formula); for (const [e, k] of Object.entries(c)) t[e] = (t[e] || 0) + k * x.coeff; }
    return t;
  };
  const L = sum(parsed.reactants), R = sum(parsed.products);
  const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
  const diff = [...keys].filter((k) => (L[k] || 0) !== (R[k] || 0)).map((k) => `${k}:${L[k] || 0}/${R[k] || 0}`);
  return { ok: diff.length === 0, diff };
}

// ---------- catalog maps ----------
const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
const nameVariants = (name) => {
  const out = new Set();
  const n = norm(name);
  out.add(n);
  out.add(n.replace(/\s*\(.*?\)\s*/g, ' ').trim());
  for (const m of n.matchAll(/\(([^)]*)\)/g)) m[1].split(/[,;]/).forEach((x) => out.add(x.trim()));
  n.split(/\s*\/\s*/).forEach((x) => out.add(x.trim()));
  for (const v of [...out]) { out.add(v.replace(/^н-/, '')); out.add(v.replace(/^n-/, '')); }
  return [...out].filter(Boolean);
};
// alias table for catalog names that differ from book names
const ORG_ALIASES = {
  'этен': 'ethylene', 'этилен': 'ethylene', 'этин': 'acetylene', 'ацетилен': 'acetylene', 'пропилен': 'propene', 'пропен': 'propene',
  'метилацетилен': 'propyne', 'пропин': 'propyne', 'дивинил': 'butadiene', 'бутадиен-1,3': 'butadiene', 'бутадиен': 'butadiene',
  '2-метилбутадиен-1,3': 'isoprene', 'изопрен': 'isoprene', 'изобутан': 'isobutane', '2-метилпропан': 'isobutane', 'бутан': 'n-butane', 'н-бутан': 'n-butane',
  'пентан': 'n-pentane', 'н-пентан': 'n-pentane', 'изопентан': 'isopentane', 'неопентан': 'neopentane', 'гексан': 'n-hexane', 'н-гексан': 'n-hexane',
  'метилбензол': 'toluene', 'толуол': 'toluene', 'винный спирт': 'ethanol', 'этиловый спирт': 'ethanol', 'спирт': 'ethanol', 'метиловый спирт': 'methanol',
  'пропанол-1': 'propanol', 'бутанол-1': 'n-butanol', 'уксусный альдегид': 'acetaldehyde', 'этаналь': 'acetaldehyde', 'пропанон': 'acetone',
  'этановая кислота': 'acetic-acid', 'метилхлорид': 'chloromethane', 'сахар': 'sucrose', 'этиленгликоль': 'ethylene-glycol', 'формалин': 'formaldehyde',
};
const orgByName = new Map();
for (const o of cat.organic) for (const v of nameVariants(o.nameRu)) if (!orgByName.has(v)) orgByName.set(v, o.id);
const orgIds = new Set(cat.organic.map((o) => o.id));
const orgHill = new Map(cat.organic.map((o) => [o.id, hill(parseFormula(o.formula))]));
const compByHill = new Map();
for (const c of cat.compounds) {
  if (!c.composition) continue;
  const h = hill(c.composition);
  if (!compByHill.has(h)) compByHill.set(h, []);
  compByHill.get(h).push(c);
}
function mapSubstance(s) {
  if (s.kind === 'simple' || !s.formula) {
    if (!s.formula) {
      for (const v of nameVariants(s.nameRu)) { if (ORG_ALIASES[v]) return { id: ORG_ALIASES[v], how: 'name' }; if (orgByName.has(v)) return { id: orgByName.get(v), how: 'name' }; }
    }
    return null;
  }
  const mf = s.molecularFormula;
  if (s.kind === 'organic' || (mf && mf.startsWith('C') && /H/.test(mf) && !/^CH?\d*O\d*$/.test(mf))) {
    for (const v of nameVariants(s.nameRu)) {
      const id = ORG_ALIASES[v] || orgByName.get(v);
      if (id && orgHill.get(id) === mf) return { id, how: 'name+formula' };
    }
    // no formula-only fallback: isomers (бутадиен-1,2 vs 1,3, пропанол-2 vs 1) would be mis-mapped.
    // salts with organic anion etc. fall through to compounds
  }
  const cands = compByHill.get(mf) || [];
  if (cands.length === 1) return { id: cands[0].id, how: 'composition' };
  if (cands.length > 1) {
    const nv = nameVariants(s.nameRu);
    const hit = cands.find((c) => nv.some((v) => norm(c.nameRu).startsWith(v.slice(0, 6))));
    return { id: (hit || cands[0]).id, how: hit ? 'composition+name' : 'composition(ambiguous)' };
  }
  return null;
}

// ---------- bank signatures ----------
const sig = (parsed) => {
  const side = (a) => a.map((x) => `${x.coeff}*${hill(parseFormula(x.formula))}`).sort().join('+');
  return side(parsed.reactants) + '=>' + side(parsed.products);
};
const bankSig = new Map();
for (const b of cat.bank) {
  try {
    const eq = deUni(b.equationRu).split(';')[0].replace(/\s\([^)]*\)/g, ' ').replace(/[↑↓]/g, '').replace(/⇄/g, '⇌');
    const p = parseEquation(eq);
    bankSig.set(sig(p), b.id);
  } catch { /* skip unparsable bank rows */ }
}

// ---------- build ----------
const KINDS = new Set(['simple', 'oxide', 'acid', 'base', 'salt', 'organic', 'other']);
const ROLES = new Set(['studied', 'obtained', 'reagent', 'mentioned']);
const TYPES = new Set(['combination', 'decomposition', 'substitution', 'exchange', 'redox', 'neutralization', 'combustion', 'hydrolysis', 'polymerization', 'other']);
const clampQuote = (q, where) => { if (q && q.length > 160) { warn(`quote >160 (${q.length}) at ${where}`); return q.slice(0, 157) + '...'; } return q; };

const N = secList.length;
const half = Math.ceil(N / 2);
const out = [];
for (let i = 0; i < half; i++) {
  const s = secList[i];
  const next = secList[i + 1];
  const d = data[s.id];
  if (!d) { warn('missing data for ' + s.id); continue; }
  const [chapterId] = s.id.split('-');
  const pageStart = s.page;
  const pageEnd = next ? next.page - 1 : 192;
  const substances = d.subs.map((t, k) => {
    const [formula, nameRu, kind, role, page, quote, o = {}] = t;
    const where = `${s.id} sub#${k} ${nameRu}`;
    if (!KINDS.has(kind)) warn('bad kind ' + where);
    if (!ROLES.has(role)) warn('bad role ' + where);
    if (page < pageStart || page > pageEnd) warn(`page ${page} outside ${pageStart}-${pageEnd} ${where}`);
    const rec = { formula, formulaUnicode: formula ? toUni(formula) : null, formulaInBook: formula ? o.inBook !== false : false, nameRu, kind, role, page, quote: clampQuote(quote, where) };
    if (formula) {
      try { rec.molecularFormula = hill(parseFormula(formula)); } catch (e) { warn('formula parse ' + where + ': ' + e.message); rec.molecularFormula = null; }
    } else rec.molecularFormula = null;
    const m = mapSubstance(rec);
    rec.catalogId = m ? m.id : null;
    if (m) rec.catalogMatch = m.how;
    if (o.nameInBook === false) rec.nameInBook = false;
    if (o.ex) rec.fromExercise = true;
    if (o.note) rec.note = o.note;
    return rec;
  });
  const reactions = d.rx.map((t, k) => {
    const [page, asInBook, equation, type, conditions, quote, o = {}] = t;
    const where = `${s.id} rx#${k} ${equation}`;
    if (!TYPES.has(type)) warn('bad type ' + where);
    if (page < pageStart || page > pageEnd) warn(`page ${page} outside ${pageStart}-${pageEnd} ${where}`);
    const parsed = parseEquation(equation);
    const general = !!o.general || [...parsed.reactants, ...parsed.products].some((x) => /^R|R-|-R|R\*|Cn/.test(x.formula));
    const rec = {
      equationAsInBook: asInBook,
      equation,
      reactants: parsed.reactants.map(({ formula, coeff, coeffRaw }) => (coeffRaw.includes('n') ? { formula, coeff, coeffSymbolic: coeffRaw } : { formula, coeff })),
      products: parsed.products.map(({ formula, coeff, coeffRaw }) => (coeffRaw.includes('n') ? { formula, coeff, coeffSymbolic: coeffRaw } : { formula, coeff })),
      conditions: conditions || '',
      type,
      isGeneralScheme: general,
      isIonic: !!o.ionic,
      page,
      quote: clampQuote(quote, where),
      balanced: null,
      bankId: null,
    };
    const hasWords = [...parsed.reactants, ...parsed.products].some((x) => WORDISH.test(x.formula));
    if (!general && !hasWords) {
      try {
        const b = balanceOf(parsed);
        rec.balanced = b.ok;
        if (!b.ok && !o.noBalance) warn(`UNBALANCED ${where} ${b.diff.join(',')}`);
        if (!b.ok) rec.balanceDiff = b.diff.join(', ');
        rec.bankId = bankSig.get(sig(parsed)) || null;
      } catch (e) { warn('eq parse ' + where + ': ' + e.message); }
    }
    if (o.described) rec.describedInTextOnly = true;
    if (o.note) rec.note = o.note;
    return rec;
  });
  const labWorks = d.labs.map(([title, page, subs]) => ({ title, page, substances: subs }));
  out.push({ sectionId: s.id, chapterId, kp: s.kp, title: s.title, pageStart, pageEnd, substances, reactions, labWorks });
}

const allSubs = out.flatMap((s) => s.substances);
const allRx = out.flatMap((s) => s.reactions);
const counts = {
  sections: out.length,
  substances: allSubs.length,
  uniqueFormulas: new Set(allSubs.filter((x) => x.formula).map((x) => x.formula.replace(/[-–]/g, ''))).size,
  uniqueMolecularFormulas: new Set(allSubs.map((x) => x.molecularFormula).filter(Boolean)).size,
  uniqueNames: new Set(allSubs.map((x) => norm(x.nameRu))).size,
  substancesWithoutFormula: allSubs.filter((x) => !x.formula).length,
  substancesMappedToCatalog: allSubs.filter((x) => x.catalogId).length,
  uniqueCatalogIds: new Set(allSubs.map((x) => x.catalogId).filter(Boolean)).size,
  reactions: allRx.length,
  reactionsGeneralSchemes: allRx.filter((r) => r.isGeneralScheme).length,
  reactionsDescribedOnly: allRx.filter((r) => r.describedInTextOnly).length,
  reactionsBalanced: allRx.filter((r) => r.balanced === true).length,
  reactionsUnbalancedByDesign: allRx.filter((r) => r.balanced === false).length,
  reactionsMappedToBank: allRx.filter((r) => r.bankId).length,
  labWorks: out.reduce((a, s) => a + s.labWorks.length, 0),
};
const doc = {
  grade: 10,
  part: 1,
  source: 'public/textbooks/kimyo-10-ru-2022.pdf (Химия 10, Ташкент 2022); text: scripts/kb/.cache/raw/g10-layout.txt + visual check of rendered pages 46-95',
  splitRule: `kb-sections.json g10: ${N} sections, part 1 = indices 0..${half - 1} (${secList[0].id} .. ${secList[half - 1].id})`,
  generatedAt: new Date().toISOString(),
  conventions: {
    formula: 'ASCII; semi-structural formulas keep "-" for bonds between groups and "=" / "≡" for multiple bonds; polymers as (...)n; molecularFormula is Hill-style computed',
    formulaInBook: 'false = the book names the substance but does not print its formula at this spot (formula added by extractor)',
    nameInBook: 'false = the book prints only a formula (name added by extractor)',
    fromExercise: 'substance appears in a task/exercise (Задания)',
    catalogMatch: 'how catalogId was found: name+formula | formula+nameRoot | composition | composition+name | composition(ambiguous) | name',
    balanced: 'null = general scheme or word scheme (not checked); false = unbalanced as printed / schematic (see note, balanceDiff)',
    describedInTextOnly: 'true = no equation in the book; reaction described in words or requested in a question; equation composed by extractor',
    simpleSubstances: 'catalogId is null for simple substances (catalog compounds contain no elements)',
  },
  counts,
  sections: out,
};
fs.mkdirSync(path.join(root, 'src/data/textbook'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/textbook/inventory-g10-part1.json'), JSON.stringify(doc, null, 1) + '\n');
console.log(JSON.stringify(counts, null, 1));
console.log('warnings:', warnings.length);
for (const w of warnings) console.log(' -', w);
