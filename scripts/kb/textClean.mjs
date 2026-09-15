// Text repair / normalisation helpers shared by the KB build scripts.

const CP1251_HIGH =
  'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї' +
  'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';

/** Map one Latin-1 code point (U+0080..U+00FF) to the cp1251 character with the same byte. */
export function latin1ToCp1251Char(ch) {
  const code = ch.charCodeAt(0);
  if (code < 0x80 || code > 0xff) return ch;
  return CP1251_HIGH[code - 0x80] || ch;
}

// Latin-1 letters that a broken font map emits instead of Cyrillic (plus ¨ ¸ ¹ used for Ё ё №).
const GARBLED_CHARS = 'À-ÿ¨¸';
const GARBLED_RE = new RegExp(`[${GARBLED_CHARS}]`);
const WORD_RE = new RegExp(`[\\p{L}${GARBLED_CHARS}]+`, 'gu');

/**
 * Repair words whose Cyrillic letters came out as Latin-1 look-alikes (grade 8 book).
 * Only words that contain such characters are touched; a lone × or ÷ between numbers stays.
 */
export function repairCp1251(str) {
  if (!GARBLED_RE.test(str) && !str.includes('¹')) return str;
  let out = str.replace(WORD_RE, (word) => {
    if (!GARBLED_RE.test(word)) return word;
    if (/^[×÷]$/.test(word)) return word; // × ÷ as operators
    return [...word].map((c) => (GARBLED_RE.test(c) ? latin1ToCp1251Char(c) : c)).join('');
  });
  out = out.replace(/¹(?=\s*\d)/g, '№');
  return out;
}

/** Count characters that look like an unrepaired Latin-1 → cp1251 font-map problem. */
export function countGarbled(text) {
  const m = text.match(/[À-ÖØ-öø-ÿ]/g);
  return m ? m.length : 0;
}

/** Latin letters that are visually identical to Cyrillic ones, used inside Cyrillic words. */
const LAT_TO_CYR = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х' };

/** Fix mixed-script words (Cyrillic word containing Latin look-alikes, e.g. "Kремний", "METAЛЛЫ"). */
export function fixMixedScript(text) {
  return text.replace(/[A-Za-zЀ-ӿ]+/g, (w) => {
    const cyr = (w.match(/[Ѐ-ӿ]/g) || []).length;
    const lat = w.length - cyr;
    if (!cyr || !lat) return w;
    if (cyr < lat) return w; // mostly Latin: leave (formula/label)
    return [...w].map((c) => LAT_TO_CYR[c] || c).join('');
  });
}

/** Unicode sub/superscript digits → ASCII (keeps formulas searchable). */
const SUBSUP = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '₊': '+', '₋': '-',
};

/** General whitespace / punctuation normalisation. ё is normalised to е (as the retrieval side folds it). */
export function normalizeText(text, { foldYo = true } = {}) {
  let t = text
    // eslint-disable-next-line no-control-regex -- stray control characters from PDF text layers
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/[\ue000-\uf8ff]/g, ' ')
    .replace(/[\u2080-\u2089\u2070-\u2079\u207a\u207b\u208a\u208b\u00b9\u00b2\u00b3]/g, (c) => SUBSUP[c] || c)
    .replace(/[\u2010\u2011\u2012]/g, '-')
    .replace(/\u2026/g, '...')
    // "H2 + F2→2HF": reaction arrows stand apart so formulas stay separate tokens
    .replace(/[ \t]*([\u2192\u21c4\u2194\u21cc])[ \t]*/g, ' $1 ')
    .replace(/(→|⇄|↔|⇌)(?:[ \t]*\1)+/g, '$1')
    .replace(/[ \t]+/g, ' ');
  if (foldYo) t = t.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  return t;
}
