import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { CATALOG_BALL_STICK_RADIUS_SCALE, heroAtomStyle, heroBondStyle } from '../../chemistry/catalogHeroAppearance'
import { getElementBySymbol } from '../../data/elements'
import type { CompoundDef } from '../../types/chemistry'
import type { Vec3 } from '../../types/chemistry'

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

function BondCylinder({
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
  const { mid, len, quat } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = a.distanceTo(b)
    const dir = b.clone().sub(a).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    return { mid, len, quat }
  }, [from, to])

  const hero = visualPreset === 'catalogHero'
  const r = hero ? 0.048 : 0.06
  const seg = hero ? 10 : 8

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[r, r, Math.max(0.08, len), seg, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hero ? 0.72 : 0.25}
        metalness={hero ? 0.55 : 0.3}
        roughness={hero ? 0.22 : 0.35}
      />
    </mesh>
  )
}

type PlasmaBondGeom = { mid: THREE.Vector3; len: number; quat: THREE.Quaternion }

/**
 * Все плазменные связи молекулы рендерятся в одном компоненте с одним useFrame.
 * Это значительно снижает overhead по сравнению с отдельным useFrame на каждую связь.
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
      const a = new THREE.Vector3(...ai.pos)
      const b = new THREE.Vector3(...aj.pos)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const len = Math.max(0.08, a.distanceTo(b))
      const dir = b.clone().sub(a).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      out.push({ mid, len, quat })
    }
    return out
  }, [bonds, atoms])

  const coreMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const haloMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([])

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const ei1 = 0.78 + Math.sin(t * 3.1) * 0.22
    const ei2 = 0.65 + Math.sin(t * 2.2 + 0.7) * 0.2
    for (const m of coreMatsRef.current) if (m) m.emissiveIntensity = 1.05 * ei1
    for (const m of haloMatsRef.current) if (m) m.emissiveIntensity = 0.62 * ei2
  })

  return (
    <>
      {geoms.map((bd, k) => (
        <group key={k} position={bd.mid} quaternion={bd.quat}>
          <mesh>
            <cylinderGeometry args={[0.024, 0.024, bd.len, 8, 1]} />
            <meshStandardMaterial
              ref={(el) => { coreMatsRef.current[k] = el }}
              color={core}
              emissive={core}
              emissiveIntensity={1.05}
              metalness={0.48}
              roughness={0.28}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.044, 0.044, bd.len * 1.04, 6, 1]} />
            <meshStandardMaterial
              ref={(el) => { haloMatsRef.current[k] = el }}
              color={halo}
              emissive={halo}
              emissiveIntensity={0.62}
              metalness={0.35}
              roughness={0.4}
              transparent
              opacity={0.38}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

/**
 * Символ в центре шара (каталог и лабо): troika + Billboard, depthTest off — и для стекла, и для CPK.
 */
function AtomInSphereLabel({ symbol, r }: { symbol: string; r: number }) {
  const fontSize = r * (symbol.length <= 1 ? 0.66 : 0.5)
  const outline = fontSize * 0.07
  return (
    <Billboard follow>
      <Text
        position={[0, 0, 0]}
        fontSize={fontSize}
        fontWeight={700}
        color="#ffffff"
        fillOpacity={0.99}
        outlineWidth={outline}
        outlineColor="#0f172a"
        outlineOpacity={0.75}
        anchorX="center"
        anchorY="middle"
        depthOffset={0.04}
        letterSpacing={symbol.length > 1 ? -0.03 * fontSize : 0}
        renderOrder={2}
        onSync={(m) => {
          m.renderOrder = 2
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
}: {
  compound: CompoundDef
  scale: number
  accentBoost?: number
  visualPreset?: 'default' | 'catalogHero'
  /** 'synthesis' = быстрый режим (без troika Text, меньше poly/эффектов) */
  renderQuality?: 'high' | 'synthesis'
  /** По умолчанию true, но в synthesis лучше отключать */
  showLabels?: boolean
}) {
  const hero = visualPreset === 'catalogHero'
  const quality = renderQuality
  const labels = showLabels ?? quality !== 'synthesis'

  const degrees = useMemo(
    () => atomDegrees(compound.atoms.length, compound.bonds),
    [compound.atoms.length, compound.bonds],
  )
  const maxDegree = useMemo(() => (degrees.length ? Math.max(...degrees) : 0), [degrees])

  const bondPlasma = useMemo(() => heroBondStyle(compound.category), [compound.category])
  const usePlasma = hero && quality !== 'synthesis'

  return (
    <group scale={scale}>
      {compound.atoms.map((a, i) => {
        const st = hero
          ? heroAtomStyle(a.symbol, compound.category, { degree: degrees[i] ?? 0, maxDegree })
          : null
        const r = hero && st ? st.radius * CATALOG_BALL_STICK_RADIUS_SCALE : 0.32
        const sphereSegW = hero ? (quality === 'synthesis' ? 16 : 36) : 18
        const sphereSegH = hero ? (quality === 'synthesis' ? 14 : 32) : 18
        return (
          <group key={i} position={[a.pos[0], a.pos[1], a.pos[2]]}>
            <mesh>
              {hero ? (
                <sphereGeometry args={[r, sphereSegW, sphereSegH]} />
              ) : (
                <sphereGeometry args={[0.32, 18, 18]} />
              )}
              {hero && st ? (
                <meshPhysicalMaterial
                  color={st.baseColor}
                  emissive={st.emissive}
                  emissiveIntensity={st.emissiveIntensity * accentBoost}
                  metalness={st.metalness}
                  roughness={st.roughness}
                  clearcoat={st.clearcoat}
                  clearcoatRoughness={st.clearcoatRoughness}
                  transmission={st.transmission}
                  thickness={st.thickness}
                  transparent
                  opacity={st.opacity}
                  envMapIntensity={st.envMapIntensity}
                />
              ) : (
                <meshStandardMaterial
                  color={cpkColor(a.symbol)}
                  emissive={cpkColor(a.symbol)}
                  emissiveIntensity={0.22 * accentBoost}
                  metalness={0.2}
                  roughness={0.38}
                />
              )}
            </mesh>
            {labels ? <AtomInSphereLabel symbol={a.symbol} r={r} /> : null}
          </group>
        )
      })}
      {usePlasma ? (
        <BondPlasmaGroup
          bonds={compound.bonds}
          atoms={compound.atoms}
          core={bondPlasma.core}
          halo={bondPlasma.halo}
        />
      ) : (
        compound.bonds.map(([i, j], k) => {
          const ai = compound.atoms[i]
          const aj = compound.atoms[j]
          if (!ai || !aj) return null
          return (
            <BondCylinder
              key={k}
              from={ai.pos}
              to={aj.pos}
              color={compound.accentColor}
              visualPreset={visualPreset}
            />
          )
        })
      )}
    </group>
  )
}
