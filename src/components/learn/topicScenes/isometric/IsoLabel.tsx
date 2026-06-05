import { useMemo } from 'react'
import { Html } from '@react-three/drei'

export function IsoLabel({
  children,
  position,
  title,
  variant = 'chip',
}: {
  children: string
  position: [number, number, number]
  title?: string
  variant?: 'chip' | 'banner' | 'title'
}) {
  const className =
    variant === 'banner'
      ? 'iso-label iso-label--banner'
      : variant === 'title'
        ? 'iso-label iso-label--title'
        : 'iso-label iso-label--chip'

  const portal = useMemo(() => {
    if (typeof document === 'undefined') return undefined
    return { current: document.body }
  }, [])

  return (
    <Html
      position={position}
      center
      distanceFactor={6}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
      portal={portal}
      transform
      occlude={false}
    >
      <div className={className}>
        {title ? <span className="iso-label__title">{title}</span> : null}
        <span className="iso-label__text">{children}</span>
      </div>
    </Html>
  )
}
