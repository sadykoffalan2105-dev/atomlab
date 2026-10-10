/**
 * Шаг 8: пост-проверка ответа.
 *   R3 — запрещённые фразы («не знаю», «нет в базе», «Puter», «умный ИИ»…) переписываются в «Рассуждаю от законов: …»;
 *   язык ответа = язык вопроса (иначе один перевод LLM, без неё — запасной текст);
 *   длина — обрезка по границе предложения до лимита режима;
 *   числа инструментов обязаны присутствовать (иначе дописываем блок точного расчёта);
 *   опасные инструкции — фильтр как в src/learn/learnAssistantGuard.ts (6 регексов): синтез взрывчатки, ядов,
 *   наркотиков — отказ; объяснять безопасность и «почему опасно» можно.
 */
import { matchesLang, type Lang } from './normalize.ts'
import type { ToolResult } from './tools.ts'

/** Из src/learn/learnAssistantGuard.ts (BLOCKED_PATTERNS). */
const BLOCKED_PATTERNS = [/взрывчат/i, /\bexplosive\b/i, /наркотик/i, /\bdrug\s+synth/i, /отравить\s+человек/i, /poison\s+someone/i]
const EXTRA_DANGER = [/(нитроглицерин|тротил|гексоген|tnt|rdx|пероксид ацетона|tatp|напалм|зарин|иприт|рицин|метамфетамин|амфетамин|героин|кокаин|portlovchi|zaharlash|giyohvand|bomb|бомб)/i]
const HOW_TO = /(как (сделать|изготовить|приготовить|получить|синтезировать|собрать)|рецепт|инструкци|пошагово|в домашних условиях|how (to|do i|can i) (make|build|synthesi[sz]e|prepare|produce)|recipe|step by step|qanday (tayyorla|yasa|olish)|uyda)/i

export function isDangerousRequest(text: string): boolean {
  const t = text.toLowerCase()
  if (/отравить\s+человек|poison\s+someone|odamni\s+zaharla/i.test(t)) return true
  const danger = BLOCKED_PATTERNS.some((re) => re.test(t)) || EXTRA_DANGER.some((re) => re.test(t))
  return danger && HOW_TO.test(t)
}

export const DANGER_REPLY: Record<Lang, string> = {
  ru: 'Инструкции по изготовлению взрывчатых, отравляющих или наркотических веществ я не даю — это опасно для жизни и запрещено законом. Зато могу объяснить, почему такие вещества нестабильны или токсичны, и как химики обеспечивают безопасность в лаборатории. С чего начнём?',
  uz: 'Portlovchi, zaharli yoki giyohvand moddalarni tayyorlash boʻyicha koʻrsatma bermayman — bu hayot uchun xavfli va qonun bilan taqiqlangan. Lekin bunday moddalar nega beqaror yoki zaharli ekanini va kimyogarlar laboratoriyada xavfsizlikni qanday taʼminlashini tushuntira olaman. Nimadan boshlaymiz?',
  en: 'I do not give instructions for making explosives, poisons or drugs — it is dangerous and illegal. I can explain why such substances are unstable or toxic and how chemists keep a lab safe. Where shall we start?',
}

