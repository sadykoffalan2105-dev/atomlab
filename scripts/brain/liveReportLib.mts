/**
 * Общее для живого ночного отчёта качества (nextBuild #2 «Живые ворота качества»):
 *   - типы отчёта C:\ATOMLAB\reports\live-YYYYMMDD.json (пишет scripts/brain/nightly-live.mts на сервере с GPU);
 *   - пороги приёмки (Fable, plan-top1.json → nextBuild #2) и их проверка;
 *   - отчёт в Markdown (scripts/brain/live-report.mts → docs/plans/live-report.md на ноутбуке владельца).
 * Провал порога — красная строка в журнале и ✗ в отчёте, но НИКОГДА не ошибка обновления сервера.
 */

export type PartName = 'eval' | 'curriculum' | 'image' | 'stt'
export type PartStatus = 'ok' | 'fail' | 'skipped' | 'error'

export interface PartBase {
  status: PartStatus
  durationMs: number
  /** почему пропущено / упало (без ключей и путей секретов) */
  note?: string
}

export interface EvalPart extends PartBase {
  n: number
  pass: number
  byCat: Record<string, { n: number; pass: number }>
  /** первое слово ответа модели (route=llm, без busy), мс */
  firstMs: { n: number; p50: number | null; p95: number | null }
  busy: number
  r3: number
  cjk: number
  wikiLeak: number | null
  /** до 10 провалов: id, категория, причина */
  fails: { id: string; cat: string; why: string }[]
}

export interface CurriculumPart extends PartBase {
  n: number
  pass: number
  bySub: Record<string, { n: number; pass: number }>
  waits: number
  r3: number
  cjk: number
  wikiLeak: number
  fails: { id: string; sub: string; why: string }[]
}

export interface ImagePart extends PartBase {
  engine: string | null
  items: { presetId: string; ok: boolean; ms: number; genMs: number | null; nsfw: number | null; error?: string }[]
  p50Ms: number | null
  p95Ms: number | null
  nsfwMax: number | null
}

export interface SttPart extends PartBase {
  engine: string | null
  device: string | null
  clips: number
  /** WER clean по языкам (0…1) */
  wer: Record<string, number>
  p95Ms: number | null
  /** собственный итог voice:eval (его пороги строже/другие — справочно) */
  evalOk: boolean | null
}

export interface LiveHealth {
  ok: boolean
  version: string | null
  chatModel: string | null
  llm: boolean
  image: { enabled: boolean; ready: boolean; engine: string | null }
  stt: { available: boolean; device: string | null }
}

export interface Threshold {
  part: PartName
  name: string
  value: number | null
  limit: number
  op: '>=' | '<=' | '<' | '='
  unit: '%' | 's' | 'ms' | ''
  ok: boolean
}

export interface LiveReport {
  version: 1
  /** YYYY-MM-DD (местная дата сервера) */
  date: string
  startedAt: string
  finishedAt: string
  commit: string | null
  url: string
  health: LiveHealth | null
  parts: { eval?: EvalPart; curriculum?: CurriculumPart; image?: ImagePart; stt?: SttPart }
  thresholds: Threshold[]
  ok: boolean
  failed: string[]
}

/** Пороги Fable nextBuild #2 (живой сервер). Меняются здесь — и в отчёте, и в ночном прогоне. */
export const LIVE_THRESHOLDS = {
  eval: { all: 0.85, calc: 1, firstP50Ms: 2000, firstP95Ms: 8000, r3: 0, cjk: 0, wikiLeak: 0 },
  curriculum: { all: 0.85, calc: 1, test: 0.85, why: 0.85, r3: 0, cjk: 0, wikiLeak: 0 },
  image: { p50Ms: 15_000, p95Ms: 30_000, nsfwMax: 0.1 },
  stt: { wer: { ru: 0.12, uz: 0.18, en: 0.1 } as Record<string, number> },
} as const

export const PART_TITLES: Record<PartName, string> = {
  eval: 'Диалоги (brain:eval)',
  curriculum: 'Программа Kimyo (eval:curriculum)',
  image: 'Картинки (/admin/image/test)',
  stt: 'Распознавание речи (voice:eval)',
}

