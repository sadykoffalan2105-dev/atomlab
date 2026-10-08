/**
 * Showcase H₂O — 2H₂ + O₂ → 2H₂O (Kimyo 8–9: ковалентная полярная связь, угол 104,5°, водородная связь).
 *
 * Сцена рисуется ВНУТРИ группы атомов FormationMoleculeView: атомы/палочки — вид (atomPosAt), здесь — облака
 * (1s у H, 2p-гантели и неподелённые пары у O), восемь электронов ровно по story.electrons, вспышки энергии при
 * образовании связей, подписи (δ±, угол 90° → 104,5°, длина 0,96 Å, диполь), честная стехиометрия (вторая H₂ в кадре,
 * вторая H₂O-«дублёр» собирается рядом) и окружение в финале: шесть молекул воды с водородными связями → намёк на
 * шестиугольное кольцо льда → всё гаснет, остаётся модель карточки. Всё — функции t (перемотка безопасна).
 */
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { V3 } from '../../../hero/schoolHeroModel'
import { atomPosAt, clamp01, easeInOut, type StageKey } from '../../formationStory'
import { add3, AngleArc, Burst, DipoleArrow, Electron, Glow, len3, lerp3, Lobe, MeasureLine, mid3, norm3, seg, sub3, Tag, useClockCtx, win, type PFn } from '../kit/core'
import { DecorH2, DecorWaters, type WaterPose } from '../kit/h2o-decor'
import type { ShowcaseProps, ShowcaseScene } from '../types'

/* ── геометрия (мир модели: 1 Å = 0,285) ── */
const A = 0.285
const OH = 0.96 * A // длина O–H
const HB = 1.8 * A // водородная связь H···O (≈1,8 Å; O···O ≈ 2,76 Å)
const OO_ICE = 2.76 * A
const ANG = (104.5 * Math.PI) / 180
const HALF0 = (45 * Math.PI) / 180 // полуугол между p-гантелями (90°)
const HALF1 = ANG / 2

const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
/** Поворот v вокруг единичной оси n на угол a (Родриг). */
function rot3(v: V3, n: V3, a: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const k = cross3(n, v)
  const d = dot3(n, v) * (1 - c)
  return [v[0] * c + k[0] * s + n[0] * d, v[1] * c + k[1] * s + n[1] * d, v[2] * c + k[2] * s + n[2] * d]
}
/** Направление под углом ang к d в сторону target (компонента target ⟂ d). */
function towards(d: V3, target: V3, ang: number): V3 {
  const w = norm3(sub3(target, d.map((x) => x * dot3(d, target)) as V3))
  return norm3(add3(d.map((x) => x * Math.cos(ang)) as V3, w, Math.sin(ang)))
}

type Frame = {
  O: V3; H1: V3; H2: V3
  /** биссектриса O → середина H–H, нормаль плоскости, боковое направление */
  b: V3; n: V3; side: V3
  /** оси p-гантелей (к H1 / к H2), раскрытие 90° → 104,5° */
  d1: V3; d2: V3
  /** неподелённые пары — от H, над и под плоскостью */
  lA: V3; lB: V3
  /** второй атом O (призрак вида) */
  G: V3
  uOpen: number
}

/** Молекула воды: O, направление первой связи, «вверх» для плоскости. */
function water(o: V3, d1: V3, up: V3): WaterPose {
  const h1 = add3(o, d1, OH)
  const d2 = towards(d1, up, ANG)
  return { o, h1, h2: add3(o, d2, OH) }
}

