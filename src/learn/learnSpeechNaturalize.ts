import type { SpeechPrepLocale } from './learnSpeechText'

/** Формулы → как говорит учитель (длинные совпадения первыми). */
const FORMULA_SPEECH_RU: ReadonlyArray<readonly [RegExp, string]> = [
  [/Ca\s*\(\s*OH\s*\)\s*2|Ca\(OH\)₂/gi, 'гидроксид кальция'],
  [/Fe\s*\(\s*OH\s*\)\s*3|Fe\(OH\)₃/gi, 'гидроксид железа'],
  [/H₂SO₄|H2SO4/gi, 'серная кислота'],
  [/HNO₃|HNO3/gi, 'азотная кислота'],
  [/H₃PO₄|H3PO4/gi, 'фосфорная кислота'],
  [/H₂CO₃|H2CO3/gi, 'угольная кислота'],
  [/H₂O₂|H2O2/gi, 'перекись водорода'],
  [/C₂H₅OH|C2H5OH/gi, 'этиловый спирт'],
  [/CaCO₃|CaCO3/gi, 'карбонат кальция'],
  [/Na₂CO₃|Na2CO3/gi, 'карбонат натрия'],
  [/NaHCO₃|NaHCO3/gi, 'гидрокарбонат натрия'],
  [/Fe₂O₃|Fe2O3/gi, 'оксид железа три'],
  [/Al₂O₃|Al2O3/gi, 'оксид алюминия'],
  [/Fe₃O₄|Fe3O4/gi, 'оксид железа два три'],
  [/CuSO₄|CuSO4/gi, 'сульфат меди'],
  [/ZnSO₄|ZnSO4/gi, 'сульфат цинка'],
  [/AgNO₃|AgNO3/gi, 'нитрат серебра'],
  [/BaSO₄|BaSO4/gi, 'сульфат бария'],
  [/NH₄Cl|NH4Cl/gi, 'хлорид аммония'],
  [/NH₃|NH3/gi, 'аммиак'],
  [/CH₄|CH4/gi, 'метан'],
  [/C₂H₆|C2H6/gi, 'этан'],
  [/C₃H₈|C3H8/gi, 'пропан'],
  [/HCl/gi, 'хлороводород'],
  [/NaOH/gi, 'гидроксид натрия'],
  [/KOH/gi, 'гидроксид калия'],
  [/NaCl/gi, 'хлорид натрия'],
  [/KCl/gi, 'хлорид калия'],
  [/CaO/gi, 'оксид кальция'],
  [/MgO/gi, 'оксид магния'],
  [/CuO/gi, 'оксид меди'],
  [/ZnO/gi, 'оксид цинка'],
  [/H₂O|H2O/gi, 'вода'],
  [/CO₂|CO2/gi, 'углекислый газ'],
  [/SO₂|SO2/gi, 'сульфурный газ'],
  [/SO₃|SO3/gi, 'оксид серы шесть'],
  [/NO₂|NO2/gi, 'оксид азота четыре'],
  [/O₂|O2/gi, 'кислород'],
  [/H₂|H2/gi, 'водород'],
  [/N₂|N2/gi, 'азот'],
  [/Cl₂|Cl2/gi, 'хлор'],
  [/F₂|F2/gi, 'фтор'],
  [/Br₂|Br2/gi, 'бром'],
  [/I₂|I2/gi, 'йод'],
]

/** Буква ё — TTS читает естественнее, чем combining acute. */
const YO_FIXES_RU: Record<string, string> = {
  еще: 'ещё',
  Еще: 'Ещё',
  ЕЩЕ: 'ЕЩЁ',
  щелоч: 'щёлоч',
  Щелоч: 'Щёлоч',
  объем: 'объём',
  Объем: 'Объём',
  объема: 'объёма',
  подъем: 'подъём',
  Подъем: 'Подъём',
  подъема: 'подъёма',
}

const COMBINING_ACUTE = /\u0301/g

export function stripCombiningAcute(text: string): string {
  return text.replace(COMBINING_ACUTE, '')
}

