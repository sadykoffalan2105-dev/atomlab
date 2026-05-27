import { compoundById } from './compounds'
import { isCatalogRenderable } from '../lab/synthesisGuarantee'

/** Маппинг § → visualId (каталожные модели и ключевые темы). */
export const LEARN_SECTION_VISUAL_MAP: Readonly<Record<string, string>> = {
  'g7-c1-s02': 'molecule:h2o',
  'g7-c2-s01': 'atom_h_1s',
  'g7-c2-s06': 'molecule:h2o',
  'g7-c3-s02': 'molecule:co2',
  'g7-c3-s03': 'diatomic:8',
  'g7-c3-s04': 'molecule:h2o',
  'g7-c4-s01': 'molecule:nacl',
  'g7-c4-s02': 'bond_nacl_ionic',
  'g8-c1-s03': 'molecule:h2so4',
  'g8-c2-s05': 'molecule:fe2o3',
  'g8-c3-s16': 'bond_nacl_ionic',
  'g8-c4-s08': 'molecule:co2',
  'g9-c1-s04': 'molecule:al2o3',
  'g9-c2-s06': 'molecule:hcl',
  'g9-c3-s10': 'electrolysis_nacl',
  'g9-c4-s05': 'molecule:cao',
}

export function sectionVisualOverride(sectionPathId: string): string | undefined {
  return LEARN_SECTION_VISUAL_MAP[sectionPathId]
}

/** Каталожная 3D-модель по тотему главы, если вещество рендерится. */
export function totemCatalogVisualId(totemCompoundId: string): string | undefined {
  const c = compoundById[totemCompoundId]
  if (!c || !isCatalogRenderable(c)) return undefined
  return `molecule:${totemCompoundId}`
}
