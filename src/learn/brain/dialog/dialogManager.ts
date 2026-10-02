/**
 * Диалоговый менеджер ИИ-учителя: многоходовый разговор поверх поиска по учебнику.
 *
 *  • викторина («проверь меня», «quiz me», «savol ber»): вопросы из банков проекта
 *    (7 класс — g7ExamPools, 8–11 — examPools/oral-g*.json), оценка ответа ученика по
 *    опорным словам эталона + gradeAnswer, счёт, серия, подсказки, итог;
 *  • поддержка («не понимаю», «устал», «я тупой», «боюсь контрольной»): тёплый ответ,
 *    конкретный следующий шаг, настроение — в профиль ученика;
 *  • обучение в моменте («мне нравится, когда коротко», «мне сложно с ОВР», «называй меня…»):
 *    профиль меняется и реально влияет на стиль и выбор вопросов;
 *  • домашка («помоги с задачей»): наводящие шаги, готовое решение — только по просьбе и
 *    только расчётом из данных (молярные массы), без выдумок;
 *  • продолжения без темы («а почему?», «проще», «а он?») — тема из стека → rewrite для базы.
 *
 * Факты — только из банков вопросов и данных проекта. Возвращает null, если реплика —
 * обычный учебный вопрос (дальше отвечает прежний маршрут).
 */
import { gradeAnswer } from '../dualMode/answerQuality'
import { contentStems, foldText, stemsMatch } from '../dualMode/textStems'
import { detectFollowUp, isSubstantiveQuestion, stripLeadingDiscourse } from '../dualMode/followUps'
import { extractKeyTerm } from '../dualMode/localAnswerComposer'
import { loadOralPool, preferTranslated, type GradeOralItem } from '../dualMode/gradeOralPools'
import { findFormulaInText, molarMassOf, plainFormula, prettyFormula } from '../human/chemFacts'
import { loadProfile, updateProfile, type StudentMood } from '../human/studentProfile'
import {
  ADDITION,
  ASK_MORE,
  HINT,
  HW_DONE,
  HW_EXIT,
  HW_REVEAL_NO_DATA,
  HW_START,
  HW_STEPS,
  HW_STEP_ACK,
  NO_POOL,
  OFFER_STEP,
  PARTIAL,
  PRAISE,
  QUIZ_INTRO,
  QUIZ_NEXT,
  REVIEW_OFFER,
  STREAK,
  SUMMARY,
  SUMMARY_PERFECT,
  SUMMARY_REVIEW,
  SUPPORT,
  TEACH_NAME,
  TEACH_STYLE,
  TEACH_WEAK,
  WRONG,
  WRONG_HINT,
  fillTemplate,
  type DialogLang,
} from './dialogPhrases'
import {
  currentTopic,
  loadDialog,
  pickFresh,
  pushTopic,
  rememberTeacherLine,
  saveDialog,
  updateDialog,
  type DialogState,
  type QuizQuestionState,
  type QuizState,
} from './dialogState'

export interface DialogInput {
  lang: DialogLang
  /** 'g8' или 8; нет — класс из профиля ученика, иначе 7. */
  grade?: string | number | null
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
  /** История чата (для «а почему?» — есть ли у ученика свой предыдущий вопрос). */
  messages?: readonly { role: string; content: string }[]
}

export type DialogIntent =
  | 'quiz_start'
  | 'quiz_question'
  | 'quiz_correct'
  | 'quiz_partial'
  | 'quiz_wrong'
  | 'quiz_hint'
  | 'quiz_summary'
  | 'quiz_review'
  | 'quiz_exit'
  | 'support'
  | 'offer_step'
  | 'teach_style'
  | 'teach_weak'
  | 'teach_name'
  | 'homework_start'
  | 'homework_step'
  | 'homework_reveal'
  | 'homework_exit'
  | 'rewrite'

export interface DialogResult {
  text?: string
  /** Переписанный запрос для поиска по базе (тема подставлена из стека). */
  rewrite?: string
  citations: string[]
  confident: boolean
  intent: DialogIntent
  /** Текущий счёт викторины (для тестов и интерфейса). */
  score?: { asked: number; correct: number; partial: number; wrong: number; streak: number }
}

let rng: () => number = Math.random
/** Для тестов: детерминированный выбор вопросов. */
export function setDialogRandom(fn: () => number): void {
  rng = fn
}

/* --------------------------------------------------------------- шаблоны */

