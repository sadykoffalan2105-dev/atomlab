import * as THREE from 'three'

/**
 * ATOMLAB Cinema — процедурные текстуры.
 *
 * Всё рисуется на canvas в рантайме: приложение работает офлайн (Electron),
 * поэтому никаких загрузок спрайтов из сети — иначе газ и искры молча пропадают.
 * Текстуры кэшируются на сессию и освобождаются одним вызовом при выгрузке 3D.
 */

type TextureKind = 'puff' | 'glow' | 'spark' | 'ring'

const cache = new Map<TextureKind, THREE.Texture>()

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('[cinema] 2D context unavailable')
  return { canvas, ctx }
}

function radial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: ReadonlyArray<readonly [number, string]>,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [offset, color] of stops) g.addColorStop(offset, color)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Клуб дыма / газа: рваная мягкая клякса, белая (цвет задаёт материал). */
function drawPuff(size: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  // Детерминированный шум: облако должно выглядеть одинаково при каждом запуске.
  let seed = 1337
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2
    const d = rnd() * c * 0.34
    const r = c * (0.34 + rnd() * 0.4)
    radial(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, r, [
      [0, `rgba(255,255,255,${0.1 + rnd() * 0.1})`],
      [0.55, 'rgba(255,255,255,0.035)'],
      [1, 'rgba(255,255,255,0)'],
    ])
  }
  // Общая огранка, чтобы края не были «квадратными» после сложения клякс.
  ctx.globalCompositeOperation = 'destination-in'
  radial(ctx, c, c, c, [
    [0, 'rgba(255,255,255,1)'],
    [0.62, 'rgba(255,255,255,0.85)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  return canvas
}

/** Чистое свечение — ядра, вспышки, электронные импульсы. */
function drawGlow(size: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  radial(ctx, c, c, c, [
    [0, 'rgba(255,255,255,1)'],
    [0.16, 'rgba(255,255,255,0.85)'],
    [0.42, 'rgba(255,255,255,0.24)'],
    [0.72, 'rgba(255,255,255,0.05)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  return canvas
}

/** Искра: горячее ядро + вытянутый хвост (для StretchedBillBoard). */
function drawSpark(size: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  radial(ctx, c, c, c * 0.42, [
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,255,255,0.5)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  const g = ctx.createLinearGradient(0, c, size, c)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = g
  ctx.fillRect(0, c - size * 0.035, size, size * 0.07)
  return canvas
}

/** Тонкое кольцо — световая волна образования связи. */
function drawRing(size: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size)
  const c = size / 2
  radial(ctx, c, c, c, [
    [0, 'rgba(255,255,255,0)'],
    [0.7, 'rgba(255,255,255,0)'],
    [0.86, 'rgba(255,255,255,0.9)'],
    [0.95, 'rgba(255,255,255,0.25)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  return canvas
}

export function cinemaTexture(kind: TextureKind): THREE.Texture {
  const hit = cache.get(kind)
  if (hit) return hit
  const canvas =
    kind === 'puff'
      ? drawPuff(128)
      : kind === 'glow'
        ? drawGlow(64)
        : kind === 'spark'
          ? drawSpark(64)
          : drawRing(128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  cache.set(kind, tex)
  return tex
}

/** Полная выгрузка — вызывать при закрытии 3D-лаборатории, не между прогонами. */
export function disposeCinemaTextures(): void {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
