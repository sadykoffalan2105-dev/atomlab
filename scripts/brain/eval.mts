/**
 * npm run brain:eval — контрольные вопросы мозга (brain/eval/questions.jsonl, ≥ 150) по категориям.
 *
 *   по умолчанию     — через HTTP на запущенный сервер http://127.0.0.1:8787 (env BRAIN_PORT / --url=…)
 *   --inproc         — без сервера: конвейер в этом процессе (без LLM — запасной путь)
 *   --mock-llm       — в процессе с подменой Ollama (brain/llm/mock.ts; часть ответов «капризные»: R3 и испорченные числа)
 *   --cat=calc,rule  — только эти категории;  --verbose — печатать ответы;  --fails — печатать провалы
 *   --json=путь      — сохранить подробный отчёт
 *   --sample=N       — стратифицированная подвыборка ~N вопросов (равномерно по категориям) для быстрых замеров на живой модели
 *
 * Критерии (код выхода 1 при провале): rule, profanity, calc, smalltalk — 100 %; общий pass ≥ 85 % с настоящей
 * LLM (Ollama) и ≥ 75 % без неё (запасной путь и mock). R3-фразы запрещены во всех ответах.
 * Всегда: CJK-символов (китайский/японский/корейский) в ответах 0; маршрут честный — meta.route=llm только
 * если ответ реально от модели (done.source=llm), и meta.route совпадает с done.route, если сервер его прислал.
 * Метрики: доля route=llm, первый кусок ответа p50/p95, длительность p50/p95.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ChatRequest, DoneEvent, MetaEvent } from '../../brain/pipeline/chat.ts'
import { CJK_RE, hasR3, wordCount } from '../../brain/pipeline/postcheck.ts'
import { matchesLang } from '../../brain/pipeline/normalize.ts'

type Expect = {
  exact?: string
  startsWith?: string
  mustMatch?: string[]
  mustNotMatch?: string[]
  lang?: 'ru' | 'uz' | 'en'
  maxWords?: number
  number?: { value: number; tol: number }
  intent?: string
}
type Question = { id: string; cat: string; lang: string; q: string; expect: Expect }
type Answer = { text: string; meta: MetaEvent | null; done: DoneEvent | null; ms: number; firstMs?: number; error?: string }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)

const DETERMINISTIC = ['rule', 'profanity', 'calc', 'smalltalk']

const questions: Question[] = fs
  .readFileSync(path.join(ROOT, 'brain', 'eval', 'questions.jsonl'), 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => JSON.parse(s) as Question)
const cats = arg('cat')?.split(',')
const pool = cats ? questions.filter((q) => cats.includes(q.cat)) : questions
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
    messages: [{ role: 'user', content: q.q }],
    context: { gradeId: 'g9', mode: 'chat', detail: 'brief' },
  }
}

/** Числа из текста: «98,08», «98.08», «−2», «6,02·10²³» (берём мантиссу). */
function numbersIn(text: string): number[] {
  return [...text.replace(/[−–]/g, '-').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.'))).filter((n) => Number.isFinite(n))
}

function check(q: Question, a: Answer): string[] {
  const e = q.expect
  const t = a.text.trim()
  const why: string[] = []
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
  if (e.number && !numbersIn(t).some((n) => Math.abs(n - e.number!.value) <= e.number!.tol)) why.push(`нет числа ${e.number.value}±${e.number.tol}`)
  if (e.intent && a.meta?.intent !== e.intent) why.push(`intent ${a.meta?.intent} ≠ ${e.intent}`)
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

type Row = { q: Question; a: Answer; why: string[] }
const rows: Row[] = []
for (const q of set) {
  const a = await runner.ask(q)
  const why = check(q, a)
  rows.push({ q, a, why })
  if (flag('verbose')) console.log(`\n${why.length ? '✗' : '✓'} [${q.id}] ${q.q}\n${a.text}\n  → ${a.meta?.route} · ${a.done?.source} · ${a.done?.confidenceLabel} · первый кусок ${a.firstMs ?? '—'} мс · всего ${a.ms} мс${why.length ? ' · ' + why.join('; ') : ''}`)
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0
}
const byCat = new Map<string, Row[]>()
for (const r of rows) byCat.set(r.q.cat, [...(byCat.get(r.q.cat) ?? []), r])
console.log('\nкатегория      всего  прошло   доля   медиана мс  маршруты')
for (const [cat, rs] of byCat) {
  const ok = rs.filter((r) => !r.why.length).length
  const routes = new Map<string, number>()
  for (const r of rs) routes.set(r.a.meta?.route ?? '—', (routes.get(r.a.meta?.route ?? '—') ?? 0) + 1)
  console.log(
    `${cat.padEnd(14)} ${String(rs.length).padStart(5)}  ${String(ok).padStart(6)}  ${((ok / rs.length) * 100).toFixed(0).padStart(4)} %  ${String(Math.round(median(rs.map((r) => r.a.ms)))).padStart(9)}   ${[...routes].map(([k, v]) => `${k}×${v}`).join(' ')}`,
  )
}
const pass = rows.filter((r) => !r.why.length).length
const total = rows.length
const r3 = rows.filter((r) => hasR3(r.a.text)).length
const share = total ? pass / total : 0
const need = runner.llm === 'ollama' ? 0.85 : 0.75
console.log(`ВСЕГО          ${String(total).padStart(5)}  ${String(pass).padStart(6)}  ${(share * 100).toFixed(1).padStart(5)} %  ${String(Math.round(median(rows.map((r) => r.a.ms)))).padStart(8)}   R3-фраз: ${r3}`)

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

const failsDet = DETERMINISTIC.filter((c) => byCat.get(c)?.some((r) => r.why.length))
if (flag('fails') || flag('verbose') || failsDet.length) {
  const bad = rows.filter((r) => r.why.length && (flag('fails') || flag('verbose') || DETERMINISTIC.includes(r.q.cat)))
  if (bad.length) console.log('\nпровалы:')
  for (const r of bad) console.log(`  [${r.q.id}] ${r.q.q} → ${r.why.join('; ')}\n      «${r.a.text.replace(/\s+/g, ' ').slice(0, 220)}»`)
}
const jsonOut = arg('json')
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows.map((r) => ({ id: r.q.id, cat: r.q.cat, q: r.q.q, text: r.a.text, route: r.a.meta?.route, source: r.a.done?.source, firstMs: r.a.firstMs, ms: r.a.ms, why: r.why })), null, 2))

const okAll = share >= need && !failsDet.length && !r3 && !cjk && !dishonest
console.log(
  `\n${okAll ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}: общий ${(share * 100).toFixed(1)} % (порог ${need * 100} % ${runner.llm === 'ollama' ? 'с LLM' : runner.llm === 'mock' ? 'mock-LLM' : 'без LLM'}); детерминированные (${DETERMINISTIC.join(', ')}): ${failsDet.length ? 'провал — ' + failsDet.join(', ') : '100 %'}; R3: ${r3}; CJK: ${cjk}; нечестный route: ${dishonest}`,
)
process.exit(okAll ? 0 : 1)
