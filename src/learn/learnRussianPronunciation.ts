/**
 * Лексикон произношения для русского TTS.
 * Без combining acute (U+0301) — Edge/ElevenLabs читают хуже с ним.
 * Только буква ё и исправления слов, которые движки путают.
 */
const COMBINING_ACUTE = /\u0301/g

/** Ключ → форма для озвучки (только если отличается от ключа). */
export const RUSSIAN_PRONUNCIATION_LEXICON: Record<string, string> = {
  еще: 'ещё',
  Еще: 'Ещё',
  ЕЩЕ: 'ЕЩЁ',
  щелоч: 'щёлоч',
  Щелоч: 'Щёлоч',
  щелочи: 'щёлочи',
  Щелочи: 'Щёлочи',
  щелочной: 'щёлочной',
  щелочная: 'щёлочная',
  щелочное: 'щёлочное',
  щелочные: 'щёлочные',
  объем: 'объём',
  Объем: 'Объём',
  объема: 'объёма',
  объемы: 'объёмы',
  объемный: 'объёмный',
  подъем: 'подъём',
  Подъем: 'Подъём',
  подъема: 'подъёма',
  твердый: 'твёрдый',
  Твердый: 'Твёрдый',
  твердая: 'твёрдая',
  твердое: 'твёрдое',
  твердые: 'твёрдые',
  твердость: 'твёрдость',
  мягкий: 'мягкий',
  легкий: 'лёгкий',
  Легкий: 'Лёгкий',
  легкая: 'лёгкая',
  легкое: 'лёгкое',
  жесткий: 'жёсткий',
  Жесткий: 'Жёсткий',
  желтый: 'жёлтый',
  Желтый: 'Жёлтый',
  желтая: 'жёлтая',
  желтое: 'жёлтое',
  черный: 'чёрный',
  Черный: 'Чёрный',
  черная: 'чёрная',
  черное: 'чёрное',
  берет: 'берёт',
  врет: 'врёт',
  влечет: 'влечёт',
  создает: 'создаёт',
  образует: 'образует',
  растворяет: 'растворяет',
  кипит: 'кипит',
  плавится: 'плавится',
  Kimyo: 'Кимё',
  kimyo: 'Кимё',
  ATOMLAB: 'Атомлаб',
  pH: 'пэ аш',
  Ph: 'пэ аш',
  NaCl: 'хлорид натрия',
  H2O: 'вода',
  CO2: 'углекислый газ',
  O2: 'кислород',
  H2: 'водород',
  N2: 'азот',
  Cl2: 'хлор',
}

const SORTED_KEYS = Object.keys(RUSSIAN_PRONUNCIATION_LEXICON).sort((a, b) => b.length - a.length)

export function stripCombiningAcute(text: string): string {
  return text.replace(COMBINING_ACUTE, '')
}

/** Исправляет слова для естественного русского TTS. */
export function applyRussianPronunciationLexicon(text: string): string {
  let out = stripCombiningAcute(text)
  for (const key of SORTED_KEYS) {
    const spoken = RUSSIAN_PRONUNCIATION_LEXICON[key]!
    if (spoken === key) continue
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, 'gu')
    out = out.replace(re, spoken)
  }
  return out
}

/** Убирает только «шумовые» символы, слова и формулы не трогаем. */
export function sanitizeRussianTtsSurface(text: string): string {
  return text
    .replace(/(?<![A-Za-zА-Яа-яЁё0-9])[_=]{2,}(?![A-Za-zА-Яа-яЁё0-9])/g, ' ')
    .replace(/(?<![A-Za-zА-Яа-яЁё0-9])[#]{2,}(?![A-Za-zА-Яа-яЁё0-9])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