const H2OScene: ShowcaseScene = ({ story, model, cam, lowPower }: ShowcaseProps) => {
  const three = useThree()
  const portrait = useRef(false)
  const S = useMemo(() => {
    const st = (k: StageKey) => {
      const s = story.stages.find((x) => x.key === k) ?? story.stages[0]!
      return { t0: s.t0, t1: s.t0 + s.dur, dur: s.dur }
    }
    return { reagents: st('reagents'), break: st('break'), approach: st('approach'), valence: st('valence'), pairs: st('pairs'), bonds: st('bonds'), assemble: st('assemble'), final: st('final') }
  }, [story])
  const rO = model.atoms[0]?.r ?? 0.117
  const rH = model.atoms[1]?.r ?? 0.055
  const rStick = 5.2 * A * 0.01
  const eR = Math.max(story.eR * 1.4, 0.02)

  /* ── кадр геометрии (один расчёт на t) ── */
  const fr = useMemo(() => {
    const bufs: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const cache: { t: number; f: Frame | null } = { t: NaN, f: null }
    const g = story.ghosts[0]
    return (t: number): Frame => {
      if (cache.f && cache.t === t) return cache.f
      const O = [...atomPosAt(story, 0, t, bufs[0]!)] as V3
      const H1 = [...atomPosAt(story, 1, t, bufs[1]!)] as V3
      const H2 = [...atomPosAt(story, 2, t, bufs[2]!)] as V3
      const v1 = sub3(H1, O)
      const v2 = sub3(H2, O)
      let b = norm3(add3(norm3(v1), norm3(v2)))
      if (len3(b) < 1e-6 || !Number.isFinite(b[0])) b = [0, -1, 0]
      let n = norm3(cross3(v1, v2))
      if (!(len3(cross3(v1, v2)) > 1e-8)) n = [0, 0, 1]
      const side = norm3(cross3(n, b))
      const uOpen = seg(t, S.bonds.t0 + 0.4, S.bonds.t1 - 0.2)
      const half = HALF0 + (HALF1 - HALF0) * uOpen
      let d1 = rot3(b, n, half)
      let d2 = rot3(b, n, -half)
      if (dot3(d1, v1) < dot3(d1, v2)) [d1, d2] = [d2, d1]
      const lA = norm3(add3(b.map((x) => -1.1 * x) as V3, n, 0.9))
      const lB = norm3(add3(b.map((x) => -1.1 * x) as V3, n, -0.9))
      const gu = easeInOut((t - S.break.t0 - 0.6) / (S.break.dur - 0.6))
      const G: V3 = g ? lerp3(g.p0, g.p1, gu) : [O[0], O[1] + 2 * rO, O[2]]
      const f: Frame = { O, H1, H2, b, n, side, d1, d2, lA, lB, G, uOpen }
      cache.t = t
      cache.f = f
      return f
    }
  }, [story, S, rO])

  /* ── вторая молекула H₂ (декорация, стехиометрия 2H₂ + O₂) и вторая H₂O-«дублёр» ── */
  const h2b = useMemo(() => {
    const g = story.ghosts[0]
    const base: V3 = [story.P[0][1]![0], 0.44, 0]
    const far: V3 = g ? add3(g.p1, [0.3, 0.25, 0]) : [0.9, 0.9, 0]
    const at = (sign: 1 | -1) => (t: number): V3 => {
      const sway = 0.01 * Math.sin(t * 1.3 + sign)
      const sep = 0.084 + 0.05 * easeInOut((t - S.break.t0 - 0.6) / (S.break.dur - 0.9))
      const p: V3 = [base[0], base[1] + sign * sep + sway, base[2]]
      const u = seg(t, S.approach.t0 - 0.4, S.approach.t0 + 1.6)
      return lerp3(p, add3(far, [0, sign * 0.1, 0]), u)
    }
    return {
      hA: at(1),
      hB: at(-1),
      k: (t: number) => win(t, -1, S.approach.t0 + 1.5, 0.7),
      stick: (t: number) => 1 - easeInOut((t - S.break.t0 - 0.6) / 0.8),
    }
  }, [story, S])

  /* ── окружение: раскладка шести молекул воды (жидкость ↔ кольцо льда) ── */
  const env = useMemo(() => {
    const PF = story.P[4]
    const Of = PF[0]!
    const H1f = PF[1]!
    const H2f = PF[2]!
    const v1 = norm3(sub3(H1f, Of))
    const v2 = norm3(sub3(H2f, Of))
    const b = norm3(add3(v1, v2))
    const n = norm3(cross3(v1, v2))
    const lA = norm3(add3(b.map((x) => -1.1 * x) as V3, n, 0.9))
    const lB = norm3(add3(b.map((x) => -1.1 * x) as V3, n, -0.9))
    const liquid = (): { poses: WaterPose[] } => {
      // 0, 1 — акцепторы в плоскости модели (принимают H···O от её H), 2, 3 — доноры с неподелённых пар (их H → O
      // модели), 4, 5 — доноры к неподелённым парам акцепторов, позади (перспектива — помещаются в кадр).
      const O0 = add3(H2f, v2, HB)
      const O1 = add3(H1f, v1, HB)
      const m0 = water(O0, rot3(v2, n, HALF1), rot3(v2, n, -Math.PI / 2))
      const m1 = water(O1, rot3(v1, n, -HALF1), rot3(v1, n, Math.PI / 2))
      const O2 = add3(Of, lA, OH + HB)
      const O3 = add3(Of, lB, OH + HB)
      const m2 = water(O2, lA.map((x) => -x) as V3, [-1, 0.2, 0])
      const m3 = water(O3, lB.map((x) => -x) as V3, [1, 0.2, 0])
      const back = (m: WaterPose): V3 => {
        const bis = norm3(add3(sub3(m.h1, m.o), sub3(m.h2, m.o)))
        return norm3(add3(bis.map((x) => -0.8 * x) as V3, n, -1))
      }
      const l0 = back(m0)
      const l1 = back(m1)
      const m4 = water(add3(O0, l0, OH + HB), l0.map((x) => -x) as V3, [0, 1, 0])
      const m5 = water(add3(O1, l1, OH + HB), l1.map((x) => -x) as V3, [0, 1, 0])
      return { poses: [m0, m1, m2, m3, m4, m5] }
    }
    const ice = (port: boolean): { poses: WaterPose[] } => {
      // кольцо позади модели (z −1,05): перспектива уменьшает его — честный размер O···O 2,76 Å помещается в кадр
      const e1: V3 = port ? [0, 1, 0] : [1, 0, 0]
      const sh: V3 = port ? [1, 0, 0] : [0, 1, 0]
      const beta = (22 * Math.PI) / 180
      const e2: V3 = norm3(add3(sh.map((x) => x * Math.cos(beta)) as V3, [0, 0, 1], Math.sin(beta)))
      const e3 = norm3(cross3(e1, e2))
      const c: V3 = [0, 0.06, -1.05]
      const Os: V3[] = []
      for (let k = 0; k < 6; k++) {
        const ph = (Math.PI / 3) * k
        Os.push(add3(add3(c, e1, OO_ICE * Math.cos(ph)), e2, OO_ICE * Math.sin(ph)))
      }
      const poses: WaterPose[] = []
      for (let k = 0; k < 6; k++) {
        const o = Os[k]!
        const nx = Os[(k + 1) % 6]!
        const d1 = norm3(sub3(nx, o))
        poses.push(water(o, d1, k % 2 ? e3 : (e3.map((x) => -x) as V3)))
      }
      return { poses }
    }
    const L = [liquid(), liquid()]
    const I = [ice(false), ice(true)]
    const mixPose = (a: WaterPose, c: WaterPose, u: number, bob: V3): WaterPose => {
      const o = add3(lerp3(a.o, c.o, u), bob)
      const d1 = norm3(lerp3(norm3(sub3(a.h1, a.o)), norm3(sub3(c.h1, c.o)), u))
      const d2 = norm3(lerp3(norm3(sub3(a.h2, a.o)), norm3(sub3(c.h2, c.o)), u))
      return { o, h1: add3(o, d1, OH), h2: add3(o, d2, OH) }
    }
    const out: WaterPose[] = Array.from({ length: 6 }, () => ({ o: [0, 0, 0], h1: [0, 0, 0], h2: [0, 0, 0] }))
    const outHb: [V3, V3][] = Array.from({ length: 6 }, () => [[0, 0, 0], [0, 0, 0]])
    const cache = { t: NaN, port: false }
    const layout = (t: number): readonly WaterPose[] => {
      const port = portrait.current
      if (cache.t === t && cache.port === port) return out
      cache.t = t
      cache.port = port
      const li = L[port ? 1 : 0]!
      const ic = I[port ? 1 : 0]!
      const uIce = seg(t, S.final.t0 + 6.6, S.final.t0 + 8.4)
      const uIn = seg(t, S.assemble.t0 + 3.2, S.assemble.t0 + 5.4)
      for (let i = 0; i < 6; i++) {
        const bob: V3 = [0.012 * Math.sin(0.9 * t + i * 1.7), 0.012 * Math.sin(0.7 * t + i * 2.3), 0.01 * Math.sin(0.8 * t + i)]
        let p = mixPose(li.poses[i]!, ic.poses[i]!, uIce, bob.map((x) => x * (1 - uIce)) as V3)
        if (i === 0 && uIn < 1) {
          // дублёр прилетает из угла, куда ушли второй O и вторая H₂
          const off: V3 = [0.55 * (1 - uIn), 0.75 * (1 - uIn), -0.1 * (1 - uIn)]
          p = { o: add3(p.o, off), h1: add3(p.h1, off), h2: add3(p.h2, off) }
        }
        out[i] = p
      }
      // водородные связи: в жидкости — H модели → O акцепторов, H доноров → O модели, вторая оболочка;
      // в кольце льда — вдоль рёбер (H молекулы k → O молекулы k+1). Пунктир гаснет на время перестройки (kHb).
      if (uIce < 0.5) {
        outHb[0] = [H2f, out[0]!.o]
        outHb[1] = [H1f, out[1]!.o]
        outHb[2] = [out[2]!.h1, Of]
        outHb[3] = [out[3]!.h1, Of]
        outHb[4] = [out[4]!.h1, out[0]!.o]
        outHb[5] = [out[5]!.h1, out[1]!.o]
      } else for (let i = 0; i < 6; i++) outHb[i] = [out[i]!.h1, out[(i + 1) % 6]!.o]
      return out
    }
    const hb = (t: number): readonly (readonly [V3, V3])[] => {
      layout(t)
      // пунктир виден только когда молекулы на местах (дублёр прилетел; смена жидкость → лёд — короткий разрыв)
      return outHb
    }
    const layoutDub = (t: number): readonly WaterPose[] => [layout(t)[0]!]
    const layoutRest = (t: number): readonly WaterPose[] => layout(t).slice(1)
    return { layout, layoutDub, layoutRest, hb }
  }, [story, S])

  const kEnv = (t: number) => win(t, S.final.t0 + 0.9, S.final.t0 + 12.6, 1.0)
  const kDub = (t: number) => win(t, S.assemble.t0 + 3.0, S.final.t0 + 12.6, 0.8)
  const kHb = (t: number) => kEnv(t) * (1 - win(t, S.final.t0 + 6.4, S.final.t0 + 8.6, 0.4))

  /* ── электроны: ровно story.electrons (их моменты — из аудита), положения — по своей раскладке облаков ── */
  const electrons = useMemo(() => {
    return story.electrons.map((e, i) => {
      const home = (t: number): V3 => {
        const f = fr(t)
        if (e.kind === 'lone') {
          const j = story.electrons.filter((x, k) => x.kind === 'lone' && k < i).length // 0..3
          const l = j < 2 ? f.lA : f.lB
          const sd = norm3(cross3(l, f.b))
          return add3(add3(f.O, l, 0.15), sd, (j % 2 ? 1 : -1) * 0.024)
        }
        if (e.home === 0) {
          const d = e.move?.bond?.b === 1 ? f.d1 : f.d2
          return add3(f.O, d, 0.2)
        }
        const H = e.home === 1 ? f.H1 : f.H2
        return add3(H, norm3(sub3(f.O, H)), 0.05)
      }
      const target = (t: number): V3 => {
        const f = fr(t)
        const bd = e.move?.bond
        const H = bd?.b === 1 ? f.H1 : f.H2
        const ax = norm3(sub3(H, f.O))
        const perp = norm3(cross3(f.n, ax))
        // общая пара смещена к O (полярная связь): 0,42 длины от O
        const M = add3(f.O, sub3(H, f.O), 0.42)
        return add3(M, perp, (e.home === 0 ? 1 : -1) * 0.02)
      }
      const pos = (t: number): V3 => {
        if (!e.move || t < e.move.t0) return home(t)
        const u = easeInOut((t - e.move.t0) / Math.max(1e-6, e.move.t1 - e.move.t0))
        const p = lerp3(home(t), target(t), u)
        const f = fr(t)
        return add3(p, f.n, 0.05 * Math.sin(Math.PI * u) * (e.home === 0 ? 1 : -1))
      }
      const k = (t: number) => clamp01((t - e.tIn) / 0.4) * (1 - clamp01((t - e.tOut) / 0.5))
      return { pos, k, key: i }
    })
  }, [story, fr])

  /* ── камера: ключевые кадры по этапам + дыхание ── */
  const camKeys = useMemo(() => {
    const K: [number, number, number, number][] = [
      [0, 0.0, 0.1, 1.0],
      [S.break.t0, 0.12, 0.16, 1.05],
      [S.approach.t0, -0.2, 0.22, 1.0],
      [S.valence.t0, 0.42, 0.34, 1.12],
      [S.pairs.t0, 0.18, 0.16, 1.18],
      [S.bonds.t0, 0.0, 0.08, 1.15],
      [S.assemble.t0, -0.22, 0.26, 1.0],
      [S.assemble.t0 + 3.2, -0.1, 0.28, 0.66],
      [S.final.t0, 0.25, 0.3, 0.5],
      [S.final.t0 + 6.5, 0.0, 0.22, 0.5],
      [S.final.t0 + 11.2, 0.0, 0.12, 1.0],
    ]
    return K
  }, [S])
  const clockT = useClockCtx()
  useFrame(() => {
    portrait.current = three.size.height > three.size.width
    const t = clockT()
    let k = 0
    for (let i = 0; i < camKeys.length; i++) if (t >= camKeys[i]![0]) k = i
    const cur = camKeys[k]!
    const prev = camKeys[Math.max(0, k - 1)]!
    const u = k === 0 ? 1 : easeInOut((t - cur[0]) / 1.6)
    const c = cam.current
    c.active = true
    c.yaw = prev[1] + (cur[1] - prev[1]) * u + 0.15 * Math.sin(t * 0.4)
    c.pitch = prev[2] + (cur[2] - prev[2]) * u
    c.zoom = prev[3] + (cur[3] - prev[3]) * u
  })

  /* ── функции положений для примитивов ── */
  const P = useMemo(() => {
    const O: PFn = (t) => fr(t).O
    const H1: PFn = (t) => fr(t).H1
    const H2: PFn = (t) => fr(t).H2
    const G: PFn = (t) => fr(t).G
    const midH: PFn = (t) => { const f = fr(t); return mid3(f.H1, f.H2) }
    const midOG: PFn = (t) => { const f = fr(t); return mid3(f.O, f.G) }
    const M1: PFn = (t) => { const f = fr(t); return add3(f.O, sub3(f.H1, f.O), 0.45) }
    const M2: PFn = (t) => { const f = fr(t); return add3(f.O, sub3(f.H2, f.O), 0.45) }
    const tipA: PFn = (t) => { const f = fr(t); return add3(f.O, f.lA, 0.22) }
    const ray1: PFn = (t) => { const f = fr(t); return lerp3(add3(f.O, f.d1, 0.3), f.H1, f.uOpen) }
    const ray2: PFn = (t) => { const f = fr(t); return lerp3(add3(f.O, f.d2, 0.3), f.H2, f.uOpen) }
    const H1s: PFn = (t) => { const f = fr(t); return add3(f.H1, norm3(sub3(f.O, f.H1)), 0.03) }
    const H2s: PFn = (t) => { const f = fr(t); return add3(f.H2, norm3(sub3(f.O, f.H2)), 0.03) }
    const ax1: PFn = (t) => fr(t).d1
    const ax2: PFn = (t) => fr(t).d2
    const axA: PFn = (t) => fr(t).lA
    const axB: PFn = (t) => fr(t).lB
    const X: PFn = () => [1, 0, 0]
    const origin: PFn = () => [0, 0, 0]
    const axOG: PFn = (t) => { const f = fr(t); return norm3(sub3(f.G, f.O)) }
    const piL: PFn = (t) => { const f = fr(t); const m = mid3(f.O, f.G); return [m[0] - 0.19, m[1], m[2]] }
    const piR: PFn = (t) => { const f = fr(t); const m = mid3(f.O, f.G); return [m[0] + 0.19, m[1], m[2]] }
    // стрелка диполя — сбоку от молекулы, вдоль её оси: от стороны H (+) к стороне O (−)
    const dipFrom: PFn = (t) => { const f = fr(t); return add3(mid3(f.H1, f.H2), f.side, 0.3) }
    const dipTo: PFn = (t) => { const f = fr(t); return add3(add3(f.O, f.side, 0.3), f.b, -0.1) }
    const hb0: PFn = (t) => { const p = env.hb(t)[0]!; return mid3(p[0], p[1]) }
    const dub: PFn = (t) => env.layout(t)[0]!.o
    const ring: PFn = (t) => { const w = env.layout(t)[3]!; return w.o }
    return { O, H1, H2, G, midH, midOG, M1, M2, tipA, ray1, ray2, H1s, H2s, ax1, ax2, axA, axB, X, origin, axOG, piL, piR, dipFrom, dipTo, hb0, dub, ring }
  }, [fr, env])

  const stick1 = story.sticks[0]
  const stick2 = story.sticks[1]
  const e0 = story.electrons[0]
  const e1 = story.electrons[1]
  const tPair1 = e0?.move?.t1 ?? S.pairs.t0 + 1.4
  const tPair2 = e1?.move?.t1 ?? S.pairs.t1 - 0.4
  const tS1 = stick1?.t0 ?? S.bonds.t0 + 0.3
  const tS2 = stick2?.t0 ?? S.bonds.t0 + 2
  const tS1e = stick1?.t1 ?? S.bonds.t0 + 1.9
  const tS2e = stick2?.t1 ?? S.bonds.t1 - 0.4

  // окна (с)
  const kReag = (t: number) => win(t, 0.3, S.break.t0 + 0.9, 0.6)
  const kHs1 = (t: number) => win(t, S.approach.t0 + 1.0, tS1e, 0.8)
  const kHs2 = (t: number) => win(t, S.approach.t0 + 1.0, tS2e, 0.8)
  const kP1 = (t: number) => win(t, S.approach.t0 + 1.3, tS1e + 0.6, 0.9)
  const kP2 = (t: number) => win(t, S.approach.t0 + 1.3, tS2e + 0.6, 0.9)
  const kLone = (t: number) => win(t, S.valence.t0 + 1.0, S.final.t0 + 1.2, 0.9)
  const k2s = (t: number) => 0.55 * win(t, S.valence.t0 + 0.3, S.valence.t1, 0.6)
  const kArc = (t: number) => win(t, S.bonds.t0 + 0.2, S.assemble.t0 + 1.4, 0.6)
  const kMeasure = (t: number) => win(t, S.assemble.t0 + 0.4, S.assemble.t0 + 3.4, 0.5)
  const kDip = (t: number) => win(t, S.assemble.t0 + 1.4, S.final.t0 + 1.4, 0.6)
  const kDelta = (t: number) => win(t, tPair1 + 0.6, S.assemble.t0 + 3.4, 0.5)
  const kDelta2 = (t: number) => win(t, tPair2 + 0.3, S.assemble.t0 + 3.4, 0.5)
  /** Нижняя строка-подпись: граница кадра зависит от зума этапа (ближе — выше). */
  const BOT_VAL: V3 = [0, -0.42, 0]
  const BOT_PAIRS: V3 = [0, -0.4, 0]
  const BOT_BONDS: V3 = [0, -0.34, 0]
  const BOT_ASM: V3 = [0, -0.3, 0]
  const BOT_FIN: V3 = [0, -0.56, 0]

  const degLabel = (t: number) => `${(90 + 14.5 * fr(t).uOpen).toFixed(1).replace('.', ',')}°`

  return (
    <group name="showcase-h2o">
      {/* ── исходные вещества: H₂ (σ 1s–1s), O₂ (σ + π), вторая H₂ ── */}
      <Lobe kind="s" center={P.H1} r={0.085} k={kReag} />
      <Lobe kind="s" center={P.H2} r={0.085} k={kReag} />
      <Glow pos={P.midH} r={0.07} k={(t) => 0.6 * kReag(t)} color="#9fd3ff" />
      {/* π-связь O₂: боковое перекрывание p-гантелей — два облака по обе стороны оси O=O; σ — свечение на оси */}
      <Lobe kind="p" center={P.piL} axis={P.axOG} r={0.12} k={kReag} color="#c4b5fd" />
      <Lobe kind="p" center={P.piR} axis={P.axOG} r={0.12} k={kReag} color="#c4b5fd" />
      <Glow pos={P.midOG} r={0.09} k={(t) => 0.7 * kReag(t)} color="#e9d5ff" />
      <DecorH2 h1={h2b.hA} h2={h2b.hB} rH={rH} rStick={rStick} k={h2b.k} stick={h2b.stick} lowPower={lowPower} />
      <Tag pos={P.midH} offset={[0, -0.2, 0]} text="H₂ · σ 1s–1s" k={(t) => win(t, 0.8, S.break.t0, 0.5)} />
      <Tag pos={P.midOG} offset={[0.26, 0, 0]} text="O₂ · σ + π" k={(t) => win(t, 1.0, S.break.t0, 0.5)} />
      <Tag pos={P.origin} offset={[0, -0.6, 0]} text="2H₂ + O₂ — гремучий газ" tone="heat" k={(t) => win(t, 1.6, S.break.t0 + 0.2, 0.5)} />

      {/* ── искра: связи рвутся ── */}
      <Burst pos={P.origin} t0={S.break.t0 + 0.2} dur={1.6} r={0.5} color="#ffd7a1" />
      <Burst pos={P.midH} t0={S.break.t0 + 0.6} dur={1.0} r={0.16} color="#fff1c4" />
      <Burst pos={P.midOG} t0={S.break.t0 + 0.7} dur={1.0} r={0.22} color="#fff1c4" />
      <Glow pos={P.origin} r={0.9} k={(t) => 0.35 * win(t, S.break.t0, S.break.t1, 1.0)} color="#fb923c" />
      <Tag pos={P.origin} offset={[0, 0.05, 0]} text="искра!" tone="heat" k={(t) => win(t, S.break.t0 + 0.1, S.break.t0 + 1.6, 0.3)} />
      <Tag pos={P.origin} offset={[0, -0.55, 0]} text="связи H–H и O=O рвутся" tone="heat" k={(t) => win(t, S.break.t0 + 1.4, S.break.t1 + 0.3, 0.5)} />

      {/* ── валентные электроны: 1s у H, 2s² и 2p⁴ у O (две гантели под 90°, две неподелённые пары) ── */}
      <Lobe kind="s" center={P.H1s} r={0.085} k={kHs1} />
      <Lobe kind="s" center={P.H2s} r={0.085} k={kHs2} />
      <Lobe kind="s" center={P.O} r={0.1} k={k2s} color="#c4b5fd" />
      <Lobe kind="p" center={P.O} axis={P.ax1} r={0.16} k={kP1} />
      <Lobe kind="p" center={P.O} axis={P.ax2} r={0.16} k={kP2} />
      <Lobe kind="lone" center={P.O} axis={P.axA} r={0.15} k={kLone} color="#f0abfc" />
      <Lobe kind="lone" center={P.O} axis={P.axB} r={0.15} k={kLone} color="#f0abfc" />
      {electrons.map((e) => (
        <Electron key={e.key} pos={e.pos} r={eR} k={e.k} trail={!lowPower} />
      ))}
      <Tag pos={P.O} offset={[0, 0.34, 0]} text="O: 2s²2p⁴ — 6 валентных e⁻" k={(t) => win(t, S.valence.t0 + 0.4, S.valence.t1 - 0.2, 0.5)} />
      <Tag pos={P.H1} offset={[0, -0.16, 0]} text="H: 1s¹" k={(t) => win(t, S.valence.t0 + 0.6, S.valence.t1 - 0.2, 0.5)} />
      <Tag pos={P.H2} offset={[0, -0.16, 0]} text="H: 1s¹" k={(t) => win(t, S.valence.t0 + 0.6, S.valence.t1 - 0.2, 0.5)} />
      <Tag pos={P.origin} offset={BOT_VAL} text="2 неспаренных e⁻ в p-гантелях под 90° → 2 связи" tone="key" k={(t) => win(t, S.valence.t0 + 1.8, S.valence.t1 + 0.4, 0.5)} />
      <Tag pos={P.tipA} offset={[0.16, 0.12, 0]} text="неподелённые пары" tone="minus" k={(t) => win(t, S.valence.t0 + 2.8, S.pairs.t0 + 1.2, 0.5)} />

      {/* ── общие пары: перекрывание s–p, вспышка, пара смещена к O ── */}
      <Burst pos={P.M1} t0={tPair1} dur={1.1} r={0.1} color="#a5f3fc" />
      <Burst pos={P.M2} t0={tPair2} dur={1.1} r={0.1} color="#a5f3fc" />
      <Glow pos={P.M1} r={0.11} k={(t) => 0.5 * win(t, tPair1 - 0.2, tS1e, 0.5)} color="#67e8f9" />
      <Glow pos={P.M2} r={0.11} k={(t) => 0.5 * win(t, tPair2 - 0.2, tS2e, 0.5)} color="#67e8f9" />
      <Tag pos={P.M1} offset={[-0.16, -0.12, 0]} text="общая электронная пара" k={(t) => win(t, tPair1 + 0.1, tPair1 + 2.6, 0.4)} />
      <Tag pos={P.M2} offset={[0.16, -0.12, 0]} text="общая электронная пара" k={(t) => win(t, tPair2 + 0.1, S.bonds.t0 + 1.2, 0.4)} />
      <Tag pos={P.O} offset={[0, 0.2, 0]} text="δ−" tone="minus" k={kDelta} />
      <Tag pos={P.H1} offset={[0, -0.13, 0]} text="δ+" tone="plus" k={kDelta} />
      <Tag pos={P.H2} offset={[0, -0.13, 0]} text="δ+" tone="plus" k={kDelta2} />
      <Tag pos={P.origin} offset={BOT_PAIRS} text="пара смещена к O (ΔЭО = 1,24): полярная ковалентная связь" tone="key" k={(t) => win(t, tPair1 + 1.2, S.pairs.t1 + 0.3, 0.5)} />

      {/* ── связи: энергия, угол 90° → 104,5° ── */}
      <Burst pos={P.M1} t0={tS1} dur={1.3} r={0.18} color="#fff1c4" />
      <Burst pos={P.M2} t0={tS2} dur={1.3} r={0.18} color="#fff1c4" />
      <AngleArc v={P.O} a={P.ray1} b={P.ray2} r={0.11} k={kArc} label={degLabel} />
      <Tag pos={P.origin} offset={BOT_BONDS} text="неподелённые пары O отталкивают связи: 90° → 104,5°" tone="key" k={(t) => win(t, S.bonds.t0 + 0.6, S.bonds.t1 + 0.5, 0.5)} />

      {/* ── сборка: длина связи, диполь, вторая H₂O ── */}
      <MeasureLine a={P.O} b={P.H1} k={kMeasure} text="O–H 0,96 Å" offset={0.1} />
      <DipoleArrow from={P.dipFrom} to={P.dipTo} k={kDip} width={0.028} />
      <Tag pos={P.origin} offset={BOT_ASM} text="полярная молекула: диполь от H к O" tone="key" k={(t) => win(t, S.assemble.t0 + 1.4, S.assemble.t0 + 3.6, 0.5)} />
      <DecorWaters n={1} nHb={0} layout={env.layoutDub} k={kDub} rO={rO} rH={rH} rStick={rStick} lowPower={lowPower} />
      <Tag pos={P.dub} offset={[0, 0.2, 0]} text="вторая H₂O: 2H₂ + O₂ → 2H₂O" k={(t) => win(t, S.assemble.t0 + 5.2, S.final.t0 + 1.6, 0.5)} />

      {/* ── финал: окружение — водородные связи, намёк на лёд, затем гаснет ── */}
      <DecorWaters n={5} nHb={6} layout={env.layoutRest} hb={env.hb} k={kEnv} kLines={kHb} rO={rO} rH={rH} rStick={rStick} lowPower={lowPower} />
      <Tag pos={P.hb0} offset={[0.06, -0.14, 0]} text="водородная связь O···H" tone="minus" k={(t) => win(t, S.final.t0 + 2.2, S.final.t0 + 6.4, 0.5)} />
      <Tag pos={P.origin} offset={BOT_FIN} text="поэтому вода кипит при 100 °C, а лёд легче воды" tone="key" k={(t) => win(t, S.final.t0 + 3.6, S.final.t0 + 6.6, 0.5)} />
      <Tag pos={P.origin} offset={BOT_FIN} text="лёд: шестиугольные кольца с пустотами — лёд легче воды" tone="key" k={(t) => win(t, S.final.t0 + 8.4, S.final.t0 + 11.4, 0.5)} />
    </group>
  )
}
H2OScene.hideElectrons = true

export default H2OScene
export { H2OScene }
