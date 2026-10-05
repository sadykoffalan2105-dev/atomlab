/**
 * Органика v2 — Конструктор: рисуешь только скелет (C и гетероатомы, группы, кольца), водороды, формулу, класс,
 * название ИЮПАК (RU/EN/UZ) и живое 3D считает движок src/chemistry/organicV2.
 * Задания: build (собери по названию), isomers (найди все изомеры формулы), free. Контракт props — ./contracts.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OrganicConstructorProps } from './contracts'
import { buildRegistryIndex, type RegistryIndex } from '../../chemistry/organicV2'
import { EMPTY, GROUP_KEYS, PALETTE_ELEMENTS, bondById, removeAtom, removeBond, setBondOrder, setElement, toSkeleton, topologyKey, type CState, type GroupKey } from './constructor/model'
import { analyze, entryName, isomerSet, judgeBuild, judgeIsomer, makeTarget, rememberName, type NameSet } from './constructor/analysis'
import { tidyLayout } from './constructor/layout'
import { EditorCanvas, type Focus, type Tool } from './constructor/EditorCanvas'
import { Preview3D } from './constructor/Preview3D'
import { embedInBackground, nameInBackground, type Embedded } from './constructor/engineClient'
import { CT, GROUP_LABEL, GROUP_TITLE, fmt, hintText } from './constructor/i18n'
import styles from './constructor/OrganicConstructor.module.css'

const INTRO_KEY = 'atomlab.ov2.constructor.intro.v1'
const readIntroSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1' } catch { return false } }
const writeIntroSeen = () => { try { localStorage.setItem(INTRO_KEY, '1') } catch { /* приватное окно */ } }

/** Индекс реестра строится один раз на набор молекул. */
const indexCache = new WeakMap<object, RegistryIndex>()
function registryIndex(mols: OrganicConstructorProps['molecules']): RegistryIndex {
  let ix = indexCache.get(mols)
  if (!ix) { ix = buildRegistryIndex(Object.values(mols)); indexCache.set(mols, ix) }
  return ix
}

interface History { readonly past: readonly CState[]; readonly now: CState; readonly future: readonly CState[] }

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)
const IC = {
  draw: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  erase: 'M7 21h10M5 15l8-8 6 6-6 6H9l-4-4zM9 11l6 6',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  tidy: 'M3 17l5-8 4 6 4-6 5 8',
  clear: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
}

