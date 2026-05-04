import { useEffect, useMemo, useRef } from 'react'
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

function BondPlasma({
  from,
  to,
  core,
  halo,
}: {
  from: Vec3
  to: Vec3
  core: string
  halo: string
}) {
  const { mid, len, quat } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = Math.max(0.08, a.distanceTo(b))
    const dir = b.clone().sub(a).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    return { mid, len, quat }
  }, [from, to])

  const coreMat = useRef<THREE.MeshStandardMaterial>(null)
  const haloMat = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((s) => {
    const t = s.clock.elapsedTime
    const pulse = 0.78 + Math.sin(t * 3.1) * 0.22
    const pulse2 = 0.65 + Math.sin(t * 2.2 + 0.7) * 0.2
    if (coreMat.current) coreMat.current.emissiveIntensity = 1.05 * pulse
    if (haloMat.current) haloMat.current.emissiveIntensity = 0.62 * pulse2
  })

  return (
    <group position={mid} quaternion={quat}>
      <mesh>
        <cylinderGeometry args={[0.024, 0.024, len, 10, 1]} />
        <meshStandardMaterial
          ref={coreMat}
          color={core}
          emissive={core}
          emissiveIntensity={1.05}
          metalness={0.48}
          roughness={0.28}
        />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.044, 0.044, len * 1.04, 8, 1]} />
        <meshStandardMaterial
          ref={haloMat}
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

  // #region agent log
  const loggedRef = useRef<string | null>(null)
  useEffect(() => {
    if (loggedRef.current === compound.id) return
    loggedRef.current = compound.id
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c09a52' },
      body: JSON.stringify({
        sessionId: 'c09a52',
        runId: 'pre-fix',
        hypothesisId: 'H_render',
        location: 'MoleculeMesh.tsx:MoleculeMesh',
        message: 'render MoleculeMesh',
        data: { id: compound.id, category: compound.category, atomsLen: compound.atoms.length, bondsLen: compound.bonds.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compound.id, compound.category, compound.atoms.length, compound.bonds.length])
  // #endregion

  // #region agent log
  useEffect(() => {
    if (compound.id !== 'salt_na_no2') return
    const atoms = compound.atoms ?? []
    const bonds = compound.bonds ?? []
    const naIdx = atoms.findIndex((a) => a.symbol.toUpperCase() === 'NA')
    const naTouched = naIdx < 0 ? null : bonds.filter(([i, j]) => i === naIdx || j === naIdx).slice(0, 8)
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'na_no2_dbg',
        hypothesisId: 'H2_render_has_na_bonds',
        location: 'src/components/lab/MoleculeMesh.tsx:MoleculeMesh',
        message: 'render salt_na_no2 bonds summary',
        data: {
          atomsLen: atoms.length,
          bondsLen: bonds.length,
          naIdx,
          naTouched,
          firstSymbols: atoms.slice(0, 8).map((a) => a.symbol),
          firstBonds: bonds.slice(0, 10),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compound.id, compound.atoms, compound.bonds])
  // #endregion

  // #region agent log
  useEffect(() => {
    if (compound.id !== 'salt_k_no3') return
    const atoms = compound.atoms ?? []
    const bonds = compound.bonds ?? []
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'kno3_dbg',
        hypothesisId: 'H_kno3_render_input',
        location: 'src/components/lab/MoleculeMesh.tsx:MoleculeMesh',
        message: 'render salt_k_no3 atoms/bonds',
        data: {
          atomsLen: atoms.length,
          bondsLen: bonds.length,
          firstSymbols: atoms.slice(0, 8).map((a) => a.symbol),
          firstBonds: bonds.slice(0, 12),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compound.id, compound.atoms, compound.bonds])
  // #endregion

  const degrees = useMemo(
    () => atomDegrees(compound.atoms.length, compound.bonds),
    [compound.atoms.length, compound.bonds],
  )
  const maxDegree = useMemo(() => (degrees.length ? Math.max(...degrees) : 0), [degrees])

  const bondPlasma = useMemo(() => heroBondStyle(compound.category), [compound.category])

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
      {compound.bonds.map(([i, j], k) => {
        const ai = compound.atoms[i]
        const aj = compound.atoms[j]
        if (!ai || !aj) return null
        if (hero && quality !== 'synthesis') {
          return <BondPlasma key={k} from={ai.pos} to={aj.pos} core={bondPlasma.core} halo={bondPlasma.halo} />
        }
        return (
          <BondCylinder
            key={k}
            from={ai.pos}
            to={aj.pos}
            color={compound.accentColor}
            visualPreset={visualPreset}
          />
        )
      })}
    </group>
  )
}
