import type { SpeechPrepLocale } from './learnSpeechText'
import { expandElementSymbolsForRussianSpeech } from './learnElementSpeech'
import { expandCatalogFormulasForSpeech } from './learnCatalogFormulaSpeech'

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
  [/NaClO₂|NaClO2/gi, 'хлорит натрия'],
  [/ClO₂|ClO2/gi, 'диоксид хлора'],
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
  [/SO₂|SO2/gi, 'диоксид серы'],
  [/SO₃|SO3/gi, 'триоксид серы'],
  [/NO₂|NO2/gi, 'диоксид азота'],
  [/NO\b/g, 'оксид азота'],
  [/CO\b/g, 'угарный газ'],
  [/MnO₂|MnO2/gi, 'диоксид марганца'],
  [/KMnO₄|KMnO4/gi, 'перманганат калия'],
  [/K₂Cr₂O₇|K2Cr2O7/gi, 'дихромат калия'],
  [/H₂S|H2S/gi, 'сероводород'],
  [/HF\b/g, 'фтороводород'],
  [/HBr\b/g, 'бромоводород'],
  [/HI\b/g, 'йодоводород'],
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
  щелочь: 'щёлочь',
  Щелочь: 'Щёлочь',
  щелочи: 'щёлочи',
  Щелочи: 'Щёлочи',
  объем: 'объём',
  Объем: 'Объём',
  объема: 'объёма',
  объеме: 'объёме',
  объемом: 'объёмом',
  подъем: 'подъём',
  Подъем: 'Подъём',
  подъема: 'подъёма',
  разберем: 'разберём',
  Разберем: 'Разберём',
  начнем: 'начнём',
  Начнем: 'Начнём',
  пойдем: 'пойдём',
  Пойдем: 'Пойдём',
  берете: 'берёте',
  берешь: 'берёшь',
  ждете: 'ждёте',
  ждешь: 'ждёшь',
  придем: 'придём',
  зайдем: 'зайдём',
  легкий: 'лёгкий',
  легкая: 'лёгкая',
  легкое: 'лёгкое',
  теплый: 'тёплый',
  теплая: 'тёплая',
  теплое: 'тёплое',
  черный: 'чёрный',
  черная: 'чёрная',
  черное: 'чёрное',
  желтый: 'жёлтый',
  желтая: 'жёлтая',
  желтое: 'жёлтое',
  твердый: 'твёрдый',
  твердая: 'твёрдая',
  твердое: 'твёрдое',
  зеленый: 'зелёный',
  зеленая: 'зелёная',
  зеленое: 'зелёное',
  учет: 'учёт',
  зачет: 'зачёт',
  самолет: 'самолёт',
  полет: 'полёт',
  придет: 'придёт',
  найдет: 'найдёт',
  дает: 'даёт',
  Дает: 'Даёт',
  создает: 'создаёт',
  узнает: 'узнаёт',
  растворенное: 'растворённое',
  растворенный: 'растворённый',
  растворенная: 'растворённая',
}

const COMBINING_ACUTE = /\u0301/g

export function stripCombiningAcute(text: string): string {
  return text.replace(COMBINING_ACUTE, '')
}

/** Один RegExp на все замены (строится лениво) — без полусотни компиляций на каждой фразе. */
let yoRe: RegExp | null = null

export function applyYoLetterFixes(text: string): string {
  if (!yoRe) {
    const keys = Object.keys(YO_FIXES_RU).sort((a, b) => b.length - a.length)
    const alternation = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    yoRe = new RegExp(`(?<![\\p{L}])(?:${alternation})(?![\\p{L}])`, 'gu')
  }
  return text.replace(yoRe, (m) => YO_FIXES_RU[m] ?? m)
}

/**
 * Формула — только целым токеном: «F2» внутри «OF2» или «N2» внутри «N2O» не трогаем
 * (иначе «Oфтор», «азотO»). Компилируется один раз.
 */
const FORMULA_SPEECH_RU_BOUNDED: ReadonlyArray<readonly [RegExp, string]> = FORMULA_SPEECH_RU.map(([re, spoken]) => {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  return [new RegExp(`(?<![A-Za-z0-9₀-₉])(?:${re.source})(?![A-Za-z0-9₀-₉])`, flags), spoken] as const
})

function expandFormulasForSpeech(text: string, locale: SpeechPrepLocale): string {
  if (locale !== 'ru') return text
  let out = text
  for (const [re, spoken] of FORMULA_SPEECH_RU_BOUNDED) {
    out = out.replace(re, spoken)
  }
  // Каталог (все 434) — после ручных правил, чтобы не перебить спец-произношения.
  out = expandCatalogFormulasForSpeech(out)
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
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[️•·▪✦📖|🎤🔊⚗🧪🔬]/gu, ' ')
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
  void _options
  let t = stripTtsNoise(text)
  // Формулы/символы элементов бывают только с латиницей или индексами — иначе не гоняем
  // сотни правил каталога (фраза без формул готовится за доли миллисекунды).
  if (/[A-Za-z₀-₉]/.test(t.replace(/(?<!\d\s*)\b[IVXLCDM]+\b/g, ''))) {
    t = expandFormulasForSpeech(t, locale)
    if (locale === 'ru') {
      t = expandElementSymbolsForRussianSpeech(t)
    }
  }
  t = normalizeUnitsForSpeech(t, locale)
  t = softenPunctuationForSpeech(t)

  if (locale === 'ru') {
    t = applyYoLetterFixes(t)
  }

  return t
    .replace(/\s+([,.!?])/g, '$1')
    // «(… века).» → «…века, .» — лишняя запятая перед концом фразы
    .replace(/,+\s*([.!?])/g, '$1')
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
