import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import {
  buildCollapseAccentTheme,
  createElementsCollapseAnimation,
  resolveCollapseOptionsForDevice,
  type ElementsCollapseController,
} from '../../lab/synthesisCollapseEffect/elementsCollapseAnimation'

const ATOM_WAIT_FRAMES = 18
const PROXY_COUNT_DEFAULT = 5

/**
 * Коллапс + burst в цвете молекулы.
 * onEmbryoReady — micro-молекула внутри круга (GPU warm).
 * onBirthReady — видимое рождение ИЗ круга на пике свечения.
 * onComplete — FX полностью закончен.
 */
export function SynthesisElementsCollapseFx({
  atomGroupRefs,
  atomCount,
  runId = 0,
  lowPower = false,
  densePreview = false,
  accentHex,
  onEmbryoReady,
  onBirthReady,
  onComplete,
}: {
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomCount: number
  runId?: number
  lowPower?: boolean
  densePreview?: boolean
  accentHex?: string
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete: () => void
}) {
  const fxRootRef = useRef<THREE.Group>(null)
  const ctrlRef = useRef<ElementsCollapseController | null>(null)
  const proxyRef = useRef<THREE.Object3D[]>([])
  const doneRef = useRef(false)
  const embryoFiredRef = useRef(false)
  const birthFiredRef = useRef(false)
  const waitFramesRef = useRef(0)
  const startedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const onEmbryoReadyRef = useRef(onEmbryoReady)
  const onBirthReadyRef = useRef(onBirthReady)
  onCompleteRef.current = onComplete
  onEmbryoReadyRef.current = onEmbryoReady
  onBirthReadyRef.current = onBirthReady

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
    const theme = buildCollapseAccentTheme(accentHex)
    const colors = theme
      ? [theme.accent_hex, theme.ring_color, theme.light_color, theme.flash_tint, 0xffffff]
      : [0xff6688, 0x66ffaa, 0x66aaff, 0xffcc66, 0xcc88ff]
    const out: THREE.Object3D[] = []
    const n = Math.max(3, Math.min(8, count || PROXY_COUNT_DEFAULT))
    for (let i = 0; i < n; i++) {
      const geo = new THREE.SphereGeometry(0.35, 10, 8)
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
    const opts = resolveCollapseOptionsForDevice(lowPower, densePreview)
    const theme = buildCollapseAccentTheme(accentHex)
    if (theme) {
      opts.particle_colors = theme.particle_colors
      opts.core_gradient = theme.core_gradient
      opts.accent_hex = theme.accent_hex
      opts.ring_color = theme.ring_color
      opts.core_mesh_color = theme.core_mesh_color
      opts.light_color = theme.light_color
      opts.flash_tint = theme.flash_tint
    }
    return opts
  }

  const fireEmbryo = () => {
    if (embryoFiredRef.current) return
    embryoFiredRef.current = true
    onEmbryoReadyRef.current?.()
  }

  const fireBirth = () => {
    if (birthFiredRef.current) return
    birthFiredRef.current = true
    fireEmbryo()
    onBirthReadyRef.current?.()
  }

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    fireBirth()
    ctrlRef.current?.dispose()
    ctrlRef.current = null
    clearProxies()
    onCompleteRef.current()
  }

  const startAnimation = (root: THREE.Group) => {
    let atoms = collectBohrAtoms()
    if (atoms.length === 0) {
      atoms = spawnProxies(Math.max(PROXY_COUNT_DEFAULT, Math.min(8, atomCount || PROXY_COUNT_DEFAULT)))
    }
    ctrlRef.current?.dispose({ interrupted: true })
    ctrlRef.current = createElementsCollapseAnimation(atoms, root, buildOpts())
    startedRef.current = true
  }

  useEffect(() => {
    doneRef.current = false
    embryoFiredRef.current = false
    birthFiredRef.current = false
    startedRef.current = false
    waitFramesRef.current = 0
    return () => {
      ctrlRef.current?.dispose({ interrupted: !doneRef.current })
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
      if (!ready) return
      startAnimation(root)
      return
    }

    if (!ctrlRef.current) {
      startAnimation(root)
      return
    }

    const finished = ctrlRef.current.tick(delta)
    if (ctrlRef.current.embryoReady) fireEmbryo()
    if (ctrlRef.current.birthReady) fireBirth()
    if (finished) finish()
  })

  return <group ref={fxRootRef} position={[0, 0, 0]} renderOrder={35} />
}
