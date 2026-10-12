/**
 * Ссылка на печатную единицу учебника в вопросе: «что в §12 Kimyo 8», «8-sinf 12-§ nima haqida», «расскажи параграф 25
 * за 8 класс», «тема 2.6 7 класс», «Kimyo 7, 2-bob 6-mavzu», «section 12 grade 8». Без явного маркера (§, параграф, тема,
 * mavzu, bob, глава, section) — null: «pH 12», «12 г», «8 класс» ссылкой на § не считаются.
 * Класс — из «Kimyo N» / «N класс» / «N-sinf» / «grade N»; нет в тексте — его подставляет поиск (класс ученика).
 * Для 7 и 10 кл. номер собирается как «глава.тема» (римские главы I–VIII → 1–8).
 * Свой регекс класса (не GRADE_HINT_RE из intent.ts) — чтобы карта не зависела от файлов диалога.
 */
import type { Lang } from '../pipeline/normalize.ts'

export type SectionRef = { grade?: number; kp?: string; chapter?: number; topic?: number }

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 }
const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined
  if (/^\d+$/.test(s)) return Number(s)
  return ROMAN[s.toUpperCase()]
}

// порядок важен: «grade 11» — число после слова, «8 класс» / «8-sinf» / «8th grade» — до слова
const GRADE_RES: RegExp[] = [
  /Kimyo\s*[-–]?\s*(7|8|9|10|11)(?!\d)/iu,
  /grade\s*[-–]?\s*(7|8|9|10|11)(?!\d)/iu,
  /(?<![\d.,])(7|8|9|10|11)\s*[-–]?\s*(?:й|го|м|ом|ый)?\s*(?:класс|кл\.|sinf)/iu,
  /(?<![\d.,])(7|8|9|10|11)\s*(?:th)?\s*grade/iu,
  /(?:класс[аеу]?|sinf)\s*[-–]?\s*(7|8|9|10|11)(?!\d)/iu,
]

/** Класс 7–11 из текста или undefined. */
export function gradeFromText(text: string): number | undefined {
  for (const re of GRADE_RES) {
    const m = text.match(re)
    if (m) return Number(m[1])
  }
  return undefined
}

export function parseSectionRef(text: string, _lang?: Lang): SectionRef | null {
  const t = text.replace(/\s+/g, ' ')
  let kp: string | undefined
  let chapter: number | undefined
  let topic: number | undefined

  // «тема 2.6», «topic 2.6», «2.6-mavzu», «§2.6»
  const dotted = t.match(/(?:тем[аеуы]|topic|mavzu|§)\s*(\d)\.(\d{1,2})(?!\d)/iu) ?? t.match(/(?<![\d.,])(\d)\.(\d{1,2})\s*[-–]?\s*(?:mavzu|тема)/iu)
  if (dotted) {
    chapter = Number(dotted[1])
    topic = Number(dotted[2])
  } else {
    const para =
      t.match(/§\s*(\d{1,2})(?![\d.,]\d)/u) ??
      t.match(/(?<![\d.,])(\d{1,2})\s*[-–]?\s*§/u) ??
      t.match(/(?:параграф\p{L}*|paragraf\p{L}*|paragraph|section)\s*(?:№\s*)?(\d{1,2})(?!\d)/iu) ??
      t.match(/(?<![\d.,])(\d{1,2})\s*[-–]?\s*(?:paragraf|параграф)/iu)
    if (para) kp = para[1]
    const ch =
      t.match(/(?:глав[аеыу]|гл\.|chapter|ch\.)\s*([IVX]+|\d)(?![\d.])/iu) ??
      t.match(/(?<![\d.,])([IVX]+|\d)\s*[-–]?\s*bob/iu) ??
      t.match(/bob\s*([IVX]+|\d)(?!\d)/iu)
    if (ch) chapter = num(ch[1])
    const tp =
      // «тема 1.» в конце предложения: точка — не часть номера («…гл. 1, тема 1.» раньше не читалось)
      t.match(/(?:тем[аеуы]|topic|mavzu)\s*(?:№\s*)?(\d{1,2})(?!\d|\.\d)/iu) ??
      t.match(/(?<![\d.,])(\d{1,2})\s*[-–]?\s*(?:mavzu|тема)/iu)
    if (tp) topic = Number(tp[1])
  }
  if (!kp && chapter == null && topic == null) return null

  const grade = gradeFromText(t)
  const out: SectionRef = {}
  if (grade) out.grade = grade
  if (chapter != null) out.chapter = chapter
  if (topic != null) out.topic = topic
  // 7 и 10 кл. (и класс не назван): «глава.тема»; 8, 9, 11 — номер § (или «тема N» как §N)
  const dottedBooks = grade == null || grade === 7 || grade === 10
  if (chapter != null && topic != null && dottedBooks) out.kp = `${chapter}.${topic}`
  else if (kp) out.kp = kp
  else if (topic != null && grade != null && !dottedBooks) out.kp = String(topic)
  return out
}
