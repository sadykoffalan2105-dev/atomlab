/**
 * Органика v2 — 2D-формула крупной молекулы (> 30 тяжёлых атомов: жиры, полисахариды, β-каротин) с лупой:
 * рисунок в натуральном масштабе внутри прокручиваемой рамки, кнопки «−/+/целиком», масштаб пальцами (2 касания)
 * и Ctrl/⌘ + колесо. Скелетная открывается «целиком», развёрнутая — читаемой (связь ≈ 30 px) с прокруткой.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Formula2DProps } from '../contracts'
import { Formula2D, layoutFormula2D } from '../Formula2D'
import styles from './ZoomFormula.module.css'

/** порог «крупной» молекулы — по тяжёлым атомам */
export const BIG_HEAVY = 30

const T = {
  ru: { zoomIn: 'Крупнее', zoomOut: 'Мельче', fit: 'Целиком', hint: 'Крупная молекула: прокрутите или сведите/разведите пальцы' },
  en: { zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', hint: 'Large molecule: scroll or pinch to zoom' },
  uz: { zoomIn: 'Kattaroq', zoomOut: 'Kichikroq', fit: 'Butunicha', hint: 'Katta molekula: aylantiring yoki barmoqlar bilan kattalashtiring' },
} as const

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Поворот 2D-координат (p2) на угол a — жёсткий, в плоскости: подписи и клинья пересчитываются из новых координат. */
function rotate2D(mol: Formula2DProps['mol'], a: number): Formula2DProps['mol'] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { ...mol, atoms: mol.atoms.map((at) => ({ ...at, p2: [at.p2[0] * c - at.p2[1] * s, at.p2[0] * s + at.p2[1] * c] })) }
}

/** Угол главной оси 2D-рисунка (по тяжёлым атомам). */
function mainAxisAngle(mol: Formula2DProps['mol']): number {
  const pts = mol.atoms.filter((a) => a.el !== 'H').map((a) => a.p2)
  if (pts.length < 3) return 0
  let mx = 0
  let my = 0
  for (const p of pts) {
    mx += p[0] / pts.length
    my += p[1] / pts.length
  }
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of pts) {
    sxx += (p[0] - mx) ** 2
    syy += (p[1] - my) ** 2
    sxy += (p[0] - mx) * (p[1] - my)
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy)
}

const viewOf = (mol: Formula2DProps['mol'], kind: Formula2DProps['kind']) => {
  const [, , w, h] = layoutFormula2D(mol, kind).viewBox.split(/\s+/).map(Number)
  return { w: w || 1, h: h || 1 }
}

export function ZoomFormula(props: Formula2DProps) {
  const { kind, lang } = props
  const t = T[lang]
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  // рисунок поворачивается главной осью вдоль длинной стороны рамки, если так он крупнее (жиры, целлюлоза «по диагонали»)
  const landscape = size.w === 0 ? null : size.w >= size.h
  const { mol, view } = useMemo(() => {
    const base = { mol: props.mol, view: viewOf(props.mol, kind) }
    if (landscape === null) return base
    const a = mainAxisAngle(props.mol)
    const rot = rotate2D(props.mol, (landscape ? 0 : Math.PI / 2) - a)
    const rv = viewOf(rot, kind)
    const k = (v: { w: number; h: number }) => Math.min(size.w / v.w, size.h / v.h)
    return k(rv) > k(base.view) * 1.12 ? { mol: rot, view: rv } : base
    // size — только через landscape и пропорцию; пересчёт при смене ориентации рамки
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mol, kind, landscape, Math.round((size.w / Math.max(1, size.h)) * 4)])
  const fit = size.w > 0 ? Math.min((size.w - 8) / view.w, (size.h - 8) / view.h) : 0.3
  const readable = kind === 'structural' ? Math.max(fit, 0.78) : fit
  const [z, setZ] = useState<number | null>(null)
  const zoom = z ?? readable
  const minZ = Math.min(fit, 0.2)
  const maxZ = 2.2

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const upd = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // новая молекула/вид — снова стартовый масштаб и прокрутка к середине рисунка (у жиров — глицериновый «узел»)
  const needCenter = useRef(true)
  useEffect(() => {
    setZ(null)
    needCenter.current = true
  }, [view])
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !needCenter.current || size.w === 0) return
    needCenter.current = false
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2)
  })

  /** масштаб с сохранением точки под курсором/пальцами */
  const zoomAt = useCallback(
    (next: number, cx?: number, cy?: number) => {
      const el = box.current
      const nz = clamp(next, minZ, maxZ)
      if (!el) {
        setZ(nz)
        return
      }
      const px = cx ?? el.clientWidth / 2
      const py = cy ?? el.clientHeight / 2
      const ux = (el.scrollLeft + px) / zoom
      const uy = (el.scrollTop + py) / zoom
      setZ(nz)
      requestAnimationFrame(() => {
        el.scrollLeft = ux * nz - px
        el.scrollTop = uy * nz - py
      })
    },
    [zoom, minZ],
  )

  // Ctrl/⌘ + колесо (и жест «щипок» тачпада) — масштаб, без прокрутки страницы
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(zoom * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, zoomAt])

  // два пальца — масштаб
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ d: number; z: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: zoom }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2 && pinch.current) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const r = box.current?.getBoundingClientRect()
      zoomAt(pinch.current.z * (d / pinch.current.d), r ? (a.x + b.x) / 2 - r.left : undefined, r ? (a.y + b.y) / 2 - r.top : undefined)
    }
  }
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
  }

  const w = Math.round(view.w * zoom)
  const h = Math.round(view.h * zoom)
  return (
    <div className={styles.wrap} data-ov2-zoom={kind}>
      <div
        ref={box}
        className={styles.box}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        data-zoom={zoom.toFixed(2)}
      >
        <div className={styles.inner} style={{ width: w, height: h, minWidth: '100%', minHeight: '100%' }}>
          <Formula2D mol={mol} kind={kind} lang={lang} highlightAtoms={props.highlightAtoms} className={styles.svg} />
        </div>
      </div>
      <div className={styles.ctl} role="group">
        <button type="button" onClick={() => zoomAt(zoom / 1.3)} title={t.zoomOut} aria-label={t.zoomOut}>
          −
        </button>
        <button type="button" onClick={() => zoomAt(zoom * 1.3)} title={t.zoomIn} aria-label={t.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => setZ(fit)} title={t.fit} aria-label={t.fit} className={styles.fitBtn}>
          ⤢
        </button>
      </div>
      {zoom > fit * 1.05 && <div className={styles.hint}>{t.hint}</div>}
    </div>
  )
}
