/**
 * Общие материалы сцены: один экземпляр на сцену (меньше программ шейдеров и переключений состояния).
 * Стекло (tuneLabGlass) и жидкость (labLiquid) — здесь же: параметры поверх фабрик labContract, контракт не меняется.
 */
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { LAB_COLORS, labGlassMaterial } from '../labContract'
import { benchTopTexture, noiseTexture } from './labTextures'

/**
 * Лабораторное стекло (боросиликат): на ПК — пропускание с лёгким голубоватым поглощением в толще, двойной блик
 * (clearcoat), отражение окна; на слабых — полупрозрачное (контур даёт sharedGlassEdge). Меняет переданный экземпляр.
 */
export function tuneLabGlass(m: THREE.MeshPhysicalMaterial, quality: 'low' | 'high'): THREE.MeshPhysicalMaterial {
  if (quality === 'high') {
    m.roughness = 0.02
    m.thickness = 0.0025
    m.ior = 1.5
    m.attenuationColor.set('#f2fbff')
    m.attenuationDistance = 0.6
    m.specularIntensity = 1
    m.envMapIntensity = 1.2
    m.clearcoat = 1
    m.clearcoatRoughness = 0.02
  } else {
    m.opacity = 0.22
  }
  return m
}

/**
 * Жидкость (аналог labLiquidMaterial): БЕЗ transmission — внутри стекла с transmission такая жидкость пропала бы
 * (three не рисует прозрачно-пропускающие объекты в буфер пропускания). Вода n = 1,33; блик поверхности — clearcoat.
 * vertexColors — для градиента «гуще ко дну» и светлой поверхности (цвет вершин умножает основной цвет).
 * Непрозрачность по веществу: вода 0,5, кислоты 0,55, CuSO₄ 0,85, раствор с осадком 0,9.
 */
export function labLiquid(color: THREE.ColorRepresentation, opacity = 0.6, vertexColors = false): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.03,
    metalness: 0,
    ior: 1.33,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.9,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexColors,
  })
}

/**
 * Цвет вершин для жидкости: низ темнее на 12 %, верхняя крышка (поверхность) светлее на 5 %.
 * Цилиндр высотой 1 (−0,5…0,5) — как в TestTube; у полусферы дна — весь низ тёмный.
 */
export function shadeLiquidGeometry(g: THREE.BufferGeometry, kind: 'column' | 'bottom' | 'flat'): THREE.BufferGeometry {
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    let k = 1
    if (kind === 'bottom') k = 0.88
    else if (kind === 'column') {
      const top = nor && nor.getY(i) > 0.9
      k = top ? 1.05 : 0.9 + 0.1 * (pos.getY(i) + 0.5)
    }
    col[i * 3] = k
    col[i * 3 + 1] = k
    col[i * 3 + 2] = k
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

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
    const high = quality === 'high'
    // Шероховатость столешницы 0,28…0,42 (следы протирки), рельеф стен — едва заметная штукатурка
    const benchRough = noiseTexture(31, 0.28, 0.42, 256, 30, 2600)
    benchRough.repeat.set(3, 1.1)
    const wallBump = high ? noiseTexture(47, 0.2, 0.8, 256, 60, 5000) : null
    wallBump?.repeat.set(4, 4)
    const hoodGlass = labGlassMaterial('low')
    hoodGlass.opacity = 0.14
    hoodGlass.color.set('#dfefff')
    return {
      wall: new THREE.MeshStandardMaterial({ color: LAB_COLORS.wall, roughness: 0.92, bumpMap: wallBump, bumpScale: 0.0015 }),
      wallAccent: new THREE.MeshStandardMaterial({ color: '#d8e4ef', roughness: 0.85 }),
      benchTop: new THREE.MeshPhysicalMaterial({
        color: LAB_COLORS.benchTop,
        map: benchTopTexture(),
        roughness: 1,
        roughnessMap: benchRough,
        clearcoat: high ? 0.6 : 0.4,
        clearcoatRoughness: 0.15,
      }),
      benchBody: new THREE.MeshStandardMaterial({ color: LAB_COLORS.benchBody, roughness: 0.55 }),
      plinth: new THREE.MeshStandardMaterial({ color: '#7d8794', roughness: 0.7 }),
      handle: new THREE.MeshStandardMaterial({ color: '#6f7a87', roughness: 0.3, metalness: 0.8 }),
      door: new THREE.MeshStandardMaterial({ color: '#cddbe9', roughness: 0.5 }),
      metal: new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.35, metalness: 0.75 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#e7ebf0', roughness: 0.12, metalness: 1, envMapIntensity: 1.3 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c3c9d0', roughness: 0.28, metalness: 0.9, envMapIntensity: 1.3 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: '#4a525c', roughness: 0.45, metalness: 0.6 }),
      wood: new THREE.MeshStandardMaterial({ color: LAB_COLORS.wood, roughness: 0.7 }),
      whitePlastic: new THREE.MeshStandardMaterial({ color: '#f7f8fa', roughness: 0.45 }),
      blackPlastic: new THREE.MeshStandardMaterial({ color: '#23272e', roughness: 0.5 }),
      porcelain: new THREE.MeshPhysicalMaterial({ color: '#fbfbf9', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2, sheenColor: '#ffffff' }),
      glass: tuneLabGlass(labGlassMaterial(quality), quality),
      amberGlass: amber,
      hoodGlass,
      water: labLiquid('#cfe9ff', 0.5),
      blueLiquid: labLiquid('#3d8fe0', 0.85),
      pinkLiquid: labLiquid('#e05a9a', 0.7),
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
      mats.benchTop.roughnessMap?.dispose()
      mats.wall.bumpMap?.dispose()
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
