/**
 * Пост-коррекция распознанной речи ученика (чётче слова в Chrome и Edge).
 *
 *  (а) произнесённые формулы → запись: «аш два о» → H₂O, «эн а о аш» → NaOH, «натрий хлор» → NaCl;
 *  (б) ослышки терминов: таблица реально наблюдаемых пар STT + Дамерау–Левенштейн ≤ 2
 *      (слова ≥ 6 букв) и фонетическая свёртка к словарю химических терминов (CHEM_TERMS,
 *      сгенерирован из лексикона и корпуса учебников); исправляем только уникального кандидата
 *      и только если исходное слово не словарное русское (KNOWN_WORDS);
 *  (в) числа словами → цифры в контексте («девяносто восемь грамм» → 98 г), «моль» не трогаем;
 *  (г) выбор лучшей альтернативы STT по «химическому» счёту + confidence.
 *
 * Чистый модуль: без DOM, тестируется в node (scripts/test-voice-transcript.mts).
 */
import { CHEM_TERMS, KNOWN_WORDS } from './chemTerms.generated'
import { STT_FIX_CHEM_TERMS, STT_FIX_PAIRS_EXTRA } from './sttFixesExtra'

export type TranscriptLang = 'ru' | 'en' | 'uz'

/* ------------------------------------------------------------ (г) ослышки STT */

/** Реально наблюдаемые ошибки распознавания: «услышано» → «надо». */
export const STT_FIX_PAIRS: readonly (readonly [string, string])[] = [
  ['аксид', 'оксид'], ['оксит', 'оксид'], ['аксиды', 'оксиды'], ['окситы', 'оксиды'],
  ['валентнасть', 'валентность'], ['волентность', 'валентность'], ['валентнось', 'валентность'],
  ['гидрооксид', 'гидроксид'], ['гедроксид', 'гидроксид'], ['гидроксит', 'гидроксид'], ['гидрооксиды', 'гидроксиды'],
  ['мол', 'моль'], ['молль', 'моль'], ['мольный', 'молярный'],
  ['риакция', 'реакция'], ['реакцыя', 'реакция'], ['риакции', 'реакции'],
  ['электролид', 'электролит'], ['електролит', 'электролит'], ['электролиты', 'электролиты'],
  ['кислата', 'кислота'], ['кислоты', 'кислоты'], ['кеслота', 'кислота'], ['кислата', 'кислота'],
  ['щелочь', 'щёлочь'], ['шёлочь', 'щёлочь'], ['шелочь', 'щёлочь'], ['щолочь', 'щёлочь'],
  ['котион', 'катион'], ['кат ион', 'катион'], ['анеон', 'анион'], ['ан ион', 'анион'],
  ['менделеева', 'Менделеева'], ['мендель', 'Менделеев'], ['менделеев', 'Менделеев'], ['менделеива', 'Менделеева'],
  ['авагадро', 'Авогадро'], ['авогадра', 'Авогадро'], ['авагадра', 'Авогадро'],
  ['ломоносав', 'Ломоносов'], ['ламаносов', 'Ломоносов'],
  ['малекула', 'молекула'], ['молекулла', 'молекула'], ['малекулы', 'молекулы'],
  ['атам', 'атом'], ['атомы', 'атомы'], ['атамы', 'атомы'],
  ['электрон', 'электрон'], ['електрон', 'электрон'], ['электроны', 'электроны'], ['електроны', 'электроны'],
  ['пратон', 'протон'], ['нийтрон', 'нейтрон'], ['нитрон', 'нейтрон'],
  ['карбанат', 'карбонат'], ['карбанаты', 'карбонаты'], ['сульфад', 'сульфат'], ['сульфит', 'сульфит'],
  ['нитрад', 'нитрат'], ['фасфат', 'фосфат'], ['хларид', 'хлорид'], ['хлорит', 'хлорид'],
  ['окисление', 'окисление'], ['окесление', 'окисление'], ['востановление', 'восстановление'],
  ['растваримость', 'растворимость'], ['раствор', 'раствор'], ['расствор', 'раствор'],
  ['индикатар', 'индикатор'], ['лакмуз', 'лакмус'], ['фенолфталеин', 'фенолфталеин'], ['финолфталеин', 'фенолфталеин'],
  ['катализатар', 'катализатор'], ['котализатор', 'катализатор'],
  ['амиак', 'аммиак'], ['аммеак', 'аммиак'], ['амияк', 'аммиак'],
  ['серная кислата', 'серная кислота'], ['саляная', 'соляная'], ['азотная кислата', 'азотная кислота'],
  ['углерот', 'углерод'], ['кислорот', 'кислород'], ['вадарод', 'водород'], ['водарод', 'водород'],
  ['натрии', 'натрий'], ['калии', 'калий'], ['кальции', 'кальций'], ['алюминии', 'алюминий'],
  ['периодическая', 'периодическая'], ['пириодическая', 'периодическая'], ['периадическая', 'периодическая'],
  ['изатоп', 'изотоп'], ['изотоп', 'изотоп'], ['ковалентная', 'ковалентная'], ['кавалентная', 'ковалентная'],
  ['ионая', 'ионная'], ['металическая', 'металлическая'], ['эквивалент', 'эквивалент'], ['иквивалент', 'эквивалент'],
  ['концентрация', 'концентрация'], ['канцентрация', 'концентрация'], ['диссоциация', 'диссоциация'], ['дисоциация', 'диссоциация'],
  ['гидролиз', 'гидролиз'], ['гидролис', 'гидролиз'], ['электролиз', 'электролиз'], ['электролис', 'электролиз'],
  ['окислитель', 'окислитель'], ['акислитель', 'окислитель'], ['восстановитель', 'восстановитель'], ['востановитель', 'восстановитель'],
  // en / uz
  ['oxid', 'oxide'], ['hidroxide', 'hydroxide'], ['mol', 'mole'], ['avogadros', 'Avogadro'], ['mendeleyev', 'Mendeleev'],
  ['valentlik', 'valentlik'], ['oksit', 'oksid'], ['gidroksit', 'gidroksid'], ['reaksiya', 'reaksiya'], ['reaktsiya', 'reaksiya'],
]

