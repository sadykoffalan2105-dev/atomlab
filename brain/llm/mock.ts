/**
 * Подмена Ollama для тестов и `npm run brain:eval -- --mock-llm`: детерминированная «модель», которая
 * отвечает по блокам системного промпта (ЗНАНИЯ, ВЫЧИСЛЕНО ТОЧНО), стримит текст по словам и
 * нарочно ведёт себя как настоящая маленькая LLM — иногда вставляет R3-фразы («не знаю точно, но…»)
 * и портит числа расчёта. Так проверяется весь путь llm → StreamGate → postcheck без Ollama.
 */
import type { ChatStreamOptions, ChatStreamResult, LlmClient, LlmMessage, LlmStatus } from './ollama.ts'

export type MockOptions = {
  /** доля «капризных» ответов (R3-фраза в начале + испорченное число), 0..1; решается детерминированно по тексту вопроса */
  misbehave?: number
  /** задержка между токенами, мс */
  tokenDelayMs?: number
  /** задержка до первого токена, мс (проверка таймаута первого токена) */
  firstTokenDelayMs?: number
  /** отвечать не на том языке (проверка перевода) */
  wrongLanguage?: boolean
  available?: boolean
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res) => {
    if (ms <= 0) return res()
    const t = setTimeout(res, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), res()), { once: true })
  })

