/**
 * npm run brain:teacher-selftest — автоматизация учителя v1 (brain/teacher/**) без Ollama:
 *   1) все 247 единиц карты × ru/uz: план урока и тест СОР — каждый ≤ 2 с без LLM; этапы в сумме = minutes;
 *      2–3 задачи; все уравнения уравнены (balanceEquation); числа задач = калькулятору (повторный расчёт);
 *      язык текста = запрошенному; нет R3-фраз, CJK и пересказа плана; разбаловка сходится с суммой баллов;
 *   2) en на 30 единицах; форматы quiz/soch на наборах единиц; варианты теста различаются;
 *   3) проверка работ: разбор разбаловки (строка и ответ /teacher/test), модель без зрения → manual,
 *      подменная модель со зрением → баллы в пределах максимума, пометка «рекомендация, подтверждает учитель»;
 *   4) шлифовка LLM: строка с R3 / потерянным числом отвергается, нормальная — принимается;
 *   5) HTTP через createServer (временная папка данных): ключ учителя/админа, 403/400/404/405, лимит 429 на ключ.
 * Код выхода 1, если хоть одна проверка не прошла.
 */
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.BRAIN_TEACHER_SELFTEST_PORT || 8793)
process.env.BRAIN_DATA_DIR = path.join(os.tmpdir(), `atomlab-brain-teacher-selftest-${process.pid}`)
delete process.env.BRAIN_PROFILE
delete process.env.BRAIN_ADMIN_TOKEN
process.env.BRAIN_NO_WARM = '1'

const { DEFAULT_CONFIG, applyProfile } = await import('../../brain/config.ts')
const { sharedCurriculum } = await import('../../brain/curriculum/map.ts')
const { solveSchoolTask } = await import('../../brain/calc/index.ts')
const { valueNum } = await import('../../brain/calc/format.ts')
const { cmpForm, matchesLang } = await import('../../brain/pipeline/normalize.ts')
const { CJK_RE, hasR3, isPlanLeak, splitSentences } = await import('../../brain/pipeline/postcheck.ts')
const { isBalanced } = await import('../../brain/teacher/content.ts')
const { planFor, splitMinutes } = await import('../../brain/teacher/plan.ts')
const { testFor, stripCoefficients } = await import('../../brain/teacher/test.ts')
const { gradeWork, parseRubric, parseGradeReply } = await import('../../brain/teacher/grade.ts')
const { polishPlan, polishedOk } = await import('../../brain/teacher/polish.ts')
const { DEFAULT_TEACHER_CONFIG } = await import('../../brain/teacher/config.ts')
const { lightKnowledge } = await import('./calcKb.mts')
type Lang = 'ru' | 'uz' | 'en'
type LlmClient = import('../../brain/llm/ollama.ts').LlmClient
type LlmStatus = import('../../brain/llm/ollama.ts').LlmStatus

let failed = 0
let passed = 0
const ok = (cond: boolean, what: string, extra = '') => {
  if (cond) passed++
  else failed++
  if (!cond || process.argv.includes('--verbose')) console.log(`${cond ? '  ✓' : '  ✗'} ${what}${extra ? ' — ' + extra : ''}`)
}

const map = sharedCurriculum()
if (!map) {
  console.error('нет карты программы (npm run brain:curriculum-map)')
  process.exit(1)
}
const kb = lightKnowledge()
const byId = (id: string) => map.byId.get(id) ?? null
const scale = DEFAULT_TEACHER_CONFIG.scale

