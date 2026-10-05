/**
 * Органика v2 — контракт компонентов интерфейса (план: docs/plans/organic-v2.md).
 * Каждый компонент делает свой агент в своём файле; оболочка страницы (OrganicLabPage) импортирует их по этим props.
 * Менять — только добавлениями необязательных полей.
 */
import type { OV2Molecule, OV2Reaction } from '../../data/organicV2/types'

export type OV2Lang = 'ru' | 'en' | 'uz'

/** Стиль 3D-модели. */
export type MoleculeStyle = 'ballStick' | 'spaceFill' | 'wire'
/** Слой поверх модели. */
export type MoleculeOverlay = 'none' | 'hybrid' | 'groups' | 'charges' | 'carbonDegree'
/** Инструмент: измерение (2 атома — расстояние, 3 — угол), вращение вокруг одинарной связи (Ньюмен). */
export type MoleculeTool = 'none' | 'measure' | 'rotate'

/** Только 3D-сцена молекулы (без панелей) — используют просмотрщик, изомеры, карточки. */
export interface Molecule3DProps {
  readonly mol: OV2Molecule
  readonly style: MoleculeStyle
  readonly overlay?: MoleculeOverlay
  readonly tool?: MoleculeTool
  readonly highlightAtoms?: readonly number[]
  readonly lang: OV2Lang
  readonly autoRotate?: boolean
  /** компактная карточка (без подписей/инструментов, низкое качество) */
  readonly compact?: boolean
  readonly className?: string
}

/** 2D-формула: скелетная (учебник), развёрнутая структурная (все атомы и связи), полуструктурная строкой. */
export interface Formula2DProps {
  readonly mol: OV2Molecule
  readonly kind: 'skeletal' | 'structural'
  readonly highlightAtoms?: readonly number[]
  readonly lang: OV2Lang
  readonly className?: string
}

/** Полный просмотрщик режима «Молекула»: 3D + 2D + панель стилей/слоёв/инструментов + карточка свойств. */
export interface MoleculeViewerProps {
  readonly mol: OV2Molecule
  readonly lang: OV2Lang
  readonly initialStyle?: MoleculeStyle
  readonly className?: string
}

/** Задание Конструктора. */
export type ConstructorTask =
  | { readonly kind: 'free' }
  /** собрать молекулу реестра по названию */
  | { readonly kind: 'build'; readonly targetId: string }
  /** найти все изомеры формулы (expected — id реестра; сам перечень может дополнить движок) */
  | { readonly kind: 'isomers'; readonly formula: string; readonly expected?: readonly string[] }

export interface ConstructorSolved {
  readonly canonical: string
  /** id молекулы реестра, если собранное с ней совпало */
  readonly matchId?: string
  readonly nameRu?: string
}

export interface OrganicConstructorProps {
  readonly task: ConstructorTask
  readonly lang: OV2Lang
  /** все молекулы v2 (для сопоставления собранного с реестром и RDKit-геометрии) */
  readonly molecules: Readonly<Record<string, OV2Molecule>>
  readonly onSolved?: (r: ConstructorSolved) => void
  readonly className?: string
}

/** Проигрыватель синтеза/реакции: 3D по атомному соответствию, этапы, доска, учитель. */
export interface SynthesisPlayerProps {
  readonly reaction: OV2Reaction
  readonly lang: OV2Lang
  /** молекула, ради которой открыт синтез (подсвечивается среди продуктов) */
  readonly focusMoleculeId?: string
  readonly autoplay?: boolean
  readonly onDone?: () => void
  readonly className?: string
}

/** Галерея изомеров одной формулы: 2D + маленькое 3D, вид изомерии, подсветка отличий. */
export interface IsomerGalleryProps {
  readonly formula: string
  readonly molecules: readonly OV2Molecule[]
  readonly lang: OV2Lang
  readonly onOpen?: (id: string) => void
  readonly className?: string
}
