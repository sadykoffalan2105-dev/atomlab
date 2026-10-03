/**
 * Каркас установок: непрерывный прогресс опыта p (целая часть — сколько шагов выполнено),
 * поза объектов как функция p, подсвеченная цель шага, нажатие мышью или пальцем.
 *
 * Все анимации — функции p: нажатие запускает плавный ход p от s к s + 1 (действие шага), «Далее»/«Назад»
 * на доске просто подтягивают p к новому шагу — установка проигрывает действие быстрее или откатывается без телепортов.
 */
import { createContext, useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { LAB_COLORS, type LabLang } from '../labContract'
import type { RigGesture } from './rigTargets'
import { labEvents } from '../labEvents'

export type Quality = 'low' | 'high'

export interface RigContextValue {
  /** Непрерывный прогресс опыта. */
  readonly p: RefObject<number>
  /** Время (с) — для мерцания пламени и пузырьков. */
  readonly time: RefObject<number>
  readonly quality: Quality
  readonly lang: LabLang
  /** Цель текущего шага (null — идёт действие или опыт завершён). */
  readonly activeTarget: string | null
  readonly act: (target: string) => void
  /** Жест текущего шага (нажать / перетащить / провести). */
  readonly gesture: RigGesture | null
  /** Начать перетаскивание или «провести» по цели (палец/мышь ведут прогресс шага). */
  readonly beginGesture: (target: string, e: ThreeEvent<PointerEvent>) => void
  /** Идёт перетаскивание — призрачная рука прячется. */
  readonly dragging: boolean
  /** Локальная точка установки → мировые координаты (где бы сцена ни поставила установку: стол или вытяжка). */
  readonly toWorld: (local: readonly [number, number, number]) => [number, number, number]
}

export const RigContext = createContext<RigContextValue | null>(null)

export function useRig(): RigContextValue {
  const ctx = useContext(RigContext)
  if (!ctx) throw new Error('useRig: нет RigContext')
  return ctx
}

/* ── Математика анимаций ── */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
/** Доля пройденного отрезка [a, b] прогресса. */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
export const smooth = (x: number) => x * x * (3 - 2 * x)
export const ease = (p: number, a: number, b: number) => smooth(seg(p, a, b))
export const mix = (a: number, b: number, k: number) => a + (b - a) * k
/** «Холм»: 0 → 1 → 0 на отрезке [a, b] с плато в середине. */
export const hill = (p: number, a: number, b: number, edge = 0.25) => {
  const w = (b - a) * edge
  return Math.min(ease(p, a, a + w), 1 - ease(p, b - w, b))
}

export type V3 = readonly [number, number, number]
export function mixV(a: V3, b: V3, k: number): [number, number, number] {
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)]
}

export interface PoseValue {
  pos: V3
  rot?: V3
  scale?: number
}

/** Группа, чья поза каждый кадр считается из прогресса p. */
export function Pose({ pose, children }: { pose: (p: number, t: number) => PoseValue; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const { p, time } = useRig()
  useFrame(() => {
    const g = ref.current
    if (!g) return
    const v = pose(p.current ?? 0, time.current ?? 0)
    g.position.set(v.pos[0], v.pos[1], v.pos[2])
    if (v.rot) g.rotation.set(v.rot[0], v.rot[1], v.rot[2])
    const s = v.scale ?? 1
    g.scale.setScalar(Math.max(1e-4, s))
    g.visible = s > 1e-3
  })
  return <group ref={ref}>{children}</group>
}

/** Значение-функция прогресса для свойств деталей. */
export type PFn = (p: number) => number

/** Подпись-подсказка над целью шага: «Нажмите» / «Перетащите» / «Проведите», для пальца и мыши. */
const HINT: Record<RigGesture['kind'], Record<LabLang, string>> = {
  tap: { ru: 'Нажмите', en: 'Tap', uz: 'Bosing' },
  drag: { ru: 'Перетащите', en: 'Drag', uz: 'Torting' },
  swipe: { ru: 'Проведите', en: 'Swipe', uz: 'Suring' },
}

export function HandIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 10V9a1.5 1.5 0 0 1 3 0v2" />
      <path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-3.9-1.9L4.6 16a1.6 1.6 0 0 1 2.4-2.1L9 15.5" />
    </svg>
  )
}

const hintStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px 6px 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.94)',
  color: LAB_COLORS.accent,
  font: '600 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  boxShadow: '0 6px 18px rgba(31, 76, 160, 0.22), 0 0 0 2px rgba(47,124,246,0.35)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  animation: 'lab3dHintBob 1.6s ease-in-out infinite',
}

let hintCssInjected = false
function ensureHintCss() {
  if (hintCssInjected || typeof document === 'undefined') return
  hintCssInjected = true
  const st = document.createElement('style')
  st.textContent = '@keyframes lab3dHintBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'
  document.head.appendChild(st)
}

