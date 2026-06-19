import { useMemo } from 'react'
import * as THREE from 'three'
import { getCachedCanvasTexture } from './vrLabTextureCache'

function createBenchTopTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grd = ctx.createLinearGradient(0, 0, size, size)
  grd.addColorStop(0, '#7a7490')
  grd.addColorStop(0.5, '#8a849c')
  grd.addColorStop(1, '#6e6884')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 1.2)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createLabWallTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const panelH = size / 4
  for (let row = 0; row < 4; row++) {
    ctx.fillStyle = row % 2 === 0 ? '#a89cc8' : '#9a8eb8'
    ctx.fillRect(0, row * panelH, size, panelH)
    ctx.strokeStyle = 'rgba(60,50,90,0.12)'
    ctx.strokeRect(0, row * panelH, size, panelH)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 1.5)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function useBenchTopTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-bench-v2', createBenchTopTexture), [])
}

export function useLabWallTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-wall-v2', createLabWallTexture), [])
}
