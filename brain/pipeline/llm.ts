/**
 * Шаг 7: ответ LLM (Ollama) потоком через StreamGate (R3, лимит слов, язык, CJK).
 * live-режим → быстрая модель (если есть); таймауты из config.timeouts (под этот ПК: первый токен чата 45 с,
 * живой голос 8 с, всего 120 с).
 * Срыв на китайский (CJK): поток останавливается, законченные предложения до срыва остаются; если их мало —
 * одна повторная попытка с напоминанием о языке (подсказка в кеше, это дёшево), иначе — запасной путь.
 * Язык не совпал → один вызов «переведи на …»; не вышло — ok:false, и конвейер отвечает запасным путём.
 */
import type { BrainConfig } from '../config.ts'
import type { ChatStreamResult, LlmClient, LlmMessage } from '../llm/ollama.ts'
import { CLASSIFY_PROMPT, LANG_REMINDER, translatePrompt } from '../persona/systemPrompt.ts'
import type { Intent } from './intent.ts'
import type { Lang } from './normalize.ts'
import { hasCjk, languageOk, scrubR3, StreamGate, trimToWords, wordCount } from './postcheck.ts'

export type LlmAnswer = {
  ok: boolean
  /** уже отправленный ученику текст */
  text: string
  stopped: string
  translated: boolean
  model: string | null
  /** модель сорвалась на CJK хотя бы в одной попытке */
  cjk?: boolean
  /** сколько попыток генерации (1 или 2) */
  attempts?: number
  /** мс до первого токена модели в последней попытке; токены подсказки, реально прочитанные (после кеша) */
  firstMs?: number
  promptTokens?: number
  promptMs?: number
}

/** Минимум слов, чтобы ответ, оборванный на CJK, считался ответом модели (иначе повтор / запасной путь). */
const CJK_MIN_WORDS = 12

export async function llmAnswer(a: {
  llm: LlmClient
  config: BrainConfig
  lang: Lang
  mode: 'chat' | 'live'
  detail: 'brief' | 'more'
  intent: Intent
  system: string
  history: LlmMessage[]
  wordLimit: number
  signal?: AbortSignal
  onDelta: (text: string) => void
}): Promise<LlmAnswer> {
  const st = a.llm.status()
  const model = a.mode === 'live' ? (st.fastModel ?? st.chatModel) : st.chatModel
  if (!st.available || !model) return { ok: false, text: '', stopped: 'unavailable', translated: false, model: null }
  const t0 = Date.now()
  const totalMs = a.config.timeouts.totalMs
  const baseTemp = a.intent === 'calc' || a.intent === 'homework' ? a.config.temperature.calc : a.config.temperature.chat
  let emitted = ''
  let cjk = false
  let attempts = 0
  let res: ChatStreamResult = { text: '', stopped: 'error' }
  let gate = new StreamGate(a.lang, a.wordLimit, a.onDelta)
  for (; attempts < 2; ) {
    attempts++
    const retry = attempts > 1
    const messages: LlmMessage[] = [{ role: 'system', content: a.system }, ...a.history]
    if (retry) {
      // повтор после срыва: тот же префикс (кеш), в конце короткое напоминание о языке; уже сказанное продолжаем
      const last = messages[messages.length - 1]!
      messages[messages.length - 1] = { ...last, content: `${last.content}\n\n${LANG_REMINDER[a.lang]}` }
    }
    gate = new StreamGate(a.lang, a.wordLimit - wordCount(emitted), (s) => {
      const piece = emitted && !/\s$/.test(emitted) && !/^\s/.test(s) ? ' ' + s : s
      emitted += piece
      a.onDelta(piece)
    })
    res = await a.llm.chatStream({
      model,
      messages,
      temperature: retry ? Math.min(baseTemp, 0.1) : baseTemp,
      numPredict: a.mode === 'live' ? a.config.numPredict.live : a.detail === 'more' ? a.config.numPredict.more : a.config.numPredict.brief,
      numCtx: a.config.numCtx,
      firstTokenMs: a.mode === 'live' ? a.config.timeouts.liveFirstTokenMs : a.config.timeouts.firstTokenMs,
      totalMs: Math.max(1000, totalMs - (Date.now() - t0)),
      signal: a.signal,
      onToken: (t) => gate.push(t),
    })
    if (res.stopped === 'client_abort') return { ok: false, text: emitted, stopped: res.stopped, translated: false, model, cjk, attempts }
    gate.end()
    if (gate.cjk) cjk = true
    // повторяем только если сорвались на CJK почти сразу, ничего толкового не сказав, и время ещё есть
    if (gate.cjk && wordCount(emitted) < CJK_MIN_WORDS && !retry && Date.now() - t0 < totalMs / 2 && !emitted) continue
    break
  }
  const stats = { firstMs: res.firstMs, promptTokens: res.promptTokens, promptMs: res.promptMs, attempts, cjk }
  if (gate.langMismatch && !emitted) {
    const raw = res.text
    const tr = await a.llm.complete({
      model: st.fastModel ?? model,
      messages: [
        { role: 'system', content: translatePrompt(a.lang) },
        { role: 'user', content: raw },
      ],
      timeoutMs: a.config.timeouts.translateMs,
      numPredict: a.config.numPredict.more,
      signal: a.signal,
    })
    if (tr && languageOk(tr, a.lang) && !hasCjk(tr)) {
      const clean = trimToWords(scrubR3(tr.trim(), a.lang), a.wordLimit)
      if (clean) {
        a.onDelta(clean)
        return { ok: true, text: clean, stopped: res.stopped, translated: true, model, ...stats }
      }
    }
    return { ok: false, text: '', stopped: 'lang_mismatch', translated: false, model, ...stats }
  }
  const stopped = cjk && res.stopped !== 'first_token_timeout' ? 'cjk' : res.stopped
  // CJK-обрыв с достаточным текстом — ответ модели (конвейер допишет недостающее из запасного пути)
  const okStop = res.stopped === 'done' || res.stopped === 'limit' || res.stopped === 'total_timeout' || (cjk && wordCount(emitted) >= CJK_MIN_WORDS)
  const ok = !!emitted.trim() && okStop
  return { ok, text: emitted, stopped, translated: false, model, ...stats }
}

const LABELS: Intent[] = ['smalltalk', 'chemistry', 'calc', 'homework', 'offtopic']

/** Уточнение спорного намерения одним быстрым вызовом (метка или null). */
export async function llmClassify(llm: LlmClient, config: BrainConfig, text: string, signal?: AbortSignal): Promise<Intent | null> {
  const st = llm.status()
  const model = st.fastModel ?? st.chatModel
  if (!st.available || !model) return null
  const out = await llm.complete({
    model,
    messages: [
      { role: 'system', content: CLASSIFY_PROMPT },
      { role: 'user', content: text.slice(0, 1500) },
    ],
    numPredict: 6,
    timeoutMs: config.timeouts.classifyMs,
    signal,
  })
  const label = out?.toLowerCase().match(/smalltalk|chemistry|calc|homework|offtopic/)?.[0]
  return label && LABELS.includes(label as Intent) ? (label as Intent) : null
}