/** Мягкое свечение цели: полупрозрачная «оболочка» и пульсирующее кольцо на столе. */
function ActiveGlow({ size, center, ringR, ring: showRing }: { size: V3; center: V3; ringR: number; ring: boolean }) {
  const halo = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const { time } = useRig()
  useFrame(() => {
    const t = time.current ?? 0
    const k = 0.5 + 0.5 * Math.sin(t * 4)
    if (halo.current) halo.current.opacity = 0.035 + 0.05 * k
    if (ring.current) {
      ring.current.scale.setScalar(1 + 0.12 * k)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.35 * (1 - k)
    }
  })
  return (
    <>
      <mesh position={center as unknown as THREE.Vector3Tuple} renderOrder={5}>
        <capsuleGeometry args={[Math.max(size[0], size[2]) * 0.4, Math.max(0.001, size[1] - Math.max(size[0], size[2]) * 0.8), 6, 16]} />
        <meshBasicMaterial ref={halo} color={LAB_COLORS.accent} transparent opacity={0.1} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      {showRing ? <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[center[0], 0.0015, center[2]]} renderOrder={5}>
        <ringGeometry args={[ringR * 0.86, ringR, 40]} />
        <meshBasicMaterial color={LAB_COLORS.accent} transparent opacity={0.5} depthWrite={false} />
      </mesh> : null}
    </>
  )
}

/**
 * Нажимаемый объект установки. Невидимая зона нажатия крупнее самого объекта — удобно пальцем.
 * Подсветка и подсказка — только когда этот объект — цель текущего шага.
 */
export function Target({
  name,
  size,
  center,
  ringR,
  hintY,
  ring = true,
  children,
}: {
  name: string
  /** Размер зоны нажатия (м). */
  size: V3
  /** Центр зоны нажатия в локальных координатах. */
  center?: V3
  ringR?: number
  hintY?: number
  /** Кольцо на столе под целью (у предметов в руке — без кольца). */
  ring?: boolean
  children?: ReactNode
}) {
  const { activeTarget, act, lang, gesture, beginGesture, dragging } = useRig()
  const active = activeTarget === name
  const kind = active ? (gesture?.kind ?? 'tap') : 'tap'
  const c: V3 = center ?? [0, size[1] / 2, 0]
  const [hover, setHover] = useState(false)
  ensureHintCss()
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // неактивная цель (гранула, уже лежащая в пробирке) не гасит нажатие — оно доходит до текущей цели за ней
    if (!active) return
    e.stopPropagation()
    // у перетаскивания и «провести» простое нажатие не засчитывается — нужен жест (рука-подсказка показывает какой)
    if (kind === 'tap') act(name)
  }
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!active || kind === 'tap') return
    e.stopPropagation()
    beginGesture(name, e)
  }
  return (
    <group name={`target:${name}`}>
      {children}
      <mesh
        position={c as unknown as THREE.Vector3Tuple}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          if (active) document.body.style.cursor = kind === 'tap' ? 'pointer' : 'grab'
        }}
        onPointerOut={() => {
          setHover(false)
          document.body.style.cursor = ''
        }}
        userData={{ labTarget: name }}
      >
        <boxGeometry args={[Math.max(size[0], 0.07), Math.max(size[1], 0.07), Math.max(size[2], 0.07)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {active && !dragging ? (
        <>
          <ActiveGlow size={size} center={c} ringR={Math.min(0.07, ringR ?? Math.max(size[0], size[2]) * 0.75)} ring={ring} />
          <Html position={[c[0], hintY ?? c[1] + size[1] / 2 + 0.03, c[2]]} center zIndexRange={[30, 10]} style={{ pointerEvents: 'none' }}>
            <div style={{ ...hintStyle, transform: hover ? 'scale(1.06)' : undefined }} data-lab3d-hint={name}>
              <HandIcon />
              {HINT[kind][lang]}
            </div>
          </Html>
        </>
      ) : null}
    </group>
  )
}

/** Материал, у которого каждый кадр меняются цвет/прозрачность из p. */
export function useAnimatedMaterial<M extends THREE.Material>(make: () => M, update: (m: M, p: number, t: number) => void): M {
  const mat = useMemo(make, []) // eslint-disable-line react-hooks/exhaustive-deps
  const { p, time } = useRig()
  useFrame(() => update(mat, p.current ?? 0, time.current ?? 0))
  return mat
}

/** Вызвать fn, когда прогресс p проходит порог вперёд (звук хлопка, щелчок крана). */
export function useCrossing(threshold: number, fn: () => void) {
  const { p } = useRig()
  const prev = useRef<number | null>(null)
  useFrame(() => {
    const v = p.current ?? 0
    if (prev.current != null && prev.current < threshold && v >= threshold && v - prev.current < 0.2) fn()
    prev.current = v
  })
}

/** Звук события через шину labEvents (сцена проигрывает его пространственно в точке установки local). */
export function useSoundAt(threshold: number, name: string, local: V3, gain?: number) {
  const { toWorld } = useRig()
  useCrossing(threshold, () => labEvents.emit({ type: 'sound', name, at: toWorld(local), gain }))
}
