/**
 * Постоянная метка «Горячо» над нагретым у пламени предметом, пока он не остыл (labHand.markHot, 90 с).
 * Без источников света и новых материалов: обычный HTML поверх холста (drei Html), опрос раз в полсекунды.
 */
import { LabLabel } from '../scene/labOccluders'
import { useEffect, useState, type CSSProperties } from 'react'
import type { LabLang } from '../labContract'
import { labHand } from './labHandStore'
import { useXrPresenting } from '../xr/labXrStore'

const HOT_LABEL: Readonly<Record<LabLang, string>> = { ru: 'Горячо', en: 'Hot', uz: 'Issiq' }

const badgeStyle: CSSProperties = {
  padding: '2px 7px',
  borderRadius: 999,
  background: 'linear-gradient(180deg, #ff7a3d, #e8402a)',
  color: '#fff',
  font: '600 11px/1.3 system-ui, sans-serif',
  whiteSpace: 'nowrap',
  boxShadow: '0 1px 4px rgba(120, 30, 10, 0.35)',
  pointerEvents: 'none',
  userSelect: 'none',
}

type Hot = ReturnType<typeof labHand.hotItems>

const sameList = (a: Hot, b: Hot) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id && x.at.every((v, k) => Math.abs(v - b[i].at[k]) < 1e-3))

export function LabHotBadges({ lang }: { lang: LabLang }) {
  const [hot, setHot] = useState<Hot>([])
  const xr = useXrPresenting()
  useEffect(() => {
    const tick = () => {
      const next = labHand.hotItems()
      setHot((prev) => (sameList(prev, next) ? prev : next))
    }
    tick()
    const t = window.setInterval(tick, 500)
    return () => window.clearInterval(t)
  }, [])
  // в VR DOM-значки не видны — не монтируем
  if (xr) return null
  return (
    <>
      {hot.map((h) => (
        <LabLabel key={h.id} position={h.at} center>
          <div style={badgeStyle} role="status">
            {'\u{1F525} '}
            {HOT_LABEL[lang]}
          </div>
        </LabLabel>
      ))}
    </>
  )
}
