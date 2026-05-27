/** Типичная валентность для школьного курса (римские цифры в подсказках). */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

const VALENCY_BY_Z: Record<number, number> = {
  1: 1,
  2: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
  10: 0,
  11: 1,
  12: 2,
  13: 3,
  14: 4,
  15: 3,
  16: 2,
  17: 1,
  18: 0,
  19: 1,
  20: 2,
  26: 2,
  29: 2,
  30: 2,
}

export function schoolValency(z: number): number | null {
  if (z === 2 || z === 10 || z === 18) return 0
  return VALENCY_BY_Z[z] ?? null
}

export function schoolValencyRoman(z: number): string | null {
  const v = schoolValency(z)
  if (v == null || v === 0) return null
  return ROMAN[v] ?? String(v)
}

export function valencyBondDots(z: number): number {
  const v = schoolValency(z)
  if (v == null || v <= 0) return 0
  return Math.min(4, v)
}
