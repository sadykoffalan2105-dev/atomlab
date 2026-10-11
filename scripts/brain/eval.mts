/**
 * npm run brain:eval — контрольные вопросы мозга (brain/eval/questions.jsonl, ≥ 150) по категориям.
 *
 *   по умолчанию     — через HTTP на запущенный сервер http://127.0.0.1:8787 (env BRAIN_PORT / --url=…)
 *   --inproc         — без сервера: конвейер в этом процессе (без LLM — запасной путь)
 *   --mock-llm       — в процессе с подменой Ollama (brain/llm/mock.ts; часть ответов «капризные»: R3 и испорченные числа)
 *   --cat=calc,rule  — только эти категории;  --ids=ob01,sr24 — только эти вопросы (живая модель: несколько штук)
 *   --verbose — печатать ответы;  --fails — печатать провалы
 *   --json=путь      — сохранить подробный отчёт
 *   --sample=N       — стратифицированная подвыборка ~N вопросов (равномерно по категориям) для быстрых замеров на живой модели
 *
 *   --profile=laptop|gpu — профиль мозга v2 в режимах --inproc/--mock-llm (config.dialog.profile)
 *   --strict-dialog  — считать контракт DIALOG собранным (нет meta.standalone → провал), см. DIALOG_MERGED
 *
 * Критерии (код выхода 1 при провале): rule, profanity, calc, smalltalk — 100 %; общий pass ≥ 85 % с настоящей
 * LLM (Ollama) и ≥ 75 % без неё (запасной путь и mock; ≥ 80 % после сборки DIALOG). R3-фразы запрещены во всех ответах.
 * Мозг v2 (многоходовые кейсы: messages до вопроса, context {gradeId, detail, mode}): категории dialog-ru/uz/en, scope,
 * length, logic. Поля meta.standalone/followUp/scope/kind/lengthClass и done.sources — 100 % в --inproc и --mock-llm,
 * текст диалогов ≥ 90 %, scope ≥ 95 %, length ≥ 90 %, logic ≥ 85 %, wikiLeak (Википедия в цитатах школьного ответа) = 0.
 * Живая подвыборка: --sample=12 --cat=dialog-ru,dialog-uz,dialog-en,length — ≥ 80 %.
 * Пока chat.ts не шлёт meta.standalone (DIALOG не слит), эти поля «ждут DIALOG», а v2-категории не входят в общий порог.
 * Всегда: CJK-символов (китайский/японский/корейский) в ответах 0; маршрут честный — meta.route=llm только
 * если ответ реально от модели (done.source=llm), и meta.route совпадает с done.route, если сервер его прислал.
 * Метрики: доля route=llm, первый кусок ответа p50/p95, длительность p50/p95.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ChatRequest, DoneEvent, MetaEvent } from '../../brain/pipeline/chat.ts'
import { CJK_RE, hasR3, wordCount } from '../../brain/pipeline/postcheck.ts'
import { matchesLang } from '../../brain/pipeline/normalize.ts'

type OneNumber = { value: number; tol: number }
type Expect = {
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
type ChatTurn = { role: 'user' | 'assistant'; content: string }
type Question = { id: string; cat: string; lang: string; q: string; messages?: ChatTurn[]; context?: { gradeId?: string; detail?: 'brief' | 'more'; mode?: 'chat' | 'live' }; expect: Expect }
/** meta/done мозга v2 (поля DIALOG; до слияния их нет — проверки «ожидают DIALOG») */
type MetaV2 = MetaEvent & { standalone?: string; followUp?: string; scope?: string; kind?: string; lengthClass?: string }
type DoneV2 = DoneEvent & { sources?: string[]; plan?: { kind: string; lengthClass: string; scope: string } }
type Answer = { text: string; meta: MetaV2 | null; done: DoneV2 | null; ms: number; firstMs?: number; error?: string }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)

const DETERMINISTIC = ['rule', 'profanity', 'calc', 'smalltalk']
/** Категории мозга v2: многоходовые диалоги, охват, длина, логика. */
const DIALOG_CATS = ['dialog-ru', 'dialog-uz', 'dialog-en']
const V2_CATS = [...DIALOG_CATS, 'scope', 'length', 'logic']
/** Поля meta от DIALOG, которые проверяются точно (детерминированы в --inproc и --mock-llm). */
const FIELDS = ['standalone', 'followUp', 'scope', 'kind', 'lengthClass', 'topSource', 'notSource'] as const
/**
 * Контракт DIALOG собран? До слияния agent A (chat.ts без meta.standalone) проверки полей «ожидают DIALOG» и не валят прогон,
 * а v2-категории не входят в общий порог. При слиянии переключить в true (или запускать с --strict-dialog):
 * тогда отсутствие поля в meta — провал «нет meta.standalone».
 */
