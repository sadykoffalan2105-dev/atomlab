/**
 * Интерфейс задачи-опыта — общий для электронной доски (1280 × 720, крупно, для пальцев) и панели страницы
 * лаборатории (узкая колонка, телефон):
 *  • TaskStatement — условие как в учебнике, что найти, масштаб опыта, приборы, опечатка книги;
 *  • TaskJournal — журнал измерений (показания приборов этой попытки по мере выполнения шагов);
 *  • TaskTeacherTip — учитель на текущем шаге: что происходит с частицами и типичная ошибка (можно прослушать);
 *  • TaskSolve — «Дано» с измеренными числами → ввод ответа → проверка → решение → сверка
 *    «Измерено / Расчёт по вашим измерениям / Учебник» с объяснением разницы → звёзды и запись в прогресс.
 * Все части читают одну попытку (measure/labTaskSession) — ответ, введённый на доске, виден в панели, и наоборот.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import type { LabLang, LabTaskId } from '../labContract'
import { labEvents } from '../labEvents'
import { getLabTask } from '../../../data/labTasks/labTasks'
import type { LabTask } from '../../../data/labTasks/labTaskTypes'
import { INSTRUMENTS, UNITS, decimalsFor, fmtNum, fmtReading } from '../measure/instruments'
import { answerOk, compareRows, type AnswerCheck } from '../measure/labTaskCheck'
import { labTaskSession, useLabTaskSession, type LabTaskSessionState } from '../measure/labTaskSession'
import { recordLabTaskSolved } from '../../../learn/labTaskProgress'
import { isSpeechOutputSupported, LearnSpeechController } from '../../../learn/learnSpeech'
import css from './LabTaskUi.module.css'

type Variant = 'board' | 'panel'
type L3 = Record<LabLang, string>

const UI = {
  task: { ru: 'Задача из учебника', en: 'Textbook problem', uz: 'Darslikdagi masala' },
  find: { ru: 'Найти', en: 'Find', uz: 'Topish kerak' },
  scale: { ru: 'Масштаб опыта', en: 'Experiment scale', uz: 'Tajriba masshtabi' },
  instruments: { ru: 'Приборы', en: 'Instruments', uz: 'Asboblar' },
  bookNote: { ru: 'Примечание к учебнику', en: 'Note on the textbook', uz: 'Darslikka izoh' },
  journal: { ru: 'Журнал измерений', en: 'Measurement log', uz: 'O‘lchovlar jurnali' },
  journalEmpty: { ru: 'Показания приборов появятся здесь по ходу опыта.', en: 'Instrument readings will appear here as you work.', uz: 'Asboblar ko‘rsatkichlari tajriba davomida shu yerda paydo bo‘ladi.' },
  afterStep: { ru: 'после шага', en: 'after step', uz: 'qadamdan keyin' },
  derived: { ru: 'вычислено', en: 'calculated', uz: 'hisoblangan' },
  teacher: { ru: 'Учитель', en: 'Teacher', uz: 'O‘qituvchi' },
  mistake: { ru: 'Частая ошибка', en: 'Common mistake', uz: 'Ko‘p uchraydigan xato' },
  listen: { ru: 'Прослушать', en: 'Listen', uz: 'Tinglash' },
  stop: { ru: 'Стоп', en: 'Stop', uz: 'To‘xtatish' },
  calc: { ru: 'Расчёт по вашим измерениям', en: 'Calculation from your measurements', uz: 'O‘lchovlaringiz bo‘yicha hisob' },
  given: { ru: 'Дано (измерено)', en: 'Given (measured)', uz: 'Berilgan (o‘lchangan)' },
  answer: { ru: 'Ваш ответ на вопрос задачи', en: 'Your answer to the problem', uz: 'Masala savoliga javobingiz' },
  check: { ru: 'Проверить', en: 'Check', uz: 'Tekshirish' },
  showSolution: { ru: 'Показать решение', en: 'Show the solution', uz: 'Yechimni ko‘rsatish' },
  solution: { ru: 'Решение', en: 'Solution', uz: 'Yechim' },
  reconcile: { ru: 'Сверка: опыт и расчёт', en: 'Check: experiment vs calculation', uz: 'Solishtirish: tajriba va hisob' },
  measured: { ru: 'Измерено', en: 'Measured', uz: 'O‘lchangan' },
  predicted: { ru: 'Расчёт по вашим количествам', en: 'Calculated from your amounts', uz: 'Olingan miqdorlar bo‘yicha hisob' },
  book: { ru: 'Учебник (в масштабе опыта)', en: 'Textbook (at lab scale)', uz: 'Darslik (tajriba masshtabida)' },
  dev: { ru: 'Расхождение', en: 'Difference', uz: 'Farq' },
  within: { ru: 'в пределах погрешности метода', en: 'within the method error', uz: 'usul xatoligi chegarasida' },
  outside: { ru: 'больше погрешности метода — повторите опыт аккуратнее', en: 'larger than the method error: repeat more carefully', uz: 'usul xatoligidan katta — tajribani ehtiyotroq takrorlang' },
  why: { ru: 'Почему числа не совпадают точно', en: 'Why the numbers do not match exactly', uz: 'Nega sonlar aynan mos kelmaydi' },
  stars: { ru: 'Оценка', en: 'Score', uz: 'Baho' },
  starSafety: { ru: 'Техника безопасности', en: 'Safety', uz: 'Xavfsizlik' },
  starNeat: { ru: 'Аккуратность (без пропусков шагов)', en: 'Neatness (no skipped steps)', uz: 'Ozodalik (qadamlarsiz o‘tkazib yubormaslik)' },
  starCalc: { ru: 'Расчёт сделан самостоятельно', en: 'Calculation done on your own', uz: 'Hisob mustaqil bajarildi' },
  saved: { ru: 'Результат сохранён в прогрессе.', en: 'The result is saved to your progress.', uz: 'Natija o‘zlashtirishda saqlandi.' },
  repeat: { ru: 'Повторить опыт (новые показания)', en: 'Repeat the experiment (new readings)', uz: 'Tajribani takrorlash (yangi ko‘rsatkichlar)' },
  finishFirst: { ru: 'Выполните опыт до конца — расчёт откроется, когда все показания будут в журнале.', en: 'Finish the experiment: the calculation opens when all readings are logged.', uz: 'Tajribani oxiriga yetkazing — barcha ko‘rsatkichlar jurnalga tushgach, hisob ochiladi.' },
} satisfies Record<string, L3>

const STATUS: Record<AnswerCheck['status'], L3> = {
  empty: { ru: 'Введите число', en: 'Enter a number', uz: 'Son kiriting' },
  invalid: { ru: 'Не похоже на число — например 0,4 или 2,41·10^23', en: 'That is not a number: e.g. 0.4 or 2.41·10^23', uz: 'Songa o‘xshamaydi — masalan 0,4 yoki 2,41·10^23' },
  book: { ru: 'Верно — совпадает с ответом учебника', en: 'Correct: matches the textbook', uz: 'To‘g‘ri — darslik javobiga mos' },
  run: { ru: 'Верно — по вашим измерениям', en: 'Correct: from your own measurements', uz: 'To‘g‘ri — o‘lchovlaringiz bo‘yicha' },
  close: { ru: 'Почти: проверьте округление и единицы', en: 'Almost: check rounding and units', uz: 'Deyarli: yaxlitlash va birliklarni tekshiring' },
  wrong: { ru: 'Пока нет — проверьте ход решения', en: 'Not yet: check your reasoning', uz: 'Hali emas — yechim yo‘lini tekshiring' },
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' }
const sup = (n: number) => String(n).replace(/[-0-9]/g, (c) => SUP[c] ?? c)

function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className={css.stars} aria-label={`${n}/${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} data-on={i < n || undefined}>
          ★
        </span>
      ))}
    </span>
  )
}

/* ── Условие ── */