const QUIZ_START_RE =
  /(провер(?:ь|ьте)\s+(?:меня|мои\s+знания|знания|как\s+я)|задай(?:те)?\s+(?:мне\s+)?(?:ещ[её]\s+)?вопрос|давай(?:те)?\s+(?:по)?трениру|потренир|опроси\s+меня|устрой\s+(?:мне\s+)?(?:опрос|викторин|тест)|^викторин|мини-?викторин|quiz\s*me|test\s*me|ask\s+me\s+(?:a\s+|another\s+)?question|let'?s\s+practi[sc]e|^quiz\b|savol\s+ber|meni\s+tekshir|^viktorina|mashq\s+qil(?:amiz|aylik))/iu

const STOP_RE =
  /^(?:хватит|стоп|достаточно|вс[её]|закончим|закончить|заканчиваем|надоело|не\s+хочу\s+больше|устал[а]?|enough|stop|that'?s\s+(?:it|all|enough)|i'?m\s+done|quit|bo'?ldi|yetarli|to'?xta|tugat(?:dik|amiz)?)[\s.!,]*$/iu

const DONT_KNOW_RE =
  /^(?:я\s+)?(?:не\s+знаю|незнаю|не\s+помню|не\s+могу|хз|без\s+понятия|сложно|трудно|подскажи|подсказк[ау]|намекни|дай\s+подсказку|i\s+do\s?n'?t\s+know|dunno|no\s+idea|not\s+sure|hint|give\s+me\s+a\s+hint|bilmayman|bilmadim|eslay\s+olmayman|maslahat\s+ber|yordam\s+ber)[\s.!?]*$/iu

const YES_RE =
  /^(?:да|давай|ага|угу|ещ[её]|дальше|следующий|продолж(?:ай|им)|ок|окей|конечно|готов[а]?|yes|yeah|yep|sure|next|more|go\s+on|continue|ok|okay|ready|ha|yana|davom|keyingi|mayli|xo'?p|tayyor)[\s.!]*$/iu

const NO_RE = /^(?:нет|не\s+надо|не\s+хочу|пока\s+нет|no|nope|not\s+now|yo'?q|kerak\s+emas|hozir\s+emas)[\s.!]*$/iu

const QUESTION_LIKE_RE = /(^|\s)(что|как|почему|зачем|какой|какая|какие|сколько|объясни|расскажи|what|why|how|which|explain|tell\s+me|nima|nega|qanday|qaysi|tushuntir|ayt)(\s|\?|$)/iu

const HOMEWORK_RE =
  /(помоги(?:те)?\s+(?:мне\s+)?(?:с\s+|решить\s+|сделать\s+)?(?:домашк|дз\b|задач|упражнен|примером|номер|№)|домашк|домашнее\s+задание|реши(?:ть|м)?\s+(?:со\s+мной\s+)?задач|задач[аи]\s*(?:№|номер|n)\s*\d|help\s+(?:me\s+)?with\s+(?:my\s+|the\s+|this\s+)?(?:homework|problem|exercise|task)|\bhomework\b|uy\s+vazifa|masala(?:ni)?\s+(?:yech|ish)|masalaga\s+yordam)/iu

const REVEAL_RE = /(покажи\s+решение|дай\s+решение|реши\s+сам|просто\s+реши|show\s+(?:me\s+)?the\s+solution|just\s+solve|yechimni\s+ko'?rsat|o'?zing\s+yech)/iu

const DEICTIC_RE = /^(?:а|и|and|va)?\s*(?:он|она|оно|они|это|этот|эта|у\s+него|у\s+не[её]|у\s+них|про\s+него|про\s+не[её]|it|this|that|they|them|u|bu|ular|uni|unda)\s*\??[\s.!?]*$/iu

const SUPPORT_RE: [StudentMood, RegExp][] = [
  ['down', /(я\s+туп(?:ой|ая)|я\s+глуп(?:ый|ая)|я\s+дурак|я\s+дура|ничего\s+не\s+получается|у\s+меня\s+не\s+получается|я\s+не\s+смогу|i'?m\s+(?:so\s+)?(?:stupid|dumb)|i\s+can'?t\s+do\s+(?:this|it)|men\s+ahmoqman|qo'?limdan\s+kelmayapti)/iu],
  ['scared', /(боюсь|страшно|волнуюсь|переживаю|тревожно|паник|scared|afraid|nervous|worried|panic|qo'?rq|xavotir|hayajon)/iu],
  ['tired', /(устал[а]?|утомил|нет\s+сил|вымотал|tired|exhausted|charchadim|holim\s+yo'?q)/iu],
  ['bored', /(скучно|скукота|надоело|boring|bored|zerik)/iu],
  ['easy', /(слишком\s+легко|это\s+легко|легкотня|слишком\s+просто|too\s+easy|that'?s\s+easy|juda\s+oson|oson\s+ekan)/iu],
  ['confused', /(не\s+понимаю|ничего\s+не\s+понял|не\s+поняла|непонятно|не\s+понятно|запутал|сложно|трудно|don'?t\s+understand|confus|too\s+hard|tushunmayapman|tushunmadim|chalkash|qiyin)/iu],
]

const STYLE_BRIEF_RE =
  /(нравится,?\s+когда\s+коротко|отвечай\s+короче|покороче|говори\s+кратко|коротко\s+и\s+по\s+делу|люблю\s+коротк|без\s+длинных|keep\s+it\s+short|answer\s+shorter|be\s+brief|like\s+it\s+short|short\s+answers|qisqa\s+javob\s+ber|qisqaroq\s+gapir|qisqa\s+bo'?lsin)/iu
const STYLE_MORE_RE =
  /(отвечай\s+подробнее|люблю\s+подробно|нравится,?\s+когда\s+подробно|объясняй\s+подробнее|объясняй\s+подробно|с\s+деталями|more\s+detailed\s+answers|like\s+it\s+detailed|explain\s+in\s+detail|answer\s+in\s+detail|batafsil\s+javob\s+ber|batafsilroq\s+tushuntir)/iu
const STYLE_EXAMPLES_RE = /(больше\s+примеров|люблю\s+примеры|с\s+примерами|объясняй\s+на\s+примерах|more\s+examples|love\s+examples|with\s+examples|ko'?proq\s+misol|misollar\s+bilan)/iu

const WEAK_RE: RegExp[] = [
  /(?:мне|у\s+меня)\s+(?:очень\s+)?(?:сложно|трудно|тяжело|непонятно|плохо)\s+(?:с|по|в|даётся|дается|идёт|идет|получается\s+с)\s+(.{2,40})$/iu,
  /не\s+понимаю\s+(?:тему\s+)?(.{2,40})$/iu,
  /плохо\s+(?:понимаю|знаю)\s+(.{2,40})$/iu,
  /i\s+struggle\s+with\s+(.{2,40})$/iu,
  /(.{2,40})\s+is\s+(?:hard|difficult)\s+for\s+me$/iu,
  /i\s+find\s+(.{2,40})\s+(?:hard|difficult)$/iu,
  /menga\s+(.{2,40})\s+qiyin$/iu,
]

const NAME_RE = /(?:называй\s+меня|обращайся\s+ко\s+мне|chaqir\s+meni)\s+([\p{L}][\p{L}'-]{1,19})/iu

/* --------------------------------------------------------------- утилиты */

function L<T>(lang: DialogLang, ru: T, en: T, uz: T): T {
  return lang === 'en' ? en : lang === 'uz' ? uz : ru
}

function say(text: string, intent: DialogIntent, extra: Partial<DialogResult> = {}): DialogResult {
  rememberTeacherLine(text)
  return { text, citations: [], confident: true, intent, ...extra }
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function gradeIdOf(input: DialogInput): string {
  const raw = input.grade ?? loadProfile().grade
  const n = Number(String(raw ?? '').replace(/^g/, ''))
  if (!Number.isFinite(n) || n < 7) return 'g7'
  if (n > 11) return 'g11'
  return `g${n}`
}

function cleanTopic(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:тем(?:а|у|ой)|topic|mavzu)\s+/iu, '')
    .replace(/[.!?,;:]+$/u, '')
    .replace(/^[«"']|[»"']$/gu, '')
    .trim()
}

/** Опорные слова эталона на языке ученика. */
function rubricFor(item: GradeOralItem, lang: DialogLang): string[] {
  const ru = [...(item.rubric ?? [])]
  const en = [...(item.rubricEn ?? [])]
  const uz = [...(item.rubricUz ?? [])]
  const picked = lang === 'en' ? (en.length ? en : ru) : lang === 'uz' ? (uz.length ? uz : en.length ? en : ru) : ru
  return picked.map((k) => foldText(k)).filter(Boolean)
}

function questionFor(item: GradeOralItem, lang: DialogLang): string {
  const q = lang === 'en' ? item.questionSpeakEn : lang === 'uz' ? (item.questionSpeakUz ?? item.questionSpeakEn) : undefined
  return (q ?? item.questionSpeak).trim()
}

function sampleFor(item: GradeOralItem, lang: DialogLang): string {
  const s = lang === 'en' ? item.sampleAnswerEn : lang === 'uz' ? (item.sampleAnswerUz ?? item.sampleAnswerEn) : undefined
  return (s ?? item.sampleAnswer ?? '').trim()
}

/** Слово эталона, начинающееся с опорной основы («гидрокси» → «гидроксильных»). */
function keyWord(stem: string, sample: string): string {
  const w = sample.split(/[\s,;:()«»"]+/).find((x) => foldText(x).startsWith(stem))
  return w ? w.replace(/[.!?]+$/, '') : stem
}

/* ---------------------------------------------------------------- оценка */

export type AnswerLevel = 'correct' | 'partial' | 'wrong'

export interface StudentGrade {
  level: AnswerLevel
  hits: string[]
  missing: string[]
  ratio: number
}

const FORMULA_RE = /(?<![A-Za-z])(?:[A-Z][a-z]?[\d₀-₉]*){2,}(?![a-z])|(?<![A-Za-z])[A-Z][a-z]?[\d₀-₉]+(?![a-z])/gu

function formulasIn(text: string): string[] {
  return [...new Set((text.match(FORMULA_RE) ?? []).map((f) => plainFormula(f)))]
}

/**
 * Оценка ответа ученика по опорным словам эталона (банк вопросов) + формулы эталона
 * + gradeAnswer как дополнительный признак «по сути». Никаких внешних моделей.
 */
export function gradeStudentAnswer(answer: string, q: Pick<QuizQuestionState, 'question' | 'rubric' | 'sampleAnswer'>, lang: DialogLang): StudentGrade {
  const flat = foldText(answer)
  const aStems = contentStems(answer)
  const hits: string[] = []
  const missing: string[] = []
  for (const key of q.rubric) {
    const k = key.length > 5 ? key.slice(0, Math.max(5, key.length - 1)) : key
    const ok = flat.includes(key) || flat.includes(k) || aStems.some((s) => s.startsWith(k) || k.startsWith(s) || stemsMatch(s, key))
    ;(ok ? hits : missing).push(key)
  }
  // Формулы эталона: «Na2O», «H₂SO₄» — ответ с теми же формулами засчитываем как попадание.
  const sampleFormulas = formulasIn(q.sampleAnswer)
  const answerFormulas = new Set(formulasIn(answer))
  const formulaHits = sampleFormulas.filter((f) => answerFormulas.has(f)).length
  const total = q.rubric.length + sampleFormulas.length
  const score = hits.length + formulaHits
  let ratio = total === 0 ? 0 : score / total
  // Дополнительный признак: ответ по сути (ожидаемые основы) и формула — из answerQuality.
  const report = gradeAnswer({ question: q.question, answer, lang, expect: q.rubric, confident: true })
  if (report.onTopic && ratio < 0.34 && score > 0) ratio = 0.34
  let level: AnswerLevel
  if (total <= 2) level = score >= total && total > 0 ? 'correct' : score > 0 ? 'partial' : 'wrong'
  else level = ratio >= 0.66 ? 'correct' : ratio >= 0.34 || score >= 2 ? 'partial' : 'wrong'
  if (words(answer) <= 1 && score === 0) level = 'wrong'
  return { level, hits, missing, ratio }
}

/* ------------------------------------------------------------ викторина */

function quizEmpty(poolKey: string, planned: number | null): QuizState {
  return { poolKey, askedIds: [], current: null, asked: 0, correct: 0, partial: 0, wrong: 0, streak: 0, wrongTopic: null, toReview: [], awaitingMore: false, planned }
}

function scoreOf(q: QuizState): DialogResult['score'] {
  return { asked: q.asked, correct: q.correct, partial: q.partial, wrong: q.wrong, streak: q.streak }
}

async function pickQuestion(input: DialogInput, quiz: QuizState): Promise<GradeOralItem | null> {
  const gradeId = gradeIdOf(input)
  const chapterId = input.chapterId ?? 'c1'
  let pool = await loadOralPool(gradeId, chapterId, input.sectionId)
  if (!pool.length && gradeId !== 'g7') pool = await loadOralPool('g7', 'c1')
  if (!pool.length) return null
  const asked = new Set(quiz.askedIds)
  let candidates = preferTranslated(pool, input.lang).filter((it) => !asked.has(it.id))
  if (!candidates.length) candidates = preferTranslated(pool, input.lang)
  // Приоритет: темы-сложности ученика → тема урока → остальные.
  const weak = loadProfile().weakTopics.flatMap((t) => contentStems(t))
  const lesson = input.sectionTitle ? contentStems(input.sectionTitle) : []
  const rank = (it: GradeOralItem): number => {
    const hay = `${it.questionSpeak} ${it.sampleAnswer ?? ''} ${it.rubric.join(' ')}`
    const stems = contentStems(hay)
    const hit = (keys: string[]) => keys.some((k) => stems.some((s) => stemsMatch(s, k)))
    return (weak.length && hit(weak) ? 2 : 0) + (lesson.length && hit(lesson) ? 1 : 0)
  }
  const best = Math.max(...candidates.map(rank))
  const top = candidates.filter((it) => rank(it) === best)
  return top[Math.floor(rng() * top.length)] ?? null
}

async function askNext(input: DialogInput, quiz: QuizState, lead: string, intent: DialogIntent): Promise<DialogResult> {
  const item = await pickQuestion(input, quiz)
  if (!item) {
    updateDialog(() => ({ mode: 'chat', quiz: null }))
    return say(`${lead ? `${lead} ` : ''}${pickFresh(NO_POOL[input.lang])}`.trim(), 'quiz_exit')
  }
  const question = questionFor(item, input.lang)
  const current: QuizQuestionState = {
    id: item.id,
    question,
    rubric: rubricFor(item, input.lang),
    sampleAnswer: sampleFor(item, input.lang),
    topicKey: item.sectionId ?? quiz.poolKey,
    hinted: false,
  }
  const next: QuizState = { ...quiz, current, askedIds: [...quiz.askedIds, item.id].slice(-60), asked: quiz.asked + 1, awaitingMore: false }
  updateDialog(() => ({ mode: 'quiz', quiz: next, pending: null }))
  // В стек тем — только вопросы-определения («что такое…»): у «назовите…» ключевое слово — глагол.
  if (/^(?:что\s+такое|что\s+назыв|what\s+(?:is|are)|nima(?:ga\s+aytiladi)?)\b/iu.test(item.questionSpeak)) {
    const term = extractKeyTerm(item.questionSpeak, 'ru')
    if (term) pushTopic(term)
  }
  const opener = lead || pickFresh(quiz.asked === 0 ? QUIZ_INTRO[input.lang] : QUIZ_NEXT[input.lang])
  return say(`${opener} ${question}`, intent, { score: scoreOf(next) })
}

function summary(lang: DialogLang, quiz: QuizState): DialogResult {
  const partialNote = quiz.partial ? L(lang, `, частично — ${quiz.partial}`, `, partly — ${quiz.partial}`, `, qisman — ${quiz.partial}`) : ''
  const answered = quiz.correct + quiz.partial + quiz.wrong
  let text = fillTemplate(pickFresh(SUMMARY[lang]), { correct: quiz.correct, asked: answered, partial: partialNote })
  const review = [...new Set(quiz.toReview)].slice(0, 4)
  if (review.length) text += ` ${fillTemplate(pickFresh(SUMMARY_REVIEW[lang]), { topics: review.join(', ') })}`
  else if (answered > 0 && quiz.wrong === 0 && quiz.partial === 0) text += ` ${pickFresh(SUMMARY_PERFECT[lang])}`
  updateDialog(() => ({ mode: 'chat', quiz: null, pending: null }))
  return say(text, 'quiz_summary', { score: scoreOf(quiz) })
}

async function quizTurn(text: string, input: DialogInput, state: DialogState): Promise<DialogResult | null> {
  const lang = input.lang
  const quiz = state.quiz!
  const t = stripLeadingDiscourse(text).trim()
  if (STOP_RE.test(t) || (quiz.awaitingMore && NO_RE.test(t))) return summary(lang, quiz)
  if (quiz.awaitingMore || !quiz.current) {
    if (YES_RE.test(t) || QUIZ_START_RE.test(t)) return askNext(input, quiz, '', 'quiz_question')
    // Ученик ушёл в свой вопрос — викторину закрываем, вопрос отвечает база.
    updateDialog(() => ({ mode: 'chat', quiz: null }))
    return null
  }
  const q = quiz.current
  // Свой вопрос посреди викторины («а что такое оксид?») — выходим, отвечает база.
  if (/\?\s*$/.test(t) && QUESTION_LIKE_RE.test(t) && words(t) >= 3 && !DONT_KNOW_RE.test(t)) {
    updateDialog(() => ({ mode: 'chat', quiz: null }))
    return null
  }
  if (DONT_KNOW_RE.test(t) && !q.hinted) {
    const start = q.sampleAnswer.split(/\s+/).slice(0, 4).join(' ')
    const keys = q.rubric.map((k) => keyWord(k, q.sampleAnswer)).slice(0, 3).join(', ')
    const hint = fillTemplate(pickFresh(start ? HINT[lang] : HINT[lang].slice(1, 2)), { start, keys })
    updateDialog(() => ({ quiz: { ...quiz, current: { ...q, hinted: true } } }))
    return say(hint, 'quiz_hint', { score: scoreOf(quiz) })
  }
  const grade = DONT_KNOW_RE.test(t) ? ({ level: 'wrong', hits: [], missing: q.rubric, ratio: 0 } as StudentGrade) : gradeStudentAnswer(t, q, lang)
  const topicName = extractKeyTerm(q.question, lang) ?? q.question.replace(/[?]/g, '').split(/\s+/).slice(0, 4).join(' ')
  let next: QuizState = { ...quiz, current: null, awaitingMore: true }
  let body = ''
  let intent: DialogIntent = 'quiz_correct'
  if (grade.level === 'correct') {
    next = { ...next, correct: quiz.correct + 1, streak: quiz.streak + 1, wrongTopic: null }
    body = pickFresh(PRAISE[lang])
    if (next.streak >= 3) body += ` ${fillTemplate(pickFresh(STREAK[lang]), { n: next.streak })}`
    if (q.sampleAnswer && q.sampleAnswer.length <= 240 && grade.ratio < 1) body += ` ${fillTemplate(pickFresh(ADDITION[lang]), { sample: q.sampleAnswer })}`
  } else if (grade.level === 'partial') {
    intent = 'quiz_partial'
    next = { ...next, partial: quiz.partial + 1, streak: 0 }
    const missing = grade.missing.map((k) => keyWord(k, q.sampleAnswer)).slice(0, 3).join(', ')
    body = fillTemplate(pickFresh(PARTIAL[lang]), { missing: missing || q.sampleAnswer })
    if (q.sampleAnswer && q.sampleAnswer.length <= 240) body += ` ${fillTemplate(pickFresh(ADDITION[lang]), { sample: q.sampleAnswer })}`
  } else {
    intent = 'quiz_wrong'
    const sameTopic = quiz.wrongTopic && quiz.wrongTopic[0] === q.topicKey ? quiz.wrongTopic[1] + 1 : 1
    next = { ...next, wrong: quiz.wrong + 1, streak: 0, wrongTopic: [q.topicKey, sameTopic], toReview: [...quiz.toReview, topicName].slice(-8) }
    updateProfile((p) => ({ mistakes: [...p.mistakes, topicName] }))
    body = fillTemplate(pickFresh(WRONG[lang]), { answer: q.sampleAnswer || q.rubric.join(', ') })
    const keys = q.rubric.map((k) => keyWord(k, q.sampleAnswer)).slice(0, 3).join(', ')
    if (keys) body += ` ${fillTemplate(pickFresh(WRONG_HINT[lang]), { keys })}`
    if (sameTopic >= 3) {
      updateDialog(() => ({ mode: 'chat', quiz: null, pending: null }))
      const topic = input.sectionTitle && q.topicKey === input.sectionId ? input.sectionTitle : topicName
      return say(`${body} ${fillTemplate(pickFresh(REVIEW_OFFER[lang]), { topic })}`, 'quiz_review', { score: scoreOf(next) })
    }
  }
  const answered = next.correct + next.partial + next.wrong
  if (next.planned && answered >= next.planned) {
    const tail = summary(lang, next)
    return { ...tail, text: `${body} ${tail.text}`, intent: 'quiz_summary' }
  }
  updateDialog(() => ({ quiz: next }))
  return say(`${body} ${pickFresh(ASK_MORE[lang])}`, intent, { score: scoreOf(next) })
}

async function startQuiz(input: DialogInput, planned: number | null): Promise<DialogResult> {
  const poolKey = `${gradeIdOf(input)}/${input.chapterId ?? 'c1'}`
  const prev = loadDialog().quiz
  const quiz = prev && prev.poolKey === poolKey ? { ...quizEmpty(poolKey, planned), askedIds: prev.askedIds } : quizEmpty(poolKey, planned)
  return askNext(input, quiz, '', 'quiz_start')
}

/* --------------------------------------------------------------- домашка */

function formulaHint(problem: string, lang: DialogLang): string {
  const p = foldText(problem)
  if (/(масс|mass|massa|\d\s*(?:г|g|gramm)(?![\p{L}]))/u.test(p) && /(моль|mol|количеств|amount|miqdor)/.test(p)) return L(lang, 'Подсказка: n = m / M. ', 'Hint: n = m / M. ', 'Maslahat: n = m / M. ')
  if (/(объ[её]м|volume|hajm)/.test(p) && /(газ|gas|н\.у|n\.u|stp)/.test(p)) return L(lang, 'Подсказка: V = n · Vm, Vm = 22,4 л/моль. ', 'Hint: V = n · Vm, Vm = 22.4 L/mol. ', 'Maslahat: V = n · Vm, Vm = 22,4 l/mol. ')
  if (/(молекул|частиц|атомов|molecul|particle|zarracha)/.test(p) && /(число|количество|number|soni)/.test(p)) return L(lang, 'Подсказка: N = n · N_A. ', 'Hint: N = n · N_A. ', 'Maslahat: N = n · N_A. ')
  if (/(дол[яи]|share|fraction|ulush)/.test(p)) return L(lang, 'Подсказка: ω = m(части) / m(целого). ', 'Hint: ω = m(part) / m(whole). ', 'Maslahat: ω = m(qism) / m(butun). ')
  return ''
}

function num(s: string): number {
  return Number(s.replace(',', '.'))
}

/** Готовое решение — только расчёт по данным (молярная масса из таблицы), иначе честный отказ. */
function revealSolution(problem: string, lang: DialogLang): string {
  const formula = findFormulaInText(problem)
  const M = formula ? molarMassOf(formula) : null
  const mass = problem.match(/(\d+(?:[.,]\d+)?)\s*(?:г|g|gramm)(?![\p{L}])/iu)
  const moles = problem.match(/(\d+(?:[.,]\d+)?)\s*(?:моль|mol)(?![\p{L}])/iu)
  const fmt = (v: number) => (lang === 'ru' || lang === 'uz' ? String(Math.round(v * 1000) / 1000).replace('.', ',') : String(Math.round(v * 1000) / 1000))
  if (formula && M && mass && !moles) {
    const m = num(mass[1]!)
    const n = m / M.total
    const pf = prettyFormula(formula)
    return L(
      lang,
      `Решение: M(${pf}) = ${fmt(M.total)} г/моль (по таблице). n = m / M = ${fmt(m)} / ${fmt(M.total)} = ${fmt(n)} моль. Проверь единицы: г ÷ г/моль = моль.`,
      `Solution: M(${pf}) = ${fmt(M.total)} g/mol (from the table). n = m / M = ${fmt(m)} / ${fmt(M.total)} = ${fmt(n)} mol. Check units: g ÷ g/mol = mol.`,
      `Yechim: M(${pf}) = ${fmt(M.total)} g/mol (jadval boʻyicha). n = m / M = ${fmt(m)} / ${fmt(M.total)} = ${fmt(n)} mol. Birliklarni tekshir: g ÷ g/mol = mol.`,
    )
  }
  if (formula && M && moles) {
    const n = num(moles[1]!)
    const m = n * M.total
    const pf = prettyFormula(formula)
    return L(
      lang,
      `Решение: M(${pf}) = ${fmt(M.total)} г/моль (по таблице). m = n · M = ${fmt(n)} · ${fmt(M.total)} = ${fmt(m)} г.`,
      `Solution: M(${pf}) = ${fmt(M.total)} g/mol (from the table). m = n · M = ${fmt(n)} · ${fmt(M.total)} = ${fmt(m)} g.`,
      `Yechim: M(${pf}) = ${fmt(M.total)} g/mol (jadval boʻyicha). m = n · M = ${fmt(n)} · ${fmt(M.total)} = ${fmt(m)} g.`,
    )
  }
  return fillTemplate(pickFresh(HW_REVEAL_NO_DATA[lang]), { formula: 'n = m / M' })
}

function homeworkTurn(text: string, input: DialogInput, state: DialogState): DialogResult | null {
  const lang = input.lang
  const hw = state.homework ?? { problem: '', step: 0, revealed: false }
  const t = stripLeadingDiscourse(text).trim()
  if (STOP_RE.test(t)) {
    updateDialog(() => ({ mode: 'chat', homework: null, pending: null }))
    return say(pickFresh(HW_EXIT[lang]), 'homework_exit')
  }
  if (REVEAL_RE.test(t)) {
    if (!hw.problem) {
      updateDialog(() => ({ pending: 'homework-problem' }))
      return say(fillTemplate(pickFresh(HW_REVEAL_NO_DATA[lang]), { formula: 'n = m / M' }), 'homework_reveal')
    }
    updateDialog(() => ({ mode: 'chat', homework: { ...hw, revealed: true }, pending: null }))
    return say(revealSolution(hw.problem, lang), 'homework_reveal')
  }
  // Свой вопрос по теории посреди домашки — отвечает база, режим сохраняем.
  if (/\?\s*$/.test(t) && QUESTION_LIKE_RE.test(t) && !hw.problem && words(t) <= 8) return null
  if (!hw.problem) {
    // Ждём условие: числа, формулы или хотя бы 4 слова.
    if (!/\d/.test(t) && words(t) < 4) return say(pickFresh(HW_START[lang]), 'homework_start')
    const steps = HW_STEPS[lang]
    updateDialog(() => ({ mode: 'homework', homework: { problem: t, step: 1, revealed: false }, pending: null }))
    const term = findFormulaInText(t)
    if (term) pushTopic(prettyFormula(term))
    return say(fillTemplate(steps[0]!, { formulaHint: '' }), 'homework_step')
  }
  const steps = HW_STEPS[lang]
  if (hw.step >= steps.length) {
    updateDialog(() => ({ mode: 'chat', homework: hw }))
    return say(pickFresh(HW_DONE[lang]), 'homework_step')
  }
  const stepText = fillTemplate(steps[hw.step]!, { formulaHint: formulaHint(hw.problem, lang) })
  updateDialog(() => ({ homework: { ...hw, step: hw.step + 1 } }))
  return say(`${pickFresh(HW_STEP_ACK[lang])} ${stepText}`, 'homework_step')
}

/* ------------------------------------------------------- поддержка/обучение */

function detectMood(text: string): StudentMood | null {
  const t = foldText(text)
  if (/\?\s*$/.test(text.trim()) || words(text) > 12) return null
  if (/(что\s+такое|объясни|расскажи|what\s+is|explain|nima\s+bu|tushuntir)/iu.test(t)) return null
  for (const [mood, re] of SUPPORT_RE) if (re.test(t)) return mood
  return null
}

function supportTurn(mood: StudentMood, input: DialogInput): DialogResult {
  updateProfile(() => ({ mood, moodAt: Date.now() }))
  const text = `${pickFresh(SUPPORT[mood][input.lang])} ${pickFresh(OFFER_STEP[mood][input.lang], 1)}`
  updateDialog(() => ({ pending: 'offer-step' }))
  return say(text, 'support')
}

async function offerStepTurn(text: string, input: DialogInput): Promise<DialogResult | null> {
  const t = foldText(stripLeadingDiscourse(text))
  if (words(t) > 4) {
    updateDialog(() => ({ pending: null }))
    return null
  }
  const topic = currentTopic() ?? input.sectionTitle ?? ''
  if (/(викторин|вопрос|quiz|question|viktorina|savol|3)/iu.test(t)) {
    updateDialog(() => ({ pending: null }))
    return startQuiz(input, 3)
  }
  if (/(проще|простыми|simpler|simple|soddaroq|oddiyroq)/iu.test(t)) {
    updateDialog(() => ({ pending: null }))
    return topic
      ? { rewrite: L(input.lang, `объясни проще ${topic}`, `explain simpler ${topic}`, `soddaroq tushuntir ${topic}`), citations: [], confident: false, intent: 'rewrite' }
      : say(L(input.lang, 'Какую тему объяснить проще? Назови её — например, «моль» или «валентность».', 'Which topic shall I explain simpler? Name it — e.g. "mole" or "valence".', 'Qaysi mavzuni soddaroq tushuntiray? Nomini ayt — masalan, «mol» yoki «valentlik».'), 'offer_step')
  }
  if (/(пример|example|misol)/iu.test(t)) {
    updateDialog(() => ({ pending: null }))
    return topic
      ? { rewrite: L(input.lang, `пример ${topic}`, `example ${topic}`, `misol ${topic}`), citations: [], confident: false, intent: 'rewrite' }
      : say(L(input.lang, 'Пример по какой теме? Назови её.', 'An example on which topic? Name it.', 'Qaysi mavzuga misol? Nomini ayt.'), 'offer_step')
  }
  updateDialog(() => ({ pending: null }))
  return null
}

function teachTurn(text: string, input: DialogInput): DialogResult | null {
  const lang = input.lang
  const t = text.trim().replace(/^(?:запомни|запиши|remember|note|eslab\s+qol)\s*[:,—-]?\s*(?:что\s+|that\s+)?/iu, '')
  const name = t.match(NAME_RE)
  if (name) {
    const n = name[1]!.charAt(0).toUpperCase() + name[1]!.slice(1).toLowerCase()
    updateProfile(() => ({ name: n }))
    return say(fillTemplate(pickFresh(TEACH_NAME[lang]), { name: n }), 'teach_name')
  }
  if (STYLE_BRIEF_RE.test(t)) {
    updateProfile(() => ({ detail: -2 }))
    return say(pickFresh(TEACH_STYLE.brief[lang]), 'teach_style')
  }
  if (STYLE_MORE_RE.test(t)) {
    updateProfile(() => ({ detail: 2 }))
    return say(pickFresh(TEACH_STYLE.more[lang]), 'teach_style')
  }
  if (STYLE_EXAMPLES_RE.test(t)) {
    updateProfile(() => ({ examples: 2 }))
    return say(pickFresh(TEACH_STYLE.examples[lang]), 'teach_style')
  }
  for (const re of WEAK_RE) {
    const m = t.match(re)
    if (!m) continue
    const topic = cleanTopic(m[1]!)
    if (!topic || words(topic) > 5) continue
    updateProfile((p) => ({ weakTopics: [...p.weakTopics.filter((x) => x.toLowerCase() !== topic.toLowerCase()), topic], mood: 'confused', moodAt: Date.now() }))
    pushTopic(topic)
    return say(fillTemplate(pickFresh(TEACH_WEAK[lang]), { topic }), 'teach_weak')
  }
  return null
}

/* ------------------------------------------------------------ продолжения */

function hasPreviousQuestion(messages: DialogInput['messages']): boolean {
  if (!messages) return false
  return messages.slice(0, -1).some((m) => m.role === 'user' && isSubstantiveQuestion(m.content))
}

function continuationTurn(text: string, input: DialogInput): DialogResult | null {
  const topic = currentTopic()
  if (!topic) return null
  const clean = stripLeadingDiscourse(text)
  // «А он?», «а у него?» — сущность помнит humanTeacher; тема из стека — только если её нет.
  if (DEICTIC_RE.test(clean) && !loadProfile().lastEntity) {
    return { rewrite: topic, citations: [], confident: false, intent: 'rewrite' }
  }
  const f = detectFollowUp(clean)
  if (!f.kinds.length || !f.needsPrevious) return null
  // resolveTurn сам возьмёт прошлый вопрос из истории; подставляем тему лишь когда истории нет.
  if (hasPreviousQuestion(input.messages)) return null
  if (f.kinds.length === 1 && f.kinds[0] === 'repeat') return null
  return { rewrite: `${clean.replace(/[?!.]+$/u, '').trim()} ${topic}`, citations: [], confident: false, intent: 'rewrite' }
}

/* ------------------------------------------------------------------ шаг */

/**
 * Один ход диалога. null — обычный учебный вопрос (отвечает прежний маршрут).
 * {text} — готовый ответ; {rewrite} — запрос для базы с темой из стека.
 */
export async function dialogStep(raw: string, input: DialogInput): Promise<DialogResult | null> {
  const text = raw.trim()
  if (!text) return null
  const state = loadDialog()

  // 1) Активные режимы: всё, что говорит ученик, — ответ/шаг (кроме явного своего вопроса).
  if (state.mode === 'quiz' && state.quiz) return quizTurn(text, input, state)
  if (state.mode === 'homework') return homeworkTurn(text, input, state)

  const clean = stripLeadingDiscourse(text)
  // 2) Ожидали выбор шага после поддержки: «проще» / «пример» / «викторина».
  if (state.pending === 'offer-step') {
    const r = await offerStepTurn(text, input)
    if (r) return r
  }
  if (state.pending === 'homework-problem') {
    if (REVEAL_RE.test(clean) || HOMEWORK_RE.test(clean) || /\d/.test(clean) || words(clean) >= 4) {
      updateDialog(() => ({ mode: 'homework', homework: { problem: '', step: 0, revealed: false }, pending: null }))
      return homeworkTurn(text, input, loadDialog())
    }
    updateDialog(() => ({ pending: null }))
  }

  // 3) Команды: викторина, домашка, обучение учителя, поддержка.
  if (QUIZ_START_RE.test(clean) && words(clean) <= 8) {
    const n = clean.match(/(\d+)\s*(?:вопрос|question|savol)/iu)
    return startQuiz(input, n ? Math.max(1, Math.min(10, Number(n[1]))) : null)
  }
  if (HOMEWORK_RE.test(clean) && words(clean) <= 12 && !/\d+\s*(?:г|g|моль|mol|л|l|%)(?![\p{L}])/iu.test(clean)) {
    const d = saveDialog({ ...loadDialog(), mode: 'homework', homework: { problem: '', step: 0, revealed: false }, pending: 'homework-problem' })
    const hint = findFormulaInText(clean)
    if (hint) pushTopic(prettyFormula(hint))
    void d
    return say(pickFresh(HW_START[input.lang]), 'homework_start')
  }
  const taught = teachTurn(clean, input)
  if (taught) return taught
  const mood = detectMood(clean)
  if (mood) return supportTurn(mood, input)

  // 4) Продолжение без своей темы — тема из стека.
  const cont = continuationTurn(text, input)
  if (cont) return cont

  // 5) Обычный вопрос: запоминаем тему и отдаём базе.
  if (isSubstantiveQuestion(clean)) {
    const term = extractKeyTerm(clean, input.lang) ?? (words(clean) <= 6 ? clean.replace(/[?!.]+$/u, '') : null)
    if (term) pushTopic(term)
  }
  return null
}

/**
 * Подсказки стиля для ответа из базы: слабая тема ученика («мне сложно с ОВР») или недавнее
 * «не понимаю / устал / я тупой» (20 минут) → объяснять проще и короче.
 */
export function dialogStyleHints(query: string): { simpler: boolean; reason: 'weak-topic' | 'mood' | null } {
  const p = loadProfile()
  const qs = contentStems(query)
  const weak = p.weakTopics.some((t) => contentStems(t).some((k) => qs.some((s) => stemsMatch(s, k))))
  if (weak) return { simpler: true, reason: 'weak-topic' }
  const soft: StudentMood[] = ['confused', 'tired', 'down', 'scared']
  if (p.mood && soft.includes(p.mood) && Date.now() - p.moodAt < 20 * 60_000) return { simpler: true, reason: 'mood' }
  return { simpler: false, reason: null }
}

/** Для интерфейса/тестов: режим и счёт текущей беседы. */
export function dialogSnapshot(): { mode: DialogState['mode']; topics: string[]; score: DialogResult['score'] | null; pending: DialogState['pending'] } {
  const d = loadDialog()
  return { mode: d.mode, topics: [...d.topics], score: d.quiz ? scoreOf(d.quiz) : null, pending: d.pending }
}
