/**
 * «Нарисуй …» в чате ИИ-учителя: просьба нарисовать картинку открывает диалог «Нарисовать» с темой
 * вместо обычного ответа (контракт G). Срабатывает только на повелительную форму в начале реплики:
 *   RU «нарисуй(те) / изобрази(те) …», «сделай / создай / сгенерируй / покажи (мне) картинку (с) …»;
 *   UZ «(iltimos) (menga) rasm chizing: …», «… rasmini chizib bering», «… chizing»;
 *   EN «(please) draw / sketch / paint / illustrate (me) (a) …», «generate / create / make / show an image of …».
 * Вопросы «как нарисовать / how to draw / qanday chizish» и «make a solution» (без слова «картинка») — не рисование.
 */

export type DrawLang = 'ru' | 'uz' | 'en'

export interface DrawRequest {
  /** Что нарисовать (без «пожалуйста / мне / картинку»). */
  subject: string
  lang: DrawLang
}

const PICTURE_RU = '(?:картинк[уа]|изображени[ея]|рисун(?:ок|ка)|иллюстраци[юя]|фото(?:графию)?)'
const PICTURE_EN = '(?:picture|image|illustration|drawing|diagram|photo|sketch)'
/** Узбекская буква ʻ: апостроф, ‘, ʻ, ` — как в moderation.ts. */
const Q = "['‘ʻ`’]"
/** Граница после слова (\b в JS не видит кириллицу). */
const END = '(?=[\\s,:;—–-]|$)'

/** Повелительная форма в начале (группа 1 — всё после глагола). */
const RU_DRAW = new RegExp(
  `^(?:(?:пожалуйста|плиз|а|ну)[,\\s]+)?(?:нарисуй|изобрази)(?:те)?(?:[,\\s]+(?:пожалуйста|мне|нам)${END})*(?:[,\\s]+${PICTURE_RU}${END})?(?:[,\\s]+(?:с|со|как выглядит|как выглядят)${END})?${END}(.*)$`,
  'isu',
)
const RU_MAKE = new RegExp(
  `^(?:(?:пожалуйста|плиз|а|ну)[,\\s]+)?(?:сгенерируй|сделай|создай|покажи|нарисуй)(?:те)?(?:[,\\s]+(?:пожалуйста|мне|нам)${END})*[,\\s]+${PICTURE_RU}(?:[,\\s]+(?:с|со|как выглядит|как выглядят|про|на тему)${END})?${END}(.*)$`,
  'isu',
)
const UZ_LEAD = new RegExp(
  `^(?:iltimos[,\\s]+)?(?:menga[,\\s]+)?(?:rasm|surat|tasvir)(?:ini|ni|i)?[,\\s]+(?:chiz(?:ing|ib\\s+ber(?:ing)?)?|yarat(?:ing)?|tayyorla(?:ng)?|ko${Q}?rsat(?:ing)?)(?:[,\\s]+iltimos)?${END}(.*)$`,
  'isu',
)
/** Объект впереди: «Kipp apparati(ni) (rasmini) chiz(ing | ib bering)» — только глагол chiz («eritma tayyorlang» — не рисунок). */
const UZ_TAIL = new RegExp(
  `^(?:iltimos[,\\s]+)?(?:menga[,\\s]+)?(.+?)[,\\s]+(?:(?:rasm|surat|tasvir)(?:ini|ni)?[,\\s]+)?chiz(?:ing|ib\\s+ber(?:ing)?)?(?:[,\\s]+iltimos)?[\\s.!…]*$`,
  'isu',
)
const EN_DRAW = new RegExp(`^(?:please[,\\s]+)?(?:draw|sketch|paint|illustrate)(?:\\s+(?:me|us)${END})?(?:\\s+(?:an?|the|some)${END})?${END}(.*)$`, 'isu')
const EN_MAKE = new RegExp(
  `^(?:please[,\\s]+)?(?:generate|create|make|show|render)(?:\\s+(?:me|us))?(?:\\s+(?:an?|the|some))?\\s+${PICTURE_EN}s?(?:\\s+(?:of|showing|with|about))?${END}(.*)$`,
  'isu',
)