/** Перцентиль «ближайший ранг» (как в brain:eval). */
export function pct(xs: number[], p: number): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!
}

const share = (x: { n: number; pass: number } | undefined): number | null => (x && x.n ? x.pass / x.n : null)

/** Проверка порогов по частям, которые реально прошли (skipped — без порогов; error — один проваленный «прогон выполнен»). */
export function evaluateThresholds(parts: LiveReport['parts']): Threshold[] {
  const out: Threshold[] = []
  const add = (part: PartName, name: string, value: number | null, op: Threshold['op'], limit: number, unit: Threshold['unit']) => {
    const ok = value !== null && (op === '>=' ? value >= limit - 1e-9 : op === '<=' ? value <= limit + 1e-9 : op === '<' ? value < limit : value === limit)
    out.push({ part, name, value, limit, op, unit, ok })
  }
  const ran = (name: PartName, p: PartBase | undefined): boolean => {
    if (!p || p.status === 'skipped') return false
    if (p.status === 'error') {
      add(name, 'прогон выполнен', 0, '=', 1, '')
      return false
    }
    return true
  }
  const E = LIVE_THRESHOLDS.eval
  const e = parts.eval
  if (ran('eval', e) && e) {
    add('eval', 'общий', share(e), '>=', E.all, '%')
    if (e.byCat.calc?.n) add('eval', 'calc (числа)', share(e.byCat.calc), '>=', E.calc, '%')
    add('eval', 'первое слово p50', e.firstMs.p50, '<=', E.firstP50Ms, 'ms')
    add('eval', 'первое слово p95', e.firstMs.p95, '<=', E.firstP95Ms, 'ms')
    add('eval', 'R3-фразы', e.r3, '<=', E.r3, '')
    add('eval', 'CJK', e.cjk, '<=', E.cjk, '')
    if (e.wikiLeak !== null) add('eval', 'wikiLeak', e.wikiLeak, '<=', E.wikiLeak, '')
  }
  const C = LIVE_THRESHOLDS.curriculum
  const c = parts.curriculum
  if (ran('curriculum', c) && c) {
    add('curriculum', 'общий', share(c), '>=', C.all, '%')
    for (const sub of ['calc', 'test', 'why'] as const) if (c.bySub[sub]?.n) add('curriculum', sub, share(c.bySub[sub]), '>=', C[sub], '%')
    add('curriculum', 'R3-фразы', c.r3, '<=', C.r3, '')
    add('curriculum', 'CJK', c.cjk, '<=', C.cjk, '')
    add('curriculum', 'wikiLeak', c.wikiLeak, '<=', C.wikiLeak, '')
  }
  const I = LIVE_THRESHOLDS.image
  const im = parts.image
  if (ran('image', im) && im) {
    add('image', 'все картинки готовы', im.items.length ? im.items.filter((x) => x.ok).length / im.items.length : null, '>=', 1, '%')
    add('image', 'картинка p50', im.p50Ms, '<=', I.p50Ms, 's')
    add('image', 'картинка p95', im.p95Ms, '<=', I.p95Ms, 's')
    add('image', 'nsfw (макс.)', im.nsfwMax, '<', I.nsfwMax, '')
  }
  const s = parts.stt
  if (ran('stt', s) && s) {
    for (const [lang, lim] of Object.entries(LIVE_THRESHOLDS.stt.wer)) if (s.wer[lang] !== undefined) add('stt', `WER ${lang}`, s.wer[lang]!, '<=', lim, '%')
    if (!Object.keys(s.wer).length) add('stt', 'WER посчитан', null, '=', 1, '')
  }
  return out
}

/** Пороги → статусы частей, итог и список проваленных (для журнала и /admin/live-report). */
export function finalize(r: Omit<LiveReport, 'thresholds' | 'ok' | 'failed'>): LiveReport {
  const thresholds = evaluateThresholds(r.parts)
  for (const name of Object.keys(r.parts) as PartName[]) {
    const p = r.parts[name]
    if (p && p.status !== 'skipped' && p.status !== 'error') p.status = thresholds.some((t) => t.part === name && !t.ok) ? 'fail' : 'ok'
  }
  const failed = thresholds.filter((t) => !t.ok).map((t) => `${t.part}: ${t.name} ${fmtValue(t)} (нужно ${t.op} ${fmtLimit(t)})`)
  return { ...r, thresholds, ok: failed.length === 0, failed }
}

