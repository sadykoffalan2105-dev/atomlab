import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { CyberGameDef } from '../../../../../learn/learnCyberGames'
import type { MessageKey } from '../../../../../i18n/messagesRu'
import { useT } from '../../../../../i18n/useT'
import { CyberGameShell } from './CyberGameShell'
import { PureMixLabGame } from './PureMixLabGame'
import shellStyles from './CyberGameShell.module.css'

const CyberExploreCanvas = lazy(() =>
  import('../explore/CyberExploreCanvas').then((m) => ({ default: m.CyberExploreCanvas })),
)

type GameProps = {
  accent: string
  onScore: (score: number, total: number) => void
  onWin: () => void
  onFeedback: (msg: string | null) => void
  resetToken: number
}

/* ── Task 1: свойство / структура ── */
const TASK1_ROUNDS = [
  { q: 'learn.g7.c1.s01.game.task1.q1', a: 'molecule', choices: ['molecule', 'lattice', 'physical'] as const },
  { q: 'learn.g7.c1.s01.game.task1.q2', a: 'lattice', choices: ['molecule', 'lattice', 'physical'] as const },
  { q: 'learn.g7.c1.s01.game.task1.q3', a: 'physical', choices: ['molecule', 'lattice', 'physical'] as const },
  { q: 'learn.g7.c1.s01.game.task1.q4', a: 'molecule', choices: ['molecule', 'lattice', 'physical'] as const },
  { q: 'learn.g7.c1.s01.game.task1.q5', a: 'physical', choices: ['molecule', 'lattice', 'physical'] as const },
] as const

function StructureQuizGame({ onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setRound(0)
    setScore(0)
    setPicked(null)
    setDone(false)
    onFeedback(null)
    onScore(0, TASK1_ROUNDS.length)
  }, [resetToken, onFeedback, onScore])

  const cur = TASK1_ROUNDS[round]
  if (done) return null

  const label = (c: string) =>
    t(
      c === 'molecule'
        ? 'learn.g7.c1.s01.game.task1.choice.molecule'
        : c === 'lattice'
          ? 'learn.g7.c1.s01.game.task1.choice.lattice'
          : 'learn.g7.c1.s01.game.task1.choice.physical',
    )

  const pick = (c: string) => {
    if (picked) return
    setPicked(c)
    const ok = c === cur.a
    const nextScore = score + (ok ? 1 : 0)
    setScore(nextScore)
    onScore(nextScore, TASK1_ROUNDS.length)
    onFeedback(
      ok ? t('learn.g7.c1.s01.game.correct') : t('learn.g7.c1.s01.game.wrong'),
    )
    window.setTimeout(() => {
      if (round + 1 >= TASK1_ROUNDS.length) {
        setDone(true)
        if (nextScore >= 4) onWin()
      } else {
        setRound((r) => r + 1)
        setPicked(null)
        onFeedback(null)
      }
    }, 700)
  }

  if (!cur) return null

  return (
    <>
      <p className={shellStyles.gamePrompt}>{t(cur.q)}</p>
      <div className={shellStyles.gameChoices}>
        {cur.choices.map((c) => (
          <button
            key={c}
            type="button"
            disabled={!!picked}
            className={[
              shellStyles.choiceBtn,
              picked === c ? (c === cur.a ? shellStyles.choiceBtnOk : shellStyles.choiceBtnBad) : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => pick(c)}
          >
            {label(c)}
          </button>
        ))}
      </div>
    </>
  )
}

