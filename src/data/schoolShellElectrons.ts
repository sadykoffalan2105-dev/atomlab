import { toFullElectronConfiguration } from './electronConfigExpand'

/** Числа электронов на внешних оболочках (как справа в школьной ПСХЭ). */
export function schoolShellElectronCounts(abbrevConfig: string | undefined | null): number[] {
  const full = toFullElectronConfiguration(abbrevConfig)
  if (full === '—') return []

  const shellTotals = new Map<number, number>()
  const re = /(\d+)([spdf])(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(full))) {
    const n = Number(m[1])
    const count = Number(m[3])
    if (!Number.isFinite(n) || !Number.isFinite(count)) continue
    shellTotals.set(n, (shellTotals.get(n) ?? 0) + count)
  }

  const levels = [...shellTotals.keys()].sort((a, b) => a - b)
  if (levels.length === 0) return []
  if (levels.length <= 3) return levels.map((n) => shellTotals.get(n) ?? 0)
  return levels.slice(-3).map((n) => shellTotals.get(n) ?? 0)
}
