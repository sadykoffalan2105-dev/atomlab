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
 *   --extra=файл.jsonl — дописать случаи к пулу (можно несколько раз), напр. brain/eval/curriculum/sample-live.jsonl;
 *                      их категория curriculum: с живой LLM порог ≥ 85 %, без LLM/mock — печатается отдельно, в общий порог не входит
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
import { CJK_RE, hasR3 } from '../../brain/pipeline/postcheck.ts'
// проверки, типы и исполнители — общие с npm run brain:eval:curriculum (вынесены без изменения логики)
import { check, httpRunner, inprocRunner, type Answer, type Question } from './evalCheck.mts'

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
// --extra=путь.jsonl (можно несколько): случаи других наборов (покрытие программы Kimyo — cat curriculum)
for (const file of process.argv.filter((a) => a.startsWith('--extra=')).map((a) => a.slice(8)))
  for (const line of fs.readFileSync(path.resolve(file), 'utf8').split('\n')) if (line.trim()) questions.push(JSON.parse(line) as Question)
/** Категории наборов --extra: в живом прогоне — свой порог, без LLM — вне общего порога (печатаются отдельно). */
const EXTRA_CATS = ['curriculum']
const EXTRA_LIVE_MIN = 0.85
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

const runner = flag('mock-llm') ? await inprocRunner(true, arg('profile')) : flag('inproc') ? await inprocRunner(false, arg('profile')) : await httpRunner(arg('url') ?? `http://127.0.0.1:${process.env.BRAIN_PORT || 8787}`)
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
const gated = (dialogReady ? rows : rows.filter((r) => !V2_CATS.includes(r.q.cat))).filter((r) => !EXTRA_CATS.includes(r.q.cat))
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
// категории --extra (curriculum): с живой LLM — свой порог; без LLM/mock — только печать (пороги — npm run brain:eval:curriculum)
for (const cat of EXTRA_CATS) {
  const rs = byCat.get(cat)
  if (!rs?.length) continue
  const ok = rs.filter((r) => !r.why.length).length
  if (runner.llm === 'ollama' && ok / rs.length < EXTRA_LIVE_MIN) v2Fails.push(`${cat}: ${ok}/${rs.length} (нужно ≥ ${EXTRA_LIVE_MIN * 100} %)`)
  else if (runner.llm !== 'ollama') console.log(`${cat}: ${ok}/${rs.length} — вне общего порога (без живой LLM)`)
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

