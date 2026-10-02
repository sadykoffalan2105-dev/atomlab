/**
 * ML-шаг маршрута учителя: когда «человеческий» слой (humanTurn) промолчал, спрашиваем
 * классификатор намерений.
 *   - разговорные намерения → реплика из банка (intentReplies);
 *   - учебные → подсказка стиля для композитора (почему / пример / проще / подробнее);
 *   - низкая уверенность (p < 0,55) → ничего не меняем;
 *   - поправка ученика («нет, я спросил что такое…», «это была шутка») и 👎 с последующей
 *     переформулировкой → teachIntent (дообучение в моменте, localStorage).
 */
import type { ComposeStyle } from '../dualMode/localAnswerComposer'
import { hasFormula, TALK_INTENTS, type Intent } from './intentFeatures'
import { predictIntent, teachIntent, type IntentPrediction } from './intentClassifier'
import { replyForIntent, type ReplyLang } from './intentReplies'

export const INTENT_CONFIDENCE = 0.55

export interface IntentStepResult {
  intent: Intent
  p: number
  /** Готовая реплика учителя (разговорное намерение). */
  reply?: string
  /** Переписанный вопрос («нет, я спросил что такое моль» → «что такое моль»). */
  rewrite?: string
  /** Подсказка стиля для учебного ответа. */
  style?: Partial<ComposeStyle>
  /** Было ли дообучение на этой реплике. */
  learned?: boolean
}

/* ------------------------------------------------------------ память сессии */

interface SessionState {
  lastText: string | null
  lastIntent: Intent | null
  awaitingRephrase: boolean
}
const session: SessionState = { lastText: null, lastIntent: null, awaitingRephrase: false }

/** Для UI: ученик нажал 👎 на последний ответ — следующая переформулировка станет поправкой. */
export function noteNegativeFeedback(): void {
  if (session.lastText) session.awaitingRephrase = true
}
/** Для тестов. */
export function resetIntentSession(): void {
  session.lastText = null
  session.lastIntent = null
  session.awaitingRephrase = false
}

/* ------------------------------------------------------------ поправки ученика */

const JOKE_CORRECTION = /(это была шутка|это шутка была|я пошутил|я пошутила|я шутил|я шутила|it was a joke|just kidding|i was joking|i was kidding|hazil edi|hazillashdim|hazillashgandim)/iu
const RESTATE = /^(?:нет|неа|не|не то|ты не понял|ты не поняла|ты неправильно понял|no|nope|wrong|yo['‘ʻ]?q)[,.!:\s-]*(?:я\s+|i\s+|men\s+)?(?:спросил[а]?|спрашивал[а]?|имел[а]? в виду|хотел[а]? (?:узнать|спросить)|говорил[а]?|про|asked|meant|mean|was asking|so['‘ʻ]?radim|nazarda tutdim)?[,:\s]*(.{3,})$/iu

