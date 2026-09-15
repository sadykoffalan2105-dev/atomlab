/**
 * Локальный «учитель без LLM»: из найденных фрагментов базы знаний собирает
 * живой устный ответ — прямой ответ (1–2 фразы) → короткое объяснение →
 * пример (формула/реакция, если есть) → вопрос на проверку.
 *
 * Правило: НИЧЕГО не выдумывать. Все фактические фразы — из найденного текста
 * (допускается только чистка разметки, мягкая обрезка и перестановка
 * «A называются B» → «B — это A»). Если в найденном нет ответа на вопрос —
 * честно говорим об этом и предлагаем близкую тему. Чистый модуль (без DOM).
 */
import { countWords } from '../voice/sentenceStream'
import { sameUtterance } from '../voice/echoFilter'
import { contentStems, foldText, stemWord, stemsMatch, tokenizeWords, type StemLang } from './textStems'

export interface KnowledgeHitLike {
  title: string
  text: string
  source?: string
  /** Тип фрагмента базы знаний: definition / card / faq / summary / textbook … */
  type?: string
}

export interface ComposeStyle {
  /** brief ≈ 60 слов для голоса; more ≈ 140 слов («подробнее»). */
  detail?: 'brief' | 'more'
  simpler?: boolean
  wantExample?: boolean
  wantWhy?: boolean
  /** Режим «помощник»: наводим, не выдаём готовое решение. */
  helper?: boolean
  maxWords?: number
  /** Не добавлять вопрос на проверку. */
  noCheckQuestion?: boolean
}

export interface ComposeInput {
  query: string
  hits: readonly KnowledgeHitLike[]
  lang: StemLang
  style?: ComposeStyle
  /** Тема урока — для честного «давай вернёмся к теме…». */
  topicHint?: string
  /** Детерминированная вариативность формулировок. */
  seed?: number
  /** Предложить подключить умный ИИ, если ответа нет. */
  suggestSmartAi?: boolean
}

export interface ComposedAnswer {
  text: string
  sentences: string[]
  confident: boolean
  usedTitles: string[]
  keyTerm: string | null
}

type Candidate = {
  keyInHead: boolean
  text: string
  hitIndex: number
  title: string
  overlap: number
  definitional: boolean
  definesKey: boolean
  causal: boolean
  example: boolean
  score: number
}

const JUNK_RE =
  /Тема школьной программы|Путает близкие термины|Заучивает без понимания|В данном § такой информации нет|неверная формулировка по учебнику|Так описывается другое явление|Program \(FGOS\)|Content tier in app|Slide excerpt|^\s*Current slide|Изучаемые понятия|Типичная ошибка|Исправь мягко|Чек-лист|^\s*(Пример|Задача|Решение|Дано|Ответ)\s*\d*[.:]|(Выведите|Определите|Найдите|Вычислите|Рассчитайте|Составьте|Напишите уравнени|Сколько граммов|Какой объ[её]м|самостоятельн)|(^|\s)(Find|Calculate|Determine)\s/i

const MOJIBAKE_RE = /[À-ÿ]/g

