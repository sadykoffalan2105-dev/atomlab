/**
 * Виджеты электронной доски: таймер опыта, «приборы» по опыту (цифровой термометр у выпаривания, шкала pH
 * с лакмусом у аммиака, таблица вытеснения и ряд активности у галогенов), средства защиты (надето / надеть)
 * и итоговая оценка за технику безопасности и аккуратность (звёзды).
 */
import { useEffect, useState } from 'react'
import type { LabExperimentDef, LabExperimentId, LabGear, LabLang } from '../labContract'
import { labEvents } from '../labEvents'
import styles from './BoardPanel.module.css'

type L3 = Record<LabLang, string>
const UI = {
  time: { ru: 'Время', en: 'Time', uz: 'Vaqt' },
  temp: { ru: 'Термометр', en: 'Thermometer', uz: 'Termometr' },
  boil: { ru: 'кипит — вода испаряется', en: 'boiling: water evaporates', uz: 'qaynayapti — suv bug‘lanadi' },
  heat: { ru: 'нагревание', en: 'heating', uz: 'qizdirish' },
  cool: { ru: 'остывает', en: 'cooling', uz: 'sovumoqda' },
  room: { ru: 'комнатная', en: 'room temp.', uz: 'xona harorati' },
  ph: { ru: 'Индикатор', en: 'Indicator', uz: 'Indikator' },
  litmus: { ru: 'лакмус', en: 'litmus', uz: 'lakmus' },
  alkaline: { ru: 'щелочная среда', en: 'alkaline', uz: 'ishqoriy muhit' },
  neutral: { ru: 'ещё не проверено', en: 'not tested yet', uz: 'hali tekshirilmagan' },
  air: { ru: 'NH₃ легче воздуха: 17 < 29', en: 'NH₃ is lighter than air: 17 < 29', uz: 'NH₃ havodan yengil: 17 < 29' },
  table: { ru: 'Таблица вытеснения', en: 'Displacement table', uz: 'Siqib chiqarish jadvali' },
  activity: { ru: 'Активность', en: 'Activity', uz: 'Faollik' },
  gear: { ru: 'Защита', en: 'Protection', uz: 'Himoya' },
  putOn: { ru: 'Надеть', en: 'Put on', uz: 'Kiyish' },
  score: { ru: 'Оценка', en: 'Score', uz: 'Baho' },
  safety: { ru: 'Техника безопасности', en: 'Safety', uz: 'Xavfsizlik' },
  neat: { ru: 'Аккуратность', en: 'Neatness', uz: 'Ozodalik' },
} satisfies Record<string, L3>

const GEAR_NAMES: Record<LabGear, L3> = {
  goggles: { ru: 'очки', en: 'goggles', uz: 'ko‘zoynak' },
  gloves: { ru: 'перчатки', en: 'gloves', uz: 'qo‘lqop' },
  coat: { ru: 'халат', en: 'coat', uz: 'xalat' },
}

export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** Секунды с начала опыта и с последней смены шага (тик — 4 раза в секунду). */
export function useLabClock(experimentId: LabExperimentId, step: number, finished: boolean) {
  const [start, setStart] = useState(() => performance.now())
  const [stepAt, setStepAt] = useState(() => performance.now())
  const [stopAt, setStopAt] = useState<number | null>(null)
  const [, tick] = useState(0)
  useEffect(() => {
    setStart(performance.now())
    setStopAt(null)
  }, [experimentId])
  useEffect(() => {
    setStepAt(performance.now())
    if (step === 0) {
      setStart(performance.now())
      setStopAt(null)
    }
  }, [step])
  useEffect(() => {
    if (finished) setStopAt((v) => v ?? performance.now())
    else setStopAt(null)
  }, [finished])
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])
  const now = performance.now()
  return { total: ((stopAt ?? now) - start) / 1000, inStep: (now - stepAt) / 1000 }
}

/** Что сейчас надето (labEvents 'safety'). */
export function useWornGear(): readonly LabGear[] {
  const [worn, setWorn] = useState<readonly LabGear[]>(() => labEvents.wornGear())
  useEffect(() => labEvents.on('safety', () => setWorn(labEvents.wornGear())), [])
  return worn
}

export function TimerChip({ seconds, lang }: { seconds: number; lang: LabLang }) {
  return (
    <span className={styles.timer} title={UI.time[lang]} data-lab3d-timer>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      {fmtTime(seconds)}
    </span>
  )
}

/** Средства защиты опыта: надето / кнопка «Надеть» (запасной путь без сцены). */
export function GearBar({ def, lang, onPutOn }: { def: LabExperimentDef; lang: LabLang; onPutOn?: () => void }) {
  const worn = useWornGear()
  const gear = def.gear ?? []
  if (!gear.length) return null
  const all = gear.every((g) => worn.includes(g))
  return (
    <div className={styles.gearBar} data-ok={all || undefined}>
      <span className={styles.gearTitle}>{UI.gear[lang]}</span>
      {gear.map((g) => (
        <span key={g} className={styles.gearChip} data-on={worn.includes(g) || undefined}>
          {worn.includes(g) ? '✓ ' : ''}
          {GEAR_NAMES[g][lang]}
        </span>
      ))}
      {!all && onPutOn ? (
        <button type="button" className={styles.gearBtn} onClick={onPutOn} data-lab3d-gear>
          {UI.putOn[lang]}
        </button>
      ) : null}
    </div>
  )
}

