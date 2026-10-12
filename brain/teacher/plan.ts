/**
 * POST /teacher/plan — план урока по §-карточке карты Kimyo 7–11, детерминированно и без LLM:
 * цели, этапы с минутами (сумма = minutes), ключевые вопросы, 2–3 задачи с решением калькулятора,
 * уравнения (только уравненные), ссылки на учебник и 3D-реактор ATOMLAB. План — рекомендация: учитель правит под класс.
 */
import type { Unit } from '../curriculum/types.ts'
import type { Knowledge } from '../kb/shards.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { curriculum, L3, testOf, unitConcepts, unitDefinitions, unitEquations, unitLinks, unitTitle, type EqItem, type LinkItem } from './content.ts'
import { problemsForUnit, type Problem } from './problems.ts'

export type StageId = 'org' | 'check' | 'new' | 'demo' | 'practice' | 'consolidate' | 'reflect'
export type PlanStage = { id: StageId; title: string; minutes: number; activities: string[] }
export type LessonPlan = {
  unit: { id: string; grade: number; kind: string; label: string; cite: string; title: string; pages: { start: number; end: number } }
  lang: Lang
  minutes: number
  objectives: string[]
  stages: PlanStage[]
  keyQuestions: { q: string; hint?: string }[]
  quickCheck: { q: string; choices: string[]; answer: string }[]
  problems: Problem[]
  equations: EqItem[]
  links: LinkItem[]
  homework: string[]
  note: string
}

const STAGE_TITLE: Record<StageId, [string, string, string]> = {
  org: ['Организационный момент', 'Tashkiliy qism', 'Warm-up and organisation'],
  check: ['Актуализация знаний', 'Bilimlarni faollashtirish', 'Review of prior knowledge'],
  new: ['Новый материал', 'Yangi mavzu', 'New material'],
  demo: ['Опыт и 3D-модель', 'Tajriba va 3D-model', 'Experiment and 3D model'],
  practice: ['Решение задач', 'Masalalar yechish', 'Problem solving'],
  consolidate: ['Закрепление', 'Mustahkamlash', 'Consolidation'],
  reflect: ['Рефлексия и домашнее задание', 'Refleksiya va uy vazifasi', 'Reflection and homework'],
}
const PRACTICAL_TITLE: Partial<Record<StageId, [string, string, string]>> = {
  check: ['Инструктаж по технике безопасности', 'Xavfsizlik texnikasi boʻyicha yoʻriqnoma', 'Safety briefing'],
  demo: ['Выполнение практической работы', 'Amaliy ishni bajarish', 'Doing the practical work'],
  consolidate: ['Оформление отчёта и выводы', 'Hisobot va xulosalar', 'Report and conclusions'],
}

/** Веса этапов на 45 минут (по виду единицы); этапа нет — его вес уходит в «Новый материал» / «Закрепление». */
const WEIGHTS: Record<string, Record<StageId, number>> = {
  paragraph: { org: 2, check: 5, new: 14, demo: 5, practice: 10, consolidate: 6, reflect: 3 },
  practical: { org: 2, check: 5, new: 4, demo: 22, practice: 4, consolidate: 6, reflect: 2 },
  lab: { org: 2, check: 5, new: 4, demo: 22, practice: 4, consolidate: 6, reflect: 2 },
  review: { org: 2, check: 8, new: 6, demo: 3, practice: 14, consolidate: 9, reflect: 3 },
  tasks: { org: 2, check: 5, new: 5, demo: 2, practice: 22, consolidate: 6, reflect: 3 },
}

/** Минуты по весам: целые, ≥ 1, сумма ровно total (наибольшие остатки). */
export function splitMinutes(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const raw = weights.map((w) => (w / sum) * total)
  const out = raw.map((x) => Math.max(1, Math.floor(x)))
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length]!.i]!++
  // слишком мало минут на этапы по 1 — снимаем с самых длинных
  while (left < 0) {
    const i = out.indexOf(Math.max(...out))
    out[i]!--
    left++
  }
  return out
}

const join = (xs: string[]) => xs.join(', ')

export function buildPlan(unitId: string, lang: Lang, minutes: number, kb: Knowledge): LessonPlan | null {
  const map = curriculum()
  const u = map?.byId.get(unitId)
  if (!map || !u) return null
  return planFor(u, lang, minutes, kb, (id) => map.byId.get(id) ?? null, map.taskTypes)
}

