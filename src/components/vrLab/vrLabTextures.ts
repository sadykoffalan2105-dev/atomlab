import { useMemo } from 'react'
import * as THREE from 'three'
import { getCachedCanvasTexture } from './vrLabTextureCache'
import { VR_THEME } from './vrLabTheme'

function createBenchTopTexture(): THREE.CanvasTexture {
  const size = 256
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
    ctx.fillStyle = row % 2 === 0 ? '#4a3a6a' : '#3d2f5c'
    ctx.fillRect(0, row * panelH, size, panelH)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 1.5)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function useBenchTopTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-bench', createBenchTopTexture), [])
}

export function useLabWallTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-wall', createLabWallTexture), [])
}

export function useHoloGridTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = VR_THEME.holoBg
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}
