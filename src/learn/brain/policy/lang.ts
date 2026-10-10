/**
 * Язык реплики ученика (контракт «Локальный мозг» v1): ответ — на языке вопроса.
 * Определение по письменности и стоп-словам ru/uz/en; без зависимостей.
 */
export type PolicyLang = 'ru' | 'en' | 'uz'

const UZ_LATIN_STOP =
  /(?<!\p{L})(nima|nega|qanday|qaysi|qancha|nimaga|haqida|uchun|bilan|emas|yoʻq|yo'q|yo‘q|bormi|kerak|qilib|deb|va|ham|siz|sen|menga|salom|rahmat|raxmat|iltimos|tushuntir\p{L}*|farq\p{L}*|kimyo\p{L}*|modda\p{L}*|reaksiya\p{L}*|oʻ\p{L}*|o'\p{L}*|g'\p{L}*|gʻ\p{L}*)(?!\p{L})/giu
const EN_STOP =
  /(?<!\p{L})(the|what|why|how|is|are|does|do|which|when|where|who|of|and|between|difference|explain|please|hello|hi|thanks|you|can|tell|me|about)(?!\p{L})/giu
/** Узбекская кириллица: ў қ ғ ҳ — их нет в русском. */
const UZ_CYR_LETTERS = /[ўқғҳЎҚҒҲ]/u
const UZ_CYR_STOP = /(?<!\p{L})(нима|нега|қандай|қайси|учун|билан|ва|ҳам|салом|рахмат|раҳмат|кимё\p{L}*|модда\p{L}*|фарқ\p{L}*)(?!\p{L})/iu

/** Язык текста; `fallback` — когда текст пуст или неоднозначен. */
export function detectQuestionLang(text: string, fallback: PolicyLang = 'ru'): PolicyLang {
  const t = (text ?? '').trim()
  if (!t) return fallback
  const cyr = (t.match(/\p{Script=Cyrillic}/gu) ?? []).length
  const lat = (t.match(/\p{Script=Latin}/gu) ?? []).length
  if (cyr === 0 && lat === 0) return fallback
  if (cyr >= lat) {
    if (UZ_CYR_LETTERS.test(t) || UZ_CYR_STOP.test(t)) return 'uz'
    return 'ru'
  }
  const uz = (t.match(UZ_LATIN_STOP) ?? []).length
  const en = (t.match(EN_STOP) ?? []).length
  if (uz > en) return 'uz'
  if (en > uz) return 'en'
  return fallback === 'ru' ? 'en' : fallback
}

/** Нормализация для поиска: нижний регистр, ё→е, все апострофы → ' . */
export function foldForPolicy(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´]/g, "'")
}
