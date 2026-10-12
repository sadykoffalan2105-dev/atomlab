/**
 * Кабинет учителя → «ИИ-помощник учителя»: план урока по §, тест по § / главе (СОР/СОЧ/квиз),
 * проверка работы по фото (рекомендация — решает учитель). Запросы — teacherTools.ts (/teacher/*),
 * ключ учителя — тот же, что у «Нарисовать» (imageClient). Экспорт: Word (.doc), Excel (.xlsx), CSV, печать.
 * Демо без сервера: «?teacherMock=1» в адресе (teacherToolsMock.ts) — результат помечен «Демо».
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { AppLocale } from '../../../i18n/types'
import { prepareChatPhoto, type ChatPhoto } from '../../../learn/brain/remote/chatPhoto'
import { setImageKey, useImageRole } from '../../../learn/brain/remote/imageClient'
import {
  callTeacherTool,
  GRADE_IMAGES_MAX,
  GRADE_RUBRIC_MAX,
  PLAN_MINUTES,
  TEST_N,
  TEST_N_DEFAULT,
  TEST_UNITS_MAX,
  TeacherToolError,
  type GradeResult,
  type LessonPlan,
  type TeacherTest,
  type TeacherToolKind,
  type TeacherToolMap,
  type TestFormat,
} from '../../../learn/brain/remote/teacherTools'
import {
  downloadBlob,
  gradeHtml,
  MIME,
  planHtml,
  printDocument,
  printHtml,
  safeFileName,
  testCsv,
  testHtml,
  testXlsx,
  wordDocument,
} from '../../../learn/brain/remote/teacherToolsExport'
import { mockTeacherTool, teacherMockEnabled } from '../../../learn/brain/remote/teacherToolsMock'
import { onRadioGroupKeyDown } from './radioGroupKeys'
import { exportLabels, ttFor, useTT, type TTKey } from './teacherToolsI18n'
import s from './TeacherToolsPanel.module.css'

type L3 = Record<AppLocale, string>
interface UnitRow {
  id: string
  g: number
  kp: string
  kind: string
  t: L3
  l: L3
  ch?: { n: number; t: L3 }
}

type Result =
  | { kind: 'plan'; data: LessonPlan; demo: boolean; lang: AppLocale }
  | { kind: 'test'; data: TeacherTest; demo: boolean; lang: AppLocale }
  | { kind: 'grade'; data: GradeResult; demo: boolean; lang: AppLocale; title: string }

const TOOLS: { id: TeacherToolKind; key: TTKey }[] = [
  { id: 'plan', key: 'tabPlan' },
  { id: 'test', key: 'tabTest' },
  { id: 'grade', key: 'tabGrade' },
]
const GRADES = [7, 8, 9, 10, 11] as const
const ALL_CHAPTERS = -1
const LANGS: AppLocale[] = ['ru', 'uz', 'en']
const LANG_NAME: Record<AppLocale, string> = { ru: 'Русский', uz: 'O‘zbekcha', en: 'English' }
const FORMATS: { id: TestFormat; key: TTKey }[] = [
  { id: 'sor', key: 'fmtSor' },
  { id: 'soch', key: 'fmtSoch' },
  { id: 'quiz', key: 'fmtQuiz' },
]

const ERR_KEY: Record<string, TTKey> = {
  offline: 'errOffline',
  network: 'errNetwork',
  timeout: 'errTimeout',
  forbidden: 'errForbidden',
  bad_request: 'errBad',
  not_found: 'errNotFound',
  rate: 'errRate',
  busy: 'errBusy',
  disabled: 'errDisabled',
  internal: 'errInternal',
}

let unitsCache: UnitRow[] | null = null
function loadUnits(): Promise<UnitRow[]> {
  if (unitsCache) return Promise.resolve(unitsCache)
  return import('../../../learn/brain/remote/teacherUnits.json').then((m) => {
    const data = (m as unknown as { default?: { units: UnitRow[] }; units?: UnitRow[] }).default ?? (m as unknown as { units: UnitRow[] })
    unitsCache = data.units ?? []
    return unitsCache
  })
}

const unitText = (u: UnitRow, lang: AppLocale) => `${u.l[lang] || u.l.ru} — ${u.t[lang] || u.t.ru}`

function groupByChapter(list: UnitRow[]): { n: number; title: string; units: UnitRow[] }[] {
  const map = new Map<number, { n: number; title: string; units: UnitRow[] }>()
  for (const u of list) {
    const n = u.ch?.n ?? 0
    if (!map.has(n)) map.set(n, { n, title: '', units: [] })
    map.get(n)!.units.push(u)
  }
  // глава 0 («Практические занятия») — в конце списка
  return [...map.values()].sort((a, b) => (a.n || 999) - (b.n || 999))
}

export function TeacherToolsPanel() {
  const { locale, tt } = useTT()
  const uid = useId()
  const role = useImageRole()
  const mock = useMemo(() => teacherMockEnabled(), [])
  const allowed = mock || role !== 'student'

  const [tool, setTool] = useState<TeacherToolKind>('plan')
  const [units, setUnits] = useState<UnitRow[]>(unitsCache ?? [])
  const [gradeNum, setGradeNum] = useState<number>(8)
  // язык результата: по умолчанию — язык интерфейса (меняется вместе с ним), пока учитель не выберет другой
  const [langPicked, setLang] = useState<AppLocale | null>(null)
  const lang: AppLocale = langPicked ?? locale
  // план
  const [planUnit, setPlanUnit] = useState('')
  const [minutes, setMinutes] = useState<number>(PLAN_MINUTES.def)
  // тест
  // -1 = все главы (0 — глава «Практические занятия» в карте программы)
  const [chapter, setChapter] = useState<number>(ALL_CHAPTERS)
  const [picked, setPicked] = useState<string[]>([])
  const [format, setFormat] = useState<TestFormat>('sor')
  const [nItems, setNItems] = useState<number>(TEST_N_DEFAULT.sor)
  // проверка
  const [gradeUnit, setGradeUnit] = useState('')
  // критерии: пока учитель их не трогал — образец на языке интерфейса (переводится вместе с ним)
  type RubricRow = { name: string; max: number }
  const [rubricEdited, setRubricEdited] = useState<RubricRow[] | null>(null)
  const rubric: RubricRow[] = rubricEdited ?? [
    { name: tt('rubricDefault1'), max: 2 },
    { name: tt('rubricDefault2'), max: 2 },
    { name: tt('rubricDefault3'), max: 1 },
  ]
  const setRubric = (f: (cur: RubricRow[]) => RubricRow[]) => setRubricEdited(f(rubric))
  const [photos, setPhotos] = useState<ChatPhoto[]>([])
  const [photoErr, setPhotoErr] = useState(false)
  // ключ
  const [keyInput, setKeyInput] = useState('')
  const [keyOwner, setKeyOwner] = useState(false)
  // запрос / результат
  const [busy, setBusy] = useState<TeacherToolKind | null>(null)
  const [error, setError] = useState<string>('')
  const [result, setResult] = useState<Result | null>(null)
  const [edits, setEdits] = useState<Record<number, number>>({})
  const [withKeys, setWithKeys] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const resultHeadRef = useRef<HTMLHeadingElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let alive = true
    void loadUnits()
      .then((u) => alive && setUnits(u))
      .catch(() => undefined)
    return () => {
      alive = false
      abortRef.current?.abort()
    }
  }, [])

  const gradeUnits = useMemo(() => units.filter((u) => u.g === gradeNum), [units, gradeNum])
  const chapters = useMemo(() => {
    const out = groupByChapter(gradeUnits)
    for (const c of out) c.title = c.units[0]?.ch ? `${c.n ? `${c.n}. ` : ''}${c.units[0].ch.t[locale] || c.units[0].ch.t.ru}` : ''
    return out
  }, [gradeUnits, locale])
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units])
  const testList = useMemo(() => (chapter !== ALL_CHAPTERS ? gradeUnits.filter((u) => (u.ch?.n ?? 0) === chapter) : gradeUnits), [gradeUnits, chapter])

  // § плана: выбранный, если он из текущего класса, иначе первый в классе (без эффекта — выводим из состояния)
  const planUnitEff = gradeUnits.some((u) => u.id === planUnit) ? planUnit : (gradeUnits[0]?.id ?? '')
  const changeGrade = (g: number) => {
    setGradeNum(g)
    setGradeUnit('')
    setPicked([])
    setChapter(ALL_CHAPTERS)
  }

  const titleOf = (id: string) => {
    const u = unitById.get(id)
    return u ? u.t[lang] || u.t.ru : id
  }

  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TOOLS.findIndex((x) => x.id === tool)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % TOOLS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TOOLS.length) % TOOLS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TOOLS.length - 1
    if (next < 0) return
    e.preventDefault()
    setTool(TOOLS[next]!.id)
    document.getElementById(`${uid}-tab-${TOOLS[next]!.id}`)?.focus()
  }

  const togglePick = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= TEST_UNITS_MAX ? cur : [...cur, id]))

  const pickChapter = () => setPicked(testList.slice(0, TEST_UNITS_MAX).map((u) => u.id))

  const saveKey = () => {
    const v = keyInput.trim()
    if (v.length < 8) return
    setImageKey(keyOwner ? 'owner' : 'teacher', v)
    setKeyInput('')
    setError('')
  }
  const forgetKey = () => {
    setImageKey('owner', '')
    setImageKey('teacher', '')
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setPhotoErr(false)
    const room = GRADE_IMAGES_MAX - photos.length
    const next: ChatPhoto[] = []
    for (const f of [...files].slice(0, Math.max(0, room))) {
      try {
        next.push(await prepareChatPhoto(f))
      } catch {
        setPhotoErr(true)
      }
    }
    if (next.length) setPhotos((cur) => [...cur, ...next].slice(0, GRADE_IMAGES_MAX))
    if (fileRef.current) fileRef.current.value = ''
  }

  const run = async (kind: TeacherToolKind) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(kind)
    setError('')
    try {
      const call = <K extends TeacherToolKind>(k: K, req: TeacherToolMap[K]['req']): Promise<TeacherToolMap[K]['res']> =>
        mock ? mockTeacherTool(k, req, titleOf) : callTeacherTool(k, req, { signal: ctrl.signal })
      let next: Result
      if (kind === 'plan') {
        next = { kind, data: await call('plan', { unit: planUnitEff, lang, minutes }), demo: mock, lang }
      } else if (kind === 'test') {
        const data = await call('test', { units: picked, lang, n: nItems, format })
        // id единицы «g8:14» → подпись «Kimyo 8, §14» для листа, Word и Excel
        const items = data.items.map((it) => {
          const u = unitById.get(it.unit)
          return u ? { ...it, unit: u.l[lang] || u.l.ru } : it
        })
        next = { kind, data: { ...data, items }, demo: mock, lang }
      } else {
        const data = await call('grade', { lang, unit: gradeUnit || undefined, rubric, images: photos.map((p) => p.base64) })
        next = { kind, data, demo: mock, lang, title: `${ttLang(lang, 'gradeTitle')}${gradeUnit ? `: ${titleOf(gradeUnit)}` : ''}` }
      }
      if (ctrl.signal.aborted) return
      setEdits({})
      setResult(next)
      requestAnimationFrame(() => resultHeadRef.current?.focus())
    } catch (e) {
      if (ctrl.signal.aborted) return
      const err = e instanceof TeacherToolError ? e : new TeacherToolError('internal')
      if (err.code === 'aborted') return
      setError(tt(ERR_KEY[err.code] ?? 'errInternal', { n: err.retryAfterSec ?? 30 }))
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null
        setBusy(null)
      }
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(null)
  }

  /* ---------- результат: HTML, правки баллов, экспорт ---------- */

  const gradeView: GradeResult | null = useMemo(() => {
    if (result?.kind !== 'grade') return null
    const criteria = result.data.criteria.map((c, i) => (edits[i] != null ? { ...c, points: edits[i]! } : c))
    return { ...result.data, criteria, total: criteria.reduce((a, c) => a + c.points, 0) }
  }, [result, edits])

  const docTitle = (r: Result): string => (r.kind === 'grade' ? r.title : r.data.title || tt(r.kind === 'plan' ? 'tabPlan' : 'tabTest'))

  const bodyHtml = (r: Result, keys: boolean): string => {
    const L = exportLabels(r.lang)
    const origin = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : ''
    if (r.kind === 'plan') return planHtml(r.data, L, origin)
    if (r.kind === 'test') return testHtml(r.data, L, keys)
    return gradeHtml(gradeView ?? r.data, L, r.title)
  }

  const previewHtml = useMemo(() => (result && result.kind !== 'grade' ? bodyHtml(result, true) : ''), [result]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportWord = () => {
    if (!result) return
    const title = docTitle(result)
    downloadBlob(`${safeFileName(title)}.doc`, wordDocument(title, bodyHtml(result, withKeys), exportLabels(result.lang)), MIME.doc)
  }
  const exportXlsx = () => {
    if (result?.kind !== 'test') return
    downloadBlob(`${safeFileName(docTitle(result))}.xlsx`, testXlsx(result.data, exportLabels(result.lang)) as BlobPart, MIME.xlsx)
  }
  const exportCsv = () => {
    if (result?.kind !== 'test') return
    downloadBlob(`${safeFileName(docTitle(result))}.csv`, testCsv(result.data, exportLabels(result.lang)), MIME.csv)
  }
  const doPrint = () => {
    if (!result) return
    printHtml(printDocument(docTitle(result), bodyHtml(result, withKeys), exportLabels(result.lang)))
  }

  /* ---------- разметка ---------- */

  const canPlan = allowed && !!planUnitEff && !busy
  const canTest = allowed && picked.length > 0 && !busy
  const canGrade = allowed && photos.length > 0 && rubric.some((r) => r.name.trim()) && !busy
  const keyNoteId = `${uid}-keynote`

  const unitSelect = (id: string, value: string, onChange: (v: string) => void, optional: boolean) => (
    <select id={id} className={s.input} value={value} onChange={(e) => onChange(e.target.value)} disabled={!units.length}>
      {optional ? <option value="">{tt('unitNone')}</option> : null}
      {chapters.map((c) => (
        <optgroup key={c.n} label={c.title || tt('chapter')}>
          {c.units.map((u) => (
            <option key={u.id} value={u.id}>
              {unitText(u, locale)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )

  const commonFields = (
    <>
      <div className={s.field}>
        <label htmlFor={`${uid}-grade`}>{tt('grade')}</label>
        <select id={`${uid}-grade`} className={s.input} value={gradeNum} onChange={(e) => changeGrade(Number(e.target.value))}>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {tt('gradeN', { n: g })}
            </option>
          ))}
        </select>
      </div>
      <div className={s.field}>
        <label htmlFor={`${uid}-lang`}>{tt('lang')}</label>
        <select id={`${uid}-lang`} className={s.input} value={lang} onChange={(e) => setLang(e.target.value as AppLocale)}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAME[l]}
            </option>
          ))}
        </select>
      </div>
    </>
  )

  const runRow = (kind: TeacherToolKind, label: TTKey, can: boolean) => (
    <div className={s.actions}>
      <button
        type="button"
        className={`${s.btn} ${s.primary}`}
        onClick={() => void run(kind)}
        disabled={!can}
        aria-describedby={!allowed ? keyNoteId : undefined}
      >
        {tt(label)}
      </button>
      {busy === kind ? (
        <button type="button" className={s.btn} onClick={cancel}>
          {tt('cancel')}
        </button>
      ) : null}
    </div>
  )

  return (
    <section className={s.panel} aria-labelledby={`${uid}-title`}>
      <div className={s.head}>
        <h2 id={`${uid}-title`} className={s.title}>
          {tt('title')}
        </h2>
        {mock ? (
          <span className={s.demo} title={tt('demoNote')}>
            {tt('demo')}
          </span>
        ) : null}
      </div>
      <p className={s.lead}>{tt('lead')}</p>
      {mock ? <p className={s.note}>{tt('demoNote')}</p> : null}

      {/* ключ учителя — тот же, что у «Нарисовать» */}
      {role === 'student' ? (
        <div className={s.keyBox}>
          <p id={keyNoteId} className={s.note}>
            {tt('keyNeed')}
          </p>
          <div className={s.row}>
            <label className={s.srOnly} htmlFor={`${uid}-key`}>
              {tt('keyLabel')}
            </label>
            <input
              id={`${uid}-key`}
              type="password"
              className={s.input}
              placeholder={tt('keyLabel')}
              value={keyInput}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveKey()
                }
              }}
            />
            <button type="button" className={s.btn} onClick={saveKey} disabled={keyInput.trim().length < 8}>
              {tt('keySave')}
            </button>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={keyOwner} onChange={(e) => setKeyOwner(e.target.checked)} />
            <span>{tt('keyOwner')}</span>
          </label>
        </div>
      ) : (
        <div className={s.keyRow}>
          <span className={s.ok}>{tt(role === 'owner' ? 'keyRoleOwner' : 'keyRoleTeacher')}</span>
          <button type="button" className={s.linkBtn} onClick={forgetKey}>
            {tt('keyForget')}
          </button>
        </div>
      )}

      <div className={s.tabs} role="tablist" aria-label={tt('tabsLabel')} onKeyDown={onTabsKey}>
        {TOOLS.map((x) => (
          <button
            key={x.id}
            id={`${uid}-tab-${x.id}`}
            type="button"
            role="tab"
            aria-selected={tool === x.id}
            aria-controls={`${uid}-panel`}
            tabIndex={tool === x.id ? 0 : -1}
            className={tool === x.id ? `${s.tab} ${s.tabOn}` : s.tab}
            onClick={() => setTool(x.id)}
          >
            {tt(x.key)}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tool}`} className={s.tabPanel}>
        {tool === 'plan' ? (
          <>
            <div className={s.grid}>
              {commonFields}
              <div className={s.field}>
                <label htmlFor={`${uid}-minutes`}>{tt('minutes')}</label>
                <input
                  id={`${uid}-minutes`}
                  className={s.input}
                  type="number"
                  inputMode="numeric"
                  min={PLAN_MINUTES.min}
                  max={PLAN_MINUTES.max}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value) || PLAN_MINUTES.def)}
                />
              </div>
            </div>
            <div className={s.field}>
              <label htmlFor={`${uid}-plan-unit`}>{tt('unit')}</label>
              {unitSelect(`${uid}-plan-unit`, planUnitEff, setPlanUnit, false)}
            </div>
            {runRow('plan', 'makePlan', canPlan)}
          </>
        ) : null}

        {tool === 'test' ? (
          <>
            <div className={s.grid}>
              {commonFields}
              <div className={s.field}>
                <label htmlFor={`${uid}-n`}>{tt('n')}</label>
                <input
                  id={`${uid}-n`}
                  className={s.input}
                  type="number"
                  inputMode="numeric"
                  min={TEST_N.min}
                  max={TEST_N.max}
                  value={nItems}
                  onChange={(e) => setNItems(Number(e.target.value) || TEST_N_DEFAULT[format])}
                />
              </div>
            </div>
            <div className={s.field}>
              <span id={`${uid}-fmt`}>{tt('format')}</span>
              <div className={s.seg} role="radiogroup" aria-labelledby={`${uid}-fmt`} onKeyDown={onRadioGroupKeyDown}>
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={format === f.id}
                    tabIndex={format === f.id ? 0 : -1}
                    className={format === f.id ? `${s.segBtn} ${s.segOn}` : s.segBtn}
                    onClick={() => {
                      setFormat(f.id)
                      setNItems(TEST_N_DEFAULT[f.id])
                    }}
                  >
                    {tt(f.key)}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.row}>
              <div className={s.field}>
                <label htmlFor={`${uid}-ch`}>{tt('chapter')}</label>
                <select id={`${uid}-ch`} className={s.input} value={chapter} onChange={(e) => setChapter(Number(e.target.value))}>
                  <option value={ALL_CHAPTERS}>{tt('chapterAll')}</option>
                  {chapters.map((c) => (
                    <option key={c.n} value={c.n}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.inlineBtns}>
                <button type="button" className={s.btn} onClick={pickChapter} disabled={!testList.length}>
                  {tt('pickChapter')}
                </button>
                <button type="button" className={s.btn} onClick={() => setPicked([])} disabled={!picked.length}>
                  {tt('clearPick')}
                </button>
              </div>
            </div>
            <fieldset className={s.unitList}>
              <legend>
                {tt('units')} · <span aria-live="polite">{tt('unitsPicked', { n: picked.length, max: TEST_UNITS_MAX })}</span>
              </legend>
              {testList.map((u) => (
                <label key={u.id} className={s.check}>
                  <input
                    type="checkbox"
                    checked={picked.includes(u.id)}
                    disabled={!picked.includes(u.id) && picked.length >= TEST_UNITS_MAX}
                    onChange={() => togglePick(u.id)}
                  />
                  <span>{unitText(u, locale)}</span>
                </label>
              ))}
            </fieldset>
            {runRow('test', 'makeTest', canTest)}
          </>
        ) : null}

        {tool === 'grade' ? (
          <>
            <div className={s.grid}>{commonFields}</div>
            <div className={s.field}>
              <label htmlFor={`${uid}-g-unit`}>{tt('unitOptional')}</label>
              {unitSelect(`${uid}-g-unit`, gradeUnit, setGradeUnit, true)}
            </div>
            <fieldset className={s.rubric}>
              <legend>{tt('rubric')}</legend>
              {rubric.map((r, i) => (
                <div key={i} className={s.rubricRow}>
                  <input
                    className={s.input}
                    aria-label={tt('rubricName', { n: i + 1 })}
                    value={r.name}
                    maxLength={200}
                    onChange={(e) => setRubric((cur) => cur.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className={`${s.input} ${s.num}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    aria-label={tt('rubricMax', { n: i + 1 })}
                    value={r.max}
                    onChange={(e) => setRubric((cur) => cur.map((x, j) => (j === i ? { ...x, max: Math.max(1, Number(e.target.value) || 1) } : x)))}
                  />
                  <button
                    type="button"
                    className={s.iconBtn}
                    aria-label={tt('rubricDel', { n: i + 1 })}
                    disabled={rubric.length <= 1}
                    onClick={() => setRubric((cur) => cur.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={s.btn}
                disabled={rubric.length >= GRADE_RUBRIC_MAX}
                onClick={() => setRubric((cur) => [...cur, { name: '', max: 1 }])}
              >
                {tt('rubricAdd')}
              </button>
            </fieldset>
            <div className={s.field}>
              <span id={`${uid}-ph`}>{tt('photos', { max: GRADE_IMAGES_MAX })}</span>
              <div className={s.photos} role="list" aria-labelledby={`${uid}-ph`}>
                {photos.map((p, i) => (
                  <div key={p.id} className={s.photo} role="listitem">
                    <img src={p.thumb} alt={tt('photoAlt', { n: i + 1 })} width={80} height={80} />
                    <button
                      type="button"
                      className={s.photoDel}
                      aria-label={tt('photoDel', { n: i + 1 })}
                      onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < GRADE_IMAGES_MAX ? (
                  <label className={s.addPhoto}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className={s.srOnly}
                      onChange={(e) => void addPhotos(e.target.files)}
                    />
                    <span aria-hidden="true">＋</span>
                    <span>{tt('photosAdd')}</span>
                  </label>
                ) : null}
              </div>
              {photoErr ? (
                <p className={s.err} role="alert">
                  {tt('photoBad')}
                </p>
              ) : null}
              <p className={s.note}>{tt('photosPrivacy')}</p>
            </div>
            {runRow('grade', 'makeGrade', canGrade)}
          </>
        ) : null}

        <p className={s.status} role="status" aria-live="polite">
          {busy ? tt(busy === 'grade' ? 'workingGrade' : 'working') : ''}
        </p>
        {busy ? <div className={s.progress} aria-hidden="true" /> : null}
        {error ? (
          <p className={s.err} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {result ? (
        <div className={s.result} role="region" aria-labelledby={`${uid}-res`}>
          <div className={s.resultHead}>
            <h3 id={`${uid}-res`} ref={resultHeadRef} tabIndex={-1} className={s.resultTitle}>
              {tt('resultTitle')}: {tt(result.kind === 'plan' ? 'tabPlan' : result.kind === 'test' ? 'tabTest' : 'tabGrade')}
            </h3>
            {result.demo ? <span className={s.demo}>{tt('demo')}</span> : null}
          </div>
          <div className={s.exportRow}>
            <button type="button" className={s.btn} onClick={exportWord}>
              {tt('exportWord')}
            </button>
            {result.kind === 'test' ? (
              <>
                <button type="button" className={s.btn} onClick={exportXlsx}>
                  {tt('exportXlsx')}
                </button>
                <button type="button" className={s.btn} onClick={exportCsv}>
                  {tt('exportCsv')}
                </button>
              </>
            ) : null}
            <button type="button" className={s.btn} onClick={doPrint}>
              {tt('print')}
            </button>
            {result.kind === 'test' ? (
              <label className={s.check}>
                <input type="checkbox" checked={withKeys} onChange={(e) => setWithKeys(e.target.checked)} />
                <span>{tt('withKeys')}</span>
              </label>
            ) : null}
          </div>

          {result.kind === 'grade' && gradeView ? (
            <div className={s.doc} lang={result.lang}>
              <p className={s.warn}>{ttLang(result.lang, 'recommendation')}</p>
              <p className={s.note}>{tt('gradeEdit')}</p>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">{ttLang(result.lang, 'criterion')}</th>
                      <th scope="col">{ttLang(result.lang, 'range')}</th>
                      <th scope="col">{ttLang(result.lang, 'max')}</th>
                      <th scope="col">{ttLang(result.lang, 'comment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeView.criteria.map((c, i) => (
                      <tr key={i}>
                        <th scope="row">{c.name}</th>
                        <td>
                          <input
                            className={`${s.input} ${s.num}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={c.max || undefined}
                            step={0.5}
                            value={c.points}
                            aria-label={tt('pointsFor', { name: c.name })}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(c.max || Infinity, Number(e.target.value) || 0))
                              setEdits((cur) => ({ ...cur, [i]: v }))
                            }}
                          />
                        </td>
                        <td>{c.max}</td>
                        <td>{c.comment}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">{ttLang(result.lang, 'total')}</th>
                      <td>
                        <strong aria-live="polite">{gradeView.total}</strong>
                      </td>
                      <td>
                        <strong>{gradeView.max}</strong>
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
              {gradeView.note ? (
                <p className={s.note}>
                  {ttLang(result.lang, 'note')}: {gradeView.note}
                </p>
              ) : null}
            </div>
          ) : (
            // HTML собран из экранированного текста (teacherToolsExport.escapeHtml) — тот же, что уйдёт в Word и на печать
            <div className={s.doc} lang={result.lang} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          )}
        </div>
      ) : null}
    </section>
  )
}

/** Подпись на языке результата (таблица проверки на языке ответа, а не интерфейса). */
const ttCache = new Map<AppLocale, ReturnType<typeof ttFor>>()
function ttLang(lang: AppLocale, key: TTKey): string {
  let f = ttCache.get(lang)
  if (!f) {
    f = ttFor(lang)
    ttCache.set(lang, f)
  }
  return f(key)
}

export default TeacherToolsPanel
