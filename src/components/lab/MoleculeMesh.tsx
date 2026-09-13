import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { CATALOG_BALL_STICK_RADIUS_SCALE, heroAtomStyle, heroBondStyle, organicHeroAtomStyle, organicHeroBondStyle } from '../../chemistry/catalogHeroAppearance'
import { getElementBySymbol } from '../../data/elements'
import type { CompoundDef } from '../../types/chemistry'
import type { Vec3 } from '../../types/chemistry'
import { buildBondStickSegments } from './preview/bondOffset'
import {
  getAtomCpkMaterial,
  getBondStickMaterial,
  getSharedSphereGeometry,
  getUnitBondCylinderGeometry,
} from './preview/previewSharedResources'

function cpkColor(symbol: string): string {
  const e = getElementBySymbol(symbol)
  return e ? '#' + e.cpkHex : '#8899aa'
}

function atomDegrees(atomsLen: number, bonds: readonly (readonly [number, number])[]): number[] {
  const d = new Array<number>(atomsLen).fill(0)
  for (const [i, j] of bonds) {
    if (i >= 0 && i < atomsLen) d[i]++
    if (j >= 0 && j < atomsLen) d[j]++
  }
  return d
}

type BondTransform = {
  position: [number, number, number]
  quaternion: THREE.Quaternion
  /** Длина связи (без нижнего порога). */
  length: number
}

const BOND_UP = new THREE.Vector3(0, 1, 0)
const bondDirScratch = new THREE.Vector3()

