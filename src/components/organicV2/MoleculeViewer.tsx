/**
 * Органика v2 — просмотрщик режима «Молекула»: большое 3D + 2D-формула рядом (на телефоне — вкладки),
 * панель «Модель / Слой / Инструмент», карточка вещества (название RU/EN/UZ, класс, брутто- и полуструктурная
 * формулы, молярная масса, гибридизация C, функциональные группы, стереометки, где в учебнике).
 */
import { useMemo, useState, type ReactNode } from 'react'
import type { MoleculeOverlay, MoleculeStyle, MoleculeTool, MoleculeViewerProps } from './contracts'
import type { OV2GroupKey } from '../../data/organicV2/types'
import { Molecule3D } from './Molecule3D'
import { Formula2D } from './Formula2D'
import { CLASS_LABELS, classifyMolecule, semiStructuralFormula, skeletonFromOV2, subscriptDigits } from '../../chemistry/organicV2'
import { atomCaption, hybridCounts, molarMass, stereoMarks } from './viewer/molMath'
import { GROUP_COLOR, GROUP_NAME, GROUP_SHORT, VIEWER_T } from './viewer/i18n'
import { moleculeName } from './viewer/names'
import styles from './viewer/MoleculeViewer.module.css'

const I = {
  ballStick: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <line x1="7" y1="16" x2="17" y2="8" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="7" cy="16" r="4" fill="currentColor" />
      <circle cx="17" cy="8" r="3.2" fill="currentColor" opacity=".7" />
    </svg>
  ),
  spaceFill: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="13" r="6.5" fill="currentColor" />
      <circle cx="16" cy="9" r="5" fill="currentColor" opacity=".65" />
    </svg>
  ),
  wire: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <polyline points="3,16 8,8 13,16 18,8 21,13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  none: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  hybrid: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <polygon points="12,3 21,19 3,19" fill="currentColor" opacity=".35" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="12" y1="3" x2="12" y2="14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  groups: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 12V4h8l10 10-8 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="7.5" cy="8.5" r="1.6" fill="currentColor" />
    </svg>
  ),
  charges: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <text x="2" y="17" fontSize="14" fontWeight="700" fill="currentColor">δ</text>
      <text x="12" y="12" fontSize="10" fontWeight="700" fill="currentColor">±</text>
    </svg>
  ),
  carbonDegree: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <text x="3" y="17" fontSize="12" fontWeight="800" fill="currentColor">IV</text>
    </svg>
  ),
  measure: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="8" width="20" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 8v4M10 8v3M14 8v4M18 8v3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <polyline points="19,3 19,8 14,8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  ),
} satisfies Record<string, ReactNode>

const STYLES: readonly MoleculeStyle[] = ['ballStick', 'spaceFill', 'wire']
const OVERLAYS: readonly MoleculeOverlay[] = ['none', 'hybrid', 'groups', 'charges', 'carbonDegree']
const TOOLS: readonly MoleculeTool[] = ['none', 'measure', 'rotate']

type Tab = '3d' | '2d' | 'info'

