import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, OrbitControls, Sparkles } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { hash32 } from '../../chemistry/placeholderMolecule'
import { compoundById } from '../../data/compounds'
import type { CompoundCategory, CompoundDef } from '../../types/chemistry'
import { MoleculeMesh } from './MoleculeMesh'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { isWebGLAvailable } from '../../utils/webgl'
import { CATALOG_HERO_DEFAULT_LAB_SCALE, catalogMoleculeFitScale, categoryAccentRgb, rgbToHex } from './catalogMoleculeHeroShared'
import { CATALOG_HERO_VIEW } from './labOrbitConstants'

/** Полупрозрачная «капсула» вокруг молекулы в цвете вещества + тонкие кольца. */
export function SubstanceAuraBubble({
  accentColor,
  compoundId,
}: {
  accentColor: string
  compoundId: string
}) {
  const col = useMemo(() => new THREE.Color(accentColor), [accentColor])
  const emissive = useMemo(() => new THREE.Color(accentColor).multiplyScalar(0.45), [accentColor])
  const gShell = useRef<THREE.Group>(null)
  const gRings = useRef<THREE.Group>(null)
  const phase = hash32(`${compoundId}_aura`) * 0.02

  useFrame((s) => {
    const t = s.clock.elapsedTime + phase
    if (gShell.current) {
      gShell.current.rotation.y = t * 0.06
      gShell.current.rotation.x = Math.sin(t * 0.11) * 0.04
    }
    if (gRings.current) {
      gRings.current.rotation.y = t * 0.11
      gRings.current.rotation.z = Math.sin(t * 0.09) * 0.06
    }
  })

  const shellHex = `#${col.getHexString()}`
  const emHex = `#${emissive.getHexString()}`

  return (
    <group position={[0, 0.02, 0]} renderOrder={-3}>
      <group ref={gShell}>
        <mesh scale={1.24}>
          <sphereGeometry args={[1, 40, 32]} />
          <meshPhysicalMaterial
            color={shellHex}
            emissive={emHex}
            emissiveIntensity={0.28}
            transmission={0.88}
            thickness={0.55}
            roughness={0.22}
            metalness={0.06}
            transparent
            opacity={0.14}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.06}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshPhysicalMaterial
            color={shellHex}
            emissive={emHex}
            emissiveIntensity={0.15}
            transmission={0.92}
            thickness={0.4}
            roughness={0.28}
            metalness={0.04}
            transparent
            opacity={0.07}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={gRings}>
        <mesh rotation={[Math.PI / 2.35, 0.4, 0.2]}>
          <ringGeometry args={[0.88, 1.02, 64]} />
          <meshBasicMaterial
            color={shellHex}
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh rotation={[0.35, Math.PI / 2.1, 0.5]}>
          <ringGeometry args={[0.9, 1.04, 64]} />
          <meshBasicMaterial
            color={shellHex}
            transparent
            opacity={0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Звёздное поле в духе лаборатории: тёмный фон + мелкие точки, с лёгким оттенком акцента вещества. */
export function CosmicStarfield({
  compoundId,
  accentColor,
  category,
  pointCount = 260,
}: {
  compoundId: string
  accentColor: string
  category: CompoundCategory
  /** Меньше — дешевле (лаборатория / синтез) */
  pointCount?: number
}) {
  const ref = useRef<THREE.Points>(null)
  const count = Math.max(32, Math.min(400, pointCount | 0))
  const geom = useMemo(() => {
    const baseSeed = hash32(`${compoundId}_stars`)
    const u01 = (x: number) => ((x >>> 0) / 0x100000000)
    const mix = (x: number) => {
      let v = x >>> 0
      v ^= v >>> 16
      v = Math.imul(v, 0x7feb352d)
      v ^= v >>> 15
      v = Math.imul(v, 0x846ca68b)
      v ^= v >>> 16
      return v >>> 0
    }
    const r01 = (i: number, k: number) => u01(mix(baseSeed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)))
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const acc = new THREE.Color(accentColor)
    const [cr, cg, cb] = categoryAccentRgb(category)
    const waterBlue = compoundId === 'h2o'
    for (let i = 0; i < count; i++) {
      const bx = (r01(i, 0) - 0.5) * 7.2
      const by = (r01(i, 1) - 0.5) * 4.2
      const bz = (r01(i, 2) - 0.5) * 4.8 - 0.6 * r01(i, 3)
      pos[i * 3] = bx
      pos[i * 3 + 1] = by
      pos[i * 3 + 2] = bz
      const useAcc = r01(i, 4) < 0.28
      if (useAcc) {
        col[i * 3] = acc.r * (0.55 + r01(i, 5) * 0.9)
        col[i * 3 + 1] = acc.g * (0.55 + r01(i, 6) * 0.9)
        col[i * 3 + 2] = acc.b * (0.55 + r01(i, 7) * 0.9)
      } else {
        const tw = 0.65 + r01(i, 8) * 0.55
        if (waterBlue) {
          col[i * 3] = (0.42 + r01(i, 9) * 0.35) * tw
          col[i * 3 + 1] = (0.62 + r01(i, 10) * 0.28) * tw
          col[i * 3 + 2] = (0.92 + r01(i, 11) * 0.08) * tw
        } else {
          col[i * 3] = (cr * 0.25 + 0.55) * tw
          col[i * 3 + 1] = (cg * 0.25 + 0.62) * tw
          col[i * 3 + 2] = (cb * 0.35 + 0.75) * tw
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [compoundId, accentColor, category, count])

  useEffect(() => () => geom.dispose(), [geom])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = ref.current
    if (!p) return
    p.rotation.y = t * 0.018 + hash32(compoundId) * 1e-4
    p.rotation.x = Math.sin(t * 0.07) * 0.02
  })

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.028}
        vertexColors
        transparent
        opacity={0.72}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

/** Post-processing как в мини-Canvas карточки каталога — к «космическому» блеску. */
export function CatalogStyleBloom() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.16} mipmapBlur intensity={0.72} radius={0.38} levels={7} />
    </EffectComposer>
  )
}

