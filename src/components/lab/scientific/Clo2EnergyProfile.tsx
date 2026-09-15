import { useEffect, useId, useRef } from 'react'
import {
  CLO2_ENERGETICS,
  CLO2_PROFILE_MAIN,
  clo2ProfilePoint,
  clo2ProfilePosAt,
  clo2ProfilePosAtStepEnd,
  type Clo2ProfilePoint,
} from '../../../lab/cinema/scenes/clo2/clo2Energetics'
import { getClo2MechanismText, type Clo2Locale } from '../../../lab/cinema/scenes/clo2/clo2MechanismText'
import { clo2Playhead } from '../../../lab/cinema/scenes/clo2/clo2StepStore'
import styles from './Clo2EnergyProfile.module.css'

/**
 * Энергетический профиль урока ClO₂ — компактная SVG-диаграмма для панели шагов.
 *
 * Честность рисунка (см. clo2Energetics.ts):
 *   • сплошные маркеры — уровни из измерений (ΔG°) и барьеры, пересчитанные из k;
 *   • пунктир у ям ClOClO и комплекса — их глубина не измерена;
 *   • барьеры подписаны от своих реагентов (скобки), а не от общего нуля;
 *   • после комплекса — тонкая хлоратная ветка с долей канала.
 *
 * Бегунок синхронизирован со story time: requestAnimationFrame читает
 * clo2Playhead и двигает кружок через SVG DOM (cx.baseVal) — без setState на кадр.
 */

type Bezier = { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }

type PlacedPoint = { p: Clo2ProfilePoint; x: number; y: number }

type Layout = {
  w: number
  h: number
  left: number
  right: number
  top: number
  bottom: number
  zeroY: number
  main: readonly PlacedPoint[]
  /** сегменты между соседними точками основного пути; индекс = целая часть позиции бегунка */
  segs: readonly Bezier[]
  solidD: string
  dashedD: string
  glowD: string
  branch: PlacedPoint
  branchD: string
  branchEndX: number
}

/** Доля dx для горизонтальных касательных: в каждой стационарной точке наклон 0. */
const HANDLE = 0.46
const G_MAX = 50

function f1(v: number): string {
  return v.toFixed(1)
}

function bezierBetween(a: { x: number; y: number }, b: { x: number; y: number }): Bezier {
  const dx = (b.x - a.x) * HANDLE
  return { x0: a.x, y0: a.y, x1: a.x + dx, y1: a.y, x2: b.x - dx, y2: b.y, x3: b.x, y3: b.y }
}

/** Половина кривой Безье (де Кастельжо в t = 0,5) — как подпуть «M … C …». */
function halfBezierD(s: Bezier, second: boolean): string {
  const ax = (s.x0 + s.x1) / 2
  const ay = (s.y0 + s.y1) / 2
  const bx = (s.x1 + s.x2) / 2
  const by = (s.y1 + s.y2) / 2
  const cx = (s.x2 + s.x3) / 2
  const cy = (s.y2 + s.y3) / 2
  const abx = (ax + bx) / 2
  const aby = (ay + by) / 2
  const bcx = (bx + cx) / 2
  const bcy = (by + cy) / 2
  const mx = (abx + bcx) / 2
  const my = (aby + bcy) / 2
  return second
    ? `M${f1(mx)} ${f1(my)}C${f1(bcx)} ${f1(bcy)} ${f1(cx)} ${f1(cy)} ${f1(s.x3)} ${f1(s.y3)}`
    : `M${f1(s.x0)} ${f1(s.y0)}C${f1(ax)} ${f1(ay)} ${f1(abx)} ${f1(aby)} ${f1(mx)} ${f1(my)}`
}

function bezierD(s: Bezier): string {
  return `C${f1(s.x1)} ${f1(s.y1)} ${f1(s.x2)} ${f1(s.y2)} ${f1(s.x3)} ${f1(s.y3)}`
}

/**
 * Ширина 320 единиц: в панели урока (≈ 310–400 px) единица ≈ 1 px и крупнее,
 * поэтому подписи в 12 единиц не мельче 11 px. Отступы подписей ниже
 * посчитаны под этот кегль (CSS .value / .formula / .note).
 */
