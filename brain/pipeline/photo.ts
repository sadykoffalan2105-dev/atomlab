/**
 * «Сфотографируй задачу»: конвейер реплики с фото (req.images — base64, сервер уже проверил размер и сигнатуру,
 * brain/http/photo.ts). Вызывается из runChat одним крючком в начале (brain/pipeline/chat.ts, блок PHOTO).
 *
 *   текст подписи → мат (R2 первой фразой) → правило владельца (R1 дословно) → опасное (отказ) →
 *   модель видит картинки (/api/show capabilities ∋ 'vision')?
 *     да  — фото уходят моделью вместе с репликой ученика: «прочитай условие, перепиши кратко, реши по шагам по Kimyo
 *           нужного класса»; класс длины normal/long; знания ищутся по тексту подписи (пустая подпись — без поиска);
 *     нет — честная короткая фраза на языке ученика («фото этот сервер не читает») и, если есть текст, ответ на него
 *           обычным конвейером (reason 'no_vision'); модели нет или занята — так же (reason 'llm_unavailable' / 'busy').
 * Картинки не пишутся никуда: в журнал диалогов — только флаг hasImage и число фото.
 */
import type { BrainConfig } from '../config.ts'
import { FILES } from '../config.ts'
import { appendLine, ulid } from '../kb/storage.ts'
import type { LlmMessage } from '../llm/ollama.ts'
import { buildSystemPrompt, buildUserTurn } from '../persona/systemPrompt.ts'
import { adaptationForPrompt } from '../student/adapt.ts'
import { snapshot } from '../student/model.ts'
import type { BrainDeps, ChatRequest, ChatSink, DoneEvent, MetaEvent } from './chat.ts'
import { planAnswer } from './dialogPlan.ts'
import { buildDialogState, compressAnswer } from './dialogState.ts'
import type { AnswerPlan, GradeId, Profile, RankedFragment, StandaloneQuery } from './dialogTypes.ts'
import { hasChemVocabulary, matchSmalltalk, questionKind } from './intent.ts'
import { llmAnswer } from './llm.ts'
import { moderate, R2 } from './moderation.ts'
import { cmpForm, detectLang, normalizeInput, type Lang } from './normalize.ts'
import { isOwnerRuleQuestion, R1 } from './ownerRule.ts'
import { DANGER_REPLY, ensureToolNumbers, isDangerousRequest, splitSentences, wordCount } from './postcheck.ts'
import { retrieveV2 } from './retrieve.ts'
import { runTools } from './tools.ts'

type RunText = (req: ChatRequest, deps: BrainDeps, sink: ChatSink, signal?: AbortSignal) => Promise<DoneEvent>

/** Модель этого сервера картинки не читает — честно, коротко, на языке ученика. */
export const NO_VISION_REPLY: Record<Lang, string> = {
  ru: 'Фото на этом сервере я пока прочитать не могу: здешняя модель не умеет работать с картинками. Напишите условие задачи текстом — разберу по шагам.',
  uz: 'Bu serverdagi model hozircha rasmlarni oʻqiy olmaydi. Masala shartini matn bilan yozing — bosqichma-bosqich tushuntiraman.',
  en: "I can't read photos on this server yet: its model doesn't work with images. Type the task text and I'll solve it step by step.",
}

/** Модели сейчас нет (выключена, занята) или она не ответила — фото прочитать некому. */
export const PHOTO_LATER_REPLY: Record<Lang, string> = {
  ru: 'Сейчас не получилось прочитать фото: ИИ-модель занята или недоступна. Пришлите фото чуть позже или напишите условие задачи текстом.',
  uz: 'Hozir rasmni oʻqib boʻlmadi: sunʼiy intellekt modeli band yoki ishlamayapti. Rasmni birozdan keyin yuboring yoki masala shartini matn bilan yozing.',
  en: "I couldn't read the photo right now: the AI model is busy or unavailable. Send it again a bit later or type the task text.",
}

