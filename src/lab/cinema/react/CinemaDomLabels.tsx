import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Подписи, привязанные к точкам 3D-мира, но нарисованные DOM-текстом.
 *
 * Почему DOM: в формулах нужны δ, ⁺/⁻, подстрочные ₂ и «−1» — шрифт troika в
 * сцене такие глифы не держит. Почему не drei <Html>: там по React-корню на
 * подпись; здесь один слой, элементы создаются один раз, а кадр меняет только
 * transform/opacity (и textContent, когда текст реально сменился).
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
    'font: italic 700 15px/1 "Times New Roman", Georgia, serif; text-shadow: 0 0 8px rgba(0,0,0,0.9);',
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

export function CinemaDomLabels({ labels, scale = 1 }: { labels: readonly DomLabelSource[]; scale?: number }) {
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nodes = useRef<Array<{ el: HTMLDivElement; text: string; shown: boolean; ox: string }>>([])

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
      return { el, text: l.text, shown: false, ox: '' }
    })
    host.appendChild(layer)
    nodes.current = list
    return () => {
      nodes.current = []
      layer.remove()
    }
    // Набор подписей фиксирован на прогон: labels — массив из заранее созданного кадра.
  }, [gl, labels])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const list = nodes.current
    const w = size.width
    const h = size.height
    for (let i = 0; i < list.length; i++) {
      const n = list[i]!
      const src = labels[i]
      if (!src) continue
      const visible = src.opacity > 0.01
      if (!visible) {
        if (n.shown) {
          n.el.style.display = 'none'
          n.shown = false
        }
        continue
      }
      _v.copy(src.pos).applyMatrix4(g.matrixWorld).project(camera)
      if (_v.z > 1 || _v.z < -1) {
        if (n.shown) {
          n.el.style.display = 'none'
          n.shown = false
        }
        continue
      }
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
      const x = (_v.x * 0.5 + 0.5) * w
      const y = (-_v.y * 0.5 + 0.5) * h
      n.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale})`
      n.el.style.opacity = src.opacity.toFixed(3)
    }
  })

  return <group ref={group} />
}
