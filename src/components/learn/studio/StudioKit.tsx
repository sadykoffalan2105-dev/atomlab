import type { ReactNode } from 'react'
import { LearnShellIcon, type LearnShellIconName } from '../LearnShellIcon'
import kit from './StudioKit.module.css'

/** Маленькая подсказка горячей клавиши. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={className ? `${kit.kbd} ${className}` : kit.kbd} aria-hidden="true">
      {children}
    </kbd>
  )
}

/** Плитка-иконка в тоне панели. */
export function StudioIconTile({
  icon,
  size = 15,
  soft = false,
  large = false,
  className,
}: {
  icon: LearnShellIconName
  size?: number
  soft?: boolean
  large?: boolean
  className?: string
}) {
  const cls = [kit.iconTile, soft ? kit.iconTileSoft : '', large ? kit.iconTileLg : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls} aria-hidden="true">
      <LearnShellIcon name={icon} size={size} strokeWidth={2.2} />
    </span>
  )
}

/**
 * Шапка панели студии: плитка-иконка + заголовок (+ подзаголовок) + действия справа.
 * Тон берётся из --studio-tone корня панели.
 */
export function StudioPanelHead({
  icon,
  title,
  subtitle,
  actions,
  className,
}: {
  icon: LearnShellIconName
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `${kit.panelHead} ${className}` : kit.panelHead}>
      <StudioIconTile icon={icon} />
      <div className={kit.panelHeadText}>
        <span className={kit.panelTitle} title={title}>
          {title}
        </span>
        {subtitle ? (
          <span className={kit.panelSubtitle} title={subtitle}>
            {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className={kit.panelActions} role="toolbar" aria-label={title}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}

/** Дружелюбное пустое состояние с действиями. */
export function StudioEmptyState({
  icon = 'layout',
  title,
  lead,
  actions,
  className,
}: {
  icon?: LearnShellIconName
  title: string
  lead?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `${kit.emptyState} ${className}` : kit.emptyState}>
      <StudioIconTile icon={icon} size={20} large />
      <p className={kit.emptyTitle}>{title}</p>
      {lead ? <p className={kit.emptyLead}>{lead}</p> : null}
      {actions ? <div className={kit.emptyActions}>{actions}</div> : null}
    </div>
  )
}
