/**
 * Доска: анимированная иконка жеста шага и блок «Что произошло» — частицы реакции (SVG + CSS, без three),
 * плюс мини-проверка из трёх вопросов с объяснением ответа.
 */
import { useState, type CSSProperties } from 'react'
import type { LabExperimentId, LabLang } from '../labContract'
import { LAB_PARTICLE_STORY, LAB_QUIZ, type LabGestureKind } from '../../../data/labWorks/labExperiments'
import styles from './BoardPanel.module.css'

/* ── Иконка жеста: палец нажимает / тянет по стрелке / проводит черту ── */
export function ActionIcon({ kind }: { kind: LabGestureKind }) {
  return (
    <svg className={styles.actIcon} data-kind={kind} viewBox="0 0 96 72" aria-hidden>
      {kind === 'tap' ? <circle className={styles.actRipple} cx="40" cy="30" r="14" /> : null}
      {kind === 'drag' ? (
        <>
          <path d="M14 56 Q 46 6 82 22" className={styles.actPath} />
          <circle cx="82" cy="22" r="9" className={styles.actGoal} />
        </>
      ) : null}
      {kind === 'swipe' ? <path d="M12 44 L 84 44" className={styles.actStroke} /> : null}
      <g className={styles.actHand}>
        <path
          d="M36 30 V 16 a 4 4 0 0 1 8 0 V 28 M44 26 a 4 4 0 0 1 8 0 v 4 M52 30 a 4 4 0 0 1 8 0 v 10 a 14 14 0 0 1 -14 14 h -3 a 12 12 0 0 1 -9 -4.5 l -8 -9 a 4 4 0 0 1 6 -5.5 l 4 4"
          fill="#ffffff"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/* ── Частицы реакции ── */
type Pt = readonly [number, number]
interface Atom {
  readonly label: string
  readonly color: string
  readonly r: number
  readonly from: Pt
  readonly to: Pt
  readonly mid?: Pt
  /** Тёмная подпись на светлой частице. */
  readonly dark?: boolean
  /** Электрон: виден только в середине цикла. */
  readonly electron?: boolean
  /** Подпись в конце цикла (Zn → Zn²⁺). */
  readonly toLabel?: string
}

const H = '#ffffff'
const O = '#e04b3a'
const C = '#3a3f46'
const atom = (label: string, color: string, r: number, from: Pt, to: Pt, extra: Partial<Atom> = {}): Atom => ({ label, color, r, from, to, ...extra })

const STORIES: Record<LabExperimentId, { atoms: readonly Atom[]; product?: { at: Pt; w: number; label: string } }> = {
  baso4: {
    atoms: [
      atom('Cl⁻', '#6aa8e8', 17, [60, 70], [74, 92]),
      atom('Cl⁻', '#6aa8e8', 17, [470, 70], [452, 92]),
      atom('H⁺', '#f08080', 12, [170, 175], [150, 160]),
      atom('H⁺', '#f08080', 12, [360, 175], [384, 158]),
      atom('Ba²⁺', '#3fae72', 24, [110, 110], [238, 200]),
      atom('SO₄²⁻', '#f2c14e', 26, [410, 120], [286, 200], { dark: true }),
    ],
    product: { at: [262, 200], w: 124, label: 'BaSO₄↓' },
  },
  'zn-hcl': {
    atoms: [
      atom('Cl⁻', '#6aa8e8', 16, [330, 210], [312, 196]),
      atom('Cl⁻', '#6aa8e8', 16, [470, 150], [456, 168]),
      atom('Zn', '#9aa5b1', 30, [120, 140], [120, 140], { toLabel: 'Zn²⁺' }),
      atom('H⁺', '#f08080', 12, [420, 70], [330, 50], { mid: [196, 112] }),
      atom('H⁺', '#f08080', 12, [430, 200], [354, 50], { mid: [196, 168] }),
      atom('e⁻', '#2f7cf6', 7, [140, 128], [196, 112], { mid: [178, 118], electron: true }),
      atom('e⁻', '#2f7cf6', 7, [140, 152], [196, 168], { mid: [178, 162], electron: true }),
    ],
  },
  'ch4-burn': {
    atoms: [
      atom('C', C, 18, [90, 130], [360, 130]),
      atom('H', H, 11, [90, 98], [440, 104], { dark: true }),
      atom('H', H, 11, [90, 162], [480, 104], { dark: true }),
      atom('H', H, 11, [58, 130], [440, 214], { dark: true }),
      atom('H', H, 11, [122, 130], [480, 214], { dark: true }),
      atom('O', O, 15, [200, 84], [330, 130]),
      atom('O', O, 15, [230, 84], [390, 130]),
      atom('O', O, 15, [200, 176], [460, 82]),
      atom('O', O, 15, [230, 176], [460, 192]),
    ],
  },
  'h2-practical': {
    atoms: [
      atom('H', H, 12, [80, 84], [350, 108], { dark: true }),
      atom('H', H, 12, [108, 84], [410, 108], { dark: true }),
      atom('H', H, 12, [80, 184], [350, 214], { dark: true }),
      atom('H', H, 12, [108, 184], [410, 214], { dark: true }),
      atom('O', O, 16, [210, 118], [380, 84]),
      atom('O', O, 16, [210, 150], [380, 190]),
    ],
  },
  // ионы из раствора собираются в кубическую решётку NaCl, молекулы воды улетают паром
  'salt-purify': {
    atoms: [
      atom('Na⁺', '#9a78d6', 15, [70, 70], [290, 120]),
      atom('Cl⁻', '#54b06a', 19, [150, 190], [330, 120]),
      atom('Na⁺', '#9a78d6', 15, [210, 60], [330, 160]),
      atom('Cl⁻', '#54b06a', 19, [90, 150], [290, 160]),
      atom('Na⁺', '#9a78d6', 15, [190, 130], [370, 120]),
      atom('Cl⁻', '#54b06a', 19, [40, 200], [370, 160]),
      atom('H₂O', '#7fb7ec', 16, [120, 105], [470, 34]),
      atom('H₂O', '#7fb7ec', 16, [230, 190], [500, 70]),
    ],
    product: { at: [330, 140], w: 140, label: 'NaCl' },
  },
  // NH₃ своей электронной парой присоединяет H⁺ от HCl
  nh3: {
    atoms: [
      atom('N', '#3f6fd8', 22, [110, 130], [300, 130]),
      atom('H', H, 11, [80, 102], [270, 100], { dark: true }),
      atom('H', H, 11, [140, 102], [330, 100], { dark: true }),
      atom('H', H, 11, [110, 168], [300, 168], { dark: true }),
      atom('H⁺', '#f08080', 12, [400, 130], [340, 150], { mid: [360, 120] }),
      atom('Cl⁻', '#54b06a', 20, [440, 130], [430, 170], { mid: [445, 150] }),
    ],
    product: { at: [350, 140], w: 210, label: 'NH₄Cl' },
  },
  // Cl₂ забирает по электрону у двух ионов Br⁻: 2Cl⁻ + Br₂
  halogens: {
    atoms: [
      atom('Cl', '#54b06a', 18, [80, 110], [110, 70], { toLabel: 'Cl⁻' }),
      atom('Cl', '#54b06a', 18, [116, 110], [110, 190], { toLabel: 'Cl⁻' }),
      atom('Br⁻', '#a0412d', 21, [360, 80], [380, 130]),
      atom('Br⁻', '#a0412d', 21, [420, 180], [422, 130]),
      atom('e⁻', '#2f7cf6', 7, [350, 92], [110, 84], { mid: [230, 80], electron: true }),
      atom('e⁻', '#2f7cf6', 7, [410, 168], [110, 176], { mid: [250, 180], electron: true }),
    ],
    product: { at: [401, 130], w: 110, label: 'Br₂' },
  },
  // CaO + H₂O: молекула воды присоединяется — две группы OH у кальция
  'water-oxides': {
    atoms: [
      atom('Ca', '#3fae72', 22, [90, 130], [330, 130]),
      atom('O', O, 15, [124, 130], [284, 130]),
      atom('O', O, 15, [240, 168], [376, 130]),
      atom('H', H, 11, [214, 186], [258, 112], { dark: true }),
      atom('H', H, 11, [266, 186], [402, 112], { dark: true }),
    ],
    product: { at: [330, 130], w: 190, label: 'Ca(OH)₂' },
  },
  // CO₂ + Ca(OH)₂: кальций, углерод и три O — в CaCO₃↓, остальное — вода
  co2: {
    atoms: [
      atom('Ca', '#3fae72', 22, [100, 120], [236, 196]),
      atom('O', O, 14, [66, 150], [276, 196]),
      atom('H', H, 10, [44, 172], [446, 96], { dark: true }),
      atom('O', O, 14, [134, 150], [420, 80]),
      atom('H', H, 10, [156, 172], [394, 96], { dark: true }),
      atom('C', C, 16, [380, 150], [318, 196]),
      atom('O', O, 14, [350, 150], [346, 176]),
      atom('O', O, 14, [410, 150], [346, 216]),
    ],
    product: { at: [292, 196], w: 150, label: 'CaCO₃↓' },
  },
  // Mg отдаёт два электрона двум ионам H⁺ — молекула H₂; SO₄²⁻ остаётся в растворе
  'metals-acids': {
    atoms: [
      atom('SO₄²⁻', '#f2c14e', 24, [430, 205], [410, 196], { dark: true }),
      atom('Mg', '#c9d2da', 28, [120, 140], [120, 140], { toLabel: 'Mg²⁺', dark: true }),
      atom('H⁺', '#f08080', 12, [420, 70], [330, 50], { mid: [196, 112] }),
      atom('H⁺', '#f08080', 12, [440, 140], [354, 50], { mid: [196, 168] }),
      atom('e⁻', '#2f7cf6', 7, [140, 128], [196, 112], { mid: [178, 118], electron: true }),
      atom('e⁻', '#2f7cf6', 7, [140, 152], [196, 168], { mid: [178, 162], electron: true }),
    ],
  },
}

const LEFT: Record<LabExperimentId, string> = {
  baso4: 'BaCl₂ + H₂SO₄',
  'zn-hcl': 'Zn + 2HCl',
  'ch4-burn': 'CH₄ + 2O₂',
  'h2-practical': '2H₂ + O₂',
  'salt-purify': 'Na⁺ + Cl⁻ (H₂O↑)',
  nh3: 'NH₃ + HCl',
  halogens: 'Cl₂ + 2Br⁻',
  'water-oxides': 'CaO + H₂O',
  co2: 'CO₂ + Ca(OH)₂',
  'metals-acids': 'Mg + 2H⁺',
}

const UI = {
  what: { ru: 'Что произошло', en: 'What happened', uz: 'Nima sodir bo‘ldi' },
  quiz: { ru: 'Проверь себя', en: 'Check yourself', uz: 'O‘zingizni tekshiring' },
  right: { ru: 'Верно!', en: 'Correct!', uz: 'To‘g‘ri!' },
  wrong: { ru: 'Не совсем.', en: 'Not quite.', uz: 'Unchalik emas.' },
  next: { ru: 'Следующий вопрос', en: 'Next question', uz: 'Keyingi savol' },
  again: { ru: 'Пройти ещё раз', en: 'Try again', uz: 'Qayta topshirish' },
  score: { ru: 'Правильных ответов', en: 'Correct answers', uz: 'To‘g‘ri javoblar' },
  q: { ru: 'Вопрос', en: 'Question', uz: 'Savol' },
} as const

export function ParticleStory({ experimentId, lang }: { experimentId: LabExperimentId; lang: LabLang }) {
  const st = STORIES[experimentId]
  const info = LAB_PARTICLE_STORY[experimentId]
  return (
    <div className={styles.story} data-lab3d-story={experimentId}>
      <p className={styles.label}>{UI.what[lang]}</p>
      <svg className={styles.storySvg} viewBox="0 0 520 250" aria-hidden>
        <rect x="6" y="6" width="508" height="238" rx="18" className={styles.storyBg} />
        <text x="18" y="236" className={styles.storyCap}>
          {LEFT[experimentId]}
        </text>
        {st.product ? (
          <g className={styles.storyProduct}>
            <rect x={st.product.at[0] - st.product.w / 2} y={st.product.at[1] - 30} width={st.product.w} height={60} rx="12" />
            <text x={st.product.at[0]} y={st.product.at[1] - 40} textAnchor="middle">
              {st.product.label}
            </text>
          </g>
        ) : null}
        {st.atoms.map((a, i) => {
          const mid = a.mid ?? ([(a.from[0] + a.to[0]) / 2, (a.from[1] + a.to[1]) / 2] as Pt)
          const vars = {
            '--x0': `${a.from[0]}px`,
            '--y0': `${a.from[1]}px`,
            '--xm': `${mid[0]}px`,
            '--ym': `${mid[1]}px`,
            '--x1': `${a.to[0]}px`,
            '--y1': `${a.to[1]}px`,
          } as CSSProperties
          return (
            <g key={i} className={a.electron ? styles.electron : styles.atom} style={vars}>
              <circle r={a.r} fill={a.color} stroke={a.dark ? '#9aa6b4' : 'rgba(0,0,0,0.18)'} strokeWidth="2" />
              {a.toLabel ? (
                <>
                  <text className={styles.atomLabelA} y={a.r > 14 ? 6 : 4} textAnchor="middle" fill="#fff" fontSize={16}>
                    {a.label}
                  </text>
                  <text className={styles.atomLabelB} y={6} textAnchor="middle" fill="#fff" fontSize={15}>
                    {a.toLabel}
                  </text>
                </>
              ) : (
                <text y={a.r > 14 ? 6 : 4} textAnchor="middle" fill={a.dark ? '#18212b' : '#fff'} fontSize={a.r > 20 ? 15 : a.r > 12 ? 14 : 11}>
                  {a.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className={styles.storyEq}>{info.equation}</p>
      <p className={styles.storyText}>{info.text[lang]}</p>
    </div>
  )
}

export function LabQuiz({ experimentId, lang }: { experimentId: LabExperimentId; lang: LabLang }) {
  const qs = LAB_QUIZ[experimentId]
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const done = i >= qs.length
  const q = qs[Math.min(i, qs.length - 1)]!
  return (
    <div className={styles.quiz} data-lab3d-quiz={experimentId}>
      <p className={styles.label}>
        {UI.quiz[lang]} · {done ? `${UI.score[lang]}: ${score} / ${qs.length}` : `${UI.q[lang]} ${i + 1} / ${qs.length}`}
      </p>
      {done ? (
        <div className={styles.quizDone}>
          <p className={styles.quizScore}>
            {score} / {qs.length}
          </p>
          <button
            type="button"
            className={styles.quizNext}
            onClick={() => {
              setI(0)
              setPick(null)
              setScore(0)
            }}
          >
            ↺ {UI.again[lang]}
          </button>
        </div>
      ) : (
        <>
          <p className={styles.quizQ}>{q.q[lang]}</p>
          <div className={styles.quizOpts}>
            {q.options.map((o, k) => (
              <button
                key={k}
                type="button"
                className={styles.quizOpt}
                data-state={pick == null ? undefined : k === q.correct ? 'right' : k === pick ? 'wrong' : 'off'}
                disabled={pick != null}
                onClick={() => {
                  setPick(k)
                  if (k === q.correct) setScore((s) => s + 1)
                }}
              >
                {o[lang]}
              </button>
            ))}
          </div>
          {pick != null ? (
            <div className={styles.quizWhy} data-ok={pick === q.correct || undefined}>
              <b>{pick === q.correct ? UI.right[lang] : UI.wrong[lang]}</b> {q.why[lang]}
              <button
                type="button"
                className={styles.quizNext}
                onClick={() => {
                  setI(i + 1)
                  setPick(null)
                }}
              >
                {UI.next[lang]} ›
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
