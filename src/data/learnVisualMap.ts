import { compoundById } from './compounds'
import { isCatalogRenderable } from '../lab/synthesisGuarantee'

/** Маппинг § → visualId (каталожные модели и ключевые темы). */
export const LEARN_SECTION_VISUAL_MAP: Readonly<Record<string, string>> = {
  'g7-c1-s02': 'molecule:h2o',
  'g7-c1-s05': 'molecule:nacl',
  'g7-c2-s01': 'atom_h_1s',
  'g7-c2-s03': 'element:8',
  'g7-c2-s06': 'molecule:h2o',
  'g7-c2-s07': 'molecule:h2o',
  'g7-c3-s01': 'element:8',
  'g7-c3-s02': 'element:11',
  'g7-c3-s03': 'svg_periodicity',
  'g7-c4-s01': 'diatomic:7',
  'g7-c4-s03': 'diatomic:8',
  'g7-c4-s05': 'diatomic:8',
  'g7-c4-s06': 'reaction_h2_o2',
  'g7-c4-s10': 'molecule:co2',
  'g7-c5-s01': 'molecule:h2',
  'g7-c5-s04': 'molecule:hcl',
  'g7-c6-s01': 'molecule:h2o',
  'g7-c6-s04': 'molecule:h2o',
  'g7-c6-s06': 'molecule:naoh',
  'g7-c7-s02': 'molecule:nacl',
  'g7-c8-s01': 'molecule:fe2o3',
  'g8-c1-s02': 'svg_bond_types',
  'g8-c1-s03': 'molecule:co2',
  'g8-c1-s04': 'molecule:hcl',
  'g8-c1-s05': 'molecule:nacl',
  'g8-c1-s06': 'molecule:cao',
  'g8-c2-s01': 'svg_periodicity',
  'g8-c2-s05': 'molecule:fe2o3',
  'g8-c3-s01': 'bond_h2_covalent',
  'g8-c3-s16': 'bond_nacl_ionic',
  'g8-c4-s01': 'molecule:h2o',
  'g8-c4-s08': 'molecule:co2',
  'g8-c5-s04': 'reaction_h2_o2',
  'g9-c1-s02': 'molecule:fe2o3',
  'g9-c1-s04': 'molecule:al2o3',
  'g9-c2-s03': 'element:16',
  'g9-c2-s06': 'molecule:hcl',
  'g9-c3-s03': 'molecule:h2so4',
  'g9-c3-s05': 'molecule:naoh',
  'g9-c3-s10': 'electrolysis_nacl',
  'g9-c4-s05': 'molecule:cao',
  'g9-c6-s01': 'molecule:nacl',
  'g9-c7-s01': 'molecule:h2so4',
}

/**
 * Визуал §: явные molecule/atom из карты ИЛИ изометрическая сцена topic_*.
 */
export function sectionVisualOverride(sectionPathId: string): string | undefined {
  const direct = LEARN_SECTION_VISUAL_MAP[sectionPathId]
  if (direct) return direct
  const parts = sectionPathId.split('-')
  if (parts.length >= 3) {
    return `topic_${parts[0]}_${parts[1]}_${parts[2]}`
  }
  return undefined
}

/** Каталожная 3D-модель по тотему главы, если вещество рендерится. */
export function totemCatalogVisualId(totemCompoundId: string): string | undefined {
  const c = compoundById[totemCompoundId]
  if (!c || !isCatalogRenderable(c)) return undefined
  return `molecule:${totemCompoundId}`
}
