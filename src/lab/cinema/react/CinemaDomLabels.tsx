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
  /** Радиус (система группы) вокруг закреплённой подписи-символа: другие подписи его обходят (шар атома). */
  avoidR?: number
}

const KIND_STYLE: Record<string, string> = {
  ox:
    'font: 600 12px/1 "Inter", system-ui, sans-serif; padding: 3px 6px; border-radius: 999px;' +
    'background: rgba(6, 14, 30, 0.72); border: 1px solid rgba(160, 210, 255, 0.35); color: #dff1ff;',
  species:
    'font: 600 14px/1.1 "Inter", system-ui, sans-serif; color: #f4f8ff; letter-spacing: 0.01em;' +
    'text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.8);',
  // Подпись вещества в несколько строк (перевод строки в тексте) — выноска школьного режима BaSO₄.
  speciesLines:
    'font: 600 14px/1.2 "Inter", system-ui, sans-serif; color: #f4f8ff; letter-spacing: 0.01em; white-space: pre-line; text-align: left;' +
    'text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.8);',
  delta:
    'font: italic 700 15px/1 "Times New Roman", Georgia, serif; color: #8fe6ff; text-shadow: 0 0 8px rgba(0,0,0,0.9);',
  // Размер (длина, параметр ячейки): прямой шрифт героя на тёмной плашке — читается поверх сфер.
  measure:
    'font: 600 12.5px/1 "Inter", system-ui, sans-serif; color: #cfeeff; padding: 3px 7px; border-radius: 6px;' +
    'background: rgba(6, 12, 26, 0.78); border: 1px solid rgba(150, 205, 255, 0.35); font-variant-numeric: tabular-nums;',
  // Символ элемента/иона ВНУТРИ шара: крупный, белый, с тенью — читается и на фиолетовом Na, и на зелёном Cl.
  atom:
    'font: 700 16px/1 "Inter", system-ui, sans-serif; color: #ffffff; letter-spacing: 0.01em;' +
    'text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.55);',
  // Символ внутри СВЕТЛОГО шара (H — белый CPK, S — жёлтый): тёмный текст со светлым ореолом.
  atomDark:
    'font: 700 16px/1 "Inter", system-ui, sans-serif; color: #111822; letter-spacing: 0.01em;' +
    'text-shadow: 0 0 3px rgba(255,255,255,0.75), 0 0 8px rgba(255,255,255,0.35);',
  token:
    'font: 700 13px/1 "Inter", system-ui, sans-serif; color: #fff3c4; text-shadow: 0 0 10px rgba(255,190,80,0.9);',
  // Условие реакции (t°, кат. V₂O₅) — крупной плашкой: читается на облаках и на телефоне.
  condition:
    'font: 700 17px/1 "Inter", system-ui, sans-serif; color: #ffe3a3; padding: 5px 12px; border-radius: 999px;' +
    'background: rgba(34, 24, 6, 0.8); border: 1px solid rgba(255, 210, 120, 0.55); text-shadow: 0 0 8px rgba(255,190,80,0.6);',
  // Уравнение итога: «левая ␟ стрелка ␟ условие ␟ правая» — условие мелко НАД стрелкой (renderEquation).
  equation:
    'font: 600 15px/1.1 "Inter", system-ui, sans-serif; color: #f4f8ff; letter-spacing: 0.01em; padding-top: 16px;' +
    'text-shadow: 0 0 6px rgba(0,0,0,0.95), 0 0 14px rgba(0,0,0,0.8);',
  // Уравнение итога поверх «живого» фона (молекулы воды в растворе): тот же шрифт на тёмной плашке.
  equationPlate:
    'font: 700 18px/1.15 "Inter", system-ui, sans-serif; color: #f4f8ff; letter-spacing: 0.01em; padding: 6px 14px 7px;' +
    'border-radius: 10px; background: rgba(6, 12, 26, 0.86); border: 1px solid rgba(150, 205, 255, 0.45);' +
    'box-shadow: 0 6px 24px rgba(0,0,0,0.45);',
  // Выноска-пояснение (что такое H₃O⁺): несколько строк через перевод строки, тёплая рамка — как ореол катиона.
  callout:
    'font: 500 13px/1.42 "Inter", system-ui, sans-serif; color: #fff4e3; padding: 8px 13px 9px; border-radius: 10px;' +
    'white-space: pre-line; text-align: left; background: rgba(28, 16, 6, 0.9); border: 1px solid rgba(255, 184, 96, 0.7);' +
    'box-shadow: 0 0 18px rgba(255, 170, 70, 0.28), 0 6px 22px rgba(0,0,0,0.5);',
  // pH-метр (renderPh): стеклянная карточка фиксированной ширины (labelLayout FIXED_BOX) — шкала 0–14 и подпись.
  ph:
    'box-sizing: border-box; width: 232px; padding: 9px 12px 10px; border-radius: 12px; white-space: normal;' +
    'font: 600 12.5px/1.35 "Inter", system-ui, sans-serif; color: #eef6ff; text-align: left;' +
    'background: linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 55%), rgba(10, 18, 36, 0.52);' +
    '-webkit-backdrop-filter: blur(10px) saturate(1.25); backdrop-filter: blur(10px) saturate(1.25);' +
    'border: 1px solid rgba(214, 232, 255, 0.34); box-shadow: 0 8px 26px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.18);',
}

/** Ширина карточки pH-метра, px: 232 на широком холсте, на узком — меньше половины его ширины (не меньше 176). */
function phWidth(canvasW: number): number {
  return Math.round(Math.min(232, Math.max(176, canvasW * 0.46)))
}

