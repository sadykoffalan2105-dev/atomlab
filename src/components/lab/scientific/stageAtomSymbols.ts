/**
 * Символы элементов ВНУТРИ шаров сцены реактора: один атлас на всё приложение
 * (CanvasTexture, клетка на подпись «Ba», «Cl⁻», «Ba²⁺»…), который рисуется один раз
 * на подпись и дорастает, когда встречается новая. DOM на каждый атом не создаётся.
 *
 * Каналы атласа (фон непрозрачный чёрный — без премультипликации на краях):
 *   R — заливка букв, G — «ореол» (буквы, расширенные обводкой) для читаемости.
 * В Node (тесты) document нет — атлас не создаётся, чистые функции работают.
 */
import * as THREE from 'three'

/** Клеток по стороне атласа (8 × 8 = 64 подписи). */
export const SYMBOL_ATLAS_COLS = 8
/** Сторона клетки, px. */
const CELL_PX = 128
const ATLAS_PX = SYMBOL_ATLAS_COLS * CELL_PX
/** Доля клетки под текст: поля страхуют от «подтекания» соседей в мипмапах. */
const FIT_W = 0.84
const FIT_CAP = 0.42
/** Кегль заряда относительно символа. */
const SUP_SCALE = 0.5
const FONT_STACK ="system-ui, 'Segoe UI', Roboto, sans-serif"

const SUP_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

export type AtomSymbolText = {
  /** ключ клетки атласа: 'Ba', 'Cl-', 'Ba2+' */
  key: string
  /** символ элемента */
  main: string
  /** заряд надстрочным индексом без символа элемента: '2+', '−', '' */
  sup: string
}

/** Подпись шара: символ элемента, у иона — заряд справа сверху (как Na⁺, Cl⁻ в уроке NaCl). */
export function atomSymbolText(symbol: string, charge: number): AtomSymbolText {
  const q = Number.isFinite(charge) ? Math.trunc(charge) : 0
  if (q === 0) return { key: symbol, main: symbol, sup: '' }
  const mag = Math.abs(q)
  const sign = q > 0 ? '+' : '−'
  return { key: `${symbol}${mag === 1 ? '' : mag}${q > 0 ? '+' : '-'}`, main: symbol, sup: `${mag === 1 ? '' : mag}${sign}` }
}

/** Та же подпись одной строкой (для отладки и тестов): «Ba²⁺», «Cl⁻». */
export function atomSymbolLabel(symbol: string, charge: number): string {
  const t = atomSymbolText(symbol, charge)
  if (!t.sup) return t.main
  const digits = t.sup.slice(0, -1).split('').map((d) => SUP_DIGITS[Number(d)] ?? '').join('')
  return `${t.main}${digits}${t.sup.endsWith('+') ? '⁺' : '⁻'}`
}

// ── цвет шара и контраст подписи ────────────────────────────────────────────

/**
 * Тон шара сцены. CPK сохраняется; Ba (0x00c900) и Cl (0x1ff01f) оба зелёные — Ba чуть уводим
 * в изумрудный, чтобы пары BaCl₂ / BaSO₄ различались не только буквами.
 */
const STAGE_TONE: Readonly<Record<string, number>> = { Ba: 0x00b56e }

export function stageAtomColor(symbol: string, cpk: number): number {
  return STAGE_TONE[symbol] ?? cpk
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Относительная яркость sRGB-цвета (WCAG). */
export function relativeLuminance(hex: number): number {
  const r = srgbToLinear(((hex >> 16) & 255) / 255)
  const g = srgbToLinear(((hex >> 8) & 255) / 255)
  const b = srgbToLinear((hex & 255) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Тёмные буквы на светлых шарах (H, S, Cl, Mg…), белые — на тёмных и насыщенных (O, N, C, Na…).
 * Порог выше «математического» 0.2: белое на красном O и оранжевом Fe читается привычнее.
 */
export function symbolInkIsDark(hex: number): boolean {
  return relativeLuminance(hex) > 0.3
}

// ── атлас ───────────────────────────────────────────────────────────────────

type Atlas = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  cells: Map<string, number>
}

let atlas: Atlas | null = null
let atlasFailed = false

function createAtlas(): Atlas | null {
  if (atlasFailed) return null
  if (typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = ATLAS_PX
    canvas.height = ATLAS_PX
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      atlasFailed = true
      return null
    }
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, ATLAS_PX, ATLAS_PX)
    const texture = new THREE.CanvasTexture(canvas)
    // Данные (маски), не цвет: без sRGB-преобразования.
    texture.colorSpace = THREE.NoColorSpace
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 4
    texture.name = 'stage-atom-symbols'
    return { canvas, ctx, texture, cells: new Map() }
  } catch {
    atlasFailed = true
    return null
  }
}

