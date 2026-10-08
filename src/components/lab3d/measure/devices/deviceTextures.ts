/**
 * Текстуры приборов (CanvasTexture, без шрифтов из сети): дисплей весов, шкалы мерной посуды и термометра
 * с цифрами, этикетки банок. Шкалы кешируются по параметрам — одинаковые приборы делят одну текстуру.
 */
import { useEffect, useMemo, type DependencyList } from 'react'
import * as THREE from 'three'

const FONT = 'system-ui, "Segoe UI", Arial, sans-serif'
const MONO = '"Consolas", "DejaVu Sans Mono", "Courier New", monospace'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2d недоступен')
  return [c, g]
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Как useMemo, но созданный материал/геометрия освобождается при размонтировании (и при смене deps).
 * Без этого материал опыта живёт после ухода из опыта и держит свою программу шейдера — число программ
 * растёт с каждой сменой опыта. Только для объектов, созданных здесь же (не для общих кешей: sharedGlass, шкалы).
 */
export function useOwned<T extends { dispose: () => void }>(make: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- deps задаёт вызывающий, как у useMemo
  const v = useMemo(make, deps)
  useEffect(() => () => v.dispose(), [v])
  return v
}

/**
 * Грани «плоской заливки» прямо в геометрии (у каждого треугольника своя нормаль) — вместо flatShading у
 * материала: flatShading собирает отдельную программу шейдера, а так подходит общая программа.
 */
export function faceted(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const f = g.index ? g.toNonIndexed() : g
  f.computeVertexNormals()
  if (f !== g) g.dispose()
  return f
}

/* ── Дисплей электронных весов ── */

export interface ScalesDisplay {
  readonly texture: THREE.CanvasTexture
  /** Перерисовать: text = null — весы выключены (тёмный экран). */
  draw(text: string | null, stable: boolean, zero: boolean): void
}

/**
 * Передняя панель весов целиком — тёмная окантовка и утопленный ЖК-экран в ОДНОЙ текстуре (плоскость лежит ровно на
 * скосе корпуса, поэтому экран не «отрывается» от панели при крупном плане). 640 × 102 px ↔ панель 0,15 × 0,024 м.
 */
export const SCALES_PANEL_PX = { w: 640, h: 102 } as const
/** Окно ЖК-экрана в пикселях панели (по центру, с полями). */
const LCD = { x: 168, y: 10, w: 304, h: 82 } as const