/** Все правила ослышек: базовые + расширенные (вещества, элементы, учёные, школьные фразы, узбекские слова). */
export const ALL_STT_FIX_PAIRS: readonly (readonly [string, string])[] = [...STT_FIX_PAIRS, ...STT_FIX_PAIRS_EXTRA]

const FIX_MAP: ReadonlyMap<string, string> = new Map(
  ALL_STT_FIX_PAIRS.filter(([a]) => !a.includes(' ')).map(([a, b]) => [norm(a), b]),
)
/** Словосочетания-ослышки (2+ слова) — заменяем регуляркой целиком. */
const PHRASE_FIXES: readonly (readonly [RegExp, string])[] = ALL_STT_FIX_PAIRS.filter(([a]) => a.includes(' ')).map(
  ([heard, fix]) => [new RegExp(`(^|[^\\p{L}])${heard.replace(/ё/g, '[её]')}(?=[^\\p{L}]|$)`, 'giu'), fix] as const,
)

/* ------------------------------------------------------------ словарь терминов */

/** Слова вопроса — считаются «химическими» при выборе альтернативы. */
const QUESTION_WORDS = [
  'что', 'такое', 'почему', 'зачем', 'как', 'какой', 'какая', 'какие', 'объясни', 'расскажи', 'пример', 'задача',
  'what', 'why', 'how', 'explain', 'example', 'nima', 'nega', 'qanday', 'tushuntir', 'misol',
]

const EXTRA_TERMS = [
  ...STT_FIX_PAIRS.map(([, fix]) => fix),
  // Расширенные правила: только химические «исправления» (не переводы узбекских/разговорных слов).
  ...STT_FIX_CHEM_TERMS,
  'оксид', 'оксиды', 'гидроксид', 'кислота', 'кислоты', 'щёлочь', 'щёлочи', 'соль', 'соли', 'основание', 'основания',
  'катион', 'анион', 'моль', 'молярная', 'масса', 'валентность', 'электроотрицательность', 'реакция', 'уравнение',
  'коэффициент', 'индекс', 'формула', 'вещество', 'вещества', 'элемент', 'элементы', 'период', 'группа', 'подгруппа',
  'металл', 'металлы', 'неметалл', 'неметаллы', 'ион', 'ионы', 'связь', 'ковалентная', 'ионная', 'металлическая',
  'водородная', 'раствор', 'растворимость', 'осадок', 'газ', 'индикатор', 'лакмус', 'фенолфталеин', 'метилоранж',
  'окислитель', 'восстановитель', 'окисление', 'восстановление', 'степень', 'катализатор', 'экзотермическая',
  'эндотермическая', 'обратимая', 'необратимая', 'электролит', 'неэлектролит', 'диссоциация', 'гидролиз', 'электролиз',
  'аммиак', 'метан', 'этан', 'этилен', 'ацетилен', 'бензол', 'спирт', 'этанол', 'метанол', 'альдегид', 'кетон',
  'углевод', 'глюкоза', 'сахароза', 'крахмал', 'целлюлоза', 'белок', 'белки', 'жир', 'жиры', 'полимер', 'мономер',
  'изомер', 'изомерия', 'гомолог', 'алкан', 'алкен', 'алкин', 'арен', 'карбоновая', 'аминокислота',
  'protein', 'oxide', 'hydroxide', 'acid', 'base', 'salt', 'mole', 'molar', 'valence', 'reaction', 'equation', 'solution',
  'oksid', 'gidroksid', 'kislota', 'asos', 'tuz', 'valentlik', 'reaksiya', 'tenglama', 'eritma', 'modda', 'element',
]

