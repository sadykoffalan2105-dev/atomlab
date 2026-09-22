import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedAtoms, InstancedBonds } from '../../../lab/cinema'
import type { AtomRenderMode } from '../../../lab/cinema/core/atomImpostorShader'
import type { AtomPool, BondPool } from '../../../lab/cinema/core/pools'
import { Ease } from '../../../lab/cinema/core/easing'
import { springStep } from '../../../lab/cinema/core/spring'
import {
  entryFlashAt,
  entryHeroFitScale,
  entryPhaseAt,
  entryTargetAngleDeg,
  ENTRY_FREEZE_SEC,
  sampleEntryFrame,
  writeEntryStatics,
  type EntryFrameOptions,
} from './labEntryScenario'
import { advanceEntryLoop, type EntryRuntime } from './labEntryRuntime'

/**
 * Герой экрана входа — настоящая реакция 2 H₂ + O₂ → 2 H₂O одним циклом.
 *
 * Все атомы — один draw call (InstancedAtoms), все связи — второй
 * (InstancedBonds). Для сравнения: язык CpkAtomModel рисует на атом меш, облако,
 * спрайт-ореол и спрайт-подпись, то есть те же шесть атомов стоили бы 24 вызова.
 *
 * Угол H–O–H доводится пружиной 180° → угол воды из ядра (ω = 9, ζ = 0.8): решение
 * аналитическое, поэтому на 24 Гц доводка выглядит так же, как на 60.
 */

const ANGLE_OMEGA = 9
const ANGLE_ZETA = 0.8

// --- ореол вспышки -----------------------------------------------------------

