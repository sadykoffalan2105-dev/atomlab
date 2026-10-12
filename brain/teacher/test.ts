/**
 * POST /teacher/test — тест по единицам карты в формате СОР / СОЧ / мини-теста, детерминированно и без LLM:
 *   вопросы с выбором ответа — банк тестов карты (на языке запроса, варианты перемешаны по сиду);
 *   «уравняйте» — уравнения карты (ответ проверен balanceEquation);
 *   расчётные задачи — шаблоны brain/teacher/problems.ts, решение и числа — только калькулятор;
 *   определения — текст учебника (только ru: учебники русские).
 * Ключ с ответами и разбаловка по критериям: краткая запись «1; 1; 1+1; 1+1+1+1» и дерево {tasks:[{title,max,parts}]}
 * совместимы с проектом «Отчёты СОР/СОЧ» (parseStructure). Шкала оценки — config.teacher.scale.
 */
import type { Unit } from '../curriculum/types.ts'
import type { Knowledge } from '../kb/shards.ts'
import type { Lang } from '../pipeline/normalize.ts'
import type { TeacherConfig } from './config.ts'
import { curriculum, L3, testOf, unitDefinitions, unitEquations, unitTitle } from './content.ts'
import { generateProblem, problemTypesFor, rng, seedOf, type Rng } from './problems.ts'

export type TestFormat = 'sor' | 'soch' | 'quiz'
export type TestItem = {
  n: number
  kind: 'choice' | 'equation' | 'calc' | 'definition'
  unit: string
  cite: string
  q: string
  choices?: string[]
  /** ответ для ключа: буква и текст варианта / уравнение / ответ калькулятора / определение учебника */
  answer: string
  solution?: string
  points: number
  criteria: { label: string; points: number }[]
}
export type TestPaper = {
  format: TestFormat
  lang: Lang
  title: string
  units: { id: string; label: string; title: string }[]
  items: TestItem[]
  totalPoints: number
  /** краткая запись разбаловки для «Отчётов СОР/СОЧ»: задания через «;», критерии через «+» */
  razbalovka: string
  structure: { tasks: { title: string; max: number; parts: { label: string; max: number }[] }[] }
  scale: { mark: 5 | 4 | 3 | 2; minPoints: number; maxPoints: number; minPct: number }[]
  instructions: string
  note: string
}

const LETTERS: Record<Lang, string[]> = { ru: ['А', 'Б', 'В', 'Г', 'Д', 'Е'], uz: ['A', 'B', 'C', 'D', 'E', 'F'], en: ['A', 'B', 'C', 'D', 'E', 'F'] }
const DEFAULT_N: Record<TestFormat, number> = { quiz: 10, sor: 8, soch: 15 }

function shuffle<T>(xs: T[], r: Rng): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** «2Al + 3O₂ → 2Al₂O₃» → «Al + O₂ → Al₂O₃» (коэффициенты убраны — задание «уравняйте»). */
export function stripCoefficients(eq: string): string {
  return eq
    .split(/(\s*(?:→|=|⇄|⇌|->)\s*)/)
    .map((side, i) => (i % 2 ? side : side.split(/(\s\+\s)/).map((s, k) => (k % 2 ? s : s.replace(/^(\s*)\d+\s*/, '$1'))).join('')))
    .join('')
}

const C = {
  choice: (l: Lang) => [{ label: L3(l, 'верный ответ', 'toʻgʻri javob', 'correct answer'), points: 1 }],
  equation: (l: Lang) => [
    { label: L3(l, 'формулы веществ', 'moddalar formulalari', 'formulas'), points: 1 },
    { label: L3(l, 'коэффициенты', 'koeffitsiyentlar', 'coefficients'), points: 1 },
  ],
  definition: (l: Lang) => [
    { label: L3(l, 'ключевые слова', 'kalit soʻzlar', 'key words'), points: 1 },
    { label: L3(l, 'полнота определения', 'taʼrif toʻliqligi', 'completeness'), points: 1 },
  ],
  calc: (l: Lang, full: boolean) =>
    full
      ? [
          { label: L3(l, 'дано и найти', 'berilgan va topish kerak', 'given and find'), points: 1 },
          { label: L3(l, 'уравнение или формула', 'tenglama yoki formula', 'equation or formula'), points: 1 },
          { label: L3(l, 'расчёт', 'hisoblash', 'calculation'), points: 1 },
          { label: L3(l, 'ответ с единицами', 'birlik bilan javob', 'answer with units'), points: 1 },
        ]
      : [
          { label: L3(l, 'ход решения', 'yechim', 'method'), points: 1 },
          { label: L3(l, 'расчёт', 'hisoblash', 'calculation'), points: 1 },
          { label: L3(l, 'ответ с единицами', 'birlik bilan javob', 'answer with units'), points: 1 },
        ],
}