/* ── Task 2: синтез H₂O ── */
function CosmicSynthesisGame({ onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [h, setH] = useState(0)
  const [o, setO] = useState(0)

  useEffect(() => {
    setH(0)
    setO(0)
    onFeedback(null)
    onScore(0, 1)
  }, [resetToken, onFeedback, onScore])

  const trySynth = () => {
    if (h === 2 && o === 1) {
      onScore(1, 1)
      onFeedback(t('learn.g7.c1.s01.game.task2.ok'))
      onWin()
    } else {
      onFeedback(t('learn.g7.c1.s01.game.task2.bad'))
    }
  }

  return (
    <>
      <p className={shellStyles.gamePrompt}>{t('learn.g7.c1.s01.game.task2.prompt')}</p>
      <div className={shellStyles.slotRow}>
        <span className={shellStyles.token}>H × {h}</span>
        <span className={shellStyles.token}>O × {o}</span>
      </div>
      <div className={shellStyles.gameChoices}>
        <button type="button" className={shellStyles.choiceBtn} onClick={() => setH((n) => Math.min(4, n + 1))}>
          + H
        </button>
        <button type="button" className={shellStyles.choiceBtn} onClick={() => setO((n) => Math.min(3, n + 1))}>
          + O
        </button>
        <button type="button" className={shellStyles.choiceBtn} onClick={() => { setH(0); setO(0) }}>
          {t('learn.g7.c1.s01.cyber.explore.reset')}
        </button>
        <button type="button" className={shellStyles.choiceBtn} onClick={trySynth}>
          {t('learn.g7.c1.s01.game.task2.synth')}
        </button>
      </div>
      <Suspense fallback={null}>
        <div style={{ height: 160, marginTop: 8 }}>
          <CyberExploreCanvas taskId="task2" hotspotId="chamber" animate resetToken={resetToken} />
        </div>
      </Suspense>
    </>
  )
}

/* ── Task 3: отрасль ── */
const TASK3_PAIRS = [
  { id: 'energy', clue: 'learn.g7.c1.s01.game.task3.clue.energy', label: 'learn.g7.c1.s01.game.task3.energy' },
  { id: 'nano', clue: 'learn.g7.c1.s01.game.task3.clue.nano', label: 'learn.g7.c1.s01.game.task3.nano' },
  { id: 'factory', clue: 'learn.g7.c1.s01.game.task3.clue.factory', label: 'learn.g7.c1.s01.game.task3.factory' },
  { id: 'recycle', clue: 'learn.g7.c1.s01.game.task3.clue.recycle', label: 'learn.g7.c1.s01.game.task3.recycle' },
] as const

function TechMatchGame({ onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const prompts = useMemo(
    () => [...TASK3_PAIRS].sort(() => Math.random() - 0.5),
    [resetToken],
  )
  const cur = prompts[round]

  useEffect(() => {
    setRound(0)
    setScore(0)
    setDone(false)
    onFeedback(null)
    onScore(0, TASK3_PAIRS.length)
  }, [resetToken, onFeedback, onScore])

  if (done) return null

  const pick = (id: string) => {
    if (!cur) return
    const ok = id === cur.id
    const next = score + (ok ? 1 : 0)
    setScore(next)
    onScore(next, TASK3_PAIRS.length)
    onFeedback(ok ? t('learn.g7.c1.s01.game.correct') : t('learn.g7.c1.s01.game.wrong'))
    window.setTimeout(() => {
      if (round + 1 >= TASK3_PAIRS.length) {
        setDone(true)
        if (next >= 3) onWin()
      } else {
        setRound((r) => r + 1)
        onFeedback(null)
      }
    }, 600)
  }

  if (!cur) return null

  return (
    <>
      <p className={shellStyles.gamePrompt}>{t('learn.g7.c1.s01.game.task3.prompt', { clue: t(cur.clue) })}</p>
      <div className={shellStyles.gameChoices}>
        {TASK3_PAIRS.map((p) => (
          <button key={p.id} type="button" className={shellStyles.choiceBtn} onClick={() => pick(p.id)}>
            {t(p.label)}
          </button>
        ))}
      </div>
    </>
  )
}

/* ── Task 4: очистка ── */
const ECO_STEPS = ['intake', 'filter', 'clean'] as const

const ECO_STEP_KEYS: Record<(typeof ECO_STEPS)[number], MessageKey> = {
  intake: 'learn.g7.c1.s01.game.task4.intake',
  filter: 'learn.g7.c1.s01.game.task4.filter',
  clean: 'learn.g7.c1.s01.game.task4.clean',
}

function EcoPipelineGame({ onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [seq, setSeq] = useState<string[]>([])

  useEffect(() => {
    setSeq([])
    onFeedback(null)
    onScore(0, 1)
  }, [resetToken, onFeedback, onScore])

  const add = (step: string) => {
    if (seq.length >= 3) return
    const next = [...seq, step]
    setSeq(next)
    if (next.length === 3) {
      const ok =
        next[0] === 'intake' && next[1] === 'filter' && next[2] === 'clean'
      if (ok) {
        onScore(1, 1)
        onFeedback(t('learn.g7.c1.s01.game.task4.ok'))
        onWin()
      } else {
        onFeedback(t('learn.g7.c1.s01.game.task4.bad'))
        window.setTimeout(() => setSeq([]), 800)
      }
    }
  }

  return (
    <>
      <p className={shellStyles.gamePrompt}>{t('learn.g7.c1.s01.game.task4.prompt')}</p>
      <div className={shellStyles.slotRow}>
        {seq.map((s) => (
          <span key={s} className={shellStyles.token}>
            {t(ECO_STEP_KEYS[s as (typeof ECO_STEPS)[number]])}
          </span>
        ))}
      </div>
      <div className={shellStyles.gameChoices}>
        {ECO_STEPS.map((s) => (
          <button key={s} type="button" className={shellStyles.choiceBtn} onClick={() => add(s)}>
            {t(ECO_STEP_KEYS[s])}
          </button>
        ))}
      </div>
    </>
  )
}

/* ── Task 6: формула ── */
const FORMULA_TARGETS = [
  { id: 'h2o', need: ['H', 'H', 'O'], label: 'H₂O' },
  { id: 'co2', need: ['C', 'O', 'O'], label: 'CO₂' },
  { id: 'nacl', need: ['Na', 'Cl'], label: 'NaCl' },
] as const

function FormulaBuildGame({ onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [targetIdx, setTargetIdx] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const target = FORMULA_TARGETS[targetIdx]

  useEffect(() => {
    setTargetIdx(0)
    setPicked([])
    setScore(0)
    setDone(false)
    onFeedback(null)
    onScore(0, FORMULA_TARGETS.length)
  }, [resetToken, onFeedback, onScore])

  const addEl = (el: string) => {
    if (!target || picked.length >= target.need.length) return
    const next = [...picked, el]
    setPicked(next)
    if (next.length === target.need.length) {
      const ok = next.every((v, i) => v === target.need[i])
      const nextScore = score + (ok ? 1 : 0)
      setScore(nextScore)
      onScore(nextScore, FORMULA_TARGETS.length)
      onFeedback(ok ? t('learn.g7.c1.s01.game.correct') : t('learn.g7.c1.s01.game.wrong'))
      window.setTimeout(() => {
        setPicked([])
        if (targetIdx + 1 >= FORMULA_TARGETS.length) {
          setDone(true)
          if (nextScore >= 2) onWin()
        } else {
          setTargetIdx((i) => i + 1)
          onFeedback(null)
        }
      }, 700)
    }
  }

  if (done || !target) return null

  return (
    <>
      <p className={shellStyles.gamePrompt}>
        {t('learn.g7.c1.s01.game.task6.prompt', { formula: target.label })}
      </p>
      <div className={shellStyles.slotRow}>
        {picked.map((el, i) => (
          <span key={`${el}-${i}`} className={shellStyles.token}>
            {el}
          </span>
        ))}
      </div>
      <div className={shellStyles.gameChoices}>
        {['H', 'O', 'C', 'Na', 'Cl'].map((el) => (
          <button key={el} type="button" className={shellStyles.choiceBtn} onClick={() => addEl(el)}>
            {el}
          </button>
        ))}
      </div>
    </>
  )
}

export function CyberGamePlayer({
  game,
  accent,
  onClose,
}: {
  game: CyberGameDef
  accent: string
  onClose: () => void
}) {
  const { t } = useT()
  const [resetToken, setResetToken] = useState(0)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(1)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [won, setWon] = useState(false)

  const handleReset = useCallback(() => {
    setResetToken((n) => n + 1)
    setWon(false)
    setFeedback(null)
  }, [])

  const gameProps: GameProps = {
    accent,
    resetToken,
    onScore: (s, tot) => {
      setScore(s)
      setTotal(tot)
    },
    onWin: () => setWon(true),
    onFeedback: setFeedback,
  }

  let body = null
  switch (game.id) {
    case 'structure-quiz':
      body = <StructureQuizGame {...gameProps} />
      break
    case 'cosmic-synthesis':
      body = <CosmicSynthesisGame {...gameProps} />
      break
    case 'tech-match':
      body = <TechMatchGame {...gameProps} />
      break
    case 'eco-pipeline':
      body = <EcoPipelineGame {...gameProps} />
      break
    case 'pure-mix-sort':
      body = <PureMixLabGame {...gameProps} />
      break
    case 'formula-build':
      body = <FormulaBuildGame {...gameProps} />
      break
  }

  return (
    <CyberGameShell
      title={t(game.titleKey)}
      intro={t(game.introKey)}
      score={score}
      total={total}
      feedback={feedback}
      accent={accent}
      onClose={onClose}
      onReset={handleReset}
    >
      {won ? <p className={shellStyles.winBanner}>{t(game.winKey)}</p> : body}
    </CyberGameShell>
  )
}
