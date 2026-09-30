/** Окно 3D листа кадров: одно вещество (window.__sheetSet переключает), тот же SchoolCatalogCanvas, что в каталоге. */
import { useEffect, useState } from 'react'
import { compoundById } from '../../src/data/compounds'
import { CATALOG_TOP200_IDS } from '../../src/data/catalog/catalogTop200'
import { SchoolCatalogCanvas } from '../../src/components/lab/hero/SchoolCatalogCanvas'

export function Sheet() {
  const [state, setState] = useState<{ id: string; size: number }>({ id: CATALOG_TOP200_IDS[0]!, size: 360 })
  useEffect(() => {
    window.__sheetSet = (id, size) => setState({ id, size })
  }, [])
  const c = compoundById[state.id]
  if (!c) return <p style={{ color: '#fff' }}>нет {state.id}</p>
  return (
    <div id="tile" key={state.id} style={{ width: state.size, height: state.size, position: 'relative' }}>
      <SchoolCatalogCanvas shape={c} />
    </div>
  )
}
