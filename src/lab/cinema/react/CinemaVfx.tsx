import {
  Component,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { ParticleSystem, QuarksProvider, type ParticleSystemRef } from 'quarks.r3f'
import {
  ApplyForce,
  Bezier,
  ColorOverLife,
  ColorRange,
  ConstantValue,
  Gradient,
  IntervalValue,
  PiecewiseBezier,
  RenderMode,
  SizeOverLife,
  SphereEmitter,
  TurbulenceField,
  Vector3 as QVec3,
  Vector4 as QVec4,
  type Behavior,
} from 'three.quarks'
import { particleSpriteMaterial } from '../core/materials'

/**
 * GPU-частицы сцены на three.quarks (batched renderer — все системы в один
 * набор draw call'ов, как Shuriken в Unity).
 *
 * Каждый эффект — одноразовый burst: он живёт выключенным и «выстреливает»
 * по событию раскадровки, поэтому в простое стоит почти ноль.
 */

export type VfxHandle = {
  fire: () => void
  /** Object3D эмиттера — сцена двигает его за атомом (шлейф электрона). */
  node: () => THREE.Object3D | null
}

export type VfxPreset = 'spark' | 'fire' | 'ion' | 'dust' | 'flash'

type PresetConfig = {
  count: number
  life: [number, number]
  speed: [number, number]
  size: [number, number]
  duration: number
  gravity: number
  turbulence: number
  from: THREE.Color
  to: THREE.Color
  sprite: 'glow' | 'spark' | 'puff'
  stretched: boolean
  radius: number
}

const PRESETS: Record<VfxPreset, PresetConfig> = {
  /** Искра активации: короткая, белo-голубая, разлетается радиально. */
  spark: {
    count: 90,
    life: [0.25, 0.6],
    speed: [1.6, 4.2],
    size: [0.05, 0.14],
    duration: 0.7,
    gravity: 0,
    turbulence: 0.3,
    from: new THREE.Color('#ffffff'),
    to: new THREE.Color('#4fd8ff'),
    sprite: 'spark',
    stretched: true,
    radius: 0.06,
  },
  /** Экзотермический выброс: оранжево-красные и голубые угольки. */
  fire: {
    count: 160,
    life: [0.4, 1.1],
    speed: [1.0, 3.4],
    size: [0.08, 0.24],
    duration: 0.9,
    gravity: 0.6,
    turbulence: 0.75,
    from: new THREE.Color('#fff0b0'),
    to: new THREE.Color('#ff3a10'),
    sprite: 'glow',
    stretched: false,
    radius: 0.12,
  },
  /** Перенос электрона: плотный узкий шлейф вдоль полёта. */
  ion: {
    count: 40,
    life: [0.16, 0.34],
    speed: [0.25, 0.9],
    size: [0.05, 0.12],
    duration: 0.5,
    gravity: 0,
    turbulence: 0.1,
    from: new THREE.Color('#ffffff'),
    to: new THREE.Color('#8ad8ff'),
    sprite: 'glow',
    stretched: true,
    radius: 0.03,
  },
  /** Осадок: тяжёлая пыль, медленно тонет. */
  dust: {
    count: 70,
    life: [1.2, 2.4],
    speed: [0.15, 0.6],
    size: [0.06, 0.16],
    duration: 1.4,
    gravity: -0.5,
    turbulence: 0.18,
    from: new THREE.Color('#e6ddff'),
    to: new THREE.Color('#6f5bb0'),
    sprite: 'puff',
    stretched: false,
    radius: 0.2,
  },
  /** Световая волна образования связи: мягкие широкие блики. */
  flash: {
    count: 60,
    life: [0.3, 0.7],
    speed: [2.2, 5.0],
    size: [0.12, 0.3],
    duration: 0.7,
    gravity: 0,
    turbulence: 0.2,
    from: new THREE.Color('#ffffff'),
    to: new THREE.Color('#ffb45a'),
    sprite: 'glow',
    stretched: false,
    radius: 0.05,
  },
}

class VfxBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    // Частицы — украшение: если движок VFX упал, урок обязан продолжиться.
    return this.state.failed ? null : this.props.children
  }
}

