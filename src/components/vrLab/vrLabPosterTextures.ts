import { useMemo } from 'react'
import * as THREE from 'three'

/** pH-шкала Bromothymol Blue (как на LabXchange). */
export function usePhScaleTexture() {
  return useMemo(() => {
    const w = 512
    const h = 320
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(8, 8, w - 16, h - 16)

    const colors = [
      '#f5e642', '#e8e84a', '#c8e050', '#98d858', '#68c860',
      '#48b868', '#38a878', '#3898a0', '#3890c0', '#4070d0',
      '#5058c8', '#5850b8', '#6848a8',
    ]
    const phs = [2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12]
    const startX = 40
    const endX = w - 40
    const cy = h / 2 - 10
    colors.forEach((c, i) => {
      const x = startX + (i / (colors.length - 1)) * (endX - startX)
      ctx.beginPath()
      ctx.arc(x, cy, 18, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
      ctx.strokeStyle = '#888'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#222'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(phs[i]), x, cy + 38)
    })

    ctx.fillStyle = '#222'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Ideal pH range for BTB', w / 2, h - 28)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

export function useExperimentPosterTexture() {
  return useMemo(() => {
    const w = 256
    const h = 180
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#ccc'
    ctx.strokeRect(4, 4, w - 8, h - 8)
    ctx.fillStyle = '#333'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Experimental setup', w / 2, 18)
    for (let i = 0; i < 4; i++) {
      const x = 35 + i * 55
      ctx.fillStyle = '#d0e8ff'
      ctx.fillRect(x - 8, 40, 16, 50)
      ctx.fillStyle = i % 2 === 0 ? '#3a8a50' : '#2a6a40'
      ctx.fillRect(x - 6, 55, 12, 25)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}
