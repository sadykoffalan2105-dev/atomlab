import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../../../i18n/useT'
import styles from '../../../pages/LearnResearchLab.module.css'

/** Учебный SN2: нуклеофил должен подойти с «тыла» (~180° к уходящей группе). */
const CX = 58
const CY = 48
const IDEAL_DEG = 180
const TOLERANCE_DEG = 28

function angleFromCenter(cx: number, cy: number, x: number, y: number): number {
  const rad = Math.atan2(y - cy, x - cx)
  let deg = (rad * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

function angleDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Полярная точка в % сцены вокруг C. */
function polar(deg: number, rPct: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return {
    x: CX + Math.cos(rad) * rPct,
    y: CY + Math.sin(rad) * rPct,
  }
}

export function ResearchAttackMode({ onMacro }: { onMacro: (text: string) => void }) {
  const { t } = useT()
  const stageRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => polar(210, 28))
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<'idle' | 'ok' | 'bad'>('idle')

  const liveAngle = useMemo(() => Math.round(angleFromCenter(CX, CY, pos.x, pos.y)), [pos])
  const liveDelta = useMemo(() => Math.round(angleDelta(liveAngle, IDEAL_DEG)), [liveAngle])
  const inZone = liveDelta <= TOLERANCE_DEG

  const moveTo = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * 100
    const y = ((clientY - r.top) / r.height) * 100
    setPos({
      x: Math.min(94, Math.max(6, x)),
      y: Math.min(92, Math.max(8, y)),
    })
    setResult('idle')
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    moveTo(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    moveTo(e.clientX, e.clientY)
  }

  const onPointerUp = () => setDragging(false)

  const check = () => {
    const ok = inZone
    setResult(ok ? 'ok' : 'bad')
    onMacro(ok ? t('learn.research.attackOkMacro') : t('learn.research.attackBadMacro'))
  }

  const idealTip = polar(IDEAL_DEG, 34)
  const lgPos = polar(0, 22)
  const rayColor = inZone ? 'rgba(52, 211, 153, 0.85)' : 'rgba(125, 211, 252, 0.55)'

  return (
    <div>
      <p className={styles.hint}>{t('learn.research.attackHint')}</p>
      <div
        ref={stageRef}
        className={styles.attackStage}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg className={styles.attackPlane} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {/* сетка */}
          {Array.from({ length: 11 }, (_, i) => {
            const v = i * 10
            return (
              <g key={`g-${v}`}>
                <line
                  x1={v}
                  y1={0}
                  x2={v}
                  y2={100}
                  stroke="rgba(100, 140, 190, 0.14)"
                  strokeWidth={v === 50 ? 0.35 : 0.18}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={0}
                  y1={v}
                  x2={100}
                  y2={v}
                  stroke="rgba(100, 140, 190, 0.14)"
                  strokeWidth={v === 50 ? 0.35 : 0.18}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}

          {/* оси через центр C */}
          <line
            x1={0}
            y1={CY}
            x2={100}
            y2={CY}
            stroke="rgba(125, 211, 252, 0.45)"
            strokeWidth={0.45}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={CX}
            y1={0}
            x2={CX}
            y2={100}
            stroke="rgba(125, 211, 252, 0.45)"
            strokeWidth={0.45}
            vectorEffect="non-scaling-stroke"
          />

          {/* зона правильной атаки ~180° */}
          <path
            d={`M ${CX} ${CY} L ${polar(IDEAL_DEG - TOLERANCE_DEG, 36).x} ${polar(IDEAL_DEG - TOLERANCE_DEG, 36).y} A 36 36 0 0 1 ${polar(IDEAL_DEG + TOLERANCE_DEG, 36).x} ${polar(IDEAL_DEG + TOLERANCE_DEG, 36).y} Z`}
            fill="rgba(52, 211, 153, 0.12)"
            stroke="rgba(52, 211, 153, 0.35)"
            strokeWidth={0.35}
            vectorEffect="non-scaling-stroke"
          />

          {/* идеальный вектор атаки */}
          <line
            x1={CX}
            y1={CY}
            x2={idealTip.x}
            y2={idealTip.y}
            stroke="rgba(52, 211, 153, 0.55)"
            strokeWidth={0.5}
            strokeDasharray="1.2 1"
            vectorEffect="non-scaling-stroke"
          />

          {/* луч Nu → C */}
          <line
            x1={pos.x}
            y1={pos.y}
            x2={CX}
            y2={CY}
            stroke={rayColor}
            strokeWidth={0.55}
            vectorEffect="non-scaling-stroke"
          />

          {/* полярные метки углов */}
          {[0, 90, 180, 270].map((deg) => {
            const p = polar(deg, 40)
            return (
              <text
                key={deg}
                x={p.x}
                y={p.y}
                fill="rgba(160, 185, 220, 0.75)"
                fontSize="3.2"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {deg}°
              </text>
            )
          })}
        </svg>

        <div className={styles.attackAxisLabelX} aria-hidden>
          x
        </div>
        <div className={styles.attackAxisLabelY} aria-hidden>
          y
        </div>

        <div className={styles.attackHud} aria-live="polite">
          <span>
            {t('learn.research.attackAngleLive', { n: liveAngle })}
          </span>
          <span className={inZone ? styles.statusOk : styles.hint}>
            {t('learn.research.attackDeltaLive', { n: liveDelta })}
          </span>
        </div>

        <div className={styles.attackCone} aria-hidden />

        <div
          className={styles.leavingGroup}
          style={{ left: `${lgPos.x}%`, top: `${lgPos.y}%` }}
          title={t('learn.research.attackLeaving')}
        >
          LG
        </div>

        <div className={styles.targetAtom} title={t('learn.research.attackCarbon')}>
          C
        </div>
        <div
          className={styles.attacker}
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          role="slider"
          aria-label={t('learn.research.attackNucleophile')}
          aria-valuetext={`${liveAngle}°`}
        >
          Nu⁻
        </div>
      </div>
      <div className={styles.challengeBar} style={{ marginTop: '0.65rem' }}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={check}>
          {t('learn.research.attackCheck')}
        </button>
        {result === 'ok' ? <span className={styles.statusOk}>{t('learn.research.attackOk')}</span> : null}
        {result === 'bad' ? <span className={styles.statusBad}>{t('learn.research.attackBad')}</span> : null}
      </div>
    </div>
  )
}
