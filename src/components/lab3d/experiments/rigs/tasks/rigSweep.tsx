/**
 * Уборка установки после ухода из опыта. Материалы, созданные в установке через useMemo (а не JSX), R3F не
 * освобождает — каждый держит свою программу шейдера, и после 20 смен опыта их набирается за 50 (на Windows/ANGLE
 * каждая новая программа — сотни мс). RigScope при размонтировании запоминает материалы и геометрии своей ветки,
 * а через несколько секунд (когда новая установка уже собрана) освобождает те, что так и не вернулись в сцену.
 * Общие кеши (sharedGlass и т. п.), снова взятые новой установкой, в сцене — их не трогаем; текстуры не трогаем.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/** Через сколько после смены опыта освобождать (сборка шейдеров новой установки — до ~1–2 с). */
const SWEEP_DELAY_MS = 4000

type Disposable = THREE.Material | THREE.BufferGeometry

function collect(o: THREE.Object3D, out: Set<Disposable>, skip?: THREE.Object3D) {
  if (o === skip) return
  const m = (o as THREE.Mesh).material
  if (m) for (const x of Array.isArray(m) ? m : [m]) out.add(x)
  const g = (o as THREE.Mesh).geometry
  if (g) out.add(g)
  for (const c of o.children) collect(c, out, skip)
}

export function RigScope({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
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
        collect(scene, used)
        for (const x of mine) if (!used.has(x)) x.dispose()
      }, SWEEP_DELAY_MS)
    }
  }, [])
  return <group ref={ref}>{children}</group>
}
