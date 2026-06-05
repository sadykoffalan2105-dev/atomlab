import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { MessageKey } from '../../../../../i18n/messagesRu'
import { useT } from '../../../../../i18n/useT'
import { SYNTHESIS_PERF } from '../../../../../lab/synthesisPerfPreset'
import { PureMixLabScene } from './PureMixLabScene'
import shellStyles from './CyberGameShell.module.css'
import styles from './PureMixLabGame.module.css'

type SampleDef = {
  id: string
  bin: 'pure' | 'mix'
  label: MessageKey
  formula: MessageKey
  micro: MessageKey
  hint: MessageKey
  separation?: 'filter' | 'distill' | 'magnet'
}

const SAMPLES: SampleDef[] = [
  {
    id: 'water',
    bin: 'pure',
    label: 'learn.g7.c1.s01.game.task5.water',
    formula: 'learn.g7.c1.s01.game.task5.formula.water',
    micro: 'learn.g7.c1.s01.game.task5.micro.water',
    hint: 'learn.g7.c1.s01.game.task5.hint.water',
  },
  {
    id: 'air',
    bin: 'mix',
    label: 'learn.g7.c1.s01.game.task5.air',
    formula: 'learn.g7.c1.s01.game.task5.formula.air',
    micro: 'learn.g7.c1.s01.game.task5.micro.air',
    hint: 'learn.g7.c1.s01.game.task5.hint.air',
    separation: 'distill',
  },
  {
    id: 'cu',
    bin: 'pure',
    label: 'learn.g7.c1.s01.game.task5.cu',
    formula: 'learn.g7.c1.s01.game.task5.formula.cu',
    micro: 'learn.g7.c1.s01.game.task5.micro.cu',
    hint: 'learn.g7.c1.s01.game.task5.hint.cu',
  },
  {
    id: 'milk',
    bin: 'mix',
    label: 'learn.g7.c1.s01.game.task5.milk',
    formula: 'learn.g7.c1.s01.game.task5.formula.milk',
    micro: 'learn.g7.c1.s01.game.task5.micro.milk',
    hint: 'learn.g7.c1.s01.game.task5.hint.milk',
    separation: 'filter',
  },
  {
    id: 'sugar',
    bin: 'pure',
    label: 'learn.g7.c1.s01.game.task5.sugar',
    formula: 'learn.g7.c1.s01.game.task5.formula.sugar',
    micro: 'learn.g7.c1.s01.game.task5.micro.sugar',
    hint: 'learn.g7.c1.s01.game.task5.hint.sugar',
  },
  {
    id: 'soil',
    bin: 'mix',
    label: 'learn.g7.c1.s01.game.task5.soil',
    formula: 'learn.g7.c1.s01.game.task5.formula.soil',
    micro: 'learn.g7.c1.s01.game.task5.micro.soil',
    hint: 'learn.g7.c1.s01.game.task5.hint.soil',
    separation: 'filter',
  },
]

type Phase = 'sort' | 'separate' | 'fly'

type GameProps = {
  accent: string
  onScore: (score: number, total: number) => void
  onWin: () => void
  onFeedback: (msg: string | null) => void
  resetToken: number
}

const TOTAL_POINTS = SAMPLES.length + 3

