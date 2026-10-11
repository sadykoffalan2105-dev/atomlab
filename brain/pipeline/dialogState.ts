/**
 * Мозг v2, DIALOG: состояние разговора из реплик, которые прислал сайт (до 12). Чистая функция — сервер сессий
 * не хранит: источник правды — история запроса (иначе eval, HTTP-клиенты и сайт расходятся).
 * Идём по репликам старые → новые (кроме последней — это текущий вопрос):
 *   user: содержательная реплика (своя сущность/понятие или ≥ 3 своих слов) становится lastStandalone, из неё — тема
 *         (первое понятие по-русски, иначе первая сущность, иначе 1–3 первых слова) и сущности; follow-up («а почему?»)
 *         тему не сбивает, «а у натрия?» меняет сущность, «в 8 классе» — класс, «пиши короче» — желаемую длину;
 *   assistant: lastAnswer = первое + последнее предложение (≤ 240 симв.), формулы из ответа — сущности
 *         (для «а почему он так реагирует?»).
 */
import type { Knowledge } from '../kb/shards.ts'
import type { ChatMessage, ChatRequest } from './chat.ts'
import { analyzeReply, contentWords, entitiesOf, gradeHint, resolveStandalone, styleCue, topicOf } from './dialogResolve.ts'
import type { DialogState, GradeId, QuestionKind } from './dialogTypes.ts'
import { findFormulas } from './entities.ts'
import { questionType } from './intent.ts'
import { cmpForm, detectLang, type Lang } from './normalize.ts'
import { splitSentences } from './postcheck.ts'

/** Тип вопроса для состояния: функция SOURCES (questionKind), пока её нет — по старому questionType. */
export type KindOf = (cmp: string, text: string) => QuestionKind

export function questionKindCompat(cmp: string, _text: string): QuestionKind {
  const q = questionType(cmp)
  return q === 'how' ? 'howto_obtain' : q === 'who' ? 'who_history' : q
}

/** Первое + последнее предложение, ≤ max символов. */
export function compressAnswer(text: string, max = 240): string {
  const ss = splitSentences(text.replace(/\n+/g, ' ')).map((s) => s.trim()).filter(Boolean)
  if (!ss.length) return ''
  let out = ss.length > 1 ? `${ss[0]} … ${ss[ss.length - 1]}` : ss[0]!
  if (out.length > max) {
    // последнее предложение важнее (там вопрос учителя «Хотите задачу?»), первое обрезаем
    const last = ss.length > 1 ? ss[ss.length - 1]! : ''
    const room = Math.max(40, max - last.length - 3)
    const first = ss[0]!.length > room ? ss[0]!.slice(0, room).replace(/\s+\S*$/, '') + '…' : ss[0]!
    out = last ? `${first} ${last}` : first
    if (out.length > max) out = out.slice(0, max - 1) + '…'
  }
  return out
}

function langOf(text: string, fallback: Lang): Lang {
  try {
    return detectLang(text)
  } catch {
    return fallback
  }
}

/** Явные английские слова: без них короткая латинская реплика в узбекском разговоре — узбекская («misol keltir», «ha»). */
const EN_MARK =
  /(?<![\p{L}'ʻʼ’])(the|what|is|are|was|how|why|of|which|does|do|did|you|your|hello|hi|thanks|thank|please|explain|can|could|would|i|my|and|with|in|a|an|about|for|more|detail|details|example|simpler|simply|again|yes|yeah|yep|sure|it|this|that|grade|tell|me|give|where|when|who|repeat|briefly|used|use|life|what's|it's)(?![\p{L}'ʻʼ’])/iu
