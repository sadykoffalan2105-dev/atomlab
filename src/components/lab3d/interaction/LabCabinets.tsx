/**
 * Шкафы с дверцами, которые открываются нажатием (плавно, на петлях): тумба под рабочим столом (4 секции,
 * внутри полка, спиртовка, спички, лучинки, фарфоровая чашка) и навесной шкаф со стеклянными дверцами над полками
 * реактивов (колбы, стакан, цилиндр, воронка, пробирка, часовое стекло). Корпуса полые — внутри видно посуду.
 */
import { RoundedBox, useCursor } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import type { LabMaterials } from '../scene/labMaterials'
import { BENCH, ROOM } from '../scene/labSceneLayout'
import { BENCH_CAB, WALL_CAB, benchDoorX } from './labItems'
import { labHand, useHand } from './labHandStore'

const OPEN_ANGLE = 1.85

/** Дверца на петле: hinge — край с петлями (−1 левый, +1 правый). Группа стоит в точке петли. */
function Door({
  id,
  open,
  hinge,
  w,
  h,
  children,
}: {
  id: string
  open: boolean
  hinge: -1 | 1
  w: number
  h: number
  children: React.ReactNode
}) {
  const ref = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    // Левая петля: дверца раскрывается к ученику (поворот −), правая — (+)
    const target = open ? hinge * OPEN_ANGLE : 0
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 5.5, dt)
  })
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    labHand.toggleDoor(id)
  }
  return (
    <group ref={ref}>
      <group
        position-x={-hinge * (w / 2)}
        onClick={onClick}
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
      {/* Петли */}
      {[h * 0.38, -h * 0.38].map((y) => (
        <mesh key={y} position={[0, y, -0.004]}>
          <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
          <meshStandardMaterial color="#9aa4ae" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
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

/** Тумба под столом: полый корпус, полка, ящики сверху, 4 дверцы. */
export function BenchCabinet({ mats }: { mats: LabMaterials }) {
  const { doors } = useHand()
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
            {/* Ящик */}
            <mesh position={[x, topY - c.drawerH / 2 - 0.006, c.frontZ + 0.009]} material={mats.door}>
              <boxGeometry args={[c.doorW - 0.012, c.drawerH - 0.012, 0.018]} />
            </mesh>
            <group position={[x, topY - c.drawerH / 2 - 0.006, c.frontZ + 0.018]}>
              <BarHandle mats={mats} />
            </group>
            {/* Дверца на петле */}
            <group position={[x + hinge * (c.doorW / 2 - 0.006), doorY, c.frontZ + 0.009]}>
              <Door id={id} open={!!doors[id]} hinge={hinge} w={c.doorW - 0.012} h={doorH}>
                <RoundedBox args={[c.doorW - 0.012, doorH, 0.018]} radius={0.004} smoothness={2} material={mats.door} castShadow />
                <group position={[-hinge * (c.doorW / 2 - 0.07), doorH / 2 - 0.06, 0.009]}>
                  <BarHandle mats={mats} len={0.1} vertical />
                </group>
              </Door>
            </group>
          </group>
        )
      })}
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
            <Door id={id} open={!!doors[id]} hinge={hinge} w={doorW} h={doorH}>
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
              {/* Стекло */}
              <mesh material={mats.hoodGlass}>
                <planeGeometry args={[doorW - 0.03, doorH - 0.03]} />
              </mesh>
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
