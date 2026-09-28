import { useMemo } from 'react'
import { organicGraphToCompoundDef } from '../../chemistry/organic/organicToCompound'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { SchoolCatalogCanvas } from '../lab/hero/SchoolCatalogCanvas'

/** 3D органической молекулы в карточке каталога — школьный вид (CPK, символы в шарах, палочки по кратности). */
export function OrganicMoleculeHero({ mol }: { mol: OrganicMoleculeDef }) {
  const { t } = useT()
  const compound = useMemo(
    () => organicGraphToCompoundDef(mol.graph, mol.id, mol.accentColor),
    [mol],
  )
  const webglOk = isWebGLAvailable()

  if (!webglOk) {
    return (
      <div
        role="status"
        style={{
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
        }}
      >
        {t('catalog.webglUnavailable')}
      </div>
    )
  }

  // Единый школьный вид, как у неорганики каталога и героя лаборатории (кратность — из графа молекулы).
  return <SchoolCatalogCanvas shape={compound} />
}
