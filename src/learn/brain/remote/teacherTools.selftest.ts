/**
 * Самопроверка инструментов учителя (сайт): контракт запросов, разбор ответов, ошибки, демо, экспорт.
 * Запуск: npx tsx src/learn/brain/remote/teacherTools.selftest.ts
 */
import { inflateRawSync } from 'node:zlib'
import {
  buildBody,
  callTeacherTool,
  defaultScale,
  isUnitId,
  normGrade,
  normPlan,
  normTest,
  TeacherToolError,
  type TeacherToolErrorCode,
} from './teacherTools'
import { mockTeacherTool } from './teacherToolsMock'
import { absoluteHref, escapeHtml, planHtml, sorLadder, testCsv, testHtml, testXlsx, wordDocument, gradeHtml } from './teacherToolsExport'
import { crc32, colName, sheetName } from './xlsxLite'
import { exportLabels } from '../../../components/learn/teacher/teacherToolsI18n'
import units from './teacherUnits.json'

let pass = 0
let fail = 0
function ok(cond: unknown, name: string): void {
  if (cond) pass++
  else {
    fail++
    console.error(`  ✗ ${name}`)
  }
}

async function throwsCode(p: () => Promise<unknown> | unknown, code: TeacherToolErrorCode, name: string): Promise<void> {
  try {
    await p()
    ok(false, `${name}: не бросил`)
  } catch (e) {
    ok(e instanceof TeacherToolError && e.code === code, `${name}: код ${(e as TeacherToolError).code} ≠ ${code}`)
  }
}

/** Мини-распаковщик ZIP (STORE/DEFLATE) для проверки .xlsx. */
function unzip(buf: Uint8Array): Map<string, string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out = new Map<string, string>()
  let p = 0
  const dec = new TextDecoder()
  while (p + 30 <= buf.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true)
    const crc = dv.getUint32(p + 14, true)
    const size = dv.getUint32(p + 18, true)
    const nameLen = dv.getUint16(p + 26, true)
    const extra = dv.getUint16(p + 28, true)
    const name = dec.decode(buf.subarray(p + 30, p + 30 + nameLen))
    const start = p + 30 + nameLen + extra
    const raw = buf.subarray(start, start + size)
    const data = method === 0 ? raw : new Uint8Array(inflateRawSync(raw))
    ok(crc32(data) === crc, `zip crc ${name}`)
    out.set(name, dec.decode(data))
    p = start + size
  }
  return out
}

