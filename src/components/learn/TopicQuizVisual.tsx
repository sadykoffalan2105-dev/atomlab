import type { ReactNode } from 'react'
import styles from './TopicQuizVisual.module.css'

type Props = {
  visualId: string
  compact?: boolean
}

function SvgFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className={styles.topicQuizVisual}>
      <svg
        className={styles.svg}
        viewBox="0 0 640 400"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={caption}
      >
        <defs>
          <linearGradient id="quizBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0a1020" />
            <stop offset="100%" stopColor="#040810" />
          </linearGradient>
          <radialGradient id="quizGlow" cx="50%" cy="35%" r="55%">
            <stop offset="0%" stopColor="#3dffec" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3dffec" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="640" height="400" fill="url(#quizBg)" />
        <rect width="640" height="400" fill="url(#quizGlow)" />
        {children}
      </svg>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  )
}

function VisualChemistry({ accent }: { accent: string }) {
  return (
    <>
      <ellipse cx="320" cy="210" rx="180" ry="70" fill={accent} opacity="0.08" />
      <circle cx="220" cy="180" r="28" fill="#ff5a6a" opacity="0.85" />
      <circle cx="280" cy="160" r="24" fill="#6bcfff" opacity="0.85" />
      <circle cx="340" cy="190" r="26" fill="#ff5a6a" opacity="0.85" />
      <circle cx="400" cy="170" r="22" fill="#6bcfff" opacity="0.85" />
      <path
        d="M160 280 Q320 220 480 280"
        stroke={accent}
        strokeWidth="3"
        fill="none"
        opacity="0.55"
      />
      <text x="320" y="340" textAnchor="middle" fill="#d8e8ff" fontSize="22" fontWeight="700">
        Вещества и превращения
      </text>
    </>
  )
}

function VisualPureSubstance() {
  return (
    <>
      <rect x="250" y="120" width="140" height="140" rx="12" fill="#1a2848" stroke="#3dffec" strokeWidth="2" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <circle
            key={`${r}-${c}`}
            cx={280 + c * 30}
            cy={150 + r * 30}
            r="8"
            fill="#6bcfff"
            opacity="0.9"
          />
        )),
      )}
      <text x="320" y="310" textAnchor="middle" fill="#d8e8ff" fontSize="20" fontWeight="700">
        Постоянный состав
      </text>
    </>
  )
}

function VisualHomogeneous() {
  return (
    <>
      <rect x="120" y="130" width="180" height="140" rx="16" fill="#102040" stroke="#3dffec" strokeWidth="2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={160 + i * 28} cy={200} r="6" fill="#7afcff" opacity="0.75" />
      ))}
      <rect x="340" y="130" width="180" height="140" rx="16" fill="#102040" stroke="#8899bb" strokeWidth="2" />
      <circle cx="400" cy="180" r="22" fill="#c4a574" opacity="0.9" />
      <circle cx="460" cy="220" r="18" fill="#8899bb" opacity="0.9" />
      <text x="210" y="310" textAnchor="middle" fill="#7dffb0" fontSize="16" fontWeight="700">
        Гомогенная
      </text>
      <text x="430" y="310" textAnchor="middle" fill="#ffb199" fontSize="16" fontWeight="700">
        Гетерогенная
      </text>
    </>
  )
}

function VisualPhysical() {
  return (
    <>
      <rect x="200" y="220" width="80" height="60" rx="8" fill="#a8d8ff" opacity="0.85" />
      <path d="M280 250 L360 250 L340 200 L300 200 Z" fill="#d8f4ff" opacity="0.7" />
      <ellipse cx="320" cy="260" rx="90" ry="24" fill="#3dffec" opacity="0.25" />
      <text x="320" y="120" textAnchor="middle" fill="#d8e8ff" fontSize="22" fontWeight="700">
        Лёд → вода
      </text>
      <text x="320" y="340" textAnchor="middle" fill="#7afcff" fontSize="18">
        Состав H₂O не меняется
      </text>
    </>
  )
}

function VisualChemical() {
  return (
    <>
      <ellipse cx="320" cy="250" rx="70" ry="18" fill="#ff8844" opacity="0.35" />
      <path d="M300 250 Q320 180 340 250" fill="#ffaa44" opacity="0.9" />
      <path d="M290 250 Q310 170 330 250" fill="#ff6622" opacity="0.75" />
      <circle cx="320" cy="200" r="16" fill="#ffee88" opacity="0.95" />
      <text x="320" y="120" textAnchor="middle" fill="#d8e8ff" fontSize="22" fontWeight="700">
        Горение → новые вещества
      </text>
      <text x="320" y="340" textAnchor="middle" fill="#ffb199" fontSize="17">
        CO₂, H₂O и тепло
      </text>
    </>
  )
}

function VisualSafety() {
  return (
    <>
      <path d="M280 280 L280 160 L360 160 L360 280 Z" fill="#1a3050" stroke="#3dffec" strokeWidth="2" />
      <ellipse cx="320" cy="160" rx="40" ry="10" fill="#2a4060" stroke="#3dffec" strokeWidth="2" />
      <path d="M300 200 L320 240 L340 200" stroke="#ff8844" strokeWidth="4" fill="none" />
      <text x="420" y="200" fill="#7afcff" fontSize="16">
        H₂O
      </text>
      <text x="320" y="330" textAnchor="middle" fill="#d8e8ff" fontSize="18" fontWeight="700">
        Кислоту → в воду
      </text>
    </>
  )
}