/** R3: запрещённые фразы в финальном ответе (контракт). */
const R3: RegExp[] = [
  /в\s+моей\s+базе\s+нет/i,
  /нет\s+в\s+(моей\s+)?базе/i,
  /не\s+знаю/i,
  /не\s+могу\s+ответить/i,
  /bazamda\s*[^.!?\n]{0,40}?\s*yo[ʻ‘'’`]?q/i,
  /bilmayman/i,
  /i\s+don[’']?t\s+know/i,
  /i\s+do\s+not\s+know/i,
  /not\s+in\s+my\s+database/i,
  /умн(ый|ого|ому|ым)\s+ии/i,
  /puter/i,
]

export function hasR3(text: string): boolean {
  return R3.some((re) => re.test(text))
}

const REASON_PREFIX: Record<Lang, string> = { ru: 'Рассуждаю от законов: ', uz: 'Qonunlardan kelib chiqib mulohaza qilaman: ', en: 'Reasoning from first principles: ' }

/** Переписать предложения с R3-фразами: «Я не знаю точно, но думаю, что X» → «Рассуждаю от законов: думаю, что X». */
export function scrubR3(text: string, lang: Lang): string {
  if (!hasR3(text)) return text
  const sentences = splitSentences(text)
  const out: string[] = []
  for (const s of sentences) {
    if (!hasR3(s)) {
      out.push(s)
      continue
    }
    let rest = s
    for (const re of R3) {
      const m = rest.match(re)
      if (!m) continue
      if (/puter|ии/i.test(m[0])) rest = rest.replace(new RegExp(re.source, 'gi'), '').replace(/\s{2,}/g, ' ')
      else rest = rest.slice((m.index ?? 0) + m[0].length)
    }
    rest = rest.replace(/^[\s,;:—–-]*(но|однако|but|however|lekin|ammo|точно|exactly|aniq)?[\s,;:—–-]*/i, '').trim()
    if (rest.split(/\s+/).filter(Boolean).length >= 3) out.push(REASON_PREFIX[lang] + rest.charAt(0).toLowerCase() + rest.slice(1))
  }
  return out.join(' ').replace(/\s{2,}/g, ' ').trim()
}

/** Разбиение на предложения (формулы с точками и числа с запятой не рвутся). */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  let buf = ''
  const chars = [...text]
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    buf += ch
    const next = chars[i + 1] ?? ''
    const isEnd = (/[.!?…]/.test(ch) && (next === '' || /\s/.test(next))) || ch === '\n'
    if (isEnd && buf.trim()) {
      if (ch === '.' && /((?<!\p{L})\p{Ll}{1,3}|т\.\s?[еп]|н\.\s?у|стр|рис|напр)\.$/u.test(buf.trim()) && /^\s*[\p{Ll}0-9]/u.test(chars.slice(i + 1, i + 4).join(''))) continue
      out.push(buf.trim() + (ch === '\n' ? '\n' : ''))
      buf = ''
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Обрезать по границе предложения до limit слов (первое предложение остаётся всегда). */
export function trimToWords(text: string, limit: number): string {
  if (wordCount(text) <= limit) return text
  const paras = text.split(/\n/)
  const out: string[] = []
  let n = 0
  for (const p of paras) {
    const ss = splitSentences(p)
    const kept: string[] = []
    for (const s of ss) {
      const w = wordCount(s)
      if (n + w > limit && (out.length || kept.length)) break
      kept.push(s)
      n += w
    }
    if (kept.length) out.push(kept.join(' '))
    if (kept.length < ss.length) break
  }
  return out.join('\n').trim()
}

const normNum = (s: string) => s.replace(/\s+/g, '').replace(',', '.').replace(/[−–]/g, '-').replace(/^\+/, '')

/** Все ли ключевые числа/уравнения инструментов есть в ответе. */
export function missingToolNumbers(text: string, tools: ToolResult[]): string[] {
  const hay = normNum(text.replace(/,(\d)/g, '.$1'))
  const missing: string[] = []
  for (const t of tools) for (const n of t.numbers) if (n && !hay.includes(normNum(n))) missing.push(n)
  return missing
}

export function ensureToolNumbers(text: string, tools: ToolResult[], lang: Lang): string {
  if (!tools.length || !missingToolNumbers(text, tools).length) return text
  const head = lang === 'ru' ? 'Точный расчёт' : lang === 'uz' ? 'Aniq hisob' : 'Exact calculation'
  return `${text.trim()}\n\n${head}: ${tools.map((t) => t.text).join('\n')}`
}

export function languageOk(text: string, lang: Lang): boolean {
  return matchesLang(text, lang)
}

/**
 * Поток LLM → предложения: копит токены, отдаёт наружу только законченные и проверенные предложения
 * (R3, лимит слов). До первой отдачи проверяет язык (≥ 60 букв): не тот — молчит до конца, дальше перевод.
 */
export class StreamGate {
  private buf = ''
  emitted = ''
  words = 0
  langChecked = false
  langMismatch = false
  stopped = false
  private readonly lang: Lang
  private readonly limit: number
  private readonly emit: (s: string) => void

  constructor(lang: Lang, limit: number, emit: (s: string) => void) {
    this.lang = lang
    this.limit = limit
    this.emit = emit
  }

  /** false — пора остановить генерацию (лимит). */
  push(token: string): boolean {
    if (this.stopped) return false
    this.buf += token
    if (!this.langChecked) {
      const letters = (this.buf.match(/\p{L}/gu) ?? []).length
      if (letters < 60) return true
      this.langChecked = true
      this.langMismatch = !languageOk(this.buf, this.lang)
    }
    if (this.langMismatch) return true
    this.flush(false)
    return !this.stopped
  }

  private flush(final: boolean): void {
    const ss = splitSentences(this.buf)
    if (!ss.length) return
    const complete = final ? ss : ss.slice(0, -1)
    const lastRaw = final ? '' : ss[ss.length - 1]!
    for (const s of complete) {
      const body = scrubR3(s.trim(), this.lang)
      if (!body) continue
      const clean = body + (s.endsWith('\n') ? '\n' : '')
      const w = wordCount(clean)
      if (this.words && this.words + w > this.limit) {
        this.stopped = true
        break
      }
      const piece = (this.emitted ? (/\n$/.test(this.emitted) ? '' : ' ') : '') + clean
      this.emitted += piece
      this.words += w
      this.emit(piece)
    }
    this.buf = this.stopped ? '' : lastRaw
  }

  end(): string {
    if (!this.langMismatch && !this.stopped) this.flush(true)
    return this.emitted
  }

  /** Весь сырой текст (для перевода, когда язык не совпал). */
  raw(): string {
    return this.buf
  }
}
