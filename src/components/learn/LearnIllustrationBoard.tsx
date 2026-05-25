import type { LearnTopicArtId } from '../../types/learn'
import { useT } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

type Props = {
  artId: LearnTopicArtId
  accent: string
  title?: string
  subtitle?: string
}

function LabSafetyBoard({ accent }: { accent: string }) {
  const { t } = useT()
  const items = [
    { icon: '🥽', label: t('learn.illus.safety.goggles') },
    { icon: '🧤', label: t('learn.illus.safety.gloves') },
    { icon: '🔥', label: t('learn.illus.safety.fire') },
    { icon: '💨', label: t('learn.illus.safety.hood') },
  ]
  return (
    <div className={styles.learnIllusGrid} style={{ ['--illus-accent' as string]: accent }}>
      {items.map((it) => (
        <div key={it.label} className={styles.learnIllusCard}>
          <span className={styles.learnIllusIcon} aria-hidden>
            {it.icon}
          </span>
          <span className={styles.learnIllusLabel}>{it.label}</span>
        </div>
      ))}
      <div className={styles.learnIllusHero}>
        <div className={styles.learnIllusFlask} aria-hidden />
        <p className={styles.learnIllusHeroText}>{t('learn.illus.safety.hero')}</p>
      </div>
    </div>
  )
}

function PeriodicityBoard({ accent }: { accent: string }) {
  const { t } = useT()
  return (
    <div className={styles.learnIllusPeriod} style={{ ['--illus-accent' as string]: accent }}>
      <div className={styles.learnIllusOrbitRing} aria-hidden />
      <div className={styles.learnIllusOrbitRing2} aria-hidden />
      <div className={styles.learnIllusNucleus} aria-hidden />
      <ul className={styles.learnIllusPeriodList}>
        <li>{t('learn.illus.period.row')}</li>
        <li>{t('learn.illus.period.group')}</li>
        <li>{t('learn.illus.period.trend')}</li>
      </ul>
    </div>
  )
}

function LabInviteBoard({ accent }: { accent: string }) {
  const { t } = useT()
  return (
    <div className={styles.learnIllusLab} style={{ ['--illus-accent' as string]: accent }}>
      <div className={styles.learnIllusReactor} aria-hidden />
      <p className={styles.learnIllusLabLead}>{t('learn.illus.lab.lead')}</p>
      <ul className={styles.learnIllusLabSteps}>
        <li>{t('learn.illus.lab.step1')}</li>
        <li>{t('learn.illus.lab.step2')}</li>
        <li>{t('learn.illus.lab.step3')}</li>
      </ul>
    </div>
  )
}

function BondTypesBoard({ accent }: { accent: string }) {
  const { t } = useT()
  const modes = [
    { key: 'ionic', title: t('learn.illus.bond.ionic') },
    { key: 'covalent', title: t('learn.illus.bond.covalent') },
    { key: 'polar', title: t('learn.illus.bond.polar') },
  ] as const
  return (
    <div className={styles.learnIllusBondRow} style={{ ['--illus-accent' as string]: accent }}>
      {modes.map((m) => (
        <div key={m.key} className={styles.learnIllusBondCard}>
          <div className={`${styles.learnIllusBondArt} ${styles[`learnIllusBond_${m.key}`]}`} aria-hidden />
          <span>{m.title}</span>
        </div>
      ))}
    </div>
  )
}

function GenericBoard({ accent, artId }: { accent: string; artId: LearnTopicArtId }) {
  const { t } = useT()
  return (
    <div className={styles.learnIllusGeneric} style={{ ['--illus-accent' as string]: accent }}>
      <div className={styles.learnIllusGlow} aria-hidden />
      <p className={styles.learnIllusGenericTitle}>{t('learn.illus.generic.title')}</p>
      <p className={styles.learnIllusGenericSub}>{artId}</p>
    </div>
  )
}

export function LearnIllustrationBoard({ artId, accent, title, subtitle }: Props) {
  let inner
  switch (artId) {
    case 'safety_lab':
      inner = <LabSafetyBoard accent={accent} />
      break
    case 'periodicity':
      inner = <PeriodicityBoard accent={accent} />
      break
    case 'lab_invite':
      inner = <LabInviteBoard accent={accent} />
      break
    case 'bond_types':
      inner = <BondTypesBoard accent={accent} />
      break
    default:
      inner = <GenericBoard accent={accent} artId={artId} />
  }
  return (
    <div className={styles.learnIllusBoard}>
      {title ? <p className={styles.learnIllusBoardTitle}>{title}</p> : null}
      {subtitle ? <p className={styles.learnIllusBoardSub}>{subtitle}</p> : null}
      {inner}
    </div>
  )
}