export function fmtValue(t: Pick<Threshold, 'value' | 'unit'>): string {
  if (t.value === null) return '—'
  if (t.unit === '%') return `${(t.value * 100).toFixed(1)} %`
  if (t.unit === 's') return `${(t.value / 1000).toFixed(1)} с`
  if (t.unit === 'ms') return `${Math.round(t.value)} мс`
  return String(Math.round(t.value * 1000) / 1000)
}
const fmtLimit = (t: Threshold) => fmtValue({ value: t.limit, unit: t.unit })

/** Строки для консоли (сервер): провал — красным (ANSI), но код выхода не трогаем. */
export function consoleLines(r: LiveReport, color = true): string[] {
  const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s)
  const green = (s: string) => (color ? `\x1b[32m${s}\x1b[0m` : s)
  const lines = r.thresholds.map((t) => {
    const s = `${t.ok ? '  ok  ' : '  XX  '}${PART_TITLES[t.part]} · ${t.name}: ${fmtValue(t)} (порог ${t.op} ${fmtLimit(t)})`
    return t.ok ? green(s) : red(s)
  })
  for (const [name, p] of Object.entries(r.parts) as [PartName, PartBase][]) if (p.status === 'skipped' || p.status === 'error') lines.push(`  --  ${PART_TITLES[name]}: ${p.status === 'skipped' ? 'пропущено' : 'ошибка'}${p.note ? ' — ' + p.note : ''}`)
  lines.push(r.ok ? green(`ИТОГ: все пороги пройдены (${r.thresholds.length})`) : red(`ИТОГ: провалено ${r.failed.length} из ${r.thresholds.length} порогов — обновление сервера это НЕ останавливает`))
  return lines
}

