/**
 * «Нарисуй …» в чате (контракт G): только повелительная форма В НАЧАЛЕ фразы. Вопросы «как нарисовать …»,
 * «нарисовал ли …» и упоминания в середине предложения — не просьба нарисовать.
 * Сейчас — только экспорт и тесты; перехват в /chat подключается отдельно (после слияния веток диалога).
 */

const LEAD = String.raw`^\s*(?:(?:пожалуйста|please|iltimos|а|ну|давай|можешь|можете|could you|can you|would you)[\s,]+)*`

const RU = new RegExp(
  LEAD +
    String.raw`(?:нарисуй(?:те)?|изобрази(?:те)?|покажи(?:те)? (?:картинк\S*|рисун\S*|изображени\S*)|сделай(?:те)? (?:картинк\S*|рисун\S*|изображени\S*|иллюстраци\S*)|сгенерируй(?:те)? (?:картинк\S*|изображени\S*|рисун\S*)|набросай(?:те)?)(?=[\s,:.!]|$)`,
  'iu',
)
/** uz: глагол обычно в конце («kolbani chizing»), реже в начале («rasm chizib bering: …»). */
const UZ_VERB = String.raw`(?:chiz(?:ing|ib\s+ber(?:ing)?|gin|ib\s+koʻrsat(?:ing)?)|tasvirla(?:ng|b\s+ber(?:ing)?))`
const UZ_END = new RegExp(String.raw`(?:^|\s)(?:rasm(?:ini|ni|i)?\s+)?` + UZ_VERB + String.raw`\s*[.!]?\s*$`, 'iu')
const UZ_START = new RegExp(LEAD + String.raw`(?:rasm(?:ini|ni)?\s+)?` + UZ_VERB + String.raw`(?=[\s,:.!]|$)`, 'iu')
const EN = new RegExp(LEAD + String.raw`(?:draw|sketch|illustrate|paint|generate (?:an? )?(?:image|picture|illustration)|make (?:an? )?(?:image|picture|illustration)|create (?:an? )?(?:image|picture|illustration))(?=[\s,:.!]|$)`, 'iu')

/** Вопрос о том, КАК рисовать, — не просьба. */
const QUESTION = /^\s*(?:как|каким образом|можно ли|зачем|почему|how|why|can i|should i|qanday|nega|nima uchun)\b|\?\s*$/iu

export function isDrawRequest(text: string): boolean {
  // апострофы узбекского — к одному знаку (oʻ, gʻ)
  const t = text.normalize('NFC').replace(/[ʼ‘’`´']/g, 'ʻ').trim()
  if (!t || t.length > 500) return false
  if (QUESTION.test(t)) return false
  return RU.test(t) || EN.test(t) || UZ_START.test(t) || UZ_END.test(t)
}

/** Что нарисовать: фраза без глагола и вежливых слов («нарисуй, пожалуйста, колбу с водой» → «колбу с водой»). */
export function drawSubject(text: string): string {
  let t = text.normalize('NFC').replace(/[ʼ‘’`´']/g, 'ʻ').trim()
  t = t.replace(new RegExp(LEAD, 'iu'), '')
  t = t
    .replace(/^(?:нарисуй(?:те)?|изобрази(?:те)?|набросай(?:те)?|(?:покажи|сделай|сгенерируй)(?:те)?\s+(?:картинк\S*|рисун\S*|изображени\S*|иллюстраци\S*))\s*/iu, '')
    .replace(/^(?:draw|sketch|illustrate|paint|(?:generate|make|create)\s+(?:an?\s+)?(?:image|picture|illustration))\s*(?:of\s+)?/iu, '')
    .replace(new RegExp(String.raw`^(?:rasm(?:ini|ni)?\s+)?` + UZ_VERB + String.raw`\s*[:,]?\s*`, 'iu'), '')
    .replace(/\s*(?:rasm(?:ini|ni)?\s+)?(?:chiz(?:ing|ib\s+bering|ib\s+ber|gin|ib\s+koʻrsating)|tasvirla(?:ng|b\s+bering))\s*[.!]?\s*$/iu, '')
    .replace(/^[\s,:—–-]+/g, '')
    .replace(/^(?:мне|для меня|пожалуйста|please|iltimos)[\s,]+/iu, '')
    .replace(/^[\s,:—–-]+|[\s.!]+$/g, '')
  return t.slice(0, 500)
}
