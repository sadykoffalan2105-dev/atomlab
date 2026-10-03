/**
 * Временное содержимое электронной доски (пока нет BoardPanel из части «опыты»).
 * Рисуется внутри drei <Html> — это отдельный React-корень: контексты сайта (язык, роутер) здесь недоступны,
 * всё нужное приходит через props. Размер — ровно BOARD_PX (1280×720).
 */
import type { BoardPanelProps, LabExperimentId, LabLang } from '../labContract'
import { BOARD_PX } from '../labContract'

const NAMES: Readonly<Record<LabExperimentId, Readonly<Record<LabLang, string>>>> = {
  baso4: { ru: '§ 2.12 Обмен', en: '§ 2.12 Exchange', uz: '§ 2.12 Almashinish' },
  'ch4-burn': { ru: '§ 2.12 Горение', en: '§ 2.12 Combustion', uz: '§ 2.12 Yonish' },
  'zn-hcl': { ru: '§ 2.12 Замещение', en: '§ 2.12 Substitution', uz: '§ 2.12 O‘rin olish' },
  'h2-practical': { ru: 'Практическое § 5.2', en: 'Practical § 5.2', uz: 'Amaliy § 5.2' },
  'salt-purify': { ru: 'Практическое § 1.6', en: 'Practical § 1.6', uz: 'Amaliy § 1.6' },
  nh3: { ru: 'Практическая работа 3', en: 'Practical work 3', uz: '3-amaliy ish' },
  halogens: { ru: 'Лабораторная работа 5', en: 'Laboratory work 5', uz: '5-laboratoriya ishi' },
}
const EQUATIONS: Readonly<Record<LabExperimentId, string>> = {
  baso4: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
  'ch4-burn': 'CH₄ + 2O₂ → CO₂ + 2H₂O + Q',
  'zn-hcl': 'Zn + 2HCl → ZnCl₂ + H₂↑',
  'h2-practical': 'Zn + 2HCl → ZnCl₂ + H₂↑',
  'salt-purify': 'NaCl (+ SiO₂) → NaCl',
  nh3: '2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O',
  halogens: 'Cl₂ + 2NaBr → 2NaCl + Br₂',
}
const IDS = Object.keys(NAMES) as LabExperimentId[]

export function BoardPlaceholder({ experimentId, step, lang, onSelectExperiment, onStep }: BoardPanelProps) {
  return (
    <div
      style={{
        width: BOARD_PX.w,
        height: BOARD_PX.h,
        boxSizing: 'border-box',
        padding: '44px 56px',
        background: 'linear-gradient(160deg, #ffffff 0%, #eef4fb 100%)',
        color: '#18202a',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectExperiment(id)}
            style={{
              minHeight: 72,
              padding: '0 28px',
              borderRadius: 18,
              border: id === experimentId ? '3px solid #2f7cf6' : '2px solid #cdd6e1',
              background: id === experimentId ? '#e4efff' : '#ffffff',
              fontSize: 28,
              fontWeight: 600,
              color: '#18202a',
              cursor: 'pointer',
            }}
          >
            {NAMES[id][lang]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: 0.5, marginTop: 40 }}>{EQUATIONS[experimentId]}</div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 20, fontSize: 30 }}>
        <button
          type="button"
          onClick={() => onStep(Math.max(0, step - 1))}
          style={{ minHeight: 72, minWidth: 120, borderRadius: 18, border: '2px solid #cdd6e1', background: '#fff', fontSize: 34 }}
        >
          ◀
        </button>
        <span style={{ fontWeight: 600 }}>{step + 1}</span>
        <button
          type="button"
          onClick={() => onStep(step + 1)}
          style={{ minHeight: 72, minWidth: 120, borderRadius: 18, border: 'none', background: '#2f7cf6', color: '#fff', fontSize: 34 }}
        >
          ▶
        </button>
      </div>
    </div>
  )
}