/** Вопрос «как нарисовать», «можно нарисовать?» — не просьба нарисовать. */
const QUESTION = /^(?:как|каким образом|зачем|почему|можно ли|можешь ли|умеешь ли|how|why|can you|could you|qanday|nega|nima uchun)(?=[\s,?!.]|$)/iu
/**
 * Это просьба к учителю, а не картинка: «draw a conclusion», «нарисуй структурную формулу / график / уравнение» —
 * формулы и графики модель картинок рисует неверно, их объясняет чат (а формулы на картинку накладывает сайт).
 */
const NOT_PICTURE =
  /^(?:(?:an?|the)\s+)?(?:conclusions?|lewis|structures?|structural|formulas?|formulae|equations?|graphs?|charts?|parallels?|attention|формул|структурн|график|уравнени|вывод|formula|grafik|tenglama|xulosa)/iu

function cleanSubject(rest: string, lang: DrawLang): string {
  let s = rest.replace(/^[\s,:;—–-]+/u, '').replace(/[\s.!?…]+$/u, '').trim()
  if (lang === 'ru') {
    s = s.replace(/^(?:(?:пожалуйста|мне|нам)(?:[,\s]+|$))+/iu, '').replace(/[,\s]+пожалуйста$/iu, '')
    s = s.replace(new RegExp(`^${PICTURE_RU}(?:[,\\s]+(?:с|со))?\\s+`, 'iu'), '')
  } else if (lang === 'en') {
    s = s.replace(/^(?:(?:please|me|us|an?|the)(?:[,\s]+|$))+/iu, '').replace(/[,\s]+please$/iu, '')
    s = s.replace(new RegExp(`^${PICTURE_EN}s?\\s+(?:of\\s+)?`, 'iu'), '')
  } else {
    s = s.replace(/^(?:(?:iltimos|menga)(?:[,\s]+|$))+/iu, '').replace(/[,\s]+iltimos$/iu, '')
  }
  return s.trim()
}

/** Остаток пригоден как тема: ≥ 3 символов, есть буквы/цифры и это не «формула / график / вывод». */
function okSubject(s: string): boolean {
  return s.length >= 3 && /[\p{L}\p{N}]/u.test(s) && !NOT_PICTURE.test(s)
}

/** Узбекский винительный падеж темы перед глаголом: «kislotani» → «kislota» (только у последнего слова). */
function uzStripAccusative(s: string): string {
  return s.replace(/(\p{L}{3,})ni$/u, '$1')
}

/** «Нарисуй …» → {subject, lang} | null. locale — язык интерфейса (сейчас язык берётся из самой фразы). */
export function parseDrawRequest(text: string, locale?: string): DrawRequest | null {
  void locale
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length < 5 || t.length > 600) return null
  if (QUESTION.test(t)) return null

  const tries: [RegExp, DrawLang][] = [
    [RU_MAKE, 'ru'],
    [RU_DRAW, 'ru'],
    [EN_MAKE, 'en'],
    [EN_DRAW, 'en'],
    [UZ_LEAD, 'uz'],
  ]
  for (const [re, lang] of tries) {
    const m = re.exec(t)
    if (!m) continue
    const subject = cleanSubject(m[1] ?? '', lang)
    return okSubject(subject) ? { subject, lang } : null
  }
  // узбекский порядок «объект … chizing» — только латиница
  const m = UZ_TAIL.exec(t)
  if (m && !/[а-яё]/iu.test(t)) {
    const subject = uzStripAccusative(cleanSubject(m[1] ?? '', 'uz'))
    if (okSubject(subject) && !/^(?:qanday|nima|nega)(?=\s|$)/iu.test(subject)) return { subject, lang: 'uz' }
  }
  return null
}
