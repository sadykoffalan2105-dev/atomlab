import type { CyberTaskDef } from '../../../../../learn/learnCyberDashboard'
import { CyberAtomOrbitSvg } from './CyberAtomOrbitSvg'
import { CyberHotspot } from './CyberHotspot'
import svgStyles from './CyberTaskSceneSvg.module.css'

const VB = '0 0 240 140'

function SvgDefs() {
  return (
    <defs>
      <linearGradient id="cyberGlass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(120,200,255,0.35)" />
        <stop offset="100%" stopColor="rgba(20,60,120,0.15)" />
      </linearGradient>
      <filter id="cyberGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="cyberGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

function Scene1({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      <g filter="url(#cyberGlowStrong)">
        <g className={svgStyles.molCluster}>
          <circle cx="120" cy="58" r="22" fill="none" stroke="#5ecbff" strokeWidth="1" opacity="0.6" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <line
              key={deg}
              x1="120"
              y1="58"
              x2={120 + 28 * Math.cos((deg * Math.PI) / 180)}
              y2={58 + 28 * Math.sin((deg * Math.PI) / 180)}
              stroke="#3dffec"
              strokeWidth="1.2"
              opacity="0.7"
            />
          ))}
          <circle cx="120" cy="58" r="8" fill="#e84a7a" />
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <circle
              key={i}
              cx={120 + 28 * Math.cos((deg * Math.PI) / 180)}
              cy={58 + 28 * Math.sin((deg * Math.PI) / 180)}
              r="5"
              fill="#5ecbff"
            />
          ))}
        </g>
      </g>
      <g transform="translate(168, 88)">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <rect
            key={i}
            x={(i % 3) * 14}
            y={Math.floor(i / 3) * 14}
            width="10"
            height="10"
            fill="url(#cyberGlass)"
            stroke="#3dffec"
            strokeWidth="0.6"
            opacity="0.85"
          />
        ))}
      </g>
      <polyline
        points="24,118 48,98 72,108 96,88 120,102"
        fill="none"
        stroke="#ffe566"
        strokeWidth="1.5"
        filter="url(#cyberGlow)"
      />
      <CyberHotspot id="molecule" cx={120} cy={58} r={32} active={activeHotspot === 'molecule'} onFocus={onFocus} />
      <CyberHotspot id="lattice" cx={186} cy={102} r={22} active={activeHotspot === 'lattice'} onFocus={onFocus} />
      <CyberHotspot id="graph" cx={72} cy={104} r={28} active={activeHotspot === 'graph'} onFocus={onFocus} />
    </svg>
  )
}

function Scene2({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      <g className={svgStyles.synthArmL}>
        <line x1="22" y1="108" x2="58" y2="78" stroke="#6a7a8a" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="58" y1="78" x2="82" y2="62" stroke="#aabbd0" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="82" cy="62" r="4" fill="#ffb347" className={svgStyles.armTipGlow} />
      </g>
      <g className={svgStyles.synthArmR}>
        <line x1="218" y1="108" x2="182" y2="78" stroke="#6a7a8a" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="182" y1="78" x2="158" y2="62" stroke="#aabbd0" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="158" cy="62" r="4" fill="#ffb347" className={svgStyles.armTipGlow} />
      </g>
      <rect x="86" y="30" width="68" height="76" rx="7" fill="url(#cyberGlass)" stroke="#3dffec" strokeWidth="1.3" />
      <text x="120" y="46" textAnchor="middle" className={svgStyles.miniLabel}>
        Vacuum
      </text>
      <g className={svgStyles.chamberMol} transform="translate(120, 72)">
        <circle r="11" fill="none" stroke="#ff9ec4" strokeWidth="1.2" />
        <circle r="5" fill="#7eb6ff" filter="url(#cyberGlow)" />
      </g>
      <g className={svgStyles.flaskL}>
        <path d="M 34 108 L 42 86 L 50 108 Z" fill="url(#cyberGlass)" stroke="#3dffec" strokeWidth="1" />
        <rect x="38" y="92" width="8" height="12" fill="#5cff8a" opacity="0.75" className={svgStyles.flaskLiquidAnim} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={40 + i * 3} cy={100} r="2" className={svgStyles.bubbleDot} style={{ ['--bi' as string]: i }} />
        ))}
      </g>
      <g className={svgStyles.flaskR}>
        <path d="M 190 108 L 198 86 L 206 108 Z" fill="url(#cyberGlass)" stroke="#3dffec" strokeWidth="1" />
        <rect x="194" y="90" width="8" height="14" fill="#ff6b9d" opacity="0.8" className={svgStyles.flaskLiquidAnim} />
        {[1, 2, 3].map((i) => (
          <circle key={i} cx={196 + i * 2} cy={98} r="2" className={svgStyles.bubbleDot} style={{ ['--bi' as string]: i }} />
        ))}
        <text x="200" y="80" className={svgStyles.badgeNew}>
          NEW
        </text>
      </g>
      <CyberHotspot id="chamber" cx={120} cy={68} r={36} active={activeHotspot === 'chamber'} onFocus={onFocus} />
      <CyberHotspot id="robot" cx={52} cy={82} r={28} active={activeHotspot === 'robot'} onFocus={onFocus} />
      <CyberHotspot id="flasks" cx={196} cy={96} r={26} active={activeHotspot === 'flasks'} onFocus={onFocus} />
    </svg>
  )
}

