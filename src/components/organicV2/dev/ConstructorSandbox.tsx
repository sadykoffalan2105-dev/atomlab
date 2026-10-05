/**
 * Витрина Конструктора органики v2 (для проверки до подключения оболочкой страницы).
 * Открывается временным ?ov2sandbox=constructor в своей сборке; параметры:
 *   task=free|build|isomers, target=<id реестра>, formula=C5H12, lang=ru|en|uz.
 */
import { useEffect, useState } from 'react'
import { OrganicConstructor } from '../OrganicConstructor'
import type { ConstructorSolved, ConstructorTask, OV2Lang } from '../contracts'
import { loadOrganicV2Molecules } from '../../../data/organicV2/molecules'
import type { OV2Molecule } from '../../../data/organicV2/types'

export function ConstructorSandbox() {
  const q = new URLSearchParams(window.location.search)
  const lang = (q.get('lang') as OV2Lang) || 'ru'
  const kind = q.get('task') || 'free'
  const task: ConstructorTask = kind === 'build' ? { kind: 'build', targetId: q.get('target') || '2-2-dimethylbutane' }
    : kind === 'isomers' ? { kind: 'isomers', formula: q.get('formula') || 'C5H12' } : { kind: 'free' }
  const [mols, setMols] = useState<Readonly<Record<string, OV2Molecule>> | null>(null)
  const [solved, setSolved] = useState<ConstructorSolved | null>(null)
  useEffect(() => { loadOrganicV2Molecules().then(setMols) }, [])
  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-shell-bg, #060913)', padding: '16px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 style={{ color: 'var(--lt-text, #e8edff)', fontSize: 20, margin: '0 0 12px' }}>Конструктор — витрина</h1>
        {mols ? (
          <OrganicConstructor key={JSON.stringify(task)} task={task} lang={lang} molecules={mols} onSolved={setSolved} />
        ) : <p style={{ color: '#8793b8' }}>…</p>}
        <p id="ov2-solved" data-solved={solved ? '1' : '0'} style={{ color: 'var(--lt-text-3, #8793b8)', fontSize: 13 }}>
          {solved ? `onSolved: ${solved.matchId ?? ''} ${solved.nameRu ?? ''}` : 'onSolved: —'}
        </p>
      </div>
    </div>
  )
}

export default ConstructorSandbox
