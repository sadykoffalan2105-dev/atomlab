/**
 * Showcase SiO₂ (кварц): Si + O₂ → атомный каркас тетраэдров SiO₄ (Kimyo 8 § 17 п. 2; Kimyo 9 § «Кремний»).
 *  reagents  — Si (атомный кристалл) и молекулы O₂ (облака σ + π у одной молекулы);
 *  break     — сильный нагрев: O=O рвётся (вспышка, облака расходятся);
 *  valence   — Si 3s²3p² (s-сфера + две p-гантели) → возбуждение 3s¹3p³: четыре лепестка к будущим O; у O —
 *              две неподелённые пары и два неспаренных e⁻; электроны — ровно story.electrons (28), положения свои;
 *  pairs     — четыре полярные пары Si–O (пара смещена к O), δ+/δ−, стрелка диполя, вспышки при росте палочек;
 *  bonds     — тетраэдр SiO₄ (дуга 109,5°, выноска 1,61 Å), мостик Si–O–Si ≈ 144°, волна подсветки тетраэдров
 *              одним мешем: центральный → соседние → все; подпись «SiO₂ — простейшее соотношение, молекул нет»;
 *  assemble  — каркас собирается (атомы — вид), подпись «тетраэдры соединяются вершинами»;
 *  final     — окружение: контур кристалла кварца → песок → стекло (декоративные тетраэдры: порядок → беспорядок);
 *              всё гаснет, остаётся модель карточки. Камера — ключевые кадры по этапам + «дыхание».
 * Всё — функции clock t (перемотка без артефактов). Данные story не меняются (аудит B/C/E).
 */
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import type { V3 } from '../../../hero/schoolHeroModel'
import { atomPosAt, clamp01, easeInOut, screenToModel, type FormationStory, type StageKey } from '../../formationStory'
import { viewLocale } from '../../FormationHud'
import { AngleArc, Burst, DipoleArrow, Electron, Lobe, MeasureLine, Tag, add3, lerp3, len3, mid3, norm3, pulse, seg, sub3, useClockCtx, win, type PFn } from '../kit/core'
import { DecorTetra, HexPrism, SandGrains, TetraFaces, type Tetra } from '../kit/sio2-tetra'
import type { ShowcaseProps, ShowcaseScene } from '../types'
import type { Tri } from '../texts/index'

const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sc3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

/** Подписи 3D (RU/EN/UZ) — коротко, факты из Kimyo 8–9 и справочника. */
const T = {
  siCrystal: ['Si — атомный кристалл', 'Si — atomic crystal', 'Si — atom kristall'],
  o2: ['O₂: σ + π', 'O₂: σ + π', 'O₂: σ + π'],
  heat: ['сильный нагрев: O=O рвётся', 'strong heating: O=O breaks', 'kuchli qizdirish: O=O uziladi'],
  siGround: ['Si 3s²3p² — 4 валентных e⁻', 'Si 3s²3p² — 4 valence e⁻', 'Si 3s²3p² — 4 ta valent e⁻'],
  siExcited: ['возбуждение: 3s¹3p³ — 4 неспаренных', 'excitation: 3s¹3p³ — 4 unpaired', 'uyg‘onish: 3s¹3p³ — 4 ta juftlashmagan'],
  oVal: ['O: 2 неспаренных e⁻ + 2 пары', 'O: 2 unpaired e⁻ + 2 lone pairs', 'O: 2 ta juftlashmagan e⁻ + 2 juft'],
  dPlus: ['δ+', 'δ+', 'δ+'],
  dMinus: ['δ−', 'δ−', 'δ−'],
  den: ['ΔЭО = 1,54 → пара смещена к O', 'ΔEN = 1.54 → pair shifted to O', 'ΔEM = 1,54 → juft O tomon siljigan'],
  angle: ['109,5°', '109.5°', '109,5°'],
  bridge: ['≈ 144°', '≈ 144°', '≈ 144°'],
  len: ['Si–O 1,61 Å', 'Si–O 1.61 Å', 'Si–O 1,61 Å'],
  tetra: ['тетраэдр SiO₄', 'SiO₄ tetrahedron', 'SiO₄ tetraedri'],
  bridgeKey: ['каждый O — мостик между двумя Si', 'every O bridges two Si', 'har bir O — ikkita Si orasida ko‘prik'],
  noMol: ['SiO₂ — простейшее соотношение, молекул нет', 'SiO₂ is the simplest ratio — no molecules', 'SiO₂ — eng sodda nisbat, molekulalar yo‘q'],
  corners: ['тетраэдры соединяются вершинами', 'tetrahedra join corner to corner', 'tetraedrlar uchlari bilan tutashadi'],
  quartz: ['кристалл кварца (горный хрусталь)', 'quartz crystal (rock crystal)', 'kvarts kristalli (tog‘ billuri)'],
  sand: ['песок — зёрна кварца', 'sand — grains of quartz', 'qum — kvarts donachalari'],
  glass: ['стекло: те же тетраэдры, без дальнего порядка', 'glass: same tetrahedra, no long-range order', 'shisha: o‘sha tetraedrlar, uzoq tartibsiz'],
} satisfies Record<string, Tri>

