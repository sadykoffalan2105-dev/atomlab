/**
 * VR-доска: плоскость 1,9 × 1,07 м поверх доски класса (BOARD_CENTER, z + 4 мм) с canvas-текстурой 1280 × 720.
 * Перерисовка — только при смене опыта/шага/языка/страницы/наведения и не чаще 10 раз в секунду.
 * Кнопки — невидимые зоны нажатия (onClick → labEvents 'uiCommand': next/back/restart/select).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BOARD_CENTER, BOARD_SIZE, type LabLang } from '../labContract'
import { labEvents } from '../labEvents'
import { useXrState } from './labXrStore'
import { BOARD_TEX, boardBoxes, CARDS_PER_PAGE, boardList, drawBoard, type BoardBox } from './xrBoardDraw'

const toM = (b: BoardBox): { pos: [number, number, number]; w: number; h: number } => {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return {
    pos: [(cx / BOARD_TEX.w - 0.5) * BOARD_SIZE.w, (0.5 - cy / BOARD_TEX.h) * BOARD_SIZE.h, 0.002],
    w: (b.w / BOARD_TEX.w) * BOARD_SIZE.w,
    h: (b.h / BOARD_TEX.h) * BOARD_SIZE.h,
  }
}

export function XrBoardPanel() {
  const run = useXrState().run
  const experimentId = run?.experimentId ?? ''
  const step = run?.step ?? 0
  const lang: LabLang = run?.lang ?? 'ru'
  const [page, setPage] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  // при смене опыта лента открывается на странице с ним
  useEffect(() => {
    const i = boardList(experimentId).indexOf(experimentId as never)
    setPage(i >= 0 ? Math.floor(i / CARDS_PER_PAGE) : 0)
  }, [experimentId])
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = BOARD_TEX.w
    c.height = BOARD_TEX.h
    return c
  }, [])
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [canvas])
  useEffect(() => () => texture.dispose(), [texture])
  const dirty = useRef(true)
  const last = useRef(-1)
  useEffect(() => {
    dirty.current = true
  }, [experimentId, step, lang, page, hover])
  useFrame((s) => {
    const now = s.clock.elapsedTime
    if (!dirty.current || now - last.current < 0.1) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawBoard(ctx, experimentId, step, lang, page, hover)
    texture.needsUpdate = true
    dirty.current = false
    last.current = now
  })
  const boxes = boardBoxes(experimentId, page)
  const press = (b: BoardBox) => {
    if (b.cmd === 'page') setPage(b.page ?? 0)
    else if (b.cmd === 'select') labEvents.emit({ type: 'uiCommand', cmd: 'select', experimentId: b.experimentId })
    else labEvents.emit({ type: 'uiCommand', cmd: b.cmd })
  }
  return (
    <group position={[BOARD_CENTER.x, BOARD_CENTER.y, BOARD_CENTER.z + 0.004]} name="xr-board">
      <mesh renderOrder={2}>
        <planeGeometry args={[BOARD_SIZE.w, BOARD_SIZE.h]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
      </mesh>
      {boxes.map((b) => {
        const m = toM(b)
        return (
          <mesh
            key={b.id}
            position={m.pos}
            userData={{ interactive: true, xrBoard: b.id }}
            onClick={(e) => {
              e.stopPropagation()
              press(b)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(b.id)
            }}
            onPointerOut={() => setHover((h) => (h === b.id ? null : h))}
          >
            <planeGeometry args={[m.w, m.h]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}