export function OrganicConstructor(props: OrganicConstructorProps) {
  const { task, lang, molecules, onSolved, className } = props
  const t = CT[lang]
  const [hist, setHist] = useState<History>({ past: [], now: EMPTY, future: [] })
  const [preview, setPreview] = useState<CState | null>(null)
  const [tool, setTool] = useState<Tool>({ kind: 'draw', el: 'C' })
  const [focus, setFocus] = useState<Focus>(null)
  const [fitKey, setFitKey] = useState(0)
  const [showDeg, setShowDeg] = useState(false)
  const [intro, setIntro] = useState<number>(() => (readIntroSeen() ? -1 : 0))
  const [bgName, setBgName] = useState<{ code: string; name: NameSet } | null>(null)
  const [emb, setEmb] = useState<{ key: string; data: Embedded } | null>(null)
  const [showFormula, setShowFormula] = useState(false)
  const [buildMsg, setBuildMsg] = useState<string | null>(null)
  const [isoFound, setIsoFound] = useState<readonly string[]>([])
  const [isoMsg, setIsoMsg] = useState<{ text: string; tone: 'ok' | 'warn' | 'bad' } | null>(null)
  const solvedRef = useRef<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const state = preview ?? hist.now
  const index = useMemo(() => registryIndex(molecules), [molecules])

  const commit = useCallback((s: CState) => {
    setPreview(null)
    setHist((h) => (s === h.now ? h : { past: [...h.past.slice(-99), h.now], now: s, future: [] }))
  }, [])
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h)), [])
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h)), [])

  // ── разбор (только при изменении молекулы, не при сдвиге атома) ──
  const sk = useMemo(() => toSkeleton(hist.now), [hist.now])
  const topo = useMemo(() => topologyKey(sk.graph), [sk])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const an = useMemo(() => analyze(sk.graph, index), [topo, index])
  const name = an.name ?? (bgName && bgName.code === an.code ? bgName.name : null)

  useEffect(() => {
    if (an.empty || an.name || an.issues.length) return
    let live = true
    const code = an.code
    nameInBackground(sk.graph).then((n) => { if (live) { rememberName(code, n); setBgName({ code, name: n }) } }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [an])

  // 3D: молекула реестра → точные координаты RDKit; иначе встраиватель движка в фоне
  const regMol = an.match?.exact ? molecules[an.match.id] : undefined
  useEffect(() => {
    if (an.empty || regMol || an.issues.length || an.fragments > 1) return
    let live = true
    const key = an.code
    const timer = setTimeout(() => {
      embedInBackground(sk.graph).then((d) => { if (live) setEmb({ key, data: d }) }).catch(() => {})
    }, 60)
    return () => { live = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [an, regMol])
  const view3d = regMol ? { atoms: regMol.atoms, bonds: regMol.bonds } : emb && emb.key === an.code && !an.empty ? emb.data : null

  const hById = useMemo(() => new Map(sk.ids.map((id, i) => [id, an.hCount[i] ?? 0])), [sk, an])
  const issueById = useMemo(() => new Map(an.issues.map((x) => [sk.ids[x.atom], lang === 'ru' ? x.messageRu : lang === 'en' ? x.messageEn : x.messageUz])), [an, sk, lang])
  const degById = useMemo(() => (showDeg ? new Map(sk.ids.map((id, i) => [id, an.degrees[i] ?? -1])) : null), [showDeg, sk, an])

  // ── задания ──
  // задание сравниваем по содержимому: оболочка может передавать новый объект при каждой отрисовке
  const taskKey = JSON.stringify(task)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => (task.kind === 'build' && molecules[task.targetId] ? makeTarget(molecules[task.targetId]) : null), [taskKey, molecules])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const iso = useMemo(() => (task.kind === 'isomers' ? isomerSet(task.formula, task.expected, molecules) : null), [taskKey, molecules])
  const isoNames = useMemo(() => new Map([...(iso?.main ?? []), ...(iso?.inter ?? [])].map((e) => [e.constitution, entryName(e, lang)])), [iso, lang])

  useEffect(() => { setIsoFound([]); setIsoMsg(null); setBuildMsg(null); setShowFormula(false); solvedRef.current = null }, [taskKey])

  const verdict = target ? judgeBuild(an, target) : null
  useEffect(() => {
    if (!target || verdict?.kind !== 'solved') return
    if (solvedRef.current === target.id) return
    solvedRef.current = target.id
    onSolved?.({ canonical: an.code, matchId: target.id, nameRu: target.name.ru })
  }, [verdict?.kind, target, an.code, onSolved])

  const checkBuild = () => {
    if (!verdict || !target) return
    if (verdict.kind === 'empty') setBuildMsg(t.emptyCanvas)
    else if (verdict.kind === 'hint') setBuildMsg(hintText(lang, verdict.key, verdict.args))
    else setBuildMsg(null)
  }
  useEffect(() => { setBuildMsg(null) }, [topo])

  const addIsomer = () => {
    if (!iso) return
    const v = judgeIsomer(an, iso, isoFound)
    if (v.kind === 'new') {
      const next = [...isoFound, v.entry.constitution]
      setIsoFound(next)
      setIsoMsg({ text: fmt(t.newIsomer, { name: isoNames.get(v.entry.constitution) ?? '' }), tone: 'ok' })
      commit(EMPTY)
      setFitKey((k) => k + 1)
      const mainDone = iso.main.every((e) => next.includes(e.constitution))
      if (mainDone && solvedRef.current !== 'isomers') { solvedRef.current = 'isomers'; onSolved?.({ canonical: v.entry.constitution, nameRu: entryName(v.entry, 'ru') }) }
    } else if (v.kind === 'duplicate') setIsoMsg({ text: fmt(t.duplicate, { name: (isoNames.get(v.of) ?? '').toLowerCase() }), tone: 'warn' })
    else if (v.kind === 'wrongFormula') setIsoMsg({ text: fmt(t.wrongFormula, v), tone: 'bad' })
    else if (v.kind === 'notInList') setIsoMsg({ text: t.notInList, tone: 'bad' })
    else setIsoMsg({ text: an.empty ? t.emptyCanvas : t.invalidIsomer, tone: 'bad' })
  }

  // ── действия панели ──
  const tidy = () => { commit(tidyLayout(hist.now, an.match ? molecules[an.match.id] : null)); setFitKey((k) => k + 1) }
  const clear = () => { commit(EMPTY); setFitKey((k) => k + 1); setFocus(null) }

  // ── клавиатура ──
  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const k = e.key
    if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z' || k === 'я' || k === 'Я')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y' || k === 'н' || k === 'Н')) { e.preventDefault(); redo(); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const elKey: Record<string, string> = { c: 'C', o: 'O', n: 'N', s: 'S', с: 'C', о: 'O' }
    const el = elKey[k.toLowerCase()]
    if (el) {
      e.preventDefault()
      setTool({ kind: 'draw', el })
      if (focus?.kind === 'atom') commit(setElement(hist.now, focus.id, el))
      return
    }
    if ((k === '1' || k === '2' || k === '3') && focus?.kind === 'bond' && bondById(hist.now, focus.id)) {
      e.preventDefault(); commit(setBondOrder(hist.now, focus.id, +k as 1 | 2 | 3)); return
    }
    if ((k === 'Delete' || k === 'Backspace') && focus) {
      e.preventDefault()
      commit(focus.kind === 'atom' ? removeAtom(hist.now, focus.id) : removeBond(hist.now, focus.id))
      setFocus(null)
    }
  }

  const toolBtn = (active: boolean, label: string, onClick: () => void, content: React.ReactNode, extra?: string) => (
    <button type="button" className={`${styles.btn} ${active ? styles.btnOn : ''} ${extra ?? ''}`} aria-pressed={active} aria-label={label} title={label} onClick={onClick}>{content}</button>
  )

  // при ошибке валентности название/формула не показываются — они были бы неверными
  const bad = an.issues.length > 0 || an.fragments > 1
  const nameText = an.empty || bad ? '' : name ? name[lang] : t.naming
  const synonyms = name ? (lang === 'ru' ? name.synonymsRu : lang === 'en' ? name.synonymsEn : name.synonymsUz).filter((x) => x !== name[lang] && !/^н-|^n-/.test(x)).slice(0, 2) : []
  const introSteps = [t.intro1, t.intro2, t.intro3]

  return (
    <div ref={rootRef} className={`${styles.root} ${className ?? ''}`} data-ov2-constructor="" data-task={task.kind} onKeyDown={onKey} tabIndex={-1}>
      {/* ── задание ── */}
      {task.kind === 'build' && target && (
        <section className={`${styles.task} ${verdict?.kind === 'solved' ? styles.taskSolved : ''}`} aria-live="polite" data-solved={verdict?.kind === 'solved' ? '1' : '0'}>
          <div className={styles.taskHead}>
            <span className={styles.taskKicker}>{t.taskBuild}</span>
            <strong className={styles.taskTitle}>{target.name[lang]}</strong>
          </div>
          {verdict?.kind === 'solved' ? (
            <p className={styles.okLine}>✓ {t.solved} {target.name[lang]} ({target.formula})</p>
          ) : (
            <div className={styles.taskRow}>
              <button type="button" className={styles.ghostBtn} onClick={() => setShowFormula((v) => !v)} aria-expanded={showFormula}>{t.hintFormula}</button>
              {showFormula && <span className={styles.hintFormula}>{target.formula} · {target.semi}</span>}
              <button type="button" className={styles.primaryBtn} onClick={checkBuild}>{t.check}</button>
            </div>
          )}
          {buildMsg && verdict?.kind !== 'solved' && <p className={styles.warnLine}><b>{t.nextHint}</b> {buildMsg}</p>}
        </section>
      )}
      {task.kind === 'isomers' && iso && (
        <section className={`${styles.task} ${iso.main.every((e) => isoFound.includes(e.constitution)) ? styles.taskSolved : ''}`} aria-live="polite">
          <div className={styles.taskHead}>
            <span className={styles.taskKicker}>{t.taskIsomers}</span>
            <strong className={styles.taskTitle}>{iso.formula}</strong>
            <span className={styles.counter} data-found={isoFound.filter((c) => iso.main.some((e) => e.constitution === c)).length} data-total={iso.main.length}>
              {t.found}: {isoFound.filter((c) => iso.main.some((e) => e.constitution === c)).length}/{iso.main.length}
            </span>
          </div>
          <ol className={styles.isoList}>
            {iso.main.map((e, i) => {
              const got = isoFound.includes(e.constitution)
              return <li key={e.constitution} className={got ? styles.isoGot : styles.isoMiss}>{got ? isoNames.get(e.constitution) : `${i + 1}. ?`}</li>
            })}
          </ol>
          {iso.inter.length > 0 && (
            <>
              <div className={styles.subHead}>{t.interclass}: {isoFound.filter((c) => iso.inter.some((e) => e.constitution === c)).length}/{iso.inter.length}</div>
              <ol className={styles.isoList}>
                {iso.inter.map((e, i) => {
                  const got = isoFound.includes(e.constitution)
                  return <li key={e.constitution} className={got ? styles.isoGot : styles.isoMiss}>{got ? isoNames.get(e.constitution) : `${i + 1}. ?`}</li>
                })}
              </ol>
            </>
          )}
          <div className={styles.taskRow}>
            <button type="button" className={styles.primaryBtn} onClick={addIsomer}>{t.addIsomer}</button>
            {isoMsg && <span className={`${styles.isoMsg} ${styles['tone_' + isoMsg.tone]}`} role="status">{isoMsg.text}</span>}
          </div>
          {iso.main.every((e) => isoFound.includes(e.constitution)) && <p className={styles.okLine}>✓ {t.allFound}</p>}
        </section>
      )}
      {task.kind === 'free' && <p className={styles.freeHint}>{t.freeHint}</p>}

      <div className={styles.layout}>
        <div className={styles.editor}>
          {/* ── инструменты ── */}
          <div className={styles.toolbar} role="toolbar" aria-label={t.title}>
            <div className={styles.toolRow}>
              {toolBtn(tool.kind === 'draw', t.toolDraw, () => setTool({ kind: 'draw', el: tool.kind === 'draw' ? tool.el : 'C' }), <Icon d={IC.draw} />)}
              {toolBtn(tool.kind === 'move', t.toolMove, () => setTool({ kind: 'move' }), <Icon d={IC.move} />)}
              {toolBtn(tool.kind === 'erase', t.toolErase, () => setTool({ kind: 'erase' }), <Icon d={IC.erase} />)}
              <span className={styles.sep} />
              {toolBtn(false, t.undo, undo, <Icon d={IC.undo} />, hist.past.length ? '' : styles.btnDim)}
              {toolBtn(false, t.redo, redo, <Icon d={IC.redo} />, hist.future.length ? '' : styles.btnDim)}
              {toolBtn(false, t.tidy, tidy, <><Icon d={IC.tidy} /><span className={styles.btnText}>{t.tidy}</span></>, styles.btnWide)}
              {toolBtn(false, t.clear, clear, <Icon d={IC.clear} />)}
              {toolBtn(showDeg, t.degrees, () => setShowDeg((v) => !v), <span className={styles.btnText}>I–IV</span>, styles.btnWide)}
            </div>
            <div className={styles.toolRow} aria-label={t.elements}>
              {PALETTE_ELEMENTS.map((el) => toolBtn(tool.kind === 'draw' && tool.el === el, `${t.elements} ${el}`, () => setTool({ kind: 'draw', el }), <span className={`${styles.elChip} ${styles['el' + el] ?? ''}`}>{el}</span>))}
            </div>
            <div className={styles.toolRow} aria-label={t.groups}>
              {GROUP_KEYS.map((g: GroupKey) => toolBtn(tool.kind === 'group' && tool.key === g, GROUP_TITLE[lang][g], () => setTool({ kind: 'group', key: g }), <span className={styles.groupChip}>{g === 'benzene' ? <BenzeneGlyph /> : GROUP_LABEL[g]}</span>, styles.btnWide))}
            </div>
          </div>
          <div className={styles.canvasWrap}>
            <EditorCanvas
              state={state}
              tool={tool}
              hById={hById}
              issues={issueById}
              degrees={degById}
              focus={focus}
              fitKey={fitKey}
              label={t.canvasLabel}
              emptyText={t.emptyCanvas}
              onCommit={commit}
              onPreview={setPreview}
              onFocus={setFocus}
            />
            {intro >= 0 && (
              <div className={styles.intro} role="dialog" aria-label={t.title}>
                <div className={styles.introStep}>{t.introStep} {intro + 1}/3</div>
                <p>{introSteps[intro]}</p>
                <div className={styles.introDots}>{introSteps.map((_, i) => <span key={i} className={i === intro ? styles.dotOn : styles.dot} />)}</div>
                <button type="button" className={styles.primaryBtn} onClick={() => { if (intro < 2) setIntro(intro + 1); else { setIntro(-1); writeIntroSeen() } }}>
                  {intro < 2 ? t.introNext : t.introDone}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── живая панель ── */}
        <aside className={styles.panel} aria-live="polite">
          <div className={styles.nameCard} data-name={bad ? '' : name?.ru ?? ''}>
            <div className={styles.cardLabel}>{t.name}</div>
            <div className={styles.nameText}>{an.empty || bad ? '—' : nameText || t.noName}</div>
            {synonyms.length > 0 && !bad && <div className={styles.synonyms}>{t.trivial}: {synonyms.join(', ')}</div>}
            {an.fragments > 1 && <div className={styles.warnLine}>{t.fragments}</div>}
            {an.issues.length > 0 && (
              <ul className={styles.issues} aria-label={t.valenceTitle}>
                {an.issues.map((x) => <li key={x.atom}>⚠ {lang === 'ru' ? x.messageRu : lang === 'en' ? x.messageEn : x.messageUz}</li>)}
              </ul>
            )}
          </div>
          <dl className={styles.facts}>
            <div><dt>{t.formula}</dt><dd className={styles.mono} data-formula={bad ? '' : an.formula}>{bad ? '—' : an.formulaPretty || '—'}</dd></div>
            <div><dt>{t.cls}</dt><dd>{an.empty || bad ? '—' : an.classLabel[lang]}</dd></div>
            <div className={styles.factWide}><dt>{t.semi}</dt><dd className={styles.mono}>{bad ? '—' : an.semi || '—'}</dd></div>
          </dl>
          <div className={styles.view3d} data-app-night="">
            <div className={styles.view3dHead}>
              <span>{t.view3d}</span>
              {view3d && <span className={styles.badge}>{regMol ? t.exact3d : t.approx3d}</span>}
            </div>
            <div className={styles.view3dBody}>
              {view3d ? <Preview3D atoms={view3d.atoms} bonds={view3d.bonds} label={`${t.view3d}: ${nameText}`} /> : <div className={styles.view3dEmpty}>{an.empty ? t.emptyCanvas : an.issues.length ? t.valenceTitle : an.fragments > 1 ? t.fragments : '…'}</div>}
            </div>
            {view3d && <div className={styles.view3dFoot}>{t.drag3d}</div>}
          </div>
        </aside>
      </div>
    </div>
  )
}

function BenzeneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M12 6.2l5 2.9M17 15l-5 2.9M7 15V9" />
    </svg>
  )
}