export function TaskStatement({ task, lang, variant }: { task: LabTask; lang: LabLang; variant: Variant }) {
  return (
    <section className={css.card} data-variant={variant} data-lab3d-task-statement={task.id}>
      <div className={css.cardHead}>
        <span className={css.kicker}>{UI.task[lang]}</span>
        <span className={css.source}>{task.source[lang]}</span>
        <Stars n={task.difficulty} />
      </div>
      <blockquote className={css.statement}>{task.statement[lang]}</blockquote>
      <p className={css.row}>
        <b>{UI.find[lang]}:</b> {task.answers.map((a) => `${a.label} — ${a.what[lang]}`).join('; ')}
      </p>
      {task.labScale.factor > 1 ? (
        <p className={css.row}>
          <b>
            {UI.scale[lang]} 1 : {task.labScale.factor}.
          </b>{' '}
          {task.labScale.note[lang]}
        </p>
      ) : null}
      <p className={css.row}>
        <b>{UI.instruments[lang]}:</b> {task.instruments.map((i) => INSTRUMENTS[i].name[lang]).join(' · ')}
      </p>
      {task.bookNote ? (
        <p className={css.note}>
          <b>{UI.bookNote[lang]}:</b> {task.bookNote[lang]}
        </p>
      ) : null}
    </section>
  )
}

