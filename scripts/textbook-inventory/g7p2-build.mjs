/**
 * Builds src/data/textbook/inventory-g7-part2.json from g7p2-data.mjs.
 *  - quotes are cut from the textbook page text (scripts/kb/.cache/raw/g7-raw.txt, pdftotext) by a search key;
 *    equationAsInBook is replaced by the exact matched page text;
 *  - every reaction is balance-checked; formulas are parsed to element counts;
 *  - substances are mapped to the catalog (compounds / organic registry), reactions to SCHOOL_REACTION_BANK.
 * Catalog dump: .smoke/textbook-inventory/g7p2-catalog.json (made by g7p2-dump-catalog.mts).
 * Usage: node scripts/textbook-inventory/g7p2-build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA } from './g7p2-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const OUT = path.join(root, 'src', 'data', 'textbook', 'inventory-g7-part2.json');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '.smoke', 'textbook-inventory', 'g7p2-catalog.json'), 'utf8'));
const sectionsList = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'kb', 'corpus', 'kb-sections.json'), 'utf8')).g7;
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'kb', 'corpus', 'kb-corpus-g7.json'), 'utf8')).chunks;
const rawPages = fs.readFileSync(path.join(root, 'scripts', 'kb', '.cache', 'raw', 'g7-raw.txt'), 'utf8').split('\f');

const errors = [];
const warnings = [];

// ─────────────── page text + search
const LOOK = { А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ё: 'е', '−': '-', '–': '-', '—': '-' };
const fold = (s) => s.replace(/[АВСЕНКМОРТХаеорсухі ё−–—]/g, (ch) => LOOK[ch] ?? ch).toLowerCase();
const pageCache = new Map();
function pageText(p) {
  if (pageCache.has(p)) return pageCache.get(p);
  let t = rawPages[p - 1] ?? '';
  t = t.replace(/-\n(?=[а-яё])/g, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s\d{3}$/, ''); // trailing page number
  const idx = [];
  let ns = '';
  for (let i = 0; i < t.length; i += 1) {
    if (!/\s/.test(t[i])) { idx.push(i); ns += t[i]; }
  }
  const v = { t, idx, ns: fold(ns) };
  pageCache.set(p, v);
  return v;
}
function findOnPage(p, key) {
  const pt = pageText(p);
  const k = fold(key.replace(/\s+/g, ''));
  if (!k) return null;
  const at = pt.ns.indexOf(k);
  if (at < 0) return null;
  const s = pt.idx[at];
  const e = pt.idx[at + k.length - 1] + 1;
  return { page: p, start: s, end: e, match: pt.t.slice(s, e) };
}
function quoteAround(hit, max = 160) {
  const t = pageText(hit.page).t;
  const len = hit.end - hit.start;
  if (len >= max) return t.slice(hit.start, hit.start + max).trim();
  let s = Math.max(0, hit.start - Math.floor((max - len) / 3));
  // snap to a sentence start if one is close, else to a word boundary
  const sentence = t.lastIndexOf('. ', hit.start);
  if (sentence >= s && sentence < hit.start) s = sentence + 2;
  else if (s > 0) { const sp = t.indexOf(' ', s); s = sp >= 0 && sp < hit.start ? sp + 1 : s; }
  let e = Math.min(t.length, s + max);
  if (e < hit.end) { s = hit.end - max; e = hit.end; }
  if (e < t.length) { const sp = t.lastIndexOf(' ', e); if (sp > hit.end) e = sp; }
  return t.slice(s, e).trim();
}
function locate(sec, page, keys, what) {
  const order = [page, ...[page - 1, page + 1, page + 2, page - 2].filter((p) => p >= sec.searchFrom && p <= sec.searchTo)];
  for (const key of keys.filter(Boolean)) {
    for (const p of order) {
      const hit = findOnPage(p, key);
      if (hit) {
        if (p !== page) warnings.push(`${sec.id}: "${what}" found on p.${p}, data says p.${page} — using p.${p}`);
        return hit;
      }
    }
  }
  errors.push(`${sec.id}: quote key not found for ${what} (keys: ${JSON.stringify(keys)}) near p.${page}`);
  return null;
}

// ─────────────── formulas
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', n: 'ₙ', m: 'ₘ' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
function toUnicode(f) {
  if (!f) return null;
  const [body, charge] = f.split('^');
  let out = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    const prev = body[i - 1];
    if (/[0-9]/.test(ch) && prev && /[A-Za-z)\]₀-₉ₙₘ]/.test(out[out.length - 1] ?? '') && !/[·*]/.test(prev)) {
      // digits directly after an element/bracket are subscripts (a digit after "·" starts a coefficient)
      out += SUB[ch];
    } else if (/[nm]/.test(ch) && (prev === ')' || (i === 1 && prev === 'C' && body[2] === '('))) {
      out += SUB[ch];
    } else if (ch === '*') out += '·';
    else out += ch;
  }
  if (charge) out += [...charge].map((c) => SUP[c] ?? c).join('');
  return out;
}
function parseFormula(f) {
  if (!f) return null;
  let body = f.split('^')[0].replace(/[↑↓]/g, '');
  if (/[a-z]/.test(body.replace(/[A-Z][a-z]?/g, '').replace(/[n]$/, ''))) {
    // letters that are not element symbols (e.g. Cn(H2O)m) → not parseable
    if (!/^\(.*\)n$/.test(body)) return null;
  }
  body = body.replace(/\)n$/, ')');
  const total = {};
  for (const partRaw of body.split(/[·*]/)) {
    const m = partRaw.match(/^(\d*)(.*)$/);
    const mult = m[1] ? Number(m[1]) : 1;
    const counts = parseGroup(m[2]);
    if (!counts) return null;
    for (const [el, n] of Object.entries(counts)) total[el] = (total[el] ?? 0) + n * mult;
  }
  return total;
}
function parseGroup(s) {
  const stack = [{}];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[') { stack.push({}); i += 1; continue; }
    if (ch === ')' || ch === ']') {
      i += 1;
      let num = '';
      while (i < s.length && /\d/.test(s[i])) num += s[i++];
      const grp = stack.pop();
      const k = num ? Number(num) : 1;
      const top = stack[stack.length - 1];
      for (const [el, n] of Object.entries(grp)) top[el] = (top[el] ?? 0) + n * k;
      continue;
    }
    const m = s.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
    if (!m) return null;
    const top = stack[stack.length - 1];
    top[m[1]] = (top[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
    i += m[0].length;
  }
  return stack.length === 1 ? stack[0] : null;
}
const compKey = (c) => (c ? Object.entries(c).sort(([a], [b]) => a.localeCompare(b)).map(([e, n]) => `${e}${n}`).join('') : null);
const fromUnicode = (s) => s.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, '');

// ─────────────── catalog maps
const compoundsByComp = new Map();
for (const c of catalog.compounds) compoundsByComp.set(compKey(c.composition), c);
const organicByComp = new Map();
for (const o of catalog.organic) {
  const k = compKey(parseFormula(fromUnicode(o.formula)));
  if (!organicByComp.has(k)) organicByComp.set(k, []);
  organicByComp.get(k).push(o);
}
const NAME_ALIAS = { сахар: 'sucrose', 'уксусная кислота': 'acetic-acid', 'муравьиная кислота': 'formic-acid', метанол: 'methanol', глицерин: 'glycerol' };
function mapCatalog(formula, nameRu, kind) {
  if (!formula || formula.includes('^')) return {};
  const comp = parseFormula(formula);
  if (!comp) return {};
  const key = compKey(comp);
  const els = Object.keys(comp);
  const res = {};
  if (els.length === 1) res.element = els[0];
  const c = compoundsByComp.get(key);
  if (c) return { ...res, catalogId: c.id, catalogSource: 'compounds', catalogNameRu: c.nameRu };
  const orgs = organicByComp.get(key) ?? [];
  if (orgs.length) {
    const lname = (nameRu ?? '').toLowerCase().replace(/\s*\(.*\)\s*/g, ' ').trim();
    if (lname) {
      const alias = Object.entries(NAME_ALIAS).find(([n]) => lname.startsWith(n));
      const byAlias = alias && orgs.find((o) => o.id === alias[1]);
      const byName = byAlias ?? orgs.find((o) => o.nameRu.toLowerCase().includes(lname.split(' ')[0]));
      if (byName) return { ...res, catalogId: byName.id, catalogSource: 'organic', catalogNameRu: byName.nameRu };
      return { ...res, catalogCandidates: orgs.map((o) => o.id) };
    }
    if (orgs.length === 1) return { ...res, catalogId: orgs[0].id, catalogSource: 'organic', catalogNameRu: orgs[0].nameRu };
    const pref = orgs.find((o) => /открыт/.test(o.nameRu)) ?? null;
    return { ...res, catalogId: pref?.id ?? null, catalogSource: pref ? 'organic' : undefined, catalogCandidates: orgs.map((o) => o.id) };
  }
  return res;
}

