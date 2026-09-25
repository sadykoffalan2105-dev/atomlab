import { memo, useMemo, useRef, type CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ReactorEquationTerm } from '../../../chemistry/reactorEquationBalance'
import {
  scientificStageLayout,
  type StageCoProduct,
  type StageTallyRow,
  type StageVec3,
} from './scientificReactorStageLayout'
import { StageInstancedMolecules } from './stageInstancedAtoms'
import { createSafeArea, measureSafeArea, SAFE_AREA_EVERY, type SafeArea } from '../../../lab/cinema/core/safeArea'

export type ScientificReactorStageLabels = { balanced: string; unbalanced: string }

export type ScientificReactorStageProps = {
  leftTerms: readonly ReactorEquationTerm[]
  coProducts: readonly StageCoProduct[]
  productId: string
  productCoeff: number
  balanced: boolean
  lowPower: boolean
  visible: boolean
  /** подпись под счётом атомов (i18n); по умолчанию русская */
  labels?: ScientificReactorStageLabels
  position?: StageVec3
}

const DEFAULT_LABELS: ScientificReactorStageLabels = {
  balanced: 'уравнение уравнено ✓',
  unbalanced: 'не уравнено',
}
const ORIGIN: StageVec3 = [0, 0, 0]
/** Доля видимой ширины кадра, которую может занять ряд «реагенты → продукты». */
const STAGE_WIDTH_FILL = 0.9
const _stageCenter = new THREE.Vector3()

/**
 * Масштаб ряда под текущий кадр. Камеру лаборатория ставит императивно (без ререндера React),
 * поэтому считаем в кадре, а не через селектор useThree: на узком/портретном холсте ряд ужимается.
 *
 * Приём «отодвинуть группу от камеры в k раз и во столько же увеличить» здесь сознательно
 * не применяется: гомотетия с центром в камере сохраняет каждый луч, поэтому ни положение,
 * ни форма шаров на экране от неё не меняются (эллипсы у краёв — тоже). Круглые шары у
 * краёв кадра даёт проекция в stageAtomMaterials (смещения вершин в масштабе глубины центра).
 */
function fitStageToView(
  group: THREE.Group | null,
  camera: THREE.Camera,
  aspect: number,
  maxScale: number,
  width: number,
  position: StageVec3,
): void {
  if (!group || width <= 0) return
  let s = maxScale
  if (camera instanceof THREE.PerspectiveCamera) {
    const dist = camera.position.distanceTo(_stageCenter.set(position[0], position[1] + 0.5, position[2]))
    const visibleWidth = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * aspect
    s = Math.min(maxScale, (STAGE_WIDTH_FILL * visibleWidth) / width)
  }
  if (Math.abs(group.scale.x - s) > 1e-3) group.scale.setScalar(s)
}

/** Высота DOM-подписей под рядом (px при ui = 1): строка слагаемых + отступ и карточка счёта атомов. */
const TALLY_BELOW_PX = 124
const _base = new THREE.Vector3()
const _probe = new THREE.Vector3()

/**
 * Вертикаль ряда: композиция «молекулы + подписи + счёт атомов» центрируется в СВОБОДНОЙ области
 * канвы (над панелью реактора), а если не влезает по высоте — ужимается. Раньше ряд стоял в центре
 * канвы, и подписи «1 NaOH», «1 HCl» уходили под панель реактора (приёмка, naoh-hcl).
 */
function fitStageVertically(
  group: THREE.Group,
  camera: THREE.Camera,
  sizeH: number,
  safe: SafeArea,
  topY: number,
  tallyY: number,
  ui: number,
  position: StageVec3,
  fit: { y: number; ready: boolean },
): void {
  if (!safe.ready) return
  _base.set(position[0], position[1], position[2]).project(camera)
  _probe.set(position[0], position[1] + 1, position[2]).project(camera)
  const ppu = Math.abs(_probe.y - _base.y) * 0.5 * sizeH
  if (ppu < 1e-3) return
  let s = group.scale.x
  const below = TALLY_BELOW_PX * ui
  const freeH = Math.max(40, safe.bottom - safe.top)
  const needPx = (topY - tallyY) * s * ppu + below
  if (needPx > freeH * 0.92) {
    s = Math.max(0.05, (freeH * 0.92 - below) / ((topY - tallyY) * ppu))
    group.scale.setScalar(s)
  }
  // Экранные координаты (y вниз) относительно точки position.
  const baseY = (1 - (_base.y + 1) / 2) * sizeH
  const compTop = -topY * s * ppu
  const compBottom = -tallyY * s * ppu + below
  const wantBaseY = (safe.top + safe.bottom) / 2 - (compTop + compBottom) / 2
  const dy = -(wantBaseY - baseY) / ppu
  fit.y = fit.ready ? fit.y + (dy - fit.y) * 0.2 : dy
  fit.ready = true
  group.position.set(position[0], position[1] + fit.y, position[2])
}

