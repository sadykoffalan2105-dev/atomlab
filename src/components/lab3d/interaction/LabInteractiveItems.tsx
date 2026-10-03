/**
 * Интерактивные предметы: нажал на склянку на полке / посуду в шкафу — она плавно поднимается и «летит в руку»
 * (зависает перед камерой справа внизу, слегка покачивается). Пока предмет в руке — подсвечены места, куда его
 * можно поставить: рабочее место (слот у края), свободные места стола, своё место на полке.
 * Предмет на столе перетаскивается мышью/пальцем по столешнице (края стола, круги-коллайдеры).
 * Двойной клик/тап — камера приближается к предмету. Нужный опыту предмет пульсирует и подписан «Возьмите».
 */
import { Html, useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { labEvents, type LabItemId } from '../labEvents'
import { WORK_AREA_SIZE, type LabLang, type LabText } from '../labContract'
import type { LabSceneBridge } from '../scene/labBridge'
import type { LabMaterials } from '../scene/labMaterials'
import { LabItemModel } from './LabItemModels'
import { BENCH_Y, LAB_ITEMS, TAKE_LABEL, WORK_RECT, type LabItemDef } from './labItems'
import { freeSlot, itemXZ, labHand, useHand, type ItemZone } from './labHandStore'
import css from './labInteraction.module.css'

const WORK_LABEL: LabText = { ru: 'Рабочее место', en: 'Work area', uz: 'Ish joyi' }
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

interface Shared {
  readonly mats: LabMaterials
  readonly lang: LabLang
  readonly quality: 'low' | 'high'
  readonly bridge: LabSceneBridge
}

/** Общие материалы подсветки (одна программа шейдера на все кольца). */
function useGlowMats() {
  const m = useMemo(
    () => ({
      need: new THREE.MeshBasicMaterial({ color: '#2f7cf6', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
      hover: new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
      target: new THREE.MeshBasicMaterial({ color: '#2f7cf6', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      work: new THREE.MeshBasicMaterial({ color: '#1f9d63', transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      edge: new THREE.MeshBasicMaterial({ color: '#1f9d63', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    }),
    [],
  )
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m])
  return m
}
type GlowMats = ReturnType<typeof useGlowMats>

const tmpV = new THREE.Vector3()

interface ItemProps extends Shared {
  readonly def: LabItemDef
  readonly zone: ItemZone
  readonly needed: boolean
  readonly dragging: boolean
  readonly glow: GlowMats
}

const InteractiveItem = memo(function InteractiveItem({ def, zone, needed, dragging, mats, lang, quality, bridge, glow }: ItemProps) {
  const ref = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const [hover, setHover] = useState(false)
  useCursor(hover && zone !== 'hand', dragging ? 'grabbing' : zone === 'bench' || zone === 'work' ? 'grab' : 'pointer', 'auto')
  const anim = useRef({ zone: zone as ItemZone, from: new THREE.Vector3(...def.home), t: 1, yaw: 0, first: true })
  const clickTimer = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)
  useEffect(() => () => window.clearTimeout(clickTimer.current), [])

  useFrame((state, dt) => {
    const g = ref.current
    if (!g) return
    const a = anim.current
    // Цель: дом, рука перед камерой, место на столе
    const target = tmpV
    let yaw = 0
    if (zone === 'hand') {
      const d = 0.42 + def.h * 1.25
      const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const halfW = halfH * camera.aspect
      const time = state.clock.elapsedTime
      target.set(halfW * (camera.aspect < 1 ? 0.42 : 0.58), -halfH * 0.62 - def.h * 0.35 + Math.sin(time * 1.7) * 0.004, -d)
      target.applyQuaternion(camera.quaternion).add(camera.position)
      yaw = Math.atan2(camera.position.x - target.x, camera.position.z - target.z) + Math.sin(time * 1.1) * 0.05
    } else if (zone === 'bench' || zone === 'work') {
      const p = itemXZ.get(def.id)
      target.set(p?.[0] ?? def.home[0], BENCH_Y + (dragging ? 0.018 : 0), p?.[1] ?? def.home[2])
    } else {
      target.set(def.home[0], def.home[1], def.home[2])
    }
    if (a.first) {
      g.position.copy(target)
      a.first = false
    }
    if (a.zone !== zone) {
      a.from.copy(g.position)
      a.t = 0
      a.zone = zone
    }
    if (a.t < 1 && !dragging) {
      a.t = Math.min(1, a.t + dt / (zone === 'hand' ? 0.7 : 0.6))
      const k = ease(a.t)
      g.position.lerpVectors(a.from, target, k)
      // Дуга: предмет приподнимается над полкой/столом, а не едет сквозь мебель
      g.position.y += Math.sin(Math.PI * a.t) * (zone === 'hand' ? 0.12 : 0.09)
    } else {
      g.position.copy(target)
    }
    a.yaw = THREE.MathUtils.damp(a.yaw, yaw, 8, dt)
    g.rotation.set(zone === 'hand' ? -0.12 : 0, a.yaw, zone === 'hand' ? Math.sin(state.clock.elapsedTime * 1.3) * 0.03 : 0)
    const ring = ringRef.current
    if (ring) {
      const s = 1 + 0.18 * Math.sin(state.clock.elapsedTime * 4)
      ring.scale.setScalar(needed ? s : 1)
    }
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (zone === 'hand') return
    e.stopPropagation()
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    window.clearTimeout(clickTimer.current)
    // Небольшая задержка — отличаем одиночный клик (взять) от двойного (приблизить)
    clickTimer.current = window.setTimeout(() => labHand.pick(def.id), 210)
  }
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (zone === 'hand') return
    e.stopPropagation()
    window.clearTimeout(clickTimer.current)
    const g = ref.current
    if (g) bridge.zoomTo?.(g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, def.h / 2, 0)), 0.45 + def.h)
  }
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (zone !== 'bench' && zone !== 'work') return
    e.stopPropagation()
    if (controls) controls.enabled = false
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BENCH_Y)
    const hit = new THREE.Vector3()
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const p0 = itemXZ.get(def.id) ?? [def.home[0], def.home[2]]
    const off = e.ray.intersectPlane(plane, hit) ? [p0[0] - hit.x, p0[1] - hit.z] : [0, 0]
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
      if (!moved) {
        moved = true
        window.clearTimeout(clickTimer.current)
        labHand.dragStart(def.id)
      }
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hit)) labHand.dragMove(def.id, hit.x + off[0], hit.z + off[1])
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (controls) controls.enabled = true
      if (moved) {
        suppressClick.current = true
        window.setTimeout(() => (suppressClick.current = false), 60)
        labHand.dragEnd(def.id)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const showRing = zone !== 'hand' && (needed || hover)
  return (
    <group
      ref={ref}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerOver={(e) => {
        if (zone === 'hand') return
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <LabItemModel def={def} mats={mats} lang={lang} quality={quality} />
      {/* Невидимая «ручка» для попадания пальцем: цилиндр чуть шире предмета */}
      <mesh position-y={def.h / 2} visible={false}>
        <cylinderGeometry args={[def.r + 0.012, def.r + 0.012, Math.max(0.05, def.h + 0.02), 10]} />
      </mesh>
      {showRing && (
        <mesh ref={ringRef} position-y={0.003} rotation-x={-Math.PI / 2} material={needed ? glow.need : glow.hover} raycast={() => null}>
          <ringGeometry args={[def.r + 0.006, def.r + 0.016, 40]} />
        </mesh>
      )}
      {needed && zone === 'home' && (
        <Html position={[0, def.h + 0.05, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={css.tag}>{TAKE_LABEL[lang]}</div>
        </Html>
      )}
    </group>
  )
})

/** Места, куда можно поставить предмет из руки. */
function PlaceTargets({ held, lang, glow }: { held: LabItemId; lang: LabLang; glow: GlowMats }) {
  const def = LAB_ITEMS.find((d) => d.id === held)
  const hand = useHand()
  const work = useMemo(() => freeSlot('work', held), [held, hand.zones])
  const bench = useMemo(() => freeSlot('bench', held), [held, hand.zones])
  const pulse = useRef<THREE.Group>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  useCursor(!!hoverKey)
  useFrame((s) => {
    const k = 0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 3.2)
    glow.target.opacity = 0.22 + 0.25 * k
    glow.work.opacity = 0.3 + 0.3 * k
    glow.edge.opacity = 0.55 + 0.4 * k
    if (pulse.current) pulse.current.scale.setScalar(1 + 0.06 * k)
  })
  if (!def) return null
  const r = def.r + 0.02
  const W = WORK_AREA_SIZE.w
  const D = WORK_AREA_SIZE.d
  const cx = (WORK_RECT.x0 + WORK_RECT.x1) / 2
  const cz = (WORK_RECT.z0 + WORK_RECT.z1) / 2
  const y = BENCH_Y + 0.002
  const hov = (k: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHoverKey(k)
    },
    onPointerOut: () => setHoverKey((h) => (h === k ? null : h)),
  })
  return (
    <group>
      {/* Рабочее место: светящаяся рамка + слот у края */}
      <group position={[cx, y, cz]}>
        {[
          [0, D / 2, W, 0.008],
          [0, -D / 2, W, 0.008],
          [W / 2, 0, 0.008, D],
          [-W / 2, 0, 0.008, D],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, 0, z]} rotation-x={-Math.PI / 2} material={glow.edge} raycast={() => null}>
            <planeGeometry args={[w, d]} />
          </mesh>
        ))}
      </group>
      {work && (
        <group position={[work[0], y, work[1]]}>
          <group ref={pulse}>
            <mesh
              rotation-x={-Math.PI / 2}
              material={glow.work}
              onClick={(e) => {
                e.stopPropagation()
                labHand.place('work', work)
              }}
              {...hov('work')}
            >
              <circleGeometry args={[r, 40]} />
            </mesh>
          </group>
          <Html position={[0, 0.05, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className={css.tagWork}>{WORK_LABEL[lang]}</div>
          </Html>
        </group>
      )}
      {bench && (
        <mesh
          position={[bench[0], y, bench[1]]}
          rotation-x={-Math.PI / 2}
          material={glow.target}
          onClick={(e) => {
            e.stopPropagation()
            labHand.place('bench', bench)
          }}
          {...hov('bench')}
        >
          <circleGeometry args={[r, 40]} />
        </mesh>
      )}
      {/* Своё место на полке / в шкафу */}
      <mesh
        position={[def.home[0], def.home[1] + 0.003, def.home[2]]}
        rotation-x={-Math.PI / 2}
        material={glow.target}
        onClick={(e) => {
          e.stopPropagation()
          labHand.putBack()
        }}
        {...hov('shelf')}
      >
        <circleGeometry args={[def.r + 0.01, 32]} />
      </mesh>
    </group>
  )
}

/** Подсказки опыта: аккуратная метка над точкой на 2,5 с. */
function LabHints() {
  const [hints, setHints] = useState<ReadonlyArray<{ key: number; at: readonly [number, number, number]; text: string }>>([])
  useEffect(() => {
    let n = 0
    const timers = new Set<number>()
    const off = labEvents.on('hint', (e) => {
      const key = ++n
      setHints((h) => [...h.slice(-2), { key, at: e.at, text: e.text }])
      const t = window.setTimeout(() => {
        timers.delete(t)
        setHints((h) => h.filter((x) => x.key !== key))
      }, 2500)
      timers.add(t)
    })
    return () => {
      off()
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [])
  return (
    <>
      {hints.map((h) => (
        <Html key={h.key} position={h.at as unknown as THREE.Vector3Tuple} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={css.hint}>{h.text}</div>
        </Html>
      ))}
    </>
  )
}

export function LabInteractiveItems(props: Shared) {
  const hand = useHand()
  const glow = useGlowMats()
  // Опыт сообщает, какой предмет нужен; сцена, смонтированная позже, берёт последний запрос
  useEffect(() => {
    labHand.setNeed(labEvents.currentNeed())
    return labEvents.on('need', (e) => labHand.setNeed(e.itemIds))
  }, [])
  return (
    <group>
      {LAB_ITEMS.map((def) => (
        <InteractiveItem
          key={def.id}
          def={def}
          zone={hand.zones[def.id] ?? 'home'}
          needed={hand.need.includes(def.id) && hand.held !== def.id}
          dragging={hand.dragging === def.id}
          glow={glow}
          {...props}
        />
      ))}
      {hand.held && <PlaceTargets held={hand.held} lang={props.lang} glow={glow} />}
      <LabHints />
    </group>
  )
}
