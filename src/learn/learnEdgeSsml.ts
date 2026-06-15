/** SSML-разметка для Edge Neural — паузы на запятых и точках. */

export function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function textToSsmlProsodyContent(text: string): string {
  const tokens = text.split(/([,.!?;:])\s*/).filter((t) => t.length > 0)
  let out = ''

  for (const token of tokens) {
    if (/^[,.!?;:]$/.test(token)) {
      const pause =
        token === ',' ? '240ms' : token === ';' || token === ':' ? '300ms' : '460ms'
      out += `${token}<break time="${pause}"/> `
      continue
    }
    out += `${escapeSsmlText(token)} `
  }

  return out.trim()
}

/** Минимальный SSML — prosody в браузерном Edge часто даёт «буквование». */
export function buildTeacherSsml(
  text: string,
  voice: string,
  _rate: string,
  _pitch: string,
  _volume: string,
  lang: string,
): string {
  const body = escapeSsmlText(text)
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voice}'>${body}</voice></speak>`
  )
}