const DIALOG_MERGED = true

const questions: Question[] = fs
  .readFileSync(path.join(ROOT, 'brain', 'eval', 'questions.jsonl'), 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => JSON.parse(s) as Question)
const cats = arg('cat')?.split(',')
const ids = arg('ids')?.split(',')
const pool = ids ? questions.filter((q) => ids.includes(q.id)) : cats ? questions.filter((q) => cats.includes(q.cat)) : questions
/** Подвыборка: из каждой категории берём долю, пропорциональную её размеру, равномерно по списку (детерминированно). */
function sample(list: Question[], n: number): Question[] {
  if (!n || n >= list.length) return list
  const groups = new Map<string, Question[]>()
  for (const q of list) groups.set(q.cat, [...(groups.get(q.cat) ?? []), q])
  const out: Question[] = []
  for (const g of groups.values()) {
    const k = Math.max(1, Math.round((g.length / list.length) * n))
    for (let i = 0; i < k && i < g.length; i++) out.push(g[Math.floor((i * g.length) / k)]!)
  }
  return out
}
const set = sample(pool, Number(arg('sample') ?? 0))

function request(q: Question): ChatRequest {
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
function numbersIn(text: string): number[] {
  return [...text.replace(/[−–]/g, '-').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.'))).filter((n) => Number.isFinite(n))
}

/** «a|b» — любое из */
const anyOf = (want: string, got: string | undefined | null) => got != null && want.split('|').includes(got)

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

function check(q: Question, a: Answer, dialogReady: boolean, pending: string[] = []): string[] {
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
type Runner = { name: string; llm: 'ollama' | 'mock' | 'none'; ask(q: Question): Promise<Answer>; close?(): void }

async function inprocRunner(mock: boolean): Promise<Runner> {
  const { createBrain } = await import('../../brain/server.ts')
  const { runChat } = await import('../../brain/pipeline/chat.ts')
  const { MockLlm } = await import('../../brain/llm/mock.ts')
  const llm = mock ? new MockLlm({ misbehave: 0.35 }) : null
  const brain = createBrain({ llm })
  await brain.deps.journal.buildIndex()
  // --profile=laptop|gpu: профиль мозга v2 (config.dialog.profile — блок DIALOG; до слияния поле просто лишнее)
  const profile = arg('profile')
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

async function httpRunner(base: string): Promise<Runner> {
  let health: { llm?: { available?: boolean; chatModel?: string | null } }
  try {
    health = (await (await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) })).json()) as typeof health
  } catch {
    console.error(`[brain:eval] сервер ${base} не отвечает. Запустите npm run brain:start или используйте --inproc.`)
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

const runner = flag('mock-llm') ? await inprocRunner(true) : flag('inproc') ? await inprocRunner(false) : await httpRunner(arg('url') ?? `http://127.0.0.1:${process.env.BRAIN_PORT || 8787}`)
console.log(`[brain:eval] ${set.length} вопросов · ${runner.name}`)

type Row = { q: Question; a: Answer; why: string[]; pending: string[] }
const answers: { q: Question; a: Answer }[] = []
for (const q of set) answers.push({ q, a: await runner.ask(q) })
// контракт DIALOG собран, если хоть один ответ несёт meta.standalone (или явно: DIALOG_MERGED / --strict-dialog)
const dialogReady = DIALOG_MERGED || flag('strict-dialog') || answers.some(({ a }) => !!a.meta && 'standalone' in a.meta)
const rows: Row[] = answers.map(({ q, a }) => {
  const pending: string[] = []
  const why = check(q, a, dialogReady, pending)
  return { q, a, why, pending }
})
if (flag('verbose'))
  for (const { q, a, why } of rows)
    console.log(
      `\n${why.length ? '✗' : '✓'} [${q.id}] ${q.q}\n${a.text}\n  → ${a.meta?.route} · ${a.done?.source} · ${a.done?.confidenceLabel}${a.meta?.standalone ? ` · «${a.meta.standalone}» ${a.meta.followUp}/${a.meta.scope}/${a.meta.kind}/${a.meta.lengthClass}` : ''} · первый кусок ${a.firstMs ?? '—'} мс · всего ${a.ms} мс${why.length ? ' · ' + why.join('; ') : ''}`,
    )

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0
}
const isFieldFail = (w: string) => w.startsWith('[поле]')
const byCat = new Map<string, Row[]>()
for (const r of rows) byCat.set(r.q.cat, [...(byCat.get(r.q.cat) ?? []), r])
console.log('\nкатегория      всего  прошло   доля   медиана мс  маршруты')
for (const [cat, rs] of byCat) {
  const ok = rs.filter((r) => !r.why.length).length
  const routes = new Map<string, number>()
  for (const r of rs) routes.set(r.a.meta?.route ?? '—', (routes.get(r.a.meta?.route ?? '—') ?? 0) + 1)
  const pend = rs.filter((r) => r.pending.length).length
  console.log(
    `${cat.padEnd(14)} ${String(rs.length).padStart(5)}  ${String(ok).padStart(6)}  ${((ok / rs.length) * 100).toFixed(0).padStart(4)} %  ${String(Math.round(median(rs.map((r) => r.a.ms)))).padStart(9)}   ${[...routes].map(([k, v]) => `${k}×${v}`).join(' ')}${pend ? ` · ждут DIALOG: ${pend}` : ''}`,
  )
}
// до слияния с DIALOG v2-категории (многоходовые кейсы) в общий порог не входят — их текст зависит от разрешения реплики
const gated = dialogReady ? rows : rows.filter((r) => !V2_CATS.includes(r.q.cat))
const pass = gated.filter((r) => !r.why.length).length
const total = gated.length
const r3 = rows.filter((r) => hasR3(r.a.text)).length
const share = total ? pass / total : 0
// живая модель: 85 %; живая подвыборка только диалогов/длины (--sample=12 --cat=dialog-ru,dialog-uz,dialog-en,length) — 80 %;
// без LLM и mock — 75 %, после сборки DIALOG — 80 %
const onlyV2 = set.length > 0 && set.every((q) => V2_CATS.includes(q.cat))
const need = runner.llm === 'ollama' ? (onlyV2 ? 0.8 : 0.85) : dialogReady ? 0.8 : 0.75
console.log(`ВСЕГО          ${String(rows.length).padStart(5)}  ${String(rows.filter((r) => !r.why.length).length).padStart(6)}  ${((rows.filter((r) => !r.why.length).length / Math.max(1, rows.length)) * 100).toFixed(1).padStart(5)} %  ${String(Math.round(median(rows.map((r) => r.a.ms)))).padStart(8)}   R3-фраз: ${r3}${dialogReady ? '' : ` · в пороге ${total} (без v2-категорий: DIALOG не собран)`}`)

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]! : 0
}
// доля LLM — только среди вопросов, где модель вообще участвует (без правил, светской беседы и чистых расчётов)
const llmEligible = rows.filter((r) => /(^|\+)(llm|fallback)$/.test(r.a.meta?.route ?? '') && r.a.meta?.intent !== 'smalltalk' && r.a.meta?.intent !== 'gibberish')
const llmRows = llmEligible.filter((r) => /(^|\+)llm$/.test(r.a.meta?.route ?? '') && r.a.done?.source === 'llm')
const firsts = llmRows.map((r) => r.a.firstMs).filter((x): x is number => typeof x === 'number')
const cjk = rows.filter((r) => CJK_RE.test(r.a.text)).length
const dishonest = rows.filter((r) => r.why.some((w) => w.startsWith('нечестный route') || w.startsWith('route meta='))).length
const mustMiss = rows.filter((r) => r.why.some((w) => w.startsWith('нет /'))).length
console.log(
  `МЕТРИКИ: route=llm ${llmRows.length}/${llmEligible.length} (${llmEligible.length ? ((llmRows.length / llmEligible.length) * 100).toFixed(0) : 0} %) · первый кусок (llm) p50 ${pct(firsts, 50)} мс, p95 ${pct(firsts, 95)} мс · длительность p50 ${pct(rows.map((r) => r.a.ms), 50)} мс, p95 ${pct(rows.map((r) => r.a.ms), 95)} мс · CJK: ${cjk} · нечестный route: ${dishonest} · провалы mustMatch: ${mustMiss}`,
)

