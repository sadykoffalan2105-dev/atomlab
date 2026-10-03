import { useMemo, useState } from 'react'
import type { FormationPlan, FormationShapeKey } from '../../../../chemistry/formationPlan'
import { formationScript, type FormationRouteKind, type FormationScript } from '../../../../chemistry/formationScripts'
import type { FormationLocale } from '../../../../chemistry/formationText'
import { compoundById } from '../../../../data/compounds'
import { buildSchoolHeroModel } from '../../hero/schoolHeroModel'
import type { StageKey } from '../formationStory'
import { setCloudsOn, useCloudsOn } from './cloudsStore'
import { bridgedDimer, fragmentKind, unitFragment, waterGraph, type FragmentKind } from './fragment'
import { ionicParts, moleculeGraph, valenceAtom, VALENCE, type LAtom, type LGraph, type LPart } from './lewis'
import { FormulaSvg, TransferSvg, type TransferArc, type TransferNode } from './LewisSvg'
import styles from './FormationBoard.module.css'

/**
 * «Доска учителя» рядом с 3D «Как образуется» (Kimyo 8, § 14–17): электронная формула (точки Льюиса), структурная
 * формула, схема перехода e⁻ (ионные), ΔЭО на шкале, решётка / форма и путь получения. Карточка текущего этапа
 * подсвечена; на телефоне доска свёрнута до неё.
 */
type CardKey = 'lewis' | 'struct' | 'transfer' | 'den' | 'lattice'

const FOCUS: Record<StageKey, CardKey> = {
  reagents: 'lattice',
  break: 'lewis',
  approach: 'den',
  // путь получения (нейтрализация, обмен, гидратация …) — уравнение пути в карточке итога
  route: 'lattice',
  valence: 'lewis',
  inner: 'struct',
  transfer: 'transfer',
  pairs: 'struct',
  bonds: 'struct',
  assemble: 'lattice',
  lattice: 'lattice',
  final: 'lattice',
}

const L = (loc: FormationLocale, ru: string, en: string, uz: string) => (loc === 'en' ? en : loc === 'uz' ? uz : ru)

const ROUTE_KIND: Record<FormationRouteKind, [string, string, string]> = {
  elements: ['из простых веществ', 'from simple substances', 'oddiy moddalardan'],
  atoms: ['из атомов', 'from atoms', 'atomlardan'],
  neutralization: ['нейтрализация', 'neutralization', 'neytrallanish'],
  oxideWater: ['оксид + вода', 'oxide + water', 'oksid + suv'],
  oxideAcid: ['оксид + кислота', 'oxide + acid', 'oksid + kislota'],
  baseAcidOxide: ['основный оксид + кислотный оксид', 'basic oxide + acidic oxide', 'asosli oksid + kislotali oksid'],
  exchange: ['обмен ионами в растворе', 'ion exchange in solution', 'eritmada ion almashinishi'],
  decomposition: ['разложение', 'decomposition', 'parchalanish'],
  redox: ['окислительно-восстановительная', 'redox', 'oksidlanish-qaytarilish'],
  hydration: ['присоединение воды', 'adding water', 'suv birikishi'],
  mixture: ['смешение', 'mixing', 'aralashtirish'],
  protonTransfer: ['перенос протона H⁺', 'proton (H⁺) transfer', 'proton (H⁺) o‘tishi'],
  dehydration: ['отщепление воды', 'water removal', 'suv ajralishi'],
}

const BOND_TYPE: Record<FormationPlan['bondType'], [string, string, string]> = {
  ionic: ['ионная', 'ionic', 'ion'],
  'covalent-nonpolar': ['ковалентная неполярная', 'nonpolar covalent', 'kovalent qutbsiz'],
  'covalent-polar': ['ковалентная полярная', 'polar covalent', 'kovalent qutbli'],
  'ionic-covalent': ['ионная между ионами, ковалентная внутри иона', 'ionic between ions, covalent inside the ion', 'ionlar orasida ion, ion ichida kovalent'],
}

