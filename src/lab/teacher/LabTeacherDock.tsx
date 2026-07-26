import { useEffect, useState } from 'react'
import { useT } from '../../i18n/useT'
import type { Clo2TeacherLine } from './clo2TeacherScript'
import { getLabTeacherNarrator } from './LabTeacherNarrator'
import styles from './LabTeacherDock.module.css'

/**
 * HUD преподавателя на синтезе ClO₂: субтитры, mute, слот аватара (GLB позже).
 */
export function LabTeacherDock({ active }: { active: boolean }) {
  const { t, locale } = useT()
  const narrator = getLabTeacherNarrator()
  const [line, setLine] = useState<Clo2TeacherLine | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => narrator.isVoiceEnabled())

  useEffect(() => {
    narrator.setLocale(locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru')
  }, [locale, narrator])

  useEffect(() => {
    if (!active) {
      setLine(null)
      return
    }
    return narrator.subscribe(setLine)
  }, [active, narrator])

  if (!active) return null

  return (
    <aside className={styles.dock} aria-label={t('lab.teacher.aria')}>
      <div className={styles.row}>
        {/* Слот под скелетный аватар — подключите GLB позже */}
        <div className={styles.avatarSlot} data-slot="teacher-avatar" aria-hidden>
          <span className={styles.avatarMark}>✦</span>
        </div>
        <div className={styles.body}>
          <div className={styles.head}>
            <span className={styles.badge}>{t('lab.teacher.badge')}</span>
            <button
              type="button"
              className={voiceOn ? styles.muteOn : styles.muteOff}
              onClick={() => {
                const next = !voiceOn
                narrator.setVoiceEnabled(next)
                setVoiceOn(next)
              }}
              aria-pressed={!voiceOn}
              title={voiceOn ? t('lab.teacher.mute') : t('lab.teacher.unmute')}
            >
              {voiceOn ? t('lab.teacher.mute') : t('lab.teacher.unmute')}
            </button>
          </div>
          {line ? (
            <>
              <p className={styles.title}>{line.title}</p>
              <p className={styles.text}>{line.speak}</p>
            </>
          ) : (
            <p className={styles.idle}>{t('lab.teacher.idle')}</p>
          )}
        </div>
      </div>
    </aside>
  )
}
