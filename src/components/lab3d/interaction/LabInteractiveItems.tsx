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
import { labAudio } from '../audio/labAudio'
import { labEvents, type LabGearId, type LabItemId } from '../labEvents'
import type { LabLang, LabText } from '../labContract'
import type { LabSceneBridge } from '../scene/labBridge'
import { LABEL_Z_MIN, LabLabel } from '../scene/labOccluders'
import type { LabMaterials } from '../scene/labMaterials'
import { LabItemModel } from './LabItemModels'
import { BENCH_Y, LAB_ITEMS, TAKE_LABEL, itemSoundMaterial, type LabItemDef } from './labItems'
import { currentWorkRect, freeSlot, itemXZ, labHand, useHand, type ItemZone } from './labHandStore'
import { HeldHand, LabSafetyGear } from './LabSafetyGear'
import css from './labInteraction.module.css'
import { labXr } from '../xr/labXrStore'
import type { XrEventInfo } from '../xr/xrRayInput'

const tmpVel = new THREE.Vector3()
const tmpAcc = new THREE.Vector3()
const tmpRight = new THREE.Vector3()
const tmpPivot = new THREE.Vector3()
const liqEuler = new THREE.Euler()
/** Середина столба раствора в склянке (м от дна) — ось колыхания. */
const LIQ_PIVOT = 0.05

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
  /** Надетые средства защиты: в руке видна перчатка и рукав халата. */
  readonly worn: readonly LabGearId[]
}

