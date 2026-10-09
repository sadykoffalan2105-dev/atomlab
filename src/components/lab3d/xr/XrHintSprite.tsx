/**
 * Подсказка над целью шага для VR: спрайт с canvas-текстурой (drei <Html> в шлеме не виден).
 * Размер 0,12 × 0,04 м (ширина по тексту), всегда лицом к камере, поверх посуды (depthTest false, renderOrder 50).
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { makeTextTexture } from './xrText'

export function XrHintSprite({ text, position, scale = 1 }: { text: string; position: readonly [number, number, number]; scale?: number }) {
  const { texture, aspect } = useMemo(() => makeTextTexture(`✋ ${text}`, { px: 48, maxWidth: 512, bg: 'rgba(255,255,255,.92)', color: '#0f172a' }), [text])
  const h = 0.04 * scale
  const w = Math.max(0.12 * scale, h * aspect)
  return (
    <sprite position={position as unknown as THREE.Vector3Tuple} scale={[w, h, 1]} renderOrder={50} userData={{ xrHint: text }}>
      <spriteMaterial map={texture} depthTest={false} depthWrite={false} transparent sizeAttenuation toneMapped={false} />
    </sprite>
  )
}
