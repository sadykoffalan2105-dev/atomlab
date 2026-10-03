/**
 * Содержимое электронной доски (1280 × 720 CSS px): выбор опыта, уравнение, оборудование и ТБ,
 * шаги с отметками, текущая инструкция, наблюдение, вывод. Крупные элементы (≥ 56 px) — для пальцев.
 */
import { useState } from 'react'
import type { BoardPanelProps, LabExperimentDef, LabLang } from '../labContract'
import { LAB_EXPERIMENTS, getLabExperiment } from '../../../data/labWorks/labExperiments'
import styles from './BoardPanel.module.css'

type UiKey =
  | 'experiments'
  | 'page'
  | 'grade'
  | 'equipment'
  | 'safety'
  | 'steps'
  | 'step'
  | 'observation'
  | 'conclusion'
  | 'back'
  | 'next'
  | 'repeat'
  | 'tapHint'
  | 'done'
  | 'exchange'
  | 'combustion'
  | 'substitution'
  | 'hide'

const UI: Record<UiKey, Record<LabLang, string>> = {
  experiments: { ru: 'Опыты', en: 'Experiments', uz: 'Tajribalar' },
  page: { ru: 'с.', en: 'p.', uz: 'b.' },
  grade: { ru: 'класс', en: 'grade', uz: 'sinf' },
  equipment: { ru: 'Оборудование и вещества', en: 'Equipment and substances', uz: 'Jihozlar va moddalar' },
  safety: { ru: 'Техника безопасности', en: 'Safety rules', uz: 'Xavfsizlik texnikasi' },
  steps: { ru: 'Ход работы', en: 'Procedure', uz: 'Ish tartibi' },
  step: { ru: 'Шаг', en: 'Step', uz: 'Qadam' },
  observation: { ru: 'Наблюдение', en: 'Observation', uz: 'Kuzatish' },
  conclusion: { ru: 'Вывод', en: 'Conclusion', uz: 'Xulosa' },
  back: { ru: 'Назад', en: 'Back', uz: 'Orqaga' },
  next: { ru: 'Далее', en: 'Next', uz: 'Keyingi' },
  repeat: { ru: 'Повторить', en: 'Repeat', uz: 'Qaytarish' },
  tapHint: {
    ru: 'Нажмите на подсвеченный предмет на столе',
    en: 'Tap the highlighted item on the bench',
    uz: 'Stoldagi yoritilgan buyumni bosing',
  },
  done: { ru: 'Опыт выполнен', en: 'Experiment complete', uz: 'Tajriba bajarildi' },
  exchange: { ru: 'Обмен', en: 'Exchange', uz: 'Almashinish' },
  combustion: { ru: 'Горение', en: 'Combustion', uz: 'Yonish' },
  substitution: { ru: 'Замещение', en: 'Substitution', uz: 'O‘rin olish' },
  hide: { ru: 'Скрыть', en: 'Hide', uz: 'Yashirish' },
}

function KindTag({ def, lang }: { def: LabExperimentDef; lang: LabLang }) {
  return (
    <span className={styles.kind} data-kind={def.kind}>
      {UI[def.kind][lang]}
    </span>
  )
}

