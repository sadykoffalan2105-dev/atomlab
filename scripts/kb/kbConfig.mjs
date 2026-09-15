// Shared paths and per-book settings for the knowledge-base build (scripts/kb/*).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(KB_DIR, '..', '..');
export const CACHE_DIR = path.join(KB_DIR, '.cache');
export const OUT_DIR = path.join(ROOT, 'src', 'data', 'kb');

/**
 * pdf: identical copy of the root "книга N класс" PDFs that ships with the site.
 * pageOffset: printed page number = pdf page index - pageOffset (verified from page footers).
 */
export const BOOKS = {
  7: { grade: 7, pdf: 'public/textbooks/kimyo-7-ru-2022.pdf', source: 'Kimyo 7', textLayer: true },
  8: { grade: 8, pdf: 'public/textbooks/kimyo-8-ru.pdf', source: 'Kimyo 8', textLayer: true, cp1251Repair: true },
  9: { grade: 9, pdf: 'public/textbooks/kimyo-9-ru.pdf', source: 'Kimyo 9', textLayer: true },
  10: { grade: 10, pdf: 'public/textbooks/kimyo-10-ru-2022.pdf', source: 'Kimyo 10', textLayer: true },
  11: { grade: 11, pdf: 'public/textbooks/kimyo-11-ru.pdf', source: 'Kimyo 11', textLayer: false },
};

export const GRADES = [7, 8, 9, 10, 11];