/** Нормализация слова для сравнения. */
export function norm(word: string): string {
  return word.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}']/gu, '')
}

export const CHEM_DICTIONARY: ReadonlySet<string> = new Set([...CHEM_TERMS, ...EXTRA_TERMS].map(norm))
const KNOWN: ReadonlySet<string> = new Set(KNOWN_WORDS.map(norm))
const QUESTION: ReadonlySet<string> = new Set(QUESTION_WORDS)

/** Фонетическая свёртка русского слова: о/а, е/и, безударные, тс/ц, щ/ш, в/ф, удвоения. */
export function phoneticKey(word: string): string {
  return norm(word)
    .replace(/тс|тьс|дс/g, 'ц')
    .replace(/щ/g, 'ш')
    .replace(/ж/g, 'ш')
    .replace(/[оа]/g, 'а')
    .replace(/[еиэыя]/g, 'и')
    .replace(/ю/g, 'у')
    .replace(/[фв]/g, 'в')
    .replace(/[дт]/g, 'т')
    .replace(/[зс]/g, 'с')
    .replace(/[бп]/g, 'п')
    .replace(/[гк]/g, 'к')
    .replace(/[ьъй]/g, '')
    .replace(/(.)\1+/g, '$1')
}

/** Расстояние Дамерау–Левенштейна (с ограничением — всё, что больше max, возвращается как max+1). */
export function damerauLevenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i]![0] = i
  for (let j = 0; j <= n; j++) d[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[m]![n]!
}

const byPhonetic = new Map<string, string[]>()
const byLength = new Map<number, string[]>()
for (const term of CHEM_DICTIONARY) {
  const k = phoneticKey(term)
  const arr = byPhonetic.get(k)
  if (arr) arr.push(term)
  else byPhonetic.set(k, [term])
  const l = byLength.get(term.length)
  if (l) l.push(term)
  else byLength.set(term.length, [term])
}

/** Исправить одно слово-ослышку; null — оставить как есть. */
export function correctTerm(word: string): string | null {
  const w = norm(word)
  if (!w) return null
  const exact = FIX_MAP.get(w)
  if (exact) return exact
  if (CHEM_DICTIONARY.has(w) || KNOWN.has(w) || QUESTION.has(w)) return null
  if (w.length < 6 || /\d/.test(w)) return null
  // Отличие только в окончании («ионную» ↔ «ионная») — словоформа, не ослышка.
  const sameStem = (term: string) => {
    const n = Math.min(w.length, term.length) - 2
    return n >= 4 && w.slice(0, n) === term.slice(0, n)
  }
  // 1) фонетика: один уникальный термин с той же свёрткой
  const ph = byPhonetic.get(phoneticKey(w))
  if (ph && ph.length === 1 && ph[0] !== w) return sameStem(ph[0]!) ? null : ph[0]!
  if (ph && ph.length > 1) return null
  // 2) Дамерау–Левенштейн: ≤ 1 для слов короче 9 букв, ≤ 2 (и длина ±1) для длинных; кандидат уникален
  //    на минимальном расстоянии, первая буква совпадает. Строже, чем раньше: «сестры» ≠ «серы»,
  //    «выходной» ≠ «водной», «изобрёл» ≠ «изопрен» (обычная речь не портится).
  const maxD = w.length >= 9 ? 2 : 1
  let best: string[] = []
  let bestD = maxD + 1
  for (let len = w.length - maxD; len <= w.length + maxD; len++) {
    for (const term of byLength.get(len) ?? []) {
      if (term[0] !== w[0]) continue
      const d = damerauLevenshtein(w, term, maxD)
      if (d === 2 && Math.abs(term.length - w.length) > 1) continue
      if (d < bestD) {
        bestD = d
        best = [term]
      } else if (d === bestD) best.push(term)
    }
  }
  if (bestD > maxD || best.length !== 1) return null
  return sameStem(best[0]!) ? null : best[0]!
}