const OK_COLOR = '#6dffae'
const WARN_COLOR = '#ffb547'
const TEXT_COLOR = '#eef3ff'
const MUTED_COLOR = '#a9b8d6'
/** Html поверх канваса, но под модалками/панелями страницы */
const Z_RANGE: [number, number] = [12, 0]

const labelWrap: CSSProperties = {
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  fontFamily: 'inherit',
  color: TEXT_COLOR,
  textShadow: '0 0 8px rgba(4, 10, 24, 0.9), 0 1px 2px rgba(0, 0, 0, 0.85)',
}

/** Размер подписей следует за высотой канваса (Html — это px, не мир). */
function useUiScale(): number {
  return useThree((s) => Math.round(Math.min(1.2, Math.max(0.7, s.size.height / 760)) * 20) / 20)
}

const TermLabel = memo(function TermLabel({
  position,
  coeff,
  formula,
  ionFormula,
  ui,
}: {
  position: StageVec3
  coeff: number
  formula: string
  ionFormula: string | null
  ui: number
}) {
  return (
    <Html position={position} zIndexRange={Z_RANGE} style={{ pointerEvents: 'none' }}>
      <div style={labelWrap}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: `${5 * ui}px` }}>
          <span
            style={{
              fontSize: `${26 * ui}px`,
              fontWeight: 800,
              lineHeight: 1,
              color: '#ffffff',
              fontVariantNumeric: 'tabular-nums',
              // как dimWhenOne в панели реактора: «1» есть, но не мешает читать формулу
              opacity: coeff === 1 ? 0.35 : 1,
            }}
          >
            {coeff}
          </span>
          <span style={{ fontSize: `${20 * ui}px`, fontWeight: 650, lineHeight: 1, letterSpacing: '0.01em' }}>
            {formula}
          </span>
        </div>
        {ionFormula ? (
          <span
            style={{
              fontSize: `${11.5 * ui}px`,
              fontWeight: 600,
              lineHeight: 1.25,
              color: MUTED_COLOR,
              marginTop: `${5 * ui}px`,
              padding: `${1 * ui}px ${7 * ui}px`,
              borderRadius: 999,
              background: 'rgba(120, 150, 215, 0.13)',
              border: '1px solid rgba(150, 180, 240, 0.18)',
              letterSpacing: '0.03em',
              textShadow: 'none',
            }}
          >
            {ionFormula}
          </span>
        ) : null}
      </div>
    </Html>
  )
})

const Separator = memo(function Separator({
  position,
  glyph,
  ui,
}: {
  position: StageVec3
  glyph: '+' | '→'
  ui: number
}) {
  return (
    <Html position={position} center zIndexRange={Z_RANGE} style={{ pointerEvents: 'none' }}>
      <span
        style={{
          ...labelWrap,
          transform: undefined,
          display: 'block',
          fontSize: `${(glyph === '→' ? 36 : 28) * ui}px`,
          // тонкие знаки: ряд читается как уравнение, а не как набор кнопок
          fontWeight: glyph === '→' ? 400 : 300,
          lineHeight: 1,
          color: glyph === '→' ? '#ffffff' : MUTED_COLOR,
          opacity: glyph === '→' ? 0.9 : 1,
        }}
      >
        {glyph}
      </span>
    </Html>
  )
})

const CopiesBadge = memo(function CopiesBadge({
  position,
  coeff,
  ui,
}: {
  position: StageVec3
  coeff: number
  ui: number
}) {
  return (
    <Html position={position} center zIndexRange={Z_RANGE} style={{ pointerEvents: 'none' }}>
      <span
        style={{
          display: 'block',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontSize: `${12 * ui}px`,
          fontWeight: 800,
          lineHeight: 1,
          padding: `${3 * ui}px ${6 * ui}px`,
          borderRadius: 999,
          color: '#0b1220',
          background: 'rgba(234, 242, 255, 0.92)',
          boxShadow: '0 0 10px rgba(120, 190, 255, 0.55)',
        }}
      >
        ×{coeff}
      </span>
    </Html>
  )
})

