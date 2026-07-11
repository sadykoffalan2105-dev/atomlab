import { useEffect, useMemo, useState } from 'react'
import {
  ORGANIC_BUILD_CHALLENGES,
  ORGANIC_CLASS_LABELS,
  type OrganicBuildChallenge,
  type OrganicClassId,
} from '../../../data/researchLab/organicBuildCatalog'
import {
  addBond,
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
  rotateNeighborAround,
  scoreBondAngles,
  snapAnglesHint,
  targetAngleDeg,
} from '../../../chemistry/organic/organicLayout'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from './OrganicBuilderCanvas.module.css'
import { OrganicBuilderCanvas } from './OrganicBuilderCanvas'
import { ResearchAttackMode } from './ResearchAttackMode'
import { ResearchEquilibriumMode } from './ResearchEquilibriumMode'
import { ResearchDetectiveMode } from './ResearchDetectiveMode'

type StudioPanel = 'build' | 'sn2' | 'equilibrium' | 'detective' | 'equation'

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

const CLASS_ORDER: OrganicClassId[] = [
  'alkane',
  'cycloalkane',
  'alkene',
  'alkadiene',
  'alkyne',
  'arene',
  'alcohol',
  'polyol',
  'phenol',
  'ether',
  'aldehyde',
  'ketone',
  'acid',
  'ester',
  'carb',
  'halo',
  'nitrogen',
]