// ─────────────── equations
const ARROW = /\s*(→|⇌|⇄|↔|=)\s*/;
function parseSide(side) {
  return side.split(/\s+\+\s+/).map((term) => {
    const t = term.trim().replace(/[↑↓]/g, '');
    const m = t.match(/^(\d*)(n?)\s*(.+)$/);
    return { formula: m[3], coeff: m[1] ? Number(m[1]) : 1, ...(m[2] ? { perN: true } : {}) };
  });
}
function parseEquation(e) {
  const m = e.match(ARROW);
  if (!m) return null;
  const [l, r] = [e.slice(0, m.index), e.slice(m.index + m[0].length)];
  return { arrow: m[1], reactants: parseSide(l), products: parseSide(r) };
}
function sumSide(terms) {
  const total = {};
  for (const t of terms) {
    const c = parseFormula(t.formula);
    if (!c) return null;
    for (const [el, n] of Object.entries(c)) total[el] = (total[el] ?? 0) + n * t.coeff;
  }
  return total;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function speciesSignature(reactants, products) {
  const all = [...reactants, ...products];
  const g = all.reduce((acc, t) => gcd(acc, t.coeff), 0) || 1;
  const side = (ts) => ts.map((t) => `${t.coeff / g}*${compKey(parseFormula(t.formula))}`).sort().join('+');
  return `${side(reactants)}>${side(products)}`;
}
const bankBySig = new Map();
for (const r of catalog.reactions) {
  const eq = fromUnicode(r.equationRu).replace(/\([^)]*[°а-яё][^)]*\)/gi, ' ');
  const p = parseEquation(eq.replace(/⇄/g, '⇌'));
  if (!p) continue;
  const ok = [...p.reactants, ...p.products].every((t) => /^[A-Za-z0-9()[\]·]+$/.test(t.formula) && parseFormula(t.formula));
  if (!ok) continue;
  const sig = speciesSignature(p.reactants, p.products);
  if (!bankBySig.has(sig)) bankBySig.set(sig, r.id);
}

