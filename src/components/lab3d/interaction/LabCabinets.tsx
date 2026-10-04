/**
 * Шкафы с дверцами, которые открываются нажатием (плавно, на петлях): тумба под рабочим столом (4 секции,
 * внутри полка, спиртовка, спички, лучинки, фарфоровая чашка) и навесной шкаф со стеклянными дверцами над полками
 * реактивов (колбы, стакан, цилиндр, воронка, пробирка, часовое стекло). Корпуса полые — внутри видно посуду.
 */
import { RoundedBox, useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { labAudio } from '../audio/labAudio'
import * as THREE from 'three'
import type { LabLang } from '../labContract'
import type { LabMaterials } from '../scene/labMaterials'
import { BENCH, ROOM } from '../scene/labSceneLayout'
import { signTexture } from '../scene/labTextures'
import { BENCH_CAB, LAB_ITEMS, WALL_CAB, benchDoorX } from './labItems'
import { labHand, useHand } from './labHandStore'

const OPEN_ANGLE = 1.85
/** Доводчик: зона (рад) и предельная скорость (рад/с) мягкого закрытия. */
const SOFT_ZONE = 0.3
const SOFT_SPEED = 0.75

/** Перетаскивание мышью/пальцем: общая логика для дверец и ящиков (движение окна, отключение орбиты). */
function useDragGesture(onMove: (dx: number, dy: number, dt: number) => void, onEnd: (moved: boolean) => void) {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const suppress = useRef(false)
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    let lx = e.clientX
    let ly = e.clientY
    const sx = e.clientX
    const sy = e.clientY
    let lt = performance.now()
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      moved = true
      const now = performance.now()
      onMove(ev.clientX - lx, ev.clientY - ly, Math.max(1, now - lt) / 1000)
      lx = ev.clientX
      ly = ev.clientY
      lt = now
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (controls) controls.enabled = true
      if (moved) {
        suppress.current = true
        window.setTimeout(() => (suppress.current = false), 60)
      }
      onEnd(moved)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return { onPointerDown, suppress }
}

const tmpW = new THREE.Vector3()

/**
 * Дверца на петле с физикой: инерция (пружина с затуханием), доводчик (закрывается мягко, в конце — тихий стук),
 * упоры (не проходит сквозь корпус, у предела — лёгкий отскок). Открыть: нажатием или перетащить за ручку
 * (к петле/на себя — открывается); отпустил с разгона — дверца докатывается сама.
 * hinge — край с петлями (−1 левый, +1 правый). Группа стоит в точке петли.
 */
function Door({
  id,
  open,
  hinge,
  w,
  h,
  mats,
  children,
}: {
  id: string
  open: boolean
  hinge: -1 | 1
  w: number
  h: number
  mats: LabMaterials
  children: React.ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'grab', 'auto')
  const ph = useRef({ a: 0, v: 0, drag: false, open, firstFrame: true, lastThud: 0 })
  const soundAt = (): [number, number, number] => {
    const g = ref.current
    if (!g) return [0, 1, 0]
    g.getWorldPosition(tmpW)
    return [tmpW.x, tmpW.y, tmpW.z]
  }
  // Открыли (нажатием или из кода) — щелчок защёлки и тихий скрип петли
  if (ph.current.open !== open) {
    ph.current.open = open
    if (open && !ph.current.firstFrame) labAudio.play('door-open', { at: soundAt() })
  }
  useFrame((_, dtRaw) => {
    const g = ref.current
    const p = ph.current
    if (!g) return
    p.firstFrame = false
    const dt = Math.min(dtRaw, 1 / 30)
    if (!p.drag) {
      // Открывается бодро, закрывается доводчиком — чуть медленнее и мягче
      const target = open ? hinge * OPEN_ANGLE : 0
      const k = open ? 24 : 30
      const c = open ? 7.2 : 8.6
      p.v += ((target - p.a) * k - p.v * c) * dt
      // Доводчик: последние ~17° перед закрытием дверца идёт медленно и мягко (как петля с демпфером)
      if (!open && hinge * p.a < SOFT_ZONE && hinge * p.v < 0) p.v = hinge * Math.max(hinge * p.v, -SOFT_SPEED)
      p.a += p.v * dt
    }
    // Упор «закрыто»: стук, если пришла с заметной скоростью; маленький отскок
    if (hinge * p.a < 0) {
      // Один стук на одно закрытие (отскок и дрожание у упора звук не повторяют)
      const now = performance.now()
      if (Math.abs(p.v) > 0.25 && now - p.lastThud > 450) {
        p.lastThud = now
        labAudio.play('door-close', { at: soundAt(), gain: Math.min(1, 0.25 + Math.abs(p.v) / 2.2) })
      }
      p.a = 0
      p.v = -p.v * 0.15
    }
    // Упор «полностью открыта»
    const lim = OPEN_ANGLE + 0.08
    if (hinge * p.a > lim) {
      p.a = hinge * lim
      p.v = -p.v * 0.3
    }
    g.rotation.y = p.a
  })
  const drag = useDragGesture(
    (dx, dy, dt) => {
      const p = ph.current
      p.drag = true
      // Ручку тянут к петле или на себя (вниз по экрану) — дверца открывается
      const da = (hinge * dx + dy * 0.6) / 140
      const prev = p.a
      p.a = hinge * Math.min(OPEN_ANGLE + 0.08, Math.max(0, hinge * p.a + da))
      p.v = (p.a - prev) / dt
    },
    (moved) => {
      const p = ph.current
      p.drag = false
      if (!moved) return
      // Отпустили: решает угол и разгон (бросок)
      const opened = hinge * p.a + hinge * p.v * 0.18 > OPEN_ANGLE * 0.4
      labHand.setDoor(id, opened)
    },
  )
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (drag.suppress.current) return
    labHand.toggleDoor(id)
  }
  return (
    <group ref={ref}>
      <group
        position-x={-hinge * (w / 2)}
        onClick={onClick}
        onPointerDown={drag.onPointerDown}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        userData={{ interactive: true }}
      >
        {children}
      </group>
      {/* Петли: шарнир (цилиндр с колпачками) и пластина на дверце — поворачивается вместе с ней */}
      {[h * 0.38, -h * 0.38].map((y) => (
        <group key={y} position={[0, y, -0.004]}>
          <mesh material={mats.chrome}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.05, 10]} />
          </mesh>
          {[0.026, -0.026].map((cy) => (
            <mesh key={cy} position-y={cy} material={mats.chrome}>
              <sphereGeometry args={[0.0045, 8, 4]} />
            </mesh>
          ))}
          <mesh position={[-hinge * 0.014, 0, -0.0045]} material={mats.chrome}>
            <boxGeometry args={[0.024, 0.044, 0.0015]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const DRAWER_OUT = 0.3

/** Мелочи в ящиках: шпатели и пипетки, ёршик, фильтровальная бумага, индикаторная бумага. */
function DrawerContents({ kind, w, mats }: { kind: number; w: number; mats: LabMaterials }) {
  const y = -0.035
  if (kind === 0)
    return (
      <group position={[0, y, -0.13]}>
        {[-0.1, -0.06, -0.02].map((x) => (
          <mesh key={x} position={[x, 0.004, 0]} material={mats.steel}>
            <boxGeometry args={[0.012, 0.004, 0.2]} />
          </mesh>
        ))}
        {[0.04, 0.08].map((x) => (
          <group key={x} position={[x, 0.008, 0]} rotation-x={Math.PI / 2}>
            <mesh material={mats.glass}>
              <cylinderGeometry args={[0.005, 0.003, 0.15, 10]} />
            </mesh>
            <mesh position-y={-0.09} material={mats.rubberBlue}>
              <capsuleGeometry args={[0.009, 0.02, 4, 8]} />
            </mesh>
          </group>
        ))}
      </group>
    )
  if (kind === 1)
    return (
      <group position={[0, y, -0.13]}>
        {[-0.06, 0.03].map((x) => (
          <group key={x} position={[x, 0.01, 0]} rotation-x={Math.PI / 2}>
            <mesh material={mats.darkMetal}>
              <cylinderGeometry args={[0.002, 0.002, 0.22, 6]} />
            </mesh>
            <mesh position-y={0.07} material={mats.whitePlastic}>
              <cylinderGeometry args={[0.011, 0.011, 0.07, 10]} />
            </mesh>
          </group>
        ))}
      </group>
    )
  if (kind === 2)
    return (
      <group position={[0, y, -0.13]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[-0.03 + i * 0.002, 0.002 + i * 0.0015, i * 0.003]} rotation-x={-Math.PI / 2} material={mats.whitePlastic}>
            <circleGeometry args={[0.06, 28]} />
          </mesh>
        ))}
      </group>
    )
  return (
    <group position={[0, y, -0.13]}>
      {[-0.07, 0, 0.07].map((x, i) => (
        <mesh key={x} position={[x, 0.006, 0]} material={i === 1 ? mats.red : i === 2 ? mats.green : mats.door}>
          <boxGeometry args={[0.05, 0.012, Math.min(0.09, w * 0.3)]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Выдвижной ящик: скользит по направляющим с ограничителем (у упора — короткий отскок), шуршание роликов.
 * Нажатие — выдвинуть/задвинуть; можно потянуть на себя (перетаскивание вниз/к камере).
 */
function Drawer({ id, open, w, h, depth, mats, kind }: { id: string; open: boolean; w: number; h: number; depth: number; mats: LabMaterials; kind: number }) {
  const ref = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover, 'grab', 'auto')
  const ph = useRef({ z: 0, v: 0, drag: false, open, first: true })
  const at = (): [number, number, number] => {
    const g = ref.current
    if (!g) return [0, 0.8, 0.4]
    g.getWorldPosition(tmpW)
    return [tmpW.x, tmpW.y, tmpW.z]
  }
  if (ph.current.open !== open) {
    ph.current.open = open
    if (!ph.current.first) labAudio.play('drawer', { at: at(), gain: 0.8 })
  }
  useFrame((_, dtRaw) => {
    const g = ref.current
    const p = ph.current
    if (!g) return
    p.first = false
    const dt = Math.min(dtRaw, 1 / 30)
    if (!p.drag) {
      const target = open ? DRAWER_OUT : 0
      p.v += ((target - p.z) * 60 - p.v * 11) * dt
      p.z += p.v * dt
    }
    if (p.z > DRAWER_OUT + 0.012) {
      p.z = DRAWER_OUT + 0.012
      p.v = -p.v * 0.25
    }
    if (p.z < 0) {
      p.z = 0
      p.v = -p.v * 0.1
    }
    g.position.z = p.z
  })
  const drag = useDragGesture(
    (_dx, dy, dt) => {
      const p = ph.current
      p.drag = true
      const prev = p.z
      p.z = Math.min(DRAWER_OUT + 0.012, Math.max(0, p.z + dy / 420))
      p.v = (p.z - prev) / dt
    },
    (moved) => {
      const p = ph.current
      p.drag = false
      if (moved) labHand.setDoor(id, p.z + p.v * 0.15 > DRAWER_OUT * 0.45)
    },
  )
  const inner = depth - 0.03
  return (
    <group ref={ref}>
      <group
        onClick={(e) => {
          e.stopPropagation()
          if (drag.suppress.current) return
          labHand.toggleDoor(id)
        }}
        onPointerDown={drag.onPointerDown}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        userData={{ interactive: true }}
      >
        {/* Фасад и ручка */}
        <mesh material={mats.door}>
          <boxGeometry args={[w, h, 0.018]} />
        </mesh>
        <group position-z={0.009}>
          <BarHandle mats={mats} />
        </group>
      </group>
      {/* Короб ящика: дно, боковины, задняя стенка (виден, когда выдвинут) */}
      <group position-z={-0.009}>
        <mesh position={[0, -h / 2 + 0.012, -inner / 2]} material={mats.whitePlastic}>
          <boxGeometry args={[w - 0.03, 0.008, inner]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (w / 2 - 0.018), -0.01, -inner / 2]} material={mats.whitePlastic}>
            <boxGeometry args={[0.008, h - 0.04, inner]} />
          </mesh>
        ))}
        <mesh position={[0, -0.01, -inner + 0.004]} material={mats.whitePlastic}>
          <boxGeometry args={[w - 0.03, h - 0.04, 0.008]} />
        </mesh>
        <group position-y={-h / 2 + 0.05}>
          <DrawerContents kind={kind} w={w} mats={mats} />
        </group>
      </group>
    </group>
  )
}

/** Ручка-скоба на стойках. */
function BarHandle({ mats, len = 0.12, vertical = false }: { mats: LabMaterials; len?: number; vertical?: boolean }) {
  return (
    <group rotation-z={vertical ? Math.PI / 2 : 0}>
      <mesh position-z={0.022} rotation-z={Math.PI / 2} material={mats.chrome}>
        <cylinderGeometry args={[0.0055, 0.0055, len, 12]} />
      </mesh>
      {[-len / 2 + 0.008, len / 2 - 0.008].map((x) => (
        <mesh key={x} position={[x, 0, 0.011]} rotation-x={Math.PI / 2} material={mats.chrome}>
          <cylinderGeometry args={[0.004, 0.004, 0.022, 8]} />
        </mesh>
      ))}
    </group>
  )
}

/** Дверцы тумбы, за которыми хранится посуда (наклейка-подсказка на фасаде). */
const BENCH_DOORS_WITH_ITEMS = new Set(LAB_ITEMS.flatMap((d) => (d.store.kind === 'cabinet' && d.store.doorId.startsWith('bench:') ? [d.store.doorId] : [])))
const INSIDE_TEXT: Record<LabLang, string> = { ru: 'Посуда внутри', en: 'Glassware inside', uz: 'Ichida idishlar' }
const STICKER_W = 0.15
const STICKER_H = 0.034

/** Тумба под столом: полый корпус, полка, ящики сверху, 4 дверцы. */
export function BenchCabinet({ mats, lang = 'ru' }: { mats: LabMaterials; lang?: LabLang }) {
  const { doors } = useHand()
  // Наклейка на фасаде: видна, пока дверца закрыта (открыли — уходит вместе с дверцей), за мебелью прячется сама
  const sticker = useMemo(() => {
    const map = signTexture(INSIDE_TEXT[lang], '#2b6cb0', '#ffffff', Math.round((96 * STICKER_W) / STICKER_H), 96)
    return { map, mat: new THREE.MeshStandardMaterial({ map, roughness: 0.55 }) }
  }, [lang])
  useEffect(
    () => () => {
      sticker.map.dispose()
      sticker.mat.dispose()
    },
    [sticker],
  )
  const c = BENCH_CAB
  const cz = BENCH.centerZ
  const y0 = c.bodyY0
  const topY = y0 + c.bodyH
  const doorH = c.bodyH - c.drawerH - 0.03
  const doorY = y0 + 0.015 + doorH / 2
  const t = 0.018
  return (
    <group>
      {/* Цоколь */}
      <mesh position={[0, 0.05, cz]} material={mats.plinth}>
        <boxGeometry args={[c.width - 0.06, 0.1, c.depth - 0.1]} />
      </mesh>
      {/* Дно, задняя стенка, боковины, перегородки */}
      <mesh position={[0, y0 + t / 2, cz]} material={mats.benchBody} receiveShadow>
        <boxGeometry args={[c.width, t, c.depth]} />
      </mesh>
      <mesh position={[0, y0 + c.bodyH / 2, c.backZ + t / 2]} material={mats.benchBody}>
        <boxGeometry args={[c.width, c.bodyH, t]} />
      </mesh>
      {Array.from({ length: c.doors + 1 }, (_, i) => (
        <mesh key={i} position={[-c.width / 2 + c.doorW * i + (i === 0 ? t / 2 : i === c.doors ? -t / 2 : 0), y0 + c.bodyH / 2, cz]} material={mats.benchBody} castShadow>
          <boxGeometry args={[t, c.bodyH, c.depth]} />
        </mesh>
      ))}
      {/* Внутренняя полка и подсветка-отражение светлым пластиком */}
      <mesh position={[0, c.shelfY, cz + 0.02]} material={mats.whitePlastic} receiveShadow>
        <boxGeometry args={[c.width - 0.02, 0.016, c.depth - 0.06]} />
      </mesh>
      {/* Блок ящиков под столешницей */}
      <mesh position={[0, topY - c.drawerH / 2, cz]} material={mats.benchBody}>
        <boxGeometry args={[c.width, c.drawerH, c.depth]} />
      </mesh>
      {Array.from({ length: c.doors }, (_, i) => {
        const x = benchDoorX(i)
        const hinge: -1 | 1 = i < 2 ? -1 : 1
        const id = `bench:${i}`
        return (
          <group key={i}>
            {/* Выдвижной ящик на направляющих */}
            <group position={[x, topY - c.drawerH / 2 - 0.006, c.frontZ + 0.009]}>
              <Drawer id={`drawer:${i}`} open={!!doors[`drawer:${i}`]} w={c.doorW - 0.012} h={c.drawerH - 0.012} depth={c.depth - 0.08} mats={mats} kind={i} />
            </group>
            {/* Свет внутри отделения при открытой дверце */}
            <CabinetGlow open={!!doors[id]} w={c.doorW - 0.03} h={doorH} position={[x, doorY, c.backZ + 0.02]} />
            {/* Дверца на петле */}
            <group position={[x + hinge * (c.doorW / 2 - 0.006), doorY, c.frontZ + 0.009]}>
              <Door id={id} open={!!doors[id]} hinge={hinge} w={c.doorW - 0.012} h={doorH} mats={mats}>
                <RoundedBox args={[c.doorW - 0.012, doorH, 0.018]} radius={0.004} smoothness={2} material={mats.door} castShadow />
                <group position={[-hinge * (c.doorW / 2 - 0.07), doorH / 2 - 0.06, 0.009]}>
                  <BarHandle mats={mats} len={0.1} vertical />
                </group>
                {BENCH_DOORS_WITH_ITEMS.has(id) && (
                  <mesh position={[0, doorH / 2 - 0.17, 0.0096]} material={sticker.mat} raycast={() => null}>
                    <planeGeometry args={[STICKER_W, STICKER_H]} />
                  </mesh>
                )}
              </Door>
            </group>
          </group>
        )
      })}
    </group>
  )
}

/**
 * Мягкий свет внутри отделения: светодиодная полоска под крышкой и тёплое свечение задней стенки, плавно
 * загорается, когда дверца открыта (без настоящего источника света — число источников не меняется,
 * шейдеры сцены не пересобираются).
 */
function CabinetGlow({ open, w, h, position }: { open: boolean; w: number; h: number; position: [number, number, number] }) {
  const strip = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff6e6', transparent: true, opacity: 0, toneMapped: false }), [])
  const wash = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffe9c4', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  useEffect(
    () => () => {
      strip.dispose()
      wash.dispose()
    },
    [strip, wash],
  )
  const k = useRef(0)
  useFrame((_, dt) => {
    const goal = open ? 1 : 0
    if (k.current === goal) return
    k.current = goal > k.current ? Math.min(goal, k.current + dt * 3) : Math.max(goal, k.current - dt * 4)
    strip.opacity = k.current
    wash.opacity = k.current * 0.22
  })
  return (
    <group position={position}>
      <mesh position={[0, h / 2 - 0.012, 0.05]} rotation-x={Math.PI / 2} material={strip}>
        <planeGeometry args={[w - 0.06, 0.012]} />
      </mesh>
      <mesh position={[0, 0, 0.001]} material={wash}>
        <planeGeometry args={[w - 0.03, h - 0.02]} />
      </mesh>
    </group>
  )
}

/** Навесной шкаф со стеклянными дверцами в алюминиевой рамке. */
export function WallCabinet({ mats }: { mats: LabMaterials }) {
  const { doors } = useHand()
  const w = WALL_CAB.x1 - WALL_CAB.x0
  const h = WALL_CAB.y1 - WALL_CAB.y0
  const cx = (WALL_CAB.x0 + WALL_CAB.x1) / 2
  const cy = (WALL_CAB.y0 + WALL_CAB.y1) / 2
  const d = WALL_CAB.d
  const z0 = ROOM.frontZ
  const frontZ = z0 + d
  const t = 0.018
  const doorW = w / 2 - 0.006
  const doorH = h - 0.02
  const glint = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  )
  useEffect(() => () => glint.dispose(), [glint])
  return (
    <group>
      {/* Корпус: дно, крыша, боковины, стенка */}
      <mesh position={[cx, WALL_CAB.y0 + t / 2, z0 + d / 2]} material={mats.whitePlastic} castShadow receiveShadow>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      <mesh position={[cx, WALL_CAB.y1 - t / 2, z0 + d / 2]} material={mats.whitePlastic} castShadow>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      {[WALL_CAB.x0 + t / 2, WALL_CAB.x1 - t / 2].map((x) => (
        <mesh key={x} position={[x, cy, z0 + d / 2]} material={mats.whitePlastic} castShadow>
          <boxGeometry args={[t, h, d]} />
        </mesh>
      ))}
      <mesh position={[cx, cy, z0 + 0.006]} material={mats.wallAccent}>
        <boxGeometry args={[w, h, 0.01]} />
      </mesh>
      {/* Подсветка внутри шкафа (светодиодная полоса) */}
      <mesh position={[cx, WALL_CAB.y1 - t - 0.002, frontZ - 0.05]} rotation-x={Math.PI / 2} material={mats.hoodLight}>
        <planeGeometry args={[w - 0.08, 0.016]} />
      </mesh>
      {([-1, 1] as const).map((hinge, i) => {
        const id = `wall:${i}`
        const hx = hinge === -1 ? WALL_CAB.x0 + 0.004 : WALL_CAB.x1 - 0.004
        return (
          <group key={id} position={[hx, cy, frontZ + 0.01]}>
            <Door id={id} open={!!doors[id]} hinge={hinge} w={doorW} h={doorH} mats={mats}>
              {/* Рамка */}
              {[
                [0, doorH / 2 - 0.012, doorW, 0.024],
                [0, -doorH / 2 + 0.012, doorW, 0.024],
                [doorW / 2 - 0.012, 0, 0.024, doorH],
                [-doorW / 2 + 0.012, 0, 0.024, doorH],
              ].map(([x, y, fw, fh], k) => (
                <mesh key={k} position={[x, y, 0]} material={mats.metal}>
                  <boxGeometry args={[fw, fh, 0.016]} />
                </mesh>
              ))}
              {/* Стекло и лёгкий косой блик */}
              <mesh material={mats.hoodGlass}>
                <planeGeometry args={[doorW - 0.03, doorH - 0.03]} />
              </mesh>
              <group position={[hinge * 0.04, doorH * 0.18, 0.0012]} rotation-z={0.62}>
                <mesh material={glint} raycast={() => null}>
                  <planeGeometry args={[Math.min(0.24, doorW * 0.5), 0.022]} />
                </mesh>
                <mesh position-y={-0.036} material={glint} raycast={() => null}>
                  <planeGeometry args={[Math.min(0.16, doorW * 0.34), 0.008]} />
                </mesh>
              </group>
              <group position={[-hinge * (doorW / 2 - 0.04), -doorH / 2 + 0.09, 0.002]}>
                <BarHandle mats={mats} len={0.09} vertical />
              </group>
            </Door>
          </group>
        )
      })}
    </group>
  )
}
