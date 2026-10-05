/**
 * Холст Конструктора (SVG): мышь и палец через Pointer Events.
 * Касание пустого места — новый атом; касание атома — рост цепи зигзагом (или замена элементом палитры);
 * протягивание от атома — новая связь под углом, кратным 30° (или к существующему атому — замыкание цикла);
 * касание связи — кратность 1→2→3→1. Водороды — подписями CH₃/CH₂/OH/NH₂ по валентности.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  addAtom, addBond, atomById, atomNear, attachGroup, cycleBond, growFrom, moveAtom, removeAtom, removeBond, setElement, snapAngle,
  type CState, type GroupKey,
} from './model'
import styles from './OrganicConstructor.module.css'

export type Tool =
  | { readonly kind: 'draw'; readonly el: string }
  | { readonly kind: 'group'; readonly key: GroupKey }
  | { readonly kind: 'move' }
  | { readonly kind: 'erase' }

export type Focus = { readonly kind: 'atom' | 'bond'; readonly id: number } | null

export interface EditorCanvasProps {
  readonly state: CState
  readonly tool: Tool
  /** число H у атома (по id) */
  readonly hById: ReadonlyMap<number, number>
  /** ошибки валентности: id атома → текст */
  readonly issues: ReadonlyMap<number, string>
  /** степень C по id атома (показывается, если задано) */
  readonly degrees: ReadonlyMap<number, number> | null
  readonly focus: Focus
  readonly fitKey: number
  readonly label: string
  readonly emptyText: string
  readonly onCommit: (s: CState) => void
  readonly onPreview: (s: CState | null) => void
  readonly onFocus: (f: Focus) => void
}

const K = 48 // svg-пикселей на длину связи
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n: number) => (n > 1 ? String(n).replace(/\d/g, (d) => SUBS[+d]) : '')
const ROMAN = ['', 'I', 'II', 'III', 'IV']

/** Подпись атома с водородами: CH₃ / H₃C (если связи уходят вправо), OH / HO, NH₂ / H₂N, Cl. */
function atomText(el: string, h: number, flip: boolean): string {
  if (!h) return el
  const hs = 'H' + sub(h)
  return flip ? hs + el : el + hs
}

interface View { x: number; y: number; w: number; h: number }

function fitView(s: CState, aspect: number, pxW = 800): View {
  // минимальная ширина вида: на телефоне ~5 длин связи (крупно, пальцем попадать легко), на большом экране — 8
  const minW = Math.max(5, Math.min(8, pxW / 64))
  if (!s.atoms.length) { const w = minW; return { x: -w / 2, y: -w / aspect / 2, w, h: w / aspect } }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const a of s.atoms) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y) }
  const m = 1.6
  let w = Math.max(minW, x1 - x0 + 2 * m), h = Math.max(minW / 1.6, y1 - y0 + 2 * m)
  if (w / h < aspect) w = h * aspect; else h = w / aspect
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h }
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

type Gesture = {
  pid: number
  sx: number; sy: number
  target: Focus
  moved: boolean
  /** конец протягиваемой связи */
  ghost?: { x: number; y: number; to?: number }
  base: CState
}

