/** SSML-разметка для Edge Neural — паузы на запятых и точках. */

import { getTeacherTtsProsodyMode } from './learnTeacherVoiceProfile'

export function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type PauseStyle = 'default' | 'lab'

function pauseForToken(token: string, style: PauseStyle): string {
  if (style === 'lab') {
    // Короче default-lab: плотные cue в реакторе.
    if (token === ',') return '180ms'
    if (token === ';' || token === ':') return '220ms'
    return '320ms'
  }
  if (token === ',') return '240ms'
  if (token === ';' || token === ':') return '300ms'
  return '460ms'
}

export function textToSsmlProsodyContent(text: string, style?: PauseStyle): string {
  const pauseStyle = style ?? (getTeacherTtsProsodyMode() === 'lab' ? 'lab' : 'default')
  const tokens = text.split(/([,.!?;:])\s*/).filter((t) => t.length > 0)
  let out = ''

  for (const token of tokens) {
    if (/^[,.!?;:]$/.test(token)) {
      out += `${token}<break time="${pauseForToken(token, pauseStyle)}"/> `
      continue
    }
    out += `${escapeSsmlText(token)} `
  }

  return out.trim()
}

/**
 * SSML с prosody + паузами.
 * Раньше node-путь игнорировал rate/pitch — из‑за этого лабораторный голос звучал «плоско».
 */
export function buildTeacherSsml(
  text: string,
  voice: string,
  rate: string,
  pitch: string,
  volume: string,
  lang: string,
  pauseStyle?: PauseStyle,
): string {
  const body = textToSsmlProsodyContent(text, pauseStyle)
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
    `<voice name='${voice}'>` +
    `<prosody rate='${rate}' pitch='${pitch}' volume='${volume}'>${body}</prosody>` +
    `</voice></speak>`
  )
}
