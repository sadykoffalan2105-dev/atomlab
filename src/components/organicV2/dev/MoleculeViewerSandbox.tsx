/**
 * Органика v2 — витрина просмотрщика (не маршрут приложения): монтируется отдельной точкой входа
 * dev/ViewerSandboxMain.tsx для кадров Playwright и ручной проверки. Параметры адреса:
 *   view=viewer|m3d|f2|grid|isomers, mol=<id>, ids=a,b,c, formula=C4H8, lang=ru|en|uz, theme=dark|light,
 *   style=ballStick|spaceFill|wire, overlay=…, tool=measure|rotate, phi=<°>, picks=1,2,3, kind=skeletal|structural.
 */
import { useEffect, useMemo, useState } from 'react'
import type { OV2Molecule } from '../../../data/organicV2/types'
import { loadOrganicV2Molecules } from '../../../data/organicV2/molecules'
import type { MoleculeOverlay, MoleculeStyle, MoleculeTool, OV2Lang } from '../contracts'
import { MoleculeViewer } from '../MoleculeViewer'
import { Molecule3DCore } from '../Molecule3D'
import { Formula2D } from '../Formula2D'
import { IsomerGallery } from '../IsomerGallery'
import { isRotatable, neighbors } from '../viewer/molMath'
import { moleculeName } from '../viewer/names'

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '')

/** Центральная одинарная связь C–C (для Ньюмена): у обоих концов больше всего соседей-C. */
export function centralCCBond(mol: OV2Molecule): number | undefined {
  const adj = neighbors(mol)
  const cdeg = (i: number) => adj[i].filter((j) => mol.atoms[j].el === 'C').length
  let best: number | undefined
  let score = -1
  mol.bonds.forEach((b, i) => {
    if (mol.atoms[b.a].el !== 'C' || mol.atoms[b.b].el !== 'C' || !isRotatable(mol, adj, i)) return
    const s = Math.min(cdeg(b.a), cdeg(b.b)) * 10 + cdeg(b.a) + cdeg(b.b)
    if (s > score) {
      score = s
      best = i
    }
  })
  return best
}

export function MoleculeViewerSandbox() {
  const [all, setAll] = useState<Readonly<Record<string, OV2Molecule>> | null>(null)
  useEffect(() => {
    void loadOrganicV2Molecules().then(setAll)
  }, [])
  const lang = (q.get('lang') ?? 'ru') as OV2Lang
  const view = q.get('view') ?? 'viewer'
  const mol = all?.[q.get('mol') ?? 'ethanol']
  const picks = useMemo(() => q.get('picks')?.split(',').map(Number), [])
  if (!all) return <div style={{ padding: 20 }}>…</div>
  if (view === 'grid') {
    const ids = (q.get('ids') ?? '').split(',').filter((id) => all[id])
    const kind = (q.get('kind') ?? 'skeletal') as 'skeletal' | 'structural'
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10, padding: 12 }}>
        {ids.map((id) => (
          <div key={id} style={{ border: '1px solid var(--lt-border)', borderRadius: 14, padding: 8, background: 'var(--lt-surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lt-text)' }}>{moleculeName(all[id], lang)}</div>
            <div style={{ height: 170 }}>
              <Formula2D mol={all[id]} kind={kind} lang={lang} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (view === 'isomers') {
    const f = q.get('formula') ?? 'C4H8'
    const first = q.get('first')
    const list = Object.values(all)
      .filter((m) => m.formula === f)
      .sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0))
    return (
      <div style={{ padding: 12 }}>
        <IsomerGallery formula={f} molecules={list} lang={lang} onOpen={(id) => console.log('open', id)} />
      </div>
    )
  }
  if (!mol) return <div style={{ padding: 20 }}>нет молекулы {q.get('mol')}</div>
  if (view === 'f2') {
    return (
      <div style={{ height: '100vh', padding: 16, boxSizing: 'border-box' }}>
        <Formula2D mol={mol} kind={(q.get('kind') ?? 'skeletal') as 'skeletal' | 'structural'} lang={lang} />
      </div>
    )
  }
  if (view === 'm3d') {
    const tool = (q.get('tool') ?? 'none') as MoleculeTool
    return (
      <div style={{ height: '100vh' }}>
        <Molecule3DCore
          mol={mol}
          lang={lang}
          style={(q.get('style') ?? 'ballStick') as MoleculeStyle}
          overlay={(q.get('overlay') ?? 'none') as MoleculeOverlay}
          tool={tool}
          compact={q.get('compact') === '1'}
          initialRotateBond={tool === 'rotate' ? centralCCBond(mol) : undefined}
          initialPhi={q.get('phi') ? Number(q.get('phi')) : undefined}
          initialPicks={picks}
        />
      </div>
    )
  }
  return (
    <div style={{ padding: 12, maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <MoleculeViewer mol={mol} lang={lang} initialStyle={(q.get('style') ?? 'ballStick') as MoleculeStyle} />
    </div>
  )
}
