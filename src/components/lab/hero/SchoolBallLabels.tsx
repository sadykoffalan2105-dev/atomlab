import { useEffect, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SchoolHeroAtom } from './schoolHeroModel'
import { schoolAtomHex, schoolLabelDark } from './schoolHeroStyle'

/**
 * Символы ВНУТРИ шаров (как у школьной сцены): DOM-текст в передней точке шара по лучу камеры.
 *  • размер шрифта — от экранного радиуса шара (clamp 11…40 px; у «Na⁺», «Mg²⁺» — мельче);
 *  • цвет — по яркости шара: на светлом (H, S, Cl, Mg) тёмная буква, на тёмном — белая;
 *  • подпись прячется, если шар на экране мал или его центр закрыт более близким шаром —
 *    буквы задних атомов не рисуются поверх передних;
 *  • у кристалла подписываются только несколько передних открытых узлов каждого сорта, разнесённых
 *    по экрану (без «каши» из десятков подписей); выбор держится, пока узел открыт (без мигания).
 *
 * Компонент монтируется ВНУТРИ группы позы: координаты атомов — в её системе. Один слой на вид,
 * элементы создаются один раз, в кадре пишется только изменившееся (как CinemaDomLabels).
 */

type Node = { el: HTMLDivElement; shown: boolean; x: number; y: number; fs: number; op: number }

const _w = new THREE.Vector3()
const _cam = new THREE.Vector3()
const _f = new THREE.Vector3()
const _s = new THREE.Vector3()

type Scratch = {
  x: Float32Array
  y: Float32Array
  d: Float32Array
  r: Float32Array
  open: Uint8Array
  shown: Uint8Array
  order: number[]
}

function createScratch(n: number): Scratch {
  return {
    x: new Float32Array(n),
    y: new Float32Array(n),
    d: new Float32Array(n),
    r: new Float32Array(n),
    open: new Uint8Array(n),
    shown: new Uint8Array(n),
    order: Array.from({ length: n }, (_, i) => i),
  }
}

/** Подписей одного сорта у кристалла. */
const CRYSTAL_PER_KIND = 3

function fontK(label: string): number {
  const n = [...label].length
  return n <= 1 ? 0.8 : n === 2 ? 0.58 : n === 3 ? 0.5 : 0.42
}

