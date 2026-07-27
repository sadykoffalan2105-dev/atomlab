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
  [/с плюс трёх/gi, 'с плюс три'],
  [/до плюс четырёх/gi, 'до плюс четыре'],
  [/с нуля до минус одного/gi, 'с нуля до минус один'],
  [/плюс трёх/gi, 'плюс три'],
  [/плюс четырёх/gi, 'плюс четыре'],
  [/минус одного/gi, 'минус один'],
  [/плюс три\s*[—–→-]+\s*плюс четыре/gi, 'плюс три. плюс четыре'],
  [/ноль\s*[—–→-]+\s*минус один/gi, 'ноль. минус один'],
  [/117\s*°/g, 'сто семнадцать градусов'],
  [/(?<![\p{L}\d])117(?![\p{L}\d])/g, 'сто семнадцать'],
]

const LAB_SPOKEN_REWRITES_EN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bClO₂\b|\bClO2\b/gi, 'chlorine dioxide'],
  [/\bNaClO₂\b|\bNaClO2\b/gi, 'sodium chlorite'],
  [/\bNaCl\b/g, 'sodium chloride'],
  [/\bCl₂\b|\bCl2\b/gi, 'molecular chlorine'],
  [/plus three\s*[—–→-]+\s*plus four/gi, 'plus three. plus four'],
  [/zero\s*[—–→-]+\s*minus one/gi, 'zero. minus one'],
  [/\b117\s*°/g, 'one hundred seventeen degrees'],
  [/\bone hundred seventeen degrees/gi, 'one hundred seventeen degrees'],
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
    t = cadenceForLabTeacher(t)
  } else if (locale === 'en') {
    t = applyRewrites(t, LAB_SPOKEN_REWRITES_EN)
    t = cadenceForLabTeacher(t)
  } else {
    t = cadenceForLabTeacher(t)
  }

  return t
}
