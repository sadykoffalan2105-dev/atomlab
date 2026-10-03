/**
 * Общие материалы сцены: один экземпляр на сцену (меньше программ шейдеров и переключений состояния).
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LAB_COLORS, labGlassMaterial, labLiquidMaterial } from '../labContract'
import { benchTopTexture } from './labTextures'

export interface LabMaterials {
  wall: THREE.MeshStandardMaterial
  wallAccent: THREE.MeshStandardMaterial
  benchTop: THREE.MeshPhysicalMaterial
  benchBody: THREE.MeshStandardMaterial
  plinth: THREE.MeshStandardMaterial
  handle: THREE.MeshStandardMaterial
  door: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  chrome: THREE.MeshStandardMaterial
  steel: THREE.MeshStandardMaterial
  darkMetal: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  whitePlastic: THREE.MeshStandardMaterial
  blackPlastic: THREE.MeshStandardMaterial
  porcelain: THREE.MeshPhysicalMaterial
  glass: THREE.MeshPhysicalMaterial
  amberGlass: THREE.MeshPhysicalMaterial
  hoodGlass: THREE.MeshPhysicalMaterial
  water: THREE.MeshPhysicalMaterial
  blueLiquid: THREE.MeshPhysicalMaterial
  pinkLiquid: THREE.MeshPhysicalMaterial
  rubberBlue: THREE.MeshStandardMaterial
  red: THREE.MeshStandardMaterial
  green: THREE.MeshStandardMaterial
  emissivePanel: THREE.MeshBasicMaterial
  hoodLight: THREE.MeshBasicMaterial
  screenBlack: THREE.MeshStandardMaterial
}

export function useLabMaterials(quality: 'low' | 'high'): LabMaterials {
  const mats = useMemo<LabMaterials>(() => {
    const amber = labGlassMaterial(quality)
    amber.color.set('#8a4b12')
    amber.opacity = quality === 'high' ? 1 : 0.78
    amber.transmission = quality === 'high' ? 0.6 : 0
    amber.attenuationColor = new THREE.Color('#5b2d06')
    amber.attenuationDistance = 0.05
    const hoodGlass = labGlassMaterial('low')
    hoodGlass.opacity = 0.14
    hoodGlass.color.set('#dfefff')
    return {
      wall: new THREE.MeshStandardMaterial({ color: LAB_COLORS.wall, roughness: 0.92 }),
      wallAccent: new THREE.MeshStandardMaterial({ color: '#d8e4ef', roughness: 0.85 }),
      benchTop: new THREE.MeshPhysicalMaterial({
        color: LAB_COLORS.benchTop,
        map: benchTopTexture(),
        roughness: 0.34,
        clearcoat: quality === 'high' ? 0.6 : 0.4,
        clearcoatRoughness: 0.18,
      }),
      benchBody: new THREE.MeshStandardMaterial({ color: LAB_COLORS.benchBody, roughness: 0.55 }),
      plinth: new THREE.MeshStandardMaterial({ color: '#7d8794', roughness: 0.7 }),
      handle: new THREE.MeshStandardMaterial({ color: '#6f7a87', roughness: 0.3, metalness: 0.8 }),
      door: new THREE.MeshStandardMaterial({ color: '#cddbe9', roughness: 0.5 }),
      metal: new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.35, metalness: 0.75 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e7ebf0', roughness: 0.12, metalness: 1 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c3c9d0', roughness: 0.28, metalness: 0.9 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: '#4a525c', roughness: 0.45, metalness: 0.6 }),
      wood: new THREE.MeshStandardMaterial({ color: LAB_COLORS.wood, roughness: 0.7 }),
      whitePlastic: new THREE.MeshStandardMaterial({ color: '#f7f8fa', roughness: 0.45 }),
      blackPlastic: new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.5 }),
      porcelain: new THREE.MeshPhysicalMaterial({ color: '#fbfbf9', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
      glass: labGlassMaterial(quality),
      amberGlass: amber,
      hoodGlass,
      water: labLiquidMaterial('#cfe9ff', 0.45),
      blueLiquid: labLiquidMaterial('#3d8fe0', 0.75),
      pinkLiquid: labLiquidMaterial('#e05a9a', 0.7),
      rubberBlue: new THREE.MeshStandardMaterial({ color: '#4c8de8', roughness: 0.65 }),
      red: new THREE.MeshStandardMaterial({ color: '#d93a2e', roughness: 0.35, metalness: 0.15 }),
      green: new THREE.MeshStandardMaterial({ color: '#2f9e5b', roughness: 0.5 }),
      emissivePanel: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6), toneMapped: false }),
      hoodLight: new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4f9ff').multiplyScalar(1.3), toneMapped: false }),
      screenBlack: new THREE.MeshStandardMaterial({ color: '#0d1117', roughness: 0.2, metalness: 0.1 }),
    }
  }, [quality])
  useEffect(
    () => () => {
      mats.benchTop.map?.dispose()
      Object.values(mats).forEach((m) => m.dispose())
    },
    [mats],
  )
  return mats
}

/** Профиль сосуда для LatheGeometry: пары [радиус, высота] снизу вверх. */
export function lathe(profile: ReadonlyArray<readonly [number, number]>, segments = 32): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  )
}
