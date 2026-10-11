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

const EMPTY: DialogState = { topic: null, entities: [], lastStandalone: null, lastAnswer: null, grade: null, lengthPref: null, summary: null, turns: 0, lastKind: null }

export function buildDialogState(messages: ChatMessage[], ctx: ChatRequest['context'], kb: Knowledge, kindOf: KindOf = questionKindCompat): DialogState {
  const st: DialogState = { ...EMPTY, entities: [] }
  const past = messages.slice(0, -1)
  const topics: string[] = []
  let simpler = false
  let explicitGrade: GradeId | null = null
  /** формулы последнего ответа учителя — предмет для «а почему он так реагирует?», если ученик сам ничего не назвал */
  let answerEnts: string[] = []
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
    const lang = langOf(t, 'ru')
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
    if (!ents.length && !concept && own.length < 3) continue
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
