/**
 * Build src/data/textbook/inventory-g11-part1.json from g11p1-data.mjs:
 * formula → Unicode, composition parsing, element/charge (or nuclear A/Z) balance check,
 * catalog mapping (compounds / organic registry / school reaction bank), per-section de-duplication.
 * Usage: node scripts/textbook-inventory/build-g11p1.mjs [catalogSnapshot.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS } from './g11p1-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const catalogPath = process.argv[2] ?? path.join(root, '.smoke', 'textbook-inventory', 'g11p1-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const kbSections = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'kb', 'corpus', 'kb-sections.json'), 'utf8')).g11;

const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
const UNSUB = Object.fromEntries(Object.entries(SUB).map(([a, b]) => [b, a]));
const warnings = [];

/** ASCII formula (optionally with ^charge) → Unicode. */
function toUnicode(f) {
  if (!f) return null;
  const [body, charge] = f.split('^');
  const b = body.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((c) => SUB[c]).join(''));
  return b + (charge ? [...charge].map((c) => SUP[c]).join('') : '');
}

/** Parse ASCII formula into {comp, charge}. Supports parentheses and '·'. */
function parseFormula(f) {
  const [body, chargeStr] = f.split('^');
  let charge = 0;
  if (chargeStr) {
    const m = chargeStr.match(/^(\d*)([+-])$/);
    if (!m) throw new Error(`bad charge ${f}`);
    charge = (m[1] ? Number(m[1]) : 1) * (m[2] === '+' ? 1 : -1);
  }
  const comp = {};
  const parts = body.split('·');
  for (const part of parts) {
    const pm = part.match(/^(\d*)(.*)$/);
    const mult = pm[1] ? Number(pm[1]) : 1;
    const stack = [{}];
    const tokens = pm[2].match(/[A-Z][a-z]?\d*|\(|\)\d*/g) ?? [];
    if (tokens.join('') !== pm[2]) throw new Error(`cannot parse formula ${f}`);
    for (const t of tokens) {
      if (t === '(') stack.push({});
      else if (t.startsWith(')')) {
        const n = t.length > 1 ? Number(t.slice(1)) : 1;
        const top = stack.pop();
        const cur = stack[stack.length - 1];
        for (const [el, c] of Object.entries(top)) cur[el] = (cur[el] ?? 0) + c * n;
      } else {
        const m = t.match(/([A-Z][a-z]?)(\d*)/);
        const cur = stack[stack.length - 1];
        cur[m[1]] = (cur[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
      }
    }
    for (const [el, c] of Object.entries(stack[0])) comp[el] = (comp[el] ?? 0) + c * mult;
  }
  return { comp, charge };
}
const compKey = (comp) => Object.keys(comp).sort().map((k) => `${k}${comp[k]}`).join('');

/** Parse one side "2NaCl + H2O{g}" into [{formula, coeff, state}] */
function parseSide(side) {
  return side.split(' + ').map((tok) => {
    tok = tok.trim();
    let state = null;
    const st = tok.match(/\{(v|g)\}$/);
    if (st) { state = st[1] === 'v' ? 'precipitate' : 'gas'; tok = tok.slice(0, -3); }
    let m = tok.match(/^(\d+) (\d+\/[+-]?\d+\/\S+)$/); // nuclear with coefficient "3 1/0/n"
    if (m) return { formula: m[2], coeff: Number(m[1]), state };
    m = tok.match(/^(\d+)?(.+)$/);
    if (/^\d+\/[+-]?\d+\//.test(tok)) return { formula: tok, coeff: 1, state };
    return { formula: m[2], coeff: m[1] ? Number(m[1]) : 1, state };
  });
}
function speciesUnicode(sp) {
  const nm = sp.formula.match(/^(\d+)\/([+-]?\d+)\/(.+)$/);
  let s;
  if (nm) s = `${[...nm[1]].map((c) => SUP[c]).join('')}${[...nm[2]].map((c) => (c === '+' ? '₊' : c === '-' ? '₋' : SUB[c])).join('')}${nm[3]}`;
  else s = toUnicode(sp.formula);
  return `${sp.coeff > 1 ? sp.coeff : ''}${s}${sp.state === 'precipitate' ? '↓' : sp.state === 'gas' ? '↑' : ''}`;
}

function analyzeReaction(r) {
  const arrow = r.eq.includes('<=>') ? '<=>' : '->';
  const [l, rr] = r.eq.split(` ${arrow} `);
  if (rr === undefined) throw new Error(`bad eq ${r.eq}`);
  const reactants = parseSide(l);
  const products = parseSide(rr);
  const nuclear = /^nuclear/.test(r.sub ?? '');
  let balanced;
  let balanceDetail;
  if (nuclear) {
    const sum = (arr) => arr.reduce((acc, s) => {
      const [A, Z] = s.formula.split('/');
      return [acc[0] + s.coeff * Number(A), acc[1] + s.coeff * Number(Z)];
    }, [0, 0]);
    const a = sum(reactants); const b = sum(products);
    balanced = a[0] === b[0] && a[1] === b[1];
    balanceDetail = `A ${a[0]}=${b[0]}, Z ${a[1]}=${b[1]}`;
  } else {
    const tally = (arr) => arr.reduce((acc, s) => {
      const { comp, charge } = parseFormula(s.formula);
      for (const [el, c] of Object.entries(comp)) acc.el[el] = (acc.el[el] ?? 0) + c * s.coeff;
      acc.q += charge * s.coeff;
      return acc;
    }, { el: {}, q: 0 });
    const a = tally(reactants); const b = tally(products);
    balanced = compKey(a.el) === compKey(b.el) && a.q === b.q;
    balanceDetail = balanced ? null : `L ${compKey(a.el)} q${a.q} | R ${compKey(b.el)} q${b.q}`;
  }
  if (!balanced) warnings.push(`UNBALANCED p${r.p}: ${r.eq} (${balanceDetail})`);
  const arrowU = arrow === '<=>' ? '⇌' : '→';
  const cond = r.cond ? `(${r.cond})` : '';
  const equation = `${reactants.map(speciesUnicode).join(' + ')} ${arrowU}${cond} ${products.map(speciesUnicode).join(' + ')}`;
  const equationAscii = r.eq.replace(/\{v\}/g, '(s)').replace(/\{g\}/g, '(g)');
  const strip = (arr) => arr.map((s) => ({ formula: s.formula, coeff: s.coeff, ...(s.state ? { state: s.state } : {}) }));
  return { reactants: strip(reactants), products: strip(products), balanced, balanceDetail, equation, equationAscii, nuclear };
}

// ── catalog indexes ──
const unicodeToAscii = (u) => u.replace(/[₀-₉]/g, (c) => UNSUB[c]).replace(/[·•]/g, '·');
const compoundsByKey = new Map();
for (const c of catalog.compounds) {
  const key = compKey(c.composition);
  if (!compoundsByKey.has(key)) compoundsByKey.set(key, []);
  compoundsByKey.get(key).push(c);
}
const organicByKey = new Map();
for (const o of catalog.organic ?? catalog.organics ?? []) {
  let key;
  try { key = compKey(parseFormula(unicodeToAscii(o.formula)).comp); } catch { continue; }
  if (!organicByKey.has(key)) organicByKey.set(key, []);
  organicByKey.get(key).push(o);
}
const ORGANIC_HINT = { C2H5OH: 'ethanol', C12H22O11: 'sucrose', CH3COOH: 'acetic-acid', HCOOH: 'formic-acid' };

function mapSubstance(formula, kind, nameRu) {
  if (!formula || formula.includes('^')) return { catalogId: null };
  const { comp } = parseFormula(formula);
  const key = compKey(comp);
  const hint = ORGANIC_HINT[formula];
  if (hint && (catalog.organic ?? []).some((o) => o.id === hint)) return { catalogId: hint, catalogSource: 'organic' };
  const org = organicByKey.get(key) ?? [];
  const inorg = compoundsByKey.get(key) ?? [];
  const isOrganicLike = kind === 'organic' || (comp.C && comp.H && !/CO3|CN/.test(formula));
  if (isOrganicLike && org.length === 1) return { catalogId: org[0].id, catalogSource: 'organic' };
  if (isOrganicLike && org.length > 1) {
    const byName = org.find((o) => nameRu && o.nameRu.toLowerCase().includes(nameRu.toLowerCase().split(' ')[0]));
    if (byName) return { catalogId: byName.id, catalogSource: 'organic' };
    warnings.push(`AMBIGUOUS organic ${formula}: ${org.map((o) => o.id).join(',')}`);
    return { catalogId: null };
  }
  if (inorg.length === 1) return { catalogId: inorg[0].id, catalogSource: 'compounds' };
  if (inorg.length > 1) {
    const exact = inorg.find((c) => unicodeToAscii(c.formulaUnicode).replace(/·/g, '') === formula);
    if (exact) return { catalogId: exact.id, catalogSource: 'compounds' };
    warnings.push(`AMBIGUOUS compound ${formula}: ${inorg.map((c) => c.id).join(',')}`);
  }
  return { catalogId: null };
}

// Reaction bank index: parse equationRu into normalized side keys.
function bankSideKey(side) {
  return side.split(' + ').map((t) => {
    t = t.replace(/[↓↑]/g, '').trim();
    const m = t.match(/^(\d+)?(.+)$/);
    const f = unicodeToAscii(m[2]).replace(/[[\]]/g, (c) => (c === '[' ? '(' : ')'));
    let k;
    try { k = compKey(parseFormula(f).comp); } catch { k = `?${f}`; }
    return `${m[1] ?? 1}*${k}`;
  }).sort().join('|');
}
const bankIndex = new Map();
for (const r of catalog.reactions) {
  const eqs = r.equationRu.split(';').map((s) => s.trim());
  if (eqs.length !== 1) continue;
  const m = eqs[0].match(/^(.*?)\s*(?:→|⇄|⇌|=)(?:\([^)]*\))?\s*(.*)$/);
  if (!m) continue;
  try { bankIndex.set(`${bankSideKey(m[1])}=>${bankSideKey(m[2])}`, r.id); } catch { /* skip */ }
}
function mapReaction(an, r) {
  if (r.bank) return { bankId: r.bank, bankMatch: r.bankMatch ?? 'exact' };
  if (an.nuclear || r.ion || r.gen) return { bankId: null };
  const key = (arr) => arr.map((s) => `${s.coeff}*${compKey(parseFormula(s.formula).comp)}`).sort().join('|');
  const id = bankIndex.get(`${key(an.reactants)}=>${key(an.products)}`);
  return id ? { bankId: id, bankMatch: 'exact' } : { bankId: null };
}

const ROLE_RANK = { studied: 4, reagent: 3, obtained: 2, mentioned: 1 };
/** Keep quotes within 160 chars: cut at a word boundary and mark the cut with an ellipsis. */
function clampQuote(q) {
  if (q.length <= 160) return q;
  const cut = q.slice(0, 159);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 100 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}
const out = { grade: 11, part: 1, source: 'Kimyo 11 (рус.), public/textbooks/kimyo-11-ru.pdf', generatedAt: new Date().toISOString(), notes: [], sections: [], stats: {} };
out.notes.push(
  'Part 1 = first 17 of 33 grade-11 sections in kb-sections.json (kp 1–17, pages 4–85).',
  'The PDF has no text layer; text comes from the OCR cache and every formula was checked against a render of the page.',
  'Substances are de-duplicated per section (by formula, or by name when formula is null); `pages` lists all pages of the section where the substance occurs; role is the strongest role seen (studied > reagent > obtained > mentioned).',
  'nameInBook / formulaInBook tell whether the Russian name / the formula is literally printed in the book for that occurrence; otherwise it was added by the extractor.',
  'Atoms/elements that appear only in electron-configuration, isotope or periodic-table context are listed in `elementsMentioned`, not as substances. General formulas (R2O, RO4, RH4, EO3, EH3) are not listed.',
  'Nuclear equations (subtype nuclear / nuclear-particle) use species "A/Z/Symbol"; they are balanced by mass number and charge, not by elements.',
  'labWorks: grade 11 part 1 contains no formal лабораторные/практические работы; in-text demonstration experiments are listed with isFormalLabWork=false.',
);

let totalSubs = 0; let totalRx = 0; let totalLabs = 0;
const uniqueFormulas = new Set();
const uniqueNames = new Set();
for (const sec of SECTIONS) {
  const kb = kbSections.find((s) => s.id === sec.id);
  if (!kb) throw new Error(`section ${sec.id} not in kb-sections`);
  const [chapter] = sec.id.split('-');
  const merged = new Map();
  for (const [page, quote, role, flag, items] of sec.subs) {
    if (page < sec.pageStart || page > sec.pageEnd) warnings.push(`PAGE OUT OF RANGE ${sec.id} p${page}`);
    for (const [formula, nameRu, kind, itemFlag] of items) {
      const f = itemFlag ?? flag;
      const key = formula ?? `name:${nameRu}`;
      const entry = {
        formula,
        formulaUnicode: toUnicode(formula),
        nameRu,
        nameInBook: f !== 'F',
        formulaInBook: formula ? f !== 'N' : false,
        kind,
        role,
        page,
        pages: [page],
        quote: clampQuote(quote),
        ...mapSubstance(formula, kind, nameRu),
      };
      if (formula && !formula.includes('^') && kind === 'simple') {
        const { comp } = parseFormula(formula);
        if (Object.keys(comp).length === 1) entry.elementSymbol = Object.keys(comp)[0];
      }
      if (formula?.includes('^')) entry.isIon = true;
      const prev = merged.get(key);
      if (!prev) { merged.set(key, entry); continue; }
      if (!prev.pages.includes(page)) prev.pages.push(page);
      prev.nameInBook ||= entry.nameInBook;
      prev.formulaInBook ||= entry.formulaInBook;
      if (ROLE_RANK[role] > ROLE_RANK[prev.role]) {
        Object.assign(prev, { role, page, quote: entry.quote, nameRu: entry.nameInBook ? nameRu : prev.nameRu });
      }
    }
  }
  const substances = [...merged.values()].map((s) => ({ ...s, pages: [...s.pages].sort((a, b) => a - b) }));
  const reactions = sec.rx.map((r) => {
    const an = analyzeReaction(r);
    return {
      equationAsInBook: r.book,
      equation: an.equation,
      equationAscii: an.equationAscii,
      reactants: an.reactants,
      products: an.products,
      conditions: r.cond ?? null,
      type: r.type,
      subtype: r.sub ?? null,
      isGeneralScheme: Boolean(r.gen),
      isIonic: Boolean(r.ion),
      balanced: an.balanced,
      page: r.p,
      quote: clampQuote(r.quote),
      ...mapReaction(an, r),
      note: r.note ?? null,
    };
  });
  const labWorks = sec.labs.map((l) => ({ title: l.title, page: l.page, pages: l.pages, isFormalLabWork: l.formal, substances: l.subs }));
  for (const l of sec.labs) for (const f of l.subs) if (!merged.has(f)) warnings.push(`LAB SUBSTANCE NOT IN SECTION ${sec.id}: ${f}`);
  // every formula used in a (non-nuclear) reaction should be in the section's substances
  for (const r of reactions) {
    if (/^nuclear/.test(r.subtype ?? '') || r.isGeneralScheme) continue;
    for (const s of [...r.reactants, ...r.products]) {
      if (!s.formula.includes('^') && s.formula !== 'H' && !merged.has(s.formula)) warnings.push(`RX SPECIES NOT IN SUBSTANCES ${sec.id} p${r.page}: ${s.formula}`);
    }
  }
  totalSubs += substances.length; totalRx += reactions.length; totalLabs += labWorks.length;
  for (const s of substances) { if (s.formula && !s.isIon) uniqueFormulas.add(s.formula); if (!s.formula) uniqueNames.add(s.nameRu); }
  out.sections.push({
    sectionId: `g11-${sec.id}`,
    chapterId: `g11-${chapter}`,
    kp: kb.kp,
    title: kb.title,
    pageStart: sec.pageStart,
    pageEnd: sec.pageEnd,
    elementsMentioned: sec.elements ? sec.elements.split(/\s+/) : [],
    substances,
    reactions,
    labWorks,
  });
}
const allSubs = out.sections.flatMap((s) => s.substances);
const uniq = new Map();
for (const s of allSubs) if (s.formula && !s.isIon) uniq.set(s.formula, s.catalogId);
out.stats = {
  sections: out.sections.length,
  substanceEntries: totalSubs,
  uniqueFormulas: uniqueFormulas.size,
  uniqueIons: new Set(allSubs.filter((s) => s.isIon).map((s) => s.formula)).size,
  nameOnlySubstances: [...uniqueNames],
  uniqueFormulasMappedToCatalog: [...uniq.values()].filter(Boolean).length,
  uniqueFormulasNotInCatalog: [...uniq.entries()].filter(([, id]) => !id).map(([f]) => f).sort(),
  reactions: totalRx,
  reactionsMolecular: out.sections.flatMap((s) => s.reactions).filter((r) => !r.isIonic && !/^nuclear/.test(r.subtype ?? '')).length,
  reactionsMappedToBank: out.sections.flatMap((s) => s.reactions).filter((r) => r.bankId).length,
  reactionsUnbalanced: out.sections.flatMap((s) => s.reactions).filter((r) => !r.balanced).length,
  labWorks: totalLabs,
};
const outFile = path.join(root, 'src', 'data', 'textbook', 'inventory-g11-part1.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
console.log(JSON.stringify(out.stats, null, 1));
console.log(warnings.length ? `WARNINGS:\n${warnings.join('\n')}` : 'no warnings');
