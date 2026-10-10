/**
 * Электронная (сенсорная) доска на передней стене: рамка, экран и HTML-содержимое (BoardPanel из части «опыты»).
 * HTML рисуется drei <Html transform occlude="blending">: 1 CSS px = distanceFactor / 400 м, поэтому
 * BOARD_PX (1280×720) ровно заполняет экран BOARD_SIZE (1,9 × 1,07 м). Касания и клики по доске уходят в HTML
 * и не крутят камеру; на телефоне в режиме «Доска» горизонтальное перетаскивание листает доску.
 *
 * Два «сторожа» (жалобы «доска отлетает» и «доска видна сквозь стену/шкаф»):
 *  • occlude="blending" работает, только пока холст лежит НАД доской (z-index 10, доска ниже) и
 *    прозрачен для указателя — тогда стены и мебель перед доской её закрывают, а «дыра» в холсте её показывает.
 *    drei ставит этот стиль холсту один раз, а любой другой <Html> без blending (подписи LabLabel, подсказки
 *    «Нажмите») при монтировании сбрасывает его — доска оказывалась поверх всей сцены. Держим стиль каждый кадр.
 *  • обёртка drei — overflow:hidden размером с холст; выделение текста протяжкой, Tab по кнопкам доски или
 *    фокус прокручивали её (scrollTop/scrollLeft), и HTML-доска съезжала с рамки. Прокрутку обёрток гасим.
 */
import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { BOARD_CENTER, BOARD_PX, BOARD_SIZE, type BoardPanelProps } from '../labContract'
import { labXr } from '../xr/labXrStore'
import { BoardPanel } from '../experiments'
import type { LabMaterials } from './labMaterials'
import type { LabSceneBridge } from './labBridge'
import { markBoard, probeBoard, type BoardMark } from './labBoardProbe'

const DISTANCE_FACTOR = (BOARD_SIZE.w * 400) / BOARD_PX.w
/** Диапазон z-index HTML доски; холст — ровно посередине (как у drei для occlude="blending"), доска — ниже него. */
const BOARD_Z_RANGE: [number, number] = [20, 0]
/** Совпадает с LABEL_Z_MIN − 1 в labOccluders.tsx: подписи и подсказки всегда выше холста. */
const CANVAS_Z = String(Math.floor(BOARD_Z_RANGE[0] / 2))

interface Props {
  readonly mats: LabMaterials
  readonly panel: BoardPanelProps
  readonly bridge: LabSceneBridge
}

export function LabBoard({ mats, panel, bridge }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gl = useThree((s) => s.gl)

  // Холст над доской: без этого доска просвечивает сквозь стены и шкафы (см. шапку файла)
  useFrame(() => {
    const st = gl.domElement.style
    // в VR-эмуляции мышь слушает сам холст; DOM-доска там скрыта — отдаём холсту указатель
    const pe = labXr.get().presenting ? '' : 'none'
    if (st.zIndex !== CANVAS_Z || st.position !== 'absolute' || st.pointerEvents !== pe) {
      st.zIndex = CANVAS_Z
      st.position = 'absolute'
      st.pointerEvents = pe
    }
  })

  // Обёртки drei (overflow:hidden) не прокручиваются: иначе HTML-доска съезжает с рамки
  // (HTML drei рисует отдельным React-корнем, поэтому корень доски ищем в момент прокрутки, а не при монтировании)
  useEffect(() => {
    const host = gl.domElement.parentElement?.parentElement
    if (!host) return
    const onScroll = (e: Event) => {
      const t = e.target
      const root = rootRef.current
      // только корень доски и обёртки над ним; списки внутри доски листаются как обычно
      if (!root || !(t instanceof Element) || !t.contains(root)) return
      if (t.scrollTop) t.scrollTop = 0
      if (t.scrollLeft) t.scrollLeft = 0
    }
    host.addEventListener('scroll', onScroll, true)
    return () => host.removeEventListener('scroll', onScroll, true)
  }, [gl])

  useEffect(() => {
    const el = rootEl
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
    // колесо над доской листает её списки, а не приближает камеру (OrbitControls глушил прокрутку и двигал вид)
    const onWheel = (e: WheelEvent) => e.stopPropagation()
    const onClickCapture = (e: MouseEvent) => {
      if (panned) {
        e.stopPropagation()
        e.preventDefault()
        panned = false
      }
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('wheel', onWheel)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [bridge, rootEl])

  const frameW = BOARD_SIZE.w + 0.07
  const frameH = BOARD_SIZE.h + 0.07
  return (
    <group ref={groupRef} position={BOARD_CENTER}>
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
        zIndexRange={BOARD_Z_RANGE}
        style={{ width: BOARD_PX.w, height: BOARD_PX.h }}
      >
        <div
          ref={setRoot}
          style={{ width: BOARD_PX.w, height: BOARD_PX.h, overflow: 'hidden', touchAction: 'none', background: '#ffffff' }}
        >
          <BoardPanel {...panel} />
        </div>
      </Html>
    </group>
  )
}
