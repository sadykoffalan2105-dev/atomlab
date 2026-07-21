import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import {
  createElementsCollapseAnimation,
  resolveCollapseOptionsForDevice,
  type ElementsCollapseController,
} from '../../lab/synthesisCollapseEffect/elementsCollapseAnimation'

const ATOM_WAIT_FRAMES = 48

/**
 * Коллапс Bohr-атомов + particle burst между «Запустить синтез» и молекулой.
 * Верный порт vendor/expl_threejs_effect_v02gm_dev — без второго WebGL render.
 */
export function SynthesisElementsCollapseFx({
  atomGroupRefs,
  atomCount,
  lowPower = false,
  accentHex,
  onComplete,
}: {
  atomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  atomCount: number
  lowPower?: boolean
  accentHex?: string
  onComplete: () => void
}) {
  const { invalidate } = useThree()
  const fxRootRef = useRef<THREE.Group>(null)
  const ctrlRef = useRef<ElementsCollapseController | null>(null)
  const doneRef = useRef(false)
  const waitFramesRef = useRef(0)
  const startedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const collectAtoms = (): THREE.Object3D[] => {
    const atoms: THREE.Object3D[] = []
    const n = Math.max(0, Math.min(atomCount, atomGroupRefs.current.length))
    for (let i = 0; i < n; i++) {
      const g = atomGroupRefs.current[i]
      if (g && g.visible !== false) atoms.push(g)
    }
    // Если count завышен, всё равно берём живые refs.
    if (atoms.length === 0) {
      for (const g of atomGroupRefs.current) {
        if (g) atoms.push(g)
      }
    }
    return atoms
  }

  const buildOpts = () => {
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
    onCompleteRef.current()
    invalidate()
  }

  useEffect(() => {
    doneRef.current = false
    startedRef.current = false
    waitFramesRef.current = 0
    return () => {
      ctrlRef.current?.dispose()
      ctrlRef.current = null
      // StrictMode unmount: НЕ зовём onComplete — иначе мгновенный skip анимации.
    }
  }, [atomCount, lowPower, accentHex, atomGroupRefs])

  useFrame((_, delta) => {
    if (doneRef.current) return
    const root = fxRootRef.current
    if (!root) return

    if (!startedRef.current) {
      waitFramesRef.current += 1
      const atoms = collectAtoms()
      const ready = atoms.length > 0 || waitFramesRef.current >= ATOM_WAIT_FRAMES
      if (!ready) {
        invalidate()
        return
      }
      startedRef.current = true
      ctrlRef.current = createElementsCollapseAnimation(atoms, root, buildOpts())
      invalidate()
      return
    }

    const ctrl = ctrlRef.current
    if (!ctrl) {
      finish()
      return
    }
    const finished = ctrl.tick(delta)
    invalidate()
    if (finished) finish()
  })

  return <group ref={fxRootRef} position={[0, 0, 0]} renderOrder={35} />
}
