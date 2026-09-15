/**
 * Потоковый делитель текста на предложения для «живой» озвучки.
 *
 * LLM отдаёт текст кусочками (токенами). Чтобы учитель заговорил как можно
 * раньше, первое законченное предложение отдаём в TTS сразу, не дожидаясь
 * конца ответа. Модуль чистый (без DOM) — покрыт тестами в
 * scripts/test-teacher-live-engine.mts.
 */

export interface SentenceSplitterOptions {
  /** Предложение короче — склеиваем со следующим (кроме flush). */
  minChars?: number
  /** Нет границы, а буфер длиннее — режем по запятой/пробелу. */
  maxChars?: number
  /** То же для самого первого предложения (быстрый старт речи). */
  firstMaxChars?: number
}

/** Сокращения, после точки в которых предложение НЕ заканчивается. */
const ABBREVIATIONS = new Set([
  // ru
  'т', 'д', 'п', 'е', 'др', 'см', 'рис', 'стр', 'г', 'гг', 'в', 'вв', 'им', 'проф', 'акад', 'ок',
  'мин', 'макс', 'кв', 'куб', 'тыс', 'млн', 'млрд', 'прим', 'напр', 'т.е', 'т.д', 'т.п', 'т.к',
  'с', 'ул', 'н', 'э', 'до н', 'пр', 'хим', 'физ', 'мол', 'атм', 'темп',
  // en
  'e.g', 'i.e', 'eg', 'ie', 'vs', 'dr', 'mr', 'mrs', 'ms', 'prof', 'etc', 'no', 'approx', 'fig', 'st',
  'jr', 'sr', 'al', 'cf',
  // uz
  'b', 'y', 'va h', 'sh',
])

const TERMINATORS = '.!?…'

function lastWordBefore(text: string, index: number): string {
  let start = index
  while (start > 0) {
    const ch = text[start - 1]!
    if (/[\p{L}\p{N}.]/u.test(ch)) start--
    else break
  }
  return text.slice(start, index)
}

function isListMarker(text: string, dotIndex: number): boolean {
  // «1.» / «2)» в начале строки — это номер пункта, а не конец предложения.
  let i = dotIndex - 1
  while (i >= 0 && /\d/.test(text[i]!)) i--
  if (i === dotIndex - 1) return false
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t')) i--
  return i < 0 || text[i] === '\n'
}

/** Точка стоит внутри «…», открытых недавно (≤ 120 символов) и ещё не закрытых. */
function isInsideOpenQuote(text: string, index: number, final: boolean): boolean {
  const open = text.lastIndexOf('«', index)
  if (open < 0 || index - open > 120) return false
  const close = text.lastIndexOf('»', index)
  if (close > open) return false
  // Кавычка должна закрыться дальше; в потоке закрывающая может ещё не прийти — ждём.
  const after = text.indexOf('»', index)
  if (after < 0) return !final && text.length - open <= 120
  return after - index <= 120
}

/**
 * Индекс конца первого предложения (включительно) или -1.
 * `final` — буфер больше не будет пополняться (можно резать на последнем символе).
 */
export function findSentenceBoundary(text: string, final = false): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '\n') {
      if (text.slice(0, i).trim().length > 0) return i
      continue
    }
    if (!TERMINATORS.includes(ch)) continue

    // Склеиваем серии «?!», «...», «.»» и закрывающие кавычки/скобки.
    let end = i
    while (end + 1 < text.length && /[.!?…»"')\]]/.test(text[end + 1]!)) end++
    const next = text[end + 1]
    if (next === undefined) {
      if (!final) return -1
    } else if (!/\s/.test(next)) {
      // «3.5», «H2O.Это» — не граница; пропускаем серию.
      i = end
      continue
    }

    if (ch === '.') {
      const word = lastWordBefore(text, i).toLowerCase()
      const bare = word.replace(/\.+$/, '')
      if (bare && ABBREVIATIONS.has(bare)) {
        i = end
        continue
      }
      // Инициалы: «Д. И. Менделеев» — одна заглавная буква.
      if (/^\p{Lu}$/u.test(lastWordBefore(text, i))) {
        i = end
        continue
      }
      if (/^\d+$/.test(bare) && isListMarker(text, i)) {
        i = end
        continue
      }
      // «§1. Химия…», «№ 3. …» — номер параграфа/задачи, а не конец предложения.
      if (/^\d+$/.test(bare) && /[§№]\s*$/.test(text.slice(Math.max(0, i - bare.length - 3), i - bare.length))) {
        i = end
        continue
      }
      // Следом строчная буква — скорее сокращение, чем конец мысли.
      const after = text.slice(end + 1).trimStart()[0]
      if (after && /\p{Ll}/u.test(after)) {
        i = end
        continue
      }
    }
    // Внутри незакрытых «ёлочек» (название темы) предложение не заканчивается.
    if (end === i && isInsideOpenQuote(text, i, final)) {
      i = end
      continue
    }
    return end
  }
  return -1
}

