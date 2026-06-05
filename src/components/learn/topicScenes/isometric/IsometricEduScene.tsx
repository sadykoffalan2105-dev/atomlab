import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import type { IsometricSceneDef } from '../../../../learn/learnIsometricScenes'
import { IsoLabel } from './IsoLabel'
import { IsoPlatform, PropByType } from './isometricProps'
import { IsoReferencePlane, useLearnRefImageUrl } from './IsoReferencePlane'

export function IsometricEduScene({
  def,
  sceneId,
  autoRotate = false,
  forceProcedural = false,
}: {
  def: IsometricSceneDef
  sceneId: string
  autoRotate?: boolean
  /** Не подставлять PNG из refs (для генерации скриншотов). */
  forceProcedural?: boolean
}) {
  const root = useRef<THREE.Group>(null)
  const refUrlRaw = useLearnRefImageUrl(sceneId)
  const refUrl = forceProcedural ? null : refUrlRaw
  useFrame((_, d) => {
    if (root.current && autoRotate) root.current.rotation.y += d * 0.06
  })

  if (refUrl) {
    return (
      <>
        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 4]} intensity={0.85} color="#ffffff" />
        <group ref={root}>
          <IsoReferencePlane sceneId={sceneId} />
        </group>
      </>
    )
  }

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} color="#fff8f0" />
      <directionalLight position={[-4, 6, -3]} intensity={0.45} color={def.accent} />
      <pointLight position={[0, 3, 2]} intensity={0.6} color={def.accent} distance={14} />

      <group ref={root}>
        {def.centerTitle ? (
          <>
            {def.centerProp ? (
              <PropByType type={def.centerProp.type} position={def.centerProp.position} scale={def.centerProp.scale ?? 1.2} color={def.centerProp.color} />
            ) : null}
            <IsoLabel position={[0, 1.55, 0]} variant="title">
              {def.centerTitle}
            </IsoLabel>
          </>
        ) : null}

        {def.panels.map((panel, pi) => (
          <group key={pi}>
            <IsoPlatform position={panel.platformPos} size={panel.platformSize ?? [1.35, 0.1, 1.05]} color={panel.platformColor ?? '#eef1f8'} />
            <IsoLabel position={panel.titlePos} variant="banner">
              {panel.title}
            </IsoLabel>
            {panel.props.map((pr, i) => (
              <PropByType key={i} type={pr.type} position={pr.position} color={pr.color} scale={pr.scale} />
            ))}
            {panel.labels.map((lb, i) => (
              <IsoLabel key={i} position={lb.position} variant="chip">
                {lb.text}
              </IsoLabel>
            ))}
          </group>
        ))}
      </group>
    </>
  )
}
