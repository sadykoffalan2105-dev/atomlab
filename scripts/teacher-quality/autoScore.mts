/**
 * Automatic quality checks for the local AI teacher answers (answers-<tag>.json from runAnswers.mts).
 *
 * Per answer:
 *   mention   — share of GOLD mustMention facts found (stem level; "a|b" alternatives, all words of an alternative)
 *   forbidden — mustNotMention hits (stem level or "re:<regex>")
 *   dup       — near-duplicate sentence ratio: content-stem Jaccard ≥ 0.6 with an earlier sentence, or a second
 *               definition of the same term («Наука химия изучает … Химия – это наука …»)
 *   offTopic  — ratio of content sentences not about the topic: fewer than 2 specific stems shared with the
 *               question (+ parent question), the gold facts and the retrieved definition sentence, unless a
 *               question stem is among the first 6 words (generic chemistry words do not count)
 *   hedge     — «Точного определения … нет. Вот что там сказано: …» on an answerable question
 *   length    — words of the spoken text: voice ≤ 70, chat ≤ 160 («подробнее»: 150 / 250)
 *   lang      — answer written in the question's locale (script + en/uz marker words). A labelled source quote of the
 *               Russian textbook in an en/uz answer («From the Kimyo 9 textbook (in Russian): «…»», «… (rus tilida): «…»»)
 *               is a citation, not answer text: it is ignored by lang and off-topic (an unlabelled Russian sentence still fails)
 *   citation  — a textbook/source chip is attached (answerable questions)
 *   noAnswer  — "no exact answer in my base" on an answerable question (fail); for unanswerable ones the
 *               honest no-answer + a suggestion are REQUIRED
 *   why       — "почему" questions: a cause connective (потому что / так как / из-за …) or an honest "no reason in base"
 *
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag baseline [--mode chat|voice] [--worst 10] [--quiet]
 *
 * Output: table + totals on stdout, .smoke/answer-quality/score-<tag>.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GOLD_QUESTIONS, goldById, type GoldQuestion } from './goldQuestions.mts'
import type { AnswerRecord, AnswersFile } from './runAnswers.mts'
import { contentStems, foldText, stemWord, stemsMatch, tokenizeWords } from '../../src/learn/brain/dualMode/textStems.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = path.join(ROOT, '.smoke', 'answer-quality')

const args = process.argv.slice(2)
const arg = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : def
}
const tag = arg('tag', 'baseline')!
const modeFilter = arg('mode')
const worstN = Number(arg('worst', '10'))
const quiet = args.includes('--quiet')
/**
 * --questions holdout → holdout-r3.mts; --questions <module>#<export> (e.g. holdout-r4.mts#HOLDOUT_R4) → any question set.
 */
const questionSet = arg('questions', 'gold')!
async function loadQuestionSet(spec: string): Promise<GoldQuestion[]> {
  if (spec === 'gold') return GOLD_QUESTIONS
  const [mod, exp] = spec === 'holdout' ? ['holdout-r3.mts', 'HOLDOUT_R3'] : spec.split('#')
  const loaded = (await import(`./${mod}`)) as Record<string, GoldQuestion[]>
  const set = exp ? loaded[exp] : Object.values(loaded).find((v) => Array.isArray(v))
  if (!set) throw new Error(`[score] no question export in ${spec}`)
  return set
}
const QUESTIONS: GoldQuestion[] = await loadQuestionSet(questionSet)
const questionById = (id: string): GoldQuestion | undefined => (questionSet === 'gold' ? goldById(id) : QUESTIONS.find((q) => q.id === id))

/* ----------------------------------------------------------------- limits */

const LIMITS = {
  voice: { brief: 70, more: 150 },
  chat: { brief: 160, more: 250 },
} as const
const DUP_JACCARD = 0.6
const OFF_TOPIC_FAIL = 0.2

/* -------------------------------------------------------- text utilities */

/** Service phrases of the composer (check questions, honest "no answer", suggestions) — not content. */
const TEMPLATE_RE: RegExp[] = [
  /^Сможешь (своими словами|теперь сам|пересказать это|назвать главное отличие|привести ещё один пример|привести еще один пример|перечислить эти|назвать, из каких частей)/iu,
  /^Can you (list these|name what it consists of)/i,
  /^(Bu guruhlarni|Bu omillarni|U nimalardan)/iu,
  /^(I have this answer only in my Russian textbook|Bu javob menda faqat rus tilidagi darslikda)/iu,
  /^Can you (retell it|name the main difference|think of one more example)/i,
  /^(Buni o‘z so‘zingiz|Asosiy farqni bitta gap|Yana bitta misolni|Endi nega)/iu,
  /^(My textbooks are in Russian|Darsliklarim rus tilida)\.$/iu,
  /^А теперь ты:/iu,
  /^Как бы ты сам объяснил/iu,
  /^Понятно\?( Если хочешь)?/iu,
  /^Если хочешь — приведу пример/iu,
  /^I can give an example or explain/i,
  /^Xohlasangiz, misol keltiraman/iu,
  /^Подсказка, а решишь ты сам/iu,
  /^Как это помогает с вопросом/iu,
  /^Попробуй сделать следующий шаг/iu,
  /^Честно скажу: точного ответа/iu,
  /^А точной причины в моей базе/iu,
  /^Точного определения .* в моей базе нет/iu,
  /^Зато могу рассказать/iu,
  /^Давай вернёмся к теме|^Давай вернемся к теме/iu,
  /^Или подключи умный ИИ/iu,
  /^Готового примера в моей базе/iu,
  /^Can you (explain|now explain)/i,
  /^Your turn:/i,
  /^How would you explain/i,
  /^Is that clear\?/i,
  /^Here is a hint/i,
  /^How does this help/i,
  /^Try the next step/i,
  /^To be honest, my knowledge base has no exact answer/i,
  /^The exact reason is not written/i,
  /^My knowledge base has no exact definition/i,
  /^I can tell you about/i,
  /^Let us go back to/i,
  /^Or connect the smart AI/i,
  /^I have no ready example/i,
  /nima ekanini o‘z so‘zingiz|o'z so'zingiz bilan/iu,
  /^Endi siz:/iu,
  /^Tushunarlimi\?/iu,
  /^Mana maslahat/iu,
  /bilan qanday bog‘liq|bilan qanday bog'liq/iu,
  /^Keyingi qadamni/iu,
  /^Rostini aytsam/iu,
  /^Aniq sababi bazamda/iu,
  /^Bazamda .* aniq ta’rifi yo‘q|^Bazamda .* aniq ta'rifi yo'q/iu,
  /^U yerda shunday yozilgan/iu,
  /^Lekin .* haqida aytib bera olaman/iu,
  /^Keling, .* mavzusiga qaytamiz/iu,
  /^Yoki aqlli SI ni ulang/iu,
  /^Bu savol bo‘yicha bazamda tayyor misol|^Bu savol bo'yicha bazamda tayyor misol/iu,
  /^Вот что там сказано/iu,
  // r10: book index answers (src/learn/brain/dualMode/bookIndexAnswer.ts)
  /^Сможешь сам записать (эту формулу|это уравнение)/iu,
  /^Какую из этих реакций разберём подробнее/iu,
  /^Откроешь этот параграф/iu,
  /^Here is what it says/i,
]
const LEAD_RE = /^(Почему так\?|Например:|Если проще:|Why is that\?|For example:|Put simply:|Nega shunday\?|Masalan:|Soddaroq aytganda:)\s*/iu

