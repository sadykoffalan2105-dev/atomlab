/**
 * Лёгкое живое 3D собранной молекулы (canvas 2D, без WebGL: быстро на телефоне, без отдельного чанка three).
 * Шары-стержни с объёмной заливкой, сортировка по глубине, автоповорот, вращение пальцем/мышью.
 *
 * ТОЧКА ЗАМЕНЫ: когда общий Molecule3D (../Molecule3D.tsx) станет полноценным, его можно подставить
 * в OrganicConstructor вместо <Preview3D> — данные те же (атомы с p, связи с o).
 */
import { useEffect, useRef } from 'react'

export interface P3Atom { readonly el: string; readonly p: readonly [number, number, number] }
export interface P3Bond { readonly a: number; readonly b: number; readonly o: number }
export interface Preview3DProps {
  readonly atoms: readonly P3Atom[]
  readonly bonds: readonly P3Bond[]
  readonly label: string
  readonly className?: string
}

const COLOR: Record<string, string> = {
  C: '#4b5563', H: '#f1f5f9', O: '#ef4444', N: '#3b82f6', S: '#facc15', Cl: '#22c55e', Br: '#b45309', I: '#7e22ce', F: '#86efac', P: '#f97316',
}
const RADIUS: Record<string, number> = { H: 0.25, C: 0.38, N: 0.37, O: 0.36, S: 0.48, Cl: 0.46, Br: 0.5, I: 0.56, F: 0.33, P: 0.46 }

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

export function Preview3D({ atoms, bonds, label, className }: Preview3DProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const rot = useRef({ yaw: 0.6, pitch: -0.35, auto: true, drag: null as null | { x: number; y: number; yaw: number; pitch: number } })
  const data = useRef({ atoms, bonds })
  data.current = { atoms, bonds }

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let visible = true
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true }) : null
    io?.observe(cv)
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible) return
      const r = rot.current
      if (r.auto && !r.drag) r.yaw += dt * 0.5
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = cv.clientWidth, H = cv.clientHeight
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const { atoms: A, bonds: B } = data.current
      if (!A.length) return
      // центр и масштаб
      let cx = 0, cy = 0, cz = 0
      for (const a of A) { cx += a.p[0]; cy += a.p[1]; cz += a.p[2] }
      cx /= A.length; cy /= A.length; cz /= A.length
      let R = 1
      for (const a of A) R = Math.max(R, Math.hypot(a.p[0] - cx, a.p[1] - cy, a.p[2] - cz))
      const scale = (Math.min(W, H) * 0.42) / (R + 0.6)
      const cyw = Math.cos(r.yaw), syw = Math.sin(r.yaw), cp = Math.cos(r.pitch), sp = Math.sin(r.pitch)
      const P = A.map((a) => {
        const x = a.p[0] - cx, y = a.p[1] - cy, z = a.p[2] - cz
        const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp
        const persp = 1 / (1 - z2 / (R * 6))
        return { x: W / 2 + x1 * scale * persp, y: H / 2 - y2 * scale * persp, z: z2, s: scale * persp }
      })
      type Item = { z: number; draw: () => void }
      const items: Item[] = []
      for (const b of B) {
        const p = P[b.a], q = P[b.b]
        if (!p || !q) continue
        const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1
        const nx = -dy / L, ny = dx / L
        const w = Math.max(2, 0.11 * (p.s + q.s) / 2)
        const offs = b.o === 1 ? [0] : b.o === 2 ? [-1, 1] : [-1.6, 0, 1.6]
        const ca = COLOR[A[b.a].el] ?? '#9ca3af', cb = COLOR[A[b.b].el] ?? '#9ca3af'
        items.push({
          z: (p.z + q.z) / 2 - 0.01,
          draw: () => {
            ctx.lineCap = 'round'
            for (const o of offs) {
              const ox = nx * o * w * (b.o === 1 ? 0 : 0.9), oy = ny * o * w * (b.o === 1 ? 0 : 0.9)
              const lw = b.o === 1 ? w : w * 0.62
              const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
              ctx.lineWidth = lw
              ctx.strokeStyle = shade(ca, -0.15)
              ctx.beginPath(); ctx.moveTo(p.x + ox, p.y + oy); ctx.lineTo(mx + ox, my + oy); ctx.stroke()
              ctx.strokeStyle = shade(cb, -0.15)
              ctx.beginPath(); ctx.moveTo(mx + ox, my + oy); ctx.lineTo(q.x + ox, q.y + oy); ctx.stroke()
            }
          },
        })
      }
      A.forEach((a, i) => {
        const p = P[i]
        const rr = (RADIUS[a.el] ?? 0.4) * p.s
        const base = COLOR[a.el] ?? '#a3a3a3'
        items.push({
          z: p.z,
          draw: () => {
            const g = ctx.createRadialGradient(p.x - rr * 0.35, p.y - rr * 0.4, rr * 0.1, p.x, p.y, rr)
            g.addColorStop(0, shade(base, 0.65))
            g.addColorStop(0.45, base)
            g.addColorStop(1, shade(base, -0.55))
            ctx.fillStyle = g
            ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill()
          },
        })
      })
      items.sort((u, v) => u.z - v.z)
      for (const it of items) it.draw()
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); io?.disconnect() }
  }, [])

  const onDown = (e: React.PointerEvent) => {
    const r = rot.current
    r.drag = { x: e.clientX, y: e.clientY, yaw: r.yaw, pitch: r.pitch }
    r.auto = false
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const r = rot.current
    if (!r.drag) return
    r.yaw = r.drag.yaw + (e.clientX - r.drag.x) * 0.01
    r.pitch = Math.max(-1.4, Math.min(1.4, r.drag.pitch + (e.clientY - r.drag.y) * 0.01))
  }
  const onUp = () => { rot.current.drag = null }

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={() => { rot.current.auto = true }}
      style={{ touchAction: 'none', width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
    />
  )
}
