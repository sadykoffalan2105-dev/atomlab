/**
 * Уборка установки после ухода из опыта. Материалы, созданные в установке через useMemo (а не JSX), R3F не
 * освобождает — каждый держит свою программу шейдера, и после 20 смен опыта их набирается за 50 (на Windows/ANGLE
 * каждая новая программа — сотни мс). RigScope при размонтировании запоминает материалы и геометрии своей ветки,
 * а через несколько секунд (когда новая установка уже собрана) освобождает те, что так и не вернулись в сцену.
 *
 * Материал освобождается, только если это может отпустить программу: хотя бы одна его программа не нужна
 * постоянной части сцены (комната, мебель — всё вне установок). Материалы с программой комнаты (обычный
 * MeshStandardMaterial и т. п.) не трогаем: эту программу всё равно не отпустить, а среди таких — общие кеши модулей
 * (перчатка GripHand, sharedGlass…), которые следующая установка взяла бы уже освобождёнными. Текстуры не трогаем.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Через сколько после смены опыта освобождать (сборка шейдеров новой установки — до ~1–2 с). */
const SWEEP_DELAY_MS = 4000

type Disposable = THREE.Material | THREE.BufferGeometry
type MatProps = { programs?: Map<string, unknown> }

/** Материалы и геометрии ветки; room — то же без веток установок (RigScope), т. е. постоянная часть сцены. */
function collect(o: THREE.Object3D, out: Set<Disposable>, room?: Set<Disposable>, inRig = false) {
  const rig = inRig || o.userData.rigScope === true
  const m = (o as THREE.Mesh).material
  if (m)
    for (const x of Array.isArray(m) ? m : [m]) {
      out.add(x)
      if (!rig) room?.add(x)
    }
  const g = (o as THREE.Mesh).geometry
  if (g) out.add(g)
  for (const c of o.children) collect(c, out, room, rig)
}

export function RigScope({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  // layout-очистка выполняется до того, как R3F отцепит объекты ветки, — ветка ещё целая и в сцене
  useLayoutEffect(() => {
    const g = ref.current
    return () => {
      if (!g) return
      let scene: THREE.Object3D = g
      while (scene.parent) scene = scene.parent
      const mine = new Set<Disposable>()
      collect(g, mine)
      window.setTimeout(() => {
        const used = new Set<Disposable>()
        const room = new Set<Disposable>()
        collect(scene, used, room)
        const props = gl.properties
        const programsOf = (m: THREE.Material) => (props.has(m) ? (props.get(m) as MatProps).programs : undefined)
        // программы постоянной части сцены — их не отпустить никогда
        const live = new Set<unknown>()
        for (const x of room) if (x instanceof THREE.Material) programsOf(x)?.forEach((pr) => live.add(pr))
        for (const x of mine) {
          if (used.has(x)) continue
          if (x instanceof THREE.Material) {
            const progs = programsOf(x)
            // не собирался ни разу или все его программы нужны комнате — освобождение ничего не даст
            if (!progs || ![...progs.values()].some((pr) => !live.has(pr))) continue
          }
          x.dispose()
        }
      }, SWEEP_DELAY_MS)
    }
  }, [gl])
  return (
    <group ref={ref} userData={{ rigScope: true }}>
      {children}
    </group>
  )
}
