import { Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { compoundById } from '../../data/compounds'
import { canPourFromTilt, computePourFlow } from '../../vrLab/physics/PourSolver'
import type { VrLabShelfFlask } from '../../vrLab/types'
import {
  BENCH_Y,
  isNearVat,
  SHELF_SLOT_POSITIONS,
  SHELF_Y,
  SHELF_Z,
  SHELF_ZONE_Z,
  VAT_POSITION,
} from '../../vrLab/vrLabShelfLayout'
import { VrLabPourBridge } from './VrLabPourBridge'
import { useVrLabGrabOptional } from './VrLabGrabContext'
import { VrLabErlenmeyerFlask } from './VrLabGlassware'
import { liquidVisualFromContent } from './VrLabLiquid'
import { VR_THEME } from './vrLabTheme'

const FLASK_SCALE_SHELF = 0.4
const FLASK_SCALE_BENCH = 0.52
const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const TARGET_POS = new THREE.Vector3()
const PICK_RESULT = new THREE.Vector3()

type Props = {
  flasks: VrLabShelfFlask[]
  selectedId: string | null
  pourFlaskId: string | null
  pourProgress: number
  busy?: boolean
  autoMixFlaskId?: string | null
  autoMixOverridePos?: [number, number, number] | null
  autoMixTilt?: number
  practiceTarget?: { a: string; b: string } | null
  onSelect: (id: string) => void
  onDragStart: () => void
  onDragEnd: (id: string, position: [number, number, number]) => void
  onPourFlaskToVat: (id: string) => void
}

function WallShelfRack() {
  const width = SHELF_SLOT_POSITIONS[9]![0] - SHELF_SLOT_POSITIONS[0]![0] + 0.22
  const cx = (SHELF_SLOT_POSITIONS[0]![0] + SHELF_SLOT_POSITIONS[9]![0]) / 2

  return (
    <group position={[cx, SHELF_Y - 0.04, SHELF_Z - 0.02]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.022, 0.14]} />
        <meshStandardMaterial color={VR_THEME.darkMetal} metalness={0.78} roughness={0.24} />
      </mesh>
      <mesh position={[0, -0.018, 0.04]}>
        <boxGeometry args={[width + 0.04, 0.008, 0.006]} />
        <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.2} />
      </mesh>
      {SHELF_SLOT_POSITIONS.map((pos, i) => (
        <mesh key={i} position={[pos[0] - cx, 0.012, 0.04]}>
          <cylinderGeometry args={[0.018, 0.018, 0.024, 8]} />
          <meshStandardMaterial color={VR_THEME.chrome} metalness={0.85} roughness={0.18} />
        </mesh>
      ))}
    </group>
  )
}

function constrainDragPosition(x: number, z: number, out: THREE.Vector3): THREE.Vector3 {
  if (z <= SHELF_ZONE_Z) {
    return out.set(x, SHELF_Y, SHELF_Z)
  }
  return out.set(
    Math.max(-1.05, Math.min(0.95, x)),
    BENCH_Y,
    Math.max(0.02, Math.min(0.32, z)),
  )
}