/** Обёртка сцены: batched renderer + защита от падения движка частиц. */
export function CinemaVfxStage({ children }: { children: ReactNode }) {
  return (
    <VfxBoundary>
      <QuarksProvider>{children}</QuarksProvider>
    </VfxBoundary>
  )
}

export const CinemaBurst = forwardRef<
  VfxHandle,
  {
    preset: VfxPreset
    position?: [number, number, number]
    /** множитель количества частиц (уровень качества) */
    scale?: number
    /** множитель размера — сцена бывает масштабирована */
    sizeScale?: number
    colorFrom?: number
    colorTo?: number
  }
>(function CinemaBurst(
  { preset, position = [0, 0, 0], scale = 1, sizeScale = 1, colorFrom, colorTo },
  ref,
) {
  const sysRef = useRef<ParticleSystemRef>(null)
  const cfg = PRESETS[preset]

  const from = useMemo(() => (colorFrom != null ? new THREE.Color(colorFrom) : cfg.from), [colorFrom, cfg.from])
  const to = useMemo(() => (colorTo != null ? new THREE.Color(colorTo) : cfg.to), [colorTo, cfg.to])

  const material = useMemo(() => particleSpriteMaterial(cfg.sprite), [cfg.sprite])

  const behaviors = useMemo<Behavior[]>(() => {
    const list: Behavior[] = [
      new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.95, 0.5, 0), 0]])),
      new ColorOverLife(
        new Gradient(
          [
            [new QVec3(from.r, from.g, from.b), 0],
            [new QVec3(to.r, to.g, to.b), 1],
          ],
          [
            [1, 0],
            [1, 0.55],
            [0, 1],
          ],
        ),
      ),
    ]
    if (cfg.gravity !== 0) {
      list.push(new ApplyForce(new QVec3(0, cfg.gravity > 0 ? 1 : -1, 0), new ConstantValue(Math.abs(cfg.gravity))))
    }
    if (cfg.turbulence > 0) {
      list.push(
        new TurbulenceField(
          new QVec3(1.6, 1.6, 1.6),
          2,
          new QVec3(cfg.turbulence, cfg.turbulence, cfg.turbulence),
          new QVec3(1, 1, 1),
        ),
      )
    }
    return list
  }, [cfg.gravity, cfg.turbulence, from, to])

  const emissionBursts = useMemo(
    () => [
      {
        time: 0,
        count: new ConstantValue(Math.max(6, Math.round(cfg.count * scale))),
        cycle: 1,
        interval: 0.01,
        probability: 1,
      },
    ],
    [cfg.count, scale],
  )

  const shape = useMemo(() => new SphereEmitter({ radius: cfg.radius, thickness: 1 }), [cfg.radius])

  const startColor = useMemo(
    () => new ColorRange(new QVec4(from.r, from.g, from.b, 1), new QVec4(to.r, to.g, to.b, 1)),
    [from, to],
  )

  useImperativeHandle(
    ref,
    () => ({
      fire: () => sysRef.current?.restart(),
      node: () => (sysRef.current?.emitter as unknown as THREE.Object3D | undefined) ?? null,
    }),
    [],
  )

  return (
    <ParticleSystem
      ref={sysRef}
      position={position}
      autoPlay={false}
      looping={false}
      autoDestroy={false}
      duration={cfg.duration}
      shape={shape}
      material={material}
      renderMode={cfg.stretched ? RenderMode.StretchedBillBoard : RenderMode.BillBoard}
      speedFactor={cfg.stretched ? 0.6 : 0}
      startLife={new IntervalValue(cfg.life[0], cfg.life[1])}
      startSpeed={new IntervalValue(cfg.speed[0], cfg.speed[1])}
      startSize={new IntervalValue(cfg.size[0] * sizeScale, cfg.size[1] * sizeScale)}
      startColor={startColor}
      emissionOverTime={new ConstantValue(0)}
      emissionBursts={emissionBursts}
      behaviors={behaviors}
      worldSpace={false}
    />
  )
})