/* -------------------------------------------------------- (а) формулы словами */

type FormulaToken = {
  sym: string
  strong: boolean
  kind: 'letter' | 'element' | 'number'
  /** Слабая буква («а», «и», «же»…): входит в формулу только как вторая буква символа (эн а → Na). */
  joinOnly?: boolean
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

const FORMULA_TOKENS: Record<TranscriptLang, Record<string, FormulaToken>> = {
  ru: {
    аш: { sym: 'H', strong: true, kind: 'letter' }, о: { sym: 'O', strong: false, kind: 'letter' },
    эс: { sym: 'S', strong: true, kind: 'letter' },
    це: { sym: 'C', strong: true, kind: 'letter' }, ка: { sym: 'K', strong: true, kind: 'letter' },
    эль: { sym: 'L', strong: true, kind: 'letter' }, эф: { sym: 'F', strong: true, kind: 'letter' },
    пэ: { sym: 'P', strong: true, kind: 'letter' }, пе: { sym: 'P', strong: true, kind: 'letter' },
    а: { sym: 'A', strong: false, kind: 'letter', joinOnly: true }, у: { sym: 'U', strong: false, kind: 'letter', joinOnly: true },
    е: { sym: 'E', strong: false, kind: 'letter', joinOnly: true }, и: { sym: 'I', strong: false, kind: 'letter', joinOnly: true },
    же: { sym: 'G', strong: false, kind: 'letter', joinOnly: true }, жэ: { sym: 'G', strong: false, kind: 'letter', joinOnly: true },
    гэ: { sym: 'G', strong: false, kind: 'letter', joinOnly: true }, ге: { sym: 'G', strong: false, kind: 'letter', joinOnly: true },
    эр: { sym: 'R', strong: false, kind: 'letter', joinOnly: true }, эн: { sym: 'N', strong: true, kind: 'letter' },
    бэ: { sym: 'B', strong: true, kind: 'letter' }, h: { sym: 'H', strong: true, kind: 'letter' },
    эл: { sym: 'L', strong: true, kind: 'letter' }, эм: { sym: 'M', strong: true, kind: 'letter' },
    зет: { sym: 'Z', strong: true, kind: 'letter' }, зэт: { sym: 'Z', strong: true, kind: 'letter' },
    ош: { sym: 'H', strong: true, kind: 'letter' }, ашь: { sym: 'H', strong: true, kind: 'letter' },
    йод: { sym: 'I', strong: true, kind: 'element' }, сера: { sym: 'S', strong: true, kind: 'element' },
    фтор: { sym: 'F', strong: true, kind: 'element' }, барий: { sym: 'Ba', strong: true, kind: 'element' },
    литий: { sym: 'Li', strong: true, kind: 'element' }, серебро: { sym: 'Ag', strong: true, kind: 'element' },
    свинец: { sym: 'Pb', strong: true, kind: 'element' },
    натрий: { sym: 'Na', strong: true, kind: 'element' }, калий: { sym: 'K', strong: true, kind: 'element' },
    кальций: { sym: 'Ca', strong: true, kind: 'element' }, магний: { sym: 'Mg', strong: true, kind: 'element' },
    хлор: { sym: 'Cl', strong: true, kind: 'element' }, железо: { sym: 'Fe', strong: true, kind: 'element' },
    медь: { sym: 'Cu', strong: true, kind: 'element' }, цинк: { sym: 'Zn', strong: true, kind: 'element' },
    алюминий: { sym: 'Al', strong: true, kind: 'element' }, бром: { sym: 'Br', strong: true, kind: 'element' },
    два: { sym: '2', strong: false, kind: 'number' }, три: { sym: '3', strong: false, kind: 'number' },
    четыре: { sym: '4', strong: false, kind: 'number' }, пять: { sym: '5', strong: false, kind: 'number' },
    шесть: { sym: '6', strong: false, kind: 'number' }, семь: { sym: '7', strong: false, kind: 'number' },
    восемь: { sym: '8', strong: false, kind: 'number' }, десять: { sym: '10', strong: false, kind: 'number' },
    двенадцать: { sym: '12', strong: false, kind: 'number' },
  },
  en: {
    h: { sym: 'H', strong: true, kind: 'letter' }, o: { sym: 'O', strong: false, kind: 'letter' }, oh: { sym: 'O', strong: false, kind: 'letter' },
    s: { sym: 'S', strong: true, kind: 'letter' }, n: { sym: 'N', strong: true, kind: 'letter' }, c: { sym: 'C', strong: true, kind: 'letter' },
    k: { sym: 'K', strong: true, kind: 'letter' }, l: { sym: 'L', strong: false, kind: 'letter' }, f: { sym: 'F', strong: true, kind: 'letter' },
    p: { sym: 'P', strong: true, kind: 'letter' }, a: { sym: 'A', strong: false, kind: 'letter' }, u: { sym: 'U', strong: false, kind: 'letter' },
    e: { sym: 'E', strong: false, kind: 'letter' }, i: { sym: 'I', strong: false, kind: 'letter' }, b: { sym: 'B', strong: true, kind: 'letter' },
    sodium: { sym: 'Na', strong: true, kind: 'element' }, potassium: { sym: 'K', strong: true, kind: 'element' },
    calcium: { sym: 'Ca', strong: true, kind: 'element' }, magnesium: { sym: 'Mg', strong: true, kind: 'element' },
    chlorine: { sym: 'Cl', strong: true, kind: 'element' }, iron: { sym: 'Fe', strong: true, kind: 'element' },
    copper: { sym: 'Cu', strong: true, kind: 'element' }, zinc: { sym: 'Zn', strong: true, kind: 'element' },
    aluminium: { sym: 'Al', strong: true, kind: 'element' }, aluminum: { sym: 'Al', strong: true, kind: 'element' },
    two: { sym: '2', strong: false, kind: 'number' }, three: { sym: '3', strong: false, kind: 'number' },
    four: { sym: '4', strong: false, kind: 'number' }, five: { sym: '5', strong: false, kind: 'number' },
    six: { sym: '6', strong: false, kind: 'number' }, seven: { sym: '7', strong: false, kind: 'number' },
    eight: { sym: '8', strong: false, kind: 'number' }, ten: { sym: '10', strong: false, kind: 'number' },
  },
  uz: {
    ha: { sym: 'H', strong: true, kind: 'letter' }, o: { sym: 'O', strong: false, kind: 'letter' },
    es: { sym: 'S', strong: true, kind: 'letter' }, en: { sym: 'N', strong: true, kind: 'letter' },
    se: { sym: 'C', strong: true, kind: 'letter' }, ka: { sym: 'K', strong: true, kind: 'letter' },
    el: { sym: 'L', strong: true, kind: 'letter' }, ef: { sym: 'F', strong: true, kind: 'letter' },
    pe: { sym: 'P', strong: true, kind: 'letter' }, a: { sym: 'A', strong: false, kind: 'letter' },
    u: { sym: 'U', strong: false, kind: 'letter' }, e: { sym: 'E', strong: false, kind: 'letter' },
    natriy: { sym: 'Na', strong: true, kind: 'element' }, kaliy: { sym: 'K', strong: true, kind: 'element' },
    kalsiy: { sym: 'Ca', strong: true, kind: 'element' }, magniy: { sym: 'Mg', strong: true, kind: 'element' },
    xlor: { sym: 'Cl', strong: true, kind: 'element' }, temir: { sym: 'Fe', strong: true, kind: 'element' },
    mis: { sym: 'Cu', strong: true, kind: 'element' }, rux: { sym: 'Zn', strong: true, kind: 'element' },
    alyuminiy: { sym: 'Al', strong: true, kind: 'element' },
    ikki: { sym: '2', strong: false, kind: 'number' }, uch: { sym: '3', strong: false, kind: 'number' },
    tort: { sym: '4', strong: false, kind: 'number' }, "to'rt": { sym: '4', strong: false, kind: 'number' },
    besh: { sym: '5', strong: false, kind: 'number' }, olti: { sym: '6', strong: false, kind: 'number' },
    yetti: { sym: '7', strong: false, kind: 'number' }, sakkiz: { sym: '8', strong: false, kind: 'number' },
    on: { sym: '10', strong: false, kind: 'number' },
  },
}

/** Две буквы подряд, означающие один символ: «эн а» → Na, «це а» → Ca, «це у» → Cu, «эф е» → Fe, «це эль» → Cl. */
const DIGRAPHS: Record<string, string> = {
  NA: 'Na', CA: 'Ca', CU: 'Cu', FE: 'Fe', CL: 'Cl', MG: 'Mg', AL: 'Al', ZN: 'Zn', BA: 'Ba', LI: 'Li', BE: 'Be', SI: 'Si',
  BR: 'Br', AG: 'Ag', HE: 'He', NE: 'Ne', MN: 'Mn', HG: 'Hg', PB: 'Pb', NI: 'Ni', CR: 'Cr', SN: 'Sn',
}
/** Металл + галоген/сера: «натрий хлор» → NaCl, «железо сера» → FeS (два названия элементов подряд). */
const SALT_METALS = new Set(['Na', 'K', 'Ca', 'Mg', 'Fe', 'Cu', 'Zn', 'Al', 'Ba', 'Li', 'Ag', 'Pb'])
const SALT_ANIONS = new Set(['Cl', 'Br', 'I', 'F', 'S'])

function buildFormula(tokens: FormulaToken[]): string {
  const syms: string[] = []
  for (const t of tokens) {
    if (t.kind === 'number') {
      if (syms.length === 0) syms.push(t.sym)
      else syms[syms.length - 1] += [...t.sym].map((d) => SUB[d] ?? d).join('')
      continue
    }
    const prev = syms[syms.length - 1]
    const pair = prev && prev.length === 1 && t.kind === 'letter' ? DIGRAPHS[prev + t.sym] : undefined
    if (pair) syms[syms.length - 1] = pair
    else syms.push(t.sym)
  }
  const out = syms.join('')
  if (out === 'PH') return 'pH'
  // «це а о аш два» → Ca(OH)₂: гидроксогруппа с индексом после металла.
  const hydroxide = out.match(/^([A-Z][a-z]?)OH([₂₃₄])$/)
  if (hydroxide && SALT_METALS.has(hydroxide[1]!)) return `${hydroxide[1]}(OH)${hydroxide[2]}`
  return out
}

function qualifiesAsFormula(tokens: FormulaToken[]): boolean {
  if (tokens.length < 2) return false
  const strong = tokens.filter((t) => t.strong).length
  const numbers = tokens.filter((t) => t.kind === 'number').length
  const letters = tokens.length - numbers
  if (tokens[0]!.kind === 'number') return false
  if (tokens.every((t) => t.kind === 'number')) return false
  // Только названия элементов («азот кислород водород») — это перечисление, а не формула;
  // исключение — соль «металл + галоген/сера» (натрий хлор → NaCl).
  if (tokens.every((t) => t.kind === 'element')) {
    return tokens.length === 2 && SALT_METALS.has(tokens[0]!.sym) && SALT_ANIONS.has(tokens[1]!.sym)
  }
  if (strong >= 2) return true
  return strong >= 1 && numbers >= 1 && letters >= 2
}

/** «аш два о» → H₂O (и т. п.) внутри текста. */
export function spokenFormulasToText(text: string, lang: TranscriptLang): string {
  const table = FORMULA_TOKENS[lang]
  const parts = text.split(/(\s+)/)
  const out: string[] = []
  let run: { tokens: FormulaToken[]; start: number } | null = null
  const flush = () => {
    if (!run) return
    if (qualifiesAsFormula(run.tokens)) {
      let end = out.length
      while (end > run.start && /^\s+$/.test(out[end - 1]!)) end--
      out.splice(run.start, end - run.start, buildFormula(run.tokens))
    }
    run = null
  }
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      if (!run) out.push(part)
      else out.push(part)
      continue
    }
    const key = norm(part)
    let token = key ? table[key] : undefined
    if (token?.joinOnly) {
      // Слабая буква входит в формулу только как вторая буква символа: «эн а» → Na, «и» между словами — союз.
      const prev = run?.tokens[run.tokens.length - 1]
      if (!prev || prev.kind !== 'letter' || prev.sym.length !== 1 || !DIGRAPHS[prev.sym + token.sym]) token = undefined
      // Пара букв дала символ элемента (Mg, Ca) — это уже сильный признак формулы.
      else token = { ...token, strong: true }
    }
    if (token) {
      if (!run) run = { tokens: [], start: out.length }
      run.tokens.push(token)
      out.push(part)
      continue
    }
    flush()
    out.push(part)
  }
  flush()
  return out.join('').replace(/\s{2,}/g, ' ')
}