const InteractiveItem = memo(function InteractiveItem({ def, zone, needed, dragging, mats, lang, quality, bridge, glow, worn }: ItemProps) {
  const ref = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const [hover, setHover] = useState(false)
  useCursor(hover && zone !== 'hand', dragging ? 'grabbing' : zone === 'bench' || zone === 'work' ? 'grab' : 'pointer', 'auto')
  const anim = useRef({ zone: zone as ItemZone, from: new THREE.Vector3(...def.home), t: 1, yaw: 0, first: true })
  // Физика: скорость (пружина в руке, трение на столе), ускорение для наклона и колыхания раствора, «посадка»
  const phys = useRef({
    vel: new THREE.Vector3(),
    prev: new THREE.Vector3(),
    prevVel: new THREE.Vector3(),
    acc: new THREE.Vector3(),
    settle: 1,
    slosh: { x: 0, z: 0, vx: 0, vz: 0 },
    roll: 0,
    pitch: 0,
    liquid: null as THREE.Object3D | null | undefined,
  })
  const clickTimer = useRef<number | undefined>(undefined)
  const suppressClick = useRef(false)
  useEffect(() => () => window.clearTimeout(clickTimer.current), [])

  useFrame((state, dtRaw) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(dtRaw, 1 / 30)
    const a = anim.current
    const ph = phys.current
    // Цель: дом, рука перед камерой, место на столе
    const target = tmpV
    let yaw = 0
    if (zone === 'hand') {
      // Чем выше предмет, тем дальше от камеры — в кадре он занимает примерно четверть высоты
      const d = 0.5 + def.h * 1.6
      const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      const halfW = halfH * camera.aspect
      const time = state.clock.elapsedTime
      const phone = camera.aspect < 1
      // Лёгкое «дыхание» руки
      target.set(halfW * (phone ? 0.5 : 0.76), -halfH * (phone ? 0.12 : 0.06) - def.h * 0.5 + Math.sin(time * 1.7) * 0.003, -d)
      target.applyQuaternion(camera.quaternion).add(camera.position)
      yaw = Math.atan2(camera.position.x - target.x, camera.position.z - target.z) + Math.sin(time * 1.1) * 0.04
    } else if (zone === 'bench' || zone === 'work') {
      const p = itemXZ.get(def.id)
      target.set(p?.[0] ?? def.home[0], BENCH_Y + (dragging ? 0.004 : 0), p?.[1] ?? def.home[2])
    } else {
      target.set(def.home[0], def.home[1], def.home[2])
    }
    if (a.first) {
      g.position.copy(target)
      ph.prev.copy(target)
      a.first = false
    }
    if (a.zone !== zone) {
      a.from.copy(g.position)
      a.t = 0
      a.zone = zone
      ph.vel.set(0, 0, 0)
    }
    if (a.t < 1 && !dragging) {
      a.t = Math.min(1, a.t + dt / (zone === 'hand' ? 0.7 : 0.6))
      const k = ease(a.t)
      g.position.lerpVectors(a.from, target, k)
      // Дуга: предмет приподнимается над полкой/столом, а не едет сквозь мебель
      g.position.y += Math.sin(Math.PI * a.t) * (zone === 'hand' ? 0.12 : 0.09)
      if (a.t >= 1 && zone !== 'hand') {
        // Коснулся поверхности: мягкая «посадка» с маленьким отскоком и стук по материалу
        ph.settle = 0
        // Громкость стука — по скорости касания: чем дальше летел предмет за те же 0,6 с, тем быстрее и громче
        const speed = a.from.distanceTo(target) / 0.6
        const land = THREE.MathUtils.clamp(0.35 + speed * 0.28, 0.35, 1)
        labAudio.play('glass-place', { at: [target.x, target.y, target.z], material: itemSoundMaterial(def.id), gain: (zone === 'home' ? 0.7 : 0.95) * land })
      }
    } else if (zone === 'hand') {
      // Пружина с затуханием: при повороте камеры предмет чуть отстаёт и покачивается (инерция)
      const kS = 230
      const c = 2 * Math.sqrt(kS) * 0.62
      ph.vel.x += ((target.x - g.position.x) * kS - ph.vel.x * c) * dt
      ph.vel.y += ((target.y - g.position.y) * kS - ph.vel.y * c) * dt
      ph.vel.z += ((target.z - g.position.z) * kS - ph.vel.z * c) * dt
      g.position.addScaledVector(ph.vel, dt)
      // Слишком далеко отстал (резкий перелёт камеры) — догоняет сразу
      if (g.position.distanceToSquared(target) > 0.09) g.position.copy(target)
    } else if (dragging || zone === 'bench' || zone === 'work') {
      // Скольжение по столу с трением: визуально догоняет точку под пальцем, при отпускании у края — съезжает обратно
      g.position.x = THREE.MathUtils.damp(g.position.x, target.x, dragging ? 16 : 9, dt)
      g.position.z = THREE.MathUtils.damp(g.position.z, target.z, dragging ? 16 : 9, dt)
      g.position.y = target.y
    } else {
      g.position.copy(target)
    }
    // Посадка: затухающий отскок 6 мм → 0 за ~0,35 с
    if (ph.settle < 1) {
      ph.settle = Math.min(1, ph.settle + dt / 0.35)
      const s = ph.settle
      g.position.y += 0.006 * Math.exp(-s * 5) * Math.abs(Math.sin(s * Math.PI * 3))
    }
    // Скорость и ускорение (сглаженные) — для наклона предмета и колыхания жидкости
    if (dt > 0) {
      tmpVel.copy(g.position).sub(ph.prev).divideScalar(dt)
      tmpAcc.copy(tmpVel).sub(ph.prevVel).divideScalar(dt)
      ph.acc.lerp(tmpAcc, 0.25)
      ph.prevVel.copy(tmpVel)
      ph.prev.copy(g.position)
    }
    // Ускорение в осях камеры: вправо — предмет наклоняется влево (инерция), вперёд — кивает
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const accRight = ph.acc.dot(tmpRight)
    let roll = 0
    let pitch = 0
    if (zone === 'hand') {
      roll = THREE.MathUtils.clamp(-accRight * 0.012, -0.22, 0.22) + Math.sin(state.clock.elapsedTime * 1.3) * 0.025
      pitch = -0.12 + THREE.MathUtils.clamp(ph.acc.y * 0.006, -0.12, 0.12)
    } else if (dragging) {
      // Трение о стол: верх предмета чуть «запаздывает» в сторону, обратную движению
      roll = THREE.MathUtils.clamp(-ph.prevVel.x * 0.18, -0.09, 0.09)
      pitch = THREE.MathUtils.clamp(ph.prevVel.z * 0.18, -0.09, 0.09)
    }
    ph.roll = THREE.MathUtils.damp(ph.roll, roll, 10, dt)
    ph.pitch = THREE.MathUtils.damp(ph.pitch, pitch, 10, dt)
    a.yaw = THREE.MathUtils.damp(a.yaw, yaw, 8, dt)
    g.rotation.set(ph.pitch, a.yaw, ph.roll)
    // Раствор в склянке колышется: затухающие колебания поверхности, которые раскачивает ускорение
    if (ph.liquid === undefined) ph.liquid = g.getObjectByName('liquid') ?? null
    const liq = ph.liquid
    if (liq) {
      const sl = ph.slosh
      const w = 9
      const z = 0.14
      const driveX = THREE.MathUtils.clamp(ph.acc.z * 0.01, -0.08, 0.08) - ph.pitch * 0.85
      const driveZ = THREE.MathUtils.clamp(-ph.acc.x * 0.01, -0.08, 0.08) - ph.roll * 0.85
      sl.vx += (-(sl.x - driveX) * w * w - 2 * z * w * sl.vx) * dt
      sl.vz += (-(sl.z - driveZ) * w * w - 2 * z * w * sl.vz) * dt
      sl.x = THREE.MathUtils.clamp(sl.x + sl.vx * dt, -0.12, 0.12)
      sl.z = THREE.MathUtils.clamp(sl.z + sl.vz * dt, -0.12, 0.12)
      // Поворот вокруг середины столба жидкости — края не вылезают из стекла
      liqEuler.set(sl.x, 0, sl.z)
      tmpPivot.set(0, LIQ_PIVOT, 0).applyEuler(liqEuler)
      liq.rotation.copy(liqEuler)
      liq.position.set(-tmpPivot.x, LIQ_PIVOT - tmpPivot.y, -tmpPivot.z)
    }
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
    // луч VR-контроллера (или эмуляции): предмет ведёт пересечение луча с плоскостью стола, конец — selectend
    const xr = (e as unknown as { xr?: XrEventInfo }).xr
    if (xr) {
      const start = hit.clone()
      let movedXr = false
      xr.onFrame((r) => {
        if (!r.intersectPlane(plane, hit)) return
        if (!movedXr && hit.distanceTo(start) < 0.02) return
        if (!movedXr) {
          movedXr = true
          window.clearTimeout(clickTimer.current)
          labHand.dragStart(def.id)
        }
        labHand.dragMove(def.id, hit.x + off[0], hit.z + off[1])
      })
      xr.onEnd(() => {
        if (controls) controls.enabled = !labXr.get().presenting
        if (movedXr) labHand.dragEnd(def.id)
      })
      return
    }
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
      name={`labItem:${def.id}`}
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
      {zone === 'hand' && <HeldHand r={def.r} h={def.h} gloved={worn.includes('gloves')} coat={worn.includes('coat')} mats={mats} />}
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
        <LabLabel position={[0, def.h + 0.05, 0]}>
          <div className={css.tag}>{TAKE_LABEL[lang]}</div>
        </LabLabel>
      )}
    </group>
  )
})

