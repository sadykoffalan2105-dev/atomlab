import { useCallback, useMemo, useRef, type JSX } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, type EffectComposer as EffectComposerImpl, type Pass } from 'postprocessing'
import * as THREE from 'three'
import type { PostDirector } from '../core/states'

/**
 * Кинематографичный пост-продакшн.
 *
 * Цветовой конвейер: сцена → Bloom → тонмаппинг → Vignette, всё в одном
 * EffectPass. EffectComposer на время монтирования ставит рендереру
 * NoToneMapping, поэтому без эффекта ToneMapping стопки аддитивных слоёв
 * просто обрезались на выходе (плоское белое пятно, сдвиг оттенка).
 *
 * Оператор:
 *   • cinematic — AgX: HDR-буфер, AgX мягко сжимает света и углубляет тени;
 *   • lite — Khronos PBR Neutral: буфер 8-битный, значения уже обрезаны на 1.0,
 *     и AgX здесь нечего сжимать — он только тускнит и обесцвечивает CPK-цвета
 *     (1.0 → ≈0.79 sRGB, Cl из лаймового становится оливковым). Neutral не
 *     трогает тона ниже ≈0.76 и мягко сжимает только блики.
 * Проп toneMapping переопределяет выбор (для сверки вида на обоих уровнях).
 *
 * Bloom работает как «энергетический»: порог luminanceThreshold ≈0.88, поэтому
 * светится только то, что реально ярче белой бумаги — плазма связей под
 * нагрузкой, вспышки, волны. Атомы и газ под порог не попадают.
 *
 * Буферы: HalfFloat только на cinematic (там нужен HDR до тонмаппинга). На lite —
 * UnsignedByte: вдвое меньше памяти и дешевле на тайловых GPU; postprocessing
 * сам пишет туда sRGB, так что тёмные градиенты не полосят.
 *
 * DepthOfField сознательно не включён: на слабых GPU он давал заметный hitch,
 * а ощущение фокуса даёт объёмный туман сцены и виньетка.
 *
 * ChromaticAberration (только cinematic) — короткий пульс ровно на пике разрыва
 * связи (тот же director.bloom, что управляет Bloom). Это «свёрточный» эффект:
 * он не сливается с другими и живёт отдельным полноэкранным проходом. Поэтому он
 * стоит ПЕРВЫМ в цепочке, а вне удара его проход выключается (pass.enabled) —
 * последний проход, который пишет на экран, всегда включён.
 *
 * Композер монтируется сразу, на первом кадре. Раньше он поднимался через два
 * rAF, и все материалы сцены компилировались дважды: сначала под экран, потом
 * под render target композера (другой ключ программы: тонмаппинг/цветовое пространство).
 */

const CHROMA_TRIGGER = 0.72
const CHROMA_MAX_OFFSET = 0.0026
/** Ниже этого смещения аберрация незаметна — проход выключаем. */
const CHROMA_OFF_EPS = 0.00002
/**
 * Первые кадры проход аберрации рисуется даже с нулевым смещением: шейдер
 * компилируется при монтировании, а не посреди урока на первом разрыве связи.
 */
const CHROMA_WARM_FRAMES = 3

/** Скорости сглаживания, 1/с: 1 − exp(−k·dt) ≈ прежним 0.14 / 0.5 / 0.08 за кадр на 60 Гц. */
const K_LEVEL = 9
const K_CHROMA_ATTACK = 42
const K_CHROMA_RELEASE = 5

export type CinemaToneMapping = 'agx' | 'neutral'

type BloomLike = { intensity: number }
type VignetteLike = { darkness: number }
type ChromaLike = { offset: THREE.Vector2 }

type PostRuntime = {
  bloom: BloomLike | null
  vignette: VignetteLike | null
  chroma: ChromaLike | null
  composer: EffectComposerImpl | null
  /** EffectPass, в котором живёт аберрация (ищется лениво после монтирования) */
  chromaPass: Pass | null
  /** кадров, отрисованных проходом аберрации после монтирования (прогрев шейдера) */
  chromaWarm: number
  chromaAmount: number
}

function damp(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-k * dt))
}

/** Проход композера, содержащий данный эффект. EffectPass.effects в типах приватный. */
function findPassOf(composer: EffectComposerImpl, effect: object): Pass | null {
  const passes = composer.passes
  for (let i = 0; i < passes.length; i++) {
    const effects = (passes[i] as unknown as { effects?: readonly object[] }).effects
    if (effects && effects.indexOf(effect) !== -1) return passes[i]!
  }
  return null
}

