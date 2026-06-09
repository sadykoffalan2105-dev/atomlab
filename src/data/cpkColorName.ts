/** Человекочитаемое название CPK-цвета по hex (RU / EN). */

type Locale = 'ru' | 'en' | 'uz'

type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

function parseHex(hex: string): Rgb | null {
  const clean = hex.replace(/^#/, '').trim()
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: h * 360, s, l }
}

/** Точные названия типовых CPK-цветов из справочника элементов. */
const EXACT: Record<string, { ru: string; en: string }> = {
  FFFFFF: { ru: 'Белый', en: 'White' },
  D9FFFF: { ru: 'Бледно-голубой', en: 'Pale cyan' },
  CC80FF: { ru: 'Светло-фиолетовый', en: 'Light purple' },
  C88033: { ru: 'Медно-коричневый', en: 'Copper brown' },
  FFD98F: { ru: 'Золотисто-жёлтый', en: 'Golden yellow' },
  C0C0C0: { ru: 'Серебристо-серый', en: 'Silver gray' },
  '909090': { ru: 'Серый (углерод CPK)', en: 'Gray (CPK carbon)' },
  FF8000: { ru: 'Оранжевый', en: 'Orange' },
  FFFF30: { ru: 'Жёлтый', en: 'Yellow' },
  '3050F8': { ru: 'Синий', en: 'Blue' },
  FF0D0D: { ru: 'Красный', en: 'Red' },
  '00FF00': { ru: 'Зелёный', en: 'Green' },
  FFA100: { ru: 'Янтарный', en: 'Amber' },
  B5A642: { ru: 'Латунный', en: 'Brass' },
}

function hueName(h: number, locale: Locale): string {
  const ru =
    h < 15 || h >= 345
      ? 'красный'
      : h < 40
        ? 'оранжевый'
        : h < 65
          ? 'жёлтый'
          : h < 150
            ? 'зелёный'
            : h < 195
              ? 'бирюзовый'
              : h < 250
                ? 'синий'
                : h < 290
                  ? 'фиолетовый'
                  : h < 330
                    ? 'розовый'
                    : 'красный'
  const en =
    h < 15 || h >= 345
      ? 'red'
      : h < 40
        ? 'orange'
        : h < 65
          ? 'yellow'
          : h < 150
            ? 'green'
            : h < 195
              ? 'cyan'
              : h < 250
                ? 'blue'
                : h < 290
                  ? 'purple'
                  : h < 330
                    ? 'pink'
                    : 'red'
  if (locale === 'en') return en
  return ru
}

function capitalize(s: string, locale: Locale): string {
  if (!s) return s
  return locale === 'en' ? s.charAt(0).toUpperCase() + s.slice(1) : s.charAt(0).toUpperCase() + s.slice(1)
}

function nameFromHsl({ h, s, l }: Hsl, locale: Locale): string {
  const ru = locale !== 'en'
  if (l > 0.94 && s < 0.12) return ru ? 'Белый' : 'White'
  if (l < 0.1) return ru ? 'Чёрный' : 'Black'
  if (s < 0.12) {
    if (l > 0.78) return ru ? 'Светло-серый' : 'Light gray'
    if (l > 0.45) return ru ? 'Серый' : 'Gray'
    return ru ? 'Тёмно-серый' : 'Dark gray'
  }
  const base = hueName(h, locale)
  if (l > 0.78) return capitalize(ru ? `светло-${base}` : `light ${base}`, locale)
  if (l < 0.32) return capitalize(ru ? `тёмно-${base}` : `dark ${base}`, locale)
  return capitalize(base, locale)
}

export function cpkColorName(hex: string, locale: Locale = 'ru'): string {
  const key = hex.replace(/^#/, '').toUpperCase()
  const exact = EXACT[key]
  if (exact) return locale === 'en' ? exact.en : exact.ru
  const rgb = parseHex(key)
  if (!rgb) return locale === 'en' ? 'Unknown' : 'Неизвестный'
  return nameFromHsl(rgbToHsl(rgb), locale)
}