export function SchoolBallLabels({
  atoms,
  crystal,
  opacity,
}: {
  atoms: readonly SchoolHeroAtom[]
  crystal: boolean
  /** общая прозрачность подписей (проявление вместе с героем) */
  opacity: MutableRefObject<number>
}) {
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nodes = useRef<Node[]>([])
  const scratchRef = useRef<Scratch | null>(null)

  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.dataset.schoolBallLabels = ''
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:2; contain:strict;'
    nodes.current = atoms.map((a) => {
      const el = document.createElement('div')
      const dark = schoolLabelDark(schoolAtomHex(a.el))
      el.textContent = a.label
      el.style.cssText =
        'position:absolute; left:0; top:0; white-space:nowrap; will-change:transform,opacity; display:none; opacity:0;' +
        'font-family:"Inter", system-ui, sans-serif; font-weight:700; line-height:1; letter-spacing:0.01em;' +
        (dark
          ? 'color:#101722; text-shadow:0 0 3px rgba(255,255,255,0.6);'
          : 'color:#ffffff; text-shadow:0 1px 2px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.35);')
      layer.appendChild(el)
      return { el, shown: false, x: NaN, y: NaN, fs: NaN, op: NaN }
    })
    host.appendChild(layer)
    scratchRef.current = createScratch(atoms.length)
    return () => {
      nodes.current = []
      scratchRef.current = null
      layer.remove()
    }
  }, [gl, atoms])

  useFrame(() => {
    const g = group.current
    const list = nodes.current
    const scratch = scratchRef.current
    if (!g || list.length === 0 || !scratch) return
    const op = Math.round(Math.min(1, Math.max(0, opacity.current)) * 100) / 100
    const n = atoms.length
    const cam = camera as THREE.PerspectiveCamera
    const w = size.width
    const h = size.height
    if (op <= 0.01 || w < 2 || h < 2) {
      for (const node of list) hide(node)
      scratch.shown.fill(0)
      return
    }
    g.updateWorldMatrix(true, false)
    _s.setFromMatrixScale(g.matrixWorld)
    const k = (_s.x + _s.y + _s.z) / 3
    _cam.setFromMatrixPosition(cam.matrixWorld)
    const pxK = h / 2 / Math.tan(((cam.fov || 46) * Math.PI) / 360)
    // 1) экранные центры (передняя точка шара) и радиусы
    for (let i = 0; i < n; i++) {
      const a = atoms[i]!
      _w.set(a.pos[0], a.pos[1], a.pos[2]).applyMatrix4(g.matrixWorld)
      const d = _cam.distanceTo(_w)
      const rw = a.r * k
      _f.copy(_cam).sub(_w).normalize().multiplyScalar(rw).add(_w).project(cam)
      scratch.x[i] = (_f.x * 0.5 + 0.5) * w
      scratch.y[i] = (-_f.y * 0.5 + 0.5) * h
      scratch.d[i] = d
      scratch.r[i] = d > 1e-6 && _f.z < 1 ? (rw / d) * pxK : 0
    }
    // 2) открыт ли центр шара (не закрыт ближним шаром) и достаточно ли он крупный
    const minR = crystal ? 12 : 9
    const openCenter = (i: number) => {
      for (let j = 0; j < n; j++) {
        if (j === i || scratch.d[j]! >= scratch.d[i]! - 1e-6) continue
        if (Math.hypot(scratch.x[j]! - scratch.x[i]!, scratch.y[j]! - scratch.y[i]!) < scratch.r[j]! + 0.35 * scratch.r[i]!) return false
      }
      return true
    }
    for (let i = 0; i < n; i++) scratch.open[i] = scratch.r[i]! >= minR && openCenter(i) ? 1 : 0
    // 3) кристалл: несколько передних открытых узлов каждого сорта, разнесённых по экрану
    if (crystal) {
      const ord = scratch.order
      ord.sort((p, q) => (scratch.shown[q]! - scratch.shown[p]!) || scratch.d[p]! - scratch.d[q]!)
      const count = new Map<string, number>()
      const picked: number[] = []
      scratch.shown.fill(0)
      const tryPick = (i: number, minPx: number) => {
        if (!scratch.open[i] && !(minPx < minR && scratch.r[i]! >= minPx && openCenter(i))) return
        const lab = atoms[i]!.label
        if ((count.get(lab) ?? 0) >= CRYSTAL_PER_KIND) return
        for (const j of picked) {
          if (Math.hypot(scratch.x[j]! - scratch.x[i]!, scratch.y[j]! - scratch.y[i]!) < 2.6 * Math.max(scratch.r[i]!, scratch.r[j]!, 12)) return
        }
        picked.push(i)
        count.set(lab, (count.get(lab) ?? 0) + 1)
        scratch.shown[i] = 1
      }
      for (const i of ord) tryPick(i, minR)
      // Мелкие ионы (Na⁺ рядом с Cl⁻): если ни один не набрал порога размера — одна подпись на самом
      // крупном открытом переднем узле сорта (буква может чуть выйти за шар, но сорт назван).
      const labels = new Set(atoms.map((a) => a.label))
      for (const lab of labels) {
        if ((count.get(lab) ?? 0) > 0) continue
        for (const i of ord) {
          if (atoms[i]!.label !== lab) continue
          const before = count.get(lab) ?? 0
          tryPick(i, 5)
          if ((count.get(lab) ?? 0) > before) break
        }
      }
    } else {
      for (let i = 0; i < n; i++) scratch.shown[i] = scratch.open[i]!
    }
    // 4) запись в DOM только изменившегося
    for (let i = 0; i < n; i++) {
      const node = list[i]
      if (!node) continue
      if (!scratch.shown[i]) {
        hide(node)
        continue
      }
      const fs = Math.round(Math.max(11, Math.min(40, scratch.r[i]! * fontK(atoms[i]!.label))) * 2) / 2
      // Дробные пиксели (translate3d + will-change): подпись идёт за шаром плавно, без «ступенек» по 0,5 px.
      const x = Math.round(scratch.x[i]! * 100) / 100
      const y = Math.round(scratch.y[i]! * 100) / 100
      if (!node.shown) {
        node.el.style.display = 'block'
        node.shown = true
      }
      if (fs !== node.fs) {
        node.el.style.fontSize = `${fs}px`
        node.fs = fs
      }
      if (x !== node.x || y !== node.y) {
        node.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
        node.x = x
        node.y = y
      }
      if (op !== node.op) {
        node.el.style.opacity = String(op)
        node.op = op
      }
    }
  })

  return <group ref={group} />
}

function hide(node: Node): void {
  if (!node.shown) return
  node.el.style.display = 'none'
  node.shown = false
}
