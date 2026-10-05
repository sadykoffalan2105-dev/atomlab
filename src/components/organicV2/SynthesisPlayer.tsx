/**
 * Органика v2 — проигрыватель синтеза/реакции по атомному соответствию («Как образуется» для органики).
 *
 * Сценарий (этапы, позиции атомов, связи) — чистая функция src/chemistry/organicV2/synthesis/scenario.ts;
 * 3D — ./synthesis/SynthesisScene.tsx (instancing, отдельный чанк); доска справа (на телефоне — под 3D):
 * структурное уравнение с условиями, текущий этап крупно, фраза учителя RU/EN/UZ, где в учебнике.
 * Управление: шкала этапов, ⏮ ⏯ ⏭, скорость 0,5/1/1,5×, ползунок, клавиши ← → и пробел.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SynthesisPlayerProps } from './contracts'
import {
  buildSynthesisScenario,
  stageIndexAt,
  SYNTH_STAGE_KEYS,
  type SynthScenario,
} from '../../chemistry/organicV2/synthesis/scenario'
import {
  conditionsLabel,
  inorganicName,
  parseEquation,
  reactionTypeName,
  speciesTermIndex,
  stageTitle,
  subscript,
  teacherLine,
} from '../../chemistry/organicV2/synthesis/teacher'
import { organicMoleculeById } from '../../data/organicLab/organicMoleculeRegistry'
import type { OV2Reaction } from '../../data/organicV2/types'
import type { SceneLabel, SynthClock } from './synthesis/SynthesisScene'
import { SYNTH_UI, type SynthUiLang } from './synthesis/synthesisUi'
import { regName } from './synthesis/uzNames'
import styles from './synthesis/SynthesisPlayer.module.css'

const SynthesisScene = lazy(() => import('./synthesis/SynthesisScene'))

export const SYNTH_SPEEDS = [0.5, 1, 1.5] as const

/** Дополнительные (необязательные) возможности для витрины и кадров; контракт ./contracts.ts не меняется. */
export interface SynthesisPlayerExtraProps {
  /** начать с момента t, с (кадры этапов) */
  readonly startTime?: number
}

function useSynthClock(total: number, autoplay: boolean, startTime: number | undefined, onDone?: () => void) {
  const clock = useRef<SynthClock>({ t: Math.min(total, startTime ?? 0), playing: autoplay && startTime == null })
  const [time, setTime] = useState(clock.current.t)
  const [playing, setPlaying] = useState(clock.current.playing)
  const [speed, setSpeedState] = useState(1)
  const speedRef = useRef(1)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const c = clock.current
      if (c.playing) {
        c.t += dt * speedRef.current
        if (c.t >= total) {
          c.t = total
          c.playing = false
          setPlaying(false)
          doneRef.current?.()
        }
      }
      const shown = Math.round(c.t * 10) / 10
      setTime((p) => (p === shown ? p : shown))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total])

  const seek = useCallback(
    (t: number) => {
      clock.current.t = Math.max(0, Math.min(total, t))
      setTime(Math.round(clock.current.t * 10) / 10)
    },
    [total],
  )
  const toggle = useCallback(() => {
    const c = clock.current
    if (!c.playing && c.t >= total - 0.05) c.t = 0
    c.playing = !c.playing
    setPlaying(c.playing)
  }, [total])
  const setSpeed = useCallback((x: number) => {
    speedRef.current = x
    setSpeedState(x)
  }, [])
  return { clock, time, playing, speed, seek, toggle, setSpeed }
}

type Lang = SynthUiLang

function speciesName(r: OV2Reaction, si: number, lang: Lang): string {
  const s = r.species[si]
  const reg = organicMoleculeById[s.ref]
  if (reg) return regName(reg, lang)
  const inorg = inorganicName(s.ref, lang)
  if (inorg) return inorg
  if (s.nameRu && lang === 'ru') return s.nameRu
  if (s.ref.startsWith('polymer:')) return SYNTH_UI[lang].polymer
  return ''
}

