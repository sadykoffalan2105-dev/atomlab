import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ORGANIC_BUILD_CHALLENGES,
  ORGANIC_CLASS_LABELS,
  challengeBuildStage,
  type OrganicBuildChallenge,
  type OrganicClassId,
} from '../../../data/researchLab/organicBuildCatalog'
import {
  addBond,
  applySkeletonBonds,
  autoBondKitHydrogens,
  canBond,
  compositionOf,
  compositionsEqual,
  createFormulaKit,
  formulaUnicode,
  freeValence,
  isValenceOk,
  matchesSkeletonSpec,
  removeBondBetween,
  setBondOrder,
  type OrganicGraph,
  valenceErrors,
} from '../../../chemistry/organic/organicGraph'
import {
  anglesOk,
  hybridizationOf,
  layoutOrganicGraph,
  planarRingAngleDeg,
  rotateNeighborAround,
  scoreBondAngles,
  snapAnglesHint,
  targetAngleDeg,
  targetAngleForTriple,
} from '../../../chemistry/organic/organicLayout'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from './OrganicBuilderCanvas.module.css'
import { OrganicBuilderCanvas } from './OrganicBuilderCanvas'
import { ResearchEquationBuilder } from './ResearchEquationBuilder'
import { ResearchEquilibriumMode } from './ResearchEquilibriumMode'

type LabTool = 'build' | 'attack' | 'equation' | 'equilibrium'

function pickTitle(c: OrganicBuildChallenge, locale: string) {
  if (locale === 'en') return c.titleEn
  if (locale === 'uz') return c.titleUz
  return c.titleRu
}

function pickHint(c: OrganicBuildChallenge, locale: string) {
  if (locale === 'en') return c.hintEn
  if (locale === 'uz') return c.hintUz
  return c.hintRu
}

function pickSuccess(c: OrganicBuildChallenge, locale: string) {
  if (locale === 'en') return c.successEn
  if (locale === 'uz') return c.successUz
  return c.successRu
}

function pickEq(c: OrganicBuildChallenge, locale: string) {
  if (locale === 'en') return c.equationEn
  if (locale === 'uz') return c.equationUz
  return c.equationRu
}

function pickClass(id: OrganicClassId, locale: string) {
  const L = ORGANIC_CLASS_LABELS[id]
  if (locale === 'en') return L.en
  if (locale === 'uz') return L.uz
  return L.ru
}

function kitTotal(kit: OrganicBuildChallenge['kit']): number {
  return Object.values(kit).reduce((s, n) => s + (n ?? 0), 0)
}

function expectedComposition(kit: OrganicBuildChallenge['kit']): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(kit)) {
    if (v && v > 0) out[k] = v
  }
  return out
}

function startKit(challenge: OrganicBuildChallenge): OrganicGraph {
  return createFormulaKit(challenge.kit)
}

/** Без каркаса (адамантан и т.п.) — только цепи, кольца, функциональные классы. */
const STUDIO_CHALLENGES = ORGANIC_BUILD_CHALLENGES.filter((c) => challengeBuildStage(c) !== 'cage')

const CLASS_ORDER: OrganicClassId[] = [
  'alkane',
  'cycloalkane',
  'alkene',
  'alkyne',
  'arene',
  'alcohol',
  'aldehyde',
  'ketone',
  'acid',
  'ester',
  'halo',
  'nitrogen',
]

