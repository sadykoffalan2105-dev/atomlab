import type { RefObject } from 'react'
import type { OralMediaErrorCode, OralMediaStatus } from '../../learn/useOralExamMedia'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './OralExamCameraPanel.module.css'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: OralMediaStatus
  errorCode: OralMediaErrorCode | null
  listening: boolean
  onRetry: () => void
}

const ERROR_KEYS: Record<OralMediaErrorCode, MessageKey> = {
  not_supported: 'learn.teacherExam.cameraErrorUnsupported',
  denied: 'learn.teacherExam.cameraErrorDenied',
  not_found: 'learn.teacherExam.cameraErrorNotFound',
  in_use: 'learn.teacherExam.cameraErrorInUse',
  unknown: 'learn.teacherExam.cameraErrorUnknown',
}

export function OralExamCameraPanel({ videoRef, status, errorCode, listening, onRetry }: Props) {
  const { t } = useT()
  const showVideo = status === 'active' || status === 'requesting'

  return (
    <section className={styles.panel} aria-label={t('learn.teacherExam.cameraTitle')}>
      <div className={styles.frame}>
        <video ref={videoRef} className={styles.video} autoPlay playsInline muted aria-hidden={!showVideo} />
        {showVideo ? (
          <>
            <div className={styles.scanlines} aria-hidden />
            <div className={styles.vignette} aria-hidden />
            <span className={`${styles.hudCorner} ${styles.hudTl}`} aria-hidden />
            <span className={`${styles.hudCorner} ${styles.hudTr}`} aria-hidden />
            <span className={`${styles.hudCorner} ${styles.hudBl}`} aria-hidden />
            <span className={`${styles.hudCorner} ${styles.hudBr}`} aria-hidden />
            {listening ? <div className={styles.listeningRing} aria-hidden /> : null}
          </>
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon} aria-hidden>
              ◎
            </span>
            <p className={styles.placeholderTitle}>{t('learn.teacherExam.cameraTitle')}</p>
            <p className={`${styles.placeholderText} ${status === 'error' ? styles.errorText : ''}`}>
              {status === 'error' && errorCode
                ? t(ERROR_KEYS[errorCode])
                : t('learn.teacherExam.cameraWaiting')}
            </p>
            {status === 'error' ? (
              <button type="button" className={styles.retryBtn} onClick={onRetry}>
                {t('learn.teacherExam.cameraRetry')}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className={styles.statusBar}>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${status === 'active' ? styles.badgeOn : ''}`}>
            <span className={styles.badgeDot} aria-hidden />
            {t('learn.teacherExam.cameraBadge')}
          </span>
          <span className={`${styles.badge} ${listening ? `${styles.badgeOn} ${styles.badgeLive}` : ''}`}>
            <span className={styles.badgeDot} aria-hidden />
            {listening ? t('learn.teacherExam.micRecording') : t('learn.teacherExam.micBadge')}
          </span>
        </div>
        <p className={styles.hint}>{t('learn.teacherExam.cameraHint')}</p>
      </div>
    </section>
  )
}
