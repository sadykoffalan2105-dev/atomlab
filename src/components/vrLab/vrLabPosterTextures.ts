import { useMemo } from 'react'
import * as THREE from 'three'
import { getCachedCanvasTexture } from './vrLabTextureCache'
import { createCyberPeriodicTableTexture } from './vrLabCyberPeriodicTexture'
import { VR_THEME } from './vrLabTheme'

function createWaveformHoloTexture(): THREE.CanvasTexture {
  const w = 256
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = VR_THEME.holoBg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(34,211,238,0.06)'
  ctx.lineWidth = 1
  for (let i = 0; i < w; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, h)
    ctx.stroke()
  }

  ctx.strokeStyle = VR_THEME.cyan
  ctx.lineWidth = 3
  ctx.shadowColor = VR_THEME.cyan
  ctx.shadowBlur = 12
  ctx.beginPath()
  for (let x = 0; x < w; x += 4) {
    const y = h / 2 + Math.sin(x * 0.035) * 70 + Math.sin(x * 0.08) * 25
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.strokeStyle = VR_THEME.magenta
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.65
  ctx.beginPath()
  for (let x = 0; x < w; x += 4) {
    const y = h / 2 + Math.cos(x * 0.028) * 55
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createDnaHoloTexture(): THREE.CanvasTexture {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = VR_THEME.holoBg
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = 'rgba(34,211,238,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i < w; i += 28) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(w, i)
    ctx.stroke()
  }

  const cx = w / 2
  ctx.lineWidth = 3
  for (let y = 30; y < h - 30; y += 6) {
    const phase = y * 0.04
    const x1 = cx + Math.sin(phase) * 55
    const x2 = cx + Math.sin(phase + Math.PI) * 55
    ctx.strokeStyle = VR_THEME.cyan
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x1, y + 6)
    ctx.stroke()
    ctx.strokeStyle = VR_THEME.magenta
    ctx.beginPath()
    ctx.moveTo(x2, y)
    ctx.lineTo(x2, y + 6)
    ctx.stroke()
    if (y % 24 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
      ctx.lineWidth = 3
    }
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = VR_THEME.cyan
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'left'
  for (let i = 0; i < 6; i++) {
    ctx.fillText(`ATCG-${1000 + i * 137}`, 24, 40 + i * 22)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createMoleculeHoloTexture(): THREE.CanvasTexture {
  const w = 320
  const h = 240
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = VR_THEME.holoBg
  ctx.fillRect(0, 0, w, h)

  const nodes = [
    [160, 80], [110, 130], [210, 130], [85, 180], [135, 180], [185, 180], [235, 180],
  ]
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 5]]

  ctx.strokeStyle = VR_THEME.purpleBright
  ctx.lineWidth = 2
  for (const [a, b] of edges) {
    ctx.beginPath()
    ctx.moveTo(nodes[a][0], nodes[a][1])
    ctx.lineTo(nodes[b][0], nodes[b][1])
    ctx.stroke()
  }
  for (const [x, y] of nodes) {
    ctx.fillStyle = VR_THEME.cyan
    ctx.beginPath()
    ctx.arc(x, y, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  ctx.fillStyle = VR_THEME.purpleBright
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('C₆H₆', w / 2, 28)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function usePeriodicTablePosterTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-poster-periodic-v3', createCyberPeriodicTableTexture), [])
}

export function useWaveformHoloTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-poster-wave', createWaveformHoloTexture), [])
}

export function useDnaHoloTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-poster-dna', createDnaHoloTexture), [])
}

export function useMoleculeHoloTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-poster-molecule', createMoleculeHoloTexture), [])
}

export function useExperimentPosterTexture() {
  return useMemo(() => createMoleculeHoloTexture(), [])
}
