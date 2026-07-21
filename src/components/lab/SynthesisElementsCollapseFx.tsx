import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import {
  createElementsCollapseAnimation,
  resolveCollapseOptionsForDevice,
  type ElementsCollapseController,
} from '../../lab/synthesisCollapseEffect/elementsCollapseAnimation'

const ATOM_WAIT_FRAMES = 24
const PROXY_COUNT_DEFAULT = 5

/**
 * Коллапс Bohr-атомов + particle burst между «Запустить синтез» и молекулой.
 * Верный порт vendor/expl_threejs_effect_v02gm_dev.
 * Если Bohr-refs ещё пусты — ставит proxy-сферы, чтобы FX всегда был виден
 * для любого из 200+ продуктов.
 */
export function SynthesisElementsCollapseFx({
  atomGroupRefs,
  atomCount,
  runId = 0,
  lowPower = false,
  densePreview = false,
  accentHex,
  onComplete,
}: {
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomCount: number
  runId?: number
  lowPower?: boolean
  /** Плотное уравнение (≥10 слотов) — меньше частиц, анти white-screen. */
  densePreview?: boolean
  accentHex?: string
  onComplete: () => void
}) {
  const { invalidate } = useThree()
  const fxRootRef = useRef<THREE.Group>(null)
  const ctrlRef = useRef<ElementsCollapseController | null>(null)
  const proxyRef = useRef<THREE.Object3D[]>([])
  const doneRef = useRef(false)
  const waitFramesRef = useRef(0)
  const startedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const collectBohrAtoms = (): THREE.Object3D[] => {
    const atoms: THREE.Object3D[] = []
    const n = Math.max(0, Math.min(atomCount, atomGroupRefs.current.length))
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i]
      if (g) atoms.push(g)
    }
    if (atoms.length === 0) {
      for (const g of atomGroupRefs.current) {
        if (g) atoms.push(g)
      }
    }
    return atoms
  }

  const clearProxies = () => {
    const root = fxRootRef.current
    for (const p of proxyRef.current) {
      if (root) root.remove(p)
      p.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material
        if (mat) {
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
          else mat.dispose()
        }
      })
    }
    proxyRef.current = []
  }

  const spawnProxies = (count: number): THREE.Object3D[] => {
    clearProxies()
    const root = fxRootRef.current
    if (!root) return []
    const colors = [0xff6688, 0x66ffaa, 0x66aaff, 0xffcc66, 0xcc88ff]
    const out: THREE.Object3D[] = []
    const n = Math.max(3, Math.min(8, count || PROXY_COUNT_DEFAULT))
    for (let i = 0; i < n; i++) {
      const geo = new THREE.SphereGeometry(0.35, 16, 12)
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length]!,
        wireframe: true,
        transparent: true,
        opacity: 0.95,
        toneMapped: false,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      const a = (i / n) * Math.PI * 2
      const r = 2.2 + (i % 3) * 0.35
      mesh.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 1.1, Math.sin(a) * r * 0.55)
      mesh.renderOrder = 36
      root.add(mesh)
      out.push(mesh)
    }
    proxyRef.current = out
    return out
  }

  const buildOpts = () => {
    // Полный демо-файл; densePreview больше НЕ режет искры (иначе «нет взрыва»).
    const opts = resolveCollapseOptionsForDevice(lowPower)
    if (accentHex) {
      const raw = accentHex.replace('#', '').trim()
      const c = Number.parseInt(raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw, 16)
      if (Number.isFinite(c)) {
        opts.particle_colors = [0xffffff, c, 0xaaddff, 0xffaa00, 0xffffff]
      }
    }
    return opts
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    ctrlRef.current?.dispose()
    ctrlRef.current = null
    clearProxies()
    onCompleteRef.current()
    invalidate()
  }

  const startAnimation = (root: THREE.Group) => {
    let atoms = collectBohrAtoms()
    if (atoms.length === 0) {
      atoms = spawnProxies(Math.max(PROXY_COUNT_DEFAULT, Math.min(8, atomCount || PROXY_COUNT_DEFAULT)))
    }
    ctrlRef.current?.dispose()
    ctrlRef.current = createElementsCollapseAnimation(atoms, root, buildOpts())
    startedRef.current = true
  }

  useEffect(() => {
    doneRef.current = false
    startedRef.current = false
    waitFramesRef.current = 0
    return () => {
      // StrictMode: dispose controller, но НЕ finish/onComplete.
      ctrlRef.current?.dispose()
      ctrlRef.current = null
      startedRef.current = false
      clearProxies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount per runId
  }, [runId, atomCount, lowPower, densePreview, accentHex])

  useFrame((_, delta) => {
    if (doneRef.current) return
    const root = fxRootRef.current
    if (!root) return

    if (!startedRef.current) {
      waitFramesRef.current += 1
      const atoms = collectBohrAtoms()
      const ready = atoms.length > 0 || waitFramesRef.current >= ATOM_WAIT_FRAMES
      if (!ready) {
        invalidate()
        return
      }
      startAnimation(root)
      invalidate()
      return
    }

    // StrictMode cleanup мог обнулить ctrl — пересоздаём, НЕ завершаем FX.
    if (!ctrlRef.current) {
      startAnimation(root)
      invalidate()
      return
    }

    const finished = ctrlRef.current.tick(delta)
    invalidate()
    if (finished) finish()
  })

  return <group ref={fxRootRef} position={[0, 0, 0]} renderOrder={35} />
}
