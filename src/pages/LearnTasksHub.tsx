import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { LearnTasksClassPanel } from '../components/learn/LearnTasksClassPanel'
import { LEARN_TASK_CATEGORIES, type LearnTaskCategoryDef } from '../data/learnTaskCategories'
import { useT, type MessageKey } from '../i18n/useT'
import { LearnHubHero } from './LearnHubHero'
import { LearnHubIcon, type LearnHubIconName } from './LearnHubIcon'
import { learnHubToneStyle, taskCategoryIcon, taskCategoryTone } from './learnHubVisuals'
import ui from './LearnSecondaryHubs.module.css'

function TaskCategoryCard({ cat }: { cat: LearnTaskCategoryDef }) {
  const { t } = useT()
  return (
    <article
      className={`${ui.card} ${ui.cardInteractive} ${ui.taskCard}`}
      role="listitem"
      style={learnHubToneStyle(taskCategoryTone(cat.id)) as CSSProperties}
    >
      <div className={ui.cardHead}>
        <span className={ui.iconBadge} aria-hidden="true">
          <LearnHubIcon name={taskCategoryIcon(cat.id)} size={22} />
        </span>
        <h3 className={ui.cardTitle}>{t(cat.titleKey as MessageKey)}</h3>
      </div>
      <div>
        <p className={ui.taskLabel}>{t('learn.tasksWhatLabel')}</p>
        <p className={ui.cardText}>{t(cat.whatKey as MessageKey)}</p>
      </div>
      <div className={ui.taskExample}>
        <p className={ui.taskLabel}>{t('learn.tasksExampleLabel')}</p>
        <p className={ui.taskExampleText}>{t(cat.exampleKey as MessageKey)}</p>
      </div>
      <div className={ui.cardFoot}>
        <Link
          className={`${ui.btn} ${ui.btnPrimary}`}
          to={`/learn/tasks/${cat.id}`}
          aria-label={t('learn.tasks.practiceAria')}
        >
          {t('learn.tasks.practice')}
          <LearnHubIcon name="arrowRight" size={16} />
        </Link>
      </div>
    </article>
  )
}

function CategorySection({
  title,
  icon,
  items,
}: {
  title: string
  icon: LearnHubIconName
  items: readonly LearnTaskCategoryDef[]
}) {
  return (
    <section className={ui.section}>
      <div className={ui.sectionHead}>
        <span className={`${ui.iconBadge} ${ui.iconBadgeSm}`} aria-hidden="true">
          <LearnHubIcon name={icon} size={18} />
        </span>
        <h2 className={ui.sectionTitle}>{title}</h2>
        <span className={ui.countBadge}>{items.length}</span>
      </div>
      <div className={ui.grid} role="list">
        {items.map((cat) => (
          <TaskCategoryCard key={cat.id} cat={cat} />
        ))}
      </div>
    </section>
  )
}

export function LearnTasksHub() {
  const { t } = useT()
  const quant = LEARN_TASK_CATEGORIES.filter((c) => c.group === 'quant')
  const qual = LEARN_TASK_CATEGORIES.filter((c) => c.group === 'qual')

  return (
    <div className={ui.page}>
      <div className={ui.inner}>
        <LearnHubHero
          backTo="/learn"
          backLabel={t('learn.tasksBack')}
          icon="calc"
          title={t('learn.tasksTitle')}
          titleId="learn-tasks-title"
          lead={t('learn.tasksLead')}
        >
          <span className={ui.chip}>
            <LearnHubIcon name="calc" size={14} />
            {t('learn.tasksGroupQuant')} · {quant.length}
          </span>
          <span className={ui.chip}>
            <LearnHubIcon name="search" size={14} />
            {t('learn.tasksGroupQual')} · {qual.length}
          </span>
        </LearnHubHero>

        <p className={ui.banner} role="note">
          <span className={ui.bannerIcon} aria-hidden="true">
            <LearnHubIcon name="sparkle" size={18} />
          </span>
          <span>{t('learn.tasks.aiCoachBanner')}</span>
        </p>

        <div className={ui.tasksLayout}>
          <div className={ui.tasksAside}>
            <LearnTasksClassPanel />
          </div>
          <div className={ui.tasksMain}>
            <CategorySection title={t('learn.tasksGroupQuant')} icon="calc" items={quant} />
            <CategorySection title={t('learn.tasksGroupQual')} icon="search" items={qual} />
          </div>
        </div>
      </div>
    </div>
  )
}
