/**
 * Разбор заголовков глав и параграфов для хабов «Обучения» (только отображение).
 * Заголовки в словарях уже содержат номер («§1. …», «Глава I. …», «Ch. II. …»,
 * «III bob. …»): номер рисуем бейджем, поэтому в тексте его убираем.
 */

const SECTION_NUM_RE = /^§\s*\d+[a-zа-я]?\s*[.:)]?\s*/i

const PRACTICAL_RE =
  /^(Практическое занятие|Практическая работа|Лабораторная работа|Лабораторный опыт|Practical(?: work| lesson)?|Lab work|Amaliy mashg['ʻ’`]ulot|Laboratoriya ishi)\s*[.:—–-]?\s*/i

const CHAPTER_PREFIX_RE =
  /^((?:Глава|Раздел|Chapter|Ch\.|Bob)\s+[IVXLC\d]+|[IVXLC\d]+\s*-?\s*bob)\s*[.:—–-]?\s*/i

export type SectionTitleParts = {
  /** Заголовок без «§N.» (и без метки практикума). */
  title: string
  /** Метка практического/лабораторного занятия из самого заголовка, если есть. */
  practicalLabel: string | null
}

export function splitSectionTitle(raw: string): SectionTitleParts {
  const noNum = raw.replace(SECTION_NUM_RE, '').trim()
  const m = PRACTICAL_RE.exec(noNum)
  if (!m) return { title: noNum || raw, practicalLabel: null }
  const label = m[1]!.trim()
  const rest = noNum.slice(m[0].length).trim()
  return { title: rest || label, practicalLabel: label }
}

export type ChapterTitleParts = {
  /** «Глава I» / «Ch. II» / «III bob» — как в словаре; null, если префикса нет. */
  prefix: string | null
  title: string
}

export function splitChapterTitle(raw: string): ChapterTitleParts {
  const m = CHAPTER_PREFIX_RE.exec(raw)
  if (!m) return { prefix: null, title: raw }
  const rest = raw.slice(m[0].length).trim()
  return { prefix: m[1]!.trim(), title: rest || raw }
}

const ROMAN: readonly [number, string][] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
]

export function toRoman(n: number): string {
  let v = Math.max(1, Math.floor(n))
  if (v >= 40) return String(v)
  let out = ''
  for (const [k, s] of ROMAN) {
    while (v >= k) {
      out += s
      v -= k
    }
  }
  return out
}

/** «g7» → «7». */
export function gradeNumber(gradeId: string): string {
  return gradeId.replace(/\D/g, '') || gradeId
}

export function percent(done: number, total: number): number {
  if (!total) return 0
  return Math.round((done / total) * 100)
}
