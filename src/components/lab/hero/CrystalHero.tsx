import type { HeroModel } from './heroGeometry'
import { HeroStructureView } from './HeroStructureView'

/**
 * Герой ионной или атомной решётки (NaCl, MgO, Al₂O₃, SiO₂, PbO): фрагмент из ЦЕЛЫХ ячеек
 * (kit/lattice.latticeFragment), ионные радиусы Шеннона при фактическом КЧ узла или радиусы
 * Кордеро у полярно-ковалентного каркаса, видимые рёбра ячеек (cellEdges), подпись a / группа / КЧ
 * (latticeCaption) и медленный облёт. Без огня, свечения и ауры — свет только сценический.
 */
export function CrystalHero({ model, showLabels, lowPower, handoff }: { model: HeroModel; showLabels: boolean; lowPower?: boolean; handoff?: boolean }) {
  return <HeroStructureView model={model} showLabels={showLabels} lowPower={lowPower} handoff={handoff} />
}