export function BoardPanel({ experimentId, step, lang, onSelectExperiment, onStep }: BoardPanelProps) {
  const def = getLabExperiment(experimentId)
  const total = def.steps.length
  const s = Math.max(0, Math.min(step, total))
  const finished = s >= total
  const [info, setInfo] = useState<'none' | 'equipment' | 'safety'>('none')
  const current = finished ? null : def.steps[s]
  const lastDone = s > 0 ? def.steps[s - 1] : null

  return (
    <div className={styles.board} data-lab3d-board lang={lang}>
      <aside className={styles.side}>
        <p className={styles.sideTitle}>{UI.experiments[lang]}</p>
        {LAB_EXPERIMENTS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={styles.card}
            data-active={e.id === experimentId || undefined}
            data-kind={e.kind}
            onClick={() => onSelectExperiment(e.id)}
            data-lab3d-exp={e.id}
          >
            <span className={styles.cardTop}>
              <KindTag def={e} lang={lang} />
              <span className={styles.cardPage}>
                {e.grade} {UI.grade[lang]} · {UI.page[lang]} {e.page}
              </span>
            </span>
            <span className={styles.cardTitle}>{e.title[lang]}</span>
            <span className={styles.cardEq}>{e.equation}</span>
          </button>
        ))}
      </aside>

      <section className={styles.main}>
        <header className={styles.head}>
          <div className={styles.headMeta}>
            <KindTag def={def} lang={lang} />
            <span className={styles.source}>
              {def.source[lang]} · {UI.page[lang]} {def.page}
            </span>
          </div>
          <h2 className={styles.title}>{def.title[lang]}</h2>
          <p className={styles.equation}>{def.equation}</p>
          <div className={styles.infoBtns}>
            <button
              type="button"
              className={styles.chipBtn}
              data-on={info === 'equipment' || undefined}
              onClick={() => setInfo(info === 'equipment' ? 'none' : 'equipment')}
            >
              {UI.equipment[lang]}
            </button>
            <button
              type="button"
              className={styles.chipBtn}
              data-tone="safety"
              data-on={info === 'safety' || undefined}
              onClick={() => setInfo(info === 'safety' ? 'none' : 'safety')}
            >
              {UI.safety[lang]}
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <ol className={styles.steps} aria-label={UI.steps[lang]}>
            {def.steps.map((st, i) => (
              <li key={st.id}>
                <button
                  type="button"
                  className={styles.stepRow}
                  data-state={i < s ? 'done' : i === s ? 'current' : 'todo'}
                  onClick={() => onStep(i)}
                >
                  <span className={styles.stepNum} aria-hidden>
                    {i < s ? '✓' : i + 1}
                  </span>
                  <span className={styles.stepText}>{st.instruction[lang]}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className={styles.focus}>
            {info !== 'none' ? (
              <div className={styles.infoPanel} data-tone={info}>
                <div className={styles.infoHead}>
                  <p className={styles.label}>{info === 'equipment' ? UI.equipment[lang] : UI.safety[lang]}</p>
                  <button type="button" className={styles.smallBtn} onClick={() => setInfo('none')}>
                    {UI.hide[lang]}
                  </button>
                </div>
                <ul className={styles.infoList}>
                  {(info === 'equipment' ? def.equipment : def.safety).map((x) => (
                    <li key={x.ru}>{x[lang]}</li>
                  ))}
                </ul>
              </div>
            ) : finished ? (
              <div className={styles.doneCard}>
                <p className={styles.label}>{UI.done[lang]}</p>
                {lastDone?.observation ? <p className={styles.obsText}>{lastDone.observation[lang]}</p> : null}
                <p className={styles.label}>{UI.conclusion[lang]}</p>
                <p className={styles.conclusion}>{def.conclusion[lang]}</p>
              </div>
            ) : (
              <>
                <div className={styles.instruction}>
                  <p className={styles.label}>
                    {UI.step[lang]} {s + 1} / {total}
                  </p>
                  <p className={styles.instrText}>{current?.instruction[lang]}</p>
                  <p className={styles.tapHint}>{UI.tapHint[lang]}</p>
                </div>
                {lastDone?.observation ? (
                  <div className={styles.observation}>
                    <p className={styles.label}>{UI.observation[lang]}</p>
                    <p className={styles.obsText}>{lastDone.observation[lang]}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <footer className={styles.nav}>
          <button type="button" className={styles.navBtn} disabled={s <= 0} onClick={() => onStep(s - 1)}>
            ‹ {UI.back[lang]}
          </button>
          <div className={styles.progress} aria-hidden>
            {def.steps.map((st, i) => (
              <span key={st.id} className={styles.dot} data-done={i < s || undefined} data-current={i === s || undefined} />
            ))}
          </div>
          {finished ? (
            <button type="button" className={styles.navBtnPrimary} onClick={() => onStep(0)}>
              ↺ {UI.repeat[lang]}
            </button>
          ) : (
            <button type="button" className={styles.navBtnPrimary} onClick={() => onStep(s + 1)}>
              {UI.next[lang]} ›
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