function softCut(text: string, max: number): number {
  const windowText = text.slice(0, max + 1)
  const minPos = Math.floor(max * 0.4)
  for (let i = windowText.length - 1; i >= minPos; i--) {
    if (/[,;:—–]/.test(windowText[i]!) && /\s/.test(text[i + 1] ?? ' ')) return i
  }
  const space = windowText.lastIndexOf(' ')
  return space > minPos ? space : max
}

/** Лёгкая чистка markdown для речи и отображения фраз. */
export function cleanSentence(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/^#+\s*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasSpeakableContent(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

export class SentenceStreamSplitter {
  private buffer = ''
  private emittedCount = 0
  private readonly minChars: number
  private readonly maxChars: number
  private readonly firstMaxChars: number

  constructor(options: SentenceSplitterOptions = {}) {
    this.minChars = options.minChars ?? 16
    this.maxChars = options.maxChars ?? 240
    this.firstMaxChars = options.firstMaxChars ?? 150
  }

  /** Сколько предложений уже отдано. */
  get emitted(): number {
    return this.emittedCount
  }

  /** Добавить кусок текста; вернуть предложения, которые уже закончены. */
  push(delta: string): string[] {
    if (delta) this.buffer += delta
    return this.drain(false)
  }

  /** Поток закончился — отдать остаток. */
  flush(): string[] {
    const out = this.drain(true)
    const rest = cleanSentence(this.buffer)
    this.buffer = ''
    if (rest && hasSpeakableContent(rest)) {
      out.push(rest)
      this.emittedCount++
    }
    return out
  }

  reset(): void {
    this.buffer = ''
    this.emittedCount = 0
  }

  private drain(final: boolean): string[] {
    const out: string[] = []
    let searchFrom = 0
    for (;;) {
      const rel = findSentenceBoundary(this.buffer.slice(searchFrom), final)
      const limit = this.emittedCount === 0 && out.length === 0 ? this.firstMaxChars : this.maxChars

      if (rel < 0) {
        if (this.buffer.length > limit) {
          const cut = softCut(this.buffer, limit)
          this.emit(this.buffer.slice(0, cut + 1), out)
          this.buffer = this.buffer.slice(cut + 1)
          searchFrom = 0
          continue
        }
        break
      }

      const end = searchFrom + rel
      const candidate = this.buffer.slice(0, end + 1)
      const cleaned = cleanSentence(candidate)
      if (cleaned.length < this.minChars && !final && this.buffer.length <= limit) {
        // Короткую фразу («Да.», «Смотри.») склеиваем со следующей.
        const more = findSentenceBoundary(this.buffer.slice(end + 1), false)
        if (more < 0) break
        searchFrom = end + 1
        continue
      }
      this.emit(candidate, out)
      this.buffer = this.buffer.slice(end + 1)
      searchFrom = 0
    }
    return out
  }

  private emit(raw: string, out: string[]): void {
    const cleaned = cleanSentence(raw)
    if (!cleaned || !hasSpeakableContent(cleaned)) return
    out.push(cleaned)
    this.emittedCount++
  }
}

/** Разбить готовый текст на предложения тем же алгоритмом. */
export function splitIntoSentences(text: string, options?: SentenceSplitterOptions): string[] {
  const splitter = new SentenceStreamSplitter(options)
  return [...splitter.push(text), ...splitter.flush()]
}

/** Число слов (для лимитов «для голоса»). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}
