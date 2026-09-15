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
  /^Сможешь (своими словами|теперь сам|пересказать это|назвать главное отличие|привести ещё один пример|привести еще один пример)/iu,
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
  ['§-heading', /(^|\s)§\s*\d/u],
  ['task-variable', /(^|[\s:])x\s+\d|\s[xX]\s[+=→]|кислот[аеуы]\s+[A-DБВ]\b|\[[A-ZА-Я0-9,]{1,6}\]\s*[=-]/u],
  ['table-pipe', /\|/u],
  ['lost-exponent', /\d[,.]\d+\s*[∙·×*]\s*10(2[0-9]|1[0-9])\b/u],
  ['broken-formula', /\bH2SO(?![3-4₃₄])|\bh\d\b/u],
  ['example-label-on-definition', /(Например|For example|Masalan):[^.]{0,120}\sназыва(ется|ются|ют)\s/u],
  ['deictic', /(выше рассмотренных|вышерассмотренн|в этой реакции|данной реакции|этой модели|Эту активность)/iu],
  ['double-example', /Например:[^.]{0,80}\bнапример\b/iu],
]
/** Heading-like line without a finite verb («Влияние температуры на скорость химических реакций.»). */
function isVerbless(sentence: string): boolean {
  const bare = sentence.replace(/\([^)]*\)/g, ' ').replace(/[.!]\s*$/, '').trim()
  const words = bare.split(/\s+/).filter(Boolean)
  if (words.length < 3 || words.length > 9 || /[—–=→:«]|\sэто\s|\d|[a-z]/iu.test(bare) || !/[а-яё]/iu.test(bare)) return false
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
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}\d«"(])/u)
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
  const raw = stripCitations(text)
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
function languageOk(text: string, locale: GoldQuestion['locale']): boolean {
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
  const forbidden = (q.mustNotMention ?? []).filter((m) => entryMatches(m, idx))

  const parent = q.followUpOf ? goldById(q.followUpOf) : undefined
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
  const whyOk = q.type === 'why' ? CAUSAL_RE.test(stripCitations(rec.text)) || NO_WHY_RE.test(rec.text) : null

  // Noise (judge r1 §4): regex patterns over the whole spoken text + verbless heading-like content sentences.
  const spoken = stripCitations(rec.text || rec.answer)
  const noise = NOISE_RES.filter(([, re]) => re.test(spoken)).map(([name]) => name)
  if (q.locale === 'ru' && contentSentences.some((s) => isVerbless(s))) noise.push('verbless')
  // A follow-up must not repeat the previous answer of the dialog.
  const parentSentences = parentRec ? splitSentences(parentRec.text).filter((s) => !isTemplate(s)).map((s) => contentStems(s.replace(LEAD_RE, ''))) : []
  const dialogRepeat = stemsPer.some((st) => st.length >= 3 && parentSentences.some((p) => p.length >= 3 && jaccard(st, p) >= 0.8))
  // "No reason in my base" + a causal sentence in the same answer.
  const contradiction =
    NO_WHY_RE.test(rec.text) && contentSentences.some((s) => !NO_WHY_RE.test(s) && !/^(Сможешь|Can you|Endi)/u.test(s) && CAUSAL_RE.test(s))
  // en/uz: the labelled Russian quote is a citation — one sentence, ≤ 40% of the words.
  let russianHeavy = false
  if (q.locale !== 'ru') {
    const quotes = [...spoken.matchAll(SOURCE_QUOTE_RE)].map((m) => m[0].replace(/^\((?:in Russian|rus tilida)\):\s*«|»$/gu, ''))
    const quoteWords = quotes.reduce((acc, s) => acc + countWords(s), 0)
    const quoteSentences = quotes.reduce((acc, s) => acc + s.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u).filter((x) => x.trim().length > 3).length, 0)
    russianHeavy = quoteSentences > 1 || (countWords(spoken) > 0 && quoteWords / countWords(spoken) > 0.4)
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
  for (const q of GOLD_QUESTIONS) for (const m of [...q.mustMention, ...(q.mustNotMention ?? [])]) if (m.startsWith('re:')) new RegExp(m.slice(3), 'iu')

  const rows: AnswerScore[] = []
  for (const rec of data.items) {
    if (modeFilter && rec.mode !== modeFilter) continue
    const q = goldById(rec.id)
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
  for (const t of ['definition', 'why', 'how', 'example', 'calc', 'compare']) {
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
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n[score] saved ${path.relative(ROOT, outFile)}`)
}

main()
