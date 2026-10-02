/**
 * Эхо-страж: учитель говорит в колонки → микрофон слышит его → STT отдаёт «реплику ученика».
 * Сравниваем распознанное с тем, что РЕАЛЬНО ушло в озвучку (prepared-текст:
 * «H₂O» уже превращено в «аш два о», числа — в слова), а не с написанным.
 *
 * Правило: ≥ 4 общих слов подряд ИЛИ доля общих основ ≥ 0,5 → эхо.
 * Храним последние 8 произнесённых фраз со временем окончания. Чистый модуль, без DOM.
 */

export interface SpokenPhrase {
  /** Что ушло в TTS (после prepare). */
  prepared: string
  /** Оригинал (как написано) — тоже сравниваем: Edge-STT иногда пишет формулы латиницей. */
  raw: string
  startedAt: number
  /** Когда фраза дозвучала (Infinity — ещё звучит). */
  endedAt: number
}

export const SPOKEN_LOG_SIZE = 8
/** После конца речи учителя столько мс финальные результаты всё ещё проверяются на эхо. */
export const ECHO_WINDOW_MS = 800

const STOP = new Set([
  'это', 'как', 'что', 'для', 'при', 'или', 'так', 'его', 'она', 'они', 'мы', 'вы', 'ты', 'же', 'ли', 'бы', 'а', 'и', 'в', 'с', 'к', 'у', 'я',
  'the', 'and', 'for', 'this', 'that', 'with', 'are', 'is', 'of', 'to', 'in', 'va', 'bu', 'bilan', 'uchun',
])

export function normalizeForEcho(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[₀-₉]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x2080 + 48))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Основа слова: первые 5 букв (достаточно, чтобы «молярная/молярной» совпали). */
export function stem(word: string): string {
  return word.length > 5 ? word.slice(0, 5) : word
}

function words(text: string): string[] {
  // Однобуквенные «о/аш» нужны: так произносятся формулы («аш два о»); союзы/предлоги — в STOP.
  return normalizeForEcho(text).split(' ').filter((w) => w.length >= 1 && !STOP.has(w))
}

/** Самая длинная общая цепочка слов (в словах). */
export function longestCommonRun(a: readonly string[], b: readonly string[]): number {
  let best = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0
      while (i + k < a.length && j + k < b.length && stem(a[i + k]!) === stem(b[j + k]!)) k++
      if (k > best) best = k
    }
  }
  return best
}

/** Доля основ распознанного текста, которые есть в произнесённом. */
export function stemOverlap(heard: readonly string[], spoken: readonly string[]): number {
  if (heard.length === 0) return 0
  const set = new Set(spoken.map(stem))
  let hit = 0
  for (const w of heard) if (set.has(stem(w))) hit++
  return hit / heard.length
}

export interface EchoVerdict {
  echo: boolean
  overlap: number
  run: number
}

/** Похоже ли распознанное на эхо ОДНОЙ произнесённой фразы. */
export function echoVerdict(heard: string, spoken: string): EchoVerdict {
  const h = words(heard)
  const s = words(spoken)
  if (h.length === 0 || s.length === 0) return { echo: false, overlap: 0, run: 0 }
  const run = longestCommonRun(h, s)
  const overlap = stemOverlap(h, s)
  // Одно-два слова («да», «понял», «кислород») — ученик, если это не точный хвост фразы учителя.
  if (h.length <= 2) {
    const tail = s.slice(-h.length).map(stem).join(' ')
    return { echo: tail === h.map(stem).join(' ') && h.join('').length >= 8, overlap, run }
  }
  if (run >= 4) return { echo: true, overlap, run }
  // Короткий ответ (3–4 слова) часто повторяет слова вопроса учителя («у кислорода валентность два») —
  // эхо только при цепочке ≥ 3 слов подряд или почти полном совпадении.
  if (h.length <= 4) return { echo: run >= 3 || overlap >= 0.75, overlap, run }
  return { echo: overlap >= 0.5, overlap, run }
}

/** Журнал произнесённых фраз + решение «эхо / не эхо» с учётом времени. */
export class SpokenPhraseLog {
  private readonly items: SpokenPhrase[] = []

  /** Фраза пошла в озвучку. Возвращает запись, чтобы потом отметить конец. */
  push(raw: string, prepared: string, now: number): SpokenPhrase {
    const item: SpokenPhrase = { raw, prepared: prepared || raw, startedAt: now, endedAt: Infinity }
    this.items.push(item)
    while (this.items.length > SPOKEN_LOG_SIZE) this.items.shift()
    return item
  }

  /** Всё, что звучало, дозвучало (учитель замолчал / его перебили). */
  closeAll(now: number): void {
    for (const it of this.items) if (it.endedAt === Infinity) it.endedAt = now
  }

  recent(): readonly SpokenPhrase[] {
    return this.items
  }

  /**
   * Эхо ли это? Проверяем, когда учитель говорит ИЛИ прошло < windowMs с конца
   * последней фразы. Старые фразы (дозвучали давно) всё равно сравниваем, если
   * текст пришёл в окне, — STT часто отдаёт финал с задержкой до секунды.
   */
  isEcho(heard: string, now: number, aiSpeaking: boolean, windowMs = ECHO_WINDOW_MS): boolean {
    if (this.items.length === 0) return false
    const lastEnd = Math.max(...this.items.map((i) => i.endedAt))
    const inWindow = aiSpeaking || lastEnd === Infinity || now - lastEnd < windowMs
    if (!inWindow) return false
    const joined = this.items.map((i) => i.prepared).join(' ')
    const joinedRaw = this.items.map((i) => i.raw).join(' ')
    if (echoVerdict(heard, joined).echo || echoVerdict(heard, joinedRaw).echo) return true
    return this.items.some((i) => echoVerdict(heard, i.prepared).echo || echoVerdict(heard, i.raw).echo)
  }

  /** Эхо без учёта времени (для барджина — учитель заведомо говорит). */
  matches(heard: string): boolean {
    return this.isEcho(heard, 0, true)
  }

  clear(): void {
    this.items.length = 0
  }
}
