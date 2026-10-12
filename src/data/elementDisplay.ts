/**
 * Стандартные атомные массы IUPAC/CIAAW 2021 (сокращённые до 5 значащих цифр; для интервалов — условное значение)
 * там, где выгрузка PubChem в periodicTableRaw.json округлена: Li «7», Fe «55.84», Zn «65.4», Pb «207».
 * Таблица показывала их как «7.0000», «55.840», «65.400», «207.00» — ложная точность и неверная химия.
 * Только для показа: расчёты (Mr каталога, база ИИ-учителя) идут по ELEMENTS, разница ≤ 0,06.
 */
const IUPAC_ATOMIC_MASS: Readonly<Record<string, number>> = {
  Li: 6.94,
  S: 32.06,
  Ar: 39.95,
  Ca: 40.078,
  Fe: 55.845,
  Cu: 63.546,
  Zn: 65.38,
  Br: 79.904,
  Kr: 83.798,
  Zr: 91.224,
  Ru: 101.07,
  Sm: 150.36,
  Gd: 157.25,
  Os: 190.23,
  Pb: 207.2,
}

/** Отображение относительной атомной массы как в ячейках ПСХЭ (symbol — подставить стандартное значение IUPAC). */
export function massDisplay(mass: number, symbol?: string): string {
  const m = (symbol ? IUPAC_ATOMIC_MASS[symbol] : undefined) ?? mass
  // Школьный формат: короче, чтобы номер и масса читались в ячейке. Без дописанных нулей:
  // 6.94 → «6.94», а не «6.9400» (лишние нули выдают точность, которой у значения нет).
  const fixed = m < 10 ? m.toFixed(4) : m < 100 ? m.toFixed(3) : m.toFixed(2)
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed
}
