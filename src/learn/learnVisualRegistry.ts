import type { LearnVisualSpec } from '../types/learn'
import { isTopicSceneId, topicSceneSpec } from './learnTopicScenes'

/** Реестр 3D/2D сцен для уроков (один Canvas на экран). */
const LEGACY_VISUAL_REGISTRY: Readonly<Record<string, LearnVisualSpec>> = {
  atom_h_1s: { id: 'atom_h_1s', kind: 'atom', z: 1 },
  atom_o_8: { id: 'atom_o_8', kind: 'atom', z: 8 },
  atom_na_11: { id: 'atom_na_11', kind: 'atom', z: 11 },
  atom_cl_17: { id: 'atom_cl_17', kind: 'atom', z: 17 },
  atom_fe_26: { id: 'atom_fe_26', kind: 'atom', z: 26 },
  atom_c_6: { id: 'atom_c_6', kind: 'atom', z: 6 },
  molecule_h2o: { id: 'molecule_h2o', kind: 'molecule', compoundId: 'h2o' },
  molecule_nacl: { id: 'molecule_nacl', kind: 'molecule', compoundId: 'nacl' },
  molecule_hcl: { id: 'molecule_hcl', kind: 'molecule', compoundId: 'hcl' },
  molecule_co2: { id: 'molecule_co2', kind: 'molecule', compoundId: 'co2' },
  molecule_cao: { id: 'molecule_cao', kind: 'molecule', compoundId: 'cao' },
  molecule_h2so4: { id: 'molecule_h2so4', kind: 'molecule', compoundId: 'h2so4' },
  molecule_al2o3: { id: 'molecule_al2o3', kind: 'molecule', compoundId: 'al2o3' },
  molecule_fe2o3: { id: 'molecule_fe2o3', kind: 'molecule', compoundId: 'fe2o3' },
  element_cl: { id: 'element_cl', kind: 'element', z: 17 },
  element_n: { id: 'element_n', kind: 'element', z: 7 },
  element_s: { id: 'element_s', kind: 'element', z: 16 },
  bond_nacl_ionic: { id: 'bond_nacl_ionic', kind: 'bond', mode: 'ionic', compoundId: 'nacl' },
  bond_h2_covalent: { id: 'bond_h2_covalent', kind: 'bond', mode: 'covalent', compoundId: 'h2' },
  bond_hcl_polar: { id: 'bond_hcl_polar', kind: 'bond', mode: 'polar', compoundId: 'hcl' },
  reaction_h2_o2: {
    id: 'reaction_h2_o2',
    kind: 'reaction',
    leftTerms: [
      { z: 1, coeff: 2, diatomic: true },
      { z: 8, coeff: 1, diatomic: true },
    ],
  },
  reaction_mg_o2: {
    id: 'reaction_mg_o2',
    kind: 'reaction',
    leftTerms: [
      { z: 12, coeff: 2 },
      { z: 8, coeff: 1, diatomic: true },
    ],
  },
  electrolysis_nacl: { id: 'electrolysis_nacl', kind: 'electrolysis', compoundId: 'nacl' },
  svg_periodicity: { id: 'svg_periodicity', kind: 'svgFallback', artId: 'periodicity' },
  svg_bond_types: { id: 'svg_bond_types', kind: 'svgFallback', artId: 'bond_types' },
  svg_safety_lab: { id: 'svg_safety_lab', kind: 'svgFallback', artId: 'safety_lab' },
  svg_lab_invite: { id: 'svg_lab_invite', kind: 'svgFallback', artId: 'lab_invite' },
}

export const LEARN_VISUAL_REGISTRY: Readonly<Record<string, LearnVisualSpec>> = {
  ...LEGACY_VISUAL_REGISTRY,
}

export function getLearnVisual(id: string | undefined): LearnVisualSpec | null {
  if (!id) return null
  if (isTopicSceneId(id)) return topicSceneSpec(id)
  return LEGACY_VISUAL_REGISTRY[id] ?? null
}

export function isKnownVisualId(id: string): boolean {
  if (isTopicSceneId(id)) return true
  return id in LEGACY_VISUAL_REGISTRY
}