export function ResearchBuilderMode({
  onSpectrum,
  onMacro,
  initialChallengeId,
}: {
  onSpectrum: (peaks: OrganicBuildChallenge['irPeaks'], label: string) => void
  onMacro: (text: string) => void
  initialChallengeId?: string
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const initial =
    ORGANIC_BUILD_CHALLENGES.find((c) => c.id === initialChallengeId) ?? ORGANIC_BUILD_CHALLENGES[0]!

  const [classFilter, setClassFilter] = useState<OrganicClassId | 'all'>(initial.classId)
  const [challengeId, setChallengeId] = useState(initial.id)
  const [graph, setGraph] = useState<OrganicGraph>(() => startKit(initial))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bondFrom, setBondFrom] = useState<string | null>(null)
  const [bondOrder, setBondOrderUi] = useState<1 | 2 | 3>(1)
  const [checked, setChecked] = useState(false)
  const [angleNeighbor, setAngleNeighbor] = useState<string | null>(null)
  const [panel, setPanel] = useState<StudioPanel>('build')

  const challenge = useMemo(
    () => ORGANIC_BUILD_CHALLENGES.find((c) => c.id === challengeId) ?? ORGANIC_BUILD_CHALLENGES[0]!,
    [challengeId],
  )

  const filtered = useMemo(() => {
    if (classFilter === 'all') return ORGANIC_BUILD_CHALLENGES
    return ORGANIC_BUILD_CHALLENGES.filter((c) => c.classId === classFilter)
  }, [classFilter])

  useEffect(() => {
    onMacro(
      t('learn.research.builderKitReady', {
        n: kitTotal(challenge.kit),
        f: challenge.formula,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId])

  const angleScores = useMemo(() => scoreBondAngles(graph), [graph])
  const avgDelta =
    angleScores.length === 0
      ? 0
      : angleScores.reduce((s, a) => s + a.delta, 0) / angleScores.length
  const angleStatus =
    angleScores.length === 0 ? 'idle' : anglesOk(graph) ? 'ok' : avgDelta <= 18 ? 'close' : 'bad'

  const valenceOkPartial = valenceErrors(graph).length === 0
  const skeletonOk = matchesSkeletonSpec(graph, challenge.skeleton)
  const valenceFull = isValenceOk(graph)
  const formulaOk = compositionsEqual(compositionOf(graph), expectedComposition(challenge.kit))
  const complete = skeletonOk && valenceFull && anglesOk(graph) && formulaOk

  const neighborsOfSelected = useMemo(() => {
    if (!selectedId) return []
    return graph.bonds
      .filter((b) => b.a === selectedId || b.b === selectedId)
      .map((b) => (b.a === selectedId ? b.b : b.a))
  }, [graph, selectedId])

  const selectedAtom = selectedId ? graph.atoms.find((a) => a.id === selectedId) : null
  const hyb = selectedId ? hybridizationOf(graph, selectedId) : null

  const switchChallenge = (id: string) => {
    const next = ORGANIC_BUILD_CHALLENGES.find((c) => c.id === id) ?? ORGANIC_BUILD_CHALLENGES[0]!
    setChallengeId(id)
    setClassFilter(next.classId)
    setGraph(startKit(next))
    setSelectedId(null)
    setBondFrom(null)
    setAngleNeighbor(null)
    setChecked(false)
    setBondOrderUi(1)
    setPanel('build')
    onSpectrum([], '')
    onMacro(t('learn.research.builderKitReady', { n: kitTotal(next.kit), f: next.formula }))
  }

  const resetKit = () => {
    setGraph(startKit(challenge))
    setSelectedId(null)
    setBondFrom(null)
    setAngleNeighbor(null)
    setChecked(false)
    onSpectrum([], '')
    onMacro(t('learn.research.builderKitReady', { n: kitTotal(challenge.kit), f: challenge.formula }))
  }

  const handleSelect = (id: string | null) => {
    if (!id) {
      setSelectedId(null)
      setAngleNeighbor(null)
      return
    }
    if (bondFrom && bondFrom !== id) {
      if (canBond(graph, bondFrom, id, bondOrder)) {
        const bonded = addBond(graph, bondFrom, id, bondOrder)
        if (bonded) {
          setGraph(bonded)
          setChecked(false)
        }
        setBondFrom(null)
        setSelectedId(id)
        setAngleNeighbor(null)
        return
      }
      setBondFrom(id)
      setSelectedId(id)
      setAngleNeighbor(null)
      return
    }
    setSelectedId(id)
    setAngleNeighbor(null)
  }

  const startBond = () => {
    if (!selectedId) return
    setBondFrom(bondFrom === selectedId ? null : selectedId)
  }

  const raiseBondOrder = () => {
    if (!selectedId || !angleNeighbor) return
    const nextOrder = (Math.min(3, bondOrder + 1) || 2) as 1 | 2 | 3
    const updated = setBondOrder(graph, selectedId, angleNeighbor, nextOrder)
    if (updated) {
      setGraph(updated)
      setBondOrderUi(nextOrder)
      setChecked(false)
    }
  }

  const breakBond = () => {
    if (!selectedId || !angleNeighbor) return
    setGraph(removeBondBetween(graph, selectedId, angleNeighbor))
    setAngleNeighbor(null)
    setChecked(false)
  }

  const doAutoH = () => {
    setGraph(layoutOrganicGraph(autoBondKitHydrogens(graph)))
    setChecked(false)
  }

  const doSnap = () => {
    setGraph(snapAnglesHint(graph))
    setChecked(false)
  }

  const rotateSel = (delta: number) => {
    if (!selectedId || !angleNeighbor) return
    setGraph(rotateNeighborAround(graph, selectedId, angleNeighbor, delta))
    setChecked(false)
  }

  const runCheck = () => {
    setChecked(true)
    if (complete) {
      onMacro(pickSuccess(challenge, locale))
      onSpectrum(challenge.irPeaks, pickTitle(challenge, locale))
    } else {
      const parts: string[] = []
      if (!skeletonOk) parts.push(t('learn.research.builderFailSkeleton'))
      if (!valenceFull) parts.push(t('learn.research.builderFailValence'))
      if (!anglesOk(graph)) parts.push(t('learn.research.builderFailAngles'))
      if (!formulaOk) parts.push(t('learn.research.builderFailFormula'))
      onMacro(parts.join(' '))
    }
  }

  const kitEntries = (
    [
      ['C', challenge.kit.C],
      ['H', challenge.kit.H],
      ['O', challenge.kit.O],
      ['N', challenge.kit.N],
      ['Cl', challenge.kit.Cl],
    ] as const
  ).filter(([, n]) => n && n > 0)

  const panelBtn = (id: StudioPanel, label: string) => (
    <button
      key={id}
      type="button"
      className={`${styles.missionChip} ${panel === id ? styles.missionChipActive : ''}`}
      onClick={() => setPanel(id)}
    >
      {label}
    </button>
  )

  return (
    <div className={styles.studio}>
      <div className={styles.missionRow}>
        <button
          type="button"
          className={`${styles.missionChip} ${classFilter === 'all' ? styles.missionChipActive : ''}`}
          onClick={() => setClassFilter('all')}
        >
          {t('learn.research.builderAllClasses')} · {ORGANIC_BUILD_CHALLENGES.length}
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

      <div className={styles.missionRow}>
        {panelBtn('build', t('learn.research.studioBuild'))}
        {panelBtn('sn2', t('learn.research.studioSn2'))}
        {panelBtn('equilibrium', t('learn.research.studioEq'))}
        {panelBtn('detective', t('learn.research.studioDetective'))}
        {panelBtn('equation', t('learn.research.studioEquation'))}
      </div>

      {panel === 'build' ? (
        <OrganicBuilderCanvas
          graph={graph}
          selectedId={selectedId}
          bondFromId={bondFrom}
          onSelectAtom={handleSelect}
        >
          <div className={styles.hudTop}>
            <div className={styles.formulaPanel}>
              <span className={styles.formulaTarget}>{challenge.formula}</span>
              <span className={styles.formulaLive}>
                {t('learn.research.builderFormulaNow', { f: formulaUnicode(graph) })}
              </span>
              <div className={styles.kitCounts}>
                {kitEntries.map(([el, n]) => (
                  <span
                    key={el}
                    className={`${styles.kitPill} ${
                      el === 'C'
                        ? styles.kitPillC
                        : el === 'H'
                          ? styles.kitPillH
                          : styles.kitPillO
                    }`}
                  >
                    {el}×{n}
                  </span>
                ))}
              </div>
            </div>
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
          </div>

          <div className={styles.hudBottom}>
            {selectedAtom ? (
              <div className={styles.inspect}>
                <span>
                  <strong>{selectedAtom.element}</strong>
                  {hyb && hyb !== 'terminal' ? ` · ${hyb} · ${targetAngleDeg(hyb)}°` : ''}
                  {' · '}
                  {t('learn.research.builderFreeValence', { n: freeValence(graph, selectedAtom.id) })}
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
              <button type="button" className={styles.tool} onClick={doAutoH}>
                {t('learn.research.builderAutoH')}
              </button>
              <button type="button" className={styles.tool} onClick={doSnap}>
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
          </div>
        </OrganicBuilderCanvas>
      ) : null}

      {panel === 'sn2' ? (
        <div className={styles.panelBox}>
          <p className={styles.hintLine}>{t('learn.research.studioSn2Lead')}</p>
          <ResearchAttackMode onMacro={onMacro} />
        </div>
      ) : null}

      {panel === 'equilibrium' ? (
        <div className={styles.panelBox}>
          <p className={styles.hintLine}>{t('learn.research.studioEqLead')}</p>
          <ResearchEquilibriumMode onMacro={onMacro} />
        </div>
      ) : null}

      {panel === 'detective' ? (
        <div className={styles.panelBox}>
          <p className={styles.hintLine}>{t('learn.research.studioDetectiveLead')}</p>
          <ResearchDetectiveMode onSpectrum={onSpectrum} onMacro={onMacro} />
        </div>
      ) : null}

      {panel === 'equation' ? (
        <div className={styles.panelBox}>
          <p className={styles.hintLine}>{t('learn.research.studioEquationLead')}</p>
          <div className={styles.formulaPanel} style={{ maxWidth: '100%' }}>
            <span className={styles.formulaTarget}>{challenge.formula}</span>
            <p className={styles.hintLine} style={{ marginTop: '0.5rem', fontSize: '1rem' }}>
              {pickEq(challenge, locale)}
            </p>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolPrimary}`}
              style={{ marginTop: '0.65rem' }}
              onClick={() => {
                onMacro(pickEq(challenge, locale))
                onSpectrum(challenge.irPeaks, pickTitle(challenge, locale))
              }}
            >
              {t('learn.research.studioShowIr')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
