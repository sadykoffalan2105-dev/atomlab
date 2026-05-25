/** Маппинг § → visualId (расширяется по мере наполнения). */
export const LEARN_SECTION_VISUAL_MAP: Readonly<Record<string, string>> = {
  'g7-c1-s02': 'molecule_h2o',
  'g7-c2-s01': 'atom_h_1s',
  'g8-c3-s16': 'bond_nacl_ionic',
  'g9-c3-s10': 'electrolysis_nacl',
}

export function sectionVisualOverride(sectionPathId: string): string | undefined {
  return LEARN_SECTION_VISUAL_MAP[sectionPathId]
}
