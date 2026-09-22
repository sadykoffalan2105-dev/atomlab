import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Ease } from '../../../lab/cinema/core/easing'
import type { AtomRenderMode } from '../../../lab/cinema/core/atomImpostorShader'
import { getLowPowerDeviceProfile } from '../../../lab/lowPowerDeviceProfile'
import { getSynthesisDeviceTier } from '../../../lab/synthesisDeviceTier'
import { useAppTheme } from '../../../theme/appTheme'
import { LabEntryAtmosphere } from './LabEntryAtmosphere'
import { LabEntryGrab } from './LabEntryGrab'
import { LabEntryHints } from './LabEntryHints'
import { LabEntryMoleculeBelt } from './LabEntryMoleculeBelt'
import { LabEntryReaction } from './LabEntryReaction'
import {
  getLabEntryAtomPool,
  getLabEntryBeltAtomPool,
  getLabEntryBeltBondPool,
  getLabEntryBondPool,
} from './labEntryPools'
import { createEntryPointerState, stepEntryPointer } from './LabEntryPointer'
import { createEntryRuntime } from './labEntryRuntime'
import { ENTRY_LOOP_SEC, ENTRY_LOOP_SEC_LOW } from './labEntryScenario'

/**
 * Экран входа в лабораторию: «живая реакция-приглашение».
 *
 * Кадр строится в три слоя по глубине:
 *   задний  — пояс из четырёх настоящих веществ (H₂O, CO₂, NH₃, HCl): витрина
 *             каталога, клик по молекуле — намерение «открыть каталог»;
 *   герой   — настоящая реакция 2 H₂ + O₂ → 2 H₂O одним 11-секундным циклом;
 *   передний — вспышка связывания и DOM-подписи.
 *
 * Интерактив трёхуровневый: параллакс по указателю наклоняет НАШУ группу
 * (камера целиком остаётся за OrbitControls), удержание пальца у центра работает
 * «магнитом» и ускоряет сведение атомов, а готовую молекулу воды можно схватить
 * и потянуть вниз — это отправляет намерение «открыть реактор».
 *
 * Производительность. Режим атомов (impostor / mesh) фиксируется на весь сеанс:
 * он входит в ключ шейдерной программы InstancedAtoms, смена на лету — это
 * рекомпиляция и hitch ровно на входе в лабораторию. Кадр не считается вовсе,
 * когда вкладка скрыта или канвас за пределами экрана: в LabScene жёстко задан
 * frameloop='always', иначе наш useFrame тикал бы в свёрнутой вкладке и грел
 * телефон впустую.
 */

