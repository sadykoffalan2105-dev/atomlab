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

/** клин стереоцентра: узкий конец (x1, y1) — у стереоцентра; hash — штриховой (связь от нас) */
interface Wedge {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly hash: boolean
}

export interface Formula2DLayout {
  readonly lines: readonly Line[]
  readonly wedges: readonly Wedge[]
  readonly labels: readonly Label[]
  readonly dots: readonly { readonly i: number; readonly x: number; readonly y: number }[]
  readonly viewBox: string
  readonly fontSize: number
  /** положения атомов в px (у развёрнутой H отодвинуты на длину связи) */
  readonly pos: readonly (readonly [number, number])[]
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
  const P = kind === 'structural' ? structuralPositions(mol, adj) : mol.atoms.map((a) => a.p2)
  const X = (i: number) => P[i][0] * S
  const Y = (i: number) => -P[i][1] * S
  const hCount = (i: number) => adj[i].filter((j) => isH(j) && !shown[j]).length

  const labels: Label[] = []
  const labelled = new Set<number>()
  // этан, этилен, ацетилен: голая черта неоднозначна — подписываем все C (H₃C–CH₃, H₂C=CH₂, HC≡CH).
  // С гетероатомами (этанол, уксусная кислота, дихлорэтан) черта уже понятна — обычная скелетная запись.
  const fewC = mol.atoms.filter((a) => a.el === 'C').length <= 2 && mol.atoms.every((a) => a.el === 'C' || a.el === 'H')
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

  // клинья у стереоцентров (R/S) в скелетной: одна связь к заместителю — жирный клин (к нам) или штрих (от нас);
  // что выбрать, решает знак объёма тройки соседей в 3D против той же тройки на рисунке (у клина z = +1)
  const wedgeOf = new Map<string, { from: number; to: number; hash: boolean }>()
  if (kind === 'skeletal') {
    const isStereo = (i: number) => mol.atoms[i].cip != null
    const det3 = (u: readonly number[], v: readonly number[], w: readonly number[]) =>
      u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0])
    for (let c = 0; c < n; c++) {
      if (!isStereo(c) || !shown[c]) continue
      const nb = adj[c].filter((j) => shown[j])
      if (nb.length < 3) continue
      const inRing = (j: number) => mol.rings.some((r) => r.includes(c) && r.includes(j))
      const used = (j: number) => wedgeOf.has(`${Math.min(c, j)}-${Math.max(c, j)}`)
      const cand = nb
        .filter((j) => !used(j) && mol.bonds.some((b) => ((b.a === c && b.b === j) || (b.b === c && b.a === j)) && b.o === 1))
        .sort((x, y) => Number(inRing(x)) - Number(inRing(y)) || Number(isStereo(x)) - Number(isStereo(y)) || adj[x].filter((k) => !isH(k)).length - adj[y].filter((k) => !isH(k)).length)
      const w = cand[0]
      if (w === undefined) continue
      const trio = [w, ...nb.filter((j) => j !== w).slice(0, 2)]
      const pc = mol.atoms[c].p
      const v3 = trio.map((j) => [mol.atoms[j].p[0] - pc[0], mol.atoms[j].p[1] - pc[1], mol.atoms[j].p[2] - pc[2]])
      const q = mol.atoms[c].p2
      const v2 = trio.map((j, k) => [mol.atoms[j].p2[0] - q[0], mol.atoms[j].p2[1] - q[1], k === 0 ? 1 : 0])
      const s3 = det3(v3[0], v3[1], v3[2])
      const s2 = det3(v2[0], v2[1], v2[2])
      if (Math.abs(s2) < 1e-6 || Math.abs(s3) < 1e-6) continue
      wedgeOf.set(`${Math.min(c, w)}-${Math.max(c, w)}`, { from: c, to: w, hash: Math.sign(s2) !== Math.sign(s3) })
    }
  }
  const wedges: Wedge[] = []

  const lines: Line[] = []
  const D = 0.17 * S
  for (const b of mol.bonds) {
    if (!shown[b.a] || !shown[b.b]) continue
    const wd = b.o === 1 ? wedgeOf.get(`${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`) : undefined
    if (wd) {
      const fx = X(wd.from)
      const fy = Y(wd.from)
      const tx = X(wd.to)
      const ty = Y(wd.to)
      const L = Math.hypot(tx - fx, ty - fy) || 1
      const ux = (tx - fx) / L
      const uy = (ty - fy) / L
      const t1 = trimR(wd.from)
      const t2 = trimR(wd.to)
      wedges.push({ x1: fx + ux * t1, y1: fy + uy * t1, x2: tx - ux * t2, y2: ty - uy * t2, hash: wd.hash })
      continue
    }
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
  // маленькие молекулы не раздуваем во весь блок (CH₄ высотой 60 px): рамка не меньше ~6×3,6 длины связи
  let w = maxX - minX + 2 * pad
  let h = maxY - minY + 2 * pad
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  w = Math.max(w, 6 * S)
  h = Math.max(h, 3.6 * S)
  const vb = `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`
  return { lines, wedges, labels, dots: [], viewBox: vb, fontSize: 0.5 * S, pos: P.map((q) => [q[0] * S, -q[1] * S] as const) }
}

