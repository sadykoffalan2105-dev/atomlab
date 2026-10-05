/**
 * Органика v2 — 2D-формула по координатам RDKit (atoms[].p2, единица ≈ длина связи), чистый SVG.
 *  - skeletal: скелетная формула учебника — вершины C без подписи (C без соседей-C подписан: CH₄, CH₃–OH),
 *    гетероатомы с H («OH», «NH₂», «HO» — если связь приходит справа), вторая линия двойной связи — внутрь цикла
 *    или к заместителям, у концевой (C=O, =CH₂) — симметрично; тройная — 3 линии; бензол — кольцо Кекуле.
 *  - structural: развёрнутая структурная — все атомы и связи, H подписаны.
 * Рисунок вписывается в рамку (viewBox), цвета — из токенов темы (светлая/тёмная).
 */
import { useMemo } from 'react'
import type { Formula2DProps } from './contracts'
import type { OV2Molecule } from '../../data/organicV2/types'
import styles from './viewer/Formula2D.module.css'

const S = 40 // px на единицу p2
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const subDigits = (n: number) => String(n).replace(/\d/g, (d) => SUBS[Number(d)])

interface Label {
  readonly i: number
  readonly x: number
  readonly y: number
  /** текст до главного символа (H, H₂) */
  readonly pre: string
  readonly main: string
  /** текст после главного символа (H, H₃, ⁺) */
  readonly post: string
  /** H под символом (атом в середине цепи) */
  readonly below: string
  readonly el: string
  readonly small: boolean
}

interface Line {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly thin?: boolean
}

export interface Formula2DLayout {
  readonly lines: readonly Line[]
  readonly labels: readonly Label[]
  readonly dots: readonly { readonly i: number; readonly x: number; readonly y: number }[]
  readonly viewBox: string
  readonly fontSize: number
}

/** Раскладка 2D-формулы (чистая функция — используется и в тестах). */
export function layoutFormula2D(mol: Pick<OV2Molecule, 'atoms' | 'bonds' | 'rings'>, kind: 'skeletal' | 'structural'): Formula2DLayout {
  const n = mol.atoms.length
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const b of mol.bonds) {
    adj[b.a].push(b.b)
    adj[b.b].push(b.a)
  }
  const isH = (i: number) => mol.atoms[i].el === 'H'
  // атомы, которые рисуем: в скелетной — тяжёлые (и H, если молекула — H₂ или H не при тяжёлом атоме)
  const shown = mol.atoms.map((a, i) => kind === 'structural' || a.el !== 'H' || adj[i].every((j) => isH(j)))
  const X = (i: number) => mol.atoms[i].p2[0] * S
  const Y = (i: number) => -mol.atoms[i].p2[1] * S
  const hCount = (i: number) => adj[i].filter((j) => isH(j) && !shown[j]).length

  const labels: Label[] = []
  const labelled = new Set<number>()
  // этан, этилен, ацетилен: голая черта неоднозначна — подписываем все C (H₃C–CH₃, H₂C=CH₂, HC≡CH)
  const fewC = mol.atoms.filter((a) => a.el === 'C').length <= 2
  for (let i = 0; i < n; i++) {
    if (!shown[i]) continue
    const a = mol.atoms[i]
    const heavyNb = adj[i].filter((j) => shown[j])
    const isLabelled = kind === 'structural' || a.el !== 'C' || fewC || !adj[i].some((j) => mol.atoms[j].el === 'C') || a.ch !== 0
    if (!isLabelled) continue
    labelled.add(i)
    const h = kind === 'structural' ? 0 : hCount(i)
    const hs = h ? `H${h > 1 ? subDigits(h) : ''}` : ''
    const charge = a.ch > 0 ? (a.ch > 1 ? `${a.ch}⁺` : '⁺') : a.ch < 0 ? (a.ch < -1 ? `${-a.ch}⁻` : '⁻') : ''
    // H слева, если все связи приходят справа (HO–, H₂N–)
    let dx = 0
    for (const j of heavyNb) dx += X(j) - X(i)
    const left = hs !== '' && heavyNb.length > 0 && dx > S * 0.3
    // атом в середине цепи (–NH–, >CH– у подписанного C): H под символом, чтобы связи не налезали на подпись
    const below = hs !== '' && heavyNb.length >= 2
    labels.push({
      i,
      x: X(i),
      y: Y(i),
      pre: left && !below ? hs : '',
      main: a.el,
      post: (left || below ? '' : hs) + charge,
      below: below ? hs : '',
      el: a.el,
      small: kind === 'structural' && a.el === 'H',
    })
  }

  const ringOf = (a: number, b: number) => mol.rings.find((r) => r.includes(a) && r.includes(b))
  const centroid = (r: readonly number[]) => {
    let cx = 0
    let cy = 0
    for (const k of r) {
      cx += X(k) / r.length
      cy += Y(k) / r.length
    }
    return [cx, cy] as const
  }
  const trimR = (i: number) => (labelled.has(i) ? (kind === 'structural' && isH(i) ? 0.27 : 0.33) * S : 0)

  const lines: Line[] = []
  const D = 0.17 * S
  for (const b of mol.bonds) {
    if (!shown[b.a] || !shown[b.b]) continue
    const x1 = X(b.a)
    const y1 = Y(b.a)
    const x2 = X(b.b)
    const y2 = Y(b.b)
    const L = Math.hypot(x2 - x1, y2 - y1) || 1
    const ux = (x2 - x1) / L
    const uy = (y2 - y1) / L
    const t1 = trimR(b.a)
    const t2 = trimR(b.b)
    const ax = x1 + ux * t1
    const ay = y1 + uy * t1
    const bx = x2 - ux * t2
    const by = y2 - uy * t2
    const nx = -uy
    const ny = ux
    const seg = (off: number, shrink: number): Line => ({
      x1: ax + nx * off + ux * shrink * (t1 ? 0 : 1),
      y1: ay + ny * off + uy * shrink * (t1 ? 0 : 1),
      x2: bx + nx * off - ux * shrink * (t2 ? 0 : 1),
      y2: by + ny * off - uy * shrink * (t2 ? 0 : 1),
    })
    if (b.o === 1) {
      lines.push(seg(0, 0))
      continue
    }
    if (b.o === 3) {
      lines.push(seg(-D, 0), seg(0, 0), seg(D, 0))
      continue
    }
    // двойная связь
    if (kind === 'skeletal') {
      const ring = ringOf(b.a, b.b)
      let side = 0
      if (ring) {
        const [cx, cy] = centroid(ring)
        side = Math.sign((cx - x1) * nx + (cy - y1) * ny) || 1
      } else {
        const otherA = adj[b.a].filter((j) => j !== b.b && shown[j])
        const otherB = adj[b.b].filter((j) => j !== b.a && shown[j])
        if (otherA.length && otherB.length && !labelled.has(b.a) && !labelled.has(b.b)) {
          let s = 0
          for (const j of [...otherA, ...otherB]) s += (X(j) - x1) * nx + (Y(j) - y1) * ny
          side = Math.sign(s) || 1
        }
      }
      if (side !== 0) {
        lines.push(seg(0, 0), seg(side * D * 1.15, 0.16 * S))
        continue
      }
    }
    lines.push(seg(-D / 2 - 0.5, 0), seg(D / 2 + 0.5, 0))
  }

  // рамка
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    if (!shown[i]) continue
    const lw = labelled.has(i) ? 0.5 * S : 0.2 * S
    minX = Math.min(minX, X(i) - lw - (labels.find((l) => l.i === i)?.pre ? 0.5 * S : 0))
    maxX = Math.max(maxX, X(i) + lw + (labels.find((l) => l.i === i)?.post ? 0.6 * S : 0))
    minY = Math.min(minY, Y(i) - lw)
    maxY = Math.max(maxY, Y(i) + lw)
  }
  if (!Number.isFinite(minX)) {
    minX = -S
    minY = -S
    maxX = S
    maxY = S
  }
  const pad = 0.35 * S
  const vb = `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + 2 * pad).toFixed(1)} ${(maxY - minY + 2 * pad).toFixed(1)}`
  return { lines, labels, dots: [], viewBox: vb, fontSize: 0.5 * S }
}

