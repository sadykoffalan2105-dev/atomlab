function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** Ионная формула: катион (состав и суммарный заряд) + анион. */
export function mergeIonic(
  cation: { comp: Record<string, number>; charge: number },
  anion: { comp: Record<string, number>; charge: number },
): Record<string, number> {
  const g = gcd(Math.abs(cation.charge), Math.abs(anion.charge))
  const nCat = Math.abs(anion.charge) / g
  const nAn = Math.abs(cation.charge) / g
  const out: Record<string, number> = {}
  for (const [e, n] of Object.entries(cation.comp)) {
    out[e] = (out[e] ?? 0) + n * nCat
  }
  for (const [e, n] of Object.entries(anion.comp)) {
    out[e] = (out[e] ?? 0) + n * nAn
  }
  return out
}