export function planFor(u: Unit, lang: Lang, minutesIn: number, kb: Knowledge, unitById: (id: string) => Unit | null, taskTypes: { id: string; name: { ru: string; uz: string; en: string } }[]): LessonPlan {
  const minutes = Math.max(20, Math.min(90, Math.round(minutesIn || 45)))
  const practical = u.kind === 'practical' || u.kind === 'lab'
  const t = (k: StageId) => L3(lang, ...((practical ? PRACTICAL_TITLE[k] : undefined) ?? STAGE_TITLE[k]))
  const title = unitTitle(u, lang)
  const label = u.label[lang]
  const concepts = unitConcepts(u, lang)
  const defs = lang === 'ru' ? unitDefinitions(u) : []
  const eqs = unitEquations(u)
  const links = unitLinks(u, eqs, lang)
  const reactorLinks = links.filter((l) => l.kind !== 'book')
  const nProblems = u.kind === 'tasks' || u.kind === 'review' ? 3 : 2
  const problems = problemsForUnit(u, lang, kb, nProblems)
  const typeName = (id: string) => taskTypes.find((x) => x.id === id)?.name[lang]
  const skills = [...new Set(problems.map((p) => typeName(p.type)).filter((x): x is string => !!x && (lang === 'ru' || !/[а-яё]/iu.test(x))))]
  const pages = u.pages.start ? L3(lang, `стр. ${u.pages.start}–${u.pages.end}`, `${u.pages.start}–${u.pages.end}-betlar`, `pp. ${u.pages.start}–${u.pages.end}`) : ''

  // ——— цели
  const objectives: string[] = []
  objectives.push(
    concepts.length
      ? L3(lang, `Знать: ${join(concepts.slice(0, 4))}.`, `Bilish: ${join(concepts.slice(0, 4))}.`, `Know: ${join(concepts.slice(0, 4))}.`)
      : L3(lang, `Знать основные понятия темы «${title}».`, `${title} mavzusining asosiy tushunchalarini bilish.`, `Know the key ideas of the topic ${title}.`),
  )
  if (skills.length) objectives.push(L3(lang, `Уметь решать задачи: ${join(skills.slice(0, 3)).toLowerCase()}.`, `Masalalar yecha olish: ${join(skills.slice(0, 3)).toLowerCase()}.`, `Be able to solve problems: ${join(skills.slice(0, 3)).toLowerCase()}.`))
  if (eqs.length) objectives.push(L3(lang, 'Уметь составлять и уравнивать уравнения реакций темы.', 'Mavzu reaksiyalari tenglamalarini tuzish va tenglashtira olish.', 'Be able to write and balance the reaction equations of the topic.'))
  if (practical) objectives.push(L3(lang, 'Соблюдать правила техники безопасности, делать выводы по наблюдениям.', 'Xavfsizlik qoidalariga rioya qilish, kuzatishlardan xulosa chiqarish.', 'Follow safety rules and draw conclusions from observations.'))
  objectives.push(L3(lang, 'Связывать тему с жизнью и производством Узбекистана.', 'Mavzuni hayot va Oʻzbekiston ishlab chiqarishi bilan bogʻlash.', 'Connect the topic with everyday life and industry in Uzbekistan.'))

  // ——— ключевые вопросы
  const keyQuestions: LessonPlan['keyQuestions'] = []
  for (const d of defs) keyQuestions.push({ q: `Что такое «${d.term.toLowerCase()}»?`, hint: `${d.text} (${u.cite.slice(1, -1)}${d.page ? `, стр. ${d.page}` : ''})` })
  for (const c of concepts) {
    if (keyQuestions.length >= 3) break
    if (keyQuestions.some((k) => k.q.includes(c.toLowerCase()))) continue
    keyQuestions.push({ q: L3(lang, `Что такое «${c.toLowerCase()}»?`, `«${c}» nima?`, `What is “${c}”?`) })
  }
  for (const law of u.laws.slice(0, 1)) {
    const n = lang === 'ru' ? law.name.ru : law.name[lang]
    if (n && (lang === 'ru' || !/[а-яё]/iu.test(n))) keyQuestions.push({ q: L3(lang, `Сформулируйте: ${n}.`, `Taʼriflang: ${n}.`, `State: ${n}.`), ...(lang === 'ru' ? { hint: law.statement.ru } : {}) })
  }
  if (eqs[0]) {
    const left = eqs[0].eq.split(/\s*(?:→|=|⇄|⇌)\s*/)[0]
    keyQuestions.push({ q: L3(lang, `Что образуется в реакции ${left} → … ? Уравняйте.`, `${left} → … reaksiyasida nima hosil boʻladi? Tenglashtiring.`, `What forms in the reaction ${left} → … ? Balance it.`), hint: eqs[0].eq })
  }
  keyQuestions.push({ q: L3(lang, `Где в жизни встречается тема «${title}»?`, `${title} mavzusi hayotda qayerda uchraydi?`, `Where do we meet the topic ${title} in everyday life?`) })
  const keyQ = keyQuestions.slice(0, 5)

  // ——— быстрая проверка: тесты карты на языке запроса
  const quickCheck = u.tests
    .map((x) => testOf(x, lang))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 3)
    .map((x) => ({ q: x.q, choices: x.choices, answer: x.answer }))

  // ——— этапы
  const prereq = u.level.prereq.map(unitById).filter((x): x is Unit => !!x).slice(0, 2)
  const act: Record<StageId, string[]> = {
    org: [L3(lang, `Приветствие, отметка присутствующих. Тема: «${title}» (${label}).`, `Salomlashish, davomatni belgilash. Mavzu: ${title} (${label}).`, `Greeting and register. Topic: ${title} (${label}).`)],
    check: practical
      ? [L3(lang, 'Правила работы с реактивами и нагревательными приборами; проверка готовности рабочих мест.', 'Reaktivlar va qizdirish asboblari bilan ishlash qoidalari; ish joylarini tekshirish.', 'Rules for reagents and heating equipment; check that workplaces are ready.')]
      : [
          prereq.length
            ? L3(lang, `Повторение: ${prereq.map((p) => `${p.label.ru} «${p.title.ru}»`).join('; ')}.`, `Takrorlash: ${prereq.map((p) => `${p.label.uz} ${unitTitle(p, 'uz')}`).join('; ')}.`, `Review: ${prereq.map((p) => `${p.label.en} ${unitTitle(p, 'en')}`).join('; ')}.`)
            : L3(lang, 'Фронтальный опрос по прошлой теме, проверка домашнего задания.', 'Oʻtgan mavzu boʻyicha savol-javob, uy vazifasini tekshirish.', 'Quick oral review of the previous topic, homework check.'),
        ],
    new: [
      L3(lang, `Объяснение по учебнику: ${label}${pages ? `, ${pages}` : ''}.`, `Darslik boʻyicha tushuntirish: ${label}${pages ? `, ${pages}` : ''}.`, `Explanation from the textbook: ${label}${pages ? `, ${pages}` : ''}.`),
      ...(concepts.length ? [L3(lang, `Понятия: ${join(concepts)}.`, `Tushunchalar: ${join(concepts)}.`, `Concepts: ${join(concepts)}.`)] : []),
      ...defs.slice(0, 2).map((d) => `Определение «${d.term.toLowerCase()}»: ${d.text}`),
      ...(u.formulas.length ? [L3(lang, `Формулы: ${u.formulas.slice(0, 3).join('; ')}.`, `Formulalar: ${u.formulas.slice(0, 3).join('; ')}.`, `Formulas: ${u.formulas.slice(0, 3).join('; ')}.`)] : []),
      ...(eqs.length ? [L3(lang, `Уравнения: ${eqs.map((e) => e.eq).join('; ')}.`, `Tenglamalar: ${eqs.map((e) => e.eq).join('; ')}.`, `Equations: ${eqs.map((e) => e.eq).join('; ')}.`)] : []),
    ],
    demo: practical
      ? [
          L3(lang, `Ход работы — по учебнику (${label}); наблюдения записывать в таблицу.`, `Ish tartibi — darslik boʻyicha (${label}); kuzatishlarni jadvalga yozish.`, `Procedure as in the textbook (${label}); record observations in a table.`),
          ...reactorLinks.slice(0, 2).map((l) => L3(lang, `Перед опытом — показ в 3D: ${l.title.replace(/^3D-реактор: /, '')}.`, `Tajribadan oldin 3D koʻrsatish: ${l.title.replace(/^3D-reaktor: /, '')}.`, `Before the experiment, show it in 3D: ${l.title.replace(/^3D reactor: /, '')}.`)),
        ]
      : reactorLinks.slice(0, 2).map((l) => L3(lang, `Показ в 3D-реакторе ATOMLAB: ${l.title.replace(/^3D-реактор: /, '')}; ученики называют признаки реакции.`, `ATOMLAB 3D-reaktorida koʻrsatish: ${l.title.replace(/^3D-reaktor: /, '')}; oʻquvchilar reaksiya belgilarini aytadi.`, `Show in the ATOMLAB 3D reactor: ${l.title.replace(/^3D reactor: /, '')}; students name the signs of the reaction.`)),
    practice: problems.map((p, i) =>
      L3(lang, `Задача ${i + 1}${i === 0 ? ' (у доски)' : ' (самостоятельно)'}: ${p.statement}`, `${i + 1}-masala${i === 0 ? ' (doskada)' : ' (mustaqil)'}: ${p.statement}`, `Problem ${i + 1}${i === 0 ? ' (at the board)' : ' (individually)'}: ${p.statement}`),
    ),
    consolidate: practical
      ? [L3(lang, 'Ученики записывают наблюдения, уравнения и вывод в тетрадь.', 'Oʻquvchilar kuzatish, tenglama va xulosani daftarga yozadi.', 'Students write observations, equations and a conclusion in their notebooks.')]
      : [
          quickCheck.length
            ? L3(lang, `Мини-тест (${quickCheck.length} вопр.) — ответы в ключе плана.`, `Mini-test (${quickCheck.length} ta savol) — javoblar reja kalitida.`, `Mini-quiz (${quickCheck.length} questions) — answers in the plan key.`)
            : L3(lang, 'Ответы на ключевые вопросы в парах.', 'Asosiy savollarga juftlikda javob berish.', 'Answer the key questions in pairs.'),
        ],
    reflect: [
      L3(lang, 'Рефлексия: что было понятно, что вызвало трудность.', 'Refleksiya: nima tushunarli boʻldi, nima qiyin boʻldi.', 'Reflection: what was clear and what was difficult.'),
      L3(lang, `Домашнее задание: ${label}${pages ? `, ${pages}` : ''}; упражнения после параграфа.`, `Uy vazifasi: ${label}${pages ? `, ${pages}` : ''}; mavzu oxiridagi mashqlar.`, `Homework: ${label}${pages ? `, ${pages}` : ''}; exercises after the section.`),
    ],
  }
  const w = { ...(WEIGHTS[u.kind] ?? WEIGHTS.paragraph!) }
  if (!act.demo.length) {
    w.new += w.demo
    w.demo = 0
  }
  if (!act.practice.length) {
    w.consolidate += w.practice
    w.practice = 0
  }
  const ids = (Object.keys(w) as StageId[]).filter((k) => w[k] > 0)
  const mins = splitMinutes(
    ids.map((k) => w[k]),
    minutes,
  )
  const stages: PlanStage[] = ids.map((id, i) => ({ id, title: t(id), minutes: mins[i]!, activities: act[id] }))

  const homework = [
    L3(lang, `Прочитать ${label}${pages ? ` (${pages})` : ''}.`, `${label}${pages ? ` (${pages})` : ''} ni oʻqish.`, `Read ${label}${pages ? ` (${pages})` : ''}.`),
    ...(problems[1] ? [L3(lang, 'Дорешать задачу 2, если не успели на уроке.', 'Darsda ulgurilmagan boʻlsa, 2-masalani yechish.', 'Finish problem 2 if not done in class.')] : []),
  ]
  return {
    unit: { id: u.id, grade: u.grade, kind: u.kind, label, cite: u.cite, title, pages: u.pages },
    lang,
    minutes,
    objectives,
    stages,
    keyQuestions: keyQ,
    quickCheck,
    problems,
    equations: eqs,
    links,
    homework,
    note: L3(lang, 'План — рекомендация ИИ-помощника; учитель адаптирует его под класс.', 'Reja — sunʼiy intellekt yordamchisining tavsiyasi; oʻqituvchi uni sinfga moslashtiradi.', 'This plan is a recommendation of the AI assistant; the teacher adapts it to the class.'),
  }
}