const DEFINITION_RE =
  /(\s—\s|\s–\s|\sэто\s|называ(ют|ется|ются)|явля(ется|ются)|представля(ет|ют) собой|\sизуча(ет|ют)\s|наука о\s|\bis an?\b|\bare\b|refers to|is called|is the (science|study) of|\sstud(y|ies)\s|deb ataladi|hisoblanadi|o['‘’]rganadi|\sbu\s)/i
/** Связка «термин ↔ определение» (позиция нужна, чтобы проверить подлежащее). */
const COPULA_RE =
  /\s[—–-]\s|\sэто\s|\sявля(?:ется|ются)\s|\sпредставля(?:ет|ют) собой|\sизуча(?:ет|ют)\s|\s(?:is|are) (?:an?|the)?\s|\srefers to|\sstud(?:y|ies)\s|\so['‘’]rganadi|\sbu\s/iu
/** Служебные подписи карточек базы знаний: «Основные понятия: …», «Вывод: …». */
const LEAD_LABEL_RE = /(^|\n)\s*(Основные понятия|Вывод|Значение|Главное|Запомни|Key (?:points|ideas)|Conclusion|Asosiy tushunchalar|Xulosa)\s*:\s*/gi
const CAUSAL_RE =
  /(потому что|так как|поэтому|благодаря|из-за|вследствие|по причине|приводит к|because|since|therefore|due to|so that|chunki|sababli|shuning uchun|tufayli)/i
const EXAMPLE_RE = /(например|к примеру|пример[:\s]|такие как|for example|for instance|e\.g\.|such as|masalan|misol uchun)/i
const REACTION_RE = /(→|⇌|=\s*[A-Z]|\+\s*[A-Z][a-z]?[₀-₉0-9]*)/
const FORMULA_TOKEN_RE = /\b[A-Z][a-z]?[₀-₉0-9]*(?:\([A-Za-z0-9]+\)[₀-₉0-9]*)?(?:[A-Z][a-z]?[₀-₉0-9]*)+\b|\b[A-Z][a-z]?[₀-₉0-9]+\b/g

const SMALL_RU = /^(и|в|во|на|с|со|к|ко|о|об|у|по|за|из|от|до|не|ни|же|ли|а|но|то|их|её|ее|он|мы|вы|ей|им|ею|т|е|д|п)$/i

/** OCR-шум учебника: «осНовНые», «ме та л ло в», слипшиеся колонки. */
function looksLikeOcrNoise(sentence: string): boolean {
  if (/[а-яё][А-ЯЁ]/.test(sentence)) return true
  const tiny = sentence.split(/\s+/).filter((w) => /^[а-яё]{1,2}[.,]?$/i.test(w) && !SMALL_RU.test(w.replace(/[.,]$/, '')))
  return tiny.length >= 2
}

function hasRepeatedPairs(sentence: string): boolean {
  const w = sentence.split(/\s+/)
  const counts = new Map<string, number>()
  for (let i = 0; i + 1 < w.length; i++) {
    const k = `${w[i]} ${w[i + 1]}`.toLowerCase()
    const n = (counts.get(k) ?? 0) + 1
    counts.set(k, n)
    if (n >= 3) return true
  }
  return false
}

/** Повторы токенов («1 моль 1 моль 1 моль»), OCR-формулы «СН, + О,», обрыв на сокращении «… т.». */
function looksBroken(sentence: string): boolean {
  if (hasRepeatedPairs(sentence)) return true
  if (/^\p{Lu}\p{Ll}+\s\p{Lu}\s\p{Ll}/u.test(sentence)) return true
  if (/[A-ZА-ЯЁ][a-zа-яё]?,\s*[+—=]/u.test(sentence)) return true
  if (/(^|\s)(т|др|см|рис|стр|напр)\.$/iu.test(sentence.trim())) return true
  if (/^(следовательно|поэтому|то есть|т\.\s?е\.|значит|итак|однако|также|здесь|тогда|отсюда|где)[\s,]/iu.test(sentence)) return true
  if (/(^|\s)\d+\)\s|\d+\.\s+[а-яё]/u.test(sentence)) return true
  if (/[—–-]\s*\.?$/u.test(sentence.trim())) return true
  // Разрозненные буквы («С Н О, + О») — шум; обычные союзы/предлоги «и», «а», «в», «a» — нет.
  if (sentence.split(/\s+/).filter((w) => /^[\p{L}][.,]?$/u.test(w) && !/^[иавскоуяai]$/iu.test(w)).length >= 3) return true
  if (/\d+\s*-\s*Задача|Задача\s*\d|Упражнени/iu.test(sentence)) return true
  if (/\s[.,]\s|[a-zа-яё]\.\s*[a-zа-яё]{3,}\s[a-zа-яё]/u.test(sentence) && /[→=]|ē/u.test(sentence)) return true
  if (/(^|[\s:])(объясните|укажите|приведите|сравните|напишите|докажите|предложите|explain|compare|write)\s/iu.test(sentence)) return true
  return false
}

function cleanKnowledgeText(raw: string): string {
  return raw
    .replace(LEAD_LABEL_RE, '$1')
    .replace(/^\s*\[[^\]\n]{0,160}\]\s*$/gm, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-•*·]\s+/gm, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[ \t]+/g, ' ')
}

