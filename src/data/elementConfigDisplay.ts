/** Разбор полной электронной конфигурации для диаграммы оболочек и токенов. */
export type ElectronOrbitalToken = {
  n: number
  subshell: string
  count: number
  label: string
}

const ORBITAL_RE = /(\d)([spdf])(\d+)/g

export function parseElectronConfigTokens(fullConfig: string): ElectronOrbitalToken[] {
  if (!fullConfig || fullConfig === '—') return []
  const clean = fullConfig.replace(/\([^)]*\)/g, '').trim()
  const tokens: ElectronOrbitalToken[] = []
  let m: RegExpExecArray | null
  ORBITAL_RE.lastIndex = 0
  while ((m = ORBITAL_RE.exec(clean)) !== null) {
    const n = Number(m[1])
    const subshell = m[2]!
    const count = Number(m[3])
    if (!Number.isFinite(n) || !Number.isFinite(count)) continue
    tokens.push({ n, subshell, count, label: `${n}${subshell}${count}` })
  }
  return tokens
}

/** Число электронов на главной квантовой оболочке n (модель Бора). */
export function bohrShellCountsFromConfig(fullConfig: string): number[] {
  const byN = new Map<number, number>()
  for (const t of parseElectronConfigTokens(fullConfig)) {
    byN.set(t.n, (byN.get(t.n) ?? 0) + t.count)
  }
  if (byN.size === 0) return []
  const maxN = Math.max(...byN.keys())
  const out: number[] = []
  for (let n = 1; n <= maxN; n++) out.push(byN.get(n) ?? 0)
  return out
}

export function parseOxidationStates(raw: string): string[] {
  if (!raw || raw === '—') return []
  return raw
    .split(/[,;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatKelvinToCelsius(k: number | null | undefined, locale: 'ru' | 'en' | 'uz'): string {
  if (k == null || !Number.isFinite(k) || k <= 0) return '—'
  const c = Math.round(k - 273.15)
  return locale === 'en' ? `${c} °C (${Math.round(k)} K)` : `${c} °C (${Math.round(k)} K)`
}

/** Т. плавления; при mp > bp (As и др.) — плавление возможно лишь под давлением. */
export function formatMeltingPoint(
  k: number | null | undefined,
  locale: 'ru' | 'en' | 'uz',
  boilingK?: number | null,
): string {
  if (k == null || !Number.isFinite(k) || k <= 0) return '—'
  const base = formatKelvinToCelsius(k, locale)
  if (boilingK != null && boilingK > 0 && k > boilingK) {
    return locale === 'en' ? `${base} (under pressure)` : `${base} (под давлением)`
  }
  return base
}

/** Т. кипения; при mp ≥ bp — на самом деле температура возгонки при н. у. */
export function formatBoilingPoint(
  k: number | null | undefined,
  locale: 'ru' | 'en' | 'uz',
  meltingK?: number | null,
): string {
  if (k == null || !Number.isFinite(k) || k <= 0) return '—'
  const base = formatKelvinToCelsius(k, locale)
  if (meltingK != null && meltingK > 0 && meltingK >= k) {
    return locale === 'en' ? `${base} (sublimation at STP)` : `${base} (возгонка при н. у.)`
  }
  return base
}

function formatGramsPerLiter(gPerL: number): string {
  if (gPerL >= 10) return gPerL.toFixed(1)
  if (gPerL >= 1) return gPerL.toFixed(2)
  if (gPerL >= 0.1) return gPerL.toFixed(3)
  return gPerL.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

export function formatDensity(
  d: number | null | undefined,
  opts?: { standardState?: string; locale?: 'ru' | 'en' | 'uz' },
): string {
  if (d == null || !Number.isFinite(d) || d <= 0) return '—'

  const state = opts?.standardState?.trim().toLowerCase() ?? ''
  const isGas = state === 'gas'
  const locale = opts?.locale ?? 'ru'

  // Газы при н. у.: в справочнике плотность в g/cm³ очень мала (≈10⁻⁴–10⁻³).
  if (d < 0.01) {
    const gPerL = d * 1000
    const note =
      locale === 'en'
        ? isGas
          ? ' (gas, STP)'
          : ' (STP)'
        : isGas
          ? ' (газ, н. у.)'
          : ' (н. у.)'
    return `${formatGramsPerLiter(gPerL)} g/L${note}`
  }

  if (d < 1) {
    const trimmed = d.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    return `${trimmed} g/cm³`
  }

  return `${d.toFixed(d < 10 ? 2 : 1)} g/cm³`
}

export function formatElectronegativity(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—'
  return v.toFixed(2)
}