export const EditorCanvas = memo(function EditorCanvas(p: EditorCanvasProps) {
  const { state, tool } = p
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 420 })
  const [view, setView] = useState<View>(() => fitView(state, 640 / 420, 640))
  const [ghost, setGhost] = useState<Gesture['ghost'] & { from: number } | null>(null)
  const gest = useRef<Gesture | null>(null)
  const lastFit = useRef(p.fitKey)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // вид «липкий»: меняется, только если рисунок вышел за край, при смене размера или по fitKey («Выровнять», «Очистить»)
  useLayoutEffect(() => {
    const aspect = size.w / size.h
    setView((v) => {
      const refit = lastFit.current !== p.fitKey || Math.abs(v.w / v.h - aspect) > 0.02
      lastFit.current = p.fitKey
      if (refit) return fitView(state, aspect, size.w)
      const m = 0.7
      const out = state.atoms.some((a) => a.x < v.x + m || a.x > v.x + v.w - m || a.y < v.y + m || a.y > v.y + v.h - m)
      return out && !gest.current ? fitView(state, aspect, size.w) : v
    })
  }, [state, size, p.fitKey])

  const pxPerUnit = size.w / view.w
  // цели касания ≥ 40 px (радиус ≥ 20 px) и не меньше 0.36 длины связи
  const hitR = Math.max(0.36, 22 / pxPerUnit)

  const toModel = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const r = svg.getBoundingClientRect()
    return { x: view.x + ((e.clientX - r.left) / r.width) * view.w, y: view.y + ((e.clientY - r.top) / r.height) * view.h }
  }

  const hitTest = (x: number, y: number, s: CState): Focus => {
    const a = atomNear(s, x, y, hitR)
    if (a) return { kind: 'atom', id: a.id }
    let best: Focus = null, bd = Math.min(hitR, 0.32)
    for (const b of s.bonds) {
      const A = atomById(s, b.a), B = atomById(s, b.b)
      if (!A || !B) continue
      const d = distToSeg(x, y, A.x, A.y, B.x, B.y)
      if (d < bd) { bd = d; best = { kind: 'bond', id: b.id } }
    }
    return best
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const { x, y } = toModel(e)
    const target = hitTest(x, y, state)
    gest.current = { pid: e.pointerId, sx: x, sy: y, target, moved: false, base: state }
    svgRef.current?.setPointerCapture?.(e.pointerId)
    if (target) p.onFocus(target)
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gest.current
    const { x, y } = toModel(e)
    if (!g || g.pid !== e.pointerId) {
      if (e.pointerType === 'mouse') {
        const f = hitTest(x, y, state)
        if ((f?.id ?? -1) !== (p.focus?.id ?? -1) || f?.kind !== p.focus?.kind) p.onFocus(f)
      }
      return
    }
    if (!g.moved && Math.hypot(x - g.sx, y - g.sy) * pxPerUnit < 8) return
    g.moved = true
    if (g.target?.kind !== 'atom') return
    const from = atomById(g.base, g.target.id)
    if (!from) return
    if (tool.kind === 'move') {
      p.onPreview(moveAtom(g.base, from.id, x, y))
      return
    }
    if (tool.kind !== 'draw') return
    const near = atomNear(g.base, x, y, Math.max(0.4, hitR * 0.9), from.id)
    if (near) { g.ghost = { x: near.x, y: near.y, to: near.id } }
    else {
      const ang = snapAngle(Math.atan2(y - from.y, x - from.x))
      g.ghost = { x: from.x + Math.cos(ang), y: from.y + Math.sin(ang) }
    }
    setGhost({ ...g.ghost, from: from.id })
  }

  const finish = (e: React.PointerEvent<SVGSVGElement>, cancel = false) => {
    const g = gest.current
    if (!g || g.pid !== e.pointerId) return
    gest.current = null
    setGhost(null)
    const s = g.base
    const t = g.target
    if (cancel) { p.onPreview(null); return }
    if (tool.kind === 'move') {
      if (g.moved && t?.kind === 'atom') { const { x, y } = toModel(e); p.onPreview(null); p.onCommit(moveAtom(s, t.id, x, y)) }
      return
    }
    if (g.moved) {
      if (tool.kind === 'draw' && t?.kind === 'atom' && g.ghost) {
        if (g.ghost.to !== undefined) p.onCommit(addBond(s, t.id, g.ghost.to))
        else {
          const from = atomById(s, t.id)!
          const r = growFrom(s, t.id, tool.el, Math.atan2(g.ghost.y - from.y, g.ghost.x - from.x))
          p.onCommit(r.state)
          p.onFocus({ kind: 'atom', id: r.id })
        }
      }
      return
    }
    // касание
    if (tool.kind === 'erase') {
      if (t?.kind === 'atom') p.onCommit(removeAtom(s, t.id))
      else if (t?.kind === 'bond') p.onCommit(removeBond(s, t.id))
      p.onFocus(null)
      return
    }
    if (tool.kind === 'group') {
      const r = t?.kind === 'atom' ? attachGroup(s, tool.key, t.id) : attachGroup(s, tool.key, null, Math.round(g.sx * 2) / 2, Math.round(g.sy * 2) / 2)
      p.onCommit(r.state)
      return
    }
    if (t?.kind === 'bond') { p.onCommit(cycleBond(s, t.id)); return }
    if (t?.kind === 'atom') {
      const at = atomById(s, t.id)!
      if (at.el !== tool.el && tool.el !== 'C') { p.onCommit(setElement(s, t.id, tool.el)); return }
      if (at.el !== tool.el && tool.el === 'C' && at.el !== 'C') { p.onCommit(setElement(s, t.id, 'C')); return }
      const r = growFrom(s, t.id, 'C')
      p.onCommit(r.state)
      p.onFocus({ kind: 'atom', id: r.id })
      return
    }
    // пустое место: новый атом с привязкой к сетке 0.5
    const r = addAtom(s, Math.round(g.sx * 2) / 2, Math.round(g.sy * 2) / 2, tool.el)
    p.onCommit(r.state)
    p.onFocus({ kind: 'atom', id: r.id })
  }

  // ── рисование ──
  const atomsView = useMemo(() => state.atoms.map((a) => {
    const h = p.hById.get(a.id) ?? 0
    // переворот подписи: все связи уходят вправо → H₃C, HO
    let sx = 0, n = 0
    for (const b of state.bonds) {
      if (b.a !== a.id && b.b !== a.id) continue
      const o = atomById(state, b.a === a.id ? b.b : b.a)
      if (o) { sx += o.x - a.x; n++ }
    }
    const flip = n > 0 && sx / n > 0.25
    const text = atomText(a.el, h, flip)
    return { a, text, flip }
  }), [state, p.hById])

  const labelW = (t: string) => {
    let w = 0
    for (const ch of t) w += SUBS.includes(ch) ? 0.17 : ch === 'l' || ch === 'I' ? 0.16 : 0.3
    return Math.max(0.44, w + 0.14)
  }

  const focusId = p.focus?.id
  return (
    <div ref={boxRef} className={styles.canvasBox}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`${view.x * K} ${view.y * K} ${view.w * K} ${view.h * K}`}
        role="application"
        aria-label={p.label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onPointerLeave={() => { if (!gest.current) p.onFocus(null) }}
        data-tool={tool.kind}
      >
        <defs>
          <pattern id="ov2c-grid" width={K / 2} height={K / 2} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={1.1} className={styles.gridDot} />
          </pattern>
        </defs>
        <rect x={view.x * K} y={view.y * K} width={view.w * K} height={view.h * K} fill="url(#ov2c-grid)" />
        {state.bonds.map((b) => {
          const A = atomById(state, b.a), B = atomById(state, b.b)
          if (!A || !B) return null
          const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1
          const nx = (-dy / L) * K, ny = (dx / L) * K
          const offs = b.o === 1 ? [0] : b.o === 2 ? [-0.075, 0.075] : [-0.11, 0, 0.11]
          const hot = p.focus?.kind === 'bond' && focusId === b.id
          return (
            <g key={b.id} className={hot ? styles.bondHot : styles.bond} data-bond={b.id} data-order={b.o}>
              {offs.map((o, k) => (
                <line key={k} x1={A.x * K + nx * o} y1={A.y * K + ny * o} x2={B.x * K + nx * o} y2={B.y * K + ny * o} />
              ))}
            </g>
          )
        })}
        {ghost && (() => {
          const A = atomById(state, ghost.from)
          if (!A) return null
          return (
            <g className={styles.ghost}>
              <line x1={A.x * K} y1={A.y * K} x2={ghost.x * K} y2={ghost.y * K} />
              {ghost.to === undefined && <circle cx={ghost.x * K} cy={ghost.y * K} r={0.2 * K} />}
            </g>
          )
        })()}
        {atomsView.map(({ a, text }) => {
          const err = p.issues.get(a.id)
          const w = labelW(text) * K, h = 0.5 * K
          const hot = p.focus?.kind === 'atom' && focusId === a.id
          const deg = p.degrees?.get(a.id)
          return (
            <g key={a.id} className={`${styles.atom} ${err ? styles.atomErr : ''} ${hot ? styles.atomHot : ''}`} data-atom={a.id} data-el={a.el} data-label={text}>
              {err && <circle cx={a.x * K} cy={a.y * K} r={0.42 * K} className={styles.errRing} />}
              <rect x={a.x * K - w / 2} y={a.y * K - h / 2} width={w} height={h} rx={h / 2} className={styles.atomBg} />
              <text x={a.x * K} y={a.y * K} className={`${styles.atomText} ${styles['el' + a.el] ?? ''}`} dominantBaseline="central" textAnchor="middle">{text}</text>
              {deg !== undefined && deg > 0 && (
                <g className={styles.degree} data-degree={deg}>
                  <rect x={a.x * K + w / 2 - 4 - ROMAN[deg].length * 3.5} y={a.y * K - h / 2 - 9} width={ROMAN[deg].length * 7 + 8} height={16} rx={8} />
                  <text x={a.x * K + w / 2} y={a.y * K - h / 2 - 1} dominantBaseline="central">{ROMAN[deg]}</text>
                </g>
              )}
            </g>
          )
        })}
        {(() => {
          // пузырь с ошибкой — у первого ошибочного атома
          const first = state.atoms.find((a) => p.issues.has(a.id))
          if (!first) return null
          const msg = p.issues.get(first.id)!
          const fs = Math.max(11, 13 / Math.max(0.7, pxPerUnit / K))
          const w = Math.min(view.w * K * 0.9, msg.length * fs * 0.52 + 20)
          // пузырь — у нижнего края холста, чтобы не закрывать атомы
          const bx = view.x * K + (view.w * K - w) / 2
          const by = (view.y + view.h) * K - fs * 1.9 - 10
          return (
            <g className={styles.bubble} role="alert">
              <rect x={bx} y={by} width={w} height={fs * 1.9} rx={8} />
              <text x={bx + w / 2} y={by + fs * 0.95} dominantBaseline="central" textAnchor="middle" style={{ fontSize: fs }}>{msg}</text>
            </g>
          )
        })()}
      </svg>
      {!state.atoms.length && <div className={styles.emptyHint} aria-hidden="true">{p.emptyText}</div>}
    </div>
  )
})
