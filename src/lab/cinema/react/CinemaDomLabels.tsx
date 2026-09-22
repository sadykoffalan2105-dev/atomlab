import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createLabelLayoutBuffers,
  estimateLabelSize,
  layoutLabels,
  type LabelLayoutBuffers,
  type LabelRect,
} from '../core/labelLayout'
import type { SafeArea } from '../core/safeArea'

/**
 * Подписи, привязанные к точкам 3D-мира, но нарисованные DOM-текстом.
 *
 * Почему DOM: в формулах нужны δ, ⁺/⁻, подстрочные ₂ и «−1» — шрифт troika в
 * сцене такие глифы не держит. Почему не drei <Html>: там по React-корню на
 * подпись; здесь один слой, элементы создаются один раз, а кадр меняет только
 * transform/opacity (и textContent, когда текст реально сменился).
 *
 * Запись в style — только при реальном изменении: позиция округляется до 0.5 px,
 * прозрачность до 0.01, масштаб сравнивается как есть. Неподвижная подпись не
 * трогает DOM вовсе. Чтений раскладки (getBoundingClientRect и т. п.) в кадре
 * нет: размер канваса берётся из стора R3F, размер подписи оценивается по
 * числу символов (core/labelLayout).
 *
 * Раскладка (по умолчанию включена): центр подписи зажимается в прямоугольник
 * свободной области (safe — world.safe, без него рамка канваса), пересекающиеся
 * подписи разводятся по вертикали. Сцена микромира тёмная в обеих темах
 * приложения (решение владельца: как поле микроскопа), поэтому цвета подписей
 * заданы явно и не наследуют цвет текста темы.
 *
 * Координаты берутся в системе группы, внутри которой смонтирован компонент
 * (обычно риг камеры) — поэтому подписи едут вместе с наездом.
 */

export type DomLabelSource = {
  id: string
  kind: string
  pos: THREE.Vector3
  opacity: number
  text: string
}

const KIND_STYLE: Record<string, string> = {
  ox:
    'font: 600 12px/1 "Inter", system-ui, sans-serif; padding: 3px 6px; border-radius: 999px;' +
    'background: rgba(6, 14, 30, 0.72); border: 1px solid rgba(160, 210, 255, 0.35); color: #dff1ff;',
  species:
    'font: 600 14px/1.1 "Inter", system-ui, sans-serif; color: #f4f8ff; letter-spacing: 0.01em;' +
    'text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.8);',
  delta:
    'font: italic 700 15px/1 "Times New Roman", Georgia, serif; color: #8fe6ff; text-shadow: 0 0 8px rgba(0,0,0,0.9);',
  // Размер (длина, параметр ячейки): прямой шрифт героя на тёмной плашке — читается поверх сфер.
  measure:
    'font: 600 12.5px/1 "Inter", system-ui, sans-serif; color: #cfeeff; padding: 3px 7px; border-radius: 6px;' +
    'background: rgba(6, 12, 26, 0.78); border: 1px solid rgba(150, 205, 255, 0.35); font-variant-numeric: tabular-nums;',
  token:
    'font: 700 13px/1 "Inter", system-ui, sans-serif; color: #fff3c4; text-shadow: 0 0 10px rgba(255,190,80,0.9);',
}

function oxColor(text: string): { border: string; color: string } {
  if (text.startsWith('+')) return { border: 'rgba(255, 170, 110, 0.7)', color: '#ffd3ad' }
  if (text.startsWith('−') || text.startsWith('-')) return { border: 'rgba(120, 220, 255, 0.75)', color: '#bdf0ff' }
  return { border: 'rgba(200, 210, 230, 0.5)', color: '#e6edf7' }
}

function deltaColor(text: string): string {
  return text.includes('+') ? '#ffb27a' : '#8fe6ff'
}

const _v = new THREE.Vector3()
const _size = { w: 0, h: 0 }
const _rect: LabelRect = { left: 0, right: 0, top: 0, bottom: 0 }

type LabelNode = {
  el: HTMLDivElement
  text: string
  shown: boolean
  ox: string
  /** последние записанные в style значения (NaN — ещё не писали) */
  x: number
  y: number
  opacity: number
  scale: number
}

function hideLabel(n: LabelNode): void {
  if (!n.shown) return
  n.el.style.display = 'none'
  n.shown = false
}

