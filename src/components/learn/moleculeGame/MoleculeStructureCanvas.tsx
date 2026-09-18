import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { CompoundDef } from '../../../types/chemistry'
import { CatalogSubstanceDisplay } from '../../lab/CatalogSubstanceDisplay'
import { HeroMoleculeRig, SubstanceAuraBubble } from '../../lab/CatalogMoleculeHero'
import { CatalogCanvasResizeSync } from '../../lab/CatalogCanvasResizeSync'
import { CATALOG_HERO_VIEW } from '../../lab/labOrbitConstants'
import { CanvasErrorBoundary } from '../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../common/CanvasSceneErrorFallback'
import { isWebGLAvailable } from '../../../utils/webgl'
import { useT } from '../../../i18n/useT'
import styles from './MoleculeStructureCanvas.module.css'

type Props = {
  compound: CompoundDef
  quizMode?: boolean
  compact?: boolean
  /** Автовращение сцены (учебный режим). */
  autoRotate?: boolean
  /** Любое изменение значения возвращает камеру в исходный ракурс. */
  resetToken?: number
  /** Первое взаимодействие пользователя с орбитой (чтобы спрятать подсказку). */
  onInteract?: () => void
  /** Встроенная подсказка «тяните — вращение»; родитель может рисовать свою. */
  showHint?: boolean
}

/** Учебный режим: разрешаем небольшой зум колёсиком / щипком вокруг базового радиуса. */
const LEARN_MIN_DISTANCE = CATALOG_HERO_VIEW.minDistance * 0.72
const LEARN_MAX_DISTANCE = CATALOG_HERO_VIEW.maxDistance * 1.45

/** Надёжный resize: R3F иногда стартует с 0×0 внутри flex/fullscreen. */
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

type OrbitLike = {
  target: { set: (x: number, y: number, z: number) => unknown }
  update: () => unknown
}

/** Возврат камеры к исходному ракурсу при смене resetToken (первый рендер пропускаем). */
function ViewReset({ token }: { token: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitLike | null
  const seen = useRef(token)

  useEffect(() => {
    if (seen.current === token) return
    seen.current = token
    const [x, y, z] = CATALOG_HERO_VIEW.cameraPosition
    camera.position.set(x, y, z)
    const [tx, ty, tz] = CATALOG_HERO_VIEW.target
    if (controls) {
      controls.target.set(tx, ty, tz)
      controls.update()
    } else {
      camera.lookAt(tx, ty, tz)
    }
  }, [camera, controls, token])

  return null
}

/** Лёгкая сцена для викторины — без звёзд/sparkles, стабильнее в fullscreen. */
function MoleculeQuizScene({
  compound,
  compact,
}: {
  compound: CompoundDef
  compact: boolean
}) {
  const accent = compound.accentColor ?? '#5cffd4'

  return (
    <>
      <CatalogCanvasResizeSync touchDpr={false} />
      <CanvasSizeBootstrap />
      <color attach="background" args={['#0a0c18']} />
      <fog attach="fog" args={['#0a0c18', 7, 17]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3.2, 5.5, 3.5]} intensity={0.92} color="#e8eeff" />
      <directionalLight position={[-2.5, 2, -3]} intensity={0.32} color={accent} />
      <pointLight position={[0, 0.6, 2.2]} intensity={0.5} color={accent} distance={10} />
      <SubstanceAuraBubble accentColor={compound.accentColor} compoundId={compound.id} />
      <HeroMoleculeRig
        compound={compound}
        labScaleBoost={compact ? 0.96 : 1}
        renderQuality="high"
        fxLevel="low"
      />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        target={CATALOG_HERO_VIEW.target}
        minDistance={CATALOG_HERO_VIEW.minDistance}
        maxDistance={CATALOG_HERO_VIEW.maxDistance}
        minPolarAngle={CATALOG_HERO_VIEW.minPolarAngle}
        maxPolarAngle={CATALOG_HERO_VIEW.maxPolarAngle}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  )
}

function MoleculeLearnScene({
  compound,
  compact,
  autoRotate,
  resetToken,
  onInteract,
}: {
  compound: CompoundDef
  compact: boolean
  autoRotate: boolean
  resetToken: number
  onInteract?: () => void
}) {
  return (
    <>
      <CatalogCanvasResizeSync touchDpr={false} />
      <CanvasSizeBootstrap />
      <color attach="background" args={['#0a0c18']} />
      <fog attach="fog" args={['#0a0c18', 6.5, 16]} />
      <CatalogSubstanceDisplay
        compound={compound}
        labScaleBoost={compact ? 0.96 : 1}
        reducedEffects
        fxLevel="full"
        renderQuality="high"
      />
      <OrbitControls
        makeDefault
        enableZoom
        zoomSpeed={0.6}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
        target={CATALOG_HERO_VIEW.target}
        minDistance={LEARN_MIN_DISTANCE}
        maxDistance={LEARN_MAX_DISTANCE}
        minPolarAngle={CATALOG_HERO_VIEW.minPolarAngle}
        maxPolarAngle={CATALOG_HERO_VIEW.maxPolarAngle}
        enableDamping
        dampingFactor={0.06}
        onStart={onInteract}
      />
      <ViewReset token={resetToken} />
    </>
  )
}

export function MoleculeStructureCanvas({
  compound,
  quizMode = false,
  compact = false,
  autoRotate = false,
  resetToken = 0,
  onInteract,
  showHint = true,
}: Props) {
  const { t } = useT()
  const webglOk = isWebGLAvailable()
  const resetKey = useMemo(
    () => `${compound.id}-${quizMode ? 'q' : 'l'}-${compact ? 'c' : 'n'}`,
    [compound.id, quizMode, compact],
  )

  if (!webglOk) {
    return (
      <div className={styles.fallback} role="status">
        {t('catalog.webglUnavailable')}
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.canvasHost}>
        <CanvasErrorBoundary resetKey={resetKey} fallback={<CanvasSceneErrorFallback />}>
          <Canvas
            key={resetKey}
            className={styles.canvas}
            camera={{ position: CATALOG_HERO_VIEW.cameraPosition, fov: CATALOG_HERO_VIEW.fov }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              stencil: false,
            }}
            dpr={[1, 1.75]}
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
              {quizMode ? (
                <MoleculeQuizScene compound={compound} compact={compact} />
              ) : (
                <MoleculeLearnScene
                  compound={compound}
                  compact={compact}
                  autoRotate={autoRotate}
                  resetToken={resetToken}
                  onInteract={onInteract}
                />
              )}
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      </div>
      {showHint ? (
        <p className={styles.hint}>
          <svg
            className={styles.hintIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            focusable="false"
          >
            <path d="M20 12a8 8 0 1 1-2.35-5.65M20 4v4.5h-4.5" />
          </svg>
          <span className={styles.hintText}>{t('learn.molecules.structure.rotateHint')}</span>
        </p>
      ) : null}
    </div>
  )
}
