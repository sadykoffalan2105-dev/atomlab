import { useCallback, useRef, useState } from 'react'
import { useT } from '../i18n/useT'
import {
  captureHomeworkFromCamera,
  clearHomeworkReviewHistory,
  loadHomeworkImageFile,
  readHomeworkReviewHistory,
  reviewHomework,
  saveHomeworkReviewToHistory,
  type HomeworkReviewReport,
  type HomeworkScanSource,
} from '../learn/homework'
import styles from './LearnPage.module.css'

function authKey(a: HomeworkReviewReport['authorship']['authorship']) {
  return `learn.teacher.auth.${a}` as const
}

export function HomeworkReviewPanel() {
  const { t, locale } = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [topic, setTopic] = useState('')
  const [gradeId, setGradeId] = useState('g8')
  const [text, setText] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [source, setSource] = useState<HomeworkScanSource>('paste')
  const [ocrHint, setOcrHint] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<HomeworkReviewReport | null>(null)
  const [history, setHistory] = useState(readHomeworkReviewHistory)

  const refreshHistory = useCallback(() => {
    setHistory(readHomeworkReviewHistory())
  }, [])

  const applyScan = async (file?: File | null) => {
    setError(null)
    try {
      const result = file
        ? await loadHomeworkImageFile(file)
        : await captureHomeworkFromCamera()
      if (!result) {
        setError(t('learn.teacher.homeworkNeedText'))
        return
      }
      setPreviewUrl(result.dataUrl)
      setSource(file ? 'upload' : 'camera')
      if (result.ocrText?.trim()) {
        setText((prev) => (prev.trim() ? prev : result.ocrText!.trim()))
        setOcrHint(true)
      } else {
        setOcrHint(true)
      }
    } catch {
      setError(t('learn.teacher.homeworkNeedText'))
    }
  }

  const onRun = async () => {
    const trimmed = text.trim()
    if (trimmed.length < 12) {
      setError(t('learn.teacher.homeworkNeedText'))
      return
    }
    setError(null)
    setRunning(true)
    try {
      const next = await reviewHomework({
        text: trimmed,
        imageDataUrl: previewUrl,
        source,
        topicHint: topic.trim() || undefined,
        gradeId,
        locale,
      })
      setReport(next)
      saveHomeworkReviewToHistory(next)
      refreshHistory()
    } catch {
      setError(t('learn.teacher.homeworkNeedText'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className={`${styles.teacherBlock} ${styles.homeworkBlock}`}>
      <h2 className={styles.h}>{t('learn.teacher.homeworkTitle')}</h2>
      <p className={styles.homeworkLead}>{t('learn.teacher.homeworkLead')}</p>

      <div className={styles.teacherFormRow}>
        <input
          className={styles.teacherInput}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('learn.teacher.homeworkTopic')}
        />
        <select
          className={styles.teacherInput}
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
          aria-label={t('learn.teacher.grade')}
        >
          <option value="g7">7</option>
          <option value="g8">8</option>
          <option value="g9">9</option>
          <option value="g10">10</option>
          <option value="g11">11</option>
        </select>
      </div>

      <label className={styles.homeworkLabel} htmlFor="hw-paste">
        {t('learn.teacher.homeworkPaste')}
      </label>
      <textarea
        id="hw-paste"
        className={styles.homeworkTextarea}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSource('paste')
        }}
        placeholder={t('learn.teacher.homeworkPastePh')}
        rows={8}
      />

      <div className={styles.teacherFormRow}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className={styles.homeworkFileHidden}
          onChange={(e) => {
            const f = e.target.files?.[0]
            void applyScan(f ?? null)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={styles.btn}
          onClick={() => fileRef.current?.click()}
        >
          {t('learn.teacher.homeworkUpload')}
        </button>
        <button type="button" className={styles.btn} onClick={() => void applyScan()}>
          {t('learn.teacher.homeworkCamera')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={running}
          onClick={() => void onRun()}
        >
          {running ? t('learn.teacher.homeworkRunning') : t('learn.teacher.homeworkRun')}
        </button>
      </div>

      {ocrHint ? <p className={styles.homeworkHint}>{t('learn.teacher.homeworkOcrHint')}</p> : null}
      {error ? <p className={styles.homeworkError}>{error}</p> : null}

      {previewUrl ? (
        <div className={styles.homeworkPreviewWrap}>
          <img src={previewUrl} alt="" className={styles.homeworkPreview} />
        </div>
      ) : null}

      {report ? (
        <div className={styles.homeworkReport}>
          <div className={styles.homeworkScoreRow}>
            <div className={styles.homeworkScoreCard}>
              <span className={styles.homeworkScoreLabel}>{t('learn.teacher.homeworkAuth')}</span>
              <strong className={styles.homeworkScoreValue}>{t(authKey(report.authorship.authorship))}</strong>
              <span className={styles.homeworkScoreMeta}>
                AI ~{Math.round(report.authorship.aiProbability * 100)}%
              </span>
            </div>
            <div className={styles.homeworkScoreCard}>
              <span className={styles.homeworkScoreLabel}>{t('learn.teacher.homeworkChem')}</span>
              <strong className={styles.homeworkScoreValue}>{report.chemistry.score}/100</strong>
              <span className={styles.homeworkScoreMeta}>{report.chemistry.verdict}</span>
            </div>
          </div>

          <h3 className={styles.homeworkSubh}>{t('learn.teacher.homeworkBrief')}</h3>
          <pre className={styles.homeworkPre}>{report.teacherBrief}</pre>

          <h3 className={styles.homeworkSubh}>{t('learn.teacher.homeworkStudent')}</h3>
          <p className={styles.homeworkStudentFb}>{report.studentFeedback}</p>

          {report.authorship.signals.length > 0 ? (
            <>
              <h3 className={styles.homeworkSubh}>{t('learn.teacher.homeworkSignals')}</h3>
              <ul className={styles.homeworkSignals}>
                {report.authorship.signals.map((s) => (
                  <li key={s.id}>
                    {s.detail}
                    {s.weight !== 0 ? (
                      <span className={styles.homeworkSignalW}>
                        {s.weight > 0 ? '+' : ''}
                        {s.weight.toFixed(2)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className={styles.homeworkHistory}>
          <div className={styles.homeworkHistoryHead}>
            <h3 className={styles.homeworkSubh}>{t('learn.teacher.homeworkHistory')}</h3>
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                clearHomeworkReviewHistory()
                refreshHistory()
              }}
            >
              {t('learn.teacher.homeworkClearHistory')}
            </button>
          </div>
          <ul className={styles.homeworkHistoryList}>
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span>{t(authKey(h.authorship))}</span>
                <span>
                  {h.score}/100 · {h.chemistryVerdict}
                </span>
                <span className={styles.homeworkHistoryPreview}>{h.preview}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
