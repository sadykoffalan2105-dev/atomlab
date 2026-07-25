/**
 * ATOMLAB Cinema — безопасные глифы для 3D-текста.
 *
 * Текст в сцене рисует troika (drei/Text) по SDF-атласу одного шрифта, и в нём
 * нет ни подстрочных цифр (₂), ни надстрочных знаков заряда (⁻, ⁺): вместо них
 * на экране появляются пустые квадраты. Догрузить шрифт с нужными глифами
 * нельзя — приложение работает офлайн в Electron.
 *
 * Поэтому раскадровки пишутся химически правильно («2 NaClO₂ + Cl₂», «e⁻»),
 * а на входе в 3D-текст строка приводится к набору, который шрифт заведомо
 * покрывает: латиница, кириллица, цифры и базовая пунктуация. В DOM-интерфейсе
 * лаборатории остаются настоящие индексы — там шрифт системный.
 */

const SUBSCRIPT_ZERO = '₀'.codePointAt(0)!
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** Приводит химическую строку к глифам, доступным шрифту 3D-текста. */
export function sceneText(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code >= SUBSCRIPT_ZERO && code <= SUBSCRIPT_ZERO + 9) {
      out += String(code - SUBSCRIPT_ZERO)
      continue
    }
    const sup = SUPERSCRIPT_DIGITS.indexOf(ch)
    if (sup >= 0) {
      out += String(sup)
      continue
    }
    switch (ch) {
      case '⁻':
      case '−':
      case '–':
      case '—':
        out += '-'
        break
      case '⁺':
        out += '+'
        break
      case '↓':
        out += 'v'
        break
      case '↑':
        out += '^'
        break
      default:
        out += ch
    }
  }
  return out
}

/** Диапазоны, которые шрифт 3D-текста покрывает гарантированно. */
const SAFE = /^[\u0020-\u007E\u00A0-\u00FF\u0400-\u04FF\u2192\u2248]*$/u

/** Проверка для тестов раскадровки: после приведения не осталось «квадратов». */
export function isSceneTextSafe(text: string): boolean {
  return SAFE.test(sceneText(text))
}
