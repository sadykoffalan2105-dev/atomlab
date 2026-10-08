/**
 * Электронные весы школьной лаборатории (дискретность 0,01 г, предел 500 г) и «живое» показание:
 *  • дисплей — CanvasTexture, перерисовывается только когда меняется строка;
 *  • после изменения груза цифры «бегут» и успокаиваются ~0,5 с, затем загорается значок стабильности «○»;
 *  • «→0←» — ноль после тары; перегруз — «Err».
 * Показание (что лежит на чаше за вычетом тары) задаёт установка функцией прогресса reading(p).
 * Начало координат — центр основания весов на столе; чаша сверху, дисплей и кнопки — к ученику (+Z).
 */
import { useMemo, useRef, type CSSProperties } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { LabLang } from '../../labContract'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { LabLabel } from '../../scene/labOccluders'
import { fmtNum } from '../instruments'
import { createScalesDisplay, useOwned } from './deviceTextures'

/** Размеры весов (м): верх чаши, радиус чаши, кнопки (для целей шагов). */
export const SCALES = {
  w: 0.17,
  d: 0.21,
  bodyH: 0.034,
  panY: 0.047,
  panR: 0.066,
  /** Центр кнопки «ON/OFF» и «T» на передней панели. */
  onBtn: [-0.058, 0.02, 0.1] as V3,
  tareBtn: [0.058, 0.02, 0.1] as V3,
  display: [0, 0.021, 0.1] as V3,
} as const

const UNSTABLE_S = 0.5
/** Лицевая грань бруска панели (половина толщины) + 0,2 мм, чтобы текстура не мерцала со стенкой. */
const PANEL_FACE = 0.005 + 0.0002

const chipStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  padding: '5px 11px',
  borderRadius: 10,
  background: 'rgba(18, 28, 22, 0.88)',
  color: '#dff5dc',
  font: '700 15px/1.1 "Consolas", "DejaVu Sans Mono", monospace',
  boxShadow: '0 6px 16px rgba(10, 20, 14, 0.28)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
}
const chipSmall: CSSProperties = { font: '600 11px/1 system-ui, "Segoe UI", sans-serif', color: '#9fc59a' }

const SCALE_NAME: Record<LabLang, string> = { ru: 'весы', en: 'balance', uz: 'tarozi' }
const UNIT_G: Record<LabLang, string> = { ru: 'г', en: 'g', uz: 'g' }

