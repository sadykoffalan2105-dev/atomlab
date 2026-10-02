/**
 * Признаки реплики ученика для классификатора намерений (общий код обучения и браузера).
 *
 * - символьные 2–4-граммы слов (нижний регистр, ё→е, подстрочные цифры → обычные);
 * - основы слов: русский стеммер (stemRussian) + лёгкое усечение латинских суффиксов;
 * - признаки формы: есть формула, есть число, арифметический знак, вопрос, длина, «нет …» в начале, эмодзи.
 *
 * Вектор бинарный (признак есть/нет), нормирован на единичную длину, чтобы длинные и короткие
 * фразы давали сопоставимые логиты.
 */
import { stemRussian } from '../../kb/stemRu'
import { stemLatin } from '../../kb/analyzer'
import { spokenNormalize } from '../human/spokenNormalize'

export const INTENTS = [
  'greet', 'bye', 'thanks', 'how_are_you', 'joke', 'about_teacher', 'offtopic', 'gibberish',
  'define', 'why', 'how', 'compare', 'example', 'calc_arith', 'molar_mass', 'moles', 'units', 'problem',
  'reaction_products', 'balance', 'element_info', 'compound_info', 'exam_me', 'simpler', 'more_detail', 'repeat',
  'remember', 'correction', 'feedback_pos', 'feedback_neg', 'homework_help', 'lab_safety', 'encourage',
] as const
export type Intent = (typeof INTENTS)[number]

/** Разговорные намерения — отвечает банк фраз, а не база знаний. */
export const TALK_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  'greet', 'bye', 'thanks', 'how_are_you', 'joke', 'about_teacher', 'offtopic', 'gibberish', 'encourage', 'feedback_pos', 'feedback_neg',
])

const SUBS = '₀₁₂₃₄₅₆₇₈₉'

/** Свёртка текста: нижний регистр, ё→е, апострофы, подстрочные индексы, повторы букв («приииивет» → «привет»). */
export function foldIntentText(raw: string): string {
  // Речевой мусор («э… ну… типа», хвост «да?») снимаем и при обучении, и в браузере — модель видит одно и то же.
  return spokenNormalize(raw)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/[₀-₉]/g, (d) => String(SUBS.indexOf(d)))
    .replace(/(\p{L})\1{2,}/gu, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeIntent(folded: string): string[] {
  return folded.match(/[\p{L}\p{N}'’]+/gu) ?? []
}

function stemAny(word: string): string {
  if (/^[а-я]+$/.test(word)) return word.length > 3 ? stemRussian(word) : word
  if (/^[a-z]+$/.test(word)) return word.length > 3 ? stemLatin(word) : word
  return word
}

/** Есть ли в исходном тексте химическая формула (H2O, NaCl, Fe₂O₃, CO2 …). */
export function hasFormula(raw: string): boolean {
  const t = raw.replace(/[₀-₉]/g, (d) => String(SUBS.indexOf(d)))
  return /(?:^|[^A-Za-z])(?:[A-Z][a-z]?\d+|[A-Z][a-z]?(?:[A-Z][a-z]?)+\d*|\(?[A-Z][a-z]?\d*\)?\d*\s*[+=→]\s*[A-Z(])/.test(t)
}

/** Множество признаков реплики (строки вида `c:...`, `w:...`, `s:...`). */
export function extractIntentFeatures(raw: string): string[] {
  const folded = foldIntentText(raw)
  const feats = new Set<string>()
  const tokens = tokenizeIntent(folded)
  for (const tok of tokens) {
    const padded = `_${tok}_`
    for (let n = 2; n <= 4; n++) {
      if (padded.length < n) break
      for (let i = 0; i + n <= padded.length; i++) feats.add(`c:${padded.slice(i, i + n)}`)
    }
    feats.add(`w:${stemAny(tok)}`)
  }
  // биграммы основ — «что такое», «сколько будет», «как получить»
  for (let i = 0; i + 1 < tokens.length; i++) feats.add(`b:${stemAny(tokens[i]!)}_${stemAny(tokens[i + 1]!)}`)
  if (tokens.length) feats.add(`f:${stemAny(tokens[0]!)}`)
  // форма
  if (hasFormula(raw)) feats.add('s:formula')
  if (/\d/.test(folded)) feats.add('s:number')
  if (/\d\s*[+\-*/×:^]\s*\d|\d\s*[+\-*/×]/.test(folded)) feats.add('s:arith')
  if (/\?/.test(raw)) feats.add('s:question')
  if (/[!]{1,}/.test(raw)) feats.add('s:bang')
  if (/^(нет|не|no|nope|yo'q|yoq)\b/.test(folded)) feats.add('s:starts_no')
  if (/👍|👎|🙂|😊|😢|😞|🙏|❤|😂|🤣/u.test(raw)) feats.add('s:emoji')
  if (/👎/u.test(raw)) feats.add('s:thumbdown')
  if (/👍/u.test(raw)) feats.add('s:thumbup')
  const n = tokens.length
  feats.add(n <= 1 ? 's:len1' : n <= 3 ? 's:len3' : n <= 7 ? 's:len7' : 's:lenlong')
  if (/^[а-я\s.,!?'-]+$/.test(folded)) feats.add('s:cyr')
  else if (/^[a-z\s.,!?'-]+$/.test(folded)) feats.add('s:lat')
  // «тарабарщина»: мало гласных / много согласных подряд
  const letters = folded.replace(/[^\p{L}]/gu, '')
  if (letters.length >= 4) {
    const vowels = (letters.match(/[аеиоуыэюяaeiouy]/g) ?? []).length
    if (vowels / letters.length < 0.2) feats.add('s:novowels')
    if (/[^аеиоуыэюяaeiouy\s]{5,}/.test(folded)) feats.add('s:consonants')
  }
  return [...feats]
}
