/**
 * npm run brain:teacher-tools-live -- --url=https://<сервер>.ts.net (--admin=<ключ> | --teacher=<ключ учителя>)
 *                                    [--unit=g8:12] [--units=g8:12,g8:13] [--lang=ru] [--photo=путь.jpg] [--out=.tmp/teacher-tools-live]
 * Живая приёмка инструментов учителя (nextBuild #4) на сервере мозга — тот же контракт, что у сайта (teacherTools.ts):
 *   1) POST /teacher/plan  {unit, lang, minutes:45}       → разбор normPlan: есть этапы, сумма минут ≈ урок, есть вопросы;
 *   2) POST /teacher/test  {units, lang, n, format} ×3     → normTest: n заданий (±2), баллы сходятся с totalPoints, шкала 5/4/3/2;
 *   3) POST /teacher/grade {lang, unit, rubric, images}   → normGrade: критерии = рубрика, total ≤ max (только с --photo);
 *   4) без ключа → 403 (ученик не может). Ответы JSON сохраняются в --out; ✓/✗ и код выхода 1 при провале.
 * Ключи берутся только из аргументов/окружения (BRAIN_ADMIN_TOKEN, BRAIN_TEACHER_KEY) и нигде не печатаются.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildBody, normGrade, normPlan, normTest, type TeacherToolKind } from '../../src/learn/brain/remote/teacherTools'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true']
  }),
) as Record<string, string>
const URL_ = String(args.url ?? '').replace(/\/+$/, '')
const ADMIN = String(args.admin ?? process.env.BRAIN_ADMIN_TOKEN ?? '')
const TEACHER = String(args.teacher ?? process.env.BRAIN_TEACHER_KEY ?? '')
const LANG = (['ru', 'uz', 'en'].includes(args.lang ?? '') ? args.lang : 'ru') as 'ru' | 'uz' | 'en'
const UNIT = String(args.unit ?? 'g8:12')
const UNITS = String(args.units ?? `${UNIT}`).split(',').map((x) => x.trim()).filter(Boolean)
const OUT = path.resolve(String(args.out ?? '.tmp/teacher-tools-live'))
if (!URL_ || (!ADMIN && !TEACHER)) {
  console.error('нужно: --url=https://<сервер> и --admin=<ключ администратора> или --teacher=<ключ учителя>')
  process.exit(2)
}

let failed = 0
const check = (cond: boolean, what: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

async function post(kind: TeacherToolKind, body: Record<string, unknown>, withKey = true): Promise<{ status: number; ms: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const b = { ...body }
  if (withKey) {
    if (ADMIN) headers['X-Brain-Admin'] = ADMIN
    else b.teacherKey = TEACHER
  }
  const t0 = Date.now()
  try {
    const r = await fetch(`${URL_}/teacher/${kind}`, { method: 'POST', headers, body: JSON.stringify(b), signal: AbortSignal.timeout(kind === 'grade' ? 120_000 : 60_000) })
    let data: unknown = null
    try {
      data = await r.json()
    } catch {
      data = null
    }
    return { status: r.status, ms: Date.now() - t0, data }
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, data: { error: String((e as Error)?.message ?? e) } }
  }
}

const save = (name: string, data: unknown) => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n', 'utf8')
}

console.log(`Инструменты учителя: ${URL_} (${ADMIN ? 'владелец' : 'учитель'}), язык ${LANG}`)

// 1) план
{
  console.log('\n1) /teacher/plan')
  const r = await post('plan', buildBody('plan', { unit: UNIT, lang: LANG, minutes: 45 }))
  save('plan.json', r.data)
  check(r.status === 200, `HTTP 200 за ${r.ms} мс`, `статус ${r.status}`)
  const p = normPlan(r.data)
  const sum = p.stages.reduce((a, s) => a + s.minutes, 0)
  check(!!p.title, 'есть title', p.title.slice(0, 80))
  check(p.objectives.length >= 1, `цели: ${p.objectives.length}`)
  check(p.stages.length >= 3, `этапы: ${p.stages.length}`)
  check(Math.abs(sum - 45) <= 5, `сумма минут этапов ${sum} ≈ 45`)
  check(p.questions.length >= 2, `вопросы: ${p.questions.length}`)
  check(p.problems.every((x) => !!x.answer), `у задач есть ответы (${p.problems.length})`)
}

// 2) тест — три формата
for (const [format, n] of [['sor', 8], ['soch', 15], ['quiz', 6]] as const) {
  console.log(`\n2) /teacher/test ${format}, n=${n}`)
  const r = await post('test', buildBody('test', { units: UNITS, lang: LANG, n, format }))
  save(`test-${format}.json`, r.data)
  check(r.status === 200, `HTTP 200 за ${r.ms} мс`, `статус ${r.status}`)
  const t = normTest(r.data)
  const sum = t.items.reduce((a, it) => a + it.points, 0)
  check(Math.abs(t.items.length - n) <= 2, `заданий ${t.items.length} ≈ ${n}`)
  check(t.items.every((it) => !!it.answer), 'у каждого задания есть ответ (ключ)')
  check(t.items.every((it) => !it.options || it.options.length >= 2), 'варианты ответа — не меньше двух')
  check(Math.abs(sum - t.totalPoints) < 0.01, `баллы ${sum} = totalPoints ${t.totalPoints}`)
  check(t.scale.length >= 3, `шкала: ${t.scale.map((s) => `${s.mark}:${s.from}–${s.to}`).join(' ')}`)
}

// 3) проверка по фото — только с --photo
if (args.photo) {
  console.log('\n3) /teacher/grade')
  const img = fs.readFileSync(path.resolve(args.photo)).toString('base64')
  const rubric = [
    { name: 'Уравнение реакции', max: 2 },
    { name: 'Расчёт', max: 2 },
    { name: 'Оформление', max: 1 },
  ]
  const r = await post('grade', buildBody('grade', { lang: LANG, unit: UNIT, rubric, images: [img] }))
  save('grade.json', r.data)
  check(r.status === 200, `HTTP 200 за ${r.ms} мс`, `статус ${r.status}`)
  const g = normGrade(r.data)
  check(g.criteria.length === rubric.length, `критериев ${g.criteria.length} = рубрика ${rubric.length}`)
  check(g.criteria.every((c) => c.points <= c.max), 'баллы не выше максимума')
  check(g.total <= g.max && g.max === 5, `итог ${g.total} из ${g.max}`)
} else console.log('\n3) /teacher/grade — пропуск (нет --photo=снимок.jpg)')

// 4) без ключа — отказ
{
  console.log('\n4) без ключа')
  const r = await post('plan', buildBody('plan', { unit: UNIT, lang: LANG, minutes: 45 }), false)
  check(r.status === 401 || r.status === 403, `ученик без ключа получает отказ`, `статус ${r.status}`)
}

console.log(`\n${failed ? `✗ провалов: ${failed}` : '✓ все проверки пройдены'}; ответы — ${OUT}`)
process.exit(failed ? 1 : 0)
