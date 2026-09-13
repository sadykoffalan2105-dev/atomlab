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

const OK_COLOR = '#6dffae'
const WARN_COLOR = '#ffb547'
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
  color: '#eaf2ff',
  textShadow: '0 0 6px rgba(4, 10, 24, 0.95), 0 1px 2px rgba(0, 0, 0, 0.9)',
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: `${0.3 * ui}em` }}>
          <span
            style={{
              fontSize: `${26 * ui}px`,
              fontWeight: 800,
              lineHeight: 1,
              color: '#ffffff',
              // как dimWhenOne в панели реактора: «1» есть, но не мешает читать формулу
              opacity: coeff === 1 ? 0.35 : 1,
            }}
          >
            {coeff}
          </span>
          <span style={{ fontSize: `${19 * ui}px`, fontWeight: 600, lineHeight: 1 }}>{formula}</span>
        </div>
        {ionFormula ? (
          <span style={{ fontSize: `${11.5 * ui}px`, opacity: 0.7, marginTop: `${3 * ui}px`, letterSpacing: '0.02em' }}>
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
          fontSize: `${(glyph === '→' ? 34 : 28) * ui}px`,
          fontWeight: 700,
          lineHeight: 1,
          opacity: 0.85,
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
          marginTop: `${(58 * ui).toFixed(1)}px`,
          gap: `${5 * ui}px`,
          padding: `${7 * ui}px ${12 * ui}px`,
          borderRadius: 12 * ui,
          background: 'rgba(8, 14, 30, 0.72)',
          border: `1px solid ${accent}66`,
          boxShadow: `0 0 14px ${accent}33`,
          textShadow: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: `${10 * ui}px` }}>
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
                  fontVariantNumeric: 'tabular-nums',
                  color: c,
                }}
              >
                <b style={{ color: '#eaf2ff', fontWeight: 700 }}>{r.symbol}</b>
                <span>{r.left}</span>
                <span style={{ opacity: 0.8 }}>{r.equal ? '=' : '≠'}</span>
                <span>{r.right}</span>
              </span>
            )
          })}
        </div>
        <span style={{ fontSize: `${12 * ui}px`, fontWeight: 700, color: accent }}>
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

  useFrame(({ camera, size }) => {
    if (!layout) return
    fitStageToView(groupRef.current, camera, size.width / Math.max(1, size.height), layout.fitScale, layout.width, position)
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