/** Формулы («HNO3», «Ca(OH)2») — не язык. */
const FORMULA_TOKEN = /(?<![\p{L}])(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+(?![\p{L}])/gu

/**
 * Язык реплики с учётом разговора (lang = 'auto'): «natriyniki-chi?», «misol keltir», «ha», «HNO3 niki-chi?» после
 * узбекского вопроса — узбекские, хотя по одной реплике детектор видит английский; «HNO3?» без букв — язык разговора.
 * Кириллица и явные английские слова решают сами.
 */
export function stickyLang(text: string, detected: Lang, prev: Lang | null): Lang {
  if (!prev || prev === detected) return detected
  const bare = text.replace(FORMULA_TOKEN, (m) => (/\d/.test(m) || (m.match(/[A-Z]/g) ?? []).length >= 2 ? ' ' : m))
  const cyr = (bare.match(/[а-яёўқғҳ]/giu) ?? []).length
  const lat = (bare.match(/[a-z]/gi) ?? []).length
  if (!cyr && !lat) return prev
  if (cyr) return detected
  // «ok», «okay», «hmm» латиницей посреди русского или узбекского разговора — междометие, язык разговора прежний
  if (prev !== 'en' && /^\s*(ok|okay|okey|hmm+|lol)[\s!.,)]*$/iu.test(bare)) return prev
  if (prev === 'uz' && detected === 'en' && !EN_MARK.test(bare)) return 'uz'
  if (prev === 'en' && detected === 'uz' && !/[og]['ʻʼ’‘]/i.test(bare) && EN_MARK.test(bare)) return 'en'
  return detected
}

/** Язык каждой реплики ученика (старые → новые) с «липким» языком разговора; последняя — текущий вопрос. */
export function dialogLangs(messages: { role: string; content: string }[]): Lang[] {
  const out: Lang[] = []
  let prev: Lang | null = null
  for (const m of messages) {
    if (m.role !== 'user' || !m.content.trim()) continue
    const l = stickyLang(m.content, langOf(m.content, prev ?? 'ru'), prev)
    out.push(l)
    prev = l
  }
  return out
}

const EMPTY: DialogState = { topic: null, entities: [], lastStandalone: null, lastAnswer: null, grade: null, lengthPref: null, summary: null, turns: 0, lastKind: null }

export function buildDialogState(messages: ChatMessage[], ctx: ChatRequest['context'], kb: Knowledge, kindOf: KindOf = questionKindCompat): DialogState {
  const st: DialogState = { ...EMPTY, entities: [] }
  const past = messages.slice(0, -1)
  const topics: string[] = []
  let simpler = false
  let explicitGrade: GradeId | null = null
  /** формулы последнего ответа учителя — предмет для «а почему он так реагирует?», если ученик сам ничего не назвал */
  let answerEnts: string[] = []
  const langs = dialogLangs(past)
  let ui = 0
  for (const m of past) {
    const t = m.content.trim()
    if (!t) continue
    if (m.role === 'assistant') {
      st.lastAnswer = compressAnswer(t)
      // формулы из ответа учителя — кандидаты в сущности, если ученик сам ничего не назвал
      answerEnts = findFormulas(t, true).map((f) => f.ascii).filter((f, i, a) => f.length > 1 && a.indexOf(f) === i).slice(0, 2)
      continue
    }
    st.turns++
    const lang = langs[ui++] ?? langOf(t, 'ru')
    const g = gradeHint(t)
    if (g) explicitGrade = g
    const style = styleCue(t)
    if (style) st.lengthPref = style
    // реплика через те же правила, что и текущая: follow-up разрешается в прошлый вопрос
    const sq = resolveStandalone(t, st, { lang, cmp: cmpForm(t), kb, gradeId: ctx.gradeId })
    if (sq.followUp === 'simpler') simpler = true
    if (sq.followUp !== 'none') {
      if (sq.followUp === 'switch_entity' || sq.followUp === 'deictic') {
        st.lastStandalone = sq.text
        if (sq.entities.length) st.entities = sq.entities.slice(0, 4)
        if (sq.topic && sq.topic !== st.topic) {
          st.topic = sq.topic
          topics.push(sq.topic)
        }
      }
      if (sq.followUp === 'switch_grade' && sq.grade) explicitGrade = sq.grade
      continue
    }
    const shape = analyzeReply(t, { ...EMPTY }, lang, kb)
    const ents = entitiesOf(shape.clean, kb, lang).map((e) => e.ru)
    const concept = topicOf(shape.clean, lang)
    const own = contentWords(shape.clean, entitiesOf(shape.clean, kb, lang), [])
    // содержательна: своя сущность/понятие, ≥ 3 своих слов или вопрос со своим предметом («Что такое органическая химия?»)
    const asks = /\?\s*$/.test(t) || /^(что|как|какой|какая|какие|почему|зачем|где|когда|кто|сколько|расскажи|объясни|what|how|why|which|who|tell|explain|nima|qanday|nega|qaysi)(?!\p{L})/iu.test(shape.clean)
    if (!ents.length && !concept && own.length < 3 && !(asks && own.length >= 1)) continue
    st.lastStandalone = t
    st.lastKind = kindOf(cmpForm(t), t)
    const topic = concept ?? ents[0] ?? (own.slice(0, 3).join(' ') || null)
    if (topic && topic !== st.topic) topics.push(topic)
    st.topic = topic
    st.entities = ents.slice(0, 4)
    answerEnts = []
  }
  if (!st.entities.length && !st.topic && answerEnts.length) st.entities = answerEnts
  st.grade = explicitGrade ?? (/^g(7|8|9|10|11)$/.test(ctx.gradeId) ? (ctx.gradeId as GradeId) : null)
  if (past.length > 6 && (topics.length || simpler)) {
    const parts = [topics.length ? `Темы: ${topics.slice(-4).join(' → ')}` : '', st.grade ? `класс ${st.grade.slice(1)}` : '', simpler ? 'просил проще' : '', st.lengthPref === 'short' ? 'просил короче' : st.lengthPref === 'long' ? 'просил подробнее' : '']
    const s = parts.filter(Boolean).join('; ')
    st.summary = s.length > 220 ? s.slice(0, 219) + '…' : s
  }
  return st
}
