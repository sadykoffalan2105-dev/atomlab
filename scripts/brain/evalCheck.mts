/**
 * Общие проверки контрольных вопросов мозга — вынесены из eval.mts без изменения логики, чтобы ими пользовались
 * и npm run brain:eval (brain/eval/questions.jsonl), и npm run brain:eval:curriculum (вопросы по каждому § Kimyo 7–11).
 *
 *   check(q, a, dialogReady, pending)  — список причин провала (пусто = прошёл)
 *   numbersIn(text), anyOf(want, got)  — разбор чисел ответа и «a|b — любое из»
 *   request(q)                         — запрос к /chat (как его шлёт приложение)
 *   inprocRunner(mock, profile?) / httpRunner(base) — исполнители: конвейер в процессе (без LLM / mock-LLM) или живой сервер
 */
import type { ChatRequest, DoneEvent, MetaEvent } from '../../brain/pipeline/chat.ts'
import { CJK_RE, hasR3, wordCount } from '../../brain/pipeline/postcheck.ts'
import { matchesLang } from '../../brain/pipeline/normalize.ts'

export type OneNumber = { value: number; tol: number }
export type Expect = {
  exact?: string
  startsWith?: string
  mustMatch?: string[]
  mustNotMatch?: string[]
  lang?: 'ru' | 'uz' | 'en'
  maxWords?: number
  /** одно число или любое из списка (4 моль или 72 г) */
  number?: OneNumber | OneNumber[]
  /** «homework|calc» — любое из */
  intent?: string
  // — мозг v2 (многоходовые кейсы): поля meta/done от DIALOG; «a|b» — любое из
  /** регекс(ы) по meta.standalone — все должны совпасть */
  standalone?: string | string[]
  followUp?: string
  scope?: string
  kind?: string
  lengthClass?: string
  minWords?: number
  /** done.sources[0] */
  topSource?: string
  /** ни в done.sources, ни в цитатах (encyclopedia → нет «Википедия/Wikipedia» в citations) */
  notSource?: string[]
  /** регекс по citations.join(' ') */
  citationMatch?: string
  noCitationMatch?: string
}
export type ChatTurn = { role: 'user' | 'assistant'; content: string }
export type Question = { id: string; cat: string; lang: string; q: string; messages?: ChatTurn[]; context?: { gradeId?: string; detail?: 'brief' | 'more'; mode?: 'chat' | 'live' }; expect: Expect }
/** meta/done мозга v2 (поля DIALOG; до слияния их нет — проверки «ожидают DIALOG») */
export type MetaV2 = MetaEvent & { standalone?: string; followUp?: string; scope?: string; kind?: string; lengthClass?: string }
export type DoneV2 = DoneEvent & { sources?: string[]; plan?: { kind: string; lengthClass: string; scope: string } }
export type Answer = { text: string; meta: MetaV2 | null; done: DoneV2 | null; ms: number; firstMs?: number; error?: string }

export function request(q: Question): ChatRequest {
  return {
    sessionId: `eval-${q.id}`,
    studentId: 'eval',
    lang: 'auto',
    stream: true,
    messages: [...(q.messages ?? []), { role: 'user', content: q.q }],
    context: { gradeId: q.context?.gradeId ?? 'g9', mode: q.context?.mode ?? 'chat', detail: q.context?.detail ?? 'brief' },
  }
}