const SHAPE: Partial<Record<FormationShapeKey, [string, string, string]>> = {
  linear: ['линейная', 'linear', 'chiziqli'],
  angular: ['уголковая', 'bent', 'burchakli'],
  'trigonal-planar': ['плоский треугольник', 'trigonal planar', 'yassi uchburchak'],
  'trigonal-pyramidal': ['пирамида', 'trigonal pyramid', 'piramida'],
  tetrahedral: ['тетраэдр', 'tetrahedron', 'tetraedr'],
  octahedral: ['октаэдр', 'octahedron', 'oktaedr'],
  ring: ['кольцо', 'ring', 'halqa'],
  'tetrahedron-p4': ['тетраэдр P₄', 'P₄ tetrahedron', 'P₄ tetraedr'],
  'ionic-lattice': ['ионная решётка', 'ionic lattice', 'ion kristall panjara'],
  'atomic-lattice': ['атомная решётка', 'atomic lattice', 'atom kristall panjara'],
}

const LATTICE_KIND: Record<FormationScript['latticeKind'], [string, string, string]> = {
  generator: ['ионная кристаллическая решётка', 'ionic crystal lattice', 'ion kristall panjara'],
  schema: ['ионная кристаллическая решётка', 'ionic crystal lattice', 'ion kristall panjara'],
  molecular: ['молекулярная решётка (молекулы в узлах)', 'molecular lattice (molecules at the sites)', 'molekulyar kristall panjara'],
  none: ['свободные молекулы', 'free molecules', 'erkin molekulalar'],
  network: ['атомная решётка — каркас', 'atomic lattice (framework)', 'atom kristall panjara (karkas)'],
  chain: ['полимерные цепи', 'polymer chains', 'polimer zanjirlar'],
}

const pick = (t: [string, string, string], loc: FormationLocale) => (loc === 'en' ? t[1] : loc === 'uz' ? t[2] : t[0])
const num = (x: number, loc: FormationLocale) => (loc === 'en' ? x.toFixed(2) : x.toFixed(2).replace('.', ','))

/** Решётка по-русски: вид решётки + подробности из таблицы правил (без служебных пометок). */
function ruLattice(s: FormationScript): string {
  const t = s.lattice.replace(/\s*\(генератор есть\)/g, '').replace(/\s*\(школьная формула\)/g, '')
  return /решётк|молекул|каркас|цеп/i.test(t.split(/[;,]/)[0]!) ? t : `${pick(LATTICE_KIND[s.latticeKind], 'ru')}: ${t}`
}

/** Атомы до связи (по одному на элемент, с коэффициентом): 2 H· + ·Ö·. */
function atomsOf(plan: FormationPlan): { atom: LAtom; count: number }[] {
  const comp: Record<string, number> = {}
  for (const sp of plan.species) for (const [el, n] of Object.entries(sp.comp)) comp[el] = (comp[el] ?? 0) + n * (sp.kind === 'molecule' && plan.mode === 'ionic' ? sp.count : sp.kind === 'molecule' ? 1 : sp.count)
  return Object.entries(comp)
    .filter(([el]) => VALENCE[el] != null)
    .slice(0, 4)
    .map(([el, n]) => ({ atom: valenceAtom(el), count: n }))
}

/** Состав молекулы (ковалентный план): {P: 4, O: 10}. */
function molComp(plan: FormationPlan): Record<string, number> {
  const comp: Record<string, number> = {}
  for (const sp of plan.species) for (const [el, n] of Object.entries(sp.comp)) comp[el] = (comp[el] ?? 0) + n * (sp.kind === 'molecule' ? 1 : sp.count)
  return comp
}

/**
 * Повторяющийся фрагмент вместо всей частицы (fragment.ts): каркас N (SiO₂), звено полимера PM ((CrO₃)ₙ, (HPO₃)ₙ),
 * клетка P₄O₁₀ (узел P), мостик X–O–X (Cl₂O₇, Mn₂O₇, N₂O₅, H₄P₂O₇). null — обычная молекула.
 */
function fragmentGraph(plan: FormationPlan, type: string): LGraph | null {
  const comp = molComp(plan)
  if (type === 'N') return unitFragment(comp, 0)
  if (type === 'PM') {
    const g = unitFragment(comp, 0)
    return g?.poly ? g : null
  }
  if (Object.keys(comp).length === 2 && comp.P && comp.O && comp.O / comp.P === 2.5) return unitFragment(comp, 0)
  return bridgedDimer(comp, 0)
}