/** Сколько заданий каждого вида: [выбор, уравнение, определение, задача]. */
function mix(format: TestFormat, n: number): [number, number, number, number] {
  if (format === 'quiz') {
    const calc = Math.max(1, Math.round(n * 0.2))
    const eq = Math.round(n * 0.1)
    return [n - calc - eq, eq, 0, calc]
  }
  if (format === 'sor') {
    const calc = n >= 6 ? 2 : 1
    const eq = n >= 4 ? 1 : 0
    const def = n >= 8 ? 1 : 0
    return [Math.max(0, n - calc - eq - def), eq, def, calc]
  }
  const calc = n >= 12 ? 3 : 2
  const eq = n >= 10 ? 2 : 1
  const def = n >= 12 ? 2 : 1
  return [Math.max(0, n - calc - eq - def), eq, def, calc]
}

export function scaleFor(total: number, s: TeacherConfig['scale']): TestPaper['scale'] {
  const at = (pct: number) => Math.ceil((total * pct) / 100 - 1e-9)
  const p5 = at(s.five)
  const p4 = Math.min(at(s.four), p5)
  const p3 = Math.min(at(s.three), p4)
  return [
    { mark: 5, minPoints: p5, maxPoints: total, minPct: s.five },
    { mark: 4, minPoints: p4, maxPoints: Math.max(p4, p5 - 1), minPct: s.four },
    { mark: 3, minPoints: p3, maxPoints: Math.max(p3, p4 - 1), minPct: s.three },
    { mark: 2, minPoints: 0, maxPoints: Math.max(0, p3 - 1), minPct: 0 },
  ]
}

export function buildTest(unitIds: string[], lang: Lang, nIn: number | undefined, format: TestFormat, kb: Knowledge, scale: TeacherConfig['scale'], variant = 1): TestPaper | null {
  const map = curriculum()
  if (!map) return null
  const units = [...new Set(unitIds)].map((id) => map.byId.get(id)).filter((u): u is Unit => !!u)
  if (!units.length) return null
  return testFor(units, lang, nIn, format, kb, scale, variant)
}

