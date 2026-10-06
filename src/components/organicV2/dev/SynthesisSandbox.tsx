/**
 * Витрина проигрывателя синтеза (разработка/кадры). Маршрута в App.tsx нет: открывается временным
 * ?ov2sandbox=synthesis в локальной сборке. Параметры: r=<id реакции> | mol=<id молекулы> (выбор маршрута),
 * t=<секунды> (кадр этапа, без автозапуска) или stage=<0…5>&f=<доля этапа 0…1>, lang=ru|en|uz, theme=light|dark.
 * Кадры всех реакций без перезагрузки: window.dispatchEvent(new CustomEvent('ov2shot', { detail: { r, stage, f } }))
 * — проигрыватель пересобирается, у корня появляется data-ov2-shot="<r>:<stage>".
 */
import { useEffect, useMemo, useState } from 'react'
import { loadOrganicV2Reactions } from '../../../data/organicV2/reactions'
import type { OV2Reaction, OV2ReactionsFile } from '../../../data/organicV2/types'
import { buildSynthesisScenario } from '../../../chemistry/organicV2/synthesis/scenario'
import { SynthesisPlayer } from '../SynthesisPlayer'
import { SynthesisRoutes } from '../synthesis/SynthesisRoutes'
import type { OV2Lang } from '../contracts'

interface Shot {
  readonly r: string
  readonly t?: number
  readonly stage?: number
  readonly f?: number
}

function startOf(reaction: OV2Reaction, shot: Shot): number | undefined {
  if (shot.t != null) return shot.t
  if (shot.stage == null) return undefined
  const st = buildSynthesisScenario(reaction).stages[shot.stage]
  return st ? st.t0 + (st.t1 - st.t0) * Math.min(1, Math.max(0, shot.f ?? 0.75)) : undefined
}

export default function SynthesisSandbox() {
  const q = new URLSearchParams(window.location.search)
  const mol = q.get('mol')
  const lang = (q.get('lang') ?? 'ru') as OV2Lang
  const num = (k: string) => (q.get(k) != null ? Number(q.get(k)) : undefined)
  const [shot, setShot] = useState<Shot>({ r: q.get('r') ?? 'g10-c1-s06-r6', t: num('t'), stage: num('stage'), f: num('f') })
  const [file, setFile] = useState<OV2ReactionsFile | null>(null)

  useEffect(() => {
    if (mol) return
    loadOrganicV2Reactions().then(setFile)
  }, [mol])
  useEffect(() => {
    const on = (e: Event) => setShot((e as CustomEvent<Shot>).detail)
    window.addEventListener('ov2shot', on)
    return () => window.removeEventListener('ov2shot', on)
  }, [])

  const reaction = useMemo(() => file?.reactions.find((x) => x.id === shot.r) ?? null, [file, shot.r])
  const start = reaction ? startOf(reaction, shot) : undefined

  return (
    <div style={{ minHeight: '100vh', padding: 16, background: 'var(--app-shell-bg, var(--lt-bg))', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }} data-ov2-shot={reaction ? `${shot.r}:${shot.stage ?? shot.t ?? ''}` : undefined}>
        {mol ? (
          <SynthesisRoutes moleculeId={mol} lang={lang} autoplay={shot.t == null} />
        ) : reaction ? (
          <SynthesisPlayer
            key={`${shot.r}:${start ?? 'play'}`}
            reaction={reaction}
            lang={lang}
            focusMoleculeId={q.get('focus') ?? undefined}
            autoplay={start == null}
            startTime={start}
          />
        ) : (
          <p style={{ color: 'var(--lt-text)' }}>{file ? `нет реакции ${shot.r}` : '…'}</p>
        )}
      </div>
    </div>
  )
}