const mdEsc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const pctS = (x: { n: number; pass: number }) => `${x.pass}/${x.n} (${x.n ? ((x.pass / x.n) * 100).toFixed(0) : 0} %)`
const sec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} с`)

/** docs/plans/live-report.md: дата, коммит, пороги ✓/✗, подробности частей, история прошлых ночей. */
export function renderMarkdown(r: LiveReport, history: { date: string; ok: boolean | null; failed: number | null }[] = []): string {
  const L: string[] = []
  L.push(`# Живой отчёт качества ИИ-учителя — ${r.date}`, '')
  L.push('Ночной прогон на сервере с видеокартой (задача «ATOMLAB Nightly», 03:00; `deploy/brain-pc/nightly-eval.ps1` → `scripts/brain/nightly-live.mts`).')
  L.push('Собрано `npm run brain:live-report` с `GET /admin/live-report`. Пороги — Fable, nextBuild #2; провал порога обновление сервера не останавливает.', '')
  L.push(`- Итог: **${r.ok ? 'все пороги пройдены' : `провалено ${r.failed.length} из ${r.thresholds.length}`}**`)
  L.push(`- Коммит сервера: \`${r.commit ?? '—'}\` · прогон ${r.startedAt.replace('T', ' ').slice(0, 16)} → ${r.finishedAt.replace('T', ' ').slice(11, 16)}`)
  if (r.health) L.push(`- Модель: ${r.health.chatModel ?? '—'} (LLM ${r.health.llm ? 'доступна' : 'НЕ доступна'}) · мозг ${r.health.version ?? '—'} · картинки: ${r.health.image.enabled ? (r.health.image.ready ? `готовы (${r.health.image.engine ?? '—'})` : 'не готовы') : 'выключены'} · STT: ${r.health.stt.available ? `да (${r.health.stt.device ?? '—'})` : 'нет'}`)
  else L.push('- /health: мозг не ответил')
  L.push('', '## Пороги', '', '| Часть | Порог | Значение | Нужно | Итог |', '|---|---|---|---|---|')
  for (const t of r.thresholds) L.push(`| ${PART_TITLES[t.part]} | ${mdEsc(t.name)} | ${fmtValue(t)} | ${t.op} ${fmtLimit(t)} | ${t.ok ? '✓' : '✗'} |`)
  for (const [name, p] of Object.entries(r.parts) as [PartName, PartBase][])
    if (p.status === 'skipped' || p.status === 'error') L.push(`| ${PART_TITLES[name]} | — | ${p.status === 'skipped' ? 'пропущено' : 'ошибка'} | — | ${mdEsc(p.note ?? '')} |`)
  const e = r.parts.eval
  if (e && e.n) {
    L.push('', `## ${PART_TITLES.eval}`, '', `Вопросов ${e.n}, прошло ${pctS(e)}; первое слово (LLM, n=${e.firstMs.n}) p50 ${sec(e.firstMs.p50)}, p95 ${sec(e.firstMs.p95)}; busy ${e.busy}; R3 ${e.r3}; CJK ${e.cjk}; wikiLeak ${e.wikiLeak ?? '—'}; ${sec(e.durationMs)}.`, '')
    L.push('| Категория | Прошло |', '|---|---|')
    for (const [cat, x] of Object.entries(e.byCat)) L.push(`| ${cat} | ${pctS(x)} |`)
    if (e.fails.length) L.push('', 'Провалы:', ...e.fails.map((f) => `- \`${f.id}\` (${f.cat}): ${mdEsc(f.why)}`))
  }
  const c = r.parts.curriculum
  if (c && c.n) {
    L.push('', `## ${PART_TITLES.curriculum}`, '', `Случаев ${c.n} (ждут строителя: ${c.waits}), прошло ${pctS(c)}; R3 ${c.r3}; CJK ${c.cjk}; wikiLeak ${c.wikiLeak}; ${sec(c.durationMs)}.`, '')
    L.push('| Подтип | Прошло |', '|---|---|')
    for (const [sub, x] of Object.entries(c.bySub)) L.push(`| ${sub} | ${pctS(x)} |`)
    if (c.fails.length) L.push('', 'Провалы:', ...c.fails.map((f) => `- \`${f.id}\` (${f.sub}): ${mdEsc(f.why)}`))
  }
  const im = r.parts.image
  if (im && im.items.length) {
    L.push('', `## ${PART_TITLES.image}`, '', `Движок ${im.engine ?? '—'}; p50 ${sec(im.p50Ms)}, p95 ${sec(im.p95Ms)}; nsfw макс. ${im.nsfwMax ?? '—'}.`, '')
    L.push('| Тема | Итог | Всего | Рисование | nsfw |', '|---|---|---|---|---|')
    for (const x of im.items) L.push(`| ${x.presetId} | ${x.ok ? '✓' : `✗ ${mdEsc(x.error ?? '')}`} | ${sec(x.ms)} | ${sec(x.genMs)} | ${x.nsfw ?? '—'} |`)
  }
  const s = r.parts.stt
  if (s && s.clips) {
    L.push('', `## ${PART_TITLES.stt}`, '', `Движок ${s.engine ?? '—'}/${s.device ?? '—'}, клипов ${s.clips} (scripts/voice/fixtures), p95 ${s.p95Ms === null ? '—' : Math.round(s.p95Ms) + ' мс'}; собственные пороги voice:eval: ${s.evalOk === null ? '—' : s.evalOk ? 'пройдены' : 'не пройдены'}.`, '')
    L.push('| Язык | WER clean |', '|---|---|')
    for (const [lang, w] of Object.entries(s.wer)) L.push(`| ${lang} | ${(w * 100).toFixed(1)} % |`)
  }
  if (history.length) {
    L.push('', '## Прошлые ночи', '', '| Дата | Итог |', '|---|---|')
    for (const h of history) L.push(`| ${h.date} | ${h.ok === null ? '—' : h.ok ? '✓ все пороги' : `✗ провалено ${h.failed ?? '?'}`} |`)
  }
  return L.join('\n') + '\n'
}

/** «20261012» / «2026-10-12» → «20261012»; иначе null (защита пути отчёта). */
export function normDate(s: string | null | undefined): string | null {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(String(s ?? '').trim())
  return m ? `${m[1]}${m[2]}${m[3]}` : null
}
