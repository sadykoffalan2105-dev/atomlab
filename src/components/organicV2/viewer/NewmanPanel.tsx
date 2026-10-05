/**
 * Органика v2 — проекция Ньюмена (SVG) + график торсионной энергии V(φ) + ползунок угла.
 * Школьник крутит половину молекулы вокруг одинарной связи и видит, как меняются конформации.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { OV2Lang } from '../contracts'
import { conformationName, cpkColor, torsionEnergy, type NewmanData } from './molMath'
import { CONFORMATION_T, VIEWER_T } from './i18n'
import styles from './Molecule3D.module.css'

interface Props {
  readonly data: NewmanData
  readonly phi: number
  readonly onPhi: (phi: number) => void
  readonly lang: OV2Lang
  readonly caption: string
}

const labelColor = (el: string) => (el === 'C' || el === 'H' ? undefined : cpkColor(el))

export function NewmanPanel({ data, phi, onPhi, lang, caption }: Props) {
  const t = VIEWER_T[lang]
  const [playing, setPlaying] = useState(false)
  const phiRef = useRef(phi)
  phiRef.current = phi
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = now - last
      last = now
      onPhi((phiRef.current + dt * 0.06) % 360)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, onPhi])

  const R = 50
  const r0 = 22
  const pt = (deg: number, rad: number) => {
    const a = (deg * Math.PI) / 180
    return [Math.sin(a) * rad, -Math.cos(a) * rad] as const
  }
  const e = torsionEnergy(phi, data.pair)
  const conf = conformationName(phi, data.pair)
  const presets: readonly [number, string][] =
    data.pair === 'XX'
      ? [
          [0, CONFORMATION_T[lang].syn.split(' ')[0]],
          [60, CONFORMATION_T[lang].gauche.split(' ')[0]],
          [120, CONFORMATION_T[lang].eclipsed],
          [180, CONFORMATION_T[lang].anti.split(' ')[0]],
        ]
      : [
          [0, CONFORMATION_T[lang].eclipsed],
          [60, CONFORMATION_T[lang].staggered],
        ]

  const chart = useMemo(() => {
    const W = 200
    const H = 84
    let max = 0
    const vals: number[] = []
    for (let p = 0; p <= 360; p += 5) {
      const v = torsionEnergy(p, data.pair)
      vals.push(v)
      max = Math.max(max, v)
    }
    const y = (v: number) => H - 6 - (v / (max || 1)) * (H - 16)
    const d = vals.map((v, k) => `${k ? 'L' : 'M'}${((k * 5 * W) / 360).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    return { W, H, d, y, max }
  }, [data.pair])

  return (
    <div className={styles.newman} data-ov2-newman="">
      <div className={styles.newmanHead}>
        <strong>{t.newman}</strong>
        <span>{caption}</span>
      </div>
      <div className={styles.newmanBody}>
        <svg viewBox="-78 -78 156 156" className={styles.newmanSvg} aria-label={t.newman}>
          {/* задний атом: круг и связи от края круга */}
          {data.back.map((s) => {
            const [x1, y1] = pt(s.angle, r0)
            const [x2, y2] = pt(s.angle, R)
            const [lx, ly] = pt(s.angle, R + 13)
            return (
              <g key={`b${s.atom}`} className={styles.nmBack}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} />
                <text x={lx} y={ly + 4} textAnchor="middle" style={{ fill: labelColor(s.el) }}>
                  {s.label}
                </text>
              </g>
            )
          })}
          <circle r={r0} className={styles.nmCircle} />
          {data.front.map((s) => {
            const [x2, y2] = pt(s.angle, R - 6)
            const [lx, ly] = pt(s.angle, R + 7)
            return (
              <g key={`f${s.atom}`} className={styles.nmFront}>
                <line x1={0} y1={0} x2={x2} y2={y2} />
                <text x={lx} y={ly + 4} textAnchor="middle" style={{ fill: labelColor(s.el) }}>
                  {s.label}
                </text>
              </g>
            )
          })}
          <circle r={2.4} className={styles.nmDot} />
        </svg>
        <div className={styles.newmanRight}>
          <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className={styles.energySvg} aria-label={t.energy}>
            <path d={chart.d} className={styles.energyLine} />
            <line x1={(phi * chart.W) / 360} x2={(phi * chart.W) / 360} y1={2} y2={chart.H - 4} className={styles.energyCursor} />
            <circle cx={(phi * chart.W) / 360} cy={chart.y(e)} r={4} className={styles.energyDot} />
          </svg>
          <div className={styles.energyRead}>
            <b>{e.toFixed(1)}</b> {t.kj} · <span>{conf === 'between' ? CONFORMATION_T[lang].between : CONFORMATION_T[lang][conf]}</span>
          </div>
        </div>
      </div>
      <div className={styles.newmanCtl}>
        <button type="button" className={styles.playBtn} onClick={() => setPlaying((p) => !p)} aria-label="play">
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(phi)}
          onChange={(ev) => {
            setPlaying(false)
            onPhi(Number(ev.target.value))
          }}
          aria-label={t.dihedral}
        />
        <span className={styles.phiVal}>φ {Math.round(phi)}°</span>
      </div>
      <div className={styles.presets}>
        {presets.map(([p, name]) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPlaying(false)
              onPhi(p)
            }}
          >
            {p}° {name}
          </button>
        ))}
      </div>
    </div>
  )
}
