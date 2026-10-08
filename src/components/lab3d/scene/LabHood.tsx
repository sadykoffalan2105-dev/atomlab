/**
 * Вытяжной шкаф «как настоящий»: стеклянная створка поднимается и опускается перетаскиванием за ручку
 * (с противовесом — плавно, останавливается там, где отпустили; упоры сверху и снизу), тумблер вентилятора
 * на пульте (щелчок, гул, зелёный индикатор), тяга — лёгкие струйки воздуха и пары опыта втягиваются вверх
 * в воздуховод. Пока опыт идёт в вытяжке, а тяга выключена, тумблер мигает.
 */
import { useCursor } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { labAudio } from '../audio/labAudio'
import { labHand, useHand } from '../interaction/labHandStore'
import { BENCH_TOP_Y } from '../labContract'
import { labEvents } from '../labEvents'
import type { LabMaterials } from './labMaterials'
import { HOOD, HOOD_SASH, ROOM } from './labSceneLayout'

/** Должны совпадать с FumeHood (LabRoom): низ створки и верх проёма (под козырьком). Камера знает их же (проём, labSceneLayout). */
export const SASH_BOTTOM = HOOD_SASH.bottom
const CANOPY_H = HOOD_SASH.canopyH
const SASH_TOP = HOOD.h - CANOPY_H
export const SASH_MAX_LIFT = HOOD_SASH.maxLift

/** Положение створки (м подъёма): lift — текущее, target — куда её ведёт рука (можно задать и из кода). */
export const hoodSash = { lift: 0.06, target: 0.06 }