export function DigitalScales({
  reading,
  readout,
}: {
  /** Масса на чаше минус тара (г); null — весы выключены. */
  reading: (p: number) => number | null
  /** Показывать крупную HTML-плашку с показанием над весами (для телефона и доски). */
  readout?: PFn
}) {
  const { p, time, lang } = useRig()
  const display = useMemo(createScalesDisplay, [])
  const body = useOwned(() => new THREE.MeshStandardMaterial({ color: '#f1f3f5', roughness: 0.45, metalness: 0 }), [])
  const steel = useOwned(() => new THREE.MeshStandardMaterial({ color: '#c9cfd6', roughness: 0.22, metalness: 0.9 }), [])
  const dark = useOwned(() => new THREE.MeshStandardMaterial({ color: '#1d2329', roughness: 0.5, metalness: 0.1 }), [])
  const btn = useOwned(() => new THREE.MeshStandardMaterial({ color: '#3b4752', roughness: 0.6 }), [])
  const st = useRef({ shown: 0, target: 0, changedAt: -10, on: false })
  const chip = useRef<HTMLDivElement>(null)
  const chipVal = useRef<HTMLSpanElement>(null)
  const lastChip = useRef('')

  useFrame((_, dt) => {
    const pv = p.current ?? 0
    const t = time.current ?? 0
    const s = st.current
    const r = reading(pv)
    if (r == null) {
      s.on = false
      display.draw(null, false, false)
    } else {
      if (!s.on) {
        // включили: короткий «самотест» 8888 → ноль
        s.on = true
        s.shown = r
        s.changedAt = t
      }
      if (Math.abs(r - s.target) > 0.004) {
        s.target = r
        s.changedAt = t
      }
      // цифры догоняют груз: быстро, с лёгким «перелётом» последней цифры, пока груз не успокоился
      const k = 1 - Math.exp(-Math.min(0.05, dt) * 9)
      s.shown += (s.target - s.shown) * k
      const settling = t - s.changedAt < UNSTABLE_S
      const jitter = settling ? Math.sin(t * 37) * 0.012 * (1 - (t - s.changedAt) / UNSTABLE_S) : 0
      const v = Math.abs(s.target - s.shown) < 0.003 && !settling ? s.target : s.shown + jitter
      const text = v > 500 ? 'Err' : Math.abs(v) < 0.005 ? '0.00' : (Math.round(v * 100) / 100).toFixed(2)
      const stable = !settling && Math.abs(s.target - s.shown) < 0.003
      display.draw(text, stable, stable && Math.abs(s.target) < 0.005)
    }
    // HTML-плашка: то же показание крупно (обновляется только при смене строки)
    const el = chip.current
    if (el) {
      const want = readout ? readout(pv) > 0.5 && s.on : false
      const txt = want ? fmtNum(Math.round((Math.abs(s.target - s.shown) < 0.003 ? s.target : s.shown) * 100) / 100, 2, lang) : ''
      if (txt !== lastChip.current) {
        lastChip.current = txt
        el.style.display = txt ? 'flex' : 'none'
        if (chipVal.current) chipVal.current.textContent = `${txt} ${UNIT_G[lang]}`
      }
    }
  })

  return (
    <group>
      <RoundedBox args={[SCALES.w, SCALES.bodyH, SCALES.d]} radius={0.008} smoothness={3} position-y={SCALES.bodyH / 2} material={body} castShadow receiveShadow />
      {/* скошенная передняя панель: тёмный брусок, на его лицевой грани — текстура «панель + ЖК-экран» (ровно в плоскости грани) */}
      <mesh position={[0, 0.019, SCALES.d / 2 - 0.004]} rotation={[-0.32, 0, 0]} material={dark}>
        <boxGeometry args={[0.15, 0.024, 0.01]} />
      </mesh>
      <mesh position={[0, 0.019 + PANEL_FACE * Math.sin(0.32), SCALES.d / 2 - 0.004 + PANEL_FACE * Math.cos(0.32)]} rotation={[-0.32, 0, 0]} renderOrder={1}>
        <planeGeometry args={[0.15, 0.024]} />
        <meshBasicMaterial map={display.texture} toneMapped={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
      {/* кнопки ON/OFF и T */}
      {[SCALES.onBtn, SCALES.tareBtn].map((b, i) => (
        <mesh key={i} position={[b[0], b[1], SCALES.d / 2 + 0.0015]} rotation={[Math.PI / 2 - 0.32, 0, 0]} material={i === 0 ? btn : steel}>
          <cylinderGeometry args={[0.0058, 0.0058, 0.003, 16]} />
        </mesh>
      ))}
      {/* стойка и чаша из нержавеющей стали */}
      <mesh position={[0, SCALES.bodyH + 0.004, -0.012]} material={dark}>
        <cylinderGeometry args={[0.012, 0.016, 0.008, 16]} />
      </mesh>
      <mesh position={[0, SCALES.panY - 0.0025, -0.012]} material={steel} castShadow receiveShadow>
        <cylinderGeometry args={[SCALES.panR, SCALES.panR - 0.002, 0.005, 40]} />
      </mesh>
      <LabLabel position={[0, 0.09, SCALES.d / 2]} center zIndexRange={[24, 10]}>
        <div ref={chip} style={{ ...chipStyle, display: 'none' }} data-lab3d-readout="scales">
          <span style={chipSmall}>{SCALE_NAME[lang]}</span>
          <span ref={chipVal} />
        </div>
      </LabLabel>
    </group>
  )
}

/** Центр чаши в координатах весов (здесь стоит сосуд на взвешивании). */
export const SCALES_PAN_CENTER: V3 = [0, SCALES.panY, -0.012]

/**
 * Плашка показания прибора (HTML поверх холста): text(p) — строка или null (скрыть). Обновляется только при смене
 * строки — без перерисовки React на каждый кадр.
 */
export function Readout({ position, text, label }: { position: V3; text: (p: number, lang: LabLang) => string | null; label?: Record<LabLang, string> }) {
  const { p, lang } = useRig()
  const box = useRef<HTMLDivElement>(null)
  const val = useRef<HTMLSpanElement>(null)
  const last = useRef<string | null>('')
  useFrame(() => {
    const s = text(p.current ?? 0, lang)
    if (s === last.current) return
    last.current = s
    if (box.current) box.current.style.display = s ? 'flex' : 'none'
    if (val.current) val.current.textContent = s ?? ''
  })
  return (
    <LabLabel position={position} center zIndexRange={[24, 10]}>
      <div ref={box} style={{ ...chipStyle, display: 'none' }} data-lab3d-readout={label?.en ?? 'value'}>
        {label ? <span style={chipSmall}>{label[lang]}</span> : null}
        <span ref={val} />
      </div>
    </LabLabel>
  )
}
