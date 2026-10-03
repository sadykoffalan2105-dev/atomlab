/**
 * Современные виджеты поверх 3D-лаборатории (светлое стекло, сворачиваются): секундомер опыта, журнал
 * наблюдений (сам записывает, что взяли, куда поставили, что надели и что наблюдали — слушает labEvents),
 * индикатор средств защиты (очки/перчатки/халат — нажатие надевает/снимает), звук (вкл/выкл и громкость),
 * план лаборатории (переключатель видов). Плюс «очки на лице» — тонкая рамка по краям кадра — и окно правил ТБ.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useT, type MessageKey } from '../../../i18n/useT'
import { labAudio } from '../audio/labAudio'
import { LAB_ITEM_BY_ID } from '../interaction/labItems'
import { labHand, useHand } from '../interaction/labHandStore'
import type { LabExperimentId, LabLang } from '../labContract'
import { labEvents, type LabGearId } from '../labEvents'
import type { LabViewId } from './labSceneLayout'
import css from './LabWidgets.module.css'

const GEAR: readonly LabGearId[] = ['goggles', 'gloves', 'coat']

/** Иконки средств защиты (SVG, не эмодзи — одинаково на всех устройствах). */
export function GearIcon({ gear, size = 22 }: { gear: LabGearId; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (gear === 'goggles')
    return (
      <svg {...p}>
        <path d="M3 10.5c0-1.7 1.3-3 3-3h12c1.7 0 3 1.3 3 3v2.5c0 1.9-1.6 3.5-3.5 3.5h-1.8c-1.2 0-2.2-.8-2.6-1.9l-.3-.8a.9.9 0 0 0-1.6 0l-.3.8c-.4 1.1-1.4 1.9-2.6 1.9H6.5C4.6 16.5 3 14.9 3 13v-2.5Z" />
        <path d="M1.5 11h1.5M21 11h1.5" />
      </svg>
    )
  if (gear === 'gloves')
    return (
      <svg {...p}>
        <path d="M7 21v-3.5L4.6 13a1.6 1.6 0 0 1 2.6-1.8L9 13V5a1.3 1.3 0 0 1 2.6 0v6-7.5a1.3 1.3 0 0 1 2.6 0V11 4.5a1.3 1.3 0 0 1 2.6 0V11 6.5a1.3 1.3 0 0 1 2.6 0V15c0 3.3-2.2 6-5.5 6H7Z" />
      </svg>
    )
  return (
    <svg {...p}>
      <path d="M9 3h6l2 2 3.5 2-1.5 5-2-.8V21H7V11.2L5 12 3.5 7 7 5l2-2Z" />
      <path d="M9 3l3 4 3-4M12 7v14" />
    </svg>
  )
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface JournalEntry {
  readonly key: number
  readonly t: number
  readonly kind: 'act' | 'obs' | 'gear'
  readonly text: string
}

function Section({ title, icon, open, onToggle, children }: { title: string; icon: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={css.section}>
      <button type="button" className={css.secHead} aria-expanded={open} onClick={onToggle}>
        <span className={css.secIcon} aria-hidden>
          {icon}
        </span>
        <span className={css.secTitle}>{title}</span>
        <span className={css.caret} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className={css.secBody}>{children}</div>}
    </section>
  )
}

/** Мини-план лаборатории (вид сверху): нажатие на зону — камера летит туда. */
function MiniMap({ view, onView, label }: { view: LabViewId; onView: (v: LabViewId) => void; label: (v: LabViewId) => string }) {
  // Координаты плана: x ∈ [−3.3, 3.3] → [4, 156], z ∈ [−1.25, 3.0] → [6, 104]
  const X = (x: number) => 4 + ((x + 3.3) / 6.6) * 152
  const Z = (z: number) => 6 + ((z + 1.25) / 4.25) * 98
  const zones: ReadonlyArray<{ id: LabViewId; x0: number; x1: number; z0: number; z1: number }> = [
    { id: 'board', x0: -0.95, x1: 0.95, z0: -1.25, z1: -1.05 },
    { id: 'hood', x0: -2.65, x1: -1.45, z0: -1.25, z1: -0.53 },
    { id: 'shelves', x0: 1.32, x1: 3.3, z0: -1.25, z1: -0.63 },
    { id: 'desk', x0: -1.3, x1: 1.3, z0: -0.5, z1: 0.2 },
    { id: 'cabinets', x0: -1.3, x1: 1.3, z0: 0.2, z1: 0.46 },
  ]
  const cam: Record<LabViewId, [number, number]> = { desk: [0, 2.1], board: [0, 0.6], shelves: [1.0, 1.25], hood: [-1.2, 1.05], cabinets: [0, 2.75] }
  const [cx, cz] = cam[view]
  return (
    <svg className={css.map} viewBox="0 0 160 110" role="group" aria-label={label('desk')}>
      <rect x={X(-3.3)} y={Z(-1.25)} width={152} height={98} rx={6} className={css.mapRoom} />
      {zones.map((zn) => (
        <g key={zn.id} role="button" tabIndex={0} aria-label={label(zn.id)} aria-pressed={view === zn.id} onClick={() => onView(zn.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onView(zn.id)} className={css.mapZone}>
          <rect x={X(zn.x0)} y={Z(zn.z0)} width={X(zn.x1) - X(zn.x0)} height={Math.max(5, Z(zn.z1) - Z(zn.z0))} rx={2} className={view === zn.id ? css.mapOn : css.mapOff} />
          <title>{label(zn.id)}</title>
        </g>
      ))}
      <circle cx={X(cx)} cy={Z(Math.min(2.9, cz))} r={4} className={css.mapCam} />
    </svg>
  )
}

export interface LabWidgetsProps {
  readonly experimentId: LabExperimentId
  readonly step: number
  readonly finished: boolean
  readonly lang: LabLang
  readonly view: LabViewId
  readonly onView: (v: LabViewId) => void
  readonly viewLabel: (v: LabViewId) => string
  readonly narrow: boolean
  /** Панель опыта на телефоне раскрыта — виджеты прячутся, но журнал и секундомер продолжают работать. */
  readonly hidden?: boolean
}

export function LabWidgets({ experimentId, step, finished, lang, view, onView, viewLabel, narrow, hidden = false }: LabWidgetsProps) {
  const { t } = useT()
  const hand = useHand()
  const audio = useSyncExternalStore(labAudio.subscribe, labAudio.getSnapshot, labAudio.getSnapshot)
  const [open, setOpen] = useState(() => !narrow)
  const [sec, setSec] = useState<Record<string, boolean>>({ timer: true, journal: !narrow, gear: true, sound: false, map: false })
  const toggle = (k: string) => setSec((s) => ({ ...s, [k]: !s[k] }))

  // Секундомер: идёт с первого действия в опыте, останавливается на выводе, сбрасывается при смене опыта
  const [elapsed, setElapsed] = useState(0)
  const clock = useRef({ start: 0, acc: 0, running: false })
  const [running, setRunning] = useState(false)
  const startClock = () => {
    const c = clock.current
    if (c.running) return
    c.running = true
    c.start = performance.now()
    setRunning(true)
  }
  const pauseClock = () => {
    const c = clock.current
    if (!c.running) return
    c.acc += performance.now() - c.start
    c.running = false
    setRunning(false)
    setElapsed(c.acc)
  }
  const resetClock = () => {
    clock.current = { start: 0, acc: 0, running: false }
    setRunning(false)
    setElapsed(0)
  }
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsed(clock.current.acc + performance.now() - clock.current.start), 250)
    return () => window.clearInterval(id)
  }, [running])
  useEffect(() => {
    if (step > 0 && !finished) startClock()
    if (finished) pauseClock()
  }, [step, finished])

  // Журнал наблюдений
  const [journal, setJournal] = useState<readonly JournalEntry[]>([])
  const nowT = () => clock.current.acc + (clock.current.running ? performance.now() - clock.current.start : 0)
  useEffect(() => {
    resetClock()
    setJournal([])
  }, [experimentId])
  useEffect(() => {
    let n = 0
    const add = (kind: JournalEntry['kind'], text: string) => setJournal((j) => [...j.slice(-39), { key: ++n + Math.random(), t: nowT(), kind, text }])
    const name = (id: string) => LAB_ITEM_BY_ID.get(id as never)?.name[lang] ?? id
    const offs = [
      labEvents.on('picked', (e) => {
        startClock()
        add('act', t('lab3d.scene.jPicked', { name: name(e.itemId) }))
      }),
      labEvents.on('placed', (e) => {
        const key: MessageKey = e.zone === 'work' ? 'lab3d.scene.jPlacedWork' : e.zone === 'bench' ? 'lab3d.scene.jPlacedBench' : 'lab3d.scene.jPlacedShelf'
        add('act', t(key, { name: name(e.itemId) }))
      }),
      labEvents.on('safety', (e) => add('gear', t(e.on ? 'lab3d.scene.jGearOn' : 'lab3d.scene.jGearOff', { name: t(`lab3d.safety.${e.gear}` as MessageKey) }))),
      labEvents.on('hint', (e) => {
        startClock()
        add('obs', e.text)
      }),
    ]
    return () => offs.forEach((o) => o())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [journal])

  const wornCount = hand.worn.length
  const needList = hand.gearNeed.map((g) => t(`lab3d.safety.${g}` as MessageKey)).join(', ')
  return (
    <>
      {/* Очки на лице: тонкая рамка и лёгкая виньетка по краям кадра */}
      {hand.worn.includes('goggles') && <div className={css.goggles} aria-hidden />}

      <div className={open ? css.dock : `${css.dock} ${css.dockClosed}`} hidden={hidden}>
        <button type="button" className={css.dockHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className={css.dockTitle}>{t('lab3d.scene.widgets')}</span>
          <span className={css.miniTime}>{fmt(elapsed)}</span>
          <span className={css.miniGear} aria-label={t('lab3d.safety.title')}>
            {GEAR.map((g) => (
              <span key={g} className={hand.worn.includes(g) ? css.gearOn : hand.gearNeed.includes(g) ? css.gearNeed : css.gearOff}>
                <GearIcon gear={g} size={16} />
              </span>
            ))}
          </span>
          <span className={css.caret} aria-hidden>
            {open ? '▾' : '▸'}
          </span>
        </button>
        {open && (
          <div className={css.dockBody}>
            <Section title={t('lab3d.scene.timer')} icon={<ClockIcon />} open={sec.timer} onToggle={() => toggle('timer')}>
              <div className={css.timerRow}>
                <span className={running ? `${css.time} ${css.timeRun}` : css.time}>{fmt(elapsed)}</span>
                <button type="button" className={css.btn} onClick={() => (running ? pauseClock() : startClock())}>
                  {running ? t('lab3d.scene.timerPause') : t('lab3d.scene.timerStart')}
                </button>
                <button type="button" className={css.btnGhost} onClick={resetClock}>
                  {t('lab3d.scene.timerReset')}
                </button>
              </div>
            </Section>

            <Section title={`${t('lab3d.safety.title')} · ${wornCount}/3`} icon={<GearIcon gear="goggles" size={16} />} open={sec.gear} onToggle={() => toggle('gear')}>
              {hand.gearNeed.length > 0 && <p className={css.need}>{t('lab3d.safety.need', { list: needList })}</p>}
              <div className={css.gearRow}>
                {GEAR.map((g) => {
                  const on = hand.worn.includes(g)
                  const label = t(`lab3d.safety.${g}` as MessageKey)
                  return (
                    <button
                      key={g}
                      type="button"
                      className={on ? `${css.gearBtn} ${css.gearBtnOn}` : hand.gearNeed.includes(g) ? `${css.gearBtn} ${css.gearBtnNeed}` : css.gearBtn}
                      aria-pressed={on}
                      title={on ? t('lab3d.safety.takeOff', { name: label }) : t('lab3d.safety.putOn', { name: label })}
                      onClick={() => {
                        labHand.wear(g, !on)
                        labAudio.play('click', { gain: 0.3 })
                      }}
                    >
                      <GearIcon gear={g} />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
              <p className={css.small}>{t('lab3d.safety.wearHint')}</p>
              <button type="button" className={css.link} onClick={() => labHand.setRulesOpen(true)}>
                {t('lab3d.safety.rulesOpen')}
              </button>
            </Section>

            <Section title={t('lab3d.scene.journal')} icon={<BookIcon />} open={sec.journal} onToggle={() => toggle('journal')}>
              {journal.length === 0 ? (
                <p className={css.small}>{t('lab3d.scene.journalEmpty')}</p>
              ) : (
                <ol ref={listRef} className={css.journal}>
                  {journal.map((j) => (
                    <li key={j.key} className={j.kind === 'obs' ? css.jObs : j.kind === 'gear' ? css.jGear : css.jAct}>
                      <time>{fmt(j.t)}</time>
                      <span>{j.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section title={t('lab3d.scene.sound')} icon={<SoundIcon on={audio.on} />} open={sec.sound} onToggle={() => toggle('sound')}>
              <div className={css.soundRow}>
                <button type="button" className={audio.on ? css.btn : css.btnGhost} aria-pressed={audio.on} onClick={() => labAudio.setEnabled(!audio.on)}>
                  {audio.on ? t('lab3d.scene.soundOn') : t('lab3d.scene.soundOff')}
                </button>
                <label className={css.vol}>
                  <span className={css.srOnly}>{t('lab3d.scene.volume')}</span>
                  <input type="range" min={0} max={100} value={Math.round(audio.volume * 100)} disabled={!audio.on} onChange={(e) => labAudio.setVolume(Number(e.target.value) / 100)} />
                </label>
              </div>
              {!audio.unlocked && audio.on && <p className={css.small}>{t('lab3d.scene.soundTap')}</p>}
              <label className={css.check}>
                <input type="checkbox" checked={hand.hoodFan} onChange={(e) => labHand.setHoodFan(e.target.checked)} />
                <span>{t('lab3d.scene.hoodFan')}</span>
              </label>
            </Section>

            <Section title={t('lab3d.scene.map')} icon={<MapIcon />} open={sec.map} onToggle={() => toggle('map')}>
              <MiniMap view={view} onView={onView} label={viewLabel} />
            </Section>
          </div>
        )}
      </div>

      {hand.rulesOpen && <RulesDialog onClose={() => labHand.setRulesOpen(false)} />}
    </>
  )
}

const RULES = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5', 'rule6', 'rule7', 'rule8'] as const

function RulesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={css.backdrop} onClick={onClose}>
      <div className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="lab3d-rules-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="lab3d-rules-title" className={css.dlgTitle}>
          {t('lab3d.safety.rulesTitle')}
        </h2>
        <ol className={css.rules}>
          {RULES.map((r) => (
            <li key={r}>{t(`lab3d.safety.${r}` as MessageKey)}</li>
          ))}
        </ol>
        <button ref={closeRef} type="button" className={css.btn} onClick={onClose}>
          {t('lab3d.safety.close')}
        </button>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M10 2h4M12 2v3" />
    </svg>
  )
}
function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
      <path d="M5 17a3 3 0 0 1 3-3h10M9 8h5M9 11h3" />
    </svg>
  )
}
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  )
}
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  )
}