/** «Прибор» по опыту: термометр / индикатор / таблица вытеснения. */
export function Instrument({ experimentId, step, inStep, lang }: { experimentId: LabExperimentId; step: number; inStep: number; lang: LabLang }) {
  if (experimentId === 'salt-purify') {
    // спиртовка горит после шага 6; выпаривание — шаг 7; потушена после шага 8
    let tC = 22
    let note = UI.room[lang]
    if (step === 7) {
      tC = 22 + 78 * (1 - Math.exp(-inStep / 3.5))
      note = tC > 97 ? UI.boil[lang] : UI.heat[lang]
    } else if (step === 8) {
      tC = 100
      note = UI.boil[lang]
    } else if (step >= 9) {
      tC = 100 - 55 * (1 - Math.exp(-inStep / 12))
      note = UI.cool[lang]
    }
    const k = (tC - 0) / 110
    return (
      <div className={styles.instrument} data-lab3d-instrument="thermo">
        <p className={styles.label}>{UI.temp[lang]}</p>
        <div className={styles.thermoRow}>
          <div className={styles.thermoTube}>
            <div className={styles.thermoFill} style={{ height: `${Math.round(k * 100)}%`, background: tC > 90 ? '#e5533d' : tC > 40 ? '#f29b38' : '#3f8ef0' }} />
          </div>
          <div>
            <p className={styles.thermoValue}>{tC.toFixed(1)} °C</p>
            <p className={styles.thermoNote}>{note}</p>
          </div>
        </div>
      </div>
    )
  }
  if (experimentId === 'nh3') {
    const tested = step >= 8
    const ph = tested ? 11 : 7
    return (
      <div className={styles.instrument} data-lab3d-instrument="ph">
        <p className={styles.label}>
          {UI.ph[lang]} · {UI.litmus[lang]}
        </p>
        <div className={styles.phScale}>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ background: `hsl(${i < 7 ? 0 + i * 8 : 200 + (i - 7) * 8}, 70%, ${i === 6 ? 70 : 58}%)` }} data-on={i + 1 === ph || undefined}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className={styles.phRow}>
          <span className={styles.litmusChip} style={{ background: tested ? '#3557c9' : '#d4455a' }} />
          <span>{tested ? `pH ≈ ${ph} · ${UI.alkaline[lang]}` : UI.neutral[lang]}</span>
        </div>
        <p className={styles.thermoNote}>{UI.air[lang]}</p>
      </div>
    )
  }
  if (experimentId === 'halogens') {
    // таблица учебника: строки Cl₂, Br₂; столбцы NaCl, NaBr, NaI
    const cell = (done: boolean, color: string | null, text: string) => (
      <td data-done={done || undefined}>
        {done ? (color ? <span className={styles.swatch} style={{ background: color }} /> : null) : null}
        {done ? text : '·'}
      </td>
    )
    return (
      <div className={styles.instrument} data-lab3d-instrument="halogens">
        <p className={styles.label}>{UI.table[lang]}</p>
        <table className={styles.haloTable}>
          <thead>
            <tr>
              <th />
              <th>NaCl</th>
              <th>NaBr</th>
              <th>NaI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Cl₂</th>
              {cell(true, null, '—')}
              {cell(step >= 2, '#eea13c', 'Br₂')}
              {cell(step >= 3, '#a9611c', 'I₂')}
            </tr>
            <tr>
              <th>Br₂</th>
              {cell(step >= 5, null, '✗')}
              {cell(true, null, '—')}
              {cell(step >= 4, '#8a4a14', 'I₂')}
            </tr>
          </tbody>
        </table>
        <div className={styles.activityRow}>
          <span className={styles.label}>{UI.activity[lang]}</span>
          {['F₂', 'Cl₂', 'Br₂', 'I₂'].map((h, i) => (
            <span key={h} className={styles.haloChip} data-i={i}>
              {h}
              {i < 3 ? <b aria-hidden> &gt;</b> : null}
            </span>
          ))}
        </div>
      </div>
    )
  }
  return null
}

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars} aria-label={`${n} / 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} data-on={i < n || undefined}>
          ★
        </span>
      ))}
    </span>
  )
}

/** Итог: звёзды за технику безопасности (надето ли всё нужное) и аккуратность (шаги руками, без пропусков). */
export function ScoreCard({ def, skips, seconds, lang }: { def: LabExperimentDef; skips: number; seconds: number; lang: LabLang }) {
  const worn = useWornGear()
  const gear = def.gear ?? []
  const safety = gear.length ? Math.max(1, Math.round((3 * gear.filter((g) => worn.includes(g)).length) / gear.length)) : 3
  const neat = Math.max(1, 3 - Math.min(2, skips))
  return (
    <div className={styles.scoreCard} data-lab3d-score>
      <p className={styles.label}>
        {UI.score[lang]} · {fmtTime(seconds)}
      </p>
      <div className={styles.scoreRow}>
        <span>{UI.safety[lang]}</span>
        <Stars n={safety} />
      </div>
      <div className={styles.scoreRow}>
        <span>{UI.neat[lang]}</span>
        <Stars n={neat} />
      </div>
    </div>
  )
}
