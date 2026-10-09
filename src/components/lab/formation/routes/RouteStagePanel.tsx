/** Панель этапов «Как образуется» (общая для окна в реакторе и для показа в лаборатории). */
import type { RouteModel } from './geom'
import type { ReactorRouteId } from './routeIndex'
import { ROUTE_TEXTS, ROUTE_UI } from './texts/co2Routes'
import styles from './RouteFormation.module.css'

const SPEEDS = [0.5, 1, 1.5] as const
const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

export type RouteStagePanelProps = {
  id: ReactorRouteId
  model: Pick<RouteModel, 'stages'>
  L: 0 | 1 | 2
  time: number
  playing: boolean
  speed: number
  toggle: () => void
  seek: (t: number) => void
  replay: () => void
  setSpeed: (x: number) => void
  prev: () => void
  next: () => void
  /** другие пути того же вещества (переключатель); нет — без переключателя */
  siblings?: ReactorRouteId[]
  onSwitch?: (id: ReactorRouteId) => void
  className?: string
}

export function RouteStagePanel({ id, model, L, time, playing, speed, toggle, seek, replay, setSpeed, prev, next, siblings = [], onSwitch, className }: RouteStagePanelProps) {
  const tx = ROUTE_TEXTS[id]
  const total = model.stages.total
  const stages = model.stages.list
  let i = 0
  for (let k = 0; k < stages.length; k++) if (time >= stages[k]!.t0 - 1e-6) i = k
  const st = stages[i]!
  const s = tx.stages[st.key as keyof typeof tx.stages] as { title: [string, string, string]; main: [string, string, string]; sub?: [string, string, string] }
  const hud = tx.hud.filter((h) => h.stage === st.key && time >= st.t0 + st.dur * h.from - 1e-6 && time <= st.t0 + st.dur * h.to + 1e-6)
  return (
          <aside className={className ?? styles.side} aria-live="polite" data-route-stage={st.key} data-route-step={i + 1}>
            <ol className={styles.track} aria-label={ROUTE_UI.stage[L]}>
              {stages.map((x, k) => {
                const fill = k < i ? 1 : k > i ? 0 : Math.max(0, Math.min(1, (time - x.t0) / x.dur))
                const title = (tx.stages[x.key as keyof typeof tx.stages] as { title: [string, string, string] }).title[L]
                return (
                  <li key={x.key} className={styles.seg} style={{ flexGrow: x.dur }} aria-current={k === i ? 'step' : undefined}>
                    <button type="button" className={styles.segBtn} onClick={() => seek(x.t0)} aria-label={`${ROUTE_UI.stage[L]} ${k + 1}: ${title}`} title={title}>
                      <span className={styles.segFill} style={{ transform: `scaleX(${fill})` }} />
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className={styles.stageHead}>
              <span className={styles.stageNum}>
                {ROUTE_UI.stage[L]} {i + 1}/{stages.length}
              </span>
              <span className={styles.stageTitle}>{s.title[L]}</span>
            </p>
            <p className={styles.main}>{s.main[L]}</p>
            {s.sub ? <p className={styles.sub}>{s.sub[L]}</p> : null}
            {hud.map((h, k) => (
              <div key={`${st.key}-${k}`} className={styles.card} data-tone={h.tone ?? 'route'}>
                <p className={styles.cardTitle}>{h.title[L]}</p>
                {h.lines.map((ln, j) => (
                  <p key={j} className={styles.cardLine}>
                    {ln[L]}
                  </p>
                ))}
              </div>
            ))}
            <div className={styles.controls}>
              <button type="button" className={styles.ctrlIcon} onClick={prev} aria-label={ROUTE_UI.prev[L]} title={ROUTE_UI.prev[L]}>
                ⏮
              </button>
              <button type="button" className={styles.ctrl} onClick={toggle} data-route-toggle="">
                {playing ? `❚❚ ${ROUTE_UI.pause[L]}` : `▶ ${ROUTE_UI.resume[L]}`}
              </button>
              <button type="button" className={styles.ctrlIcon} onClick={next} aria-label={ROUTE_UI.next[L]} title={ROUTE_UI.next[L]}>
                ⏭
              </button>
              <span className={styles.speeds} role="group" aria-label={ROUTE_UI.speed[L]}>
                {SPEEDS.map((x) => (
                  <button key={x} type="button" className={x === speed ? styles.speedOn : styles.speed} aria-pressed={x === speed} onClick={() => setSpeed(x)}>
                    {String(x).replace('.', L === 1 ? '.' : ',')}×
                  </button>
                ))}
              </span>
              <button type="button" className={styles.ctrl} onClick={replay}>
                ↺ {ROUTE_UI.replay[L]}
              </button>
            </div>
            <label className={styles.timeRow}>
              <span className={styles.timeText}>{fmtT(time)}</span>
              <input type="range" className={styles.range} min={0} max={Math.ceil(total * 10) / 10} step={0.1} value={Math.min(time, total)} onChange={(e) => seek(Number(e.currentTarget.value))} aria-label={ROUTE_UI.time[L]} />
              <span className={styles.timeText}>{fmtT(total)}</span>
            </label>
            {siblings.length > 1 ? (
              <div className={styles.routes}>
                <p className={styles.routesTitle}>{ROUTE_UI.routes[L]}</p>
                <div className={styles.routeChips}>
                  {siblings.map((r) => (
                    <button key={r} type="button" className={r === id ? styles.routeChipOn : styles.routeChip} aria-pressed={r === id} onClick={() => r !== id && onSwitch?.(r)}>
                      <span className={styles.routeChipTitle}>{ROUTE_TEXTS[r].title[L]}</span>
                      <span className={styles.routeChipEq}>{ROUTE_TEXTS[r].equation}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <p className={styles.note}>{ROUTE_UI.note[L]}</p>
          </aside>
  )
}
