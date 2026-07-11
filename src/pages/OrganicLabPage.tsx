import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LabDomainTabs } from '../components/lab/LabDomainTabs'
import { OrganicAtomPalettePanel } from '../components/organicLab/OrganicAtomPalettePanel'
import {
  OrganicMoleculeCatalogPanel,
  type OrganicCatalogIntent,
} from '../components/organicLab/OrganicMoleculeCatalogPanel'
import { OrganicMoleculeViewer } from '../components/organicLab/OrganicMoleculeViewer'
import { OrganicSynthesisReactorPanel } from '../components/organicLab/OrganicSynthesisReactorPanel'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import { REACTOR_COEFF_MAX, REACTOR_EQUATION_MAX_TERMS } from '../chemistry/reactorLimits'
import { getElementByZ } from '../data/elements'
import {
  isOrganicElementZ,
  isOrganicEquationBalanced,
  leftTermsFromOrganicMolecule,
  matchOrganicProductsForEquation,
  mergeLeftTermsForOrganicProduct,
  organicProductById,
} from '../data/organicLab/organicReactorBalance'
import {
  ORGANIC_TIER1_IDS,
  organicMoleculeById,
} from '../data/organicLab/organicMoleculeRegistry'
import type { OrganicDisplayMode, OrganicMoleculeDef } from '../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../i18n/useLocale'
import { useT } from '../i18n/useT'
import labStyles from './LaboratoryPage.module.css'
import styles from './OrganicLabPage.module.css'

function newId(): string {
  return crypto.randomUUID()
}

function pickName(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

function pickDesc(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.descriptionEn
  if (locale === 'uz') return m.descriptionUz
  return m.descriptionRu
}

function pickEq(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.equationEn
  if (locale === 'uz') return m.equationUz
  return m.equationRu
}

function preserveReactorMessageOnEquationEdit(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('верно! связь') ||
    m.includes('correct! bonding') ||
    m.startsWith('получено:') ||
    m.startsWith('obtained:') ||
    m.startsWith('olingan:')
  )
}

