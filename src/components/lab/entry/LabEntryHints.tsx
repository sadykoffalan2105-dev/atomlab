import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Ease } from '../../../lab/cinema/core/easing'
import { useT } from '../../../i18n/useT'
import type { AppThemeId } from '../../../theme/appTheme'
import type { EntryRuntime } from './labEntryRuntime'
import { BELT_COMPOUND_BY_ID } from './labEntryBelt'

/**
 * Подписи экрана входа — отдельный DOM-слой, а не 3D-текст.
 *
 * Шрифт troika (drei/Text) в этом проекте не держит подстрочных индексов:
 * `sceneText()` в `cinema/core/glyphs.ts` принудительно приводит «H₂O» к «H2O»,
 * иначе в кадре будут квадраты. Для первого экрана продукта это неприемлемо,
 * поэтому подписи рисует DOM — по образцу `CinemaDomLabels`, но своим слоем:
 * там фиксированная карта стилей KIND_STYLE, и это общая зона кино-ядра.
 *
 * Правила образца соблюдены: узлы создаются один раз, кадр пишет в style
 * только реально изменившееся, getBoundingClientRect в кадре нет, размер
 * канваса берётся из стора R3F. Подписи стоят по краям кадра в CSS, так что
 * проецировать 3D-точки каждый кадр не нужно вовсе.
 *
 * Раскладка считается от РЕАЛЬНЫХ соседей, а не на глаз:
 *   • заголовок опущен ниже полосы .rightHud (сегмент «Неорганика | Органика»
 *     и кнопка синтеза стоят fixed на высоте шапка+14 px, высота ~44 px) —
 *     на 1280×800 они раньше стояли с заголовком в одной строке;
 *   • чип-подсказка на телефоне поднят НАД кнопкой ⊞ (fixed, 48 px, отступ
 *     12 px) — иначе последнее слово упиралось в её грань.
 *
 * Текст идёт через useT(): контекст локали доходит внутрь Canvas (доказано
 * ReactorTermsPreview). Формулы мимо t() — химическая нотация одинакова в
 * ru/en/uz, ровно как cpkChargeLabel в cpkAtomVisual.ts.
 */

/** Ширина, ниже которой кнопка ⊞ и подписи делят низ кадра. */
const FAB_WIDTH_PX = 760
/** Высота кнопки ⊞ с отступом: 48 + 12 снизу + 12 воздуха. */
const FAB_CLEARANCE_PX = 72
/** Заголовок ниже полосы .rightHud (fixed, шапка + 14 px, высота ~44 px). */
const TITLE_TOP_PX = 78
/** На телефоне полоса разделов стоит над канвасом — заголовку место у верхней кромки. */
const TIGHT_TITLE_TOP_PX = 26

const ACCENT: Record<
  AppThemeId,
  { title: string; equation: string; product: string; hint: string; hintBg: string; hintEdge: string; shadow: string }
> = {
  dark: {
    title: 'rgba(214, 228, 255, 0.92)',
    equation: 'rgba(146, 176, 236, 0.86)',
    product: '#eaf3ff',
    hint: 'rgba(196, 216, 250, 0.9)',
    hintBg: 'rgba(10, 18, 42, 0.55)',
    hintEdge: 'rgba(120, 160, 240, 0.28)',
    shadow: '0 1px 14px rgba(2, 6, 20, 0.85)',
  },
  // Светлая тема: фон сцены дневной, поэтому подписи ТЁМНЫЕ, а тень — светлая
  // (ореол), иначе тонкие буквы на светлом расплываются.
  light: {
    title: 'rgba(23, 34, 62, 0.94)',
    equation: 'rgba(46, 66, 110, 0.88)',
    product: '#111c38',
    hint: 'rgba(28, 41, 72, 0.94)',
    hintBg: 'rgba(255, 255, 255, 0.72)',
    hintEdge: 'rgba(90, 124, 190, 0.34)',
    shadow: '0 1px 12px rgba(236, 243, 255, 0.9)',
  },
}

type Node = { el: HTMLDivElement; text: string; opacity: number }

type HintNodes = { title: Node; equation: Node; product: Node; hint: Node }

