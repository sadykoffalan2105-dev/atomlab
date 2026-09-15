/**
 * Step 1a: extract positioned text lines from the textbooks that have a text layer (grades 7–10).
 *
 * Uses pdfjs-dist text content (unicode strings + font name + transform) and rebuilds visual lines
 * (baseline clustering, sub/superscripts attached to their line). Output per grade:
 *   scripts/kb/.cache/lines-g{grade}.json  →  [{ page, width, height, lines: [{ t, x0, x1, y, s, b, i }] }]
 * t = text, x0/x1 = horizontal extent, y = baseline from the top (pt), s = font size, b = bold, i = italic.
 *
 * Grade 8 font-map repair (Latin-1 look-alikes → cp1251 Cyrillic) happens here, per text item.
 *
 * Usage: node scripts/kb/extract-text.mjs [grades...] [--force]   (default 7 8 9 10; skips grades whose cache is newer than the PDF and this script)
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, CACHE_DIR, ROOT } from './kbConfig.mjs';
import { repairCp1251 } from './textClean.mjs';

const grades = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number).filter(Boolean);
const todo = grades.length ? grades : [7, 8, 9, 10];

function fontFlags(name) {
  const n = name || '';
  return {
    bold: /bold|black|heavy|semibold|demi/i.test(n),
    italic: /italic|oblique/i.test(n),
  };
}

function buildLines(items, pageHeight) {
  // Keep horizontal, non-empty items.
  const toks = [];
  for (const it of items) {
    if (!it.str) continue;
    const [a, b, c, d, e, f] = it.transform;
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue; // rotated text (margin labels)
    const size = Math.hypot(c, d) || Math.abs(d) || 1;
    if (a < 0 || d < 0) continue;
    toks.push({
      str: it.str,
      x0: e,
      x1: e + (it.width || 0),
      y: pageHeight - f, // baseline from top
      size,
      bold: it.bold,
      italic: it.italic,
    });
  }
  if (!toks.length) return [];
  const sizes = toks.filter((t) => t.str.trim()).map((t) => t.size).sort((p, q) => p - q);
  const bodySize = sizes[Math.floor(sizes.length / 2)] || 10;

  // Pass 1: lines from normal-size tokens.
  const main = toks.filter((t) => t.size >= bodySize * 0.78 || !t.str.trim());
  const small = toks.filter((t) => !(t.size >= bodySize * 0.78 || !t.str.trim()));
  main.sort((p, q) => p.y - q.y || p.x0 - q.x0);
  const lines = [];
  for (const t of main) {
    let best = null;
    let bestD = Infinity;
    for (let k = lines.length - 1; k >= 0 && k >= lines.length - 6; k -= 1) {
      const L = lines[k];
      const dy = Math.abs(L.y - t.y);
      const tol = 0.35 * Math.max(L.size, t.size);
      if (dy <= tol && dy < bestD) {
        best = L;
        bestD = dy;
      }
    }
    if (best) best.toks.push(t);
    else lines.push({ y: t.y, size: t.size, toks: [t] });
  }
  // A line may start with a blank item set on a different baseline: measure sub/superscripts against the
  // median baseline of the line's visible glyphs (else "H₂ + F₂" subscripts jump to the next text line).
  for (const L of lines) {
    const vis = L.toks.filter((q) => q.str.trim());
    if (!vis.length) continue;
    const ys = vis.map((q) => q.y).sort((p, q) => p - q);
    L.base = ys[Math.floor(ys.length / 2)];
    L.size = Math.max(...vis.map((q) => q.size));
  }
  // Pass 2: attach sub/superscripts to nearest line horizontally overlapping. A pass-1 line can hold two
  // columns on slightly different baselines, so measure against the glyph right before/after the script.
  const anchorY = (L, t) => {
    let bestQ = null;
    let bestGap = Infinity;
    for (const q of L.toks) {
      if (!q.str.trim()) continue;
      const gap = q.x1 <= t.x0 + 2 ? t.x0 - q.x1 : q.x0 >= t.x1 - 2 ? q.x0 - t.x1 : 0;
      if (gap > L.size * 1.5) continue;
      if (gap < bestGap) {
        bestGap = gap;
        bestQ = q;
      }
    }
    return bestQ ? bestQ.y : (L.base ?? L.y);
  };
  for (const t of small) {
    let best = null;
    let bestD = Infinity;
    for (const L of lines) {
      const dy = t.y - anchorY(L, t); // positive → below baseline (subscript)
      if (dy > 0.55 * L.size || dy < -0.75 * L.size) continue;
      const minX = Math.min(...L.toks.map((q) => q.x0)) - L.size * 2;
      const maxX = Math.max(...L.toks.map((q) => q.x1)) + L.size * 2;
      if (t.x0 < minX || t.x0 > maxX) continue;
      const dd = Math.abs(dy);
      if (dd < bestD) {
        best = L;
        bestD = dd;
      }
    }
    if (best) best.toks.push({ ...t, script: true });
    else lines.push({ y: t.y, size: t.size, toks: [t] });
  }
  // Split each visual line into segments at wide gaps (sidebars, table cells, side-by-side boxes).
  const segs = [];
  for (const L of lines) {
    L.toks.sort((p, q) => p.x0 - q.x0);
    let cur = [];
    let right = -Infinity;
    for (const t of L.toks) {
      const isBlank = !t.str.trim();
      if (cur.length && !isBlank && !t.script && t.x0 - right > 1.0 * L.size) {
        segs.push(makeSeg(cur, L));
        cur = [];
      }
      cur.push(t);
      if (!isBlank) right = Math.max(right, t.x1);
    }
    if (cur.length) segs.push(makeSeg(cur, L));
  }
  const good = segs.filter((s) => s && s.t);
  const ordered = [];
  xyCut(good, bodySize, ordered, { blk: 0 });
  return ordered;
}

/**
 * Some books fake bold type by printing the same string 2–3 times at (almost) the same position,
 * which would come out as "1,4291,4291,429 ггг ///". Keep only the first copy.
 */