function Scene3({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  const tiles = [
    { id: 'energy', x: 28, y: 36, color: '#ffe566' },
    { id: 'nano', x: 72, y: 36, color: '#3dffec' },
    { id: 'factory', x: 116, y: 36, color: '#7eb6ff' },
    { id: 'recycle', x: 160, y: 36, color: '#5cff8a' },
  ]
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      {tiles.map((t) => (
        <g key={t.id} transform={`translate(${t.x}, ${t.y})`}>
          <rect width="44" height="52" rx="4" fill="rgba(8,20,40,0.85)" stroke={t.color} strokeWidth="1" />
          <rect x="10" y="14" width="24" height="24" rx="3" fill={t.color} opacity="0.35" filter="url(#cyberGlow)" />
        </g>
      ))}
      <CyberHotspot id="energy" cx={50} cy={62} r={26} active={activeHotspot === 'energy'} onFocus={onFocus} />
      <CyberHotspot id="nano" cx={94} cy={62} r={26} active={activeHotspot === 'nano'} onFocus={onFocus} />
      <CyberHotspot id="factory" cx={138} cy={62} r={26} active={activeHotspot === 'factory'} onFocus={onFocus} />
      <CyberHotspot id="recycle" cx={182} cy={62} r={26} active={activeHotspot === 'recycle'} onFocus={onFocus} />
    </svg>
  )
}

function Scene4({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      <rect x="32" y="48" width="36" height="56" rx="4" fill="url(#cyberGlass)" stroke="#5cff8a" strokeWidth="1" />
      <rect x="36" y="72" width="28" height="24" fill="#5cff8a" opacity="0.5" />
      <line x1="68" y1="76" x2="100" y2="76" stroke="#3dffec" strokeWidth="3" />
      <rect x="100" y="52" width="40" height="48" rx="4" fill="url(#cyberGlass)" stroke="#3dffec" strokeWidth="1" />
      <line x1="140" y1="76" x2="172" y2="76" stroke="#3dffec" strokeWidth="3" />
      <rect x="172" y="48" width="36" height="56" rx="4" fill="url(#cyberGlass)" stroke="#5cff8a" strokeWidth="1" />
      <CyberHotspot id="filter" cx={50} cy={76} r={30} active={activeHotspot === 'filter'} onFocus={onFocus} />
      <CyberHotspot id="pipes" cx={120} cy={76} r={50} active={activeHotspot === 'pipes'} onFocus={onFocus} />
    </svg>
  )
}