const BASE_HERO_SCALE = 2.5
const NARROW_PX = 520
const PORTRAIT_ASPECT = 0.75
const INTRO_SEC = 0.5
/** Ширина видимого мира на десктопе — эталон, от которого считается сжатие кадра. */
const REFERENCE_VIEWPORT_W = 10.4

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function LabEntryScene() {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const pointer = useThree((s) => s.pointer)
  const viewport = useThree((s) => s.viewport)
  const { theme } = useAppTheme()

  const heroAtoms = useMemo(() => getLabEntryAtomPool(), [])
  const heroBonds = useMemo(() => getLabEntryBondPool(), [])
  const beltAtoms = useMemo(() => getLabEntryBeltAtomPool(), [])
  const beltBonds = useMemo(() => getLabEntryBeltBondPool(), [])

  // Профиль устройства и режим рендера фиксируются на весь сеанс.
  const device = useMemo(() => {
    const tier = getSynthesisDeviceTier()
    const profile = getLowPowerDeviceProfile(tier)
    const lowPower = tier === 'low' || profile.isMobileSoc
    const mode: AtomRenderMode = lowPower ? 'mesh' : 'impostor'
    return { lowPower, mode, parallax: !profile.disableAtomDrift }
  }, [])

  const runtime = useMemo(() => {
    const rt = createEntryRuntime()
    rt.reduced = prefersReducedMotion()
    rt.speed = device.lowPower ? ENTRY_LOOP_SEC / ENTRY_LOOP_SEC_LOW : 1
    return rt
  }, [device])

  const pointerState = useMemo(() => createEntryPointerState(), [])
  const downRef = useRef(false)
  const beltHoverRef = useRef<string | null>(null)
  const tilt = useRef<THREE.Group>(null)
  const flashRef = useRef(0)
  const pausedRef = useRef(false)

  // Раскладка дискретна (два состояния), чтобы ресайз не переписывал пулы на каждый пиксель.
  const compact = size.width > 0 && size.width < NARROW_PX
  const portrait = size.height > 0 && size.width / size.height < PORTRAIT_ASPECT
  const layout = useMemo(
    () => ({
      // Без пояса кадр пустеет, поэтому на слабом устройстве герой крупнее.
      heroScale: (compact ? BASE_HERO_SCALE * 0.8 : BASE_HERO_SCALE) * (device.lowPower ? 1.16 : 1),
      // Пояс — задний план, а не второй герой: кольцо шире и дальше, чем герой,
      // поэтому в кадре оно занимает ту же рамку, но молекулы в нём МЕЛЬЧЕ —
      // ровно так глаз и читает глубину.
      beltRadius: compact ? 2.6 : 3.6,
      beltScale: compact ? 1.08 : 1.38,
      liftY: portrait ? 0.35 : 0,
    }),
    [compact, portrait, device.lowPower],
  )

  useEffect(() => {
    runtime.baseScale = layout.heroScale
    runtime.heroScale = layout.heroScale
    runtime.liftY = layout.liftY
    // Радиусы атомов записаны с прежним масштабом — пометить статику устаревшей.
    // Эффект родителя срабатывает ПОСЛЕ эффектов детей, поэтому переписывает её
    // не React, а следующий кадр реакции.
    runtime.writtenLoop = -1
  }, [runtime, layout])

  /**
   * Сжатие кадра считается от ШИРИНЫ ВИДИМОГО МИРА, а не от CSS-медиазапроса:
   * на 390 px в кадр помещается ~2.9 мировых единицы против ~10.4 на 1920 px,
   * и реагенты, вылетающие с радиуса 3.4, первые две секунды просто не видны.
   */
  const spread = useMemo(() => {
    const w = viewport.width > 0 ? viewport.width : REFERENCE_VIEWPORT_W
    return Math.max(0.5, Math.min(1, w / REFERENCE_VIEWPORT_W))
  }, [viewport.width])

  useEffect(() => {
    runtime.spread = spread
    // Полуразмеры видимого мира: по ним кадр реакции подбирает масштаб под
    // вещество петли (см. entryHeroFitScale). Подстановка сюда, а не в пропсы,
    // потому что вещество меняется без единого ререндера.
    runtime.halfW = (viewport.width > 0 ? viewport.width : REFERENCE_VIEWPORT_W) * 0.5
    runtime.halfH = (viewport.height > 0 ? viewport.height : REFERENCE_VIEWPORT_W * 0.58) * 0.5
    runtime.writtenLoop = -1
  }, [runtime, spread, viewport.width, viewport.height])

  // Состояние «палец прижат»: слушатели пассивные, OrbitControls они не мешают.
  useEffect(() => {
    const el = gl.domElement
    const down = () => {
      downRef.current = true
    }
    const up = () => {
      downRef.current = false
    }
    el.addEventListener('pointerdown', down, { passive: true })
    el.addEventListener('pointerup', up, { passive: true })
    el.addEventListener('pointercancel', up, { passive: true })
    el.addEventListener('pointerleave', up, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', up)
    }
  }, [gl])

  // Скрытая вкладка или канвас за пределами экрана — полный простой.
  useEffect(() => {
    let visible = true
    let onScreen = true
    const apply = () => {
      const paused = !visible || !onScreen
      pausedRef.current = paused
      runtime.paused = paused
    }
    const onVisibility = () => {
      visible = !document.hidden
      apply()
    }
    document.addEventListener('visibilitychange', onVisibility)
    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1]
        if (e) onScreen = e.intersectionRatio > 0
        apply()
      })
      observer.observe(gl.domElement)
    }
    onVisibility()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      runtime.paused = false
      pausedRef.current = false
    }
  }, [gl, runtime])

  // Реакция на смену системной настройки движения без перезагрузки страницы.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => {
      runtime.reduced = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
    }
  }, [runtime])

  useFrame((_, delta) => {
    const rt = runtime
    if (rt.paused) return
    const dt = delta > 0.05 ? 0.05 : delta

    // Проявление сцены: под затемнением успевают скомпилироваться программы.
    if (rt.intro < 1) {
      rt.intro = Math.min(1, rt.intro + dt / INTRO_SEC)
    }

    stepEntryPointer(pointerState, {
      x: pointer.x,
      y: pointer.y,
      down: downRef.current,
      dt,
      parallax: device.parallax && !rt.reduced,
    })
    rt.boost = rt.reduced ? 0 : pointerState.boost
    flashRef.current = rt.flash

    const g = tilt.current
    if (g) {
      g.rotation.x = pointerState.tiltX
      g.rotation.y = pointerState.tiltY
      const s = 0.9 + 0.1 * Ease.outQuad(rt.intro)
      g.scale.setScalar(s)
    }
  })

  return (
    <>
      <LabEntryAtmosphere theme={theme} flashRef={flashRef} />
      <group ref={tilt}>
        {!device.lowPower ? (
          <LabEntryMoleculeBelt
            pool={beltAtoms}
            bonds={beltBonds}
            radius={layout.beltRadius}
            scale={layout.beltScale}
            mode={device.mode}
            lite={device.lowPower}
            pausedRef={pausedRef}
            runtime={runtime}
            hoverRef={beltHoverRef}
            theme={theme}
          />
        ) : null}
        <LabEntryReaction
          pool={heroAtoms}
          bonds={heroBonds}
          runtime={runtime}
          mode={device.mode}
          lite={device.lowPower}
        />
        <LabEntryGrab pool={heroAtoms} runtime={runtime} scale={layout.heroScale} />
      </group>
      <LabEntryHints runtime={runtime} theme={theme} compact={compact} beltHoverRef={beltHoverRef} />
    </>
  )
}