function buildLayout(compact: boolean): Layout {
  const w = 320
  const h = compact ? 156 : 224
  const left = compact ? 10 : 30
  const right = w - 8
  const top = compact ? 24 : 30
  const bottom = h - (compact ? 16 : 34)
  // Хлоратная ветка (≈ −96 кДж/моль) ниже продуктов ClO₂ — шкала вмещает её.
  const gMin = compact ? -112 : -124
  const yOf = (g: number) => top + ((G_MAX - g) / (G_MAX - gMin)) * (bottom - top)
  const xOf = (f: number) => left + f * (right - left)
  const place = (p: Clo2ProfilePoint): PlacedPoint => ({ p, x: xOf(p.x), y: yOf(p.drawKJ) })

  const main = CLO2_PROFILE_MAIN.map(place)
  const segs: Bezier[] = []
  const solid: string[] = []
  const dashed: string[] = []
  for (let i = 0; i < main.length - 1; i++) {
    const a = main[i]!
    const b = main[i + 1]!
    const s = bezierBetween(a, b)
    segs.push(s)
    // половина сегмента, прилегающая к схематичной точке, — пунктир
    // Пунктир — там, где уровень не на общей шкале (gKJ = null): и ямы, и пик ts2, чья высота зависит от схематичной ямы.
    ;(a.p.gKJ === null ? dashed : solid).push(halfBezierD(s, false))
    ;(b.p.gKJ === null ? dashed : solid).push(halfBezierD(s, true))
  }
  const first = main[0]!
  const last = main[main.length - 1]!
  solid.push(`M${f1(left)} ${f1(first.y)}H${f1(first.x)}`, `M${f1(last.x)} ${f1(last.y)}H${f1(right)}`)
  const glowD = `M${f1(left)} ${f1(first.y)}H${f1(first.x)}${segs.map(bezierD).join('')}H${f1(right)}`

  const adduct = main.find((m) => m.p.id === 'adduct')!
  const branch = place(clo2ProfilePoint('chlorateBranch'))
  const branchEndX = xOf(Math.min(1, branch.p.x + 0.13))
  const branchD = `M${f1(adduct.x)} ${f1(adduct.y)}${bezierD(bezierBetween(adduct, branch))}H${f1(branchEndX)}`

  return {
    w,
    h,
    left,
    right,
    top,
    bottom,
    zeroY: yOf(0),
    main,
    segs,
    solidD: solid.join(''),
    dashedD: dashed.join(''),
    glowD,
    branch,
    branchD,
    branchEndX,
  }
}

const LAYOUT_FULL = buildLayout(false)
const LAYOUT_COMPACT = buildLayout(true)

/** Кружок бегунка в позицию pos (дробный индекс основного пути). Без аллокаций. */
function placeHead(
  layout: Layout,
  pos: number,
  core: SVGCircleElement,
  halo: SVGCircleElement,
  guide: SVGLineElement,
): void {
  const segs = layout.segs
  const clamped = pos <= 0 ? 0 : pos >= segs.length ? segs.length : pos
  const i = Math.min(segs.length - 1, Math.floor(clamped))
  const s = segs[i]!
  const u = clamped - i
  const mu = 1 - u
  const a = mu * mu * mu
  const b = 3 * mu * mu * u
  const c = 3 * mu * u * u
  const d = u * u * u
  const x = a * s.x0 + b * s.x1 + c * s.x2 + d * s.x3
  const y = a * s.y0 + b * s.y1 + c * s.y2 + d * s.y3
  core.cx.baseVal.value = x
  core.cy.baseVal.value = y
  halo.cx.baseVal.value = x
  halo.cy.baseVal.value = y
  guide.x1.baseVal.value = x
  guide.x2.baseVal.value = x
}

function setActivePoint(markers: NodeListOf<SVGGElement>, index: number): void {
  for (let i = 0; i < markers.length; i++) {
    const el = markers[i]!
    const on = Number(el.dataset.index) === index
    if (on) el.setAttribute('data-active', '1')
    else el.removeAttribute('data-active')
  }
}

function fmt(value: number, locale: Clo2Locale, digits: number): string {
  const s = Math.abs(value).toFixed(digits)
  const sign = value < 0 ? '−' : ''
  return sign + (locale === 'en' ? s : s.replace('.', ','))
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => vars[key] ?? m)
}

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
}