const EL_CLASS: Record<string, string | undefined> = {
  O: styles.elO, N: styles.elN, Cl: styles.elCl, Br: styles.elBr, I: styles.elI, S: styles.elS, F: styles.elCl, H: styles.elH,
}

export function Formula2D(props: Formula2DProps) {
  const { mol, kind, highlightAtoms } = props
  const lay = useMemo(() => layoutFormula2D(mol, kind), [mol, kind])
  const fs = lay.fontSize
  const hl = highlightAtoms ?? []
  const pos = (i: number) => [mol.atoms[i].p2[0] * S, -mol.atoms[i].p2[1] * S] as const
  return (
    <svg
      className={[styles.svg, props.className].filter(Boolean).join(' ')}
      viewBox={lay.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={mol.formula}
      data-ov2-formula={kind}
    >
      {hl.length > 0 && (
        <g className={styles.hl}>
          {hl.map((i) => {
            const [x, y] = pos(i)
            return <circle key={i} cx={x} cy={y} r={0.34 * S} />
          })}
        </g>
      )}
      <g className={styles.bonds} strokeWidth={kind === 'structural' ? 2.2 : 2.6}>
        {lay.lines.map((l, k) => (
          <line key={k} x1={l.x1.toFixed(1)} y1={l.y1.toFixed(1)} x2={l.x2.toFixed(1)} y2={l.y2.toFixed(1)} />
        ))}
      </g>
      <g className={styles.labels} fontSize={fs}>
        {lay.labels.map((l) => {
          const f = l.small ? fs * 0.82 : fs
          const half = f * 0.34
          const cls = EL_CLASS[l.el] ?? (l.el === 'C' ? styles.elC : styles.elX)
          const anchor = l.pre ? 'end' : l.post ? 'start' : 'middle'
          const x = l.pre ? l.x + half : l.post ? l.x - half : l.x
          return (
            <g key={l.i}>
              <text x={x.toFixed(1)} y={(l.y + f * 0.36).toFixed(1)} textAnchor={anchor} fontSize={f} className={cls}>
                {l.pre}
                {l.main}
                {l.post}
              </text>
              {l.below && (
                <text x={l.x.toFixed(1)} y={(l.y + f * 1.3).toFixed(1)} textAnchor="middle" fontSize={f * 0.9} className={cls}>
                  {l.below}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
