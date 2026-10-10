/**
 * Отладочный «щуп» доски (только …#/vr-lab?debugLab=1 → window.__labBoard): для автоматических проверок жалоб
 * «доска отлетает при действиях» и «доска видна сквозь стену/шкаф».
 *  • drift — насколько HTML-доска (getBoundingClientRect корня) разошлась с рамкой экрана, спроецированной камерой, px;
 *  • pts — сетка точек экрана доски: occluded = луч от камеры до точки сначала упирается в непрозрачную мебель/стену.
 *    Там пиксель кадра не должен меняться, если спрятать HTML-доску (проверка — scripts/lab3d-board-check.mjs).
 */
import * as THREE from 'three'
import { BOARD_SIZE } from '../labContract'

export interface BoardProbePoint {
  readonly x: number
  readonly y: number
  readonly occluded: boolean
}

export interface BoardProbe {
  /** Наибольшее расхождение краёв HTML-доски и спроецированной рамки, CSS px; null — угол доски за камерой. */
  readonly drift: number | null
  readonly dom: readonly [number, number, number, number]
  readonly proj: readonly [number, number, number, number] | null
  readonly pts: readonly BoardProbePoint[]
}

interface ProbeArgs {
  readonly group: THREE.Object3D
  readonly root: HTMLElement
  readonly camera: THREE.Camera
  readonly scene: THREE.Scene
  readonly canvas: HTMLCanvasElement
  readonly nx?: number
  readonly ny?: number
}

const round = (v: number) => Math.round(v * 10) / 10

function hiddenInTree(o: THREE.Object3D | null): boolean {
  for (let e = o; e; e = e.parent) if (!e.visible) return true
  return false
}

function isOpaque(o: THREE.Object3D): boolean | null {
  const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
  if (!m) return null
  const list = Array.isArray(m) ? m : [m]
  if (list.every((x) => !x.visible || x.colorWrite === false)) return null
  return list.some((x) => x.visible && !(x.transparent && x.opacity < 0.9) && !(x as THREE.MeshPhysicalMaterial).transmission)
}

export function probeBoard({ group, root, camera, scene, canvas, nx = 9, ny = 5 }: ProbeArgs): BoardProbe {
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

  const camPos = camera.getWorldPosition(new THREE.Vector3())
  const ray = new THREE.Raycaster()
  const near = (camera as THREE.PerspectiveCamera).near ?? 0.05
  const pts: BoardProbePoint[] = []
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      // отступ от краёв экрана — рамка доски не в счёт
      const P = local(-hw + ((i + 0.5) / nx) * 2 * hw, -hh + ((j + 0.5) / ny) * 2 * hh)
      const s = toScreen(P)
      if (s.z <= -1 || s.z >= 1 || s.x < cr.left + 2 || s.y < cr.top + 2 || s.x > cr.right - 2 || s.y > cr.bottom - 2) continue
      const dir = P.clone().sub(camPos)
      const dist = dir.length()
      ray.set(camPos, dir.normalize())
      ray.near = near
      ray.far = dist - 0.012
      let occluded = false
      let unsure = false
      for (const h of ray.intersectObjects(scene.children, true)) {
        // линии и точки ловятся лучом с допуском в целый метр — преграда только сетка
        if (!(h.object as THREE.Mesh).isMesh || hiddenInTree(h.object)) continue
        // сама доска (корпус, экран, плоскость-«дыра» drei) — не преграда
        let own = false
        for (let e: THREE.Object3D | null = h.object; e; e = e.parent) if (e === group) own = true
        if (own) continue
        const op = isOpaque(h.object)
        if (op === null) continue
        if (op) occluded = true
        else unsure = true // стекло: что за ним видно — зависит от смешивания, точку не считаем
        break
      }
      if (unsure) continue
      pts.push({ x: Math.round(s.x), y: Math.round(s.y), occluded })
    }
  }
  return { drift, dom, proj, pts }
}