export function HeroMoleculeRig({
  compound,
  labScaleBoost = CATALOG_HERO_DEFAULT_LAB_SCALE,
  renderQuality = 'high',
  fxLevel = 'full',
}: {
  compound: CompoundDef
  /** >1 — крупнее молекула в лаборатории относительно героя каталога */
  labScaleBoost?: number
  renderQuality?: 'high' | 'synthesis'
  /** Для внешних обёрток: можно отключить тяжёлые эффекты при синтезе */
  fxLevel?: 'off' | 'low' | 'full'
}) {
  const ref = useRef<THREE.Group>(null)
  const fit = useMemo(() => catalogMoleculeFitScale(compound.atoms), [compound.atoms])
  const baseScale = 0.78 * labScaleBoost

  useFrame((s) => {
    const g = ref.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.rotation.y = t * 0.013
    g.rotation.x = Math.sin(t * 0.29) * 0.038
    g.rotation.z = Math.sin(t * 0.21 + 0.9) * 0.032
    g.position.y = Math.sin(t * 0.47) * 0.042
  })

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <MoleculeMesh
        compound={compound}
        scale={baseScale * fit}
        accentBoost={1.42}
        visualPreset="catalogHero"
        renderQuality={renderQuality}
        showLabels={fxLevel !== 'off'}
      />
    </group>
  )
}

function CatalogHeroScene({ compoundId, compound }: { compoundId: string; compound: CompoundDef }) {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_scene',
        location: 'CatalogMoleculeHero.tsx:CatalogHeroScene',
        message: 'CatalogHeroScene render',
        data: { compoundId, atomsLen: compound.atoms.length, bondsLen: compound.bonds.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [compoundId, compound.atoms.length, compound.bonds.length])

  const [sr, sg, sb] = categoryAccentRgb(compound.category)
  const sparkleHex = compound.accentColor
  const secondaryHex = useMemo(() => rgbToHex(sr * 0.5 + 0.2, sg * 0.5 + 0.15, sb * 0.55 + 0.25), [sr, sg, sb])

  return (
    <>
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={0.4} />
      </Suspense>
      <ambientLight intensity={0.42} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={0.85} color="#e8eeff" />
      <directionalLight position={[-3.5, 1.5, -2]} intensity={0.35} color={sparkleHex} />
      <pointLight position={[0.2, 0.9, 2.2]} intensity={0.75} color={secondaryHex} distance={8} />
      <CosmicStarfield compoundId={compoundId} accentColor={compound.accentColor} category={compound.category} />
      <SubstanceAuraBubble accentColor={compound.accentColor} compoundId={compoundId} />
      <Sparkles count={96} scale={5.5} size={1.85} speed={0.36} opacity={0.55} color={sparkleHex} position={[0, 0.06, 0]} />
      <Sparkles count={48} scale={4} size={1.25} speed={0.44} opacity={0.35} color="#cfefff" position={[0.1, -0.02, -0.15]} />
      <HeroMoleculeRig compound={compound} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI * 0.38}
        maxPolarAngle={Math.PI * 0.62}
      />
    </>
  )
}

