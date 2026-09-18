import { useEffect, type ReactNode } from 'react'
import { useT, type MessageKey } from '../../../i18n/useT'
import type { LearnPanelId } from '../../../learn/learnPanelLayoutStorage'
import { LearnShellIcon, type LearnShellIconName } from '../LearnShellIcon'
import { Kbd } from './StudioKit'
import {
  STUDIO_PANEL_ICON,
  STUDIO_PANEL_LABEL,
  STUDIO_PANELS,
  STUDIO_PRESET_ORDER,
  studioToneStyle,
  type StudioPreset,
} from './studioLayout'
import {
  STUDIO_WORKSPACES,
  STUDIO_WORKSPACE_DESC,
  STUDIO_WORKSPACE_ICON,
  STUDIO_WORKSPACE_KEY,
  STUDIO_WORKSPACE_LABEL,
  workspaceToneStyle,
  type StudioWorkspace,
} from './studioWorkspaces'
import kit from './StudioKit.module.css'
import styles from './StudioShell.module.css'

const PRESET_ICON: Record<StudioPreset, LearnShellIconName> = {
  lesson: 'layout',
  test: 'clipboard',
  '3d': 'cube',
  ai: 'sparkles',
  board: 'board',
}

const PRESET_LABEL: Record<StudioPreset, MessageKey> = {
  lesson: 'learn.studio.preset.lesson',
  test: 'learn.studio.preset.test',
  '3d': 'learn.studio.preset.3d',
  ai: 'learn.studio.preset.ai',
  board: 'learn.studio.preset.board',
}

const PRESET_HINT: Record<StudioPreset, MessageKey> = {
  lesson: 'learn.studio.preset.lessonHint',
  test: 'learn.studio.preset.testHint',
  '3d': 'learn.studio.preset.3dHint',
  ai: 'learn.studio.preset.aiHint',
  board: 'learn.present.hint',
}

