import { Link } from 'react-router-dom'
import { LearnPathwayRunner } from '../components/learn/pathway/LearnPathwayRunner'
import { useT } from '../i18n/useT'
import styles from './LearnPage.module.css'

export function LearnPathwayPage() {
  const { t } = useT()

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/learn/pathways">
        {t('learn.pathways.back')}
      </Link>
      <LearnPathwayRunner />
    </div>
  )
}
