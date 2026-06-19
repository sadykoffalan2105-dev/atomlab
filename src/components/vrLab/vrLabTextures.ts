import { useMemo } from 'react'
import * as THREE from 'three'
import { getCachedCanvasTexture } from './vrLabTextureCache'

function createCarbonWeaveTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#14121c'
  ctx.fillRect(0, 0, size, size)

  const cell = 16
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const even = ((x / cell + y / cell) & 1) === 0
      ctx.fillStyle = even ? '#1c1a28' : '#121018'
      ctx.fillRect(x, y, cell, cell)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y + cell * 0.5)
      ctx.lineTo(x + cell, y + cell * 0.5)
      ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 2.2)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createCarbonNormalTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = Math.sin((x / size) * Math.PI * 32) * 0.5 + 0.5
      const wy = Math.cos((y / size) * Math.PI * 32) * 0.5 + 0.5
      const weave = wx * wy
      const nx = 128 + weave * 18
      const ny = 128 + (1 - weave) * 18
      const i = (y * size + x) * 4
      img.data[i] = nx
      img.data[i + 1] = ny
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 2.2)
  return tex
}

function createBenchTopTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grd = ctx.createLinearGradient(0, 0, size, size)
  grd.addColorStop(0, '#1a1828')
  grd.addColorStop(0.45, '#222030')
  grd.addColorStop(1, '#141220')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.008 + Math.random() * 0.012})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 0.5)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 1.4)
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
  return useMemo(() => getCachedCanvasTexture('vr-bench-v3-carbon', createBenchTopTexture), [])
}

export function useBenchCarbonWeave() {
  return useMemo(() => getCachedCanvasTexture('vr-bench-weave-v1', createCarbonWeaveTexture), [])
}

export function useBenchCarbonNormal() {
  return useMemo(() => getCachedCanvasTexture('vr-bench-normal-v1', createCarbonNormalTexture), [])
}

export function useLabWallTexture() {
  return useMemo(() => getCachedCanvasTexture('vr-wall-v2', createLabWallTexture), [])
}
