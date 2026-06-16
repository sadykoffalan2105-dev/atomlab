import * as THREE from 'three'

/** Мягкая круглая текстура «клуба дыма» — без квадратных пикселей. */
export function createSmokePuffTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const r = size / 2

  ctx.clearRect(0, 0, size, size)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)')
  grad.addColorStop(0.78, 'rgba(255,255,255,0.05)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Более размытая текстура для крупных слоёв облака. */
export function createSmokeWispTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2

  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < 3; i++) {
    const ox = (Math.sin(i * 2.1) * size) / 14
    const oy = (Math.cos(i * 1.7) * size) / 14
    const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, size * (0.38 - i * 0.06))
    grad.addColorStop(0, `rgba(255,255,255,${0.35 - i * 0.08})`)
    grad.addColorStop(0.45, `rgba(255,255,255,${0.12 - i * 0.03})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
