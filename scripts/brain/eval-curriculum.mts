/**
 * npm run brain:eval:curriculum — прогон вопросов покрытия программы Kimyo 7–11 (brain/eval/curriculum/g*.jsonl,
 * собираются npm run brain:curriculum-eval) и отчёт покрытия по классам, подтипам и единицам.
 *
 *   по умолчанию / --inproc — конвейер в этом процессе без LLM (запасной путь)
 *   --mock-llm              — в процессе с mock-LLM (часть ответов «капризные»: R3, испорченные числа)
 *   --url=http://…          — живой сервер; --live — адрес из public/brain.json urls[0]
 *                             пауза между вопросами --pause-ms (по умолчанию 8000 вне loopback — лимит 8/мин на адрес;
 *                             0 на 127.0.0.1/localhost — на самом ПК сервера свои запросы не ограничиваются)
 *   --file=путь.jsonl       — другой набор (напр. brain/eval/curriculum/sample-live.jsonl для живой модели)
 *   --grade=g8 --unit=g8:12 --sub=definition --lang=uz --sample=N — фильтры (sample — класс × подтип × язык)
 *   --merged=A,B            — считать строителей слитыми (иначе флаги из brain/eval/curriculum/pending.json)
 *   --baseline=report.json  — напечатать дельты к прошлому отчёту;  --fails — напечатать провалы;  --json=путь
 *   --report                — записать отчёт и при фильтрах (без фильтров отчёт пишется всегда, кроме --no-report):
 *                             docs/plans/curriculum-coverage.md + brain/eval/curriculum/report.json (живой — report-live.json)
 *
 * Проверки — те же, что у brain:eval (scripts/brain/evalCheck.mts). Пока часть строителя не слита (pending.json):
 * A — цитата точного § (citationMatch) не проверяется в случае, citationHit печатается справочно, подтип section «ждёт A»;
 * B — случаи с needs B «ждут B». Ждущие случаи прогоняются и печатаются, но в пороги не входят.
 */
import fs from 'node:fs'
import path from 'node:path'
import { CJK_RE, hasR3 } from '../../brain/pipeline/postcheck.ts'
import { matchesLang, type Lang } from '../../brain/pipeline/normalize.ts'
import { check, httpRunner, inprocRunner, type Answer, type Question } from './evalCheck.mts'

/** Пороги без живой модели (--inproc и --mock-llm): доля прошедших по подтипу; код выхода 1 при провале. */
const THRESHOLDS_OFFLINE: Record<string, number> = { definition: 0.9, reaction: 0.9, calc: 1, obtain: 0.9, test: 0.7, why: 0.7, section: 0.85 }
/** Пороги с живой моделью (--url / --live, выборка sample-live.jsonl ≤ 100): общий и по подтипам. */
const THRESHOLDS_LIVE: Record<string, number> = { all: 0.85, calc: 1, test: 0.85, why: 0.85 }
/** Цитата нужного § среди школьных случаев (после слияния A), язык ответа = языку вопроса, Википедия/R3/CJK. */
const CITATION_HIT_MIN = 0.85
const LANG_OK_MIN = 0.98
const WIKI_LEAK_MAX = 0
const R3_MAX = 0
const CJK_MAX = 0

type Need = 'A' | 'B'
type CQuestion = Question & { unit: string; sub: string; needs?: Need[]; calcType?: string }
type Row = { q: CQuestion; a: Answer; why: string[]; waits: Need[]; citeHit: boolean; citeLoose: boolean }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const DIR = path.join(ROOT, 'brain', 'eval', 'curriculum')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)
const readLines = (file: string): CQuestion[] =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((s) => s.trim())
    .map((s) => JSON.parse(s) as CQuestion)