function dropOverprints(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const str = it.str;
    if (!str || !str.trim()) {
      out.push(it);
      continue;
    }
    const x = Math.round(it.transform[4]);
    const y = Math.round(it.transform[5]);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx += 1) {
      for (let dy = -1; dy <= 1 && !dup; dy += 1) {
        if (seen.has(`${str}|${x + dx}|${y + dy}`)) dup = true;
      }
    }
    if (dup) continue;
    seen.add(`${str}|${x}|${y}`);
    out.push(it);
  }
  return out;
}

function makeSeg(toks, L) {
  let text = '';
  let prev = null;
  let boldChars = 0;
  let italicChars = 0;
  let chars = 0;
  for (const t of toks) {
    if (!t.str.trim() && t.x1 - t.x0 < 0.15 * L.size) {
      // zero-width space glyphs mark discretionary breaks inside words in some books
      continue;
    }
    if (prev) {
      const gap = t.x0 - prev.x1;
      const needSpace = gap > 0.2 * Math.min(L.size, t.size) && !/\s$/.test(text) && !/^\s/.test(t.str);
      if (needSpace && !(t.script && gap < 0.6 * L.size)) text += ' ';
    }
    text += t.str;
    const n = t.str.replace(/\s/g, '').length;
    chars += n;
    if (t.bold) boldChars += n;
    if (t.italic) italicChars += n;
    if (t.str.trim()) prev = prev && prev.x1 > t.x1 ? prev : t;
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const vis = toks.filter((t) => t.str.trim());
  const mainToks = vis.filter((t) => !t.script);
  const sz = mainToks.length ? Math.max(...mainToks.map((t) => t.size)) : L.size;
  return {
    t: clean,
    x0: +Math.min(...vis.map((t) => t.x0)).toFixed(1),
    x1: +Math.max(...vis.map((t) => t.x1)).toFixed(1),
    y: +L.y.toFixed(1),
    s: +sz.toFixed(1),
    b: chars > 0 && boldChars / chars > 0.6 ? 1 : 0,
    i: chars > 0 && italicChars / chars > 0.6 ? 1 : 0,
  };
}

/** Recursive XY-cut: vertical gutters first (columns / sidebars), then paragraph-sized horizontal gaps. */
function xyCut(segs, body, out, state, depth = 0) {
  if (!segs.length) return;
  const top = (s) => s.y - 0.85 * s.s;
  const bot = (s) => s.y + 0.25 * s.s;
  if (segs.length > 3 && depth < 30) {
    // vertical gutter
    const byX = [...segs].sort((p, q) => p.x0 - q.x0);
    let reach = byX[0].x1;
    let bestCut = null;
    for (let k = 1; k < byX.length; k += 1) {
      const gap = byX[k].x0 - reach;
      if (gap >= Math.max(8, 0.9 * body)) {
        const left = byX.slice(0, k);
        const rightSide = byX.slice(k);
        if (left.length >= 2 && rightSide.length >= 2) {
          const lTop = Math.min(...left.map(top));
          const lBot = Math.max(...left.map(bot));
          const rTop = Math.min(...rightSide.map(top));
          const rBot = Math.max(...rightSide.map(bot));
          const overlap = Math.min(lBot, rBot) - Math.max(lTop, rTop);
          const minSpan = Math.min(lBot - lTop, rBot - rTop);
          if (overlap > 0.5 * minSpan && (!bestCut || gap > bestCut.gap)) bestCut = { gap, left, right: rightSide };
        }
      }
      reach = Math.max(reach, byX[k].x1);
    }
    if (bestCut) {
      xyCut(bestCut.left, body, out, state, depth + 1);
      state.blk += 1;
      xyCut(bestCut.right, body, out, state, depth + 1);
      state.blk += 1;
      return;
    }
    // horizontal bands at paragraph-sized gaps
    const byY = [...segs].sort((p, q) => top(p) - top(q));
    const bands = [];
    let band = [byY[0]];
    let bottom = bot(byY[0]);
    for (let k = 1; k < byY.length; k += 1) {
      const s = byY[k];
      if (top(s) - bottom >= 0.55 * body) {
        bands.push(band);
        band = [];
      }
      band.push(s);
      bottom = Math.max(bottom, bot(s));
    }
    bands.push(band);
    if (bands.length > 1) {
      for (const b of bands) {
        xyCut(b, body, out, state, depth + 1);
      }
      return;
    }
  }
  // leaf: merge segments sharing a baseline
  const rows = [];
  for (const s of [...segs].sort((p, q) => p.y - q.y || p.x0 - q.x0)) {
    const row = rows.find((r) => Math.abs(r.y - s.y) <= 0.35 * Math.max(r.s, s.s));
    if (row) row.parts.push(s);
    else rows.push({ y: s.y, s: s.s, parts: [s] });
  }
  rows.sort((p, q) => p.y - q.y);

  // Column runs: consecutive rows that share a free vertical gutter (e.g. main text + sidebar)
  if (rows.length >= 3 && depth < 30) {
    const minX = Math.min(...segs.map((s) => s.x0));
    const maxX = Math.max(...segs.map((s) => s.x1));
    const thr = Math.max(8, 0.9 * body);
    const freeOf = (row) => {
      const iv = row.parts.map((p) => [p.x0, p.x1]).sort((a, b) => a[0] - b[0]);
      const free = [];
      let cur = minX;
      for (const [a, b] of iv) {
        if (a - cur >= thr) free.push([cur, a]);
        cur = Math.max(cur, b);
      }
      if (maxX - cur >= thr) free.push([cur, maxX]);
      return free;
    };
    const intersect = (A, B) => {
      const out2 = [];
      for (const [a0, a1] of A) for (const [b0, b1] of B) {
        const lo = Math.max(a0, b0);
        const hi = Math.min(a1, b1);
        if (hi - lo >= thr) out2.push([lo, hi]);
      }
      return out2;
    };
    const runs = [];
    let run = null;
    for (const r of rows) {
      const f = freeOf(r);
      if (run) {
        const inner = intersect(run.free, f).filter(([lo, hi]) => lo > minX + 1 && hi < maxX - 1);
        if (inner.length) {
          run.rows.push(r);
          run.free = inner;
          continue;
        }
        runs.push(run);
      }
      run = { rows: [r], free: f };
    }
    if (run) runs.push(run);
    const splittable = runs.some((R) => {
      if (R.rows.length < 3) return false;
      const inner = R.free.filter(([lo, hi]) => lo > minX + 1 && hi < maxX - 1);
      return inner.length > 0;
    });
    if (splittable && runs.length < rows.length) {
      let pendingBump = false;
      for (const R of runs) {
        const inner = R.free.filter(([lo, hi]) => lo > minX + 1 && hi < maxX - 1);
        const partsAll = R.rows.flatMap((r) => r.parts);
        if (R.rows.length >= 3 && inner.length) {
          const [lo, hi] = inner.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
          const cut = (lo + hi) / 2;
          const left = partsAll.filter((p) => p.x1 <= cut);
          const right = partsAll.filter((p) => p.x1 > cut);
          if (left.length >= 2 && right.length >= 2) {
            if (pendingBump) { state.blk += 1; pendingBump = false; }
            emitRows(left, out, state);
            emitRows(right, out, state);
            continue;
          }
        }
        emitRows(partsAll, out, state, false);
        pendingBump = true;
      }
      if (pendingBump) state.blk += 1;
      return;
    }
  }
  emitRows(segs, out, state);
}

function emitRows(segs, out, state, bump = true) {
  const rows = [];
  for (const s of [...segs].sort((p, q) => p.y - q.y || p.x0 - q.x0)) {
    const row = rows.find((r) => Math.abs(r.y - s.y) <= 0.35 * Math.max(r.s, s.s));
    if (row) row.parts.push(s);
    else rows.push({ y: s.y, s: s.s, parts: [s] });
  }
  rows.sort((p, q) => p.y - q.y);
  for (const r of rows) {
    r.parts.sort((p, q) => p.x0 - q.x0);
    const chars = r.parts.reduce((n, p) => n + p.t.length, 0);
    out.push({
      t: r.parts.map((p) => p.t).join('   '),
      x0: r.parts[0].x0,
      x1: Math.max(...r.parts.map((p) => p.x1)),
      y: r.y,
      s: Math.max(...r.parts.map((p) => p.s)),
      b: r.parts.reduce((n, p) => n + (p.b ? p.t.length : 0), 0) / chars > 0.6 ? 1 : 0,
      i: r.parts.reduce((n, p) => n + (p.i ? p.t.length : 0), 0) / chars > 0.6 ? 1 : 0,
      blk: state.blk,
    });
  }
  if (bump) state.blk += 1;
}

export { buildLines, dropOverprints };

const force = process.argv.includes('--force');
const toolMtime = Math.max(
  ...['extract-text.mjs', 'textClean.mjs', 'kbConfig.mjs'].map((f) => fs.statSync(new URL(f, import.meta.url)).mtimeMs),
);
const isMain = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) fs.mkdirSync(CACHE_DIR, { recursive: true });