// ─────────────── build
const KIND = { s: 'simple', ox: 'oxide', ac: 'acid', b: 'base', sl: 'salt', org: 'organic', o: 'other' };
const ROLE = { st: 'studied', ob: 'obtained', re: 'reagent', me: 'mentioned' };
const ROLE_RANK = { studied: 3, obtained: 2, reagent: 1, mentioned: 0 };
const TYPE = { comb: 'combination', dec: 'decomposition', sub: 'substitution', exch: 'exchange', redox: 'redox', neut: 'neutralization', burn: 'combustion', hydr: 'hydrolysis', poly: 'polymerization', other: 'other' };

const corpusRange = new Map();
for (const ch of corpus) {
  const id = `${ch.chapterId}-${ch.sectionId}`;
  const r = corpusRange.get(id) ?? { ps: Infinity, pe: 0, chapterId: ch.chapterId };
  r.ps = Math.min(r.ps, ch.pageStart);
  r.pe = Math.max(r.pe, ch.pageEnd);
  corpusRange.set(id, r);
}
const half = Math.ceil(sectionsList.length / 2);
const part2 = sectionsList.slice(half);

const sections = [];
for (const s of part2) {
  const d = DATA[s.id];
  if (!d) { errors.push(`missing data for section ${s.id}`); continue; }
  const range = corpusRange.get(s.id);
  const sec = { id: s.id, searchFrom: range.ps - 1, searchTo: range.pe + 1 };

  // reactions
  const reactions = d.rx.map((r, i) => {
    const what = `reaction #${i + 1} ${r.e}`;
    let hit = null;
    if (r.b) hit = locate(sec, r.p, [r.k, r.b], what);
    else hit = locate(sec, r.p, [r.k], what);
    let equationAsInBook = r.b ? (hit && !r.k ? hit.match : r.b) : null;
    if (r.b && r.k) {
      const exact = [r.p, r.p - 1, r.p + 1].map((pg) => findOnPage(pg, r.b)).find(Boolean);
      if (exact) equationAsInBook = exact.match;
      else warnings.push(`${s.id}: equationAsInBook not found verbatim: ${r.b}`);
    }
    let reactants;
    let products;
    let balanced = null;
    const arrowCond = r.c ? `→[${r.c}]` : null;
    if (r.gen) {
      reactants = r.R.map((n) => ({ formula: null, name: n, coeff: 1 }));
      products = r.P.map((n) => ({ formula: null, name: n, coeff: 1 }));
    } else {
      const p = parseEquation(r.e);
      if (!p) { errors.push(`${s.id}: cannot parse ${r.e}`); return null; }
      reactants = p.reactants;
      products = p.products;
      const L = sumSide(reactants);
      const R = sumSide(products);
      if (!L || !R) errors.push(`${s.id}: unparseable formula in ${r.e}`);
      else {
        balanced = compKey(L) === compKey(R);
        if (!balanced) errors.push(`${s.id}: UNBALANCED ${r.e}  L=${compKey(L)} R=${compKey(R)}`);
      }
    }
    let equation = r.e;
    if (arrowCond && !r.gen) equation = r.e.replace(ARROW, (m0, a) => ` ${a === '=' ? '→' : a}[${r.c}] `);
    let bankId = null;
    if (!r.gen) bankId = bankBySig.get(speciesSignature(reactants, products)) ?? null;
    const out = {
      equationAsInBook,
      equation,
      reactants,
      products,
      conditions: r.c ?? null,
      type: TYPE[r.t],
      isGeneralScheme: !!r.gen,
      isIonic: !!r.ionic,
      ...(r.inf ? { inferred: true } : {}),
      ...(r.ex ? { fromExercise: true } : {}),
      page: hit?.page ?? r.p,
      quote: hit ? quoteAround(hit) : null,
      balanced,
      bankId,
      ...(r.n ? { note: r.n } : {}),
    };
    return out;
  }).filter(Boolean);

  // substances
  let subs = d.subs.map(([formula, nameRu, kind, role, page, o = {}]) => {
    const what = `substance ${formula ?? nameRu}`;
    const keys = o.k ? [o.k] : [nameRu && nameRu.split(' (')[0], formula];
    const hit = locate(sec, page, keys, what);
    const f = formula ?? null;
    const mapF = f ?? o.fi ?? null;
    return {
      formula: f,
      formulaUnicode: toUnicode(f),
      ...(o.fi ? { formulaInferred: o.fi, formulaInferredUnicode: toUnicode(o.fi) } : {}),
      nameRu: nameRu ?? null,
      kind: KIND[kind],
      role: ROLE[role],
      page: hit?.page ?? page,
      quote: hit ? quoteAround(hit) : null,
      catalogId: null,
      ...mapCatalog(mapF, nameRu, kind),
      ...(o.mix ? { isMixture: true } : {}),
      ...(o.note ? { note: o.note } : {}),
    };
  });
  for (const x of subs) if (x.catalogId === undefined) x.catalogId = null;

  // merge name-only entries into formula entries of the same substance (book both names and writes it)
  const merged = [];
  for (const x of subs) {
    if (!x.formula && x.formulaInferred) {
      const target = subs.find((y) => y.formula && y.formula === x.formulaInferred && !y.nameRu && !y._mergedName);
      if (target && !x.isMixture) {
        target.nameRu = x.nameRu;
        target._mergedName = true;
        if (ROLE_RANK[x.role] > ROLE_RANK[target.role]) target.role = x.role;
        if (x.page < target.page) { target.namePage = x.page; }
        target.nameQuote = x.quote;
        if (x.note) target.note = [target.note, x.note].filter(Boolean).join('; ');
        continue;
      }
    }
    merged.push(x);
  }
  subs = merged.map(({ _mergedName, ...rest }) => rest);

  // auto-add formulas printed in book equations but missing from the list
  const known = new Set(subs.flatMap((x) => [x.formula, x.formulaInferred].filter(Boolean)).map((f) => compKey(parseFormula(f))));
  for (const r of reactions) {
    if (!r.equationAsInBook || r.isGeneralScheme) continue;
    const bookFolded = fold(r.equationAsInBook.replace(/\s+/g, ''));
    for (const t of [...r.reactants, ...r.products]) {
      const k = compKey(parseFormula(t.formula));
      if (known.has(k)) continue;
      const fk = fold(t.formula.replace(/\s+/g, ''));
      const re = new RegExp(`(^|[^a-zа-я)\\]])${fk.replace(/[()[\]]/g, '\\$&')}(?![a-z0-9(])`);
      if (!re.test(bookFolded)) continue;
      known.add(k);
      const inReact = r.reactants.includes(t);
      subs.push({
        formula: t.formula,
        formulaUnicode: toUnicode(t.formula),
        nameRu: null,
        kind: 'other',
        role: inReact ? 'reagent' : 'obtained',
        page: r.page,
        quote: r.quote,
        catalogId: null,
        ...mapCatalog(t.formula, null, null),
        autoAdded: true,
      });
      warnings.push(`${s.id}: auto-added ${t.formula} from "${r.equationAsInBook}" (set kind!)`);
    }
  }
  for (const x of subs) if (x.catalogId === undefined) x.catalogId = null;

  sections.push({
    sectionId: s.id,
    chapterId: range.chapterId,
    kp: s.kp,
    title: s.title,
    pageStart: range.ps,
    pageEnd: range.pe,
    substances: subs,
    reactions,
    labWorks: d.labs.map((l) => ({ title: l.title, page: l.page, substances: l.subs })),
  });
}