/** Full honest refusal of the composer ("Честно скажу: точного ответа … нет"). */
const NO_ANSWER_RE =
  /(точного ответа на .* в моей базе нет|нет в (моей )?базе|no exact answer|not in my knowledge base|bazamda aniq javob yo[‘']q)/iu
/** Partial hedge: "Точного определения «X» в моей базе нет. Вот что там сказано: …" + some text. */
const HEDGE_RE = /(Точного определения .* в моей базе нет|has no exact definition of|aniq ta[’']rifi yo[‘']q)/iu
/** Copula of a definition sentence (subject — key term). */
const DEF_COPULA_RE = /(\s[—–-]\s|\sэто\s|\sявля(ется|ются)\s|\sпредставля(ет|ют) собой|\sизуча(ет|ют)\s|называ(ется|ются|ют)|\s(is|are) (an?|the)\s)/iu
const SUGGESTION_RE =
  /(Зато могу рассказать|Давай верн[её]мся к теме|подключи умный ИИ|I can tell you about|Let us go back to|connect the smart AI|haqida aytib bera olaman|mavzusiga qaytamiz|aqlli SI ni ulang|провер(им|ь) по учебнику|check the textbook)/iu
const CAUSAL_RE =
  /(потому что|так как|поэтому|благодаря|из-за|вследствие|по причине|приводит к|объясняется|обусловл|позволя|в результате|под воздействием|because|since|therefore|due to|that is why|this is why|chunki|sababli|shuning uchun|tufayli)/iu
const NO_WHY_RE = /(точной причины в моей базе|exact reason is not written|aniq sababi bazamda)/iu

/**
 * Textbook noise that must never reach the student (judge r1 §4): exercise imperatives, «§ N» headings, task
 * variables, table separators, lost exponents / broken formulas, «Например:» before a definition, deictic
 * back-references to text the student never saw.
 */
const NOISE_RES: Array<[string, RegExp]> = [
  ['imperative', /(^|[.!?»]\s+)(\S+\s+){0,2}(Покажите|Нарисуйте|Определите|Вычислите|Найдите|Напишите|Изобразите|изобразите|Составьте|Рассчитайте)\b/u],
  // r10: «§ 32 «Серная кислота» (стр. 137)», «§ 19 (стр. 96)» — ссылка на учебник в ответе, а не заголовок параграфа
  ['§-heading', /(^|\s)§\s*\d+(?:\.\d+)?(?![\d.]|\s*(«|\(стр\.|учебник|[;,:)]|и\s|—))/u],
  ['task-variable', /(^|[\s:])x\s+\d|\s[xX]\s[+=→]|кислот[аеуы]\s+[A-DБВ]\b|\[[A-ZА-Я0-9,]{1,6}\]\s*[=-]/u],
  ['table-pipe', /\|/u],
  ['lost-exponent', /\d[,.]\d+\s*[∙·×*]\s*10(2[0-9]|1[0-9])\b/u],
  ['broken-formula', /\bH2SO(?![3-4₃₄])|\bh\d\b/u],
  ['example-label-on-definition', /(Например|For example|Masalan):[^.]{0,120}\sназыва(ется|ются|ют)\s/u],
  ['deictic', /(выше рассмотренных|вышерассмотренн|в этой реакции|данной реакции|этой модели|Эту активность)/iu],
  ['double-example', /Например:[^.]{0,80}\bнапример\b/iu],
  // judge r2 §5
  ['bare-number', /то есть\s+\d+[,.]?\d*\s*\./u],
  ['spaced-formula', /(?<![\p{L}\d])(?:[A-Z][a-z]?\d*){2,}\s\d(?=[\s,.;)])/u],
  ['ocr-garbage', /из расходов|Еезо|про текторы/u],
  ['cut-clause', /в сторону реакции\s*\./u],
  ['two-arrows-in-parens', /\(\s*[A-Z][^()]*→[^()]*[A-Z][^()]*→/u],
  ['example-not-instance', /Например:\s*(общая формула|[^.]{0,60}(зависит|усиливается|используют))/iu],
  ['grammar-adjunct-first', /—\s*это\s+в\s/u],
  ['en-why-inversion', /explain why (do|does|did)\b/iu],
  ['undefined-variable', /(^|[\s(])[nxk]\s*[<>≤≥]\s*\d/u],
  ['task-text', /(^|\.\s)(Пример|Задача)\s*\d*\.\s|Тестовые задания/u],
  // judge r6 §7: broken rewrites and structural spans of the corpus.
  ['dangling-relative', /котор(ая|ый|ое|ые|ую|ого|ых)\s*\.(\s|$)|(?<![\p{L}IVXLC]\s?|\p{L})(при|по|на|в|во|с|со|к|от|до|из|за|для|без|под|над)\s*\.(\s|$)/u],
  ['copula-discourse', /[—–]\s*это\s+(так|итак|например|таким образом)\s*,/iu],
  ['lab-title', /(лабораторн\S*|практическ\S*)\s+(работ\S*|заняти\S*)\s*(№\s*)?\d/iu],
  ['numbered-caption', /(^|[.!?]\s)\d+\s+[А-ЯЁ]\p{Ll}+\s+\p{Ll}/u],
  ['card-passport', /\p{L}{3,}:\s*[^;:.]{2,40};\s*\p{L}{3,}:\s/u],
]
/** judge r6 §7: the answer does not have the shape of its question type. */
const ENUMERATION_ONLY_RE = /(бывают|делятся на|различают)\s*:\s*[^.]+,[^.]+\./u
const MECHANISM_MARK_RE = /(соединя\S*ся\s+с|связыва\S*(ся)?\s+с|,\s*что\s+(ухудша|наруша|препятству)|потому что|так как|поскольку|благодаря|за сч[её]т|вследствие|обусловл|объясня\S*ся)/iu
const OUTCOME_MARK_RE = /(приводит|приводят)\s+к\s+(летальн|гибел|смерт|отравлен)|вызыва\S*\s+(отравлен|гибел|смерт)/iu
const COUNT_WORD: Record<string, number> = { два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6 }
/** «X (CO) — оксид.» — a class noun with no differentia. */
const THIN_DEFINITION_RE = /^[^—–.]{2,60}\s[—–]\s*\p{L}+\s*\.$/u
/** judge r2 §5: filler supporting sentences (uses, industry, ecology, «вы узнали») — off-topic even with topical stems. */
const FILLER_SENTENCE_RE = /(использу|применя|промышленност|народн\S* хозяйств|завод|комбинат|загрязня|вы узнали|мы знаем|в свою очередь делятся|парфюмер)/iu
/** «Катализатор — это вещества изменяющие» — plural predicate after a singular term. */
const AGREEMENT_RE = /^[А-ЯЁ][а-яё]*[^ыи\s]\s—\s*это\s+вещества\s+\S+ющие/u
/** Formula tokens of a text (for dialog-level example repeats). */
const formulaSet = (s: string) => new Set((s.match(/\b[A-Z][a-z]?[0-9₀-₉]*(?:[A-Z][a-z]?[0-9₀-₉]*)+\b/gu) ?? []).map((f) => f.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))))
/** Heading-like line without a finite verb («Влияние температуры на скорость химических реакций.»). */
function isVerbless(sentence: string): boolean {
  const bare = sentence.replace(/\([^)]*\)/g, ' ').replace(/[.!]\s*$/, '').trim()
  const words = bare.split(/\s+/).filter(Boolean)
  // r10: «Это реакция замещения.» — связка «это» без глагола, нормальная фраза
  if (words.length < 3 || words.length > 9 || /[—–=→:«]|\sэто\s|^Это\s|\d|[a-z]/iu.test(bare) || !/[а-яё]/iu.test(bare)) return false
  return !words.some((w) => w.length > 3 && /(ет|ит|ут|ют|ят|ат|ется|ются|ится|ятся|ался|ился|ал|ил|ел|ла|ли|ло|ть|ся|ен|ены|ан|аны|но|ны|ит)$/iu.test(w.replace(/[,;]$/, '')))
}

