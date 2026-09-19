import { commitPool, cpkHex, writeAtom, writeBond } from '../cpkAtoms'
import { buildSceneWorld, setGlow, setWave, useSceneRuntime } from '../sceneKit'
import { SceneShell, type SceneFrameCtx } from '../SceneShell'
import type { ScientificSynthesisFxProps } from '../../../../scientificSynthesis/types'
import {
  createDemoFrame,
  DEMO_ATOMS,
  DEMO_TIMING,
  sampleDemoFrame,
  validateDemoStoryboard,
  type DemoCueId,
  type DemoStepId,
} from './demoStoryboard'

/**
 * ШАБЛОН РЕНДЕРА СЦЕНЫ. Копируйте в scenes/<id>/ и наращивайте:
 * вся механика (часы по шагам, контракт лаборатории, камера, качество,
 * prefers-reduced-motion, пост-обработка) уже внутри SceneShell.
 *
 * Эта сцена НЕ зарегистрирована в registry.ts — она существует как образец.
 */
function createDemoWorld() {
  return buildSceneWorld({
    atoms: DEMO_ATOMS.length,
    bonds: 4,
    glows: [{ id: 'exo', color: 0xffb264, radius: 0.9 }] as const,
    waves: [{ id: 'exo', color: 0xffc27a, radius: 1.2 }] as const,
  })
}

export function DemoCinemaScene(props: ScientificSynthesisFxProps) {
  // Мир и буфер кадра: один раз на прогон, дальше пишем каждый кадр.
  const { world, frame } = useSceneRuntime(() => ({ world: createDemoWorld(), frame: createDemoFrame() }))

  // ВАЖНО для всех сцен: onFrame НЕ оборачивайте в useCallback с `world`/`frame`
  // в зависимостях — react-hooks/immutability запрещает менять значение,
  // отданное хуку аргументом. SceneShell зовёт onFrame из useFrame, поэтому
  // обычная функция здесь и правильна, и дешевле.
  const onFrame = (ctx: SceneFrameCtx) => {
    sampleDemoFrame(ctx.t, frame)

    for (let i = 0; i < DEMO_ATOMS.length; i++) {
      const a = DEMO_ATOMS[i]!
      writeAtom(world.atoms, i, {
        pos: frame.atoms[a.id],
        radius: frame.radius[a.id],
        colorHex: cpkHex(a.el),
        emissive: 0.08 + frame.exo * 0.4,
        opacity: 1 - frame.fade * 0.6,
      })
    }
    commitPool(world.atoms, DEMO_ATOMS.length)

    // Две связи продукта H–Cl (до обмена — H–H и Cl–Cl; здесь показан итог).
    writeBond(world.bonds, 0, {
      a: frame.atoms.h1,
      b: frame.atoms.cl1,
      radius: 0.05,
      colorA: cpkHex('H'),
      colorB: cpkHex('Cl'),
      opacity: frame.glow,
      polarity: 0.6,
    })
    writeBond(world.bonds, 1, {
      a: frame.atoms.h2,
      b: frame.atoms.cl2,
      radius: 0.05,
      colorA: cpkHex('H'),
      colorB: cpkHex('Cl'),
      opacity: frame.glow,
      polarity: 0.6,
    })
    commitPool(world.bonds, 2)

    setGlow(world, 'exo', frame.center, frame.exo * 0.8)
    setWave(world, 'exo', frame.center, frame.exo)

    ctx.camera.zoom = frame.camera.zoom
    ctx.camera.bloom = 0.3 + frame.exo * 0.6
    ctx.camera.vignette = Math.max(0.3, frame.fade)
  }

  return (
    <SceneShell<DemoStepId, DemoCueId>
      {...props}
      lesson="demo"
      timing={DEMO_TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validateDemoStoryboard}
      debugName="demo"
    />
  )
}