const FLASH_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FLASH_FRAG = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  // Жёсткая обрезка по кругу обязательна: без неё гауссов хвост доживает
  // до края квада и вспышка читается светлым ПРЯМОУГОЛЬНИКОМ поверх сцены.
  float fall = clamp(1.0 - r, 0.0, 1.0);
  fall *= fall;
  float core = exp(-r * r * 5.0) * fall;
  float halo = exp(-r * r * 1.6) * 0.45 * fall;
  gl_FragColor = vec4(uColor * (core + halo) * uGain, 1.0);
}
`

let flashMaterial: THREE.ShaderMaterial | null = null
let flashUniforms: { uColor: { value: THREE.Color }; uGain: { value: number } } | null = null
let flashGeometry: THREE.PlaneGeometry | null = null

function getFlashResources() {
  if (!flashMaterial || !flashUniforms) {
    flashUniforms = { uColor: { value: new THREE.Color(0xfff0c8) }, uGain: { value: 0 } }
    flashMaterial = new THREE.ShaderMaterial({
      uniforms: flashUniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: FLASH_VERT,
      fragmentShader: FLASH_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    })
  }
  if (!flashGeometry) flashGeometry = new THREE.PlaneGeometry(1, 1)
  return { material: flashMaterial, uniforms: flashUniforms, geometry: flashGeometry }
}

export type LabEntryReactionProps = {
  pool: AtomPool
  bonds: BondPool
  runtime: EntryRuntime
  /** фиксируется на весь сеанс: mode — часть ключа шейдерной программы */
  mode: AtomRenderMode
  lite: boolean
}

const _frameOpt: EntryFrameOptions = { heroScale: 3.2, liftY: 0, yaw: 0, offsets: null, fade: 1, spread: 1 }
/** Модульная пружина возврата — в кадре не создаётся ни одного объекта. */
const _return = { x: 0, v: 0 }

export function LabEntryReaction({ pool, bonds, runtime, mode, lite }: LabEntryReactionProps) {
  const flash = useRef<THREE.Mesh>(null)
  const timeRef = useRef(0)
  const res = useMemo(() => getFlashResources(), [])

  // Статика пула (цвет CPK, вдв-радиус, порядок и полярность связей) — вне кадра.
  // writtenLoop = −1 заставляет кадр переписать её под текущее вещество: при
  // смене масштаба героя радиусы обязаны пересчитаться.
  useEffect(() => {
    writeEntryStatics(pool, bonds, runtime.heroScale, runtime.spec)
    runtime.writtenLoop = runtime.loop
    pool.version += 1
    bonds.version += 1
  }, [pool, bonds, runtime, runtime.heroScale])

  useFrame(({ camera }, delta) => {
    const rt = runtime
    if (rt.paused) return
    // Клампим шаг: после hitch или возврата из скрытой вкладки сценарий
    // не должен перепрыгнуть через фазу вспышки.
    const dt = delta > 0.05 ? 0.05 : delta

    if (!rt.reduced && !rt.hold) {
      advanceEntryLoop(rt, dt * rt.speed * (1 + 1.3 * rt.boost))
    } else if (rt.reduced) {
      rt.t = ENTRY_FREEZE_SEC
    }

    // Смена вещества петли: постоянные поля пулов переписываются РОВНО один раз
    // на петлю, в кадре, где счётчик уже перевернулся, — и только тогда.
    // Там же подбирается масштаб: у соли связь Na–Cl вдвое длиннее, чем O–H
    // у воды, и один масштаб на всех обрезал бы соль о края кадра.
    if (rt.writtenLoop !== rt.loop) {
      rt.heroScale = entryHeroFitScale(rt.baseScale, rt.halfW, rt.halfH, rt.spread, rt.spec)
      writeEntryStatics(pool, bonds, rt.heroScale, rt.spec)
      rt.writtenLoop = rt.loop
    }

    const at = entryPhaseAt(rt.t)
    rt.phase = at.phase
    rt.local01 = at.local01

    if (rt.reduced) {
      rt.angle.x = entryTargetAngleDeg(rt.t, rt.spec)
      rt.angle.v = 0
    } else {
      springStep(rt.angle, entryTargetAngleDeg(rt.t, rt.spec), ANGLE_OMEGA, ANGLE_ZETA, dt)
    }
    rt.flash = rt.reduced ? 0 : entryFlashAt(rt.t)

    // Возврат отпущенной молекулы на место — пружина, а не lerp по кадрам.
    if (rt.grabbed < 0 && rt.flying < 0) {
      for (let i = 0; i < rt.offsets.length; i++) {
        if (rt.offsets[i] === 0 && rt.offVel[i] === 0) continue
        _return.x = rt.offsets[i]!
        _return.v = rt.offVel[i]!
        springStep(_return, 0, 7, 0.9, dt)
        const settled = Math.abs(_return.x) < 1e-4 && Math.abs(_return.v) < 1e-3
        rt.offsets[i] = settled ? 0 : _return.x
        rt.offVel[i] = settled ? 0 : _return.v
      }
    }

    _frameOpt.heroScale = rt.heroScale
    _frameOpt.liftY = rt.liftY
    _frameOpt.yaw = rt.yaw
    _frameOpt.offsets = rt.offsets
    _frameOpt.fade = rt.intro
    _frameOpt.spread = rt.spread
    _frameOpt.spec = rt.spec
    sampleEntryFrame(rt.t, rt.angle.x, _frameOpt, pool, bonds)
    pool.version += 1
    bonds.version += 1
    timeRef.current = rt.t

    const m = flash.current
    if (m) {
      const g = rt.flash * rt.intro
      if (g <= 0.002) {
        m.visible = false
      } else {
        m.visible = true
        m.quaternion.copy(camera.quaternion)
        m.position.set(0, rt.liftY, 0)
        // Вспышка — акцент на молекулу, а не засветка кадра: диаметр примерно
        // равен паре молекул воды, усиление держит серединные тона читаемыми.
        const s = (0.8 + Ease.outQuad(rt.flash) * 2.1) * rt.heroScale * 0.36
        m.scale.set(s, s, 1)
        res.uniforms.uGain.value = g * 0.8
      }
    }
  })

  return (
    <>
      <InstancedAtoms pool={pool} mode={mode} />
      <InstancedBonds pool={bonds} time={timeRef} lite={lite} />
      {!lite ? (
        <mesh ref={flash} geometry={res.geometry} material={res.material} renderOrder={6} frustumCulled={false} />
      ) : null}
    </>
  )
}