export function applyYoLetterFixes(text: string): string {
  let out = text
  const keys = Object.keys(YO_FIXES_RU).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const yo = YO_FIXES_RU[key]!
    const re = new RegExp(`(?<![\\p{L}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'gu')
    out = out.replace(re, yo)
  }
  return out
}

function expandFormulasForSpeech(text: string, locale: SpeechPrepLocale): string {
  if (locale !== 'ru') return text
  let out = text
  for (const [re, spoken] of FORMULA_SPEECH_RU) {
    out = out.replace(re, spoken)
  }
  return out
}

function normalizeUnitsForSpeech(text: string, locale: SpeechPrepLocale): string {
  if (locale === 'ru') {
    return text
      .replace(/\bpH\b/gi, 'пэ аш')
      .replace(/(\d+)\s*°\s*C/gi, '$1 градусов')
      .replace(/(\d+)\s*°/g, '$1 градусов')
      .replace(/(\d+)\s*г\/л/gi, '$1 грамм на литр')
      .replace(/(\d+)\s*моль\/л/gi, '$1 моль на литр')
      .replace(/(\d+)\s*кДж/gi, '$1 килоджоуль')
      .replace(/(\d+)\s*кДж\/моль/gi, '$1 килоджоуль на моль')
      .replace(/(\d+)\s*%/g, '$1 процентов')
      .replace(/(\d+)\s*г\b/gi, '$1 грамм')
      .replace(/(\d+)\s*кг\b/gi, '$1 килограмм')
      .replace(/(\d+)\s*мл\b/gi, '$1 миллилитр')
      .replace(/(\d+)\s*л\b/gi, '$1 литр')
      .replace(/(\d+)\s*моль\b/gi, '$1 моль')
      .replace(/Na\+/g, 'ион натрия')
      .replace(/Cl-/g, 'ион хлора')
      .replace(/H\+/g, 'ион водорода')
      .replace(/OH-/g, 'гидроксид-ион')
      .replace(/Fe2\+/g, 'ион железа два')
      .replace(/Fe3\+/g, 'ион железа три')
      .replace(/Cu2\+/g, 'ион меди два')
  }
  return text
    .replace(/\bpH\b/gi, 'P H')
    .replace(/(\d+)\s*°\s*C/gi, '$1 degrees Celsius')
    .replace(/(\d+)\s*%/g, '$1 percent')
}

/** Пунктуация и связки — как паузы живого учителя. */
function softenPunctuationForSpeech(text: string): string {
  return text
    .replace(/\s*\(\s*/g, ', ')
    .replace(/\s*\)\s*/g, ', ')
    .replace(/\s*\/\s*/g, ', или ')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s*:\s*/g, ', ')
    .replace(/\s*\[\s*/g, ' ')
    .replace(/\s*\]\s*/g, ' ')
    .replace(/«|»|„|"/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',')
}

/** Убирает символы, которые TTS «заклинивает». */
function stripTtsNoise(text: string): string {
  return text
    .replace(/[•·▪✦📖|]/g, ' ')
    .replace(/[=]{2,}/g, ' ')
    .replace(/[_]{2,}/g, ' ')
    .replace(/[#]{1,6}/g, ' ')
}

export type NaturalizeSpeechOptions = {
  /** ElevenLabs: без combining acute, с буквой ё */
  forVoiceClone?: boolean
}

/** Финальная подготовка — живой разговорный текст для TTS. */
export function naturalizeSpeechText(
  text: string,
  locale: SpeechPrepLocale,
  _options: NaturalizeSpeechOptions = {},
): string {
  let t = stripTtsNoise(text)
  t = expandFormulasForSpeech(t, locale)
  t = normalizeUnitsForSpeech(t, locale)
  t = softenPunctuationForSpeech(t)

  if (locale === 'ru') {
    t = stripCombiningAcute(t)
    t = applyYoLetterFixes(t)
  }

  return t
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,!?])\s*/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Разбивка длинного предложения по запятым, не посередине слова. */
export function splitAtSpeechClauses(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence]

  const clauses = sentence.split(/(?<=[,])\s+/)
  const parts: string[] = []
  let buf = ''

  for (const clause of clauses) {
    const next = buf ? `${buf} ${clause}` : clause
    if (next.length > max) {
      if (buf) parts.push(buf.trim())
      if (clause.length > max) {
        const words = clause.split(/\s+/)
        let wordBuf = ''
        for (const w of words) {
          const wNext = wordBuf ? `${wordBuf} ${w}` : w
          if (wNext.length > max) {
            if (wordBuf) parts.push(wordBuf.trim())
            wordBuf = w
          } else {
            wordBuf = wNext
          }
        }
        if (wordBuf) parts.push(wordBuf.trim())
        buf = ''
      } else {
        buf = clause
      }
    } else {
      buf = next
    }
  }
  if (buf) parts.push(buf.trim())
  return parts.filter(Boolean)
}