/* ----------------------------------------------------------- (в) числа словами */

const RU_NUM: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
  десять: 10, одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16,
  семнадцать: 17, восемнадцать: 18, девятнадцать: 19, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50,
  шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, двести: 200, триста: 300, четыреста: 400,
  пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
}
const EN_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
}
const UZ_NUM: Record<string, number> = {
  nol: 0, bir: 1, ikki: 2, uch: 3, tort: 4, "to'rt": 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, toqqiz: 9, "to'qqiz": 9,
  on: 10, "o'n": 10, yigirma: 20, ottiz: 30, "o'ttiz": 30, qirq: 40, ellik: 50, oltmish: 60, yetmish: 70, sakson: 80,
  toqson: 90, "to'qson": 90, yuz: 100,
}
const NUM_TABLE: Record<TranscriptLang, Record<string, number>> = { ru: RU_NUM, en: EN_NUM, uz: UZ_NUM }

const UNITS: Record<string, string> = {
  грамм: 'г', грамма: 'г', граммов: 'г', гр: 'г', килограмм: 'кг', килограмма: 'кг', килограммов: 'кг',
  литр: 'л', литра: 'л', литров: 'л', миллилитр: 'мл', миллилитра: 'мл', миллилитров: 'мл',
  процент: '%', процента: '%', процентов: '%', градус: '°', градуса: '°', градусов: '°',
  gram: 'g', grams: 'g', liter: 'L', liters: 'L', litre: 'L', litres: 'L', percent: '%', degrees: '°',
  gramm: 'g', litr: 'L', foiz: '%', daraja: '°',
}
/** Слова, после которых число остаётся числом, но сами они не меняются («моль» не трогать). */
const KEEP_UNITS = new Set(['моль', 'молей', 'моля', 'mol', 'mole', 'moles', 'mol'])

