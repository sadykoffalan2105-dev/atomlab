import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { Ease } from '../../../lab/cinema/core/easing'
import type { AtomPool } from '../../../lab/cinema/core/pools'
import { entryMoleculeCenter } from './labEntryScenario'
import { emitLabEntryIntent } from './labEntryIntent'
import type { EntryRuntime } from './labEntryRuntime'

/**
 * Захват готовой молекулы воды — переход в реактор.
 *
 * В idle-кадре одновременно живут <OrbitControls makeDefault> и по <DragControls>
 * на каждую перетаскиваемую частицу. Если хит-меш не остановит событие, один жест
 * и повернёт камеру, и потащит молекулу. Поэтому здесь обязательны три вещи:
 * stopPropagation в onPointerDown, захват указателя (палец часто уходит за край
 * канваса — поэтому pointerup/pointercancel слушает window, а не меш) и
 * выключение чужих контролов через useThree(s => s.controls) с ОБЯЗАТЕЛЬНЫМ
 * возвратом в true в cleanup эффекта: размонтирование во время захвата
 * (как раз переход в реактор) иначе навсегда оставило бы орбиту выключенной.
 *
 * Хит-меши монтируются ТОЛЬКО в фазе показа: вне её они молча съедали бы клики
 * по частицам DraggableParticle.
 */

/** Ниже этой мировой высоты отпускание считается броском в реактор. */
const DROP_Y = -0.9
const FLY_SEC = 0.45

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _plane = new THREE.Plane()
const _hit = new THREE.Vector3()
const _grabStart = new THREE.Vector3()
const _normal = new THREE.Vector3()
const _center: [number, number, number] = [0, 0, 0]

/** Радиус невидимой зоны захвата: чуть больше самой молекулы, но не во весь кадр. */
function grabRadius(heroScale: number): number {
  return 0.5 * heroScale * 0.42 + 0.34
}

type ControlsLike = { enabled?: boolean } | null

export type LabEntryGrabProps = {
  pool: AtomPool
  runtime: EntryRuntime
  scale: number
}

export function LabEntryGrab({ pool, runtime, scale }: LabEntryGrabProps) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as ControlsLike
  const [armed, setArmed] = useState(false)
  const hit0 = useRef<THREE.Mesh>(null)
  const hit1 = useRef<THREE.Mesh>(null)
  const rectRef = useRef<DOMRect | null>(null)

  const geometry = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Чужие контролы обязаны вернуться в рабочее состояние при любом исходе.
  useEffect(() => {
    return () => {
      if (controls && 'enabled' in controls) controls.enabled = true
      document.body.style.cursor = ''
      runtime.grabbed = -1
      runtime.hold = false
    }
  }, [controls, runtime])

  useEffect(() => {
    if (!armed) return
    const onMove = (e: PointerEvent) => {
      const m = runtime.grabbed
      if (m < 0) return
      const rect = rectRef.current
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      _ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1))
      _raycaster.setFromCamera(_ndc, camera)
      if (!_raycaster.ray.intersectPlane(_plane, _hit)) return
      const o = m * 3
      runtime.offsets[o] = _hit.x - _grabStart.x
      runtime.offsets[o + 1] = _hit.y - _grabStart.y
      runtime.offsets[o + 2] = _hit.z - _grabStart.z
      runtime.offVel[o] = 0
      runtime.offVel[o + 1] = 0
      runtime.offVel[o + 2] = 0
    }
    const onUp = () => {
      const m = runtime.grabbed
      if (m < 0) return
      runtime.grabbed = -1
      if (controls && 'enabled' in controls) controls.enabled = true
      document.body.style.cursor = ''
      entryMoleculeCenter(pool, m === 0 ? 0 : 1, _center)
      if (_center[1] < DROP_Y) {
        // Бросок в нижнюю треть кадра — намерение «открыть реактор» на том
        // веществе, которое сейчас собрано в кадре.
        emitLabEntryIntent('open-reactor', runtime.spec.productId)
        runtime.flying = m
        runtime.flyT = 0
      } else {
        runtime.hold = false
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('pointercancel', onUp, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [armed, camera, controls, pool, runtime])

  const beginGrab = (molecule: 0 | 1) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    try {
      ;(e.target as Element | null)?.setPointerCapture?.(e.pointerId)
    } catch {
      /* захват указателя не критичен — слушатели всё равно на window */
    }
    rectRef.current = gl.domElement.getBoundingClientRect()
    runtime.grabbed = molecule
    runtime.hold = true
    runtime.flying = -1
    if (controls && 'enabled' in controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    // Плоскость перетаскивания ставится ОДИН раз при захвате и параллельна камере.
    camera.getWorldDirection(_normal)
    entryMoleculeCenter(pool, molecule, _center)
    _grabStart.set(_center[0], _center[1], _center[2])
    _plane.setFromNormalAndCoplanarPoint(_normal, _grabStart)
    _grabStart.copy(e.point)
  }

  useFrame((_, delta) => {
    const rt = runtime
    if (rt.paused) return
    const dt = delta > 0.05 ? 0.05 : delta

    // Молекула улетает вниз — короткий разгон Ease.inExpo, затем сброс.
    if (rt.flying >= 0) {
      rt.flyT += dt
      const k = Math.min(1, rt.flyT / FLY_SEC)
      const o = rt.flying * 3
      rt.offsets[o + 1] = rt.offsets[o + 1]! - Ease.inExpo(k) * 0.9
      if (k >= 1) {
        rt.flying = -1
        rt.hold = false
        rt.offsets.fill(0)
        rt.offVel.fill(0)
      }
      return
    }

    const canGrab = (rt.phase === 'present' || rt.reduced) && rt.grabbed < 0
    const shouldArm = canGrab || rt.grabbed >= 0
    if (shouldArm !== armed) setArmed(shouldArm)
    if (!shouldArm) return

    // Масштаб героя подбирается под вещество петли уже вне React, поэтому
    // радиус хит-сферы берётся из состояния, а не из пропа: иначе у соли
    // (её масштаб ниже) зона захвата осталась бы от воды и ловила бы пустоту.
    const hr = grabRadius(rt.heroScale)
    const a = hit0.current
    const b = hit1.current
    if (a) {
      entryMoleculeCenter(pool, 0, _center)
      a.position.set(_center[0], _center[1], _center[2])
      a.scale.setScalar(hr)
    }
    if (b) {
      entryMoleculeCenter(pool, 1, _center)
      b.position.set(_center[0], _center[1], _center[2])
      b.scale.setScalar(hr)
    }
  })

  if (!armed) return null
  const r = grabRadius(scale)
  // У одиночного продукта (CO₂) вторая молекула не существует — хит-меша нет.
  const twin = runtime.spec.products > 1
  return (
    <>
      <mesh
        ref={hit0}
        geometry={geometry}
        material={material}
        scale={r}
        renderOrder={-1}
        onPointerDown={beginGrab(0)}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          if (runtime.grabbed < 0) document.body.style.cursor = ''
        }}
      />
      {twin ? (
        <mesh
          ref={hit1}
          geometry={geometry}
          material={material}
          scale={r}
          renderOrder={-1}
          onPointerDown={beginGrab(1)}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => {
            if (runtime.grabbed < 0) document.body.style.cursor = ''
          }}
        />
      ) : null}
    </>
  )
}
