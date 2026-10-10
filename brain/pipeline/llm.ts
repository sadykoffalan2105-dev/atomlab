/**
 * Шаг 7: ответ LLM (Ollama) потоком через StreamGate (R3, лимит слов, язык).
 * live-режим → быстрая модель (если есть); таймауты: первый токен 4 с (live 2,5 с), всего 60 с.
 * Язык не совпал → один вызов «переведи на …»; не вышло — ok:false, и конвейер отвечает запасным путём.
 */
import type { BrainConfig } from '../config.ts'
import type { LlmClient, LlmMessage } from '../llm/ollama.ts'
import { CLASSIFY_PROMPT, translatePrompt } from '../persona/systemPrompt.ts'
import type { Intent } from './intent.ts'
import type { Lang } from './normalize.ts'
import { languageOk, scrubR3, StreamGate, trimToWords } from './postcheck.ts'

export type LlmAnswer = {
  ok: boolean
  /** уже отправленный ученику текст */
  text: string
  stopped: string
  translated: boolean
  model: string | null
}

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
  const gate = new StreamGate(a.lang, a.wordLimit, a.onDelta)
  const res = await a.llm.chatStream({
    model,
    messages: [{ role: 'system', content: a.system }, ...a.history],
    temperature: a.intent === 'calc' || a.intent === 'homework' ? a.config.temperature.calc : a.config.temperature.chat,
    numPredict: a.mode === 'live' ? a.config.numPredict.live : a.detail === 'more' ? a.config.numPredict.more : a.config.numPredict.brief,
    numCtx: a.config.numCtx,
    firstTokenMs: a.mode === 'live' ? a.config.timeouts.liveFirstTokenMs : a.config.timeouts.firstTokenMs,
    totalMs: a.config.timeouts.totalMs,
    signal: a.signal,
    onToken: (t) => gate.push(t),
  })
  if (res.stopped === 'client_abort') return { ok: false, text: gate.emitted, stopped: res.stopped, translated: false, model }
  const text = gate.end()
  if (gate.langMismatch) {
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
    if (tr && languageOk(tr, a.lang)) {
      const clean = trimToWords(scrubR3(tr.trim(), a.lang), a.wordLimit)
      if (clean) {
        a.onDelta(clean)
        return { ok: true, text: clean, stopped: res.stopped, translated: true, model }
      }
    }
    return { ok: false, text: '', stopped: 'lang_mismatch', translated: false, model }
  }
  const ok = !!text.trim() && (res.stopped === 'done' || res.stopped === 'limit' || res.stopped === 'total_timeout')
  return { ok, text, stopped: res.stopped, translated: false, model }
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