// ——— метрики мозга v2
const fieldAcc = (name: (typeof FIELDS)[number]) => {
  const rs = rows.filter((r) => r.q.expect[name] !== undefined)
  const checked = rs.filter((r) => !r.pending.includes(name))
  const ok = checked.filter((r) => !r.why.some((w) => w.startsWith(`[поле] ${name} `) || w === `[поле] нет meta.${name}`)).length
  return { n: rs.length, checked: checked.length, ok }
}
const fmtAcc = (x: { n: number; checked: number; ok: number }) => (x.checked ? `${x.ok}/${x.checked} (${((x.ok / x.checked) * 100).toFixed(0)} %)` : x.n ? `ждёт DIALOG (${x.n})` : '—')
const lenRows = rows.filter((r) => r.q.expect.minWords || r.q.expect.maxWords)
const lenOk = lenRows.filter((r) => !r.why.some((w) => w.startsWith('слов '))).length
const schoolRows = rows.filter((r) => (r.a.meta?.scope ?? r.q.expect.scope) === 'school' && r.a.done?.sources)
const schoolTop = schoolRows.filter((r) => ['textbook_grade', 'textbook_other', 'atomlab'].includes(r.a.done!.sources![0] ?? '')).length
const wikiLeak = rows.filter((r) => (r.a.meta?.scope ?? r.q.expect.scope) === 'school' && /википед|wikipedia/iu.test((r.a.done?.citations ?? []).join(' '))).length
const dlgRows = rows.filter((r) => DIALOG_CATS.includes(r.q.cat))
const dlgTopic = dlgRows.filter((r) => !r.why.some((w) => w.startsWith('нет /'))).length
console.log(
  `МОЗГ v2: standaloneAcc ${fmtAcc(fieldAcc('standalone'))} · followUpAcc ${fmtAcc(fieldAcc('followUp'))} · scopeAcc ${fmtAcc(fieldAcc('scope'))} · kindAcc ${fmtAcc(fieldAcc('kind'))} · lengthClassAcc ${fmtAcc(fieldAcc('lengthClass'))} · lengthAcc ${lenRows.length ? `${lenOk}/${lenRows.length}` : '—'} · schoolTop1 ${schoolRows.length ? `${schoolTop}/${schoolRows.length}` : 'ждёт done.sources'} · wikiLeak ${wikiLeak} · followUpTopic ${dlgRows.length ? `${dlgTopic}/${dlgRows.length}` : '—'}`,
)