function block(system: string, heads: RegExp): string {
  const m = system.match(heads)
  if (!m || m.index === undefined) return ''
  const rest = system.slice(m.index + m[0].length)
  const end = rest.search(/\n\n[A-ZА-ЯЁʻ'Oʻ ]{4,}[^\n]*:\n|\n\n(ВЫЧИСЛЕНО|VERILGAN|CALCULATED|УЧЕНИК|OʻQUVCHI|STUDENT|Найденных|Topilgan|Little)/)
  return (end >= 0 ? rest.slice(0, end) : rest).trim()
}

function langOf(system: string): 'ru' | 'uz' | 'en' {
  if (/^Sen — tirik/.test(system)) return 'uz'
  if (/^You are a living/.test(system)) return 'en'
  return 'ru'
}

const OPENERS = {
  ru: ['Коротко: ', 'Смотрите: ', 'Давайте разберём. '],
  uz: ['Qisqasi: ', 'Qarang: ', 'Keling, koʻrib chiqamiz. '],
  en: ['In short: ', 'Look: ', 'Let us unpack it. '],
}
const CLOSERS = {
  ru: 'Логика простая: свойства вещества следуют из строения атомов и законов сохранения. Хотите пример с задачей?',
  uz: 'Mantiq oddiy: moddaning xossalari atomlar tuzilishi va saqlanish qonunlaridan kelib chiqadi. Masala bilan misol koʻraylikmi?',
  en: 'The logic is simple: properties follow from atomic structure and the conservation laws. Shall we try a worked example?',
}
const R3_OPENERS = { ru: 'Я не знаю точно, но думаю, что ', uz: 'Bilmayman, lekin menimcha, ', en: "I don't know for sure, but I think " }

export class MockLlm implements LlmClient {
  calls = 0
  readonly opts: MockOptions
  constructor(opts: MockOptions = {}) {
    this.opts = opts
  }

  status(): LlmStatus {
    const on = this.opts.available !== false
    return { available: on, chatModel: on ? 'mock-7b' : null, fastModel: on ? 'mock-3b' : null, embedModel: null, checkedAt: Date.now() }
  }

  async refresh(): Promise<LlmStatus> {
    return this.status()
  }

  /** Ответ «модели» по системному промпту и последнему вопросу. */
  compose(messages: LlmMessage[]): string {
    const system = messages.find((m) => m.role === 'system')?.content ?? ''
    const q = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const lang = langOf(system)
    const h = hash(q)
    const bad = (this.opts.misbehave ?? 0) > 0 && (h % 1000) / 1000 < (this.opts.misbehave ?? 0)
    const know = block(system, /\n(ЗНАНИЯ|BILIMLAR|KNOWLEDGE)[^\n]*:\n/)
    const exact = block(system, /\n(ВЫЧИСЛЕНО ТОЧНО|VERILGAN ANIQ HISOB|CALCULATED EXACTLY)[^\n]*:\n/)
    const parts: string[] = []
    const open = OPENERS[lang][h % 3]!
    if (exact) {
      let calc = exact.split('\n').filter(Boolean).slice(0, 3).join(' ')
      // «капризная» модель портит первое десятичное число — postcheck обязан вернуть точный расчёт
      if (bad) calc = calc.replace(/(\d+)[.,](\d+)/, (_m, a: string, b: string) => `${Number(a) + 1},${b}`)
      parts.push(open + calc)
    }
    const first = know.split('\n')[0] ?? ''
    const body = first.replace(/^\[\d+\]\s*\[[^\]]*\]\s*/, '').replace(/^[^:]{0,120}:\s*/, '')
    const sent = body.match(/^.{20,400}?[.!?](\s|$)/)?.[0]?.trim() ?? body.slice(0, 240)
    if (sent && lang === 'ru') parts.push((parts.length ? '' : open) + sent)
    else if (sent && !parts.length) parts.push(open + (lang === 'uz' ? 'bu savol kimyoning asosiy qonunlariga bogʻliq.' : 'this question rests on the basic laws of chemistry.'))
    if (!parts.length) parts.push(open + (lang === 'ru' ? 'разберём от основ: опираемся на строение атома и законы сохранения.' : lang === 'uz' ? 'asoslardan boshlaymiz: atom tuzilishi va saqlanish qonunlariga tayanamiz.' : 'let us reason from the basics: atomic structure and the conservation laws.'))
    parts.push(CLOSERS[lang])
    let text = parts.join(' ')
    if (bad) text = R3_OPENERS[lang] + text.charAt(0).toLowerCase() + text.slice(1)
    if (this.opts.wrongLanguage) text = lang === 'en' ? 'Это ответ на русском языке вместо английского, чтобы проверить перевод и запасной путь сервера.' : 'This answer is in English instead of the expected language, to test translation and the server fallback path.'
    return text
  }

  async chatStream(o: ChatStreamOptions): Promise<ChatStreamResult> {
    this.calls++
    const text = this.compose(o.messages)
    const t0 = Date.now()
    if (this.opts.firstTokenDelayMs) {
      await sleep(Math.min(this.opts.firstTokenDelayMs, o.firstTokenMs + 50), o.signal)
      if (Date.now() - t0 >= o.firstTokenMs) return { text: '', stopped: 'first_token_timeout' }
    }
    let out = ''
    for (const tok of text.match(/\S+\s*/g) ?? []) {
      if (o.signal?.aborted) return { text: out, stopped: 'client_abort' }
      await sleep(this.opts.tokenDelayMs ?? 0, o.signal)
      out += tok
      if (o.onToken(tok) === false) return { text: out, stopped: 'limit' }
      if (Date.now() - t0 > o.totalMs) return { text: out, stopped: 'total_timeout' }
    }
    return { text: out, stopped: 'done' }
  }

  async complete(o: { model: string; messages: LlmMessage[]; timeoutMs: number }): Promise<string | null> {
    this.calls++
    const system = o.messages[0]?.content ?? ''
    if (/Classify the student message/.test(system)) {
      const q = o.messages[1]?.content ?? ''
      return /\d/.test(q) ? 'calc' : /химия|kimyo|chemi|вещест|reakts|реакц/i.test(q) ? 'chemistry' : 'offtopic'
    }
    // «перевод» — запасной путь проверяет, что ответ уже на нужном языке; мок перевести не умеет
    return null
  }

  async embed(): Promise<number[][] | null> {
    return null
  }
}
