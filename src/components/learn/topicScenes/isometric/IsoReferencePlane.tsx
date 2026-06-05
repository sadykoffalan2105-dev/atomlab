import { Suspense, useEffect, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { learnRefImageCandidates } from '../../../../learn/learnRefImage'

function PlaneWithTexture({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return (
    <mesh rotation={[-Math.PI / 2.15, 0.35, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[4.2, 2.45]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/** Проверяет, есть ли файл референса в public (HEAD). */
export function useLearnRefImageUrl(sceneId: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const candidates = learnRefImageCandidates(sceneId)
    ;(async () => {
      for (const u of candidates) {
        try {
          const r = await fetch(u, { method: 'HEAD' })
          if (r.ok) {
            if (!cancelled) setUrl(u)
            return
          }
        } catch {
          /* offline dev */
        }
      }
      if (!cancelled) setUrl(null)
    })()
    return () => {
      cancelled = true
    }
  }, [sceneId])
  return url
}

export function IsoReferencePlane({ sceneId }: { sceneId: string }) {
  const url = useLearnRefImageUrl(sceneId)
  if (!url) return null
  return (
    <Suspense fallback={null}>
      <PlaneWithTexture url={url} />
    </Suspense>
  )
}
