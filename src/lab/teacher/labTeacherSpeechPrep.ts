/**
 * Подготовка реплик лабораторного учителя к озвучке:
 * разговорные паузы, химия «как говорит преподаватель», без сырых формул.
 */

type LabSpeechLocale = 'ru' | 'en' | 'uz'

/** Разговорные замены под живой темп у стола (до словаря ударений). */
const LAB_SPOKEN_REWRITES_RU: ReadonlyArray<readonly [RegExp, string]> = [
  [/ClO₂|ClO2/gi, 'диоксид хлора'],
  [/NaClO₂|NaClO2/gi, 'хлорит натрия'],
  [/(?<![\p{L}])NaCl(?![\p{L}])/gu, 'хлорид натрия'],
  [/Cl₂|Cl2/gi, 'молекулярный хлор'],
  [/плюс три\s+стало\s+плюс четыре/gi, 'плюс три. стало плюс четыре'],
  [/плюс три\s*[—–→-]+\s*плюс четыре/gi, 'плюс три. плюс четыре'],
  [/плюс трёх/gi, 'плюс три'],
  [/плюс четырёх/gi, 'плюс четыре'],
  [/минус одного/gi, 'минус один'],
  [/ноль\s*[—–→-]+\s*минус один/gi, 'ноль. минус один'],
  [/117\s*°/g, 'сто семнадцать градусов'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, 'сто семнадцать'],
]

const LAB_SPOKEN_REWRITES_EN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bClO₂\b|\bClO2\b/gi, 'chlorine dioxide'],
  [/\bNaClO₂\b|\bNaClO2\b/gi, 'sodium chlorite'],
  [/\bNaCl\b/g, 'sodium chloride'],
  [/\bCl₂\b|\bCl2\b/gi, 'molecular chlorine'],
  [/plus three\s+becomes\s+plus four/gi, 'plus three. becomes plus four'],
  [/plus three\s*[—–→-]+\s*plus four/gi, 'plus three. plus four'],
  [/zero\s*[—–→-]+\s*minus one/gi, 'zero. minus one'],
  [/\b117\s*°/g, 'one hundred seventeen degrees'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, 'one hundred seventeen'],
  [/counter-ion/gi, 'counter ion'],
]

const LAB_SPOKEN_REWRITES_UZ: ReadonlyArray<readonly [RegExp, string]> = [
  [/ClO₂|ClO2/gi, 'xlor dioksid'],
  [/NaClO₂|NaClO2/gi, 'natriy xlorit'],
  [/(?<![\p{L}])NaCl(?![\p{L}])/gu, 'natriy xlorid'],
  [/Cl₂|Cl2/gi, 'xlor'],
  [/uchdan\s+tortga/gi, 'uchdan. tortga'],
  [/qarshi-ion/gi, 'qarshi ion'],
  [/\b117\s*daraja\b/gi, "bir yuz o'n yetti daraja"],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/gu, "bir yuz o'n yetti"],
]

/** Делает паузы заметнее для Edge SSML (запятые / точки). */
function cadenceForLabTeacher(text: string): string {
  return text
    .replace(/\s*—\s*/g, '. ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\s*\.\.\.\s*/g, '. ')
    .replace(/\s*…\s*/g, '. ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*:\s*/g, '. ')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function applyRewrites(text: string, rules: ReadonlyArray<readonly [RegExp, string]>): string {
  let out = text
  for (const [re, spoken] of rules) {
    out = out.replace(re, spoken)
  }
  return out
}

/** Сырой текст реплики → речь лабораторного учителя (ещё до общего TTS-prep). */
export function prepareLabTeacherSpeechRaw(text: string, locale: LabSpeechLocale): string {
  let t = text.trim()
  if (!t) return ''

  if (locale === 'ru') {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_RU)
  } else if (locale === 'en') {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_EN)
  } else {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_UZ)
  }

  return cadenceForLabTeacher(t)
}