/* ── Что происходит с частицами ── */

const STORY_TITLE: L3 = { ru: 'Что происходит с частицами', en: 'What happens to the particles', uz: 'Zarrachalar bilan nima sodir bo‘ladi' }

export function TaskStory({ task, lang }: { task: LabTask; lang: LabLang }) {
  return (
    <div className={css.story} data-lab3d-task-story={task.id}>
      <p className={css.title}>{STORY_TITLE[lang]}</p>
      <p className={css.storyEq}>{task.story.equation}</p>
      <p className={css.storyText}>{task.story.text[lang]}</p>
    </div>
  )
}

/* ── Журнал измерений ── */

export function TaskJournal({ task, step, lang, variant }: { task: LabTask; step: number; lang: LabLang; variant: Variant }) {
  const s = useLabTaskSession(task.id)
  if (!s) return null
  const any = task.measurements.some((m) => m.afterStep < step)
  return (
    <section className={css.card} data-variant={variant} data-lab3d-task-journal={task.id}>
      <p className={css.title}>{UI.journal[lang]}</p>
      {!any && variant === 'panel' ? <p className={css.muted}>{UI.journalEmpty[lang]}</p> : null}
      <table className={css.journal}>
        <tbody>
          {task.measurements.map((m) => {
            const done = m.afterStep < step
            const v = s.values[m.key]
            return (
              <tr key={m.key} data-done={done || undefined}>
                <th scope="row">{m.label}</th>
                <td className={css.value}>{done && v != null ? fmtReading(m.instrument, v, lang) : '—'}</td>
                <td className={css.what}>
                  {m.what[lang]}
                  <span className={css.instr}>
                    {done ? (m.derived ? UI.derived[lang] : INSTRUMENTS[m.instrument].name[lang]) : `${UI.afterStep[lang]} ${m.afterStep + 1}`}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

/** Строки журнала для учителя: «m(Zn) = 26,03 г». */
export function journalLines(task: LabTask, s: LabTaskSessionState, step: number, lang: LabLang): string[] {
  return task.measurements.filter((m) => m.afterStep < step && s.values[m.key] != null).map((m) => `${m.label} = ${fmtReading(m.instrument, s.values[m.key]!, lang)}`)
}

/* ── Учитель на шаге ── */

const speech = typeof window !== 'undefined' ? new LearnSpeechController() : null

export function TaskTeacherTip({ task, step, lang }: { task: LabTask; step: number; lang: LabLang }) {
  const st = task.steps[Math.min(step, task.steps.length - 1)]
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    speech?.stop()
    setSpeaking(false)
  }, [step, task.id])
  useEffect(() => () => speech?.stop(), [])
  if (!st || step >= task.steps.length) return null
  const text = st.teacher[lang]
  const canSpeak = isSpeechOutputSupported() && lang !== 'uz'
  return (
    <section className={css.teacher} data-lab3d-task-teacher={step}>
      <div className={css.teacherHead}>
        <span className={css.avatar} aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2 8l10 5 10-5-10-5Z" />
            <path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" />
          </svg>
        </span>
        <b>{UI.teacher[lang]}</b>
        {canSpeak ? (
          <button
            type="button"
            className={css.linkBtn}
            onClick={() => {
              if (speaking) {
                speech?.stop()
                setSpeaking(false)
                return
              }
              setSpeaking(true)
              void speech?.speak(st.mistake ? `${text} ${st.mistake[lang]}` : text, lang === 'en' ? 'en' : 'ru', () => setSpeaking(false))
            }}
          >
            {speaking ? UI.stop[lang] : UI.listen[lang]}
          </button>
        ) : null}
      </div>
      <p className={css.teacherText}>{text}</p>
      {st.mistake ? (
        <p className={css.mistake}>
          <b>{UI.mistake[lang]}:</b> {st.mistake[lang]}
        </p>
      ) : null}
    </section>
  )
}

/* ── Расчёт, проверка, сверка ── */

const recorded = new Set<string>()

/** Звёзды попытки: защита надета, шаги не пропущены, расчёт сделан сам. */
export function taskStars(task: LabTask, s: LabTaskSessionState): { safety: boolean; neat: boolean; calc: boolean; total: number } {
  const worn = labEvents.wornGear()
  const safety = (task.gear ?? []).every((g) => worn.includes(g))
  const neat = s.skips === 0
  const calc = s.solved && !s.revealed
  return { safety, neat, calc, total: Number(safety) + Number(neat) + Number(calc) }
}

export function TaskSolve({ taskId, step, lang, variant, onRepeat }: { taskId: LabTaskId; step: number; lang: LabLang; variant: Variant; onRepeat?: () => void }) {
  const task = getLabTask(taskId)
  const s = useLabTaskSession(taskId)!
  const finished = step >= task.steps.length
  const [showSol, setShowSol] = useState(false)
  const uid = useId()
  useEffect(() => setShowSol(false), [s.attempt])
  const rows = useMemo(() => compareRows(task, s.values), [task, s.values])
  const stars = taskStars(task, s)
  // решено — в прогресс и журнал класса (один раз за попытку)
  useEffect(() => {
    if (!s.solved) return
    const key = `${taskId}:${s.attempt}`
    if (recorded.has(key)) return
    recorded.add(key)
    const st = taskStars(task, s)
    recordLabTaskSolved({ taskId, stars: st.total, tries: s.tries, measurements: s.values })
  }, [s, task, taskId])

  if (!finished)
    return (
      <section className={css.card} data-variant={variant}>
        <p className={css.title}>{UI.calc[lang]}</p>
        <p className={css.muted}>{UI.finishFirst[lang]}</p>
      </section>
    )

  const checked = s.checks != null
  const solutionOpen = showSol || s.solved
  return (
    <section className={css.card} data-variant={variant} data-lab3d-task-solve={taskId}>
      <p className={css.title}>{UI.calc[lang]}</p>
      <div className={css.given}>
        <p className={css.sub}>{UI.given[lang]}</p>
        <ul>
          {task.given(s.values, lang).map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>

      <form
        className={css.answers}
        onSubmit={(e) => {
          e.preventDefault()
          labTaskSession.check(taskId)
        }}
      >
        <p className={css.sub}>{UI.answer[lang]}</p>
        {task.answers.map((a, i) => {
          const c = s.checks?.[i]
          return (
            <div key={a.key} className={css.answerRow} data-status={c?.status}>
              <label htmlFor={`${uid}-${a.key}`} className={css.answerLabel}>
                {a.label} =
              </label>
              <input
                id={`${uid}-${a.key}`}
                className={css.input}
                inputMode="decimal"
                autoComplete="off"
                value={s.answers[a.key] ?? ''}
                placeholder={a.exponent ? '0,00' : '0,0'}
                onChange={(e) => labTaskSession.setAnswer(taskId, a.key, e.target.value)}
                data-lab3d-answer={a.key}
              />
              <span className={css.unit}>
                {a.exponent ? `·10${sup(a.exponent)} ` : ''}
                {a.unit[lang]}
              </span>
              <span className={css.answerWhat}>{a.what[lang]}</span>
              {c ? <span className={css.status}>{STATUS[c.status][lang]}</span> : null}
            </div>
          )
        })}
        <div className={css.btnRow}>
          <button type="submit" className={css.primary} data-lab3d-check>
            {UI.check[lang]}
          </button>
          {checked && !s.solved ? (
            <button
              type="button"
              className={css.secondary}
              onClick={() => {
                labTaskSession.reveal(taskId)
                setShowSol(true)
              }}
            >
              {UI.showSolution[lang]}
            </button>
          ) : null}
        </div>
      </form>

      {solutionOpen ? (
        <div className={css.solution}>
          <p className={css.sub}>{UI.solution[lang]}</p>
          <ol>
            {task.solution(s.values, lang).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {checked ? (
        <div className={css.reconcile} data-lab3d-reconcile>
          <p className={css.sub}>{UI.reconcile[lang]}</p>
          <table className={css.cmp}>
            <thead>
              <tr>
                <th />
                <th>{UI.measured[lang]}</th>
                <th>{UI.predicted[lang]}</th>
                <th>{UI.book[lang]}</th>
              </tr>
            </thead>
            <tbody>
              {task.compare.map((c, i) => {
                const r = rows[i]!
                const unit = c.unit === '%' ? '%' : UNITS[c.unit][lang]
                const f = (x: number) => `${fmtNum(x, c.decimals, lang)} ${unit}`
                return (
                  <tr key={i} data-ok={r.withinMethod || undefined}>
                    <th scope="row">{c.label[lang]}</th>
                    <td className={css.strong}>{f(r.measured)}</td>
                    <td>{f(r.predicted)}</td>
                    <td>{f(r.book)}</td>
                    <td className={css.devCell}>
                      {UI.dev[lang]} {r.devPct >= 0 ? '+' : '−'}
                      {fmtNum(Math.abs(r.devPct), 1, lang)} % — {r.withinMethod ? UI.within[lang] : UI.outside[lang]} (±{fmtNum(c.tolerancePct, decimalsFor(c.tolerancePct < 1 ? 0.1 : 1), lang)} %)
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className={css.sub}>{UI.why[lang]}</p>
          <p className={css.whyText}>{task.reconcile[lang]}</p>
        </div>
      ) : null}

      {s.solved ? (
        <div className={css.score} data-lab3d-task-score={stars.total}>
          <p className={css.sub}>
            {UI.stars[lang]} <Stars n={stars.total} />
          </p>
          <ul className={css.scoreList}>
            <li data-on={stars.safety || undefined}>{UI.starSafety[lang]}</li>
            <li data-on={stars.neat || undefined}>{UI.starNeat[lang]}</li>
            <li data-on={stars.calc || undefined}>{UI.starCalc[lang]}</li>
          </ul>
          <p className={css.muted}>{UI.saved[lang]}</p>
          {onRepeat ? (
            <button type="button" className={css.secondary} onClick={onRepeat}>
              {UI.repeat[lang]}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/** Есть ли ответ задачи, засчитанный в этой попытке. */
export function isTaskSolved(s: LabTaskSessionState | null): boolean {
  return !!s?.checks?.every(answerOk)
}