type Key = { t: number; yaw: number; pitch: number; zoom: number }

export const SiO2Scene: ShowcaseScene = function SiO2Scene({ model, story, cam, lowPower }: ShowcaseProps) {
  const L = viewLocale()
  const tx = (k: keyof typeof T) => T[k][L]!
  const clock = useClockCtx()

  const S = useMemo(() => buildScene(story, model), [story, model])

  // ── камера: ключевые кадры по этапам, плавные переходы, «дыхание» ──
  useFrame(() => {
    const t = clock()
    const K = S.keys
    let i = 0
    while (i + 1 < K.length && t >= K[i + 1]!.t) i++
    const a = K[i]!
    const b = K[Math.min(K.length - 1, i + 1)]!
    const u = b === a ? 1 : easeInOut((t - b.t + 1.6) / 1.6)
    const c = cam.current
    c.active = true
    c.yaw = a.yaw + (b.yaw - a.yaw) * u + 0.15 * Math.sin(t * 0.35) + (t > S.fin.t0 ? 0.06 * (t - S.fin.t0) : 0)
    c.pitch = a.pitch + (b.pitch - a.pitch) * u + 0.04 * Math.sin(t * 0.23 + 1)
    c.zoom = a.zoom + (b.zoom - a.zoom) * u
  })

  const { posOf, si, oList, fin, sv, sp, sb, sa, brk, tEx, eR, rSi, rO, up } = S
  const siPos: PFn = (t) => posOf(si, t)
  const lobeK = (a: number, b: number, f = 0.5) => (t: number) => win(t, a, b, f)

  return (
    <group>
      {/* ── reagents / break: одна молекула O₂ крупным планом — σ (вдоль оси) и π (сбоку) ── */}
      {S.o2 && (
        <>
          <Lobe kind="p" center={(t) => posOf(S.o2!.a, t)} axis={(t) => S.o2!.axis(t)} r={1.35 * rO} k={lobeK(0.5, brk.t0 + 1.3, 0.6)} color="#7dd3fc" />
          <Lobe kind="p" center={(t) => posOf(S.o2!.b, t)} axis={(t) => S.o2!.axis(t)} r={1.35 * rO} k={lobeK(0.5, brk.t0 + 1.3, 0.6)} color="#7dd3fc" />
          <Lobe kind="p" center={(t) => posOf(S.o2!.a, t)} axis={(t) => S.o2!.perp(t)} r={1.35 * rO} k={lobeK(0.9, brk.t0 + 1.0, 0.6)} color="#c4b5fd" />
          <Lobe kind="p" center={(t) => posOf(S.o2!.b, t)} axis={(t) => S.o2!.perp(t)} r={1.35 * rO} k={lobeK(0.9, brk.t0 + 1.0, 0.6)} color="#c4b5fd" />
          <Tag pos={(t) => S.o2!.mid(t)} text={tx('o2')} k={lobeK(1.3, brk.t0 - 0.2)} offset={sc3(up, 2.6 * rO)} />
          <Tag pos={(t) => S.o2!.mid(t)} text={tx('heat')} k={lobeK(brk.t0 + 0.3, brk.t0 + brk.dur - 0.2)} tone="heat" offset={sc3(up, 2.6 * rO)} />
          <Burst pos={(t) => S.o2!.mid(t)} t0={brk.t0 + 0.55} dur={1.4} color="#fda4af" r={5 * rO} />
        </>
      )}
      <Tag pos={siPos} text={tx('siCrystal')} k={lobeK(0.9, brk.t0 + 0.6)} offset={sc3(up, 2.4 * rSi)} />

      {/* ── valence: Si 3s² 3p² → 3s¹3p³ ── */}
      <Lobe kind="s" center={siPos} r={1.45 * rSi} k={lobeK(sv.t0 + 0.4, tEx + 0.3, 0.5)} color="#fde68a" />
      <Lobe kind="p" center={siPos} axis={() => S.px} r={1.9 * rSi} k={lobeK(sv.t0 + 0.6, tEx + 0.3, 0.5)} color="#fdba74" />
      <Lobe kind="p" center={siPos} axis={() => S.py} r={1.9 * rSi} k={lobeK(sv.t0 + 0.8, tEx + 0.3, 0.5)} color="#fdba74" />
      {S.D.map((d, k) => (
        <Lobe key={`sd${k}`} kind="lone" center={siPos} axis={() => d} r={2.1 * rSi} k={(t) => win(t, tEx + 0.2, S.siMoveT1[k]! - 0.2, 0.6)} color="#fdba74" />
      ))}
      <Burst pos={siPos} t0={tEx} dur={1.1} color="#fde68a" r={4.5 * rSi} />
      <Tag pos={siPos} text={tx('siGround')} k={lobeK(sv.t0 + 0.7, tEx - 0.1)} offset={sc3(up, 2.6 * rSi)} />
      <Tag pos={siPos} text={tx('siExcited')} k={lobeK(tEx + 0.2, sp.t0 + 0.9)} tone="key" offset={sc3(up, 2.6 * rSi)} />
      {oList.map((o, j) => (
        <group key={`o${j}`}>
          <Lobe kind="lone" center={(t) => posOf(o.i, t)} axis={() => o.n1} r={1.5 * rO} k={lobeK(sv.t0 + 0.9 + 0.1 * j, sb.t0 + 2.5, 0.6)} color="#7dd3fc" />
          <Lobe kind="lone" center={(t) => posOf(o.i, t)} axis={() => o.n2} r={1.5 * rO} k={lobeK(sv.t0 + 1.0 + 0.1 * j, sb.t0 + 2.5, 0.6)} color="#7dd3fc" />
          <Lobe kind="lone" center={(t) => posOf(o.i, t)} axis={() => o.d1} r={1.5 * rO} k={(t) => win(t, sv.t0 + 1.1 + 0.1 * j, o.pairT1 - 0.2, 0.6)} color="#a5f3fc" />
          <Lobe kind="lone" center={(t) => posOf(o.i, t)} axis={() => o.d2} r={1.5 * rO} k={(t) => win(t, sv.t0 + 1.2 + 0.1 * j, o.stick.t0 + 0.2, 0.6)} color="#a5f3fc" />
        </group>
      ))}
      {oList[0] && <Tag pos={(t) => posOf(oList[0]!.i, t)} text={tx('oVal')} k={lobeK(sv.t0 + 1.6, sv.t0 + sv.dur - 0.1)} offset={sc3(up, 2.6 * rO)} />}

      {/* ── электроны: ровно story.electrons, положения — по орбитальным направлениям ── */}
      {S.electrons.map((e, i) => (
        <Electron key={`e${i}`} pos={e.pos} r={eR} k={e.k} color={e.color} trail={!lowPower} />
      ))}

      {/* ── pairs: полярность ── */}
      {oList[0] && (
        <>
          <DipoleArrow from={(t) => add3(posOf(si, t), S.D[0]!, 1.1 * rSi)} to={(t) => add3(posOf(oList[0]!.i, t), S.D[0]!, -1.3 * rO)} k={lobeK(oList[0]!.pairT1 + 0.1, sb.t0 + 2.4, 0.6)} />
          <Tag pos={siPos} text={tx('dPlus')} k={lobeK(oList[0]!.pairT1 + 0.1, sb.t0 + 2.8)} tone="plus" offset={sc3(up, -2.3 * rSi)} />
          <Tag pos={(t) => mid3(posOf(si, t), posOf(oList[0]!.i, t))} text={tx('den')} k={lobeK(oList[0]!.pairT1 + 0.4, sp.t0 + sp.dur - 0.1)} offset={sc3(up, 3.2 * rO)} />
        </>
      )}
      {oList.map((o, j) => (
        <Tag key={`dm${j}`} pos={(t) => posOf(o.i, t)} text={tx('dMinus')} k={lobeK(o.pairT1 + 0.1, sb.t0 + 2.8)} tone="minus" offset={sc3(o.d2, 2.2 * rO)} />
      ))}
      {oList.map((o, j) => (
        <Burst key={`bu${j}`} pos={(t) => mid3(posOf(si, t), posOf(o.i, t))} t0={o.stickC.t0} dur={1.1} color="#fff1c4" r={3.2 * rO} />
      ))}

      {/* ── bonds: тетраэдр, мостик, волна тетраэдров ── */}
      {oList.length >= 2 && (
        <>
          <AngleArc v={siPos} a={(t) => posOf(oList[0]!.i, t)} b={(t) => posOf(oList[1]!.i, t)} r={0.6 * S.dSiO} k={lobeK(S.tTetra, S.tTetra + 4.2, 0.6)} label={() => tx('angle')} />
          <MeasureLine a={siPos} b={(t) => posOf(oList[2]!.i, t)} k={lobeK(S.tTetra + 0.3, S.tTetra + 4.2, 0.6)} text={tx('len')} offset={0.26 * S.dSiO} />
          <Tag pos={siPos} text={tx('tetra')} k={lobeK(S.tTetra + 0.2, S.tTetra + 3.8)} tone="key" offset={sc3(up, -3.4 * rSi)} />
        </>
      )}
      {S.bridge && (
        <>
          <AngleArc v={(t) => posOf(S.bridge!.o, t)} a={siPos} b={(t) => posOf(S.bridge!.si2, t)} r={0.55 * S.dSiO} k={lobeK(S.tBridge, S.tBridge + 4.4, 0.6)} label={() => tx('bridge')} color="#f0abfc" />
          <Tag pos={(t) => posOf(S.bridge!.o, t)} text={tx('bridgeKey')} k={lobeK(S.tBridge + 0.2, S.tBridge + 4.4)} tone="key" offset={sc3(up, 3.2 * rO)} />
        </>
      )}
      <Tag pos={siPos} text={tx('noMol')} k={lobeK(S.tNoMol, sb.t0 + sb.dur + 0.4)} tone="key" offset={sc3(up, 3.6 * rSi)} />
      <TetraFaces tetras={S.tetras} posAt={(i, t, out) => atomPosAt(story, i, t, out)} alpha={S.tetraAlpha} />

      {/* ── assemble ── */}
      <Tag pos={siPos} text={tx('corners')} k={lobeK(sa.t0 + 1.2, sa.t0 + sa.dur - 1.0)} offset={sc3(up, 3.6 * rSi)} />

      {/* ── final: кварц → песок → стекло; модель остаётся ── */}
      <HexPrism r={S.R * 1.22} h={S.R * 1.15} tip={S.R * 0.55} axis={up} k={(t) => win(t, fin.t0 + 0.5, fin.t0 + 4.6, 0.8)} />
      <Tag pos={() => [0, 0, 0]} text={tx('quartz')} k={(t) => win(t, fin.t0 + 0.9, fin.t0 + 4.4)} offset={sc3(up, -S.R * 1.6)} />
      <SandGrains n={lowPower ? 60 : 150} r0={S.R * 1.25} r1={S.R * 1.75} k={(t) => win(t, fin.t0 + 4.3, fin.t0 + 7.6, 0.8)} size={0.09 * S.R} />
      <Tag pos={() => [0, 0, 0]} text={tx('sand')} k={(t) => win(t, fin.t0 + 4.6, fin.t0 + 7.3)} offset={sc3(up, -S.R * 1.6)} />
      <DecorTetra count={lowPower ? 14 : 22} R={S.R * 1.3} edge={1.6 * S.dSiO} k={(t) => win(t, fin.t0 + 7.2, fin.t0 + 10.8, 0.8)} disorder={(t) => seg(t, fin.t0 + 8.5, fin.t0 + 9.6)} />
      <Tag pos={() => [0, 0, 0]} text={tx('glass')} k={(t) => win(t, fin.t0 + 7.6, fin.t0 + 10.5)} offset={sc3(up, -S.R * 1.6)} />
    </group>
  )
}
SiO2Scene.hideElectrons = true