/** Тема меняет тон подписей и направление тени: на светлом фоне тень светлая. */
function applyHintTheme(n: HintNodes, theme: AppThemeId): void {
  const a = ACCENT[theme]
  n.title.el.style.color = a.title
  n.title.el.style.textShadow = a.shadow
  n.equation.el.style.color = a.equation
  n.equation.el.style.textShadow = a.shadow
  n.product.el.style.color = a.product
  n.product.el.style.textShadow =
    theme === 'light' ? `0 0 16px rgba(255,255,255,0.95), ${a.shadow}` : `0 0 18px rgba(90,150,255,0.45), ${a.shadow}`
  n.hint.el.style.color = a.hint
  n.hint.el.style.background = a.hintBg
  n.hint.el.style.borderColor = a.hintEdge
}

/** Низ кадра делится с кнопкой ⊞: на телефоне чип встаёт над ней и переносится по словам. */
function applyHintLayout(n: HintNodes, width: number): void {
  const tight = width > 0 && width < FAB_WIDTH_PX
  // Заголовок на телефоне поднят к самому верху кадра: полоса разделов
  // (Неорганика | Органика | Синтез) там уходит НАД канвас, и место свободно.
  n.title.el.style.top = tight ? `${TIGHT_TITLE_TOP_PX}px` : `${TITLE_TOP_PX}px`
  n.equation.el.style.top = tight
    ? `calc(${TIGHT_TITLE_TOP_PX}px + 2.05em)`
    : `calc(${TITLE_TOP_PX}px + 2.1em)`
  n.hint.el.style.bottom = tight ? `${FAB_CLEARANCE_PX}px` : '6%'
  n.hint.el.style.whiteSpace = tight ? 'normal' : 'nowrap'
  n.hint.el.style.maxWidth = tight ? 'calc(100% - 40px)' : 'calc(100% - 32px)'
  n.hint.el.style.lineHeight = tight ? '1.35' : '1.2'
  n.product.el.style.bottom = tight ? '22%' : '14%'
}

function makeNode(css: string): Node {
  const el = document.createElement('div')
  el.style.cssText = css
  return { el, text: '', opacity: -1 }
}

function setText(n: Node, value: string): void {
  if (n.text === value) return
  n.el.textContent = value
  n.text = value
}

function setOpacity(n: Node, value: number): void {
  const v = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100
  if (v === n.opacity) return
  n.el.style.opacity = String(v)
  n.opacity = v
}

const BASE =
  'position:absolute; left:50%; transform:translateX(-50%); white-space:nowrap; opacity:0;' +
  'will-change:opacity; text-align:center; max-width:calc(100% - 32px); overflow:hidden; text-overflow:ellipsis;'

export type LabEntryHintsProps = {
  runtime: EntryRuntime
  theme: AppThemeId
  compact: boolean
  beltHoverRef: { current: string | null }
}

