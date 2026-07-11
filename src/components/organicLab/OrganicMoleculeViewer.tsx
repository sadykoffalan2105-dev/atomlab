import { Suspense, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { MoleculeMesh } from '../lab/MoleculeMesh'
import { CatalogCanvasResizeSync } from '../lab/CatalogCanvasResizeSync'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { organicGraphToCompoundDef } from '../../chemistry/organic/organicToCompound'
import { hybridizationOf } from '../../chemistry/organic/organicLayout'
import { isWebGLAvailable } from '../../utils/webgl'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import type { OrganicDisplayMode, OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import styles from './OrganicMoleculeViewer.module.css'

function midOfAtoms(
  graph: OrganicMoleculeDef['graph'],
  ids: readonly string[],
): [number, number, number] {
  let x = 0
  let y = 0
  let z = 0
  let n = 0
  for (const id of ids) {
    const a = graph.atoms.find((t) => t.id === id)
    if (!a) continue
    x += a.pos[0]
    y += a.pos[1]
    z += a.pos[2]
    n += 1
  }
  if (!n) return [0, 0.5, 0]
  return [x / n, y / n + 0.35, z / n]
}

function FunctionalGroupOverlays({ mol }: { mol: OrganicMoleculeDef }) {
  const { locale } = useLocale()
  return (
    <group>
      {mol.functionalGroups.map((fg) => {
        const pos = midOfAtoms(mol.graph, fg.atomIds)
        const label =
          locale === 'en' ? fg.labelEn : locale === 'uz' ? fg.labelUz : fg.labelRu
        const anchor = mol.graph.atoms.find((a) => a.id === fg.atomIds[0])
        const lineEnd: [number, number, number] = anchor
          ? [anchor.pos[0], anchor.pos[1], anchor.pos[2]]
          : pos
        const labelPos: [number, number, number] = [pos[0] - 1.6, pos[1] + 0.8, pos[2]]
        return (
          <group key={fg.id}>
            <Line
              points={[labelPos, lineEnd]}
              color="#94a3b8"
              lineWidth={1}
              transparent
              opacity={0.55}
            />
            <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
              <div className={styles.fgBadge}>
                <strong>{fg.label}</strong>
                <span>{label}</span>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function HybridCenters({ mol }: { mol: OrganicMoleculeDef }) {
  return (
    <group>
      {mol.graph.atoms
        .filter((a) => a.element !== 'H')
        .map((a) => {
          const hyb = hybridizationOf(mol.graph, a.id)
          if (hyb === 'terminal') return null
          return (
            <Html
              key={a.id}
              position={[a.pos[0], a.pos[1] + 0.55, a.pos[2]]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <span className={styles.hybTag}>{hyb}</span>
            </Html>
          )
        })}
    </group>
  )
}

function Skeleton2D({ mol }: { mol: OrganicMoleculeDef }) {
  const heavies = mol.graph.atoms.filter((a) => a.element !== 'H')
  const index = new Map(heavies.map((a, i) => [a.id, i]))
  const xs = heavies.map((a) => a.pos[0])
  const zs = heavies.map((a) => a.pos[2])
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 1)
  const minZ = Math.min(...zs, 0)
  const maxZ = Math.max(...zs, 1)
  const w = 280
  const h = 180
  const pad = 24
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (w - pad * 2)
  const sy = (z: number) => pad + ((z - minZ) / (maxZ - minZ || 1)) * (h - pad * 2)

  const edges = mol.graph.bonds.filter((b) => {
    const A = mol.graph.atoms.find((x) => x.id === b.a)
    const B = mol.graph.atoms.find((x) => x.id === b.b)
    return A && B && A.element !== 'H' && B.element !== 'H'
  })

  return (
    <svg className={styles.skeletonSvg} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {edges.map((b) => {
        const ia = index.get(b.a)
        const ib = index.get(b.b)
        if (ia == null || ib == null) return null
        const a = heavies[ia]!
        const c = heavies[ib]!
        const stroke = b.order >= 2 ? '#67e8f9' : '#94a3b8'
        return (
          <line
            key={b.id}
            x1={sx(a.pos[0])}
            y1={sy(a.pos[2])}
            x2={sx(c.pos[0])}
            y2={sy(c.pos[2])}
            stroke={stroke}
            strokeWidth={b.order >= 3 ? 3.5 : b.order === 2 ? 2.8 : 2}
          />
        )
      })}
      {heavies.map((a) => (
        <g key={a.id}>
          <circle cx={sx(a.pos[0])} cy={sy(a.pos[2])} r={10} fill="#0f172a" stroke="#e2e8f0" />
          <text x={sx(a.pos[0])} y={sy(a.pos[2]) + 4} textAnchor="middle" fill="#e2e8f0" fontSize="11">
            {a.element}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Scene({
  mol,
  mode,
}: {
  mol: OrganicMoleculeDef
  mode: OrganicDisplayMode
}) {
  const compound = useMemo(
    () => organicGraphToCompoundDef(mol.graph, mol.id, mol.accentColor),
    [mol],
  )
  const n = mol.graph.atoms.length
  const scale = n <= 8 ? 1.15 : n <= 16 ? 0.9 : n <= 28 ? 0.72 : 0.55

  return (
    <>
      <CatalogCanvasResizeSync touchDpr={false} />
      <color attach="background" args={['#070b14']} />
      <fog attach="fog" args={['#070b14', 12, 28]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 7, 4]} intensity={1.05} color="#e8eeff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} color={mol.accentColor} />
      <gridHelper args={[18, 18, '#1e3a5f', '#122033']} position={[0, -2.4, 0]} />

      {mode !== 'skeleton2d' ? (
        <group>
          <MoleculeMesh
            compound={compound}
            scale={scale}
            renderQuality="high"
            visualPreset="organicHero"
            showLabels
            displayMode={mode === 'spaceFill' ? 'spaceFill' : 'ballStick'}
          />
          {mode === 'ballStick' || mode === 'hybridization' ? (
            <group scale={scale}>
              <FunctionalGroupOverlays mol={mol} />
              {mode === 'hybridization' ? <HybridCenters mol={mol} /> : null}
            </group>
          ) : null}
        </group>
      ) : null}

      <OrbitControls makeDefault enableDamping dampingFactor={0.07} minDistance={2.5} maxDistance={18} />
    </>
  )
}

export function OrganicMoleculeViewer({
  mol,
  mode,
  children,
  fillParent = false,
}: {
  mol: OrganicMoleculeDef
  mode: OrganicDisplayMode
  children?: ReactNode
  /** Заполнить родителя без рамки (лабораторный порт). */
  fillParent?: boolean
}) {
  const { t } = useT()
  const webglOk = isWebGLAvailable()
  const stageClass = fillParent ? `${styles.stage} ${styles.stageFill}` : styles.stage

  if (!webglOk) {
    return (
      <div className={stageClass}>
        <div className={styles.fallback}>{t('catalog.webglUnavailable')}</div>
        {children}
      </div>
    )
  }

  return (
    <div className={stageClass}>
      <div className={styles.canvasHost}>
        {mode === 'skeleton2d' ? (
          <div className={styles.skeletonWrap}>
            <Skeleton2D mol={mol} />
          </div>
        ) : (
          <CanvasErrorBoundary
            resetKey={mol.id + mode}
            fallback={<CanvasSceneErrorFallback />}
          >
            <Canvas
              className={styles.canvas}
              camera={{ position: [0, 2.4, 9], fov: 40 }}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
              dpr={[1, 1.35]}
              frameloop="demand"
            >
              <Suspense fallback={null}>
                <Scene mol={mol} mode={mode} />
              </Suspense>
            </Canvas>
          </CanvasErrorBoundary>
        )}
      </div>
      {children}
    </div>
  )
}