export function createScalesDisplay(): ScalesDisplay {
  const [c, g] = canvas(SCALES_PANEL_PX.w, SCALES_PANEL_PX.h)
  const texture = toTexture(c)
  let last = ''
  return {
    texture,
    draw(text, stable, zero) {
      const key = `${text}|${stable}|${zero}`
      if (key === last) return
      last = key
      // тёмный пластик панели
      g.fillStyle = '#1d2329'
      g.fillRect(0, 0, SCALES_PANEL_PX.w, SCALES_PANEL_PX.h)
      // утопленное окно экрана: тень сверху, ЖК с подсветкой (выключен — тёмно-зелёное стекло)
      g.fillStyle = '#0d1114'
      g.fillRect(LCD.x - 3, LCD.y - 3, LCD.w + 6, LCD.h + 6)
      g.fillStyle = text == null ? '#26302a' : '#c6dfc1'
      g.fillRect(LCD.x, LCD.y, LCD.w, LCD.h)
      if (text != null) {
        const cx = LCD.x
        const cy = LCD.y
        g.fillStyle = '#16211a'
        g.font = `700 54px ${MONO}`
        g.textAlign = 'right'
        g.textBaseline = 'middle'
        g.fillText(text, cx + LCD.w - 46, cy + LCD.h / 2 + 2)
        g.font = `700 26px ${FONT}`
        g.textAlign = 'left'
        g.fillText('g', cx + LCD.w - 38, cy + LCD.h / 2 + 12)
        // значок стабильности «○» и «→0←»
        g.font = `600 17px ${FONT}`
        g.textAlign = 'left'
        g.globalAlpha = stable ? 1 : 0.14
        g.fillText('○', cx + 8, cy + 16)
        g.globalAlpha = zero ? 1 : 0.14
        g.fillText('→0←', cx + 8, cy + LCD.h - 14)
        g.globalAlpha = 1
      }
      // подписи кнопок на панели
      g.fillStyle = '#c9d1d9'
      g.font = `600 15px ${FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'alphabetic'
      g.fillText('ON/OFF', 80, 96)
      g.fillText('TARE', 560, 96)
      texture.needsUpdate = true
    },
  }
}

/* ── Шкала мерной посуды ── */

export interface ScaleSpec {
  /** Вместимость по шкале (верхняя цифра), мл. */
  readonly capacity: number
  /** Цена деления, мл. */
  readonly division: number
  /** Цифры — каждые labelEvery мл. */
  readonly labelEvery: number
  /** Длинные риски — каждые majorEvery мл. */
  readonly majorEvery: number
  /** Перевёрнутый цилиндр для газа: «0» сверху, цифры растут вниз (текст при этом читается нормально). */
  readonly inverted?: boolean
  /** Подпись производителя внизу/вверху: «250 ml 20 °C». */
  readonly caption?: string
  /** Цвет рисок (синий — как эмаль на школьной посуде). */
  readonly color?: string
}

const scaleCache = new Map<string, THREE.CanvasTexture>()

/**
 * Текстура шкалы: прозрачный фон, риски слева, цифры справа от длинных рисок. Ось V текстуры — высота шкалы
 * (v = 0 — нижняя риска «0» обычного цилиндра; у перевёрнутого — нижний край шкалы = наибольший объём).
 * Отступ сверху и снизу — pad (доля), чтобы крайние цифры не обрезались.
 */
export const SCALE_TEX_PAD = 0.04
export function scaleTexture(spec: ScaleSpec): THREE.CanvasTexture {
  const key = JSON.stringify(spec)
  const hit = scaleCache.get(key)
  if (hit) return hit
  const W = 160
  const H = 1024
  const [c, g] = canvas(W, H)
  g.clearRect(0, 0, W, H)
  const color = spec.color ?? '#1f3f8f'
  g.strokeStyle = color
  g.fillStyle = color
  const pad = SCALE_TEX_PAD * H
  const usable = H - 2 * pad
  const n = Math.round(spec.capacity / spec.division)
  // слишком частые деления рисуем через одно, чтобы риски не сливались (на 512 px шкалы — не чаще ~4 px)
  const every = usable / n < 4 ? 2 : 1
  for (let i = 0; i <= n; i += every) {
    const v = i * spec.division
    const frac = v / spec.capacity
    const y = spec.inverted ? pad + frac * usable : H - pad - frac * usable
    const major = Math.abs(v / spec.majorEvery - Math.round(v / spec.majorEvery)) < 1e-6
    const half = !major && Math.abs((v * 2) / spec.majorEvery - Math.round((v * 2) / spec.majorEvery)) < 1e-6
    const len = major ? 54 : half ? 38 : 24
    g.lineWidth = major ? 4 : 2.4
    g.beginPath()
    g.moveTo(4, y)
    g.lineTo(4 + len, y)
    g.stroke()
    const labeled = Math.abs(v / spec.labelEvery - Math.round(v / spec.labelEvery)) < 1e-6
    if (labeled && (v > 0 || spec.inverted)) {
      g.font = `700 ${spec.capacity >= 100 ? 34 : 38}px ${FONT}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      const txt = Number.isInteger(v) ? String(v) : String(v).replace('.', ',')
      g.fillText(txt, 66, y)
    }
  }
  if (spec.caption) {
    g.font = `600 22px ${FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(spec.caption, 64, spec.inverted ? H - pad * 0.5 : pad * 0.5 + 2)
  }
  const tex = toTexture(c)
  scaleCache.set(key, tex)
  return tex
}

/* ── Шкала термометра ── */

let thermoTex: THREE.CanvasTexture | null = null
/** Шкала −10…+110 °C: риски через 1 °C, цифры через 10 °C. v = 0 — «−10», v = 1 — «110» (с отступами SCALE_TEX_PAD). */
export function thermometerScaleTexture(): THREE.CanvasTexture {
  if (thermoTex) return thermoTex
  const W = 128
  const H = 1024
  const [c, g] = canvas(W, H)
  g.fillStyle = '#fbfbf6'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#1a1f26'
  g.strokeStyle = '#1a1f26'
  const pad = SCALE_TEX_PAD * H
  const usable = H - 2 * pad
  for (let t = -10; t <= 110; t++) {
    const y = H - pad - ((t + 10) / 120) * usable
    const major = t % 10 === 0
    const mid = t % 5 === 0
    g.lineWidth = major ? 3 : 1.6
    g.beginPath()
    g.moveTo(8, y)
    g.lineTo(8 + (major ? 40 : mid ? 28 : 16), y)
    g.stroke()
    if (major) {
      g.font = `700 30px ${FONT}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(String(t).replace('-', '−'), 56, y)
    }
  }
  g.font = `700 26px ${FONT}`
  g.fillText('°C', 60, pad * 0.5 + 6)
  thermoTex = toTexture(c)
  return thermoTex
}

