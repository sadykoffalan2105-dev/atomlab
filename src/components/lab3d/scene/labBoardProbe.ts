/**
 * Отладочный «щуп» доски (только …#/vr-lab?debugLab=1 → window.__labBoard): для автоматических проверок жалоб
 * «доска отлетает при действиях» и «доска видна сквозь стену/шкаф».
 *  • drift — насколько HTML-доска (getBoundingClientRect корня) разошлась с рамкой экрана, спроецированной камерой, px;
 *  • markBoard — режимы кадра для сравнения пикселей (scripts/lab3d-board-check.mjs): 'invert' — HTML-доска
 *    в негативе (где она реально видна, пиксели меняются); 'paint' — HTML спрятана, а плоскость-«дыра» drei
 *    (occlude="blending") закрашена пурпурным с проверкой глубины — пурпур ровно там, где доска должна быть видна.
 *    Пиксель, который меняется от негатива, но не пурпурный в 'paint', — доска видна сквозь стену/мебель.
 */
import * as THREE from 'three'
import { BOARD_SIZE } from '../labContract'

export interface BoardProbe {
  /** Наибольшее расхождение краёв HTML-доски и спроецированной рамки, CSS px; null — угол доски за камерой. */
  readonly drift: number | null
  readonly dom: readonly [number, number, number, number]
  readonly proj: readonly [number, number, number, number] | null
}

interface ProbeArgs {
  readonly group: THREE.Object3D
  readonly root: HTMLElement
  readonly camera: THREE.Camera
  readonly canvas: HTMLCanvasElement
}

const round = (v: number) => Math.round(v * 10) / 10

export function probeBoard({ group, root, camera, canvas }: ProbeArgs): BoardProbe {
  group.updateWorldMatrix(true, true)
  camera.updateMatrixWorld()
  const cr = canvas.getBoundingClientRect()
  const toScreen = (v: THREE.Vector3) => {
    const p = v.clone().project(camera)
    return { x: cr.left + ((p.x + 1) / 2) * cr.width, y: cr.top + ((1 - p.y) / 2) * cr.height, z: p.z }
  }
  const hw = BOARD_SIZE.w / 2
  const hh = BOARD_SIZE.h / 2
  const local = (x: number, y: number) => group.localToWorld(new THREE.Vector3(x, y, 0.002))
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => toScreen(local(x, y)))
  const inFront = corners.every((c) => c.z > -1 && c.z < 1)
  const d = root.getBoundingClientRect()
  const dom = [round(d.left), round(d.top), round(d.right), round(d.bottom)] as const
  let proj: BoardProbe['proj'] = null
  let drift: number | null = null
  if (inFront) {
    const xs = corners.map((c) => c.x)
    const ys = corners.map((c) => c.y)
    proj = [round(Math.min(...xs)), round(Math.min(...ys)), round(Math.max(...xs)), round(Math.max(...ys))]
    drift = round(Math.max(...dom.map((v, i) => Math.abs(v - proj![i]))))
  }

  return { drift, dom, proj }
}

const PAINT = new THREE.MeshBasicMaterial({ color: '#ff00ff', side: THREE.DoubleSide, toneMapped: false })
const saved = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>()

/** Плоскость-«дыра» drei <Html occlude="blending">: шейдер пишет прозрачный пиксель (0,0,0,0). */
function holeMeshes(group: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  group.traverse((o) => {
    const m = o as THREE.Mesh
    const mat = (saved.get(m) ?? m.material) as THREE.ShaderMaterial | undefined
    if (m.isMesh && mat && (mat as THREE.ShaderMaterial).isShaderMaterial && /vec4\(0\.0, 0\.0, 0\.0, 0\.0\)/.test(mat.fragmentShader)) out.push(m)
  })
  return out
}

export type BoardMark = 'invert' | 'paint' | null

export function markBoard(group: THREE.Object3D, root: HTMLElement, mode: BoardMark): number {
  root.style.filter = mode === 'invert' ? 'invert(1)' : ''
  root.style.visibility = mode === 'paint' ? 'hidden' : ''
  const holes = holeMeshes(group)
  for (const m of holes) {
    if (mode === 'paint') {
      if (!saved.has(m)) saved.set(m, m.material)
      m.material = PAINT
    } else if (saved.has(m)) {
      m.material = saved.get(m)!
      saved.delete(m)
    }
  }
  return holes.length
}