/** Too generic to make a sentence "on topic" by themselves. */
const GENERIC_STEMS = [
  'вещест', 'химическ', 'химич', 'реакци', 'элемент', 'свойств', 'соединен', 'образ', 'явля', 'называ', 'котор',
  'также', 'можно', 'други', 'один', 'одно', 'такж', 'част', 'основн', 'получа', 'использ', 'имеет', 'будет',
  'substan', 'chemic', 'reaction', 'element', 'propert', 'compound', 'modda', 'kimyo', 'reaksiya', 'element',
]
const isGeneric = (stem: string) => GENERIC_STEMS.some((g) => stem.startsWith(g) || (stem.length >= 5 && g.startsWith(stem)))

/** Labelled Russian source quote inside an en/uz answer (the quote may contain nested «…»). */
const SOURCE_QUOTE_RE = /\((?:in Russian|rus tilida)\):\s*«.*?»(?=\s+[\p{Lu}\d]|\s*$)/gu
const withoutSourceQuotes = (s: string) => s.replace(SOURCE_QUOTE_RE, '.')

const stripCitations = (s: string) => s.replace(/\[[^\]\n]{2,160}\]/gu, ' ').replace(/\s+/g, ' ').trim()

function splitSentences(text: string): string[] {
  // Do not split inside quoted titles: «Влияние давления, объема и температуры. Катализатор».
  const GLUE = '⁣'
  const protectedText = stripCitations(text).replace(/[«“„][^»”“]{0,240}[»”“]/gu, (m) => m.replace(/([.!?…])\s+/gu, `$1${GLUE}`))
  return protectedText
    // r10: «(стр. 115)», «с. 53» — сокращение, не конец фразы
    .split(/(?<=[.!?…])(?<!(?:^|[\s(])(?:стр|с|рис|см)\.)\s+(?=[\p{Lu}\d«"(])/u)
    .map((s) => s.replaceAll(GLUE, ' ').trim())
    .filter((s) => s.length > 1)
}

const isTemplate = (s: string) => TEMPLATE_RE.some((re) => re.test(s))

function countWords(text: string): number {
  return stripCitations(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Tokens of an expectation phrase; formulas/numbers/short tokens match exactly, words by stem. */
function tokenMatches(token: string, answerTokens: readonly string[], answerStems: readonly string[], compact: string): boolean {
  if (/\d/.test(token) || token.length <= 3) {
    if (answerTokens.includes(token)) return true
    // "al2o3" inside "al2o3↓", "22,4" split tokens are handled by the caller.
    return /\d/.test(token) && token.length >= 3 && compact.includes(token)
  }
  const st = stemWord(token)
  return answerStems.some((a) => stemsMatch(st, a)) || (st.length >= 6 && compact.includes(st))
}

type AnswerIndex = { tokens: string[]; stems: string[]; compact: string; folded: string; raw: string }

function indexAnswer(text: string): AnswerIndex {
  // «KMnO₄» = «KMnO4» for required mentions.
  const raw = stripCitations(text).replace(/[₀-₉]/gu, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
  const folded = foldText(raw)
  const tokens = tokenizeWords(raw)
  return { raw, folded, tokens, stems: tokens.map((t) => stemWord(t)), compact: folded.replace(/[^\p{L}\p{N}]/gu, '') }
}

function alternativeMatches(alt: string, idx: AnswerIndex): boolean {
  const a = alt.trim()
  if (!a) return false
  if (a.startsWith('re:')) {
    const re = new RegExp(a.slice(3), 'iu')
    return re.test(idx.raw) || re.test(idx.raw.replace(/ё/g, 'е'))
  }
  const toks = tokenizeWords(a)
  if (toks.length === 0) return false
  return toks.every((t) => tokenMatches(t, idx.tokens, idx.stems, idx.compact))
}

const entryMatches = (entry: string, idx: AnswerIndex) =>
  entry.startsWith('re:') ? alternativeMatches(entry, idx) : entry.split('|').some((alt) => alternativeMatches(alt, idx))

/** judge r4 §6.4: a multi-word forbidden phrase must occur as a phrase (adjacent tokens), not as a bag of words. */
function forbiddenMatches(entry: string, idx: AnswerIndex): boolean {
  if (entry.startsWith('re:')) return alternativeMatches(entry, idx)
  return entry.split('|').some((alt) => {
    const toks = tokenizeWords(alt.trim())
    if (toks.length <= 1) return alternativeMatches(alt, idx)
    for (let i = 0; i + toks.length <= idx.tokens.length; i++) {
      if (toks.every((t, k) => tokenMatches(t, [idx.tokens[i + k]!], [idx.stems[i + k]!], idx.tokens[i + k]!))) return true
    }
    return false
  })
}

/** judge r4 §6.3/6.5: school carbon count of a name next to its formula («виниловый спирт: CH2=CH–CH2–OH» is wrong). */
const CARBON_NAME: Array<[RegExp, number]> = [
  [/^(метил|метан)/u, 1], [/^(этил|этан|этен|этин|ацетилен|винил)/u, 2], [/^(пропил|пропан|пропен|пропин|аллил)/u, 3],
  [/^(бутил|бутан|бутен|бутин)/u, 4], [/^(пентил|пентан|пентен)/u, 5], [/^(гексан|гексен|бензол|фенол)/u, 6],
]
function nameFormulaMismatch(raw: string): boolean {
  // r10: «этан (CH₃-CH₃)» — подстрочные цифры тоже считаются (иначе CH₃ читался как один атом углерода без индекса)
  const text = raw.replace(/[₀-₉]/gu, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
  for (const m of text.matchAll(/(?<!\p{L})(\p{L}{4,})\S*\s*(?:спирт\S*|кислот\S*)?\s*[:(—–-]?\s*(C[A-Za-z0-9]*(?:\s*[=≡–—-]\s*[A-Z][A-Za-z0-9]*)*)/gu)) {
    const n = CARBON_NAME.find(([re]) => re.test(foldText(m[1]!)))?.[1]
    if (!n) continue
    const c = [...m[2]!.matchAll(/C(?![a-z])(\d*)/g)].reduce((acc, x) => acc + Number(x[1] || 1), 0)
    if (c > 0 && c !== n) return true
  }
  return false
}

/** judge r4 §6.5: example class by formula pattern (oxide = 2 elements incl. O; acidic oxide = non-metal oxide; acid = H…). */
function exampleClassWrong(question: string, text: string): boolean {
  const q = foldText(question)
  const formulas = [...new Set(text.replace(/[₀-₉]/gu, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).match(/\b(?:[A-Z][a-z]?\d*){2,}\b/g) ?? [])]
  if (formulas.length === 0) return false
  const els = (f: string) => [...f.matchAll(/([A-Z][a-z]?)/g)].map((x) => x[1]!)
  const oxide = (f: string) => new Set(els(f)).size === 2 && els(f).includes('O')
  const NONMETAL = new Set(['C', 'N', 'P', 'S', 'Si', 'Cl', 'Br', 'I', 'Se', 'B', 'Mn', 'Cr'])
  if (/оксид|oxide|oksid/u.test(q)) {
    if (!formulas.some(oxide)) return true
    if (/кислотн|acidic|kislotali/u.test(q)) return formulas.filter(oxide).some((f) => !els(f).some((e) => NONMETAL.has(e)))
    return false
  }
  return false
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const matchedA = a.filter((x) => b.some((y) => stemsMatch(x, y))).length
  const matchedB = b.filter((y) => a.some((x) => stemsMatch(x, y))).length
  const inter = Math.min(matchedA, matchedB)
  return inter / (a.length + b.length - inter)
}

function detectLang(text: string): { ru: number; lat: number; en: number; uz: number } {
  let ru = 0
  let lat = 0
  let en = 0
  let uz = 0
  const EN = new Set(['the', 'is', 'are', 'of', 'and', 'to', 'in', 'that', 'with', 'it', 'as', 'by', 'which', 'this', 'an', 'be', 'or', 'for', 'from', 'can', 'not'])
  const UZ = new Set(['va', 'bu', 'bilan', 'uchun', 'nima', 'emas', 'deb', 'ham', 'bir', 'hisoblanadi', 'ataladi', 'bo‘ladi', "bo'ladi", 'yo‘q', "yo'q", 'lekin', 'yoki', 'esa', 'qanday'])
  for (const raw of stripCitations(text).split(/\s+/)) {
    const w = raw.replace(/[^\p{L}\p{N}'‘’ʻ]/gu, '')
    if (w.length < 2 || /\d/.test(w)) continue
    if (/^[A-Z][a-z]?([A-Z][a-z]?)*$/.test(w) && w.length <= 4) continue // element symbols / formulas
    if (/[а-яё]/iu.test(w)) ru++
    else if (/[a-z]/i.test(w)) {
      lat++
      const lw = w.toLowerCase()
      if (EN.has(lw)) en++
      if (UZ.has(lw) || /[‘’ʻ']/.test(lw) || /(lar|larni|ning|dagi|lari)$/.test(lw)) uz++
    }
  }
  return { ru, lat, en, uz }
}

/** Answer in the question's locale; mixed-in foreign text (a Russian title inside an English answer) fails too. */
function languageOk(raw: string, locale: GoldQuestion['locale']): boolean {
  // r10: формулы и уравнения («NaNO₃ + H₂SO₄ → …») — не английский текст в русском ответе
  const text = locale === 'ru' ? raw.replace(/(?<![A-Za-z])(?:\d*(?:[A-Z][a-z]?|[()[\]])[₀-₉\d⁺⁻]*)+(?![a-z])/g, ' ') : raw
  const { ru, lat, en, uz } = detectLang(text)
  const total = ru + lat
  if (total === 0) return false
  if (locale === 'ru') return ru / total >= 0.7
  if (lat / total < 0.85) return false
  return locale === 'en' ? en >= uz : uz > en || (uz > 0 && en === 0)
}

/* ------------------------------------------------------------------ checks */

export interface AnswerScore {
  id: string
  mode: 'chat' | 'voice'
  group: string
  type: GoldQuestion['type']
  question: string
  unanswerable: boolean
  score: number
  mention: { found: number; total: number; missing: string[] }
  forbidden: string[]
  dupRatio: number
  offTopicRatio: number
  offTopicSentences: string[]
  words: number
  wordLimit: number
  langOk: boolean
  citation: boolean
  noAnswer: boolean
  /** "Точного определения … нет. Вот что там сказано: …" */
  hedge: boolean
  suggestion: boolean
  /** Sentences re-defining the key term after the first definition. */
  redefinitions: number
  whyOk: boolean | null
  /** Textbook noise patterns found (imperatives, «§ N», task data, lost exponents …). */
  noise: string[]
  /** Follow-up repeats a sentence of the previous answer in the same dialog (Jaccard ≥ 0.8). */
  dialogRepeat: boolean
  /** "No reason in my base" together with a causal sentence (self-contradiction). */
  contradiction: boolean
  /** en/uz: Russian quote longer than 1 sentence or > 40% of the words. */
  russianHeavy: boolean
  fails: string[]
  ms: number
  excerpt: string
}

function groupOf(q: GoldQuestion): string {
  if (q.unanswerable) return 'unans'
  if (q.followUpOf) return 'follow'
  if (q.locale !== 'ru') return q.locale
  return `g${q.grade}`
}

/** Definition sentence of the best retrieved hits that mentions the question topic. */
function retrievedDefinitionStems(rec: AnswerRecord, qStems: readonly string[]): string[] {
  const DEF = /(\s[—–-]\s|\sэто\s|называ|явля(ется|ются)|изуча(ет|ют)|представля)/iu
  for (const h of rec.hits.slice(0, 3)) {
    for (const s of h.text.split(/(?<=[.!?])\s+|\n+/u)) {
      if (!DEF.test(s)) continue
      const st = contentStems(s)
      if (qStems.some((q) => !isGeneric(q) && st.some((x) => stemsMatch(q, x)))) return st
    }
  }
  return []
}

/** Drop the question echoed in quotes («…», “…») by the composer templates — it is not answer content. */
function withoutEchoedQuestion(text: string, question: string): string {
  const fq = foldText(question).replace(/[?!.…\s]+$/u, '').replace(/\s+/g, ' ')
  return text.replace(/[«“]([^»”]{2,240})[»”]/gu, (m, inner: string) => {
    const fi = foldText(inner).replace(/[?!.…\s]+$/u, '').replace(/\s+/g, ' ')
    return fi.length >= 3 && (fq.startsWith(fi) || fi.startsWith(fq)) ? ' ' : m
  })
}

function scoreAnswer(rec: AnswerRecord, q: GoldQuestion, parentRec?: AnswerRecord): AnswerScore {
  const idx = indexAnswer(withoutEchoedQuestion(rec.text || rec.answer, q.question))
  const sentences = splitSentences(q.locale === 'ru' ? rec.text || rec.answer : withoutSourceQuotes(rec.text || rec.answer))
  const contentSentences = sentences
    .filter((s) => !isTemplate(s) && !(q.locale !== 'ru' && /^(From the .{3,60}|.{0,24}(darsligidan|ma’lumotnomasidan))\s*\.$/u.test(s)))
    .map((s) => s.replace(LEAD_RE, ''))

  // mention coverage
  const missing = q.mustMention.filter((m) => !entryMatches(m, idx))
  const mentionFound = q.mustMention.length - missing.length
  // forbidden
  const forbidden = (q.mustNotMention ?? []).filter((m) => forbiddenMatches(m, idx))

  const parent = q.followUpOf ? questionById(q.followUpOf) : undefined
  const qStems = [...new Set([...contentStems(q.question), ...(parent ? contentStems(parent.question) : []), ...contentStems(rec.query)])]
  const qSpecific = qStems.filter((s) => !isGeneric(s))

  // duplicates: near-duplicate sentences (Jaccard) or a second definition of the same key term
  // («Наука химия изучает … Химия – это наука о …»).
  const stemsPer = contentSentences.map((s) => contentStems(s))
  const DEF_FILLER = ['наук', 'термин', 'понят', 'слов', 'science', 'term']
  /** Defined term of a definition sentence about the question topic ("Наука химия изучает" → [наук, хими]). */
  const definedTerm = contentSentences.map((s): string[] | null => {
    const m = DEF_COPULA_RE.exec(s)
    if (!m || qSpecific.length === 0) return null
    const named = /называ/iu.test(m[0]) ? s.slice(m.index + m[0].length).split(/[,.;:(]/u)[0] ?? '' : ''
    const term = contentStems(named || (m.index <= 60 ? s.slice(0, m.index) : ''))
    if (term.length === 0 || term.length > 4) return null
    const isKey = (x: string) => qSpecific.some((k) => stemsMatch(k, x))
    const filler = (x: string) => DEF_FILLER.some((f) => x.startsWith(f))
    if (!term.some(isKey) || !term.every((x) => isKey(x) || filler(x))) return null
    return term.filter((x) => !filler(x))
  })
  const sameTerm = (a: readonly string[], b: readonly string[]) =>
    a.every((x) => b.some((y) => stemsMatch(x, y))) && b.every((y) => a.some((x) => stemsMatch(x, y)))
  let dups = 0
  let redefinitions = 0
  stemsPer.forEach((st, i) => {
    // Compare answers: «Чугун – сплав…более 2,14 %. Сталь – сплав…менее 2,14 %.» are two sides, not a repetition —
    // the sentences differ in a question term or in a contrast pair (более/менее, полярн/неполярн, сильн/слаб …).
    const CONTRAST = [['более', 'менее'], ['больше', 'меньше'], ['одинаков', 'различн'], ['сильн', 'слаб'], ['полярн', 'неполярн'], ['прост', 'сложн'], ['физическ', 'химическ']]
    const sides = (prev: readonly string[]) => {
      if (q.type !== 'compare') return false
      const onlyHere = st.filter((x) => !prev.some((y) => stemsMatch(x, y)))
      const onlyPrev = prev.filter((y) => !st.some((x) => stemsMatch(x, y)))
      const diff = [...onlyHere, ...onlyPrev]
      return diff.some((x) => qSpecific.some((k) => stemsMatch(k, x))) || CONTRAST.some(([p1, p2]) => diff.some((x) => x.startsWith(p1!)) && diff.some((x) => x.startsWith(p2!)))
    }
    const near = st.length >= 3 && stemsPer.slice(0, i).some((prev) => prev.length >= 3 && jaccard(st, prev) >= DUP_JACCARD && !sides(prev))
    const term = definedTerm[i]
    const redefined = Boolean(term && definedTerm.slice(0, i).some((prev) => prev && sameTerm(term, prev)))
    if (redefined) redefinitions++
    if (near || redefined) dups++
  })
  const dupRatio = contentSentences.length ? dups / contentSentences.length : 0

  // off-topic: a content sentence needs ≥ 2 topical stems (question stems + gold facts + retrieved
  // definition), or 1 question stem among its first 6 words (the sentence is ABOUT the term), or 1 for an
  // example line; generic chemistry words do not count. «IUPAC номенклатура – … описания химии» is off-topic.
  const factStems = q.mustMention.flatMap((m) => m.split('|').flatMap((alt) => tokenizeWords(alt).filter((t) => t.length >= 4).map((t) => stemWord(t))))
  const defStems = retrievedDefinitionStems(rec, qStems)
  const extra = [...new Set([...factStems, ...defStems])].filter((s) => !isGeneric(s) && !qSpecific.some((k) => stemsMatch(k, s)))
  const offTopicSentences: string[] = []
  contentSentences.forEach((sentence, i) => {
    const st = stemsPer[i]!
    if (st.length < 3) return
    const qHits = qSpecific.filter((k) => st.some((x) => stemsMatch(k, x))).length
    const xHits = extra.filter((k) => st.some((x) => stemsMatch(k, x))).length
    const exampleLine = /^(Например|For example|Masalan|Пример из учебника|An example from the textbook|Darslikdagi misol)/iu.test(sentences.find((s) => s.endsWith(sentence)) ?? '')
    const head = contentStems(sentence.split(/\s+/).slice(0, 6).join(' '))
    const keyInHead = qSpecific.some((k) => head.some((x) => stemsMatch(k, x)))
    // Worked calculation line of a calc answer («Mr(H2O) = 2·Ar(H) + Ar(O) = 2·1 + 16 = 18.»).
    const calcLine = q.type === 'calc' && /=.*\d/u.test(sentence) && /\d\s*[·•*×+−-]\s*\d|=\s*\d/u.test(sentence)
    const onTopic = calcLine || qHits + xHits >= 2 || (qHits >= 1 && keyInHead) || ((exampleLine || qSpecific.length + extra.length <= 1) && qHits + xHits >= 1)
    if (!onTopic) offTopicSentences.push(sentence)
  })
  const offTopicRatio = contentSentences.length ? offTopicSentences.length / contentSentences.length : 0

  // length
  const words = countWords(rec.text || rec.answer)
  const detail = q.detail === 'more' ? 'more' : 'brief'
  const wordLimit = LIMITS[rec.mode][detail]

  const langOk = languageOk(q.locale === 'ru' ? rec.text || rec.answer : withoutSourceQuotes(rec.text || rec.answer), q.locale)
  // Chips the student sees (the app attaches them only to confident answers).
  const citation = /\[(Kimyo|Источник|Source|Manba)[^\]]*\]/u.test(rec.answer)
  const noAnswer = !rec.confident || NO_ANSWER_RE.test(stripCitations(rec.answer))
  const hedge = !noAnswer && HEDGE_RE.test(rec.answer)
  const suggestion = SUGGESTION_RE.test(rec.answer)
  // judge r6 §7.6: an outcome («приводит к летальному исходу») is not the mechanism a why-question asks for.
  const whyOk =
    q.type === 'why'
      ? (CAUSAL_RE.test(stripCitations(rec.text)) || NO_WHY_RE.test(rec.text)) &&
        !(OUTCOME_MARK_RE.test(stripCitations(rec.text)) && !MECHANISM_MARK_RE.test(stripCitations(rec.text)))
      : null

  // Noise (judge r1 §4): regex patterns over the whole spoken text + verbless heading-like content sentences.
  const spoken = stripCitations(rec.text || rec.answer)
  const noise = NOISE_RES.filter(([, re]) => re.test(spoken)).map(([name]) => name)
  if (q.locale === 'ru' && contentSentences.some((s) => isVerbless(s))) noise.push('verbless')
  if (q.locale === 'ru' && AGREEMENT_RE.test(spoken)) noise.push('agreement')
  // judge r3 §6: dangling deictic in a supporting sentence, one-item list lead-in, OCR classes, paraphrase by formula set,
  // check question that does not fit the kind, term dumps, example qualifier, calc without a computed number.
  if (q.locale === 'ru' && contentSentences.slice(1).some((s) => /(?<!\p{L})(с ним|с ней|к нему|такой же|таким же|то же самое)(?!\p{L})/iu.test(s))) noise.push('dangling-deictic')
  if (/(следующими|несколькими|различными)\s+(способами|методами|путями)\s*:\s*[^,;:]+[.]/u.test(spoken) && !/:\s*[^.]*(,|\sи\s|\sили\s)/u.test(spoken)) noise.push('one-item-lead-in')
  if (/[№›]|(?<![\p{L}\d])[A-Z][a-z]?\d*\+\s+\+|[а-яё]{2}\.[А-ЯЁ][а-яё]|\s[A-Z][A-Za-z\d]*\s+[–-]\s*=/u.test(spoken)) noise.push('ocr-class')
  {
    const fset = (s: string) => [...new Set(s.match(/\b(?:[A-Z][a-z]?\d*){2,}\b/g) ?? [])].sort().join(',')
    const sets = contentSentences.map(fset).filter(Boolean)
    // r10: ответ «формула + где в учебнике» повторяет формулу вещества по замыслу
    if (new Set(sets).size < sets.length && q.type !== 'formula' && q.type !== 'location') noise.push('paraphrase-formula-set')
  }
  if (q.locale === 'ru' && /какие\s+(бывают|есть)|виды|типы/iu.test(q.question) && /главное отличие/iu.test(spoken)) noise.push('check-kind')
  if (!q.unanswerable && /(My textbooks are in Russian|Darsliklarim rus tilida)/iu.test(spoken)) noise.push('term-dump')
  if (/осад/iu.test(q.question) && /(пример|example|misol)/iu.test(q.question) && !/↓|осад/iu.test(spoken)) noise.push('example-qualifier')
  // Filler supporting sentence (not the first one) that the question did not ask about.
  if (q.locale === 'ru' && !FILLER_SENTENCE_RE.test(q.question) && contentSentences.slice(1).some((s) => FILLER_SENTENCE_RE.test(s))) noise.push('filler')
  // judge r4 §6.3/6.5: lab-procedure steps, name↔formula mismatch, example class by formula pattern, flattened OCR table.
  if (q.locale === 'ru' && /(?<!\p{L})(добавить|прилить|налить|поместить|нагреть)(?!\p{L})|в\s+пробирк\S*\s+(добав|прилив|налива)|\d+\s*капл|Ход\s+работы/iu.test(spoken)) noise.push('lab-procedure')
  if (nameFormulaMismatch(spoken)) noise.push('name-formula')
  if (q.type === 'example' && exampleClassWrong(q.question, withoutSourceQuotes(spoken))) noise.push('example-class')
  if (/\p{Ll}{3,}-\s+(?!и\s|или\s)\p{Ll}{3,}/u.test(spoken) || /(\p{L}{3,}\s+\p{L}{2,}\s+\p{L}{3,})\s(?:[^.]*\s)?\1/u.test(spoken)) noise.push('ocr-table')
  // judge r6 §7.2: the answer must have the shape of its question type.
  if (q.type === 'compare' && contentSentences.length > 0 && contentSentences.every((x) => ENUMERATION_ONLY_RE.test(x))) noise.push('compare-enumeration')
  if (q.type === 'example' && /(?<![\p{L}\d])[A-Z]{1,2}(\s*\+\s*[A-Z]{1,2})*\s*(→|=)/u.test(spoken) && !/[A-Z][a-z]?[\d₀-₉]/u.test(spoken)) noise.push('example-letter-scheme')
  {
    const heads = spoken.match(/дел(?:ятся|ится)\s+на\s+(два|две|три|четыре|пять|шесть|\d)\s+(тип|вид|групп|класс)\S*/u)
    const want = heads ? (COUNT_WORD[heads[1]!] ?? Number(heads[1])) : 0
    if (want && (spoken.slice(spoken.indexOf(heads![0]) + heads![0].length).match(/,/gu) ?? []).length < want - 1) noise.push('classify-no-heads')
  }
  if (q.type === 'definition' && contentSentences.length > 0 && THIN_DEFINITION_RE.test(contentSentences[0]!.trim())) noise.push('thin-definition')
  // judge r7 §7: the answer must be about the asked term, fit a detection/why question and open with a real sentence.
  {
    // 1) A definition of a sub-class: «Двойные соли — соли, …» for «Что такое соли?» (head term + an extra modifier).
    const head = q.locale === 'ru' ? q.question.match(/что так(?:ое|ая|ой|ие)\s+([а-яё-]{4,}(?:\s+[а-яё-]{4,})?)/iu)?.[1] : undefined
    const headWord = head ? head.split(/\s+/).pop()!.replace(/ё/g, 'е').slice(0, 5) : ''
    const first = contentSentences[0]?.trim() ?? ''
    if (q.type === 'definition' && headWord.length >= 4) {
      const sub = first.match(/^([А-ЯЁ][а-яё]{2,})(?:[а-яё]*)\s+([а-яё-]{4,})\s*(?:[—–-]|это|—\s*это)/u)
      if (sub && sub[2]!.replace(/ё/g, 'е').startsWith(headWord) && !q.question.replace(/ё/g, 'е').toLowerCase().includes(sub[1]!.toLowerCase().slice(0, 5))) noise.push('head-term-modifier')
    }
    // 2) A detection question is answered by a reagent + an observable sign.
    if (/как\s+(распозна|обнаружи|определ)/iu.test(q.question) && !/(кислот|щелоч|реактив|индикатор|AgNO3|BaCl2|раствор\S*\s+\p{L})/iu.test(spoken)) noise.push('detect-no-reagent')
    if (/как\s+(распозна|обнаружи|определ)/iu.test(q.question) && !/(осад|↓|↑|цвет|окраш|вскипан|запах|выделя\S*\s+газ|помутнен)/iu.test(spoken)) noise.push('detect-no-sign')
    // 3) A «why» answer that only restates the premise of the question («Почему алмаз твёрдый?» → «самое твёрдое»).
    if (q.type === 'why' && q.locale === 'ru' && /(?<!\p{L})сам\p{Ll}{1,3}\s+\p{L}{4,}/u.test(first) && !CAUSAL_RE.test(first)) {
      const qStems = contentStems(q.question)
      const own = contentStems(first)
      if (own.length > 0 && own.filter((s) => qStems.some((x) => x.startsWith(s.slice(0, 4)) || s.startsWith(x.slice(0, 4)))).length / own.length >= 0.6) noise.push('why-premise')
    }
    // 4) Opening sentence: a subjectless rule fragment or a rhetorical lead-in.
    if (q.locale === 'ru' && /^(Счита|Определя|Выража|Вычисля|Рассчитыва|Измеря|Обознача|Записыва)\p{Ll}*(ется|ются)\s/u.test(first)) noise.push('verb-initial-opening')
    if (q.locale === 'ru' && /^(Все мы знаем|Всем известно|Как известно|Каждый (знает|из нас)|Мы (часто|все)|В (повседневной|обыденной) жизни)/u.test(first)) noise.push('rhetorical-opening')
    // 5) OCR inside a formula: a lower-case element symbol, a digit split off its element.
    if (/(?<![\p{L}\d])(ca|cu|na|fe|mg|al|zn|ba)\(/u.test(spoken) || /[A-Z][a-z]?\s\d[A-Z]/u.test(spoken)) noise.push('ocr-formula')
  }
  // A follow-up must not repeat the previous answer of the dialog.
  const parentSentences = parentRec ? splitSentences(parentRec.text).filter((s) => !isTemplate(s)).map((s) => contentStems(s.replace(LEAD_RE, ''))) : []
  const parentFormulas = parentRec ? formulaSet(stripCitations(parentRec.text)) : new Set<string>()
  const ownFormulas = formulaSet(spoken)
  const dialogRepeat =
    stemsPer.some((st) => st.length >= 3 && parentSentences.some((p) => p.length >= 3 && jaccard(st, p) >= 0.8)) ||
    // The same example (formula set) again, even in other words.
    (ownFormulas.size > 0 && [...ownFormulas].every((f) => parentFormulas.has(f))) ||
    // en/uz: the same Russian source quote again.
    (q.locale !== 'ru' && !!parentRec && (spoken.match(/«[^«»]{20,}»/u)?.[0] ?? '#') === (stripCitations(parentRec.text).match(/«[^«»]{20,}»/u)?.[0] ?? '$'))
  // "No reason in my base" + a causal sentence in the same answer.
  const contradiction =
    NO_WHY_RE.test(rec.text) && contentSentences.some((s) => !NO_WHY_RE.test(s) && !/^(Сможешь|Can you|Endi)/u.test(s) && CAUSAL_RE.test(s))
  // en/uz: the labelled Russian quote is a citation — one sentence, ≤ 40% of the words.
  let russianHeavy = false
  if (q.locale !== 'ru') {
    const quotes = [...spoken.matchAll(SOURCE_QUOTE_RE)].map((m) => m[0].replace(/^\((?:in Russian|rus tilida)\):\s*«|»$/gu, ''))
    const quoteWords = quotes.reduce((acc, s) => acc + countWords(s), 0)
    const quoteSentences = quotes.reduce((acc, s) => acc + s.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u).filter((x) => x.trim().length > 3).length, 0)
    // judge r6 §7.4: an answer that is only the labelled Russian quote (en as well as uz) — the boilerplate
    // «I have this answer only in my Russian textbook» is not native content.
    const nativeWords = countWords(
      contentSentences.filter((x) => !SOURCE_QUOTE_RE.test(x) && !/(only in my Russian textbook|faqat rus tilidagi darslikda)/iu.test(x)).join(' '),
    )
    russianHeavy = quoteSentences > 1 || nativeWords < 6
  }

  const fails: string[] = []
  let score: number
  if (q.unanswerable) {
    if (!noAnswer) fails.push(hedge ? 'half-honest (hedge + unrelated text)' : 'not-honest (answered from unrelated text)')
    if (!suggestion) fails.push('no-suggestion')
    if (forbidden.length) fails.push(`forbidden: ${forbidden.join('; ')}`)
    if (!langOk) fails.push('lang')
    if (words > wordLimit) fails.push(`length ${words}>${wordLimit}`)
    score = 100 * ((noAnswer ? 0.6 : hedge ? 0.25 : 0) + (suggestion ? 0.2 : 0) + (forbidden.length ? 0 : 0.1) + (langOk ? 0.1 : 0))
  } else {
    const cov = q.mustMention.length ? mentionFound / q.mustMention.length : 1
    if (rec.ms < 0) fails.push('crashed')
    if (noAnswer) fails.push('no-answer')
    if (hedge) fails.push('false-hedge («нет определения» + answer)')
    if (cov < 1) fails.push(`mention ${mentionFound}/${q.mustMention.length} (missing: ${missing.join('; ')})`)
    if (forbidden.length) fails.push(`forbidden: ${forbidden.join('; ')}`)
    if (dupRatio > 0) fails.push(`dup ${Math.round(dupRatio * 100)}%`)
    if (offTopicRatio > OFF_TOPIC_FAIL) fails.push(`off-topic ${Math.round(offTopicRatio * 100)}%`)
    if (words > wordLimit) fails.push(`length ${words}>${wordLimit}`)
    if (!langOk) fails.push('lang')
    if (!citation) fails.push('no-citation')
    if (whyOk === false) fails.push('why: no cause')
    if (noise.length) fails.push(`noise: ${noise.join(', ')}`)
    if (dialogRepeat) fails.push('dialog-repeat')
    if (contradiction) fails.push('hedge+cause contradiction')
    if (russianHeavy) fails.push('russian-heavy quote')
    const parts: Array<[number, number]> = [
      [0.4, cov],
      [0.12, forbidden.length ? 0 : 1],
      [0.1, 1 - Math.min(1, dupRatio * 2)],
      [0.1, 1 - Math.min(1, offTopicRatio * 2)],
      [0.05, words <= wordLimit ? 1 : Math.max(0, 1 - (words - wordLimit) / wordLimit)],
      [0.1, langOk ? 1 : 0],
      [0.05, citation ? 1 : 0],
      [0.08, whyOk === null ? (noAnswer ? 0 : 1) : whyOk ? 1 : 0],
    ]
    score = 100 * parts.reduce((acc, [w, v]) => acc + w * v, 0)
    if (hedge) score -= 5
    if (noise.length) score -= 8
    if (dialogRepeat) score -= 8
    if (contradiction) score -= 5
    if (russianHeavy) score -= 4
    if (noAnswer) score = Math.min(score, 25)
    // judge r4 §6.2: a refusal / hedge while a required fact is in the top-3 retrieved hits = hard fail with 0 points.
    const hitIdx = (rec.hits ?? []).slice(0, 3).map((h) => indexAnswer(h.text))
    const retrievable = q.mustMention.some((m) => hitIdx.some((hi) => entryMatches(m, hi)))
    if ((noAnswer || (hedge && cov < 1) || (whyOk && NO_WHY_RE.test(rec.text) && cov < 1)) && retrievable) {
      fails.push('false-no-answer (fact in top-3 hits)')
      score = 0
    }
  }

  const flat = stripCitations(rec.text || rec.answer)
  return {
    id: rec.id,
    mode: rec.mode,
    group: groupOf(q),
    type: q.type,
    question: parent ? `${parent.question} → ${q.question}` : q.question,
    unanswerable: Boolean(q.unanswerable),
    score: Math.round(score * 10) / 10,
    mention: { found: mentionFound, total: q.mustMention.length, missing },
    forbidden,
    dupRatio: Math.round(dupRatio * 100) / 100,
    offTopicRatio: Math.round(offTopicRatio * 100) / 100,
    offTopicSentences,
    words,
    wordLimit,
    langOk,
    citation,
    noAnswer,
    hedge,
    suggestion,
    redefinitions,
    whyOk,
    noise,
    dialogRepeat,
    contradiction,
    russianHeavy,
    fails,
    ms: rec.ms,
    excerpt: flat.length > 300 ? `${flat.slice(0, 299)}…` : flat,
  }
}

/* -------------------------------------------------------------------- report */

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—')
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r1 = (x: number) => Math.round(x * 10) / 10

function totals(rows: AnswerScore[]) {
  const ans = rows.filter((r) => !r.unanswerable)
  const un = rows.filter((r) => r.unanswerable)
  return {
    n: rows.length,
    score: r1(avg(rows.map((r) => r.score))),
    answerableScore: r1(avg(ans.map((r) => r.score))),
    fullyCorrect: ans.filter((r) => r.fails.length === 0).length,
    mentionCoverage: r1(100 * avg(ans.map((r) => (r.mention.total ? r.mention.found / r.mention.total : 1)))),
    mentionAll: ans.filter((r) => r.mention.found === r.mention.total).length,
    forbiddenHits: ans.filter((r) => r.forbidden.length > 0).length,
    withDup: ans.filter((r) => r.dupRatio > 0).length,
    withRedefinition: ans.filter((r) => r.redefinitions > 0).length,
    dupRatio: r1(100 * avg(ans.map((r) => r.dupRatio))),
    offTopicRatio: r1(100 * avg(ans.map((r) => r.offTopicRatio))),
    offTopicFail: ans.filter((r) => r.offTopicRatio > OFF_TOPIC_FAIL).length,
    tooLong: ans.filter((r) => r.words > r.wordLimit).length,
    avgWords: r1(avg(ans.map((r) => r.words))),
    langOk: ans.filter((r) => r.langOk).length,
    citation: ans.filter((r) => r.citation).length,
    falseNoAnswer: ans.filter((r) => r.noAnswer).length,
    falseHedge: ans.filter((r) => r.hedge).length,
    whyOk: `${ans.filter((r) => r.whyOk === true).length}/${ans.filter((r) => r.whyOk !== null).length}`,
    noise: ans.filter((r) => r.noise.length > 0).length,
    dialogRepeat: ans.filter((r) => r.dialogRepeat).length,
    contradiction: ans.filter((r) => r.contradiction).length,
    russianHeavy: ans.filter((r) => r.russianHeavy).length,
    answerable: ans.length,
    unansHonest: `${un.filter((r) => r.noAnswer && r.suggestion).length}/${un.length}`,
    avgMs: Math.round(avg(rows.filter((r) => r.ms >= 0).map((r) => r.ms))),
    maxMs: Math.max(0, ...rows.map((r) => r.ms)),
  }
}

function printTotals(label: string, t: ReturnType<typeof totals>) {
  console.log(
    `${label.padEnd(12)} n=${String(t.n).padStart(3)} score ${String(t.score).padStart(5)} | answerable ${t.answerable}: ` +
      `all-checks ${t.fullyCorrect} (${pct(t.fullyCorrect, t.answerable)}), mention ${t.mentionCoverage}% (all ${t.mentionAll}), ` +
      `no-answer ${t.falseNoAnswer}, hedge ${t.falseHedge}, forbidden ${t.forbiddenHits}, dup ${t.withDup} (redef ${t.withRedefinition}, avg ${t.dupRatio}%), off-topic>${OFF_TOPIC_FAIL * 100}% ${t.offTopicFail} (avg ${t.offTopicRatio}%), ` +
      `too-long ${t.tooLong} (avg ${t.avgWords} w), lang ${pct(t.langOk, t.answerable)}, cite ${pct(t.citation, t.answerable)}, why ${t.whyOk}, noise ${t.noise}, dialog-repeat ${t.dialogRepeat}, contradiction ${t.contradiction}, ru-heavy ${t.russianHeavy} | unans honest ${t.unansHonest} | ${t.avgMs} ms avg, ${t.maxMs} max`,
  )
}

function main(): void {
  const file = path.join(OUT_DIR, `answers-${tag}.json`)
  if (!fs.existsSync(file)) throw new Error(`No ${path.relative(ROOT, file)} — run runAnswers.mts --tag ${tag} first`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as AnswersFile
  // Validate regex expectations up front (a typo should not silently pass).
  for (const q of QUESTIONS) for (const m of [...q.mustMention, ...(q.mustNotMention ?? [])]) if (m.startsWith('re:')) new RegExp(m.slice(3), 'iu')

  const rows: AnswerScore[] = []
  for (const rec of data.items) {
    if (modeFilter && rec.mode !== modeFilter) continue
    const q = questionById(rec.id)
    if (!q) continue
    const parentRec = q.followUpOf ? data.items.find((x) => x.id === q.followUpOf && x.mode === rec.mode) : undefined
    rows.push(scoreAnswer(rec, q, parentRec))
  }

  if (!quiet) {
    console.log(`\n[score] tag=${tag} ctx=${data.ctxMode} answers=${rows.length} (${data.generatedAt})\n`)
    console.log('id       mode  grp    type        score  ment  forb dup  off  words   lang cite  ms  fails')
    for (const r of rows) {
      console.log(
        [
          r.id.padEnd(8),
          r.mode.padEnd(5),
          r.group.padEnd(6),
          r.type.padEnd(10),
          String(r.score).padStart(6),
          (r.unanswerable ? (r.noAnswer ? 'hon' : 'NOT') : `${r.mention.found}/${r.mention.total}`).padStart(5),
          String(r.forbidden.length).padStart(4),
          `${Math.round(r.dupRatio * 100)}%`.padStart(4),
          `${Math.round(r.offTopicRatio * 100)}%`.padStart(4),
          `${r.words}/${r.wordLimit}`.padStart(7),
          (r.langOk ? 'ok' : 'NO').padStart(5),
          (r.citation ? 'ok' : '—').padStart(4),
          String(r.ms).padStart(4),
          ' ' + r.fails.map((f) => f.replace(/ \(missing:.*\)$/, '')).join(', '),
        ].join(' '),
      )
    }
  }

  console.log('\n== TOTALS')
  const all = totals(rows)
  printTotals('ALL', all)
  const byMode: Record<string, ReturnType<typeof totals>> = {}
  for (const m of ['chat', 'voice']) {
    const sub = rows.filter((r) => r.mode === m)
    if (sub.length) printTotals(m, (byMode[m] = totals(sub)))
  }
  const byGroup: Record<string, ReturnType<typeof totals>> = {}
  for (const g of ['g7', 'g8', 'g9', 'g10', 'g11', 'en', 'uz', 'follow', 'unans']) {
    const sub = rows.filter((r) => r.group === g)
    if (sub.length) printTotals(g, (byGroup[g] = totals(sub)))
  }
  const byType: Record<string, ReturnType<typeof totals>> = {}
  for (const t of ['definition', 'why', 'how', 'example', 'calc', 'compare', 'formula', 'reaction', 'location', 'property']) {
    const sub = rows.filter((r) => r.type === t && !r.unanswerable)
    if (sub.length) printTotals(t, (byType[t] = totals(sub)))
  }

  // Worst answers: one row per question (its worse mode), at most 3 per group so one systemic failure
  // (e.g. all en/uz questions) does not hide the others.
  const sorted = [...rows].sort((a, b) => a.score - b.score || b.fails.length - a.fails.length)
  const worst: Array<AnswerScore & { modes: string }> = []
  const perGroup = new Map<string, number>()
  for (const r of sorted) {
    if (worst.length >= worstN) break
    if (worst.some((w) => w.id === r.id) || (perGroup.get(r.group) ?? 0) >= 3) continue
    perGroup.set(r.group, (perGroup.get(r.group) ?? 0) + 1)
    const twin = rows.find((x) => x.id === r.id && x.mode !== r.mode)
    worst.push({ ...r, modes: twin && twin.score === r.score ? 'chat+voice' : r.mode })
  }
  console.log(`\n== ${worstN} WORST (per question, ≤3 per group)`)
  for (const r of worst) {
    console.log(`\n[${r.score}] ${r.id} (${r.modes}, ${r.group}/${r.type}) ${r.question}`)
    console.log(`  answer: ${r.excerpt}`)
    console.log(`  fails : ${r.fails.join(' | ') || '—'}`)
  }

  const out = { tag, scoredAt: new Date().toISOString(), ctxMode: data.ctxMode, totals: all, byMode, byGroup, byType, worst, rows }
  const outFile = path.join(OUT_DIR, `score-${tag}${modeFilter ? `-${modeFilter}` : ''}.json`)
  if (questionSet !== 'gold') {
    const goldFile = path.join(OUT_DIR, `score-${arg('gold-tag', 'r7')}.json`)
    if (fs.existsSync(goldFile)) {
      const g = (JSON.parse(fs.readFileSync(goldFile, 'utf8')) as { totals: { score: number } }).totals
      const gap = g.score - all.score
      console.log(`\n[score] holdout ${all.score} (all-checks ${all.fullyCorrect}/${all.n}, refusals ${all.falseNoAnswer + all.falseHedge}) vs gold ${g.score} (gap ${gap.toFixed(1)})${gap > 25 ? ' — WARNING: generalization gap > 25 points' : ''}`)
    }
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n[score] saved ${path.relative(ROOT, outFile)}`)
}

main()