function Scene5({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      <text x="60" y="28" className={svgStyles.sectionLabel}>
        Pure
      </text>
      <CyberAtomOrbitSvg cx={48} cy={52} />
      <path d="M 88 62 L 96 42 L 104 62 Z" fill="url(#cyberGlass)" stroke="#3dffec" />
      <rect x="92" y="42" width="8" height="10" fill="#5ecbff" opacity="0.7" />
      <text x="60" y="88" className={svgStyles.sectionLabel}>
        Mix
      </text>
      <ellipse cx="52" cy="108" rx="18" ry="10" fill="#6a5040" opacity="0.8" />
      <ellipse cx="100" cy="108" rx="16" ry="9" fill="#4a90c8" opacity="0.6" />
      <text x="140" y="118" className={svgStyles.sectionLabel}>
        Sep.
      </text>
      <line x1="148" y1="48" x2="148" y2="100" stroke="#8899aa" strokeWidth="2" />
      <line x1="168" y1="58" x2="188" y2="58" stroke="#ffe566" strokeWidth="2" />
      <circle cx="208" cy="72" r="14" fill="none" stroke="#ccc" strokeWidth="2" />
      <CyberHotspot id="pure" cx={76} cy={52} r={38} active={activeHotspot === 'pure'} onFocus={onFocus} />
      <CyberHotspot id="mixtures" cx={76} cy={108} r={38} active={activeHotspot === 'mixtures'} onFocus={onFocus} />
      <CyberHotspot id="separation" cx={178} cy={72} r={36} active={activeHotspot === 'separation'} onFocus={onFocus} />
    </svg>
  )
}

function Scene6({
  activeHotspot,
  onFocus,
}: {
  activeHotspot: string | null
  onFocus: (id: string) => void
}) {
  return (
    <svg viewBox={VB} className={svgStyles.svg} aria-hidden>
      <SvgDefs />
      {['H', 'He', 'Li', 'C', 'N', 'O'].map((el, i) => (
        <g key={el} transform={`translate(${24 + (i % 3) * 22}, ${28 + Math.floor(i / 3) * 22})`}>
          <rect width="18" height="18" fill="rgba(8,24,48,0.9)" stroke="#3dffec" strokeWidth="0.8" />
          <text x="9" y="12" textAnchor="middle" className={svgStyles.ptCell}>
            {el}
          </text>
        </g>
      ))}
      <text x="100" y="44" className={svgStyles.formula}>
        H₂O
      </text>
      <text x="100" y="62" className={svgStyles.formula}>
        CO₂
      </text>
      <text x="100" y="80" className={svgStyles.formula}>
        NaCl
      </text>
      <g className={svgStyles.ch4Spin} transform="translate(178, 58)">
        <circle r="6" fill="#333" />
        {[0, 90, 180, 270].map((deg) => (
          <circle
            key={deg}
            cx={16 * Math.cos((deg * Math.PI) / 180)}
            cy={16 * Math.sin((deg * Math.PI) / 180)}
            r="4"
            fill="#5ecbff"
          />
        ))}
      </g>
      <line x1="168" y1="108" x2="208" y2="108" stroke="#aabbd0" strokeWidth="2" />
      <polygon points="188,98 196,118 180,118" fill="#3dffec" opacity="0.5" />
      <CyberHotspot id="periodic" cx={48} cy={48} r={32} active={activeHotspot === 'periodic'} onFocus={onFocus} />
      <CyberHotspot id="formulas" cx={108} cy={62} r={28} active={activeHotspot === 'formulas'} onFocus={onFocus} />
      <CyberHotspot id="ch4" cx={178} cy={58} r={22} active={activeHotspot === 'ch4'} onFocus={onFocus} />
      <CyberHotspot id="scale" cx={188} cy={108} r={24} active={activeHotspot === 'scale'} onFocus={onFocus} />
    </svg>
  )
}

export function CyberTaskSceneSvg({
  task,
  activeHotspot,
  animate,
  onHotspotFocus,
}: {
  task: CyberTaskDef
  activeHotspot: string | null
  animate: boolean
  onHotspotFocus: (hotspotId: string) => void
}) {
  const props = { activeHotspot, onFocus: onHotspotFocus }
  /** Схемы на карточках всегда «живые» — иначе электроны не видны при reduced-motion в ОС */
  const motion = true
  const wrapClass = [svgStyles.wrap, animate || motion ? svgStyles.wrapAnimate : ''].filter(Boolean).join(' ')

  return (
    <div className={wrapClass}>
      {task.id === 'task1' && <Scene1 {...props} />}
      {task.id === 'task2' && <Scene2 {...props} />}
      {task.id === 'task3' && <Scene3 {...props} />}
      {task.id === 'task4' && <Scene4 {...props} />}
      {task.id === 'task5' && <Scene5 {...props} />}
      {task.id === 'task6' && <Scene6 {...props} />}
    </div>
  )
}