/**
 * pH-метр: «pH», шкала 0–14 (красная → зелёная → синяя), стрелка в кислой зоне (без точного числа — концентрации
 * в опыте не заданы) и подпись. Всё — узлами с textContent, без HTML из строки.
 */
function renderPh(el: HTMLDivElement, caption: string): void {
  const node = (tag: string, css: string, text = '') => {
    const n = document.createElement(tag)
    n.style.cssText = css
    if (text) n.textContent = text
    return n
  }
  const head = node('div', 'display:flex;align-items:center;gap:8px;margin-bottom:5px;')
  head.append(node('span', 'font-weight:800;font-size:13px;letter-spacing:0.02em;color:#ffffff;', 'pH'))
  const track = node('div', 'position:relative;flex:1;height:9px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25);' +
    'background:linear-gradient(90deg,#e5322d 0%,#f07a26 14%,#f5c928 29%,#8fcf3a 43%,#2fb36b 50%,#1e9fb0 64%,#2f6fd8 79%,#5b3fb8 100%);')
  // стрелка — в красной (кислой) зоне
  track.append(node('span', 'position:absolute;left:12%;top:-8px;width:0;height:0;transform:translateX(-50%);' +
    'border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #ffffff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.7));'))
  track.append(node('span', 'position:absolute;left:12%;top:-1px;bottom:-1px;width:2px;transform:translateX(-50%);background:#ffffff;box-shadow:0 0 4px rgba(0,0,0,0.6);'))
  head.append(track)
  const ticks = node('div', 'display:flex;justify-content:space-between;margin:0 0 5px 30px;font-size:10.5px;font-weight:600;color:rgba(230,240,255,0.72);font-variant-numeric:tabular-nums;')
  for (const x of ['0', '7', '14']) ticks.append(node('span', '', x))
  el.replaceChildren(head, ticks, node('div', '', caption))
}

/** Разделитель частей уравнения (как EQUATION_PART_SEP школьной сцены). */
const EQ_SEP = '␟'

/** Уравнение с условием над стрелкой: части — текстом (textContent), без HTML из строки. */
function renderEquation(el: HTMLDivElement, text: string): void {
  const [left = '', arrow = '→', cond = '', right = ''] = text.split(EQ_SEP)
  const span = (t: string, css = '') => {
    const s = document.createElement('span')
    s.textContent = t
    if (css) s.style.cssText = css
    return s
  }
  // Стрелка — в строке (на базовой линии), условие — над ней по центру (место сверху даёт padding-top
  // стиля 'equation', чтобы раскладка подписей учитывала его высоту).
  const col = span(arrow, 'position:relative;display:inline-block;margin:0 0.45em;font-size:17px;line-height:1;')
  col.append(span(cond, 'position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:2px;font-size:13px;font-weight:700;line-height:1;color:#ffe3a3;white-space:nowrap;'))
  el.replaceChildren(span(left), col, span(right))
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
    if (src.kind === 'equation' && src.text.includes(EQ_SEP)) renderEquation(n.el, src.text)
    else if (src.kind === 'ph') renderPh(n.el, src.text)
    else n.el.textContent = src.text
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
      if (l.kind === 'equation' && l.text.includes(EQ_SEP)) renderEquation(el, l.text)
      else if (l.kind === 'ph') renderPh(el, l.text)
      else el.textContent = l.text
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
      // Символ атома с avoidR — препятствие для подписей даже тогда, когда сам не виден (мелкий шар).
      if (!(src.opacity > 0.01) && !src.avoidR) continue
      _v.copy(src.pos).applyMatrix4(g.matrixWorld).project(camera)
      if (_v.z > 1 || _v.z < -1) continue
      // Символ внутри шара закреплён за центром шара: раскладка его не двигает (on = 2).
      b.on[i] = src.kind === 'atom' || src.kind === 'atomDark' ? 2 : 1
      b.x[i] = (_v.x * 0.5 + 0.5) * w
      b.y[i] = (-_v.y * 0.5 + 0.5) * h
      b.r[i] = 0
      if (src.avoidR && b.on[i] === 2) {
        // Радиус препятствия на экране: сдвиг на avoidR вдоль оси x группы (у сцены — вправо по кадру).
        _v.set(src.pos.x + src.avoidR, src.pos.y, src.pos.z).applyMatrix4(g.matrixWorld).project(camera)
        b.r[i] = Math.abs((_v.x * 0.5 + 0.5) * w - b.x[i]!)
      }
      estimateLabelSize(src.kind, src.text, scale, _size)
      b.w[i] = _size.w
      b.h[i] = _size.h
      if (src.kind === 'ph') {
        // карточка pH-метра на узком холсте (телефон) — уже половины кадра, подпись в две строки (высота та же)
        const pw = phWidth(w)
        if (pw < _size.w) b.w[i] = pw * scale
        const node = list[i]
        if (node && node.ox !== String(pw)) {
          node.el.style.width = `${pw}px`
          node.ox = String(pw)
        }
      }
    }
    // 2) раскладка: зажим в свободную область и разнос по вертикали
    if (layout) {
      writeLayoutRect(safe, w, h)
      layoutLabels(b, n, _rect)
    }
    // 3) запись в DOM только изменившегося
    for (let i = 0; i < n; i++) {
      const node = list[i]!
      if (!b.on[i] || !(labels[i]!.opacity > 0.01)) {
        hideLabel(node)
        continue
      }
      writeLabel(node, labels[i]!, b.x[i]!, b.y[i]!, scale)
    }
    for (let i = n; i < list.length; i++) hideLabel(list[i]!)
  })

  return <group ref={group} />
}