/* ─────────────────────────── геометрия и расписание сцены (из story/model, один раз) ─────────────────────────── */

type ElecView = { pos: PFn; k: (t: number) => number; color: string }
type OInfo = { i: number; d1: V3; d2: V3; n1: V3; n2: V3; pairT1: number; stick: { t0: number; t1: number }; stickC: { t0: number; t1: number } }

function buildScene(story: FormationStory, model: ShowcaseProps['model']) {
  const PF = story.P[4]
  const st = (k: StageKey) => story.stages.find((s) => s.key === k) ?? { key: k, t0: 0, dur: 0.001 }
  const sv = st('valence')
  const sp = st('pairs')
  const sb = st('bonds')
  const sa = st('assemble')
  const fin = st('final')
  const brk = st('break')
  const n = model.atoms.length
  const nbrs: number[][] = model.atoms.map(() => [])
  for (const b of model.bonds) {
    nbrs[b.a]!.push(b.b)
    nbrs[b.b]!.push(b.a)
  }
  // центральный Si — тот, у чьих электронов есть пары (story.electrons), иначе ближайший к центру с 4 соседями
  const siFromE = story.electrons.find((e) => model.atoms[e.home]?.el === 'Si')?.home
  const siList = model.atoms.map((_, i) => i).filter((i) => model.atoms[i]!.el === 'Si' && nbrs[i]!.length === 4).sort((x, y) => len3(PF[x]!) - len3(PF[y]!))
  const si = siFromE ?? siList[0] ?? 0
  const rSi = model.atoms[si]?.r ?? 0.16
  const rO = model.atoms.find((a) => a.el === 'O')?.r ?? 0.095
  const eR = story.eR
  const up = norm3(screenToModel(model, [0, 1, 0]))
  const tmp: V3 = [0, 0, 0]
  const posOf = (i: number, t: number): V3 => {
    atomPosAt(story, i, t, tmp)
    return [tmp[0], tmp[1], tmp[2]]
  }
  let R = 0
  for (const p of PF) R = Math.max(R, len3(p))
  R = Math.max(R, 0.5)

  // O центрального тетраэдра — в порядке электронных пар story (как и палочки)
  const pairE = story.electrons.filter((e) => e.home === si && e.move?.bond)
  const oOrder: number[] = []
  for (const e of pairE) {
    const b = e.move!.bond!
    const o = b.a === si ? b.b : b.a
    if (!oOrder.includes(o)) oOrder.push(o)
  }
  for (const o of nbrs[si]!) if (!oOrder.includes(o)) oOrder.push(o)
  const D: V3[] = oOrder.map((o) => norm3(sub3(PF[o]!, PF[si]!)))
  while (D.length < 4) D.push([0, 1, 0])
  const px = norm3(add3(D[0]!, D[1]!))
  const py = norm3(sub3(D[0]!, D[1]!))
  const dSiO = oOrder[0] != null ? len3(sub3(PF[oOrder[0]!]!, PF[si]!)) : 0.45
  const stickOf = (a: number, b: number) => story.sticks.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))
  const siMoveT1 = oOrder.map((o) => pairE.find((e) => e.move!.bond!.a === o || e.move!.bond!.b === o)?.move?.t1 ?? sp.t0 + sp.dur)
  const tEx = sv.t0 + Math.min(2.4, 0.5 * sv.dur)

  const COS = Math.cos((54.75 * Math.PI) / 180)
  const SIN = Math.sin((54.75 * Math.PI) / 180)
  const oList: OInfo[] = oOrder.slice(0, 4).map((o, k) => {
    const si2 = nbrs[o]!.find((x) => x !== si) ?? si
    const d1 = norm3(sub3(PF[si]!, PF[o]!))
    const d2 = si2 === si ? norm3(sc3(d1, -1)) : norm3(sub3(PF[si2]!, PF[o]!))
    let bis = sc3(add3(d1, d2), -1)
    if (len3(bis) < 1e-4) bis = [0, 1, 0]
    bis = norm3(bis)
    let p = cross3(d1, d2)
    if (len3(p) < 1e-4) p = cross3(d1, [0, 1, 0])
    p = norm3(p)
    const n1 = norm3(add3(sc3(bis, COS), p, SIN))
    const n2 = norm3(add3(sc3(bis, COS), p, -SIN))
    const stick = stickOf(o, si2) ?? { t0: sb.t0 + 1, t1: sb.t0 + 2 }
    const stickC = stickOf(o, si) ?? { t0: sb.t0 + 0.5, t1: sb.t0 + 1.5 }
    return { i: o, d1, d2, n1, n2, pairT1: siMoveT1[k]!, stick: { t0: stick.t0, t1: stick.t1 }, stickC: { t0: stickC.t0, t1: stickC.t1 } }
  })
  const oInfo = new Map(oList.map((o) => [o.i, o]))

  // мостик Si–O–Si: первый O и его второй Si
  const bridge = oList[0] && nbrs[oList[0].i]!.find((x) => x !== si) != null ? { o: oList[0].i, si2: nbrs[oList[0].i]!.find((x) => x !== si)! } : null

  // ── электроны ──
  const lift = (u: number, k: number): V3 => sc3(up, Math.sin(Math.PI * u) * k)
  const homeDist = (i: number) => model.atoms[i]!.r + 2.2 * eR
  const siIdx = story.electrons.map((e, i) => (e.home === si ? i : -1)).filter((i) => i >= 0)
  const oIdx = new Map<number, number[]>()
  story.electrons.forEach((e, i) => {
    if (e.home !== si && oInfo.has(e.home)) {
      if (!oIdx.has(e.home)) oIdx.set(e.home, [])
      oIdx.get(e.home)!.push(i)
    }
  })
  const bondTarget = (e: FormationStory['electrons'][number], t: number): V3 => {
    const bd = e.move!.bond!
    const A = posOf(bd.a, t)
    const B = posOf(bd.b, t)
    const ax = norm3(sub3(B, A))
    // пара у середины связи, смещена к O (более ЭО-атом): полярная связь
    const toO = model.atoms[bd.b]!.el === 'O' ? 1 : -1
    const L = len3(sub3(B, A))
    return add3(add3(mid3(A, B), ax, bd.sign * 1.5 * eR), ax, toO * 0.1 * L)
  }
  const electrons: ElecView[] = story.electrons.map((e, idx) => {
    const appear = (t: number) => clamp01((t - e.tIn) / 0.4)
    if (e.home === si) {
      // Si: 3s² (пара у биссектрисы D0/D1) + 3p² (D2, D3) → возбуждение: по одному вдоль D0…D3
      const k = siIdx.indexOf(idx)
      const dEx = D[k] ?? D[0]!
      const side = norm3(cross3(px, up))
      const g0: V3 = k < 2 ? add3(sc3(px, 1), side, (k === 0 ? -1 : 1) * 0.3) : dEx
      const pos: PFn = (t) => {
        const H = posOf(si, t)
        const u = easeInOut((t - tEx) / 0.8)
        const dir = norm3(lerp3(norm3(g0), dEx, u))
        let p = add3(H, dir, homeDist(si))
        if (e.move && t >= e.move.t0) {
          const uu = easeInOut((t - e.move.t0) / Math.max(1e-6, e.move.t1 - e.move.t0))
          p = add3(lerp3(p, bondTarget(e, t), uu), lift(uu, 0.05 * R))
        }
        return p
      }
      const kf = (t: number) => appear(t) * (1 - clamp01((t - e.tOut) / 0.5))
      return { pos, k: kf, color: '#fde68a' }
    }
    const o = oInfo.get(e.home)!
    const list = oIdx.get(e.home)!
    const k = list.indexOf(idx)
    const side = norm3(cross3(o.n1, o.d1))
    // k=0 — пара с центральным Si (move по story); 1,2 — пара n1; 3,4 — пара n2; 5 — неспаренный к второму Si
    let dir: V3
    if (e.move?.bond) dir = o.d1
    else if (k <= 2) dir = norm3(add3(o.n1, side, k === 1 ? -0.28 : 0.28))
    else if (k <= 4) dir = norm3(add3(o.n2, side, k === 3 ? -0.28 : 0.28))
    else dir = o.d2
    const isSecond = !e.move?.bond && k === 5
    const pos: PFn = (t) => {
      const H = posOf(e.home, t)
      let p = add3(H, dir, homeDist(e.home))
      if (e.move && t >= e.move.t0) {
        const uu = easeInOut((t - e.move.t0) / Math.max(1e-6, e.move.t1 - e.move.t0))
        p = add3(lerp3(p, bondTarget(e, t), uu), lift(uu, 0.05 * R))
      } else if (isSecond && t >= o.stick.t0 - 0.5) {
        // второй неспаренный e⁻ O — в общую пару со вторым Si (его электроны вид не показывает): к середине палочки
        const uu = easeInOut((t - o.stick.t0 + 0.5) / 0.8)
        const A = H
        const B = posOf(nbrs[e.home]!.find((x) => x !== si) ?? si, t)
        const target = add3(mid3(A, B), norm3(sub3(A, B)), 0.1 * len3(sub3(A, B)))
        p = add3(lerp3(p, target, uu), lift(uu, 0.04 * R))
      }
      return p
    }
    const kf = (t: number) => appear(t) * (1 - clamp01((t - (isSecond ? o.stick.t1 : e.tOut)) / 0.5))
    return { pos, k: kf, color: e.move?.bond ? '#a5f3fc' : isSecond ? '#a5f3fc' : '#7dd3fc' }
  })

  // ── тетраэдры (Si с четырьмя O) и расписание волны ──
  const tetras: Tetra[] = []
  const tDone: number[] = []
  for (let i = 0; i < n; i++) {
    if (model.atoms[i]!.el !== 'Si' || nbrs[i]!.length !== 4) continue
    const oo = nbrs[i]!.slice(0, 4) as [number, number, number, number]
    let done = 0
    for (const o of oo) {
      const s = stickOf(i, o)
      done = Math.max(done, s ? s.t1 : sb.t0 + sb.dur)
    }
    tetras.push({ si: i, o: oo })
    tDone.push(done)
  }
  const tetraAlpha = (j: number, t: number) => {
    const td = tDone[j]!
    const on = easeInOut((t - td) / 0.6)
    if (on <= 0) return 0
    const dz = (t - td - 0.5) / 0.9
    const front = Math.exp(-(dz * dz))
    const base = 0.13 + 0.03 * pulse(t, 0.3)
    const out = 1 - seg(t, fin.t0 + 9.8, fin.t0 + 11.2)
    return (base * on + 0.4 * front) * out
  }
  const tTetra = oList.reduce((m, o) => Math.max(m, o.stickC.t1), sb.t0 + 1) + 0.2
  const tBridge = tTetra + 4.4
  const tNoMol = Math.min(tBridge + 4.6, sb.t0 + sb.dur - 3.5)

  // ── молекула O₂, в которой первый O тетраэдра ──
  let o2: { a: number; b: number; axis: (t: number) => V3; perp: (t: number) => V3; mid: (t: number) => V3 } | null = null
  const first = oList[0]?.i
  if (first != null) {
    const rs = story.reagentSticks.find((s) => (s.a === first || s.b === first) && s.b >= 0)
    if (rs) {
      const a = rs.a
      const b = rs.b
      const axis = (t: number) => norm3(sub3(posOf(b, t), posOf(a, t)))
      const perp = (t: number) => {
        const ax = axis(t)
        let p = sub3(up, sc3(ax, dot3(up, ax)))
        if (len3(p) < 1e-4) p = cross3(ax, [1, 0, 0])
        return norm3(p)
      }
      o2 = { a, b, axis, perp, mid: (t) => mid3(posOf(a, t), posOf(b, t)) }
    }
  }

  // ── камера ──
  const keys: Key[] = [
    { t: 0, yaw: 0.25, pitch: 0.18, zoom: 1.0 },
    { t: brk.t0, yaw: 0.3, pitch: 0.2, zoom: 1.12 },
    { t: st('approach').t0, yaw: 0.5, pitch: 0.24, zoom: 1.0 },
    { t: sv.t0, yaw: 0.35, pitch: 0.3, zoom: 1.38 },
    { t: sp.t0, yaw: 0.6, pitch: 0.22, zoom: 1.42 },
    { t: sb.t0, yaw: 0.75, pitch: 0.26, zoom: 1.3 },
    { t: tBridge - 0.5, yaw: 1.0, pitch: 0.3, zoom: 1.12 },
    { t: tNoMol - 0.5, yaw: 1.15, pitch: 0.32, zoom: 0.96 },
    { t: sa.t0, yaw: 1.3, pitch: 0.3, zoom: 0.9 },
    { t: fin.t0, yaw: 1.45, pitch: 0.26, zoom: 0.86 },
    { t: fin.t0 + fin.dur - 2.5, yaw: 1.6, pitch: 0.24, zoom: 1.0 },
  ]

  return { posOf, si, oList, fin, sv, sp, sb, sa, brk, tEx, eR, rSi, rO, up, D, px, py, siMoveT1, dSiO, bridge, electrons, tetras, tetraAlpha, tTetra, tBridge, tNoMol, o2, keys, R }
}