function DraggableShelfFlask({
  flask,
  selected,
  pourActive,
  pourProgress,
  busy,
  autoMixOverridePos,
  autoMixTilt = 0,
  practiceTarget = null,
  onSelect,
  onDragStart,
  onDragEnd,
  onPourFlaskToVat,
}: {
  flask: VrLabShelfFlask
  selected: boolean
  pourActive: boolean
  pourProgress: number
  busy?: boolean
  autoMixOverridePos?: [number, number, number] | null
  autoMixTilt?: number
  practiceTarget?: { a: string; b: string } | null
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: (position: [number, number, number]) => void
  onPourFlaskToVat: (id: string) => void
}) {
  const grab = useVrLabGrabOptional()
  const groupRef = useRef<THREE.Group>(null)
  const dragOffset = useRef(new THREE.Vector3())
  const dragging = useRef(false)
  const dragPlaneY = useRef(flask.position[1])
  const nearVatRef = useRef(false)
  const dragPosScratch = useRef(new THREE.Vector3())
  const livePos = useRef(new THREE.Vector3(...flask.position))
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const intersect = useMemo(() => new THREE.Vector3(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])

  const isGrabbed = grab?.grabbedId === flask.id
  const manualTilt =
    autoMixOverridePos && autoMixTilt > 0
      ? autoMixTilt
      : grab?.activeTiltFlaskId === flask.id
        ? grab.tilt
        : 0
  const fill = flask.content?.fillLevel ?? 0

  livePos.current.set(flask.position[0], flask.position[1], flask.position[2])
  if (autoMixOverridePos) {
    livePos.current.set(autoMixOverridePos[0], autoMixOverridePos[1], autoMixOverridePos[2])
  }

  useFrame((_, dt) => {
    if (!groupRef.current || dragging.current || autoMixOverridePos) return
    TARGET_POS.set(flask.position[0], flask.position[1], flask.position[2])
    livePos.current.lerp(TARGET_POS, Math.min(1, dt * 10))
    groupRef.current.position.copy(livePos.current)
  })

  useFrame(() => {
    if (autoMixOverridePos && groupRef.current) {
      groupRef.current.position.copy(livePos.current)
    }
  })

  useFrame(() => {
    if (!grab || !dragging.current || grab.grabbedId !== flask.id) return
    const pos: [number, number, number] = [livePos.current.x, livePos.current.y, livePos.current.z]
    const near = isNearVat(pos)
    nearVatRef.current = near
    const streaming = near && canPourFromTilt(grab.tilt, fill) && !!flask.content
    if (grab.streamingId !== (streaming ? flask.id : null)) {
      grab.setStreaming(streaming ? flask.id : null)
    }
  })

  const pickPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      DRAG_PLANE.constant = -dragPlaneY.current
      DRAG_PLANE.normal.set(0, 1, 0)
      if (raycaster.ray.intersectPlane(DRAG_PLANE, intersect)) {
        PICK_RESULT.copy(intersect)
        return PICK_RESULT
      }
      return null
    },
    [camera, gl.domElement, pointer, raycaster, intersect],
  )

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect()
    dragging.current = true
    dragPlaneY.current = flask.onShelf ? SHELF_Y : flask.position[1]
    grab?.setGrabbed(flask.id)
    onDragStart()
    const hit = pickPoint(e.clientX, e.clientY)
    if (hit && groupRef.current) {
      dragOffset.current.copy(groupRef.current.position).sub(hit)
    }
    gl.domElement.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !groupRef.current) return
    e.stopPropagation()
    const hit = pickPoint(e.clientX, e.clientY)
    if (!hit) return
    const raw = hit.add(dragOffset.current)
    const constrained = constrainDragPosition(raw.x, raw.z, dragPosScratch.current)
    if (constrained.z > SHELF_ZONE_Z) {
      dragPlaneY.current = BENCH_Y
    }
    groupRef.current.position.copy(constrained)
    livePos.current.copy(constrained)
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !groupRef.current) return
    e.stopPropagation()
    dragging.current = false
    const p = groupRef.current.position
    const pos: [number, number, number] = [p.x, p.y, p.z]

    const shouldPour =
      !busy &&
      flask.content &&
      grab &&
      isNearVat(pos) &&
      canPourFromTilt(grab.tilt, fill)

    grab?.setGrabbed(null)
    onDragEnd(pos)
    grab?.resetTilt()

    if (shouldPour) {
      onPourFlaskToVat(flask.id)
    }

    gl.domElement.releasePointerCapture(e.pointerId)
  }

  const visual = liquidVisualFromContent(flask.content)
  const formula = flask.content
    ? (compoundById[flask.content.compoundId]?.formulaUnicode ?? flask.content.compoundId)
    : null

  const showStreamPreview =
    grab?.streamingId === flask.id && !pourActive && !busy && visual

  const pourFlow =
    grab && flask.content
      ? computePourFlow(grab.tilt, fill, flask.content.viscosity ?? 0.35)
      : 0

  const practiceMatch =
    practiceTarget &&
    flask.content?.compoundId &&
    (flask.content.compoundId === practiceTarget.a || flask.content.compoundId === practiceTarget.b)

  const nearVatWhileGrabbed = isGrabbed && nearVatRef.current && !!flask.content

  return (
    <>
      {showStreamPreview && visual && pourFlow > 0.02 ? (
        <VrLabPourBridge
          flask={{ ...flask, position: [livePos.current.x, livePos.current.y, livePos.current.z] }}
          target={VAT_POSITION}
          progress={Math.max(0.35, grab?.tilt ?? 0.5)}
          flowRate={pourFlow}
          compoundId={flask.content?.compoundId ?? null}
        />
      ) : null}

      <group ref={groupRef} position={flask.position}>
        <group
          scale={flask.onShelf ? FLASK_SCALE_SHELF : FLASK_SCALE_BENCH}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <mesh visible={false}>
            <cylinderGeometry args={[0.17, 0.19, 0.34, 12]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <VrLabErlenmeyerFlask
            position={[0, 0, 0]}
            content={flask.content}
            scale={1}
            vapor={pourActive || (isGrabbed && manualTilt > 0.5)}
            pourActive={pourActive}
            pourProgress={pourProgress}
            fillToVat
            manualTilt={manualTilt}
            glassHighlight={selected || isGrabbed || pourActive}
          />
        </group>
        {selected ? (
          <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.082, 24]} />
            <meshStandardMaterial color={VR_THEME.magenta} emissive={VR_THEME.magenta} emissiveIntensity={1.3} />
          </mesh>
        ) : null}
        {nearVatWhileGrabbed ? (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.08, 0.1, 28]} />
            <meshStandardMaterial
              color={VR_THEME.cyan}
              emissive={VR_THEME.cyan}
              emissiveIntensity={canPourFromTilt(manualTilt, fill) ? 1.6 : 0.9}
              transparent
              opacity={0.75}
              depthWrite={false}
            />
          </mesh>
        ) : null}
        {practiceMatch ? (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.055, 0.068, 24]} />
            <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.45} />
          </mesh>
        ) : null}
        {isGrabbed && manualTilt > 0.08 ? (
          <mesh position={[0.06, 0.12, 0]} rotation={[0, 0, -manualTilt * 0.9]}>
            <boxGeometry args={[0.002, 0.08, 0.002]} />
            <meshStandardMaterial color={VR_THEME.cyan} emissive={VR_THEME.cyan} emissiveIntensity={1.5} />
          </mesh>
        ) : null}
        {formula ? (
          <Html position={[0, 0.17, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#e9d5ff',
                background: 'rgba(10,6,24,0.85)',
                padding: '2px 6px',
                borderRadius: '6px',
                border: '1px solid rgba(168,85,247,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              {formula}
            </span>
          </Html>
        ) : null}
      </group>
    </>
  )
}

export function VrLabShelfFlasksScene({
  flasks,
  selectedId,
  pourFlaskId,
  pourProgress,
  busy = false,
  autoMixFlaskId = null,
  autoMixOverridePos = null,
  autoMixTilt = 0,
  practiceTarget = null,
  onSelect,
  onDragStart,
  onDragEnd,
  onPourFlaskToVat,
}: Props) {
  return (
    <group>
      <WallShelfRack />
      {flasks.map((flask) => (
        <DraggableShelfFlask
          key={flask.id}
          flask={flask}
          selected={selectedId === flask.id}
          pourActive={pourFlaskId === flask.id}
          pourProgress={pourProgress}
          busy={busy}
          autoMixOverridePos={flask.id === autoMixFlaskId ? autoMixOverridePos : null}
          autoMixTilt={flask.id === autoMixFlaskId ? autoMixTilt : 0}
          practiceTarget={practiceTarget}
          onSelect={() => onSelect(flask.id)}
          onDragStart={onDragStart}
          onDragEnd={(pos) => onDragEnd(flask.id, pos)}
          onPourFlaskToVat={onPourFlaskToVat}
        />
      ))}
    </group>
  )
}
