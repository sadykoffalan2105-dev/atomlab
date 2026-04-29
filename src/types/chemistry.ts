export type Vec3 = readonly [number, number, number]

export interface Atom3D {
  symbol: string
  pos: Vec3
}

/** Категория для каталога и оформления. */
export type CompoundCategory = 'oxide' | 'acid' | 'base' | 'salt' | 'other'

export interface CompoundDef {
  id: string
  nameRu: string
  formulaUnicode: string
  composition: Record<string, number>
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
  accentColor: string
  descriptionRu: string
  /** Короткий учебный пример «атомы → вещество» (напр. 2H + O = H₂O). */
  laboratoryRecipeRu: string
  category: CompoundCategory
}

/** Запись до подстановки цепочки атомов и цвета по категории (если нет). */
export type RawCompoundDef = Omit<CompoundDef, 'atoms' | 'bonds' | 'accentColor' | 'laboratoryRecipeRu'> & {
  atoms?: Atom3D[]
  bonds?: readonly (readonly [number, number])[]
  accentColor?: string
  /** Если нет — в `finalizeCompound` короткая схема `nA + mB = формула` */
  laboratoryRecipeRu?: string
}

export type LabParticle =
  | {
      id: string
      type: 'atom'
      z: number
      symbol: string
      color: string
      position: Vec3
    }
  | {
      id: string
      type: 'molecule'
      compoundId: string
      position: Vec3
    }

export interface ElementViewModel {
  z: number
  symbol: string
  nameRu: string
  atomicMass: number
  cpkHex: string
  gridX: number
  gridY: number
  groupBlock: string
  oxidationStates: string
  electronConfiguration: string
  /** English label from IUPAC-style data (e.g. Gas, Solid) */
  standardState: string
}