export function LabEntryHints({ runtime, theme, compact, beltHoverRef }: LabEntryHintsProps) {
  const gl = useThree((s) => s.gl)
  const width = useThree((s) => s.size.width)
  const { t } = useT()
  const tRef = useRef(t)
  tRef.current = t
  const nodes = useRef<HintNodes | null>(null)
  const themeRef = useRef(theme)
  themeRef.current = theme
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    const host = gl.domElement.parentElement
    if (!host) return
    const layer = document.createElement('div')
    layer.setAttribute('role', 'img')
    layer.style.cssText =
      'position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:3; contain:strict;' +
      'font-family:"Inter", system-ui, -apple-system, sans-serif;'
    // Заголовок стоит ниже полосы .rightHud (fixed, шапка + 14 px, высота ~44 px):
    // проценты от высоты канваса на 1280×800 ставили его ровно в ту же строку.
    const title = makeNode(
      BASE + `top:${TITLE_TOP_PX}px; font-size:clamp(14px, 1.5vw, 19px); font-weight:650;` +
        'letter-spacing:0.012em;',
    )
    const equation = makeNode(
      BASE + `top:calc(${TITLE_TOP_PX}px + 2.1em); font-size:clamp(12px, 1.15vw, 15px);` +
        'font-weight:600; letter-spacing:0.09em;',
    )
    const product = makeNode(
      // Название вещества — главная строка кадра: на телефоне не мельче 16 px.
      BASE + 'bottom:14%; font-size:clamp(16px, 1.7vw, 22px); font-weight:680; letter-spacing:0.014em;',
    )
    // Нижняя граница кегля 12 px: 10.5 px на телефоне не читается.
    const hint = makeNode(
      BASE + 'bottom:6%; font-size:clamp(12px, 1.05vw, 13.5px); font-weight:560; letter-spacing:0.01em;' +
        'padding:5px 12px; border-radius:999px; border:1px solid transparent; backdrop-filter:blur(6px);',
    )
    layer.append(title.el, equation.el, product.el, hint.el)
    host.appendChild(layer)
    const created: HintNodes = { title, equation, product, hint }
    applyHintTheme(created, themeRef.current)
    applyHintLayout(created, widthRef.current)
    nodes.current = created
    return () => {
      nodes.current = null
      layer.remove()
    }
  }, [gl])

  useEffect(() => {
    const n = nodes.current
    if (n) applyHintTheme(n, theme)
  }, [theme])

  useEffect(() => {
    const n = nodes.current
    if (n) applyHintLayout(n, width)
  }, [width])

  // Описание сцены для скринридера: обновляется только при смене локали.
  useEffect(() => {
    const n = nodes.current
    if (!n) return
    const layer = n.title.el.parentElement
    if (layer) layer.setAttribute('aria-label', t('lab.entry.a11y'))
  }, [t])

  useFrame(() => {
    const n = nodes.current
    if (!n) return
    const rt = runtime
    const tr = tRef.current
    const intro = rt.intro
    const spec = rt.spec

    if (rt.reduced) {
      setText(n.title, tr('lab.entry.title'))
      setText(n.equation, spec.equation)
      setText(n.product, `${tr(spec.nameKey)} · ${spec.formula}`)
      setText(n.hint, tr('lab.entry.reduced'))
      setOpacity(n.title, intro)
      setOpacity(n.equation, intro * (compact ? 0.68 : 0.78))
      setOpacity(n.product, intro)
      setOpacity(n.hint, intro * 0.9)
      return
    }

    const made = rt.phase === 'form' || rt.phase === 'present' || rt.phase === 'fade'
    // Название продукта проявляется ВМЕСТЕ со связями и гаснет вместе с ними.
    const named =
      rt.phase === 'form'
        ? Ease.outQuad(rt.local01)
        : rt.phase === 'fade'
          ? 1 - Ease.inQuad(rt.local01)
          : rt.phase === 'present'
            ? 1
            : 0

    setText(n.title, tr('lab.entry.title'))
    setText(n.equation, spec.equation)

    // Молекула под указателем всегда важнее сюжета: пока на неё смотрят,
    // крупная строка показывает ЕЁ название и формулу.
    const hovered = beltHoverRef.current
    const belt = hovered ? BELT_COMPOUND_BY_ID[hovered] : undefined
    if (belt) {
      setText(n.product, `${tr(belt.nameKey)} · ${belt.formula}`)
    } else {
      setText(n.product, made ? `${tr(spec.nameKey)} · ${spec.formula}` : spec.equation)
    }

    const key = hovered ? 'lab.entry.belt' : made ? 'lab.entry.drag' : 'lab.entry.hold'
    setText(n.hint, tr(key))

    // Заголовок виден и на телефоне: первый экран продукта не может открываться
    // без единой строки о том, что здесь происходит. Полоса разделов на узком
    // экране уходит над канвасом, так что место под ним свободно.
    setOpacity(n.title, intro * 0.95)
    // Уравнение вверху гаснет, когда продукт уже назван внизу, — иначе две
    // строки об одном и том же спорят друг с другом.
    setOpacity(n.equation, intro * (made ? 0.24 : compact ? 0.7 : 0.8))
    setOpacity(n.product, belt ? intro : intro * named)
    // Подсказка «задержите палец» разгорается, пока «магнит» работает.
    setOpacity(n.hint, intro * (hovered ? 1 : made ? 0.88 : 0.66 + 0.32 * rt.boost))
  })

  return null
}