for (const grade of isMain ? todo : []) {
  const book = BOOKS[grade];
  const t0 = Date.now();
  const outFile0 = path.join(CACHE_DIR, `lines-g${grade}.json`);
  if (!force && fs.existsSync(outFile0)) {
    const cacheMtime = fs.statSync(outFile0).mtimeMs;
    if (cacheMtime > toolMtime && cacheMtime > fs.statSync(path.join(ROOT, book.pdf)).mtimeMs) {
      console.log(`[extract] g${grade}: cache is up to date (use --force to re-extract)`);
      continue;
    }
  }
  const data = new Uint8Array(fs.readFileSync(path.join(ROOT, book.pdf)));
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const [vx0, vy0, vx1, vy1] = page.view;
    const tc = await page.getTextContent();
    // Resolve real font names (needed for bold/italic flags).
    const fontNames = {};
    try {
      await page.getOperatorList();
    } catch {
      /* ignore */
    }
    for (const it of tc.items) {
      if (it.fontName && !(it.fontName in fontNames)) {
        try {
          fontNames[it.fontName] = page.commonObjs.get(it.fontName)?.name || '';
        } catch {
          fontNames[it.fontName] = '';
        }
      }
    }
    const items = tc.items
      .filter((it) => typeof it.str === 'string')
      .map((it) => {
        const flags = fontFlags(fontNames[it.fontName]);
        let str = it.str.replace(/­/g, '­');
        if (book.cp1251Repair) str = repairCp1251(str, fontNames[it.fontName]);
        return { ...it, str, ...flags, transform: [it.transform[0], it.transform[1], it.transform[2], it.transform[3], it.transform[4] - vx0, it.transform[5] - vy0] };
      });
    const lines = buildLines(dropOverprints(items), vy1 - vy0);
    pages.push({ page: n, width: +(vx1 - vx0).toFixed(1), height: +(vy1 - vy0).toFixed(1), lines });
    page.cleanup();
  }
  const outFile = path.join(CACHE_DIR, `lines-g${grade}.json`);
  fs.writeFileSync(outFile, JSON.stringify(pages));
  const chars = pages.reduce((s, p) => s + p.lines.reduce((q, l) => q + l.t.length, 0), 0);
  console.log(`[extract] g${grade}: ${pages.length} pages, ${chars} chars, ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(ROOT, outFile)}`);
}
