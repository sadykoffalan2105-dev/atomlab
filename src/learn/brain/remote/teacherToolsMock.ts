/**
 * Демо инструментов учителя без сервера (превью, сервер друга выключен): тот же контракт, что у /teacher/*.
 * Включается только явно: «?teacherMock=1» в адресе (до или после #) или localStorage atomlab.teacherTools.mock = 1.
 * В интерфейсе такой ответ помечен «Демо», чтобы учитель не принял пример за работу мозга.
 */
import {
  buildBody,
  defaultScale,
  normGrade,
  normPlan,
  normTest,
  type GradeRequest,
  type PlanRequest,
  type TeacherLang,
  type TeacherToolKind,
  type TeacherToolMap,
  type TestRequest,
} from './teacherTools'

const MOCK_KEY = 'atomlab.teacherTools.mock'

export function teacherMockEnabled(): boolean {
  try {
    if (typeof location !== 'undefined' && /[?&]teacherMock=1\b/.test(location.href)) return true
    return typeof localStorage !== 'undefined' && localStorage.getItem(MOCK_KEY) === '1'
  } catch {
    return false
  }
}

type L = Record<TeacherLang, string>
const T = {
  planTitle: { ru: 'План урока: {t}', uz: 'Dars rejasi: {t}', en: 'Lesson plan: {t}' },
  obj1: { ru: 'Знать ключевые понятия темы «{t}» и приводить примеры.', uz: '«{t}» mavzusining asosiy tushunchalarini bilish va misollar keltirish.', en: 'Know the key ideas of “{t}” and give examples.' },
  obj2: { ru: 'Записывать и уравнивать уравнения реакций по теме.', uz: 'Mavzu bo‘yicha reaksiya tenglamalarini yozish va tenglashtirish.', en: 'Write and balance reaction equations for the topic.' },
  obj3: { ru: 'Решать расчётную задачу по уравнению реакции.', uz: 'Reaksiya tenglamasi bo‘yicha hisoblash masalasini yechish.', en: 'Solve a calculation problem from a reaction equation.' },
  st1: { ru: 'Организационный момент и актуализация', uz: 'Tashkiliy qism va bilimlarni faollashtirish', en: 'Warm-up and recall' },
  st2: { ru: 'Новый материал', uz: 'Yangi mavzu', en: 'New material' },
  st3: { ru: '3D-опыт и наблюдение', uz: '3D-tajriba va kuzatish', en: '3D experiment and observation' },
  st4: { ru: 'Закрепление: задачи', uz: 'Mustahkamlash: masalalar', en: 'Practice: problems' },
  st5: { ru: 'Рефлексия и домашнее задание', uz: 'Refleksiya va uy vazifasi', en: 'Reflection and homework' },
  a1: { ru: 'Фронтальный опрос по прошлому §', uz: 'O‘tgan § bo‘yicha savol-javob', en: 'Quick oral quiz on the previous §' },
  a2: { ru: 'Объяснение по учебнику: {c}', uz: 'Darslik bo‘yicha tushuntirish: {c}', en: 'Explanation from the textbook: {c}' },
  a3: { ru: 'Запись опорного конспекта', uz: 'Tayanch konspekt yozish', en: 'Students write key notes' },
  a4: { ru: 'Сцена в 3D-лаборатории, ученики описывают признаки реакции', uz: '3D-laboratoriyada sahna, o‘quvchilar reaksiya belgilarini tasvirlaydi', en: 'Scene in the 3D lab; students describe signs of reaction' },
  a5: { ru: 'Решение задачи у доски, затем в парах', uz: 'Masalani doskada, keyin juftlikda yechish', en: 'Problem at the board, then in pairs' },
  a6: { ru: 'Три вопроса «что понял»; домашнее задание: § и задача', uz: '«Nimani tushundim» uchta savol; uy vazifasi: § va masala', en: 'Three “what I learned” questions; homework: § and a problem' },
  q1: { ru: 'Что изучает тема «{t}»?', uz: '«{t}» mavzusi nimani o‘rganadi?', en: 'What does “{t}” study?' },
  q2: { ru: 'Приведите пример из жизни.', uz: 'Hayotdan misol keltiring.', en: 'Give an example from everyday life.' },
  q3: { ru: 'По каким признакам видно, что прошла реакция?', uz: 'Reaksiya sodir bo‘lganini qaysi belgilardan bilamiz?', en: 'Which signs show that a reaction happened?' },
  pText: { ru: 'Сколько граммов воды образуется при сгорании 4 г водорода? 2H₂ + O₂ → 2H₂O', uz: '4 g vodorod yonganda necha gramm suv hosil bo‘ladi? 2H₂ + O₂ → 2H₂O', en: 'How many grams of water form when 4 g of hydrogen burn? 2H₂ + O₂ → 2H₂O' },
  pSol: { ru: 'n(H₂) = 4 / 2 = 2 моль; n(H₂O) = n(H₂) = 2 моль; m(H₂O) = 2 · 18 = 36 г', uz: 'n(H₂) = 4 / 2 = 2 mol; n(H₂O) = n(H₂) = 2 mol; m(H₂O) = 2 · 18 = 36 g', en: 'n(H₂) = 4 / 2 = 2 mol; n(H₂O) = n(H₂) = 2 mol; m(H₂O) = 2 · 18 = 36 g' },
  pAns: { ru: '36 г', uz: '36 g', en: '36 g' },
  p2Text: { ru: 'Найдите массовую долю кислорода в воде H₂O.', uz: 'Suv H₂O tarkibidagi kislorodning massa ulushini toping.', en: 'Find the mass fraction of oxygen in water H₂O.' },
  p2Sol: { ru: 'M(H₂O) = 18 г/моль; ω(O) = 16 / 18 = 0,889', uz: 'M(H₂O) = 18 g/mol; ω(O) = 16 / 18 = 0,889', en: 'M(H₂O) = 18 g/mol; ω(O) = 16 / 18 = 0.889' },
  p2Ans: { ru: '88,9 %', uz: '88,9 %', en: '88.9 %' },
  lLab: { ru: '3D-лаборатория', uz: '3D-laboratoriya', en: '3D lab' },
  lCat: { ru: 'Каталог веществ', uz: 'Moddalar katalogi', en: 'Substance catalogue' },
  lPt: { ru: 'Периодическая таблица', uz: 'Davriy jadval', en: 'Periodic table' },
  testTitle: { ru: '{f}: {t}', uz: '{f}: {t}', en: '{f}: {t}' },
  tq1: { ru: 'Какое утверждение верно для темы «{t}»?', uz: '«{t}» mavzusi uchun qaysi fikr to‘g‘ri?', en: 'Which statement is true for “{t}”?' },
  tq2: { ru: 'Расставьте коэффициенты: Al + O₂ → Al₂O₃', uz: 'Koeffitsiyentlarni qo‘ying: Al + O₂ → Al₂O₃', en: 'Balance: Al + O₂ → Al₂O₃' },
  tq3: { ru: 'Вычислите молярную массу CO₂.', uz: 'CO₂ ning molyar massasini hisoblang.', en: 'Calculate the molar mass of CO₂.' },
  tq4: { ru: 'Объясните своими словами главное понятие темы «{t}».', uz: '«{t}» mavzusining asosiy tushunchasini o‘z so‘zlaringiz bilan tushuntiring.', en: 'Explain the main idea of “{t}” in your own words.' },
  o1: { ru: 'Верно, как сказано в учебнике', uz: 'To‘g‘ri, darslikda aytilganidek', en: 'True, as the textbook says' },
  o2: { ru: 'Так описывается другое явление', uz: 'Bu boshqa hodisani tasvirlaydi', en: 'This describes another phenomenon' },
  o3: { ru: 'Верно только для металлов', uz: 'Faqat metallar uchun to‘g‘ri', en: 'True only for metals' },
  o4: { ru: 'Неверно ни в одном случае', uz: 'Hech qachon to‘g‘ri emas', en: 'Never true' },
  k2: { ru: '4Al + 3O₂ → 2Al₂O₃', uz: '4Al + 3O₂ → 2Al₂O₃', en: '4Al + 3O₂ → 2Al₂O₃' },
  k3: { ru: '44 г/моль', uz: '44 g/mol', en: '44 g/mol' },
  k4: { ru: 'Ответ по определению из §; полный ответ — 3 балла', uz: '§ dagi ta’rif bo‘yicha javob; to‘liq javob — 3 ball', en: 'Answer per the § definition; full answer — 3 points' },
  gc: { ru: 'По фото видно решение; проверьте запись единиц.', uz: 'Fotoda yechim ko‘rinadi; birliklar yozuvini tekshiring.', en: 'The solution is visible; check the units.' },
  gNote: { ru: 'Демо-ответ: баллы — пример, а не проверка мозга.', uz: 'Demo javob: ballar — misol, miya tekshiruvi emas.', en: 'Demo answer: the points are an example, not a brain check.' },
} satisfies Record<string, L>