/**
 * Развёрнутая формула: RDKit ставит H слишком близко к атому (≈ 0,55 длины связи) — связь C–H пропадает под подписями.
 * Ставим каждый H на полную длину связи и, если он налезает на другой атом или H, поворачиваем вокруг своего атома
 * (±15°, ±30°, … — первое свободное место).
 */
function structuralPositions(mol: Pick<OV2Molecule, 'atoms'>, adj: readonly (readonly number[])[]): (readonly [number, number])[] {
  const n = mol.atoms.length
  const P: [number, number][] = mol.atoms.map((a) => [a.p2[0], a.p2[1]])
  const isH = (i: number) => mol.atoms[i].el === 'H'
  const placed: number[] = []
  for (let i = 0; i < n; i++) if (!isH(i)) placed.push(i)
  const free = (x: number, y: number, self: number) => {
    let m = Infinity
    for (const k of placed) if (k !== self) m = Math.min(m, Math.hypot(P[k][0] - x, P[k][1] - y))
    return m
  }
  for (let h = 0; h < n; h++) {
    if (!isH(h)) continue
    const c = adj[h].find((j) => !isH(j))
    if (c === undefined) {
      placed.push(h)
      continue
    }
    const L = 1.0
    const base = Math.atan2(mol.atoms[h].p2[1] - P[c][1], mol.atoms[h].p2[0] - P[c][0])
    let best: [number, number] = [P[c][0] + Math.cos(base) * L, P[c][1] + Math.sin(base) * L]
    let bestD = free(best[0], best[1], c)
    for (let k = 1; bestD < 0.78 && k <= 8; k++) {
      for (const sg of [1, -1]) {
        const a = base + sg * k * (Math.PI / 12)
        const q: [number, number] = [P[c][0] + Math.cos(a) * L, P[c][1] + Math.sin(a) * L]
        const d = free(q[0], q[1], c)
        // не ставим H поверх связи атома c с соседом
        let onBond = false
        for (const j of adj[c]) {
          if (j === h || isH(j)) continue
          const bj = Math.atan2(P[j][1] - P[c][1], P[j][0] - P[c][0])
          let da = Math.abs(a - bj) % (2 * Math.PI)
          if (da > Math.PI) da = 2 * Math.PI - da
          if (da < 0.5) onBond = true
        }
        if (!onBond && d > bestD) {
          bestD = d
          best = q
        }
      }
    }
    P[h] = best
    placed.push(h)
  }
  return P
}

const EL_CLASS: Record<string, string | undefined> = {
  O: styles.elO, N: styles.elN, Cl: styles.elCl, Br: styles.elBr, I: styles.elI, S: styles.elS, F: styles.elCl, H: styles.elH,
}

export function Formula2D(props: Formula2DProps) {
  const { mol, kind, highlightAtoms } = props
  const lay = useMemo(() => layoutFormula2D(mol, kind), [mol, kind])
  const fs = lay.fontSize
  const hl = highlightAtoms ?? []
  const pos = (i: number) => lay.pos[i] ?? ([0, 0] as const)
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
      <g className={styles.bonds} strokeWidth={kind === 'structural' ? 1.7 : 2.3}>
        {lay.lines.map((l, k) => (
          <line key={k} x1={l.x1.toFixed(1)} y1={l.y1.toFixed(1)} x2={l.x2.toFixed(1)} y2={l.y2.toFixed(1)} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {lay.wedges.length > 0 && (
        <g className={styles.wedges} data-ov2-wedges={lay.wedges.length}>
          {lay.wedges.map((w, k) => {
            const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1
            const nx = (-(w.y2 - w.y1) / L) * 0.15 * S
            const ny = ((w.x2 - w.x1) / L) * 0.15 * S
            if (!w.hash) {
              const pts = `${w.x1.toFixed(1)},${w.y1.toFixed(1)} ${(w.x2 + nx).toFixed(1)},${(w.y2 + ny).toFixed(1)} ${(w.x2 - nx).toFixed(1)},${(w.y2 - ny).toFixed(1)}`
              return <polygon key={k} points={pts} />
            }
            const bars = []
            for (let m = 1; m <= 6; m++) {
              const f = m / 6
              const cx = w.x1 + (w.x2 - w.x1) * f
              const cy = w.y1 + (w.y2 - w.y1) * f
              bars.push(<line key={m} x1={(cx + nx * f).toFixed(1)} y1={(cy + ny * f).toFixed(1)} x2={(cx - nx * f).toFixed(1)} y2={(cy - ny * f).toFixed(1)} vectorEffect="non-scaling-stroke" />)
            }
            return <g key={k}>{bars}</g>
          })}
        </g>
      )}
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