export function OrganicLabPage() {
  const { t } = useT()
  const { locale } = useLocale()
  const [params, setParams] = useSearchParams()

  const initialBrowseId =
    params.get('mol') && organicMoleculeById[params.get('mol')!]
      ? params.get('mol')!
      : ORGANIC_TIER1_IDS[0]!

  const [browseMolId, setBrowseMolId] = useState(initialBrowseId)
  const [mode, setMode] = useState<OrganicDisplayMode>('ballStick')

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [reactorOpen, setReactorOpen] = useState(false)
  const [leftTerms, setLeftTerms] = useState<ReactorEquationTerm[]>([])
  const [productMoleculeId, setProductMoleculeId] = useState<string | null>(null)
  const [productCoeff, setProductCoeff] = useState(1)
  const [reactorCatalogOpen, setReactorCatalogOpen] = useState(false)
  const [reactorCatalogIntent, setReactorCatalogIntent] =
    useState<OrganicCatalogIntent>('selectProduct')
  const reactorCatalogPickModeRef = useRef<OrganicCatalogIntent>('selectProduct')

  const [reactorMessage, setReactorMessage] = useState<string | null>(null)
  const [synthesisSettledProduct, setSynthesisSettledProduct] = useState<OrganicMoleculeDef | null>(
    null,
  )
  const [synthesisRunning, setSynthesisRunning] = useState(false)
  const productLockedRef = useRef(false)
  const settledSnapshotRef = useRef<string | null>(null)

  const productMolecule = useMemo(
    () => organicProductById(productMoleculeId),
    [productMoleculeId],
  )

  const deferredLeftTerms = useDeferredValue(leftTerms)

  const ambiguousMatches = useMemo(
    () => matchOrganicProductsForEquation(deferredLeftTerms, productCoeff),
    [deferredLeftTerms, productCoeff],
  )

  const equationSignature = useMemo(
    () =>
      JSON.stringify({
        terms: leftTerms.map((term) => [term.id, term.z, term.coeff, term.diatomic ?? false]),
        product: productMoleculeId,
        coeff: productCoeff,
      }),
    [leftTerms, productMoleculeId, productCoeff],
  )

  useEffect(() => {
    if (synthesisSettledProduct == null) return
    if (settledSnapshotRef.current == null) {
      settledSnapshotRef.current = equationSignature
      return
    }
    if (settledSnapshotRef.current !== equationSignature) {
      settledSnapshotRef.current = null
      setSynthesisSettledProduct(null)
    }
  }, [equationSignature, synthesisSettledProduct])

  const equationBalanced = useMemo(
    () => isOrganicEquationBalanced(deferredLeftTerms, productMolecule, productCoeff),
    [deferredLeftTerms, productMolecule, productCoeff],
  )

  const canRunSynthesis = equationBalanced && productMolecule != null && leftTerms.length >= 1

  const resetEquation = useCallback(() => {
    setLeftTerms([])
    setProductMoleculeId(null)
    setProductCoeff(1)
  }, [])

  const onPickAtomZ = useCallback(
    (z: number) => {
      if (!isOrganicElementZ(z) || !getElementByZ(z)) return
      if (!reactorOpen) {
        setReactorOpen(true)
        setReactorMessage(t('organicLab.reactorOpenHint'))
      }
      setLeftTerms((prev) => {
        const matchIndex = prev.findIndex((term) => term.z === z && !term.diatomic)
        if (matchIndex >= 0) {
          const term = prev[matchIndex]!
          const nextCoeff = term.coeff + 1
          if (nextCoeff > REACTOR_COEFF_MAX) return prev
          return prev.map((x, i) => (i === matchIndex ? { ...x, coeff: nextCoeff } : x))
        }
        if (prev.length >= REACTOR_EQUATION_MAX_TERMS) return prev
        return [...prev, { id: newId(), z, coeff: 1 }]
      })
      setPaletteOpen(false)
    },
    [reactorOpen, t],
  )

  const onRemoveTerm = useCallback((id: string) => {
    setLeftTerms((prev) => prev.filter((term) => term.id !== id))
  }, [])

  const onCoeffChange = useCallback((id: string, coeff: number) => {
    const c = Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(Number.isFinite(coeff) ? coeff : 1)))
    setSynthesisSettledProduct(null)
    settledSnapshotRef.current = null
    setLeftTerms((prev) => prev.map((term) => (term.id === id ? { ...term, coeff: c } : term)))
  }, [])

  const openReactorCatalog = useCallback((intent: OrganicCatalogIntent) => {
    reactorCatalogPickModeRef.current = intent
    setReactorCatalogIntent(intent)
    setReactorCatalogOpen(true)
  }, [])

  const handleReactorCatalogPick = useCallback(
    (id: string) => {
      setReactorCatalogOpen(false)
      const modePick = reactorCatalogPickModeRef.current
      reactorCatalogPickModeRef.current = 'selectProduct'
      setReactorCatalogIntent('selectProduct')

      const mol = organicMoleculeById[id]
      if (!mol) return

      productLockedRef.current = true
      setProductMoleculeId(id)
      setProductCoeff(1)
      setBrowseMolId(id)
      setParams({ mol: id }, { replace: true })
      setSynthesisSettledProduct(null)
      settledSnapshotRef.current = null

      if (modePick === 'generateEquation') {
        setLeftTerms(leftTermsFromOrganicMolecule(mol))
        setReactorMessage(t('organicLab.reactorGenReady'))
      } else {
        setLeftTerms((prev) =>
          prev.length === 0
            ? leftTermsFromOrganicMolecule(mol)
            : mergeLeftTermsForOrganicProduct(prev, mol),
        )
        setReactorMessage(t('organicLab.reactorProductReady'))
      }
    },
    [setParams, t],
  )

  const clearReactorSlots = useCallback(() => {
    resetEquation()
    setReactorMessage(null)
    setSynthesisSettledProduct(null)
    settledSnapshotRef.current = null
    setSynthesisRunning(false)
    productLockedRef.current = false
    reactorCatalogPickModeRef.current = 'selectProduct'
    setReactorCatalogIntent('selectProduct')
    setReactorCatalogOpen(false)
  }, [resetEquation])

  const toggleReactor = useCallback(() => {
    setReactorOpen((o) => {
      const next = !o
      if (!next) {
        resetEquation()
        setReactorMessage(null)
        setSynthesisSettledProduct(null)
        settledSnapshotRef.current = null
        setSynthesisRunning(false)
        setReactorCatalogOpen(false)
        setPaletteOpen(false)
        productLockedRef.current = false
        reactorCatalogPickModeRef.current = 'selectProduct'
        setReactorCatalogIntent('selectProduct')
      } else {
        setPaletteOpen(false)
        setReactorMessage(t('organicLab.reactorOpenHint'))
      }
      return next
    })
  }, [resetEquation, t])

  const onRequestRun = useCallback(() => {
    if (!productMolecule) {
      setReactorMessage(t('errors.reactor.NO_PRODUCT'))
      return
    }
    if (leftTerms.length < 1) {
      setReactorMessage(t('errors.reactor.NO_REAGENTS'))
      return
    }
    if (!isOrganicEquationBalanced(leftTerms, productMolecule, productCoeff)) {
      setReactorMessage(t('errors.reactor.BALANCE_MISMATCH'))
      return
    }

    setSynthesisRunning(true)
    const name = pickName(productMolecule, locale)
    setReactorMessage(t('reactor.successRunning', { name }))

    window.setTimeout(() => {
      setSynthesisSettledProduct(productMolecule)
      settledSnapshotRef.current = equationSignature
      setBrowseMolId(productMolecule.id)
      setParams({ mol: productMolecule.id }, { replace: true })
      setSynthesisRunning(false)
      setReactorMessage(
        t('reactor.successProduct', {
          name,
          formula: productMolecule.formula,
        }),
      )
    }, 650)
  }, [productMolecule, leftTerms, productCoeff, locale, t, equationSignature, setParams])

  const highlightEquationError = useMemo(() => {
    if (!reactorMessage) return false
    const m = reactorMessage.toLowerCase()
    return (
      m.includes('баланс') ||
      m.includes('mass balance') ||
      m.includes('коэффициент') ||
      m.includes('coefficient') ||
      m.includes('не совпадает') ||
      m.includes('do not match') ||
      m.includes('mos kelmaydi')
    )
  }, [reactorMessage])

  useEffect(() => {
    queueMicrotask(() => {
      setReactorMessage((prev) => {
        if (!prev) return prev
        if (preserveReactorMessageOnEquationEdit(prev)) return prev
        return null
      })
    })
  }, [leftTerms, productMoleculeId, productCoeff])

  useEffect(() => {
    const hash = window.location.hash
    const qIdx = hash.indexOf('?')
    if (qIdx < 0) return
    const hp = new URLSearchParams(hash.slice(qIdx + 1))
    if (hp.get('reactor') === '1') {
      setReactorOpen(true)
      setPaletteOpen(false)
    }
  }, [])

  const showSettled = reactorOpen && !synthesisRunning && synthesisSettledProduct != null
  const displayMol: OrganicMoleculeDef | null = showSettled
    ? synthesisSettledProduct
    : !reactorOpen
      ? (organicMoleculeById[browseMolId] ?? organicMoleculeById[ORGANIC_TIER1_IDS[0]!] ?? null)
      : null

  const modes: { id: OrganicDisplayMode; label: string }[] = [
    { id: 'ballStick', label: t('organicLab.modeBallStick') },
    { id: 'spaceFill', label: t('organicLab.modeSpaceFill') },
    { id: 'skeleton2d', label: t('organicLab.modeSkeleton') },
    { id: 'hybridization', label: t('organicLab.modeHybrid') },
  ]

  const periodicUiHidden = reactorCatalogOpen && reactorCatalogIntent === 'generateEquation'

  return (
    <div className={labStyles.wrap} data-lab-synthesis-view={showSettled ? 'substance' : 'reactor'}>
      <div className={labStyles.domainBar}>
        <LabDomainTabs active="organic" />
      </div>

      <div
        className={labStyles.canvasWrap}
        data-lab-synthesis-view={showSettled ? 'substance' : 'reactor'}
        style={
          displayMol
            ? { ['--synth-glow' as string]: displayMol.accentColor ?? '#0a0c18' }
            : undefined
        }
      >
        {displayMol ? (
          <OrganicMoleculeViewer mol={displayMol} mode={mode} fillParent key={displayMol.id}>
            <div className={styles.hudTop}>
              <div className={styles.titleCard}>
                <strong>
                  {pickName(displayMol, locale)} | {displayMol.formula}
                </strong>
                <p>{pickDesc(displayMol, locale)}</p>
              </div>
              <div className={styles.modeCol} role="group" aria-label={t('organicLab.modeAria')}>
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
                    onClick={() => setMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'hybridization' && displayMol.viewHints?.hybridFocus ? (
              <div className={styles.hybridPanel}>
                <span className={styles.hybridBadge}>{displayMol.viewHints.hybridFocus}</span>
                <span>{t('organicLab.hybridHint', { h: displayMol.viewHints.hybridFocus })}</span>
              </div>
            ) : null}

            <div className={`${styles.hudBottom} ${reactorOpen ? styles.hudBottomReactor : ''}`}>
              <div className={styles.eqBar}>
                <span className={styles.eqLabel}>{t('organicLab.equation')}</span>
                <code className={styles.eqCode}>{pickEq(displayMol, locale)}</code>
              </div>
              <div className={styles.actions}>
                {displayMol.challengeId ? (
                  <Link
                    className={styles.primaryLink}
                    to={`/learn/research/builder?challenge=${encodeURIComponent(displayMol.challengeId)}`}
                  >
                    {t('organicLab.buildYourself')}
                  </Link>
                ) : (
                  <Link className={styles.primaryLink} to="/learn/research/builder">
                    {t('organicLab.openBuilder')}
                  </Link>
                )}
              </div>
            </div>
          </OrganicMoleculeViewer>
        ) : (
          <div className={styles.idleStage} aria-live="polite">
            <p className={styles.idleTitle}>{t('organicLab.idleTitle')}</p>
            <p className={styles.idleLead}>{t('organicLab.idleHint')}</p>
          </div>
        )}

        {showSettled ? <div className={labStyles.synthVignette} aria-hidden /> : null}

        <OrganicSynthesisReactorPanel
          open={reactorOpen}
          onOpenGenerateEquationCatalog={() => openReactorCatalog('generateEquation')}
          leftTerms={leftTerms}
          productMolecule={productMolecule}
          productCoeff={productCoeff}
          onRemoveTerm={onRemoveTerm}
          onCoeffChange={onCoeffChange}
          onOpenCatalog={() => openReactorCatalog('selectProduct')}
          onProductCoeffChange={(c) => {
            setProductCoeff(Math.max(1, Math.min(REACTOR_COEFF_MAX, Math.floor(c))))
          }}
          onClearSlots={clearReactorSlots}
          onRequestRun={onRequestRun}
          message={reactorMessage}
          canRun={canRunSynthesis}
          synthesisRunning={synthesisRunning}
          equationBalanced={equationBalanced}
          highlightEquationError={highlightEquationError}
          ambiguousCount={ambiguousMatches.length}
        />

        <OrganicMoleculeCatalogPanel
          open={reactorCatalogOpen}
          intent={reactorCatalogIntent}
          onClose={() => {
            setReactorCatalogOpen(false)
            reactorCatalogPickModeRef.current = 'selectProduct'
            setReactorCatalogIntent('selectProduct')
          }}
          onPick={handleReactorCatalogPick}
        />

        <OrganicAtomPalettePanel
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onPickZ={onPickAtomZ}
        />

        <button
          type="button"
          className={`${labStyles.synthButton} ${reactorOpen ? labStyles.synthButtonActive : ''}`}
          onClick={toggleReactor}
          aria-pressed={reactorOpen}
          title={reactorOpen ? t('lab.synthButtonClose') : t('lab.synthButtonOpen')}
        >
          {t('lab.synthButton')}
        </button>

        {!paletteOpen && !periodicUiHidden ? (
          <button
            type="button"
            className={
              reactorOpen
                ? `${labStyles.panelFab} ${labStyles.panelFabReactorOpen}`
                : labStyles.panelFab
            }
            onClick={() => {
              setPaletteOpen(true)
              if (!reactorOpen) {
                setReactorOpen(true)
                setReactorMessage(t('organicLab.reactorOpenHint'))
              }
            }}
            aria-expanded={paletteOpen}
            aria-label={t('organicLab.paletteFabAria')}
          >
            ⊞
          </button>
        ) : null}
      </div>
    </div>
  )
}