const FORMAT_NAME: Record<'sor' | 'soch' | 'quiz', L> = {
  sor: { ru: 'СОР', uz: 'BSB', en: 'Unit test' },
  soch: { ru: 'СОЧ', uz: 'ChSB', en: 'Term test' },
  quiz: { ru: 'Квиз', uz: 'Viktorina', en: 'Quiz' },
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '')

function plan(req: PlanRequest, title: (id: string) => string): unknown {
  const l = req.lang
  const t = title(req.unit)
  const m = req.minutes
  // этапы пропорционально длительности, сумма = minutes
  const parts = [0.1, 0.3, 0.2, 0.3, 0.1].map((k) => Math.max(2, Math.round(m * k)))
  parts[3] = Math.max(2, m - parts[0]! - parts[1]! - parts[2]! - parts[4]!)
  return {
    plan: {
      title: fill(T.planTitle[l], { t }),
      objectives: [fill(T.obj1[l], { t }), T.obj2[l], T.obj3[l]],
      stages: [
        { name: T.st1[l], minutes: parts[0], activities: [T.a1[l]] },
        { name: T.st2[l], minutes: parts[1], activities: [fill(T.a2[l], { c: t }), T.a3[l]] },
        { name: T.st3[l], minutes: parts[2], activities: [T.a4[l]] },
        { name: T.st4[l], minutes: parts[3], activities: [T.a5[l]] },
        { name: T.st5[l], minutes: parts[4], activities: [T.a6[l]] },
      ],
      questions: [fill(T.q1[l], { t }), T.q2[l], T.q3[l]],
      problems: [
        { text: T.pText[l], solution: T.pSol[l], answer: T.pAns[l] },
        { text: T.p2Text[l], solution: T.p2Sol[l], answer: T.p2Ans[l] },
      ],
      links: [
        { title: T.lLab[l], href: '#/vr-lab' },
        { title: T.lCat[l], href: '#/catalog' },
        { title: T.lPt[l], href: '#/periodic' },
      ],
    },
  }
}

