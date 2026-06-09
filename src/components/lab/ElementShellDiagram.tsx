import { bohrShellCountsFromConfig } from '../../data/elementConfigDisplay'
import styles from './ElementShellDiagram.module.css'

type Props = {
  fullConfig: string
  cpkHex: string
  symbol: string
  z: number
}

export function ElementShellDiagram({ fullConfig, cpkHex, symbol, z }: Props) {
  const shells = bohrShellCountsFromConfig(fullConfig)
  if (shells.length === 0) return null

  const uid = `${symbol}-${z}`
  const cpk = `#${cpkHex.replace(/^#/, '')}`
  const cx = 100
  const cy = 100
  const maxR = 72

  return (
    <figure className={styles.wrap} aria-label={symbol}>
      <svg viewBox="0 0 200 200" className={styles.svg} role="img">
        <defs>
          <radialGradient id={`bg-${uid}`} cx="50%" cy="48%" r="58%">
            <stop offset="0%" stopColor="#1a3a6a" />
            <stop offset="55%" stopColor="#0e1a32" />
            <stop offset="100%" stopColor="#060a14" />
          </radialGradient>
          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="42%">
            <stop offset="0%" stopColor="#5ce0ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#5ce0ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`nuc-${uid}`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor={cpk} />
            <stop offset="55%" stopColor="#c62828" />
            <stop offset="100%" stopColor="#7f1010" />
          </radialGradient>
          <radialGradient id={`e-${uid}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ffe566" />
            <stop offset="100%" stopColor="#e6a800" />
          </radialGradient>
        </defs>

        <rect width="200" height="200" rx="16" fill={`url(#bg-${uid})`} />
        <ellipse cx={cx} cy={cy} rx="88" ry="88" fill={`url(#glow-${uid})`} />

        {shells.map((count, i) => {
          const r = 22 + ((i + 1) / shells.length) * maxR
          const dots = Math.min(count, 20)
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.88)"
                strokeWidth="1.6"
              />
              {Array.from({ length: dots }, (_, j) => {
                const angle = (j / dots) * Math.PI * 2 - Math.PI / 2
                const ex = cx + Math.cos(angle) * r
                const ey = cy + Math.sin(angle) * r
                return (
                  <g key={j}>
                    <circle cx={ex} cy={ey} r={7} fill={`url(#e-${uid})`} stroke="#fff8" strokeWidth="0.6" />
                    <text
                      x={ex}
                      y={ey + 2.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#5a3a00"
                    >
                      −
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        <circle
          cx={cx}
          cy={cy}
          r={18}
          fill={`url(#nuc-${uid})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.2"
        />
        <ellipse cx={cx - 5} cy={cy - 6} rx="8" ry="5" fill="rgba(255,255,255,0.22)" />
        <text x={cx} y={cy + 5.5} textAnchor="middle" className={styles.nucleusLabel} fontSize="14">
          {symbol}
        </text>
      </svg>
      <figcaption className={styles.caption}>
        {shells.map((c, i) => (
          <span key={i} className={styles.chip}>
            K{i + 1}: {c}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