export function spokenNumbersToDigits(text: string, lang: TranscriptLang): string {
  const table = NUM_TABLE[lang]
  const tokens = text.split(/(\s+)/)
  const out: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]!
    const key = norm(t)
    if (!(key in table)) {
      out.push(t)
      i++
      continue
    }
    // собираем цепочку числительных
    let j = i
    let value = 0
    let count = 0
    let hundreds = 0
    while (j < tokens.length) {
      const k = norm(tokens[j]!)
      if (/^\s+$/.test(tokens[j]!)) {
        j++
        continue
      }
      if (!(k in table)) break
      const n = table[k]!
      if (n === 100 && count > 0 && lang !== 'ru') hundreds = (value || 1) * 100, value = 0
      else value += n
      count++
      j++
    }
    value += hundreds
    while (j > i && /^\s+$/.test(tokens[j - 1]!)) j--
    // следующее не-пробельное слово
    let k = j
    while (k < tokens.length && /^\s+$/.test(tokens[k]!)) k++
    const nextKey = k < tokens.length ? norm(tokens[k]!) : ''
    const unit = UNITS[nextKey]
    const keep = KEEP_UNITS.has(nextKey)
    if (count >= 2 || unit || keep) {
      out.push(String(value))
      if (unit) {
        out.push(' ', unit)
        i = k + 1
      } else {
        i = j
      }
      continue
    }
    out.push(t)
    i++
  }
  return out.join('').replace(/\s{2,}/g, ' ')
}