export function MoleculeViewer(props: MoleculeViewerProps) {
  const { mol, lang } = props
  const t = VIEWER_T[lang]
  const [style, setStyle] = useState<MoleculeStyle>(props.initialStyle ?? 'ballStick')
  const [overlay, setOverlay] = useState<MoleculeOverlay>('none')
  const [tool, setTool] = useState<MoleculeTool>('none')
  const [kind2d, setKind2d] = useState<'skeletal' | 'structural'>('skeletal')
  const [tab, setTab] = useState<Tab>('3d')
  const [focusGroup, setFocusGroup] = useState<number | null>(null)

  const info = useMemo(() => {
    const g = skeletonFromOV2(mol)
    let cls = CLASS_LABELS.other[lang]
    let semi: string | null = null
    try {
      cls = CLASS_LABELS[classifyMolecule(g)][lang]
    } catch {
      /* нет класса */
    }
    try {
      const s = semiStructuralFormula(g)
      if (s.exact && s.text.length <= 64) semi = s.text
    } catch {
      /* нет полуструктурной */
    }
    const groups: { key: OV2GroupKey; atoms: readonly number[] }[] = []
    for (const gr of mol.groups) groups.push(gr)
    return { cls, semi, mass: molarMass(mol), hyb: hybridCounts(mol), groups, stereo: stereoMarks(mol) }
  }, [mol, lang])

  const highlight = focusGroup !== null ? info.groups[focusGroup]?.atoms : undefined
  const groupKeys = [...new Set(info.groups.map((g) => g.key))]
  const name = moleculeName(mol, lang)

  const seg = <T extends string>(list: readonly T[], value: T, set: (v: T) => void, label: (v: T) => string, title: string) => (
    <div className={styles.toolGroup} role="group" aria-label={title}>
      <span className={styles.toolTitle}>{title}</span>
      <div className={styles.seg}>
        {list.map((v) => (
          <button key={v} type="button" className={v === value ? styles.on : undefined} aria-pressed={v === value} onClick={() => set(v)} data-ov2-ctl={v}>
            {I[v as keyof typeof I]}
            <span>{label(v)}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className={[styles.viewer, props.className].filter(Boolean).join(' ')} data-tab={tab} data-ov2-viewer={mol.id}>
      <div className={styles.toolbar}>
        {seg(STYLES, style, setStyle, (v) => t[v], t.styleTitle)}
        {seg(OVERLAYS, overlay, setOverlay, (v) => t[v], t.overlayTitle)}
        {seg(
          TOOLS,
          tool,
          (v) => {
            setTool(v)
            if (v !== 'none') setTab('3d')
          },
          (v) => t[v],
          t.toolTitle,
        )}
      </div>
      <div className={styles.tabs} role="tablist">
        {(['3d', '2d', 'info'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? styles.on : undefined} onClick={() => setTab(k)}>
            {k === '3d' ? t.tab3d : k === '2d' ? t.tab2d : t.tabInfo}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        <section className={styles.stage}>
          <Molecule3D mol={mol} style={style} overlay={overlay} tool={tool} lang={lang} highlightAtoms={highlight} />
          <div className={styles.stageTitle}>
            <strong>{name}</strong>
            <span>{subscriptDigits(mol.formula)}</span>
          </div>
        </section>
        <aside className={styles.side}>
          <div className={`${styles.card} ${styles.card2d}`}>
            <div className={styles.cardHead}>
              <div className={styles.seg2}>
                {(['skeletal', 'structural'] as const).map((k) => (
                  <button key={k} type="button" className={kind2d === k ? styles.on : undefined} onClick={() => setKind2d(k)}>
                    {t[k]}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.formulaBox}>
              <Formula2D mol={mol} kind={kind2d} lang={lang} highlightAtoms={highlight} />
            </div>
          </div>
          <div className={`${styles.card} ${styles.cardInfo}`}>
            <h3 className={styles.name}>{name}</h3>
            <div className={styles.badges}>
              <span className={styles.badgeClass}>{info.cls}</span>
            </div>
            <dl className={styles.dl}>
              <dt>{t.formula}</dt>
              <dd className={styles.mono}>{subscriptDigits(mol.formula)}</dd>
              {info.semi && (
                <>
                  <dt>{t.semi}</dt>
                  <dd className={styles.mono}>{info.semi}</dd>
                </>
              )}
              <dt>{t.mass}</dt>
              <dd>
                {info.mass.toFixed(2).replace('.', lang === 'en' ? '.' : ',')} {t.massUnit}
              </dd>
              <dt>{t.hybC}</dt>
              <dd className={styles.hybRow}>
                {info.hyb.sp3 > 0 && <span className={styles.sp3}>sp³ × {info.hyb.sp3}</span>}
                {info.hyb.sp2 > 0 && <span className={styles.sp2}>sp² × {info.hyb.sp2}</span>}
                {info.hyb.sp > 0 && <span className={styles.sp}>sp × {info.hyb.sp}</span>}
              </dd>
              <dt>{t.fgroups}</dt>
              <dd className={styles.groupRow}>
                {groupKeys.length === 0 && <span className={styles.muted}>{t.noGroups}</span>}
                {groupKeys.map((k) => {
                  const idx = info.groups.findIndex((g) => g.key === k)
                  const n = info.groups.filter((g) => g.key === k).length
                  return (
                    <button
                      key={k}
                      type="button"
                      className={focusGroup !== null && info.groups[focusGroup]?.key === k ? styles.on : undefined}
                      style={{ ['--gc' as string]: GROUP_COLOR[k] }}
                      onClick={() => setFocusGroup((f) => (f !== null && info.groups[f]?.key === k ? null : idx))}
                    >
                      <b>{GROUP_SHORT[k]}</b> {GROUP_NAME[lang][k]}
                      {n > 1 ? ` × ${n}` : ''}
                    </button>
                  )
                })}
              </dd>
              <dt>{t.stereo}</dt>
              <dd>
                {info.stereo.length === 0 && <span className={styles.muted}>{t.noStereo}</span>}
                {info.stereo.slice(0, 8).map((s, k) => (
                  <span key={k} className={styles.stereo}>
                    {s.atoms.map((i) => atomCaption(mol, i)).join(s.kind === 'ez' ? '=' : '')}: <b>{s.label}</b>
                    {s.cisTrans ? ` (${t[s.cisTrans]}-)` : ''}
                  </span>
                ))}
                {info.stereo.length > 8 && <span className={styles.muted}> +{info.stereo.length - 8}</span>}
              </dd>
              <dt>{t.book}</dt>
              <dd>{mol.grades.length ? t.bookText(mol.grades.join(', ')) : '—'}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
