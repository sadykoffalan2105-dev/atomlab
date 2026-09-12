import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { PostDirector } from '../core/states'

/**
 * Кинематографичный пост-продакшн.
 *
 * Bloom здесь работает как «selective»: светятся только аддитивные слои —
 * плазменные связи, ядра атомов, вспышки и волны. Остальная геометрия тусклая,
 * её яркость ниже порога luminanceThreshold, поэтому в ореол она не попадает.
 *
 * DepthOfField сознательно не включён: на слабых GPU он давал заметный hitch,
 * а ощущение фокуса даёт объёмный туман сцены и виньетка.
 *
 * ChromaticAberration — короткий пульс ровно на пике разрыва связи (тот же
 * director.bloom, что уже управляет Bloom), а не постоянный эффект: дешёво
 * (не depth-of-field), не мигает вне удара, и даёт кадру ощутимый «импакт».
 */

const CHROMA_TRIGGER = 0.72
const CHROMA_MAX_OFFSET = 0.0026

export function CinemaPostFx({
  director,
  lite = false,
}: {
  director: { current: PostDirector }
  lite?: boolean
}) {
  const [ready, setReady] = useState(false)
  const bloomRef = useRef<{ intensity: number } | null>(null)
  const vignetteRef = useRef<{ darkness: number } | null>(null)
  const chromaRef = useRef<{ offset: THREE.Vector2 } | null>(null)
  const chromaAmountRef = useRef(0)

  /**
   * Ref эффекта обязан быть колбэком.
   *
   * wrapEffect из @react-three/postprocessing мемоизирует args через
   * JSON.stringify(props), а React 19 передаёт ref внутри props. Объектный ref
   * после монтирования держит сам эффект, а тот — камеру и сцену: stringify
   * упирается в циклическую структуру и роняет всю пост-обработку.
   * Функции JSON.stringify пропускает, поэтому колбэк безопасен.
   */
  const attachBloom = useCallback((effect: { intensity: number } | null) => {
    bloomRef.current = effect
  }, [])
  const attachVignette = useCallback((effect: { darkness: number } | null) => {
    vignetteRef.current = effect
  }, [])
  const attachChroma = useCallback((effect: { offset: THREE.Vector2 } | null) => {
    chromaRef.current = effect
  }, [])

  useEffect(() => {
    // Композер поднимаем через два кадра: на первом кадре WebGL-контекст
    // ещё занят загрузкой сцены, и создание render target даёт просадку.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])

  useFrame(() => {
    if (bloomRef.current) {
      const target = lite ? 0.3 + director.current.bloom * 0.5 : 0.45 + director.current.bloom * 0.95
      bloomRef.current.intensity = THREE.MathUtils.lerp(bloomRef.current.intensity, target, 0.14)
    }
    if (vignetteRef.current) {
      const base = lite ? 0.34 : 0.42
      const target = base + director.current.vignette * (lite ? 0.1 : 0.16)
      vignetteRef.current.darkness = THREE.MathUtils.lerp(vignetteRef.current.darkness, target, 0.14)
    }
    if (chromaRef.current && !lite) {
      const spike = Math.max(0, director.current.bloom - CHROMA_TRIGGER) / (1 - CHROMA_TRIGGER)
      chromaAmountRef.current = THREE.MathUtils.lerp(chromaAmountRef.current, spike, spike > chromaAmountRef.current ? 0.5 : 0.08)
      const o = chromaAmountRef.current * CHROMA_MAX_OFFSET
      chromaRef.current.offset.set(o, o * 0.6)
    }
  })

  if (!ready) return null

  // EffectComposer типизирует children как JSX.Element | JSX.Element[] —
  // без null в массиве, поэтому lite-ветку собираем условно здесь, а не
  // тернарником прямо в JSX.
  const effects = [
    <Bloom
      key="bloom"
      ref={attachBloom}
      luminanceThreshold={lite ? 0.34 : 0.24}
      luminanceSmoothing={0.42}
      mipmapBlur
      intensity={0.5}
      radius={lite ? 0.3 : 0.42}
      levels={lite ? 3 : 5}
    />,
    <Vignette
      key="vignette"
      ref={attachVignette}
      eskil={false}
      offset={0.18}
      darkness={lite ? 0.34 : 0.42}
    />,
  ]
  if (!lite) {
    effects.push(
      <ChromaticAberration
        key="chroma"
        ref={attachChroma}
        offset={new THREE.Vector2(0, 0)}
        radialModulation={false}
        modulationOffset={0}
      />,
    )
  }

  return <EffectComposer multisampling={0}>{effects}</EffectComposer>
}
