import { useId, type ReactNode } from 'react'
import type { LAtom, LGraph, LPart } from './lewis'

/**
 * Рисунок формулы на доске (SVG): «dots» — электронная формула по § 15 (H:H, H:O:H, O::O, N⋮⋮N, [:Cl:]⁻),
 * «dashes» — структурная (черточки по кратности, стрелка — донорно-акцепторная связь).
 */
export type LewisMode = 'dots' | 'dashes'

const FS = 19
const DOT = 2.4
const INK = 'var(--fb-ink, #1e293b)'
const SHARED = 'var(--fb-shared, #0f766e)'
const SINGLE = 'var(--fb-single, #2563eb)'

type Box = { x0: number; y0: number; x1: number; y1: number }
type Drawn = { nodes: ReactNode[]; box: Box }

const grow = (b: Box, x: number, y: number, r = 0) => {
  b.x0 = Math.min(b.x0, x - r)
  b.y0 = Math.min(b.y0, y - r)
  b.x1 = Math.max(b.x1, x + r)
  b.y1 = Math.max(b.y1, y + r)
}
const halfW = (el: string) => 6.5 + 5 * (el.length - 1)

/** Направления групп электронов вокруг атома: подальше от связей, сначала стороны «крестом». */
const CANDIDATES = (() => {
  const out: number[] = [0, 90, 180, 270, 45, 135, 225, 315]
  for (let a = 0; a < 360; a += 15) if (!out.includes(a)) out.push(a)
  return out.map((d) => (d * Math.PI) / 180)
})()
const angDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI)
  return d > Math.PI ? 2 * Math.PI - d : d
}
function groupDirs(taken: number[], k: number): number[] {
  const used = [...taken]
  const out: number[] = []
  for (let g = 0; g < k; g++) {
    let best = CANDIDATES[0]!
    let bestD = -1
    for (const c of CANDIDATES) {
      const d = used.length ? Math.min(...used.map((u) => angDist(u, c))) : Math.PI
      if (d > bestD + 1e-6) {
        bestD = d
        best = c
      }
    }
    used.push(best)
    out.push(best)
  }
  return out
}

