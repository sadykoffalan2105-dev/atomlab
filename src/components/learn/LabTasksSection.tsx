/**
 * «Задачи-опыты» в обучении: задачи учебников Kimyo 7–9, которые решают в 3D-лаборатории как настоящий опыт
 * (взвесить, отмерить, провести реакцию, снять показания, посчитать и сверить с учебником).
 *  • LabTasksSection — карточки по классам на хабе задач (/learn/tasks);
 *  • LabTaskButton — кнопка «Решить в лаборатории» в тренажёре и в задаче параграфа (подходящие задачи-опыты).
 */
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LabLang, LabTaskId } from '../lab3d/labContract'
import { LAB_TASKS, labTaskHref } from '../../data/labTasks/labTasks'
import type { LabTask, LabTaskType } from '../../data/labTasks/labTaskTypes'
import { isLabTaskCompleted } from '../../learn/labTaskProgress'
import { useT } from '../../i18n/useT'
import css from './LabTasksSection.module.css'

const UI = {
  title: { ru: 'Задачи-опыты: решите в лаборатории', en: 'Lab problems: solve them in the lab', uz: 'Masala-tajribalar: laboratoriyada yeching' },
  lead: {
    ru: 'Задачи из учебников Kimyo — как настоящий опыт: взвесьте на весах, отмерьте мензуркой, проведите реакцию, снимите показания приборов, посчитайте по своим измерениям и сверьте с ответом учебника.',
    en: 'Kimyo textbook problems as a real experiment: weigh on the balance, measure with a cylinder, run the reaction, read the instruments, calculate from your own measurements and compare with the textbook answer.',
    uz: 'Kimyo darsliklaridagi masalalar — haqiqiy tajriba kabi: tarozida torting, silindr bilan o‘lchang, reaksiyani o‘tkazing, asboblarni o‘qing, o‘z o‘lchovlaringiz bo‘yicha hisoblang va darslik javobi bilan solishtiring.',
  },
  grade: { ru: 'класс', en: 'grade', uz: 'sinf' },
  open: { ru: 'Открыть опыт', en: 'Open the experiment', uz: 'Tajribani ochish' },
  done: { ru: 'решено', en: 'solved', uz: 'yechilgan' },
  solveInLab: { ru: 'Решить в лаборатории', en: 'Solve in the lab', uz: 'Laboratoriyada yechish' },
  similar: { ru: 'Похожая задача как опыт', en: 'A similar problem as an experiment', uz: 'O‘xshash masala tajriba sifatida' },
} satisfies Record<string, Record<LabLang, string>>

const TYPE: Record<LabTaskType, Record<LabLang, string>> = {
  moles: { ru: 'Количество вещества', en: 'Amount of substance', uz: 'Modda miqdori' },
  'stoich-mass': { ru: 'Расчёт по уравнению', en: 'Calculation by equation', uz: 'Tenglama bo‘yicha hisob' },
  'stoich-gas': { ru: 'Объём газа', en: 'Gas volume', uz: 'Gaz hajmi' },
  'solution-w': { ru: 'Растворы', en: 'Solutions', uz: 'Eritmalar' },
  'crystal-hydrate': { ru: 'Кристаллогидраты', en: 'Crystal hydrates', uz: 'Kristallogidratlar' },
  precipitate: { ru: 'Осадок', en: 'Precipitate', uz: 'Cho‘kma' },
  excess: { ru: 'Избыток и недостаток', en: 'Excess and limiting', uz: 'Ortiqcha va yetishmovchi' },
  mixture: { ru: 'Смеси', en: 'Mixtures', uz: 'Aralashmalar' },
}

