/**
 * Перевод единиц для учителя: масса (мг/г/кг/т), объём (мл/л/м³), температура (°C/K/°F).
 * «2 кг в граммы», «сколько миллилитров в 1,5 л», «25 °C в кельвинах», «300 K to celsius».
 */
import { formatNumber, type MathLang } from './safeMath'

type Dim = 'mass' | 'volume' | 'temp'
type UnitId = 'mg' | 'g' | 'kg' | 't' | 'ml' | 'l' | 'm3' | 'C' | 'K' | 'F'

const UNIT: Record<UnitId, { dim: Dim; factor: number }> = {
  mg: { dim: 'mass', factor: 1e-3 },
  g: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1e3 },
  t: { dim: 'mass', factor: 1e6 },
  ml: { dim: 'volume', factor: 1e-3 },
  l: { dim: 'volume', factor: 1 },
  m3: { dim: 'volume', factor: 1e3 },
  C: { dim: 'temp', factor: 1 },
  K: { dim: 'temp', factor: 1 },
  F: { dim: 'temp', factor: 1 },
}

/** Порядок важен: длинные формы раньше коротких. */
const ALIASES: [RegExp, UnitId][] = [
  [/^(миллиграмм\p{L}*|мг|mg|milligram\p{L}*|milligramm\p{L}*)$/u, 'mg'],
  [/^(килограмм\p{L}*|кг|kg|kilogram\p{L}*|kilogramm\p{L}*|kilo)$/u, 'kg'],
  [/^(грамм\p{L}*|гр|г|g|gr|gram\p{L}*|gramm\p{L}*)$/u, 'g'],
  [/^(тонн\p{L}*|т|tonn\p{L}*|ton\p{L}*|t)$/u, 't'],
  [/^(миллилитр\p{L}*|мл|ml|millilit\p{L}*|см3|см³|cm3|cm³)$/u, 'ml'],
  [/^(литр\p{L}*|л|l|lit\p{L}*|litr\p{L}*|дм3|дм³|dm3|dm³)$/u, 'l'],
  [/^(кубометр\p{L}*|м3|м³|m3|m³)$/u, 'm3'],
  [/^(°?c|°?с|цельси\p{L}*|celsius|selsiy|градус\p{L}*)$/u, 'C'],
  [/^(k|к|кельвин\p{L}*|kelvin\p{L}*)$/u, 'K'],
  [/^(°?f|фаренгейт\p{L}*|fahrenheit|farengeyt)$/u, 'F'],
]

function unitOf(word: string): UnitId | null {
  const w = word.toLowerCase().replace(/ё/g, 'е').replace(/\.$/, '')
  for (const [re, id] of ALIASES) if (re.test(w)) return id
  return null
}

const NAMES: Record<MathLang, Record<UnitId, string>> = {
  ru: { mg: 'мг', g: 'г', kg: 'кг', t: 'т', ml: 'мл', l: 'л', m3: 'м³', C: '°C', K: 'K', F: '°F' },
  en: { mg: 'mg', g: 'g', kg: 'kg', t: 't', ml: 'ml', l: 'l', m3: 'm³', C: '°C', K: 'K', F: '°F' },
  uz: { mg: 'mg', g: 'g', kg: 'kg', t: 't', ml: 'ml', l: 'l', m3: 'm³', C: '°C', K: 'K', F: '°F' },
}

function toKelvin(v: number, u: UnitId): number {
  if (u === 'K') return v
  if (u === 'C') return v + 273.15
  return ((v - 32) * 5) / 9 + 273.15
}

function fromKelvin(k: number, u: UnitId): number {
  if (u === 'K') return k
  if (u === 'C') return k - 273.15
  return ((k - 273.15) * 9) / 5 + 32
}

export interface UnitAnswer {
  value: number
  from: UnitId
  to: UnitId
  result: number
  text: string
}

const UNIT_WORD = String.raw`(°\s*[cCсСfF]|[\p{L}°]+[3³]?)`