/** Места, куда можно поставить предмет из руки. */
function PlaceTargets({ held, lang, glow }: { held: LabItemId; lang: LabLang; glow: GlowMats }) {
  const def = LAB_ITEMS.find((d) => d.id === held)
  const hand = useHand()
  const work = useMemo(() => freeSlot('work', held), [held, hand.zones, hand.site])
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
  // Рабочее место — на столе или в вытяжке (по опыту)
  const wr = currentWorkRect()
  const W = wr.x1 - wr.x0
  const D = wr.z1 - wr.z0
  const cx = (wr.x0 + wr.x1) / 2
  const cz = (wr.z0 + wr.z1) / 2
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
          <LabLabel position={[0, 0.05, 0]}>
            <div className={css.tagWork}>{WORK_LABEL[lang]}</div>
          </LabLabel>
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
        <Html key={h.key} position={h.at as unknown as THREE.Vector3Tuple} zIndexRange={[30, LABEL_Z_MIN]} style={{ pointerEvents: 'none' }}>
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
          worn={hand.worn}
          {...props}
        />
      ))}
      {hand.held && <PlaceTargets held={hand.held} lang={props.lang} glow={glow} />}
      <LabSafetyGear mats={props.mats} lang={props.lang} />
      <LabHints />
    </group>
  )
}