/* --------------------------------------------------------------- (б) слова */

function fixWords(text: string): string {
  // сначала словосочетания из таблицы (2 слова)
  let t = text
  for (const [re, fix] of PHRASE_FIXES) {
    re.lastIndex = 0
    t = t.replace(re, (_m, pre: string) => `${pre}${fix}`)
  }
  return t
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s*$/.test(part)) return part
      const m = part.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}'’-]+)([^\p{L}\p{N}]*)$/u)
      if (!m) return part
      const [, pre, word, post] = m
      const fixed = correctTerm(word!)
      if (!fixed) return part
      const cased = /^\p{Lu}/u.test(word!) && !/^\p{Lu}/u.test(fixed) ? fixed[0]!.toUpperCase() + fixed.slice(1) : fixed
      return `${pre}${cased}${post}`
    })
    .join('')
}

/* ----------------------------------------------------------------- публичное */

/** Полная пост-коррекция финального транскрипта. */
export function fixTranscript(text: string, lang: TranscriptLang): string {
  const raw = text.trim()
  if (!raw) return raw
  let t = spokenFormulasToText(raw, lang)
  t = fixWords(t)
  t = spokenNumbersToDigits(t, lang)
  return t.replace(/\s{2,}/g, ' ').trim()
}

export interface SttAlternative {
  transcript: string
  confidence?: number
}