/* ── Этикетка банки / склянки ── */

const labelCache = new Map<string, THREE.CanvasTexture>()
/** Этикетка: формула крупно, название, строка (концентрация, «ч.д.а.»); полоса цвета класса опасности. */
export function jarLabelTexture(formula: string, name: string, sub = '', stripe = '#2f7cf6'): THREE.CanvasTexture {
  const key = `${formula}|${name}|${sub}|${stripe}`
  const hit = labelCache.get(key)
  if (hit) return hit
  const [c, g] = canvas(256, 192)
  g.fillStyle = '#fbfaf6'
  g.fillRect(0, 0, 256, 192)
  g.fillStyle = stripe
  g.fillRect(0, 0, 256, 20)
  g.fillStyle = '#1d2733'
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  let size = 62
  g.font = `700 ${size}px ${FONT}`
  while (g.measureText(formula).width > 236 && size > 26) {
    size -= 4
    g.font = `700 ${size}px ${FONT}`
  }
  g.fillText(formula, 128, 92)
  g.font = `500 24px ${FONT}`
  g.fillStyle = '#4c5866'
  let nsize = 24
  while (g.measureText(name).width > 240 && nsize > 14) {
    nsize -= 2
    g.font = `500 ${nsize}px ${FONT}`
  }
  g.fillText(name, 128, 132)
  if (sub) {
    g.font = `700 26px ${FONT}`
    g.fillStyle = '#1d2733'
    g.fillText(sub, 128, 170)
  }
  const tex = toTexture(c)
  labelCache.set(key, tex)
  return tex
}

/* ── Табличка-дисплей (сушильный шкаф, плитка) ── */

export interface SmallDisplay {
  readonly texture: THREE.CanvasTexture
  draw(lines: readonly string[]): void
}

export function createSmallDisplay(w = 256, h = 96, bg = '#101820', fg = '#ff6a3c'): SmallDisplay {
  const [c, g] = canvas(w, h)
  const texture = toTexture(c)
  let last = ''
  return {
    texture,
    draw(lines) {
      const key = lines.join('\n')
      if (key === last) return
      last = key
      g.fillStyle = bg
      g.fillRect(0, 0, w, h)
      g.fillStyle = fg
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const lh = h / Math.max(1, lines.length)
      lines.forEach((l, i) => {
        g.font = `700 ${Math.round(lh * 0.62)}px ${MONO}`
        g.fillText(l, w / 2, lh * (i + 0.5))
      })
      texture.needsUpdate = true
    },
  }
}