/** Многоатомный ион фрагментом: Cr₂O₇²⁻ (мостик Cr–O–Cr), (SiO₃²⁻)ₙ — звено цепи силиката. */
function ionFragment(comp: Record<string, number>, charge: number): LGraph | null {
  const b = bridgedDimer(comp, charge)
  if (b) return b
  const u = unitFragment(comp, charge)
  return u?.poly ? u : null
}

const FRAG_NOTE: Record<FragmentKind, (x: string) => [string, string, string]> = {
  node: (x) => [
    `повторяющийся фрагмент: у ${x} — 4 связи, каждый мостиковый O связывает два ${x}; бледные — соседние атомы`,
    `repeating fragment: ${x} has 4 bonds, each bridging O joins two ${x}; pale — neighbouring atoms`,
    `takrorlanuvchi boʻlak: ${x} da 4 ta bogʻ, har bir koʻprik O ikki ${x} ni bogʻlaydi; xira — qoʻshni atomlar`,
  ],
  chain: (x) => [
    `звено цепи: мостиковый O связывает соседние звенья ${x}; n — число звеньев`,
    `chain unit: the bridging O joins neighbouring ${x} units; n — the number of units`,
    `zanjir boʻgʻini: koʻprik O qoʻshni ${x} boʻgʻinlarini bogʻlaydi; n — boʻgʻinlar soni`,
  ],
  bridge: (x) => [
    `две половины связаны мостиком ${x}–O–${x}`,
    `the two halves are joined by an ${x}–O–${x} bridge`,
    `ikki yarmi ${x}–O–${x} koʻprigi bilan bogʻlangan`,
  ],
}
const fragCenter = (g: LGraph) => g.atoms.find((a) => !a.ghost && a.el !== 'O' && a.el !== 'H')?.el ?? ''

/** Схема перехода: узлы, дуги и строки «Na⁰ − 1e⁻ → Na⁺». */
function transferScheme(plan: FormationPlan, script: FormationScript | null, loc: FormationLocale) {
  const cat = plan.species.find((s) => s.charge > 0)
  const an = plan.species.find((s) => s.charge < 0)
  if (!cat || !an) return null
  const bare = (f: string) => f.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+$/u, '')
  if (script?.routeKind === 'protonTransfer' && cat.comp.N && cat.comp.H) {
    const acid = `H${bare(an.formula)}`
    return {
      nodes: [{ text: ':NH₃' }, { text: 'H⁺' }] as TransferNode[],
      arcs: [{ from: 0, to: 1, text: L(loc, 'пара e⁻', 'e⁻ pair', 'e⁻ jufti') }] as TransferArc[],
      lines: [`${acid} → H⁺ + ${an.formula}`, `:NH₃ + H⁺ → NH₄⁺`],
      given: null as null | [number, number],
      note: L(loc, 'неподелённая пара N становится общей с H⁺ — донорно-акцепторная связь', 'the lone pair of N becomes shared with H⁺ — a donor–acceptor bond', 'N ning bo‘linmagan jufti H⁺ bilan umumiy bo‘ladi — donor-akseptor bog‘'),
    }
  }
  /** faces — куда смотрит неспаренный e⁻: у отдающего — к принимающему, у принимающего — навстречу стрелке. */
  const node = (sp: typeof cat, faces: number): TransferNode => {
    const els = Object.keys(sp.comp)
    if (els.length === 1) {
      const el = els[0]!
      if (sp.charge > 0) return { atom: { el, x: 0, y: 0, lone: 0, single: Math.min(4, sp.charge), faces } }
      return { atom: { ...valenceAtom(el), faces } }
    }
    return { text: bare(sp.formula) }
  }
  const q = cat.charge
  const a = -an.charge
  let nodes: TransferNode[]
  let arcs: TransferArc[]
  if (cat.count === 1 && an.count === 2) {
    nodes = [node(an, 0), node(cat, 0), node(an, Math.PI)]
    arcs = [
      { from: 1, to: 0, text: `${a}e⁻` },
      { from: 1, to: 2, text: `${a}e⁻` },
    ]
  } else if (cat.count === 2 && an.count === 1) {
    nodes = [node(cat, 0), node(an, Math.PI), node(cat, Math.PI)]
    arcs = [
      { from: 0, to: 1, text: `${q}e⁻` },
      { from: 2, to: 1, text: `${q}e⁻` },
    ]
  } else {
    nodes = [node(cat, 0), node(an, Math.PI)]
    arcs = [{ from: 0, to: 1, text: `${q}e⁻` }]
  }
  const line = (sp: typeof cat, give: boolean) => {
    const els = Object.keys(sp.comp)
    const base = els.length === 1 ? `${els[0]}⁰` : bare(sp.formula)
    const k = Math.abs(sp.charge)
    return `${base} ${give ? '−' : '+'} ${k}e⁻ → ${sp.formula}${sp.count > 1 ? `   ×${sp.count}` : ''}`
  }
  const cats = plan.species.filter((s) => s.charge > 0)
  const ans = plan.species.filter((s) => s.charge < 0)
  const given = cats.reduce((s, x) => s + x.count * x.charge, 0)
  const taken = ans.reduce((s, x) => s - x.count * x.charge, 0)
  return { nodes, arcs, lines: [...cats.map((s) => line(s, true)), ...ans.map((s) => line(s, false))], given: [given, taken] as [number, number], note: '' }
}

