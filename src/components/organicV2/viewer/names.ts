/** Органика v2 — название молекулы на языке интерфейса (реестр учебника; запасной вариант — формула). */
import type { OV2Lang } from '../contracts'
import type { OV2Molecule } from '../../../data/organicV2/types'
import { organicMoleculeById } from '../../../data/organicLab/organicMoleculeRegistry'
import { subscriptDigits } from '../../../chemistry/organicV2'

export function moleculeName(mol: Pick<OV2Molecule, 'id' | 'formula'>, lang: OV2Lang): string {
  const d = organicMoleculeById[mol.id]
  if (!d) return subscriptDigits(mol.formula)
  return lang === 'en' ? d.nameEn : lang === 'uz' ? d.nameUz : d.nameRu
}
