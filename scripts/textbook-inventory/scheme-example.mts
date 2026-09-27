/**
 * Общая схема учебника (R, Me, Hal) или формула с «n» (полимер, олеум, ржавчина) открывается в реакторе по конкретному
 * примеру самого учебника — поле labExample карточки: «2MeCl → 2Me + Cl₂» — «2NaCl → 2Na + Cl₂» (с. 140),
 * «(C₆H₁₀O₅)ₙ + nH₂O → nC₆H₁₂O₆» — на одно звено «C₆H₁₀O₅ + H₂O → C₆H₁₂O₆».
 * Общие функции build-book-reader.mts (10–11 классы), build-curated-equations.mts (7–9) и scripts/test-book-schemes.mts.
 */
import { reactorHrefForEquation, resolveReactorEquation, type ReactorLinkResult } from '../../src/lab/reactorDeepLink.ts'

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const asciiDigits = (s: string) => s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))

/** ASCII-запись примера: цифры, стрелки «->» / «<=>». */
export function exampleAscii(example: string): string {
  return asciiDigits(example)
    .replace(/→|⟶/g, '->')
    .replace(/⇄|⇌/g, '<=>')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Записи примера для реактора: как есть, затем у каждого вещества — без радикальной точки («Cl•», «CH₃*») и без
 * знаков связей («CH₃–C≡CH», «CH₂Cl-CH₂Cl»): реактор узнаёт вещество по составу (гидратная точка «·5H₂O» остаётся).
 */
export function reactorExampleTexts(example: string): string[] {
  const ascii = exampleAscii(example)
  const parts = ascii.split(/\s*(<=>|->)\s*/)
  if (parts.length !== 3) return [ascii]
  const term = (t: string) => {
    const m = /^(\d+)(?=[A-Z(\[])/.exec(t)
    const core = (m ? t.slice(m[1]!.length) : t)
      .replace(/^[•·∙*]+|[•·∙*]+$/g, '')
      .replace(/(?<=[A-Za-z0-9)\]])[-‐‑–—=≡]+(?=[A-Z(\[])/g, '')
    return `${m ? m[1] : ''}${core}`
  }
  const side = (s: string) => s.split(/\s+\+\s+/).map((t) => term(t.trim())).join(' + ')
  const plain = `${side(parts[0]!)} ${parts[1]} ${side(parts[2]!)}`
  return [...new Set([ascii, plain])]
}

/** Пример для карточки: «2NaCl → 2Na + Cl₂», «C₆H₁₀O₅», радикал «Cl*» → «Cl•», гидрат «H₂SO₄*SO₃» → «H₂SO₄·SO₃». */
export function exampleDisplay(example: string): string {
  return exampleAscii(example)
    .replace(/<=>/g, '⇌')
    .replace(/->/g, '→')
    .replace(/\*(?=\s|$)/g, '•')
    .replace(/(?<=[A-Za-z0-9)\]])\*(?=\d*[A-Z(])/g, '·')
    .replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((x) => SUB[Number(x)]).join(''))
}

export type ExampleLab = { ok: true; href: string; example: string }

/**
 * Результат реактора для примера: первая запись, которую реактор собирает; иначе самый понятный отказ — «нет вещества»
 * (organic / unknownSubstance с формулами) важнее «не разобрать запись» (scheme у «CH₃•», «CH₂Cl-CH₂Cl»).
 */
export function resolveExample(example: string): { text: string; res: ReactorLinkResult } {
  const texts = reactorExampleTexts(example)
  let fail: { text: string; res: ReactorLinkResult } | null = null
  for (const text of texts) {
    const res = resolveReactorEquation({ equation: text })
    if (res.ok) return { text, res }
    if (!fail || (fail.res.ok === false && fail.res.code === 'scheme' && res.code !== 'scheme')) fail = { text, res }
  }
  return fail!
}

/** Ссылка в реактор на пример схемы; null — примера нет или реактор его пока не собирает (вещества нет в реакторе). */
export function exampleLab(example: string | null | undefined, src: string): ExampleLab | null {
  const ex = example?.trim()
  if (!ex) return null
  const { text, res } = resolveExample(ex)
  return res.ok ? { ok: true, href: reactorHrefForEquation(text, { src }), example: exampleDisplay(ex) } : null
}