/** Шкала ΔЭО: 0 — неполярная, до ~1,7 — полярная, больше — ионная (§ 15–16). */
function DenScale({ dEN, loc }: { dEN: number; loc: FormationLocale }) {
  const X = (v: number) => 10 + (Math.min(3.3, Math.max(0, v)) / 3.3) * 260
  return (
    <svg className="fbSvg" viewBox="0 0 280 64" role="img" aria-label={`ΔЭО ${num(dEN, loc)}`}>
      <rect x={X(0)} y={26} width={X(0.12) - X(0)} height={10} rx={2} fill="#94a3b8" />
      <rect x={X(0.12)} y={26} width={X(1.7) - X(0.12)} height={10} fill="#60a5fa" />
      <rect x={X(1.7)} y={26} width={X(3.3) - X(1.7)} height={10} rx={2} fill="#fb923c" />
      <line x1={X(1.7)} x2={X(1.7)} y1={22} y2={40} stroke="#334155" strokeDasharray="2 2" />
      <text x={X(0)} y={52} fontSize={10.5} fill="#334155">
        0 · {L(loc, 'неполярная', 'nonpolar', 'qutbsiz')}
      </text>
      <text x={X(1.3)} y={52} fontSize={10.5} textAnchor="middle" fill="#1d4ed8">
        {L(loc, 'полярная', 'polar', 'qutbli')}
      </text>
      <text x={X(1.7)} y={62} fontSize={9.5} textAnchor="middle" fill="#334155">
        ~1,7
      </text>
      <text x={X(3.3)} y={52} fontSize={10.5} textAnchor="end" fill="#c2410c">
        {L(loc, 'ионная', 'ionic', 'ion')}
      </text>
      <path d={`M${X(dEN)} 24 l-6 -9 h12 z`} fill="#0f172a" />
      <text x={Math.min(250, Math.max(30, X(dEN)))} y={11} fontSize={12} fontWeight={700} textAnchor="middle" fill="#0f172a">
        ΔЭО = {num(dEN, loc)}
      </text>
    </svg>
  )
}