function HoodSash({ mats }: { mats: LabMaterials }) {
  const ref = useRef<THREE.Group>(null)
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null
  const [hover, setHover] = useState(false)
  useCursor(hover, 'ns-resize', 'auto')
  const ph = useRef({ y: hoodSash.lift, v: 0 })
  useFrame((_, dtRaw) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(dtRaw, 1 / 30)
    const p = ph.current
    // Противовес: створка догоняет руку с лёгкой инерцией, у упоров — мягкий отскок
    p.v += ((hoodSash.target - p.y) * 90 - p.v * 15) * dt
    p.y += p.v * dt
    if (p.y < 0) {
      if (p.v < -0.25) labAudio.play('door-close', { at: [HOOD.x, SASH_BOTTOM, ROOM.frontZ + HOOD.d], gain: 0.5 })
      p.y = 0
      p.v = -p.v * 0.2
    }
    if (p.y > SASH_MAX_LIFT) {
      p.y = SASH_MAX_LIFT
      p.v = -p.v * 0.2
    }
    hoodSash.lift = p.y
    g.position.y = p.y
  })
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (controls) controls.enabled = false
    let ly = e.clientY
    const move = (ev: PointerEvent) => {
      // Вверх по экрану — створка поднимается; масштаб — примерно как реальное движение в кадре
      hoodSash.target = Math.min(SASH_MAX_LIFT, Math.max(0, hoodSash.target - (ev.clientY - ly) / 380))
      ly = ev.clientY
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (controls) controls.enabled = true
    }
    labAudio.play('drawer', { at: [HOOD.x, SASH_BOTTOM + ph.current.y, ROOM.frontZ + HOOD.d], gain: 0.45 })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
  }
  const h = SASH_TOP - SASH_BOTTOM
  const handlers = {
    onPointerDown,
    onClick,
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      setHover(true)
    },
    onPointerOut: () => setHover(false),
    userData: { interactive: true },
  }
  return (
    <group position={[HOOD.x, 0, ROOM.frontZ + HOOD.d - 0.03]}>
      <group ref={ref}>
        {/* Стекло не перехватывает нажатия — опыт за створкой остаётся доступным */}
        <mesh position-y={SASH_BOTTOM + h / 2} material={mats.hoodGlass} raycast={() => null}>
          <planeGeometry args={[HOOD.w - 0.14, h]} />
        </mesh>
        {/* Нижняя планка с ручкой — за неё тянут */}
        <group {...handlers}>
          <mesh position-y={SASH_BOTTOM} material={mats.metal}>
            <boxGeometry args={[HOOD.w - 0.12, 0.05, 0.03]} />
          </mesh>
          <mesh position={[0, SASH_BOTTOM - 0.035, 0.03]} rotation-z={Math.PI / 2} material={mats.chrome}>
            <cylinderGeometry args={[0.011, 0.011, HOOD.w * 0.6, 12]} />
          </mesh>
          {/* Широкая невидимая зона захвата (для пальца) */}
          <mesh position={[0, SASH_BOTTOM - 0.02, 0.03]} visible={false}>
            <boxGeometry args={[HOOD.w * 0.75, 0.1, 0.06]} />
          </mesh>
        </group>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (HOOD.w / 2 - 0.075), SASH_BOTTOM + h / 2, 0]} material={mats.metal}>
            <boxGeometry args={[0.02, h, 0.03]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function FanSwitch({ mats }: { mats: LabMaterials }) {
  const { hoodFan, site } = useHand()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const rocker = useRef<THREE.Mesh>(null)
  const led = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const remind = site === 'hood' && !hoodFan
  useFrame((s, dt) => {
    if (rocker.current) rocker.current.rotation.x = THREE.MathUtils.damp(rocker.current.rotation.x, hoodFan ? 0.28 : -0.28, 18, dt)
    if (led.current) led.current.color.set(hoodFan ? '#38d27a' : remind && Math.sin(s.clock.elapsedTime * 6) > 0 ? '#ff9f1c' : '#8a949e')
    if (ring.current) ring.current.scale.setScalar(1 + 0.12 * Math.sin(s.clock.elapsedTime * 4))
  })
  const z = ROOM.frontZ + HOOD.d + 0.004
  const y = HOOD.h - CANOPY_H / 2
  const x = HOOD.x + HOOD.w / 2 - 0.36
  return (
    <group position={[x, y, z]}>
      <mesh material={mats.blackPlastic}>
        <boxGeometry args={[0.07, 0.1, 0.012]} />
      </mesh>
      <mesh
        ref={rocker}
        position-z={0.012}
        material={hoodFan ? mats.green : mats.whitePlastic}
        onClick={(e) => {
          e.stopPropagation()
          labHand.setHoodFan(!hoodFan)
          labAudio.play('click', { at: [x, y, z], gain: 0.6 })
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        userData={{ interactive: true }}
      >
        <boxGeometry args={[0.05, 0.075, 0.018]} />
      </mesh>
      <mesh position={[0.07, 0, 0.002]}>
        <circleGeometry args={[0.012, 16]} />
        <meshBasicMaterial ref={led} color="#8a949e" toneMapped={false} />
      </mesh>
      {remind && (
        <mesh ref={ring} position-z={0.02} raycast={() => null}>
          <ringGeometry args={[0.07, 0.082, 32]} />
          <meshBasicMaterial color="#ff9f1c" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

function puffTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Тяга: струйки воздуха и пары опытов в вытяжке поднимаются к воздуховоду (пул частиц без перерисовок React). */
function HoodDraft({ quality, busy }: { quality: 'low' | 'high'; busy: boolean }) {
  const { hoodFan } = useHand()
  const N = quality === 'high' ? 140 : 56
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [N])
  const tex = useMemo(() => puffTexture(), [])
  const mat = useMemo(
    () => new THREE.PointsMaterial({ map: tex, size: 0.07, transparent: true, opacity: 0.28, depthWrite: false, color: '#e4ecf4', sizeAttenuation: true }),
    [tex],
  )
  useEffect(() => () => [geo, tex, mat].forEach((x) => x.dispose()), [geo, tex, mat])
  const sim = useMemo(() => ({ life: new Float32Array(N), vel: new Float32Array(N * 3), next: 0, acc: 0 }), [N])
  const fanRef = useRef(hoodFan)
  fanRef.current = hoodFan
  // Опыт идёт в вытяжке (NH₃, галогены): лёгкий пар всё время поднимается от места опыта (только на высоком качестве)
  const vapor = busy && quality === 'high'
  const vaporAcc = useRef(0)
  const x0 = HOOD.x - HOOD.w / 2 + 0.1
  const x1 = HOOD.x + HOOD.w / 2 - 0.1
  const z0 = ROOM.frontZ + 0.08
  const z1 = ROOM.frontZ + HOOD.d - 0.08
  const spawn = (x: number, y: number, z: number, spread: number) => {
    const i = sim.next
    sim.next = (sim.next + 1) % N
    const pos = geo.attributes.position.array as Float32Array
    pos[i * 3] = x + (Math.random() - 0.5) * spread
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread
    sim.vel[i * 3] = (Math.random() - 0.5) * 0.04
    sim.vel[i * 3 + 1] = 0.05 + Math.random() * 0.05
    sim.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.04
    sim.life[i] = 1
  }
  // Пары и дым опыта в вытяжке: звук-событие у точки внутри шкафа — облачко
  useEffect(
    () =>
      labEvents.on('sound', (e) => {
        if (!e.at || !['fizz', 'sizzle', 'flame-on', 'pop', 'bubble', 'flame-loop'].includes(e.name)) return
        const [x, y, z] = e.at
        if (x < x0 - 0.05 || x > x1 + 0.05 || z < z0 - 0.1 || z > z1 + 0.1) return
        for (let k = 0; k < (quality === 'high' ? 24 : 10); k++) spawn(x, y + 0.04, z, 0.08)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo, quality],
  )
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30)
    const fan = fanRef.current
    // Струйки втягиваемого воздуха — только при включённой тяге
    if (fan) {
      sim.acc += dt * (quality === 'high' ? 9 : 4)
      while (sim.acc > 1) {
        sim.acc -= 1
        spawn(x0 + Math.random() * (x1 - x0), BENCH_TOP_Y + 0.05 + Math.random() * 0.25, z1 - Math.random() * 0.1, 0.02)
      }
    }
    if (vapor) {
      vaporAcc.current += dt * 3
      while (vaporAcc.current > 1) {
        vaporAcc.current -= 1
        spawn(HOOD.x + (Math.random() - 0.5) * 0.3, BENCH_TOP_Y + 0.14, (z0 + z1) / 2, 0.06)
      }
    }
    const pos = geo.attributes.position.array as Float32Array
    const topY = HOOD.h - CANOPY_H - 0.05
    const ventX = HOOD.x
    const ventZ = ROOM.frontZ + 0.3
    let alive = 0
    for (let i = 0; i < N; i++) {
      if (sim.life[i] <= 0) {
        pos[i * 3 + 1] = -10
        continue
      }
      alive++
      const j = i * 3
      if (fan) {
        // Тяга: вверх и к воздуховоду, чем выше — тем сильнее
        const up = 0.35 + (pos[j + 1] - BENCH_TOP_Y) * 0.6
        sim.vel[j] += ((ventX - pos[j]) * 0.6 - sim.vel[j]) * dt * 2
        sim.vel[j + 1] += (up - sim.vel[j + 1]) * dt * 2.5
        sim.vel[j + 2] += ((ventZ - pos[j + 2]) * 0.8 - sim.vel[j + 2]) * dt * 2
      } else {
        // Без тяги пар медленно поднимается и расползается — может выйти из шкафа
        sim.vel[j + 1] += (0.06 - sim.vel[j + 1]) * dt
        sim.vel[j + 2] += (0.05 - sim.vel[j + 2]) * dt * 0.5
      }
      pos[j] += sim.vel[j] * dt
      pos[j + 1] += sim.vel[j + 1] * dt
      pos[j + 2] += sim.vel[j + 2] * dt
      sim.life[i] -= dt * (fan ? 0.45 : 0.18)
      if (pos[j + 1] > topY + (fan ? 0 : 0.6)) sim.life[i] = 0
    }
    geo.attributes.position.needsUpdate = true
    mat.opacity = alive ? 0.26 : 0
  })
  return <points geometry={geo} material={mat} frustumCulled={false} raycast={() => null} />
}

export function LabHoodControls({ mats, quality, busy = false }: { mats: LabMaterials; quality: 'low' | 'high'; busy?: boolean }) {
  return (
    <group>
      <HoodSash mats={mats} />
      <FanSwitch mats={mats} />
      <HoodDraft quality={quality} busy={busy} />
    </group>
  )
}

// Для автоматических кадров: …#/vr-lab?debugHand=1 — window.__labHood.lift(м)
if (typeof window !== 'undefined' && /[?&]debugHand=1/.test(window.location.hash)) {
  ;(window as unknown as { __labHood?: { lift: (m: number) => void } }).__labHood = {
    lift: (m: number) => {
      hoodSash.target = Math.min(SASH_MAX_LIFT, Math.max(0, m))
    },
  }
}
