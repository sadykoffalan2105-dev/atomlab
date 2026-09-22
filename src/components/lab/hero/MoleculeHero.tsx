import type { HeroModel } from './heroGeometry'
import { HeroStructureView } from './HeroStructureView'

/**
 * Герой молекулярного вещества (H₂O, CO₂, H₂O₂, SO₃, Mn₂O₇, Cl₂O₇): одна молекула крупно, длины,
 * углы и двугранный угол — из bondData (core/vsepr: writeBent, writeLinear, writeTrigonalPlanar,
 * writeDihedral, writeBridged). У воды — четыре соседа на водородных связях (пунктир kit/bondVisual
 * 'hbond'), соседние молекулы чуть прозрачнее. У газа соседей нет: при 25 °C среднее расстояние
 * между молекулами в десятки раз больше молекулы — это сказано в карточке продукта.
 */
export function MoleculeHero({ model, showLabels, lowPower }: { model: HeroModel; showLabels: boolean; lowPower?: boolean }) {
  return <HeroStructureView model={model} showLabels={showLabels} lowPower={lowPower} />
}
