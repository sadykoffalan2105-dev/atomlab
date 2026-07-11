import type { OrganicClassId } from '../researchLab/organicBuildCatalog'
import type { OrganicGraph } from '../../chemistry/organic/organicGraph'
import type { Hybridization } from '../../chemistry/organic/organicLayout'

/** Якорь функциональной группы на атоме(ах) графа. */
export type OrganicFunctionalGroup = {
  id: string
  /** Подпись: -OH, C=C, C≡C, C=O, -COOH, Ar, -NH₂, -Cl, -O- … */
  label: string
  labelRu: string
  labelEn: string
  labelUz: string
  /** id атомов-якорей (центр группы) */
  atomIds: readonly string[]
}

export type OrganicViewHints = {
  /** Атом для панели гибридизации (обычно ключевой C) */
  hybridFocusId?: string
  hybridFocus?: Hybridization
}

export type OrganicMoleculeDef = {
  id: string
  classId: OrganicClassId
  formula: string
  nameRu: string
  nameEn: string
  nameUz: string
  descriptionRu: string
  descriptionEn: string
  descriptionUz: string
  grade: 'g10' | 'g11'
  /** Готовый граф для 3D */
  graph: OrganicGraph
  functionalGroups: readonly OrganicFunctionalGroup[]
  equationRu: string
  equationEn: string
  equationUz: string
  /** Связь с кабинетом исследователя */
  challengeId?: string
  viewHints?: OrganicViewHints
  accentColor: string
}

export type OrganicDisplayMode = 'ballStick' | 'spaceFill' | 'skeleton2d' | 'hybridization'