/** Поза единичного цилиндра (ось Y) между двумя точками — без временных Vector3. */
function computeBondTransform(from: Vec3, to: Vec3): BondTransform {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const length = Math.hypot(dx, dy, dz)
  const quaternion = new THREE.Quaternion()
  if (length > 1e-9) {
    quaternion.setFromUnitVectors(BOND_UP, bondDirScratch.set(dx / length, dy / length, dz / length))
  }
  return {
    position: [(from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5, (from[2] + to[2]) * 0.5],
    quaternion,
    length,
  }
}

/**
 * Стержень связи. Геометрия — общий единичный цилиндр (длина через scale.y),
 * материал — из кэша по цвету: N связей не создают N геометрий и N материалов.
 * Материал общий — не мутировать его снаружи.
 */
export function BondCylinder({
  from,
  to,
  color,
  visualPreset = 'default',
}: {
  from: Vec3
  to: Vec3
  color: string
  visualPreset?: 'default' | 'catalogHero'
}) {
  const hero = visualPreset === 'catalogHero'
  const pose = useMemo(() => {
    const t = computeBondTransform(from, to)
    return { ...t, scale: [1, Math.max(0.08, t.length), 1] as [number, number, number] }
  }, [from, to])
  const geometry = getUnitBondCylinderGeometry(hero ? 0.048 : 0.06, hero ? 10 : 8)
  const material = getBondStickMaterial(color, hero)

  return (
    <mesh
      position={pose.position}
      quaternion={pose.quaternion}
      scale={pose.scale}
      geometry={geometry}
      material={material}
    />
  )
}

type PlasmaBondGeom = {
  position: [number, number, number]
  quaternion: THREE.Quaternion
  coreScale: [number, number, number]
  haloScale: [number, number, number]
}

type PlasmaMaterials = { core: THREE.MeshStandardMaterial; halo: THREE.MeshStandardMaterial }

function createPlasmaMaterials(core: string, halo: string): PlasmaMaterials {
  return {
    core: new THREE.MeshStandardMaterial({
      color: core,
      emissive: core,
      emissiveIntensity: 1.05,
      metalness: 0.48,
      roughness: 0.28,
    }),
    halo: new THREE.MeshStandardMaterial({
      color: halo,
      emissive: halo,
      emissiveIntensity: 0.62,
      metalness: 0.35,
      roughness: 0.4,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  }
}

/** Пульс плазмы: все связи молекулы пульсировали синхронно — достаточно двух общих материалов. */
function pulsePlasmaMaterials(mats: PlasmaMaterials, t: number): void {
  const ei1 = 0.78 + Math.sin(t * 3.1) * 0.22
  const ei2 = 0.65 + Math.sin(t * 2.2 + 0.7) * 0.2
  mats.core.emissiveIntensity = 1.05 * ei1
  mats.halo.emissiveIntensity = 0.62 * ei2
}

/**
 * Все плазменные связи молекулы рендерятся в одном компоненте с одним useFrame.
 * Два материала на группу (ядро + ореол) и общие единичные цилиндры вместо
 * пары геометрий и пары материалов на каждую связь.
 */
function BondPlasmaGroup({
  bonds,
  atoms,
  core,
  halo,
}: {
  bonds: readonly (readonly [number, number])[]
  atoms: CompoundDef['atoms']
  core: string
  halo: string
}) {
  const geoms = useMemo<PlasmaBondGeom[]>(() => {
    const out: PlasmaBondGeom[] = []
    for (const [i, j] of bonds) {
      const ai = atoms[i]
      const aj = atoms[j]
      if (!ai || !aj) continue
      const t = computeBondTransform(ai.pos, aj.pos)
      const len = Math.max(0.08, t.length)
      out.push({
        position: t.position,
        quaternion: t.quaternion,
        coreScale: [1, len, 1],
        haloScale: [1, len * 1.04, 1],
      })
    }
    return out
  }, [bonds, atoms])

  const mats = useMemo(() => createPlasmaMaterials(core, halo), [core, halo])
  useEffect(
    () => () => {
      mats.core.dispose()
      mats.halo.dispose()
    },
    [mats],
  )
  const coreGeo = getUnitBondCylinderGeometry(0.024, 8)
  const haloGeo = getUnitBondCylinderGeometry(0.044, 6)

  useFrame((s) => {
    pulsePlasmaMaterials(mats, s.clock.elapsedTime)
  })

  return (
    <>
      {geoms.map((bd, k) => (
        <group key={k} position={bd.position} quaternion={bd.quaternion}>
          <mesh scale={bd.coreScale} geometry={coreGeo} material={mats.core} />
          <mesh scale={bd.haloScale} geometry={haloGeo} material={mats.halo} />
        </group>
      ))}
    </>
  )
}

/**
 * Символ в центре шара (каталог и лабо): troika + Billboard, depthTest off — и для стекла, и для CPK.
 */
function AtomInSphereLabel({ symbol, r }: { symbol: string; r: number }) {
  const fontSize = r * (symbol.length <= 1 ? 0.88 : 0.64)
  const outline = Math.max(fontSize * 0.14, 0.012)
  return (
    <Billboard follow>
      <Text
        position={[0, 0, r * 0.42]}
        fontSize={fontSize}
        fontWeight={800}
        color="#ffffff"
        fillOpacity={1}
        outlineWidth={outline}
        outlineColor="#020617"
        outlineOpacity={0.92}
        anchorX="center"
        anchorY="middle"
        depthOffset={-0.02}
        letterSpacing={symbol.length > 1 ? -0.04 * fontSize : 0}
        renderOrder={12}
        onSync={(m) => {
          m.renderOrder = 12
          const mat = m.material
          const apply = (n: { depthWrite: boolean; depthTest: boolean; transparent: boolean; needsUpdate: boolean }) => {
            n.depthWrite = false
            n.depthTest = false
            n.transparent = true
            n.needsUpdate = true
          }
          if (Array.isArray(mat)) {
            for (const n of mat) apply(n)
          } else {
            apply(mat)
          }
        }}
      >
        {symbol}
      </Text>
    </Billboard>
  )
}

export function MoleculeMesh({
  compound,
  scale,
  accentBoost = 1,
  visualPreset = 'default',
  renderQuality = 'high',
  showLabels,
  displayMode = 'ballStick',
}: {
  compound: CompoundDef
  scale: number
  accentBoost?: number
  visualPreset?: 'default' | 'catalogHero' | 'organicHero'
  /** 'synthesis' = быстрый режим (без troika Text, меньше poly/эффектов) */
  renderQuality?: 'high' | 'synthesis'
  /** По умолчанию буквы на атомах всегда включены (и в synthesis, и при fxLevel=off). */
  showLabels?: boolean
  /** ballStick — стержни; spaceFill — ван-дер-ваальсовы сферы без стержней */
  displayMode?: 'ballStick' | 'spaceFill'
}) {
  const hero = visualPreset === 'catalogHero' || visualPreset === 'organicHero'
  const organicHero = visualPreset === 'organicHero'
  const quality = renderQuality
  const labels = showLabels !== false
  const spaceFill = displayMode === 'spaceFill'

  const degrees = useMemo(
    () => atomDegrees(compound.atoms.length, compound.bonds),
    [compound.atoms.length, compound.bonds],
  )
  const maxDegree = useMemo(() => (degrees.length ? Math.max(...degrees) : 0), [degrees])

  const bondPlasma = useMemo(
    () => (organicHero ? organicHeroBondStyle(compound.accentColor) : heroBondStyle(compound.category)),
    [compound.category, compound.accentColor, organicHero],
  )
  const usePlasma = hero && quality !== 'synthesis' && !spaceFill && !organicHero
  /** Органика: параллельные стержни CPK вместо плазмы — видны кратные связи. */
  const useOrganicSticks = organicHero && !spaceFill

  /**
   * Стержни с уже смещёнными концами (кратные связи — ⟂ связи, в плоскости соседа).
   * Концы — стабильные массивы из useMemo: BondCylinder не пересчитывает позу на каждый ре-рендер.
   */
  const bondDrawList = useMemo(
    () => buildBondStickSegments(compound.atoms, compound.bonds),
    [compound.atoms, compound.bonds],
  )

  return (
    <group scale={scale}>
      {compound.atoms.map((a, i) => {
        const st = hero
          ? organicHero
            ? organicHeroAtomStyle(a.symbol, { degree: degrees[i] ?? 0, maxDegree })
            : heroAtomStyle(a.symbol, compound.category, { degree: degrees[i] ?? 0, maxDegree })
          : null
        const baseR = hero && st ? st.radius * CATALOG_BALL_STICK_RADIUS_SCALE : 0.32
        const r = spaceFill ? baseR * (a.symbol === 'H' ? 2.4 : 2.85) : baseR
        const sphereSegW = hero ? (quality === 'synthesis' ? 16 : 36) : 18
        const sphereSegH = hero ? (quality === 'synthesis' ? 14 : 32) : 18
        return (
          <group key={i} position={[a.pos[0], a.pos[1], a.pos[2]]}>
            {hero && st ? (
              <mesh key="hero">
                <sphereGeometry args={[r, sphereSegW, sphereSegH]} />
                <meshPhysicalMaterial
                  color={st.baseColor}
                  emissive={st.emissive}
                  emissiveIntensity={st.emissiveIntensity * accentBoost}
                  metalness={st.metalness}
                  roughness={quality === 'synthesis' ? Math.max(0.28, st.roughness) : st.roughness}
                  clearcoat={quality === 'synthesis' ? 0.55 : st.clearcoat}
                  clearcoatRoughness={st.clearcoatRoughness}
                  /** Синтез: непрозрачные сферы — иначе сквозь стекло видны sparkles как «атомы внутри». */
                  transmission={quality === 'synthesis' ? 0 : st.transmission}
                  thickness={quality === 'synthesis' ? 0 : st.thickness}
                  transparent={quality === 'synthesis' ? false : true}
                  opacity={quality === 'synthesis' ? 1 : spaceFill ? Math.min(0.92, st.opacity) : st.opacity}
                  envMapIntensity={st.envMapIntensity}
                />
              </mesh>
            ) : (
              // CPK-сфера: общая геометрия + материал из кэша по цвету (не по атому).
              <mesh
                key="cpk"
                geometry={getSharedSphereGeometry(r, 18, 18)}
                material={getAtomCpkMaterial(cpkColor(a.symbol), 0.22 * accentBoost, spaceFill)}
              />
            )}
            {labels && !spaceFill ? <AtomInSphereLabel symbol={a.symbol} r={r} /> : null}
          </group>
        )
      })}
      {!spaceFill && usePlasma ? (
        <BondPlasmaGroup
          bonds={compound.bonds}
          atoms={compound.atoms}
          core={bondPlasma.core}
          halo={bondPlasma.halo}
        />
      ) : null}
      {!spaceFill && (useOrganicSticks || (!usePlasma && !organicHero))
        ? bondDrawList.map((b, k) => (
            <BondCylinder
              key={k}
              from={b.from}
              to={b.to}
              color={organicHero ? bondPlasma.core : compound.accentColor}
              visualPreset={organicHero ? 'catalogHero' : visualPreset === 'catalogHero' ? 'catalogHero' : 'default'}
            />
          ))
        : null}
    </group>
  )
}