function test(req: TestRequest, title: (id: string) => string): unknown {
  const l = req.lang
  const items = Array.from({ length: req.n }, (_, i) => {
    const unit = req.units[i % req.units.length]!
    const t = title(unit)
    switch (i % 4) {
      case 0:
        return { type: 'single', q: fill(T.tq1[l], { t }), options: [T.o1[l], T.o2[l], T.o3[l], T.o4[l]], answer: 'A', points: 1, unit }
      case 1:
        return { type: 'open', q: T.tq2[l], answer: T.k2[l], points: 2, unit }
      case 2:
        return { type: 'calc', q: T.tq3[l], answer: T.k3[l], points: 2, unit }
      default:
        return { type: 'open', q: fill(T.tq4[l], { t }), answer: T.k4[l], points: 3, unit }
    }
  })
  const totalPoints = items.reduce((a, x) => a + x.points, 0)
  return {
    test: {
      title: fill(T.testTitle[l], { f: FORMAT_NAME[req.format][l], t: req.units.length === 1 ? title(req.units[0]!) : req.units.map(title).slice(0, 3).join('; ') }),
      items,
      totalPoints,
      scale: defaultScale(totalPoints),
    },
  }
}

function grade(req: GradeRequest): unknown {
  const criteria = req.rubric.map((c, i) => {
    const points = Math.max(0, c.max - (i % 3 === 1 ? 1 : 0))
    return { name: c.name, max: c.max, points, comment: T.gc[req.lang] }
  })
  return {
    grade: {
      criteria,
      total: criteria.reduce((a, c) => a + c.points, 0),
      max: criteria.reduce((a, c) => a + c.max, 0),
      note: T.gNote[req.lang],
    },
  }
}

/** Демо-ответ по контракту (с той же проверкой запроса и тем же разбором, что у настоящего вызова). */
export async function mockTeacherTool<K extends TeacherToolKind>(
  kind: K,
  req: TeacherToolMap[K]['req'],
  title: (unitId: string) => string,
  delayMs = 600,
): Promise<TeacherToolMap[K]['res']> {
  const body = buildBody(kind, req) as unknown as TeacherToolMap[K]['req']
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  if (kind === 'plan') return normPlan(plan(body as PlanRequest, title)) as TeacherToolMap[K]['res']
  if (kind === 'test') return normTest(test(body as TestRequest, title)) as TeacherToolMap[K]['res']
  return normGrade(grade(body as GradeRequest)) as TeacherToolMap[K]['res']
}