// ——— набор
const file = arg('file')
let all: CQuestion[] = file ? readLines(path.resolve(file)) : fs.readdirSync(DIR).filter((f) => /^g\d+\.jsonl$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))).flatMap((f) => readLines(path.join(DIR, f)))
if (!all.length) {
  console.error('[curriculum] нет вопросов — сначала npm run brain:curriculum-eval')
  process.exit(2)
}
const filters = { grade: arg('grade'), unit: arg('unit'), sub: arg('sub'), lang: arg('lang') }
if (filters.grade) all = all.filter((q) => q.unit.startsWith(`${filters.grade}:`))
if (filters.unit) all = all.filter((q) => filters.unit!.split(',').includes(q.unit))
if (filters.sub) all = all.filter((q) => filters.sub!.split(',').includes(q.sub))
if (filters.lang) all = all.filter((q) => filters.lang!.split(',').includes(q.lang))
const gradeOf = (q: CQuestion) => q.unit.split(':')[0]!
/** стратифицированная подвыборка: класс × подтип × язык по кругу, детерминированно */
function sample(list: CQuestion[], n: number): CQuestion[] {
  if (!n || n >= list.length) return list
  const groups = new Map<string, CQuestion[]>()
  for (const q of list) groups.set(`${gradeOf(q)}|${q.sub}|${q.lang}`, [...(groups.get(`${gradeOf(q)}|${q.sub}|${q.lang}`) ?? []), q])
  const keys = [...groups.keys()].sort()
  const out: CQuestion[] = []
  for (let i = 0; out.length < n; i++) {
    let added = false
    for (const k of keys) {
      const g = groups.get(k)!
      const j = Math.floor(((i * 7919) % g.length + i) % g.length)
      if (i < g.length && out.length < n && !out.includes(g[j]!)) (out.push(g[j]!), (added = true))
    }
    if (!added) break
  }
  return out
}
const set = sample(all, Number(arg('sample') ?? 0))
const filtered = !!(file || filters.grade || filters.unit || filters.sub || filters.lang || arg('sample'))

// ——— что ещё не слито
const pendingFile = JSON.parse(fs.readFileSync(path.join(DIR, 'pending.json'), 'utf8')) as Record<Need, boolean>
const merged = new Set((arg('merged') ?? '').split(',').filter(Boolean))
const pending: Record<Need, boolean> = { A: pendingFile.A && !merged.has('A'), B: pendingFile.B && !merged.has('B') }

// ——— исполнитель
const liveUrl = arg('url') ?? (flag('live') ? (JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'brain.json'), 'utf8')) as { urls: string[] }).urls[0] : undefined)
const runner = flag('mock-llm') ? await inprocRunner(true) : liveUrl ? await httpRunner(liveUrl.replace(/\/+$/, ''), 'brain:eval:curriculum') : await inprocRunner(false)
const loopback = !!liveUrl && /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(liveUrl)
const pauseMs = Number(arg('pause-ms') ?? (liveUrl && !loopback ? 8000 : 0))
const live = runner.llm === 'ollama'
console.log(`[brain:eval:curriculum] ${set.length} вопросов из ${all.length} · ${runner.name}${pauseMs ? ` · пауза ${pauseMs} мс` : ''} · ждут: ${(['A', 'B'] as Need[]).filter((n) => pending[n]).join(', ') || 'ничего'}`)

/** цитата нужного § в любом формате (до A: «§2.6», после A: «гл. 2, тема 6») — справочная метрика */
function looseCite(unit: string): RegExp {
  const [g, kp] = unit.split(':') as [string, string]
  const n = g.slice(1)
  const m = /^(\d+)\.(\d+)$/.exec(kp)
  const esc = kp.replace(/\./g, '\\.')
  return new RegExp(`Kimyo ${n}, (?:§${esc}${m ? `|гл\\. ${m[1]}, тема ${m[2]}` : ''})(?![\\d.])`, 'u')
}

const rows: Row[] = []
const t0 = performance.now()
for (const [i, q] of set.entries()) {
  if (i && pauseMs) await new Promise((r) => setTimeout(r, pauseMs))
  const a = await runner.ask(q)
  // ждёт: B — случаи калькулятора; A — только подтип section (ссылка на §); цитату § до A просто не проверяем в случае
  const waits = (q.needs ?? []).filter((n) => pending[n] && (n === 'B' || q.sub === 'section'))
  // до слияния A цитату точного § не требуем в самом случае (считаем отдельно — citationHit)
  const qq: CQuestion = pending.A ? { ...q, expect: { ...q.expect, citationMatch: undefined } } : q
  const why = check(qq, a, true)
  const cites = (a.done?.citations ?? []).join(' ')
  const citeHit = !!q.expect.citationMatch && new RegExp(q.expect.citationMatch, 'iu').test(cites)
  rows.push({ q, a, why, waits, citeHit, citeLoose: looseCite(q.unit).test(cites) })
  if ((i + 1) % 500 === 0) console.log(`  … ${i + 1}/${set.length} (${Math.round((performance.now() - t0) / 1000)} с)`)
}

