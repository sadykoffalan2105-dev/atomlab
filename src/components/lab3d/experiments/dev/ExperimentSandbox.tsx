/**
 * ВРЕМЕННАЯ песочница опытов (маршрут #/lab3d-sandbox?exp=<id>&step=<n>): светлая подложка, стол, свет,
 * OrbitControls и доска сбоку. Нужна, пока в ветке нет сцены лаборатории; при слиянии маршрут можно убрать.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { BENCH_TOP_Y, BOARD_PX, LAB_COLORS, WORK_AREA_CENTER, WORK_AREA_SIZE, type LabExperimentId, type LabLang } from '../../labContract'
import { detectVrLabQuality } from '../../../vrLab/vrLabPerformance'
import { BoardPanel, ExperimentRig, getLabExperiment, isLabExperimentId } from '../index'

/** Кадр камеры под размер установки: [высота над столом, отступ по Z, высота цели]. */
const VIEW: Record<LabExperimentId, readonly [number, number, number]> = {
  baso4: [0.26, 0.44, 0.09],
  'ch4-burn': [0.42, 0.88, 0.12],
  'zn-hcl': [0.36, 0.82, 0.1],
  'h2-practical': [0.55, 1.2, 0.14],
}

export function ExperimentSandbox() {
  const [params, setParams] = useSearchParams()
  const expParam = params.get('exp')
  const experimentId: LabExperimentId = isLabExperimentId(expParam) ? expParam : 'baso4'
  const stepParam = Number(params.get('step') ?? 0)
  const [step, setStep] = useState(Number.isFinite(stepParam) ? stepParam : 0)
  // ?step= в адресе (кадры по шагам) — без перезагрузки страницы
  useEffect(() => {
    if (Number.isFinite(stepParam)) setStep(stepParam)
  }, [stepParam, experimentId])
  const lang = (['ru', 'en', 'uz'].includes(params.get('lang') ?? '') ? params.get('lang') : 'ru') as LabLang
  const quality = useMemo(() => (params.get('q') === 'low' || detectVrLabQuality() === 'low' ? 'low' : 'high') as 'low' | 'high', [params])
  const total = getLabExperiment(experimentId).steps.length
  const [vw, setVw] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))
  useEffect(() => {
    const on = () => setVw(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const narrow = vw < 900
  const boardScale = narrow ? (vw - 16) / BOARD_PX.w : Math.min(0.42, (vw * 0.4) / BOARD_PX.w)

  const select = (id: LabExperimentId) => {
    setStep(0)
    setParams({ exp: id }, { replace: true })
  }
  const goto = (s: number) => setStep(Math.max(0, Math.min(total, s)))

  return (
    <div style={{ position: 'fixed', inset: '64px 0 0 0', background: '#eef2f6', display: 'flex', flexDirection: narrow ? 'column' : 'row' }} data-lab3d-sandbox>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Canvas
          shadows={quality === 'high'}
          dpr={quality === 'high' ? [1, 1.75] : [1, 1.25]}
          key={experimentId}
          camera={{ position: [0, BENCH_TOP_Y + VIEW[experimentId][0], VIEW[experimentId][1]], fov: 42, near: 0.02, far: 20 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.05
          }}
        >
          <color attach="background" args={['#eef2f6']} />
          <hemisphereLight args={['#ffffff', '#d9dee5', 0.7]} />
          <directionalLight
            position={[1.2, 3, 1.6]}
            intensity={1.6}
            castShadow={quality === 'high'}
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-1}
            shadow-camera-right={1}
            shadow-camera-top={1}
            shadow-camera-bottom={-1}
            shadow-bias={-0.0004}
          />
          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={2.2} position={[0, 3, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-3, 1.5, 1]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} />
            <Lightformer form="rect" intensity={1.0} position={[3, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[3, 2, 1]} color="#eaf2ff" />
            <Lightformer form="rect" intensity={0.8} position={[0, 1.5, 3]} scale={[4, 2, 1]} />
          </Environment>
          {/* стол */}
          <mesh position={[0, BENCH_TOP_Y - 0.02, 0]} receiveShadow>
            <boxGeometry args={[WORK_AREA_SIZE.w + 0.5, 0.04, WORK_AREA_SIZE.d + 0.3]} />
            <meshStandardMaterial color={LAB_COLORS.benchTop} roughness={0.55} />
          </mesh>
          <mesh position={[0, BENCH_TOP_Y / 2 - 0.02, 0]}>
            <boxGeometry args={[WORK_AREA_SIZE.w + 0.46, BENCH_TOP_Y - 0.04, WORK_AREA_SIZE.d + 0.26]} />
            <meshStandardMaterial color={LAB_COLORS.benchBody} roughness={0.8} />
          </mesh>
          <ContactShadows position={[0, BENCH_TOP_Y + 0.0005, 0]} scale={[WORK_AREA_SIZE.w + 0.4, WORK_AREA_SIZE.d + 0.3]} opacity={0.35} blur={2.2} far={0.5} resolution={512} />
          <group position={WORK_AREA_CENTER}>
            <ExperimentRig experimentId={experimentId} step={step} onAdvance={() => goto(step + 1)} quality={quality} lang={lang} />
          </group>
          <OrbitControls target={[0, BENCH_TOP_Y + VIEW[experimentId][2], 0]} enableDamping minDistance={0.25} maxDistance={2.2} maxPolarAngle={Math.PI / 2 - 0.05} />
        </Canvas>
      </div>
      <div
        style={{
          width: narrow ? '100%' : BOARD_PX.w * boardScale + 16,
          height: BOARD_PX.h * boardScale + 16,
          padding: 8,
          alignSelf: narrow ? 'stretch' : 'center',
          flex: '0 0 auto',
        }}
      >
        <div style={{ width: BOARD_PX.w, height: BOARD_PX.h, transform: `scale(${boardScale})`, transformOrigin: '0 0' }}>
          <BoardPanel experimentId={experimentId} step={step} lang={lang} onSelectExperiment={select} onStep={goto} />
        </div>
      </div>
    </div>
  )
}