function SuspenseFallbackLog({ compoundId }: { compoundId: string }) {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_suspense',
        location: 'CatalogMoleculeHero.tsx:SuspenseFallbackLog',
        message: 'Suspense fallback active',
        data: { compoundId },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [compoundId])
  return null
}

export function CatalogMoleculeHero({ compoundId }: { compoundId: string }) {
  const c = compoundById[compoundId]
  const webglOk = isWebGLAvailable()

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_branch',
        location: 'CatalogMoleculeHero.tsx:CatalogMoleculeHero',
        message: 'hero render branch',
        data: { compoundId, found: !!c, webglOk },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [compoundId, webglOk, c])
  // #endregion

  useEffect(() => {
    if (!c || !webglOk) return
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
      body: JSON.stringify({
        sessionId: 'a62735',
        runId: 'pre-fix',
        hypothesisId: 'H_hero',
        location: 'CatalogMoleculeHero.tsx:CatalogMoleculeHero',
        message: 'CatalogMoleculeHero render',
        data: { compoundId, category: c.category, atomsLen: c.atoms.length, bondsLen: c.bonds.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [compoundId, webglOk, c])

  if (!c) return null
  if (!webglOk) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 12,
          borderRadius: 12,
          color: 'rgba(220,228,255,0.92)',
          background: 'rgba(8,10,26,0.92)',
          border: '1px solid rgba(61,255,236,0.22)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        WebGL недоступен — 3D‑модель не может быть показана. Проверьте аппаратное ускорение в настройках
        браузера.
      </div>
    )
  }

  return (
    <CanvasErrorBoundary>
      <Canvas
        camera={{ position: CATALOG_HERO_VIEW.cameraPosition, fov: CATALOG_HERO_VIEW.fov }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.75]}
        onCreated={(state) => {
          // #region agent log
          fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
            body: JSON.stringify({
              sessionId: 'a62735',
              runId: 'pre-fix',
              hypothesisId: 'H_canvas',
              location: 'CatalogMoleculeHero.tsx:Canvas.onCreated',
              message: 'Canvas created',
              data: {
                compoundId,
                size: state.size,
                dpr: state.viewport?.dpr ?? null,
                gl: { isWebGL2: state.gl.capabilities.isWebGL2 },
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
          // #endregion

          // #region agent log
          const onLost = () => {
            fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
              body: JSON.stringify({
                sessionId: 'a62735',
                runId: 'pre-fix',
                hypothesisId: 'H_context',
                location: 'CatalogMoleculeHero.tsx:Canvas.onCreated',
                message: 'webglcontextlost',
                data: { compoundId },
                timestamp: Date.now(),
              }),
            }).catch(() => {})
          }
          const onRestored = () => {
            fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a62735' },
              body: JSON.stringify({
                sessionId: 'a62735',
                runId: 'pre-fix',
                hypothesisId: 'H_context',
                location: 'CatalogMoleculeHero.tsx:Canvas.onCreated',
                message: 'webglcontextrestored',
                data: { compoundId },
                timestamp: Date.now(),
              }),
            }).catch(() => {})
          }
          state.gl.domElement.addEventListener('webglcontextlost', onLost)
          state.gl.domElement.addEventListener('webglcontextrestored', onRestored)
          // #endregion
        }}
      >
        <color attach="background" args={['#0a0c18']} />
        <fog attach="fog" args={['#0a0c18', 6.5, 16]} />
        <Suspense fallback={<SuspenseFallbackLog compoundId={compoundId} />}>
          <CatalogHeroScene compoundId={compoundId} compound={c} />
        </Suspense>
      </Canvas>
    </CanvasErrorBoundary>
  )
}
