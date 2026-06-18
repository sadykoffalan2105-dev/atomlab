import { useMemo } from 'react'
import * as THREE from 'three'

/** Процедурная текстура столешницы (ламинат лаборатории). */
export function useBenchTopTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grd = ctx.createLinearGradient(0, 0, size, size)
    grd.addColorStop(0, '#8a939f')
    grd.addColorStop(0.5, '#9aa3ae')
    grd.addColorStop(1, '#7a848f')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.025})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 6, 1)
    }
    for (let i = 0; i < 8; i++) {
      const y = (i / 8) * size
      ctx.strokeStyle = 'rgba(0,0,0,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(3, 1.2)
    tex.anisotropy = 8
    return tex
  }, [])
}

export function useLabWallTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#e8ecef'
    ctx.fillRect(0, 0, size, size)
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        const n = Math.random() * 8
        ctx.fillStyle = `rgb(${232 - n}, ${236 - n}, ${239 - n})`
        ctx.fillRect(x, y, 4, 4)
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 2)
    return tex
  }, [])
}