/** Числа из текста: «98,08», «98.08», «−2», «6,02·10²³» (берём мантиссу). */
export function numbersIn(text: string): number[] {
  return [...text.replace(/[−–]/g, '-').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.'))).filter((n) => Number.isFinite(n))
}

/** «a|b» — любое из */
export const anyOf = (want: string, got: string | undefined | null) => got != null && want.split('|').includes(got)

/**
 * Проверки полей мозга v2. Провалы помечаются «[поле] …» (для порога 100 % по полям); поле, которого нет в meta/done
 * при несобранном контракте DIALOG, уходит в pending (не провал).
 */
function checkFields(q: Question, a: Answer, dialogReady: boolean, why: string[], pending: string[]): void {
  const e = q.expect
  const meta = a.meta
  const done = a.done
  const field = (name: string, got: unknown, okFn: () => boolean, show: string) => {
    if (got === undefined || got === null) {
      if (dialogReady) why.push(`[поле] нет meta.${name}`)
      else pending.push(name)
      return
    }
    if (!okFn()) why.push(`[поле] ${name} ${show}`)
  }
  if (e.standalone !== undefined) {
    const res = Array.isArray(e.standalone) ? e.standalone : [e.standalone]
    field('standalone', meta?.standalone, () => res.every((re) => new RegExp(re, 'iu').test(meta!.standalone!)), `«${meta?.standalone}» ≠ /${res.join('/ & /')}/`)
  }
  if (e.followUp) field('followUp', meta?.followUp, () => anyOf(e.followUp!, meta!.followUp), `${meta?.followUp} ≠ ${e.followUp}`)
  if (e.scope) field('scope', meta?.scope, () => anyOf(e.scope!, meta!.scope), `${meta?.scope} ≠ ${e.scope}`)
  if (e.kind) field('kind', meta?.kind, () => anyOf(e.kind!, meta!.kind), `${meta?.kind} ≠ ${e.kind}`)
  if (e.lengthClass) field('lengthClass', meta?.lengthClass, () => anyOf(e.lengthClass!, meta!.lengthClass), `${meta?.lengthClass} ≠ ${e.lengthClass}`)
  if (e.topSource) field('topSource', done?.sources, () => anyOf(e.topSource!, done!.sources![0]), `${done?.sources?.[0]} ≠ ${e.topSource}`)
  if (e.notSource?.length) field('notSource', done?.sources, () => !done!.sources!.some((s) => e.notSource!.includes(s)), `[${done?.sources?.join(',')}] ∋ ${e.notSource.join('|')}`)
}

export function check(q: Question, a: Answer, dialogReady: boolean, pending: string[] = []): string[] {
  const e = q.expect
  const t = a.text.trim()
  const why: string[] = []
  checkFields(q, a, dialogReady, why, pending)
  const cites = (a.done?.citations ?? []).join(' ')
  if (e.minWords && wordCount(t) < e.minWords) why.push(`слов ${wordCount(t)} < ${e.minWords}`)
  if (e.citationMatch && !new RegExp(e.citationMatch, 'iu').test(cites)) why.push(`цитаты без /${e.citationMatch}/: ${cites || '—'}`)
  if (e.noCitationMatch && new RegExp(e.noCitationMatch, 'iu').test(cites)) why.push(`цитаты с запрещённым /${e.noCitationMatch}/: ${cites}`)
  if (e.notSource?.includes('encyclopedia') && /википед|wikipedia/iu.test(cites)) why.push(`цитата из энциклопедии: ${cites}`)
  if (a.error) why.push(`ошибка: ${a.error}`)
  if (!t) why.push('пустой ответ')
  if (e.exact !== undefined && t !== e.exact) why.push('не дословно R1')
  if (e.startsWith !== undefined && !t.startsWith(e.startsWith)) why.push('нет R2 в начале')
  for (const re of e.mustMatch ?? []) if (!new RegExp(re, 'iu').test(t)) why.push(`нет /${re}/`)
  for (const re of e.mustNotMatch ?? []) if (new RegExp(re, 'iu').test(t)) why.push(`есть запрещённое /${re}/`)
  if (hasR3(t)) why.push('R3-фраза')
  if (CJK_RE.test(t)) why.push('CJK-символы')
  const route = a.meta?.route ?? ''
  const doneRoute = (a.done as (DoneEvent & { route?: string }) | null)?.route
  if (/(^|\+)llm$/.test(route) && a.done && a.done.source !== 'llm') why.push(`нечестный route: meta=llm, source=${a.done.source}`)
  if (doneRoute && route && doneRoute !== route) why.push(`route meta=${route} ≠ done=${doneRoute}`)
  if (e.lang && !matchesLang(t, e.lang)) why.push(`язык ≠ ${e.lang}`)
  if (e.maxWords && wordCount(t) > e.maxWords) why.push(`слов ${wordCount(t)} > ${e.maxWords}`)
  if (e.number) {
    const want = Array.isArray(e.number) ? e.number : [e.number]
    if (!numbersIn(t).some((n) => want.some((w) => Math.abs(n - w.value) <= w.tol))) why.push(`нет числа ${want.map((w) => `${w.value}±${w.tol}`).join(' или ')}`)
  }
  if (e.intent && !anyOf(e.intent, a.meta?.intent)) why.push(`intent ${a.meta?.intent} ≠ ${e.intent}`)
  // ответ «по сути» после R2: что-то кроме самого замечания
  if (q.cat === 'profanity' && e.startsWith && t.slice(e.startsWith.length).trim().length < 15) why.push('после R2 нет ответа')
  return why
}

// ——— исполнители
export type Runner = { name: string; llm: 'ollama' | 'mock' | 'none'; ask(q: Question): Promise<Answer>; close?(): void }

/** Конвейер в этом процессе: без LLM (запасной путь) или с mock-LLM (часть ответов «капризные»). profile — config.dialog.profile. */
export async function inprocRunner(mock: boolean, profile?: string): Promise<Runner> {
  const { createBrain } = await import('../../brain/server.ts')
  const { runChat } = await import('../../brain/pipeline/chat.ts')
  const { MockLlm } = await import('../../brain/llm/mock.ts')
  const llm = mock ? new MockLlm({ misbehave: 0.35 }) : null
  const brain = createBrain({ llm })
  await brain.deps.journal.buildIndex()
  // --profile=laptop|gpu: профиль мозга v2 (config.dialog.profile — блок DIALOG; до слияния поле просто лишнее)
  if (profile === 'laptop' || profile === 'gpu') {
    const cfg = brain.deps.config as unknown as { dialog?: Record<string, unknown> }
    cfg.dialog = { ...(cfg.dialog ?? {}), profile }
  }
  return {
    name: mock ? 'в процессе, mock-LLM' : 'в процессе, без LLM (запасной путь)',
    llm: mock ? 'mock' : 'none',
    async ask(q) {
      let meta: MetaEvent | null = null
      let done: DoneEvent | null = null
      let error: string | undefined
      const t0 = performance.now()
      await runChat(request(q), { ...brain.deps, noJournal: true }, { meta: (m) => (meta = m), delta: () => {}, done: (d) => (done = d), error: (e) => (error = e.message) })
      const d = done as DoneEvent | null
      return { text: d?.text ?? '', meta, done: d, ms: d?.ms ?? Math.round(performance.now() - t0), error }
    },
  }
}

/** Живой сервер по HTTP (/health, потоковый /chat). Сервер недоступен — выход с кодом 2. */
export async function httpRunner(base: string, tag = 'brain:eval'): Promise<Runner> {
  let health: { llm?: { available?: boolean; chatModel?: string | null } }
  try {
    health = (await (await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })).json()) as typeof health
  } catch {
    console.error(`[${tag}] сервер ${base} не отвечает. Запустите npm run brain:start или используйте --inproc.`)
    process.exit(2)
  }
  return {
    name: `HTTP ${base} (llm: ${health.llm?.available ? health.llm.chatModel : 'нет — запасной путь'})`,
    llm: health.llm?.available ? 'ollama' : 'none',
    async ask(q) {
      const t0 = performance.now()
      let meta: MetaEvent | null = null
      let done: DoneEvent | null = null
      let error: string | undefined
      let text = ''
      let firstMs: number | undefined
      try {
        const res = await fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request(q)), signal: AbortSignal.timeout(180_000) })
        if (!res.ok || !res.body) return { text: '', meta, done, ms: 0, error: `HTTP ${res.status}` }
        // читаем поток по мере прихода: время первого куска ответа (delta) — то, что видит ученик
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let raw = ''
        for (;;) {
          const { value, done: end } = await reader.read()
          if (end) break
          raw += dec.decode(value, { stream: true })
          if (firstMs === undefined && /(^|\n)event: ?delta\n/.test(raw)) firstMs = Math.round(performance.now() - t0)
        }
        for (const block of raw.split(/\n\n/)) {
          const ev = block.match(/^event: ?(.+)$/m)?.[1]?.trim()
          const data = block.match(/^data: ?(.*)$/m)?.[1]
          if (!ev || data === undefined) continue
          const j = JSON.parse(data)
          if (ev === 'meta') meta = j
          else if (ev === 'delta') text += j.text
          else if (ev === 'done') done = j
          else if (ev === 'error') error = j.message
        }
      } catch (err) {
        error = (err as Error).message
      }
      const d = done as DoneEvent | null
      if (d && text.trim() !== d.text.trim()) error = (error ? error + '; ' : '') + 'delta ≠ done.text'
      return { text: d?.text ?? text, meta, done: d, ms: d?.ms ?? Math.round(performance.now() - t0), firstMs, error }
    },
  }
}
