/**
 * Dev-страница листа кадров 200 веществ каталога (НЕ входит в сборку приложения): одно окно 3D — тот же
 * SchoolCatalogCanvas, что в карточке каталога, — и подпись (формула, семейство, ионы, источник, «схема»).
 * Скрипт scripts/sheet/capture-models-sheet.mts переключает вещество через window.__sheetSet(id, size)
 * и снимает кадр. Сборка: npx vite build --config scripts/sheet/vite.sheet.config.ts
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import '../../src/theme/appTheme.css'
import { LocaleProvider } from '../../src/i18n/LocaleProvider'
import { compoundById } from '../../src/data/compounds'
import { CATALOG_TOP200_IDS } from '../../src/data/catalog/catalogTop200'
import { familyOf } from '../../src/data/catalog/catalogFamilies'
import { SchoolCatalogCanvas } from '../../src/components/lab/hero/SchoolCatalogCanvas'
import { buildSchoolHeroModel } from '../../src/components/lab/hero/schoolHeroModel'

declare global {
  interface Window {
    __sheetSet?: (id: string, size: number) => void
    __sheetIds?: readonly string[]
    __sheetInfo?: (id: string) => { formula: string; family: string; root: string; source: string; ions: string; schematic: string[] } | null
  }
}

window.__sheetIds = CATALOG_TOP200_IDS
window.__sheetInfo = (id) => {
  const c = compoundById[id]
  if (!c) return null
  const m = buildSchoolHeroModel(c)
  const f = familyOf(id)
  const ions = new Map<string, number>()
  for (const i of m?.ions ?? []) ions.set(i.label, (ions.get(i.label) ?? 0) + 1)
  return {
    formula: c.formulaUnicode,
    family: f ? f.family.ru : '—',
    root: f?.root?.formula ?? '',
    source: m ? m.source : 'нет',
    ions: [...ions].map(([l, n]) => (n > 1 ? `${n}·${l}` : l)).join(' + '),
    schematic: m?.schematic ?? [],
  }
}

function Sheet() {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <Sheet />
    </LocaleProvider>
  </StrictMode>,
)
