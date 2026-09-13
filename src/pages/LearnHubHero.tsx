import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LearnHubHeroArt } from './LearnHubArt'
import { LearnHubIcon, type LearnHubIconName } from './LearnHubIcon'
import ui from './LearnSecondaryHubs.module.css'

type Props = {
  backTo: string
  backLabel: string
  icon: LearnHubIconName
  title: ReactNode
  titleId?: string
  lead?: ReactNode
  /** Чипы, статусы, кнопки под заголовком. */
  children?: ReactNode
  /** Правая колонка шапки (статистика, действия). По умолчанию — орбитальная иллюстрация. */
  aside?: ReactNode
  style?: CSSProperties
}

/** Строки «← К обучению» уже содержат стрелку — в кнопке её рисует SVG. */
function stripArrow(label: string) {
  return label.replace(/^\s*[←‹<]\s*/, '')
}

export function LearnHubHero({ backTo, backLabel, icon, title, titleId, lead, children, aside, style }: Props) {
  return (
    <header className={ui.hero} style={style}>
      <div className={ui.heroMain}>
        <Link className={ui.backLink} to={backTo}>
          <LearnHubIcon name="arrowLeft" size={16} />
          <span>{stripArrow(backLabel)}</span>
        </Link>
        <div className={ui.heroTitleRow}>
          <span className={ui.heroIcon} aria-hidden="true">
            <LearnHubIcon name={icon} size={28} />
          </span>
          <h1 className={ui.title} id={titleId}>
            {title}
          </h1>
        </div>
        {lead ? <p className={ui.lead}>{lead}</p> : null}
        {children ? <div className={ui.heroExtras}>{children}</div> : null}
      </div>
      <div className={ui.heroAside}>{aside ?? <LearnHubHeroArt className={ui.heroArt} />}</div>
    </header>
  )
}
