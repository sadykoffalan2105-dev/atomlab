import { memo } from 'react'
import { ELEMENTS } from '../../data/elements'
import { atomColor } from './catalogVisuals'

export type ThumbAtom = { el: string; pos: readonly [number, number, number] | readonly number[] }
export type ThumbBond = { a: number; b: number; order?: 1 | 2 | 3 }

function atomRadius(el: string): number {
  if (el === 'H') return 0.3
  if (el === 'C' || el === 'N' || el === 'O' || el === 'F') return 0.46
  return 0.58
}

const VIEW_W = 150
const VIEW_H = 72
const PAD = 5
const YAW = 0.6
const PITCH = 0.38

type Props = {
  atoms: readonly ThumbAtom[]
  bonds: readonly ThumbBond[]
  className?: string
}

type Line = { x1: number; y1: number; x2: number; y2: number; w: number }
type Ball = { x: number; y: number; r: number; fill: string }
type Scene = { lines: Line[]; balls: Ball[] }

/** id общего градиента шарика для цвета (градиенты рисует MoleculeThumbDefs). */
function gradientId(color: string): string {
  return `thumb-${color.replace('#', '').toLowerCase()}`
}

/** Проекция считается один раз на массив атомов (массивы кэшируются страницей). */
const sceneCache = new WeakMap<readonly ThumbAtom[], Scene | null>()

function buildScene(atoms: readonly ThumbAtom[], bonds: readonly ThumbBond[]): Scene | null {
  if (atoms.length === 0) return null
  const cy = Math.cos(YAW)
  const sy = Math.sin(YAW)
  const cp = Math.cos(PITCH)
  const sp = Math.sin(PITCH)
  const pts = atoms.map((a) => {
    const x0 = Number(a.pos[0]) || 0
    const y0 = Number(a.pos[1]) || 0
    const z0 = Number(a.pos[2]) || 0
    const x1 = x0 * cy + z0 * sy
    const z1 = -x0 * sy + z0 * cy
    const y2 = y0 * cp - z1 * sp
    const z2 = y0 * sp + z1 * cp
    return { el: a.el, x: x1, y: -y2, z: z2, r: atomRadius(a.el) }
  })
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x - p.r)
    maxX = Math.max(maxX, p.x + p.r)
    minY = Math.min(minY, p.y - p.r)
    maxY = Math.max(maxY, p.y + p.r)
  }
  const w = Math.max(maxX - minX, 0.001)
  const h = Math.max(maxY - minY, 0.001)
  // Одиночный атом / маленькая молекула не раздувается во всю карточку.
  const scale = Math.min((VIEW_W - 2 * PAD) / w, (VIEW_H - 2 * PAD) / h, 40)
  const ox = VIEW_W / 2 - ((minX + maxX) / 2) * scale
  const oy = VIEW_H / 2 - ((minY + maxY) / 2) * scale
  const proj = pts.map((p) => ({
    z: p.z,
    x: p.x * scale + ox,
    y: p.y * scale + oy,
    r: Math.max(p.r * scale, 1.6),
    fill: `url(#${gradientId(atomColor(p.el))})`,
  }))
  const bondW = Math.max(Math.min(scale * 0.13, 3.2), 0.9)
  const lines: Line[] = []
  for (const b of bonds) {
    const pa = proj[b.a]
    const pb = proj[b.b]
    if (!pa || !pb) continue
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const order = b.order ?? 1
    const offs = order === 1 ? [0] : order === 2 ? [-0.75, 0.75] : [-1.3, 0, 1.3]
    for (const o of offs) {
      lines.push({
        x1: pa.x + nx * o * bondW,
        y1: pa.y + ny * o * bondW,
        x2: pb.x + nx * o * bondW,
        y2: pb.y + ny * o * bondW,
        w: order === 1 ? bondW : bondW * 0.62,
      })
    }
  }
  const balls = [...proj].sort((a, b) => a.z - b.z)
  return { lines, balls }
}

/**
 * Мини-превью молекулы для карточек каталога: 3D-координаты модели,
 * повёрнутые под фиксированным ракурсом, шарики CPK с бликом. Без WebGL;
 * один <circle> на атом — объём/блик даёт общий градиент из MoleculeThumbDefs.
 */
export const MoleculeThumb = memo(function MoleculeThumb({ atoms, bonds, className }: Props) {
  let scene = sceneCache.get(atoms)
  if (scene === undefined) {
    scene = buildScene(atoms, bonds)
    sceneCache.set(atoms, scene)
  }
  if (!scene) return null

  return (
    <svg className={className} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden focusable="false">
      <g stroke="rgba(214, 224, 255, 0.55)" strokeLinecap="round">
        {scene.lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} strokeWidth={l.w} />
        ))}
      </g>
      <g stroke="rgba(3, 6, 18, 0.55)" strokeWidth={0.6}>
        {scene.balls.map((a, i) => (
          <circle key={i} cx={a.x} cy={a.y} r={a.r} fill={a.fill} />
        ))}
      </g>
    </svg>
  )
})

function mix(hex: string, target: number, amount: number): string {
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16)
  const ch = (v: number) =>
    Math.round(v + (target - v) * amount)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(n(1))}${ch(n(3))}${ch(n(5))}`
}

const THUMB_COLORS = [...new Set([...ELEMENTS.map((e) => atomColor(e.symbol)), atomColor('?')])]

/** Один на страницу: градиенты шариков для всех цветов CPK (id="thumb-<hex>"). */
export function MoleculeThumbDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        {THUMB_COLORS.map((c) => (
          <radialGradient key={c} id={gradientId(c)} cx="36%" cy="32%" r="72%">
            <stop offset="0%" stopColor={mix(c, 255, 0.62)} />
            <stop offset="42%" stopColor={c} />
            <stop offset="100%" stopColor={mix(c, 0, 0.5)} />
          </radialGradient>
        ))}
      </defs>
    </svg>
  )
}
