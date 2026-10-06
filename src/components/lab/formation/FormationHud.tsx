import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { FormationPlan } from '../../../chemistry/formationPlan'
import type { FormationStory, StoryHud } from './formationStory'
import type { FormationClock } from './formationTimeline'
import styles from './FormationHud.module.css'

/**
 * Стеклянная HUD-карточка «Как образуется» (DOM, не 3D): справа сверху у 3D-окна (на телефоне — полосой под ним).
 * Показывает строки story.hud по времени истории; пока сценарий их не задал — запасной путь из routeStage.badges
 * (уравнение пути и смена степеней окисления) и подписи решётки. Формулы больше не рисуются плашками поверх атомов.
 */

/** Карточка HUD; lineWin — окна строк (строка вне окна приглушена, но место держит — без прыжков вёрстки). */
export type HudCard = StoryHud & { key: string; lineWin?: ([number, number] | null)[] }

/** Сколько места HUD занимает у 3D-окна (px): камера вписывает модель в остаток (смещение вида). */
export type HudLayout = { dx: number; dy: number }

type L3 = 0 | 1 | 2
export function viewLocale(): L3 {
  const l = typeof document !== 'undefined' ? document.documentElement.lang : 'ru'
  return l === 'en' ? 1 : l === 'uz' ? 2 : 0
}

const CAPTION = {
  ionic: ['Ионная кристаллическая решётка', 'Ionic crystal lattice', 'Ion kristall panjara'],
  ionicLine: ['Каждый ион окружён ионами противоположного знака', 'Each ion is surrounded by ions of opposite charge', 'Har bir ion qarama-qarshi zaryadli ionlar bilan oʻralgan'],
  molecular: ['Молекулярная решётка', 'Molecular lattice', 'Molekulyar panjara'],
  molecularLine: ['В узлах — молекулы', 'Molecules at the lattice sites', 'Tugunlarda — molekulalar'],
  chain: ['Полимер', 'Polymer', 'Polimer'],
  network: ['Атомная решётка', 'Covalent network', 'Atom panjara'],
  networkLine: ['Каркас тетраэдров SiO₄ (молекул нет)', 'Framework of SiO₄ tetrahedra (no molecules)', 'SiO₄ tetraedrlari karkasi (molekula yoʻq)'],
} as const

/** Карточки HUD истории: story.hud (сценарий) или запасной путь из пути получения; плюс подпись решётки. */
export function hudCards(story: FormationStory, plan: FormationPlan, L: L3): HudCard[] {
  const out: HudCard[] = []
  const stage = (k: string) => story.stages.find((s) => s.key === k)
  const fin = story.stages[story.stages.length - 1]!
  const own = story.hud ?? []
  own.forEach((h, i) => out.push({ ...h, key: `h${i}` }))
  const rs = story.routeStage
  if (own.length === 0 && rs) {
    const seen = new Map<string, [number, number]>()
    for (const b of rs.badges) {
      const w = seen.get(b.text)
      seen.set(b.text, w ? [Math.min(w[0], b.from), Math.max(w[1], b.to)] : [b.from, b.to])
    }
    const lines = [rs.equation, ...seen.keys()].filter(Boolean)
    out.push({
      key: 'route',
      t0: rs.t0,
      t1: rs.t0 + rs.dur,
      title: rs.title[L],
      lines,
      tone: 'route',
      lineWin: [null, ...[...seen.values()]],
    })
  }
  // Многоатомные частицы ионного вещества (SO₄²⁻, NH₄⁺, H₂O гидрата) — строками HUD, не плашками над атомами.
  if (plan.mode === 'ionic' && !plan.crystal && own.length === 0) {
    const ins = stage('inner')
    const asm = stage('assemble')
    const lat = stage('lattice')
    const lines: string[] = []
    const wins: ([number, number] | null)[] = []
    for (const u of plan.units) {
      const sp = plan.species[u.species]
      if (!sp || u.atoms.length < 2 || lines.includes(sp.formula)) continue
      const w: [number, number] = sp.kind === 'molecule' ? [ins?.t0 ?? story.ionLabelsFrom, (asm?.t0 ?? fin.t0) + 1] : [story.ionLabelsFrom, lat ? lat.t0 : fin.t0 + fin.dur]
      if (!Number.isFinite(w[0])) continue
      lines.push(sp.formula)
      wins.push(w)
    }
    if (lines.length) {
      const t0 = Math.min(...wins.map((w) => w![0]))
      const t1 = Math.max(...wins.map((w) => w![1]))
      out.push({ key: 'parts', t0, t1, title: ['Частицы', 'Particles', 'Zarrachalar'][L]!, lines, tone: 'route', lineWin: wins })
    }
  }
  const latS = stage('lattice')
  const covered = (t0: number, t1: number) => own.some((h) => h.t0 < t1 && h.t1 > t0 && h.tone === 'check')
  if (story.latticeKind === 'ionic' && latS) {
    const t0 = latS.t0 + 0.4
    const t1 = fin.t0 + 2.6
    if (!covered(t0, t1)) out.push({ key: 'lat', t0, t1, title: CAPTION.ionic[L], lines: [CAPTION.ionicLine[L]], tone: 'check' })
  } else if (story.latticeKind === 'molecular') out.push({ key: 'lat', t0: fin.t0 + 0.4, t1: fin.t0 + fin.dur - 1.4, title: CAPTION.molecular[L], lines: [CAPTION.molecularLine[L]], tone: 'check' })
  else if (story.latticeKind === 'chain')
    out.push({ key: 'lat', t0: fin.t0 + 0.4, t1: fin.t0 + fin.dur - 1.4, title: CAPTION.chain[L], lines: [[`(${plan.formula})ₙ — цепь звеньев`, `(${plan.formula})ₙ — a chain of units`, `(${plan.formula})ₙ — boʻgʻinlar zanjiri`][L]!], tone: 'check' })
  else if (story.latticeKind === 'network') {
    const sa = stage('assemble')
    if (sa) out.push({ key: 'lat', t0: sa.t0 + 0.3, t1: Infinity, title: CAPTION.network[L], lines: [CAPTION.networkLine[L]], tone: 'check' })
  }
  return out
}