async function main(): Promise<void> {
  // ---------- единицы программы
  const list = (units as { units: { id: string; g: number; t: { ru: string; uz: string; en: string } }[] }).units
  ok(list.length === 247, `247 единиц (есть ${list.length})`)
  ok(list.every((u) => isUnitId(u.id)), 'все id в формате gN:K')
  ok(new Set(list.map((u) => u.id)).size === list.length, 'id без повторов')
  ok(list.every((u) => u.t.ru && u.t.uz && u.t.en), 'названия на трёх языках')
  for (const g of [7, 8, 9, 10, 11]) ok(list.some((u) => u.g === g), `есть ${g} класс`)

  // ---------- сборка запроса
  ok(isUnitId('g8:12') && isUnitId('g10:3.15') && !isUnitId('g6:1') && !isUnitId('8:12') && !isUnitId('g8:12;drop'), 'isUnitId')
  const pb = buildBody('plan', { unit: 'g8:12', lang: 'uz', minutes: 500 })
  ok(pb.unit === 'g8:12' && pb.lang === 'uz' && pb.minutes === 90, 'plan: unit/lang/minutes ≤ 90')
  ok(buildBody('plan', { unit: 'g8:12', lang: 'xx' as 'ru', minutes: NaN }).minutes === 45 && buildBody('plan', { unit: 'g8:12', lang: 'xx' as 'ru', minutes: 45 }).lang === 'ru', 'plan: умолчания')
  await throwsCode(() => buildBody('plan', { unit: 'abc', lang: 'ru', minutes: 45 }), 'bad_request', 'plan: плохой unit')
  const tb = buildBody('test', { units: ['g8:1', 'g8:1', 'bad', ...Array.from({ length: 20 }, (_, i) => `g9:${i + 1}`)], lang: 'en', n: 1, format: 'soch' })
  ok(Array.isArray(tb.units) && (tb.units as string[]).length === 12 && (tb.units as string[])[0] === 'g8:1' && !(tb.units as string[]).includes('bad'), 'test: units уникальны, ≤ 12')
  ok(tb.n === 3 && tb.format === 'soch' && tb.lang === 'en', 'test: n ≥ 3, format')
  ok(buildBody('test', { units: ['g8:1'], lang: 'ru', n: NaN, format: 'zzz' as 'sor' }).format === 'sor', 'test: неизвестный format → sor')
  await throwsCode(() => buildBody('test', { units: [], lang: 'ru', n: 5, format: 'sor' }), 'bad_request', 'test: без единиц')
  const gb = buildBody('grade', { lang: 'ru', rubric: [{ name: ' Уравнение ', max: 2 }, { name: '', max: 3 }], images: ['data:image/jpeg;base64,AAAA', 'BBBB', 'C', 'D', 'E'] })
  ok((gb.images as string[]).length === 4 && (gb.images as string[])[0] === 'AAAA', 'grade: ≤ 4 фото, без data:')
  ok((gb.rubric as { name: string }[]).length === 1 && (gb.rubric as { name: string }[])[0]!.name === 'Уравнение' && !('unit' in gb), 'grade: пустые критерии отброшены, unit необязателен')
  await throwsCode(() => buildBody('grade', { lang: 'ru', rubric: [{ name: 'x', max: 1 }], images: [] }), 'bad_request', 'grade: без фото')

  // ---------- разбор ответов (поля строго по контракту + терпимость)
  const plan = normPlan({
    ok: true,
    plan: {
      title: 'План',
      objectives: ['a', '', 7],
      stages: [{ name: 'Этап', minutes: 10, activities: ['x', { text: 'y' }] }, { title: 'Второй', min: '5' }, 'Третий', { minutes: 3 }],
      questions: ['q1', { q: 'q2' }],
      problems: [{ text: 'p', solution: 's', answer: '36 г' }, 'голая задача', {}],
      links: ['#/vr-lab', { title: 'Каталог', url: '#/catalog' }, { name: 'n', route: '/periodic' }],
    },
  })
  ok(plan.title === 'План' && plan.objectives.join() === 'a,7', 'plan: objectives')
  ok(plan.stages.length === 3 && plan.stages[0]!.activities.join() === 'x,y' && plan.stages[1]!.minutes === 5 && plan.stages[2]!.name === 'Третий', 'plan: stages')
  ok(plan.questions.join() === 'q1,q2', 'plan: questions')
  ok(plan.problems.length === 2 && plan.problems[0]!.answer === '36 г', 'plan: problems')
  ok(plan.links.length === 3 && plan.links[0]!.href === '#/vr-lab' && plan.links[1]!.href === '#/catalog' && plan.links[2]!.href === '/periodic', 'plan: links')
  ok(normPlan({ title: 'T', objectives: ['o'], stages: [], questions: [], problems: [], links: [] }).objectives[0] === 'o', 'plan: без обёртки')

  const test = normTest({
    test: {
      title: 'СОР',
      items: [
        { type: 'single', q: 'Q1', options: ['a', 'b'], answer: 'A', points: 1, unit: 'g8:1' },
        { q: 'Q2', answer: ['x', 'y'], points: '2', unit: 'g8:2' },
        { q: '' },
      ],
      totalPoints: 3,
      scale: { '5': [3, 3], '4': [2, 2], '3': [1, 1], '2': [0, 0] },
    },
  })
  ok(test.items.length === 2 && test.items[0]!.options?.length === 2 && test.items[1]!.type === 'open' && test.items[1]!.answer === 'x; y' && test.items[1]!.points === 2, 'test: items')
  ok(test.totalPoints === 3 && test.scale.length === 4 && test.scale[0]!.mark === '5' && test.scale[3]!.to === 0, 'test: totalPoints + scale-объект')
  const t2 = normTest({ items: [{ q: 'a', answer: 'b', points: 4 }], scale: [{ grade: 5, min: 4, max: 4 }] })
  ok(t2.scale[0]!.mark === '5' && t2.scale[0]!.from === 4 && t2.totalPoints === 4, 'test: scale-массив, totalPoints из суммы')
  const t3 = normTest({ items: [{ q: 'a', answer: 'b', points: 10 }], scale: { '5': 9, '4': 7, '3': 5, '2': 0 } })
  ok(t3.scale.map((r) => `${r.mark}:${r.from}-${r.to}`).join(' ') === '5:9-9 4:7-8 3:5-6 2:0-4', `test: scale — только нижние границы (${t3.scale.map((r) => `${r.mark}:${r.from}-${r.to}`).join(' ')})`)
  const ds = defaultScale(20)
  ok(ds[0]!.from === 18 && ds[0]!.to === 20 && ds[3]!.from === 0 && ds.every((r, i) => i === 0 || r.to === ds[i - 1]!.from - 1), 'defaultScale: 86/71/56 % без дыр')
  ok(normTest({ items: [{ q: 'a', answer: 'b', points: 2 }] }).scale.length > 0, 'test: без шкалы → школьная по умолчанию')

  const grade = normGrade({ grade: { criteria: [{ name: 'A', max: 2, points: 5, comment: 'c' }, { name: 'B', max: 3, points: -1 }, { max: 1 }], note: 'n' } })
  ok(grade.criteria.length === 2 && grade.criteria[0]!.points === 2 && grade.criteria[1]!.points === 0, 'grade: points в пределах 0..max')
  ok(grade.total === 2 && grade.max === 5 && grade.note === 'n', 'grade: total/max из критериев')

  // ---------- вызов: заголовки, ключи, ошибки
  const calls: { url: string; init: RequestInit }[] = []
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} })
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
    }) as typeof fetch
  const r1 = await callTeacherTool('plan', { unit: 'g8:12', lang: 'ru', minutes: 40 }, { baseUrl: 'http://brain.test', fetchImpl: reply(200, { plan: { title: 'P', objectives: ['o'], stages: [{ name: 's', minutes: 40, activities: [] }] } }) })
  ok(r1.title === 'P' && calls[0]!.url === 'http://brain.test/teacher/plan', 'call: адрес /teacher/plan')
  const sent = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
  ok(sent.unit === 'g8:12' && sent.minutes === 40 && sent.lang === 'ru', 'call: тело по контракту')
  ok((calls[0]!.init.headers as Record<string, string>)['X-Brain-Session'] !== undefined, 'call: X-Brain-Session')
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(403, { error: 'forbidden' }) }), 'forbidden', '403')
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(404, { error: 'not found' }) }), 'disabled', '404 → старый сервер')
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(404, { code: 'not_found' }) }), 'not_found', '404 с кодом not_found')
  try {
    await callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(429, { error: 'rate' }, { 'Retry-After': '12' }) })
    ok(false, '429 не бросил')
  } catch (e) {
    ok(e instanceof TeacherToolError && e.code === 'rate' && e.retryAfterSec === 12, '429 → rate + Retry-After')
  }
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(503, {}) }), 'busy', '503 → busy')
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(200, { test: { items: [] } }) }), 'internal', 'пустой тест → internal')
  await throwsCode(() => callTeacherTool('test', { units: ['g8:1'], lang: 'ru', n: 5, format: 'sor' }, { baseUrl: 'http://b', fetchImpl: reply(200, { ok: false, error: 'busy' }) }), 'busy', 'ok:false с кодом')
  const netFail = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
  await throwsCode(() => callTeacherTool('plan', { unit: 'g8:1', lang: 'ru', minutes: 45 }, { baseUrl: 'http://b', fetchImpl: netFail }), 'network', 'обрыв сети')
  const ac = new AbortController()
  ac.abort()
  await throwsCode(() => callTeacherTool('plan', { unit: 'g8:1', lang: 'ru', minutes: 45 }, { baseUrl: 'http://b', fetchImpl: netFail, signal: ac.signal }), 'aborted', 'отмена')

  // ---------- демо: 30 единиц × 3 языка — непустые ответы по контракту
  const title = (id: string) => list.find((u) => u.id === id)?.t.ru ?? id
  const sample = list.filter((_, i) => i % 8 === 0).slice(0, 30)
  let demoOk = 0
  for (const u of sample) {
    for (const lang of ['ru', 'uz', 'en'] as const) {
      const p = await mockTeacherTool('plan', { unit: u.id, lang, minutes: 45 }, title, 0)
      const t = await mockTeacherTool('test', { units: [u.id], lang, n: 8, format: 'sor' }, title, 0)
      const stagesSum = p.stages.reduce((a, s) => a + s.minutes, 0)
      if (p.stages.length === 5 && stagesSum === 45 && p.problems.length === 2 && t.items.length === 8 && t.totalPoints === t.items.reduce((a, x) => a + x.points, 0) && t.items.every((x) => x.unit === u.id))
        demoOk++
    }
  }
  ok(demoOk === sample.length * 3, `демо: ${demoOk}/${sample.length * 3} планов и тестов`)
  const g = await mockTeacherTool('grade', { lang: 'uz', rubric: [{ name: 'A', max: 2 }, { name: 'B', max: 3 }], images: ['AAAA'] }, title, 0)
  ok(g.criteria.length === 2 && g.total <= g.max && g.max === 5, 'демо: проверка')

  // ---------- экспорт
  const L = exportLabels('ru')
  const evil = normTest({ items: [{ type: 'single', q: '<script>alert(1)</script> & "x"', options: ['<b>', 'ok'], answer: 'A', points: 2, unit: 'g8:1' }, { q: 'Q;2\n"кавычки"', answer: 'b', points: 1.5, unit: 'g8:2' }] })
  const html = testHtml(evil, L, true)
  ok(!html.includes('<script>') && html.includes('&lt;script&gt;') && html.includes('&lt;b&gt;'), 'html: экранирование')
  ok(html.includes(L.keys) && !testHtml(evil, L, false).includes(L.keys), 'html: ключи только с withKeys')
  ok(escapeHtml(`'"<>&`) === '&#39;&quot;&lt;&gt;&amp;', 'escapeHtml')
  ok(sorLadder(evil) === '2; 1.5', 'разбаловка для СОР/СОЧ')
  const doc = wordDocument('T', planHtml(plan, L, 'https://site/'), L)
  ok(doc.charCodeAt(0) === 0xfeff && doc.includes('urn:schemas-microsoft-com:office:word') && doc.includes('href="https://site/#/vr-lab"'), 'word: BOM, Office-namespace, абсолютные ссылки')
  ok(absoluteHref('javascript:alert(1)', 'https://s/') === null && absoluteHref('/periodic', 'https://s/') === 'https://s/#/periodic', 'ссылки: только сайт и http(s)')
  ok(gradeHtml(grade, L, 'Проверка').includes(L.recommendation), 'grade: пометка «рекомендация»')
  const csv = testCsv(evil, L)
  ok(csv.charCodeAt(0) === 0xfeff && csv.includes('"Q;2\n""кавычки"""') && csv.split('\r\n')[0]!.split(';').length === 7, 'csv: BOM, «;», кавычки')

  const files = unzip(testXlsx(evil, L, 5))
  ok(files.has('[Content_Types].xml') && files.has('xl/workbook.xml') && files.has('xl/worksheets/sheet3.xml'), 'xlsx: части книги')
  const s1 = files.get('xl/worksheets/sheet1.xml') ?? ''
  ok(s1.includes('&lt;script&gt;') && !s1.includes('<script>'), 'xlsx: экранирование')
  const wb = files.get('xl/workbook.xml') ?? ''
  ok(wb.includes(`name="${L.sheetTest}"`) && wb.includes('fullCalcOnLoad="1"'), 'xlsx: листы, пересчёт формул')
  const s3 = files.get('xl/worksheets/sheet3.xml') ?? ''
  ok(s3.includes('<f>SUM(C2:D2)</f>') && s3.includes('SUM(C3:D3)') && s3.includes('E3/E$2*100') && (s3.match(/<row /g) ?? []).length === 7, 'xlsx: журнал с формулами (5 учеников)')
  ok(colName(0) === 'A' && colName(25) === 'Z' && colName(26) === 'AA' && colName(701) === 'ZZ', 'colName')
  ok(sheetName('a/b:c*?[x]', 0) === 'a b c   x' && sheetName('', 2) === 'Sheet3', 'sheetName')
  const uzL = exportLabels('uz')
  ok(uzL.sheetJournal === 'Jurnal' && exportLabels('en').recommendation.startsWith('AI recommendation'), 'подписи на языке результата')

  console.log(`teacherTools selftest: ${pass} ok, ${fail} fail`)
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