export function PureMixLabGame({ accent, onScore, onWin, onFeedback, resetToken }: GameProps) {
  const { t } = useT()
  const [order, setOrder] = useState(() => SAMPLES.map((s) => s.id))
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('sort')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [flyTarget, setFlyTarget] = useState<'pure' | 'mix' | null>(null)
  const [highlight, setHighlight] = useState<'pure' | 'mix' | null>(null)
  const [locked, setLocked] = useState(false)

  const shuffle = useCallback(() => {
    return [...SAMPLES].sort(() => Math.random() - 0.5).map((s) => s.id)
  }, [])

  useEffect(() => {
    setOrder(shuffle())
    setIdx(0)
    setPhase('sort')
    setScore(0)
    setStreak(0)
    setFlyTarget(null)
    setHighlight(null)
    setLocked(false)
    onFeedback(null)
    onScore(0, TOTAL_POINTS)
  }, [resetToken, shuffle, onFeedback, onScore])

  const sample = useMemo(() => {
    const id = order[idx]
    return SAMPLES.find((s) => s.id === id) ?? SAMPLES[0]
  }, [order, idx])

  const advance = useCallback(
    (finalScore: number) => {
      setFlyTarget(null)
      setHighlight(null)
      setLocked(false)
      setPhase('sort')
      onFeedback(null)
      if (idx + 1 >= order.length) {
        if (finalScore >= 7) onWin()
        return
      }
      setIdx((i) => i + 1)
    },
    [idx, order.length, onFeedback, onWin],
  )

  const afterFly = useCallback(
    (nextScore: number) => {
      window.setTimeout(() => {
        onScore(nextScore, TOTAL_POINTS)
        advance(nextScore)
      }, 520)
    },
    [advance, onScore],
  )

  const pickBin = (bin: 'pure' | 'mix') => {
    if (locked || phase !== 'sort') return
    setLocked(true)
    setHighlight(bin)
    const ok = sample.bin === bin
    const nextScore = score + (ok ? 1 : 0)
    setScore(nextScore)
    if (ok) {
      setStreak((s) => s + 1)
      onFeedback(t('learn.g7.c1.s01.game.correct'))
      if (sample.bin === 'mix' && sample.separation) {
        setPhase('separate')
        setLocked(false)
        setHighlight(null)
        return
      }
      setPhase('fly')
      setFlyTarget(bin)
      afterFly(nextScore)
    } else {
      setStreak(0)
      onFeedback(t('learn.g7.c1.s01.game.task5.hintReveal', { hint: t(sample.hint) }))
      window.setTimeout(() => {
        setLocked(false)
        setHighlight(null)
      }, 1100)
    }
  }

  const pickSeparation = (method: 'filter' | 'distill' | 'magnet') => {
    if (locked || phase !== 'separate' || !sample.separation) return
    setLocked(true)
    const ok = method === sample.separation
    const nextScore = score + (ok ? 1 : 0)
    setScore(nextScore)
    onFeedback(
      ok ? t('learn.g7.c1.s01.game.task5.sepOk') : t('learn.g7.c1.s01.game.task5.sepBad'),
    )
    setPhase('fly')
    setFlyTarget('mix')
    afterFly(nextScore)
  }

  if (idx >= order.length && !flyTarget) return null

  return (
    <div className={styles.arena} style={{ ['--game-accent' as string]: accent }}>
      {streak >= 2 ? (
        <span className={styles.streak}>{t('learn.g7.c1.s01.game.task5.streak', { streak })}</span>
      ) : null}

      <div className={styles.canvasWrap}>
        <span className={styles.scanBadge}>{t('learn.g7.c1.s01.game.task5.scanning')}</span>
        <Canvas
          className={styles.canvas}
          camera={{ position: [0, 0.2, 3.2], fov: 44 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={SYNTHESIS_PERF.cyberCanvasDpr}
          frameloop="always"
        >
          <Suspense fallback={null}>
            <PureMixLabScene
              sampleId={sample.id}
              flyTarget={flyTarget}
              highlightPortal={highlight}
            />
          </Suspense>
        </Canvas>
      </div>

      <p className={shellStyles.gamePrompt}>
        {phase === 'separate'
          ? t('learn.g7.c1.s01.game.task5.sepPrompt', { name: t(sample.label) })
          : t('learn.g7.c1.s01.game.task5.prompt3d', { name: t(sample.label) })}
      </p>

      <div className={styles.clueRow}>
        <div className={styles.clue}>
          <span className={styles.clueLabel}>{t('learn.g7.c1.s01.game.task5.clueFormula')}</span>
          {t(sample.formula)}
        </div>
        <div className={styles.clue}>
          <span className={styles.clueLabel}>{t('learn.g7.c1.s01.game.task5.clueMicro')}</span>
          {t(sample.micro)}
        </div>
        <div className={styles.clue}>
          <span className={styles.clueLabel}>{t('learn.g7.c1.s01.game.task5.clueLeft')}</span>
          {t('learn.g7.c1.s01.game.task5.remaining', { count: order.length - idx })}
        </div>
      </div>

      {phase === 'separate' ? (
        <div className={shellStyles.gameChoices}>
          <button
            type="button"
            className={shellStyles.choiceBtn}
            disabled={locked}
            onClick={() => pickSeparation('filter')}
          >
            {t('learn.g7.c1.s01.game.task5.sep.filter')}
          </button>
          <button
            type="button"
            className={shellStyles.choiceBtn}
            disabled={locked}
            onClick={() => pickSeparation('distill')}
          >
            {t('learn.g7.c1.s01.game.task5.sep.distill')}
          </button>
          <button
            type="button"
            className={shellStyles.choiceBtn}
            disabled={locked}
            onClick={() => pickSeparation('magnet')}
          >
            {t('learn.g7.c1.s01.game.task5.sep.magnet')}
          </button>
        </div>
      ) : (
        <div className={styles.portalRow}>
          <button
            type="button"
            className={[styles.portalBtn, styles.portalBtnPure].join(' ')}
            disabled={locked || phase === 'fly'}
            onClick={() => pickBin('pure')}
          >
            {t('learn.g7.c1.s01.game.task5.binPure')}
            <span className={styles.portalSub}>{t('learn.g7.c1.s01.game.task5.portalPure')}</span>
          </button>
          <button
            type="button"
            className={[styles.portalBtn, styles.portalBtnMix].join(' ')}
            disabled={locked || phase === 'fly'}
            onClick={() => pickBin('mix')}
          >
            {t('learn.g7.c1.s01.game.task5.binMix')}
            <span className={styles.portalSub}>{t('learn.g7.c1.s01.game.task5.portalMix')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