/** Текст для проверки языка: без «цитат» на другом языке (русское название темы в узбекском плане — упоминание). */
const forLang = (xs: string[]) => xs.join(' \n').replace(/«[^«»]*»|“[^“”]*”/gu, ' ')
/** Притяжательное «Avogadro's» — не узбекский диграф oʻ/gʻ (эвристика детектора языка срабатывает на него в en). */
const langOk = (xs: string[], lang: Lang) => matchesLang(lang === 'en' ? forLang(xs).replace(/([og])['’]s\b/g, '$1s') : forLang(xs), lang)
/** Повторный расчёт калькулятором: те же ответы, что в задаче. */
function sameAsCalc(statement: string, answers: string[], lang: Lang): boolean {
  const sol = solveSchoolTask(statement, cmpForm(statement), lang, kb)
  if (!sol) return false
  const again = sol.answers.map((a) => valueNum(a, lang))
  return again.length === answers.length && again.every((a, i) => a === answers[i])
}
function badLines(texts: string[]): string[] {
  const out: string[] = []
  for (const t of texts) {
    if (hasR3(t)) out.push(`R3: ${t.slice(0, 80)}`)
    if (CJK_RE.test(t)) out.push(`CJK: ${t.slice(0, 80)}`)
    for (const s of splitSentences(t)) if (isPlanLeak(s)) out.push(`план: ${s.slice(0, 80)}`)
  }
  return out
}
/** «1; 2+2; (1+1)+1» → сумма баллов (как parseStructure «Отчётов СОР/СОЧ»). */
const razSum = (s: string) => s.split(/[;\n]/).flatMap((t) => t.replace(/[()]/g, ' ').split(/[+,\s/]+/).filter(Boolean)).reduce((a, x) => a + Number(x), 0)

// ——— 0) мелочи
console.log('0) минуты этапов, коэффициенты')
for (const total of [20, 30, 40, 45, 80, 90]) {
  const m = splitMinutes([2, 5, 14, 5, 10, 6, 3], total)
  ok(m.reduce((a, b) => a + b, 0) === total && m.every((x) => x >= 1), `splitMinutes(${total}) = ${m.join('+')}`)
}
ok(stripCoefficients('2Al + 3O₂ → 2Al₂O₃') === 'Al + O₂ → Al₂O₃', 'stripCoefficients: «2Al + 3O₂ → 2Al₂O₃» → «Al + O₂ → Al₂O₃»')
ok(isBalanced('2H₂ + O₂ → 2H₂O') && !isBalanced('H₂ + O₂ → H₂O') && isBalanced('C + O₂ → CO₂'), 'isBalanced: уравнено / нет / без коэффициентов')

// ——— 1) все единицы × ru/uz
console.log(`1) все ${map.units.length} единиц × ru/uz: план и тест СОР без LLM`)
const stats = { plans: 0, tests: 0, problems: 0, eqs: 0, calcItems: 0, slowest: 0, slowestId: '' }
const fails: string[] = []
const fail = (s: string) => {
  if (fails.length < 40) fails.push(s)
}
function checkUnit(id: string, lang: Lang) {
  const u = byId(id)!
  const t0 = performance.now()
  const plan = planFor(u, lang, 45, kb, byId, map!.taskTypes)
  const tPlan = performance.now() - t0
  const t1 = performance.now()
  const test = testFor([u], lang, undefined, 'sor', kb, scale)
  const tTest = performance.now() - t1
  for (const [ms, what] of [[tPlan, 'план'], [tTest, 'тест']] as const) {
    if (ms > stats.slowest) {
      stats.slowest = ms
      stats.slowestId = `${id} ${lang} ${what}`
    }
    if (ms > 2000) fail(`${id} ${lang}: ${what} ${Math.round(ms)} мс > 2 с`)
  }
  stats.plans++
  stats.tests++
  // план
  const sum = plan.stages.reduce((a, s) => a + s.minutes, 0)
  if (sum !== 45) fail(`${id} ${lang}: этапы ${sum} мин ≠ 45`)
  if (plan.problems.length < 2 || plan.problems.length > 3) fail(`${id} ${lang}: задач ${plan.problems.length}`)
  if (!plan.objectives.length || !plan.keyQuestions.length || !plan.links.length) fail(`${id} ${lang}: пустые цели/вопросы/ссылки`)
  for (const p of plan.problems) {
    stats.problems++
    if (!sameAsCalc(p.statement, p.answers, lang)) fail(`${id} ${lang}: числа задачи ≠ калькулятор: ${p.statement.slice(0, 60)}`)
    if (!p.answers.every((a) => p.solution.includes(a))) fail(`${id} ${lang}: ответа нет в решении`)
  }
  for (const e of plan.equations) {
    stats.eqs++
    if (!isBalanced(e.eq)) fail(`${id} ${lang}: не уравнено ${e.eq}`)
  }
  const planTexts = [...plan.objectives, ...plan.stages.flatMap((s) => [s.title, ...s.activities.filter((a) => !plan.problems.some((p) => a.includes(p.statement)))]), ...plan.keyQuestions.map((k) => k.q), ...plan.homework, plan.note]
  if (!langOk(planTexts, lang)) fail(`${id} ${lang}: язык плана: ${forLang(planTexts).slice(0, 120)}`)
  for (const p of plan.problems) if (!matchesLang(p.statement, lang)) fail(`${id} ${lang}: язык задачи: ${p.statement.slice(0, 80)}`)
  for (const b of badLines([JSON.stringify(plan), ...planTexts])) fail(`${id} ${lang}: ${b}`)
  // тест
  if (test.items.length !== 8) fail(`${id} ${lang}: заданий ${test.items.length} ≠ 8`)
  const total = test.items.reduce((a, it) => a + it.points, 0)
  if (total !== test.totalPoints || razSum(test.razbalovka) !== total || test.structure.tasks.reduce((a, t) => a + t.max, 0) !== total) fail(`${id} ${lang}: разбаловка не сходится (${test.razbalovka} ≠ ${total})`)
  if (test.scale[0]!.maxPoints !== total || test.scale[3]!.minPoints !== 0) fail(`${id} ${lang}: шкала`)
  for (const it of test.items) {
    if (it.kind === 'equation' && !isBalanced(it.answer)) fail(`${id} ${lang}: ключ не уравнен ${it.answer}`)
    if (it.kind === 'calc') {
      stats.calcItems++
      const sol = solveSchoolTask(it.q, cmpForm(it.q), lang, kb)
      if (!sol || !sol.answers.every((a) => it.answer.includes(valueNum(a, lang)))) fail(`${id} ${lang}: ключ задачи ≠ калькулятор: ${it.q.slice(0, 60)}`)
    }
    if (it.kind === 'choice' && (!it.choices || !it.choices.some((c) => it.answer.endsWith(c)))) fail(`${id} ${lang}: ключ выбора не из вариантов`)
  }
  const testTexts = [test.instructions, test.note, ...test.items.flatMap((it) => [it.q, ...(it.choices ?? [])])]
  if (!langOk(testTexts, lang)) fail(`${id} ${lang}: язык теста: ${forLang(testTexts).slice(0, 120)}`)
  for (const b of badLines([JSON.stringify(test), ...testTexts])) fail(`${id} ${lang}: ${b}`)
}
for (const u of map.units) for (const lang of ['ru', 'uz'] as const) checkUnit(u.id, lang)
ok(fails.length === 0, `планы ${stats.plans}, тесты ${stats.tests}; задач ${stats.problems}, уравнений ${stats.eqs}, расчётных заданий ${stats.calcItems}; самый долгий ${Math.round(stats.slowest)} мс (${stats.slowestId})`, fails.length ? `\n    ${fails.join('\n    ')}` : '')

// ——— 2) en, форматы, варианты
console.log('2) en на 30 единицах; quiz/soch; варианты')
fails.length = 0
const sample = map.units.filter((_, i) => i % Math.ceil(map.units.length / 30) === 0).slice(0, 30)
for (const u of sample) checkUnit(u.id, 'en')
ok(fails.length === 0, `en: ${sample.length} единиц`, fails.join('\n    '))
for (const g of [7, 8, 9, 10, 11]) {
  const units = (map.byGrade.get(g) ?? []).slice(3, 8)
  for (const lang of ['ru', 'uz'] as const) {
    for (const [format, n] of [['quiz', 12], ['soch', 15]] as const) {
      const t0 = performance.now()
      const t = testFor(units, lang, n, format, kb, scale)
      const ms = performance.now() - t0
      const unitsHit = new Set(t.items.map((it) => it.unit)).size
      ok(t.items.length === n && razSum(t.razbalovka) === t.totalPoints && ms < 2000 && unitsHit >= Math.min(units.length, 3), `${format} g${g} ${lang}: ${t.items.length} заданий, ${t.totalPoints} б., единиц ${unitsHit}, ${Math.round(ms)} мс`, t.razbalovka)
    }
  }
}
{
  const units = (map.byGrade.get(8) ?? []).slice(0, 6)
  const a = testFor(units, 'ru', 10, 'quiz', kb, scale, 1)
  const b = testFor(units, 'ru', 10, 'quiz', kb, scale, 2)
  const a2 = testFor(units, 'ru', 10, 'quiz', kb, scale, 1)
  ok(JSON.stringify(a) === JSON.stringify(a2), 'тест детерминирован (тот же вариант — тот же тест)')
  ok(JSON.stringify(a.items) !== JSON.stringify(b.items), 'вариант 2 отличается от варианта 1')
  const s = testFor(units, 'ru', 15, 'soch', kb, scale)
  ok(s.scale.map((x) => x.mark).join('') === '5432' && s.scale[0]!.minPoints === Math.ceil(s.totalPoints * 0.86), `шкала СОЧ: ${s.scale.map((x) => `«${x.mark}» ${x.minPoints}–${x.maxPoints}`).join(', ')}`)
}

// ——— 3) проверка работ
console.log('3) проверка работ (рекомендация)')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64').toString('base64')
const statusOf = (vision: boolean): LlmStatus => ({ available: true, chatModel: 'gemma4:12b', fastModel: 'gemma4:12b', embedModel: null, checkedAt: 0, vision })
/** Подменная модель: проверка работ — баллы = max (а 1.1 — 99, проверка обрезки); шлифовка — по сценарию. */
class FakeLlm implements LlmClient {
  calls = 0
  private vision: boolean
  private polishReply?: (user: string) => string
  constructor(vision: boolean, polishReply?: (user: string) => string) {
    this.vision = vision
    this.polishReply = polishReply
  }
  status() {
    return statusOf(this.vision)
  }
  async refresh() {
    return this.status()
  }
  async chatStream(): Promise<never> {
    throw new Error('не нужен')
  }
  async embed() {
    return null
  }
  async complete(o: { messages: { role: string; content: string; images?: string[] }[] }): Promise<string | null> {
    this.calls++
    const user = o.messages.find((m) => m.role === 'user')!
    if (/JSON/.test(o.messages[0]!.content)) {
      if (!user.images?.length) return 'нет фото'
      const scores = [...user.content.matchAll(/^(\d+)\.(\d+) max=([\d.]+)/gm)].map((m) => ({ task: Number(m[1]), criterion: Number(m[2]), points: m[1] === '1' && m[2] === '1' ? 99 : Number(m[3]) - 0.5, comment: 'видно решение' }))
      return `Вот оценка: ${JSON.stringify({ scores })}`
    }
    return this.polishReply ? this.polishReply(user.content) : null
  }
}
{
  const r1 = parseRubric('1; 2+2; (1+1)+1')
  ok(Array.isArray(r1) && r1.length === 6 && r1.reduce((a, c) => a + c.max, 0) === 8, 'разбаловка строкой «1; 2+2; (1+1)+1» → 6 критериев, 8 баллов')
  ok(typeof parseRubric('1; x') === 'string' && typeof parseRubric('') === 'string' && typeof parseRubric({ tasks: [] }) === 'string', 'кривая разбаловка → 400')
  const t = testFor([byId('g8:2')!], 'ru', 8, 'sor', kb, scale)
  const r2 = parseRubric({ items: t.items })
  ok(Array.isArray(r2) && r2.reduce((a, c) => a + c.max, 0) === t.totalPoints && r2.some((c) => !!c.answer), `ответ /teacher/test как разбаловка: ${Array.isArray(r2) ? r2.length : r2} критериев, ${t.totalPoints} б., с ключом`)
  const r3 = parseRubric(t.structure)
  ok(Array.isArray(r3) && r3.reduce((a, c) => a + c.max, 0) === t.totalPoints, 'structure /teacher/test как разбаловка')
  const cfg = DEFAULT_TEACHER_CONFIG
  const man = await gradeWork({ rubric: r2 as never, images: [PNG], lang: 'ru', llm: new FakeLlm(false), cfg })
  ok(man.mode === 'manual' && man.recommendation && man.scores.every((s) => s.points === null) && /подтверждает учитель/.test(man.notice), 'модель без зрения → manual, баллы пустые, «подтверждает учитель»')
  const none = await gradeWork({ rubric: r2 as never, images: [PNG], lang: 'uz', llm: null, cfg })
  ok(none.mode === 'manual' && /tasdiqlaydi/.test(none.notice), 'нет LLM → manual (uz: «oʻqituvchi tasdiqlaydi»)')
  const fake = new FakeLlm(true)
  const vis = await gradeWork({ rubric: r2 as never, images: [PNG], lang: 'ru', llm: fake, cfg })
  const first = vis.scores[0]!
  ok(vis.mode === 'vision' && first.points === first.max && vis.scores.every((s) => s.points != null && s.points >= 0 && s.points <= s.max), `модель со зрением: баллы в [0, max] (99 → ${first.points})`)
  ok(vis.totalRecommended != null && vis.markRecommended != null && vis.recommendation === true, `итог-рекомендация ${vis.totalRecommended}/${vis.totalMax}, оценка «${vis.markRecommended}»`)
  ok(parseGradeReply('нет json', r2 as never) === null && parseGradeReply('{"scores":[{"task":99,"points":1}]}', r2 as never) === null, 'ответ модели без баллов → null (manual)')
}

// ——— 4) шлифовка
console.log('4) шлифовка LLM (только формулировки)')
{
  ok(polishedOk('Уметь решать задачи на 22,4 л.', 'Научиться решать задачи с объёмом 22,4 л.', 'ru'), 'перефраз с тем же числом — принят')
  ok(!polishedOk('Уметь решать задачи на 22,4 л.', 'Научиться решать задачи с объёмом 22 л.', 'ru'), 'потеряно число — отвергнут')
  ok(!polishedOk('Знать: оксиды, кислоты.', 'Я не знаю, что такое оксиды.', 'ru'), 'R3-фраза — отвергнут')
  ok(!polishedOk('Bilish: oksidlar.', 'Знать: оксиды.', 'uz'), 'чужой язык — отвергнут')
  const plan = planFor(byId('g8:2')!, 'ru', 45, kb, byId, map.taskTypes)
  const fake = new FakeLlm(true, (user) =>
    user
      .split('\n')
      .map((l, i) => (i === 0 ? l.replace('Знать:', 'Ученики узнают:') : i === 1 ? `${l.split('.')[0]} — я не знаю.` : l))
      .join('\n'),
  )
  const p = await polishPlan(plan, fake, 1000)
  ok(p.polished === 1 && p.plan.objectives[0]!.startsWith('Ученики узнают:') && p.plan.objectives[1] === plan.objectives[1] && JSON.stringify(p.plan.problems) === JSON.stringify(plan.problems), `шлифовка: принята 1 строка, R3 отвергнута, задачи не тронуты`)
  const p0 = await polishPlan(plan, null, 1000)
  ok(p0.polished === 0 && p0.plan === plan, 'нет LLM — план без изменений')
}

// ——— 5) HTTP
console.log('5) HTTP /teacher/* через createServer')
{
  const { createServer } = await import('../../brain/server.ts')
  const { Journal } = await import('../../brain/kb/journal.ts')
  const { StudentStore } = await import('../../brain/student/events.ts')
  const TEACHER = 'teacher-key-0123456789abcdef'
  const ADMIN = 'admin-key-0123456789abcdef'
  const config = applyProfile({ ...structuredClone(DEFAULT_CONFIG), adminToken: ADMIN, teacher: { ...DEFAULT_TEACHER_CONFIG, tokens: [TEACHER], rate: { perMin: 7, perDay: 100, gradePerMin: 2, gradePerDay: 10 } } })
  const llm = new FakeLlm(true)
  const brain = { deps: { kb, journal: new Journal(), embeds: undefined, llm, students: new StudentStore(), config, noJournal: true }, startedAt: Date.now(), ollama: null } as unknown as Parameters<typeof createServer>[0]
  const server = createServer(brain)
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', () => r()))
  const call = (p: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
    new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const data = body === undefined ? '' : JSON.stringify(body)
      const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
        let s = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (s += c))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(s) })
          } catch {
            resolve({ status: res.statusCode ?? 0, body: { raw: s } })
          }
        })
      })
      req.on('error', reject)
      req.end(data)
    })
  try {
    const noKey = await call('/teacher/plan', { unit: 'g8:12', lang: 'ru' })
    ok(noKey.status === 403, `без ключа → 403 (${noKey.status})`)
    const badKey = await call('/teacher/plan', { unit: 'g8:12', lang: 'ru', teacherKey: 'wrong-key-0123456789abcdef' })
    ok(badKey.status === 403, `чужой ключ → 403 (${badKey.status})`)
    const okPlan = await call('/teacher/plan', { unit: 'g8:12', lang: 'uz', minutes: 40, teacherKey: TEACHER, polish: false })
    const plan = okPlan.body.plan as { unit: { id: string }; minutes: number; stages: { minutes: number }[] } | undefined
    ok(okPlan.status === 200 && plan?.unit.id === 'g8:12' && plan.minutes === 40 && plan.stages.reduce((a, s) => a + s.minutes, 0) === 40, `ключ учителя → план (${okPlan.status}, ${okPlan.body.ms} мс)`)
    const adm = await call('/teacher/plan', { unit: 'g9:3', lang: 'ru' }, { 'X-Brain-Admin': ADMIN })
    ok(adm.status === 200 && typeof adm.body.polished === 'number', `админ по X-Brain-Admin → план, шлифовка ${adm.body.polished}`)
    ok((await call('/teacher/plan', { unit: 'g8:99', lang: 'ru', teacherKey: TEACHER })).status === 404, 'неизвестная единица → 404')
    ok((await call('/teacher/plan', { unit: '../etc', lang: 'ru', teacherKey: TEACHER })).status === 400, 'кривой unit → 400')
    ok((await call('/teacher/plan', { unit: 'g8:12', lang: 'de', teacherKey: TEACHER })).status === 400, 'lang de → 400')
    ok((await call('/teacher/plan', undefined, {}, 'GET')).status === 405, 'GET → 405')
    const test = await call('/teacher/test', { units: ['g8:2', 'g8:3'], lang: 'ru', format: 'soch', n: 15, teacherKey: TEACHER })
    const tp = test.body.test as { items: unknown[]; totalPoints: number; razbalovka: string } | undefined
    ok(test.status === 200 && tp?.items.length === 15 && razSum(tp.razbalovka) === tp.totalPoints, `тест СОЧ → ${tp?.items.length} заданий, разбаловка «${tp?.razbalovka}»`)
    ok((await call('/teacher/test', { units: [], lang: 'ru', teacherKey: TEACHER })).status === 400, 'пустой units → 400')
    ok((await call('/teacher/test', { units: ['g8:2'], format: 'exam', teacherKey: TEACHER })).status === 400, 'format exam → 400')
    const lim = await call('/teacher/plan', { unit: 'g8:12', lang: 'ru', teacherKey: TEACHER })
    ok(lim.status === 429 && lim.body.rule === 'teacher_minute', `8-й запрос учителя за минуту (лимит 7) → 429 ${String(lim.body.rule)}`)
    const adm2 = await call('/teacher/plan', { unit: 'g8:12', lang: 'ru', polish: false }, { 'X-Brain-Admin': ADMIN })
    ok(adm2.status === 200, 'владелец лимитом учителя не ограничен')
    const g = await call('/teacher/grade', { rubric: '1; 2+2', images: [PNG], lang: 'ru', teacherKey: TEACHER })
    const gr = g.body.grade as { mode: string; recommendation: boolean; scores: { points: number | null; max: number }[]; notice: string } | undefined
    ok(g.status === 200 && gr?.mode === 'vision' && gr.recommendation === true && gr.scores.every((s) => s.points != null && s.points <= s.max) && /подтверждает учитель/.test(gr.notice), `проверка работы → рекомендация (${gr?.mode})`)
    ok((await call('/teacher/grade', { rubric: '1; 2', images: ['bm90IGFuIGltYWdl'], teacherKey: TEACHER })).status === 415, 'не картинка → 415')
    const g3 = await call('/teacher/grade', { rubric: '1; 2', images: [PNG], teacherKey: TEACHER })
    ok(g3.status === 429 && g3.body.rule === 'teacher_grade_minute', `3-я проверка за минуту → 429 ${String(g3.body.rule)}`)
  } finally {
    server.close()
  }
}

console.log(`\nитог: ${passed} ✓, ${failed} ✗`)
process.exit(failed ? 1 : 0)