export function FormationBoard({ compoundId, plan, stage, loc, refText }: { compoundId: string; plan: FormationPlan; stage: StageKey; loc: FormationLocale; refText?: string }) {
  const script = useMemo(() => formationScript(compoundId), [compoundId])
  const model = useMemo(() => {
    const c = compoundById[compoundId]
    return c ? buildSchoolHeroModel(c) : null
  }, [compoundId])
  const ionic = plan.mode === 'ionic'
  const type = script?.type ?? (ionic ? 'IB' : 'MP')
  const frag = useMemo(() => (ionic ? null : fragmentGraph(plan, type)), [ionic, plan, type])
  const mol = useMemo(() => (ionic ? null : (frag ?? moleculeGraph(model, plan.formula, script?.special))), [ionic, frag, plan.formula, model, script])
  const parts: LPart[] | null = useMemo(() => {
    if (!ionic) return null
    return ionicParts(plan, model).map((p, k): LPart => {
      const sp = plan.species[k]
      if (sp?.kind === 'polyion') {
        const f = ionFragment(sp.comp, sp.charge)
        if (f) return { ...p, graph: f, bracket: !f.poly }
      }
      // кристаллизационная вода: «· 5» и рисунок одной молекулы H–O–H (пары O — к катиону)
      if (sp?.kind === 'molecule' && sp.comp.H === 2 && sp.comp.O === 1 && Object.keys(sp.comp).length === 2) return { ...p, graph: waterGraph(), bracket: false, lead: '·' }
      return p
    })
  }, [ionic, plan, model])
  const fragNote = useMemo(() => {
    const g = frag ?? parts?.map((p) => p.graph).find((x) => x && (x.poly || x.atoms.some((a) => a.ghost) || x.atoms.filter((a) => a.el !== 'O' && a.el !== 'H').length === 2 && x.bonds.length > 6))
    return g ? pick(FRAG_NOTE[fragmentKind(g)](fragCenter(g)), loc) : null
  }, [frag, parts, loc])
  const hydrate = !!parts?.some((p) => p.lead)
  const atoms = useMemo(() => atomsOf(plan), [plan])
  const scheme = useMemo(() => (ionic ? transferScheme(plan, script, loc) : null), [ionic, plan, script, loc])
  const clouds = useCloudsOn()
  const [open, setOpen] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(max-width: 640px)').matches)

  let focus = FOCUS[stage] ?? 'lewis'
  if (focus === 'transfer' && !scheme) focus = 'lewis'
  const cloudsAllowed = type === 'S' || type === 'MP' || type === 'IB' || type === 'IC' || type === 'IH'

  const latticeText = script
    ? loc === 'ru'
      ? ruLattice(script)
      : `${pick(LATTICE_KIND[script.latticeKind], loc)}${script.lattice.match(/\d+\s?:\s?\d+/) ? `, ${script.lattice.match(/\d+\s?:\s?\d+/)![0]}` : ''}`
    : plan.crystal
      ? pick(LATTICE_KIND.schema, loc)
      : ''
  const shape = plan.shapes.find((s) => SHAPE[s.key])

  const card = (key: CardKey, title: string, body: React.ReactNode) =>
    !open && key !== focus ? null : (
      <section key={key} className={`${key === focus ? styles.cardOn : styles.card}${key === 'den' || key === 'lattice' ? ` ${styles.wide}` : ''}`} data-board-card={key} data-board-focus={key === focus ? '' : undefined}>
        <h4 className={styles.cardTitle}>{title}</h4>
        {body}
      </section>
    )

  const lewisLabel = L(loc, 'Электронная формула', 'Electron-dot formula', 'Elektron formula')
  const structLabel = L(loc, 'Структурная формула', 'Structural formula', 'Struktur formula')
  return (
    <div className={styles.board} data-formation-board="" data-board-type={type}>
      <div className={styles.head}>
        <span className={styles.headTitle}>{L(loc, 'Доска учителя', 'Teacher’s board', 'O‘qituvchi doskasi')}</span>
        {cloudsAllowed ? (
          <button type="button" className={clouds ? styles.chipOn : styles.chip} aria-pressed={clouds} onClick={() => setCloudsOn(!clouds)} data-formation-clouds="">
            {L(loc, 'Электронные облака', 'Electron clouds', 'Elektron bulutlar')}
          </button>
        ) : null}
        <button type="button" className={styles.chip} aria-expanded={open} onClick={() => setOpen(!open)} data-board-toggle="">
          {open ? L(loc, 'Свернуть', 'Collapse', 'Yig‘ish') : L(loc, 'Вся доска', 'Whole board', 'Butun doska')}
        </button>
      </div>
      <div className={styles.grid}>
        {card(
          'lewis',
          `${lewisLabel} · § 15`,
          <>
            <div className={styles.rowLabel}>{L(loc, 'атомы: валентные электроны', 'atoms: valence electrons', 'atomlar: valent elektronlar')}</div>
            <FormulaSvg atoms={atoms} mode="dots" label={lewisLabel} />
            <div className={styles.rowLabel}>
              {ionic
                ? L(loc, 'ионы', 'ions', 'ionlar')
                : frag && fragmentKind(frag) !== 'bridge'
                  ? `${plan.formula}: ${L(loc, 'повторяющийся фрагмент', 'repeating fragment', 'takrorlanuvchi boʻlak')}`
                  : L(loc, 'молекула', 'molecule', 'molekula')}
            </div>
            {ionic ? <FormulaSvg parts={parts ?? []} mode="dots" label={lewisLabel} /> : mol ? <FormulaSvg graph={mol} mode="dots" label={lewisLabel} /> : <p className={styles.big}>{plan.formula}</p>}
            {hydrate ? (
              <p className={styles.small} data-board-hydrate="">
                {L(
                  loc,
                  'кристаллизационная вода: молекула H₂O обращена к катиону неподелённой парой O',
                  'water of crystallisation: the H₂O molecule faces the cation with a lone pair of O',
                  'kristallizatsiya suvi: H₂O molekulasi kationga O ning taqsimlanmagan jufti bilan qaragan',
                )}
              </p>
            ) : null}
          </>,
        )}
        {card(
          'struct',
          structLabel,
          <>
            {ionic ? (
              <FormulaSvg parts={parts ?? []} mode="dashes" showLone={false} label={structLabel} />
            ) : mol ? (
              <FormulaSvg graph={mol} mode="dashes" showLone={false} label={structLabel} />
            ) : (
              <p className={styles.big}>{plan.formula}</p>
            )}
            {fragNote ? (
              <p className={styles.small} data-board-fragment="">
                {fragNote}
              </p>
            ) : null}
            <p className={styles.small}>
              {plan.bondKinds.length
                ? plan.bondKinds.map((b) => `${b.label}${b.count > 1 ? ` ×${b.count}` : ''}`).join(' · ')
                : plan.innerBonds.map((x) => `${x.of}: ${x.kinds.map((k) => `${k.label}${k.count > 1 ? ` ×${k.count}` : ''}`).join(', ')}`).join(' · ')}
              {(mol?.bonds.some((b) => b.dative != null) || parts?.some((p) => p.graph?.bonds.some((b) => b.dative != null))) ? ` · → ${L(loc, 'донорно-акцепторная', 'donor–acceptor', 'donor-akseptor')}` : ''}
            </p>
          </>,
        )}
        {scheme
          ? card(
              'transfer',
              `${L(loc, 'Переход электронов', 'Electron transfer', 'Elektronlar o‘tishi')} · § 16`,
              <>
                <TransferSvg nodes={scheme.nodes} arcs={scheme.arcs} label={scheme.lines.join('; ')} />
                <ul className={styles.lines}>
                  {scheme.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                {scheme.given ? (
                  <p className={scheme.given[0] === scheme.given[1] ? styles.balanceOk : styles.balance} data-board-balance="">
                    {L(loc, 'отдано', 'given', 'berildi')} {scheme.given[0]}e⁻ = {L(loc, 'принято', 'taken', 'qabul qilindi')} {scheme.given[1]}e⁻ {scheme.given[0] === scheme.given[1] ? '✓' : ''}
                  </p>
                ) : (
                  <p className={styles.small}>{scheme.note}</p>
                )}
              </>,
            )
          : null}
        {card(
          'den',
          `ΔЭО · ${L(loc, 'тип связи', 'bond type', 'bog‘ turi')}`,
          <>
            {script ? <DenScale dEN={script.dEN} loc={loc} /> : null}
            <p className={styles.strong}>{pick(BOND_TYPE[plan.bondType], loc)}</p>
          </>,
        )}
        {card(
          'lattice',
          L(loc, 'Итог и путь получения', 'Result and how it is made', 'Natija va olinish yo‘li'),
          <>
            {shape && !ionic ? (
              <p className={styles.small}>
                {L(loc, 'форма', 'shape', 'shakli')}: <b>{pick(SHAPE[shape.key]!, loc)}</b>
              </p>
            ) : null}
            {latticeText ? <p className={styles.small}>{latticeText}</p> : null}
            {script ? (
              <p className={styles.route} data-board-route={script.routeKind}>
                <span className={styles.kind}>{pick(ROUTE_KIND[script.routeKind], loc)}</span>
                <span className={styles.eq}>{script.route}</span>
              </p>
            ) : null}
            {script?.lab ? <p className={styles.small}>{L(loc, 'в лаборатории', 'in the lab', 'laboratoriyada')}: {script.lab}</p> : null}
          </>,
        )}
      </div>
      {refText ? (
        <p className={styles.ref} data-board-ref="">
          {refText}
        </p>
      ) : null}
    </div>
  )
}
