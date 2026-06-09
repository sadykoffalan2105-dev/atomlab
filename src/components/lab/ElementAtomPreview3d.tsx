import { Suspense, useLayoutEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { LearnElementVisual } from '../learn/LearnCatalogVisual'
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

function ElementAtomScene({ z }: { z: number }) {
  const view = ELEMENT_ATOM_PREVIEW_VIEW
  return (
    <>
      <color attach="background" args={['#0a1628']} />
      <fog attach="fog" args={['#060a14', 3.5, 10]} />
      <group scale={view.modelScale}>
        <LearnElementVisual z={z} autoRotate />
      </group>
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
              <ElementAtomScene z={z} />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      </div>
      <ShellCaption shells={shells} />
    </figure>
  )
}