/** Разобрать запрос на перевод единиц. */
export function convertUnitsQuery(raw: string, lang: MathLang): UnitAnswer | null {
  const t = raw
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/−/g, '-')
    .replace(/(градус\p{L}*|degrees?)\s+(по\s+)?(цельси\p{L}*|celsius)/giu, '°C')
    .replace(/(градус\p{L}*|degrees?)\s+(по\s+)?(фаренгейт\p{L}*|fahrenheit)/giu, '°F')
  // «2 кг в граммы», «25 °C в кельвины», «300 K to celsius», «1.5 l ml ga»
  const direct = new RegExp(String.raw`(-?\d+(?:\.\d+)?)\s*${UNIT_WORD}\s*(?:в|во|to|in|into|->|→|=|ga|da)\s+${UNIT_WORD}`, 'iu')
  // «сколько граммов в 2 кг», «how many ml in 2 l», «2 kg necha gramm»
  const reverse = new RegExp(String.raw`(?:сколько|how\s+many|how\s+much|nechta|necha)\s+${UNIT_WORD}\s+(?:в|во|in|is|are\s+in)\s+(-?\d+(?:\.\d+)?)\s*${UNIT_WORD}`, 'iu')
  let value: number | null = null
  let from: UnitId | null = null
  let to: UnitId | null = null
  const m1 = t.match(direct)
  if (m1) {
    value = Number(m1[1])
    from = unitOf(m1[2]!.replace(/\s+/g, ''))
    to = unitOf(m1[3]!.replace(/\s+/g, ''))
  }
  if (!from || !to) {
    const m2 = t.match(reverse)
    if (m2) {
      to = unitOf(m2[1]!)
      value = Number(m2[2])
      from = unitOf(m2[3]!.replace(/\s+/g, ''))
    }
  }
  if (value === null || !Number.isFinite(value) || !from || !to || from === to) return null
  if (UNIT[from].dim !== UNIT[to].dim) return null
  const dim = UNIT[from].dim
  const result = dim === 'temp' ? fromKelvin(toKelvin(value, from), to) : (value * UNIT[from].factor) / UNIT[to].factor
  if (dim === 'temp' && toKelvin(value, from) < 0) {
    const text =
      lang === 'en'
        ? 'That temperature is below absolute zero (0 K = −273.15 °C) — nothing can be colder, so let us check the number.'
        : lang === 'uz'
          ? 'Bu harorat absolyut noldan past (0 K = −273,15 °C) — undan sovuq boʻlmaydi, sonni tekshirib koʻraylik.'
          : 'Такая температура ниже абсолютного нуля (0 K = −273,15 °C) — холоднее не бывает. Давай проверим число.'
    return { value, from, to, result, text }
  }
  const n = NAMES[lang]
  const line = `${formatNumber(value, lang)} ${n[from]} = ${formatNumber(result, lang)} ${n[to]}`
  let rule: string
  if (dim === 'temp') {
    rule =
      lang === 'en'
        ? 'Rule: T(K) = t(°C) + 273.15; °F = °C × 9/5 + 32.'
        : lang === 'uz'
          ? 'Qoida: T(K) = t(°C) + 273,15; °F = °C × 9/5 + 32.'
          : 'Правило: T(K) = t(°C) + 273,15; а °F = °C × 9/5 + 32.'
  } else {
    const k = UNIT[from].factor / UNIT[to].factor
    const big = k >= 1
    const f = formatNumber(big ? k : 1 / k, lang)
    rule =
      lang === 'en'
        ? big
          ? `1 ${n[from]} = ${f} ${n[to]}, so we multiply by ${f}.`
          : `1 ${n[to]} = ${f} ${n[from]}, so we divide by ${f}.`
        : lang === 'uz'
          ? big
            ? `1 ${n[from]} = ${f} ${n[to]}, shuning uchun ${f} ga koʻpaytiramiz.`
            : `1 ${n[to]} = ${f} ${n[from]}, shuning uchun ${f} ga boʻlamiz.`
          : big
            ? `1 ${n[from]} = ${f} ${n[to]}, поэтому умножаем на ${f}.`
            : `1 ${n[to]} = ${f} ${n[from]}, поэтому делим на ${f}.`
  }
  return { value, from, to, result, text: `${line}. ${rule}` }
}