function VisualFilter() {
  return (
    <>
      <path d="M280 120 L360 120 L340 200 L300 200 Z" fill="#8899bb" opacity="0.5" stroke="#aab" />
      <rect x="295" y="200" width="50" height="80" fill="#c4a574" opacity="0.8" />
      <path d="M270 290 L390 290" stroke="#3dffec" strokeWidth="3" />
      <ellipse cx="320" cy="310" rx="60" ry="14" fill="#3dffec" opacity="0.2" />
      <text x="320" y="360" textAnchor="middle" fill="#d8e8ff" fontSize="18" fontWeight="700">
        Осадок на фильтре
      </text>
    </>
  )
}

function VisualMelting() {
  return (
    <>
      <rect x="240" y="200" width="160" height="40" rx="6" fill="#3dffec" opacity="0.25" />
      <rect x="260" y="160" width="50" height="50" rx="4" fill="#d8f4ff" opacity="0.9" />
      <rect x="330" y="170" width="40" height="35" rx="4" fill="#a8d8ff" opacity="0.55" />
      <text x="320" y="120" textAnchor="middle" fill="#d8e8ff" fontSize="22" fontWeight="700">
        0 °C — плавление
      </text>
    </>
  )
}

function VisualLamp() {
  return (
    <>
      <ellipse cx="320" cy="270" rx="50" ry="14" fill="#2a4060" stroke="#3dffec" />
      <rect x="305" y="180" width="30" height="90" fill="#1a2848" stroke="#8899bb" />
      <path d="M315 160 Q320 130 325 160" fill="#ffaa44" opacity="0.9" />
      <circle cx="320" cy="145" r="10" fill="#ffee88" />
      <text x="320" y="330" textAnchor="middle" fill="#d8e8ff" fontSize="18" fontWeight="700">
        Нагрев в пробирке
      </text>
    </>
  )
}

function VisualSeparation() {
  return (
    <>
      <circle cx="200" cy="220" r="30" fill="#c4a574" />
      <circle cx="240" cy="240" r="8" fill="#fff" opacity="0.9" />
      <circle cx="260" cy="210" r="8" fill="#fff" opacity="0.9" />
      <path d="M300 200 L380 200" stroke="#3dffec" strokeWidth="2" strokeDasharray="6 4" />
      <rect x="400" y="170" width="80" height="80" rx="8" fill="#102040" stroke="#3dffec" />
      <text x="440" y="218" textAnchor="middle" fill="#fff" fontSize="14">
        Соль
      </text>
      <text x="320" y="330" textAnchor="middle" fill="#d8e8ff" fontSize="17" fontWeight="700">
        Раствор → фильтр → выпаривание
      </text>
    </>
  )
}

function VisualStates() {
  return (
    <>
      <rect x="140" y="180" width="100" height="80" rx="8" fill="#8899bb" opacity="0.7" />
      <text x="190" y="230" textAnchor="middle" fill="#fff" fontSize="14">
        Твёрдое
      </text>
      <ellipse cx="320" cy="220" rx="55" ry="30" fill="#3dffec" opacity="0.35" />
      <text x="320" y="225" textAnchor="middle" fill="#fff" fontSize="14">
        Жидкое
      </text>
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={480 + (i % 3) * 22}
          cy={200 + Math.floor(i / 3) * 28}
          r="10"
          fill="#7afcff"
          opacity="0.5"
        />
      ))}
      <text x="500" y="250" textAnchor="middle" fill="#fff" fontSize="14">
        Газ
      </text>
    </>
  )
}

function VisualBurner() {
  return (
    <>
      <rect x="260" y="240" width="120" height="20" rx="4" fill="#444" />
      <circle cx="320" cy="220" r="28" fill="#333" stroke="#666" />
      <path d="M305 200 Q320 160 335 200" fill="#ff8844" opacity="0.85" />
      <text x="320" y="120" textAnchor="middle" fill="#d8e8ff" fontSize="20" fontWeight="700">
        CH₄ + O₂ → CO₂ + H₂O
      </text>
      <text x="320" y="340" textAnchor="middle" fill="#ffb199" fontSize="17">
        Химическая реакция
      </text>
    </>
  )
}

const VISUALS: Record<string, { caption: string; node: ReactNode }> = {
  'c1-t01': { caption: 'Химия изучает вещества и их превращения', node: <VisualChemistry accent="#3dffec" /> },
  'c1-t02': { caption: 'Кристаллическая решётка чистого вещества', node: <VisualPureSubstance /> },
  'c1-t03': { caption: 'Однородная и неоднородная смесь', node: <VisualHomogeneous /> },
  'c1-t04': { caption: 'Физическое явление: плавление', node: <VisualPhysical /> },
  'c1-t05': { caption: 'Химическое явление: горение', node: <VisualChemical /> },
  'c1-t06': { caption: 'Безопасное разбавление кислоты', node: <VisualSafety /> },
  'c1-t07': { caption: 'Фильтрование осадка', node: <VisualFilter /> },
  'c1-t08': { caption: 'Лёд превращается в воду', node: <VisualMelting /> },
  'c1-t09': { caption: 'Спиртовая лампа в лаборатории', node: <VisualLamp /> },
  'c1-t10': { caption: 'Разделение песка и соли', node: <VisualSeparation /> },
  'c1-t11': { caption: 'Агрегатные состояния', node: <VisualStates /> },
  'c1-t12': { caption: 'Горение газа на плите', node: <VisualBurner /> },
}

export function TopicQuizVisual({ visualId, compact = false }: Props) {
  const spec = VISUALS[visualId]
  if (!spec) return null
  return (
    <div className={compact ? styles.compact : undefined}>
      <SvgFrame caption={spec.caption}>{spec.node}</SvgFrame>
    </div>
  )
}

export function hasTopicQuizVisual(visualId?: string): boolean {
  return !!visualId && visualId in VISUALS
}
