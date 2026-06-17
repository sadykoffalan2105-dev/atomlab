import { Suspense, useLayoutEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { LearnElementVisual } from '../learn/LearnCatalogVisual'
import { AtomCosmicBloom } from './atom/AtomCosmicBloom'
import { ELEMENT_ATOM_PREVIEW_VIEW } from './labOrbitConstants'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { bohrShellCountsFromConfig } from '../../data/elementConfigDisplay'
import { isWebGLAvailable } from '../../utils/webgl'
import { ElementShellDiagram } from './ElementShellDiagram'
import styles from './ElementAtomPreview3d.module.css'

type Props = {
  z: number
  fullConfig: string
  cpkHex: string
  symbol: string
}

function ShellCaption({ shells }: { shells: number[] }) {
  return (
    <figcaption className={styles.caption}>
      {shells.map((c, i) => (
        <span key={i} className={styles.chip}>
          K{i + 1}: {c}
        </span>
      ))}
    </figcaption>
  )
}

function CanvasSizeBootstrap() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const ran = useRef(false)

  useLayoutEffect(() => {
    const canvas = gl.domElement
    const parent = canvas.parentElement
    if (!parent || ran.current) return
    const w = Math.max(2, parent.clientWidth)
    const h = Math.max(2, parent.clientHeight)
    if (w > 2 && h > 2 && (size.width < 3 || size.height < 3)) {
      gl.setSize(w, h, false)
      ran.current = true
    }
  }, [gl, size.width, size.height])

  return null
}

function ElementAtomScene({ z, cpkHex }: { z: number; cpkHex: string }) {
  const view = ELEMENT_ATOM_PREVIEW_VIEW
  const accent = cpkHex.startsWith('#') ? cpkHex : `#${cpkHex}`
  return (
    <>
      <color attach="background" args={['#03040a']} />
      <fog attach="fog" args={['#03040a', 4, 12]} />
      <Stars radius={80} depth={40} count={600} factor={2.5} saturation={0} fade speed={0.2} />
      <ambientLight intensity={0.12} />
      <pointLight position={[1.2, 1, 2]} intensity={0.4} distance={10} color={accent} />
      <group scale={view.modelScale}>
        <LearnElementVisual z={z} autoRotate cpkHex={accent} />
      </group>
      <AtomCosmicBloom intensity={0.58} luminanceThreshold={0.62} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={view.minDistance}
        maxDistance={view.maxDistance}
        minPolarAngle={view.minPolarAngle}
        maxPolarAngle={view.maxPolarAngle}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  )
}

export function ElementAtomPreview3d({ z, fullConfig, cpkHex, symbol }: Props) {
  const shells = bohrShellCountsFromConfig(fullConfig)
  if (shells.length === 0) return null

  const fallback = (
    <ElementShellDiagram fullConfig={fullConfig} cpkHex={cpkHex} symbol={symbol} z={z} />
  )

  if (!isWebGLAvailable()) {
    return fallback
  }

  const resetKey = `${symbol}-${z}`

  return (
    <figure className={styles.wrap} aria-label={symbol}>
      <div className={styles.canvasHost}>
        <CanvasErrorBoundary resetKey={resetKey} fallback={fallback}>
          <Canvas
            key={resetKey}
            className={styles.canvas}
            camera={{
              position: ELEMENT_ATOM_PREVIEW_VIEW.cameraPosition,
              fov: ELEMENT_ATOM_PREVIEW_VIEW.fov,
            }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              stencil: false,
            }}
            dpr={[1, 1.5]}
            frameloop="always"
            resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
            onCreated={({ gl }) => {
              const parent = gl.domElement.parentElement
              if (!parent) return
              const w = Math.max(2, parent.clientWidth)
              const h = Math.max(2, parent.clientHeight)
              if (w > 2 && h > 2) gl.setSize(w, h, false)
            }}
          >
            <Suspense fallback={null}>
              <CanvasSizeBootstrap />
              <ElementAtomScene z={z} cpkHex={cpkHex} />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      </div>
      <ShellCaption shells={shells} />
    </figure>
  )
}