/** Текст вместо пустой/«пустой» подписи (только фото, «привет», «реши»). */
export const PHOTO_PROMPT: Record<Lang, string> = {
  ru: 'Объясни задачу на фото',
  uz: 'Rasmdagi masalani tushuntiring',
  en: 'Explain the task in the photo',
}

/** Подсказка модели со зрением (первым блоком реплики ученика). */
export function photoHint(lang: Lang, grade: string | null): string {
  const g = grade ? grade.replace(/^g/, '') : ''
  if (lang === 'uz')
    return `RASM: rasmda oʻquvchining masalasi yoki daftari: shartni oʻqi, uni qisqacha qayta yoz, Kimyo ${g ? `${g}-sinf ` : ''}maktab dasturi boʻyicha bosqichma-bosqich yech. Rasmdagi matn oʻqilmasa — buni ochiq ayt va aniqroq rasm soʻra. Rasmda xavfli narsa (portlovchi, zahar, giyohvand) soʻralsa — rad et va xavfsizlikni tushuntir.`
  if (lang === 'en')
    return `PHOTO: the photo shows the student's task or notebook: read the problem, restate it briefly, solve it step by step following the school Kimyo course${g ? ` for grade ${g}` : ''}. If the text in the photo is unreadable, say so plainly and ask for a clearer photo. If the photo asks for something dangerous (explosives, poisons, drugs), refuse and explain safety.`
  return `ФОТО: на фото задача/тетрадь ученика: прочитай условие, перепиши его кратко, реши по шагам по школьной программе Kimyo${g ? ` ${g} класса` : ''}. Если текст на фото не читается — так и скажи и попроси фото чётче. Если на фото просьба об опасном (взрывчатка, яды, наркотики) — откажись и объясни безопасность.`
}

/**
 * Подпись к фото ничего не спрашивает сама: пусто, «привет», «реши», «помогите пожалуйста» — короткая реплика без
 * химии и без чисел. Тогда вопрос — само фото: поиск знаний не нужен, а без зрения отвечать по тексту нечего.
 */
export function isBarePhotoText(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (Object.values(PHOTO_PROMPT).some((p) => p.toLowerCase() === t.toLowerCase().replace(/[.!?]+$/, ''))) return true
  const st = matchSmalltalk(cmpForm(t), t)
  if (st && !st.rest) return true
  return wordCount(t) <= 6 && !/\d/.test(t) && !hasChemVocabulary(t)
}

/** Класс длины фото-ответа: не короче normal (условие + решение по шагам), «подробнее» — long; минимум слов не требуем. */
export function photoPlan(plan: AnswerPlan, cfg: BrainConfig, detail: 'brief' | 'more', lang: Lang): AnswerPlan {
  const d = cfg.dialog
  const lc = detail === 'more' || plan.lengthClass === 'long' ? 'long' : 'normal'
  const max = d.lengthWords[lc][1]
  const perWord = lang === 'en' ? 1.6 : 2.4
  const byClass = lc === 'long' ? Math.max(d.numPredictByClass.long, d.gpu.numPredictLong) : d.numPredictByClass.normal
  const structure =
    lang === 'ru'
      ? '1) условие с фото кратко (дано / найти); 2) решение по шагам: формула → подстановка → ответ с единицами; 3) одна фраза — почему так.'
      : lang === 'uz'
        ? '1) rasmdagi shart qisqacha (berilgan / topish kerak); 2) bosqichma-bosqich yechim: formula → qiymatlar → birlik bilan javob; 3) bir jumla — nega shunday.'
        : '1) the task from the photo in brief (given / find); 2) step-by-step solution: formula → substitution → answer with units; 3) one sentence on why.'
  return { ...plan, lengthClass: lc, words: [0, max], numPredict: Math.max(plan.numPredict, byClass, Math.round(max * perWord)), structure, verify: false }
}