function Stars({ n }: { n: number }) {
  return (
    <span className={css.stars} aria-label={`${n}/3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} data-on={i < n || undefined}>
          ★
        </span>
      ))}
    </span>
  )
}

function TaskCard({ task, lang, from }: { task: LabTask; lang: LabLang; from: string }) {
  const done = isLabTaskCompleted(task.id)
  return (
    <article className={css.card} role="listitem" data-done={done || undefined} data-lab-task-card={task.id}>
      <div className={css.top}>
        <span className={css.source}>{task.source[lang]}</span>
        <Stars n={task.difficulty} />
      </div>
      <h4 className={css.cardTitle}>{task.title[lang]}</h4>
      <p className={css.statement}>{task.statement[lang]}</p>
      <div className={css.foot}>
        <span className={css.type}>{TYPE[task.type][lang]}</span>
        {done ? <span className={css.done}>✓ {UI.done[lang]}</span> : null}
        <Link className={css.open} to={labTaskHref(task.id, from)}>
          {UI.open[lang]} →
        </Link>
      </div>
    </article>
  )
}

export function LabTasksSection() {
  const { locale } = useT()
  const lang: LabLang = locale
  const loc = useLocation()
  const grades = useMemo(() => ([7, 8, 9] as const).filter((g) => LAB_TASKS.some((t) => t.grade === g)), [])
  const [grade, setGrade] = useState<7 | 8 | 9>(grades[0] ?? 7)
  if (!LAB_TASKS.length) return null
  const list = LAB_TASKS.filter((t) => t.grade === grade)
  return (
    <section className={css.section} aria-labelledby="lab-tasks-title" data-lab-tasks-section>
      <div className={css.head}>
        <span className={css.badge} aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3" />
            <path d="M7.5 14h9" />
          </svg>
        </span>
        <h2 id="lab-tasks-title" className={css.title}>
          {UI.title[lang]}
        </h2>
        <span className={css.count}>{LAB_TASKS.length}</span>
      </div>
      <p className={css.lead}>{UI.lead[lang]}</p>
      <div className={css.tabs} role="tablist">
        {grades.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={g === grade} className={g === grade ? css.tabOn : css.tab} onClick={() => setGrade(g)}>
            {g} {UI.grade[lang]}
          </button>
        ))}
      </div>
      <div className={css.grid} role="list">
        {list.map((t) => (
          <TaskCard key={t.id} task={t} lang={lang} from={loc.pathname} />
        ))}
      </div>
    </section>
  )
}

/** Какие задачи-опыты подходят к категории тренажёра (тот же тип расчёта). */
const BY_CATEGORY: Record<string, readonly LabTaskType[]> = {
  solutions: ['solution-w', 'crystal-hydrate'],
  stoichiometry: ['stoich-mass', 'stoich-gas', 'moles'],
  limiting_reagent: ['excess'],
  yield_impurities: ['mixture', 'stoich-mass'],
  metal_plate: ['stoich-mass'],
  oge_prep: ['stoich-gas', 'precipitate', 'solution-w'],
}

export function labTasksForCategory(categoryId: string, grade?: number): readonly LabTask[] {
  const types = BY_CATEGORY[categoryId]
  if (!types) return []
  const list = LAB_TASKS.filter((t) => types.includes(t.type))
  return grade ? [...list.filter((t) => t.grade === grade), ...list.filter((t) => t.grade !== grade)] : list
}

/** Кнопка «Решить в лаборатории» — ведёт в задачу-опыт (с возвратом сюда). */
export function LabTaskButton({ taskIds, className }: { taskIds: readonly LabTaskId[]; className?: string }) {
  const { locale } = useT()
  const lang: LabLang = locale
  const loc = useLocation()
  const [i, setI] = useState(0)
  if (!taskIds.length) return null
  const id = taskIds[i % taskIds.length]!
  const task = LAB_TASKS.find((t) => t.id === id)
  if (!task) return null
  return (
    <span className={`${css.inline} ${className ?? ''}`} data-lab-task-button={id}>
      <Link className={css.inlineBtn} to={labTaskHref(id, `${loc.pathname}${loc.search}`)} title={`${UI.similar[lang]}: ${task.source[lang]}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3" />
        </svg>
        {UI.solveInLab[lang]}
      </Link>
      {taskIds.length > 1 ? (
        <button type="button" className={css.inlineNext} onClick={() => setI((k) => k + 1)} aria-label="↻">
          ↻
        </button>
      ) : null}
      <span className={css.inlineHint}>{task.source[lang]}</span>
    </span>
  )
}
