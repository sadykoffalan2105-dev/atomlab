import { useCallback, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
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
 */

export function CinemaPostFx({
  director,
  lite = false,
}: {
  director: { current: PostDirector }
  lite?: boolean
}) {
  const [ready, setReady] = useState(false)
  const bloomRef = useRef<{ intensity: number } | null>(null)

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
    if (!bloomRef.current) return
    const target = lite ? 0.3 + director.current.bloom * 0.5 : 0.45 + director.current.bloom * 0.95
    bloomRef.current.intensity = THREE.MathUtils.lerp(bloomRef.current.intensity, target, 0.14)
  })

  if (!ready) return null

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={attachBloom}
        luminanceThreshold={lite ? 0.34 : 0.24}
        luminanceSmoothing={0.42}
        mipmapBlur
        intensity={0.5}
        radius={lite ? 0.3 : 0.42}
        levels={lite ? 3 : 5}
      />
      <Vignette eskil={false} offset={0.18} darkness={lite ? 0.34 : 0.42} />
    </EffectComposer>
  )
}