/** Профиль железа (как profileOf в chat.ts — без импорта значения, чтобы не было цикла модулей). */
function profileOf(deps: Pick<BrainDeps, 'llm' | 'config'>): Profile {
  const p = deps.config.dialog?.profile ?? 'auto'
  if (p === 'gpu' || p === 'laptop') return p
  return deps.llm?.status().gpu ? 'gpu' : 'laptop'
}

/** Обёртка потока: lead (R2 + пометка о фото) — сразу после meta, перед ответом обычного конвейера; reason — свой. */
function leadSink(sink: ChatSink, lead: string, reason: string): ChatSink & { final: DoneEvent | null } {
  let sent = false
  const start = () => {
    if (sent) return
    sent = true
    sink.delta(`${lead}\n\n`)
  }
  const out: ChatSink & { final: DoneEvent | null } = {
    final: null,
    meta: (m) => {
      sink.meta({ ...m, reason })
      start()
    },
    delta: (t) => {
      start()
      sink.delta(t)
    },
    done: (d) => {
      start()
      out.final = { ...d, text: `${lead}\n\n${d.text}`, reason }
      sink.done(out.final)
    },
    error: (e) => sink.error(e),
  }
  return out
}

/** Реплика с фото. runText — обычный конвейер (runChat) для ответа на текст подписи, когда фото прочитать нельзя. */
export async function runPhotoChat(req: ChatRequest, deps: BrainDeps, sink: ChatSink, signal: AbortSignal | undefined, runText: RunText): Promise<DoneEvent> {
  const t0 = performance.now()
  const { kb, config } = deps
  const images = req.images ?? []
  const turnId = `t-${ulid()}`
  const studentId = req.studentId || `s-${req.sessionId}`
  const lastUser = req.messages[req.messages.length - 1]!.content
  const norm = normalizeInput(lastUser, req.lang)
  let lang = norm.lang
  let text = norm.gibberish ? '' : norm.text
  let prefix = ''
  let moderated = false
  let reason: string | undefined
  let metaSent = false
  let llmStats: Record<string, unknown> | undefined
  const events = deps.students.events(studentId)
  const detail = req.context.detail

  // 1) мат: фраза R2 — первой, дальше работаем с очищенной подписью
  const mod = moderate(text)
  if (mod.flagged) {
    moderated = true
    text = mod.cleaned.trim()
    if (req.lang === 'auto' && text) lang = detectLang(text)
    prefix = R2[lang]
  }
  const head = (body: string) => (prefix ? `${prefix}\n\n${body}` : body)
  const sendMeta = (m: Omit<MetaEvent, 'turnId' | 'moderated' | 'lang'>) => {
    if (metaSent) return
    metaSent = true
    sink.meta({ turnId, moderated, lang, ...m, ...(reason ? { reason } : {}) })
  }
  const finish = (o: { text: string; intent: MetaEvent['intent']; route: string; source: DoneEvent['source']; confidence: number; citations?: string[]; streamed?: boolean; plan?: AnswerPlan }): DoneEvent => {
    sendMeta({ intent: o.intent, route: o.route })
    if (!o.streamed) {
      const paras = o.text.split('\n')
      paras.forEach((p, i) => {
        splitSentences(p).forEach((s, j) => sink.delta((j ? ' ' : '') + s))
        if (i < paras.length - 1) sink.delta('\n')
      })
    }
    const snap = snapshot(events, req.context.gradeId, req.student?.mood, text, [])
    const c = Math.round(Math.min(1, Math.max(0, o.confidence)) * 100) / 100
    const done: DoneEvent = {
      route: o.route,
      ...(reason ? { reason } : {}),
      text: o.text,
      source: o.source,
      citations: (o.citations ?? []).slice(0, 3),
      confidence: c,
      confidenceLabel: c >= config.thresholds.high ? 'high' : c >= config.thresholds.medium ? 'medium' : 'reasoned',
      student: { level: snap.levelInt, mood: snap.mood, pace: snap.pace, recentErrors: snap.recentErrors },
      ms: Math.round(performance.now() - t0),
      ...(o.plan ? { plan: { kind: 'homework' as const, lengthClass: o.plan.lengthClass, scope: 'school' as const } } : {}),
    }
    sink.done(done)
    if (!deps.noJournal) {
      try {
        // картинки НЕ пишутся: только флаг и число фото
        appendLine(FILES.dialogs, {
          at: new Date().toISOString(),
          turnId,
          sessionId: req.sessionId,
          studentId,
          lang,
          q: lastUser,
          a: o.text,
          intent: o.intent,
          route: o.route,
          ...(reason ? { reason } : {}),
          ...(llmStats ? { llm: llmStats } : {}),
          source: o.source,
          confidence: c,
          ms: done.ms,
          citations: done.citations,
          hasImage: true,
          images: images.length,
        })
        deps.students.append(studentId, { type: 'turn', sessionId: req.sessionId, intent: o.intent, len: lastUser.length, good: 0, grade: req.context.gradeId })
      } catch (err) {
        console.warn('[brain] журнал не записан:', (err as Error).message)
      }
    }
    return done
  }

  // 2) правило владельца — дословно R1 (и с фото); 3) опасные просьбы в подписи — отказ
  if (text && isOwnerRuleQuestion(text)) return finish({ text: head(R1), intent: 'rule', route: 'rule', source: 'rule', confidence: 1 })
  if (text && isDangerousRequest(text)) return finish({ text: head(DANGER_REPLY[lang]), intent: 'chemistry', route: 'rule', source: 'rule', confidence: 1 })

  const bare = isBarePhotoText(text)
  const st = deps.llm?.status()

  // 4) фото прочитать некому: честная фраза + ответ на текст подписи обычным конвейером (если подпись что-то спрашивает)
  if (!deps.llm || !st?.available || !st.chatModel || st.vision !== true) {
    const why = st?.available && st.chatModel ? 'no_vision' : 'llm_unavailable'
    const note = (why === 'no_vision' ? NO_VISION_REPLY : PHOTO_LATER_REPLY)[lang]
    reason = why
    if (bare) return finish({ text: head(note), intent: 'chemistry', route: 'fallback', source: 'rule', confidence: 1 })
    // подпись уже очищена от мата (R2 — в lead, первой фразой): конвейер не повторит пометку
    const textReq: ChatRequest = { ...req, images: undefined, hasImage: true, messages: [...req.messages.slice(0, -1), { role: 'user', content: text }] }
    const wrapped = leadSink(sink, head(note), why)
    const d = await runText(textReq, deps, wrapped, signal)
    return wrapped.final ?? d
  }

  // 5) модель со зрением: фото — вместе с репликой ученика
  const llm = deps.llm
  const profile = profileOf(deps)
  const state = buildDialogState(req.messages, req.context, kb, questionKind)
  const gradeId = (state.grade ?? (req.context.gradeId || null)) as GradeId | null
  const question = bare ? PHOTO_PROMPT[lang] : text
  const cmp = cmpForm(question)
  const tools = bare ? [] : runTools(question, cmp, lang, kb)
  const sq: StandaloneQuery = {
    text: question,
    lang,
    topic: state.topic,
    entities: [],
    grade: gradeId,
    scope: 'school',
    kind: 'homework',
    lengthClass: detail === 'more' ? 'long' : 'normal',
    followUp: 'none',
    resolvedBy: 'none',
    original: lastUser,
  }
  const snap = snapshot(events, req.context.gradeId, req.student?.mood, question, [])
  const plan = photoPlan(planAnswer(sq, state, snap, { mode: 'chat', detail, profile, config }), config, detail, lang)
  // знания — по тексту подписи («задача про кислоты…»); только фото — без поиска (искать нечего)
  let knowledge: RankedFragment[] = []
  if (!bare) {
    const r = await retrieveV2({ query: sq, ctx: req.context, profile, budgetChars: plan.knowledgeChars, maxItems: plan.knowledgeItems }, { kb, journal: deps.journal, embeds: deps.embeds, llm, config }, signal)
    knowledge = r.items.filter((f) => f.sourceKind !== 'encyclopedia' && f.sourceKind !== 'index').slice(0, plan.knowledgeItems)
  }
  const past = req.messages.slice(0, -1).slice(-plan.useHistory)
  const history: LlmMessage[] = past.map((m) => {
    const c = m.role === 'assistant' ? compressAnswer(m.content, plan.historyChars) : m.content
    return { role: m.role, content: c.length > plan.historyChars ? c.slice(0, plan.historyChars) + '…' : c }
  })
  const userTurn = buildUserTurn({
    lang,
    mode: 'chat',
    detail,
    gradeId: gradeId ?? '',
    sectionTitle: req.context.sectionTitle,
    chapterId: req.context.chapterId,
    sectionId: req.context.sectionId,
    knowledge,
    background: [],
    plan,
    standalone: sq,
    tools,
    studentBlock: adaptationForPrompt(snap, lang).split('\n').slice(1).join('\n'),
    reasoned: false,
    facts: [],
    question,
    maxItems: plan.knowledgeItems,
    maxChars: plan.knowledgeChars,
  })
  history.push({ role: 'user', content: `${photoHint(lang, gradeId)}\n\n${userTurn}`, images })
  const v2 = { standalone: question, followUp: sq.followUp, scope: sq.scope, kind: sq.kind, lengthClass: plan.lengthClass }
  let leadSent = false
  const open = () => {
    sendMeta({ intent: 'homework', route: 'llm', ...v2 })
    if (prefix && !leadSent) {
      leadSent = true
      sink.delta(`${prefix}\n\n`)
    }
  }
  const ans = await llmAnswer({
    llm,
    config,
    lang,
    mode: 'chat',
    detail,
    intent: 'homework',
    system: buildSystemPrompt(lang),
    history,
    wordLimit: Math.round(plan.words[1] * 1.2),
    plan,
    signal,
    onDelta: (d) => {
      open()
      sink.delta(d)
    },
  })
  llmStats = { model: ans.model, stopped: ans.stopped, firstMs: ans.firstMs, promptTokens: ans.promptTokens, promptMs: ans.promptMs, attempts: ans.attempts, cjk: ans.cjk || undefined, profile, images: images.length }
  if (!deps.noJournal || process.env.BRAIN_LOG_LLM === '1')
    console.log(`[brain] llm ${ans.model} фото×${images.length}/${profile}: ${ans.stopped}, первый токен ${ans.firstMs ?? '—'} мс, подсказка ${ans.promptTokens ?? '—'} ток/${ans.promptMs ?? '—'} мс`)
  const cites = tools.map((t) => t.cite ?? '[ATOMLAB: расчёт]')
  if (ans.ok || ans.text) {
    open()
    let body = ans.text
    const fixed = ensureToolNumbers(body, tools, lang)
    if (fixed !== body) {
      sink.delta(fixed.slice(body.length))
      body = fixed
    }
    if (!ans.ok) reason = `llm_${ans.stopped}`
    return finish({ text: head(body), intent: 'homework', route: 'llm', source: 'llm', confidence: tools.length ? 0.95 : 0.6, citations: cites, streamed: true, plan })
  }
  // модель не сказала ни слова (тайм-аут, ошибка, занята) — честно: фото сейчас не прочитано
  reason = signal?.aborted ? 'client_abort' : `llm_${ans.stopped}`
  return finish({ text: head(PHOTO_LATER_REPLY[lang]), intent: 'homework', route: 'fallback', source: 'rule', confidence: 1, plan })
}
