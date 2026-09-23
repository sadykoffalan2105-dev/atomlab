import { useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { createNaclLatticeView, takeNaclHeroView } from '../../../lab/cinema/scenes/nacl/naclLatticeView'
import { heroHandoff } from './heroHandoff'

/**
 * Тело героя NaCl — та же решётка, которой кончается сцена урока (scenes/nacl/naclLatticeView):
 * тот же фрагмент (heroStructures.cells), шары, материалы и рёбра ячеек. Поэтому в кадр передачи
 * «сцена → герой» картинка не меняется: решётка сцены стоит ровно на месте этой группы и выглядит
 * так же, программа шейдера и геометрия уже в GPU (их прогрела сцена).
 *
 * handoff — это тело героя в слоте, на который сцена заявила передачу: регистрируем группу, чтобы
 * сцена читала её matrixWorld (облёт героя продолжается, решётка сцены встаёт в его текущую позу).
 */
export function NaclHeroBody({ lowPower = false, handoff = false }: { lowPower?: boolean; handoff?: boolean }) {
  // Заготовка сцены урока (уже в GPU) — если есть; иначе (каталог, превью) собираем сами.
  // Только герой передачи кадра: каталог и прочие превью заготовку не трогают.
  const view = useMemo(() => (handoff ? takeNaclHeroView() : null) ?? createNaclLatticeView({ settled: true, lowPower }), [lowPower, handoff])
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!handoff) return
    heroHandoff.setBody('nacl', view.group)
    return () => heroHandoff.setBody('nacl', null)
  }, [handoff, view])

  useEffect(() => () => view.dispose(), [view])

  return (
    <group ref={groupRef}>
      <primitive object={view.group} />
    </group>
  )
}