export function ResearchBuilderMode({
  onMacro,
  initialChallengeId,
}: {
  onSpectrum?: (peaks: OrganicBuildChallenge['irPeaks'], label: string) => void
  onMacro: (text: string) => void
  initialChallengeId?: string
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const initial =
    STUDIO_CHALLENGES.find((c) => c.id === initialChallengeId) ??
    STUDIO_CHALLENGES.find((c) => c.id === 'methane') ??
    STUDIO_CHALLENGES[0]!

  const [classFilter, setClassFilter] = useState<OrganicClassId | 'all'>(initial.classId)
  const [challengeId, setChallengeId] = useState(initial.id)
  const [graph, setGraph] = useState<OrganicGraph>(() => startKit(initial))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bondFrom, setBondFrom] = useState<string | null>(null)
  const [bondOrder, setBondOrderUi] = useState<1 | 2 | 3>(1)
  const [checked, setChecked] = useState(false)
  const [angleNeighbor, setAngleNeighbor] = useState<string | null>(null)
  const [labTool, setLabTool] = useState<LabTool>('build')
  const attackMode = labTool === 'attack'
  const [attackDeg, setAttackDeg] = useState(180)
  const [attackDelta, setAttackDelta] = useState(0)
  const [attackInZone, setAttackInZone] = useState(true)
  const [attackResult, setAttackResult] = useState<'idle' | 'ok' | 'bad'>('idle')
  const attackRef = useRef({ inZone: true })
  const [showCoach, setShowCoach] = useState(() => {
    try {
      return localStorage.getItem('atomlab-research-coach') !== 'off'
    } catch {
      return true
    }
  })
  const [feedback, setFeedback] = useState('')

  const say = (text: string) => {
    setFeedback(text)
    onMacro(text)
  }

  const dismissCoach = () => {
    setShowCoach(false)
    try {
      localStorage.setItem('atomlab-research-coach', 'off')
    } catch {
      /* ignore */
    }
  }

  const openCoach = () => {
    setShowCoach(true)
    try {
      localStorage.removeItem('atomlab-research-coach')
    } catch {
      /* ignore */
    }
  }

  const challenge = useMemo(
    () => STUDIO_CHALLENGES.find((c) => c.id === challengeId) ?? STUDIO_CHALLENGES[0]!,
    [challengeId],
  )

  const filtered = useMemo(() => {
    if (classFilter === 'all') return STUDIO_CHALLENGES
    return STUDIO_CHALLENGES.filter((c) => c.classId === classFilter)
  }, [classFilter])

  useEffect(() => {
    say(
      t('learn.research.builderKitReady', {
        n: kitTotal(challenge.kit),
        f: challenge.formula,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id])

  const switchChallenge = (id: string) => {
    const next = STUDIO_CHALLENGES.find((c) => c.id === id)
    if (!next) return
    setChallengeId(id)
    setGraph(startKit(next))
    setSelectedId(null)
    setBondFrom(null)
    setChecked(false)
    setAngleNeighbor(null)
    setLabTool('build')
    setAttackResult('idle')
    setClassFilter(next.classId)
    say(t('learn.research.builderKitReady', { n: kitTotal(next.kit), f: next.formula }))
  }

  const resetKit = () => {
    setGraph(startKit(challenge))
    setSelectedId(null)
    setBondFrom(null)
    setChecked(false)
    setAngleNeighbor(null)
    say(t('learn.research.builderKitReady', { n: kitTotal(challenge.kit), f: challenge.formula }))
  }

  const handleSelect = (id: string | null) => {
    if (attackMode) return
    setAngleNeighbor(null)
    if (bondFrom && id && id !== bondFrom) {
      if (canBond(graph, bondFrom, id, bondOrder)) {
        const bonded = addBond(graph, bondFrom, id, bondOrder)
        if (bonded) setGraph(layoutOrganicGraph(bonded))
      }
      setBondFrom(null)
      setSelectedId(id)
      setChecked(false)
      return
    }
    setSelectedId(id)
  }

  const startBond = () => {
    if (!selectedId || attackMode) return
    setBondFrom(selectedId)
  }

  const doAutoH = () => {
    setGraph((g) => layoutOrganicGraph(autoBondKitHydrogens(g)))
    setChecked(false)
  }

  const doSnap = () => {
    setGraph((g) => snapAnglesHint(g))
    setChecked(false)
  }

  const doBuildSkeleton = () => {
    setGraph((g) => layoutOrganicGraph(applySkeletonBonds(g, challenge.skeleton)))
    setBondFrom(null)
    setChecked(false)
  }

  const selectedAtom = graph.atoms.find((a) => a.id === selectedId) ?? null
  const neighborsOfSelected = useMemo(() => {
    if (!selectedId) return [] as string[]
    return graph.bonds
      .filter((b) => b.a === selectedId || b.b === selectedId)
      .map((b) => (b.a === selectedId ? b.b : b.a))
  }, [graph.bonds, selectedId])

  const rotateSel = (deg: number) => {
    if (!selectedId || !angleNeighbor) return
    setGraph((g) => rotateNeighborAround(g, selectedId, angleNeighbor, deg))
    setChecked(false)
  }

  const breakBond = () => {
    if (!selectedId || !angleNeighbor) return
    setGraph((g) => removeBondBetween(g, selectedId, angleNeighbor))
    setAngleNeighbor(null)
    setChecked(false)
  }

  const raiseBondOrder = () => {
    if (!selectedId || !angleNeighbor) return
    const bond = graph.bonds.find(
      (b) =>
        (b.a === selectedId && b.b === angleNeighbor) ||
        (b.b === selectedId && b.a === angleNeighbor),
    )
    if (!bond) return
    const next = (bond.order === 3 ? 1 : ((bond.order + 1) as 1 | 2 | 3))
    const updated = setBondOrder(graph, selectedId, angleNeighbor, next)
    if (updated) {
      setGraph(updated)
      setBondOrderUi(next)
      setChecked(false)
    }
  }

  const skeletonOk = matchesSkeletonSpec(graph, challenge.skeleton)
  const valenceOkPartial = valenceErrors(graph).length === 0
  const valenceFull = isValenceOk(graph)
  const formulaOk = compositionsEqual(compositionOf(graph), expectedComposition(challenge.kit))
  const angleScores = useMemo(() => scoreBondAngles(graph), [graph])
  const avgDelta =
    angleScores.length === 0
      ? null
      : angleScores.reduce((s, a) => s + a.delta, 0) / angleScores.length
  const angleStatus =
    angleScores.length === 0 ? 'idle' : anglesOk(graph) ? 'ok' : (avgDelta ?? 99) <= 18 ? 'close' : 'bad'
  const hyb = selectedAtom ? hybridizationOf(graph, selectedAtom.id) : null
  const angleHintDeg =
    selectedAtom && angleNeighbor
      ? Math.round(
          targetAngleForTriple(
            graph,
            selectedAtom.id,
            angleNeighbor,
            neighborsOfSelected.find((id) => id !== angleNeighbor) ?? angleNeighbor,
          ),
        )
      : hyb && hyb !== 'terminal'
        ? targetAngleDeg(hyb)
        : null

  const ringHint =
    challenge.classId === 'cycloalkane' && challenge.kit.C && challenge.kit.C <= 6
      ? Math.round(challenge.kit.C === 6 ? 109.5 : planarRingAngleDeg(challenge.kit.C))
      : null

  const complete = skeletonOk && valenceFull && anglesOk(graph) && formulaOk
  const coachStep = !skeletonOk ? 1 : !valenceFull ? 2 : angleStatus === 'bad' ? 3 : !complete ? 4 : 5

  const kitEntries = (
    [
      ['C', challenge.kit.C],
      ['H', challenge.kit.H],
      ['O', challenge.kit.O],
      ['N', challenge.kit.N],
      ['Cl', challenge.kit.Cl],
    ] as const
  ).filter(([, n]) => n && n > 0)

  const runCheck = () => {
    setChecked(true)
    if (complete) {
      say(pickSuccess(challenge, locale))
      setLabTool('equation')
    } else {
      const parts: string[] = []
      if (!skeletonOk) parts.push(t('learn.research.builderFailSkeleton'))
      if (!valenceFull) parts.push(t('learn.research.builderFailValence'))
      if (!anglesOk(graph)) parts.push(t('learn.research.builderFailAngles'))
      if (!formulaOk) parts.push(t('learn.research.builderFailFormula'))
      say(parts.join(' '))
    }
  }

  const toolBtn = (id: LabTool, label: string) => (
    <button
      key={id}
      type="button"
      className={`${styles.dockBtn} ${labTool === id ? styles.dockBtnActive : ''}`}
      onClick={() => {
        setLabTool(id)
        if (id !== 'attack') setAttackResult('idle')
        if (id === 'attack') setBondFrom(null)
      }}
    >
      {label}
    </button>
  )

  return (
    <div className={styles.studio}>
      <div className={styles.dock} role="tablist" aria-label={t('learn.research.labDockAria')}>
        {toolBtn('build', t('learn.research.labToolBuild'))}
        {toolBtn('attack', t('learn.research.labToolAttack'))}
        {toolBtn('equation', t('learn.research.labToolEquation'))}
        {toolBtn('equilibrium', t('learn.research.labToolEq'))}
      </div>

      <div className={styles.missionRow}>
        <button
          type="button"
          className={`${styles.missionChip} ${classFilter === 'all' ? styles.missionChipActive : ''}`}
          onClick={() => setClassFilter('all')}
        >
          {t('learn.research.builderAllClasses')} · {STUDIO_CHALLENGES.length}
        </button>
        {CLASS_ORDER.map((cid) => (
          <button
            key={cid}
            type="button"
            className={`${styles.missionChip} ${classFilter === cid ? styles.missionChipActive : ''}`}
            onClick={() => setClassFilter(cid)}
          >
            {pickClass(cid, locale)}
          </button>
        ))}
      </div>

      <div className={styles.missionRow}>
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${styles.missionChip} ${challengeId === c.id ? styles.missionChipActive : ''}`}
            onClick={() => switchChallenge(c.id)}
            title={pickTitle(c, locale)}
          >
            {c.formula}
          </button>
        ))}
      </div>

      <div className={styles.titleLine}>
        <strong>{pickTitle(challenge, locale)}</strong>
        <span className={styles.hintLine}>
          {pickClass(challenge.classId, locale)} ·{' '}
          {t('learn.research.builderAtomCount', {
            n: graph.atoms.length,
            target: kitTotal(challenge.kit),
          })}{' '}
          · {t('learn.research.builderBondCount', { n: graph.bonds.length })}
        </span>
      </div>
      <p className={styles.hintLine}>{pickHint(challenge, locale)}</p>
      {ringHint != null ? (
        <p className={styles.hintLine}>
          {t('learn.research.coachRingAngle', { n: ringHint, formula: challenge.formula })}
        </p>
      ) : null}

      {showCoach ? (
        <div className={styles.coach} role="note">
          <div className={styles.coachHead}>
            <strong>{t('learn.research.coachTitle')}</strong>
            <button type="button" className={styles.tool} onClick={dismissCoach}>
              {t('learn.research.coachHide')}
            </button>
          </div>
          <ol className={styles.coachList}>
            <li className={coachStep === 1 ? styles.coachActive : coachStep > 1 ? styles.coachDone : ''}>
              {t('learn.research.coachStep1')}
            </li>
            <li className={coachStep === 2 ? styles.coachActive : coachStep > 2 ? styles.coachDone : ''}>
              {t('learn.research.coachStep2')}
            </li>
            <li className={coachStep === 3 ? styles.coachActive : coachStep > 3 ? styles.coachDone : ''}>
              {t('learn.research.coachStep3')}
            </li>
            <li className={coachStep === 4 ? styles.coachActive : coachStep > 4 ? styles.coachDone : ''}>
              {t('learn.research.coachStep4')}
            </li>
            <li className={coachStep === 5 ? styles.coachActive : ''}>{t('learn.research.coachStep5')}</li>
          </ol>
          <p className={styles.hintLine}>{t('learn.research.coachHow')}</p>
        </div>
      ) : (
        <button type="button" className={styles.tool} onClick={openCoach}>
          {t('learn.research.coachShow')}
        </button>
      )}

      {feedback ? <p className={styles.feedback}>{feedback}</p> : null}

      {(labTool === 'build' || labTool === 'attack') && (
        <OrganicBuilderCanvas
          graph={graph}
          selectedId={selectedId}
          bondFromId={bondFrom}
          onSelectAtom={handleSelect}
          attackMode={attackMode}
          keepMoleculeWithAttack
          onAttackAngle={(d, del, ok) => {
            attackRef.current = { inZone: ok }
            const rd = Math.round(d)
            const rdel = Math.round(del)
            setAttackDeg((p) => (p === rd ? p : rd))
            setAttackDelta((p) => (p === rdel ? p : rdel))
            setAttackInZone((p) => (p === ok ? p : ok))
          }}
        >
          <div className={styles.hudTop}>
            <div className={styles.formulaPanel}>
              {attackMode ? (
                <>
                  <span className={styles.formulaLive}>
                    {t('learn.research.attackAngleLive', { n: attackDeg })}
                  </span>
                  <span className={attackInZone ? styles.statusOk : styles.hintLine}>
                    {t('learn.research.attackDeltaLive', { n: attackDelta })}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.formulaTarget}>{challenge.formula}</span>
                  <span className={styles.formulaLive}>
                    {t('learn.research.builderFormulaNow', { f: formulaUnicode(graph) })}
                  </span>
                  <div className={styles.kitCounts}>
                    {kitEntries.map(([el, n]) => (
                      <span
                        key={el}
                        className={`${styles.kitPill} ${
                          el === 'C' ? styles.kitPillC : el === 'H' ? styles.kitPillH : styles.kitPillO
                        }`}
                      >
                        {el}×{n}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            {!attackMode ? (
              <div className={styles.checks}>
                <span className={`${styles.check} ${valenceOkPartial ? styles.checkOn : ''}`}>
                  {t('learn.research.builderCheckValence')}
                </span>
                <span className={`${styles.check} ${skeletonOk ? styles.checkOn : ''}`}>
                  {t('learn.research.builderCheckSkeleton')}
                </span>
                <span className={`${styles.check} ${angleStatus === 'ok' ? styles.checkOn : ''}`}>
                  {t('learn.research.builderCheckAngles')}
                </span>
                <span className={`${styles.check} ${formulaOk ? styles.checkOn : ''}`}>
                  {t('learn.research.builderCheckFormula')}
                </span>
              </div>
            ) : null}
          </div>

          <div className={styles.hudBottom}>
            {attackMode ? (
              <div className={styles.toolbar}>
                <span className={styles.hintLine}>{t('learn.research.studioSn2Lead3d')}</span>
                <button
                  type="button"
                  className={`${styles.tool} ${styles.toolPrimary}`}
                  onClick={() => {
                    const ok = attackRef.current.inZone
                    setAttackResult(ok ? 'ok' : 'bad')
                    say(ok ? t('learn.research.attackOkMacro') : t('learn.research.attackBadMacro'))
                  }}
                >
                  {t('learn.research.attackCheck')}
                </button>
                {attackResult === 'ok' ? (
                  <span className={styles.statusOk}>{t('learn.research.attackOk')}</span>
                ) : null}
                {attackResult === 'bad' ? (
                  <span className={styles.statusBad}>{t('learn.research.attackBad')}</span>
                ) : null}
              </div>
            ) : (
              <>
                {selectedAtom ? (
                  <div className={styles.inspect}>
                    <span>
                      <strong>{selectedAtom.element}</strong>
                      {angleHintDeg != null
                        ? ` · ${hyb && hyb !== 'terminal' ? `${hyb} · ` : ''}${angleHintDeg}°`
                        : ''}
                      {' · '}
                      {t('learn.research.builderFreeValence', {
                        n: freeValence(graph, selectedAtom.id),
                      })}
                    </span>
                    {neighborsOfSelected.length > 0 ? (
                      <>
                        <select
                          value={angleNeighbor ?? ''}
                          onChange={(e) => setAngleNeighbor(e.target.value || null)}
                          aria-label={t('learn.research.builderAngleArm')}
                        >
                          <option value="">{t('learn.research.builderPickNeighbor')}</option>
                          {neighborsOfSelected.map((id) => {
                            const a = graph.atoms.find((x) => x.id === id)
                            return (
                              <option key={id} value={id}>
                                {a?.element ?? id}
                              </option>
                            )
                          })}
                        </select>
                        <button type="button" className={styles.tool} disabled={!angleNeighbor} onClick={() => rotateSel(-5)}>
                          −5°
                        </button>
                        <button type="button" className={styles.tool} disabled={!angleNeighbor} onClick={() => rotateSel(5)}>
                          +5°
                        </button>
                        <button type="button" className={styles.tool} disabled={!angleNeighbor} onClick={raiseBondOrder}>
                          {t('learn.research.builderBondOrder')}
                        </button>
                        <button type="button" className={styles.tool} disabled={!angleNeighbor} onClick={breakBond}>
                          {t('learn.research.builderBreakBond')}
                        </button>
                      </>
                    ) : (
                      <span>{t('learn.research.builderClickBond')}</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.inspect}>{t('learn.research.builderClickBond')}</div>
                )}

                <div className={styles.toolbar}>
                  <button
                    type="button"
                    className={`${styles.tool} ${coachStep === 1 ? styles.toolPrimary : ''}`}
                    onClick={doBuildSkeleton}
                    title={t('learn.research.builderSkeletonHint')}
                  >
                    {t('learn.research.builderSkeleton')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.tool} ${bondFrom ? styles.toolActive : styles.toolPrimary}`}
                    onClick={startBond}
                    disabled={!selectedId}
                  >
                    {bondFrom ? t('learn.research.builderBondPick') : t('learn.research.builderBond')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.tool} ${bondOrder > 1 ? styles.toolActive : ''}`}
                    onClick={() => setBondOrderUi((o) => (o === 1 ? 2 : o === 2 ? 3 : 1))}
                    title={t('learn.research.builderBondOrderHint')}
                  >
                    {bondOrder === 1 ? '—' : bondOrder === 2 ? '=' : '≡'} ×{bondOrder}
                  </button>
                  <button type="button" className={`${styles.tool} ${coachStep === 2 ? styles.toolPrimary : ''}`} onClick={doAutoH}>
                    {t('learn.research.builderAutoH')}
                  </button>
                  <button type="button" className={`${styles.tool} ${coachStep === 3 ? styles.toolPrimary : ''}`} onClick={doSnap}>
                    {t('learn.research.builderSnap')}
                  </button>
                  <button type="button" className={styles.tool} onClick={resetKit}>
                    {t('learn.research.builderResetKit')}
                  </button>
                  <button type="button" className={`${styles.tool} ${styles.toolPrimary}`} onClick={runCheck}>
                    {t('learn.research.builderCheck')}
                  </button>
                  {checked ? (
                    complete ? (
                      <span className={styles.statusOk}>{t('learn.research.builderOk')}</span>
                    ) : (
                      <span className={styles.statusBad}>{t('learn.research.builderBad')}</span>
                    )
                  ) : null}
                </div>
              </>
            )}
          </div>
        </OrganicBuilderCanvas>
      )}

      {labTool === 'equation' ? (
        <section className={styles.eqBelow} aria-labelledby="studio-eq-title">
          <h3 className={styles.eqBelowTitle} id="studio-eq-title">
            {t('learn.research.studioEquation')}
          </h3>
          <p className={styles.hintLine}>
            {t('learn.research.studioEquationLinked')}{' '}
            <span className={styles.formulaInline}>{pickEq(challenge, locale)}</span>
          </p>
          <ResearchEquationBuilder
            onMacro={say}
            compact
            preferFormula={challenge.formula}
          />
        </section>
      ) : null}

      {labTool === 'equilibrium' ? (
        <section className={styles.eqBelow}>
          <h3 className={styles.eqBelowTitle}>{t('learn.research.labToolEq')}</h3>
          <ResearchEquilibriumMode onMacro={say} />
        </section>
      ) : null}
    </div>
  )
}