/** Явная поправка: что ученик имел в виду на самом деле. */
function detectCorrection(text: string): { kind: 'joke' } | { kind: 'restate'; rest: string } | null {
  if (JOKE_CORRECTION.test(text)) return { kind: 'joke' }
  const m = RESTATE.exec(text.trim())
  if (m && /(спросил|спрашивал|имел|имела|хотел|хотела|говорил|говорила|про\b|asked|meant|mean|nazarda|so['‘ʻ]?radim|haqida)/iu.test(text)) {
    const rest = m[1]!.replace(/^(?:что|that|what)\s+/iu, (s) => s).trim()
    if (rest.length >= 3) return { kind: 'restate', rest }
  }
  return null
}

/* ------------------------------------------------------------ стиль */

const STYLE_BY_INTENT: Partial<Record<Intent, Partial<ComposeStyle>>> = {
  why: { wantWhy: true },
  example: { wantExample: true },
  simpler: { simpler: true },
  more_detail: { detail: 'more' },
}

/** Слить стиль follow-up-детектора с подсказкой классификатора (регулярки главнее при явном follow-up). */
export function mergeIntentStyle(base: ComposeStyle, hint: Partial<ComposeStyle> | undefined, hasFollowUp: boolean): ComposeStyle {
  if (!hint) return base
  return {
    ...base,
    wantWhy: Boolean(base.wantWhy || hint.wantWhy),
    wantExample: Boolean(base.wantExample || hint.wantExample),
    simpler: Boolean(base.simpler || hint.simpler),
    detail: hasFollowUp ? base.detail : (hint.detail ?? base.detail),
  }
}

/** Энциклопедический вопрос («что такое …», «кто открыл …», «расскажи о …») — не офтоп: отвечает база/энциклопедия. */
const ENCYCLO_GUARD = /^(?:а\s+|и\s+)?(что\s+(такое|это)|кто\s+(такой|такая|такие|открыл|изобр[её]л|создал|придумал|получил|первым)|расскажи\s+(о|об|про)|what\s+(is|are|was)|who\s+(discovered|invented|was|is|created)|tell\s+me\s+about|kim\s+(kashf|ixtiro|yaratgan|edi)|nima\s+bu|haqida\s+ayt)/iu

/** Похоже на химию — offtopic/gibberish от классификатора не применяем (пусть ответит база знаний). */
const CHEM_GUARD = /(оксид|кислот|основани|соль|соли|солей|реакц|моль|молярн|атом|молекул|хими|элемент|валент|формул|уравнен|раствор|газ|металл|ион|электрон|oxide|acid|base|salt|reaction|mole|molar|atom|molecule|chem|element|valence|formula|equation|solution|metal|ion|electron|oksid|kislota|asos|tuz|reaksiya|mol|molyar|atom|molekula|kimyo|element|valent|formula|tenglama|eritma|metall|ion|elektron)/iu

/** Вопрос «за пределами школы» (учёные, история, промышленность, быт) — не считаем офтопом. */
const BEYOND_SCHOOL =
  /(кто\s+так|кто\s+откр|кто\s+созда|кто\s+изобр|кто\s+получил|расскаж|биограф|учен|учён|химик|истори|нобелев|промышлен|в быту|в жизни|зачем нуж|где использ|где примен|применени|who\s+(is|was|discover|invent)|tell me about|history|scientist|chemist|nobel|industr|kim\s*\?|kim\s+edi|kashf|haqida|olim|tarix)/iu

/* ------------------------------------------------------------ шаг */

/**
 * ML-шаг. `topic` — тема урока (для возврата к химии при offtopic), `lang` — язык интерфейса.
 * Возвращает null, если классификатор не уверен или модель недоступна.
 */
export async function mlIntentStep(text: string, lang: ReplyLang, opts: { topic?: string } = {}): Promise<IntentStepResult | null> {
  const clean = text.trim()
  if (!clean) return null

  // 1) явная поправка ученика → дообучение на ПРЕДЫДУЩЕЙ реплике
  const corr = detectCorrection(clean)
  if (corr) {
    let learned = false
    if (corr.kind === 'joke') {
      if (session.lastText && session.lastIntent !== 'joke') learned = await teachIntent(session.lastText, 'joke')
      session.awaitingRephrase = false
      const reply = replyForIntent('feedback_neg', lang) // мягкое «понял» без выдумок
      const ack = lang === 'ru' ? 'Понял, это была шутка — запомню.' : lang === 'en' ? 'Got it, that was a joke — noted.' : 'Tushundim, bu hazil ekan — eslab qoldim.'
      return { intent: 'correction', p: 1, reply: reply ? ack : ack, learned }
    }
    const pred = await predictIntent(corr.rest)
    if (pred && pred.p >= INTENT_CONFIDENCE && session.lastText && session.lastIntent !== pred.intent && !TALK_INTENTS.has(pred.intent as Intent)) {
      learned = await teachIntent(session.lastText, pred.intent)
    }
    session.awaitingRephrase = false
    session.lastText = corr.rest
    session.lastIntent = (pred?.intent as Intent) ?? null
    return { intent: 'correction', p: pred?.p ?? 1, rewrite: corr.rest, style: pred ? STYLE_BY_INTENT[pred.intent as Intent] : undefined, learned }
  }

  // 2) обычная реплика
  let pred: IntentPrediction | null
  try {
    pred = await predictIntent(clean)
  } catch {
    pred = null
  }
  if (!pred) return null
  const intent = pred.intent as Intent
  if (pred.p < INTENT_CONFIDENCE) {
    session.lastText = clean
    session.lastIntent = null
    session.awaitingRephrase = false
    return null
  }

  if (TALK_INTENTS.has(intent)) {
    if ((intent === 'offtopic' || intent === 'gibberish') && (hasFormula(clean) || CHEM_GUARD.test(clean))) return null
    // «кто такой / кто открыл / расскажи о / история …» — вопрос об учёном или о химии вокруг нас: отвечают учёные/энциклопедия, не офтоп
    if (intent === 'offtopic' && BEYOND_SCHOOL.test(clean)) return null
    // «Что такое пенициллин и кто его открыл», «кто такой Флеминг» — энциклопедия/база, а не «тут я бессилен».
    if ((intent === 'offtopic' || intent === 'gibberish') && ENCYCLO_GUARD.test(clean)) return null
    if (intent === 'feedback_neg') {
      if (session.lastText) session.awaitingRephrase = true
    } else if (intent !== 'feedback_pos') {
      session.awaitingRephrase = false
    }
    const reply = replyForIntent(intent, lang, { topic: opts.topic })
    return reply ? { intent, p: pred.p, reply } : null
  }

  // учебное намерение: 👎 + переформулировка → поправка прошлой реплики
  let learned = false
  if (session.awaitingRephrase && session.lastText && session.lastText !== clean && session.lastIntent && session.lastIntent !== intent) {
    learned = await teachIntent(session.lastText, intent)
  }
  session.awaitingRephrase = false
  session.lastText = clean
  session.lastIntent = intent
  return { intent, p: pred.p, style: STYLE_BY_INTENT[intent], learned }
}

/** Заменить последнюю реплику ученика (для `rewrite`). */
export function replaceLastUser<M extends { role: string; content: string }>(messages: M[], content: string): M[] {
  const next = [...messages]
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i]?.role === 'user') {
      next[i] = { ...next[i]!, content }
      break
    }
  }
  return next
}