/* ------------------------------------------------- контекст диалога (для альтернатив) */

/** Слова текущей темы урока и недавних реплик учителя: ученик чаще всего отвечает ими же. */
const contextWords = new Map<string, number>()
let contextSeq = 0
const CONTEXT_LIMIT = 160
const STOP = new Set(['это', 'что', 'как', 'для', 'или', 'так', 'там', 'тут', 'его', 'она', 'они', 'оно', 'все', 'был', 'была', 'будет', 'есть'])

function addContext(text: string): void {
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    const w = norm(raw)
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue
    contextWords.set(w, ++contextSeq)
  }
  if (contextWords.size > CONTEXT_LIMIT) {
    const old = [...contextWords].sort((a, b) => a[1] - b[1]).slice(0, contextWords.size - CONTEXT_LIMIT)
    for (const [w] of old) contextWords.delete(w)
  }
}

/** Тема урока (название раздела/главы) — подсказка выбору альтернативы STT. */
export function setRecognitionTopic(...titles: (string | null | undefined)[]): void {
  for (const t of titles) if (t) addContext(t)
}

/** Фраза учителя ушла в озвучку — её слова становятся контекстом. */
export function noteTeacherSpeech(sentence: string): void {
  if (sentence) addContext(sentence)
}

/** Сбросить контекст (тесты / новый урок). */
export function resetRecognitionContext(): void {
  contextWords.clear()
  contextSeq = 0
}

/** Доля слов из контекста диалога. */
export function contextScore(text: string): number {
  const ws = text.split(/\s+/).map(norm).filter((w) => w.length >= 3)
  if (ws.length === 0 || contextWords.size === 0) return 0
  let hit = 0
  for (const w of ws) if (contextWords.has(w)) hit++
  return hit / ws.length
}

/** Доля «химических» слов (термины + слова вопроса + формулы) в тексте. */
export function chemScore(text: string): number {
  const ws = text.split(/\s+/).map(norm).filter(Boolean)
  if (ws.length === 0) return 0
  let hit = 0
  for (const w of ws) {
    if (CHEM_DICTIONARY.has(w) || QUESTION.has(w) || /^[a-z]{1,2}\d/.test(w)) hit++
    else if (FIX_MAP.has(w)) hit += 0.5
  }
  return hit / ws.length
}

/** Подробности выбора альтернативы (для отладки ?debugVoice=1 и тестов). */
export interface ScoredAlternative {
  transcript: string
  score: number
  chem: number
  context: number
  confidence: number
}

/**
 * Оценка альтернатив STT: химический словарь + контекст диалога + вероятность + порядок.
 * Chrome даёт confidence только первой альтернативе (у остальных 0) — для них берём 0,5 и
 * небольшую премию за ранг: без химических/контекстных слов выигрывает первая.
 */
export function scoreAlternatives(alts: readonly SttAlternative[]): ScoredAlternative[] {
  const out: ScoredAlternative[] = []
  alts.forEach((alt, rank) => {
    const text = alt.transcript?.trim()
    if (!text) return
    const confidence = typeof alt.confidence === 'number' && alt.confidence > 0 ? alt.confidence : 0.5
    const chem = chemScore(text)
    const context = contextScore(text)
    const score = chem + context * 0.5 + confidence * 0.6 + Math.max(0, 0.06 - rank * 0.02)
    out.push({ transcript: text, score, chem, context, confidence })
  })
  return out
}

/** Лучшая из альтернатив STT: химический счёт + контекст + вероятность. */
export function pickBestAlternative(alts: readonly SttAlternative[]): string {
  let best = ''
  let bestScore = -Infinity
  for (const a of scoreAlternatives(alts)) {
    if (a.score > bestScore) {
      bestScore = a.score
      best = a.transcript
    }
  }
  return best
}