// ——— пороги мозга v2 (только когда контракт DIALOG собран: поля детерминированы в --inproc и --mock-llm)
const v2Fails: string[] = []
if (dialogReady) {
  const live = runner.llm === 'ollama'
  for (const cat of DIALOG_CATS) {
    const rs = byCat.get(cat)
    if (!rs?.length) continue
    const fieldBad = rs.filter((r) => r.why.some(isFieldFail)).length
    if (!live && fieldBad) v2Fails.push(`${cat}: поля ${rs.length - fieldBad}/${rs.length} (нужно 100 %)`)
    const textOk = rs.filter((r) => !r.why.some((w) => !isFieldFail(w))).length
    if (textOk / rs.length < 0.9) v2Fails.push(`${cat}: текст ${textOk}/${rs.length} (нужно ≥ 90 %)`)
  }
  for (const [cat, min] of [['scope', 0.95], ['length', 0.9], ['logic', 0.85]] as const) {
    const rs = byCat.get(cat)
    if (!rs?.length) continue
    const ok = rs.filter((r) => !r.why.length).length
    if (ok / rs.length < min) v2Fails.push(`${cat}: ${ok}/${rs.length} (нужно ≥ ${min * 100} %)`)
  }
  if (wikiLeak) v2Fails.push(`wikiLeak ${wikiLeak} (нужно 0)`)
}

const failsDet = DETERMINISTIC.filter((c) => byCat.get(c)?.some((r) => r.why.length))
if (flag('fails') || flag('verbose') || failsDet.length) {
  const bad = rows.filter((r) => r.why.length && (flag('fails') || flag('verbose') || DETERMINISTIC.includes(r.q.cat)))
  if (bad.length) console.log('\nпровалы:')
  for (const r of bad) console.log(`  [${r.q.id}] ${r.q.q} → ${r.why.join('; ')}\n      «${r.a.text.replace(/\s+/g, ' ').slice(0, 220)}»`)
}
const jsonOut = arg('json')
if (jsonOut)
  fs.writeFileSync(
    jsonOut,
    JSON.stringify(
      rows.map((r) => ({ id: r.q.id, cat: r.q.cat, q: r.q.q, text: r.a.text, route: r.a.meta?.route, source: r.a.done?.source, standalone: r.a.meta?.standalone, followUp: r.a.meta?.followUp, scope: r.a.meta?.scope, kind: r.a.meta?.kind, lengthClass: r.a.meta?.lengthClass, sources: r.a.done?.sources, firstMs: r.a.firstMs, ms: r.a.ms, why: r.why, pending: r.pending })),
      null,
      2,
    ),
  )

const okAll = share >= need && !failsDet.length && !r3 && !cjk && !dishonest && !v2Fails.length
console.log(
  `\n${okAll ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}: общий ${(share * 100).toFixed(1)} % (порог ${need * 100} % ${runner.llm === 'ollama' ? 'с LLM' : runner.llm === 'mock' ? 'mock-LLM' : 'без LLM'}); детерминированные (${DETERMINISTIC.join(', ')}): ${failsDet.length ? 'провал — ' + failsDet.join(', ') : '100 %'}; R3: ${r3}; CJK: ${cjk}; нечестный route: ${dishonest}; мозг v2: ${dialogReady ? (v2Fails.length ? 'провал — ' + v2Fails.join('; ') : 'пороги пройдены') : 'DIALOG не собран — поля и v2-категории не в пороге'}`,
)
process.exit(okAll ? 0 : 1)

