import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { setAtomLighting } from '../core/atomImpostorShader'
import {
  getLabEnvironment,
  getLabSoftboxLighting,
  subscribeLabEnvironment,
  type LabEnvironment,
} from '../core/envLighting'

/**
 * Единый световой риг урока: окружение «лабораторный софтбокс» вместо набора ламп.
 *
 *   • scene.environment = PMREM софтбокса, пока риг смонтирован (при размонтировании
 *     возвращается прежнее окружение) — стандартные материалы получают отражения;
 *   • атомы (InstancedAtoms) получают те же панели как 9 коэффициентов SH
 *     через общие uniforms — точечные источники не нужны;
 *   • опционально ОДИН направленный свет по ключевой панели. Количество
 *     источников постоянно весь урок: «выключение» — intensity 0, не размонтирование,
 *     иначе three перекомпилирует все освещаемые материалы.
 *
 * Монтировать один раз на старте сцены (вместе с туманом): смена
 * scene.environment меняет ключ программ стандартных материалов.
 */

export type CinemaLightRigProps = {
  /** яркость окружения: scene.environmentIntensity и SH атомов */
  intensity?: number
  /** монтировать ли направленный свет по ключу (решение на весь урок) */
  directionalLight?: boolean
  /** яркость направленного света; 0 — «выключен» без смены числа источников */
  directionalIntensity?: number
}

type SceneEnvSnapshot = {
  environment: THREE.Texture | null
  environmentIntensity: number
}

function applySceneEnvironment(scene: THREE.Scene, env: LabEnvironment, intensity: number): SceneEnvSnapshot {
  const prev = { environment: scene.environment, environmentIntensity: scene.environmentIntensity }
  scene.environment = env.texture
  scene.environmentIntensity = intensity
  return prev
}

function setSceneEnvironmentIntensity(scene: THREE.Scene, env: LabEnvironment, intensity: number): void {
  if (scene.environment === env.texture) scene.environmentIntensity = intensity
}

/** Вернуть прежнее окружение, если за время жизни рига его никто не переназначил. */
function restoreSceneEnvironment(scene: THREE.Scene, owned: THREE.Texture, prev: SceneEnvSnapshot): void {
  if (scene.environment !== owned) return
  scene.environment = prev.environment
  scene.environmentIntensity = prev.environmentIntensity
}

function swapSceneEnvironment(scene: THREE.Scene, from: THREE.Texture, to: THREE.Texture): void {
  if (scene.environment === from) scene.environment = to
}

export function CinemaLightRig({ intensity = 1, directionalLight = false, directionalIntensity = 1.2 }: CinemaLightRigProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const lighting = getLabSoftboxLighting()

  // Окружение ставим один раз на рендерер/сцену; яркость меняем отдельно, без пересборки.
  useEffect(() => {
    let env = getLabEnvironment(gl)
    const prev = applySceneEnvironment(scene, env, intensity)
    const unsubscribe = subscribeLabEnvironment(gl, (next) => {
      swapSceneEnvironment(scene, env.texture, next.texture)
      env = next
    })
    return () => {
      unsubscribe()
      restoreSceneEnvironment(scene, env.texture, prev)
    }
    // intensity намеренно не в зависимостях — её обновляет эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene])

  useEffect(() => {
    setSceneEnvironmentIntensity(scene, getLabEnvironment(gl), intensity)
    setAtomLighting(lighting, intensity)
  }, [gl, scene, lighting, intensity])

  const keyPosition = useMemo<[number, number, number]>(() => {
    const [x, y, z] = lighting.keyDir
    return [x * 10, y * 10, z * 10]
  }, [lighting])

  const keyColor = useMemo(() => {
    const [r, g, b] = lighting.keyIrradiance
    const m = Math.max(r, g, b) || 1
    return new THREE.Color().setRGB(r / m, g / m, b / m, THREE.LinearSRGBColorSpace)
  }, [lighting])

  if (!directionalLight) return null
  return <directionalLight position={keyPosition} color={keyColor} intensity={directionalIntensity} />
}