// ─────────────── stats + write
const allSubs = sections.flatMap((s) => s.substances);
const allRx = sections.flatMap((s) => s.reactions);
const uniq = (arr) => [...new Set(arr)];
const stats = {
  sections: sections.length,
  substances: allSubs.length,
  uniqueFormulasWritten: uniq(allSubs.map((x) => x.formula).filter(Boolean)).length,
  uniqueFormulasInclInferred: uniq(allSubs.map((x) => x.formula ?? x.formulaInferred).filter(Boolean)).length,
  nameOnlySubstances: allSubs.filter((x) => !x.formula).length,
  substancesMappedToCatalog: allSubs.filter((x) => x.catalogId).length,
  uniqueCatalogIds: uniq(allSubs.map((x) => x.catalogId).filter(Boolean)).length,
  reactions: allRx.length,
  reactionsPrintedInBook: allRx.filter((r) => !r.inferred && !r.fromExercise).length,
  reactionsFromExercises: allRx.filter((r) => r.fromExercise).length,
  reactionsInferredFromText: allRx.filter((r) => r.inferred).length,
  generalSchemes: allRx.filter((r) => r.isGeneralScheme).length,
  reactionsMappedToBank: allRx.filter((r) => r.bankId).length,
  reactionsWithBookErrorFixed: allRx.filter((r) => /ошибка в книге/.test(r.note ?? '')).length,
  labWorks: sections.reduce((n, s) => n + s.labWorks.length, 0),
};
const out = {
  grade: 7,
  part: 2,
  source: {
    book: 'Kimyo 7 (рус.), Ташкент 2022',
    pdf: 'public/textbooks/kimyo-7-ru-2022.pdf',
    split: `kb-sections.json g7: ${sectionsList.length} sections; part 2 = sections ${half + 1}..${sectionsList.length}`,
    pages: `${sections[0]?.pageStart}-${sections[sections.length - 1]?.pageEnd}`,
    notes: [
      'formula = formula printed in the book (null if only a name); formulaInferred = unambiguous formula for a name-only mention (for mapping).',
      'inferred = reaction described in words / lab instruction, equation not printed; fromExercise = equation completed from an exercise.',
      'quote = text cut from the pdftotext page layer (whitespace normalized).',
      'catalogId refers to compoundById (catalogSource "compounds") or ORGANIC_MOLECULES (catalogSource "organic"); simple substances carry element.',
    ],
  },
  stats,
  sections,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 1));
console.log(`warnings: ${warnings.length}`);
for (const w of warnings) console.log('  W', w);
console.log(`errors: ${errors.length}`);
for (const e of errors) console.log('  E', e);