/** Покадровое управление эффектами — вне компонента (правила react-hooks). */
function updatePost(rt: PostRuntime, director: PostDirector, lite: boolean, delta: number): void {
  // Клэмп: после долгого hitch не прыгаем в цель одним кадром.
  const dt = Math.min(Math.max(delta, 0), 0.1)
  if (rt.bloom) {
    const target = lite ? 0.45 + director.bloom * 0.7 : 0.6 + director.bloom * 1.25
    rt.bloom.intensity = damp(rt.bloom.intensity, target, K_LEVEL, dt)
  }
  if (rt.vignette) {
    const base = lite ? 0.34 : 0.42
    const target = base + director.vignette * (lite ? 0.1 : 0.16)
    rt.vignette.darkness = damp(rt.vignette.darkness, target, K_LEVEL, dt)
  }
  if (lite || !rt.chroma) return

  const spike = Math.max(0, director.bloom - CHROMA_TRIGGER) / (1 - CHROMA_TRIGGER)
  rt.chromaAmount = damp(rt.chromaAmount, spike, spike > rt.chromaAmount ? K_CHROMA_ATTACK : K_CHROMA_RELEASE, dt)
  const o = rt.chromaAmount * CHROMA_MAX_OFFSET
  rt.chroma.offset.set(o, o * 0.6)

  if (!rt.chromaPass && rt.composer) {
    rt.chromaPass = findPassOf(rt.composer, rt.chroma)
    rt.chromaWarm = 0
  }
  if (rt.chromaPass) {
    const warming = rt.chromaWarm < CHROMA_WARM_FRAMES
    if (warming) rt.chromaWarm++
    const on = warming || o > CHROMA_OFF_EPS
    if (rt.chromaPass.enabled !== on) rt.chromaPass.enabled = on
  }
}

export function CinemaPostFx({
  director,
  lite = false,
  toneMapping,
}: {
  director: { current: PostDirector }
  lite?: boolean
  /** оператор тонмаппинга; по умолчанию AgX на cinematic и Neutral на lite (см. шапку файла) */
  toneMapping?: CinemaToneMapping
}) {
  const toneMappingMode = (toneMapping ?? (lite ? 'neutral' : 'agx')) === 'agx' ? ToneMappingMode.AGX : ToneMappingMode.NEUTRAL
  const runtime = useRef<PostRuntime>({
    bloom: null,
    vignette: null,
    chroma: null,
    composer: null,
    chromaPass: null,
    chromaWarm: 0,
    chromaAmount: 0,
  })

  /**
   * Ref эффекта обязан быть колбэком.
   *
   * wrapEffect из @react-three/postprocessing мемоизирует args через
   * JSON.stringify(props), а React 19 передаёт ref внутри props. Объектный ref
   * после монтирования держит сам эффект, а тот — камеру и сцену: stringify
   * упирается в циклическую структуру и роняет всю пост-обработку.
   * Функции JSON.stringify пропускает, поэтому колбэк безопасен.
   * (Композер — не wrapEffect, но для единообразия и ему даём колбэк.)
   */
  const attachBloom = useCallback((effect: BloomLike | null) => {
    runtime.current.bloom = effect
  }, [])
  const attachVignette = useCallback((effect: VignetteLike | null) => {
    runtime.current.vignette = effect
  }, [])
  const attachChroma = useCallback((effect: ChromaLike | null) => {
    runtime.current.chroma = effect
    runtime.current.chromaPass = null
  }, [])
  const attachComposer = useCallback((composer: EffectComposerImpl | null) => {
    runtime.current.composer = composer
    runtime.current.chromaPass = null
  }, [])

  useFrame((_, delta) => updatePost(runtime.current, director.current, lite, delta))

  // EffectComposer типизирует children как JSX.Element | JSX.Element[] —
  // без null в массиве, поэтому цепочку собираем условно здесь, а не
  // тернарником прямо в JSX. Порядок важен: свёрточная аберрация отдельным
  // проходом впереди, затем Bloom + AgX + Vignette сливаются в один EffectPass.
  //
  // useMemo обязателен: композер пересобирает проходы (и перекомпилирует
  // EffectPass), когда меняется массив children, а LabScene перерисовывает
  // сцену и посреди урока.
  const effects = useMemo(() => {
    const list: JSX.Element[] = []
    if (!lite) {
      list.push(
        <ChromaticAberration
          key="chroma"
          ref={attachChroma}
          offset={new THREE.Vector2(0, 0)}
          radialModulation={false}
          modulationOffset={0}
        />,
      )
    }
    list.push(
      <Bloom
        key="bloom"
        ref={attachBloom}
        luminanceThreshold={0.88}
        luminanceSmoothing={lite ? 0.12 : 0.2}
        mipmapBlur
        intensity={lite ? 0.45 : 0.6}
        radius={lite ? 0.35 : 0.55}
        levels={lite ? 2 : 4}
      />,
      <ToneMapping key="tonemap" mode={toneMappingMode} />,
      <Vignette key="vignette" ref={attachVignette} eskil={false} offset={0.18} darkness={lite ? 0.34 : 0.42} />,
    )
    return list
  }, [lite, toneMappingMode, attachBloom, attachChroma, attachVignette])

  return (
    <EffectComposer
      ref={attachComposer}
      multisampling={0}
      frameBufferType={lite ? THREE.UnsignedByteType : THREE.HalfFloatType}
    >
      {effects}
    </EffectComposer>
  )
}
