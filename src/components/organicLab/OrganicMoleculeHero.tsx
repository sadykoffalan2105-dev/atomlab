import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { organicGraphToCompoundDef } from '../../chemistry/organic/organicToCompound'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { loadOrganicV2Molecules, organicV2MoleculeSync } from '../../data/organicV2/molecules'
import type { OV2Molecule } from '../../data/organicV2/types'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { SchoolCatalogCanvas } from '../lab/hero/SchoolCatalogCanvas'

/** Общая 3D-сцена органики v2 (те же RDKit-координаты и вид, что на странице #/organic); отдельный чанк. */
const Molecule3D = lazy(() => import('../organicV2/Molecule3D').then((m) => ({ default: m.Molecule3D })))

const boxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  padding: 12,
  borderRadius: 12,
  color: 'rgba(220,228,255,0.92)',
  background: 'rgba(8,10,26,0.92)',
  border: '1px solid rgba(52,211,153,0.25)',
  textAlign: 'center',
  boxSizing: 'border-box',
}

/**
 * 3D органической молекулы в карточке каталога — единый вид с органикой v2 (Molecule3D compact, RDKit-геометрия).
 * Молекулы, которой нет в данных v2, — прежний школьный вид (CPK, кратность из графа).
 */
export function OrganicMoleculeHero({ mol }: { mol: OrganicMoleculeDef }) {
  const { t } = useT()
  const { locale } = useLocale()
  const lang = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const webglOk = isWebGLAvailable()
  // undefined — грузится; null — нет в v2
  const [v2, setV2] = useState<{ id: string; mol: OV2Molecule | null } | null>(() => {
    const m = organicV2MoleculeSync(mol.id)
    return m ? { id: mol.id, mol: m } : null
  })
  useEffect(() => {
    if (v2?.id === mol.id) return
    let alive = true
    loadOrganicV2Molecules().then(
      (all) => alive && setV2({ id: mol.id, mol: all[mol.id] ?? null }),
      () => alive && setV2({ id: mol.id, mol: null }),
    )
    return () => {
      alive = false
    }
  }, [mol.id, v2?.id])
  const fallback = useMemo(() => organicGraphToCompoundDef(mol.graph, mol.id, mol.accentColor), [mol])

  if (!webglOk) {
    return (
      <div role="status" style={boxStyle}>
        {t('catalog.webglUnavailable')}
      </div>
    )
  }
  const ready = v2?.id === mol.id ? v2.mol : undefined
  if (ready === null) return <SchoolCatalogCanvas shape={fallback} />
  const loading = <div style={{ ...boxStyle, border: 'none', background: 'transparent' }} aria-hidden />
  if (!ready) return loading
  return (
    <Suspense fallback={loading}>
      <Molecule3D key={ready.id} mol={ready} style="ballStick" lang={lang} compact autoRotate />
    </Suspense>
  )
}