function drawCell(a: Atlas, cell: number, text: AtomSymbolText): void {
  const { ctx } = a
  const x0 = (cell % SYMBOL_ATLAS_COLS) * CELL_PX
  const y0 = Math.floor(cell / SYMBOL_ATLAS_COLS) * CELL_PX
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(x0, y0, CELL_PX, CELL_PX)
  ctx.beginPath()
  ctx.rect(x0, y0, CELL_PX, CELL_PX)
  ctx.clip()

  // Кегль: по высоте прописной (одинаковая у H и Ba) и по ширине всей подписи.
  const probe = 100
  ctx.font = `700 ${probe}px ${FONT_STACK}`
  const mMain = ctx.measureText(text.main)
  const capProbe = Math.max(1, ctx.measureText('H').actualBoundingBoxAscent || probe * 0.72)
  ctx.font = `700 ${probe * SUP_SCALE}px ${FONT_STACK}`
  const supProbeW = text.sup ? ctx.measureText(text.sup).width + probe * 0.03 : 0
  const widthProbe = mMain.width + supProbeW
  const size = Math.min((FIT_CAP * CELL_PX * probe) / capProbe, (FIT_W * CELL_PX * probe) / Math.max(1, widthProbe))
  const k = size / probe
  const cap = capProbe * k
  const mainW = mMain.width * k
  const supW = supProbeW * k
  const left = x0 + (CELL_PX - (mainW + supW)) / 2
  // Базовая линия: прописные по центру клетки.
  const base = y0 + CELL_PX / 2 + cap / 2
  const supSize = size * SUP_SCALE
  const supBase = base - cap * 0.52
  const halo = Math.max(1.5, size * 0.1)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  // G — ореол (обводка + заливка), R — сами буквы; «lighter» складывает каналы.
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = 'rgb(0,255,0)'
  ctx.fillStyle = 'rgb(0,255,0)'
  ctx.lineWidth = halo * 2
  ctx.font = `700 ${size}px ${FONT_STACK}`
  ctx.strokeText(text.main, left, base)
  ctx.fillText(text.main, left, base)
  if (text.sup) {
    ctx.font = `700 ${supSize}px ${FONT_STACK}`
    ctx.lineWidth = halo * 1.6
    ctx.strokeText(text.sup, left + mainW + size * 0.03, supBase)
    ctx.fillText(text.sup, left + mainW + size * 0.03, supBase)
  }
  ctx.fillStyle = 'rgb(255,0,0)'
  ctx.font = `700 ${size}px ${FONT_STACK}`
  ctx.fillText(text.main, left, base)
  if (text.sup) {
    ctx.font = `700 ${supSize}px ${FONT_STACK}`
    ctx.fillText(text.sup, left + mainW + size * 0.03, supBase)
  }
  ctx.restore()
}

/** Текстура атласа (null без DOM или без 2D-контекста). */
export function stageSymbolAtlasTexture(): THREE.Texture | null {
  if (!atlas) atlas = createAtlas()
  return atlas?.texture ?? null
}

/**
 * Клетки атласа для набора подписей (вызывается при смене раскладки, НЕ в кадре).
 * Новые подписи дорисовываются; если атлас полон — он перерисовывается только
 * под текущий набор. Возвращает индексы клеток в порядке `texts` (−1 без атласа).
 */
export function ensureStageSymbolCells(texts: readonly AtomSymbolText[], out: Int32Array | number[]): void {
  if (!atlas) atlas = createAtlas()
  const a = atlas
  if (!a) {
    for (let i = 0; i < texts.length; i++) out[i] = -1
    return
  }
  const capacity = SYMBOL_ATLAS_COLS * SYMBOL_ATLAS_COLS
  let fresh = 0
  const seen = new Set<string>()
  for (const t of texts) {
    if (!a.cells.has(t.key) && !seen.has(t.key)) fresh += 1
    seen.add(t.key)
  }
  let dirty = false
  if (a.cells.size + fresh > capacity) {
    a.cells.clear()
    a.ctx.fillStyle = '#000'
    a.ctx.fillRect(0, 0, ATLAS_PX, ATLAS_PX)
    dirty = true
  }
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!
    let cell = a.cells.get(t.key)
    if (cell == null) {
      cell = a.cells.size
      if (cell >= capacity) {
        out[i] = -1
        continue
      }
      a.cells.set(t.key, cell)
      drawCell(a, cell, t)
      dirty = true
    }
    out[i] = cell
  }
  if (dirty) a.texture.needsUpdate = true
}
