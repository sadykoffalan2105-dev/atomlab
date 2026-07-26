import { useEffect, useState } from 'react'
import { useT } from '../../i18n/useT'
import type { Clo2TeacherLine } from './clo2TeacherScript'
import { getLabTeacherNarrator } from './LabTeacherNarrator'
import styles from './LabTeacherDock.module.css'

/**
 * HUD преподавателя на синтезе ClO₂: субтитры, озвучка, слот аватара.
 */
export function LabTeacherDock({ active }: { active: boolean }) {
  const { t, locale } = useT()
  const narrator = getLabTeacherNarrator()
  const [line, setLine] = useState<Clo2TeacherLine | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => narrator.isVoiceEnabled())
  const [speaking, setSpeaking] = useState(() => narrator.isSpeaking())

  useEffect(() => {
    narrator.setLocale(locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru')
  }, [locale, narrator])

  useEffect(() => {
    if (!active) {
      setLine(null)
      return
    }
    const offLine = narrator.subscribe(setLine)
    const offSpeak = narrator.subscribeSpeaking(setSpeaking)
    setVoiceOn(narrator.isVoiceEnabled())
    return () => {
      offLine()
      offSpeak()
    }
  }, [active, narrator])

  if (!active) return null

  return (
    <aside className={styles.dock} aria-label={t('lab.teacher.aria')} data-speaking={speaking ? '1' : undefined}>
      <div className={styles.row}>
        <div className={styles.avatarSlot} data-slot="teacher-avatar" aria-hidden>
          <span className={styles.avatarMark}>{speaking ? '◎' : '✦'}</span>
        </div>
        <div className={styles.body}>
          <div className={styles.head}>
            <span className={styles.badge}>
              {t('lab.teacher.badge')}
              {speaking ? <span className={styles.liveDot} aria-hidden /> : null}
            </span>
            <div className={styles.headActions}>
              <button
                type="button"
                className={styles.replayBtn}
                onClick={() => {
                  narrator.prime()
                  narrator.replay()
                }}
                title={t('lab.teacher.replay')}
                aria-label={t('lab.teacher.replay')}
              >
                {t('lab.teacher.replay')}
              </button>
              <button
                type="button"
                className={voiceOn ? styles.muteOn : styles.muteOff}
                onClick={() => setVoiceOn(narrator.toggleVoice())}
                aria-pressed={!voiceOn}
                title={voiceOn ? t('lab.teacher.mute') : t('lab.teacher.unmute')}
              >
                {voiceOn ? t('lab.teacher.voiceOn') : t('lab.teacher.voiceOff')}
              </button>
            </div>
          </div>
          {line ? (
            <>
              <p className={styles.title}>{line.title}</p>
              <p className={styles.text}>{line.speak || t('lab.teacher.idle')}</p>
            </>
          ) : (
            <p className={styles.idle}>{t('lab.teacher.idle')}</p>
          )}
        </div>
      </div>
    </aside>
  )
}
