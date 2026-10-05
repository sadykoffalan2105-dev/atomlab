/**
 * Маленькая скелетная формула для чипа молекулы (по 2D-координатам RDKit, без H; гетероатомы — буквой).
 * Это значок, а не полноценная формула (её рисует Formula2D) — лёгкий SVG, без пересчёта геометрии.
 */
import { memo } from 'react'
import type { OV2Molecule } from '../../../data/organicV2/types'

const HETERO_COLOR: Record<string, string> = { O: '#ef4444', N: '#3b82f6', S: '#ca8a04', Cl: '#16a34a', Br: '#b45309', I: '#7c3aed', F: '#0d9488' }

export const MiniSkeleton = memo(function MiniSkeleton({ mol, size = 44 }: { mol: OV2Molecule; size?: number }) {
  const heavy = mol.atoms.map((a, i) => (a.el === 'H' ? -1 : i)).filter((i) => i >= 0)
  if (heavy.length === 0) return null
  if (heavy.length === 1) {
    const el = mol.atoms[heavy[0]!]!.el
    return (
      <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden>
        <text x="22" y="27" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
          {el === 'C' ? 'CH₄' : el}
        </text>
      </svg>
    )
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const i of heavy) {
    const [x, y] = mol.atoms[i]!.p2
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const pad = 0.7
  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2
  const span = Math.max(w, h)
  const ox = minX - pad - (span - w) / 2
  const oy = minY - pad - (span - h) / 2
  const k = 44 / span
  const X = (i: number) => (mol.atoms[i]!.p2[0] - ox) * k
  // y RDKit вверх — экран вниз
  const Y = (i: number) => 44 - (mol.atoms[i]!.p2[1] - oy) * k
  const stroke = Math.max(0.9, Math.min(2, 2.4 - heavy.length / 30))
  const lines: React.ReactNode[] = []
  mol.bonds.forEach((b, n) => {
    const A = mol.atoms[b.a]!, B = mol.atoms[b.b]!
    if (A.el === 'H' || B.el === 'H') return
    const x1 = X(b.a), y1 = Y(b.a), x2 = X(b.b), y2 = Y(b.b)
    lines.push(<line key={n} x1={x1} y1={y1} x2={x2} y2={y2} />)
    if (b.o >= 2) {
      const dx = x2 - x1, dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const off = Math.min(2.6, len * 0.2)
      const nx = (-dy / len) * off, ny = (dx / len) * off
      lines.push(<line key={`${n}b`} x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} />)
      if (b.o === 3) lines.push(<line key={`${n}c`} x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} />)
    }
  })
  const labels = heavy.length <= 40
    ? heavy.filter((i) => mol.atoms[i]!.el !== 'C').map((i) => {
        const el = mol.atoms[i]!.el
        return (
          <g key={`l${i}`}>
            <circle cx={X(i)} cy={Y(i)} r={3.6} fill="var(--ov2-chip-bg, #fff)" stroke="none" />
            <text x={X(i)} y={Y(i) + 2.6} textAnchor="middle" fontSize="7" fontWeight="800" fill={HETERO_COLOR[el] ?? 'currentColor'} stroke="none">
              {el}
            </text>
          </g>
        )
      })
    : null
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden>
      <g stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">{lines}</g>
      {labels}
    </svg>
  )
})
