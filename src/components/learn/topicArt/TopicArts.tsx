import type { LearnTopicArtId } from '../../../types/learn'
import { LearnArtShell, LearnArtSvgFrame } from '../LearnArtShell'
import art from '../LearnArtShell.module.css'

type Props = { accent: string; variant: 'hero' | 'compact' }

function strokeW(v: Props['variant']) {
  return v === 'compact' ? 1.6 : 2.2
}

export function renderTopicArt(artId: LearnTopicArtId, props: Props) {
  const { accent, variant } = props
  const sw = strokeW(variant)
  const shellClass = variant === 'compact' ? art.shellCompact : undefined
  return (
    <LearnArtShell accent={accent} className={shellClass}>
      {innerArt(artId, sw)}
    </LearnArtShell>
  )
}

function innerArt(artId: LearnTopicArtId, sw: number) {
  switch (artId) {
    case 'periodicity':
      return (
        <LearnArtSvgFrame>
          <g className={art.orbit} opacity={0.85}>
            <ellipse cx="100" cy="100" rx="78" ry="28" stroke="currentColor" strokeWidth={sw} strokeDasharray="6 10" />
            <ellipse cx="100" cy="100" rx="52" ry="74" stroke="currentColor" strokeWidth={sw * 0.75} strokeDasharray="4 8" />
          </g>
          <circle cx="100" cy="100" r="16" className={art.pulse} fill="currentColor" opacity={0.35} />
          <circle cx="100" cy="100" r="6" fill="currentColor" />
          <circle cx="152" cy="88" r="5" fill="currentColor" opacity={0.8} />
          <circle cx="48" cy="112" r="4" fill="currentColor" opacity={0.65} />
        </LearnArtSvgFrame>
      )
    case 'bond_types':
      return (
        <LearnArtSvgFrame>
          <line x1="40" y1="120" x2="100" y2="80" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <line x1="100" y1="80" x2="160" y2="120" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
          <circle cx="100" cy="80" r="10" className={art.pulse} stroke="currentColor" strokeWidth={sw * 0.6} fill="none" />
          <rect x="52" y="118" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" />
          <rect x="130" y="118" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" />
        </LearnArtSvgFrame>
      )
    case 'oxides_acidic':
      return (
        <LearnArtSvgFrame>
          <line x1="100" y1="40" x2="100" y2="150" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" opacity={0.35} />
          <path d="M70 150 L100 60 L130 150 Z" stroke="currentColor" strokeWidth={sw} fill="none" className={art.drift} />
          <circle cx="100" cy="52" r="8" fill="currentColor" opacity={0.85} className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'oxides_basic':
      return (
        <LearnArtSvgFrame>
          <rect x="70" y="70" width="60" height="60" rx="8" stroke="currentColor" strokeWidth={sw} fill="none" className={art.pulse} />
          <path d="M85 130 L100 95 L115 130" stroke="currentColor" strokeWidth={sw} fill="none" />
          <circle cx="100" cy="88" r="6" fill="currentColor" />
        </LearnArtSvgFrame>
      )
    case 'oxides_amphoteric':
      return (
        <LearnArtSvgFrame>
          <path d="M60 130 Q100 50 140 130" stroke="currentColor" strokeWidth={sw} fill="none" />
          <path d="M60 70 Q100 150 140 70" stroke="currentColor" strokeWidth={sw * 0.75} fill="none" opacity={0.65} />
          <circle cx="100" cy="100" r="10" fill="currentColor" opacity={0.4} className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'acids_strong':
      return (
        <LearnArtSvgFrame>
          <path d="M88 40 L112 40 L118 150 L82 150 Z" stroke="currentColor" strokeWidth={sw} fill="none" />
          <path d="M94 55 h12 M94 70 h12 M94 85 h8" stroke="currentColor" strokeWidth={sw * 0.55} />
          <circle cx="100" cy="120" r="22" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'acids_weak':
      return (
        <LearnArtSvgFrame>
          <circle cx="100" cy="100" r="48" stroke="currentColor" strokeWidth={sw} strokeDasharray="10 14" className={art.orbitSlow} />
          <circle cx="100" cy="100" r="22" stroke="currentColor" strokeWidth={sw * 0.8} fill="none" />
          <text x="100" y="106" textAnchor="middle" fill="currentColor" fontSize="14" opacity={0.9}>
            ⇄
          </text>
        </LearnArtSvgFrame>
      )
    case 'bases_alkali':
      return (
        <LearnArtSvgFrame>
          <path d="M92 45 L108 45 L112 155 L88 155 Z" stroke="currentColor" strokeWidth={sw} fill="none" />
          <path d="M78 155 h44" stroke="currentColor" strokeWidth={sw * 1.2} strokeLinecap="round" />
          <circle cx="100" cy="72" r="4" fill="currentColor" className={art.pulse} />
          <path d="M130 90 Q155 100 130 110" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" opacity={0.7} />
        </LearnArtSvgFrame>
      )
    case 'salts_ionic':
      return (
        <LearnArtSvgFrame>
          <g className={art.drift}>
            <circle cx="78" cy="100" r="14" stroke="currentColor" strokeWidth={sw} fill="none" />
            <circle cx="122" cy="100" r="14" stroke="currentColor" strokeWidth={sw} fill="none" />
            <line x1="92" y1="100" x2="108" y2="100" stroke="currentColor" strokeWidth={sw * 0.5} opacity={0.4} />
          </g>
          <circle cx="100" cy="58" r="5" fill="currentColor" opacity={0.75} className={art.pulse} />
          <circle cx="100" cy="142" r="5" fill="currentColor" opacity={0.75} className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'salts_solubility':
      return (
        <LearnArtSvgFrame>
          <rect x="55" y="70" width="90" height="70" rx="10" stroke="currentColor" strokeWidth={sw} fill="none" />
          <path d="M75 115 L95 95 L115 115 L135 95" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" className={art.drift} />
          <circle cx="100" cy="52" r="6" fill="currentColor" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'gases_nitrogen':
      return (
        <LearnArtSvgFrame>
          <path d="M70 120 Q100 60 130 120" stroke="currentColor" strokeWidth={sw} fill="none" />
          <circle cx="88" cy="98" r="16" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" />
          <circle cx="118" cy="98" r="12" stroke="currentColor" strokeWidth={sw * 0.7} fill="none" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'gases_sulfur':
      return (
        <LearnArtSvgFrame>
          <circle cx="100" cy="105" r="38" stroke="currentColor" strokeWidth={sw} fill="none" />
          <circle cx="100" cy="105" r="22" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" className={art.orbitSlow} />
          <circle cx="100" cy="88" r="8" fill="currentColor" />
        </LearnArtSvgFrame>
      )
    case 'halogens_intro':
      return (
        <LearnArtSvgFrame>
          <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth={sw} strokeDasharray="4 10" className={art.orbit} />
          <line x1="100" y1="60" x2="100" y2="140" stroke="currentColor" strokeWidth={sw} />
          <circle cx="100" cy="100" r="10" fill="currentColor" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'metals_activity':
      return (
        <LearnArtSvgFrame>
          <rect x="70" y="80" width="60" height="50" rx="6" stroke="currentColor" strokeWidth={sw} fill="none" />
          <line x1="52" y1="105" x2="68" y2="105" stroke="currentColor" strokeWidth={sw} />
          <polygon points="48,105 56,100 56,110" fill="currentColor" />
          <text x="100" y="112" textAnchor="middle" fill="currentColor" fontSize="11" opacity={0.85}>
            CuO
          </text>
        </LearnArtSvgFrame>
      )
    case 'redox_intro':
      return (
        <LearnArtSvgFrame>
          <path d="M50 120 C80 60 120 60 150 120" stroke="currentColor" strokeWidth={sw} fill="none" />
          <text x="55" y="135" fill="currentColor" fontSize="11">
            e⁻
          </text>
          <text x="138" y="135" fill="currentColor" fontSize="11">
            Ox
          </text>
          <circle cx="100" cy="78" r="14" stroke="currentColor" strokeWidth={sw} fill="none" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'electrolysis_intro':
      return (
        <LearnArtSvgFrame>
          <line x1="100" y1="50" x2="100" y2="150" stroke="currentColor" strokeWidth={sw * 0.5} strokeDasharray="4 6" />
          <line x1="60" y1="70" x2="60" y2="130" stroke="currentColor" strokeWidth={sw} />
          <line x1="140" y1="70" x2="140" y2="130" stroke="currentColor" strokeWidth={sw} />
          <path d="M70 95 Q100 110 130 95" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" className={art.drift} />
          <circle cx="75" cy="118" r="4" fill="currentColor" className={art.pulse} />
          <circle cx="125" cy="118" r="4" fill="currentColor" className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'water_chemistry':
      return (
        <LearnArtSvgFrame>
          <path d="M100 55 L118 95 L82 95 Z" stroke="currentColor" strokeWidth={sw} fill="none" className={art.drift} />
          <circle cx="92" cy="118" r="5" stroke="currentColor" strokeWidth={sw * 0.5} fill="none" />
          <circle cx="108" cy="128" r="4" stroke="currentColor" strokeWidth={sw * 0.5} fill="none" />
          <path d="M55 150 Q100 120 145 150" stroke="currentColor" strokeWidth={sw * 0.5} opacity={0.45} fill="none" />
        </LearnArtSvgFrame>
      )
    case 'qual_analysis':
      return (
        <LearnArtSvgFrame>
          <rect x="70" y="60" width="60" height="90" rx="8" stroke="currentColor" strokeWidth={sw} fill="none" />
          <rect x="78" y="110" width="44" height="28" rx="4" fill="currentColor" opacity={0.25} className={art.pulse} />
          <circle cx="100" cy="82" r="10" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" />
        </LearnArtSvgFrame>
      )
    case 'industrial_touch':
      return (
        <LearnArtSvgFrame>
          <rect x="60" y="85" width="80" height="40" rx="6" stroke="currentColor" strokeWidth={sw} fill="none" />
          <path d="M60 105 H40 M140 105 H160 M100 85 V65" stroke="currentColor" strokeWidth={sw * 0.8} />
          <circle cx="100" cy="58" r="10" stroke="currentColor" strokeWidth={sw} fill="none" className={art.orbitSlow} />
        </LearnArtSvgFrame>
      )
    case 'safety_lab':
      return (
        <LearnArtSvgFrame>
          <path d="M70 140 L100 55 L130 140 Z" stroke="currentColor" strokeWidth={sw} fill="none" />
          <text x="100" y="118" textAnchor="middle" fill="currentColor" fontSize="22">
            !
          </text>
          <circle cx="100" cy="100" r="52" stroke="currentColor" strokeWidth={sw * 0.5} fill="none" opacity={0.35} className={art.pulse} />
        </LearnArtSvgFrame>
      )
    case 'lab_invite':
      return (
        <LearnArtSvgFrame>
          <path
            d="M88 150 V85 Q88 55 100 55 Q112 55 112 85 V150"
            stroke="currentColor"
            strokeWidth={sw}
            fill="none"
          />
          <path d="M78 85 H122" stroke="currentColor" strokeWidth={sw} />
          <circle cx="92" cy="118" r="4" fill="currentColor" className={art.pulse} />
          <circle cx="108" cy="128" r="3" fill="currentColor" className={art.pulse} />
          <circle cx="100" cy="72" r="5" stroke="currentColor" strokeWidth={sw * 0.6} fill="none" className={art.orbit} />
        </LearnArtSvgFrame>
      )
    default:
      return (
        <LearnArtSvgFrame>
          <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth={sw} opacity={0.5} />
        </LearnArtSvgFrame>
      )
  }
}