function splitCandidates(text: string): string[] {
  const out: string[] = []
  for (const line of cleanKnowledgeText(text).split(/\n+|\s•\s/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/(?<=[.!?])\s+(?=[\p{Lu}\d«"(])/u)
    for (const p of parts) {
      const s = p.trim().replace(/[:;,]\s*$/, '.')
      if (s) out.push(s)
    }
  }
  return out
}

function letterStats(text: string): { letters: number; cyr: number; lat: number; mojibake: number } {
  let letters = 0
  let cyr = 0
  let lat = 0
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      letters++
      if (/[а-яё]/i.test(ch)) cyr++
      else if (/[a-z]/i.test(ch)) lat++
    }
  }
  const mojibake = (text.match(MOJIBAKE_RE) ?? []).length
  return { letters, cyr, lat, mojibake }
}

function acceptableForLang(sentence: string, lang: StemLang): boolean {
  const st = letterStats(sentence)
  if (st.letters < 12) return false
  if (st.mojibake / st.letters > 0.04) return false
  if (lang === 'ru') return st.cyr / st.letters >= 0.55
  return st.lat / st.letters >= 0.6
}

const FOLLOW_UP_WORDS =
  /^(подробнее|подробно|проще|попроще|пожалуйста|мне|про|о|об|ещё|еще|пример|примеры|приведи|приведите|more|about|please|simpler|batafsil|haqida)$/i

/** Ключевой термин вопроса: «что такое X», «what is X», «X nima». */
export function extractKeyTerm(query: string, lang: StemLang): string | null {
  const q = query.trim().replace(/[?!.]+$/, '')
  const patterns: RegExp[] =
    lang === 'en'
      ? [/what (?:is|are) (?:an? |the )?(.+)$/i, /(?:explain|about|define) (?:an? |the )?(.+)$/i]
      : lang === 'uz'
        ? [/^(.+?) (?:nima|degani nima|nima degani)$/i, /^(.+?) haqida/i]
        : [
            /что так(?:ое|ая|ой|ие) (.+)$/i,
            /что значит (.+)$/i,
            /что называ\p{L}* (.+)$/iu,
            /(?:объясни|расскажи|поясни)(?:те)?(?: мне)?(?: подробнее| подробно| проще)?(?: про| о| об)? (.+)$/i,
            /пример(?:ы)? (.+)$/i,
          ]
  for (const re of patterns) {
    const m = q.match(re)
    if (m?.[1]) {
      const words = m[1]
        .split(/\s+/)
        .map((w) => w.replace(/[^\p{L}\p{N}₀-₉()-]/gu, ''))
        .filter((w) => w.length >= 2 && !FOLLOW_UP_WORDS.test(w))
      if (words.length > 0) return words.slice(0, 3).join(' ').toLowerCase()
    }
  }
  const content = tokenizeWords(q).filter((w) => w.length >= 4 && contentStems(w).length > 0 && !FOLLOW_UP_WORDS.test(w))
  if (content.length === 0) return null
  return content.sort((a, b) => b.length - a.length)[0] ?? null
}

/** Остаток вопроса «почему …» — для вопроса на проверку. */
function whyRemainder(query: string): string | null {
  const m = query.trim().replace(/[?!.]+$/, '').match(/(?:почему|зачем|отчего|why|nega)\s+(.{3,60})$/i)
  return m?.[1]?.trim() ?? null
}

function shortenForVoice(sentence: string, maxWords: number): string {
  const words = sentence.split(/\s+/)
  if (words.length <= maxWords) return sentence
  let acc = ''
  let lastCommaCut = ''
  for (let i = 0; i < words.length && i < maxWords; i++) {
    acc = acc ? `${acc} ${words[i]}` : words[i]!
    if (/[,;:]$/.test(words[i]!) && i >= Math.floor(maxWords * 0.45)) lastCommaCut = acc
  }
  const cut = (lastCommaCut || acc).replace(/[,;:—–-]+$/, '')
  return `${cut}.`
}

function ensureEnd(s: string): string {
  const t = capitalizeFirst(s.trim().replace(/[,;:]+$/, ''))
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

function capitalizeFirst(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!
}

/** Совпадение стема с текстом, устойчивое к OCR-разрывам слов («окси дами»). */
function stemInText(stem: string, words: readonly string[], compact: string): boolean {
  if (words.some((w) => stemsMatch(stem, stemWord(w)))) return true
  return stem.length >= 5 && compact.includes(stem)
}

/**
 * «Сложные вещества …, называются оксидами» → «Оксиды — это сложные вещества …».
 * Только перестановка найденного текста (без новых фактов).
 */
function reframeDefinition(sentence: string, keyTerm: string | null, lang: StemLang): string | null {
  if (!keyTerm || lang !== 'ru') return null
  const m = sentence.match(/^(.{12,220}?),?\s+называ(?:ется|ются|ют)\s+([^,.;:(]{3,48})(?:\s*\([^)]*\))?(?:[,;:].*)?[.!]?$/u)
  if (!m) return null
  const keyStems = contentStems(keyTerm)
  const namedCompact = foldText(m[2]!).replace(/\s+/g, '')
  if (keyStems.length === 0 || !keyStems.every((k) => namedCompact.includes(k.slice(0, Math.min(5, k.length))))) return null
  if (tokenizeWords(m[2]!).length > keyStems.length) return null
  let body = m[1]!.trim().replace(/,\s*то есть.*$/iu, '').replace(/,\s*где\s.*$/iu, '')
  body = body[0]!.toLowerCase() + body.slice(1)
  return `${capitalizeFirst(keyTerm)} — это ${body}.`
}

const L = {
  ru: {
    why: 'Почему так?',
    exampleLead: 'Например:',
    simplerLead: 'Если проще:',
    checks: [
      (t: string) => `Сможешь своими словами сказать, что такое ${t}?`,
      (t: string) => `А теперь ты: что такое ${t} — одной фразой?`,
      (t: string) => `Как бы ты сам объяснил, что такое ${t}?`,
    ],
    checkWhy: (r: string) => `Сможешь теперь сам объяснить, почему ${r}?`,
    checkGeneric: 'Понятно? Если хочешь — приведу пример или объясню проще.',
    helperLead: 'Подсказка, а решишь ты сам.',
    helperAsk: (t: string) => `Как это помогает с вопросом про «${t}»? Попробуй сделать следующий шаг.`,
    noAnswer: (q: string) => `Честно скажу: точного ответа на «${q}» в моей базе нет, а выдумывать я не буду.`,
    noWhy: 'А точной причины в моей базе не написано — проверим по учебнику?',
    noDefinition: (t: string) => `Точного определения «${t}» в моей базе нет. Вот что там сказано:`,
    related: (title: string) => `Зато могу рассказать про «${title}».`,
    topic: (t: string) => `Давай вернёмся к теме «${t}» — спроси, что в ней главное.`,
    smartAi: 'Или подключи умный ИИ — он ответит шире.',
    noExample: 'Готового примера в моей базе по этому вопросу нет.',
  },
  en: {
    why: 'Why is that?',
    exampleLead: 'For example:',
    simplerLead: 'Put simply:',
    checks: [
      (t: string) => `Can you explain what ${t} is in your own words?`,
      (t: string) => `Your turn: what is ${t}, in one sentence?`,
      (t: string) => `How would you explain ${t} to a friend?`,
    ],
    checkWhy: (r: string) => `Can you now explain why ${r}?`,
    checkGeneric: 'Is that clear? I can give an example or explain it more simply.',
    helperLead: 'Here is a hint — the solving is yours.',
    helperAsk: (t: string) => `How does this help with “${t}”? Try the next step yourself.`,
    noAnswer: (q: string) => `To be honest, my knowledge base has no exact answer to “${q}”, and I will not make one up.`,
    noWhy: 'The exact reason is not written in my knowledge base — shall we check the textbook?',
    noDefinition: (t: string) => `My knowledge base has no exact definition of “${t}”. Here is what it says:`,
    related: (title: string) => `I can tell you about “${title}” instead.`,
    topic: (t: string) => `Let us go back to “${t}” — ask me what matters most there.`,
    smartAi: 'Or connect the smart AI for a broader answer.',
    noExample: 'I have no ready example for this in my knowledge base.',
  },
  uz: {
    why: 'Nega shunday?',
    exampleLead: 'Masalan:',
    simplerLead: 'Soddaroq aytganda:',
    checks: [
      (t: string) => `${t} nima ekanini o‘z so‘zingiz bilan ayta olasizmi?`,
      (t: string) => `Endi siz: ${t} nima — bitta gap bilan?`,
    ],
    checkWhy: (r: string) => `Endi nega ${r} — o‘zingiz tushuntira olasizmi?`,
    checkGeneric: 'Tushunarlimi? Xohlasangiz, misol keltiraman yoki soddaroq tushuntiraman.',
    helperLead: 'Mana maslahat — yechimni o‘zingiz topasiz.',
    helperAsk: (t: string) => `Bu «${t}» bilan qanday bog‘liq? Keyingi qadamni o‘zingiz qiling.`,
    noAnswer: (q: string) => `Rostini aytsam, «${q}» bo‘yicha bazamda aniq javob yo‘q, o‘ylab topmayman.`,
    noWhy: 'Aniq sababi bazamda yozilmagan — darslikdan tekshiramizmi?',
    noDefinition: (t: string) => `Bazamda «${t}» ning aniq ta’rifi yo‘q. U yerda shunday yozilgan:`,
    related: (title: string) => `Lekin «${title}» haqida aytib bera olaman.`,
    topic: (t: string) => `Keling, «${t}» mavzusiga qaytamiz — undagi asosiy narsani so‘rang.`,
    smartAi: 'Yoki aqlli SI ni ulang — u kengroq javob beradi.',
    noExample: 'Bu savol bo‘yicha bazamda tayyor misol yo‘q.',
  },
} as const

function shortQuery(query: string): string {
  const q = query.trim().replace(/[?!.]+$/, '')
  const words = q.split(/\s+/)
  return words.length > 8 ? `${words.slice(0, 8).join(' ')}…` : q
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(\d+\/\d+\)\s*$/, '')
    .replace(/^§\s*\d+(?:\.\d+)?\.?\s*/, '')
    .replace(/:\s*определения$/i, '')
    .replace(/^(Ошибка|Типичная ошибка)[:\s—-]+/i, '')
    .replace(/[«»"]/g, '')
    .trim()
    .slice(0, 80)
}

const DEFINITION_TYPES = new Set(['definition', 'card', 'faq', 'summary'])

export function composeLocalAnswer(input: ComposeInput): ComposedAnswer {
  const lang = input.lang
  const style = input.style ?? {}
  const seed = input.seed ?? 0
  const t = L[lang]
  const detail = style.detail ?? 'brief'
  const maxWords = style.maxWords ?? (detail === 'more' ? 140 : style.simpler ? 50 : 60)
  const keyTerm = extractKeyTerm(input.query, lang)

  let qStems = contentStems(input.query).filter((s) => !FOLLOW_UP_WORDS.test(s))
  if (qStems.length === 0 && input.topicHint) qStems = contentStems(input.topicHint)
  const keyStems = keyTerm ? contentStems(keyTerm) : []
  const isWhatIs = /что так|что значит|что называ|what (is|are)|nima/i.test(input.query)

  // 1) Кандидаты-фразы из найденного.
  const candidates: Candidate[] = []
  const seenText = new Set<string>()
  input.hits.forEach((hit, hitIndex) => {
    if (!hit.text) return
    const titleStems = contentStems(hit.title)
    const titleOverlap =
      qStems.length === 0 ? 0 : qStems.filter((q) => titleStems.some((s) => stemsMatch(q, s))).length / qStems.length
    const defType = DEFINITION_TYPES.has(hit.type ?? '')
    for (const raw of splitCandidates(hit.text)) {
      if (JUNK_RE.test(raw)) continue
      if (raw.endsWith('?')) continue
      if (looksLikeOcrNoise(raw) || looksBroken(raw)) continue
      if (!acceptableForLang(raw, lang)) continue
      if (raw.length < 24 || raw.length > 420) continue
      const key = foldText(raw).slice(0, 80)
      if (seenText.has(key)) continue
      seenText.add(key)

      const words = tokenizeWords(raw)
      const compact = foldText(raw).replace(/[^\p{L}\p{N}]/gu, '')
      const matched = qStems.filter((q) => stemInText(q, words, compact)).length
      const overlap = qStems.length === 0 ? 0 : matched / qStems.length
      const definitional = DEFINITION_RE.test(raw)
      const causal = CAUSAL_RE.test(raw)
      const formulas = (raw.match(FORMULA_TOKEN_RE) ?? []).filter((tok) => !/^[IVXLCDM]+$/.test(tok)).length
      const example = EXAMPLE_RE.test(raw) || REACTION_RE.test(raw) || (formulas >= 1 && formulas <= 3 && !definitional)
      const head = foldText(raw.slice(0, 70))
      const headWords = tokenizeWords(head)
      const headCompact = head.replace(/[^\p{L}\p{N}]/gu, '')
      const keyInHead = keyStems.length > 0 && keyStems.every((k) => stemInText(k, headWords, headCompact))
      const namedPart = raw.match(/называ(?:ется|ются|ют)\s+([^,.;:(]{3,48})/iu)?.[1] ?? ''
      const namedKey =
        keyStems.length > 0 &&
        namedPart.length > 0 &&
        tokenizeWords(namedPart).length <= keyStems.length &&
        keyStems.every((k) => foldText(namedPart).replace(/\s+/g, '').includes(k.slice(0, 5)))
      // Определение термина: «Термин — …», «Наука химия изучает …», «… называются термином».
      // Подлежащее до связки — сам термин (± 2 слова: «Наука», «Термин»), скобки не считаем:
      // «Эпоха классической химии (1860 – …)» и «Единственный элемент, который не образует оксид, — фтор»
      // определениями «химии»/«оксидов» не являются.
      const noParen = raw.replace(/\([^)]*\)/g, ' ')
      const copulaAt = noParen.search(COPULA_RE)
      const subject = copulaAt > 0 ? noParen.slice(0, copulaAt) : ''
      const subjectWords = tokenizeWords(foldText(subject))
      const subjectIsKey =
        keyStems.length > 0 &&
        subjectWords.length > 0 &&
        subjectWords.length <= keyStems.length + 2 &&
        keyStems.every((k) => stemInText(k, subjectWords, foldText(subject).replace(/[^\p{L}\p{N}]/gu, '')))
      const definesKey = namedKey || (definitional && keyInHead && copulaAt >= 0 && copulaAt <= 48 && subjectIsKey)

      const digits = (raw.match(/\d/g) ?? []).length
      const commas = (raw.match(/,/g) ?? []).length
      let score = overlap * 3 + titleOverlap * 0.8 + 0.6 / (hitIndex + 1)
      if (defType && (isWhatIs || !style.wantWhy)) score += 0.5
      if (definitional && !style.wantWhy) score += 0.4
      if (definesKey) score += isWhatIs ? 2.2 : 1.2
      if (causal) score += style.wantWhy ? 1.4 : 0.15
      if (example && style.wantExample) score += 1.2
      if (/^[a-zа-яё]/.test(raw)) score -= 0.9
      if (digits / raw.length > 0.06 || /[=]|\d\)/.test(raw)) score -= 1.1
      if (formulas >= 3 || (commas >= 4 && formulas >= 2)) score -= 1.3
      if (raw.length > 240) score -= 0.5
      if (style.simpler && raw.length > 160) score -= 0.6

      candidates.push({ keyInHead, text: raw.trim(), hitIndex, title: hit.title, overlap, definitional, definesKey, causal, example, score })
    }
  })

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const needed = qStems.length <= 1 ? 1 : qStems.length <= 3 ? 0.5 : 0.4
  const confident = Boolean(best && qStems.length > 0 && best.overlap >= needed - 1e-9 && best.score > 1.2)

  // 2) Нет ответа в базе — честно.
  if (!confident) {
    const parts: string[] = [t.noAnswer(shortQuery(input.query))]
    const related = input.hits.find((h) => cleanTitle(h.title).length >= 4 && !/ошибка|чек-лист/i.test(h.title))
    if (related) parts.push(t.related(cleanTitle(related.title)))
    else if (input.topicHint) parts.push(t.topic(cleanTitle(input.topicHint)))
    if (input.suggestSmartAi) parts.push(t.smartAi)
    return { text: parts.join(' '), sentences: parts, confident: false, usedTitles: related ? [related.title] : [], keyTerm }
  }

  // 3) Сборка ответа.
  const used: Candidate[] = []
  const isDup = (c: Candidate) => used.some((u) => u.text === c.text || sameUtterance(u.text, c.text))
  const relevant = candidates.filter((c) => c.score > 0.4 && (c.overlap > 0 || c.hitIndex === best!.hitIndex))

  const sentences: string[] = []
  let words = 0
  const perSentenceMax = detail === 'more' ? 40 : style.simpler ? 20 : 26
  const add = (s: string, force = false): boolean => {
    const clean = ensureEnd(shortenForVoice(s, perSentenceMax))
    const w = countWords(clean)
    if (!force && words + w > maxWords && sentences.length > 0) return false
    sentences.push(clean)
    words += w
    return true
  }

  if (style.helper) add(t.helperLead, true)

  const keyDefinition = relevant.find((c) => c.definesKey)
  const definition = keyDefinition ?? (isWhatIs ? undefined : relevant.find((c) => c.definitional && c.overlap >= needed))
  // «Почему» — только причина про то же самое (все слова вопроса или термин в начале фразы).
  const causalCandidate = relevant.find((c) => c.causal && (c.overlap >= 1 - 1e-9 || c.keyInHead))
  const noDefinition = isWhatIs && !keyDefinition && !style.wantWhy
  let direct: Candidate
  let missingWhy = false
  if (style.wantWhy) {
    if (causalCandidate) direct = causalCandidate
    else {
      direct = definition ?? best!
      missingWhy = true
    }
  } else if (style.wantExample) {
    direct = definition ?? best!
  } else {
    direct = definition ?? best!
  }
  used.push(direct)
  if (noDefinition && keyTerm) add(t.noDefinition(keyTerm), true)
  const directText = reframeDefinition(direct.text, keyTerm, lang) ?? direct.text
  add(style.simpler ? `${t.simplerLead} ${lowerFirst(directText, lang)}` : directText, true)
  if (missingWhy) add(t.noWhy, true)

  // Объяснение: ещё 1 (или 3 для «подробнее») фразы той же темы.
  const explanationPool = relevant.filter((c) => !isDup(c) && !(c.example && !c.definitional))
  const explanationCount = missingWhy || noDefinition ? 0 : detail === 'more' ? 3 : style.simpler ? 0 : 1
  let explained = 0
  for (const c of explanationPool) {
    if (explained >= explanationCount) break
    if (style.helper && explained >= 1) break
    if (c.overlap === 0 && c.hitIndex !== direct.hitIndex) continue
    if (c.score < 1) continue
    const base = reframeDefinition(c.text, keyTerm, lang) ?? c.text
    const text = style.wantWhy && !c.causal && explained === 0 && !direct.causal ? `${t.why} ${base}` : base
    if (!add(text)) break
    used.push(c)
    explained++
  }

  // Пример — только из найденного (фраза с «например», реакцией или формулой).
  if (!style.helper && (!missingWhy || style.wantExample)) {
    const ex = relevant.find((c) => c.example && !isDup(c) && c.score > 1.2 && !/^[a-zа-яё]/.test(c.text))
    if (ex) {
      const already = EXAMPLE_RE.test(ex.text.slice(0, 24))
      if (add(already ? ex.text : `${t.exampleLead} ${lowerFirst(ex.text, lang)}`, style.wantExample)) used.push(ex)
    } else if (style.wantExample) {
      add(t.noExample, true)
    }
  }

  // Вопрос на проверку (без фактов — только просьба объяснить своими словами).
  if (!style.noCheckQuestion) {
    const term = keyTerm && keyTerm.length <= 40 ? keyTerm : null
    const explicitKey = /что так|что значит|что называ|объясни|расскажи|поясни|what (is|are)|explain|define|about|nima|haqida/i.test(input.query)
    const whyRest =
      whyRemainder(input.query) ??
      (style.wantWhy && !isWhatIs && !missingWhy && input.query.split(/\s+/).length <= 6
        ? input.query.trim().replace(/[?!.]+$/, '')
        : null)
    const q = style.helper && term
      ? t.helperAsk(term)
      : whyRest
        ? t.checkWhy(whyRest)
        : term && explicitKey && !noDefinition && !style.wantWhy && !style.wantExample && (isWhatIs || definition)
          ? pick(t.checks, seed)(term)
          : t.checkGeneric
    sentences.push(q)
  }

  return {
    text: sentences.join(' '),
    sentences,
    confident: true,
    usedTitles: [...new Set(used.map((u) => u.title))],
    keyTerm,
  }
}

function lowerFirst(text: string, lang: StemLang): string {
  const first = text[0]
  if (!first) return text
  if (lang === 'en' && /^[A-Z][a-z]/.test(text) && !/^(The|A|An|It|This|These|Such)\b/.test(text)) return text
  if (/^[\p{Lu}]{2}/u.test(text) || /^[A-Z][a-z]?\d/.test(text)) return text
  return first.toLowerCase() + text.slice(1)
}