export function testFor(units: Unit[], lang: Lang, nIn: number | undefined, format: TestFormat, kb: Knowledge, scale: TeacherConfig['scale'], variant = 1): TestPaper {
  const n = Math.max(3, Math.min(40, Math.round(nIn || DEFAULT_N[format])))
  const r = rng(seedOf(`${units.map((u) => u.id).join(',')}|${lang}|${format}|${n}|${variant}`))
  let [nChoice, nEq, nDef, nCalc] = mix(format, n)
  if (lang !== 'ru') {
    // определения учебника — только по-русски: на uz/en вместо них уравнения
    nEq += nDef
    nDef = 0
  }
  // пулы по единицам (по кругу — чтобы все единицы попали в тест)
  const choicePool = units.map((u) => shuffle(u.tests.map((t) => testOf(t, lang)).filter((x): x is NonNullable<typeof x> => !!x), r).map((x) => ({ u, x })))
  const eqPool = units.map((u) => shuffle(unitEquations(u, 8).filter((e) => stripCoefficients(e.eq) !== e.eq), r).map((e) => ({ u, e })))
  const defPool = units.map((u) => shuffle(unitDefinitions(u, 6), r).map((d) => ({ u, d })))
  const roundRobin = <T,>(pools: T[][], k: number): T[] => {
    const out: T[] = []
    const idx = pools.map(() => 0)
    for (let guard = 0; out.length < k && guard < k * pools.length + pools.length; guard++) {
      const p = guard % pools.length
      const item = pools[p]![idx[p]!]
      if (item !== undefined) {
        out.push(item)
        idx[p]!++
      }
      if (pools.every((pl, i) => idx[i]! >= pl.length)) break
    }
    return out
  }
  const choices = roundRobin(choicePool, nChoice)
  const eqs = roundRobin(eqPool, nEq)
  const defs = roundRobin(defPool, nDef)
  // не хватило тестов карты / уравнений / определений — добираем задачами калькулятора
  nCalc += nChoice - choices.length + (nEq - eqs.length) + (nDef - defs.length)
  const calcs: { u: Unit; p: NonNullable<ReturnType<typeof generateProblem>> }[] = []
  const typeLists = units.map((u) => problemTypesFor(u))
  for (let i = 0; calcs.length < nCalc && i < nCalc * 4 + 8; i++) {
    const ui = i % units.length
    const types = typeLists[ui]!
    const type = types[Math.floor(i / units.length) % types.length]!
    const p = generateProblem(type, lang, kb, r)
    if (p && !calcs.some((c) => c.p.statement === p.statement)) calcs.push({ u: units[ui]!, p })
  }

  const items: TestItem[] = []
  const letters = LETTERS[lang]
  for (const { u, x } of choices) {
    const order = shuffle(
      x.choices.map((c, i) => ({ c, ok: i === x.correct })),
      r,
    )
    const k = order.findIndex((o) => o.ok)
    items.push({ n: 0, kind: 'choice', unit: u.id, cite: u.cite, q: x.q, choices: order.map((o) => o.c), answer: `${letters[k]}) ${x.answer}`, points: 1, criteria: C.choice(lang) })
  }
  for (const { u, e } of eqs) {
    const crit = format === 'quiz' ? C.choice(lang) : C.equation(lang)
    items.push({
      n: 0,
      kind: 'equation',
      unit: u.id,
      cite: u.cite,
      q: L3(lang, `Расставьте коэффициенты: ${stripCoefficients(e.eq)}`, `Koeffitsiyentlarni qoʻying: ${stripCoefficients(e.eq)}`, `Balance the equation: ${stripCoefficients(e.eq)}`),
      answer: e.eq,
      points: crit.reduce((a, c) => a + c.points, 0),
      criteria: crit,
    })
  }
  for (const { u, d } of defs) {
    items.push({ n: 0, kind: 'definition', unit: u.id, cite: u.cite, q: `Дайте определение: «${d.term.toLowerCase()}».`, answer: `${d.text} (${u.label.ru}${d.page ? `, стр. ${d.page}` : ''})`, points: 2, criteria: C.definition(lang) })
  }
  for (const { u, p } of calcs) {
    const crit = format === 'quiz' ? C.choice(lang) : C.calc(lang, format === 'soch')
    items.push({ n: 0, kind: 'calc', unit: u.id, cite: u.cite, q: p.statement, answer: p.answerLine, solution: p.solution, points: crit.reduce((a, c) => a + c.points, 0), criteria: crit })
  }
  items.forEach((it, i) => (it.n = i + 1))
  const totalPoints = items.reduce((a, it) => a + it.points, 0)
  const task = (it: TestItem) => L3(lang, `Задание ${it.n}`, `${it.n}-topshiriq`, `Task ${it.n}`)
  const structure = { tasks: items.map((it) => ({ title: task(it), max: it.points, parts: it.criteria.length > 1 ? it.criteria.map((c) => ({ label: c.label, max: c.points })) : [] })) }
  const razbalovka = items.map((it) => (it.criteria.length > 1 ? it.criteria.map((c) => c.points).join('+') : String(it.points))).join('; ')
  const fmtName = L3(lang, { sor: 'СОР', soch: 'СОЧ', quiz: 'Мини-тест' }, { sor: 'BSB', soch: 'ChSB', quiz: 'Mini-test' }, { sor: 'Unit summative (SOR)', soch: 'Term summative (SOCH)', quiz: 'Quiz' })[format]
  const unitNames = units.map((u) => `${u.label[lang]}`).join('; ')
  return {
    format,
    lang,
    title: `${fmtName}: ${unitNames}`,
    units: units.map((u) => ({ id: u.id, label: u.label[lang], title: unitTitle(u, lang) })),
    items,
    totalPoints,
    razbalovka,
    structure,
    scale: scaleFor(totalPoints, scale),
    instructions: L3(
      lang,
      `Выполните все задания. Максимальный балл — ${totalPoints}. В задачах запишите «Дано», решение и ответ с единицами.`,
      `Barcha topshiriqlarni bajaring. Eng yuqori ball — ${totalPoints}. Masalalarda «Berilgan», yechim va birlik bilan javobni yozing.`,
      `Complete all tasks. Maximum score: ${totalPoints}. In problems write “Given”, the solution and the answer with units.`,
    ),
    note: L3(lang, 'Тест и разбаловка — рекомендация ИИ-помощника; учитель проверяет и утверждает.', 'Test va ballar taqsimoti — sunʼiy intellekt yordamchisining tavsiyasi; oʻqituvchi tekshiradi va tasdiqlaydi.', 'The test and scoring are a recommendation of the AI assistant; the teacher reviews and approves them.'),
  }
}
