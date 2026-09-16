// Compact constructors for hand-extracted textbook entries.
// S(formula, nameRu, kind, role, page, quote, extra)
//   formula: ASCII; prefix '=' means the formula is written in the book itself;
//   no prefix = inferred by the extractor from an unambiguous name; null = no definite formula.
// R(equationAsInBook, equation, type, page, quote, extra)
//   equationAsInBook: exact text (null if reaction only described in words)
//   extra: { conditions, isGeneralScheme, isIonic, note, reactants, products }
export function S(formula, nameRu, kind, role, page, quote, extra = {}) {
  let inBook = false
  let f = formula
  if (typeof f === 'string' && f.startsWith('=')) {
    inBook = true
    f = f.slice(1)
  }
  return { formula: f, formulaInBook: f ? inBook : false, nameRu, kind, role, page, quote, ...extra }
}

export function R(equationAsInBook, equation, type, page, quote, extra = {}) {
  return { equationAsInBook, equation, type, page, quote, ...extra }
}

export function L(title, page, substances, extra = {}) {
  return { title, page, substances, ...extra }
}