/** Строка — полуреакция / уравнение (цифры одной ширины)? */
const isFormulaLine = (s: string) => /[→⇄=]|e⁻/.test(s)

/** Карточка «Путь» (уравнение пути): всегда первой и компактно — одной строкой. */
const isPathCard = (c: HudCard) => c.key === 'route' || c.titleT?.[0] === 'Путь' || c.title === 'Путь' || /^Путь:/.test(c.lines[0] ?? '')

/**
 * Перенос строк по смыслу: после «→ / ⇄ / = / + / −» не рвать (знак держится со следующим членом — «→ 4Mn³⁺» вместе),
 * переносить можно только перед знаком; «Восстановление:» держится с первым членом.
 */
const keepTogether = (s: string) => s.replace(/([→⇄=+−]) /g, '$1\u00a0').replace(/: (?=\S)/g, ':\u00a0')

/** Строки / заголовок на языке интерфейса (titleT / linesT сценария), иначе — как есть. */
const titleOf = (c: HudCard, L: L3) => c.titleT?.[L] ?? c.title
const linesOf = (c: HudCard, L: L3) => (c.linesT && c.linesT.length === c.lines.length ? c.linesT.map((t) => t[L] ?? t[0]) : c.lines)

export function FormationHud({
  story,
  plan,
  clock,
  layout,
}: {
  story: FormationStory
  plan: FormationPlan
  clock: MutableRefObject<FormationClock>
  layout: MutableRefObject<HudLayout>
}) {
  const [L] = useState<L3>(viewLocale)
  const cards = useMemo(() => hudCards(story, plan, L), [story, plan, L])
  const [state, setState] = useState<{ on: string; lines: string }>({ on: '', lines: '' })
  const box = useRef<HTMLDivElement>(null)

  // Часы показа — те же, что у 3D (ref): опрос rAF, перерисовка только при смене набора карточек / строк.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = clock.current.t
      const on: string[] = []
      const lines: string[] = []
      for (const c of cards) {
        if (!(t >= c.t0 && t < c.t1)) continue
        on.push(c.key)
        c.lineWin?.forEach((w, i) => {
          if (w && t >= w[0] && t < w[1]) lines.push(`${c.key}:${i}`)
        })
      }
      const key = on.join(',')
      const lk = lines.join(',')
      setState((p) => (p.on === key && p.lines === lk ? p : { on: key, lines: lk }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cards, clock])

  // Место под HUD у 3D-окна — по ФАКТИЧЕСКОМУ прямоугольнику (ResizeObserver): dx — от левого края HUD до правого края окна,
  // dy — от верха окна до низа HUD (+ зазор); полоса под окном (телефон) — 0.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const side = getComputedStyle(el).position === 'absolute'
      const has = el.dataset.empty !== 'true'
      const host = el.parentElement
      if (!side || !has || !host) {
        layout.current = { dx: 0, dy: 0 }
        return
      }
      const hr = host.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      layout.current = { dx: Math.max(0, hr.right - r.left) + 12, dy: Math.max(0, r.bottom - hr.top) + 12 }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [layout, state.on])

  const onSet = new Set(state.on ? state.on.split(',') : [])
  const lineSet = new Set(state.lines ? state.lines.split(',') : [])
  const active = cards.filter((c) => onSet.has(c.key))
  // Не больше двух карточек: «Путь» (одной строкой) + карточка ТЕКУЩЕГО этапа (начавшаяся последней).
  const path = active.find(isPathCard) ?? null
  let cur: HudCard | null = null
  for (const c of active) if (c !== path && (!cur || c.t0 >= cur.t0)) cur = c
  const shown = [path, cur].filter((c): c is HudCard => c != null)
  return (
    <div ref={box} className={styles.hud} data-formation-hud="" data-empty={shown.length === 0 ? 'true' : 'false'} aria-live="polite">
      {shown.map((c) => {
        const lines = linesOf(c, L)
        if (c === path)
          return (
            <div key={c.key} className={`${styles.card} ${styles.path}`} data-tone={c.tone ?? 'route'} data-hud-card={c.key}>
              <span className={styles.pathTitle}>{titleOf(c, L).replace(/:$/, '')}</span>
              <span className={styles.pathEq}>{keepTogether(lines.map((ln) => ln.replace(/^(Путь|Route|Yoʻl):\s*/, '')).join('  '))}</span>
            </div>
          )
        return (
          <div key={c.key} className={styles.card} data-tone={c.tone ?? 'route'} data-hud-card={c.key}>
            <p className={styles.title}>{titleOf(c, L).replace(/ (=)/g, '\u00a0$1').replace(/(=) /g, '$1\u00a0')}</p>
            {lines.map((ln, i) => {
              const w = c.lineWin?.[i]
              const dim = w ? !lineSet.has(`${c.key}:${i}`) : false
              return (
                <p key={i} className={isFormulaLine(ln) ? styles.formula : styles.line} data-dim={dim ? 'true' : 'false'}>
                  {keepTogether(ln)}
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
