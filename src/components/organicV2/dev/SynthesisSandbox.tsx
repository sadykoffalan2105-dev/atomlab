/**
 * Витрина проигрывателя синтеза (разработка/кадры). Маршрута в App.tsx нет: открывается временным
 * ?ov2sandbox=synthesis в локальной сборке. Параметры: r=<id реакции> | mol=<id молекулы> (выбор маршрута),
 * t=<секунды> (кадр этапа, без автозапуска), lang=ru|en|uz, theme=light|dark.
 */
import { useEffect, useState } from 'react'
import { loadOrganicV2Reactions } from '../../../data/organicV2/reactions'
import type { OV2Reaction } from '../../../data/organicV2/types'
import { SynthesisPlayer } from '../SynthesisPlayer'
import { SynthesisRoutes } from '../synthesis/SynthesisRoutes'
import type { OV2Lang } from '../contracts'

export default function SynthesisSandbox() {
  const q = new URLSearchParams(window.location.search)
  const rid = q.get('r') ?? 'g10-c1-s06-r6'
  const mol = q.get('mol')
  const t = q.get('t')
  const lang = (q.get('lang') ?? 'ru') as OV2Lang
  const [reaction, setReaction] = useState<OV2Reaction | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (mol) return
    loadOrganicV2Reactions().then((f) => {
      const r = f.reactions.find((x) => x.id === rid)
      if (r) setReaction(r)
      else setMissing(true)
    })
  }, [rid, mol])

  return (
    <div style={{ minHeight: '100vh', padding: 16, background: 'var(--app-shell-bg, var(--lt-bg))', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {mol ? (
          <SynthesisRoutes moleculeId={mol} lang={lang} autoplay={t == null} />
        ) : reaction ? (
          <SynthesisPlayer
            reaction={reaction}
            lang={lang}
            focusMoleculeId={q.get('focus') ?? undefined}
            autoplay={t == null}
            startTime={t != null ? Number(t) : undefined}
          />
        ) : (
          <p style={{ color: 'var(--lt-text)' }}>{missing ? `нет реакции ${rid}` : '…'}</p>
        )}
      </div>
    </div>
  )
}
