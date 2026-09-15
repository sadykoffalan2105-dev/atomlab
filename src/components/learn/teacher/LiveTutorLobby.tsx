/**
 * «Перед звонком»: объясняем, зачем микрофон и камера, до запроса разрешений.
 * Показывает предупреждения (нет распознавания речи, нет сети), выбор режима,
 * согласие на камеру (по умолчанию выключена) и подключение умного ИИ.
 */
import { useEffect, useRef } from 'react'
import { useT } from '../../../i18n/useT'
import type { TutorMode } from '../../../learn/brain'
import { IconMic } from '../LearnAiIcons'
import { SmartAiCta } from './TeacherChips'
import { TeacherAvatar } from './TeacherAvatar'
import { IconKeyboardSmall, IconShield, IconVideo, IconWifiOff } from './TeacherIcons'
import styles from './LiveTutor.module.css'

export function LiveTutorLobby({
  topic,
  mode,
  onModeChange,
  cameraOn,
  onCameraChange,
  speechSupported,
  online,
  onStart,
}: {
  topic: string
  mode: TutorMode
  onModeChange: (mode: TutorMode) => void
  cameraOn: boolean
  onCameraChange: (on: boolean) => void
  speechSupported: boolean
  online: boolean
  onStart: (withVoice: boolean) => void
}) {
  const { t } = useT()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyCard}>
        <div className={styles.lobbyHero}>
          <TeacherAvatar state="connecting" className={styles.lobbyAvatar} />
          <div className={styles.lobbyHeroText}>
            <p className={styles.eyebrow}>{t('learn.teacherUi.liveTitle')}</p>
            <h3 className={styles.lobbyTitle}>{t('learn.teacherUi.lobbyTitle')}</h3>
            <p className={styles.lobbyLead}>{t('learn.teacherUi.lobbyLead')}</p>
            <p className={styles.topicChip}>{t('learn.teacherUi.lobbyTopic', { topic })}</p>
          </div>
        </div>

        <div className={styles.lobbyModes} role="radiogroup" aria-label={t('learn.teacherUi.modeAria')}>
          {(['training', 'exam'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={styles.modeCard}
              data-on={mode === m ? '1' : undefined}
              data-mode={m}
              onClick={() => onModeChange(m)}
            >
              <span className={styles.modeCardName}>
                {m === 'exam' ? t('learn.teacherExam.liveModeExam') : t('learn.teacherExam.liveModeTraining')}
              </span>
              <span className={styles.modeCardDesc}>
                {m === 'exam' ? t('learn.teacherExam.liveModeExamDesc') : t('learn.teacherExam.liveModeTrainingDesc')}
              </span>
            </button>
          ))}
        </div>

        <ul className={styles.permList}>
          <li className={styles.permRow}>
            <span className={styles.permIcon} data-tone="mic">
              <IconMic />
            </span>
            <div className={styles.permText}>
              <strong>{t('learn.teacherUi.permMicTitle')}</strong>
              <span>{t('learn.teacherUi.permMicText')}</span>
            </div>
          </li>
          <li className={styles.permRow}>
            <span className={styles.permIcon} data-tone="cam">
              <IconVideo />
            </span>
            <div className={styles.permText}>
              <strong>{t('learn.teacherUi.permCamTitle')}</strong>
              <span>{t('learn.teacherUi.permCamText')}</span>
            </div>
            <label className={styles.switch}>
              <span className={styles.srOnly}>{t('learn.teacherUi.permCamToggle')}</span>
              <input
                type="checkbox"
                role="switch"
                checked={cameraOn}
                onChange={(e) => onCameraChange(e.target.checked)}
              />
              <span className={styles.switchTrack} aria-hidden />
            </label>
          </li>
          <li className={styles.permRow}>
            <span className={styles.permIcon} data-tone="safe">
              <IconShield />
            </span>
            <div className={styles.permText}>
              <strong>{t('learn.teacherUi.permPrivacyTitle')}</strong>
              <span>{t('learn.teacherUi.permHint')}</span>
            </div>
          </li>
        </ul>

        {!speechSupported ? (
          <p className={styles.warn} role="note">
            <IconKeyboardSmall className={styles.warnIcon} />
            <span>{t('learn.teacherUi.noSpeech')}</span>
          </p>
        ) : null}
        {!online ? (
          <p className={styles.warn} role="note">
            <IconWifiOff className={styles.warnIcon} />
            <span>{t('learn.teacherUi.offline')}</span>
          </p>
        ) : null}

        <SmartAiCta className={styles.lobbyCta} />

        <div className={styles.lobbyActions}>
          <button
            ref={primaryRef}
            type="button"
            className={styles.startBtn}
            onClick={() => onStart(speechSupported)}
          >
            {speechSupported ? <IconMic className={styles.btnIcon} /> : <IconKeyboardSmall className={styles.btnIcon} />}
            <span>{speechSupported ? t('learn.teacherUi.startVoice') : t('learn.teacherUi.startText')}</span>
          </button>
          {speechSupported ? (
            <button type="button" className={styles.ghostBtn} onClick={() => onStart(false)}>
              <IconKeyboardSmall className={styles.btnIcon} />
              <span>{t('learn.teacherUi.startTextOnly')}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