// ——— метрики
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0)
const fmtP = (a: number, b: number) => (b ? `${pct(a, b).toFixed(1)} %` : '—')
const quant = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]! : 0
}
const gated = rows.filter((r) => !r.waits.length)
const ok = (r: Row) => !r.why.length
const school = rows.filter((r) => (r.a.meta as { scope?: string } | null)?.scope !== 'broad')
const metrics = {
  cases: rows.length,
  gated: gated.length,
  waiting: rows.length - gated.length,
  pass: gated.filter(ok).length,
  passAll: rows.filter(ok).length,
  citationHit: school.filter((r) => r.citeHit).length,
  citationHitLoose: school.filter((r) => r.citeLoose).length,
  schoolCases: school.length,
  schoolTop1: rows.filter((r) => ['textbook_grade', 'textbook_other', 'atomlab'].includes((r.a.done as { sources?: string[] } | null)?.sources?.[0] ?? '')).length,
  wikiLeak: rows.filter((r) => /википед|wikipedia/iu.test((r.a.done?.citations ?? []).join(' '))).length,
  r3: rows.filter((r) => hasR3(r.a.text)).length,
  cjk: rows.filter((r) => CJK_RE.test(r.a.text)).length,
  langOk: rows.filter((r) => matchesLang(r.a.text.trim(), r.q.lang as Lang)).length,
  calc: rows.filter((r) => r.q.sub === 'calc').length,
  numberOk: rows.filter((r) => r.q.sub === 'calc' && !r.why.some((w) => w.startsWith('нет числа'))).length,
  msP50: quant(rows.map((r) => r.a.ms), 50),
  msP95: quant(rows.map((r) => r.a.ms), 95),
}
type Agg = { n: number; ok: number; gated: number; gatedOk: number; cite: number }
function aggregate(key: (r: Row) => string): Map<string, Agg> {
  const m = new Map<string, Agg>()
  for (const r of rows) {
    const k = key(r)
    const a = m.get(k) ?? { n: 0, ok: 0, gated: 0, gatedOk: 0, cite: 0 }
    a.n++
    if (ok(r)) a.ok++
    if (!r.waits.length) (a.gated++, ok(r) && a.gatedOk++)
    if (r.citeHit) a.cite++
    m.set(k, a)
  }
  return new Map([...m].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
}
const bySub = aggregate((r) => r.q.sub)
const byGrade = aggregate((r) => gradeOf(r.q))
const byGradeSub = aggregate((r) => `${gradeOf(r.q)}/${r.q.sub}`)
const byUnit = aggregate((r) => r.q.unit)
const byLang = aggregate((r) => r.q.lang)

console.log('\nподтип        всего  прошло   доля   в пороге  прошло   доля   цитата §')
for (const [k, a] of bySub)
  console.log(`${k.padEnd(12)} ${String(a.n).padStart(6)} ${String(a.ok).padStart(7)} ${fmtP(a.ok, a.n).padStart(8)} ${String(a.gated).padStart(9)} ${String(a.gatedOk).padStart(7)} ${fmtP(a.gatedOk, a.gated).padStart(8)} ${fmtP(a.cite, a.n).padStart(9)}`)
console.log('\nкласс        всего  прошло   доля   цитата §')
for (const [k, a] of byGrade) console.log(`${k.padEnd(12)} ${String(a.n).padStart(6)} ${String(a.ok).padStart(7)} ${fmtP(a.ok, a.n).padStart(8)} ${fmtP(a.cite, a.n).padStart(9)}`)
console.log(`\nязыки: ${[...byLang].map(([k, a]) => `${k} ${fmtP(a.ok, a.n)} (${a.n})`).join(' · ')}`)
console.log(
  `МЕТРИКИ: в пороге ${metrics.pass}/${metrics.gated} (${fmtP(metrics.pass, metrics.gated)}) · все ${fmtP(metrics.passAll, metrics.cases)} · ждут ${metrics.waiting} · citationHit ${fmtP(metrics.citationHit, metrics.schoolCases)}${pending.A ? ' (ждёт A; любой формат § — ' + fmtP(metrics.citationHitLoose, metrics.schoolCases) + ')' : ''} · schoolTop1 ${fmtP(metrics.schoolTop1, metrics.cases)} · wikiLeak ${metrics.wikiLeak} · R3 ${metrics.r3} · CJK ${metrics.cjk} · язык ${fmtP(metrics.langOk, metrics.cases)} · numberOk ${metrics.numberOk}/${metrics.calc} · мс p50 ${metrics.msP50}, p95 ${metrics.msP95}`,
)

// ——— худшие единицы
const reasonOf = (w: string) => (w.startsWith('нет /') ? 'нет ожидаемого факта' : w.startsWith('цитаты без') ? 'нет цитаты §' : w.startsWith('нет числа') ? 'неверное число' : w.startsWith('язык') ? 'язык ответа' : w.startsWith('[поле]') ? w.split(' ').slice(0, 2).join(' ') : w.split(':')[0]!.slice(0, 40))
const worst = [...byUnit]
  .filter(([, a]) => a.n >= 3)
  .map(([unit, a]) => {
    const fails = rows.filter((r) => r.q.unit === unit && !ok(r))
    const reasons = new Map<string, number>()
    for (const r of fails) for (const w of r.why) reasons.set(reasonOf(w), (reasons.get(reasonOf(w)) ?? 0) + 1)
    return { unit, share: a.ok / a.n, n: a.n, ok: a.ok, reasons: [...reasons].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`), examples: fails.slice(0, 2).map((r) => ({ q: r.q.q.split('\n')[0]!.slice(0, 90), why: r.why[0] ?? '', answer: r.a.text.replace(/\s+/g, ' ').slice(0, 140) })) }
  })
  .sort((a, b) => a.share - b.share || b.n - a.n)
  .slice(0, 10)
console.log('\nхудшие единицы:')
for (const w of worst) console.log(`  ${w.unit.padEnd(9)} ${w.ok}/${w.n} — ${w.reasons.join('; ') || '—'}`)

// ——— пороги
const fails: string[] = []
const th = live ? THRESHOLDS_LIVE : THRESHOLDS_OFFLINE
if (live && th.all !== undefined && metrics.gated && metrics.pass / metrics.gated < th.all) fails.push(`общий ${fmtP(metrics.pass, metrics.gated)} < ${th.all * 100} %`)
for (const [sub, min] of Object.entries(th)) {
  if (sub === 'all') continue
  const a = bySub.get(sub)
  if (a?.gated && a.gatedOk / a.gated < min) fails.push(`${sub} ${fmtP(a.gatedOk, a.gated)} < ${min * 100} %`)
}
if (!pending.A && metrics.schoolCases && metrics.citationHit / metrics.schoolCases < CITATION_HIT_MIN) fails.push(`citationHit ${fmtP(metrics.citationHit, metrics.schoolCases)} < ${CITATION_HIT_MIN * 100} %`)
if (live && metrics.calc && metrics.numberOk < rows.filter((r) => r.q.sub === 'calc' && !r.waits.length).length) fails.push(`numberOk ${metrics.numberOk}/${metrics.calc} (нужно 100 %)`)
if (metrics.cases && metrics.langOk / metrics.cases < LANG_OK_MIN) fails.push(`язык ${fmtP(metrics.langOk, metrics.cases)} < ${LANG_OK_MIN * 100} %`)
if (metrics.wikiLeak > WIKI_LEAK_MAX) fails.push(`wikiLeak ${metrics.wikiLeak}`)
if (metrics.r3 > R3_MAX) fails.push(`R3 ${metrics.r3}`)
if (metrics.cjk > CJK_MAX) fails.push(`CJK ${metrics.cjk}`)

if (flag('fails'))
  for (const r of rows.filter((x) => !ok(x)))
    console.log(`  ✗ [${r.q.id}]${r.waits.length ? ` (ждёт ${r.waits.join(',')})` : ''} ${r.q.q.split('\n')[0]!.slice(0, 100)} → ${r.why.join('; ')}\n      «${r.a.text.replace(/\s+/g, ' ').slice(0, 200)}»`)

// ——— отчёт
const index = fs.existsSync(path.join(DIR, 'index.json')) ? (JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')) as { mapSource?: string; gaps?: { g9AppSectionsWithoutBook?: string[]; lowCoverage?: string[] } }) : {}
const mode = flag('mock-llm') ? 'mock-llm' : liveUrl ? 'live' : 'inproc'
const report = {
  version: 1,
  mode,
  runner: runner.name,
  pending,
  mapSource: index.mapSource ?? '—',
  filters: filtered ? { file, ...filters, sample: arg('sample') } : null,
  metrics,
  thresholds: { offline: THRESHOLDS_OFFLINE, live: THRESHOLDS_LIVE, citationHit: CITATION_HIT_MIN, langOk: LANG_OK_MIN },
  bySub: Object.fromEntries(bySub),
  byGrade: Object.fromEntries(byGrade),
  byGradeSub: Object.fromEntries(byGradeSub),
  byLang: Object.fromEntries(byLang),
  worstUnits: worst,
  passed: !fails.length,
  fails,
}
const baseline = arg('baseline')
if (baseline && fs.existsSync(baseline)) {
  const b = JSON.parse(fs.readFileSync(baseline, 'utf8')) as typeof report
  const d = (x: Agg | undefined, y: Agg | undefined) => (x && y && x.n && y.n ? `${((x.ok / x.n - y.ok / y.n) * 100).toFixed(1)} п.п.` : '—')
  console.log(`\nдельты к ${baseline}: всего ${(pct(metrics.passAll, metrics.cases) - pct(b.metrics.passAll, b.metrics.cases)).toFixed(1)} п.п. · ${[...bySub].map(([k, a]) => `${k} ${d(a, (b.bySub as Record<string, Agg>)[k])}`).join(' · ')}`)
}
const jsonOut = arg('json')
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows.map((r) => ({ id: r.q.id, unit: r.q.unit, sub: r.q.sub, lang: r.q.lang, q: r.q.q, text: r.a.text, citations: r.a.done?.citations, why: r.why, waits: r.waits, ms: r.a.ms })), null, 2))
if ((!filtered || flag('report')) && !flag('no-report')) {
  const reportName = mode === 'inproc' ? 'report.json' : `report-${mode}.json`
  fs.writeFileSync(path.join(DIR, reportName), JSON.stringify(report, null, 2) + '\n')
  if (mode === 'inproc') fs.writeFileSync(path.join(ROOT, 'docs', 'plans', 'curriculum-coverage.md'), markdown())
  console.log(`\nотчёт: brain/eval/curriculum/${reportName}${mode === 'inproc' ? ' · docs/plans/curriculum-coverage.md' : ''}`)
}

function markdown(): string {
  const subs = [...bySub.keys()]
  const L: string[] = []
  L.push('# Покрытие программы Kimyo 7–11 — отчёт прогона')
  L.push('')
  L.push('> Генерируется `npm run brain:eval:curriculum` (без LLM, запасной путь мозга). Не править руками — перезапустить.')
  L.push(`> Вопросы: \`npm run brain:curriculum-eval\` → brain/eval/curriculum/g7..g11.jsonl (${all.length} случаев; карта: ${index.mapSource ?? '—'}).`)
  L.push(`> Ждут слияния: ${(['A', 'B'] as Need[]).filter((n) => pending[n]).map((n) => (n === 'A' ? 'A (карта и точный § в цитатах)' : 'B (калькулятор brain/calc)')).join(', ') || 'ничего'} — флаги в brain/eval/curriculum/pending.json.`)
  L.push('')
  L.push('## Итог')
  L.push('')
  L.push(`- В пороге: **${metrics.pass}/${metrics.gated} (${fmtP(metrics.pass, metrics.gated)})**, всего с ждущими: ${fmtP(metrics.passAll, metrics.cases)}; ждут слияния: ${metrics.waiting}.`)
  L.push(`- citationHit (цитата нужного §): ${fmtP(metrics.citationHit, metrics.schoolCases)}${pending.A ? ` — ждёт A; § в любом формате: ${fmtP(metrics.citationHitLoose, metrics.schoolCases)}` : ''}; schoolTop1 ${fmtP(metrics.schoolTop1, metrics.cases)}.`)
  L.push(`- Википедия в цитатах: ${metrics.wikiLeak}; R3: ${metrics.r3}; CJK: ${metrics.cjk}; язык ответа = языку вопроса: ${fmtP(metrics.langOk, metrics.cases)}; числа в расчётах: ${metrics.numberOk}/${metrics.calc}.`)
  L.push(`- Пороги: ${fails.length ? '**не пройдены** — ' + fails.join('; ') : '**пройдены**'}.`)
  L.push('')
  L.push('## По классам и подтипам (доля прошедших, в скобках — число случаев)')
  L.push('')
  L.push(`| класс | всего | ${subs.join(' | ')} | цитата § |`)
  L.push(`|---|---|${subs.map(() => '---').join('|')}|---|`)
  for (const [g, a] of byGrade) L.push(`| ${g} | ${fmtP(a.ok, a.n)} (${a.n}) | ${subs.map((s) => { const x = byGradeSub.get(`${g}/${s}`); return x ? `${fmtP(x.ok, x.n)} (${x.n})` : '—' }).join(' | ')} | ${fmtP(a.cite, a.n)} |`)
  L.push('')
  L.push('Пороги без LLM: ' + Object.entries(THRESHOLDS_OFFLINE).map(([k, v]) => `${k} ≥ ${v * 100} %`).join(', ') + `; citationHit ≥ ${CITATION_HIT_MIN * 100} % (после A); wikiLeak = 0, R3 = 0, CJK = 0, язык ≥ ${LANG_OK_MIN * 100} %.`)
  L.push('Живая модель (sample-live.jsonl, 100 случаев): ' + Object.entries(THRESHOLDS_LIVE).map(([k, v]) => `${k} ≥ ${v * 100} %`).join(', ') + ', numberOk 100 %.')
  L.push('')
  L.push('## Худшие 10 единиц')
  L.push('')
  L.push('| единица | прошло | причины | пример провала |')
  L.push('|---|---|---|---|')
  for (const w of worst) L.push(`| ${w.unit} | ${w.ok}/${w.n} | ${w.reasons.join('; ') || '—'} | ${w.examples[0] ? `«${w.examples[0].q.replace(/\|/g, '/')}» — ${w.examples[0].why.replace(/\|/g, '/').slice(0, 90)}` : '—'} |`)
  L.push('')
  L.push('## Пробелы книги (не «дотягиваются» — показываются честно)')
  L.push('')
  const g9 = index.gaps?.g9AppSectionsWithoutBook ?? []
  L.push(`- Секции приложения 9 класса без § в книге Kimyo 9 (${g9.length}): ${g9.join('; ') || '—'}. Их покрытие идёт только из карточек ATOMLAB и Kimyo 11.`)
  const low = index.gaps?.lowCoverage ?? []
  L.push(`- Единицы с coverageScore < 0,6 (${low.length}): ${low.join('; ') || '—'}.`)
  L.push('')
  return L.join('\n')
}

console.log(`\n${fails.length ? 'НЕ ПРОЙДЕНО' : 'ПРОЙДЕНО'} (${mode}${live ? ', живая модель' : ''}): ${fails.length ? fails.join('; ') : 'все пороги'}${metrics.waiting ? ` · ${metrics.waiting} случаев ждут слияния (${(['A', 'B'] as Need[]).filter((n) => pending[n]).join(', ')})` : ''}`)
process.exit(fails.length ? 1 : 0)