const TallyCard = memo(function TallyCard({
  position,
  rows,
  balanced,
  balancedText,
  unbalancedText,
  ui,
}: {
  position: StageVec3
  rows: readonly StageTallyRow[]
  balanced: boolean
  balancedText: string
  unbalancedText: string
  ui: number
}) {
  const accent = balanced ? OK_COLOR : WARN_COLOR
  return (
    <Html position={position} zIndexRange={Z_RANGE} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          ...labelWrap,
          // под строкой подписей слагаемых (их высота в px)
          marginTop: `${(64 * ui).toFixed(1)}px`,
          gap: `${6 * ui}px`,
          padding: `${7 * ui}px ${10 * ui}px ${6 * ui}px`,
          borderRadius: 14 * ui,
          background: 'rgba(9, 14, 30, 0.8)',
          border: `1px solid ${accent}55`,
          boxShadow: `0 6px 22px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
          textShadow: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: `${5 * ui}px`,
            // Узкий экран: фишки переносятся, карточка не вылезает за край. Без max-content
            // контейнер у точки привязки Html нулевой ширины — фишки встали бы столбиком.
            width: 'max-content',
            maxWidth: '88vw',
          }}
        >
          {rows.map((r) => {
            const c = r.equal ? OK_COLOR : WARN_COLOR
            return (
              <span
                key={r.symbol}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: `${4 * ui}px`,
                  fontSize: `${13 * ui}px`,
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                  color: c,
                  padding: `${2 * ui}px ${7 * ui}px`,
                  borderRadius: 8 * ui,
                  background: r.equal ? 'rgba(109, 255, 174, 0.08)' : 'rgba(255, 181, 71, 0.12)',
                }}
              >
                <b style={{ color: TEXT_COLOR, fontWeight: 700 }}>{r.symbol}</b>
                <span>{r.left}</span>
                <span style={{ opacity: 0.7 }}>{r.equal ? '=' : '≠'}</span>
                <span>{r.right}</span>
              </span>
            )
          })}
        </div>
        <span style={{ fontSize: `${12 * ui}px`, fontWeight: 700, color: accent, letterSpacing: '0.02em' }}>
          {balanced ? balancedText : unbalancedText}
        </span>
      </div>
    </Html>
  )
})

/**
 * Сцена реактора до запуска синтеза (научный маршрут): настоящие формульные
 * единицы реагентов и продуктов рядом «2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂»,
 * по копии на единицу коэффициента, и счёт атомов слева/справа.
 * Раствор: Na⁺ и анионы без связи. Монтируется внутри Canvas (LabScene).
 */
export function ScientificReactorStage({
  leftTerms,
  coProducts,
  productId,
  productCoeff,
  balanced,
  lowPower,
  visible,
  labels = DEFAULT_LABELS,
  position = ORIGIN,
}: ScientificReactorStageProps) {
  const layout = useMemo(
    () => (visible ? scientificStageLayout(leftTerms, coProducts, productId, productCoeff) : null),
    [visible, leftTerms, coProducts, productId, productCoeff],
  )
  const ui = useUiScale()
  const groupRef = useRef<THREE.Group>(null)

  // Свободная область канвы меряется в кадре: изменяемое состояние — в ref, не в useMemo.
  const safeRef = useRef<SafeArea | null>(null)
  const vfit = useRef({ y: 0, ready: false })
  const vext = useMemo(() => {
    if (!layout) return null
    let top = 0
    for (const t of layout.terms) top = Math.max(top, t.center[1] + t.clusterHeight / 2)
    return { top, tally: layout.tallyPosition[1] }
  }, [layout])

  useFrame(({ camera, size, gl }) => {
    if (!layout || !groupRef.current) return
    fitStageToView(groupRef.current, camera, size.width / Math.max(1, size.height), layout.fitScale, layout.width, position)
    const safe = (safeRef.current ??= createSafeArea())
    if (safe.counter++ % SAFE_AREA_EVERY === 0) measureSafeArea(safe, gl.domElement)
    if (vext) fitStageVertically(groupRef.current, camera, size.height, safe, vext.top, vext.tally, ui, position, vfit.current)
  })

  if (!visible || !layout) return null

  return (
    <group ref={groupRef} position={position} scale={layout.fitScale}>
      <StageInstancedMolecules layout={layout} lowPower={lowPower} />
      {layout.terms.map((t) => (
        <TermLabel
          key={t.key}
          position={t.labelPosition}
          coeff={t.coeff}
          formula={t.formula}
          ionFormula={t.ionFormula}
          ui={ui}
        />
      ))}
      {layout.terms.map((t) =>
        t.hiddenCopies > 0 ? (
          <CopiesBadge key={`badge:${t.key}`} position={t.badgePosition} coeff={t.coeff} ui={ui} />
        ) : null,
      )}
      {layout.separators.map((s) => (
        <Separator key={s.key} position={s.position} glyph={s.glyph} ui={ui} />
      ))}
      <TallyCard
        position={layout.tallyPosition}
        rows={layout.tally.rows}
        balanced={balanced}
        balancedText={labels.balanced}
        unbalancedText={labels.unbalanced}
        ui={ui}
      />
    </group>
  )
}