/** Переключатель рабочих пространств: Обучение · Доска · ИИ-учитель (1/2/3). */
export function StudioWorkspaceSwitch({
  active,
  onPick,
  className,
  wrap = false,
}: {
  active: StudioWorkspace
  onPick: (ws: StudioWorkspace) => void
  className?: string
  wrap?: boolean
}) {
  const { t } = useT()
  return (
    <div
      className={[kit.segmented, styles.wsSwitch, wrap ? styles.presetsWrap : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={t('learn.studio.ws.switch')}
    >
      {STUDIO_WORKSPACES.map((ws) => {
        const on = active === ws
        const label = t(STUDIO_WORKSPACE_LABEL[ws])
        return (
          <button
            key={ws}
            type="button"
            className={[kit.segmentedItem, styles.wsItem, on ? kit.segmentedItemActive : ''].filter(Boolean).join(' ')}
            style={workspaceToneStyle(ws)}
            onClick={() => onPick(ws)}
            aria-pressed={on}
            title={`${label} · ${t(STUDIO_WORKSPACE_DESC[ws])} (${STUDIO_WORKSPACE_KEY[ws]})`}
            data-studio-ws={ws}
          >
            <LearnShellIcon name={STUDIO_WORKSPACE_ICON[ws]} size={15} />
            <span className={styles.wsLabel}>{label}</span>
            <Kbd className={styles.switchKbd}>{STUDIO_WORKSPACE_KEY[ws]}</Kbd>
          </button>
        )
      })}
    </div>
  )
}

/** Телефон/планшет: выбор видимой колонки внутри пространства. */
export function StudioColumnTabs({
  cols,
  active,
  onPick,
  label,
}: {
  cols: readonly ('main' | LearnPanelId)[]
  active: string
  onPick: (id: 'main' | LearnPanelId) => void
  label: string
}) {
  const { t } = useT()
  if (cols.length < 2) return null
  return (
    <div className={`${kit.segmented} ${styles.mobileCols}`} role="group" aria-label={label}>
      {cols.map((id) => (
        <button
          key={id}
          type="button"
          className={[kit.segmentedItem, styles.mobileColItem, active === id ? kit.segmentedItemActive : '']
            .filter(Boolean)
            .join(' ')}
          style={studioToneStyle(id)}
          onClick={() => onPick(id)}
          aria-pressed={active === id}
        >
          <LearnShellIcon name={id === 'main' ? 'users' : STUDIO_PANEL_ICON[id]} size={15} />
          <span>{id === 'main' ? t('learn.studio.cockpit') : t(STUDIO_PANEL_LABEL[id])}</span>
        </button>
      ))}
    </div>
  )
}

/** Сегментированный выбор раскладки: Урок · Тест · 3D · ИИ · Доска. */
export function StudioPresetBar({
  active,
  onPick,
  className,
  wrap = false,
}: {
  active: StudioPreset | null
  onPick: (p: StudioPreset) => void
  className?: string
  wrap?: boolean
}) {
  const { t } = useT()
  return (
    <div
      className={[kit.segmented, styles.presets, wrap ? styles.presetsWrap : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={t('learn.studio.presets')}
    >
      {STUDIO_PRESET_ORDER.map((p) => {
        const on = active === p
        const cls = [
          kit.segmentedItem,
          styles.presetItem,
          on ? (p === 'board' ? styles.presetBoardOn : kit.segmentedItemActive) : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={p}
            type="button"
            className={cls}
            onClick={() => onPick(p)}
            aria-pressed={on}
            title={t(PRESET_HINT[p])}
            data-studio-preset={p}
          >
            <LearnShellIcon name={PRESET_ICON[p]} size={14} />
            <span>{t(PRESET_LABEL[p])}</span>
            {p === 'board' ? <Kbd className={styles.switchKbd}>B</Kbd> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Переключатель панелей 3D · Рабочая зона · ИИ-учитель с подсказками клавиш. */
export function StudioPanelSwitch({
  hidden,
  expanded,
  panels = STUDIO_PANELS,
  onToggle,
  className,
}: {
  hidden: ReadonlySet<LearnPanelId>
  expanded: LearnPanelId | null
  /** Панели текущего рабочего пространства (по умолчанию — все). */
  panels?: readonly LearnPanelId[]
  onToggle: (id: LearnPanelId) => void
  className?: string
}) {
  const { t } = useT()
  if (panels.length < 2) return null
  return (
    <div
      className={[kit.segmented, styles.panelSwitch, className ?? ''].filter(Boolean).join(' ')}
      role="group"
      aria-label={t('learn.panel.menu')}
    >
      {panels.map((id) => {
        const isHidden = hidden.has(id)
        const state = isHidden ? 'off' : expanded === id ? 'fs' : 'on'
        const cls = [
          kit.segmentedItem,
          styles.switchItem,
          state === 'off' ? kit.segmentedItemOff : state === 'fs' ? kit.segmentedItemActive : kit.segmentedItemOn,
        ].join(' ')
        const label = t(STUDIO_PANEL_LABEL[id])
        return (
          <button
            key={id}
            type="button"
            className={cls}
            style={studioToneStyle(id)}
            onClick={() => onToggle(id)}
            aria-pressed={!isHidden}
            title={`${label} · ${isHidden ? t('learn.panel.show') : t('learn.panel.hide')}`}
            data-state={state}
            data-studio-switch={id}
          >
            <LearnShellIcon name={STUDIO_PANEL_ICON[id]} size={14} />
            <span className={styles.switchLabel}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Нижняя шторка с действиями урока (телефон). */
export function StudioSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useT()
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <>
      <button type="button" className={styles.sheetBackdrop} aria-label={t('learn.studio.close')} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title} data-studio-sheet="1">
        <span className={styles.sheetGrab} aria-hidden="true" />
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>{title}</h2>
          <button type="button" className={kit.iconBtn} onClick={onClose} aria-label={t('learn.studio.close')}>
            <LearnShellIcon name="close" size={16} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
