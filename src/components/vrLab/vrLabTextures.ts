import { useMemo } from 'react'
import * as THREE from 'three'
import { VR_THEME } from './vrLabTheme'

/** Тёмная металлическая столешница с фиолетовым градиентом. */
export function useBenchTopTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grd = ctx.createLinearGradient(0, 0, size, size)
    grd.addColorStop(0, '#2a2240')
    grd.addColorStop(0.5, '#3d3258')
    grd.addColorStop(1, '#221a38')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(168,85,247,${0.02 + Math.random() * 0.04})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1)
    }
    for (let i = 0; i < 6; i++) {
      const y = (i / 6) * size
      ctx.strokeStyle = 'rgba(34,211,238,0.06)'
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
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/** Фиолетовые металлические панели стен с «заклёпками». */
export function useLabWallTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const panelH = size / 4
    for (let row = 0; row < 4; row++) {
      const shade = row % 2 === 0 ? '#4a3a6a' : '#3d2f5c'
      ctx.fillStyle = shade
      ctx.fillRect(0, row * panelH, size, panelH)
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, row * panelH)
      ctx.lineTo(size, row * panelH)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(168,85,247,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, row * panelH + panelH - 1)
      ctx.lineTo(size, row * panelH + panelH - 1)
      ctx.stroke()
      for (let col = 0; col < 5; col++) {
        const rx = 40 + col * 100
        const ry = row * panelH + panelH / 2
        ctx.fillStyle = '#2a2040'
        ctx.beginPath()
        ctx.arc(rx, ry, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(139,156,184,0.5)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 1.5)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/** Гекс-сетка для голографических экранов. */
export function useHoloGridTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = VR_THEME.holoBg
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(34,211,238,0.12)'
    ctx.lineWidth = 1
    const step = 24
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}
