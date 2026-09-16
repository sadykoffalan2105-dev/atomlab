/**
 * Fixes found while verifying the grade-11 merged inventory against rendered page images.
 * Each call is applied by g11merge-build.mjs; the resulting log is stored in inventory-g11.json -> verification.fixLog.
 */
export const VERIFICATION = {
  method: 'выборочная проверка: для каждого раздела выборки — OCR-текст страниц + рендер страниц PDF в PNG (pdfjs, масштаб 1.6–2) и сравнение со списком веществ/уравнений',
  sampledSections: [],
  pagesViewed: [],
}

export function FIXES(api) {
}