/** пример общей схемы (ASCII) → уравнение: стрелки ⇌/→, коэффициент перед веществом — обычной цифрой, индексы — подстрочные */
function exampleText(ex: string): string {
  return ex
    .replace(/<=>/g, '⇌')
    .replace(/->/g, '→')
    .split(/(\s+)/)
    .map((w) => {
      const m = /^(\d+)([A-Z(\[].*)$/.exec(w)
      return m ? m[1] + subscript(m[2]) : subscript(w)
    })
    .join('')
}

function formulaOf(r: OV2Reaction, si: number): string {
  const s = r.species[si]
  if (s.ref.startsWith('inorg:')) return subscript(s.ref.slice(6))
  const cnt = new Map<string, number>()
  for (const a of s.atoms) cnt.set(a.el, (cnt.get(a.el) ?? 0) + 1)
  const order = ['C', 'H', ...[...cnt.keys()].filter((e) => e !== 'C' && e !== 'H').sort()]
  return subscript(order.filter((e) => cnt.has(e)).map((e) => e + (cnt.get(e)! > 1 ? cnt.get(e) : '')).join(''))
}

function PlayerInner({ reaction, lang, focusMoleculeId, autoplay = true, onDone, className, startTime }: SynthesisPlayerProps & SynthesisPlayerExtraProps) {
  const ui = SYNTH_UI[lang]
  const sc: SynthScenario = useMemo(() => buildSynthesisScenario(reaction), [reaction])
  const { clock, time, playing, speed, seek, toggle, setSpeed } = useSynthClock(sc.total, autoplay, startTime, onDone)
  const stage = stageIndexAt(sc, time)
  const stageKey = SYNTH_STAGE_KEYS[stage]
  const eq = useMemo(() => parseEquation(reaction.equation), [reaction.equation])
  const termIdx = useMemo(() => speciesTermIndex(reaction, eq), [reaction, eq])
  const cond = conditionsLabel(reaction)

  // фокусная молекула — среди продуктов
  const focusSpecies = useMemo(
    () => (focusMoleculeId ? reaction.species.findIndex((s) => s.side === 'R' && s.ref === focusMoleculeId) : -1),
    [reaction, focusMoleculeId],
  )
  const focusAtoms = useMemo(
    () => (focusSpecies >= 0 ? new Set(sc.species[focusSpecies].atoms) : undefined),
    [sc, focusSpecies],
  )
  const focusTerm = focusSpecies >= 0 ? termIdx[focusSpecies] : -1

  // подписи в 3D: по одной на член уравнения (первая копия), не больше 8
  const labels: SceneLabel[] = useMemo(() => {
    const out: SceneLabel[] = []
    const seen = new Set<string>()
    reaction.species.forEach((s, si) => {
      const k = `${s.side}:${termIdx[si] >= 0 ? termIdx[si] : s.ref}`
      if (seen.has(k)) return
      seen.add(k)
      const term = termIdx[si] >= 0 ? (s.side === 'L' ? eq.left : eq.right)[termIdx[si]] : null
      const text = term && term.text.length <= 26 ? term.text : formulaOf(reaction, si)
      out.push({ species: si, text, sub: speciesName(reaction, si, lang) || undefined, focus: si === focusSpecies })
    })
    const left = out.filter((l) => reaction.species[l.species].side === 'L').slice(0, 8)
    const right = out.filter((l) => reaction.species[l.species].side === 'R').slice(0, 8)
    return [...left, ...right]
  }, [reaction, termIdx, eq, lang, focusSpecies])

  const line = teacherLine(reaction, sc, stageKey, lang)
  const st = sc.stages[stage]
  const prev = () => {
    const t = clock.current.t
    seek(t - st.t0 > 0.6 || stage === 0 ? st.t0 : sc.stages[stage - 1].t0)
  }
  const next = () => seek(stage < sc.stages.length - 1 ? sc.stages[stage + 1].t0 : sc.total)
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); toggle() }
  }
  const src = reaction.source
  const srcText = ui.source(src.grade, src.section, src.page)

  const terms = (side: 'L' | 'R') =>
    (side === 'L' ? eq.left : eq.right).map((t, k) => (
      <span key={`${side}${k}`} className={styles.termWrap}>
        {k > 0 ? <span className={styles.plus}>+</span> : null}
        <span className={side === 'R' && k === focusTerm ? styles.termFocus : styles.term}>
          {t.coef ? <b className={styles.coef}>{t.coef}</b> : null}
          {t.text}
        </span>
      </span>
    ))

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(' ')}
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={ui.aria}
      data-ov2-synthesis={reaction.id}
      data-stage={stageKey}
    >
      <div className={styles.stageCol}>
        <div className={styles.viewport} data-app-night>
          <Suspense fallback={<div className={styles.loading}>{ui.loading}</div>}>
            <SynthesisScene
              sc={sc}
              clock={clock}
              stage={stage}
              labels={labels}
              focusAtoms={focusAtoms}
              endLabel={ui.chainGoesOn}
            />
          </Suspense>
          <div className={styles.badge}>
            <span className={styles.badgeNum}>{stage + 1}/6</span>
            <span>{stageTitle(stageKey, lang)}</span>
          </div>
          {sc.radical && stage === 2 ? <div className={styles.legend}><span className={styles.legendDots} aria-hidden="true">•</span>{ui.radicalHint}</div> : null}
          {!sc.radical && stage === 2 ? <div className={styles.legend}><span className={styles.legendDots} aria-hidden="true">••</span>{ui.pairHint}</div> : null}
        </div>
        <div className={styles.controls}>
          <ol className={styles.timeline}>
            {sc.stages.map((s, i) => {
              const p = Math.max(0, Math.min(1, (time - s.t0) / (s.t1 - s.t0)))
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    className={i === stage ? styles.segOn : styles.seg}
                    onClick={() => seek(s.t0)}
                    aria-current={i === stage ? 'step' : undefined}
                    title={stageTitle(s.key, lang)}
                  >
                    <span className={styles.segBar}>
                      <span className={styles.segFill} style={{ transform: `scaleX(${p})` }} />
                    </span>
                    <span className={styles.segText}>{stageTitle(s.key, lang)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className={styles.row}>
            <button type="button" className={styles.ctrl} onClick={prev} aria-label={ui.prev} title={ui.prev}>⏮</button>
            <button type="button" className={styles.ctrlMain} onClick={toggle} aria-label={playing ? ui.pause : ui.play} title={playing ? ui.pause : ui.play}>
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" className={styles.ctrl} onClick={next} aria-label={ui.next} title={ui.next}>⏭</button>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={sc.total}
              step={0.1}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label={ui.slider}
            />
            <div className={styles.speeds} role="group" aria-label={ui.speed}>
              {SYNTH_SPEEDS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={x === speed ? styles.speedOn : styles.speed}
                  onClick={() => setSpeed(x)}
                  aria-pressed={x === speed}
                >
                  {String(x).replace('.', lang === 'en' ? '.' : ',')}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className={styles.board}>
        <div className={styles.eqBox}>
          <div className={styles.eqLine}>
            {terms('L')}
            <span className={styles.arrow}>
              {cond ? <span className={styles.cond}>{cond}</span> : null}
              <span className={styles.arrowGlyph}>{eq.arrow === '→' ? '⟶' : eq.arrow}</span>
            </span>
            {terms('R')}
          </div>
          {reaction.generic ? (
            <p className={styles.generic}>
              {ui.generic(src.page)}
              {reaction.example ? <span className={styles.example}>{ui.example}: {exampleText(reaction.example)}</span> : null}
            </p>
          ) : null}
        </div>
        <div className={styles.now} aria-live="polite">
          <span className={styles.nowNum}>{ui.stage} {stage + 1} / 6</span>
          <h3 className={styles.nowTitle}>{stageTitle(stageKey, lang)}</h3>
        </div>
        <div className={styles.teacher}>
          <span className={styles.teacherTag}>{ui.teacher}</span>
          <p className={styles.teacherText}>{line}</p>
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>{ui.type}</dt>
            <dd>{reactionTypeName(reaction, lang)}</dd>
          </div>
          {cond ? (
            <div>
              <dt>{ui.conditions}</dt>
              <dd>{cond}</dd>
            </div>
          ) : null}
          <div>
            <dt>{ui.book}</dt>
            <dd>{srcText}</dd>
          </div>
        </dl>
      </aside>
    </section>
  )
}

export function SynthesisPlayer(props: SynthesisPlayerProps & SynthesisPlayerExtraProps) {
  return <PlayerInner key={props.reaction.id} {...props} />
}

export default SynthesisPlayer