export function Clo2EnergyProfile({
  locale,
  compact = false,
  caption = true,
}: {
  locale: Clo2Locale
  compact?: boolean
  /** false — заголовок и единицы показывает родитель (шапка раздела в панели урока) */
  caption?: boolean
}) {
  const layout = compact ? LAYOUT_COMPACT : LAYOUT_FULL
  const gradientId = `clo2ep-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const svgRef = useRef<SVGSVGElement>(null)
  const coreRef = useRef<SVGCircleElement>(null)
  const haloRef = useRef<SVGCircleElement>(null)
  const guideRef = useRef<SVGLineElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const core = coreRef.current
    const halo = haloRef.current
    const guide = guideRef.current
    if (!svg || !core || !halo || !guide) return
    const markers = svg.querySelectorAll<SVGGElement>('g[data-index]')
    const mq = reducedMotionQuery()
    let reduced = mq?.matches ?? false
    let lastPos = Number.NaN
    let lastActive = -1
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const t = clo2Playhead.t
      const pos = reduced ? clo2ProfilePosAtStepEnd(t) : clo2ProfilePosAt(t)
      if (pos === lastPos) return
      lastPos = pos
      placeHead(layout, pos, core, halo, guide)
      const active = Math.round(pos)
      if (active !== lastActive) {
        lastActive = active
        setActivePoint(markers, active)
      }
    }
    const onMotionChange = () => {
      reduced = mq?.matches ?? false
      lastPos = Number.NaN
    }
    mq?.addEventListener('change', onMotionChange)
    tick()
    return () => {
      cancelAnimationFrame(raf)
      mq?.removeEventListener('change', onMotionChange)
    }
  }, [layout])

  const text = getClo2MechanismText(locale).energy
  const e = CLO2_ENERGETICS
  const pctMain = String(Math.round(e.clo2Fraction * 100))
  const pctSide = String(Math.round(e.chlorateFraction * 100))
  const vars = {
    dG: fmt(e.dG0KJ, locale, 0),
    dGAlt: fmt(e.dG0AltKJ, locale, 0),
    ts1: fmt(e.ts1KJ, locale, 1),
    ts2: fmt(e.ts2KJ, locale, 1),
    tsCl: fmt(e.chlorateTsKJ, locale, 1),
    main: pctMain,
    side: pctSide,
    ms: fmt(e.halfLifeS * 1000, locale, 2),
  }
  const summary = fill(text.summary, vars)

  const L = layout
  const byId = (id: Clo2ProfilePoint['id']) => L.main.find((m) => m.p.id === id)!
  const reactants = byId('reactants')
  const ts1 = byId('ts1')
  const well = byId('clOclO')
  const ts2 = byId('ts2')
  const adduct = byId('adduct')
  const products = byId('products')

  return (
    <figure className={styles.root} data-compact={compact ? '1' : undefined}>
      {caption ? (
        <figcaption className={styles.caption}>
          <span>{text.title}</span>
          <span className={styles.captionUnit}>{compact ? text.unit : text.axisG}</span>
        </figcaption>
      ) : null}

      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${L.w} ${L.h}`}
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* кривая — градиент «Aurora»: бирюза (реагенты) → голубой → индиго (продукты) */}
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={L.left} y1="0" x2={L.right} y2="0">
            <stop offset="0" stopColor="#2dd4bf" />
            <stop offset="0.55" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* нулевой уровень — исходные реагенты */}
        <line className={styles.zero} x1={L.left} x2={L.right} y1={L.zeroY} y2={L.zeroY} />

        {compact ? null : (
          <g aria-hidden>
            <path className={styles.axis} d={`M${L.left - 14} ${L.bottom + 10}V${L.top - 8}`} />
            <path className={styles.axisHead} d={`M${L.left - 14} ${L.top - 13}l-3 6h6z`} />
            <path className={styles.axis} d={`M${L.left - 14} ${L.bottom + 10}H${L.right}`} />
            <path className={styles.axisHead} d={`M${L.right + 5} ${L.bottom + 10}l-6 -3v6z`} />
            <text className={styles.axisLabel} x={L.right} y={L.h - 3} textAnchor="end">
              {text.axisCoord}
            </text>
          </g>
        )}

        {/* скобки барьеров: каждый от своих реагентов */}
        <g aria-hidden>
          <path className={styles.bracket} d={`M${f1(ts1.x)} ${f1(L.zeroY)}V${f1(ts1.y + 4)}`} />
          <path className={styles.bracket} d={`M${f1(well.x + 5)} ${f1(well.y)}H${f1(ts2.x)}V${f1(ts2.y + 4)}`} />
          <path className={styles.bracket} d={`M${f1(L.right - 3)} ${f1(L.zeroY)}V${f1(products.y - 3)}`} />
        </g>

        <path className={styles.glow} d={L.glowD} stroke={`url(#${gradientId})`} aria-hidden />
        <path className={styles.branch} d={L.branchD} aria-hidden />
        <path className={styles.solid} d={L.solidD} stroke={`url(#${gradientId})`} aria-hidden />
        <path className={styles.dashed} d={L.dashedD} stroke={`url(#${gradientId})`} aria-hidden />

        <g aria-hidden>
          {L.main.map((m, i) => (
            <g key={m.p.id} className={styles.point} data-index={i}>
              <Marker kind={m.p.kind} x={m.x} y={m.y} />
            </g>
          ))}
          <circle className={styles.branchEnd} cx={L.branch.x} cy={L.branch.y} r={2.8} />
        </g>

        {/* Подписи — с «ореолом» цвета фона (paint-order), чтобы читались поверх кривой. */}
        <g aria-hidden>
          <text className={styles.value} x={ts1.x} y={ts1.y - 9} textAnchor="middle">
            {compact ? null : <tspan className={styles.valueSub}>ΔG‡ </tspan>}
            {fmt(e.ts1KJ, locale, 1)}
          </text>
          <text className={styles.value} x={ts2.x} y={ts2.y - 9} textAnchor="middle">
            {compact ? null : <tspan className={styles.valueSub}>ΔG‡ </tspan>}
            {fmt(e.ts2KJ, locale, 1)}
          </text>
          <text className={styles.value} x={L.right - 8} y={L.zeroY - 6} textAnchor="end">
            {compact ? null : <tspan className={styles.valueSub}>ΔG° </tspan>}
            {fmt(e.dG0KJ, locale, 0)}
          </text>

          {/* Хлоратная ветка лежит НИЖЕ продуктов ClO₂: подписи продуктов — над линией, ветки — под ней. */}
          <text className={styles.mainText} x={L.right - 8} y={products.y - (compact ? 8 : 20)} textAnchor="end">
            {fill(text.mainLabel, { pct: pctMain })}
          </text>
          <text className={styles.branchText} x={L.branchEndX} y={L.branch.y + 15} textAnchor="end">
            {fill(text.branchLabel, { pct: pctSide })}
          </text>

          <text className={styles.note} x={well.x} y={well.y + (compact ? 16 : 29)} textAnchor="middle">
            {text.schematic}
          </text>

          {compact ? null : (
            <>
              <text className={styles.formula} x={L.left - 2} y={reactants.y + 16} textAnchor="start">
                {reactants.p.formula}
              </text>
              <text className={styles.formula} x={well.x} y={well.y + 15} textAnchor="middle">
                {well.p.formula}
              </text>
              <text className={styles.formula} x={adduct.x + 7} y={adduct.y - 8} textAnchor="start">
                {adduct.p.formula}
              </text>
              <text className={styles.formula} x={L.right - 8} y={products.y - 6} textAnchor="end">
                {products.p.formula}
              </text>
              <text className={styles.formula} x={L.branchEndX} y={L.branch.y + 29} textAnchor="end">
                {L.branch.p.formula}
              </text>
            </>
          )}
        </g>

        {/* засечка бегунка на оси «ход реакции» */}
        <line
          ref={guideRef}
          className={styles.headGuide}
          x1={reactants.x}
          x2={reactants.x}
          y1={compact ? L.bottom + 3 : L.bottom + 4}
          y2={compact ? L.bottom + 11 : L.bottom + 16}
          aria-hidden
        />
        <circle ref={haloRef} className={styles.headHalo} cx={reactants.x} cy={reactants.y} r={compact ? 7 : 8} aria-hidden />
        <circle ref={coreRef} className={styles.headCore} cx={reactants.x} cy={reactants.y} r={compact ? 3.4 : 3.8} aria-hidden />
      </svg>

      <ul className={styles.legend}>
        <li>
          <LegendIcon kind="measured" />
          <span>{text.measured}</span>
        </li>
        <li>
          <LegendIcon kind="derived" />
          <span>{text.derived}</span>
        </li>
        <li>
          <LegendIcon kind="schematic" />
          <span>{text.schematic}</span>
        </li>
      </ul>
      {/* Оговорки, модели и источники — по запросу: график и легенда уже показывают, что измерено, а что схема. */}
      <details className={styles.more}>
        <summary>
          <span>{text.more}</span>
          <svg className={styles.moreChevron} viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className={styles.caveat}>{fill(text.caveat, vars)}</p>
        <p>{fill(text.chlorateModels, vars)}</p>
        <p>{fill(text.halfLife, vars)}</p>
        <p className={styles.sources}>{text.sources}</p>
      </details>
    </figure>
  )
}

function Marker({ kind, x, y }: { kind: Clo2ProfilePoint['kind']; x: number; y: number }) {
  if (kind === 'measured') return <circle className={styles.measured} cx={x} cy={y} r={3} />
  if (kind === 'derived') {
    return (
      <>
        <circle className={styles.derived} cx={x} cy={y} r={3.3} />
        <circle className={styles.derivedCore} cx={x} cy={y} r={1.3} />
      </>
    )
  }
  return <circle className={styles.schematic} cx={x} cy={y} r={3} />
}

function LegendIcon({ kind }: { kind: Clo2ProfilePoint['kind'] }) {
  return (
    <svg className={styles.legendIcon} viewBox="0 0 10 10" aria-hidden>
      <Marker kind={kind} x={5} y={5} />
    </svg>
  )
}