function drawGraph(g: LGraph, mode: LewisMode, key: string, markerId: string, showLone: boolean): Drawn {
  const B = mode === 'dots' ? 50 : 42
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const nodes: ReactNode[] = []
  const P = g.atoms.map((a) => [a.x * B, a.y * B] as [number, number])
  const taken: number[][] = g.atoms.map(() => [])
  g.bonds.forEach((b, k) => {
    const [ax, ay] = P[b.a]!
    const [bx, by] = P[b.b]!
    const dx = bx - ax
    const dy = by - ay
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d
    const px = -uy
    const py = ux
    taken[b.a]!.push(Math.atan2(dy, dx))
    taken[b.b]!.push(Math.atan2(-dy, -dx))
    if (mode === 'dots') {
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const cols = b.order === 1 ? [0] : [-3.2, 3.2]
      for (let r = 0; r < b.order; r++) {
        const rowOff = b.order === 1 ? 0 : (r - (b.order - 1) / 2) * 6.6
        for (const c of cols) {
          // Одна пара — «двоеточие» поперёк связи; несколько — столбики по две точки.
          const offs = b.order === 1 ? [-3.3, 3.3] : [0]
          for (const o of offs) {
            const x = mx + ux * c + px * (rowOff + o)
            const y = my + uy * c + py * (rowOff + o)
            nodes.push(<circle key={`${key}b${k}-${r}-${c}-${o}`} cx={x} cy={y} r={DOT} fill={SHARED} />)
            grow(box, x, y, DOT)
          }
        }
      }
    } else {
      const ra = halfW(g.atoms[b.a]!.el) + 3
      const rb = halfW(g.atoms[b.b]!.el) + 3
      for (let s = 0; s < b.order; s++) {
        const off = (s - (b.order - 1) / 2) * 4.4
        const x1 = ax + ux * ra + px * off
        const y1 = ay + uy * ra + py * off
        const x2 = bx - ux * rb + px * off
        const y2 = by - uy * rb + py * off
        const arrow = b.dative != null && s === b.order - 1
        const rev = arrow && b.dative === b.b
        nodes.push(
          <line
            key={`${key}l${k}-${s}`}
            x1={rev ? x2 : x1}
            y1={rev ? y2 : y1}
            x2={rev ? x1 : x2}
            y2={rev ? y1 : y2}
            stroke={arrow ? SINGLE : INK}
            strokeWidth={2}
            strokeLinecap="round"
            markerEnd={arrow ? `url(#${markerId})` : undefined}
          />,
        )
      }
    }
  })
  g.atoms.forEach((a: LAtom, i) => {
    const [x, y] = P[i]!
    nodes.push(
      <text key={`${key}a${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={FS} fontWeight={700} fill={INK}>
        {a.el}
      </text>,
    )
    grow(box, x - halfW(a.el), y - 11)
    grow(box, x + halfW(a.el), y + 11)
    if (!showLone) return
    const groups = a.lone + a.single
    if (!groups) return
    const dirs = groupDirs(taken[i]!, groups)
    dirs.forEach((th, gi) => {
      const pair = gi < a.lone
      const rx = halfW(a.el) + 6
      const ry = 15
      const cx = x + Math.cos(th) * rx
      const cy = y + Math.sin(th) * ry
      const offs = pair ? [-3.3, 3.3] : [0]
      for (const o of offs) {
        const dx = cx - Math.sin(th) * o
        const dy = cy + Math.cos(th) * o
        nodes.push(<circle key={`${key}e${i}-${gi}-${o}`} cx={dx} cy={dy} r={DOT} fill={pair ? INK : SINGLE} />)
        grow(box, dx, dy, DOT)
      }
    })
  })
  return { nodes, box }
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
export const chargeText = (q: number) => (q === 0 ? '' : `${Math.abs(q) === 1 ? '' : [...String(Math.abs(q))].map((d) => SUP[d]).join('')}${q > 0 ? '⁺' : '⁻'}`)

/** Части в строку: коэффициент, [группа]заряд — и общий viewBox. */
function row(drawn: { d: Drawn | null; label: string; charge: number; count: number; bracket: boolean }[], sep: string): { nodes: ReactNode[]; w: number; h: number; y0: number } {
  const nodes: ReactNode[] = []
  let x = 0
  let y0 = -16
  let y1 = 16
  drawn.forEach((p, k) => {
    if (k > 0 && sep) {
      nodes.push(
        <text key={`sep${k}`} x={x + 9} y={0} textAnchor="middle" dominantBaseline="central" fontSize={FS} fill={INK} opacity={0.6}>
          {sep}
        </text>,
      )
      x += 18
    } else if (k > 0) x += 10
    if (p.count > 1) {
      nodes.push(
        <text key={`c${k}`} x={x} y={0} dominantBaseline="central" fontSize={FS} fontWeight={700} fill={INK}>
          {p.count}
        </text>,
      )
      x += 13
    }
    if (!p.d) {
      nodes.push(
        <text key={`t${k}`} x={x} y={0} dominantBaseline="central" fontSize={FS} fontWeight={700} fill={INK}>
          {p.label}
        </text>,
      )
      x += p.label.length * 10.5
      return
    }
    const b = p.d.box
    const pad = p.bracket ? 7 : 0
    const gx = x + pad - b.x0
    const gy = -(b.y0 + b.y1) / 2
    y0 = Math.min(y0, b.y0 + gy - 4)
    y1 = Math.max(y1, b.y1 + gy + 4)
    nodes.push(
      <g key={`g${k}`} transform={`translate(${gx} ${gy})`}>
        {p.d.nodes}
      </g>,
    )
    const w = b.x1 - b.x0
    if (p.bracket) {
      const top = b.y0 + gy - 4
      const bot = b.y1 + gy + 4
      const l = x + 2
      const r = x + pad * 2 + w - 2
      nodes.push(<path key={`br${k}`} d={`M${l + 4} ${top} H${l} V${bot} H${l + 4} M${r - 4} ${top} H${r} V${bot} H${r - 4}`} fill="none" stroke={INK} strokeWidth={1.6} />)
      nodes.push(
        <text key={`q${k}`} x={r + 2} y={top + 5} fontSize={15} fontWeight={700} fill={p.charge > 0 ? '#b91c1c' : '#1d4ed8'}>
          {chargeText(p.charge)}
        </text>,
      )
      x = r + 4 + chargeText(p.charge).length * 7
    } else x += w
  })
  return { nodes, w: x, h: y1 - y0, y0 }
}

/** SVG электронной / структурной формулы: молекула (graph) или ионы (parts). */
export function FormulaSvg({
  graph,
  parts,
  atoms,
  mode,
  showLone = true,
  label,
}: {
  graph?: LGraph | null
  parts?: LPart[]
  /** атомы до образования связи: H· + ·O· + H· */
  atoms?: { atom: LAtom; count: number }[]
  mode: LewisMode
  showLone?: boolean
  label: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const marker = `fbArrow${uid}`
  let items: { d: Drawn | null; label: string; charge: number; count: number; bracket: boolean }[] = []
  let sep = ''
  if (graph) items = [{ d: drawGraph(graph, mode, 'm', marker, showLone), label: '', charge: graph.charge, count: 1, bracket: graph.charge !== 0 }]
  else if (parts) items = parts.map((p, k) => ({ d: p.graph ? drawGraph(p.graph, mode, `p${k}`, marker, showLone) : null, label: p.label, charge: p.charge, count: p.count, bracket: p.bracket }))
  else if (atoms) {
    sep = '+'
    items = atoms.map((a, k) => ({ d: drawGraph({ atoms: [a.atom], bonds: [], charge: 0 }, 'dots', `v${k}`, marker, true), label: a.atom.el, charge: 0, count: a.count, bracket: false }))
  }
  if (!items.length) return null
  const r = row(items, sep)
  const W = Math.max(40, r.w + 8)
  return (
    <svg className="fbSvg" viewBox={`-4 ${r.y0 - 2} ${W} ${r.h + 4}`} role="img" aria-label={label} style={{ maxWidth: Math.min(W * 1.25, 420) }}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={SINGLE} />
        </marker>
      </defs>
      {r.nodes}
    </svg>
  )
}

/** Узел схемы перехода: атом с точками или подпись (SO₄, :NH₃, H⁺). */
export type TransferNode = { atom?: LAtom; text?: string }
export type TransferArc = { from: number; to: number; text: string }

/** Схема перехода по § 16: Na· ⟶ ·Cl: — дуга-стрелка от отдающего к принимающему (над формулами). */
export function TransferSvg({ nodes, arcs, label }: { nodes: TransferNode[]; arcs: TransferArc[]; label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const marker = `fbArc${uid}`
  const STEP = 112
  const out: ReactNode[] = []
  nodes.forEach((n, k) => {
    const x = k * STEP
    if (n.atom) {
      const d = drawGraph({ atoms: [n.atom], bonds: [], charge: 0 }, 'dots', `n${k}`, marker, true)
      out.push(
        <g key={`n${k}`} transform={`translate(${x} 0)`}>
          {d.nodes}
        </g>,
      )
    } else
      out.push(
        <text key={`n${k}`} x={x} y={0} textAnchor="middle" dominantBaseline="central" fontSize={FS} fontWeight={700} fill={INK}>
          {n.text}
        </text>,
      )
  })
  arcs.forEach((a, k) => {
    const x1 = a.from * STEP + (a.to > a.from ? 16 : -16)
    const x2 = a.to * STEP + (a.to > a.from ? -18 : 18)
    const mx = (x1 + x2) / 2
    out.push(<path key={`a${k}`} d={`M${x1} -12 Q${mx} -52 ${x2} -14`} fill="none" stroke="#dc2626" strokeWidth={2} markerEnd={`url(#${marker})`} />)
    out.push(
      <text key={`t${k}`} x={mx} y={-40} textAnchor="middle" fontSize={14} fontWeight={700} fill="#dc2626">
        {a.text}
      </text>,
    )
  })
  const W = (nodes.length - 1) * STEP + 60
  return (
    <svg className="fbSvg" viewBox={`-30 -58 ${W} 84`} role="img" aria-label={label} style={{ maxWidth: Math.min(W * 1.3, 420) }}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#dc2626" />
        </marker>
      </defs>
      {out}
    </svg>
  )
}
