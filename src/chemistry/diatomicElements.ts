/**
 * Элементы, которые в свободном состоянии (молекулярная форма) в учебном контексте
 * записываются как X₂ (не одиночный атом X в реакторе).
 */
export const DIATOMIC_NATIVE_ELEMENT_Z = new Set<number>([
  1, // H
  7, // N
  8, // O
  9, // F
  17, // Cl
  35, // Br
  53, // I
])

export function isDiatomicNativeElement(z: number): boolean {
  return DIATOMIC_NATIVE_ELEMENT_Z.has(z)
}
