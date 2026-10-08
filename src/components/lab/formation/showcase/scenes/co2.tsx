/**
 * Showcase CO₂ — C + O₂ → CO₂ (1:1). Сцена рисуется внутри группы атомов FormationMoleculeView (атомы и палочки — вид),
 * поверх: электронные облака (s/p/sp по реальным орбиталям), свои электроны по данным story.electrons (число и моменты
 * как в аудите), вспышки энергии, подписи (σ/π, δ±, 180°, 1,16 Å, ΔH, диполи), окружение финала (газ → сухой лёд),
 * камера. Всё — функции t сценария (перемотка без состояния).
 *
 * Сюжет: reagents — атом C (2s²2p²: s-облако + p_y, p_z; p_x пустое) и O₂ (σ + π); break — поджиг, O=O рвётся;
 * approach — O подходят с двух сторон; valence — возбуждение C: электрон 2s → 2p (2s¹2p³, 4 неспаренных; затем s и p_x
 * смешиваются в два облака вдоль оси — sp); pairs — четыре общие пары: σ (по оси) и π (над/под осью) для C=O₁ —
 * π в вертикальной плоскости, для C=O₂ — в горизонтальной (две π-связи CO₂ взаимно перпендикулярны); δ+ на C, δ− на O;
 * bonds — палочки, ΔH = −394 кДж/моль; assemble — 180°, 1,16 Å, два диполя гасят друг друга; final — газ (молекулы
 * летают), сухой лёд (ГЦК-ячейка, модель — узел передней грани), окружение гаснет — остаётся модель.
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { V3 } from '../../../hero/schoolHeroModel'
import { atomPosAt, clamp01, easeInOut, type StageKey, type StoryElectron } from '../../formationStory'
import { AngleArc, Burst, DipoleArrow, Electron, Glow, Lobe, MeasureLine, Tag, add3, lerp3, mid3, seg, sub3, useClockCtx, win, type PFn, type TFn } from '../kit/core'
import { CO2Electron } from '../kit/co2-electron'
import { CO2Gas } from '../kit/co2-gas'
import { CO2_TAGS } from '../texts/co2'
import type { ShowcaseProps, ShowcaseScene } from '../types'

type Win = { t0: number; t1: number; dur: number }
type CamKey = { t: number; d: number; yaw: number; pitch: number; zoom: number }

const C_LOBE = '#7dd3fc'
const O_LOBE = '#fda4af'
const SIG = '#a5f3fc'
const PI = '#f0abfc'
const E_C = '#fde68a'
const E_O = '#fdba74'

const CO2SceneImpl = ({ model, story, cam, lowPower }: ShowcaseProps) => {
  const clock = useClockCtx()
  const L = useMemo(() => {
    const l = typeof document !== 'undefined' ? document.documentElement.lang : 'ru'
    return l === 'en' ? 1 : l === 'uz' ? 2 : 0
  }, [])
  const T = (k: keyof typeof CO2_TAGS) => CO2_TAGS[k]![L]!

  const S = useMemo(() => {
    const g = (k: StageKey): Win => {
      const s = story.stages.find((x) => x.key === k) ?? { t0: 0, dur: 0.001 }
      return { t0: s.t0, t1: s.t0 + s.dur, dur: s.dur }
    }
    return { R: g('reagents'), B: g('break'), A: g('approach'), V: g('valence'), P: g('pairs'), Bo: g('bonds'), As: g('assemble'), F: g('final') }
  }, [story])
  const { R, B, A, V, P, Bo, As, F } = S
  // возбуждение C: 2s → 2p; затем s + p_x → два облака вдоль оси
  const X0 = V.t0 + 1.9
  const X1 = V.t0 + 3.1
  const H0 = X1 + 0.3
  const H1 = X1 + 1.2

  // положения атомов (функции t)
  const pos = useMemo(() => {
    const mk = (i: number): PFn => (t) => {
      const o: V3 = [0, 0, 0]
      atomPosAt(story, i, t, o)
      return o
    }
    return [mk(0), mk(1), mk(2)] as const
  }, [story])
  const [pC, pO1, pO2] = pos
  const at = (p: PFn, off: V3): PFn => (t) => add3(p(t), off)
  const midO: PFn = (t) => mid3(pO1(t), pO2(t))
  const mid01: PFn = (t) => mid3(pC(t), pO1(t))
  const mid02: PFn = (t) => mid3(pC(t), pO2(t))
  const dir = (a: PFn, b: PFn) => (t: number): V3 => {
    const d = sub3(b(t), a(t))
    const l = Math.hypot(d[0], d[1], d[2]) || 1
    return [d[0] / l, d[1] / l, d[2] / l]
  }

  // электроны: по данным story (число/моменты), положения — по сюжету сцены
  const moves = useMemo(() => {
    const m = (home: number, partner: number, slot: number) => story.electrons.find((e) => e.home === home && e.kind === 'pair' && e.move?.bond?.a === 0 && e.move.bond.b === partner && e.move.bond.slot === slot)?.move
    const z = { t0: 0, t1: 0.001 }
    return { s1: m(0, 1, 0) ?? z, p1: m(0, 1, 1) ?? z, s2: m(0, 2, 0) ?? z, p2: m(0, 2, 1) ?? z }
  }, [story])
  const fadeBy = (w: { t0: number; t1: number }) => (t: number) => 1 - seg(t, w.t0, w.t1)

  type ERender = { e: StoryElectron; pos: PFn; k: TFn; color: string; moving: boolean }
  const electrons = useMemo<ERender[]>(() => {
    const out: ERender[] = []
    const loneIdx = new Map<number, number>()
    const sin = (u: number) => Math.sin(Math.PI * u)
    for (const e of story.electrons) {
      const home = pos[e.home] ?? pC
      const k: TFn = (t) => clamp01((t - e.tIn) / 0.4) * (1 - clamp01((t - e.tOut) / 0.5))
      let rel: (t: number) => V3
      const bd = e.move?.bond
      if (e.home === 0 && bd) {
        if (bd.b === 1 && bd.slot === 0) rel = (t) => lerp3([0.07, 0.07, 0.15], [0.19, 0, 0.05], seg(t, H0, H1)) // s-электрон → облако sp вдоль +x
        else if (bd.b === 1) rel = () => [0, 0.21, 0.05] // p_y
        else if (bd.b === 2 && bd.slot === 0) rel = (t) => { const u = seg(t, X0, X1); const p = lerp3([-0.07, -0.07, 0.15], [-0.21, 0, 0.05], u); return [p[0], p[1] + 0.13 * sin(u), p[2] + 0.06 * sin(u)] } // 2s → 2p_x (возбуждение)
        else rel = () => [0, 0.03, 0.22] // p_z
      } else if (e.home === 1) {
        if (bd && bd.slot === 0) rel = () => [-0.18, 0, 0.04] // p_x → σ
        else if (bd) rel = () => [0, 0.18, 0.04] // p_y → π (вертикальная плоскость)
        else {
          const j = loneIdx.get(1) ?? 0
          loneIdx.set(1, j + 1)
          rel = () => ([[0.12, 0.04, 0.1], [0.12, -0.04, 0.1], [0.035, 0.056, 0.16], [-0.035, 0.056, 0.16]] as V3[])[j] ?? [0, 0, 0.15]
        }
      } else if (e.home === 2) {
        if (bd && bd.slot === 0) rel = () => [0.18, 0, 0.04] // p_x → σ
        else if (bd) rel = () => [0, 0, 0.19] // p_z → π (горизонтальная плоскость)
        else {
          const j = loneIdx.get(2) ?? 0
          loneIdx.set(2, j + 1)
          rel = () => ([[-0.12, 0.04, 0.1], [-0.12, -0.04, 0.1], [0.035, 0.16, 0.056], [-0.035, 0.16, 0.056]] as V3[])[j] ?? [0, 0, 0.15]
        }
      } else rel = () => e.homeOff
      // цель общей пары: σ — на оси между ядрами, π — над/под осью (C=O₁ — по y, C=O₂ — по z)
      const target: PFn | null = bd
        ? (t) => {
            const pa = pC(t)
            const pb = (bd.b === 1 ? pO1 : pO2)(t)
            const m = mid3(pa, pb)
            if (bd.slot === 0) {
              const d = sub3(pb, pa)
              const l = Math.hypot(d[0], d[1], d[2]) || 1
              return add3(m, [d[0] / l, d[1] / l, d[2] / l], 0.032 * bd.sign)
            }
            const perp: V3 = bd.b === 1 ? [0, 1, 0] : [0, 0, 1]
            return add3(m, perp, -0.1 * bd.sign)
          }
        : null
      const p: PFn = (t) => {
        const Hm = add3(home(t), rel(t))
        if (!e.move || !target || t < e.move.t0) return Hm
        const u = easeInOut((t - e.move.t0) / Math.max(1e-6, e.move.t1 - e.move.t0))
        const Tg = target(t)
        const lift = sin(u) * 0.06
        return [Hm[0] + (Tg[0] - Hm[0]) * u, Hm[1] + (Tg[1] - Hm[1]) * u + lift, Hm[2] + (Tg[2] - Hm[2]) * u]
      }
      out.push({ e, pos: p, k, color: e.home === 0 ? E_C : E_O, moving: e.kind === 'pair' })
    }
    return out
  }, [story, pos, pC, pO1, pO2, X0, X1, H0, H1])

  // камера: ключевые кадры по этапам + «дыхание»
  const camKeys = useMemo<CamKey[]>(() => [
    { t: -1, d: 1, yaw: 0.05, pitch: 0.1, zoom: 1 },
    { t: R.t0 + 1.4, d: 2.2, yaw: 0.38, pitch: 0.2, zoom: 1.04 },
    { t: B.t0, d: 1.4, yaw: 0.18, pitch: 0.12, zoom: 1.1 },
    { t: A.t0, d: 2.2, yaw: 0.45, pitch: 0.24, zoom: 1 },
    { t: V.t0 + 0.8, d: 1.6, yaw: 0.55, pitch: 0.3, zoom: 1.22 },
    { t: P.t0 - 0.4, d: 1.6, yaw: 0.36, pitch: 0.16, zoom: 1.08 },
    { t: moves.s2.t0 - 0.6, d: 1.8, yaw: 0.42, pitch: 0.42, zoom: 1.08 },
    { t: Bo.t0, d: 1.6, yaw: 0.26, pitch: 0.3, zoom: 1 },
    { t: As.t0, d: 2.2, yaw: 0.02, pitch: 0.08, zoom: 1 },
    { t: F.t0, d: 2.6, yaw: 0.3, pitch: 0.16, zoom: 0.56 },
    { t: F.t0 + 5.6, d: 2.6, yaw: 0.58, pitch: 0.3, zoom: 0.5 },
    { t: F.t0 + 11.0, d: 2.6, yaw: 0.02, pitch: 0.1, zoom: 1 },
  ], [R, B, A, V, P, Bo, As, F, moves])
  useFrame(() => {
    const t = clock()
    let yaw = camKeys[0]!.yaw
    let pitch = camKeys[0]!.pitch
    let zoom = camKeys[0]!.zoom
    for (let i = 1; i < camKeys.length; i++) {
      const k = camKeys[i]!
      const u = easeInOut((t - k.t) / k.d)
      if (u <= 0) break
      yaw += (k.yaw - yaw) * u
      pitch += (k.pitch - pitch) * u
      zoom += (k.zoom - zoom) * u
    }
    const c = cam.current
    c.active = true
    c.yaw = yaw + 0.12 * Math.sin(0.35 * t)
    c.pitch = pitch + 0.03 * Math.sin(0.27 * t + 1)
    c.zoom = zoom
  })

  // размеры для декорации финала — как у модели карточки
  const geo = useMemo(() => {
    const rC = model.atoms[0]?.r ?? 0.134
    const rO = model.atoms[1]?.r ?? 0.117
    const dCO = Math.hypot(...sub3(model.atoms[1]?.pos ?? [0.331, 0, 0], model.atoms[0]?.pos ?? [0, 0, 0])) || 0.331
    const K = dCO / 116 // единиц модели на пм (C=O 116 пм)
    return { rC, rO, dCO, a: 562 * K, stickR: 5.2 * K, stickStep: 15 * K }
  }, [model])

  const appearR = (t: number) => seg(t, R.t0 + 0.3, R.t0 + 1.1)
  const spMix = (t: number) => seg(t, H0, H1)
  const oAppear = (t: number) => seg(t, A.t0 + 0.6, A.t0 + 1.5)
  const loneOut = (t: number) => 1 - seg(t, F.t0 + 0.9, F.t0 + 1.7)
  const overlapOut = (t: number) => 1 - seg(t, As.t0 + 2.6, As.t0 + 3.6)
  const stickBursts = story.sticks.map((s) => ({ t0: s.t0, p: s.b === 1 ? mid01 : mid02 }))
  const sticksStart = story.sticks.length ? Math.min(...story.sticks.map((s) => s.t0)) : Bo.t0
  const zAxis = (): V3 => [0, 0, 1]
  const yAxis = (): V3 => [0, 1, 0]
  const xAxis = (): V3 => [1, 0, 0]
  const xNeg = (): V3 => [-1, 0, 0]
  const shrink = (p: PFn): PFn => (t) => lerp3(p(t), add3(pC(t), [0, 0.16, 0]), seg(t, As.t0 + 3.8, As.t0 + 4.8))

  return (
    <group>
      {/* ── углерод: 2s (сфера), 2p_y, 2p_z; 2p_x пустое (тусклое) → возбуждение → sp вдоль оси ── */}
      <Lobe kind="s" center={pC} r={0.19} color={C_LOBE} k={(t) => appearR(t) * (1 - 0.35 * seg(t, X0, X1)) * (1 - spMix(t))} />
      <Lobe kind="p" center={pC} axis={yAxis} r={0.22} color={C_LOBE} k={(t) => appearR(t) * fadeBy(moves.p1)(t)} />
      <Lobe kind="p" center={pC} axis={zAxis} r={0.22} color={C_LOBE} k={(t) => appearR(t) * fadeBy(moves.p2)(t)} />
      <Lobe kind="p" center={pC} axis={xAxis} r={0.22} color={C_LOBE} k={(t) => appearR(t) * (0.28 + 0.72 * seg(t, X0, X1)) * (1 - spMix(t))} />
      <Lobe kind="lone" center={pC} axis={xAxis} r={0.2} color={C_LOBE} k={(t) => spMix(t) * fadeBy(moves.s1)(t)} />
      <Lobe kind="lone" center={pC} axis={xNeg} r={0.2} color={C_LOBE} k={(t) => spMix(t) * fadeBy(moves.s2)(t)} />
      {/* ── O₂ до разрыва: σ (между ядрами) + π (сбоку от оси O=O) ── */}
      <Lobe kind="s" center={midO} r={0.1} color={SIG} k={(t) => seg(t, R.t0 + 0.4, R.t0 + 1.2) * (1 - seg(t, B.t0 + 0.4, B.t0 + 1.3))} />
      <Lobe kind="p" center={midO} axis={(t) => { const d = dir(pO2, pO1)(t); return [d[1], -d[0], 0] }} r={0.17} color={PI} k={(t) => seg(t, R.t0 + 0.6, R.t0 + 1.4) * (1 - seg(t, B.t0 + 0.4, B.t0 + 1.3))} />
      {/* ── кислород: p_x (к C → σ), p_y у O₁ / p_z у O₂ (→ π), неподелённые пары: 2s и третье p-облако ── */}
      <Lobe kind="p" center={pO1} axis={xAxis} r={0.2} color={O_LOBE} k={(t) => oAppear(t) * fadeBy(moves.s1)(t)} />
      <Lobe kind="p" center={pO1} axis={yAxis} r={0.2} color={O_LOBE} k={(t) => oAppear(t) * fadeBy(moves.p1)(t)} />
      <Lobe kind="s" center={pO1} r={0.16} color={O_LOBE} k={(t) => 0.7 * seg(t, V.t0 + 0.2, V.t0 + 1) * loneOut(t)} />
      <Lobe kind="lone" center={pO1} axis={() => [0, 0.33, 0.94]} r={0.17} color={O_LOBE} k={(t) => seg(t, V.t0 + 0.2, V.t0 + 1) * loneOut(t)} />
      <Lobe kind="p" center={pO2} axis={xAxis} r={0.2} color={O_LOBE} k={(t) => oAppear(t) * fadeBy(moves.s2)(t)} />
      <Lobe kind="p" center={pO2} axis={zAxis} r={0.2} color={O_LOBE} k={(t) => oAppear(t) * fadeBy(moves.p2)(t)} />
      <Lobe kind="s" center={pO2} r={0.16} color={O_LOBE} k={(t) => 0.7 * seg(t, V.t0 + 0.2, V.t0 + 1) * loneOut(t)} />
      <Lobe kind="lone" center={pO2} axis={() => [0, 0.94, 0.33]} r={0.17} color={O_LOBE} k={(t) => seg(t, V.t0 + 0.2, V.t0 + 1) * loneOut(t)} />
      {/* ── перекрывания: σ по оси, π над/под осью (C=O₁ — по y, C=O₂ — по z) ── */}
      <Lobe kind="s" center={mid01} r={0.11} color={SIG} k={(t) => seg(t, moves.s1.t0 + 0.3, moves.s1.t1) * overlapOut(t)} />
      <Lobe kind="p" center={mid01} axis={yAxis} r={0.14} color={PI} k={(t) => seg(t, moves.p1.t0 + 0.3, moves.p1.t1) * overlapOut(t)} />
      <Lobe kind="s" center={mid02} r={0.11} color={SIG} k={(t) => seg(t, moves.s2.t0 + 0.3, moves.s2.t1) * overlapOut(t)} />
      <Lobe kind="p" center={mid02} axis={zAxis} r={0.14} color={PI} k={(t) => seg(t, moves.p2.t0 + 0.3, moves.p2.t1) * overlapOut(t)} />
      {/* ── электроны (данные story: число и моменты) ── */}
      {electrons.map((x, i) =>
        x.moving && !lowPower ? <CO2Electron key={i} pos={x.pos} r={story.eR * 1.15} k={x.k} color={x.color} /> : <Electron key={i} pos={x.pos} r={story.eR * 1.15} k={x.k} color={x.color} trail={false} />,
      )}
      {/* ── энергия: поджиг, образование пар, палочки ── */}
      <Burst pos={midO} t0={B.t0 + 0.45} dur={1.5} r={0.5} color="#ffb86b" />
      <Glow pos={midO} r={0.34} k={(t) => 0.8 * win(t, B.t0 + 0.2, B.t0 + 2.4, 0.5)} color="#fb923c" />
      {[moves.s1, moves.p1].map((m, i) => <Burst key={`b1${i}`} pos={mid01} t0={m.t1 - 0.1} dur={1.1} r={0.3} />)}
      {[moves.s2, moves.p2].map((m, i) => <Burst key={`b2${i}`} pos={mid02} t0={m.t1 - 0.1} dur={1.1} r={0.3} />)}
      {stickBursts.map((s, i) => <Burst key={`s${i}`} pos={s.p} t0={s.t0} dur={0.9} r={0.22} color="#ffd7a8" />)}
      {/* ── подписи ── */}
      <Tag pos={at(pC, [0, 0.3, 0])} text={T('carbon')} k={(t) => win(t, R.t0 + 0.5, R.t1 + 0.6)} />
      <Tag pos={at(midO, [0, 0.45, 0])} text={T('o2')} k={(t) => win(t, R.t0 + 0.9, B.t0 + 0.3)} />
      <Tag pos={at(midO, [-0.33, 0, 0])} text={T('sigma')} k={(t) => win(t, R.t0 + 1.3, B.t0 + 0.2)} />
      <Tag pos={at(midO, [0.33, 0, 0])} text={T('pi')} k={(t) => win(t, R.t0 + 1.3, B.t0 + 0.2)} />
      <Tag pos={at(midO, [0, 0.45, 0])} text={T('ignite')} tone="heat" k={(t) => win(t, B.t0 + 0.5, B.t1 - 0.1)} />
      <Tag pos={at(pO1, [0, 0.32, 0])} text={T('twoUnpaired')} tone="minus" k={(t) => win(t, A.t0 + 0.9, V.t0 + 1.6)} />
      <Tag pos={at(pO2, [0, -0.32, 0])} text={T('twoUnpaired')} tone="minus" k={(t) => win(t, A.t0 + 0.9, V.t0 + 1.6)} />
      <Tag pos={at(pC, [0, -0.36, 0])} text={T('ground')} k={(t) => win(t, A.t0 + 0.5, X0 - 0.1)} />
      <Tag pos={at(pC, [0, 0.38, 0])} text={T('jump')} tone="key" k={(t) => win(t, X0 - 0.2, X1 + 0.4)} />
      <Tag pos={at(pC, [0, -0.36, 0])} text={T('excited')} tone="key" k={(t) => win(t, X1 + 0.1, P.t0 + 1)} />
      <Tag pos={at(mid01, [0, -0.2, 0])} text={T('sigma')} k={(t) => win(t, moves.s1.t0 + 0.5, moves.s1.t1 + 1.3)} />
      <Tag pos={at(mid01, [0, 0.3, 0])} text={T('pi')} k={(t) => win(t, moves.p1.t0 + 0.5, moves.p1.t1 + 1.3)} />
      <Tag pos={at(mid02, [0, -0.2, 0])} text={T('sigma')} k={(t) => win(t, moves.s2.t0 + 0.5, moves.s2.t1 + 1.3)} />
      <Tag pos={at(mid02, [0, 0.3, 0])} text={T('pi')} k={(t) => win(t, moves.p2.t0 + 0.5, moves.p2.t1 + 1.3)} />
      <Tag pos={at(pC, [0, -0.3, 0])} text={T('deltaPlus')} tone="plus" k={(t) => win(t, P.t0 + 1.7, As.t0 + 0.9)} />
      <Tag pos={at(pO1, [0, -0.3, 0])} text={T('deltaMinus')} tone="minus" k={(t) => win(t, P.t0 + 1.7, As.t0 + 0.9)} />
      <Tag pos={at(pO2, [0, -0.3, 0])} text={T('deltaMinus')} tone="minus" k={(t) => win(t, moves.s2.t1 - 0.2, As.t0 + 0.9)} />
      <Tag pos={at(pC, [0, 0.5, 0])} text={T('heat')} tone="heat" k={(t) => win(t, sticksStart + 0.4, Bo.t1 + 0.8)} />
      {/* ── геометрия: 180°, 1,16 Å, диполи гасят друг друга ── */}
      <AngleArc v={pC} a={pO1} b={pO2} r={0.5} k={(t) => win(t, As.t0 + 0.3, F.t0 + 1.5)} label={() => T('angle')} />
      <MeasureLine a={pC} b={pO1} offset={-0.2} text={T('length')} k={(t) => win(t, As.t0 + 1.2, As.t0 + 3.8)} />
      <DipoleArrow from={at(pC, [0, 0.16, 0])} to={shrink(at(pO1, [0, 0.16, 0]))} k={(t) => win(t, As.t0 + 1.6, As.t0 + 5.2)} />
      <DipoleArrow from={at(pC, [0, 0.16, 0])} to={shrink(at(pO2, [0, 0.16, 0]))} k={(t) => win(t, As.t0 + 1.6, As.t0 + 5.2)} />
      <Tag pos={at(pC, [0, -0.45, 0])} text={T('cancel')} tone="key" k={(t) => win(t, As.t0 + 3.6, F.t0 + 2)} />
      {/* ── финал: газ → сухой лёд (ГЦК-ячейка), окружение гаснет — остаётся модель ── */}
      <CO2Gas {...geo} lowPower={lowPower} k={(t) => win(t, F.t0 + 0.5, F.t0 + 12.4, 0.9)} lattice={(t) => seg(t, F.t0 + 6, F.t0 + 8.2)} edges={(t) => win(t, F.t0 + 7.2, F.t0 + 12, 0.6)} />
      <Tag pos={() => [0, -0.62, 0]} text={T('gas')} k={(t) => win(t, F.t0 + 1.2, F.t0 + 5.6)} />
      <Tag pos={() => [0, -0.62, 0]} text={T('dryIce')} tone="key" k={(t) => win(t, F.t0 + 7.6, F.t0 + 11.4)} />
    </group>
  )
}

export const CO2Scene: ShowcaseScene = CO2SceneImpl
CO2Scene.hideElectrons = true