/** Пишет в DOM только изменившееся. Округление гасит дребезг субпиксельного движения. */
function writeLabel(n: LabelNode, src: DomLabelSource, px: number, py: number, scale: number): void {
  if (!n.shown) {
    n.el.style.display = 'block'
    n.shown = true
  }
  if (n.text !== src.text) {
    n.el.textContent = src.text
    n.text = src.text
  }
  if (src.kind === 'ox' && n.ox !== src.text) {
    const c = oxColor(src.text)
    n.el.style.borderColor = c.border
    n.el.style.color = c.color
    n.ox = src.text
  } else if (src.kind === 'delta' && n.ox !== src.text) {
    n.el.style.color = deltaColor(src.text)
    n.ox = src.text
  }
  const x = Math.round(px * 2) / 2
  const y = Math.round(py * 2) / 2
  if (x !== n.x || y !== n.y || scale !== n.scale) {
    n.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
    n.x = x
    n.y = y
    n.scale = scale
  }
  const opacity = Math.round(src.opacity * 100) / 100
  if (opacity !== n.opacity) {
    n.el.style.opacity = String(opacity)
    n.opacity = opacity
  }
}

/** Прямоугольник раскладки: свободная область, если она измерена и не вырождена, иначе весь канвас. */
function writeLayoutRect(safe: SafeArea | undefined, w: number, h: number): void {
  if (safe && safe.ready && safe.right - safe.left > 40 && safe.bottom - safe.top > 40) {
    _rect.left = safe.left
    _rect.right = safe.right
    _rect.top = safe.top
    _rect.bottom = safe.bottom
    return
  }
  _rect.left = 0
  _rect.right = w
  _rect.top = 0
  _rect.bottom = h
}

export function CinemaDomLabels({
  labels,
  scale = 1,
  safe,
  layout = true,
}: {
  labels: readonly DomLabelSource[]
  scale?: number
  /** свободная область холста (world.safe): подписи не уходят под панель урока и реактор */
  safe?: SafeArea
  /** зажимать подписи в область и разводить пересекающиеся по вертикали (по умолчанию да) */
  layout?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nodes = useRef<LabelNode[]>([])
  const buffers = useRef<LabelLayoutBuffers | null>(null)

  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const layer = document.createElement('div')
    layer.setAttribute('aria-hidden', 'true')
    layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:2; contain:strict;'
    const list = labels.map((l) => {
      const el = document.createElement('div')
      el.style.cssText =
        'position:absolute; left:0; top:0; white-space:nowrap; will-change:transform,opacity; opacity:0; display:none;' +
        (KIND_STYLE[l.kind] ?? KIND_STYLE.species)
      el.textContent = l.text
      layer.appendChild(el)
      return { el, text: l.text, shown: false, ox: '', x: NaN, y: NaN, opacity: NaN, scale: NaN }
    })
    host.appendChild(layer)
    nodes.current = list
    buffers.current = createLabelLayoutBuffers(labels.length)
    return () => {
      nodes.current = []
      buffers.current = null
      layer.remove()
    }
    // Набор подписей фиксирован на прогон: labels — массив из заранее созданного кадра.
  }, [gl, labels])

  useFrame(() => {
    const g = group.current
    const b = buffers.current
    if (!g || !b) return
    const list = nodes.current
    const w = size.width
    const h = size.height
    const n = Math.min(list.length, labels.length, b.on.length)
    // 1) проекция: экранные центры и оценка размеров видимых подписей
    for (let i = 0; i < n; i++) {
      const src = labels[i]!
      b.on[i] = 0
      if (!(src.opacity > 0.01)) continue
      _v.copy(src.pos).applyMatrix4(g.matrixWorld).project(camera)
      if (_v.z > 1 || _v.z < -1) continue
      b.on[i] = 1
      b.x[i] = (_v.x * 0.5 + 0.5) * w
      b.y[i] = (-_v.y * 0.5 + 0.5) * h
      estimateLabelSize(src.kind, src.text, scale, _size)
      b.w[i] = _size.w
      b.h[i] = _size.h
    }
    // 2) раскладка: зажим в свободную область и разнос по вертикали
    if (layout) {
      writeLayoutRect(safe, w, h)
      layoutLabels(b, n, _rect)
    }
    // 3) запись в DOM только изменившегося
    for (let i = 0; i < n; i++) {
      const node = list[i]!
      if (!b.on[i]) {
        hideLabel(node)
        continue
      }
      writeLabel(node, labels[i]!, b.x[i]!, b.y[i]!, scale)
    }
    for (let i = n; i < list.length; i++) hideLabel(list[i]!)
  })

  return <group ref={group} />
}
