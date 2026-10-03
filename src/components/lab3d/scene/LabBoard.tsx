/**
 * Электронная (сенсорная) доска на передней стене: рамка, экран и HTML-содержимое (BoardPanel из части «опыты»).
 * HTML рисуется drei <Html transform occlude="blending">: 1 CSS px = distanceFactor / 400 м, поэтому
 * BOARD_PX (1280×720) ровно заполняет экран BOARD_SIZE (1,9 × 1,07 м). Касания и клики по доске уходят в HTML
 * и не крутят камеру; на телефоне в режиме «Доска» горизонтальное перетаскивание листает доску.
 */
import { Html, RoundedBox } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { BOARD_CENTER, BOARD_PX, BOARD_SIZE, type BoardPanelProps } from '../labContract'
import { BoardPanel } from '../experiments'
import type { LabMaterials } from './labMaterials'
import type { LabSceneBridge } from './labBridge'

const DISTANCE_FACTOR = (BOARD_SIZE.w * 400) / BOARD_PX.w

interface Props {
  readonly mats: LabMaterials
  readonly panel: BoardPanelProps
  readonly bridge: LabSceneBridge
}

export function LabBoard({ mats, panel, bridge }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let start: { x: number; y: number; id: number } | null = null
    let lastX = 0
    let panned = false
    const onDown = (e: PointerEvent) => {
      // Не отдаём нажатие OrbitControls — иначе захват указателя съест клик по кнопке доски
      e.stopPropagation()
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      lastX = e.clientX
      panned = false
    }
    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id || !bridge.boardPanEnabled) return
      if (!panned && Math.abs(e.clientX - start.x) > 12 && Math.abs(e.clientX - start.x) > Math.abs(e.clientY - start.y)) {
        panned = true
      }
      if (panned) {
        bridge.panBoard?.(e.clientX - lastX)
        lastX = e.clientX
      }
    }
    const onUp = (e: PointerEvent) => {
      if (start && e.pointerId === start.id) start = null
    }
    const onClickCapture = (e: MouseEvent) => {
      if (panned) {
        e.stopPropagation()
        e.preventDefault()
        panned = false
      }
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [bridge])

  const frameW = BOARD_SIZE.w + 0.07
  const frameH = BOARD_SIZE.h + 0.07
  return (
    <group position={BOARD_CENTER}>
      {/* Корпус и рамка */}
      <RoundedBox args={[frameW, frameH, 0.06]} radius={0.015} smoothness={3} position-z={-0.032} material={mats.darkMetal} castShadow />
      <mesh position-z={-0.001} material={mats.screenBlack}>
        <planeGeometry args={[BOARD_SIZE.w + 0.01, BOARD_SIZE.h + 0.01]} />
      </mesh>
      {/* Полочка с маркерами-стилусами */}
      <group position={[0, -frameH / 2 - 0.02, 0.02]}>
        <mesh material={mats.metal}>
          <boxGeometry args={[0.7, 0.02, 0.07]} />
        </mesh>
        {[-0.1, -0.04, 0.03].map((x, i) => (
          <mesh key={x} position={[x, 0.018, 0.005]} rotation-z={Math.PI / 2} material={[mats.blackPlastic, mats.rubberBlue, mats.red][i]}>
            <cylinderGeometry args={[0.007, 0.007, 0.13, 10]} />
          </mesh>
        ))}
      </group>
      {/* Логотип/датчик под экраном */}
      <mesh position={[0, -frameH / 2 + 0.018, 0.0005]}>
        <circleGeometry args={[0.006, 12]} />
        <meshBasicMaterial color="#5fd18c" toneMapped={false} />
      </mesh>
      <Html
        transform
        occlude="blending"
        distanceFactor={DISTANCE_FACTOR}
        position={[0, 0, 0.002]}
        zIndexRange={[20, 0]}
        style={{ width: BOARD_PX.w, height: BOARD_PX.h }}
      >
        <div
          ref={rootRef}
          style={{ width: BOARD_PX.w, height: BOARD_PX.h, overflow: 'hidden', touchAction: 'none', background: '#ffffff' }}
        >
          <BoardPanel {...panel} />
        </div>
      </Html>
    </group>
  )
}
